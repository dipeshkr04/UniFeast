const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const NutritionLog = require('../models/NutritionLog');
const Settings = require('../models/Settings');
const KitchenStock = require('../models/KitchenStock');
const { calculateETA, recalculateAllETAs } = require('../utils/queueEngine');

function getItemRequestedQty(orderItem) {
  return Number(orderItem.quantity || 0);
}

function getItemAssignedQty(orderItem) {
  return Math.min(Number(orderItem.assignedReadyQty || 0), Number(orderItem.quantity || 0));
}

function isOrderFullyAssigned(order) {
  return order.items.every((item) => getItemAssignedQty(item) >= getItemRequestedQty(item));
}

function getFulfillmentSummary(order) {
  const totalRequested = order.items.reduce((sum, item) => sum + getItemRequestedQty(item), 0);
  const totalAssigned = order.items.reduce((sum, item) => sum + getItemAssignedQty(item), 0);

  return {
    totalRequested,
    totalAssigned,
    isFulfilled: totalRequested > 0 && totalAssigned >= totalRequested,
  };
}

async function getAllocatedActiveQuantity(menuItemId) {
  const activeOrders = await Order.find({
    status: { $in: ['pending', 'queued', 'preparing', 'ready'] },
    'items.menuItem': menuItemId,
  }, { items: 1 });

  return activeOrders.reduce((sum, order) => {
    const item = order.items.find((x) => x.menuItem.toString() === menuItemId.toString());
    return sum + (item ? getItemAssignedQty(item) : 0);
  }, 0);
}

async function autoAllocateForMenuItem(menuItemId, app) {
  const stock = await KitchenStock.findOne({ menuItem: menuItemId });
  if (!stock || stock.madeQuantity <= 0) return [];

  const allocatedActive = await getAllocatedActiveQuantity(menuItemId);
  let availableToAllocate = Math.max(0, stock.madeQuantity - allocatedActive);
  if (availableToAllocate <= 0) return [];

  const waitingOrders = await Order.find({
    status: { $in: ['pending', 'queued', 'preparing', 'ready'] },
    'items.menuItem': menuItemId,
  }).sort({ createdAt: 1 });

  const touchedOrders = [];
  for (const order of waitingOrders) {
    const item = order.items.find((x) => x.menuItem.toString() === menuItemId.toString());
    if (!item) continue;

    const need = Math.max(0, getItemRequestedQty(item) - getItemAssignedQty(item));
    if (need <= 0) continue;

    const assign = Math.min(need, availableToAllocate);
    item.assignedReadyQty = getItemAssignedQty(item) + assign;
    availableToAllocate -= assign;

    if (isOrderFullyAssigned(order) && order.status !== 'ready') {
      order.status = 'ready';
      order.statusHistory.push({ status: 'ready', timestamp: new Date() });
    }

    touchedOrders.push(order);
    if (availableToAllocate <= 0) break;
  }

  if (touchedOrders.length === 0) return [];

  await Promise.all(touchedOrders.map((o) => o.save()));

  const populatedTouched = await Promise.all(
    touchedOrders.map((o) => Order.findById(o._id)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .populate('user', 'name email'))
  );

  if (app?.get('socketHandlers')) {
    const handlers = app.get('socketHandlers');
    populatedTouched.forEach((order) => {
      handlers.notifyOrderUpdate(order.user._id.toString(), {
        orderId: order._id,
        status: order.status,
        estimatedTime: order.estimatedTime,
      });
    });
    handlers.notifyQueueStats();
  }

  return populatedTouched;
}

async function consumeMadeStockForCompletedOrder(order) {
  const updates = order.items.map((item) => ({
    updateOne: {
      filter: { menuItem: item.menuItem },
      update: { $inc: { madeQuantity: -Number(item.quantity || 0) } },
    },
  }));

  if (updates.length) {
    await KitchenStock.bulkWrite(updates, { ordered: true });
    await KitchenStock.updateMany(
      { madeQuantity: { $lt: 0 } },
      { $set: { madeQuantity: 0 } }
    );
  }
}

