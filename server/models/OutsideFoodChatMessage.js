const mongoose = require('mongoose');

const outsideFoodChatMessageSchema = new mongoose.Schema({
  poolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OutsideFoodPool',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  type: {
    type: String,
    enum: ['TEXT', 'SYSTEM', 'STATUS_UPDATE'],
    default: 'TEXT',
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [600, 'Message cannot exceed 600 characters'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

outsideFoodChatMessageSchema.index({ poolId: 1, timestamp: 1 });

module.exports = mongoose.model('OutsideFoodChatMessage', outsideFoodChatMessageSchema);
