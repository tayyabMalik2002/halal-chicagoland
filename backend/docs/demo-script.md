# Demo Script — Zabiha Halal Backend

Use this script to record the Milestone 2 demo video. Each step pairs a Postman call (from `tests/zabiha-halal.postman_collection.json`) with a SQL query to run in a second terminal/MySQL client immediately afterward, so the database change is visible on screen.

**Before recording:** reset to a clean, known state:
```bash
mysql -u <user> -p < database/schema.sql
mysql -u <user> -p < database/seed.sql
npm start
```
Keep a `mysql` client open in a second window/pane, connected to `zabiha_halal_db`, for the SELECT queries below.

---

### Step 1 — Show the menu (read path)
**Postman:** `GET {{baseUrl}}/api/menu-categories` then `GET {{baseUrl}}/api/menu-items?category_id=3`
**SQL:**
```sql
SELECT category_id, name FROM menu_categories ORDER BY display_order;
SELECT item_id, name, price, is_available FROM menu_items WHERE category_id = 3;
```
Narrate: categories and items are read live from MySQL, not hardcoded.

---

### Step 2 — Register a new customer
**Postman:** `POST /api/customers` (Customers folder → "Register Customer")
```json
{ "first_name": "Yusuf", "last_name": "Malik", "email": "yusuf.malik@example.com", "phone": "312-555-0177", "password": "SecurePass1!" }
```
**SQL:**
```sql
SELECT customer_id, first_name, last_name, email, password_hash FROM customers WHERE email = 'yusuf.malik@example.com';
```
Narrate: point out `password_hash` is a bcrypt hash (starts with `$2b$`), never the plaintext `SecurePass1!` sent in the request.

---

### Step 3 — Attempt a duplicate registration (negative case)
**Postman:** "Register Customer - Duplicate Email (409)" — same email as an existing seeded customer.
**SQL:** none — show the 409 response in Postman; no new row was written.
```sql
SELECT COUNT(*) FROM customers WHERE email = 'ahmed.khan@example.com'; -- still 1
```

---

### Step 4 — Toggle a menu item's availability
**Postman:** `PATCH /api/menu-items/9/availability` `{ "is_available": false }`
**SQL:**
```sql
SELECT item_id, name, is_available FROM menu_items WHERE item_id = 9;
```
Narrate: `is_available` flips from 1 to 0. Then call it again with `true` to restore it before Step 5, since Chicken Biryani is used in an order below.

---

### Step 5 — Place an order (transaction across `orders` + `order_items`)
**Postman:** `POST /api/orders`
```json
{
  "customer_id": 2,
  "order_type": "pickup",
  "special_instructions": "No onions please",
  "items": [ { "item_id": 5, "quantity": 2 }, { "item_id": 13, "quantity": 1 } ]
}
```
**SQL:**
```sql
SELECT * FROM orders ORDER BY order_id DESC LIMIT 1;
SELECT * FROM order_items WHERE order_id = (SELECT MAX(order_id) FROM orders);
```
Narrate: `total_amount` (38.97) was computed server-side from current menu prices (16.99 × 2 + 4.99 × 1), not sent by the client, and both tables were written atomically in one transaction.

---

### Step 6 — Show the transaction rolling back on bad input (negative case)
**Postman:** "Create Order - Invalid Item (400, rolls back)" — one valid item + `item_id: 9999`.
**SQL:**
```sql
SELECT COUNT(*) FROM orders;      -- unchanged from Step 5
SELECT COUNT(*) FROM order_items; -- unchanged from Step 5
```
Narrate: the whole order was rejected — no partial order or orphaned line item was written, because the insert happens inside a single DB transaction that gets rolled back on validation failure.

---

### Step 7 — Walk the order status lifecycle
**Postman:** `PATCH /api/orders/<id from Step 5>/status` with body `{ "status": "confirmed" }`, then `{ "status": "preparing" }`, then `{ "status": "ready" }`, then `{ "status": "completed" }`.
**SQL (after each call):**
```sql
SELECT order_id, status, updated_at FROM orders WHERE order_id = <id>;
```
Narrate: `status` and `updated_at` change after each call, in the exact sequence `pending → confirmed → preparing → ready → completed`.

---

