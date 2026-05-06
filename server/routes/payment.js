const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.post('/create-order', protect, paymentController.createOrder);

router.post('/verify', protect, paymentController.verifyPayment);

module.exports = router;
