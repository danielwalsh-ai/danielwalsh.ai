# Pipeline — danielwalsh.ai CRM

Password-protected front end over the Airtable CRM (base `appbuQKkmnK569H1r`).
Node 20 + Express; proxies Airtable server-side so the token never reaches the browser.

## Deploy (Coolify)

1. Coolify → **+ New → Resource** → this repo → Build Pack **Dockerfile** →
   **Base directory `crm/`** → port **3000**.
2. Domain: `crm.danielwalsh.ai` (DNS A record → server IP).
3. Set the env vars from `env.example` in Coolify's environment panel.
4. Deploy, sign in with `APP_PASSWORD`.

Then put Cloudflare Access in front (see HANDOVER §Task 3): Zero Trust →
Access → Applications → Self-hosted → `crm.danielwalsh.ai`, allow
`hello@danielwalsh.ai`, and make sure the container is not reachable by raw
IP/port — Access only protects the hostname.
