const OutsideFoodRestaurant = require('../models/OutsideFoodRestaurant');
const OutsideFoodPool = require('../models/OutsideFoodPool');
const OutsideFoodChatMessage = require('../models/OutsideFoodChatMessage');
const {
  OUTSIDE_FOOD_LOBBY_ROOM,
  getOutsideFoodRoomName,
  outsideFoodError,
  parsePositiveAmount,
  parseDateValue,
  normalizeStringList,
  serializePool,
  serializeMessage,
  createRoomMessage,
  emitPoolState,
  joinOutsideFoodPool,
  assertRoomAccess,
  sendTextMessage,
  updateOutsideFoodPoolStatus,
  volunteerAsCoordinator,
  expireDueOutsideFoodPools,
  buildRestaurantPayload,
} = require('../services/outsideFood.service');

function handleOutsideFoodError(res, error) {
  const status = error.statusCode || error.status || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Outside food request failed',
  });
}

function restaurantPayloadFromBody(body = {}) {
  return {
    name: body.name,
    image: body.image || '',
    cuisineTags: normalizeStringList(body.cuisineTags),
    minPoolAmount: parsePositiveAmount(body.minPoolAmount, 'Minimum pool amount'),
    estimatedDeliveryTime: body.estimatedDeliveryTime || '45-60 min',
    contactNumber: body.contactNumber || '',
    menuLink: body.menuLink || '',
    whatsappLink: body.whatsappLink || '',
    pickupPoints: normalizeStringList(body.pickupPoints),
    active: body.active === undefined ? true : String(body.active).toLowerCase() !== 'false',
  };
}

