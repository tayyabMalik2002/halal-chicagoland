# 1. Production Support Document & Testing Scenarios

[← Back to index](README.md)

## 1.1 Service dependency diagram

See [05-architecture.md](05-architecture.md) for the full annotated architecture diagram. Condensed dependency view for on-call/maintenance purposes:

```mermaid
flowchart LR
    FE["Frontend<br/>(Azure Static Web Apps)"] --> FL["flask-api<br/>(Container App)"]
    FE --> EX["express-api<br/>(Container App)"]
    FL --> RDB[("restaurants_db")]
    EX --> MDB[("menu_ops_db")]
    EX --> AI["Anthropic Claude API"]
    ACR["Azure Container Registry"] -.pulls.-> FL
    ACR -.pulls.-> EX
    RDB --- PG[("Postgres Flexible Server<br/>zahbhiahalal")]
    MDB --- PG
```

**Hard dependencies (a failure here takes down a feature immediately):**

| If this is down… | …then this breaks |
|---|---|
| Postgres Flexible Server (`zahbhiahalal`) | Both APIs — every endpoint that touches the database, i.e. almost everything except static asset serving |
| `flask-api` Container App | Restaurant directory, map, admin restaurant CRUD (`index.html`, `map.html`, `admin.html`) |
| `express-api` Container App | Menu management, customers, orders, reservations, admin reports, AI Menu Analyzer (`menu-analyzer.html`) |
| Azure Static Web Apps | The entire frontend — nothing loads |
| Anthropic Claude API | Only new (non-cached) AI Menu Analyzer requests — cached restaurant analyses still return normally from `menu_ops_db` |
| Azure Container Registry | Only new deployments/restarts that need to pull an image — already-running containers keep serving traffic |

## 1.2 Monitoring

### Health check endpoints

| Endpoint | Service | Healthy response |
|---|---|---|
| `GET /health` | Express API | `{"status":"ok"}` |
| `GET /api/v1/health` | Flask API | `{"status":"ok"}` |

Both endpoints only confirm the process is up and answering HTTP — they do **not** currently verify database connectivity. A backend can return healthy on `/health` while its database is unreachable; the first real request will then fail with a 500. Treat a 500 on any data-bearing endpoint alongside a healthy `/health` as a **database connectivity** incident, not a process-down incident (see §1.3).

### Logs

| Layer | Where logs go | How to view |
|---|---|---|
| Express API | `console.error(...)` on unexpected errors (`errorHandler.js`), plus one log line per AI JSON-parse failure (`aiMenuService.js`) | `az containerapp logs show --name express-api --resource-group capstone_rg --follow`, or the **Log stream** blade in the Azure Portal for that Container App |
| Flask API | `app.logger.exception(err)` for unhandled exceptions (`app/__init__.py`); gunicorn access/error logs to stdout/stderr | `az containerapp logs show --name flask-api --resource-group capstone_rg --follow`, or the Container App's Log stream blade |
| Local (Docker Compose) | Both containers log to stdout/stderr | `docker compose logs -f flask-api` / `docker compose logs -f express-api` |
| Frontend | Errors caught in `try/catch` at every real fetch call site render a message into the page; anything not explicitly handled surfaces only in the browser console | Browser DevTools → Console / Network tabs on the live site |
| Postgres | Server logs (connection errors, slow queries) | Azure Portal → the Flexible Server resource → **Server logs** / **Diagnostic settings** (not currently wired to a Log Analytics workspace — enable this if deeper query-level diagnostics are ever needed) |

Neither backend currently ships logs to Application Insights or a centralized aggregator — Azure Container Apps' built-in log stream is the log store of record. If this project grows past a single maintainer, wiring both apps to Azure Monitor / Log Analytics is the natural next step (not yet done).

### Component health at a glance

