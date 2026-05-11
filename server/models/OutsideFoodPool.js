const mongoose = require('mongoose');

const POOL_STATUSES = ['OPEN', 'UNLOCKED', 'LOCKED', 'COORDINATING', 'COMPLETED', 'ARCHIVED'];
const POOL_CATEGORIES = ['food', 'travel', 'others'];

const outsideFoodPoolSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OutsideFoodRestaurant',
    default: null,
  },
  category: {
    type: String,
    enum: POOL_CATEGORIES,
    default: 'food',
    lowercase: true,
  },
  broadcaster: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [140, 'Pool title cannot exceed 140 characters'],
  },
  status: {
    type: String,
    enum: POOL_STATUSES,
    default: 'OPEN',
  },
  targetAmount: {
    type: Number,
    required: true,
    min: [1, 'Target amount must be positive'],
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  participantCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OutsideFoodParticipant',
  }],
  opensAt: {
    type: Date,
    default: Date.now,
  },
  closesAt: {
    type: Date,
    default: null,
  },
  unlockAt: {
    type: Date,
    default: null,
  },
  graceClosesAt: {
    type: Date,
    default: null,
  },
  lockedAt: {
    type: Date,
    default: null,
  },
  coordinators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  coordinatorLastActiveAt: {
    type: Date,
    default: null,
  },
  coordinationConfirmedAt: {
    type: Date,
    default: null,
  },
  pickupPoint: {
    type: String,
    default: '',
    trim: true,
  },
  archived: {
    type: Boolean,
    default: false,
  },
  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

outsideFoodPoolSchema.index({ status: 1, archived: 1, opensAt: 1, closesAt: 1 });
outsideFoodPoolSchema.index({ restaurantId: 1, closesAt: 1 });
outsideFoodPoolSchema.index({ coordinators: 1 });
outsideFoodPoolSchema.index({ broadcaster: 1, status: 1, createdAt: -1 });
outsideFoodPoolSchema.index({ category: 1, status: 1, createdAt: -1 });

outsideFoodPoolSchema.statics.statuses = POOL_STATUSES;
outsideFoodPoolSchema.statics.categories = POOL_CATEGORIES;

module.exports = mongoose.model('OutsideFoodPool', outsideFoodPoolSchema);
