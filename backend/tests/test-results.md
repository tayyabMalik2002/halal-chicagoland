# Automated Test Results — Zabiha Halal Backend

- **Command:** `npm test` (`NODE_ENV=test jest --runInBand`)
- **Date run:** 2026-08-07
- **Environment:** Node.js v20.18.1, MySQL 8.4.0, database `zabiha_halal_db_test` reset to the seeded fixture data before each test file via `tests/setup/resetDb.js`
- **Result:** 7 test suites passed, 97 / 97 tests passed, 0 failed

## Summary

| Test Suite | Tests | Passed | Failed |
|---|---|---|---|
| tests/menuCategories.test.js | 12 | 12 | 0 |
| tests/menuItems.test.js | 16 | 16 | 0 |
| tests/customers.test.js | 13 | 13 | 0 |
| tests/orders.test.js | 17 | 17 | 0 |
| tests/reservations.test.js | 16 | 16 | 0 |
| tests/reports.test.js | 7 | 7 | 0 |
| tests/menuAnalysis.test.js | 16 | 16 | 0 |
| **Total** | **97** | **97** | **0** |

The AI Menu Analyzer suite (`tests/menuAnalysis.test.js`) mocks the `@anthropic-ai/sdk` client (`jest.mock('@anthropic-ai/sdk', ...)`), so it exercises the full route → controller → service → MySQL persistence path without making a real Anthropic API call or requiring `ANTHROPIC_API_KEY`. One test intentionally feeds back non-JSON text to verify the 502 "invalid AI response" path, which logs an expected `console.error` in the raw output below — it is not a failure.

## Raw Output

