const Pool = require('../models/Pool');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { findOrCreatePool, joinPool, closePool, getActivePools } = require('../utils/poolEngine');
const { calculateETA } = require('../utils/queueEngine');
const {
  resetExpiredDailyStocks,
  reserveDailyStock,
  releaseDailyStock,
} = require('../utils/dailyStock');
const { buildUserSnapshot } = require('../utils/userSnapshot');
const { normalizeImageUrl } = require('../utils/imageUrl');

// @desc    Get active pools
// @route   GET /api/pools
exports.getActivePools = async (req, res) => {
  try {
    const pools = await getActivePools();
    res.json({ success: true, count: pools.length, data: pools });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pool details
// @route   GET /api/pools/:id
exports.getPoolDetails = async (req, res) => {
  try {
    const pool = await Pool.findById(req.params.id)
      .populate('menuItem', 'name price imageUrl prepTime nutrition')
      .populate('members.user', 'name email');

    if (!pool) {
      return res.status(404).json({ success: false, message: 'Pool not found' });
    }

    const costSplit = pool.getCostSplit();

    res.json({ success: true, data: { ...pool.toObject(), costSplit } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create or find pool for item and join
// @route   POST /api/pools/join
exports.joinOrCreatePool = async (req, res) => {
  let reservedStock = [];
  let orderPersisted = false;
  try {
    const { menuItemId } = req.body;
    const quantity = Number(req.body.quantity || 1);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive whole number' });
    }

    await resetExpiredDailyStocks();

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    if (!menuItem.isAvailable) {
      return res.status(400).json({ success: false, message: `${menuItem.name} is currently unavailable` });
    }

    reservedStock = await reserveDailyStock([{ menuItem: menuItem._id, quantity }]);

    // Find or create pool
    const { pool, isNew } = await findOrCreatePool(menuItemId, menuItem.price);

    // Join the pool
    const updatedPool = await joinPool(pool._id, req.user.id, quantity);

    // Create individual order linked to pool
    const etaResult = await calculateETA(menuItem.prepTime);
    const order = await Order.create({
      user: req.user.id,
      userSnapshot: buildUserSnapshot(req.user),
      items: [{
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        imageUrl: normalizeImageUrl(menuItem.imageUrl),
        quantity,
        poolId: pool._id,
      }],
      totalAmount: menuItem.price * quantity,
      isPooled: true,
      estimatedTime: etaResult.eta,
      estimatedReadyAt: new Date(Date.now() + etaResult.eta * 60 * 1000),
      statusHistory: [{ status: 'pending', timestamp: new Date() }],
    });
    orderPersisted = true;

    // Update pool member's order reference
    const memberIndex = updatedPool.members.findIndex(
      m => m.user.toString() === req.user.id
    );
    if (memberIndex !== -1) {
      updatedPool.members[memberIndex].order = order._id;
      await updatedPool.save();
    }

    const populatedPool = await Pool.findById(updatedPool._id)
      .populate('menuItem', 'name price imageUrl prepTime')
      .populate('members.user', 'name email');

    const costSplit = populatedPool.getCostSplit();

    // Socket notification
    if (req.app.get('socketHandlers')) {
      const handlers = req.app.get('socketHandlers');
      handlers.notifyPoolUpdate({
        poolId: pool._id,
        currentSize: updatedPool.currentSize,
        totalQuantity: updatedPool.totalQuantity,
        status: updatedPool.status,
        savingsPercent: updatedPool.savingsPercent,
        isNew,
      });
      handlers.notifyNewOrder(order);
    }
    if (reservedStock.length && req.app.get('io')) {
      req.app.get('io').emit('menu:stockChanged', { updated: true });
    }

    res.status(201).json({
      success: true,
      data: {
        pool: { ...populatedPool.toObject(), costSplit },
        order,
        isNewPool: isNew,
      },
    });
  } catch (error) {
    if (reservedStock.length && !orderPersisted) {
      await releaseDailyStock(reservedStock).catch((releaseError) => {
        console.error('Daily stock release error:', releaseError.message);
      });
    }
    console.error('Join pool error:', error);
    res.status(error.statusCode || error.status || 500).json({ success: false, message: error.message });
  }
};

// @desc    Check if pool exists for item
// @route   GET /api/pools/check/:menuItemId
exports.checkPoolForItem = async (req, res) => {
  try {
    const pool = await Pool.findOne({
      menuItem: req.params.menuItemId,
      status: 'open',
      closesAt: { $gt: new Date() },
    })
      .populate('menuItem', 'name price imageUrl')
      .populate('members.user', 'name');

    if (!pool) {
      return res.json({ success: true, hasPool: false, data: null });
    }

    const costSplit = pool.getCostSplit();
    const timeLeft = Math.max(0, Math.round((pool.closesAt - new Date()) / 1000));

    res.json({
      success: true,
      hasPool: true,
      data: {
        ...pool.toObject(),
        costSplit,
        timeLeftSeconds: timeLeft,
        spotsLeft: pool.maxSize - pool.currentSize,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manually close a pool
// @route   PATCH /api/pools/:id/close
exports.closePoolManually = async (req, res) => {
  try {
    const pool = await closePool(req.params.id);
    if (!pool) {
      return res.status(404).json({ success: false, message: 'Pool not found or already closed' });
    }

    if (req.app.get('socketHandlers')) {
      req.app.get('socketHandlers').notifyPoolUpdate({
        poolId: pool._id,
        status: 'queued',
        message: 'Pool manually closed',
      });
    }

    res.json({ success: true, data: pool });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
