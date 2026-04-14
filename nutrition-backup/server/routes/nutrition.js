const express = require('express');
const router = express.Router();
const {
  getDailyLog,
  getWeeklyReport,
  getMonthlyReport,
  updateNutritionGoals,
  analyzeFood,
  logManualMeal,
  deleteMealEntry,
  updateMealQuantity,
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/daily/:date', protect, getDailyLog);
router.get('/weekly', protect, getWeeklyReport);
router.get('/monthly', protect, getMonthlyReport);
router.put('/goals', protect, updateNutritionGoals);
router.post('/analyze', protect, upload.single('image'), analyzeFood);
router.post('/log', protect, upload.single('image'), logManualMeal);
router.delete('/meal/:logId/:mealId', protect, deleteMealEntry);
router.patch('/meal/:logId/:mealId/quantity', protect, updateMealQuantity);

module.exports = router;
