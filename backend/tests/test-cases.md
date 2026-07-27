# Formal Test Case Document — Zabiha Halal Backend

These test cases correspond 1:1 with the automated Jest + Supertest suite in `/tests/*.test.js`. All cases were executed against a real MySQL database (`zabiha_halal_db_test`), reset to a known seeded state before each test file runs (see `/tests/setup/resetDb.js`).

Actual Result / Pass-Fail columns reflect the run recorded in [`test-results.md`](./test-results.md) on **2026-07-20**. Full raw output: `npm test`.

## Menu Categories — `/api/menu-categories`

| TC ID | Description | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| TC-CAT-01 | List all categories | `GET /api/menu-categories` | 200, 5 categories, first is "Appetizers" | 200, 5 categories returned | Pass |
| TC-CAT-02 | Get category by valid ID | `GET /api/menu-categories/1` | 200, category_id 1, name "Appetizers" | 200, matched | Pass |
| TC-CAT-03 | Get category — not found | `GET /api/menu-categories/9999` | 404, error message | 404 returned | Pass |
| TC-CAT-04 | Get category — malformed ID | `GET /api/menu-categories/abc` | 400 | 400 returned | Pass |
| TC-CAT-05 | Create category — valid | `POST /api/menu-categories` `{"name":"Soups","description":"Warm starters","display_order":6}` | 201, category returned with new ID | 201, category created | Pass |
| TC-CAT-06 | Create category — missing name | `POST /api/menu-categories` `{"description":"No name here"}` | 400 with details mentioning "name" | 400 returned | Pass |
| TC-CAT-07 | Create category — duplicate name | `POST /api/menu-categories` `{"name":"Appetizers"}` | 409 conflict | 409 returned | Pass |
| TC-CAT-08 | Update category | `PUT /api/menu-categories/2` `{"display_order":20}` | 200, display_order updated, other fields unchanged | 200, updated correctly | Pass |
| TC-CAT-09 | Update category — not found | `PUT /api/menu-categories/9999` `{"display_order":1}` | 404 | 404 returned | Pass |
| TC-CAT-10 | Delete category — no items | Create temp category, then `DELETE /api/menu-categories/:id` | 204 | 204 returned | Pass |
| TC-CAT-11 | Delete category — still referenced | `DELETE /api/menu-categories/1` | 409 (has menu items) | 409 returned | Pass |
| TC-CAT-12 | Delete category — not found | `DELETE /api/menu-categories/9999` | 404 | 404 returned | Pass |

## Menu Items — `/api/menu-items`

| TC ID | Description | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| TC-ITEM-01 | List all menu items | `GET /api/menu-items` | 200, 18 items | 200, 18 items | Pass |
| TC-ITEM-02 | Filter by category_id | `GET /api/menu-items?category_id=3` | 200, 4 items, all category_id 3 | 200, matched | Pass |
| TC-ITEM-03 | Filter by availability | `GET /api/menu-items?available=true` | 200, all items is_available=1 | 200, matched | Pass |
| TC-ITEM-04 | Filter — invalid available value | `GET /api/menu-items?available=maybe` | 400 | 400 returned | Pass |
| TC-ITEM-05 | Get item by valid ID | `GET /api/menu-items/9` | 200, name "Chicken Biryani", price 14.99 | 200, matched | Pass |
| TC-ITEM-06 | Get item — not found | `GET /api/menu-items/9999` | 404 | 404 returned | Pass |
| TC-ITEM-07 | Create item — valid | `POST /api/menu-items` (Chicken Karahi, price 15.99) | 201, item created | 201, created | Pass |
| TC-ITEM-08 | Create item — negative price | `POST /api/menu-items` price `-5` | 400 | 400 returned | Pass |
| TC-ITEM-09 | Create item — nonexistent category | `POST /api/menu-items` category_id `9999` | 400 | 400 returned | Pass |
| TC-ITEM-10 | Update item price | `PUT /api/menu-items/9` `{"price":16.49}` | 200, price updated | 200, updated | Pass |
| TC-ITEM-11 | Update item — not found | `PUT /api/menu-items/9999` | 404 | 404 returned | Pass |
| TC-ITEM-12 | Toggle availability off | `PATCH /api/menu-items/9/availability` `{"is_available":false}` | 200, is_available=0 | 200, matched | Pass |
| TC-ITEM-13 | Toggle availability — invalid type | `PATCH /api/menu-items/9/availability` `{"is_available":"yes"}` | 400 | 400 returned | Pass |
| TC-ITEM-14 | Delete item — no orders | Create temp item, then delete | 204 | 204 returned | Pass |
| TC-ITEM-15 | Delete item — referenced by order | `DELETE /api/menu-items/9` | 409 | 409 returned | Pass |
| TC-ITEM-16 | Delete item — not found | `DELETE /api/menu-items/9999` | 404 | 404 returned | Pass |

