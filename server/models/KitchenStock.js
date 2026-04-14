const mongoose = require('mongoose');

const kitchenStockSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
    unique: true,
    index: true,
  },
  madeQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('KitchenStock', kitchenStockSchema);
