const OutsideFoodRestaurant = require('../models/OutsideFoodRestaurant');
const OutsideFoodPool = require('../models/OutsideFoodPool');
const OutsideFoodParticipant = require('../models/OutsideFoodParticipant');
const OutsideFoodChatMessage = require('../models/OutsideFoodChatMessage');
const OutsideFoodJoinRequest = require('../models/OutsideFoodJoinRequest');

const OUTSIDE_FOOD_LOBBY_ROOM = 'outside-food:lobby';
const VISIBLE_POOL_STATUSES = ['OPEN', 'LOCKED'];
const POOL_TTL_MS = 2 * 24 * 60 * 60 * 1000;

function getOutsideFoodRoomName(poolId) {
  return `pool:${poolId}`;
}

function outsideFoodError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePositiveAmount(value, label = 'Amount') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw outsideFoodError(`${label} must be a positive number`);
  }
  return Math.round(amount);
}

function parseDateValue(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw outsideFoodError('Invalid date value');
  }
  return date;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeCategory(value) {
  const category = String(value || 'food').trim().toLowerCase();
  return OutsideFoodPool.categories.includes(category) ? category : 'others';
}

function idToString(value) {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
}

function isBroadcaster(pool, userOrId) {
  return idToString(pool?.broadcaster) === idToString(userOrId);
}

function isPoolExpired(pool) {
  return pool?.createdAt && Date.now() - new Date(pool.createdAt).getTime() > POOL_TTL_MS;
}

function canJoinPool(pool) {
  return (
    pool?.status === 'OPEN' &&
    !pool.archived &&
    !isPoolExpired(pool)
  );
}

function canRequestPool(pool) {
  return (
    pool?.status === 'LOCKED' &&
    !pool.archived &&
    !isPoolExpired(pool)
  );
}

function buildRestaurantPayload(restaurant) {
  if (!restaurant) return null;
  const raw = typeof restaurant.toObject === 'function' ? restaurant.toObject() : restaurant;
  return {
    _id: raw._id,
    name: raw.name,
    image: raw.image || '',
    cuisineTags: raw.cuisineTags || [],
    minPoolAmount: raw.minPoolAmount,
    estimatedDeliveryTime: raw.estimatedDeliveryTime || '',
    orderWindow: raw.orderWindow || '1:00 PM - 7:30 PM',
    location: raw.location || '',
    contactNumber: raw.contactNumber || '',
    menuLink: raw.menuLink || '',
    whatsappLink: raw.whatsappLink || '',
    pickupPoints: raw.pickupPoints || [],
    active: raw.active,
  };
}

function serializeUser(user) {
  if (!user) return null;
  return {
    _id: user._id || user,
    name: user.name || 'Student',
    email: user.email || '',
  };
}

function serializeParticipant(participant) {
  const raw = typeof participant.toObject === 'function' ? participant.toObject() : participant;
  const user = raw.userId || {};
  return {
    _id: raw._id,
    userId: user._id || raw.userId,
    name: user.name || 'Student',
    email: user.email || '',
    intendedAmount: raw.intendedAmount,
    orderPreview: raw.orderPreview || '',
    joinedAt: raw.joinedAt,
    messageCount: Number(raw.messageCount || 0),
    lastActiveAt: raw.lastActiveAt,
    online: Boolean(raw.online),
  };
}

