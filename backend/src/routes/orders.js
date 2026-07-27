const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/ordersController');

const router = express.Router();

router.get('/', asyncHandler(controller.listOrders));
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getOrder));
router.post('/', asyncHandler(controller.createOrder));
router.patch('/:id/status', validateIdParam('id'), asyncHandler(controller.updateOrderStatus));
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteOrder));

module.exports = router;
