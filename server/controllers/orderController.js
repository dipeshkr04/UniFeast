const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const NutritionLog = require('../models/NutritionLog');
const { calculateETA, recalculateAllETAs } = require('../utils/queueEngine');

// @desc    Create new order
// @route   POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { items, specialInstructions } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please add items to your order' });
    }

    // Fetch menu items and calculate total
    let totalAmount = 0;
    let maxPrepTime = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (!menuItem) {
        return res.status(404).json({ success: false, message: `Menu item ${item.menuItem} not found` });
      }
      if (!menuItem.isAvailable) {
        return res.status(400).json({ success: false, message: `${menuItem.name} is currently unavailable` });
      }

      const quantity = item.quantity || 1;
      totalAmount += menuItem.price * quantity;
      maxPrepTime = Math.max(maxPrepTime, menuItem.prepTime);

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
      });
    }

    // Calculate ETA using queue engine
    const etaResult = await calculateETA(maxPrepTime);

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      totalAmount,
      estimatedTime: etaResult.eta,
      estimatedReadyAt: new Date(Date.now() + etaResult.eta * 60 * 1000),
      specialInstructions,
      statusHistory: [{ status: 'pending', timestamp: new Date() }],
    });

    // Populate for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .populate('user', 'name email');

    // Emit socket events
    if (req.app.get('socketHandlers')) {
      const handlers = req.app.get('socketHandlers');
      handlers.notifyNewOrder(populatedOrder);
      handlers.notifyQueueStats();
    }

    res.status(201).json({
      success: true,
      data: populatedOrder,
      eta: etaResult,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my orders
// @route   GET /api/orders/my
exports.getMyOrders = async (req, res) => {
  try {
    const { status, limit = 20 } = req.query;
    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders (kitchen/admin)
// @route   GET /api/orders
exports.getAllOrders = async (req, res) => {
  try {
    const { status, date, limit = 50 } = req.query;
    const filter = {};
    
    if (status) {
      filter.status = status === 'active' 
        ? { $in: ['pending', 'queued', 'preparing'] }
        : status;
    }
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const orders = await Order.find(filter)
      .populate('items.menuItem', 'name price imageUrl prepTime')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'queued', 'preparing', 'ready', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    order.statusHistory.push({ status, timestamp: new Date() });
    
    if (status === 'completed') {
      order.actualCompletionTime = new Date();
      // Auto-log nutrition on completion
      await autoLogNutrition(order);
    }

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .populate('user', 'name email');

    // Recalculate all ETAs when an order status changes
    const etaUpdates = await recalculateAllETAs();

    // Socket notifications
    if (req.app.get('socketHandlers')) {
      const handlers = req.app.get('socketHandlers');
      handlers.notifyOrderUpdate(order.user.toString(), {
        orderId: order._id,
        status,
        estimatedTime: order.estimatedTime,
      });
      handlers.notifyAllETAUpdates(etaUpdates);
      handlers.notifyQueueStats();
    }

    res.json({ success: true, data: populatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Students can only see their own orders
    if (req.user.role === 'student' && order.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats/summary
exports.getOrderStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayOrders, totalRevenue, avgPrepTime, statusCounts] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed', actualCompletionTime: { $ne: null } } },
        {
          $project: {
            prepDuration: {
              $divide: [{ $subtract: ['$actualCompletionTime', '$createdAt'] }, 60000],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: '$prepDuration' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        todayOrders,
        todayRevenue: totalRevenue[0]?.total || 0,
        avgPrepTime: Math.round(avgPrepTime[0]?.avg || 0),
        statusBreakdown: statusCounts.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Auto-log nutrition when order completes
async function autoLogNutrition(order) {
  try {
    const populatedOrder = await Order.findById(order._id).populate('items.menuItem');
    const dateStr = new Date().toISOString().split('T')[0];

    let log = await NutritionLog.findOne({ user: order.user, date: dateStr });
    if (!log) {
      log = new NutritionLog({ user: order.user, date: dateStr, meals: [] });
    }

    for (const item of populatedOrder.items) {
      if (item.menuItem && item.menuItem.nutrition) {
        const n = item.menuItem.nutrition;
        log.meals.push({
          menuItem: item.menuItem._id,
          customName: item.menuItem.name,
          calories: n.calories || 0,
          protein: n.protein || 0,
          carbs: n.carbs || 0,
          fat: n.fat || 0,
          fiber: n.fiber || 0,
          quantity: item.quantity,
          mealType: determineMealType(),
          isAutoLogged: true,
        });
      }
    }

    log.recalculateTotals();
    await log.save();
  } catch (err) {
    console.error('Auto nutrition log error:', err.message);
  }
}

function determineMealType() {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}
