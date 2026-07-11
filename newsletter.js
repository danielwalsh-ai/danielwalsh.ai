'use strict';
/*
  Automated AI newsletter for danielwalsh.ai
  ------------------------------------------
  Pipeline: fetch fresh items from curated AI feeds → Claude writes the issue
  (3 practical tips + 3 picked resources, UK tone) → branded email sent via
  Resend to every globe-pin subscriber who hasn't unsubscribed → issue logged.

  Run modes:
    node newsletter.js            — full run (guarded: skips if sent <20 days ago)
    node newsletter.js --force    — ignore the 20-day guard
    node newsletter.js --dry      — generate content, print, send nothing
  Also exported as run() for the admin trigger route in server.js.
*/

const { Pool } = require('pg');
const { Resend } = require('resend');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
require('dotenv').config();

const FEEDS = [
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
  { name: 'MIT Technology Review — AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { name: 'The Verge — AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
];

function stripTags(s) { return (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }

async function fetchFeedItems() {
  const items = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'danielwalsh.ai newsletter/1.0' }, signal: AbortSignal.timeout(15000) });
      const xml = await res.text();
      // naive RSS <item> and Atom <entry> parsing — good enough for titles/links
      const chunks = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/g)].map(m => m[0]).slice(0, 8);
      for (const c of chunks) {
        const title = stripTags((c.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '');
        let link = (c.match(/<link[^>]*href="([^"]+)"/) || [])[1] || stripTags((c.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '');
        const desc = stripTags((c.match(/<(description|summary|content)[^>]*>([\s\S]*?)<\/\1>/) || [])[2] || '').slice(0, 280);
        if (title && link && link.startsWith('http')) items.push({ source: feed.name, title, link, desc });
      }
    } catch (err) {
      console.error(`feed failed (${feed.name}):`, err.message);
    }
  }
  return items;
}

async function writeIssue(feedItems) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const prompt = `You write the monthly AI newsletter for Daniel Walsh (danielwalsh.ai), an AI consultant certified by Google, Oxford and MIT who helps businesses worldwide put AI to work. Audience: business owners and directors — smart, busy, allergic to hype.

Write the ${month} issue. British spelling. Plain, confident, practical. Never fabricate statistics, tools, or links.

You are given recent articles below. Pick the 3 most genuinely useful for business readers as "resources" — you MUST use their exact URLs and may only pick from this list.

ARTICLES:
${feedItems.map((it, i) => `${i + 1}. [${it.source}] ${it.title} — ${it.link}\n   ${it.desc}`).join('\n')}

Respond with ONLY valid JSON, no markdown fences:
{
  "subject": "short email subject, no clickbait, max 60 chars",
  "intro": "2-3 sentence warm opener from Daniel, first person",
  "tips": [ {"title": "...", "body": "3-4 sentences of genuinely actionable advice a business could act on this month"} ] (exactly 3),
  "resources": [ {"title": "...", "url": "EXACT url from the list", "why": "one sentence on why it's worth their time"} ] (exactly 3),
  "outro": "1-2 sentences, warm close, mention they can book a free discovery call"
}`;

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = resp.content[0].text.trim().replace(/^```json?\s*|\s*```$/g, '');
  const issue = JSON.parse(text);
  // hard guard: resources must come from the fetched list
  const allowed = new Set(feedItems.map(i => i.link));
  issue.resources = (issue.resources || []).filter(r => allowed.has(r.url));
  return issue;
}

function unsubToken(email) {
  return crypto.createHmac('sha256', process.env.NEWSLETTER_SECRET || 'dev-secret')
    .update(email.toLowerCase()).digest('hex').slice(0, 24);
}

