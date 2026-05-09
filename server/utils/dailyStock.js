const MenuItem = require('../models/MenuItem');

const RESET_HOUR = 4;
let lastResetDayKey = '';
let resetInterval = null;

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function stockError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getStockDayKey(date = new Date()) {
  const adjusted = new Date(date);
  if (adjusted.getHours() < RESET_HOUR) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return toLocalDateKey(adjusted);
}

function normalizeStockValue(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'string' && !value.trim()) return 0;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw stockError('Avl. Stock must be a whole number');
  }

  return parsed;
}

function hasNumericStock(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

function getDisplayStock(menuItem) {
  if (!menuItem?.dailyStock || menuItem.dailyStock.dayKey !== getStockDayKey()) {
    return 0;
  }
  return hasNumericStock(menuItem.dailyStock.quantity)
    ? Number(menuItem.dailyStock.quantity)
    : 0;
}

async function resetExpiredDailyStocks() {
  const dayKey = getStockDayKey();
  const result = await MenuItem.updateMany(
    {
      $or: [
        { 'dailyStock.dayKey': { $ne: dayKey } },
        { 'dailyStock.quantity': null },
        { 'dailyStock.quantity': { $exists: false } },
      ],
    },
    {
      $set: {
        'dailyStock.quantity': 0,
        'dailyStock.dayKey': dayKey,
      },
    }
  );

  return result.modifiedCount || result.nModified || 0;
}

async function setDailyStock(menuItemId, value) {
  const quantity = normalizeStockValue(value);
  const item = await MenuItem.findByIdAndUpdate(
    menuItemId,
    {
      $set: {
        'dailyStock.quantity': quantity,
        'dailyStock.dayKey': getStockDayKey(),
      },
    },
    { new: true, runValidators: true }
  );

  return item;
}

async function reserveDailyStock(orderItems) {
  const reserved = [];
  const dayKey = getStockDayKey();

  try {
    for (const item of orderItems) {
      const quantity = Number(item.quantity || 1);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw stockError('Order quantity must be a positive whole number');
      }

      const current = await MenuItem.findById(item.menuItem).select('name dailyStock isAvailable');
      if (!current) {
        throw stockError(`Menu item ${item.menuItem} not found`, 404);
      }
      if (!current.isAvailable) {
        throw stockError(`${current.name} is currently unavailable`);
      }

      const availableStock = current.dailyStock?.dayKey === dayKey && hasNumericStock(current.dailyStock?.quantity)
        ? Number(current.dailyStock.quantity)
        : 0;

      if (availableStock < quantity) {
        throw stockError(`${current.name} has only ${availableStock} left today`);
      }

      const updated = await MenuItem.findOneAndUpdate(
        {
          _id: current._id,
          isAvailable: true,
          'dailyStock.dayKey': dayKey,
          'dailyStock.quantity': { $gte: quantity },
        },
        { $inc: { 'dailyStock.quantity': -quantity } },
        { new: true }
      );

      if (!updated) {
        throw stockError(`${current.name} has only ${availableStock} left today`);
      }

      reserved.push({ menuItem: current._id, quantity });
    }

    return reserved;
  } catch (error) {
    if (reserved.length) {
      await MenuItem.bulkWrite(reserved.map((item) => ({
        updateOne: {
          filter: { _id: item.menuItem, 'dailyStock.dayKey': dayKey },
          update: { $inc: { 'dailyStock.quantity': item.quantity } },
        },
      })));
    }
    throw error;
  }
}

async function releaseDailyStock(reserved = []) {
  if (!reserved.length) return;
  const dayKey = getStockDayKey();
  await MenuItem.bulkWrite(reserved.map((item) => ({
    updateOne: {
      filter: { _id: item.menuItem, 'dailyStock.dayKey': dayKey },
      update: { $inc: { 'dailyStock.quantity': Number(item.quantity || 0) } },
    },
  })));
}

function startDailyStockReset(io) {
  if (resetInterval) return;
  lastResetDayKey = getStockDayKey();

  resetExpiredDailyStocks()
    .then((modifiedCount) => {
      if (modifiedCount > 0 && io) {
        io.emit('menu:stockChanged', { reset: true });
      }
    })
    .catch((error) => {
      console.error('Daily stock startup reset error:', error.message);
    });

  resetInterval = setInterval(async () => {
    const dayKey = getStockDayKey();
    if (dayKey === lastResetDayKey) return;

    lastResetDayKey = dayKey;
    try {
      const modifiedCount = await resetExpiredDailyStocks();
      if (modifiedCount > 0 && io) {
        io.emit('menu:stockChanged', { reset: true });
      }
    } catch (error) {
      console.error('Daily stock reset error:', error.message);
    }
  }, 60 * 1000);
}

module.exports = {
  getStockDayKey,
  getDisplayStock,
  normalizeStockValue,
  hasNumericStock,
  resetExpiredDailyStocks,
  setDailyStock,
  reserveDailyStock,
  releaseDailyStock,
  startDailyStockReset,
};
