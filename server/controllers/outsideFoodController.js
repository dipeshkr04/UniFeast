const OutsideFoodRestaurant = require('../models/OutsideFoodRestaurant');
const OutsideFoodPool = require('../models/OutsideFoodPool');
const OutsideFoodChatMessage = require('../models/OutsideFoodChatMessage');
const {
  OUTSIDE_FOOD_LOBBY_ROOM,
  VISIBLE_POOL_STATUSES,
  getOutsideFoodRoomName,
  outsideFoodError,
  parsePositiveAmount,
  normalizeStringList,
  serializePool,
  serializeMessage,
  createStudentPool,
  joinOutsideFoodPool,
  createJoinRequest,
  resolveJoinRequest,
  leaveOutsideFoodPool,
  kickPoolParticipant,
  assertRoomAccess,
  sendTextMessage,
  updateOutsideFoodPoolStatus,
  postPoolStatusUpdate,
  volunteerAsCoordinator,
  expireDueOutsideFoodPools,
  buildRestaurantPayload,
} = require('../services/outsideFood.service');

function handleOutsideFoodError(res, error) {
  const status = error.statusCode || error.status || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Pool request failed',
  });
}

function restaurantPayloadFromBody(body = {}) {
  return {
    name: body.name,
    image: '',
    cuisineTags: [],
    minPoolAmount: body.minPoolAmount === undefined
      ? 700
      : parsePositiveAmount(body.minPoolAmount, 'Minimum pool amount'),
    estimatedDeliveryTime: '',
    orderWindow: body.orderWindow || '1:00 PM - 7:30 PM',
    location: body.location || '',
    contactNumber: body.contactNumber || '',
    menuLink: body.menuLink || '',
    whatsappLink: '',
    pickupPoints: [],
    active: body.active === undefined ? true : String(body.active).toLowerCase() !== 'false',
  };
}

exports.getRestaurants = async (req, res) => {
  try {
    const includeInactive = req.user.role === 'admin' && req.query.includeInactive === 'true';
    const filter = includeInactive ? {} : { active: true };
    const restaurants = await OutsideFoodRestaurant.find(filter).sort({ active: -1, name: 1 });
    res.json({
      success: true,
      count: restaurants.length,
      data: restaurants.map((restaurant) => buildRestaurantPayload(restaurant)),
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
    res.status(201).json({ success: true, data: buildRestaurantPayload(restaurant) });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const existing = await OutsideFoodRestaurant.findById(req.params.id);
    if (!existing) throw outsideFoodError('Restaurant not found', 404);

    const updates = {};
    const fields = ['name', 'orderWindow', 'location', 'contactNumber', 'menuLink'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (req.body.minPoolAmount !== undefined) {
      updates.minPoolAmount = parsePositiveAmount(req.body.minPoolAmount, 'Minimum pool amount');
    }
    if (req.body.active !== undefined) updates.active = String(req.body.active).toLowerCase() !== 'false';

    const restaurant = await OutsideFoodRestaurant.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: buildRestaurantPayload(restaurant) });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await OutsideFoodRestaurant.findByIdAndDelete(req.params.id);
    if (!restaurant) throw outsideFoodError('Restaurant not found', 404);

    res.json({
      success: true,
      data: buildRestaurantPayload(restaurant),
      message: 'Restaurant deleted',
    });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.getPools = async (req, res) => {
  try {
    await expireDueOutsideFoodPools(req.app.get('io'));

    const filter = { archived: false };
    if (req.user.role !== 'admin' || req.query.scope !== 'admin') {
      filter.status = { $in: VISIBLE_POOL_STATUSES };
    }
    if (req.query.status) {
      filter.status = String(req.query.status).toUpperCase();
    }
    if (req.query.category) {
      filter.category = String(req.query.category).toLowerCase();
    }

    const pools = await OutsideFoodPool.find(filter)
      .populate('restaurantId')
      .populate('broadcaster', 'name email')
      .sort({ status: 1, updatedAt: -1, createdAt: -1 });

    const data = await Promise.all(pools.map((pool) => serializePool(pool, req.user._id, req.user.role)));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.createPool = async (req, res) => {
  try {
    const pool = await createStudentPool({
      user: req.user,
      category: req.body.category,
      title: req.body.title || req.body.name,
      targetAmount: req.body.targetAmount || req.body.poolValue,
      io: req.app.get('io'),
    });

    res.status(201).json({ success: true, data: pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.getPoolDetails = async (req, res) => {
  try {
    await expireDueOutsideFoodPools(req.app.get('io'));
    const pool = await OutsideFoodPool.findById(req.params.poolId)
      .populate('restaurantId')
      .populate('broadcaster', 'name email');
    if (!pool) throw outsideFoodError('Pool not found', 404);

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

exports.createJoinRequest = async (req, res) => {
  try {
    const pool = await createJoinRequest({
      poolId: req.params.poolId,
      user: req.user,
      intendedAmount: req.body.intendedAmount,
      orderPreview: req.body.orderPreview,
      io: req.app.get('io'),
    });

    res.status(201).json({ success: true, data: pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.resolveJoinRequest = async (req, res) => {
  try {
    const pool = await resolveJoinRequest({
      poolId: req.params.poolId,
      requestId: req.params.requestId,
      user: req.user,
      action: req.body.action,
      io: req.app.get('io'),
    });

    res.json({ success: true, data: pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.leavePool = async (req, res) => {
  try {
    const pool = await leaveOutsideFoodPool({
      poolId: req.params.poolId,
      user: req.user,
      io: req.app.get('io'),
    });

    res.json({ success: true, data: pool });
  } catch (error) {
    handleOutsideFoodError(res, error);
  }
};

exports.kickParticipant = async (req, res) => {
  try {
    const pool = await kickPoolParticipant({
      poolId: req.params.poolId,
      participantUserId: req.params.userId,
      user: req.user,
      io: req.app.get('io'),
    });

    res.json({ success: true, data: pool });
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

exports.sendBroadcastMessage = async (req, res) => {
  try {
    const message = await postPoolStatusUpdate({
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
        'pool:lock',
        'pool:request-update',
        'pool:status-update',
        'pool:status',
        'pool:participant-update',
        'pool:kicked',
        'pool:expired',
      ],
    },
  });
};
