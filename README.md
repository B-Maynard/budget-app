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
