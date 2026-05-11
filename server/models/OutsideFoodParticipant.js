const mongoose = require('mongoose');

const outsideFoodParticipantSchema = new mongoose.Schema({
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
    default: '',
    maxlength: [300, 'Order preview cannot exceed 300 characters'],
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  messageCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastActiveAt: {
    type: Date,
    default: null,
  },
  online: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

outsideFoodParticipantSchema.index({ poolId: 1, userId: 1 }, { unique: true });
outsideFoodParticipantSchema.index({ poolId: 1, online: 1 });

module.exports = mongoose.model('OutsideFoodParticipant', outsideFoodParticipantSchema);
