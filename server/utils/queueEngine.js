const Order = require('../models/Order');

const ACTIVE_QUEUE_STATUSES = ['queued', 'preparing'];
const DEFAULT_PREP_MINUTES = 10;
const DEFAULT_ARRIVAL_WINDOW_MINUTES = 30;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function wholeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function getActiveStations(fallback = 3) {
  return Math.max(1, wholeNumber(process.env.KITCHEN_ACTIVE_STATIONS || process.env.KITCHEN_STATIONS, fallback));
}

async function calculateArrivalRate(windowMinutes = DEFAULT_ARRIVAL_WINDOW_MINUTES) {
  const minutes = wholeNumber(windowMinutes, DEFAULT_ARRIVAL_WINDOW_MINUTES);
  const windowStart = new Date(Date.now() - minutes * 60 * 1000);

  const count = await Order.countDocuments({
    createdAt: { $gte: windowStart },
    status: { $nin: ['cancelled'] },
  });

  return count / minutes;
}

function getLineQuantity(item) {
  const quantity = Number(item?.quantity || 0);
  return Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 1;
}

function getAssignedReadyQuantity(item) {
  const quantity = getLineQuantity(item);
  const assignedReadyQty = Number(item?.assignedReadyQty || 0);
  return Math.min(Number.isFinite(assignedReadyQty) ? assignedReadyQty : 0, quantity);
}

function getRemainingQuantity(item) {
  return Math.max(0, getLineQuantity(item) - getAssignedReadyQuantity(item));
}

function getBasePrepMinutes(item) {
  return Math.max(1, positiveNumber(item?.prepTime ?? item?.menuItem?.prepTime, DEFAULT_PREP_MINUTES));
}

function getBatchCapacity(item) {
  return Math.max(1, wholeNumber(item?.batchCapacity ?? item?.menuItem?.batchCapacity, 1));
}

function getBatchPrepMinutes(item) {
  return Math.max(1, positiveNumber(item?.batchPrepTime ?? item?.menuItem?.batchPrepTime, getBasePrepMinutes(item)));
}

function getBatchBufferMinutes(item) {
  return Math.max(0, nonNegativeNumber(item?.batchBufferMinutes ?? item?.menuItem?.batchBufferMinutes, 0));
}

function calculateLineBucketWorkMinutes(item, options = {}) {
  const quantity = Math.max(0, wholeNumber(options.quantity ?? getRemainingQuantity(item), 0));
  if (quantity <= 0) return 0;

  const capacity = getBatchCapacity(item);
  const batches = Math.max(1, Math.ceil(quantity / capacity));
  const prepMinutes = getBatchPrepMinutes(item);
  const bufferMinutes = getBatchBufferMinutes(item);

  return (batches * prepMinutes) + (Math.max(0, batches - 1) * bufferMinutes);
}

function getLineBucketDetails(item, options = {}) {
  const quantity = Math.max(0, wholeNumber(options.quantity ?? getRemainingQuantity(item), 0));
  const capacity = getBatchCapacity(item);
  const batches = quantity > 0 ? Math.max(1, Math.ceil(quantity / capacity)) : 0;
  const bucketPrepMinutes = getBatchPrepMinutes(item);
  const bucketBufferMinutes = getBatchBufferMinutes(item);

  return {
    menuItemId: item?.menuItem?._id?.toString() || item?.menuItem?.toString() || item?._id?.toString() || null,
    name: item?.menuItem?.name || item?.name || 'Item',
    quantity,
    bucketCapacity: capacity,
    bucketPrepMinutes,
    bucketBufferMinutes,
    batches,
    workMinutes: calculateLineBucketWorkMinutes(item, { quantity }),
  };
}

function calculateOrderWorkMinutes(order) {
  const items = order?.items || [];
  const work = items.reduce((total, item) => total + calculateLineBucketWorkMinutes(item), 0);
  return Math.max(1, work);
}

function getOrderBucketDetails(order) {
  return (order?.items || [])
    .map((item) => getLineBucketDetails(item))
    .filter((detail) => detail.quantity > 0);
}

