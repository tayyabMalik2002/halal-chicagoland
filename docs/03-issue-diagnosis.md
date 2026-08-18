# 3. Issue Diagnosis, Research, Resolution, and Sharing

[← Back to index](README.md)

This section documents the troubleshooting process behind real issues found and fixed during development, in the order they were addressed. Each entry follows the same structure: what happened, the environment at the time, how to reproduce it, root-cause diagnosis, what was consulted while researching a fix, the actual resolution, and how the fix was verified.

---

## Issue 1 — Malformed JSON body returned a bare 500 instead of a 400

**Description.** Sending a syntactically invalid JSON body to any `POST`/`PUT` endpoint on the Express API returned `500 {"error":{"message":"Internal server error."}}`. Expected behavior: a client error like this should be a `400`, not a `500` — a `500` implies a server-side bug, and it also gave callers no actionable detail about what was wrong with their request.

**Environment & setup.** Local dev, Node.js 20, Express API (`backend/`) running via `npm run dev` against the local Postgres instance from `docker compose up`.

**Steps to reproduce.**
```bash
curl -X POST http://localhost:3000/api/menu-categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Bad"'
```

**Diagnosis.** `express.json()`'s body-parser sets `err.status` and `err.expose` on the error object when it fails to parse the body, then calls `next(err)` to hand it to Express's error-handling chain. The app's centralized error handler (`backend/src/middleware/errorHandler.js`) only had explicit branches for `ApiError` instances, multer's `LIMIT_FILE_SIZE`, and two specific Postgres error codes — nothing matched a raw body-parser error, so it fell through to the generic catch-all 500 branch.

**Research process.** Reviewed the Express.js official documentation on error-handling middleware and built-in `express.json()` behavior; read through the `body-parser` and `http-errors` package source/README (body-parser uses `http-errors` internally, which is what actually sets `.status` and `.expose` on the thrown error) to confirm that `expose` is only ever `true` for 4xx-class errors — meaning it's safe to trust that flag to decide what's safe to forward to the client without leaking internals.

**Resolution steps.** Added a branch to `errorHandler.js`: `if (err.status && err.status < 500 && err.expose)`, forwarding `err.status` and `err.message` as-is to the client. This generically covers malformed JSON (400) and any other 4xx `http-errors`-based failure (e.g. oversized payloads, 413) without needing a special case for every body-parser failure mode.

**Outcome verification.** Re-ran the reproduction `curl` — now returns `400` with the parser's message (`"Expected ',' or '}' after property value in JSON at position 14"`). Also re-verified against the **live production** deployment post-deploy (not just locally): same 400 response confirmed via `curl` against `express-api.calmisland-a546bf49.centralus.azurecontainerapps.io`. Fix included in commit `9d5bb5c`; file/line: `backend/src/middleware/errorHandler.js:44-48`.

---

## Issue 2 — No timeout on the Anthropic API client could hang requests indefinitely

**Description.** The Anthropic SDK client was constructed with no explicit timeout. A stalled upstream call (network issue, provider-side slowness) would hang the entire HTTP request for up to the SDK's default (several minutes), with zero feedback to the user, instead of failing over to the app's existing 502 fallback path.

**Environment & setup.** Local dev, `backend/src/services/aiMenuService.js`, `@anthropic-ai/sdk` v0.115.0.

**Steps to reproduce.** Not directly reproducible without an actual network stall; identified by code audit of every external call in the codebase, specifically checking for timeout/retry configuration on outbound HTTP clients — a class of bug that's easy to miss because it only manifests under real-world network conditions, not in normal testing.

**Diagnosis.** `new Anthropic({ apiKey: ... })` had no `timeout` option set, so the SDK's own (long) default applied. The controller already had a `try/catch` around the AI call that maps any thrown error to a `502`, but that safety net only fires if something actually *throws* — a hang doesn't throw, it just never resolves.

**Research process.** Consulted the Anthropic Node/TypeScript SDK's GitHub repository and reference docs for supported client constructor options, confirming `timeout` (milliseconds) is a first-class option that causes the SDK to throw an `APIConnectionTimeoutError` once exceeded — which the existing `try/catch` would then correctly catch.

