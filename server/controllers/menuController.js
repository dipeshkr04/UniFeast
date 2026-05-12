const MenuItem = require('../models/MenuItem');
const { analyzeMenuItemNutrition } = require('../utils/foodAnalyzer');
const {
  resetExpiredDailyStocks,
  setDailyStock,
} = require('../utils/dailyStock');
const { getUploadedFileUrl, normalizeImageUrl } = require('../utils/imageUrl');

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

function parseMaxOrder(value, fallback = 15) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 999);
}

function buildMenuPayload(body, imageUrl) {
  return {
    name: body.name,
    description: '',
    price: body.price,
    category: body.category,
    imageUrl: normalizeImageUrl(imageUrl),
    prepTime: body.prepTime,
    maxOrder: parseMaxOrder(body.maxOrder, 15),
    isAvailable: parseBoolean(body.isAvailable, true),
    tags: [],
  };
}

function serializeMenuItem(item) {
  const data = item?.toObject ? item.toObject() : item;
  return data ? { ...data, imageUrl: normalizeImageUrl(data.imageUrl) } : data;
}

function isNutritionEmpty(nutrition = {}) {
  return ['calories', 'protein', 'carbs', 'fat', 'fiber']
    .every((key) => !Number(nutrition[key]));
}

async function resolveMenuNutrition(name, imageUrl) {
  const analysis = await analyzeMenuItemNutrition({ name, imageUrl });
  return {
    analysis,
    nutrition: analysis.nutrition,
  };
}

function notifyMenuStockChanged(req, item) {
  const io = req.app.get('io');
  if (io) {
    io.emit('menu:stockChanged', {
      menuItemId: item?._id?.toString(),
      dailyStock: item?.dailyStock || null,
    });
  }
}

// @desc    Get all menu items
// @route   GET /api/menu
exports.getMenuItems = async (req, res) => {
  try {
    await resetExpiredDailyStocks();
    const { category, search, available } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (available !== undefined) filter.isAvailable = available === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 }).lean();
    const data = items.map(serializeMenuItem);
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
exports.getMenuItem = async (req, res) => {
  try {
    await resetExpiredDailyStocks();
    const item = await MenuItem.findById(req.params.id).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, data: serializeMenuItem(item) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update current daily stock for a menu item
// @route   PATCH /api/menu/:id/stock
exports.updateMenuStock = async (req, res) => {
  try {
    await resetExpiredDailyStocks();
    const item = await setDailyStock(req.params.id, req.body.stock);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    notifyMenuStockChanged(req, item);
    res.json({ success: true, data: serializeMenuItem(item) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Analyze menu item nutrition via Ollama
// @route   POST /api/menu/analyze-nutrition
exports.analyzeMenuNutrition = async (req, res) => {
  try {
    const imageUrl = getUploadedFileUrl(req.file) || normalizeImageUrl(req.body.imageUrl);
    const { analysis, nutrition } = await resolveMenuNutrition(req.body.name, imageUrl);

    res.json({
      success: true,
      data: {
        ...analysis,
        nutrition,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create menu item
// @route   POST /api/menu
exports.createMenuItem = async (req, res) => {
  try {
    const imageUrl = getUploadedFileUrl(req.file);
    const payload = buildMenuPayload(req.body, imageUrl);
    const { nutrition } = await resolveMenuNutrition(payload.name, payload.imageUrl);
    payload.nutrition = nutrition;

    const item = await MenuItem.create(payload);
    res.status(201).json({ success: true, data: serializeMenuItem(item) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
exports.updateMenuItem = async (req, res) => {
  try {
    const existingItem = await MenuItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const imageUrl = getUploadedFileUrl(req.file) || normalizeImageUrl(existingItem.imageUrl);
    const payload = buildMenuPayload({
      name: req.body.name ?? existingItem.name,
      price: req.body.price ?? existingItem.price,
      category: req.body.category ?? existingItem.category,
      prepTime: req.body.prepTime ?? existingItem.prepTime,
      maxOrder: req.body.maxOrder ?? existingItem.maxOrder ?? 15,
      isAvailable: req.body.isAvailable ?? existingItem.isAvailable,
    }, imageUrl);

    const nameChanged = payload.name !== existingItem.name;
    const imageChanged = Boolean(req.file);
    if (nameChanged || imageChanged || isNutritionEmpty(existingItem.nutrition)) {
      const { nutrition } = await resolveMenuNutrition(payload.name, payload.imageUrl);
      payload.nutrition = nutrition;
    }

    const item = await MenuItem.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    res.json({ success: true, data: serializeMenuItem(item) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
exports.deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle item availability
// @route   PATCH /api/menu/:id/toggle
exports.toggleAvailability = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    item.isAvailable = !item.isAvailable;
    await item.save();
    res.json({ success: true, data: serializeMenuItem(item) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
