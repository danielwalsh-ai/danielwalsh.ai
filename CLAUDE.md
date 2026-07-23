# danielwalsh.ai — Project Context

Professional AI consultancy site for Daniel Walsh (KF Ltd, trading as danielwalsh.ai). Live production system — be careful with payments and booking logic.

## Stack & deployment

- **Frontend:** `public/` — `index.html` (self-contained: inline CSS/JS, no build step) plus content pages (`about.html`, `faq.html`, `services/*.html`, `tools/*.html`) which share `css/site.css` and external JS in `js/`. Clean URLs via `express.static` extensions (`/about` → `about.html`).
- **Admin:** `public/admin.html` — separate password-protected portal (dashboard, availability, bookings, settings).
- **Backend:** `server.js` — Node.js/Express. GoCardless payments (LIVE), Anthropic API proxy for the chat widget, PostgreSQL bookings, Resend emails, Make.com webhook forwarding, admin endpoints. CSP is `script-src 'self'` — **no inline `<script>` blocks and no direct browser calls to third parties**; new pages put JS in `/js/` and proxy external calls through the server.
- **CRM:** `crm/` — separate "Pipeline" app (Express + static UI over the Airtable CRM base). Deploys as its own Coolify resource (base directory `crm/`, port 3000) at `crm.danielwalsh.ai`, behind Cloudflare Access once configured. Env vars in `crm/env.example`.
- **Hosting:** Coolify at 178.104.154.216. Deploys automatically on push to GitHub main.
- **Database:** PostgreSQL on Coolify (internal hostname `dm8hs0r3fezjck2f411rixp3`).
- **Secrets:** all env vars live in Coolify — never hardcode keys, never commit them. Site env includes `MARGIN_TOOL_WEBHOOK_URL` (margin tool → Make).
- **DNS:** LIVE since 10 Jul 2026 — A records @ and www → 178.104.154.216, SSL via Let's Encrypt; Resend DNS verified (hello@danielwalsh.ai sends).

## Lead engine (Airtable + Make)

- **Airtable base "danielwalsh.ai CRM"** `appbuQKkmnK569H1r`: Leads `tblP2SYi9gvixmxRl`, Outreach Log `tblFXxG9OtQKF4bkQ`, Content Calendar `tblQJBsiHhNAympuL`.
- **Make (team 1672175, org 7610462, eu1):** "Margin vs Volume — Lead Intake" `6651895` (webhook → Airtable lead → branded numbers email to the visitor); "CRM — Outreach Send" `6653267` (15-min poll, sends Notes as email, stamps Last Contacted); "CRM — Reply Capture" `6653714` (inactive until token + full-scope hello@ Gmail connection added in UI).
- Margin tool lead flow: site form → `/api/tools/margin-lead` (server) → Make webhook + Resend alert to Daniel. Daniel gets ONE alert per lead (server-side); the Make scenario emails the visitor.
- Make HTTP modules to Airtable need all five advanced params (`shareCookies`, `followAllRedirects`, `useQuerystring`, `gzip`, `useMtls`) or they fail validation.

## Brand — JARVIS HUD (owner rebrand, 11 Jul 2026)

**These guidelines apply to EVERYTHING produced for danielwalsh.ai — site pages, Instagram/social graphics, emails, PDFs, the CRM UI, slide decks. No exceptions without Daniel's instruction.** If an older document (e.g. a handover file) shows the pre-11-Jul navy palette (`#07070F` canvas / `#12163A` panels / "never pure black"), it is superseded by this table.

| Token | Value | Usage |
|---|---|---|
| Canvas | `#000000` | Pitch-black background + faint cyan graph-paper grid overlay |
| Panels | `#020608` / `#040C12` | Near-black panels |
| Structure | `#00E5FF` (neon cyan) | Hairline borders, glows, graticules, section labels `[ like this ]`, corner brackets |
| Depth | `#3D5AFE` (electric blue) | Charts/particles/secondary bars — never CTAs |
| Hot accent | `#F0A030` (glowing orange/amber) | CTAs, prices, key highlights — kept for conversion; roughly 10% of any composition |
| Heading text | `#FFFFFF` | |
| Body text | `#9AA0B5` | |