## Customers — `/api/customers`

| TC ID | Description | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| TC-CUST-01 | List all customers | `GET /api/customers` | 200, 5 customers, no password_hash field | 200, matched | Pass |
| TC-CUST-02 | Get customer by valid ID | `GET /api/customers/1` | 200, email "ahmed.khan@example.com" | 200, matched | Pass |
| TC-CUST-03 | Get customer — not found | `GET /api/customers/9999` | 404 | 404 returned | Pass |
| TC-CUST-04 | Register — valid | `POST /api/customers` (Yusuf Malik) | 201, customer created, no password_hash returned | 201, created | Pass |
| TC-CUST-05 | Register — duplicate email | `POST /api/customers` email `ahmed.khan@example.com` | 409 | 409 returned | Pass |
| TC-CUST-06 | Register — invalid email format | `POST /api/customers` email `not-an-email` | 400 | 400 returned | Pass |
| TC-CUST-07 | Register — password too short | `POST /api/customers` password `"123"` | 400 | 400 returned | Pass |
| TC-CUST-08 | Update customer field | `PUT /api/customers/2` `{"phone":"312-555-9999"}` | 200, phone updated | 200, updated | Pass |
| TC-CUST-09 | Update — email already taken | `PUT /api/customers/2` email of customer 1 | 409 | 409 returned | Pass |
| TC-CUST-10 | Update — not found | `PUT /api/customers/9999` | 404 | 404 returned | Pass |
| TC-CUST-11 | Delete customer — no orders/reservations | Create temp customer, then delete | 204 | 204 returned | Pass |
| TC-CUST-12 | Delete customer — has orders | `DELETE /api/customers/1` | 409 | 409 returned | Pass |
| TC-CUST-13 | Delete customer — not found | `DELETE /api/customers/9999` | 404 | 404 returned | Pass |

## Orders — `/api/orders`

| TC ID | Description | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| TC-ORD-01 | List all orders | `GET /api/orders` | 200, 6 orders | 200, 6 orders | Pass |
| TC-ORD-02 | Filter by customer_id | `GET /api/orders?customer_id=1` | 200, 2 orders | 200, matched | Pass |
| TC-ORD-03 | Filter by status | `GET /api/orders?status=cancelled` | 200, all rows status "cancelled" | 200, matched | Pass |
| TC-ORD-04 | Filter — invalid status | `GET /api/orders?status=not-a-status` | 400 | 400 returned | Pass |
| TC-ORD-05 | Get order with line items | `GET /api/orders/1` | 200, 2 items, total 39.96 | 200, matched | Pass |
| TC-ORD-06 | Get order — not found | `GET /api/orders/9999` | 404 | 404 returned | Pass |
| TC-ORD-07 | Create order — valid (transactional) | `POST /api/orders` customer 2, 2 line items | 201, total computed server-side (38.97), row exists in DB | 201, verified in DB | Pass |
| TC-ORD-08 | Create order — one invalid item, rollback | `POST /api/orders` one valid + one nonexistent item_id | 400, no order or order_items rows added | 400, row counts unchanged | Pass |
| TC-ORD-09 | Create order — unavailable item | `POST /api/orders` item marked unavailable | 400, details mention "not currently available" | 400, matched | Pass |
| TC-ORD-10 | Create order — nonexistent customer | `POST /api/orders` customer_id 9999 | 400 | 400 returned | Pass |
| TC-ORD-11 | Create order — empty items array | `POST /api/orders` `items: []` | 400 | 400 returned | Pass |
| TC-ORD-12 | Valid status transition | `PATCH /api/orders/3/status` `{"status":"confirmed"}` (from pending) | 200, status "confirmed" | 200, matched | Pass |
| TC-ORD-13 | Illegal status transition | `PATCH /api/orders/3/status` `{"status":"completed"}` (from confirmed) | 400, message names allowed next statuses | 400, matched | Pass |
| TC-ORD-14 | Unknown status value | `PATCH /api/orders/3/status` `{"status":"exploded"}` | 400 | 400 returned | Pass |
| TC-ORD-15 | Status update — order not found | `PATCH /api/orders/9999/status` | 404 | 404 returned | Pass |
| TC-ORD-16 | Delete order — cascades line items | Create order, then delete it | 204, order_items rows for that order gone | 204, verified | Pass |
| TC-ORD-17 | Delete order — not found | `DELETE /api/orders/9999` | 404 | 404 returned | Pass |

