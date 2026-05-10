const CartReservation = require('../models/CartReservation');
const MenuItem = require('../models/MenuItem');
const Settings = require('../models/Settings');
const {
  getStockDayKey,
  hasNumericStock,
  resetExpiredDailyStocks,
  reserveDailyStock,
} = require('./dailyStock');

const DEFAULT_CART_HOLD_MS = 2 * 60 * 1000;

function getEnvCartHoldMs(overrideMs) {
  const parsed = Number(overrideMs || process.env.CART_HOLD_MS || process.env.VITE_CART_HOLD_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CART_HOLD_MS;
}

async function getCartHoldMs(overrideMs) {
  if (overrideMs) return getEnvCartHoldMs(overrideMs);
  return Settings.getCartHoldMs();
}

function normalizeHoldQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0) {
    const error = new Error('Cart quantity must be a whole number');
    error.statusCode = 400;
    throw error;
  }
  return quantity;
}

function notifyStockChanged(io, payload = {}) {
  if (io) {
    io.emit('menu:stockChanged', { cartReservation: true, ...payload });
  }
}

async function releaseReservations(reservations = [], io) {
  if (!reservations.length) return;
  const dayKey = getStockDayKey();
  const released = [];

  for (const reservation of reservations) {
    const deleted = await CartReservation.findOneAndDelete({ _id: reservation._id });
    if (deleted) released.push(deleted);
  }

  const activeDayReservations = released.filter((reservation) => reservation.dayKey === dayKey);
  if (activeDayReservations.length) {
    await MenuItem.bulkWrite(activeDayReservations.map((reservation) => ({
      updateOne: {
        filter: { _id: reservation.menuItem, 'dailyStock.dayKey': dayKey },
        update: { $inc: { 'dailyStock.quantity': Number(reservation.quantity || 0) } },
      },
    })));
  }

  if (released.length) {
    notifyStockChanged(io, { released: true });
  }
}

async function releaseExpiredCartReservations(io) {
  const expired = await CartReservation.find({ expiresAt: { $lte: new Date() } });
  await releaseReservations(expired, io);
  return expired.length;
}

