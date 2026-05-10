const Order = require('../models/Order');
const KitchenStock = require('../models/KitchenStock');
const NutritionLog = require('../models/NutritionLog');
const { validateTransition } = require('../middleware/orderStateMachine');
const { recalculateQueueETAs, getKitchenSummary } = require('../services/queueService');
const lockManager = require('../config/lockManager');

const redisClient = lockManager.client;

function toRedisKey(key) {
  return `idempotency:${key}`;
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

function getOrderItemQuantity(item) {
  const quantity = Number(item?.quantity || 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

async function autoLogNutrition(order) {
  try {
    const populatedOrder = await Order.findById(order._id).populate('items.menuItem');
    const dateStr = new Date().toISOString().split('T')[0];
    let log = await NutritionLog.findOne({ user: order.user, date: dateStr });

    if (!log) {
      log = new NutritionLog({ user: order.user, date: dateStr, meals: [] });
    }

    for (const item of populatedOrder.items) {
      if (item.menuItem?.nutrition) {
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

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { newStatus, idempotencyKey, wasteReason } = req.body;
  const io = req.app.get('io');
  const isAdmin = req.user && req.user.role === 'admin';
  const requestedStatus = String(newStatus || '').toLowerCase();

  try {
    if (!requestedStatus) {
      return res.status(400).json({ error: 'newStatus is required' });
    }

    if (idempotencyKey && redisClient?.get) {
      const cached = await redisClient.get(toRedisKey(idempotencyKey));
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    }

    const currentOrder = await Order.findById(id);
    if (!currentOrder) return res.status(404).json({ error: 'Order not found' });

    const transition = validateTransition(currentOrder.status, requestedStatus, isAdmin);
    if (!transition.valid) {
      return res.status(400).json({ error: transition.error, currentStatus: currentOrder.status, attemptedStatus: requestedStatus });
    }

    if (transition.requiresWasteLog && !wasteReason) {
      return res.status(400).json({ error: 'wasteReason is required when cancelling a preparing order' });
    }

    const now = new Date();
    const timestamps = {};
    if (requestedStatus === 'preparing') timestamps.startedAt = now;
    if (requestedStatus === 'ready') timestamps.preparedAt = now;
    if (requestedStatus === 'completed') {
      timestamps.completedAt = now;
      const preparingStartedAt =
        currentOrder.startedAt ||
        currentOrder.statusHistory.find((h) => h.status === 'preparing')?.timestamp ||
        currentOrder.createdAt;
      timestamps.actualCompletionTime = now.getTime() - new Date(preparingStartedAt).getTime();
    }

    const updateDoc = {
      $set: { status: requestedStatus, ...timestamps },
      $push: { statusHistory: { status: requestedStatus, timestamp: now } },
      $inc: { __v: 1 },
    };

    if (requestedStatus === 'completed') {
      currentOrder.items.forEach((item, index) => {
        updateDoc.$set[`items.${index}.assignedReadyQty`] = getOrderItemQuantity(item);
      });
    }
    if (['completed', 'cancelled'].includes(requestedStatus)) {
      updateDoc.$set.qrTokenHash = null;
      updateDoc.$set.qrTokenLookup = null;
      updateDoc.$set.qrIssuedAt = null;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, status: currentOrder.status, __v: currentOrder.__v },
      updateDoc,
      { new: true }
    ).populate('user', 'name email _id').populate('items.menuItem', 'name imageUrl');

    if (!updatedOrder) {
      return res.status(409).json({ error: 'Concurrent modification — retry' });
    }

    if (redisClient?.zadd && requestedStatus === 'queued') {
      await redisClient.zadd('kitchen:queue', Date.now(), updatedOrder._id.toString());
    }
    if (redisClient?.zrem && ['preparing', 'completed', 'cancelled'].includes(requestedStatus)) {
      await redisClient.zrem('kitchen:queue', updatedOrder._id.toString());
    }

    if (requestedStatus === 'completed') {
      await consumeMadeStockForCompletedOrder(updatedOrder);
      await autoLogNutrition(updatedOrder);
    }

    if (io) {
      const notifyMessage =
        requestedStatus === 'ready'
          ? 'Your order is ready for pickup ✅'
          : requestedStatus === 'completed'
            ? 'Your order pickup is confirmed 🎉'
            : null;

      const payload = {
        orderId: updatedOrder._id.toString(),
        status: requestedStatus,
        newStatus: requestedStatus,
        estimatedReadyAt: updatedOrder.estimatedReadyAt,
        order: updatedOrder,
        notification: notifyMessage,
      };

      io.to('kitchen').emit('order:statusChanged', payload);

      const userId = updatedOrder.user?._id?.toString() || currentOrder.user?.toString();
      if (userId) {
        io.to(`user:${userId}`).emit('order:statusChanged', payload);
        io.to(`user:${userId}`).emit('order-update', payload);
      }

      const summary = await getKitchenSummary();
      io.to('kitchen').emit('kitchen:summary', summary);
    }

    const queueStats = await recalculateQueueETAs(io);
    const responsePayload = { order: updatedOrder, queueStats };

    if (idempotencyKey && redisClient?.setex) {
      await redisClient.setex(toRedisKey(idempotencyKey), 30, JSON.stringify(responsePayload));
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Status Update Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};

