# Zabiha Halal — Backend (Capstone Milestone 2)

Backend REST API for a halal restaurant management and online ordering application. Built with **Node.js**, **Express**, and **PostgreSQL** (via `pg`, using a connection pool).

## Features

- Menu management: categories and items (name, description, price, halal certification notes, availability)
- Customer accounts: register, view, update — passwords hashed with `bcrypt`
- Online ordering: multi-item orders created in a single DB transaction, with a status workflow (`pending → confirmed → preparing → ready → completed` / `cancelled`)
- Table reservations: create, view, update, cancel
- Admin reporting: daily order totals, most popular menu items

## Project Structure

```
backend/
├── src/
│   ├── config/db.js          # pg connection pool
│   ├── controllers/          # request handlers per entity
│   ├── routes/                # Express routers per entity
│   ├── middleware/            # error handling, id validation
│   ├── utils/                  # ApiError, asyncHandler, validators
│   ├── app.js                  # Express app (middleware + routes)
│   └── server.js               # process entry point
├── database/
│   ├── schema.sql              # CREATE TABLE statements (3NF)
│   └── seed.sql                # sample data
├── docs/
│   ├── database-design.md      # schema documentation + ER diagram
│   ├── api-documentation.md    # every endpoint, with sample requests/responses
│   └── demo-script.md          # step-by-step demo walkthrough
├── tests/
│   ├── *.test.js                # Jest + Supertest automated tests
│   ├── setup/resetDb.js         # resets + reseeds the test database
│   ├── test-cases.md            # formal test case table
│   ├── test-results.md          # actual test run output
│   └── zabiha-halal.postman_collection.json
├── .env.example
└── package.json
```

## Prerequisites

- Node.js 20+ and npm
- A running PostgreSQL 14+ server you can create databases on (or use the repo-root `docker compose up` instead, which provisions one automatically)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` with your Postgres connection info — either a single `DATABASE_URL` (recommended; Azure Database for PostgreSQL requires `?sslmode=require`) or discrete `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` vars. `TEST_DATABASE_URL`/`TEST_DB_NAME` point at a **separate** database used only when running the test suite (`NODE_ENV=test`) — automated tests truncate and reseed it on every run, so never point it at your real data.

### 3. Create and seed the database
```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
psql "$DATABASE_URL" -f sql/menu_analyzer.sql
psql "$DATABASE_URL" -f sql/seed_menu_analyzer.sql
```
`schema.sql` drops and recreates every table (`DROP TABLE IF EXISTS ... CASCADE`), so it's safe to re-run at any time during development — it does **not** create the database itself; create that first (e.g. `createdb zabiha_halal_db` or via your cloud provider).

For the test database, run the same files against whatever database `TEST_DATABASE_URL`/`TEST_DB_NAME` points at (`tests/setup/resetDb.js` truncates/reseeds it before each test file — the tables must already exist).

### 4. Start the server
```bash
npm start          # node src/server.js
npm run dev         # node --watch src/server.js (auto-restart on changes)
```
The API listens on `http://localhost:<PORT>` (default `3000`). Health check: `GET /health`.

### 5. Run the automated tests
```bash
npm test
```
This runs Jest + Supertest against `TEST_DATABASE_URL`/`TEST_DB_NAME`, resetting it to the seed fixture before each test file. See [`../docs/MILESTONE4.md`](../docs/MILESTONE4.md#2-testing-30-pts) for the current test case table (98/98 passing) and raw output.

### 6. Explore the API in Postman
Import `tests/zabiha-halal.postman_collection.json`. It defines a `baseUrl` collection variable (default `http://localhost:3000`) and includes both success and negative-case requests for every endpoint, organized by resource.

## Documentation

- [`docs/database-design.md`](docs/database-design.md) — full schema, constraints, and a Mermaid ER diagram
- [`docs/api-documentation.md`](docs/api-documentation.md) — every endpoint: method, URL, input, output, sample request/response
- [`docs/demo-script.md`](docs/demo-script.md) — Postman call + SQL verification query for each step of a live demo, plus notable development issues and how they were resolved

## API Overview

| Resource | Base path |
|---|---|
| Menu categories | `/api/menu-categories` |
| Menu items | `/api/menu-items` |
| Customers | `/api/customers` |
| Orders | `/api/orders` |
| Reservations | `/api/reservations` |
| Admin reports | `/api/reports` |

Full details, including sample JSON bodies, are in `docs/api-documentation.md`.
