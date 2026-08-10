# Zabiha Halal — Chicagoland

A halal restaurant directory, map, online ordering system, and AI-powered Menu Analyzer for the Chicagoland area, built as a Northwestern MSISM capstone project.

**Live site:** https://delightful-moss-0894fe210.7.azurestaticapps.net

## What it does

- Browse and search Zabiha Halal–certified restaurants across Chicagoland, filter by cuisine/area, and view them on a map.
- Place orders, make reservations, and manage a menu (categories, items, availability) via a REST API.
- **AI Menu Analyzer**: at a restaurant that *isn't* halal-certified, photograph the menu (or just search by name) and get an item-by-item breakdown — safe to eat as-is, safe with a modification, doubtful, or not suitable — powered by Anthropic's Claude, with results cached per restaurant so repeat lookups don't re-call the AI.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Static HTML/CSS/vanilla JS (no framework, no build step) |
| Restaurant directory API | Python, Flask, SQLAlchemy |
| Menu/ordering/AI API | Node.js, Express, `pg` |
| Database | PostgreSQL (Azure Database for PostgreSQL — Flexible Server) |
| AI | Anthropic Claude (`@anthropic-ai/sdk`), including web search for name-only menu lookups |
| Mobile | Expo/React Native WebView wrapper around the deployed site |
| Cloud | Microsoft Azure — Static Web Apps, Container Apps, Container Registry, Postgres Flexible Server |
| Containerization | Docker + Docker Compose (local dev/test), Azure Container Apps (production) |

## Deployment

Full architecture, environment variable setup, and step-by-step "how to test the live deployment" instructions are in [`docs/MILESTONE4.md`](docs/MILESTONE4.md#5-deployment-30-pts). In short: two independently deployed backend containers on Azure Container Apps, a static frontend on Azure Static Web Apps, and one Postgres Flexible Server hosting two separate logical databases (one per backend).

## Local setup

**Prerequisites:** Docker Desktop (recommended), or Node.js 20+ and Python 3.12 if running the backends outside Docker.

### Fastest path — Docker Compose (recommended)

```bash
git clone https://github.com/tayyabMalik2002/halal-chicagoland.git
cd halal-chicagoland
docker compose up --build
```

This starts a local Postgres container (schema + seed data loaded automatically), the Express API on `http://localhost:3000`, and the Flask API on `http://localhost:5001`. Then serve the frontend statically from the repo root, e.g.:

```bash
python3 -m http.server 8080
```

`js/api.js` automatically points at `localhost` when the page isn't served from the production domain, so no configuration is needed.

### Running the backends without Docker

See [`backend/README.md`](backend/README.md) for the Express API (manual Postgres setup, `.env` configuration, running the Jest test suite). The Flask API (`backend-flask/`) needs `pip install -r requirements.txt`, a `DATABASE_URL` env var pointing at a Postgres database (falls back to local SQLite if unset), then `python seed.py` once to create/seed the schema and `python run.py` to serve it on port 5001.

### Mobile app

See [`mobile/README.md`](mobile/README.md) — an Expo Go demo that loads the deployed site in a WebView.

## Testing

```bash
cd backend
npm install
NODE_ENV=test TEST_DATABASE_URL="postgresql://postgres:localdevpassword@localhost:5432/menu_ops_db_test?sslmode=disable" npx jest --runInBand
```

98 tests across 7 suites, covering every REST resource including validation, not-found, conflict, transactional rollback, and AI-failure paths. See [`docs/MILESTONE4.md`](docs/MILESTONE4.md#2-testing-30-pts) for the full test case table and [`docs/test-output.txt`](docs/test-output.txt) for raw output.

## Repo layout

```
backend/          Express API — menu, orders, reservations, AI Menu Analyzer
backend-flask/    Flask API — restaurant directory and map
css/, js/, *.html Static frontend
mobile/           Expo WebView wrapper for a mobile demo
docs/             Design docs, API documentation, and milestone deliverables
docker-compose.yml, docker/   Local multi-service dev environment
```