function estimateRemainingOrderWorkMinutes(order, orderWorkMinutes = null) {
  const workMinutes = Math.max(1, orderWorkMinutes ?? calculateOrderWorkMinutes(order));

  if (order?.status !== 'preparing' || !order.startedAt) {
    return workMinutes;
  }

  const startedAtMs = new Date(order.startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return workMinutes;

  const elapsedMinutes = Math.max(0, (Date.now() - startedAtMs) / 60000);
  return Math.max(0.5, workMinutes - elapsedMinutes);
}

async function getActiveQueueOrders() {
  return Order.find({
    status: { $in: ACTIVE_QUEUE_STATUSES },
  }).populate('items.menuItem').sort({ createdAt: 1 });
}

async function calculateIncomingOrderETA(orderLike) {
  const activeOrders = await getActiveQueueOrders();

  const activeWork = activeOrders.map((order) => {
    const orderWorkMinutes = calculateOrderWorkMinutes(order);
    return {
      order,
      orderWorkMinutes,
      remainingWorkMinutes: estimateRemainingOrderWorkMinutes(order, orderWorkMinutes),
    };
  });

  const workloadAhead = activeWork.reduce((total, entry) => total + entry.remainingWorkMinutes, 0);
  const serviceMinutes = calculateOrderWorkMinutes(orderLike);
  const eta = Math.max(1, Math.ceil(workloadAhead + serviceMinutes));

  return {
    eta,
    waitTime: Math.round(workloadAhead * 100) / 100,
    serviceTime: Math.round(serviceMinutes * 100) / 100,
    serviceMinutes: Math.round(serviceMinutes * 100) / 100,
    workloadAhead: Math.round(workloadAhead * 100) / 100,
    itemBuckets: getOrderBucketDetails(orderLike),
    queuePosition: activeOrders.filter((order) => order.status === 'queued').length + 1,
    method: 'bucket-fcfs-snapshot',
  };
}

async function getPendingOrderCount() {
  return Order.countDocuments({
    status: { $in: ['pending', ...ACTIVE_QUEUE_STATUSES] },
  });
}

async function recalculateAllETAs() {
  const activeOrders = await getActiveQueueOrders();
  if (!activeOrders.length) return [];

  const updates = [];
  let backlogWorkMinutes = 0;

  for (let i = 0; i < activeOrders.length; i += 1) {
    const order = activeOrders[i];
    const orderWorkMinutes = calculateOrderWorkMinutes(order);
    const remainingWorkMinutes = estimateRemainingOrderWorkMinutes(order, orderWorkMinutes);
    const eta = Math.max(1, Math.ceil(backlogWorkMinutes + remainingWorkMinutes));

    order.estimatedTime = eta;
    order.estimatedReadyAt = new Date(Date.now() + eta * 60 * 1000);
    await order.save();

    updates.push({
      orderId: order._id,
      userId: order.user,
      estimatedReadyAt: order.estimatedReadyAt,
      queuePosition: i + 1,
      serviceMinutes: Math.round(orderWorkMinutes * 100) / 100,
      remainingServiceMinutes: Math.round(remainingWorkMinutes * 100) / 100,
      waitTime: Math.round(backlogWorkMinutes * 100) / 100,
      workloadAhead: Math.round(backlogWorkMinutes * 100) / 100,
      eta,
      itemBuckets: getOrderBucketDetails(order),
      method: 'bucket-fcfs-recalculation',
    });

    backlogWorkMinutes += remainingWorkMinutes;
  }

  return updates;
}

async function getQueueStats() {
  const [pendingCount, preparingCount, queuedCount, lambda, activeOrders] = await Promise.all([
    Order.countDocuments({ status: 'pending' }),
    Order.countDocuments({ status: 'preparing' }),
    Order.countDocuments({ status: 'queued' }),
    calculateArrivalRate(),
    getActiveQueueOrders(),
  ]);

  const totalBucketWorkMinutes = activeOrders.reduce((total, order) => {
    const orderWorkMinutes = calculateOrderWorkMinutes(order);
    return total + estimateRemainingOrderWorkMinutes(order, orderWorkMinutes);
  }, 0);
  const activeQueueCount = preparingCount + queuedCount;
  const averageBucketWorkMinutes = activeQueueCount > 0 ? totalBucketWorkMinutes / activeQueueCount : DEFAULT_PREP_MINUTES;

  return {
    pendingOrders: pendingCount,
    preparingOrders: preparingCount,
    queuedOrders: queuedCount,
    totalActive: pendingCount + preparingCount + queuedCount,
    arrivalRate: Math.round(lambda * 1000) / 1000,
    averageBucketWorkMinutes: Math.round(averageBucketWorkMinutes * 100) / 100,
    activeBucketWorkMinutes: Math.round(totalBucketWorkMinutes * 100) / 100,
    method: 'bucket-arithmetic',
  };
}

module.exports = {
  calculateIncomingOrderETA,
  recalculateAllETAs,
  calculateArrivalRate,
  getPendingOrderCount,
  getQueueStats,
  getActiveStations,
  calculateLineBucketWorkMinutes,
  calculateOrderWorkMinutes,
};
