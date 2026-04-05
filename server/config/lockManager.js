// In-memory lock manager as Redis alternative
// Provides distributed-lock-like semantics for order pooling

class LockManager {
  constructor() {
    this.locks = new Map();
    this.poolCache = new Map();
  }

  async acquireLock(key, ttlMs = 5000) {
    if (this.locks.has(key)) {
      const lock = this.locks.get(key);
      if (Date.now() < lock.expiresAt) {
        return false; // Lock is held
      }
      // Lock expired, allow acquisition
    }
    this.locks.set(key, {
      expiresAt: Date.now() + ttlMs,
      holder: Math.random().toString(36).substr(2, 9),
    });
    return true;
  }

  releaseLock(key) {
    this.locks.delete(key);
  }

  setActivePool(menuItemId, poolId) {
    this.poolCache.set(`pool:${menuItemId}:active`, poolId);
  }

  getActivePool(menuItemId) {
    return this.poolCache.get(`pool:${menuItemId}:active`) || null;
  }

  removeActivePool(menuItemId) {
    this.poolCache.delete(`pool:${menuItemId}:active`);
  }

  // Cleanup expired locks periodically
  startCleanup(intervalMs = 10000) {
    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, lock] of this.locks.entries()) {
        if (now >= lock.expiresAt) {
          this.locks.delete(key);
        }
      }
    }, intervalMs);
  }

  stopCleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
  }
}

// Singleton instance
const lockManager = new LockManager();
lockManager.startCleanup();

module.exports = lockManager;
