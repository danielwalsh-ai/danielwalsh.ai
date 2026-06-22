'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { Resend } = require('resend');
const GoCardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ════════════════════════════════════
   MIDDLEWARE
════════════════════════════════════ */
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'https://danielwalsh.ai' }));
app.use(express.json());
app.use(express.static('public')); // serves danielwalsh.html + admin.html

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests' } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Chat rate limit exceeded' } });
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Booking rate limit exceeded' } });

app.use('/api/', apiLimiter);

/* ════════════════════════════════════
   DATABASE — PostgreSQL
════════════════════════════════════ */
const db = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(255) NOT NULL,
      email         VARCHAR(255) NOT NULL,
      company       VARCHAR(255),
      service       VARCHAR(255) NOT NULL,
      price         INTEGER NOT NULL,
      date          DATE NOT NULL,
      time_slot     VARCHAR(10) NOT NULL,
      status        VARCHAR(50) DEFAULT 'pending',
      gc_payment_id VARCHAR(255),
      gc_mandate_id VARCHAR(255),
      make_notified BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, time_slot)
    );

    CREATE TABLE IF NOT EXISTS availability (
      id        SERIAL PRIMARY KEY,
      date      DATE NOT NULL,
      time_slot VARCHAR(10) NOT NULL,
      available BOOLEAN DEFAULT TRUE,
      UNIQUE(date, time_slot)
    );
  `);
  console.log('✓ Database ready');
}

/* ════════════════════════════════════
   SERVICES
════════════════════════════════════ */
const resend = new Resend(process.env.RESEND_API_KEY);

const gocardless = GoCardless(
  process.env.GOCARDLESS_ACCESS_TOKEN,
  constants.Environments.Live
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ════════════════════════════════════
   HELPERS
════════════════════════════════════ */
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPrice(pence) {
  if (pence === 0) return 'Free';
  return '£' + (pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

function verifyAdminToken(req) {
  const token = req.headers['x-admin-token'];
  return token && token === process.env.ADMIN_TOKEN;
}

/* ════════════════════════════════════
   API — AVAILABILITY
════════════════════════════════════ */

// GET /api/availability?month=2026-06
// Returns available slots for a month (public)
app.get('/api/availability', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    }

    const start = `${month}-01`;
    const end   = `${month}-31`;

    // Get booked slots
    const booked = await db.query(
      `SELECT date::text, time_slot FROM bookings
       WHERE date BETWEEN $1 AND $2 AND status != 'cancelled'`,
      [start, end]
    );

    // Get manually blocked slots
    const blocked = await db.query(
      `SELECT date::text, time_slot FROM availability
       WHERE date BETWEEN $1 AND $2 AND available = FALSE`,
      [start, end]
    );

    const unavailable = {};
    [...booked.rows, ...blocked.rows].forEach(({ date, time_slot }) => {
      if (!unavailable[date]) unavailable[date] = [];
      unavailable[date].push(time_slot);
    });

    res.json({ month, unavailable });
  } catch (err) {
    console.error('Availability error:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

/* ════════════════════════════════════
   API — BOOKINGS
════════════════════════════════════ */

// POST /api/bookings/initiate
// Step 1: Validate slot, create pending booking, return GoCardless redirect URL
app.post('/api/bookings/initiate', bookingLimiter, async (req, res) => {
  const { name, email, company, service, price, date, time_slot } = req.body;

  // Validate
  if (!name || !email || !service || !date || !time_slot) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  try {
    // Check slot is still free
    const existing = await db.query(
      `SELECT id FROM bookings WHERE date = $1 AND time_slot = $2 AND status != 'cancelled'`,
      [date, time_slot]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This slot has just been booked. Please choose another time.' });
    }

    const priceInt = parseInt(price) || 0;

    // For free bookings (discovery call), skip GoCardless
    if (priceInt === 0) {
      const result = await db.query(
        `INSERT INTO bookings (name, email, company, service, price, date, time_slot, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed') RETURNING id`,
        [name, email, company || null, service, 0, date, time_slot]
      );
      const bookingId = result.rows[0].id;
      await sendConfirmationEmail({ name, email, service, date, time_slot, price: 0, bookingId });
      await notifyMake({ bookingId, name, email, company, service, price: 0, date, time_slot, status: 'confirmed' });
      return res.json({ success: true, bookingId, free: true });
    }

    // Create GoCardless billing request for paid bookings
    const billingRequest = await gocardless.billingRequests.create({
      payment_request: {
        description: `${service} — ${formatDate(date)} at ${time_slot}`,
        amount: priceInt * 100, // GoCardless uses pence
        currency: 'GBP',
        app_fee: 0,
      },
    });

    const flow = await gocardless.billingRequestFlows.create({
      redirect_uri: `${process.env.BASE_URL}/api/bookings/confirm`,
      exit_uri:     `${process.env.BASE_URL}/#booking`,
      billing_request: { id: billingRequest.id },
      prefilled_customer: { given_name: name.split(' ')[0], family_name: name.split(' ').slice(1).join(' ') || '', email },
    });

    // Store pending booking
    await db.query(
      `INSERT INTO bookings (name, email, company, service, price, date, time_slot, status, gc_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
       ON CONFLICT (date, time_slot) DO NOTHING`,
      [name, email, company || null, service, priceInt, date, time_slot, billingRequest.id]
    );

    res.json({ success: true, redirectUrl: flow.authorisation_url });

  } catch (err) {
    console.error('Booking initiate error:', err);
    res.status(500).json({ error: 'Failed to create booking. Please try again.' });
  }
});