function serializeJoinRequest(request) {
  const raw = typeof request.toObject === 'function' ? request.toObject() : request;
  const user = raw.userId || {};
  return {
    _id: raw._id,
    poolId: raw.poolId,
    userId: user._id || raw.userId,
    name: user.name || 'Student',
    email: user.email || '',
    intendedAmount: raw.intendedAmount,
    orderPreview: raw.orderPreview || '',
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

async function serializeMessage(message) {
  const populated = message.senderId?.name
    ? message
    : await OutsideFoodChatMessage.findById(message._id).populate('senderId', 'name email');
  const raw = typeof populated.toObject === 'function' ? populated.toObject() : populated;
  const sender = raw.senderId || {};

  return {
    _id: raw._id,
    poolId: raw.poolId,
    senderId: sender._id || raw.senderId || null,
    senderName: sender.name || '',
    senderEmail: sender.email || '',
    type: raw.type,
    content: raw.content,
    timestamp: raw.timestamp,
  };
}

async function serializePool(poolDoc, viewerUserId = null, viewerRole = '') {
  const pool = poolDoc?.broadcaster?.name
    ? poolDoc
    : await OutsideFoodPool.findById(poolDoc._id || poolDoc)
      .populate('restaurantId')
      .populate('broadcaster', 'name email');

  if (!pool) return null;

  const [participants, pendingRequests] = await Promise.all([
    OutsideFoodParticipant.find({ poolId: pool._id })
      .populate('userId', 'name email')
      .sort({ joinedAt: 1 }),
    OutsideFoodJoinRequest.find({ poolId: pool._id, status: 'PENDING' })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 }),
  ]);

  const participantRows = participants.map(serializeParticipant);
  const requestRows = pendingRequests.map(serializeJoinRequest);
  const viewerId = viewerUserId ? viewerUserId.toString() : '';
  const broadcasterId = idToString(pool.broadcaster);
  const viewerParticipant = viewerId
    ? participantRows.find((participant) => participant.userId?.toString() === viewerId)
    : null;
  const viewerPendingRequest = viewerId
    ? requestRows.find((request) => request.userId?.toString() === viewerId)
    : null;
  const isAdmin = viewerRole === 'admin';
  const isRoomBroadcast = viewerRole === 'room';
  const viewerIsBroadcaster = Boolean(viewerId && broadcasterId === viewerId);
  const canSeeRequests = isAdmin || viewerIsBroadcaster || isRoomBroadcast;
  const remainingAmount = Math.max(0, Number(pool.targetAmount || 0) - Number(pool.currentAmount || 0));
  const progressPercent = pool.targetAmount
    ? Math.min(100, Math.round((Number(pool.currentAmount || 0) / Number(pool.targetAmount || 1)) * 100))
    : 0;
  const recentCutoff = Date.now() - (5 * 60 * 1000);

  return {
    _id: pool._id,
    restaurantId: pool.restaurantId?._id || pool.restaurantId || null,
    restaurant: buildRestaurantPayload(pool.restaurantId),
    category: pool.category || 'food',
    title: pool.title,
    status: pool.status,
    targetAmount: pool.targetAmount,
    currentAmount: pool.currentAmount,
    participantCount: pool.participantCount,
    participants: participantRows,
    pendingRequests: canSeeRequests ? requestRows : [],
    pendingRequestCount: requestRows.length,
    broadcaster: serializeUser(pool.broadcaster),
    onlineCount: participantRows.filter((participant) => participant.online).length,
    recentlyJoinedCount: participantRows.filter((participant) => (
      new Date(participant.joinedAt).getTime() >= recentCutoff
    )).length,
    opensAt: pool.opensAt,
    closesAt: pool.closesAt,
    lockedAt: pool.lockedAt,
    archived: pool.archived,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    roomName: getOutsideFoodRoomName(pool._id),
    remainingAmount,
    progressPercent,
    isJoinable: canJoinPool(pool),
    isRequestable: canRequestPool(pool),
    isExpired: isPoolExpired(pool),
    viewer: {
      isParticipant: Boolean(viewerParticipant),
      isBroadcaster: viewerIsBroadcaster,
      isAdmin,
      pendingRequest: viewerPendingRequest || null,
      canJoin: Boolean(canJoinPool(pool) && !viewerParticipant && !viewerIsBroadcaster),
      canRequest: Boolean(canRequestPool(pool) && !viewerParticipant && !viewerIsBroadcaster && !viewerPendingRequest),
      canLock: Boolean(viewerIsBroadcaster && ['OPEN', 'LOCKED'].includes(pool.status)),
      canLeave: Boolean(viewerParticipant && !viewerIsBroadcaster),
    },
  };
}

async function createRoomMessage({ poolId, senderId = null, type = 'SYSTEM', content, io = null }) {
  const message = await OutsideFoodChatMessage.create({
    poolId,
    senderId,
    type,
    content,
    timestamp: new Date(),
  });
  const payload = await serializeMessage(message);

  if (io) {
    io.to(getOutsideFoodRoomName(poolId)).emit('pool:message', payload);
  }

  return payload;
}

async function getPoolParticipants(poolId) {
  return OutsideFoodParticipant.find({ poolId }).sort({ joinedAt: 1 });
}

