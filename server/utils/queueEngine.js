/**
 * UniFeast Queue Engine
 *
 * Student-facing ETA is a strict FCFS workload estimate:
 * ETA = unfinished work ahead + this order's remaining prep work.
 *
 * Item quantity matters. Example: 2 parathas at 10 min each = 20 min.
 * If another 1 paratha order is behind it, that second order gets 30 min.
 */

const Order = require('../models/Order');

// Math helpers

function factorial(n) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// Arrival-rate helpers

/**
 * Calculate arrival rate Î» (orders per minute) from recent order history
 * Uses a sliding window of the last `windowMinutes` minutes
 */
async function calculateArrivalRate(windowMinutes = 30) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const count = await Order.countDocuments({
    createdAt: { $gte: windowStart },
    status: { $nin: ['cancelled'] },
  });

  // Î» = orders / time window (in minutes)
  const lambda = count / windowMinutes;
  
  // Return at least a small value to avoid division by zero
  return Math.max(lambda, 0.1);
}

// Service-rate helpers

/**
 * Calculate service rate Î¼ (orders per minute per station)
 * Based on item prep time
 */
function calculateServiceRate(prepTimeMinutes) {
  // Î¼ = 1 / average service time
  return 1 / Math.max(prepTimeMinutes, 1);
}

// Legacy Erlang-C helpers retained for queue metrics

/**
 * Calculate Pâ‚€ using summation method (exact, for low traffic)
 */
function calculateP0Summation(a, c, rho) {
  let sum = 0;
  
  // Summation: Î£(k=0 to c-1) (a^k / k!)
  for (let k = 0; k < c; k++) {
    sum += Math.pow(a, k) / factorial(k);
  }
  
  // Add the last term: (a^c / c!) * (1 / (1 - Ï))
  const lastTerm = (Math.pow(a, c) / factorial(c)) * (1 / (1 - rho));
  sum += lastTerm;
  
  return 1 / sum;
}

/**
 * Calculate Pâ‚€ using averaging method (approximate, for peak traffic)
 * Uses Stirling's approximation for large factorials
 */
function calculateP0Averaging(a, c, rho) {
  // For high traffic, use a simplified approximation
  // that's more numerically stable
  const utilization = rho;
  
  // Approximate Pâ‚€ â‰ˆ (1 - Ï) for high utilization
  // More accurate: use the Jagerman approximation
  const approxP0 = (1 - rho) * (1 + rho) / (1 + 2 * rho);
  return Math.max(approxP0, 0.001);
}

// Erlang-C probability helper

/**
 * Calculate Erlang-C probability C(c, a)
 * This is the probability that an arriving customer has to wait
 */
function erlangC(c, a, rho, p0) {
  if (rho >= 1) return 1; // System is overloaded
  
  const numerator = (Math.pow(a, c) / factorial(c)) * (1 / (1 - rho));
  return numerator * p0;
}

// Main ETA calculator

/**
 * Calculate ETA for an order
 * 
 * @param {number} itemPrepTime - Average prep time of items in minutes
 * @param {number} activeStations - Number of active kitchen stations (c)
 * @param {number} currentPendingOrders - Number of orders currently in queue
 * @returns {object} { eta, waitTime, serviceTime, utilization, method }
 */
async function calculateETA(itemPrepTime, activeStations = 3, currentPendingOrders = null) {
  const serviceTime = Math.max(Number(itemPrepTime || 0), 1);
  const lambda = await calculateArrivalRate();
  const eta = Math.max(Math.round(serviceTime), 1);

  return {
    eta,
    waitTime: 0,
    serviceTime,
    utilization: 0,
    method: 'strict-workload',
    erlangC: 0,
    arrivalRate: Math.round(lambda * 100) / 100,
    serviceRate: Math.round((1 / serviceTime) * 100) / 100,
    p0: 1,
  };
}

// Helpers

async function getPendingOrderCount() {
  return await Order.countDocuments({
    status: { $in: ['pending', 'queued', 'preparing'] },
  });
}

/**
 * Recalculate ETAs for all active orders
 * Should be called when an order status changes (especially to 'ready')
 */
async function recalculateAllETAs(activeStations = 3) {
  const activeOrders = await Order.find({
    status: { $in: ['pending', 'queued', 'preparing'] },
  }).populate('items.menuItem').sort({ createdAt: 1 });

  const stations = Math.max(activeStations, 1);
  const estimateOrderServiceMinutes = (order) => {
    // Queue-aware workload: only unfinished item quantities contribute to ETA.
    const total = (order.items || []).reduce((sum, item) => {
      const prepTime = Number(item.menuItem?.prepTime || 10);
      const qty = Number(item.quantity || 1);
      const readyQty = Math.min(Number(item.assignedReadyQty || 0), qty);
      const remainingQty = Math.max(0, qty - readyQty);
      return sum + prepTime * remainingQty;
    }, 0);
    return Math.max(1, total);
  };
  const estimateRemainingMinutes = (order, serviceMinutes) => {
    if (order.status !== 'preparing' || !order.startedAt) return serviceMinutes;
    const elapsedMinutes = (Date.now() - new Date(order.startedAt).getTime()) / 60000;
    return Math.max(0, serviceMinutes - elapsedMinutes);
  };

  const updates = [];
  let backlogWorkMinutes = 0;
  
  for (let i = 0; i < activeOrders.length; i++) {
    const order = activeOrders[i];

    const orderServiceMinutes = estimateOrderServiceMinutes(order);
    const remainingServiceMinutes = estimateRemainingMinutes(order, orderServiceMinutes);
    const etaResult = await calculateETA(remainingServiceMinutes, stations, i);

    // Strict FCFS cumulative delay for student-facing ETA:
    // every order waits for total workload ahead in the queue.
    const queueDelayMinutes = backlogWorkMinutes;
    const queueAwareEta = Math.max(
      1,
      Math.ceil(queueDelayMinutes + remainingServiceMinutes)
    );

    order.estimatedTime = queueAwareEta;
    order.estimatedReadyAt = new Date(Date.now() + queueAwareEta * 60 * 1000);
    await order.save();
    
    updates.push({
      orderId: order._id,
      userId: order.user,
      estimatedReadyAt: order.estimatedReadyAt,
      queuePosition: i + 1,
      serviceMinutes: orderServiceMinutes,
      remainingServiceMinutes,
      ...etaResult,
      eta: queueAwareEta,
    });

    backlogWorkMinutes += remainingServiceMinutes;
  }
  
  return updates;
}

/**
 * Get current queue statistics
 */
async function getQueueStats(activeStations = 3) {
  const pendingCount = await Order.countDocuments({ status: 'pending' });
  const preparingCount = await Order.countDocuments({ status: 'preparing' });
  const queuedCount = await Order.countDocuments({ status: 'queued' });
  const lambda = await calculateArrivalRate();
  
  return {
    pendingOrders: pendingCount,
    preparingOrders: preparingCount,
    queuedOrders: queuedCount,
    totalActive: pendingCount + preparingCount + queuedCount,
    arrivalRate: Math.round(lambda * 100) / 100,
    activeStations,
  };
}

module.exports = {
  calculateETA,
  recalculateAllETAs,
  calculateArrivalRate,
  calculateServiceRate,
  getQueueStats,
  erlangC,
};

