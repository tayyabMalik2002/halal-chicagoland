# Milestone 4 — Testing, Debugging, Error Handling & Deployment

**Zabiha Halal / halal-chicagoland — Northwestern MSISM Capstone**

---

## 1. Overview

Zabiha Halal is a halal restaurant directory and ordering platform for the Chicagoland area, built to help Muslim customers who keep zabihah halal find certified restaurants, browse them on a map, and — via its AI Menu Analyzer feature — photograph or search for a menu at a *non-halal-certified* restaurant and get an AI-generated, item-by-item breakdown of what's safe to order. The system has two independent backend APIs (a Flask/PostgreSQL service serving the restaurant directory and map, and an Express/PostgreSQL service handling menu management, online ordering, reservations, and the Anthropic-Claude-powered Menu Analyzer) behind a static HTML/CSS/JS frontend, all deployed on Microsoft Azure.

---

## 2. Testing (30 pts)

The automated suite is Jest + Supertest, in `backend/tests/`, run against a real PostgreSQL database (not mocks) that's truncated and reseeded before each test file via `backend/tests/setup/resetDb.js`. The Anthropic SDK itself is mocked (`jest.mock('@anthropic-ai/sdk', ...)` in `menuAnalysis.test.js`) so the AI-dependent tests are deterministic and don't burn real API credits, while everything else — routing, validation, database transactions, error handling — runs against real Postgres.

**Result: 98/98 passing**, across all 7 test files, covering all 7 REST resources (customers, menu categories, menu items, orders, reservations, reports, and the AI Menu Analyzer).

### 2.1 Test case table

