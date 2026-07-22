import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PORT = 3000,
  APP_PASSWORD,
  SESSION_SECRET,
  AIRTABLE_TOKEN,
  AIRTABLE_BASE = 'appbuQKkmnK569H1r',
  LEADS_TABLE = 'tblP2SYi9gvixmxRl',
  OUTREACH_TABLE = 'tblFXxG9OtQKF4bkQ',
} = process.env;

for (const [k, v] of Object.entries({ APP_PASSWORD, SESSION_SECRET, AIRTABLE_TOKEN })) {
  if (!v) { console.error(`Missing required env var: ${k}`); process.exit(1); }
}

const app = express();
app.use(express.json({ limit: '256kb' }));
app.set('trust proxy', 1);

/* ---------- auth ---------- */

const DAY = 24 * 60 * 60 * 1000;

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}
function issueToken() {
  const exp = String(Date.now() + 7 * DAY);
  return `${exp}.${sign(exp)}`;
}
function validToken(token) {
  if (!token || !token.includes('.')) return false;
  const [exp, sig] = token.split('.');
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// Throttle password guessing.
const attempts = new Map();
function tooManyAttempts(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > 15 * 60 * 1000) { attempts.delete(ip); return false; }
  return rec.count >= 10;
}
function noteAttempt(ip) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > 15 * 60 * 1000) attempts.set(ip, { count: 1, first: Date.now() });
  else rec.count += 1;
}

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes.' });

  const supplied = Buffer.from(String(req.body?.password ?? ''));
  const actual = Buffer.from(APP_PASSWORD);
  const ok = supplied.length === actual.length && crypto.timingSafeEqual(supplied, actual);

  if (!ok) { noteAttempt(ip); return res.status(401).json({ error: 'Wrong password.' }); }

  attempts.delete(ip);
  res.setHeader('Set-Cookie', [
    `dw_session=${issueToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`,
  ]);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'dw_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  if (validToken(readCookie(req, 'dw_session'))) return next();
  res.status(401).json({ error: 'Not signed in.' });
}

/* ---------- airtable proxy ---------- */

const AT = 'https://api.airtable.com/v0';

async function airtable(pathname, { method = 'GET', body, query } = {}) {
  const url = new URL(`${AT}/${AIRTABLE_BASE}/${pathname}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const message = data?.error?.message || data?.error?.type || `Airtable returned ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function wrap(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (err) {
      console.error(err);
      res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
    }
  };
}

app.get('/api/leads', requireAuth, wrap(async (req, res) => {
  const all = [];
  let offset;
  do {
    const page = await airtable(LEADS_TABLE, {
      query: { pageSize: '100', ...(offset ? { offset } : {}) },
    });
    all.push(...page.records);
    offset = page.offset;
  } while (offset);

  all.sort((a, b) => (b.createdTime || '').localeCompare(a.createdTime || ''));
  res.json({ records: all });
}));

const WRITABLE = new Set(['Name', 'Email', 'Company', 'Status', 'Notes', 'Last Contacted', 'Unsubscribed', 'Job Title', 'Industry', 'Domain', 'LinkedIn', 'Consent Basis']);

app.patch('/api/leads/:id', requireAuth, wrap(async (req, res) => {
  const fields = {};
  for (const [k, v] of Object.entries(req.body?.fields || {})) {
    if (WRITABLE.has(k)) fields[k] = v;
  }
  if (!Object.keys(fields).length) return res.status(400).json({ error: 'No editable fields supplied.' });

  const data = await airtable(`${LEADS_TABLE}/${encodeURIComponent(req.params.id)}`, {
    method: 'PATCH',
    body: { fields, typecast: true },
  });
  res.json(data);
}));

app.get('/api/outreach', requireAuth, wrap(async (req, res) => {
  const all = [];
  let offset;
  do {
    const page = await airtable(OUTREACH_TABLE, {
      query: { pageSize: '100', ...(offset ? { offset } : {}) },
    });
    all.push(...page.records);
    offset = page.offset;
  } while (offset);
  res.json({ records: all });
}));

app.get('/api/session', (req, res) => {
  res.json({ signedIn: validToken(readCookie(req, 'dw_session')) });
});

/* ---------- static ---------- */

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`CRM running on :${PORT}`));
