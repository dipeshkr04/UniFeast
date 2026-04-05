/**
 * UniFeast Queue Engine — M/M/c Queueing Model for ETA Calculation
 * 
 * This implements the Erlang-C formula for multi-server queueing systems.
 * 
 * Parameters:
 *   λ (lambda) = arrival rate (orders per minute)
 *   μ (mu)     = service rate per server (orders per minute per station)
 *   c          = number of active kitchen stations
 *   ρ          = λ / (c * μ)  — server utilization (must be < 1 for stability)
 * 
 * Key formulas:
 *   P₀ = [Σ(k=0 to c-1) (a^k/k!) + (a^c/c!) * (1/(1-ρ))]^(-1)
 *   where a = λ/μ
 * 
 *   C(c,a) = (a^c/c!) * P₀ / (1-ρ)   — Erlang-C probability
 *   Wq = C(c,a) / (c*μ - λ)          — expected wait in queue
 *   W  = Wq + 1/μ                     — total expected time in system
 */

const Order = require('../models/Order');

// ─── Math Helpers ───────────────────────────────────

function factorial(n) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// ─── Arrival Rate Calculation ───────────────────────

/**
 * Calculate arrival rate λ (orders per minute) from recent order history
 * Uses a sliding window of the last `windowMinutes` minutes
 */
async function calculateArrivalRate(windowMinutes = 30) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const count = await Order.countDocuments({
    createdAt: { $gte: windowStart },
    status: { $nin: ['cancelled'] },
  });

  // λ = orders / time window (in minutes)
  const lambda = count / windowMinutes;
  
  // Return at least a small value to avoid division by zero
  return Math.max(lambda, 0.1);
}

// ─── Service Rate Calculation ───────────────────────

/**
 * Calculate service rate μ (orders per minute per station)
 * Based on item prep time
 */
function calculateServiceRate(prepTimeMinutes) {
  // μ = 1 / average service time
  return 1 / Math.max(prepTimeMinutes, 1);
}

// ─── P₀ Calculation (Probability of empty system) ──

/**
 * Calculate P₀ using summation method (exact, for low traffic)
 */
function calculateP0Summation(a, c, rho) {
  let sum = 0;
  
  // Summation: Σ(k=0 to c-1) (a^k / k!)
  for (let k = 0; k < c; k++) {
    sum += Math.pow(a, k) / factorial(k);
  }
  
  // Add the last term: (a^c / c!) * (1 / (1 - ρ))
  const lastTerm = (Math.pow(a, c) / factorial(c)) * (1 / (1 - rho));
  sum += lastTerm;
  
  return 1 / sum;
}

/**
 * Calculate P₀ using averaging method (approximate, for peak traffic)
 * Uses Stirling's approximation for large factorials
 */
function calculateP0Averaging(a, c, rho) {
  // For high traffic, use a simplified approximation
  // that's more numerically stable
  const utilization = rho;
  
  // Approximate P₀ ≈ (1 - ρ) for high utilization
  // More accurate: use the Jagerman approximation
  const approxP0 = (1 - rho) * (1 + rho) / (1 + 2 * rho);
  return Math.max(approxP0, 0.001);
}

// ─── Erlang-C Formula ───────────────────────────────

/**
 * Calculate Erlang-C probability C(c, a)
 * This is the probability that an arriving customer has to wait
 */
function erlangC(c, a, rho, p0) {
  if (rho >= 1) return 1; // System is overloaded
  
  const numerator = (Math.pow(a, c) / factorial(c)) * (1 / (1 - rho));
  return numerator * p0;
}

// ─── Main ETA Calculator ────────────────────────────

/**
 * Calculate ETA for an order
 * 
 * @param {number} itemPrepTime - Average prep time of items in minutes
 * @param {number} activeStations - Number of active kitchen stations (c)
 * @param {number} currentPendingOrders - Number of orders currently in queue
 * @returns {object} { eta, waitTime, serviceTime, utilization, method }
 */
async function calculateETA(itemPrepTime, activeStations = 3, currentPendingOrders = null) {
  const c = Math.max(activeStations, 1);
  const mu = calculateServiceRate(itemPrepTime);
  const lambda = await calculateArrivalRate();
  
  // a = λ/μ (offered load)
  const a = lambda / mu;
  
  // ρ = λ / (c * μ) (server utilization)
  const rho = lambda / (c * mu);
  
  let p0, method;
  
  if (rho >= 1) {
    // System is overloaded — use a simple estimate
    const queuePosition = currentPendingOrders || await getPendingOrderCount();
    const eta = (queuePosition / c) * itemPrepTime + itemPrepTime;
    return {
      eta: Math.round(eta),
      waitTime: Math.round((queuePosition / c) * itemPrepTime),
      serviceTime: itemPrepTime,
      utilization: rho,
      method: 'overloaded',
      arrivalRate: lambda,
      serviceRate: mu,
    };
  }
  
  // Traffic-aware P₀ calculation
  if (rho < 0.7) {
    // Low traffic → exact summation method
    p0 = calculateP0Summation(a, c, rho);
    method = 'summation';
  } else {
    // Peak traffic → averaging method  
    p0 = calculateP0Averaging(a, c, rho);
    method = 'averaging';
  }
  
  // Erlang-C probability
  const ec = erlangC(c, a, rho, p0);
  
  // Wq = C(c,a) / (c*μ - λ) — expected wait time in queue (minutes)
  const wq = ec / (c * mu - lambda);
  
  // W = Wq + 1/μ — total expected time in system (minutes)
  const w = wq + (1 / mu);
  
  // Add buffer for practical purposes (min 1 minute)
  const eta = Math.max(Math.round(w), 1);
  
  return {
    eta,
    waitTime: Math.round(wq * 100) / 100,
    serviceTime: itemPrepTime,
    utilization: Math.round(rho * 1000) / 1000,
    method,
    erlangC: Math.round(ec * 1000) / 1000,
    arrivalRate: Math.round(lambda * 100) / 100,
    serviceRate: Math.round(mu * 100) / 100,
    p0: Math.round(p0 * 10000) / 10000,
  };
}

// ─── Helpers ────────────────────────────────────────

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

  const updates = [];
  
  for (let i = 0; i < activeOrders.length; i++) {
    const order = activeOrders[i];
    
    // Calculate average prep time for this order's items
    const avgPrepTime = order.items.reduce((sum, item) => {
      const prepTime = item.menuItem?.prepTime || 10;
      return sum + prepTime * item.quantity;
    }, 0) / Math.max(order.items.reduce((sum, item) => sum + item.quantity, 0), 1);
    
    const etaResult = await calculateETA(avgPrepTime, activeStations, i);
    
    order.estimatedTime = etaResult.eta;
    order.estimatedReadyAt = new Date(Date.now() + etaResult.eta * 60 * 1000);
    await order.save();
    
    updates.push({
      orderId: order._id,
      userId: order.user,
      eta: etaResult.eta,
      estimatedReadyAt: order.estimatedReadyAt,
      ...etaResult,
    });
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