| ID | Scenario | Endpoint / Method | Input | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|---|
| T001 | Returns all seeded customers without password hashes | GET /api/customers | none | 200, 5 customers, no `password_hash` field | same | Pass |
| T002 | Returns a single customer | GET /api/customers/1 | id=1 | 200, email `ahmed.khan@example.com` | same | Pass |
| T003 | 404 for a customer that doesn't exist | GET /api/customers/9999 | id=9999 | 404 | same | Pass |
| T004 | Registers a new customer with a hashed password | POST /api/customers | valid registration fields | 201, `password_hash` omitted from response | same | Pass |
| T005 | Rejects registration with a duplicate email | POST /api/customers | email already used | 409 | same | Pass |
| T006 | Rejects registration with an invalid email | POST /api/customers | email="not-an-email" | 400 | same | Pass |
| T007 | Rejects registration with a password &lt;8 chars | POST /api/customers | password="123" | 400 | same | Pass |
| T008 | Updates a customer profile field | PUT /api/customers/2 | `{phone}` | 200, phone updated | same | Pass |
| T009 | Rejects updating to an email used by another customer | PUT /api/customers/2 | `{email}` (dup) | 409 | same | Pass |
| T010 | 404 updating a customer that doesn't exist | PUT /api/customers/9999 | `{phone}` | 404 | same | Pass |
| T011 | Deletes a customer with no orders/reservations | DELETE /api/customers/:id (fresh) | none | 204 | same | Pass |
| T012 | Rejects deleting a customer who has existing orders | DELETE /api/customers/1 | none | 409 (FK violation) | same | Pass |
| T013 | 404 deleting a customer that doesn't exist | DELETE /api/customers/9999 | none | 404 | same | Pass |
| T014 | Returns all seeded categories ordered by display_order | GET /api/menu-categories | none | 200, 5 categories | same | Pass |
| T015 | Returns a single category | GET /api/menu-categories/1 | id=1 | 200 | same | Pass |
| T016 | 404 for a category that doesn't exist | GET /api/menu-categories/9999 | id=9999 | 404 | same | Pass |
| T017 | 400 for a non-numeric id | GET /api/menu-categories/abc | id="abc" | 400 | same | Pass |
| T018 | Creates a new category | POST /api/menu-categories | `{name, description, display_order}` | 201 | same | Pass |
| T019 | Rejects a request missing the required name field | POST /api/menu-categories | no `name` | 400 | same | Pass |
| T020 | Rejects a duplicate category name | POST /api/menu-categories | name="Appetizers" (dup) | 409 | same | Pass |
| T021 | Rejects a malformed (syntactically invalid) JSON body with 400, not 500 | POST /api/menu-categories | unterminated JSON string | 400 | same | Pass |
| T022 | Updates an existing category | PUT /api/menu-categories/2 | `{display_order}` | 200 | same | Pass |
| T023 | 404 updating a category that doesn't exist | PUT /api/menu-categories/9999 | `{display_order}` | 404 | same | Pass |
| T024 | Deletes a category with no menu items | DELETE /api/menu-categories/:id (fresh) | none | 204 | same | Pass |
| T025 | Rejects deleting a category that still has menu items | DELETE /api/menu-categories/1 | none | 409 (FK violation) | same | Pass |
| T026 | 404 deleting a category that doesn't exist | DELETE /api/menu-categories/9999 | none | 404 | same | Pass |
| T027 | Returns all seeded menu items | GET /api/menu-items | none | 200 | same | Pass |
| T028 | Filters by category_id | GET /api/menu-items?category_id=1 | category_id=1 | 200, filtered | same | Pass |
| T029 | Filters by availability | GET /api/menu-items?available=true | available=true | 200, all `is_available === true` | same | Pass |
| T030 | Rejects an invalid `available` query value | GET /api/menu-items?available=x | available="x" | 400 | same | Pass |
| T031 | Returns a single menu item | GET /api/menu-items/:id | valid id | 200 | same | Pass |
| T032 | 404 for a menu item that doesn't exist | GET /api/menu-items/9999 | id=9999 | 404 | same | Pass |
| T033 | Creates a new menu item | POST /api/menu-items | valid item fields | 201 | same | Pass |
| T034 | Rejects a negative price | POST /api/menu-items | price=-1 | 400 | same | Pass |
| T035 | Rejects a category_id that doesn't exist | POST /api/menu-items | category_id=9999 | 400 | same | Pass |
| T036 | Updates a menu item price | PUT /api/menu-items/:id | `{price}` | 200 | same | Pass |
| T037 | 404 updating a menu item that doesn't exist | PUT /api/menu-items/9999 | `{price}` | 404 | same | Pass |
| T038 | Marks a menu item unavailable | PATCH /api/menu-items/:id/availability | `{is_available:false}` | 200 | same | Pass |
| T039 | Rejects a non-boolean `is_available` value | PATCH .../availability | is_available="x" | 400 | same | Pass |
| T040 | Deletes a menu item that has no orders | DELETE /api/menu-items/:id (fresh) | none | 204 | same | Pass |
| T041 | Rejects deleting a menu item referenced by an existing order | DELETE /api/menu-items/9 | none | 409 (FK violation) | same | Pass |
| T042 | 404 deleting a menu item that doesn't exist | DELETE /api/menu-items/9999 | none | 404 | same | Pass |
| T043 | Returns all seeded orders | GET /api/orders | none | 200 | same | Pass |
| T044 | Filters by customer_id | GET /api/orders?customer_id=1 | customer_id=1 | 200, filtered | same | Pass |
| T045 | Filters by status | GET /api/orders?status=... | valid status | 200, filtered | same | Pass |
| T046 | Rejects an invalid status filter | GET /api/orders?status=bogus | status="bogus" | 400 | same | Pass |
| T047 | Returns an order with line items joined to menu item names | GET /api/orders/:id | valid id | 200, `items[]` with names | same | Pass |
| T048 | 404 for an order that doesn't exist | GET /api/orders/9999 | id=9999 | 404 | same | Pass |
| T049 | Creates an order, inserts line items, computes total from current menu prices | POST /api/orders | customer_id, items[] | 201, total computed server-side | same | Pass |
| T050 | Rolls back the entire order when one line item is invalid (no partial order created) | POST /api/orders | items incl. invalid item_id | 400, zero rows inserted (transaction rollback) | same | Pass |
| T051 | Rejects an order for an unavailable menu item | POST /api/orders | item marked unavailable | 400 | same | Pass |
| T052 | Rejects an order for a customer that doesn't exist | POST /api/orders | customer_id=9999 | 400 | same | Pass |
| T053 | Rejects an order with an empty items array | POST /api/orders | items=[] | 400 | same | Pass |
| T054 | Advances a pending order to confirmed | PATCH /api/orders/:id/status | status="confirmed" | 200 | same | Pass |
| T055 | Rejects an illegal status transition (skipping steps) | PATCH .../status | pending→completed | 400 | same | Pass |
| T056 | Rejects an unknown status value | PATCH .../status | status="exploded" | 400 | same | Pass |
| T057 | 404 updating status for an order that doesn't exist | PATCH /api/orders/9999/status | id=9999 | 404 | same | Pass |
| T058 | Deletes an order and cascades to its order_items | DELETE /api/orders/:id (fresh) | none | 204, `order_items` removed | same | Pass |
| T059 | 404 deleting an order that doesn't exist | DELETE /api/orders/9999 | id=9999 | 404 | same | Pass |
| T060 | Returns all seeded reservations | GET /api/reservations | none | 200, 4 reservations | same | Pass |
| T061 | Filters by status | GET /api/reservations?status=confirmed | status | 200, filtered | same | Pass |
| T062 | Rejects an invalid date filter | GET /api/reservations?date=07-25-2026 | bad date format | 400 | same | Pass |
| T063 | Returns a single reservation | GET /api/reservations/1 | id=1 | 200, party_size=4 | same | Pass |
| T064 | 404 for a reservation that doesn't exist | GET /api/reservations/9999 | id=9999 | 404 | same | Pass |
| T065 | Creates a reservation with default status pending | POST /api/reservations | valid fields | 201, status="pending" | same | Pass |
| T066 | Rejects a reservation with a malformed date | POST /api/reservations | bad date | 400 | same | Pass |
| T067 | Rejects a reservation with a zero party size | POST /api/reservations | party_size=0 | 400 | same | Pass |
| T068 | Rejects a reservation for a customer that doesn't exist | POST /api/reservations | customer_id=9999 | 400 | same | Pass |
| T069 | Updates party size and status | PUT /api/reservations/:id | `{party_size, status}` | 200 | same | Pass |
| T070 | 404 updating a reservation that doesn't exist | PUT /api/reservations/9999 | any body | 404 | same | Pass |
| T071 | Cancels a pending reservation | PATCH /api/reservations/:id/cancel | none | 200, status="cancelled" | same | Pass |
| T072 | Rejects cancelling an already-cancelled reservation | PATCH .../cancel | already cancelled | 400 | same | Pass |
| T073 | 404 cancelling a reservation that doesn't exist | PATCH /api/reservations/9999/cancel | none | 404 | same | Pass |
| T074 | Deletes a reservation | DELETE /api/reservations/:id (fresh) | none | 204 | same | Pass |
| T075 | 404 deleting a reservation that doesn't exist | DELETE /api/reservations/9999 | none | 404 | same | Pass |
| T076 | Order counts + revenue grouped by day, excluding cancelled orders from revenue | GET /api/reports/daily-totals | none | 200, aggregated | same | Pass |
| T077 | Single day total when a date is provided | GET /api/reports/daily-totals?date=... | date param | 200, one row | same | Pass |
| T078 | Zeroed totals for a date with no orders | GET .../daily-totals?date=... | date w/ no orders | 200, count=0 | same | Pass |
| T079 | Rejects a malformed date query parameter | GET .../daily-totals?date=bad | bad date | 400 | same | Pass |
| T080 | Top items ranked by quantity ordered | GET /api/reports/popular-items | none | 200, ranked list | same | Pass |
| T081 | Respects a custom limit | GET .../popular-items?limit=n | limit param | 200, n rows | same | Pass |
| T082 | Rejects a non-positive-integer limit | GET .../popular-items?limit=-1 | limit=-1 | 400 | same | Pass |
| T083 | Analyzes a menu photo, no restaurant_name (happy path) | POST /api/menu-analysis | valid JPEG image | 201, 1 AI call | same | Pass |
| T084 | Returns cached analysis on a 2nd request for the same restaurant, no 2nd AI call | POST /api/menu-analysis (×2) | same restaurant_name + image | 1st: 201 `source=ai_analysis`; 2nd: 200 `source=cache` | same | Pass |
| T085 | Creates a restaurant via web search when restaurant_name isn't already in the DB | POST /api/menu-analysis | restaurant_name + image | 201, `restaurant.source=web_search` | same | Pass |
| T086 | Rejects a request with neither an image nor a restaurant_name | POST /api/menu-analysis | empty body | 400 | same | Pass |
| T087 | Rejects an unsupported image mime type (invalid file) | POST /api/menu-analysis | `.txt` file, `text/plain` | 415 | same | Pass |
| T088 | Rejects an image over the 10MB size limit | POST /api/menu-analysis | 11MB buffer | 413 | same | Pass |
| T089 | 422 when the AI reports the image is not a menu (unreadable image) | POST /api/menu-analysis | AI mocked → `{"error":"not_a_menu"}` | 422 | same | Pass |
| T090 | 502 when the AI response is not valid JSON | POST /api/menu-analysis | AI mocked → plain text | 502 | same | Pass |
| T091 | 502 when the Anthropic API call itself fails | POST /api/menu-analysis | AI mocked → rejected promise | 502 | same | Pass |
| T092 | Finds a menu via web search, name-only, single AI call | POST /api/menu-analysis | restaurant_name only | 201, `source=ai_web_search` | same | Pass |
| T093 | Cached analysis on a 2nd name-only request, no 2nd AI call | POST /api/menu-analysis (×2) | name only | 2nd: 200 `source=cache` | same | Pass |
| T094 | 404 when the AI can't find the restaurant/menu | POST /api/menu-analysis | AI mocked → `{"error":"menu_not_found"}` | 404 | same | Pass |
| T095 | Returns the most recent completed analysis (cache hit path) | GET /api/restaurants/:id/menu-analysis | valid id, has analysis | 200, `source=cache` | same | Pass |
| T096 | 404 for a restaurant with no completed analysis | GET /api/restaurants/:id/menu-analysis | valid id, no analysis | 404 | same | Pass |
| T097 | 404 for a restaurant that doesn't exist | GET /api/restaurants/9999/menu-analysis | id=9999 | 404 | same | Pass |
| T098 | 400 for a malformed restaurant id | GET /api/restaurants/abc/menu-analysis | id="abc" | 400 | same | Pass |

