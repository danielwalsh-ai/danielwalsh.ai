// Blog: server-rendered /blog pages fed from the Airtable "Blog Posts" table.
// Publishing flow mirrors the Instagram pipeline: the Content Scout scenario
// drafts rows, Daniel sets Status=Approved in Airtable, and the poller here
// publishes them (DB insert + row stamped Published). No secrets leave Coolify.

const AIRTABLE_BASE = 'appbuQKkmnK569H1r';
const BLOG_TABLE = 'Blog Posts';
const SITE = 'https://danielwalsh.ai';
const POLL_MS = 10 * 60 * 1000;

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Body HTML comes from our own pipeline via a token-authed Airtable table, but
// strip anything executable anyway — defence in depth alongside the CSP.
function sanitizeHtml(html) {
  return String(html ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"');
}

function slugify(title) {
  return String(title).toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const NAV = `
<nav>
  <a href="/" class="logo">
    <div class="logo-mark">DW</div>
    <div class="logo-text">danielwalsh<span>.ai</span></div>
  </a>
  <div class="nav-links">
    <a href="/#services">Services</a>
    <a href="/#process">Process</a>
    <a href="/about">About</a>
    <a href="/faq">FAQ</a>
    <a href="/tools/margin-vs-volume">Free tools</a>
    <a href="/blog" aria-current="page">Blog</a>
  </div>
  <a href="https://www.linkedin.com/in/daniel-walsh-7885aa3a" target="_blank" rel="noopener" class="nav-linkedin" aria-label="LinkedIn"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
  <a href="/#booking" class="nav-cta">Book a session →</a>
</nav>`;

const FOOTER = `
<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="footer-logo-row">
        <div class="logo-mark">DW</div>
        <span class="footer-wordmark">danielwalsh<span>.ai</span></span>
      </div>
      <p class="footer-tagline">Oxford · Google · MIT certified<br>AI consultancy · Worldwide</p>
      <a href="mailto:hello@danielwalsh.ai" class="footer-email">hello@danielwalsh.ai</a>
      <a href="https://www.linkedin.com/in/daniel-walsh-7885aa3a" target="_blank" rel="noopener" class="footer-linkedin" aria-label="LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
    </div>
    <div class="footer-cols">
      <div class="footer-col">
        <div class="footer-col-title">Services</div>
        <a href="/services/strategy-advisory">Strategy &amp; Advisory</a>
        <a href="/services/ai-implementation">AI Implementation</a>
        <a href="/services/training-workshops">Training &amp; Workshops</a>
        <a href="/services/fractional-ai-officer">Fractional AI Officer</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Company</div>
        <a href="/about">About</a>
        <a href="/faq">FAQ</a>
        <a href="/blog">Blog</a>
        <a href="/tools/margin-vs-volume">Margin vs Volume tool</a>
        <a href="/#process">How it works</a>
        <a href="/#booking">Book a session</a>
        <a href="mailto:hello@danielwalsh.ai">Contact</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Daniel Walsh AI Consultancy Ltd. All rights reserved.</span>
    <span><a href="mailto:hello@danielwalsh.ai">hello@danielwalsh.ai</a></span>
  </div>
</footer>`;

function pageShell({ title, description, canonical, jsonLd, main }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#07070f">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="danielwalsh.ai">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body>
${NAV}
<main>
${main}
</main>
${FOOTER}
</body>
</html>`;
}

function register(app, db) {
  // GET /blog — index
  app.get('/blog', async (req, res) => {
    let posts = [];
    try {
      const r = await db.query('SELECT slug, title, description, published_at FROM blog_posts ORDER BY published_at DESC LIMIT 100');
      posts = r.rows;
    } catch (err) {
      console.error('Blog index error:', err.message);
    }
    const list = posts.length
      ? posts.map(p => `
        <a class="related-grid-item" href="/blog/${esc(p.slug)}" style="display:block;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 26px;margin-bottom:16px;text-decoration:none;box-shadow:0 0 14px rgba(0,229,255,0.06), inset 0 0 0 1px rgba(0,229,255,0.06);">
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${esc(fmtDate(p.published_at))}</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:600;color:var(--white);margin-bottom:8px;">${esc(p.title)}</div>
          <div style="font-size:14px;color:var(--body);">${esc(p.description || '')}</div>
        </a>`).join('')
      : '<p class="page-lede">First posts land shortly. In the meantime, the <a href="/tools/margin-vs-volume">Margin vs Volume calculator</a> is free.</p>';
    res.send(pageShell({
      title: 'Blog | Daniel Walsh — AI for business owners',
      description: 'Plain-spoken notes on what AI actually does inside real firms: the hours it saves, the margin it moves, and what to ignore.',
      canonical: `${SITE}/blog`,
      jsonLd: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Blog', name: 'danielwalsh.ai blog', url: `${SITE}/blog` }),
      main: `
        <div class="breadcrumbs"><a href="/">Home</a> · Blog</div>
        <span class="page-eyebrow">The operator's read on AI</span>
        <h1>Blog</h1>
        <p class="page-lede">What actually matters this week for the hours and margin in your business. No hype, no press releases.</p>
        <div class="prose" style="margin-top:40px;">${list}</div>`,
    }));
  });

  // GET /blog/:slug — single post
  app.get('/blog/:slug', async (req, res, next) => {
    const slug = String(req.params.slug || '');
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return next();
    let post;
    try {
      const r = await db.query('SELECT slug, title, description, body_html, source_url, published_at FROM blog_posts WHERE slug = $1', [slug]);
      post = r.rows[0];
    } catch (err) {
      console.error('Blog post error:', err.message);
    }
    if (!post) return next();
    res.send(pageShell({
      title: `${post.title} | Daniel Walsh`,
      description: post.description || '',
      canonical: `${SITE}/blog/${post.slug}`,
      jsonLd: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: post.title, description: post.description || '',
        datePublished: post.published_at, url: `${SITE}/blog/${post.slug}`,
        author: { '@type': 'Person', name: 'Daniel Walsh', url: `${SITE}/about` },
      }),
      main: `
        <div class="breadcrumbs"><a href="/">Home</a> · <a href="/blog">Blog</a> · ${esc(post.title)}</div>
        <h1>${esc(post.title)}</h1>
        <p class="page-lede">${esc(fmtDate(post.published_at))}</p>
        <div class="prose">${sanitizeHtml(post.body_html)}</div>
        ${post.source_url ? `<p style="margin-top:32px;font-size:13px;color:var(--muted);">Prompted by: <a href="${esc(post.source_url)}" rel="noopener nofollow" target="_blank">${esc(post.source_url)}</a></p>` : ''}
        <div class="cta-band">
          <h2>Want this level of clarity on your own numbers?</h2>
          <p>Start with the free Margin vs Volume calculator — 30 seconds, no sign-up.</p>
          <a class="btn-primary" href="/tools/margin-vs-volume">Run your numbers →</a>
        </div>`,
    }));
  });

  // Dynamic sitemap: static pages + published posts (replaces the old static file)
  app.get('/sitemap.xml', async (req, res) => {
    const staticUrls = [
      ['/', 'weekly', '1.0'],
      ['/services/strategy-advisory', 'monthly', '0.9'],
      ['/services/ai-implementation', 'monthly', '0.9'],
      ['/services/training-workshops', 'monthly', '0.9'],
      ['/services/fractional-ai-officer', 'monthly', '0.9'],
      ['/about', 'monthly', '0.8'],
      ['/faq', 'monthly', '0.8'],
      ['/blog', 'daily', '0.8'],
      ['/tools/margin-vs-volume', 'monthly', '0.7'],
    ];
    let slugs = [];
    try {
      const r = await db.query('SELECT slug FROM blog_posts ORDER BY published_at DESC LIMIT 500');
      slugs = r.rows.map(x => x.slug);
    } catch { /* sitemap still serves the static pages if the DB is down */ }
    const urls = staticUrls
      .map(([p, cf, pr]) => `  <url><loc>${SITE}${p}</loc><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`)
      .concat(slugs.map(s => `  <url><loc>${SITE}/blog/${esc(s)}</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>`))
      .join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  });
}

// Poll Airtable for Approved rows and publish them
async function publishApproved(db) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return;
  try {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(BLOG_TABLE)}`);
    url.searchParams.set('filterByFormula', "{Status}='Approved'");
    url.searchParams.set('maxRecords', '5');
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { console.error('Blog poll: Airtable returned', r.status); return; }
    const { records = [] } = await r.json();
    for (const rec of records) {
      const f = rec.fields || {};
      if (!f.Title || !f['Body HTML']) continue;
      const slug = slugify(f.Slug || f.Title);
      if (!slug) continue;
      await db.query(
        `INSERT INTO blog_posts (slug, title, description, body_html, source_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET title = $2, description = $3, body_html = $4, source_url = $5`,
        [slug, f.Title, f.Description || '', sanitizeHtml(f['Body HTML']), f['Source URL'] || null]
      );
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(BLOG_TABLE)}/${rec.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Status: 'Published', 'Post URL': `${SITE}/blog/${slug}` }, typecast: true }),
      });
      console.log('✓ Blog published:', slug);
    }
  } catch (err) {
    console.error('Blog poll error:', err.message);
  }
}

function startPoller(db) {
  setTimeout(() => publishApproved(db), 20 * 1000);
  setInterval(() => publishApproved(db), POLL_MS);
}

module.exports = { register, startPoller };
