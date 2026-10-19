# Budget App

Monorepo: Angular frontend (in `frontend/`) + NestJS backend (in `backend/`).

## Setup
```bash
npm install
```

## Run locally
```bash
# Start the database
docker compose up -d db

# Apply migrations
npm run migration:run --prefix backend

# Start frontend (port 4200) and backend (port 3000)
npm -w frontend start
npm -w backend run start:dev
```

## Run with Docker (full stack)
```bash
cp .env.example .env   # then edit TOKEN
docker compose up --build
```
Open http://localhost:8080. API is also on http://localhost:3000.

## Test
```bash
npm -w frontend test
npm -w backend test
```

## Database migrations
```bash
# Generate a migration from entity changes
npm run migration:generate --prefix backend -- src/migrations/DescribeTheChange

# Apply pending migrations
npm run migration:run --prefix backend

# Revert last migration
npm run migration:revert --prefix backend
```

## Automatic bank transactions (Plaid)

Activity has a **Connected banks** panel. Link US bank accounts through Plaid
Link to import USD transactions automatically, including pending charges.
Choose an import start date before connecting. If you already imported CSVs,
choose the day after the last imported transaction for those accounts: CSV
descriptions cannot reliably be matched to Plaid IDs, so overlapping CSV and
bank history is not automatically deduplicated. Connect each account once.
Choose an earlier date for a new budget (up to 730 days, depending on the bank).
The date is fixed for that connection; reconnecting restores access and keeps
its history and cursor.

1. Create a [Plaid developer account](https://dashboard.plaid.com/signup) and
   enable Transactions. Start with Sandbox test credentials.
2. Set `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` in the root `.env`
   for Docker, or `backend/.env` for a local backend started from `backend/`.
3. Generate `PLAID_TOKEN_ENCRYPTION_KEY` with `openssl rand -hex 32`. Keep this
   key stable and back it up with your deployment secrets. Access tokens are
   encrypted with AES-256-GCM in PostgreSQL and never sent to the browser.
   Losing/changing this key requires linking the accounts again.
4. Set `PLAID_WEBHOOK_URL` to a public HTTPS endpoint, usually
   `https://your-domain.example/api/bank-connections/webhook`. Locally, a tunnel
   to port 3000 uses `/bank-connections/webhook` without `/api`. Webhooks verify
   Plaid's signature, timestamp, and exact raw body hash; they do not use `TOKEN`.
5. Set `PLAID_REDIRECT_URI` to the app's root URL, such as
   `https://your-domain.example/` (local: `http://localhost:4200/`), and add that
   exact URL to Plaid's allowed redirect URIs. Include no hash or query. OAuth
   returns to Activity and resumes Link using the session stored in that tab.
6. Run migrations and rebuild/restart. For local development, start the frontend
   with `npm -w frontend start -- --proxy-config proxy.conf.json` so `/api` reaches
   the backend. Open Activity and select **Connect bank**.

Use `user_good` / `pass_good` when a Sandbox institution asks for credentials.
Sandbox does not access your real bank. Real accounts require Plaid production
access and `PLAID_ENV=production` with the production secret. Production setup
requires HTTPS webhook and redirect URLs. Connections belong to this app's
single shared budget, protected by the existing app access token.
Sandbox connections and their transactions are hidden from the production
budget, including analysis and AI categorization. CSV history stays visible.
Disconnect test connections while still in Sandbox to revoke their Items.

Plaid sends `SYNC_UPDATES_AVAILABLE` when changes are available. The backend
persists that work before acknowledging, then syncs all pages and the cursor
atomically. It retries failed work and checks Plaid's available data every ten
minutes as a fallback (worker wakes every 30 seconds). Multiple API processes
coordinate with PostgreSQL locks. Added, modified, and removed records are
reconciled by Plaid ID; pending-to-posted replacements retain manual categories.
Activity checks connection state every five seconds and refreshes its data after
a sync, preserving the selected filters. **Disconnect** revokes Plaid access and
keeps previously imported transactions.

**Update timing:** [Plaid usually checks banks one to four times per day](https://plaid.com/docs/api/products/transactions/).
Automatic imports remove the CSV step, but a new purchase is not guaranteed to
appear instantly. **Sync available** checks data Plaid has already fetched.
Optionally enable Plaid's separately billed Transactions Refresh product and set
`PLAID_ENABLE_REFRESH=true` to show **Refresh bank**. Refresh requests are limited
to once per connection per five minutes and still depend on bank availability.

For a Sandbox smoke check, connect a test account with a start date covering
the test history. Use Plaid's
[`/sandbox/transactions/create`](https://plaid.com/docs/api/products/transactions/#sandboxtransactionscreate)
or [`/sandbox/item/fire_webhook`](https://plaid.com/docs/api/sandbox/#sandboxitemfire_webhook)
to exercise automatic updates. Use **Reconnect** after simulating
`ITEM_LOGIN_REQUIRED` with `/sandbox/item/reset_login`. Sandbox APIs use the
server-side Item token; keep that token on the server.

Automated bank integration checks use an isolated PostgreSQL database whose name
ends with `_test`. They mock Plaid responses and make no bank requests:

```bash
npm exec -w backend -- jest --runInBand --testPathPattern=plaid.spec.ts
BANK_SYNC_TEST_DATABASE_URL=postgres://user:password@localhost:5432/budget_plaid_test \
  npm exec -w backend -- jest --config ./test/jest-e2e.json --runInBand --testPathPattern=bank-connections
```

## UI design lab

Six interactive redesign concepts are available at `/#/mockups`: Ledger,
Orbit, Grove, Current, Studio, and Pocket. The hub links to each concept;
each has overview, bills, activity, and debt plan views. They use sample
budget data and require no backend or access token. Purchases, bill statuses,
filters, and planning controls work within the demo; changes reset on reload.

Start a preview accessible to devices on your local network:

```bash
npm -w frontend start -- --host 0.0.0.0 --port 4200
```

Open `http://localhost:4200/#/mockups` on this computer, or
`http://<this-computer-LAN-IP>:4200/#/mockups` on another device.

## Current interface

The main app uses the Current design. The header's sun/moon button switches
between light and dark mode and remembers the choice on this device. The
initial mode follows the device preference. Budget settings and paydays are
on the overview; CSV imports and category limits are on Activity.
