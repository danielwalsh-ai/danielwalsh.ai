# danielwalsh.ai — Features & Build Scope

Live at **https://danielwalsh.ai** · Lighthouse (incognito): **96 Performance · 95 Accessibility · 100 Best Practices · 100 SEO**

Stack: Node.js/Express · PostgreSQL · vanilla JS (no frameworks, no build step) · Docker · Coolify on Hetzner · ~3,300 lines of first-party code across 8 pages.

---

## 1. Public website

- **Jarvis HUD design system** — pitch-black canvas with a faint cyan graph-paper grid, neon-cyan glowing hairline borders throughout, bracketed `[ section ]` labels, corner reticles on key panels, glowing orange reserved for CTAs and prices.
- **Hero** — retouched circular portrait with HUD ring, positioning eyebrow, headline, one-line hook, exactly-150-word offer copy (four services, fixed pricing, credentials, no-kickbacks pledge, worldwide), dual CTAs.
- **Micro-interactions** — service cards tilt toward the cursor (3D parallax), all primary buttons have click ripples and a glitch shudder on hover; everything honours `prefers-reduced-motion`.
- **Six SEO content pages** — four service pages (Strategy & Advisory, AI Implementation, Training & Workshops, Fractional AI Officer), About, and FAQ; shared stylesheet, unique metadata each.
- **Responsive** across desktop/tablet/mobile breakpoints.

## 2. Interactive Earth globe (lead capture)

- Canvas-rendered 3D Earth with **real dotted continents** (world coastline data rasterised to a 2° grid and baked into the page — zero runtime lookups).
- Auto-rotates; **drag to spin** with momentum (mouse + touch).
- **Click to drop a pin** → the form greets by country ("Nice spot — France.") via an embedded 180-country lookup grid, with coastal-click tolerance and an ocean easter egg.
- **Email capture = newsletter signup** (honest consent copy, persistent call-to-action badge on the panel).
- Previous visitors render as cyan dots (locations only — **emails are never exposed** by the public API); your own pin glows amber and persists.
- Every pin **emails a lead alert** to hello@danielwalsh.ai.
- The four process outcomes orbit the globe as pulsing labelled nodes.

## 3. Booking & payments

- Service selector with locked pricing (£500 session / £1,500 day / £1,200 day / £5,000 month).
- **Live calendar** — real dates, weekends blocked, availability fetched from the database per month (booked + manually blocked slots).
- Free discovery calls confirm instantly; paid bookings redirect through **GoCardless (live)**.
- **Signature-verified GoCardless webhooks** update payment status automatically (timing-safe HMAC on the raw body).
- Branded **confirmation emails** to the client + alert to Daniel via Resend from hello@danielwalsh.ai.
- Optional **Make.com webhook** fires on every confirmed booking for downstream automation.
- Double-booking prevented at the database level (unique date+slot).

## 4. AI chat widget

- Site-wide chat powered by **Claude** through a server-side proxy (key never exposed), briefed with services, pricing and tone; graceful canned fallbacks if the API is down; rate-limited.

## 5. Automated newsletter ("The AI Briefing")

- **Fully automated, zero-touch monthly cycle** (1st of month, 08:00 UTC via Coolify cron):
  1. Pulls fresh articles from three curated AI feeds (Simon Willison, MIT Technology Review AI, The Verge AI).
  2. **Claude writes the issue** — intro, three practical business tips, three picked resources (hard-restricted to real fetched URLs), outro. British English, no hype.
  3. Branded dark-theme email sent via Resend to every globe subscriber.
- **Signed one-click unsubscribe** (HMAC per recipient) honoured automatically.
- Safety rails: 20-day double-send guard, refuses thin issues, every issue logged.
- Admin endpoint to trigger an issue on demand.

## 6. Admin portal

- Password-protected dashboard (`/admin.html`, noindexed): bookings list with status management, per-date availability blocking, token-authenticated API.

## 7. SEO & structured data

- Unique titles/descriptions/canonicals/Open Graph on all 8 pages.
- **Schema.org JSON-LD**: ProfessionalService with full offer catalogue, Service ×4, Person, FAQPage (rich-result eligible), BreadcrumbList.
- sitemap.xml + robots.txt; **Google Search Console verified, sitemap submitted**.
- Clean URLs (`/about`, `/services/...`).

## 8. Security & hardening

- **Strict Content-Security-Policy** — `script-src 'self'` (no inline execution), all JS in external files.
- **HSTS** one-year, includeSubDomains, preload.
- Per-endpoint rate limiting (API / chat / bookings / pins).
- Helmet security headers, non-root Docker user, secrets only in Coolify env, admin token auth, graceful boot with missing credentials.

## 9. Infrastructure & operations

- Dockerised, deployed on **Coolify (Hetzner)** with automatic **Let's Encrypt SSL**.
- **Push-to-deploy**: every push to GitHub `main` builds and ships automatically; failed builds are health-checked and **rolled back with zero downtime**.
- PostgreSQL with automatic schema creation (bookings, availability, globe_pins, newsletter_unsubs, newsletter_issues).
- Container health checks; scheduled task for the newsletter.

---

## Integrations

| Service | Role |
|---|---|
| GoCardless (live) | Payment collection + status webhooks |
| Resend | All transactional + newsletter email from the domain |
| Anthropic (Claude) | Chat widget + newsletter authorship |
| Make.com | Booking event webhook (extensible automation) |
| Google Search Console | Indexing + search analytics |
| GitHub + Coolify | CI/CD pipeline |

## Deliberately parked (recoverable from git history)

- Cinematic AI-generated hero video with seamless crossfade loop + scroll-reactive speed
- Full hero HUD dashboard (status bar, streaming terminal, waveform, diagnostics, voice-command bar with real speech recognition)
- 4D stardust torus full-page parallax backdrop + central particle vortex
