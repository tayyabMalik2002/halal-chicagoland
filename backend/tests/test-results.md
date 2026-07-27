# Automated Test Results — Zabiha Halal Backend

- **Command:** `npm test` (`NODE_ENV=test jest --runInBand`)
- **Date run:** 2026-07-20
- **Environment:** Node.js v20.18.1, MySQL 8.4.0, database `zabiha_halal_db_test` reset to the seeded fixture data before each test file via `tests/setup/resetDb.js`
- **Result:** 6 test suites passed, 81 / 81 tests passed, 0 failed

## Summary

| Test Suite | Tests | Passed | Failed |
|---|---|---|---|
| tests/menuCategories.test.js | 12 | 12 | 0 |
| tests/menuItems.test.js | 16 | 16 | 0 |
| tests/customers.test.js | 13 | 13 | 0 |
| tests/orders.test.js | 17 | 17 | 0 |
| tests/reservations.test.js | 16 | 16 | 0 |
| tests/reports.test.js | 7 | 7 | 0 |
| **Total** | **81** | **81** | **0** |

## Raw Output

```
PASS tests/orders.test.js
  GET /api/orders
    ✓ returns all seeded orders (13 ms)
    ✓ filters by customer_id (2 ms)
    ✓ filters by status (2 ms)
    ✓ rejects an invalid status filter (1 ms)
  GET /api/orders/:id
    ✓ returns an order with its line items joined to menu item names (2 ms)
    ✓ returns 404 for an order that does not exist (2 ms)
  POST /api/orders (transactional creation)
    ✓ creates an order, inserts line items, and computes the total from current menu prices (10 ms)
    ✓ rolls back the entire order when one line item is invalid (no partial order is created) (3 ms)
    ✓ rejects an order for an unavailable menu item (7 ms)
    ✓ rejects an order for a customer that does not exist (1 ms)
    ✓ rejects an order with an empty items array (2 ms)
  PATCH /api/orders/:id/status
    ✓ advances a pending order to confirmed (2 ms)
    ✓ rejects an illegal status transition (skipping steps) (1 ms)
    ✓ rejects an unknown status value (1 ms)
    ✓ returns 404 when updating status for an order that does not exist (2 ms)
  DELETE /api/orders/:id
    ✓ deletes an order and cascades to its order_items (4 ms)
    ✓ returns 404 when deleting an order that does not exist (2 ms)

PASS tests/customers.test.js
  GET /api/customers
    ✓ returns all seeded customers without password hashes (3 ms)
  GET /api/customers/:id
    ✓ returns a single customer (2 ms)
    ✓ returns 404 for a customer that does not exist (1 ms)
  POST /api/customers (register)
    ✓ registers a new customer with a hashed password (45 ms)
    ✓ rejects registration with a duplicate email (1 ms)
    ✓ rejects registration with an invalid email (1 ms)
    ✓ rejects registration with a password shorter than 8 characters
  PUT /api/customers/:id
    ✓ updates a customer profile field (2 ms)
    ✓ rejects updating to an email already used by another customer (1 ms)
    ✓ returns 404 when updating a customer that does not exist (1 ms)
  DELETE /api/customers/:id
    ✓ deletes a customer with no orders or reservations (45 ms)
    ✓ rejects deleting a customer who has existing orders (4 ms)
    ✓ returns 404 when deleting a customer that does not exist (1 ms)

PASS tests/reservations.test.js
  GET /api/reservations
    ✓ returns all seeded reservations (3 ms)
    ✓ filters by status (2 ms)
    ✓ rejects an invalid date filter (1 ms)
  GET /api/reservations/:id
    ✓ returns a single reservation
    ✓ returns 404 for a reservation that does not exist
  POST /api/reservations
    ✓ creates a reservation with default status pending (3 ms)
    ✓ rejects a reservation with a malformed date (1 ms)
    ✓ rejects a reservation with a zero party size (1 ms)
    ✓ rejects a reservation for a customer that does not exist (1 ms)
  PUT /api/reservations/:id
    ✓ updates party size and status (2 ms)
    ✓ returns 404 when updating a reservation that does not exist (1 ms)
  PATCH /api/reservations/:id/cancel
    ✓ cancels a pending reservation (1 ms)
    ✓ rejects cancelling a reservation that is already cancelled (1 ms)
    ✓ returns 404 when cancelling a reservation that does not exist (1 ms)
  DELETE /api/reservations/:id
    ✓ deletes a reservation (4 ms)
    ✓ returns 404 when deleting a reservation that does not exist (1 ms)

PASS tests/menuItems.test.js
  GET /api/menu-items
    ✓ returns all seeded menu items (3 ms)
    ✓ filters by category_id (1 ms)
    ✓ filters by availability (1 ms)
    ✓ rejects an invalid available query value (1 ms)
  GET /api/menu-items/:id
    ✓ returns a single menu item (1 ms)
    ✓ returns 404 for a menu item that does not exist (1 ms)
  POST /api/menu-items
    ✓ creates a new menu item (2 ms)
    ✓ rejects a negative price (1 ms)
    ✓ rejects a category_id that does not exist (1 ms)
  PUT /api/menu-items/:id
    ✓ updates a menu item price (1 ms)
    ✓ returns 404 when updating a menu item that does not exist (1 ms)
  PATCH /api/menu-items/:id/availability
    ✓ marks a menu item unavailable (1 ms)
    ✓ rejects a non-boolean is_available value (1 ms)
  DELETE /api/menu-items/:id
    ✓ deletes a menu item that has no orders (2 ms)
    ✓ rejects deleting a menu item referenced by an existing order (4 ms)
    ✓ returns 404 when deleting a menu item that does not exist (1 ms)

PASS tests/menuCategories.test.js
  GET /api/menu-categories
    ✓ returns all seeded categories ordered by display_order (3 ms)
  GET /api/menu-categories/:id
    ✓ returns a single category (1 ms)
    ✓ returns 404 for a category that does not exist (1 ms)
    ✓ returns 400 for a non-numeric id
  POST /api/menu-categories
    ✓ creates a new category (3 ms)
    ✓ rejects a request missing the required name field
    ✓ rejects a duplicate category name (3 ms)
  PUT /api/menu-categories/:id
    ✓ updates an existing category (1 ms)
    ✓ returns 404 when updating a category that does not exist
  DELETE /api/menu-categories/:id
    ✓ deletes a category with no menu items (2 ms)
    ✓ rejects deleting a category that still has menu items (1 ms)
    ✓ returns 404 when deleting a category that does not exist (1 ms)

PASS tests/reports.test.js
  GET /api/reports/daily-totals
    ✓ returns order counts and revenue grouped by day, excluding cancelled orders from revenue (3 ms)
    ✓ returns a single day total when a date is provided (2 ms)
    ✓ returns zeroed totals for a date with no orders (1 ms)
    ✓ rejects a malformed date query parameter
  GET /api/reports/popular-items
    ✓ returns the top items ranked by quantity ordered (2 ms)
    ✓ respects a custom limit (1 ms)
    ✓ rejects a non-positive-integer limit

Test Suites: 6 passed, 6 total
Tests:       81 passed, 81 total
Snapshots:   0 total
Time:        0.803 s, estimated 2 s
Ran all test suites.
```

No failures occurred, so no fixes were required. See [`test-cases.md`](./test-cases.md) for the case-by-case breakdown with Actual Result / Pass-Fail filled in against this run.