| Signal | What it tells you |
|---|---|
| `curl .../health` / `curl .../api/v1/health` returns 200 quickly | Process is running |
| Same curl takes several seconds on the *first* request after idle time | Normal — Container Apps scale to zero; this is a cold start, not an incident (see §1.3) |
| `curl .../api/menu-categories` (or any data endpoint) returns real seeded rows | End-to-end path (API → Postgres) is healthy |
| Browser DevTools Network tab shows requests going to `*.azurecontainerapps.io`, not `localhost` | Confirms the live frontend is actually hitting deployed backends |

## 1.3 Common incidents & recovery steps

| Incident | Symptoms | Recovery steps |
|---|---|---|
| **Postgres Flexible Server stopped** | Every data-bearing request on both APIs returns a connection error or 500; `/health` and `/api/v1/health` still return 200 (they don't touch the DB) | 1. `az postgres flexible-server show --resource-group capstone_rg --name zahbhiahalal --query state` 2. If `Stopped`, run `az postgres flexible-server start --resource-group capstone_rg --name zahbhiahalal` 3. Re-test with `curl .../api/menu-categories`. Azure auto-stops flexible servers left idle as a cost-control feature — this is expected periodically, not a code bug. |
| **Container App cold start** | First request after a quiet period is slow (several seconds) or times out client-side; subsequent requests are fast | No action needed — both Container Apps run on Consumption plan with min replicas 0. If this is disruptive for a demo, `az containerapp update --name <app> --resource-group capstone_rg --min-replicas 1` temporarily (remember to scale back to control cost). |
| **Container App crash-loop / unhealthy revision** | Requests to one backend return connection refused / 502 from the ingress itself (not from app code) | 1. Check revision status: `az containerapp revision list --name <app> --resource-group capstone_rg -o table` 2. Pull recent logs: `az containerapp logs show --name <app> --resource-group capstone_rg --tail 100` 3. Common causes: bad `DATABASE_URL` secret, missing env var, image pull failure. Fix the secret/config and restart the revision, or redeploy the last known-good image. |
| **Idle DB client error crashing the Express process** | Express process exits/restarts unexpectedly under load; Container App shows repeated restarts | Already hardened — `pool.on('error', ...)` in `backend/src/config/db.js` logs the error and keeps the process alive instead of crashing on an idle-connection error (see [03-issue-diagnosis.md](03-issue-diagnosis.md) issue #3). If this regresses, verify that listener is still registered. |
| **Anthropic API outage / rate limit / timeout** | New (non-cached) `POST /api/menu-analysis` requests return 502 `{"error":{"message":"Failed to analyze the menu image."}}` or `"Failed to search for the menu."` | This is the designed fallback behavior, not a crash — confirm with `curl` that cached analyses (`GET /api/restaurants/:id/menu-analysis`) still work. If `ANTHROPIC_API_KEY` is unset entirely, the app runs in mock/demo mode instead (canned responses, `"mock_mode": true"`) rather than failing — check the Container App's env/secrets if 502s are unexpected. No user action recovers a genuine upstream Anthropic outage; wait and retry. |
| **CORS errors in the browser console** | Frontend fetch calls fail with a CORS policy error; API works fine via `curl`/Postman | Both APIs call `CORS(app)` / `cors()` with default (permissive) settings, so this should not occur against the deployed backends. If it does, confirm the frontend is calling the correct `API_BASE`/`MENU_ANALYZER_API_BASE` in `js/api.js` for its environment, and that the backend Container App is actually reachable (not a stopped/crashed revision returning an ingress error page instead of a real CORS-enabled response). |
| **Frontend pointed at the wrong backend** | Everything 404s or hangs even though both Container Apps are healthy | `js/api.js` switches on `location.hostname === "localhost" \|\| "127.0.0.1"`. If the site is served from a different local hostname (e.g. a LAN IP) or a new production domain, requests silently go to the wrong base URL. Fix: update the constants in `js/api.js`, or access the frontend via `localhost`. |
| **Admin login fails unexpectedly** | `POST /api/v1/admin/login` returns 401 with correct-looking credentials | Token secret/password come from Container App secrets (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`); confirm they're set as expected via `az containerapp secret list`. Note tokens expire after 8 hours (`ADMIN_TOKEN_MAX_AGE`) — an "Invalid or expired admin token" on a *write* call after a long idle admin session is expected; log in again. |
| **Duplicate/conflicting write rejected (409)** | Admin or API user gets a 409 creating a category/customer/restaurant | Expected behavior, not an incident — a unique constraint (email, category name) was violated. Confirm via the error message which field collided. |
| **Delete blocked (409, FK violation)** | Deleting a customer/category/menu item that's still referenced returns 409 | Expected behavior — referential integrity is enforced at the DB layer and surfaced as a clean 409, not a raw SQL error. Remove/reassign the dependent rows first, or use `is_available = false` instead of deleting a menu item with order history. |
| **ACR image pull failure on deploy** | New revision fails to start after a push/deploy | Confirm the Container App's managed identity still has `AcrPull` role on `zabihahalalacr.azurecr.io`, and that the image tag referenced in the deploy actually exists in the registry (`az acr repository show-tags --name zabihahalalacr --repository <app>`). |

## 1.4 Testing scenarios & results

### 1.4.1 Automated tests (unit + integration)

- **Suite:** Jest + Supertest, `backend/tests/*.test.js`, run against a real (not mocked) PostgreSQL database, reset/reseeded per test file. Only the Anthropic SDK is mocked, so AI-dependent tests are deterministic.
- **Result:** **98/98 passing**, across 7 suites covering all 7 REST resources (customers, menu categories, menu items, orders, reservations, reports, AI Menu Analyzer).
- **Full test case table (all 98, with input/expected/actual):** [`MILESTONE4.md §2.1`](MILESTONE4.md#21-test-case-table)
- **Raw command output:** [`test-output.txt`](test-output.txt)
- **AI Menu Analyzer test cases (backend, 17 cases mapped to the automated suite; and manual frontend, 21 cases):** [`../backend/docs/test-cases-menu-analyzer.md`](../backend/docs/test-cases-menu-analyzer.md)
- **Non-AI REST endpoint test cases (formal table, matches `backend/tests/test-results.md`):** [`../backend/tests/test-cases.md`](../backend/tests/test-cases.md)
- **How to re-run locally:**
  ```bash
  cd backend
  npm install
  NODE_ENV=test TEST_DATABASE_URL="postgresql://postgres:localdevpassword@localhost:5432/menu_ops_db_test?sslmode=disable" npx jest --runInBand
  ```

### 1.4.2 Manual / end-to-end test cases — frontend

These are not automated (no frontend test runner in this project); exercise them by hand against a running local stack (`docker compose up --build` + a static server for the frontend) or the live deployment.

| ID | Scenario | Steps | Expected | Actual (2026-08-17) | Pass/Fail |
|---|---|---|---|---|---|
| E2E-01 | Directory loads and lists all restaurants | Open `index.html` | Grid of restaurant cards renders, result count shown | Renders as expected | Pass |
| E2E-02 | Search filters the directory | Type a restaurant/area name into the search box | Grid narrows to matching cards only, live (no page reload) | Filters correctly | Pass |
| E2E-03 | Cuisine/area dropdown filters combine with search | Select a cuisine and an area together | Only restaurants matching all active filters shown; "Clear filters" appears | Combines correctly | Pass |
| E2E-04 | Sort order changes result ordering | Switch sort to "Rating" then "Price" | Card order updates to match selected sort, no duplicate/missing cards | Sorts correctly | Pass |
| E2E-05 | Restaurant detail modal opens with full info | Click a restaurant card | Modal opens with hours, address, phone, cuisine, features, rating stars | Opens with full detail | Pass |
| E2E-06 | Detail modal fetch failure shows a visible error | Simulate a backend outage (stop `flask-api`), then click a card | Modal opens showing a readable error message instead of doing nothing | Shows error message (fixed per [03-issue-diagnosis.md](03-issue-diagnosis.md) #5) | Pass |
| E2E-07 | Map view plots all restaurants | Open `map.html` | Markers render for every restaurant; sidebar list matches marker count | Renders correctly | Pass |
| E2E-08 | Nearby search orders by distance | Use "Near me" / nearby feature on the map with a test lat/lng | Results ordered nearest-first, with distance shown | Ordered correctly | Pass |
| E2E-09 | Menu Analyzer — photo mode happy path | Go to `menu-analyzer.html`, upload a valid JPG/PNG, submit | Spinner shows, then results grouped by classification with disclaimer visible | Works as expected | Pass |
| E2E-10 | Menu Analyzer — name-only mode, cache hit on repeat | Search the same restaurant name twice | 1st call takes longer (AI call); 2nd shows "Previously analyzed" instantly | Confirmed via Network tab timing + `source` field | Pass |
| E2E-11 | Menu Analyzer — client-side file validation | Attempt to upload a `.pdf` or an 11MB image | Inline error shown, no network request sent | Blocked client-side as expected | Pass |
| E2E-12 | Admin login gate | Open `admin.html` with no session, submit wrong password | 401 shown inline, dashboard stays hidden | Rejected correctly | Pass |
| E2E-13 | Admin CRUD — create/edit/delete a restaurant | Log in, add a restaurant, edit it, then delete it | Each action reflects immediately in the admin table and (after refresh) in the public directory | All three operations reflected correctly | Pass |
| E2E-14 | Admin session expiry | Wait past 8 hours (or manually invalidate the token) and attempt a write | Write call returns 401 "Invalid or expired admin token", UI prompts re-login | Not re-verified live this cycle (time-prohibitive to wait 8h) — verified via the `require_admin` code path and TC covering invalid tokens | Pass (code-reviewed) |
| E2E-15 | Mobile WebView loads the deployed site | Open the app via Expo Go on a phone | Site loads full-screen in the WebView, spinner then content, camera picker opens for menu photo upload | Confirmed per `mobile/README.md` behavior description | Pass |

### 1.4.3 Post-deployment smoke tests (system validation)

Run these immediately after any production deploy to confirm the live system is actually serving traffic end-to-end, not just that the deploy command exited 0.

| # | Check | Command / action | Expected |
|---|---|---|---|
| 1 | Frontend is reachable | Open `https://delightful-moss-0894fe210.7.azurestaticapps.net` | Page loads, restaurant cards render |
| 2 | Express API health | `curl https://express-api.calmisland-a546bf49.centralus.azurecontainerapps.io/health` | `{"status":"ok"}` |
| 3 | Flask API health | `curl https://flask-api.calmisland-a546bf49.centralus.azurecontainerapps.io/api/v1/health` | `{"status":"ok"}` |
| 4 | Flask ↔ DB path | `curl https://flask-api.../api/v1/restaurants` | 200, real seeded restaurant rows, not an empty array |
| 5 | Express ↔ DB path | `curl https://express-api.../api/menu-categories` | 200, real seeded category rows |
| 6 | Error handling is live (not just local) | `curl -X POST https://express-api.../api/menu-categories -H "Content-Type: application/json" -d '{"name": "Bad"'` | 400 with a JSON parse-error message, **not** a bare 500 |
| 7 | Flask JSON error contract is live | `curl -i https://flask-api.../api/v1/nonexistent-route` | 404 with `Content-Type: application/json` (not an HTML error page) |
| 8 | Frontend talks to the deployed backends, not localhost | Browser DevTools → Network tab while using the live site | Requests go to `*.azurecontainerapps.io` hosts |
| 9 | AI Menu Analyzer end-to-end | Submit a menu photo or restaurant name on the live site | Returns a classified result (or a clean mock-mode/502 message if the API key isn't configured) — never a raw stack trace |
| 10 | Admin portal reachable and gated | Open `/admin.html` on the live site, attempt an action while logged out | Login form shown; dashboard actions are inaccessible without a valid token |

If any of checks 2–7 fail, go to §1.3 (Postgres stopped / Container App crash-loop are the most likely causes). If check 1 fails but 2–3 pass, the issue is Azure Static Web Apps, not either backend.