**Resolution steps.** Added `timeout: 30_000` to the `Anthropic` client constructor in `aiMenuService.js`. A stalled call now throws well before a user would give up waiting, and is caught by the existing error handling in `menuAnalysisController.js`, which maps it to the same clean `502` used for any other AI failure.

**Outcome verification.** Confirmed via code review that the thrown timeout error is a normal `Error` instance caught by the existing `try/catch` (no special-casing needed). Full Jest suite (which mocks the Anthropic SDK) still passed 98/98 after the change, confirming no regression to the mocked AI test paths. Fix included in commit `9d5bb5c`; file/line: `backend/src/services/aiMenuService.js:10`.

---

## Issue 3 — Missing `pg.Pool` error listener risked crashing the entire Express process

**Description.** No listener was registered on the `pg.Pool`'s `'error'` event. `pg.Pool` is a Node `EventEmitter`; a connection-level error on an *idle* pooled client (a DB restart, a network blip) emits `'error'` outside the control flow of any specific in-flight request. With zero listeners, Node treats that as an uncaught exception, which can crash the whole process — taking down every in-flight request, not just whichever one happened to touch the bad connection.

**Environment & setup.** Local dev, `backend/src/config/db.js`, `pg` v8.13.0.

**Steps to reproduce.** Not safely reproducible on demand without deliberately killing a live DB connection mid-idle (destructive to test against production); identified via code audit of the `pg.Pool` setup against Node's `EventEmitter` documentation on unhandled `'error'` events being fatal by default.

**Diagnosis.** `db.js` created the pool but never called `pool.on('error', ...)`. This is a known Node.js `EventEmitter` gotcha, not specific to `pg`: any `EventEmitter` that emits `'error'` with no listener throws that error as an uncaught exception.

**Research process.** Cross-checked the Node.js `EventEmitter` documentation on the special-cased `'error'` event, and the `node-postgres` (`pg`) official documentation/GitHub issues on `Pool`, which explicitly recommends registering a `pool.on('error', ...)` handler for exactly this reason — idle-client errors are otherwise unhandled by design.

**Resolution steps.** Added `pool.on('error', (err) => console.error('Unexpected error on idle Postgres client:', err));` in `db.js`. The error is now logged server-side and the process survives; per-request errors continue to be handled independently via `asyncHandler`/`errorHandler.js`.

**Outcome verification.** Reviewed that the listener is registered at pool-creation time (before any queries run), so it's active for the lifetime of the process. Full test suite still passed 98/98. This class of bug is inherently hard to verify with an automated test (it requires an actual idle-connection failure), so verification here is code-review-based rather than a reproduced-and-fixed test case — documented honestly rather than claiming false certainty. Fix included in commit `9d5bb5c`; file/line: `backend/src/config/db.js:51-53`.

---

## Issue 4 — Flask returned HTML error pages instead of JSON

