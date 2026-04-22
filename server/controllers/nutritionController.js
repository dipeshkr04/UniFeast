const NutritionLog = require('../models/NutritionLog');
const User = require('../models/User');
const { analyzeFoodComplete } = require('../utils/foodAnalyzer');

// @desc    Get daily nutrition log
// @route   GET /api/nutrition/daily/:date
exports.getDailyLog = async (req, res) => {
  try {
    const date = req.params.date; // YYYY-MM-DD
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
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6); // 7 days including today

    const logs = await NutritionLog.find({
      user: req.user.id,
      date: {
        $gte: weekAgo.toISOString().split('T')[0],
        $lte: today.toISOString().split('T')[0],
      },
    }).sort({ date: 1 });

    const report = [];
    for (let d = new Date(weekAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const log = logs.find(l => l.date === dateStr);
      report.push({
        date: dateStr,
        ...(log ? log.dailyTotals : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
      });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get monthly nutrition report
// @route   GET /api/nutrition/monthly
exports.getMonthlyReport = async (req, res) => {
  try {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 29); // 30 days including today

    const logs = await NutritionLog.find({
      user: req.user.id,
      date: {
        $gte: monthAgo.toISOString().split('T')[0],
        $lte: today.toISOString().split('T')[0],
      },
    }).sort({ date: 1 });

    const report = [];
    for (let d = new Date(monthAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const log = logs.find(l => l.date === dateStr);
      report.push({
        date: dateStr,
        ...(log ? log.dailyTotals : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
      });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user nutrition goals
// @route   PUT /api/nutrition/goals
exports.updateNutritionGoals = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
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

    // Since Cloudinary is used, req.file.path contains the uploaded URL
    const imageUrl = req.file.path;
    const result = await analyzeFoodComplete(imageUrl);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Analyze Food Error:', error.message);
    res.status(500).json({ success: false, message: 'AI Analysis failed or no food detected' });
  }
};

// @desc    Log manual meal
// @route   POST /api/nutrition/log
exports.logManualMeal = async (req, res) => {
  try {
    const { customName, calories, protein, carbs, fat, fiber, mealType, quantity } = req.body;
    const dateStr = new Date().toISOString().split('T')[0];

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
      mealEntry.imageUrl = req.file.path;
    } else if (req.body.imageUrl) {
      mealEntry.imageUrl = req.body.imageUrl;
    }

    log.meals.push(mealEntry);
    log.recalculateTotals();
    await log.save();

    // Streak logic update
    const user = await User.findById(req.user.id);
    if (user.lastLoggedDate !== dateStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (user.lastLoggedDate === yesterdayStr) {
        user.nutritionStreak = (user.nutritionStreak || 0) + 1;
      } else {
        user.nutritionStreak = 1;
      }
      user.lastLoggedDate = dateStr;
      await user.save();
    }

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

    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
