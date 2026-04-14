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
    weekAgo.setDate(weekAgo.getDate() - 7);

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
    monthAgo.setDate(monthAgo.getDate() - 30);

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
    const { dailyCalorieGoal, dailyProteinGoal, dailyCarbGoal, dailyFatGoal } = req.body;

    const updates = {};
    if (dailyCalorieGoal !== undefined) updates.dailyCalorieGoal = dailyCalorieGoal;
    if (dailyProteinGoal !== undefined) updates.dailyProteinGoal = dailyProteinGoal;
    if (dailyCarbGoal !== undefined) updates.dailyCarbGoal = dailyCarbGoal;
    if (dailyFatGoal !== undefined) updates.dailyFatGoal = dailyFatGoal;

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
    let imageUrl = req.body.imageUrl;

    // If multer uploaded a file to Cloudinary, use that URL
    if (req.file) {
      imageUrl = req.file.path;
    }

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Please provide an image file or imageUrl' });
    }

    const result = await analyzeFoodComplete(imageUrl);
    res.status(200).json({ success: true, data: result, imageUrl });
  } catch (error) {
    console.error("analyzeFood Endpoint Error:", error);
    res.status(500).json({ success: false, message: error.message });
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
      calories: calories || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
      fiber: fiber || 0,
      quantity: quantity || 1,
      mealType: mealType || 'snack',
      isAutoLogged: false,
    };

    // FIX: use Cloudinary path directly instead of local /uploads/
    if (req.file) {
      mealEntry.imageUrl = req.file.path;
    } else if (req.body.imageUrl) {
      mealEntry.imageUrl = req.body.imageUrl;
    }

    log.meals.push(mealEntry);
    log.recalculateTotals();
    await log.save();

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