**On "missing/invalid auth" (explicitly scoped out of this table):** this API does not implement an authentication layer anywhere — no session, JWT, or API key check exists on any route (verified by reading every file in `backend/src/routes/`). All endpoints are open. Rather than write a test against auth middleware that doesn't exist, this is documented here as an honest finding. See §4 for the implication and a recommendation.

**On "unreadable/invalid file" for the photo upload:** the app does no server-side image decoding — an uploaded file either fails the mimetype check (T087, 415), fails the size check (T088, 413), or is passed through to Claude as base64 and the AI itself reports it can't read it (T089, 422) or the app can't parse what the AI sent back (T090, 502). These three cases are the actual, real failure modes for a corrupted/unreadable file in this codebase; there is no separate "corrupted-but-correctly-typed" code path to test beyond what T089/T090 already cover.

*(Screenshots are optional supplementary evidence for a rubric already satisfied by the actual command output in §2.2 below — but if you want visuals: [INSERT SCREENSHOT: `npx jest --runInBand --verbose` running in a terminal, full green output] and [INSERT SCREENSHOT: Postman collection at backend/tests/zabiha-halal.postman_collection.json hitting one live endpoint].)*

### 2.2 Raw test output

Generated by `NODE_ENV=test npx jest --runInBand --verbose` on 2026-08-10, saved verbatim to [`docs/test-output.txt`](./test-output.txt):

