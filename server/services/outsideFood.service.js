const OutsideFoodRestaurant = require('../models/OutsideFoodRestaurant');
const OutsideFoodPool = require('../models/OutsideFoodPool');
const OutsideFoodParticipant = require('../models/OutsideFoodParticipant');
const OutsideFoodChatMessage = require('../models/OutsideFoodChatMessage');

const OUTSIDE_FOOD_LOBBY_ROOM = 'outside-food:lobby';
const ACTIVE_POOL_STATUSES = ['OPEN', 'UNLOCKED'];
const COORDINATOR_STATUSES = ['UNLOCKED', 'LOCKED', 'COORDINATING', 'COMPLETED'];
const COORDINATOR_MANAGED_STATUSES = ['COORDINATING', 'COMPLETED'];
const DEFAULT_GRACE_MINUTES = 5;
const COORDINATOR_INACTIVE_AFTER_MS = 10 * 60 * 1000;
const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;

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

function idToString(value) {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
}

function getJoinDeadline(pool) {
  if (pool.status === 'UNLOCKED') {
    return pool.graceClosesAt || pool.closesAt;
  }
  return pool.closesAt;
}

function canJoinPool(pool) {
  const now = Date.now();
  const opensAt = pool.opensAt ? new Date(pool.opensAt).getTime() : 0;
  const closesAt = getJoinDeadline(pool) ? new Date(getJoinDeadline(pool)).getTime() : 0;
  return (
    ACTIVE_POOL_STATUSES.includes(pool.status) &&
    !pool.archived &&
    now >= opensAt &&
    now < closesAt
  );
}

