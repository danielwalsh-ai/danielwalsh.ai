# danielwalsh.ai — Project Context

Professional AI consultancy site for Daniel Walsh. Live production system — be careful with payments and booking logic.

## Stack & deployment

- **Frontend:** `public/index.html` — single file, all CSS inline in a `<style>` block, all JS inline. No build step, no framework.
- **Admin:** `public/admin.html` — separate password-protected portal (dashboard, availability, bookings, settings).
- **Backend:** `server.js` — Node.js/Express. Handles GoCardless payments (LIVE environment), Anthropic API proxy for the chat widget, PostgreSQL booking storage, Resend email confirmations, Make.com webhook notifications, protected admin endpoints.
- **Hosting:** Coolify at 178.104.154.216. Deploys automatically on push to GitHub main.
- **Database:** PostgreSQL on Coolify (internal hostname `dm8hs0r3fezjck2f411rixp3`).
- **Secrets:** all env vars live in Coolify — never hardcode keys, never commit them.
- **DNS:** LIVE since 10 Jul 2026 — A records @ and www → 178.104.154.216, SSL via Let's Encrypt; Resend DNS verified (hello@danielwalsh.ai sends).

## Brand — JARVIS HUD (owner rebrand, 11 Jul 2026)

Daniel explicitly overrode the previous amber-on-navy brand: the site is now styled as an Iron-Man/Jarvis heads-up display.

| Token | Value | Usage |
|---|---|---|
| Canvas | `#000000` | Pitch-black page background + faint cyan graph-paper grid overlay |
| Panels | `#020608` / `#040C12` | Near-black panels |
| Structure | `#00E5FF` (neon cyan) | Hairline borders, glows, graticules, section labels `[ like this ]`, corner brackets |
| Depth | `#3D5AFE` (electric blue) | Particle/dust accents in canvas visuals |
| Hot accent | `#F0A030` (glowing orange/amber) | CTAs, prices, pins, key highlights — kept for conversion |
| Heading text | `#FFFFFF` | |
| Body text | `#9AA0B5` | |

- **Fonts:** Space Grotesk (display/headings), Inter (body).
- **Logo:** DW monogram, amber on dark (unchanged).
- Feel: hyper-functional, technical HUD — thin glowing borders, angular (6/10px radii), grid systems, corner brackets on major panels.
- CTAs stay orange and prominent — do not let cyan swallow the conversion path.

### Decision log — do not relitigate
- **HUD rebrand (11 Jul 2026) supersedes the old "amber-only, no blue, no pure black" rules** — Daniel requested it explicitly, twice, with reference imagery. The old note that blue converted worse predates this; if conversion drops, revisit with data, not opinions.
- Site visuals are hand-rolled canvas (no three.js): full-page 4D stardust torus parallax backdrop + interactive Earth globe (drag/pin/lead-capture) in Process.
- LinkedIn: icon only, in nav and footer. No text label.
- Booking language: "reschedule" only — never "cancel".
- Pricing (correct, do not change without instruction): Strategy & Advisory £500/60-min session · AI Implementation £1,500/day · Training & Workshops £1,200/day · Fractional AI Officer £5,000/month (25 hrs, 12-month minimum).
- Service cards: strict 2×2 grid.
- Credentials bar: Google, Oxford, MIT — no "Soon" badges.

## Conventions

- British spelling, £, DD/MM/YYYY. Positioning is WORLDWIDE (decided 10 Jul 2026): no London/UK-only framing in copy, titles or structured data — "based in the UK, working worldwide" is the only permitted UK reference.
- Keep the single-file structure for index.html unless explicitly told to split it.
- CSS colours should use `:root` variables — if you find hardcoded hexes, migrate them to variables as you touch that code.
- Mobile responsive across three breakpoints — test changes at all of them.

## Known open items

- Process section SVG node diagram: nodes not filling the panel — needs fixing.
- DNS go-live (blocked on GoDaddy access / DNS contact).
- WhatsApp Business Cloud notifications — deferred pending Meta Business account setup.

## Owner working style

Direct and brief. Make clear recommendations, don't hedge with option lists. Act on established context without re-asking. Flag automation opportunities (Make scenarios) in one line when relevant.
