# API Documentation — Zabiha Halal Backend

Base URL (local development): `http://localhost:3000`

All request/response bodies are JSON (`Content-Type: application/json`). All successful responses wrap their payload in a `data` field. All errors use a consistent shape:

```json
{
  "error": {
    "message": "Human-readable summary of what went wrong.",
    "details": ["Optional array of specific field-level validation errors."]
  }
}
```

`details` is only present for multi-field validation failures (HTTP 400).

| Status | Meaning |
|---|---|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Resource created (POST) |
| 204 | Success, no content (DELETE) |
| 400 | Validation error / malformed input |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email, FK still referenced) |
| 500 | Unhandled server error |

---

## Health Check

### `GET /health`
Confirms the API process is running.

**Sample response — 200**
```json
{ "status": "ok" }
```

---

## Menu Categories — `/api/menu-categories`

### `GET /api/menu-categories`
List all menu categories, ordered by `display_order`.

**Sample response — 200**
```json
{
  "data": [
    { "category_id": 1, "name": "Appetizers", "description": "Starters and small plates to begin your meal", "display_order": 1, "created_at": "2026-07-20T19:07:56.000Z" }
  ]
}
```

### `GET /api/menu-categories/:id`
Get a single category by ID.

**Sample response — 200**
```json
{ "data": { "category_id": 1, "name": "Appetizers", "description": "Starters and small plates to begin your meal", "display_order": 1, "created_at": "2026-07-20T19:07:56.000Z" } }
```

**Sample response — 404**
```json
{ "error": { "message": "Menu category 999 not found." } }
```

### `POST /api/menu-categories`
Create a new category.

**Input:** `name` (string, required, unique), `description` (string, optional), `display_order` (non-negative integer, optional, default 0)

**Sample request**
```json
{ "name": "Soups", "description": "Warm starters", "display_order": 6 }
```

**Sample response — 201**
```json
{ "data": { "category_id": 6, "name": "Soups", "description": "Warm starters", "display_order": 6, "created_at": "2026-07-20T19:20:00.000Z" } }
```

**Sample response — 400** (missing name)
```json
{ "error": { "message": "Validation failed.", "details": ["name is required and must be a non-empty string."] } }
```

### `PUT /api/menu-categories/:id`
Update a category. All fields optional; only provided fields are changed.

**Sample request**
```json
{ "display_order": 2 }
```

**Sample response — 200**
```json
{ "data": { "category_id": 6, "name": "Soups", "description": "Warm starters", "display_order": 2, "created_at": "2026-07-20T19:20:00.000Z" } }
```

### `DELETE /api/menu-categories/:id`
Delete a category. Fails with 409 if menu items still reference it.

**Sample response — 204**: empty body.

**Sample response — 409**
```json
{ "error": { "message": "This record cannot be deleted because other records depend on it." } }
```

---

## Menu Items — `/api/menu-items`

### `GET /api/menu-items`
List menu items. Optional query params: `category_id` (int), `available` (`true`/`false`).

**Sample response — 200**
```json
{
  "data": [
    {
      "item_id": 9, "category_id": 3, "name": "Chicken Biryani",
      "description": "Basmati rice layered with spiced chicken, fried onions, and herbs",
      "price": 14.99, "halal_notes": "Zabiha halal chicken, certified by IFANCA",
      "is_available": 1, "created_at": "2026-07-20T19:07:56.000Z", "updated_at": "2026-07-20T19:07:56.000Z"
    }
  ]
}
```

### `GET /api/menu-items/:id`
Get a single menu item.

**Sample response — 404**
```json
{ "error": { "message": "Menu item 999 not found." } }
```

### `POST /api/menu-items`
Create a new menu item.

**Input:** `category_id` (int, required, must reference an existing category), `name` (string, required), `price` (non-negative number, required), `description` (string, optional), `halal_notes` (string, optional), `is_available` (boolean, optional, default true)

**Sample request**
```json
{
  "category_id": 3,
  "name": "Chicken Karahi",
  "description": "Chicken cooked in a tomato-based karahi sauce",
  "price": 15.99,
  "halal_notes": "Zabiha halal chicken, certified by IFANCA",
  "is_available": true
}
```