function buildRestaurantPayload(restaurant, revealContacts = false) {
  if (!restaurant) return null;
  const raw = typeof restaurant.toObject === 'function' ? restaurant.toObject() : restaurant;
  const payload = {
    _id: raw._id,
    name: raw.name,
    image: raw.image || '',
    cuisineTags: raw.cuisineTags || [],
    minPoolAmount: raw.minPoolAmount,
    estimatedDeliveryTime: raw.estimatedDeliveryTime || '',
    pickupPoints: raw.pickupPoints || [],
    active: raw.active,
  };

  if (revealContacts) {
    payload.contactNumber = raw.contactNumber || '';
    payload.menuLink = raw.menuLink || '';
    payload.whatsappLink = raw.whatsappLink || '';
  }

  return payload;
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
  const pool = poolDoc.restaurantId?.name
    ? poolDoc
    : await OutsideFoodPool.findById(poolDoc._id || poolDoc).populate('restaurantId');

  if (!pool) return null;

  const participants = await OutsideFoodParticipant.find({ poolId: pool._id })
    .populate('userId', 'name email')
    .sort({ joinedAt: 1 });

  const participantRows = participants.map(serializeParticipant);
  const viewerId = viewerUserId ? viewerUserId.toString() : '';
  const viewerParticipant = viewerId
    ? participantRows.find((participant) => participant.userId?.toString() === viewerId)
    : null;
  const isAdmin = viewerRole === 'admin';
  const isRoomBroadcast = viewerRole === 'room';
  const coordinatorIds = (pool.coordinators || []).map(idToString).filter(Boolean);
  const coordinatorRows = participantRows.filter((participant) => (
    coordinatorIds.includes(idToString(participant.userId))
  ));
  const viewerIsCoordinator = Boolean(viewerId && coordinatorIds.includes(viewerId));
  const hasUnlocked = Boolean(pool.unlockAt);
  const revealContacts = isAdmin || (hasUnlocked && (Boolean(viewerParticipant) || isRoomBroadcast));
  const remainingAmount = Math.max(0, Number(pool.targetAmount || 0) - Number(pool.currentAmount || 0));
  const progressPercent = pool.targetAmount
    ? Math.min(100, Math.round((Number(pool.currentAmount || 0) / Number(pool.targetAmount || 1)) * 100))
    : 0;
  const recentCutoff = Date.now() - (5 * 60 * 1000);
  const recentlyJoinedCount = participantRows.filter((participant) => (
    new Date(participant.joinedAt).getTime() >= recentCutoff
  )).length;
  const suggestedCoordinator = coordinatorRows.length
    ? null
    : participantRows
      .slice()
      .sort((a, b) => {
        const activityScore = (participant) => (
          (participant.online ? 100 : 0) +
          Number(participant.messageCount || 0) * 8 +
          Number(participant.intendedAmount || 0) / 100
        );
        const scoreDiff = activityScore(b) - activityScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.joinedAt) - new Date(b.joinedAt);
      })[0] || null;
  const coordinatorInactive = coordinatorRows.length > 0 &&
    COORDINATOR_STATUSES.includes(pool.status) &&
    pool.coordinatorLastActiveAt &&
    Date.now() - new Date(pool.coordinatorLastActiveAt).getTime() > COORDINATOR_INACTIVE_AFTER_MS;
  const activeWindowClosesAt = getJoinDeadline(pool);

  return {
    _id: pool._id,
    restaurantId: pool.restaurantId?._id || pool.restaurantId,
    restaurant: buildRestaurantPayload(pool.restaurantId, revealContacts),
    title: pool.title,
    status: pool.status,
    targetAmount: pool.targetAmount,
    currentAmount: pool.currentAmount,
    participantCount: pool.participantCount,
    participants: participantRows,
    onlineCount: participantRows.filter((participant) => participant.online).length,
    recentlyJoinedCount,
    opensAt: pool.opensAt,
    closesAt: pool.closesAt,
    unlockAt: pool.unlockAt,
    graceClosesAt: pool.graceClosesAt,
    lockedAt: pool.lockedAt,
    activeWindowClosesAt,
    pickupPoint: pool.pickupPoint,
    coordinators: coordinatorRows,
    coordinatorCount: coordinatorRows.length,
    coordinatorLastActiveAt: pool.coordinatorLastActiveAt,
    coordinationConfirmedAt: pool.coordinationConfirmedAt,
    suggestedCoordinator,
    coordinatorInactive: Boolean(coordinatorInactive),
    coordinationPrompt: hasUnlocked && coordinatorRows.length === 0
      ? 'Who wants to coordinate restaurant communication?'
      : '',
    archived: pool.archived,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    roomName: getOutsideFoodRoomName(pool._id),
    remainingAmount,
    progressPercent,
    isJoinable: canJoinPool(pool),
    viewer: {
      isParticipant: Boolean(viewerParticipant),
      isCoordinator: viewerIsCoordinator,
      isAdmin,
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
    throw outsideFoodError('Outside food pool not found', 404);
  }

  const unlockedNow = pool.status === 'OPEN' && currentAmount >= Number(pool.targetAmount || 0);
  pool.currentAmount = currentAmount;
  pool.participantCount = participants.length;
  pool.participants = participantIds;

  if (unlockedNow) {
    pool.status = 'UNLOCKED';
    pool.unlockAt = new Date();
    pool.graceClosesAt = new Date(pool.unlockAt.getTime() + DEFAULT_GRACE_MINUTES * 60 * 1000);
  }

  await pool.save();
  return { pool, unlockedNow };
}

async function emitParticipantUpdate(io, poolId) {
  if (!io) return;
  const pool = await OutsideFoodPool.findById(poolId).populate('restaurantId');
  if (!pool) return;
  const payload = await serializePool(pool, null, '');
  const summary = {
    poolId: pool._id,
    participantCount: payload.participantCount,
    onlineCount: payload.onlineCount,
    recentlyJoinedCount: payload.recentlyJoinedCount,
    currentAmount: payload.currentAmount,
    progressPercent: payload.progressPercent,
    remainingAmount: payload.remainingAmount,
  };
  io.to(OUTSIDE_FOOD_LOBBY_ROOM).emit('pool:participant-update', summary);
  io.to(getOutsideFoodRoomName(poolId)).emit('pool:participant-update', summary);
}