## Reservations — `/api/reservations`

| TC ID | Description | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| TC-RES-01 | List all reservations | `GET /api/reservations` | 200, 4 reservations | 200, 4 reservations | Pass |
| TC-RES-02 | Filter by status | `GET /api/reservations?status=confirmed` | 200, all rows status "confirmed" | 200, matched | Pass |
| TC-RES-03 | Filter — malformed date | `GET /api/reservations?date=07-25-2026` | 400 | 400 returned | Pass |
| TC-RES-04 | Get reservation by valid ID | `GET /api/reservations/1` | 200, party_size 4 | 200, matched | Pass |
| TC-RES-05 | Get reservation — not found | `GET /api/reservations/9999` | 404 | 404 returned | Pass |
| TC-RES-06 | Create reservation — valid | `POST /api/reservations` customer 1, 2026-08-01 | 201, status "pending", row in DB | 201, verified in DB | Pass |
| TC-RES-07 | Create — malformed date | `reservation_date: "08/01/2026"` | 400 | 400 returned | Pass |
| TC-RES-08 | Create — zero party size | `party_size: 0` | 400 | 400 returned | Pass |
| TC-RES-09 | Create — nonexistent customer | `customer_id: 9999` | 400 | 400 returned | Pass |
| TC-RES-10 | Update reservation | `PUT /api/reservations/2` party_size 3, status confirmed | 200, updated fields reflected | 200, matched | Pass |
| TC-RES-11 | Update — not found | `PUT /api/reservations/9999` | 404 | 404 returned | Pass |
| TC-RES-12 | Cancel reservation | `PATCH /api/reservations/2/cancel` | 200, status "cancelled" | 200, matched | Pass |
| TC-RES-13 | Cancel — already cancelled | `PATCH /api/reservations/2/cancel` (again) | 400 | 400 returned | Pass |
| TC-RES-14 | Cancel — not found | `PATCH /api/reservations/9999/cancel` | 404 | 404 returned | Pass |
| TC-RES-15 | Delete reservation | Create, then delete | 204 | 204 returned | Pass |
| TC-RES-16 | Delete — not found | `DELETE /api/reservations/9999` | 404 | 404 returned | Pass |

## Admin Reports — `/api/reports`

| TC ID | Description | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| TC-RPT-01 | Daily totals — all days | `GET /api/reports/daily-totals` | 200, array with order_count/total_revenue per day | 200, matched | Pass |
| TC-RPT-02 | Daily totals — specific date | `GET /api/reports/daily-totals?date=2026-07-20` | 200, order_count 6, total_revenue 190.81 (cancelled order excluded) | 200, matched | Pass |
| TC-RPT-03 | Daily totals — date with no orders | `GET /api/reports/daily-totals?date=2020-01-01` | 200, order_count 0 | 200, matched | Pass |
| TC-RPT-04 | Daily totals — malformed date | `GET /api/reports/daily-totals?date=not-a-date` | 400 | 400 returned | Pass |
| TC-RPT-05 | Popular items — default limit | `GET /api/reports/popular-items` | 200, at most 5 rows | 200, matched | Pass |
| TC-RPT-06 | Popular items — custom limit | `GET /api/reports/popular-items?limit=2` | 200, exactly 2 rows | 200, matched | Pass |
| TC-RPT-07 | Popular items — invalid limit | `GET /api/reports/popular-items?limit=-1` | 400 | 400 returned | Pass |

**Totals: 81 test cases, 81 passed, 0 failed.**
