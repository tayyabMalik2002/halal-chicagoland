const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/menuItemsController');

const router = express.Router();

router.get('/', asyncHandler(controller.listItems));
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getItem));
router.post('/', asyncHandler(controller.createItem));
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateItem));
router.patch('/:id/availability', validateIdParam('id'), asyncHandler(controller.updateAvailability));
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteItem));

module.exports = router;
