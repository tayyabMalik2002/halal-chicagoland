# Zabiha Halal — Backend (Capstone Milestone 2)

Backend REST API for a halal restaurant management and online ordering application. Built with **Node.js**, **Express**, and **MySQL** (via `mysql2`, using a connection pool).

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
│   ├── config/db.js          # mysql2 connection pool
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

- Node.js 18+ and npm
- A running MySQL 8.x server you can create databases on

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` with your MySQL host/port/user/password. `DB_NAME` is the development database; `TEST_DB_NAME` is a **separate** database used only when running the test suite (`NODE_ENV=test`) — automated tests truncate and reseed it on every run, so never point it at your real data.

### 3. Create and seed the database
```bash
mysql -u <user> -p < database/schema.sql
mysql -u <user> -p < database/seed.sql
```
`schema.sql` drops and recreates the `zabiha_halal_db` database from scratch, so it's safe to re-run at any time during development.

For the test database, run the same `schema.sql` against a database named to match `TEST_DB_NAME` in your `.env` (e.g. copy the file and swap the database name, or create it manually and let `tests/setup/resetDb.js` truncate/reseed it — the tables must already exist).

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
This runs Jest + Supertest against `TEST_DB_NAME`, resetting it to the seed fixture before each test file. See `tests/test-results.md` for the last recorded run (81/81 passing) and `tests/test-cases.md` for the formal test case table.

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
