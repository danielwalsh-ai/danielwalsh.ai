// Instagram auto-graphics: polls the Airtable Content Calendar for Graphic rows
// with no Asset attached, renders a branded 1080x1350 HUD graphic from the row's
// Title/Caption/Pillar, serves it from /media/ig-auto, and attaches it to the row.
// The 09:00 Make scenario then posts Approved rows exactly as before.
// Brand rules: CLAUDE.md "JARVIS HUD" table. One amber accent, cyan structure.

const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const AIRTABLE_BASE = 'appbuQKkmnK569H1r';
const CONTENT_TABLE = 'Content Calendar';
const SITE = 'https://danielwalsh.ai';
const POLL_MS = 10 * 60 * 1000;
const OUT_DIR = path.join(__dirname, 'public', 'media', 'ig-auto');

const FONT_DIR = path.join(__dirname, 'assets', 'fonts');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SpaceGrotesk-Bold.ttf'), 'Space Grotesk Bold');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'SpaceGrotesk-Medium.ttf'), 'Space Grotesk Medium');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Inter-Regular.ttf'), 'Inter');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Inter-SemiBold.ttf'), 'Inter SemiBold');

const W = 1080, H = 1350;
const CYAN = '#00E5FF', AMBER = '#F0A030', WHITE = '#FFFFFF', BODY = '#9AA0B5';

// "Scout — Oil at $100 — check your fuel line" -> headline without the pipeline tag
function cleanTitle(title) {
  const parts = String(title || '').split(' — ');
  if (parts.length > 1 && /^(scout|graphic|vo|tool promo|launch)\b/i.test(parts[0])) parts.shift();
  // Brand rule: no em dashes in copy, anywhere
  return parts.join(': ').replace(/\s+—\s+/g, ': ').trim();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function renderGraphic({ title, caption, pillar }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Canvas: pitch black + faint cyan graph-paper grid
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,229,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 54; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 54; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Cyan corner brackets
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  const inset = 48, arm = 64;
  for (const [cx, cy, dx, dy] of [[inset, inset, 1, 1], [W - inset, inset, -1, 1], [inset, H - inset, 1, -1], [W - inset, H - inset, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * arm, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * arm);
    ctx.stroke();
  }

  // Top label: [ PILLAR ]
  const label = `[ ${String(pillar || 'DANIELWALSH.AI').toUpperCase()} ]`;
  ctx.fillStyle = CYAN;
  ctx.font = '28px "Space Grotesk Medium"';
  const spaced = label.split('').join('  ');
  ctx.textAlign = 'center';
  ctx.fillText(spaced, W / 2, 150);
  ctx.textAlign = 'left';

  // Headline: white Space Grotesk bold, wrapped, auto-shrinks to fit
  const headline = cleanTitle(title);
  let size = 82;
  let lines;
  do {
    ctx.font = `${size}px "Space Grotesk Bold"`;
    lines = wrapText(ctx, headline, W - 220);
    if (lines.length <= 5) break;
    size -= 8;
  } while (size > 54);
  const lineH = Math.round(size * 1.16);

  // One amber accent: short bar above the headline
  const headTop = 350;
  ctx.fillStyle = AMBER;
  ctx.fillRect(110, headTop - 64, 64, 8);

  ctx.fillStyle = WHITE;
  lines.forEach((l, i) => ctx.fillText(l, 110, headTop + size + i * lineH));

  // Sub-text: whole sentences from the caption's first paragraph, grey Inter.
  // Never cut mid-sentence: fit as many complete sentences as the budget allows.
  const para = (String(caption || '').split(/\n/).filter(Boolean)[0] || '')
    .replace(/\s+[—–]\s+/g, ': ');
  const sentences = para.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || (para ? [para] : []);
  let sub = '';
  for (const s of sentences) {
    if (sub && (sub + s).length > 230) break;
    sub += s;
  }
  sub = sub.trim();
  // single overlong sentence: back off to the last full word and mark the cut
  if (sub.length > 260) sub = sub.slice(0, 250).replace(/\s+\S*$/, '') + ' …';
  if (sub) {
    ctx.font = '34px "Inter"';
    ctx.fillStyle = BODY;
    const subLines = wrapText(ctx, sub, W - 220).slice(0, 5);
    const subTop = headTop + size + (lines.length - 1) * lineH + 90;
    subLines.forEach((l, i) => ctx.fillText(l, 110, subTop + i * 52));
  }

  // Footer: DW monogram (amber rounded square, dark text) + site URL
  const mSize = 76, mx = 110, my = H - 190;
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.roundRect(mx, my, mSize, mSize, 16);
  ctx.fill();
  ctx.fillStyle = '#181008';
  ctx.font = '32px "Space Grotesk Bold"';
  ctx.textAlign = 'center';
  ctx.fillText('DW', mx + mSize / 2, my + mSize / 2 + 11);

  ctx.textAlign = 'right';
  ctx.font = '34px "Inter SemiBold"';
  ctx.fillStyle = WHITE;
  const urlY = my + mSize / 2 + 12;
  ctx.fillText('danielwalsh', W - 110 - ctx.measureText('.ai').width, urlY);
  ctx.fillStyle = CYAN;
  ctx.fillText('.ai', W - 110, urlY);
  ctx.textAlign = 'left';

  return canvas.encode('jpeg', 92);
}

// Poll: any Graphic row with no Asset (not yet Posted) gets a generated graphic
async function generateMissing() {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return;
  try {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(CONTENT_TABLE)}`);
    url.searchParams.set('filterByFormula', "AND({Format}='Graphic', {Asset}='', {Status}!='Posted')");
    url.searchParams.set('maxRecords', '5');
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { console.error('IG graphics poll: Airtable returned', r.status); return; }
    const { records = [] } = await r.json();
    if (records.length) fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const rec of records) {
      const f = rec.fields || {};
      if (!f.Title) continue;
      const jpeg = await renderGraphic({
        title: f.Title,
        caption: f.Caption,
        pillar: f.Pillar && f.Pillar.name ? f.Pillar.name : f.Pillar,
      });
      const filename = `${rec.id}.jpg`;
      fs.writeFileSync(path.join(OUT_DIR, filename), jpeg);
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(CONTENT_TABLE)}/${rec.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Asset: [{ url: `${SITE}/media/ig-auto/${filename}`, filename: `${cleanTitle(f.Title).slice(0, 40)}.jpg` }] } }),
      });
      console.log('✓ IG graphic generated:', f.Title);
    }
  } catch (err) {
    console.error('IG graphics poll error:', err.message);
  }
}

function startPoller() {
  setTimeout(generateMissing, 30 * 1000);
  setInterval(generateMissing, POLL_MS);
}

module.exports = { startPoller, renderGraphic };