async function syncPoolTotals(poolId) {
  const participants = await getPoolParticipants(poolId);
  const currentAmount = participants.reduce((sum, participant) => (
    sum + Number(participant.intendedAmount || 0)
  ), 0);
  const participantIds = participants.map((participant) => participant._id);
  const pool = await OutsideFoodPool.findById(poolId);

  if (!pool) {
    throw outsideFoodError('Pool not found', 404);
  }

  pool.currentAmount = currentAmount;
  pool.participantCount = participants.length;
  pool.participants = participantIds;
  await pool.save();
  return pool;
}

async function emitParticipantUpdate(io, poolId) {
  if (!io) return;
  const pool = await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email');
  if (!pool) return;
  const payload = await serializePool(pool, null, '');
  const summary = {
    poolId: pool._id,
    status: payload.status,
    participantCount: payload.participantCount,
    onlineCount: payload.onlineCount,
    recentlyJoinedCount: payload.recentlyJoinedCount,
    currentAmount: payload.currentAmount,
    targetAmount: payload.targetAmount,
    progressPercent: payload.progressPercent,
    remainingAmount: payload.remainingAmount,
    pendingRequestCount: payload.pendingRequestCount,
  };
  io.to(OUTSIDE_FOOD_LOBBY_ROOM).emit('pool:participant-update', summary);
  io.to(getOutsideFoodRoomName(poolId)).emit('pool:participant-update', summary);
}

async function emitPoolState(io, poolId, eventName = 'pool:update') {
  if (!io) return;
  const pool = await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email');
  if (!pool) return;

  const publicPayload = await serializePool(pool, null, '');
  const roomPayload = await serializePool(pool, null, 'room');

  io.to(OUTSIDE_FOOD_LOBBY_ROOM).emit(eventName, publicPayload);
  io.to(getOutsideFoodRoomName(poolId)).emit(eventName, roomPayload);
  await emitParticipantUpdate(io, poolId);
}

async function createStudentPool({ user, category, title, targetAmount, io = null }) {
  const poolTitle = String(title || '').trim();
  if (!poolTitle) throw outsideFoodError('Pool name is required');

  const amount = parsePositiveAmount(targetAmount, 'Pool value');
  const now = new Date();
  const pool = await OutsideFoodPool.create({
    category: normalizeCategory(category),
    title: poolTitle,
    targetAmount: amount,
    currentAmount: 0,
    participantCount: 0,
    participants: [],
    opensAt: now,
    closesAt: new Date(now.getTime() + POOL_TTL_MS),
    status: 'OPEN',
    archived: false,
    broadcaster: user._id,
  });

  await createRoomMessage({
    poolId: pool._id,
    senderId: user._id,
    type: 'SYSTEM',
    content: `${user.name} created the pool`,
    io,
  });
  await emitPoolState(io, pool._id, 'pool:update');

  return serializePool(
    await OutsideFoodPool.findById(pool._id).populate('restaurantId').populate('broadcaster', 'name email'),
    user._id,
    user.role
  );
}