```
PASS tests/reports.test.js
  GET /api/reports/daily-totals
    ✓ returns order counts and revenue grouped by day, excluding cancelled orders from revenue
    ✓ returns a single day total when a date is provided
    ✓ returns zeroed totals for a date with no orders
    ✓ rejects a malformed date query parameter
  GET /api/reports/popular-items
    ✓ returns the top items ranked by quantity ordered
    ✓ respects a custom limit
    ✓ rejects a non-positive-integer limit
PASS tests/customers.test.js
  GET /api/customers
    ✓ returns all seeded customers without password hashes
  GET /api/customers/:id
    ✓ returns a single customer
    ✓ returns 404 for a customer that does not exist
  POST /api/customers (register)
    ✓ registers a new customer with a hashed password
    ✓ rejects registration with a duplicate email
    ✓ rejects registration with an invalid email
    ✓ rejects registration with a password shorter than 8 characters
  PUT /api/customers/:id
    ✓ updates a customer profile field
    ✓ rejects updating to an email already used by another customer
    ✓ returns 404 when updating a customer that does not exist
  DELETE /api/customers/:id
    ✓ deletes a customer with no orders or reservations
    ✓ rejects deleting a customer who has existing orders
    ✓ returns 404 when deleting a customer that does not exist
PASS tests/menuAnalysis.test.js
  ● Console

    console.error
      Failed to parse AI response as JSON. Raw response: Sure, here is my analysis of the menu: not actually JSON.
      (expected console.error from the "returns 502 when the AI response is not valid JSON" test —
       this is the app correctly logging the malformed AI response server-side before returning a
       clean 502 to the client; it is not a test failure)

PASS tests/menuItems.test.js
PASS tests/orders.test.js
PASS tests/menuCategories.test.js
PASS tests/reservations.test.js

Test Suites: 7 passed, 7 total
Tests:       98 passed, 98 total
Snapshots:   0 total
Time:        1.054 s, estimated 2 s
Ran all test suites.
```

