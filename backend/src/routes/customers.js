// Mounted at /api/customers in src/app.js — paths below are relative to that.
// Not called from js/ yet (no signup/login UI); exercised via Postman/curl
// and backend/tests/customers.test.js. registerCustomer hashes the password
// with bcrypt — password_hash is never included in any response.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/customersController');

const router = express.Router();

router.get('/', asyncHandler(controller.listCustomers));                // GET    /api/customers
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getCustomer));    // GET    /api/customers/:id
router.post('/', asyncHandler(controller.registerCustomer));            // POST   /api/customers  (register)
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateCustomer)); // PUT    /api/customers/:id
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteCustomer)); // DELETE /api/customers/:id

module.exports = router;
