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
