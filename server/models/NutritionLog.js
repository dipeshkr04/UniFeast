const mongoose = require('mongoose');

const mealEntrySchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null,
  },
  customName: {
    type: String,
    default: '',
  },
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'snack', 'dinner'],
    default: 'snack',
  },
  imageUrl: {
    type: String,
    default: '',
  },
  isAutoLogged: {
    type: Boolean,
    default: false,
  },
  loggedAt: {
    type: Date,
    default: Date.now,
  },
});

const nutritionLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD format for easy querying
    required: true,
  },
  meals: [mealEntrySchema],
  dailyTotals: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

nutritionLogSchema.index({ user: 1, date: -1 }, { unique: true });

// Recalculate daily totals
nutritionLogSchema.methods.recalculateTotals = function () {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  this.meals.forEach(meal => {
    totals.calories += (meal.calories || 0) * (meal.quantity || 1);
    totals.protein += (meal.protein || 0) * (meal.quantity || 1);
    totals.carbs += (meal.carbs || 0) * (meal.quantity || 1);
    totals.fat += (meal.fat || 0) * (meal.quantity || 1);
    totals.fiber += (meal.fiber || 0) * (meal.quantity || 1);
  });
  this.dailyTotals = totals;
  return totals;
};

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);