async function joinOutsideFoodPool({ poolId, user, intendedAmount, orderPreview = '', io = null }) {
  const amount = parsePositiveAmount(intendedAmount, 'Contribution amount');
  const pool = await OutsideFoodPool.findById(poolId).populate('broadcaster', 'name email');

  if (!pool) throw outsideFoodError('Pool not found', 404);
  if (isBroadcaster(pool, user._id)) throw outsideFoodError('You are already the broadcaster of this pool');
  if (!canJoinPool(pool)) {
    throw outsideFoodError(pool.status === 'LOCKED'
      ? 'This pool is locked. Send a request to the broadcaster.'
      : 'This pool is no longer accepting members');
  }

  const existing = await OutsideFoodParticipant.findOne({ poolId, userId: user._id });
  const participant = await OutsideFoodParticipant.findOneAndUpdate(
    { poolId, userId: user._id },
    {
      $set: {
        intendedAmount: amount,
        orderPreview: String(orderPreview || '').trim(),
      },
      $setOnInsert: {
        joinedAt: new Date(),
        online: false,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await OutsideFoodJoinRequest.updateMany(
    { poolId, userId: user._id, status: 'PENDING' },
    { $set: { status: 'CANCELLED', resolvedAt: new Date(), resolvedBy: user._id } }
  );

  const updatedPool = await syncPoolTotals(poolId);
  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'SYSTEM',
    content: existing ? `${user.name} updated their contribution` : `${user.name} joined the pool`,
    io,
  });
  await emitPoolState(io, poolId, 'pool:update');

  return {
    participant,
    pool: await serializePool(
      await OutsideFoodPool.findById(updatedPool._id).populate('restaurantId').populate('broadcaster', 'name email'),
      user._id,
      user.role
    ),
  };
}

async function createJoinRequest({ poolId, user, intendedAmount, orderPreview = '', io = null }) {
  const amount = parsePositiveAmount(intendedAmount, 'Contribution amount');
  const preview = String(orderPreview || '').trim();
  if (!preview) throw outsideFoodError('Order note is required for a locked pool request');

  const pool = await OutsideFoodPool.findById(poolId).populate('broadcaster', 'name email');
  if (!pool) throw outsideFoodError('Pool not found', 404);
  if (isBroadcaster(pool, user._id)) throw outsideFoodError('Broadcasters cannot request to join their own pool');
  if (!canRequestPool(pool)) throw outsideFoodError('This pool is not accepting requests');

  const participant = await OutsideFoodParticipant.findOne({ poolId, userId: user._id });
  if (participant) throw outsideFoodError('You are already in this pool');

  const existing = await OutsideFoodJoinRequest.findOne({ poolId, userId: user._id, status: 'PENDING' });
  const request = await OutsideFoodJoinRequest.findOneAndUpdate(
    { poolId, userId: user._id, status: 'PENDING' },
    {
      $set: {
        intendedAmount: amount,
        orderPreview: preview,
      },
      $setOnInsert: {
        poolId,
        userId: user._id,
        status: 'PENDING',
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'SYSTEM',
    content: existing ? `${user.name} updated a join request` : `${user.name} requested to join`,
    io,
  });
  await emitPoolState(io, poolId, 'pool:request-update');

  return serializePool(
    await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email'),
    user._id,
    user.role
  );
}

async function resolveJoinRequest({ poolId, requestId, user, action, io = null }) {
  const requestedAction = String(action || '').toLowerCase();
  if (!['accept', 'reject'].includes(requestedAction)) {
    throw outsideFoodError('Request action must be accept or reject');
  }

  const pool = await OutsideFoodPool.findById(poolId).populate('broadcaster', 'name email');
  if (!pool) throw outsideFoodError('Pool not found', 404);
  if (!isBroadcaster(pool, user._id)) throw outsideFoodError('Only the broadcaster can manage join requests', 403);
  if (pool.archived || pool.status === 'ARCHIVED' || pool.status === 'COMPLETED') {
    throw outsideFoodError('This pool is closed');
  }

  const request = await OutsideFoodJoinRequest.findOne({ _id: requestId, poolId, status: 'PENDING' })
    .populate('userId', 'name email');
  if (!request) throw outsideFoodError('Join request not found', 404);

  request.status = requestedAction === 'accept' ? 'ACCEPTED' : 'REJECTED';
  request.resolvedAt = new Date();
  request.resolvedBy = user._id;
  await request.save();

  if (requestedAction === 'accept') {
    await OutsideFoodParticipant.findOneAndUpdate(
      { poolId, userId: request.userId._id || request.userId },
      {
        $set: {
          intendedAmount: request.intendedAmount,
          orderPreview: request.orderPreview,
        },
        $setOnInsert: {
          joinedAt: new Date(),
          online: false,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await syncPoolTotals(poolId);
  }

  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'SYSTEM',
    content: `${request.userId.name || 'Student'} request ${requestedAction === 'accept' ? 'accepted' : 'rejected'}`,
    io,
  });
  await emitPoolState(io, poolId, requestedAction === 'accept' ? 'pool:update' : 'pool:request-update');

  if (io) {
    const requesterId = idToString(request.userId);
    const requesterPool = await OutsideFoodPool.findById(poolId)
      .populate('restaurantId')
      .populate('broadcaster', 'name email');
    const requesterPayload = await serializePool(requesterPool, requesterId, 'student');
    io.to(`user:${requesterId}`).emit('pool:request-resolved', {
      action: requestedAction,
      pool: requesterPayload,
    });
  }

  return serializePool(
    await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email'),
    user._id,
    user.role
  );
}

async function leaveOutsideFoodPool({ poolId, user, io = null }) {
  const pool = await OutsideFoodPool.findById(poolId);
  if (!pool) throw outsideFoodError('Pool not found', 404);
  if (isBroadcaster(pool, user._id)) throw outsideFoodError('Broadcasters cannot leave their own pool');

  const deleted = await OutsideFoodParticipant.findOneAndDelete({ poolId, userId: user._id });
  if (!deleted) throw outsideFoodError('You are not a member of this pool', 404);

  await syncPoolTotals(poolId);
  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'SYSTEM',
    content: `${user.name} left the pool`,
    io,
  });
  await emitPoolState(io, poolId, 'pool:update');

  return serializePool(
    await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email'),
    user._id,
    user.role
  );
}

async function kickPoolParticipant({ poolId, participantUserId, user, io = null }) {
  const pool = await OutsideFoodPool.findById(poolId);
  if (!pool) throw outsideFoodError('Pool not found', 404);
  if (!isBroadcaster(pool, user._id)) throw outsideFoodError('Only the broadcaster can remove members', 403);
  if (idToString(participantUserId) === idToString(user._id)) throw outsideFoodError('Broadcasters cannot remove themselves');

  const deleted = await OutsideFoodParticipant.findOneAndDelete({ poolId, userId: participantUserId })
    .populate('userId', 'name email');
  if (!deleted) throw outsideFoodError('Pool member not found', 404);

  await syncPoolTotals(poolId);
  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'SYSTEM',
    content: `${deleted.userId?.name || 'A member'} was removed by the broadcaster`,
    io,
  });
  if (io) io.to(`user:${idToString(participantUserId)}`).emit('pool:kicked', { poolId });
  await emitPoolState(io, poolId, 'pool:update');

  return serializePool(
    await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email'),
    user._id,
    user.role
  );
}