// GET /api/bookings/confirm — GoCardless redirect after payment
app.get('/api/bookings/confirm', async (req, res) => {
  const { billing_request_id } = req.query;
  if (!billing_request_id) return res.redirect('/?error=missing_id#booking');

  try {
    const billingRequest = await gocardless.billingRequests.find(billing_request_id);
    const paymentId = billingRequest.payment_request?.links?.payment;

    await db.query(
      `UPDATE bookings SET status='confirmed', gc_payment_id=$1 WHERE gc_payment_id=$2`,
      [paymentId || billing_request_id, billing_request_id]
    );

    const booking = await db.query(
      `SELECT * FROM bookings WHERE gc_payment_id = $1`,
      [paymentId || billing_request_id]
    );

    if (booking.rows.length > 0) {
      const b = booking.rows[0];
      await sendConfirmationEmail({ ...b, bookingId: b.id });
      await notifyMake({ ...b, bookingId: b.id, status: 'confirmed' });
    }

    res.redirect('/?confirmed=true#booking');
  } catch (err) {
    console.error('Booking confirm error:', err);
    res.redirect('/?error=payment_failed#booking');
  }
});

// GoCardless webhook (payment events)
app.post('/api/webhooks/gocardless', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['webhook-signature'];
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;

  // Verify signature
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  if (sig !== expected) return res.status(401).send('Invalid signature');

  const events = JSON.parse(req.body).events;
  for (const event of events) {
    if (event.resource_type === 'payments') {
      const { id: paymentId, status } = event.links || {};
      if (event.action === 'paid_out') {
        await db.query(`UPDATE bookings SET status='paid' WHERE gc_payment_id=$1`, [paymentId]);
      }
      if (event.action === 'failed') {
        await db.query(`UPDATE bookings SET status='payment_failed' WHERE gc_payment_id=$1`, [paymentId]);
      }
    }
  }
  res.status(200).send('ok');
});

/* ════════════════════════════════════
   API — AI CHAT PROXY
════════════════════════════════════ */
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: `You are the AI assistant for Daniel Walsh's AI consultancy (danielwalsh.ai). 
Daniel is a UK-based AI consultant certified by Google, Oxford University, and MIT.
Services: Strategy & Advisory £500/session (60 min), AI Implementation £1,500/day, Training & Workshops £1,200/day, Fractional AI Officer £5,000/month (25hrs, 12-month minimum).
Be concise, confident, and professional. Max 2-3 sentences. Never fabricate case studies or client names.
Always encourage booking a free discovery call for detailed questions.`,
      messages: [{ role: 'user', content: message }],
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat unavailable' });
  }
});

/* ════════════════════════════════════
   API — ADMIN (protected)
════════════════════════════════════ */