async function emitPoolState(io, poolId, eventName = 'pool:update') {
  if (!io) return;
  const pool = await OutsideFoodPool.findById(poolId).populate('restaurantId');
  if (!pool) return;

  const publicPayload = await serializePool(pool, null, '');
  const roomPayload = await serializePool(pool, null, 'room');

  io.to(OUTSIDE_FOOD_LOBBY_ROOM).emit(eventName, publicPayload);
  io.to(getOutsideFoodRoomName(poolId)).emit(eventName, roomPayload);
  if (roomPayload.status === 'UNLOCKED' && roomPayload.graceClosesAt) {
    const timerPayload = {
      poolId: roomPayload._id,
      graceClosesAt: roomPayload.graceClosesAt,
      activeWindowClosesAt: roomPayload.activeWindowClosesAt,
    };
    io.to(OUTSIDE_FOOD_LOBBY_ROOM).emit('pool:grace-timer', timerPayload);
    io.to(getOutsideFoodRoomName(poolId)).emit('pool:grace-timer', timerPayload);
  }
  await emitParticipantUpdate(io, poolId);
}

async function joinOutsideFoodPool({ poolId, user, intendedAmount, orderPreview = '', io = null }) {
  const amount = parsePositiveAmount(intendedAmount, 'Intended order amount');
  const pool = await OutsideFoodPool.findById(poolId).populate('restaurantId');

  if (!pool) throw outsideFoodError('Outside food pool not found', 404);
  if (Date.now() < new Date(pool.opensAt).getTime()) {
    throw outsideFoodError('This scheduled pool has not opened yet');
  }
  if (!canJoinPool(pool)) {
    throw outsideFoodError('This pool room is no longer accepting participants');
  }
  if (Date.now() >= new Date(getJoinDeadline(pool)).getTime()) {
    throw outsideFoodError('This pool window has closed');
  }

  const existing = await OutsideFoodParticipant.findOne({ poolId, userId: user._id });
  let participant;
  let isNewParticipant = false;

  try {
    participant = await OutsideFoodParticipant.findOneAndUpdate(
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
    isNewParticipant = !existing;
  } catch (error) {
    if (error.code !== 11000) throw error;
    participant = await OutsideFoodParticipant.findOneAndUpdate(
      { poolId, userId: user._id },
      {
        $set: {
          intendedAmount: amount,
          orderPreview: String(orderPreview || '').trim(),
        },
      },
      { new: true, runValidators: true }
    );
  }

  const { pool: updatedPool, unlockedNow } = await syncPoolTotals(poolId);

  if (isNewParticipant) {
    await createRoomMessage({
      poolId,
      type: 'SYSTEM',
      content: `${user.name} joined the pool`,
      io,
    });
  }

  if (unlockedNow) {
    await createRoomMessage({
      poolId,
      type: 'STATUS_UPDATE',
      content: 'Pool unlocked - restaurant details revealed',
      io,
    });
    await createRoomMessage({
      poolId,
      type: 'SYSTEM',
      content: `${DEFAULT_GRACE_MINUTES} minute grace window started. New participants can still join.`,
      io,
    });
    await createRoomMessage({
      poolId,
      type: 'SYSTEM',
      content: 'Who wants to coordinate restaurant communication?',
      io,
    });
    await emitPoolState(io, poolId, 'pool:unlock');
  } else {
    await emitPoolState(io, poolId, 'pool:update');
  }

  return {
    participant,
    pool: await serializePool(
      await OutsideFoodPool.findById(updatedPool._id).populate('restaurantId'),
      user._id,
      user.role
    ),
  };
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
  const pool = await OutsideFoodPool.findById(poolId).populate('restaurantId');
  if (!pool) throw outsideFoodError('Outside food pool not found', 404);
  if (user.role === 'admin') {
    return {
      pool,
      participant: null,
      isAdmin: true,
      isCoordinator: true,
    };
  }

  const participant = await OutsideFoodParticipant.findOne({ poolId, userId: user._id });
  if (!participant) {
    throw outsideFoodError('Join this pool before entering the room', 403);
  }
  const isCoordinator = (pool.coordinators || []).some((coordinatorId) => (
    idToString(coordinatorId) === user._id.toString()
  ));

  return {
    pool,
    participant,
    isAdmin: false,
    isCoordinator,
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
  if (!access.isAdmin && access.isCoordinator) {
    await OutsideFoodPool.updateOne(
      { _id: poolId },
      { $set: { coordinatorLastActiveAt: new Date() } }
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
    throw outsideFoodError('Invalid outside food pool status');
  }

  const access = await assertRoomAccess(poolId, user);
  if (requestedStatus === 'ARCHIVED' && !access.isAdmin) {
    throw outsideFoodError('Only admins can archive outside food pools', 403);
  }
  if (!access.isAdmin) {
    if (!access.isCoordinator) {
      throw outsideFoodError('Only coordinators or admins can update this pool', 403);
    }
    if (!COORDINATOR_MANAGED_STATUSES.includes(requestedStatus)) {
      throw outsideFoodError('Coordinators can only post coordination or completion updates', 403);
    }
  }

  const pool = access.pool;
  if (pool.status === 'ARCHIVED' || pool.archived) {
    throw outsideFoodError('This pool is already archived');
  }

  pool.status = requestedStatus;
  if (requestedStatus === 'UNLOCKED' && !pool.unlockAt) {
    pool.unlockAt = new Date();
    pool.graceClosesAt = new Date(pool.unlockAt.getTime() + DEFAULT_GRACE_MINUTES * 60 * 1000);
  }
  if (requestedStatus === 'LOCKED' && !pool.lockedAt) pool.lockedAt = new Date();
  if (requestedStatus === 'COORDINATING') {
    pool.coordinationConfirmedAt = pool.coordinationConfirmedAt || new Date();
    pool.coordinatorLastActiveAt = new Date();
  }
  if (requestedStatus === 'COMPLETED') {
    pool.coordinatorLastActiveAt = new Date();
  }
  if (requestedStatus === 'ARCHIVED') pool.archived = true;
  await pool.save();

  const defaultMessages = {
    UNLOCKED: 'Pool unlocked - grace window started',
    LOCKED: 'Pool locked',
    COORDINATING: 'Restaurant communication confirmed',
    COMPLETED: 'Delivery completed',
    ARCHIVED: 'Pool archived',
  };
  const content = String(statusMessage || '').trim() || defaultMessages[requestedStatus] || `Pool status updated to ${requestedStatus}`;

  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: requestedStatus === 'ARCHIVED' ? 'SYSTEM' : 'STATUS_UPDATE',
    content,
    io,
  });
  if (requestedStatus === 'UNLOCKED') {
    await createRoomMessage({
      poolId,
      type: 'SYSTEM',
      content: 'Who wants to coordinate restaurant communication?',
      io,
    });
  }

  const eventName = requestedStatus === 'UNLOCKED'
    ? 'pool:unlock'
    : requestedStatus === 'LOCKED'
      ? 'pool:lock'
      : ['COORDINATING', 'COMPLETED'].includes(requestedStatus)
        ? 'pool:status-update'
        : 'pool:update';
  await emitPoolState(io, poolId, eventName);

  return serializePool(await OutsideFoodPool.findById(poolId).populate('restaurantId'), user._id, user.role);
}

async function postPoolStatusUpdate({ poolId, user, content, io = null }) {
  const text = String(content || '').trim();
  if (!text) throw outsideFoodError('statusMessage is required');

  const access = await assertRoomAccess(poolId, user);
  if (!access.isAdmin && !access.isCoordinator) {
    throw outsideFoodError('Only coordinators or admins can post status updates', 403);
  }
  if (access.pool.archived || access.pool.status === 'ARCHIVED') {
    throw outsideFoodError('This room is archived and no longer accepts updates');
  }

  if (access.isCoordinator) {
    await OutsideFoodPool.updateOne(
      { _id: poolId },
      { $set: { coordinatorLastActiveAt: new Date() } }
    );
    await OutsideFoodParticipant.updateOne(
      { poolId, userId: user._id },
      { $set: { lastActiveAt: new Date() } }
    );
  }

  await createRoomMessage({
    poolId,
    senderId: user._id,
    type: 'STATUS_UPDATE',
    content: text,
    io,
  });
  await emitPoolState(io, poolId, 'pool:status-update');
}

async function volunteerAsCoordinator({ poolId, user, io = null }) {
  const access = await assertRoomAccess(poolId, user);
  const pool = access.pool;
  if (!access.participant) {
    throw outsideFoodError('Only pool participants can volunteer as coordinators', 403);
  }
  if (!pool.unlockAt || !COORDINATOR_STATUSES.includes(pool.status)) {
    throw outsideFoodError('Coordinators can volunteer after the pool unlocks');
  }
  if (pool.archived || pool.status === 'ARCHIVED') {
    throw outsideFoodError('This pool is archived');
  }

  const coordinatorIds = (pool.coordinators || []).map(idToString);
  const alreadyCoordinator = coordinatorIds.includes(user._id.toString());
  if (!alreadyCoordinator) {
    pool.coordinators.push(user._id);
  }
  pool.coordinatorLastActiveAt = new Date();
  await pool.save();

  await OutsideFoodParticipant.updateOne(
    { poolId, userId: user._id },
    { $set: { lastActiveAt: new Date() } }
  );
  if (!alreadyCoordinator) {
    await createRoomMessage({
      poolId,
      senderId: user._id,
      type: 'SYSTEM',
      content: `${user.name} volunteered as coordinator`,
      io,
    });
  }
  await emitPoolState(io, poolId, 'pool:coordinator-update');

  return serializePool(await OutsideFoodPool.findById(poolId).populate('restaurantId'), user._id, user.role);
}

async function expireDueOutsideFoodPools(io = null) {
  const now = new Date();
  await OutsideFoodPool.updateMany(
    { status: 'EXPIRED' },
    { $set: { status: 'LOCKED', lockedAt: now } }
  );

  const dueOpenPools = await OutsideFoodPool.find({
    status: 'OPEN',
    archived: false,
    closesAt: { $lte: now },
  });

  for (const pool of dueOpenPools) {
    pool.status = 'LOCKED';
    pool.lockedAt = pool.lockedAt || now;
    await pool.save();
    await createRoomMessage({
      poolId: pool._id,
      type: 'STATUS_UPDATE',
      content: 'Pool locked',
      io,
    });
    await emitPoolState(io, pool._id, 'pool:lock');
  }

  const graceDuePools = await OutsideFoodPool.find({
    status: 'UNLOCKED',
    archived: false,
    graceClosesAt: { $lte: now },
  });

  for (const pool of graceDuePools) {
    pool.status = 'LOCKED';
    pool.lockedAt = pool.lockedAt || now;
    await pool.save();
    await createRoomMessage({
      poolId: pool._id,
      type: 'STATUS_UPDATE',
      content: 'Pool locked',
      io,
    });
    await emitPoolState(io, pool._id, 'pool:lock');
  }

  const archiveCutoff = new Date(Date.now() - ARCHIVE_AFTER_MS);
  const stalePools = await OutsideFoodPool.find({
    status: { $in: ['COMPLETED'] },
    archived: false,
    updatedAt: { $lte: archiveCutoff },
  });

  for (const pool of stalePools) {
    pool.status = 'ARCHIVED';
    pool.archived = true;
    await pool.save();
    await createRoomMessage({
      poolId: pool._id,
      type: 'SYSTEM',
      content: 'Pool archived',
      io,
    });
    await emitPoolState(io, pool._id, 'pool:update');
  }

  return { locked: dueOpenPools.length + graceDuePools.length, archived: stalePools.length };
}

module.exports = {
  OUTSIDE_FOOD_LOBBY_ROOM,
  getOutsideFoodRoomName,
  outsideFoodError,
  parsePositiveAmount,
  parseDateValue,
  normalizeStringList,
  canJoinPool,
  serializePool,
  serializeMessage,
  createRoomMessage,
  emitPoolState,
  joinOutsideFoodPool,
  setParticipantOnline,
  assertRoomAccess,
  sendTextMessage,
  updateOutsideFoodPoolStatus,
  postPoolStatusUpdate,
  volunteerAsCoordinator,
  expireDueOutsideFoodPools,
  buildRestaurantPayload,
};