**Sample response — 201**
```json
{
  "data": {
    "item_id": 19, "category_id": 3, "name": "Chicken Karahi",
    "description": "Chicken cooked in a tomato-based karahi sauce",
    "price": 15.99, "halal_notes": "Zabiha halal chicken, certified by IFANCA",
    "is_available": 1, "created_at": "2026-07-20T19:22:00.000Z", "updated_at": "2026-07-20T19:22:00.000Z"
  }
}
```

**Sample response — 400** (bad category_id)
```json
{ "error": { "message": "category_id 999 does not reference an existing menu category." } }
```

### `PUT /api/menu-items/:id`
Update a menu item. All fields optional.

**Sample request**
```json
{ "price": 16.49 }
```

**Sample response — 200**
```json
{ "data": { "item_id": 19, "category_id": 3, "name": "Chicken Karahi", "description": "Chicken cooked in a tomato-based karahi sauce", "price": 16.49, "halal_notes": "Zabiha halal chicken, certified by IFANCA", "is_available": 1, "created_at": "2026-07-20T19:22:00.000Z", "updated_at": "2026-07-20T19:23:00.000Z" } }
```

### `PATCH /api/menu-items/:id/availability`
Toggle whether an item is available for ordering.

**Input:** `is_available` (boolean, required)

**Sample request**
```json
{ "is_available": false }
```

**Sample response — 200**
```json
{ "data": { "item_id": 19, "category_id": 3, "name": "Chicken Karahi", "description": "Chicken cooked in a tomato-based karahi sauce", "price": 16.49, "halal_notes": "Zabiha halal chicken, certified by IFANCA", "is_available": 0, "created_at": "2026-07-20T19:22:00.000Z", "updated_at": "2026-07-20T19:24:00.000Z" } }
```

**Sample response — 400**
```json
{ "error": { "message": "Validation failed.", "details": ["is_available is required and must be a boolean."] } }
```

### `DELETE /api/menu-items/:id`
Delete a menu item. Fails with 409 if it appears on any existing order.

**Sample response — 204**: empty body.

---

## Customers — `/api/customers`

### `GET /api/customers`
List all customers. `password_hash` is never returned.

**Sample response — 200**
```json
{
  "data": [
    { "customer_id": 1, "first_name": "Ahmed", "last_name": "Khan", "email": "ahmed.khan@example.com", "phone": "312-555-0101", "created_at": "2026-07-20T19:07:56.000Z", "updated_at": "2026-07-20T19:07:56.000Z" }
  ]
}
```

### `GET /api/customers/:id`
Get a single customer.

**Sample response — 404**
```json
{ "error": { "message": "Customer 999 not found." } }
```

### `POST /api/customers`
Register a new customer. Password is hashed with bcrypt before storage; the hash is never returned.

**Input:** `first_name`, `last_name`, `phone` (non-empty strings, required), `email` (valid email, required, unique), `password` (string, required, min 8 characters)

**Sample request**
```json
{
  "first_name": "Yusuf",
  "last_name": "Malik",
  "email": "yusuf.malik@example.com",
  "phone": "312-555-0177",
  "password": "SecurePass1!"
}
```

**Sample response — 201**
```json
{ "data": { "customer_id": 6, "first_name": "Yusuf", "last_name": "Malik", "email": "yusuf.malik@example.com", "phone": "312-555-0177", "created_at": "2026-07-20T19:25:00.000Z", "updated_at": "2026-07-20T19:25:00.000Z" } }
```

**Sample response — 409** (duplicate email)
```json
{ "error": { "message": "A customer with this email already exists." } }
```

**Sample response — 400** (weak password)
```json
{ "error": { "message": "Validation failed.", "details": ["password is required and must be at least 8 characters long."] } }
```

### `PUT /api/customers/:id`
Update a customer's profile. All fields optional; sending `password` re-hashes it.

**Sample request**
```json
{ "phone": "312-555-9999" }
```

**Sample response — 200**
```json
{ "data": { "customer_id": 6, "first_name": "Yusuf", "last_name": "Malik", "email": "yusuf.malik@example.com", "phone": "312-555-9999", "created_at": "2026-07-20T19:25:00.000Z", "updated_at": "2026-07-20T19:26:00.000Z" } }
```

### `DELETE /api/customers/:id`
Delete a customer. Fails with 409 if the customer has existing orders or reservations.

**Sample response — 204**: empty body.

---

## Orders — `/api/orders`

### `GET /api/orders`
List orders (summary rows, no line items). Optional query params: `customer_id` (int), `status` (one of the order statuses).