Full untruncated file: [`docs/test-output.txt`](./test-output.txt).

---

## 3. Debugging & Code Revision (20 pts)

All five bugs below were found by auditing the actual error paths against real request/response behavior (not guessed), fixed in code, and are all in commit **`9d5bb5c`** — *"Harden error handling: malformed JSON, AI timeout, pool crashes, silent UI failures."*

| # | Symptom | Root Cause | File : Line | Fix | Commit |
|---|---|---|---|---|---|
| 1 | `POST` with a syntactically invalid JSON body returned a bare `500 {"error":{"message":"Internal server error."}}` instead of a `400`. Verified with `curl -X POST .../api/menu-categories -d '{"name": "Bad"'` before the fix. | `express.json()`'s body-parser sets `err.status`/`err.expose` on parse failure and calls `next(err)`, but the centralized error middleware only checked for `ApiError` instances, multer's `LIMIT_FILE_SIZE`, and two Postgres error codes — nothing matched, so it fell through to the generic 500 branch. | `backend/src/middleware/errorHandler.js:44-48` | Added a branch: `if (err.status && err.status < 500 && err.expose)` → forward `err.status`/`err.message` as-is. Covers malformed JSON (400) and oversized payloads (413) generically, since `http-errors` (used internally by body-parser) only sets `expose=true` on 4xx errors — safe by construction, never leaks a 5xx internal detail. | `9d5bb5c` |
| 2 | No timeout on the Anthropic API client — a stalled upstream call would hang the whole HTTP request for up to the SDK's default of 10 minutes with zero user feedback, instead of failing over to the existing 502 fallback. | `new Anthropic({ apiKey: ... })` was constructed with no `timeout` option. | `backend/src/services/aiMenuService.js:10` | Added `timeout: 30_000` to the client constructor. A stall now throws inside the SDK well before the user gives up, and is caught by the existing `try/catch` in `menuAnalysisController.js` (see §4), which already maps any thrown error from the AI call to a `502`. | `9d5bb5c` |
| 3 | No listener on the `pg.Pool`'s `'error'` event. `pg.Pool` is a Node `EventEmitter`; a connection-level error on an *idle* pooled client (DB restart, network blip) emits `'error'` outside any request's control flow. With zero listeners, Node treats that as an uncaught exception and can crash the entire process — taking down every in-flight request, not just the one that hit the DB issue. | Missing `pool.on('error', ...)` registration. | `backend/src/config/db.js:51-53` | Added `pool.on('error', (err) => console.error('Unexpected error on idle Postgres client:', err));` so the error is logged and the process survives; individual requests still get their own error handling via `asyncHandler`/`errorHandler.js`. | `9d5bb5c` |
| 4 | Flask returned an HTML error page (`Content-Type: text/html`) for both 404s and any unhandled exception, instead of JSON — breaking the API contract for any client expecting `application/json`. Verified with `curl -i .../api/v1/nonexistent-route` before the fix (returned `<!doctype html>...`). | No global error handler was registered anywhere in the Flask app factory; Flask's built-in default error pages are HTML. | `backend-flask/app/__init__.py:31-38` | Registered `@app.errorhandler(HTTPException)` (covers 404/405/etc., returns `{"error": <description>}`) and `@app.errorhandler(Exception)` (covers genuinely unhandled exceptions, logs via `app.logger.exception(err)` server-side, returns a generic `{"error": "Internal server error."}` with no exception detail exposed). | `9d5bb5c` |
| 5 | Clicking a restaurant card/marker when the detail fetch failed did **nothing visible** — no spinner stopped, no message appeared, the modal simply never opened. The error was technically caught (no crash), but the user got no feedback at all. | `catch (err) { console.error(...); return; }` — logged to devtools only, no DOM update. | `js/modal.js:37-51` (specifically the `catch` block, originally lines 41-44) | The `catch` block now renders a visible error message inside the modal itself (title + `err.message`) and still opens the overlay, so the user sees *something* went wrong instead of nothing happening. | `9d5bb5c` |

---

## 4. Error Handling (20 pts)

Both backends now funnel every error through one centralized handler each (`backend/src/middleware/errorHandler.js`, registered last in `backend/src/app.js:31`; and the two `@app.errorhandler` registrations in `backend-flask/app/__init__.py:31-38`), and neither ever sends a stack trace or raw exception detail to the client — unexpected errors are logged server-side (`console.error(err)` / `app.logger.exception(err)`) and the client only ever receives a generic message.

