// Mounted at /api/reservations in src/app.js — paths below are relative to that.
// Not called from js/ yet (no booking UI — see docs/04-usage-guide.md §4.3);
// exercised via Postman/curl and backend/tests/reservations.test.js.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/reservationsController');

const router = express.Router();

router.get('/', asyncHandler(controller.listReservations));             // GET    /api/reservations  (?customer_id, ?status, ?date)
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getReservation));  // GET    /api/reservations/:id
router.post('/', asyncHandler(controller.createReservation));           // POST   /api/reservations  (status starts "pending")
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateReservation)); // PUT    /api/reservations/:id
router.patch('/:id/cancel', validateIdParam('id'), asyncHandler(controller.cancelReservation)); // PATCH  /api/reservations/:id/cancel
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteReservation)); // DELETE /api/reservations/:id

module.exports = router;
