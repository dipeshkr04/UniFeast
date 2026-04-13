const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Helper to get canteen status
settingsSchema.statics.getCanteenStatus = async function () {
  const setting = await this.findOne({ key: 'canteen_live' });
  return setting ? setting.value : false; // default closed
};

// Helper to set canteen status
settingsSchema.statics.setCanteenStatus = async function (isLive, userId) {
  return this.findOneAndUpdate(
    { key: 'canteen_live' },
    { value: isLive, updatedBy: userId, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);