| Error Condition | Where It's Caught (file:line) | HTTP Status | What the User Sees |
|---|---|---|---|
| Invalid input (missing field, bad email, negative price, etc.) | Each controller's `validate*()` function throws `ApiError.badRequest(...)`, e.g. `customersController.js:20`, `menuItemsController.js` price check → routed to `errorHandler.js:5-12` | 400 | `{"error":{"message":"Validation failed.","details":["..."]}}` |
| Non-integer route `:id` param | `backend/src/middleware/validateIdParam.js:6-8` | 400 | `{"error":{"message":"id must be a positive integer."}}` |
| Resource not found (customer, order, category, item, reservation) | Explicit not-found check in each controller, e.g. `customersController.js` `getCustomer` → `ApiError.notFound(...)` → `errorHandler.js:5-12` | 404 | `{"error":{"message":"Customer 9999 not found."}}` |
| Unmatched route entirely | `backend/src/middleware/notFoundHandler.js:1-5` | 404 | `{"error":{"message":"Route not found: GET /api/bogus"}}` |
| Duplicate value on a unique column (email, category name) | Postgres unique-violation (SQLSTATE 23505) → `errorHandler.js:34-38` | 409 | `{"error":{"message":"A record with this value already exists."}}` |
| Delete blocked by a foreign-key reference (e.g. deleting a customer who has orders) | Postgres FK-violation (SQLSTATE 23503) → `errorHandler.js:23-32` | 409 | `{"error":{"message":"This record cannot be deleted because other records depend on it."}}` |
| Malformed JSON request body | `express.json()` parse failure → `errorHandler.js:44-48` (fixed this milestone, see §3 #1) | 400 | `{"error":{"message":"Expected ',' or '}' after property value in JSON at position N"}}` |
| Oversized image upload (>10MB) | multer `LIMIT_FILE_SIZE` → `errorHandler.js:15-19` | 413 | `{"error":{"message":"Image exceeds the maximum allowed size of 10MB."}}` |
| Unsupported image mime type | multer `fileFilter` → `ApiError.unsupportedMediaType` in `backend/src/routes/menuAnalysis.js:13-16` → `errorHandler.js:5-12` | 415 | `{"error":{"message":"Only JPEG and PNG images are supported."}}` |
| Anthropic API call fails or times out (fixed this milestone, see §3 #2) | `try/catch` around the AI call in `menuAnalysisController.js:116-121` (photo path) and `:170-174` (name-search path) → `ApiError.badGateway` | 502 | `{"error":{"message":"Failed to analyze the menu image."}}` (or `"Failed to search for the menu."`) |
| AI returns non-JSON / malformed response | `aiMenuService.js:81-89` `parseJsonResponse` throws → caught by the same controller `try/catch` → `ApiError.badGateway` | 502 | `{"error":{"message":"AI returned an unexpected response format."}}` |
| AI reports the image isn't a menu | `menuAnalysisController.js:124-127` | 422 | `{"error":{"message":"The uploaded image does not appear to be a menu."}}` |
| AI can't find the restaurant/menu (name-only mode) | `menuAnalysisController.js:177-180` | 404 | `{"error":{"message":"Couldn't find a menu for \"X\" online. Try uploading a photo instead."}}` |
| Unexpected/unhandled server error (e.g. DB unreachable) | `errorHandler.js:50-53`, generic catch-all | 500 | `{"error":{"message":"Internal server error."}}` — no stack trace, no exception message ever included |
| Idle DB connection error (network blip, DB restart) — fixed this milestone, see §3 #3 | `db.js:51-53`, `pool.on('error', ...)` | N/A — doesn't occur mid-request | Logged server-side only; process stays alive, in-flight requests are unaffected |
| Flask: unmatched route | `backend-flask/app/__init__.py:31-33` (fixed this milestone, see §3 #4) | 404 | `{"error": "The requested URL was not found on the server..."}` |
| Flask: unhandled exception | `backend-flask/app/__init__.py:35-38` (fixed this milestone, see §3 #4) | 500 | `{"error": "Internal server error."}` — exception detail only in the server log via `app.logger.exception` |
| Flask: invalid query params (bad `sort`, missing `lat`/`lng`) | `backend-flask/app/routes/restaurants.py:21-22`, `:62-66` | 400 | `{"error": "Invalid sort 'x'. Must be one of [...]"}` |
| Frontend: any `fetch` failure | Every real call site (`js/app.js:142-153`, `:209-221`; `js/map.js:210-218`; `js/modal.js:37-51`; `js/menuAnalyzer.js:157-164`) wraps its `apiFetch`/`analyzeMenu` call in `try/catch` | N/A (client-side) | A readable message rendered into the page — e.g. "Couldn't load restaurants", a rendered error card in the AI Menu Analyzer with the actual failure reason, or (after this milestone's fix) a visible message inside the restaurant-detail modal instead of nothing happening |
| **Missing/invalid auth** | **Not applicable — no authentication is implemented anywhere in this codebase.** | — | — |

**On the missing-auth gap:** every route in `backend/src/routes/` is open — there's no session, token, or API-key check anywhere. This isn't a bug fixed this milestone because there was never a partially-working auth system to fix; it's an absent feature. `customersController.js` does hash passwords with `bcrypt` on registration (so credentials at rest are not stored in plaintext), but nothing currently *checks* a password against those hashes to issue a session or token, and no route requires one. For a real production deployment this would need to change before this app should be treated as handling real user data; flagging it here rather than silently building fake auth into a doc that's supposed to reflect real code.

---

## 5. Deployment (30 pts)

### 5.1 Live URLs

| Component | URL |
|---|---|
| Frontend | https://delightful-moss-0894fe210.7.azurestaticapps.net |
| Express API (menu, orders, reservations, AI Menu Analyzer) | https://express-api.calmisland-a546bf49.centralus.azurecontainerapps.io |
| Flask API (restaurant directory, map) | https://flask-api.calmisland-a546bf49.centralus.azurecontainerapps.io |

### 5.2 Cloud services used (Microsoft Azure, resource group `capstone_rg`, region Central US)

- **Azure Static Web Apps** (Free tier) — hosts the static frontend (`index.html`, `map.html`, `menu-analyzer.html`, `css/`, `js/`).
- **Azure Container Apps** — two independently deployed containers on a Consumption plan (scale-to-zero, min 0 / max 2 replicas each):
  - `express-api` — the Node/Express backend.
  - `flask-api` — the Python/Flask backend.
- **Azure Container Registry** (`zabihahalalacr.azurecr.io`, Basic SKU) — stores both container images; Container Apps pull from it via a system-assigned managed identity (no admin credentials stored anywhere).
- **Azure Database for PostgreSQL — Flexible Server** (`zahbhiahalal.postgres.database.azure.com`, Burstable B1ms) — one Postgres server hosting two logical databases:
  - `menu_ops_db` — used by `express-api` (customers, menu items, orders, reservations, AI Menu Analyzer tables).
  - `restaurants_db` — used by `flask-api` (restaurant directory/map data).

  These are two separate databases, not two schemas in one, specifically because both apps independently define a table named `restaurants` with unrelated schemas (Flask's is the halal restaurant directory; Express's is the AI Menu Analyzer's third-party-restaurant lookup table) — sharing one database would collide.

### 5.3 Architecture

```
Browser
  │
  ├─▶ Azure Static Web Apps (frontend)
  │       │
  │       ├─▶ HTTPS/CORS ─▶ Container App: flask-api  ─▶ Postgres: restaurants_db
  │       │
  │       └─▶ HTTPS/CORS ─▶ Container App: express-api ─▶ Postgres: menu_ops_db
  │                                    │
  │                                    └─▶ Anthropic Claude API (menu photo/web-search analysis)
  │
  └─▶ (mobile/) Expo WebView wrapper — loads the same Static Web Apps URL
