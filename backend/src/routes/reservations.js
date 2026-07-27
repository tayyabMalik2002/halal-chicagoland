const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/reservationsController');

const router = express.Router();

router.get('/', asyncHandler(controller.listReservations));
router.get('/:id', validateIdParam('id'), asyncHandler(controller.getReservation));
router.post('/', asyncHandler(controller.createReservation));
router.put('/:id', validateIdParam('id'), asyncHandler(controller.updateReservation));
router.patch('/:id/cancel', validateIdParam('id'), asyncHandler(controller.cancelReservation));
router.delete('/:id', validateIdParam('id'), asyncHandler(controller.deleteReservation));

module.exports = router;