### Step 8 — Show an illegal transition is rejected (negative case)
**Postman:** "Update Order Status - Illegal Transition (400)" on order 3 (seeded as `pending`), sending `{ "status": "completed" }`.
**SQL:**
```sql
SELECT status FROM orders WHERE order_id = 3; -- still "pending"
```

---

### Step 9 — Create and cancel a reservation
**Postman:** `POST /api/reservations`
```json
{ "customer_id": 1, "reservation_date": "2026-08-01", "reservation_time": "19:00", "party_size": 2 }
```
**SQL:**
```sql
SELECT * FROM reservations ORDER BY reservation_id DESC LIMIT 1;
```
Then `PATCH /api/reservations/<id>/cancel`, and re-run the same SELECT to show `status` flip to `cancelled`.

---

### Step 10 — Admin reporting
**Postman:** `GET /api/reports/daily-totals?date=2026-07-20` and `GET /api/reports/popular-items?limit=3`
**SQL (what the endpoints compute under the hood):**
```sql
SELECT DATE(created_at) AS order_date, COUNT(*) AS order_count,
       SUM(CASE WHEN status <> 'cancelled' THEN total_amount ELSE 0 END) AS total_revenue
FROM orders WHERE DATE(created_at) = '2026-07-20' GROUP BY DATE(created_at);

SELECT mi.name, SUM(oi.quantity) AS total_quantity_ordered
FROM order_items oi
JOIN menu_items mi ON mi.item_id = oi.item_id
JOIN orders o ON o.order_id = oi.order_id
WHERE o.status <> 'cancelled'
GROUP BY mi.item_id, mi.name
ORDER BY total_quantity_ordered DESC LIMIT 3;
```
Narrate: the JSON response matches the manual SQL, proving the report endpoints aren't hardcoded.

---

### Step 11 — Run the automated test suite live
```bash
npm test
```
Point out the 81 passing tests, then open `tests/test-cases.md` and `tests/test-results.md` to show the formal documentation behind them.

---

## Development Issues & Resolutions (for discussion in the video)

1. **Transaction handling for orders.** Creating an order touches two tables (`orders`, `order_items`) and must compute the total from live menu prices. Early on, doing this as two separate, un-transactioned inserts risked leaving an order with no line items (or vice versa) if a later insert failed. Resolved by wrapping the whole operation in a single `mysql2` connection transaction (`beginTransaction` / `commit` / `rollback` in a `try/catch`), with the menu item rows read `FOR UPDATE` inside the same transaction so the price used for `unit_price` can't change mid-request.

2. **Foreign key constraint errors surfacing as raw 500s.** By default, deleting a menu category that still had menu items, or a customer with existing orders, threw a raw MySQL `ER_ROW_IS_REFERENCED_2` error that would have surfaced as an unhelpful 500. Resolved by mapping known MySQL error codes (`ER_ROW_IS_REFERENCED_2`, `ER_NO_REFERENCED_ROW_2`, `ER_DUP_ENTRY`) to clean 409/400 JSON responses in the central error-handling middleware (`src/middleware/errorHandler.js`).

3. **Order status could be set to any arbitrary value via PATCH.** Initially `PATCH /orders/:id/status` accepted any string in the `status` field. This allowed nonsensical jumps like `pending → completed`. Resolved by introducing an explicit state machine (`STATUS_TRANSITIONS` map in `ordersController.js`) that only allows the next legal status per the required workflow, cancel included, and returns a descriptive 400 listing the allowed next states otherwise.

4. **Validation edge cases on numeric route params.** Passing a non-numeric `:id` (e.g. `/api/customers/abc`) originally fell through to a MySQL comparison that just returned zero rows, silently becoming a 404 instead of flagging genuinely malformed input. Resolved with a small `validateIdParam` middleware applied to every `:id` route, returning a clear 400 before the controller runs.

5. **MySQL `DATE` columns returning as UTC-shifted JS `Date` objects.** By default `mysql2` returns `DATE` columns (e.g. `reservation_date`, and the `DATE(created_at)` report aggregate) as JavaScript `Date` objects, which `JSON.stringify` renders with a timezone-shifted timestamp (e.g. `2026-07-20T05:00:00.000Z` for local midnight) — confusing for a field that has no time component. Resolved by setting `dateStrings: ['DATE']` on the connection pool config so `DATE` columns are returned as plain `YYYY-MM-DD` strings, while `TIMESTAMP` columns (which do represent a real instant) are left as-is.