async function setParticipantOnline(poolId, userId, online, io = null) {
  await OutsideFoodParticipant.updateOne(
    { poolId, userId },
    {
      $set: {
        online: Boolean(online),
        ...(online ? { lastActiveAt: new Date() } : {}),
      },
    }
  );
  await emitParticipantUpdate(io, poolId);
}

async function assertRoomAccess(poolId, user) {
  const pool = await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email');
  if (!pool) throw outsideFoodError('Pool not found', 404);
  if (user.role === 'admin') {
    return {
      pool,
      participant: null,
      isAdmin: true,
      isBroadcaster: false,
    };
  }

  const broadcaster = isBroadcaster(pool, user._id);
  const participant = await OutsideFoodParticipant.findOne({ poolId, userId: user._id });
  if (!broadcaster && !participant) {
    throw outsideFoodError('Join this pool before entering the room', 403);
  }

  return {
    pool,
    participant,
    isAdmin: false,
    isBroadcaster: broadcaster,
  };
}

async function sendTextMessage({ poolId, user, content, io = null }) {
  const text = String(content || '').trim();
  if (!text) throw outsideFoodError('Message cannot be empty');

  const access = await assertRoomAccess(poolId, user);
  if (access.pool.archived || access.pool.status === 'ARCHIVED') {
    throw outsideFoodError('This room is archived and no longer accepts messages');
  }
  if (access.participant) {
    await OutsideFoodParticipant.updateOne(
      { poolId, userId: user._id },
      {
        $inc: { messageCount: 1 },
        $set: { lastActiveAt: new Date() },
      }
    );
  }

  return createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'TEXT',
    content: text,
    io,
  });
}

