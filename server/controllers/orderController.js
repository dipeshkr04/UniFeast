const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const NutritionLog = require('../models/NutritionLog');
const Settings = require('../models/Settings');
const KitchenStock = require('../models/KitchenStock');
const Payment = require('../models/paymentModel');
const { calculateETA, recalculateAllETAs } = require('../utils/queueEngine');
const { recalculateQueueETAs, getKitchenSummary } = require('../services/queueService');
const lockManager = require('../config/lockManager');
const {
  resetExpiredDailyStocks,
  reserveDailyStock,
  releaseDailyStock,
} = require('../utils/dailyStock');

function getItemRequestedQty(orderItem) {
  return Number(orderItem?.quantity || 0);
}

function getItemAssignedQty(orderItem) {
  return Math.min(Number(orderItem?.assignedReadyQty || 0), Number(orderItem?.quantity || 0));
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
      order.preparedAt = new Date();
      order.estimatedTime = 0;
      order.estimatedReadyAt = new Date();
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
  let attemptedRazorpayPaymentId = null;
  let reservedStock = [];
  let orderPersisted = false;
  try {
    const { items, specialInstructions } = req.body;
    const razorpayPaymentId = req.body.razorpayPaymentId || req.body.razorpay_payment_id || null;
    attemptedRazorpayPaymentId = razorpayPaymentId;

    if (!razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'Verified payment is required before creating an order' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please add items to your order' });
    }

    if (razorpayPaymentId) {
      const existingOrder = await Order.findOne({ user: req.user.id, razorpayPaymentId })
        .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
        .populate('user', 'name email');

      if (existingOrder) {
        return res.status(200).json({
          success: true,
          data: existingOrder,
          eta: { eta: existingOrder.estimatedTime || 0 },
          idempotent: true,
        });
      }
    }

    const verifiedPayment = await Payment.findOne({
      user: req.user.id,
      paymentId: razorpayPaymentId,
      status: 'SUCCESS',
    });

    if (!verifiedPayment) {
      return res.status(400).json({ success: false, message: 'Payment is not verified for this order' });
    }

    // Check if canteen is open
    const isLive = await Settings.getCanteenStatus();
    if (!isLive) {
      return res.status(400).json({ success: false, message: 'Canteen is currently closed. Please try again later.' });
    }

    await resetExpiredDailyStocks();

    // Fetch menu items and calculate total
    let totalAmount = 0;
    let orderServiceTime = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (!menuItem) {
        return res.status(404).json({ success: false, message: `Menu item ${item.menuItem} not found` });
      }
      if (!menuItem.isAvailable) {
        return res.status(400).json({ success: false, message: `${menuItem.name} is currently unavailable` });
      }

      const quantity = Number(item.quantity || 1);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Order item quantity must be a positive whole number' });
      }

      totalAmount += menuItem.price * quantity;
      // Queue-aware service load: quantity contributes to ETA.
      orderServiceTime += (menuItem.prepTime || 10) * quantity;

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        assignedReadyQty: 0,
      });
    }

    if (Math.round(verifiedPayment.price.amount * 100) !== Math.round(totalAmount * 100)) {
      return res.status(400).json({ success: false, message: 'Paid amount does not match the order total' });
    }

    reservedStock = await reserveDailyStock(orderItems);

    // Calculate the order's own workload; recalculateAllETAs adds existing queue backlog.
    const etaResult = await calculateETA(Math.max(1, orderServiceTime));

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      totalAmount,
      razorpayPaymentId,
      estimatedTime: etaResult.eta,
      estimatedReadyAt: new Date(Date.now() + etaResult.eta * 60 * 1000),
      specialInstructions,
      statusHistory: [{ status: 'pending', timestamp: new Date() }],
    });
    orderPersisted = true;

    order.status = 'queued';
    order.statusHistory.push({ status: 'queued', timestamp: new Date() });
    await order.save();
    if (lockManager?.client?.zadd) {
      await lockManager.client.zadd('kitchen:queue', Date.now(), order._id.toString());
    }

    const distinctMenuItemIds = [...new Set(orderItems.map((i) => i.menuItem.toString()))];
    await Promise.all(distinctMenuItemIds.map((id) => autoAllocateForMenuItem(id, req.app)));

    // Recalculate ETA snapshot immediately so later orders include queue backlog.
    const etaUpdates = await recalculateAllETAs();

    // Populate for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .populate('user', 'name email');

    // Emit socket events
    if (req.app.get('socketHandlers')) {
      const handlers = req.app.get('socketHandlers');
      handlers.notifyNewOrder(populatedOrder);
      handlers.notifyAllETAUpdates(etaUpdates);
      handlers.notifyQueueStats();
    }
    if (reservedStock.length && req.app.get('io')) {
      req.app.get('io').emit('menu:stockChanged', { updated: true });
    }

    res.status(201).json({
      success: true,
      data: populatedOrder,
      eta: {
        ...etaResult,
        eta: populatedOrder?.estimatedTime || etaResult.eta,
      },
    });
  } catch (error) {
    if (reservedStock.length && !orderPersisted) {
      await releaseDailyStock(reservedStock).catch((releaseError) => {
        console.error('Daily stock release error:', releaseError.message);
      });
    }

    if (error.code === 11000 && attemptedRazorpayPaymentId) {
      const existingOrder = await Order.findOne({ user: req.user.id, razorpayPaymentId: attemptedRazorpayPaymentId })
        .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
        .populate('user', 'name email');

      if (existingOrder) {
        return res.status(200).json({
          success: true,
          data: existingOrder,
          eta: { eta: existingOrder.estimatedTime || 0 },
          idempotent: true,
        });
      }
    }
    console.error('Create order error:', error);
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

// @desc    Get my orders
// @route   GET /api/orders/my
exports.getMyOrders = async (req, res) => {
  try {
    const { status, limit } = req.query;
    const filter = { user: req.user.id };
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'cancelled' };
    }

    const query = Order.find(filter)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .sort({ createdAt: -1 });

    if (limit) {
      query.limit(parseInt(limit));
    }

    const orders = await query;

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
      const preparingStartedAt =
        order.statusHistory.find((h) => h.status === 'preparing')?.timestamp || order.createdAt;
      order.actualCompletionTime = Date.now() - new Date(preparingStartedAt).getTime();
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

// @desc    Mark one order item line as ready and recalculate queue ETA
// @route   PATCH /api/orders/:id/items/:itemId/ready
exports.markOrderItemReady = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const io = req.app.get('io');

    const order = await Order.findById(id)
      .populate('items.menuItem', 'name imageUrl prepTime nutrition')
      .populate('user', 'name email phone _id btId');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Completed or cancelled orders cannot be changed' });
    }

    const item = order.items.id(itemId) || order.items.find((x) => x.menuItem?._id?.toString() === itemId || x.menuItem?.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found' });
    }

    const requestedQty = getItemRequestedQty(item);
    const previousReadyQty = getItemAssignedQty(item);
    const remainingQty = Math.max(0, requestedQty - previousReadyQty);
    const itemName = item.menuItem?.name || item.name || 'Item';

    if (remainingQty <= 0) {
      return res.json({
        success: true,
        message: `${itemName} is already marked ready`,
        order,
        alreadyReady: true,
      });
    }

    item.assignedReadyQty = requestedQty;

    const now = new Date();
    const becameFullyReady = isOrderFullyAssigned(order);
    if (becameFullyReady && order.status !== 'ready') {
      order.status = 'ready';
      order.preparedAt = now;
      order.estimatedTime = 0;
      order.estimatedReadyAt = now;
      order.statusHistory.push({ status: 'ready', timestamp: now });
      if (lockManager?.client?.zrem) {
        await lockManager.client.zrem('kitchen:queue', order._id.toString());
      }
    }

    await order.save();

    const queueStats = await recalculateQueueETAs(io);

    const populatedOrder = await Order.findById(order._id)
      .populate('items.menuItem', 'name price imageUrl prepTime nutrition')
      .populate('user', 'name email phone _id btId');

    const readyQty = getItemAssignedQty(
      populatedOrder.items.id(item._id) ||
      populatedOrder.items.find((x) => x._id.toString() === item._id.toString())
    );

    if (io) {
      const itemReadyNotification = `${readyQty}x ${itemName} is ready. We are finishing the rest of your order.`;
      const payload = {
        orderId: populatedOrder._id.toString(),
        itemId: item._id.toString(),
        menuItemId: item.menuItem?._id?.toString() || item.menuItem?.toString(),
        itemName,
        readyQty,
        totalQty: requestedQty,
        status: populatedOrder.status,
        newStatus: populatedOrder.status,
        estimatedTime: populatedOrder.estimatedTime,
        estimatedReadyAt: populatedOrder.estimatedReadyAt,
        order: populatedOrder,
        notification: itemReadyNotification,
      };

      io.to('kitchen').emit('order:itemReady', payload);
      io.to('kitchen').emit('order:statusChanged', payload);

      const userId = populatedOrder.user?._id?.toString() || populatedOrder.user?.toString();
      if (userId) {
        io.to(`user:${userId}`).emit('order:itemReady', payload);
        io.to(`user:${userId}`).emit('order-update', payload);
        if (becameFullyReady) {
          io.to(`user:${userId}`).emit('order:statusChanged', payload);
        }
      }

      const summary = await getKitchenSummary();
      io.to('kitchen').emit('kitchen:summary', summary);
    }

    res.json({
      success: true,
      message: `${itemName} marked ready`,
      order: populatedOrder,
      queueStats,
    });
  } catch (error) {
    console.error('Mark order item ready error:', error);
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
    const etaUpdates = await recalculateAllETAs();
    const stock = await buildKitchenStockSummary();

    if (req.app.get('socketHandlers')) {
      const handlers = req.app.get('socketHandlers');
      handlers.notifyAllETAUpdates(etaUpdates);
      handlers.notifyQueueStats();
    }

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
      // Avg prep time in minutes (actualCompletionTime is stored as duration in ms)
      Order.aggregate([
        { $match: { status: 'completed', actualCompletionTime: { $ne: null }, createdAt: { $gte: today, $lt: tomorrow } } },
        {
          $project: {
            prepDuration: {
              $divide: ['$actualCompletionTime', 60000],
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