- **Fonts:** Space Grotesk (display/headings), Inter (body). Everywhere, including social graphics and HTML emails.
- **Logo:** DW monogram, amber rounded square, dark text. The canonical rendering is the site nav's `.logo-mark`: **Space Grotesk 700**, letter-spacing −0.5px at 16px/38px box, 10px radius — scale those proportions for any size. (`public/favicon.svg` currently draws it in Arial — a known inconsistency, fine at tab size; match the Space Grotesk version everywhere else, including social profile pictures.)
- Feel: hyper-functional technical HUD — thin glowing borders, angular (6/10px radii), grid overlay, corner brackets on major panels.
- CTAs stay orange and prominent — do not let cyan swallow the conversion path.
- **Voice (all copy, all channels):** direct, operator-first, British; proof over adjectives ("40 hrs/week saved", not "transformative"); no AI hype; short sentences. Sell the hours and the margin, not the technology.

### Instagram (launched Jul 2026)

- Positioning: business owner first, AI consultant second. **General business + construction expertise — never haulage-only framing** (haulage appears only as client proof).
- Content pipeline lives in the Airtable **Content Calendar** table: Claude drafts rows (caption, script, visual notes), Daniel approves/records, Make posts Approved rows (scenario to be built once the Instagram for Business connection exists).
- Post graphics: 1080×1350 portrait, full HUD styling (black canvas, cyan grid + brackets, one amber accent), DW monogram + danielwalsh.ai footer on every graphic.
- Growth: content only. **No follower-buying, no follow/unfollow, no engagement bots — ever.** Ramp: graphics → Daniel's voiceover reels → face-to-camera.
- Media library: Google Drive folder "danielwalsh.ai — Media" (raw assets); finished per-post assets attach to the calendar row; `public/media/` only for images the website serves.

### Decision log — do not relitigate

- **HUD rebrand (11 Jul 2026) supersedes the old "amber-only, no blue, no pure black" rules** — Daniel requested it explicitly, twice, with reference imagery. If conversion drops, revisit with data, not opinions.
- Site visuals are hand-rolled canvas (no three.js): full-page 4D stardust torus parallax backdrop + interactive Earth globe (drag/pin/lead-capture) in Process.
- LinkedIn: icon only, in nav and footer. No text label.
- Booking language: "reschedule" only — never "cancel".
- Pricing (correct, do not change without instruction): Strategy & Advisory £500/60-min session · AI Implementation £1,500/day · Training & Workshops £1,200/day · Fractional AI Officer £5,000/month (25 hrs, 12-month minimum). Prices appear on the site, not on social.
- Service cards: strict 2×2 grid.
- Credentials bar: Google, Oxford, MIT — no "Soon" badges.
- Nav includes "Free tools" → `/tools/margin-vs-volume` (desktop; mobile reaches it via footer).

## Conventions

- British spelling, £, DD/MM/YYYY. Positioning is WORLDWIDE: no London/UK-only framing — "based in the UK, working worldwide" is the only permitted UK reference.
- `index.html` stays self-contained; content pages share `css/site.css`. CSS colours use `:root` variables — migrate hardcoded hexes as you touch code.
- Mobile responsive across three breakpoints — test changes at all of them.
- New public pages: add to `sitemap.xml`, footer (Company column), and follow the meta/JSON-LD pattern of `about.html`.

## Known open items

- Process section SVG node diagram: nodes not filling the panel — needs fixing.
- CRM deployment: code merged in `crm/`; Coolify resource + DNS + Cloudflare Access are manual steps for Daniel (see `crm/README.md` and the handover doc).
- Reply Capture Make scenario `6653714`: inactive — needs Airtable token pasted in its four HTTP modules and likely a full-scope hello@ Gmail connection created inside the module.
- Meta Business setup (unblocks Instagram posting via Make AND the deferred WhatsApp notifications).
- Handover Task 5: rotate the Airtable PAT used in Make scenarios (Daniel deferred; it has been pasted in chats).

## Owner working style

Direct and brief. Make clear recommendations, don't hedge with option lists. Act on established context without re-asking. Flag automation opportunities (Make scenarios) in one line when relevant.