function renderEmail(issue, email) {
  const base = process.env.BASE_URL || 'https://danielwalsh.ai';
  const unsub = `${base}/api/newsletter/unsubscribe?e=${encodeURIComponent(Buffer.from(email.toLowerCase()).toString('base64'))}&t=${unsubToken(email)}`;
  const tip = (t, i) => `
    <div style="margin-bottom:22px;">
      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#00b8cc;margin-bottom:6px;">TIP ${String(i + 1).padStart(2, '0')}</div>
      <div style="font-size:16px;font-weight:700;color:#f0f0f8;margin-bottom:6px;">${t.title}</div>
      <div style="font-size:14px;line-height:1.7;color:#aab2c0;">${t.body}</div>
    </div>`;
  const res = (r) => `
    <div style="margin-bottom:16px;">
      <a href="${r.url}" style="font-size:15px;font-weight:600;color:#f0a030;text-decoration:none;">${r.title} →</a>
      <div style="font-size:13px;line-height:1.6;color:#aab2c0;margin-top:3px;">${r.why}</div>
    </div>`;
  return `
  <div style="background:#000;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#040c12;border:1px solid rgba(0,229,255,0.25);border-radius:12px;padding:36px 32px;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:inline-block;background:#f0a030;color:#07070f;font-weight:800;font-size:15px;padding:8px 13px;border-radius:8px;">DW</div>
      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#00b8cc;margin:22px 0 8px;">[ THE AI BRIEFING ]</div>
      <h1 style="font-size:22px;color:#ffffff;margin:0 0 18px;">${issue.subject}</h1>
      <p style="font-size:14px;line-height:1.7;color:#aab2c0;margin-bottom:28px;">${issue.intro}</p>
      ${issue.tips.map(tip).join('')}
      <div style="border-top:1px solid rgba(0,229,255,0.2);margin:26px 0;padding-top:22px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#00b8cc;margin-bottom:14px;">[ WORTH YOUR TIME ]</div>
        ${issue.resources.map(res).join('')}
      </div>
      <p style="font-size:14px;line-height:1.7;color:#aab2c0;">${issue.outro}</p>
      <a href="${base}/#booking" style="display:inline-block;background:#f0a030;color:#07070f;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;text-decoration:none;margin-top:10px;">Book a free discovery call →</a>
      <div style="border-top:1px solid rgba(0,229,255,0.15);margin-top:30px;padding-top:16px;font-size:11px;color:#5b6078;">
        You're receiving this because you pinned yourself on the danielwalsh.ai globe.<br>
        <a href="${unsub}" style="color:#5b6078;">Unsubscribe</a> · danielwalsh.ai
      </div>
    </div>
  </div>`;
}

async function run(opts = {}) {
  const db = new Pool({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    // guard against double sends
    if (!opts.force && !opts.dry) {
      const recent = await db.query(`SELECT id FROM newsletter_issues WHERE sent_at > NOW() - INTERVAL '20 days' LIMIT 1`);
      if (recent.rows.length) { console.log('Issue already sent in the last 20 days — skipping.'); return { skipped: true }; }
    }

    console.log('Fetching feeds…');
    const items = await fetchFeedItems();
    if (items.length < 5) throw new Error(`only ${items.length} feed items — refusing to write a thin issue`);
    console.log(`${items.length} items. Writing issue…`);
    const issue = await writeIssue(items);
    console.log('Subject:', issue.subject);

    if (opts.dry) { console.log(JSON.stringify(issue, null, 2)); return { dry: true, issue }; }

    const subs = await db.query(`
      SELECT DISTINCT lower(email) AS email FROM globe_pins
      WHERE lower(email) NOT IN (SELECT email FROM newsletter_unsubs)`);
    const list = subs.rows.map(r => r.email);
    console.log(`${list.length} subscriber(s).`);

    let sent = 0;
    for (const email of list) {
      try {
        await resend.emails.send({
          from: 'Daniel Walsh <hello@danielwalsh.ai>',
          to: email,
          subject: issue.subject,
          html: renderEmail(issue, email),
        });
        sent++;
        await new Promise(r => setTimeout(r, 600)); // stay under Resend rate limits
      } catch (err) { console.error(`send failed (${email}):`, err.message); }
    }

    await db.query(`INSERT INTO newsletter_issues (subject, recipients) VALUES ($1, $2)`, [issue.subject, sent]);
    console.log(`Done — sent to ${sent}/${list.length}.`);
    return { sent, total: list.length, subject: issue.subject };
  } finally {
    await db.end();
  }
}

module.exports = { run, unsubToken };

if (require.main === module) {
  run({ force: process.argv.includes('--force'), dry: process.argv.includes('--dry') })
    .then(r => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch(err => { console.error('Newsletter failed:', err); process.exit(1); });
}
