# 2. System Setup Instructions (Frontend, Backend, Database)

[← Back to index](README.md)

This section takes a new developer from a clean machine to a fully running local stack, with no prior knowledge of the project assumed. Two paths are given for the backends: **Docker Compose** (recommended — provisions and seeds the database automatically) and **manual/native** (for developers who want to run Node/Python directly, e.g. to use a debugger).

## 2.1 Prerequisites

| Requirement | Version | Needed for | Notes |
|---|---|---|---|
| Git | any recent | Cloning the repo | — |
| Docker Desktop | recent | Recommended path (Compose) | Includes Docker Compose v2 |
| Node.js | 20+ | Express API (manual path), frontend static server, mobile app | `node --version` |
| npm | bundled with Node | Installing JS dependencies | — |
| Python | 3.12 | Flask API (manual path) | `python3 --version` |
| PostgreSQL client (`psql`) | 14+ compatible | Loading schema/seed SQL manually | Only needed for the manual path |
| Expo CLI (`npx expo`) | latest | Mobile demo only | No install needed beyond `npx` |
| Anthropic API key | — | Optional | AI Menu Analyzer runs in mock/demo mode without one |

No cloud account is required for local development — Azure is only used for the live deployment (see [05-architecture.md §5.5](05-architecture.md#55-hostingdeployment-environments)).

## 2.2 Fastest path — Docker Compose (recommended)

This provisions Postgres, loads the schema and seed data automatically, and starts both backend APIs in containers.

```bash
git clone https://github.com/tayyabMalik2002/halal-chicagoland.git
cd halal-chicagoland
docker compose up --build
```

What this starts (see [`docker-compose.yml`](../docker-compose.yml)):

| Service | Container | Host port | Notes |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` | Creates `restaurants_db` (default `POSTGRES_DB`) and, via [`docker/postgres-init/init-menu-ops-db.sh`](../docker/postgres-init/init-menu-ops-db.sh), a second database `menu_ops_db` — both auto-seeded from `backend/database/`, `backend/sql/`, and `docker/postgres-init/sql/` on **first** container start only |
| `flask-api` | built from `backend-flask/Dockerfile` | `5001` | `DATABASE_URL` points at `restaurants_db` |
| `express-api` | built from `backend/Dockerfile` | `3010` (maps to container port `3000`) | `DATABASE_URL` points at `menu_ops_db`; `ANTHROPIC_API_KEY` passed through from your shell environment if set |

To enable the real AI Menu Analyzer (instead of mock/demo mode), export the key before starting Compose:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
docker compose up --build
```

**Serve the frontend** (a separate terminal — the static site is not containerized):

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. `js/api.js` automatically detects `localhost` and points at the local containers — no configuration needed.

**To reset the database to a clean seeded state:** `docker compose down -v` (removes the `pgdata` volume) then `docker compose up --build` again — the init scripts only run on a fresh volume.

## 2.3 Manual setup — Backend: Express API (`backend/`)

### Install

```bash
cd backend
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (default `3000`) | HTTP port |
| `NODE_ENV` | no (default `development`) | `test` switches to `TEST_DATABASE_URL` |
| `DATABASE_URL` | yes (or the discrete `DB_*` vars below) | Postgres connection string. Azure Postgres requires `?sslmode=require`. |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | only if `DATABASE_URL` unset | Discrete connection params |
| `DB_CONNECTION_LIMIT` | no (default `10`) | Pool size |
| `TEST_DATABASE_URL` / `TEST_DB_NAME` | only for running tests | **Must** point at a separate database — the test suite truncates and reseeds it on every run |
| `ANTHROPIC_API_KEY` | no | Leave blank to run the AI Menu Analyzer in mock/demo mode (canned responses, no real API calls, no key needed) |

Secrets management: `.env` is gitignored at the repo root and inside `backend/`; only `backend/.env.example` (placeholder values) is committed. Never commit a real `.env`. In production, these are set as Azure Container Apps **secrets**, not plain environment variables (see [05-architecture.md](05-architecture.md)).

### Create and seed the database

Requires a running Postgres server you can create databases on (skip this whole section if you used Docker Compose — it's done for you):

```bash
createdb zabiha_halal_db     # or via your cloud provider's console/CLI
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
psql "$DATABASE_URL" -f sql/menu_analyzer.sql
psql "$DATABASE_URL" -f sql/seed_menu_analyzer.sql
```

`schema.sql` drops and recreates every table (`DROP TABLE IF EXISTS ... CASCADE`), so it's safe to re-run at any point during development — it does not create the database itself. `sql/menu_analyzer.sql` is idempotent (`CREATE TABLE IF NOT EXISTS`) and only needed if migrating a database created before the AI Menu Analyzer tables were merged into `schema.sql`.

For a test database, repeat the same four commands against whatever `TEST_DATABASE_URL`/`TEST_DB_NAME` points at.

### Build / run

There is no build step (plain Node, no bundler/TypeScript compile).

```bash
npm start          # node src/server.js
npm run dev         # node --watch src/server.js — auto-restarts on file changes
```

### Validate

```bash
curl http://localhost:3000/health
# {"status":"ok"}
curl http://localhost:3000/api/menu-categories
# {"data":[...5 seeded categories...]}
```

If the second call errors, the API process is up but the database connection/schema is wrong — recheck `DATABASE_URL` and that `schema.sql`/`seed.sql` were actually run against that database.

### Run the automated test suite

```bash
npm test
```

Runs Jest + Supertest against `TEST_DATABASE_URL`, resetting it before each test file. Expect `98 passed, 98 total`. See [01-production-support.md §1.4.1](01-production-support.md#141-automated-tests-unit--integration) for the full test case reference.

## 2.4 Manual setup — Backend: Flask API (`backend-flask/`)

### Install

```bash
cd backend-flask
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Configure

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | no | Postgres connection string for `restaurants_db`. **Falls back to a local SQLite file (`restaurants.db`) if unset** — the only backend component in this project that has a no-config default. Azure/`postgres://`-style URLs are auto-normalized to `postgresql://` and have `sslmode=require` appended if missing (`app/config.py`). |
| `ADMIN_USERNAME` | no (default `admin`) | Admin portal login username |
| `ADMIN_PASSWORD` | no (default `admin-dev-password`) | Admin portal login password — **change this for any non-local deployment** |
| `ADMIN_TOKEN_SECRET` | no (defaults to `ADMIN_PASSWORD`) | Signing secret for admin bearer tokens — set an independent value in production |

Set these as real environment variables (`export DATABASE_URL=...`) or via a process manager; there's no `.env.example` in this directory since every variable has a working local default.

### Create and seed the database

```bash
python seed.py
```

This creates the schema (via SQLAlchemy models) and seeds it with the restaurant directory data, against whichever database `DATABASE_URL` resolves to (SQLite by default, Postgres if set). Safe to re-run — it seeds/upserts known records.

### Build / run

No build step.

```bash
python run.py
```

Serves on `http://localhost:5001` by default.

### Validate

```bash
curl http://localhost:5001/api/v1/health
# {"status":"ok"}
curl http://localhost:5001/api/v1/restaurants
# {"results":[...], "count": N}
```

## 2.5 Frontend setup

No install, no build step — plain HTML/CSS/vanilla JS served statically.

```bash
# from the repo root
python3 -m http.server 8080
```

Any static file server works (`npx serve`, VS Code Live Server, etc.) — the only requirement is that both backend APIs are reachable at the URLs `js/api.js` expects for the current hostname (`localhost` locally, the deployed `*.azurecontainerapps.io` hosts in production). If you serve the frontend from a hostname other than `localhost`/`127.0.0.1` while developing locally (e.g. a LAN IP for testing on a phone), update the `IS_LOCAL` check / base URLs in [`js/api.js`](../js/api.js) accordingly, or requests will silently target production.

### Validate

Open `http://localhost:8080` — the restaurant grid should populate. Open DevTools → Network and confirm requests go to `localhost:5001` (Flask) and `localhost:3000` (Express), not the Azure hosts.

## 2.6 Mobile app setup (optional — demo only)

```bash
cd mobile
npm install
npx expo start
```

Scan the printed QR code with the Camera app (iOS) or the Expo Go app (Android). See [`mobile/README.md`](../mobile/README.md) for full details. `SITE_URL` at the top of `mobile/App.js` is hardcoded to the deployed frontend URL — update it if the production URL ever changes; this app is not meant to point at `localhost` (a phone can't reach your machine's localhost without extra network configuration).

## 2.7 Build and deployment steps (production, Azure)

Full live URLs, resource inventory, and grader-facing verification steps are documented in [`MILESTONE4.md §5`](MILESTONE4.md#5-deployment-30-pts). Summary of the deploy mechanics:

1. **Backends:** each of `backend/` and `backend-flask/` has its own `Dockerfile`. Build and push to Azure Container Registry:
   ```bash
   az acr build --registry zabihahalalacr --image express-api:latest ./backend
   az acr build --registry zabihahalalacr --image flask-api:latest ./backend-flask
   ```
2. **Deploy/update the Container Apps** to pick up the new image (via `az containerapp update` or the Azure Portal), pulling from ACR through the app's system-assigned managed identity.
3. **Frontend:** Azure Static Web Apps deploys the repo root's static files (`index.html`, `map.html`, `menu-analyzer.html`, `admin.html`, `css/`, `js/`) — no build step, so this is effectively a file sync/CDN push.
4. **Database migrations:** run the relevant `.sql` files under `backend/database/` and `backend/sql/` against the target Postgres database with `psql` — there is no automated migration runner in this project; schema changes are applied manually and are idempotent/re-runnable by design (`DROP ... CASCADE` for the full schema, `CREATE TABLE IF NOT EXISTS` for incremental additions).
5. **Secrets** (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_USERNAME`/`PASSWORD`/`TOKEN_SECRET`) are set as Container Apps secrets via the Azure Portal or `az containerapp secret set` — never committed to the repo.

## 2.8 Validation checklist (any environment)

After any fresh setup, confirm in this order:

1. `curl <flask-base>/api/v1/health` → `{"status":"ok"}`
2. `curl <express-base>/health` → `{"status":"ok"}`
3. `curl <flask-base>/api/v1/restaurants` → real rows, not an empty array or a 500
4. `curl <express-base>/api/menu-categories` → real rows
5. Open the frontend in a browser → restaurant grid renders, map renders, Menu Analyzer page loads
6. (Backend dev only) `cd backend && npm test` → `98 passed, 98 total`

If step 3 or 4 fails while 1/2 pass, the process is healthy but the database connection or schema is wrong — see [01-production-support.md §1.3](01-production-support.md#13-common-incidents--recovery-steps).
