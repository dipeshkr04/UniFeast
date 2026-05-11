const mongoose = require('mongoose');

const outsideFoodRestaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    maxlength: [120, 'Restaurant name cannot exceed 120 characters'],
  },
  image: {
    type: String,
    default: '',
  },
  cuisineTags: [{
    type: String,
    trim: true,
  }],
  minPoolAmount: {
    type: Number,
    required: [true, 'Minimum pool amount is required'],
    min: [1, 'Minimum pool amount must be positive'],
  },
  estimatedDeliveryTime: {
    type: String,
    default: '45-60 min',
  },
  contactNumber: {
    type: String,
    default: '',
    trim: true,
  },
  menuLink: {
    type: String,
    default: '',
    trim: true,
  },
  whatsappLink: {
    type: String,
    default: '',
    trim: true,
  },
  pickupPoints: [{
    type: String,
    trim: true,
  }],
  active: {
    type: Boolean,
    default: true,
  },
  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

outsideFoodRestaurantSchema.index({ active: 1, name: 1 });

module.exports = mongoose.model('OutsideFoodRestaurant', outsideFoodRestaurantSchema);
