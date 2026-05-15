const Order = require('../models/Order');
const { recalculateAllETAs, getQueueStats } = require('../utils/queueEngine');

exports.recalculateQueueETAs = async (io) => {
  const updates = await recalculateAllETAs();

  if (io && updates.length > 0) {
    updates.forEach((update) => {
      io.to(`user:${update.userId}`).emit('eta-update', {
        orderId: update.orderId,
        eta: update.eta,
        estimatedTime: update.eta,
        estimatedReadyAt: update.estimatedReadyAt,
      });
    });

    io.to('kitchen').emit('queue:etasBulkUpdated', updates.map((u) => ({
      orderId: u.orderId,
      newETA: u.eta,
      estimatedReadyAt: u.estimatedReadyAt,
      queuePosition: u.queuePosition ?? null,
    })));
  }

  return getQueueStats();
};

exports.getKitchenSummary = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [counts, queueStats] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay },
          status: { $in: ['pending', 'queued', 'preparing', 'ready', 'completed', 'cancelled'] },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    getQueueStats(),
  ]);

  const raw = { pending: 0, queued: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 };
  counts.forEach(({ _id, count }) => {
    if (Object.prototype.hasOwnProperty.call(raw, _id)) raw[_id] = count;
  });

  return {
    PENDING: raw.pending,
    QUEUED: raw.queued,
    PREPARING: raw.preparing,
    READY: raw.ready,
    COMPLETED: raw.completed,
    CANCELLED: raw.cancelled,
    totalActive: raw.pending + raw.queued + raw.preparing + raw.ready,
    queueStats,
  };
};

