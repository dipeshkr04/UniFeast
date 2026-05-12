const NutritionLog = require('../models/NutritionLog');
const User = require('../models/User');
const { analyzeFoodComplete } = require('../utils/foodAnalyzer');
const { getUploadedFileUrl, normalizeImageUrl } = require('../utils/imageUrl');
const { invalidateLeaderboardCache } = require('../utils/leaderboardEngine');

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Kolkata';

function getLocalDateString(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isDateKey(value = '') {
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function getDateRangeKeys(endDateKey, daysBack) {
  const startDateKey = addDaysToDateKey(endDateKey, -daysBack);
  const dates = [];
  for (let dateKey = startDateKey; dateKey <= endDateKey; dateKey = addDaysToDateKey(dateKey, 1)) {
    dates.push(dateKey);
  }
  return { startDateKey, endDateKey, dates };
}

// @desc    Get daily nutrition log
// @route   GET /api/nutrition/daily/:date
exports.getDailyLog = async (req, res) => {
  try {
    const date = req.params.date; // YYYY-MM-DD
    const todayStr = getLocalDateString();

    if (!isDateKey(date)) {
      return res.status(400).json({ success: false, message: 'Invalid nutrition date' });
    }

    if (date > todayStr) {
      return res.status(400).json({ success: false, message: 'Future nutrition updates are not available' });
    }

    let log = await NutritionLog.findOne({ user: req.user.id, date })
      .populate('meals.menuItem', 'name imageUrl');

    if (!log) {
      log = { date, meals: [], dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } };
    }

    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get weekly nutrition report
// @route   GET /api/nutrition/weekly
exports.getWeeklyReport = async (req, res) => {
  try {
    const todayStr = getLocalDateString();
    const { startDateKey, endDateKey, dates } = getDateRangeKeys(todayStr, 6); // 7 days including today

    const logs = await NutritionLog.find({
      user: req.user.id,
      date: {
        $gte: startDateKey,
        $lte: endDateKey,
      },
    }).sort({ date: 1 });

    const report = dates.map((dateStr) => {
      const log = logs.find(l => l.date === dateStr);
      return {
        date: dateStr,
        ...(log ? log.dailyTotals : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
      };
    });

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get monthly nutrition report
// @route   GET /api/nutrition/monthly
exports.getMonthlyReport = async (req, res) => {
  try {
    const todayStr = getLocalDateString();
    const { startDateKey, endDateKey, dates } = getDateRangeKeys(todayStr, 29); // 30 days including today

    const logs = await NutritionLog.find({
      user: req.user.id,
      date: {
        $gte: startDateKey,
        $lte: endDateKey,
      },
    }).sort({ date: 1 });

    const report = dates.map((dateStr) => {
      const log = logs.find(l => l.date === dateStr);
      return {
        date: dateStr,
        ...(log ? log.dailyTotals : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
      };
    });

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user nutrition goals
// @route   PUT /api/nutrition/goals
exports.updateNutritionGoals = async (req, res) => {
  try {
    const todayStr = getLocalDateString();
    const todaysLog = await NutritionLog.findOne({ user: req.user.id, date: todayStr });
    
    if (todaysLog && todaysLog.meals.length > 0) {
      return res.status(400).json({ success: false, message: 'Goals are locked because you have already consumed meals today. You can adjust goals tomorrow.' });
    }

    const { dailyCalorieGoal, dailyProteinGoal, dailyCarbGoal, dailyFatGoal, dailyFiberGoal } = req.body;

    const updates = {};
    if (dailyCalorieGoal !== undefined) updates.dailyCalorieGoal = dailyCalorieGoal;
    if (dailyProteinGoal !== undefined) updates.dailyProteinGoal = dailyProteinGoal;
    if (dailyCarbGoal !== undefined) updates.dailyCarbGoal = dailyCarbGoal;
    if (dailyFatGoal !== undefined) updates.dailyFatGoal = dailyFatGoal;
    if (dailyFiberGoal !== undefined) updates.dailyFiberGoal = dailyFiberGoal;

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    invalidateLeaderboardCache();
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Analyze uploaded food image via AI
// @route   POST /api/nutrition/analyze
exports.analyzeFood = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image' });
    }

    const imageUrl = getUploadedFileUrl(req.file);
    const result = await analyzeFoodComplete(imageUrl);

    let message = 'Food analyzed successfully';
    if (result.isLowConfidenceWarning) {
      message = 'Low confidence prediction. Please verify the food details.';
    }

    res.json({ success: true, message, data: { ...result, imageUrl } });
  } catch (error) {
    console.error('Analyze Food Error:', error.message);
    if (error.message === "LOW_CONFIDENCE") {
      return res.status(400).json({ success: false, message: 'Model has low confidence. Please enter the values manually.' });
    }
    res.status(500).json({ success: false, message: 'AI Analysis failed or no food detected' });
  }
};

// @desc    Log manual meal
// @route   POST /api/nutrition/log
exports.logManualMeal = async (req, res) => {
  try {
    const { customName, calories, protein, carbs, fat, fiber, mealType, quantity } = req.body;
    const dateStr = getLocalDateString();

    let log = await NutritionLog.findOne({ user: req.user.id, date: dateStr });
    if (!log) {
      log = new NutritionLog({ user: req.user.id, date: dateStr, meals: [] });
    }

    const mealEntry = {
      customName: customName || 'Manual Entry',
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: Number(fiber) || 0,
      quantity: Number(quantity) || 1,
      mealType: mealType || 'snack',
      isAutoLogged: false,
    };

    if (req.file) {
      mealEntry.imageUrl = getUploadedFileUrl(req.file);
    } else if (req.body.imageUrl) {
      mealEntry.imageUrl = normalizeImageUrl(req.body.imageUrl);
    }

    log.meals.push(mealEntry);
    log.recalculateTotals();
    await log.save();

    // Streak logic update
    const user = await User.findById(req.user.id);
    if (user.lastLoggedDate !== dateStr) {
      const yesterdayStr = addDaysToDateKey(dateStr, -1);

      if (user.lastLoggedDate === yesterdayStr) {
        user.nutritionStreak = (user.nutritionStreak || 0) + 1;
      } else {
        user.nutritionStreak = 1;
      }
      user.lastLoggedDate = dateStr;
      await user.save();
    }

    invalidateLeaderboardCache();
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a meal entry
// @route   DELETE /api/nutrition/meal/:logId/:mealId
exports.deleteMealEntry = async (req, res) => {
  try {
    const log = await NutritionLog.findById(req.params.logId);
    if (!log || log.user.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }

    log.meals = log.meals.filter(m => m._id.toString() !== req.params.mealId);
    log.recalculateTotals();
    await log.save();

    invalidateLeaderboardCache();
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update meal quantity
// @route   PATCH /api/nutrition/meal/:logId/:mealId/quantity
exports.updateMealQuantity = async (req, res) => {
  try {
    const { quantity } = req.body;
    const log = await NutritionLog.findById(req.params.logId);
    if (!log || log.user.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }

    const meal = log.meals.id(req.params.mealId);
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }

    const newQty = Math.max(1, Math.min(20, Number(quantity)));
    meal.quantity = newQty;
    log.recalculateTotals();
    await log.save();

    invalidateLeaderboardCache();
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
