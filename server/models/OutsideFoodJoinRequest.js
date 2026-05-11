const mongoose = require('mongoose');

const outsideFoodJoinRequestSchema = new mongoose.Schema({
  poolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OutsideFoodPool',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  intendedAmount: {
    type: Number,
    required: true,
    min: [1, 'Intended amount must be positive'],
  },
  orderPreview: {
    type: String,
    required: true,
    trim: true,
    maxlength: [300, 'Order preview cannot exceed 300 characters'],
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING',
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

outsideFoodJoinRequestSchema.index(
  { poolId: 1, userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } }
);
outsideFoodJoinRequestSchema.index({ poolId: 1, createdAt: -1 });

module.exports = mongoose.model('OutsideFoodJoinRequest', outsideFoodJoinRequestSchema);