**Description.** Both 404s and any unhandled exception on the Flask API returned an HTML error page (`Content-Type: text/html`) — Flask's built-in default — instead of JSON, breaking the API's contract for any client (including this project's own frontend) expecting `application/json` on every response.

**Environment & setup.** Local dev, `backend-flask/app/__init__.py`, Flask 3.0.3.

**Steps to reproduce.**
```bash
curl -i http://localhost:5001/api/v1/nonexistent-route
# before the fix: Content-Type: text/html; <!doctype html>...
```

**Diagnosis.** No global error handler was registered anywhere in the Flask application factory (`create_app`). Flask's default error pages are HTML unless you explicitly register `@app.errorhandler` callbacks.

**Research process.** Referenced the Flask official documentation section on custom error handlers (`@app.errorhandler`), specifically the distinction between handling `werkzeug.exceptions.HTTPException` (covers all standard HTTP error codes like 404/405) versus the base `Exception` class (covers genuinely unhandled application exceptions, e.g. a DB error), since the two need different handling — an `HTTPException` already has a safe, non-sensitive `.description`, while a raw `Exception` might contain internal detail that shouldn't reach the client.

**Resolution steps.** Registered two handlers in `app/__init__.py`: `@app.errorhandler(HTTPException)` returns `{"error": err.description}` with the original status code; `@app.errorhandler(Exception)` logs the full exception server-side via `app.logger.exception(err)` and returns a generic `{"error": "Internal server error."}` with no exception detail exposed to the client.

**Outcome verification.**
```bash
curl -i http://localhost:5001/api/v1/nonexistent-route
# after: Content-Type: application/json; {"error": "The requested URL was not found..."}
```
Re-verified against the live production Flask API post-deploy: same JSON 404 confirmed. Fix included in commit `9d5bb5c`; file/line: `backend-flask/app/__init__.py:31-38`.

---

## Issue 5 — Silent failure when the restaurant detail modal's fetch failed

**Description.** Clicking a restaurant card or map marker when the underlying detail fetch failed did **nothing visible** to the user — no spinner stopped, no error message appeared, the modal simply never opened. The error was technically caught (the app didn't crash), but the user had no way to know anything had gone wrong.

**Environment & setup.** Local dev, `js/modal.js`, tested by pointing the frontend at a stopped/unreachable Flask API.

**Steps to reproduce.** Stop the Flask API (`docker compose stop flask-api`), leave the frontend running, and click any restaurant card.

**Diagnosis.** The `catch` block around the detail fetch was `catch (err) { console.error(...); return; }` — it logged to the browser DevTools console only and returned without updating the DOM at all. This is a real-world UX failure mode: from the user's perspective, clicking did nothing.

**Research process.** This was a UI/UX pattern issue rather than an API question — reviewed how the rest of the app (`js/app.js`'s directory-load error path) already handled fetch failures, to keep the fix consistent with the existing "render a readable message into the page" convention used elsewhere, rather than introducing a new error-display pattern.

**Resolution steps.** Changed the `catch` block in `modal.js` to render a visible error message (a title plus `err.message`) inside the modal itself, and still open the overlay — so the user sees *something* happened, instead of the click appearing to do nothing.

**Outcome verification.** Repeated the reproduction steps (Flask API stopped, click a card): the modal now opens showing a readable error message. Restored the Flask API and confirmed the modal returns to showing full restaurant detail normally. Fix included in commit `9d5bb5c`; file/line: `js/modal.js:37-51`.

---

## Issue 6 — `logo_url` generated `http://` instead of `https://` behind Azure ingress

**Description.** Restaurant logo URLs returned by the Flask API (`logo_url_absolute()`, built with Flask's `url_for(..., _external=True)`) were `http://...` even though the site is only ever served over HTTPS in production — a mixed-content-adjacent issue that could cause browsers to block or warn on the logo images.

**Environment & setup.** Production (Azure Container Apps), Flask API behind Azure's ingress layer, which terminates TLS at the ingress and forwards plain HTTP to the container.

**Steps to reproduce.** Hit any restaurant endpoint on the deployed Flask API and inspect `logoUrl` in the response — scheme is `http://` despite the request having arrived over HTTPS.

**Diagnosis.** Flask's `url_for(_external=True)` decides the URL scheme based on the *incoming request* it sees, and by the time a request reaches the Flask process behind Azure Container Apps' ingress, TLS has already been terminated — Flask only ever sees a plain HTTP request internally, with the original scheme preserved only in the `X-Forwarded-Proto` header. Without telling Flask to trust and read that header, it has no way to know the original request was HTTPS.

**Research process.** Consulted Azure Container Apps documentation on ingress and forwarded headers (confirming `X-Forwarded-Proto`/`X-Forwarded-Host` are set on the original external request), and Werkzeug's `ProxyFix` middleware documentation, which is the standard, framework-recommended way to make a Flask app trust specific `X-Forwarded-*` headers from a known reverse proxy.

**Resolution steps.** Wrapped the app with `app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)` in `app/__init__.py`, telling Flask to trust one hop of `X-Forwarded-Proto` and `X-Forwarded-Host` — exactly matching Azure Container Apps' single-hop ingress.

**Outcome verification.** Redeployed and re-checked `logoUrl` on a live restaurant response — now consistently `https://`. Verified no regression for local dev (no proxy in front of `flask-api` locally, so `ProxyFix` is a no-op when the forwarded headers aren't present). Fix in commit `f6d7b84`.

---

## Issue 7 — Stale documentation: schema docs said "MySQL" after the project migrated to PostgreSQL

**Description.** While compiling this documentation package, [`backend/docs/database-design.md`](../backend/docs/database-design.md) and [`backend/docs/demo-script.md`](../backend/docs/demo-script.md) were found to state "Target RDBMS: MySQL 8.0+" and reference `mysql2`/`mysql` CLI commands, while the actual, currently-deployed schema (`backend/database/schema.sql`) targets **PostgreSQL 14+**, and `docker-compose.yml`/`.env.example`/`MILESTONE4.md` all confirm Postgres is the real, live database engine. A developer following those older docs verbatim would run `mysql -u <user> -p < database/schema.sql` against a schema file full of Postgres-specific syntax (`GENERATED ALWAYS AS IDENTITY`, `CREATE TRIGGER ... EXECUTE FUNCTION`, etc.) and get immediate, confusing errors.

**Environment & setup.** Discovered during documentation review (2026-08-17), reading `backend/docs/*.md` alongside the actual `backend/database/schema.sql` and `docker-compose.yml`.

**Steps to reproduce.** Follow `backend/docs/demo-script.md`'s setup instructions (`mysql -u <user> -p < database/schema.sql`) against the current repo — fails immediately, since no MySQL server is provisioned anywhere in this project anymore and the SQL itself is Postgres-flavored.

**Diagnosis.** The project migrated its database engine from MySQL (Milestone 2) to PostgreSQL (to match Azure Database for PostgreSQL in the eventual production deployment), and `schema.sql`/`docker-compose.yml`/the root `README.md` were updated accordingly, but `backend/docs/database-design.md` and `backend/docs/demo-script.md` — written during the MySQL milestone — were never updated to match. This is a documentation-drift issue, not a code defect: the running system has been correct and Postgres-based throughout; only two doc files described a database engine that hasn't been used for some time.

**Research process.** Cross-referenced every file that states or implies a database engine (`backend/database/schema.sql` header comment, `docker-compose.yml`, `backend/.env.example`, `backend-flask/app/config.py`'s `_normalize_database_url`, and `docs/MILESTONE4.md`) to confirm Postgres is unambiguously the actual engine everywhere except the two stale docs, before concluding this was a documentation bug rather than an active migration in progress.

**Resolution steps.** This documentation package (`docs/02-system-setup.md`) was written with Postgres-only setup instructions throughout, and this entry flags the specific stale files so they can be corrected or archived. Recommended follow-up (not yet done): either update `backend/docs/database-design.md`'s "Target RDBMS" line and `demo-script.md`'s `mysql` commands to Postgres equivalents, or add a header note to both pointing readers to the current `backend/database/schema.sql` and this `/docs` package as the source of truth.

**Outcome verification.** Confirmed by re-reading `backend/database/schema.sql`'s own header comment ("Target: PostgreSQL 14+ ... Unlike MySQL, this does not CREATE/DROP the database itself") and successfully running the Postgres-flavored setup steps in [02-system-setup.md §2.3](02-system-setup.md#23-manual-setup--backend-express-api-backend) against a real Postgres instance via Docker Compose during this documentation effort.

---

## Sharing / posting notes

Per the assignment's posting rules, all fixes above were made directly in application code (not worked around) and are traceable to specific commits (`9d5bb5c`, `f6d7b84`) and file/line locations, so any reviewer can independently verify each fix against the actual diff rather than taking this document's word for it. Issues 1–5 are also cross-referenced from the automated test suite where a corresponding regression test exists (see [01-production-support.md §1.4.1](01-production-support.md#141-automated-tests-unit--integration)); issues 3, 6, and 7 are inherently harder to cover with an automated test (a live idle-connection failure, a real reverse-proxy hop, and a documentation-only issue respectively) and were verified by code review and manual reproduction instead — noted explicitly above rather than overstating test coverage that doesn't exist.
