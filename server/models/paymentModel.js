const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderId: {
    type: String,
    required: true,
  },
  paymentId: {
    type: String,
  },
  signature: {
    type: String,
  },
  price: {
    amount: {
      type: Number,
      required: true,
    },
    currency: {
    type: String,
    required: true,
  },
  },
  
  status: {
    type: String,
    default: 'PENDING',
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
  },
}, { timestamps: true });

paymentSchema.index({ user: 1, orderId: 1 });
paymentSchema.index({ user: 1, paymentId: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
