const mongoose = require('mongoose');

const cartReservationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  dayKey: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

cartReservationSchema.index({ user: 1, menuItem: 1 }, { unique: true });
cartReservationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('CartReservation', cartReservationSchema);
