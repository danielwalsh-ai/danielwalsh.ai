# danielwalsh.ai — Deployment Guide

## Repo structure

```
/
├── public/
│   ├── index.html       ← Public site (danielwalsh.html)
│   └── admin.html       ← Admin portal
├── server.js            ← Express backend
├── package.json
├── Dockerfile
├── .env.example         ← Copy to .env and fill in
└── .github/
    └── workflows/
        └── deploy.yml   ← Auto-deploy on push to main
```

---

## 1. GitHub setup

1. Create a new **private** repo: `danielwalsh-ai`
2. Push all files:
```bash
git init
git add .
git commit -m "Initial deployment"
git remote add origin git@github.com:yourusername/danielwalsh-ai.git
git push -u origin main
```

---

## 2. Database setup (PostgreSQL)

Run once against your database:
```sql
-- Tables are auto-created on first server start via initDB()
-- But create the DB first:
CREATE DATABASE danielwalsh;
```

The server creates `bookings` and `availability` tables automatically on startup.

---

## 3. Coolify setup

1. In Coolify → **New Resource → Application → GitHub**
2. Select your repo `danielwalsh-ai`
3. Build pack: **Dockerfile**
4. Port: `3000`
5. Add all environment variables from `.env.example` under **Environment Variables**
6. Set domain: `danielwalsh.ai`
7. Enable **HTTPS** (Coolify handles Let's Encrypt automatically)
8. Deploy

---

## 4. GitHub Actions → Coolify auto-deploy

1. In Coolify → your app → **Webhooks** → copy the deploy webhook URL
2. In GitHub repo → **Settings → Secrets**:
   - `COOLIFY_WEBHOOK_URL` → paste the webhook URL
   - `COOLIFY_TOKEN` → your Coolify API token
3. Now every push to `main` auto-deploys

---

## 5. GoCardless setup

1. Log into your GoCardless dashboard (live)
2. **Developers → Access tokens** → create a new live token → paste into `GOCARDLESS_ACCESS_TOKEN`
3. **Developers → Webhooks** → create webhook:
   - URL: `https://danielwalsh.ai/api/webhooks/gocardless`
   - Copy the signing secret → paste into `GOCARDLESS_WEBHOOK_SECRET`

---

## 6. Resend setup

1. Log into [resend.com](https://resend.com)
2. **API Keys** → create key → paste into `RESEND_API_KEY`
3. **Domains** → add `danielwalsh.ai` → verify DNS records
4. Sending address `hello@danielwalsh.ai` will work once domain is verified

---

## 7. Make.com setup

1. Create a new scenario in Make
2. Add a **Webhook** trigger → copy the URL → paste into `MAKE_WEBHOOK_URL`
3. The webhook receives this payload on every confirmed booking:
```json
{
  "bookingId": 42,
  "name": "Sarah Mitchell",
  "email": "sarah@company.com",
  "company": "TechCorp",
  "service": "Strategy & Advisory",
  "price": 500,
  "date": "2026-07-01",
  "time_slot": "09:00",
  "status": "confirmed"
}
```
4. Add actions: Google Calendar event, Slack notification, CRM update — whatever you need

---

## 8. Admin portal

- URL: `https://danielwalsh.ai/admin.html`
- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in your env vars
- Generate `ADMIN_TOKEN`: `openssl rand -hex 32`
- The admin portal authenticates against `/api/admin/login` and stores the token in sessionStorage

---

## 9. DNS (Cloudflare recommended)

```
A    danielwalsh.ai        → your Coolify server IP
A    www.danielwalsh.ai    → your Coolify server IP (redirect to apex)
```

---

## Environment variables checklist

| Variable | Where to get it |
|---|---|
| `DB_HOST` / `DB_NAME` etc | Your Postgres provider |
| `GOCARDLESS_ACCESS_TOKEN` | GoCardless dashboard → Developers |
| `GOCARDLESS_WEBHOOK_SECRET` | GoCardless dashboard → Webhooks |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `RESEND_API_KEY` | resend.com → API Keys |
| `MAKE_WEBHOOK_URL` | Make.com → Scenario → Webhook trigger |
| `ADMIN_TOKEN` | Run: `openssl rand -hex 32` |

---

## Testing before go-live

1. Hit `https://danielwalsh.ai/health` → should return `{"status":"ok"}`
2. Book a free discovery call → confirm email arrives via Resend
3. Book a paid service → confirm GoCardless redirect works in sandbox first
4. Toggle availability in admin → confirm slot is blocked on public calendar
