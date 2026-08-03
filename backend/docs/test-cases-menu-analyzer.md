# Formal Test Case Document — AI Menu Analyzer

These test cases correspond 1:1 with the automated Jest + Supertest suite in [`/tests/menuAnalysis.test.js`](../tests/menuAnalysis.test.js). The Anthropic SDK is mocked (`jest.mock('@anthropic-ai/sdk')`) so the suite runs without a real `ANTHROPIC_API_KEY` or network access. The database is a real MySQL instance (`zabiha_halal_db_test`), reset to a known seeded state (3 restaurants from `sql/seed_menu_analyzer.sql`) before the file runs.

For the "DB rows to verify" column: query the test database directly after the request, e.g. `SELECT * FROM menu_analyses WHERE analysis_id = ?`.

## `POST /api/menu-analysis`

| TC ID | Description | Input | Expected HTTP Code | DB rows to verify |
|---|---|---|---|---|
| TC-MA-01 | Happy path, no `restaurant_name` — single AI call | `image` only (mocked AI returns 2 classified items) | 201 | `menu_analyses`: 1 new row, `restaurant_id` NULL, `status='completed'`. `menu_analysis_items`: 2 rows for that `analysis_id`. `analysis_requests`: 1 row, `restaurant_id` NULL, `response_code=201`. |
| TC-MA-02 | First request for a new restaurant persists it and its analysis | `image` + `restaurant_name` not yet in DB (mocked image-analysis + web-search calls) | 201 | `restaurants`: 1 new row. `menu_analyses`: 1 row linked to that `restaurant_id`. `analysis_requests`: 1 row, `response_code=201`. |
| TC-MA-03 | Second request for the same restaurant (case-insensitive) returns cached result, no AI call | Same `restaurant_name` as TC-MA-02, different casing | 200, `source: "cache"` | No new row in `menu_analyses` or `menu_analysis_items`. `analysis_requests`: 1 new row, `response_code=200`, same `restaurant_id` as TC-MA-02. Anthropic mock call count unchanged from TC-MA-02. |
| TC-MA-04 | Restaurant not in DB is created via web search | `restaurant_name` + `restaurant_location`, web-search mock returns `found: true` with address/cuisine | 201 | `restaurants`: new row with `source='web_search'`, `address` and `cuisine_type` populated from the mocked web-search JSON. |
| TC-MA-05 | Both `image` and `restaurant_name` missing | No `image`, no `restaurant_name` | 400 | `analysis_requests`: 1 new row, `restaurant_id` NULL, `response_code=400`. No `menu_analyses` row created. Anthropic mock not called. |
| TC-MA-06 | Unsupported image mime type | `image` attached with `contentType: text/plain` | 415 | No rows written to `analysis_requests`, `menu_analyses`, or `restaurants` (rejected by multer before reaching the controller). Anthropic mock not called. |
| TC-MA-07 | Image exceeds size limit | `image` larger than 10MB | 413 | Same as TC-MA-06 (rejected by multer before the controller). |
| TC-MA-08 | AI reports the photo is not a menu | `image` (mocked AI returns `{"error":"not_a_menu"}`) | 422 | `analysis_requests`: 1 new row, `response_code=422`. No `menu_analyses` row created. |
| TC-MA-09 | AI response is not valid JSON | `image` (mocked AI returns free-text prose) | 502 | `analysis_requests`: 1 new row, `response_code=502`. No `menu_analyses` row created. Raw AI text is written to the server console/log. |
| TC-MA-10 | Anthropic API call itself throws (e.g. network/timeout) | `image` (mock rejects the promise) | 502 | `analysis_requests`: 1 new row, `response_code=502`. No `menu_analyses` row created. |
| TC-MA-15 | Name-only mode: finds and classifies a menu via a single web-search call | `restaurant_name` + `restaurant_location`, no `image` (mocked web-search response with items + `menu_source_url`) | 201, `source: "ai_web_search"` | `restaurants`: 1 new row, `source='web_search'`. `menu_analyses`: 1 row linked to it. Anthropic mock called exactly once (no second call, unlike photo mode). |
| TC-MA-16 | Name-only mode: second request for the same restaurant returns cached result | Same `restaurant_name` as TC-MA-15, different casing, no `image` | 200, `source: "cache"` | No new `menu_analyses`/`menu_analysis_items` rows. Anthropic mock call count unchanged from TC-MA-15. |
| TC-MA-17 | Name-only mode: AI cannot find the restaurant or its menu online | `restaurant_name`, no `image` (mocked AI returns `{"error":"menu_not_found"}`) | 404 | `analysis_requests`: 1 new row, `response_code=404`. No `menu_analyses` row created. |

## `GET /api/restaurants/:id/menu-analysis`

