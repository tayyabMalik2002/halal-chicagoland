const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/customersController');

const router = express.Router();

router.get('/', asyncHandler(controller.listCustomers));
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getCustomer));
router.post('/', asyncHandler(controller.registerCustomer));
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateCustomer));
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteCustomer));

module.exports = router;
