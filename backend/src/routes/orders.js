// Mounted at /api/orders in src/app.js — paths below are relative to that.
// Not called from js/ yet (no ordering UI — see docs/04-usage-guide.md §4.3);
// exercised via Postman/curl and backend/tests/orders.test.js. createOrder
// inserts the order + all order_items rows inside a single DB transaction.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/ordersController');

const router = express.Router();

router.get('/', asyncHandler(controller.listOrders));                   // GET    /api/orders  (?customer_id, ?status)
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getOrder));       // GET    /api/orders/:id  (incl. line items)
router.post('/', asyncHandler(controller.createOrder));                 // POST   /api/orders  (transactional)
router.patch('/:id/status', validateIdParam('id'), asyncHandler(controller.updateOrderStatus)); // PATCH  /api/orders/:id/status
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteOrder)); // DELETE /api/orders/:id  (cascades order_items)

module.exports = router;