async function setCartReservation({ userId, menuItemId, quantity, holdMs: requestedHoldMs, io }) {
  await resetExpiredDailyStocks();
  await releaseExpiredCartReservations(io);

  const nextQuantity = normalizeHoldQuantity(quantity);
  const dayKey = getStockDayKey();
  const existing = await CartReservation.findOne({ user: userId, menuItem: menuItemId });

  if (nextQuantity === 0) {
    if (existing) {
      await releaseReservations([existing], io);
    }
    return { reservation: null, menuItem: null, holdMs: await getCartHoldMs(requestedHoldMs) };
  }

  const currentHeld = existing && existing.dayKey === dayKey && existing.expiresAt > new Date()
    ? Number(existing.quantity || 0)
    : 0;
  const delta = nextQuantity - currentHeld;

  if (existing && (existing.dayKey !== dayKey || existing.expiresAt <= new Date())) {
    await CartReservation.deleteOne({ _id: existing._id });
  }

  if (delta > 0) {
    const current = await MenuItem.findById(menuItemId).select('name dailyStock isAvailable maxOrder');
    if (!current) {
      const error = new Error('Menu item not found');
      error.statusCode = 404;
      throw error;
    }
    if (!current.isAvailable) {
      const error = new Error(`${current.name} is currently unavailable`);
      error.statusCode = 400;
      throw error;
    }
    const maxOrder = Number(current.maxOrder || 15);
    if (nextQuantity > maxOrder) {
      const error = new Error(`Maximum ${maxOrder} ${current.name} can be ordered at once`);
      error.statusCode = 400;
      throw error;
    }

    const availableStock = current.dailyStock?.dayKey === dayKey && hasNumericStock(current.dailyStock?.quantity)
      ? Number(current.dailyStock.quantity)
      : 0;
    if (availableStock < delta) {
      const error = new Error(availableStock === 0 ? `${current.name} is sold out for today` : `Only ${availableStock} ${current.name} left today`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await MenuItem.findOneAndUpdate(
      {
        _id: menuItemId,
        isAvailable: true,
        'dailyStock.dayKey': dayKey,
        'dailyStock.quantity': { $gte: delta },
      },
      { $inc: { 'dailyStock.quantity': -delta } },
      { new: true }
    );

    if (!updated) {
      const error = new Error(`${current.name} stock changed. Please try again.`);
      error.statusCode = 409;
      throw error;
    }
  } else if (delta < 0) {
    await MenuItem.updateOne(
      { _id: menuItemId, 'dailyStock.dayKey': dayKey },
      { $inc: { 'dailyStock.quantity': Math.abs(delta) } }
    );
  }

  const holdMs = await getCartHoldMs(requestedHoldMs);
  const expiresAt = new Date(Date.now() + holdMs);
  const reservation = await CartReservation.findOneAndUpdate(
    { user: userId, menuItem: menuItemId },
    {
      $set: { quantity: nextQuantity, dayKey, expiresAt },
      $setOnInsert: { user: userId, menuItem: menuItemId },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  const menuItem = await MenuItem.findById(menuItemId);

  notifyStockChanged(io, { menuItemId: menuItemId.toString(), dailyStock: menuItem?.dailyStock || null });
  return { reservation, menuItem, holdMs };
}

async function releaseUserCartReservation(userId, menuItemId, io) {
  await releaseExpiredCartReservations(io);
  const reservation = await CartReservation.findOne({ user: userId, menuItem: menuItemId });
  if (reservation) {
    await releaseReservations([reservation], io);
  }
}

async function releaseUserCartReservations(userId, io) {
  await releaseExpiredCartReservations(io);
  const reservations = await CartReservation.find({ user: userId });
  await releaseReservations(reservations, io);
}

async function validateOrderStockWithCartReservations(userId, orderItems, io) {
  await resetExpiredDailyStocks();
  await releaseExpiredCartReservations(io);

  const directReserved = [];
  const heldReservations = [];

  try {
    for (const item of orderItems) {
      const quantity = Number(item.quantity || 1);
      const reservation = await CartReservation.findOne({ user: userId, menuItem: item.menuItem });
      const heldQuantity = reservation && reservation.dayKey === getStockDayKey() && reservation.expiresAt > new Date()
        ? Number(reservation.quantity || 0)
        : 0;

      if (heldQuantity > 0) {
        heldReservations.push(reservation);
      }

      if (heldQuantity < quantity) {
        const extraReserved = await reserveDailyStock([{
          menuItem: item.menuItem,
          quantity: quantity - heldQuantity,
        }]);
        directReserved.push(...extraReserved);
      }
    }

    return { directReserved, heldReservations };
  } catch (error) {
    if (directReserved.length) {
      const dayKey = getStockDayKey();
      await MenuItem.bulkWrite(directReserved.map((reserved) => ({
        updateOne: {
          filter: { _id: reserved.menuItem, 'dailyStock.dayKey': dayKey },
          update: { $inc: { 'dailyStock.quantity': Number(reserved.quantity || 0) } },
        },
      })));
    }
    throw error;
  }
}

async function consumeCartReservations(reservations = [], io) {
  if (!reservations.length) return;
  await CartReservation.deleteMany({ _id: { $in: reservations.map((reservation) => reservation._id) } });
  notifyStockChanged(io, { consumed: true });
}

function startCartReservationCleanup(io) {
  releaseExpiredCartReservations(io).catch((error) => {
    console.error('Cart reservation startup cleanup error:', error.message);
  });

  setInterval(() => {
    releaseExpiredCartReservations(io).catch((error) => {
      console.error('Cart reservation cleanup error:', error.message);
    });
  }, 10 * 1000);
}

module.exports = {
  getCartHoldMs,
  setCartReservation,
  releaseUserCartReservation,
  releaseUserCartReservations,
  releaseExpiredCartReservations,
  validateOrderStockWithCartReservations,
  consumeCartReservations,
  startCartReservationCleanup,
};
