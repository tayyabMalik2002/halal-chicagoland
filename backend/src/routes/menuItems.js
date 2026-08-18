// Mounted at /api/menu-items in src/app.js — paths below are relative to that.
// Not called from js/ yet (no menu-browsing UI on the Express side); exercised
// via Postman/curl and backend/tests/menuItems.test.js.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/menuItemsController');

const router = express.Router();

router.get('/', asyncHandler(controller.listItems));                    // GET    /api/menu-items  (?category_id, ?available)
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getItem));        // GET    /api/menu-items/:id
router.post('/', asyncHandler(controller.createItem));                  // POST   /api/menu-items
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateItem));     // PUT    /api/menu-items/:id
router.patch('/:id/availability', validateIdParam('id'), asyncHandler(controller.updateAvailability)); // PATCH /api/menu-items/:id/availability
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteItem));  // DELETE /api/menu-items/:id

module.exports = router;