**Sample response — 200**
```json
{
  "data": [
    { "order_id": 5, "customer_id": 5, "order_type": "delivery", "status": "ready", "total_amount": 58.44, "special_instructions": "Leave at front door", "created_at": "2026-07-20T19:07:56.000Z", "updated_at": "2026-07-20T19:07:56.000Z" }
  ]
}
```

### `GET /api/orders/:id`
Get a single order including its line items (joined with menu item names).

**Sample response — 200**
```json
{
  "data": {
    "order_id": 1, "customer_id": 1, "order_type": "pickup", "status": "completed",
    "total_amount": 39.96, "special_instructions": "Extra napkins please",
    "created_at": "2026-07-20T19:07:56.000Z", "updated_at": "2026-07-20T19:07:56.000Z",
    "items": [
      { "order_item_id": 1, "item_id": 9, "name": "Chicken Biryani", "quantity": 2, "unit_price": 14.99, "line_total": 29.98 },
      { "order_item_id": 2, "item_id": 13, "name": "Mango Lassi", "quantity": 2, "unit_price": 4.99, "line_total": 9.98 }
    ]
  }
}
```

**Sample response — 404**
```json
{ "error": { "message": "Order 999 not found." } }
```

### `POST /api/orders`
Create an order with one or more line items. Runs inside a single **database transaction**: the order row, all `order_items` rows, and the computed `total_amount` are inserted atomically — if any item is invalid or unavailable, the entire order is rolled back and nothing is written.

**Input:** `customer_id` (int, required, must exist), `order_type` (one of `pickup`, `delivery`, `dine-in`; optional, default `pickup`), `special_instructions` (string, optional), `items` (non-empty array of `{ item_id, quantity }`, required; each `item_id` must reference an existing, available menu item and `quantity` must be a positive integer)

`total_amount` is calculated server-side from the current menu item prices — it is never accepted from the client.

**Sample request**
```json
{
  "customer_id": 2,
  "order_type": "pickup",
  "special_instructions": "No onions please",
  "items": [
    { "item_id": 5, "quantity": 2 },
    { "item_id": 13, "quantity": 1 }
  ]
}
```

**Sample response — 201**
```json
{
  "data": {
    "order_id": 7, "customer_id": 2, "order_type": "pickup", "status": "pending",
    "total_amount": 38.97, "special_instructions": "No onions please",
    "created_at": "2026-07-20T19:12:25.000Z", "updated_at": "2026-07-20T19:12:25.000Z",
    "items": [
      { "order_item_id": 13, "item_id": 5, "name": "Chicken Tikka Platter", "quantity": 2, "unit_price": 16.99, "line_total": 33.98 },
      { "order_item_id": 14, "item_id": 13, "name": "Mango Lassi", "quantity": 1, "unit_price": 4.99, "line_total": 4.99 }
    ]
  }
}
```

**Sample response — 400** (empty items array)
```json
{ "error": { "message": "Validation failed.", "details": ["items is required and must be a non-empty array."] } }
```

**Sample response — 400** (item does not exist)
```json
{ "error": { "message": "Validation failed.", "details": ["items[0].item_id 9999 does not reference an existing menu item."] } }
```

### `PATCH /api/orders/:id/status`
Advance an order's status. Enforces the workflow `pending → confirmed → preparing → ready → completed`, with `cancelled` reachable from any non-final state.

**Input:** `status` (required, one of `pending`, `confirmed`, `preparing`, `ready`, `completed`, `cancelled`)

**Sample request**
```json
{ "status": "confirmed" }
```

**Sample response — 200**
```json
{ "data": { "order_id": 7, "customer_id": 2, "order_type": "pickup", "status": "confirmed", "total_amount": 38.97, "special_instructions": "No onions please", "created_at": "2026-07-20T19:12:25.000Z", "updated_at": "2026-07-20T19:12:32.000Z", "items": [ /* ... */ ] } }
```

**Sample response — 400** (illegal transition, e.g. skipping straight to completed)
```json
{ "error": { "message": "Invalid status transition from \"confirmed\" to \"completed\". Allowed next statuses: preparing, cancelled." } }
```

### `DELETE /api/orders/:id`
Delete an order (cascades to its `order_items`).

**Sample response — 204**: empty body.

---

## Reservations — `/api/reservations`

### `GET /api/reservations`
List reservations. Optional query params: `customer_id` (int), `status`, `date` (`YYYY-MM-DD`).

