const Razorpay = require('razorpay');
const crypto = require('crypto');
const paymentModel = require('../models/paymentModel');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createOrder(req, res) {
  const { amount, currency = 'INR', receipt = `receipt_${Date.now()}` } = req.body;
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: 'A valid amount is required.' });
  }

  const options = {
    amount: Math.round(parsedAmount * 100),
    currency,
    receipt,
  };

  try {
    const order = await razorpay.orders.create(options);

    const newPayment = await paymentModel.create({
      user: req.user.id,
      orderId: order.id,
      price: {
        amount: parsedAmount,
        currency,
      },
      status: 'PENDING',
    });

    res.status(201).json({
      success: true,
      order,
      paymentId: newPayment._id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).send('Error creating order');
  }
};

async function verifyPayment(req, res) {
  const { razorpayOrderId, razorpayPaymentId, signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayOrderId || !razorpayPaymentId || !signature) {
    return res.status(400).json({ message: 'Missing payment verification data.' });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature === signature) {
      const payment = await paymentModel.findOne({ orderId: razorpayOrderId, user: req.user.id });
      if (!payment) {
        return res.status(404).send('Payment record not found');
      }
      payment.paymentId = razorpayPaymentId;
      payment.signature = signature;
      payment.status = 'SUCCESS';
      await payment.save();
      res.json({ status: 'success', payment });
    } else {
      res.status(400).send('Invalid signature');
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).send('Error verifying payment');
  }
}

module.exports = { createOrder, verifyPayment };
