// In-memory lock manager as Redis alternative
// Provides distributed-lock-like semantics for order pooling

class LockManager {
  constructor() {
    this.locks = new Map();
    this.poolCache = new Map();
    this.kv = new Map();
    this.zsets = new Map();
    this.client = {
      get: async (key) => {
        const entry = this.kv.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          this.kv.delete(key);
          return null;
        }
        return entry.value;
      },
      setex: async (key, ttlSec, value) => {
        this.kv.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
      },
      zadd: async (key, score, member) => {
        if (!this.zsets.has(key)) this.zsets.set(key, new Map());
        this.zsets.get(key).set(member, score);
      },
      zrem: async (key, member) => {
        const set = this.zsets.get(key);
        if (set) set.delete(member);
      },
    };
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
      for (const [key, entry] of this.kv.entries()) {
        if (entry.expiresAt && now >= entry.expiresAt) {
          this.kv.delete(key);
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