// POST /api/admin/login
app.post('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  const { username, password } = req.body;
  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass = password === process.env.ADMIN_PASSWORD;
  if (validUser && validPass) {
    res.json({ token: process.env.ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET /api/admin/bookings
app.get('/api/admin/bookings', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  try {
    const result = await db.query(
      `SELECT id, name, email, company, service, price, date::text, time_slot, status, created_at
       FROM bookings ORDER BY date DESC, time_slot DESC LIMIT 100`
    );
    res.json({ bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PATCH /api/admin/bookings/:id
app.patch('/api/admin/bookings/:id', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  const { status } = req.body;
  const allowed = ['confirmed', 'completed', 'cancelled', 'pending'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await db.query(`UPDATE bookings SET status=$1 WHERE id=$2`, [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// GET /api/admin/availability/:date
app.get('/api/admin/availability/:date', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  try {
    const { date } = req.params;
    const slots = await db.query(
      `SELECT time_slot, available FROM availability WHERE date = $1`, [date]
    );
    const booked = await db.query(
      `SELECT time_slot FROM bookings WHERE date = $1 AND status != 'cancelled'`, [date]
    );
    res.json({
      date,
      slots: slots.rows,
      booked: booked.rows.map(r => r.time_slot),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// PUT /api/admin/availability
app.put('/api/admin/availability', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  const { date, time_slot, available } = req.body;
  if (!date || !time_slot || typeof available !== 'boolean') {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    await db.query(
      `INSERT INTO availability (date, time_slot, available)
       VALUES ($1, $2, $3)
       ON CONFLICT (date, time_slot) DO UPDATE SET available = $3`,
      [date, time_slot, available]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

/* ════════════════════════════════════
   EMAIL — RESEND
════════════════════════════════════ */
async function sendConfirmationEmail({ name, email, service, date, time_slot, price, bookingId }) {
  const dateFormatted = formatDate(date);
  const priceFormatted = formatPrice(price);

  // Confirmation to client
  await resend.emails.send({
    from: 'Daniel Walsh AI <hello@danielwalsh.ai>',
    to: email,
    subject: `Booking confirmed — ${service}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#07070f;color:#f0f0f8;padding:40px;border-radius:16px;">
        <div style="margin-bottom:32px;">
          <div style="display:inline-block;background:#f0a030;color:#07070f;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;padding:8px 14px;border-radius:8px;letter-spacing:-0.3px;">DW</div>
        </div>
        <h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">You're booked in.</h1>
        <p style="color:rgba(240,240,248,0.6);margin-bottom:32px;">Here's your booking summary:</p>
        <div style="background:#0d0f1c;border:1px solid rgba(240,240,248,0.08);border-radius:12px;padding:24px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(240,240,248,0.06);">
            <span style="color:rgba(240,240,248,0.5);">Service</span><strong>${service}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(240,240,248,0.06);">
            <span style="color:rgba(240,240,248,0.5);">Date</span><strong>${dateFormatted}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(240,240,248,0.06);">
            <span style="color:rgba(240,240,248,0.5);">Time</span><strong>${time_slot}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;">
            <span style="color:rgba(240,240,248,0.5);">Total</span><strong style="color:#f0a030;">${priceFormatted}</strong>
          </div>
        </div>
        <p style="color:rgba(240,240,248,0.6);font-size:14px;margin-bottom:8px;">A video link will be sent 24 hours before your session.</p>
        <p style="color:rgba(240,240,248,0.6);font-size:14px;">To reschedule, reply to this email at least 24 hours before your session.</p>
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(240,240,248,0.06);font-size:12px;color:rgba(240,240,248,0.3);">
          danielwalsh.ai · London, UK · hello@danielwalsh.ai
        </div>
      </div>
    `,
  });

  // Alert to Daniel
  await resend.emails.send({
    from: 'danielwalsh.ai <hello@danielwalsh.ai>',
    to: 'hello@danielwalsh.ai',
    subject: `New booking: ${name} — ${service}`,
    html: `
      <p><strong>New booking #${bookingId}</strong></p>
      <p><strong>Client:</strong> ${name} (${email})</p>
      <p><strong>Service:</strong> ${service}</p>
      <p><strong>Date:</strong> ${dateFormatted} at ${time_slot}</p>
      <p><strong>Value:</strong> ${priceFormatted}</p>
    `,
  });
}

/* ════════════════════════════════════
   MAKE WEBHOOK
════════════════════════════════════ */
async function notifyMake(booking) {
  if (!process.env.MAKE_WEBHOOK_URL) return;
  try {
    await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    });
  } catch (err) {
    console.error('Make webhook error:', err.message);
  }
}

/* ════════════════════════════════════
   HEALTH CHECK
════════════════════════════════════ */
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

/* ════════════════════════════════════
   START
════════════════════════════════════ */
initDB().then(() => {
  app.listen(PORT, () => console.log(`✓ danielwalsh.ai server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