exports.getRestaurants = async (req, res) => {
  try {
    const includeInactive = req.user.role === 'admin' && req.query.includeInactive === 'true';
    const filter = includeInactive ? {} : { active: true };
    const restaurants = await OutsideFoodRestaurant.find(filter).sort({ active: -1, name: 1 });
    const revealContacts = req.user.role === 'admin';
    res.json({
      success: true,
      count: restaurants.length,
      data: restaurants.map((restaurant) => buildRestaurantPayload(restaurant, revealContacts)),
    });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const payload = restaurantPayloadFromBody(req.body);
    payload.createdByAdmin = req.user._id;
    const restaurant = await OutsideFoodRestaurant.create(payload);
    res.status(201).json({ success: true, data: buildRestaurantPayload(restaurant, true) });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const existing = await OutsideFoodRestaurant.findById(req.params.id);
    if (!existing) throw outsideFoodError('Restaurant not found', 404);

    const updates = {};
    const fields = ['name', 'image', 'estimatedDeliveryTime', 'contactNumber', 'menuLink', 'whatsappLink'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (req.body.cuisineTags !== undefined) updates.cuisineTags = normalizeStringList(req.body.cuisineTags);
    if (req.body.pickupPoints !== undefined) updates.pickupPoints = normalizeStringList(req.body.pickupPoints);
    if (req.body.minPoolAmount !== undefined) {
      updates.minPoolAmount = parsePositiveAmount(req.body.minPoolAmount, 'Minimum pool amount');
    }
    if (req.body.active !== undefined) updates.active = String(req.body.active).toLowerCase() !== 'false';

    const restaurant = await OutsideFoodRestaurant.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: buildRestaurantPayload(restaurant, true) });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.getPools = async (req, res) => {
  try {
    await expireDueOutsideFoodPools(req.app.get('io'));

    const isAdmin = req.user.role === 'admin';
    const filter = {};

    if (!isAdmin || req.query.scope !== 'admin') {
      filter.archived = false;
      filter.status = { $in: ['OPEN', 'UNLOCKED'] };
    } else if (req.query.includeArchived !== 'true') {
      filter.archived = false;
    }

    if (req.query.status) {
      filter.status = String(req.query.status).toUpperCase();
    }

    const pools = await OutsideFoodPool.find(filter)
      .populate('restaurantId')
      .sort({ status: 1, opensAt: 1, closesAt: 1 });

    const data = await Promise.all(pools.map((pool) => serializePool(pool, req.user._id, req.user.role)));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.createPool = async (req, res) => {
  try {
    const restaurant = await OutsideFoodRestaurant.findById(req.body.restaurantId);
    if (!restaurant) throw outsideFoodError('Restaurant not found', 404);
    if (!restaurant.active) throw outsideFoodError('Cannot create a pool for an inactive restaurant');

    const opensAt = parseDateValue(req.body.opensAt, new Date());
    const durationMinutes = Number(req.body.durationMinutes || 20);
    const closesAt = parseDateValue(
      req.body.closesAt,
      new Date(opensAt.getTime() + Math.max(5, durationMinutes) * 60 * 1000)
    );

    if (closesAt <= opensAt) {
      throw outsideFoodError('Pool close time must be after open time');
    }

    const targetAmount = req.body.targetAmount !== undefined
      ? parsePositiveAmount(req.body.targetAmount, 'Target amount')
      : restaurant.minPoolAmount;
    const pickupPoint = String(req.body.pickupPoint || restaurant.pickupPoints?.[0] || '').trim();
    if (!pickupPoint) throw outsideFoodError('Pickup point is required');

    const pool = await OutsideFoodPool.create({
      restaurantId: restaurant._id,
      title: req.body.title || `${restaurant.name} Pool`,
      targetAmount,
      currentAmount: 0,
      participantCount: 0,
      participants: [],
      opensAt,
      closesAt,
      pickupPoint,
      status: 'OPEN',
      archived: false,
      createdByAdmin: req.user._id,
    });

    await createRoomMessage({
      poolId: pool._id,
      type: 'SYSTEM',
      content: `${pool.title} room created`,
      io: req.app.get('io'),
    });
    await emitPoolState(req.app.get('io'), pool._id, 'pool:update');

    res.status(201).json({
      success: true,
      data: await serializePool(await OutsideFoodPool.findById(pool._id).populate('restaurantId'), req.user._id, req.user.role),
    });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.getPoolDetails = async (req, res) => {
  try {
    await expireDueOutsideFoodPools(req.app.get('io'));
    const pool = await OutsideFoodPool.findById(req.params.poolId).populate('restaurantId');
    if (!pool) throw outsideFoodError('Outside food pool not found', 404);

    res.json({
      success: true,
      data: await serializePool(pool, req.user._id, req.user.role),
    });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.joinPool = async (req, res) => {
  try {
    const result = await joinOutsideFoodPool({
      poolId: req.params.poolId,
      user: req.user,
      intendedAmount: req.body.intendedAmount,
      orderPreview: req.body.orderPreview,
      io: req.app.get('io'),
    });

    res.status(201).json({ success: true, data: result.pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    await assertRoomAccess(req.params.poolId, req.user);
    const messages = await OutsideFoodChatMessage.find({ poolId: req.params.poolId })
      .populate('senderId', 'name email')
      .sort({ timestamp: 1 })
      .limit(200);

    const data = await Promise.all(messages.map(serializeMessage));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.sendChatMessage = async (req, res) => {
  try {
    const message = await sendTextMessage({
      poolId: req.params.poolId,
      user: req.user,
      content: req.body.content,
      io: req.app.get('io'),
    });
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.updatePoolStatus = async (req, res) => {
  try {
    const pool = await updateOutsideFoodPoolStatus({
      poolId: req.params.poolId,
      user: req.user,
      status: req.body.status,
      statusMessage: req.body.statusMessage,
      io: req.app.get('io'),
    });
    res.json({ success: true, data: pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.archivePool = async (req, res) => {
  try {
    const pool = await updateOutsideFoodPoolStatus({
      poolId: req.params.poolId,
      user: req.user,
      status: 'ARCHIVED',
      statusMessage: 'Pool archived',
      io: req.app.get('io'),
    });
    res.json({ success: true, data: pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.volunteerCoordinator = async (req, res) => {
  try {
    const pool = await volunteerAsCoordinator({
      poolId: req.params.poolId,
      user: req.user,
      io: req.app.get('io'),
    });
    res.json({ success: true, data: pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.getSocketInfo = async (req, res) => {
  res.json({
    success: true,
    data: {
      lobbyRoom: OUTSIDE_FOOD_LOBBY_ROOM,
      roomPattern: 'pool:<poolId>',
      exampleRoom: getOutsideFoodRoomName('example-pool-id'),
      events: [
        'pool:join',
        'pool:leave',
        'pool:update',
        'pool:message',
        'pool:unlock',
        'pool:lock',
        'pool:coordinator-update',
        'pool:grace-timer',
        'pool:status-update',
        'pool:status',
        'pool:participant-update',
      ],
    },
  });
};