```
PASS tests/reports.test.js
  GET /api/reports/daily-totals
    ✓ returns order counts and revenue grouped by day, excluding cancelled orders from revenue (8 ms)
    ✓ returns a single day total when a date is provided (2 ms)
    ✓ returns zeroed totals for a date with no orders (1 ms)
    ✓ rejects a malformed date query parameter
  GET /api/reports/popular-items
    ✓ returns the top items ranked by quantity ordered (1 ms)
    ✓ respects a custom limit (1 ms)
    ✓ rejects a non-positive-integer limit

PASS tests/customers.test.js
  GET /api/customers
    ✓ returns all seeded customers without password hashes (3 ms)
  GET /api/customers/:id
    ✓ returns a single customer (1 ms)
    ✓ returns 404 for a customer that does not exist (1 ms)
  POST /api/customers (register)
    ✓ registers a new customer with a hashed password (47 ms)
    ✓ rejects registration with a duplicate email (1 ms)
    ✓ rejects registration with an invalid email (1 ms)
    ✓ rejects registration with a password shorter than 8 characters (1 ms)
  PUT /api/customers/:id
    ✓ updates a customer profile field (1 ms)
    ✓ rejects updating to an email already used by another customer (2 ms)
    ✓ returns 404 when updating a customer that does not exist (1 ms)
  DELETE /api/customers/:id
    ✓ deletes a customer with no orders or reservations (42 ms)
    ✓ rejects deleting a customer who has existing orders (3 ms)
    ✓ returns 404 when deleting a customer that does not exist (1 ms)

  console.error
    Failed to parse AI response as JSON. Raw response: Sure, here is my analysis of the menu: not actually JSON.

      84 |     return JSON.parse(cleaned);
      85 |   } catch (err) {
    > 86 |     console.error('Failed to parse AI response as JSON. Raw response:', rawText);
         |             ^
      87 |     throw new Error('AI response was not valid JSON.');
      88 |   }
      89 | };

      at error (src/services/aiMenuService.js:86:13)
      at Object.parseJsonResponse [as analyzeMenuImage] (src/services/aiMenuService.js:144:10)
      at analyzeFromPhoto (src/controllers/menuAnalysisController.js:118:16)

PASS tests/menuAnalysis.test.js
  POST /api/menu-analysis
    ✓ analyzes a menu photo with no restaurant_name (happy path, single AI call) (7 ms)
    ✓ returns a cached analysis on a second request for the same restaurant, without calling the AI again (5 ms)
    ✓ creates a restaurant via web search when restaurant_name is not already in the database (2 ms)
    ✓ rejects a request with neither an image nor a restaurant_name (1 ms)
    ✓ rejects an unsupported image mime type
    ✓ rejects an image over the 10MB size limit (9 ms)
    ✓ returns 422 when the AI reports the image is not a menu (1 ms)
    ✓ returns 502 when the AI response is not valid JSON (10 ms)
    ✓ returns 502 when the Anthropic API call itself fails (2 ms)
  POST /api/menu-analysis — name-only search (no image)
    ✓ finds a menu via web search with a single AI call (2 ms)
    ✓ returns a cached analysis on a second name-only request, without calling the AI again (4 ms)
    ✓ returns 404 when the AI cannot find the restaurant or its menu (1 ms)
  GET /api/restaurants/:id/menu-analysis
    ✓ returns the most recent completed analysis for a restaurant (3 ms)
    ✓ returns 404 for a restaurant with no completed analysis (1 ms)
    ✓ returns 404 for a restaurant that does not exist
    ✓ returns 400 for a malformed restaurant id (1 ms)

PASS tests/orders.test.js
  GET /api/orders
    ✓ returns all seeded orders (2 ms)
    ✓ filters by customer_id (1 ms)
    ✓ filters by status (1 ms)
    ✓ rejects an invalid status filter (1 ms)
  GET /api/orders/:id
    ✓ returns an order with its line items joined to menu item names (1 ms)
    ✓ returns 404 for an order that does not exist
  POST /api/orders (transactional creation)
    ✓ creates an order, inserts line items, and computes the total from current menu prices (4 ms)
    ✓ rolls back the entire order when one line item is invalid (no partial order is created) (1 ms)
    ✓ rejects an order for an unavailable menu item (3 ms)
    ✓ rejects an order for a customer that does not exist
    ✓ rejects an order with an empty items array (1 ms)
  PATCH /api/orders/:id/status
    ✓ advances a pending order to confirmed (1 ms)
    ✓ rejects an illegal status transition (skipping steps) (1 ms)
    ✓ rejects an unknown status value (1 ms)
    ✓ returns 404 when updating status for an order that does not exist
  DELETE /api/orders/:id
    ✓ deletes an order and cascades to its order_items (3 ms)
    ✓ returns 404 when deleting an order that does not exist (1 ms)

PASS tests/menuCategories.test.js
  GET /api/menu-categories
    ✓ returns all seeded categories ordered by display_order (3 ms)
  GET /api/menu-categories/:id
    ✓ returns a single category (1 ms)
    ✓ returns 404 for a category that does not exist
    ✓ returns 400 for a non-numeric id (1 ms)
  POST /api/menu-categories
    ✓ creates a new category (2 ms)
    ✓ rejects a request missing the required name field
    ✓ rejects a duplicate category name (3 ms)
  PUT /api/menu-categories/:id
    ✓ updates an existing category (1 ms)
    ✓ returns 404 when updating a category that does not exist (1 ms)
  DELETE /api/menu-categories/:id
    ✓ deletes a category with no menu items (2 ms)
    ✓ rejects deleting a category that still has menu items (1 ms)
    ✓ returns 404 when deleting a category that does not exist

PASS tests/reservations.test.js
  GET /api/reservations
    ✓ returns all seeded reservations (3 ms)
    ✓ filters by status (1 ms)
    ✓ rejects an invalid date filter (1 ms)
  GET /api/reservations/:id
    ✓ returns a single reservation
    ✓ returns 404 for a reservation that does not exist (1 ms)
  POST /api/reservations
    ✓ creates a reservation with default status pending (6 ms)
    ✓ rejects a reservation with a malformed date (1 ms)
    ✓ rejects a reservation with a zero party size
    ✓ rejects a reservation for a customer that does not exist
  PUT /api/reservations/:id
    ✓ updates party size and status (2 ms)
    ✓ returns 404 when updating a reservation that does not exist
  PATCH /api/reservations/:id/cancel
    ✓ cancels a pending reservation (1 ms)
    ✓ rejects cancelling a reservation that is already cancelled (1 ms)
    ✓ returns 404 when cancelling a reservation that does not exist (1 ms)
  DELETE /api/reservations/:id
    ✓ deletes a reservation (1 ms)
    ✓ returns 404 when deleting a reservation that does not exist (1 ms)

PASS tests/menuItems.test.js
  GET /api/menu-items
    ✓ returns all seeded menu items (3 ms)
    ✓ filters by category_id (1 ms)
    ✓ filters by availability (1 ms)
    ✓ rejects an invalid available query value
  GET /api/menu-items/:id
    ✓ returns a single menu item
    ✓ returns 404 for a menu item that does not exist (1 ms)
  POST /api/menu-items
    ✓ creates a new menu item (2 ms)
    ✓ rejects a negative price (4 ms)
    ✓ rejects a category_id that does not exist (1 ms)
  PUT /api/menu-items/:id
    ✓ updates a menu item price (1 ms)
    ✓ returns 404 when updating a menu item that does not exist (1 ms)
  PATCH /api/menu-items/:id/availability
    ✓ marks a menu item unavailable (1 ms)
    ✓ rejects a non-boolean is_available value (1 ms)
  DELETE /api/menu-items/:id
    ✓ deletes a menu item that has no orders (2 ms)
    ✓ rejects deleting a menu item referenced by an existing order (2 ms)
    ✓ returns 404 when deleting a menu item that does not exist (1 ms)

Test Suites: 7 passed, 7 total
Tests:       97 passed, 97 total
Snapshots:   0 total
Time:        0.985 s, estimated 1 s
Ran all test suites.
```

No failures occurred, so no fixes were required. `tests/reports.test.js` previously hardcoded the demo date `2026-07-20` for its "single day total" case; since seeded orders get `created_at = CURRENT_TIMESTAMP` at seed time, that test now computes "today" dynamically instead of relying on a fixed date. See [`test-cases.md`](./test-cases.md) for the case-by-case breakdown with Actual Result / Pass-Fail filled in against this run.
