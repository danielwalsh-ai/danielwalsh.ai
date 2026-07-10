# danielwalsh.ai — Project Context

Professional AI consultancy site for Daniel Walsh. Live production system — be careful with payments and booking logic.

## Stack & deployment

- **Frontend:** `public/index.html` — single file, all CSS inline in a `<style>` block, all JS inline. No build step, no framework.
- **Admin:** `public/admin.html` — separate password-protected portal (dashboard, availability, bookings, settings).
- **Backend:** `server.js` — Node.js/Express. Handles GoCardless payments (LIVE environment), Anthropic API proxy for the chat widget, PostgreSQL booking storage, Resend email confirmations, Make.com webhook notifications, protected admin endpoints.
- **Hosting:** Coolify at 178.104.154.216. Deploys automatically on push to GitHub main.
- **Database:** PostgreSQL on Coolify (internal hostname `dm8hs0r3fezjck2f411rixp3`).
- **Secrets:** all env vars live in Coolify — never hardcode keys, never commit them.
- **DNS:** pending — GoDaddy A records (@ and www → 178.104.154.216) plus Resend TXT records not yet added.

## Brand (LOCKED — do not deviate)

| Token | Value | Usage |
|---|---|---|
| Canvas | `#07070F` | Main page background |
| Section | `#12163A` | Section backgrounds / panels |
| Accent | `#F0A030` | Electric amber — CTAs, highlights, links ONLY |
| Heading text | `#FFFFFF` | |
| Body text | `#9AA0B5` | |
| Muted text | `#5B6078` | Captions, footers, metadata |

- **Fonts:** Space Grotesk (display/headings), Inter (body).
- **Logo:** DW monogram, amber on dark.
- Amber is the only loud element — ~10% max coverage. One primary CTA per view.
- Electric blue is tertiary ONLY (low-opacity mesh lines/charts, e.g. #3D5AFE @ 15–25%). Never on CTAs or headings.
- No pure `#000000`.

### Decision log — do not relitigate
- **Electric blue as primary accent was tested live and reverted.** Amber on dark navy converts better for B2B professional services. Do not suggest switching back.
- Deep navy section background is `#12163A` — chosen deliberately (enough lift from #07070F, dark enough that amber stays loudest).
- LinkedIn: icon only, in nav and footer. No text label.
- Booking language: "reschedule" only — never "cancel".
- Pricing (correct, do not change without instruction): Strategy & Advisory £500/60-min session · AI Implementation £1,500/day · Training & Workshops £1,200/day · Fractional AI Officer £5,000/month (25 hrs, 12-month minimum).
- Service cards: strict 2×2 grid.
- Credentials bar: Google, Oxford, MIT — no "Soon" badges.

## Conventions

- British spelling, £, DD/MM/YYYY, UK framing throughout.
- Keep the single-file structure for index.html unless explicitly told to split it.
- CSS colours should use `:root` variables — if you find hardcoded hexes, migrate them to variables as you touch that code.
- Mobile responsive across three breakpoints — test changes at all of them.

## Known open items

- Process section SVG node diagram: nodes not filling the panel — needs fixing.
- DNS go-live (blocked on GoDaddy access / DNS contact).
- WhatsApp Business Cloud notifications — deferred pending Meta Business account setup.

## Owner working style

Direct and brief. Make clear recommendations, don't hedge with option lists. Act on established context without re-asking. Flag automation opportunities (Make scenarios) in one line when relevant.
