/**
 * Pool Engine — Collaborative Order Pooling Logic
 * 
 * Pool Lifecycle:
 * 1. Student orders an item → check for active pool on that item
 * 2. If pool exists (status: 'open') → show join option
 * 3. Student joins → acquire lock → add member → release lock
 * 4. Pool closes when: timer (5 min) expires OR maxSize (10) reached
 * 5. On close: status → 'queued', consolidated order created
 * 6. Cost is split with discounts based on pool size
 */

const Pool = require('../models/Pool');
const Order = require('../models/Order');
const lockManager = require('../config/lockManager');

const POOL_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_POOL_SIZE = 10;

/**
 * Find or create a pool for a menu item
 */
async function findOrCreatePool(menuItemId, pricePerUnit) {
  // Check for existing open pool
  let pool = await Pool.findOne({
    menuItem: menuItemId,
    status: 'open',
    closesAt: { $gt: new Date() },
  });

  if (pool) {
    return { pool, isNew: false };
  }

  // Create new pool
  pool = await Pool.create({
    menuItem: menuItemId,
    pricePerUnit,
    closesAt: new Date(Date.now() + POOL_WINDOW_MS),
    maxSize: MAX_POOL_SIZE,
  });

  // Register in lock manager
  lockManager.setActivePool(menuItemId.toString(), pool._id.toString());

  return { pool, isNew: true };
}

/**
 * Join a pool with concurrency safety
 */
async function joinPool(poolId, userId, quantity = 1) {
  const lockKey = `pool:${poolId}:join`;
  
  // Acquire lock
  const acquired = await lockManager.acquireLock(lockKey, 3000);
  if (!acquired) {
    throw new Error('Pool is busy, please try again');
  }

  try {
    const pool = await Pool.findById(poolId);
    
    if (!pool) {
      throw new Error('Pool not found');
    }
    
    if (pool.status !== 'open') {
      throw new Error('Pool is no longer accepting members');
    }
    
    if (new Date() > pool.closesAt) {
      throw new Error('Pool window has expired');
    }
    
    // Check if user already in pool
    const existingMember = pool.members.find(
      m => m.user.toString() === userId.toString()
    );
    if (existingMember) {
      throw new Error('You are already in this pool');
    }
    
    if (pool.currentSize >= pool.maxSize) {
      throw new Error('Pool is full');
    }

    // Add member
    pool.members.push({ user: userId, quantity });
    pool.currentSize = pool.members.length;
    pool.totalQuantity += quantity;
    
    // Calculate savings
    pool.savingsPercent = Math.min(pool.members.length * 2, 15);
    
    await pool.save();

    // Auto-close if max size reached
    if (pool.currentSize >= pool.maxSize) {
      await closePool(pool._id);
    }

    return pool;
  } finally {
    lockManager.releaseLock(lockKey);
  }
}

/**
 * Close a pool and create consolidated order
 */
async function closePool(poolId) {
  const pool = await Pool.findById(poolId).populate('menuItem');
  
  if (!pool || pool.status !== 'open') {
    return null;
  }

  pool.status = 'queued';
  pool.closedAt = new Date();
  
  // Remove from active pools cache
  lockManager.removeActivePool(pool.menuItem._id.toString());
  
  await pool.save();
  return pool;
}

/**
 * Get active pools for display
 */
async function getActivePools() {
  const pools = await Pool.find({
    status: 'open',
    closesAt: { $gt: new Date() },
  })
    .populate('menuItem', 'name price imageUrl prepTime batchCapacity batchPrepTime batchBufferMinutes')
    .populate('members.user', 'name email')
    .sort({ createdAt: -1 });

  return pools;
}

/**
 * Check and close expired pools
 * Should be run periodically (e.g., every 30 seconds)
 */
async function checkExpiredPools() {
  const expiredPools = await Pool.find({
    status: 'open',
    closesAt: { $lte: new Date() },
  });

  const results = [];
  for (const pool of expiredPools) {
    const closed = await closePool(pool._id);
    if (closed) results.push(closed);
  }

  return results;
}

// Start periodic pool cleanup
let cleanupInterval = null;
function startPoolCleanup(io) {
  cleanupInterval = setInterval(async () => {
    try {
      const closed = await checkExpiredPools();
      if (closed.length > 0 && io) {
        closed.forEach(pool => {
          io.emit('pool-update', {
            poolId: pool._id,
            status: 'queued',
            message: 'Pool window expired, order queued',
          });
        });
      }
    } catch (err) {
      console.error('Pool cleanup error:', err.message);
    }
  }, 30000); // Every 30 seconds
}

function stopPoolCleanup() {
  if (cleanupInterval) clearInterval(cleanupInterval);
}

module.exports = {
  findOrCreatePool,
  joinPool,
  closePool,
  getActivePools,
  checkExpiredPools,
  startPoolCleanup,
  stopPoolCleanup,
  POOL_WINDOW_MS,
  MAX_POOL_SIZE,
};
