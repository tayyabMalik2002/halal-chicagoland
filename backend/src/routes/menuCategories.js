// Mounted at /api/menu-categories in src/app.js — paths below are relative to that.
// Called from the frontend via js/api.js -> MENU_ANALYZER_API_BASE (none of these
// are wired into js/ yet; exercised today via Postman/curl and the Jest suite
// in backend/tests/menuCategories.test.js).
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/menuCategoriesController');

const router = express.Router();

router.get('/', asyncHandler(controller.listCategories));               // GET    /api/menu-categories
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getCategory));    // GET    /api/menu-categories/:id
router.post('/', asyncHandler(controller.createCategory));              // POST   /api/menu-categories
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateCategory)); // PUT    /api/menu-categories/:id
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteCategory)); // DELETE /api/menu-categories/:id

module.exports = router;