| TC ID | Description | Input | Expected HTTP Code | DB rows to verify |
|---|---|---|---|---|
| TC-MA-11 | Fetch the most recent completed analysis for a restaurant | `:id` of a restaurant created via TC-MA-02-style POST | 200, `source: "cache"` | Response `items` match the rows in `menu_analysis_items` for that restaurant's latest `menu_analyses.analysis_id`. |
| TC-MA-12 | Restaurant exists but has no completed analysis | `:id` of a seeded restaurant (`Cafecito Pilsen`) | 404 | No `menu_analyses` rows exist for that `restaurant_id`. |
| TC-MA-13 | Restaurant does not exist | `:id = 9999` | 404 | — |
| TC-MA-14 | Malformed id | `:id = "abc"` | 400 | — |

**Totals: 17 documented backend test cases, 16 automated `it(...)` blocks in `tests/menuAnalysis.test.js` (TC-MA-02 and TC-MA-03, and TC-MA-15 and TC-MA-16, are each exercised by one test, since the second request only makes sense after the first). Run via `npm test`.**

---

## Frontend — `menu-analyzer.html` / `js/menuAnalyzer.js`

These are manual test cases (no automated frontend test runner in this project). Exercise them with the Express backend (`backend/`) running on `localhost:3000` and the static site served locally.

| TC ID | Description | Steps | Expected Result |
|---|---|---|---|
| TC-MA-F01 | Nav link reaches the analyzer | From `index.html` or `map.html`, click "Analyze a Menu" | Navigates to `menu-analyzer.html`; nav link is marked active there |
| TC-MA-F02 | Default mode is "Snap a Photo" | Load `menu-analyzer.html` | Photo tab is active/selected; name panel is hidden; analyze button is disabled (no photo yet) |
| TC-MA-F03 | Mode switching | Click "Search by Name" tab, then "Snap a Photo" tab | Panels toggle visibility; `aria-selected` flips on both tabs; previously entered field values are preserved |
| TC-MA-F04 | Photo selection enables the analyze button and shows a preview | Choose a valid JPG/PNG via the upload control | Thumbnail preview appears, upload prompt hides, "Analyze Menu Photo" button becomes enabled |
| TC-MA-F05 | Remove photo | With a photo selected, click the ✕ on the preview | Preview clears, upload prompt reappears, analyze button disables again |
| TC-MA-F06 | Client-side rejects non-image file | Select a `.txt` or `.pdf` file | Inline error "Please choose a JPG or PNG image." shown; no preview; button stays disabled; no network request sent |
| TC-MA-F07 | Client-side rejects oversized file | Select an image file larger than 10MB | Inline error "That image is over the 10MB limit…" shown; no network request sent |
| TC-MA-F08 | Search-by-name button stays disabled until a name is typed | On the name tab, leave the field empty, then type a restaurant name | Button disabled while empty; enables once the field has non-whitespace text |
| TC-MA-F09 | Loading state during a photo analysis | Submit a valid photo | Results area shows a spinner and "Analyzing photo…"; both tabs and both analyze buttons are disabled until the response arrives |
| TC-MA-F10 | Loading state during a name-only search | Submit a valid restaurant name with no photo | Results area shows a spinner and "Searching for the menu…" (distinct from the photo-mode message) |
| TC-MA-F11 | Successful results are grouped and color-coded | Submit a request that returns a mix of classifications | Items grouped under Vegetarian Safe (green), Safe with Modification (yellow, shows the modification text), Doubtful (orange); each item shows a confidence badge |
| TC-MA-F12 | "Not Suitable" group is collapsed by default | Submit a request whose result includes a `not_suitable` item | That group renders as a collapsed `<details>` (red) showing only the count until clicked open |
| TC-MA-F13 | Disclaimer always visible | Any successful response | The fixed disclaimer notice box is rendered below the results |
| TC-MA-F14 | Cache-hit source note | Submit the same restaurant name twice | Second response renders "Previously analyzed — from our database." instead of re-running analysis |
| TC-MA-F15 | Web-search source link | Submit a name-only search whose result includes `menu_source_url` | "Menu found via: `<link>`" is rendered with a working, `target="_blank"` link |
| TC-MA-F16 | 400 error — both inputs missing | (Not reachable via UI directly since buttons are disabled without input; verify via devtools by POSTing with neither field) | Friendly "Missing information" message shown |
| TC-MA-F17 | 404 fallback suggestion | Search by name for a restaurant the AI can't find | "We couldn't find a menu for that restaurant" message with a "Snap a Photo Instead" button that switches to photo mode |
| TC-MA-F18 | 413/415 server-side errors surface with friendly copy | Bypass client validation (e.g. via devtools) to submit an oversized/wrong-type image directly to the API | "Image too large" / "Unsupported file type" messages rendered, matching the corresponding backend status code |
| TC-MA-F19 | 422 not-a-menu error | Submit a photo of something that isn't a menu | "That doesn't look like a menu" message shown |
| TC-MA-F20 | 502 AI failure | Simulate a backend 502 (e.g. stop the Anthropic key/mock a failure) | "Analysis failed" message shown, with no crash or blank results area |
| TC-MA-F21 | Mobile camera capture | On a mobile device/browser, tap the photo upload control | Camera opens directly (via `capture="environment"`), not a `getUserMedia` in-page preview |

**Totals: 21 documented frontend test cases (manual).**