async function updateOutsideFoodPoolStatus({ poolId, user, status, statusMessage = '', io = null }) {
  const requestedStatus = String(status || '').toUpperCase();
  if (!OutsideFoodPool.statuses.includes(requestedStatus)) {
    throw outsideFoodError('Invalid pool status');
  }

  const pool = await OutsideFoodPool.findById(poolId).populate('broadcaster', 'name email');
  if (!pool) throw outsideFoodError('Pool not found', 404);
  const userIsAdmin = user.role === 'admin';
  const userIsBroadcaster = isBroadcaster(pool, user._id);
  if (!userIsAdmin && !userIsBroadcaster) {
    throw outsideFoodError('Only the broadcaster can update this pool', 403);
  }
  if (pool.status === 'ARCHIVED' || pool.archived) {
    throw outsideFoodError('This pool is already archived');
  }

  if (requestedStatus === 'OPEN') {
    if (!userIsBroadcaster) throw outsideFoodError('Only the broadcaster can unlock this pool', 403);
    if (pool.status !== 'LOCKED') throw outsideFoodError('Only locked pools can be unlocked');
    pool.lockedAt = null;
  } else if (requestedStatus === 'LOCKED') {
    if (!userIsBroadcaster) throw outsideFoodError('Only the broadcaster can lock this pool', 403);
    if (pool.status !== 'OPEN') throw outsideFoodError('Only open pools can be locked');
    pool.lockedAt = pool.lockedAt || new Date();
  } else if (requestedStatus === 'COMPLETED') {
    if (!['OPEN', 'LOCKED'].includes(pool.status)) throw outsideFoodError('This pool cannot be completed now');
  } else if (requestedStatus === 'ARCHIVED') {
    pool.archived = true;
  } else {
    throw outsideFoodError('This status is not available in student-managed pools');
  }

  pool.status = requestedStatus;
  await pool.save();

  const defaultMessages = {
    OPEN: 'Pool unlocked by the broadcaster',
    LOCKED: 'Pool locked by the broadcaster',
    COMPLETED: 'Pool marked completed',
    ARCHIVED: 'Pool archived',
  };
  const content = String(statusMessage || '').trim() || defaultMessages[requestedStatus];

  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: requestedStatus === 'ARCHIVED' ? 'SYSTEM' : 'STATUS_UPDATE',
    content,
    io,
  });

  const eventName = requestedStatus === 'LOCKED'
    ? 'pool:lock'
    : requestedStatus === 'COMPLETED'
      ? 'pool:status-update'
      : 'pool:update';
  await emitPoolState(io, poolId, eventName);

  return serializePool(
    await OutsideFoodPool.findById(poolId).populate('restaurantId').populate('broadcaster', 'name email'),
    user._id,
    user.role
  );
}

async function postPoolStatusUpdate({ poolId, user, content, io = null }) {
  const text = String(content || '').trim();
  if (!text) throw outsideFoodError('statusMessage is required');

  const access = await assertRoomAccess(poolId, user);
  if (!access.isAdmin && !access.isBroadcaster) {
    throw outsideFoodError('Only the broadcaster can post status updates', 403);
  }
  if (access.pool.archived || access.pool.status === 'ARCHIVED') {
    throw outsideFoodError('This room is archived and no longer accepts updates');
  }

  const message = await createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'STATUS_UPDATE',
    content: text,
    io,
  });
  await emitPoolState(io, poolId, 'pool:status-update');
  return message;
}

async function volunteerAsCoordinator() {
  throw outsideFoodError('This pool is managed by its broadcaster');
}

async function expireDueOutsideFoodPools(io = null) {
  const cutoff = new Date(Date.now() - POOL_TTL_MS);
  const stalePools = await OutsideFoodPool.find({ createdAt: { $lte: cutoff } }).select('_id');
  const staleIds = stalePools.map((pool) => pool._id);
  if (!staleIds.length) return { removed: 0 };

  await Promise.all([
    OutsideFoodParticipant.deleteMany({ poolId: { $in: staleIds } }),
    OutsideFoodChatMessage.deleteMany({ poolId: { $in: staleIds } }),
    OutsideFoodJoinRequest.deleteMany({ poolId: { $in: staleIds } }),
    OutsideFoodPool.deleteMany({ _id: { $in: staleIds } }),
  ]);

  if (io) {
    staleIds.forEach((poolId) => {
      io.to(OUTSIDE_FOOD_LOBBY_ROOM).emit('pool:expired', { poolId });
      io.to(getOutsideFoodRoomName(poolId)).emit('pool:expired', { poolId });
    });
  }

  return { removed: staleIds.length };
}

module.exports = {
  OUTSIDE_FOOD_LOBBY_ROOM,
  VISIBLE_POOL_STATUSES,
  POOL_TTL_MS,
  getOutsideFoodRoomName,
  outsideFoodError,
  parsePositiveAmount,
  parseDateValue,
  normalizeStringList,
  normalizeCategory,
  canJoinPool,
  canRequestPool,
  serializePool,
  serializeMessage,
  createRoomMessage,
  emitPoolState,
  createStudentPool,
  joinOutsideFoodPool,
  createJoinRequest,
  resolveJoinRequest,
  leaveOutsideFoodPool,
  kickPoolParticipant,
  setParticipantOnline,
  assertRoomAccess,
  sendTextMessage,
  updateOutsideFoodPoolStatus,
  postPoolStatusUpdate,
  volunteerAsCoordinator,
  expireDueOutsideFoodPools,
  buildRestaurantPayload,
};
