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

settingsSchema.statics.getCartHoldMs = async function () {
  const fallback = Number(process.env.CART_HOLD_MS || process.env.VITE_CART_HOLD_MS || 120000);
  const setting = await this.findOne({ key: 'cart_hold_ms' });
  const value = Number(setting?.value ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : 120000;
};

settingsSchema.statics.setCartHoldMs = async function (holdMs, userId) {
  const value = Number(holdMs);
  if (!Number.isFinite(value) || value < 10000) {
    const error = new Error('Cart hold window must be at least 10 seconds');
    error.statusCode = 400;
    throw error;
  }

  return this.findOneAndUpdate(
    { key: 'cart_hold_ms' },
    { value: Math.round(value), updatedBy: userId, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);
