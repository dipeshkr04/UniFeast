const express = require('express');
const router = express.Router();
const {
  getDailyLog,
  getWeeklyReport,
  logManualMeal,
  deleteMealEntry,
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/daily/:date', protect, getDailyLog);
router.get('/weekly', protect, getWeeklyReport);
router.post('/log', protect, upload.single('image'), logManualMeal);
router.delete('/meal/:logId/:mealId', protect, deleteMealEntry);

module.exports = router;