async function buildKitchenStockSummary() {
  const [stocks, activeOrders] = await Promise.all([
    KitchenStock.find({ madeQuantity: { $gt: 0 } }).populate('menuItem', 'name category'),
    Order.find({ status: { $in: ['pending', 'queued', 'preparing', 'ready'] } })
      .populate('items.menuItem', 'name category')
      .select('items'),
  ]);

  const waitingMap = new Map();
  const assignedMap = new Map();
  const menuMeta = new Map();

  for (const order of activeOrders) {
    for (const item of order.items) {
      const id = item.menuItem?._id?.toString() || item.menuItem?.toString();
      if (!id) continue;
      const requested = getItemRequestedQty(item);
      const assigned = getItemAssignedQty(item);
      const waiting = Math.max(0, requested - assigned);

      waitingMap.set(id, (waitingMap.get(id) || 0) + waiting);
      assignedMap.set(id, (assignedMap.get(id) || 0) + assigned);

      if (item.menuItem?.name) {
        menuMeta.set(id, {
          menuItemId: id,
          name: item.menuItem.name,
          category: item.menuItem.category,
        });
      }
    }
  }

  for (const stock of stocks) {
    const id = stock.menuItem?._id?.toString() || stock.menuItem?.toString();
    if (!id) continue;
    if (stock.menuItem?.name) {
      menuMeta.set(id, {
        menuItemId: id,
        name: stock.menuItem.name,
        category: stock.menuItem.category,
      });
    }
  }

  const summary = Array.from(menuMeta.values()).map((meta) => {
    const madeQuantity = stocks.find((s) => (s.menuItem?._id?.toString() || s.menuItem?.toString()) === meta.menuItemId)?.madeQuantity || 0;
    const allocatedQuantity = assignedMap.get(meta.menuItemId) || 0;
    const waitingQuantity = waitingMap.get(meta.menuItemId) || 0;
    return {
      ...meta,
      madeQuantity,
      allocatedQuantity,
      availableQuantity: Math.max(0, madeQuantity - allocatedQuantity),
      waitingQuantity,
    };
  });

  return summary
    .filter((x) => x.madeQuantity > 0 || x.waitingQuantity > 0 || x.allocatedQuantity > 0)
    .sort((a, b) => b.waitingQuantity - a.waitingQuantity || a.name.localeCompare(b.name));
}

// @desc    Create new order
// @route   POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { items, specialInstructions } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please add items to your order' });
    }

    // Check if canteen is open
    const isLive = await Settings.getCanteenStatus();
    if (!isLive) {
      return res.status(400).json({ success: false, message: 'Canteen is currently closed. Please try again later.' });
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
      // Use the longest item's prep time as the bottleneck
      // (items within a single order are prepped in parallel on one station)
      maxPrepTime = Math.max(maxPrepTime, menuItem.prepTime);

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        assignedReadyQty: 0,
      });
    }

    // Calculate ETA using queue engine (Erlang-C handles queue depth)
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

    const distinctMenuItemIds = [...new Set(orderItems.map((i) => i.menuItem.toString()))];
    await Promise.all(distinctMenuItemIds.map((id) => autoAllocateForMenuItem(id, req.app)));

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
        ? { $in: ['pending', 'queued', 'preparing', 'ready'] }
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

    const fulfillment = getFulfillmentSummary(order);

    if ((status === 'ready' || status === 'completed') && !fulfillment.isFulfilled) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot advance until all items are fulfilled from made stock',
      });
    }

    order.status = status;
    order.statusHistory.push({ status, timestamp: new Date() });
    
    if (status === 'completed') {
      order.actualCompletionTime = new Date();
      await consumeMadeStockForCompletedOrder(order);
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

// @desc    Add produced quantity and auto-allocate to oldest active orders
// @route   POST /api/orders/kitchen/produce
exports.addProducedStock = async (req, res) => {
  try {
    const { menuItemId, quantity } = req.body;
    const parsedQty = Number(quantity);

    if (!menuItemId || !Number.isFinite(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ success: false, message: 'menuItemId and positive quantity are required' });
    }

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    await KitchenStock.findOneAndUpdate(
      { menuItem: menuItemId },
      { $inc: { madeQuantity: parsedQty } },
      { upsert: true, new: true }
    );

    const impactedOrders = await autoAllocateForMenuItem(menuItemId, req.app);
    const stock = await buildKitchenStockSummary();

    res.json({
      success: true,
      message: `${parsedQty} ${menuItem.name} marked as made`,
      impactedOrders: impactedOrders.map((o) => ({
        _id: o._id,
        status: o.status,
        user: o.user,
      })),
      stock,
    });
  } catch (error) {
    console.error('Add produced stock error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get kitchen made/allocated stock summary
// @route   GET /api/orders/kitchen/stock
exports.getKitchenStock = async (req, res) => {
  try {
    const stock = await buildKitchenStockSummary();
    res.json({ success: true, count: stock.length, data: stock });
  } catch (error) {
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
      // Revenue = only COMPLETED orders (recognized on completion, not placement)
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      // Avg prep time = time from when kitchen started preparing to completion
      Order.aggregate([
        { $match: { status: 'completed', actualCompletionTime: { $ne: null }, createdAt: { $gte: today, $lt: tomorrow } } },
        {
          $addFields: {
            preparingStartedAt: {
              $ifNull: [
                {
                  $arrayElemAt: [
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: '$statusHistory',
                            cond: { $eq: ['$$this.status', 'preparing'] }
                          }
                        },
                        in: '$$this.timestamp'
                      }
                    },
                    0
                  ]
                },
                '$createdAt'
              ]
            }
          }
        },
        {
          $project: {
            prepDuration: {
              $divide: [{ $subtract: ['$actualCompletionTime', '$preparingStartedAt'] }, 60000],
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