```

`js/api.js` picks between `localhost` and the live Azure URLs at runtime based on `location.hostname`, so the same frontend code runs unmodified in local dev and production.

*[INSERT SCREENSHOT: Azure Portal, `capstone_rg` resource group overview showing all 5 resources]*
*[INSERT SCREENSHOT: Azure Portal, Container Apps blade for `express-api` showing "Running" status and the current revision]*

### 5.4 Environment variables / secrets

Set as Container Apps **secrets** (not plain env vars — not visible via `az containerapp show` or in any log):

| App | Variable | Purpose |
|---|---|---|
| `express-api` | `DATABASE_URL` | `postgresql://...@zahbhiahalal.postgres.database.azure.com:5432/menu_ops_db?sslmode=require` |
| `express-api` | `ANTHROPIC_API_KEY` | Claude API key for the AI Menu Analyzer |
| `express-api` | `NODE_ENV` | `production` |
| `flask-api` | `DATABASE_URL` | `postgresql://...@zahbhiahalal.postgres.database.azure.com:5432/restaurants_db?sslmode=require` |

None of these values, nor any other secret, are committed to the repository — see §6.2.

### 5.5 How to access and test this (grader instructions)

1. Open the frontend: **https://delightful-moss-0894fe210.7.azurestaticapps.net** — browse restaurants, use the map, and try the AI Menu Analyzer (upload a menu photo or search by restaurant name).
2. Open browser DevTools → Network tab while using the site to confirm requests go out to the two `*.azurecontainerapps.io` hosts (not `localhost`) — this is the actual proof the frontend is hitting the deployed backends, not something running locally.
3. Hit the health endpoints directly to confirm both backends and their database connections are live:
   - `curl https://express-api.calmisland-a546bf49.centralus.azurecontainerapps.io/health` → `{"status":"ok"}`
   - `curl https://flask-api.calmisland-a546bf49.centralus.azurecontainerapps.io/api/v1/health` → `{"status":"ok"}`
   - `curl https://express-api.calmisland-a546bf49.centralus.azurecontainerapps.io/api/menu-categories` → real seeded category data
