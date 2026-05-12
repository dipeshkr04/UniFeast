const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  name: String,
  price: Number,
  imageUrl: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: '',
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  assignedReadyQty: {
    type: Number,
    default: 0,
    min: 0,
  },
  poolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pool',
    default: null,
  },
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userSnapshot: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    btId: { type: String, default: '' },
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  qrTokenHash: {
    type: String,
    default: null,
    select: false,
  },
  qrTokenLookup: {
    type: String,
    default: null,
    select: false,
  },
  qrIssuedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'queued', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending',
  },
  isPooled: {
    type: Boolean,
    default: false,
  },
  estimatedTime: {
    type: Number, // ETA in minutes
    default: 0,
  },
  estimatedReadyAt: {
    type: Date,
    default: null,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  preparedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
  }],
  actualCompletionTime: {
    type: Number,
    default: null,
  },
  specialInstructions: {
    type: String,
    default: '',
    maxlength: [300, 'Instructions cannot exceed 300 characters'],
  },
}, {
  timestamps: true,
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ qrTokenHash: 1 }, { sparse: true });
orderSchema.index({ qrTokenLookup: 1 }, { sparse: true });
orderSchema.index({ user: 1, razorpayPaymentId: 1 });
orderSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

module.exports = mongoose.model('Order', orderSchema);