**Sample response — 200**
```json
{
  "data": [
    { "reservation_id": 1, "customer_id": 2, "reservation_date": "2026-07-25", "reservation_time": "18:30:00", "party_size": 4, "status": "confirmed", "special_requests": "Window seat preferred", "created_at": "2026-07-20T19:07:56.000Z", "updated_at": "2026-07-20T19:07:56.000Z" }
  ]
}
```

### `GET /api/reservations/:id`
Get a single reservation.

**Sample response — 404**
```json
{ "error": { "message": "Reservation 999 not found." } }
```

### `POST /api/reservations`
Create a reservation (`status` always starts as `pending`).

**Input:** `customer_id` (int, required, must exist), `reservation_date` (`YYYY-MM-DD`, required), `reservation_time` (`HH:MM` or `HH:MM:SS`, required), `party_size` (positive integer, required), `special_requests` (string, optional)

**Sample request**
```json
{ "customer_id": 1, "reservation_date": "2026-08-01", "reservation_time": "19:00", "party_size": 2 }
```

**Sample response — 201**
```json
{ "data": { "reservation_id": 5, "customer_id": 1, "reservation_date": "2026-08-01", "reservation_time": "19:00:00", "party_size": 2, "status": "pending", "special_requests": null, "created_at": "2026-07-20T19:13:00.000Z", "updated_at": "2026-07-20T19:13:00.000Z" } }
```

**Sample response — 400** (missing party_size)
```json
{ "error": { "message": "Validation failed.", "details": ["party_size is required and must be a positive integer."] } }
```

### `PUT /api/reservations/:id`
Update a reservation's date, time, party size, status, or special requests. All fields optional.

**Sample request**
```json
{ "party_size": 5, "status": "confirmed" }
```

**Sample response — 200**
```json
{ "data": { "reservation_id": 5, "customer_id": 1, "reservation_date": "2026-08-01", "reservation_time": "19:00:00", "party_size": 5, "status": "confirmed", "special_requests": null, "created_at": "2026-07-20T19:13:00.000Z", "updated_at": "2026-07-20T19:14:00.000Z" } }
```

### `PATCH /api/reservations/:id/cancel`
Convenience endpoint to cancel a reservation without sending a body.

**Sample response — 200**
```json
{ "data": { "reservation_id": 5, "customer_id": 1, "reservation_date": "2026-08-01", "reservation_time": "19:00:00", "party_size": 5, "status": "cancelled", "special_requests": null, "created_at": "2026-07-20T19:13:00.000Z", "updated_at": "2026-07-20T19:15:00.000Z" } }
```

**Sample response — 400** (already cancelled/completed)
```json
{ "error": { "message": "Reservation 5 is already \"cancelled\" and cannot be cancelled." } }
```

### `DELETE /api/reservations/:id`
Delete a reservation.

**Sample response — 204**: empty body.

---

## Admin Reporting — `/api/reports`

### `GET /api/reports/daily-totals`
Order count and total revenue, grouped by calendar day. Revenue excludes `cancelled` orders. Optional query param `date` (`YYYY-MM-DD`) restricts to a single day.

**Sample response — 200** (no `date` param — all days)
```json
{
  "data": [
    { "order_date": "2026-07-20", "order_count": 6, "total_revenue": 190.81 }
  ]
}
```

**Sample response — 200** (`?date=2026-07-20`)
```json
{ "data": { "order_date": "2026-07-20", "order_count": 6, "total_revenue": 190.81 } }
```

**Sample response — 400** (bad date format)
```json
{ "error": { "message": "date query parameter must be a valid date in YYYY-MM-DD format." } }
```

### `GET /api/reports/popular-items`
Most-ordered menu items ranked by total quantity sold across all non-cancelled orders. Optional query param `limit` (positive integer, default 5).

**Sample response — 200** (`?limit=3`)
```json
{
  "data": [
    { "item_id": 10, "name": "Beef Biryani", "category_id": 3, "total_quantity_ordered": 3, "total_revenue": 47.97 },
    { "item_id": 9, "name": "Chicken Biryani", "category_id": 3, "total_quantity_ordered": 2, "total_revenue": 29.98 },
    { "item_id": 13, "name": "Mango Lassi", "category_id": 4, "total_quantity_ordered": 2, "total_revenue": 9.98 }
  ]
}
```