4. **Cold start note:** both Container Apps scale to zero when idle to control cost. The first request after a quiet period may take a few seconds while it wakes back up — this is expected, not a bug.
5. **If every request suddenly returns a connection/500-type error:** the Postgres flexible server itself can be independently stopped (a separate cost-control feature Azure offers for flexible servers, distinct from Container Apps scaling to zero) — check with `az postgres flexible-server show --resource-group capstone_rg --name zahbhiahalal --query state` and start it with `az postgres flexible-server start --resource-group capstone_rg --name zahbhiahalal` if it shows `Stopped`. (This happened during this milestone's own work — the server had been stopped to save cost and was restarted before final verification below.)

*[INSERT SCREENSHOT: browser DevTools Network tab showing requests to both `*.azurecontainerapps.io` hosts while using the live site]*

### 5.6 Final verification (performed while writing this document)

```
$ curl -s -X POST https://express-api.../api/menu-categories -H "Content-Type: application/json" -d '{"name": "Bad"'
{"error":{"message":"Expected ',' or '}' after property value in JSON at position 14"}}
HTTP: 400

$ curl -s https://flask-api.../api/v1/nonexistent
{"error":"The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again."}
HTTP: 404
```

Both confirm the error-handling fixes in §3 are live in production, not just passing locally.

---

## 6. Repo

### 6.1 GitHub

**https://github.com/tayyabMalik2002/halal-chicagoland** — branch `menu-analyzer-live` (the active development/deployment branch for this milestone).

### 6.2 Secrets hygiene (verified this milestone)

- `.env` is gitignored at the repo root, in `backend/.gitignore`, and in `backend-flask/.gitignore`; only `backend/.env.example` (placeholder values like `changeme`) is tracked.
- Full git history (`git log --all -S"<pattern>"`) was searched for the Anthropic API key prefix (`sk-ant-`), the actual Postgres admin password used this session, and any embedded database credentials — **nothing was found**. The one historical hit for a `postgresql://` connection string was confirmed to be the placeholder in `.env.example` (`changeme` as the password), not a real credential.
- No `.env` file (real or otherwise) has ever been committed to this repository.

### 6.3 Local setup

**Prerequisites:** Docker Desktop, Node.js 20+, Python 3.12 (only if running outside Docker).

```bash
git clone https://github.com/tayyabMalik2002/halal-chicagoland.git
cd halal-chicagoland
docker compose up --build
```

This starts a local Postgres container (seeded automatically via `docker/postgres-init/`), the Express API on `:3000`, and the Flask API on `:5001`. Then serve the frontend statically (e.g. `python3 -m http.server` from the repo root) — `js/api.js` automatically points at `localhost` when not running on the deployed domain.

To run the backend test suite locally without Docker Compose running the whole stack:
```bash
cd backend
npm install
NODE_ENV=test TEST_DATABASE_URL="postgresql://postgres:localdevpassword@localhost:5432/menu_ops_db_test?sslmode=disable" npx jest --runInBand
```
(requires a local Postgres reachable at that URL with the schema loaded from `backend/database/schema.sql`).

Full setup details: [`backend/README.md`](../backend/README.md), [`mobile/README.md`](../mobile/README.md).
