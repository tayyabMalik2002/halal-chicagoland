const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/menuCategoriesController');

const router = express.Router();

router.get('/', asyncHandler(controller.listCategories));
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getCategory));
router.post('/', asyncHandler(controller.createCategory));
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateCategory));
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteCategory));

module.exports = router;
