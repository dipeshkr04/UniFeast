const mongoose = require('mongoose');

const poolMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
});

const poolSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  members: [poolMemberSchema],
  status: {
    type: String,
    enum: ['open', 'queued', 'preparing', 'ready', 'completed'],
    default: 'open',
  },
  maxSize: {
    type: Number,
    default: 10,
  },
  currentSize: {
    type: Number,
    default: 0,
  },
  totalQuantity: {
    type: Number,
    default: 0,
  },
  pricePerUnit: {
    type: Number,
    required: true,
  },
  savingsPercent: {
    type: Number,
    default: 0,
  },
  closesAt: {
    type: Date,
    required: true,
  },
  closedAt: {
    type: Date,
    default: null,
  },
  consolidatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
}, {
  timestamps: true,
});

poolSchema.index({ menuItem: 1, status: 1 });
poolSchema.index({ closesAt: 1 });

// Calculate cost split
poolSchema.methods.getCostSplit = function () {
  if (this.members.length === 0) return 0;
  const totalCost = this.pricePerUnit * this.totalQuantity;
  const discount = Math.min(this.members.length * 2, 15); // up to 15% discount for pooling
  const discountedTotal = totalCost * (1 - discount / 100);
  return {
    originalTotal: totalCost,
    discountPercent: discount,
    discountedTotal,
    perMember: this.members.map(m => ({
      userId: m.user,
      quantity: m.quantity,
      amount: (discountedTotal / this.totalQuantity) * m.quantity,
    })),
  };
};

module.exports = mongoose.model('Pool', poolSchema);
