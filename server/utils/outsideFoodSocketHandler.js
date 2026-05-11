const User = require('../models/User');
const {
  OUTSIDE_FOOD_LOBBY_ROOM,
  getOutsideFoodRoomName,
  serializePool,
  joinOutsideFoodPool,
  setParticipantOnline,
  assertRoomAccess,
  sendTextMessage,
  updateOutsideFoodPoolStatus,
  postPoolStatusUpdate,
  volunteerAsCoordinator,
} = require('../services/outsideFood.service');

const poolPresence = new Map();

function getPoolPresence(poolId) {
  const key = poolId.toString();
  if (!poolPresence.has(key)) {
    poolPresence.set(key, new Map());
  }
  return poolPresence.get(key);
}

function addPresence(poolId, userId, socketId) {
  const users = getPoolPresence(poolId);
  const key = userId.toString();
  if (!users.has(key)) users.set(key, new Set());
  users.get(key).add(socketId);
}

function removePresence(poolId, userId, socketId) {
  const poolKey = poolId.toString();
  const users = poolPresence.get(poolKey);
  if (!users) return false;

  const userKey = userId.toString();
  const sockets = users.get(userKey);
  if (!sockets) return false;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    users.delete(userKey);
    if (users.size === 0) poolPresence.delete(poolKey);
    return true;
  }

  return false;
}

function sendAck(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

async function getSocketUser(socket) {
  return User.findById(socket.user.id).select('_id name email role');
}

function setupOutsideFoodSocketHandlers(io, socket) {
  const joinedPools = new Set();

  if (socket.user.role === 'student' || socket.user.role === 'admin') {
    socket.join(OUTSIDE_FOOD_LOBBY_ROOM);
  }

  const enterRoom = async (poolId, user) => {
    const access = await assertRoomAccess(poolId, user);
    const roomName = getOutsideFoodRoomName(poolId);

    socket.join(roomName);
    joinedPools.add(poolId.toString());

    if (access.participant) {
      addPresence(poolId, user._id, socket.id);
      await setParticipantOnline(poolId, user._id, true, io);
    }

    const payload = await serializePool(access.pool, user._id, user.role);
    socket.emit('pool:status', payload);
    return payload;
  };

  const leaveRoom = async (poolId, user) => {
    const roomName = getOutsideFoodRoomName(poolId);
    socket.leave(roomName);
    joinedPools.delete(poolId.toString());

    if (user.role !== 'admin') {
      const wentOffline = removePresence(poolId, user._id, socket.id);
      if (wentOffline) {
        await setParticipantOnline(poolId, user._id, false, io);
      }
    }
  };

  socket.on('pool:join', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');

      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');

      let poolPayload = null;
      if (payload.intendedAmount !== undefined) {
        if (user.role !== 'student') {
          throw new Error('Only students can join outside food pools');
        }
        const result = await joinOutsideFoodPool({
          poolId,
          user,
          intendedAmount: payload.intendedAmount,
          orderPreview: payload.orderPreview,
          io,
        });
        poolPayload = result.pool;
      }

      const statusPayload = await enterRoom(poolId, user);
      sendAck(ack, { success: true, data: poolPayload || statusPayload });
    } catch (error) {
      socket.emit('pool:error', { message: error.message });
      sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:leave', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');
      await leaveRoom(poolId, user);
      sendAck(ack, { success: true });
    } catch (error) {
      sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:message', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');
      const message = await sendTextMessage({
        poolId,
        user,
        content: payload.content,
        io,
      });
      sendAck(ack, { success: true, data: message });
    } catch (error) {
      socket.emit('pool:error', { message: error.message });
      sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:update', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');

      if (payload.status) {
        const pool = await updateOutsideFoodPoolStatus({
          poolId,
          user,
          status: payload.status,
          statusMessage: payload.statusMessage,
          io,
        });
        return sendAck(ack, { success: true, data: pool });
      }

      await postPoolStatusUpdate({
        poolId,
        user,
        content: payload.statusMessage,
        io,
      });
      return sendAck(ack, { success: true });
    } catch (error) {
      socket.emit('pool:error', { message: error.message });
      return sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:unlock', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');
      const pool = await updateOutsideFoodPoolStatus({
        poolId,
        user,
        status: 'UNLOCKED',
        statusMessage: payload.statusMessage || 'Pool unlocked',
        io,
      });
      sendAck(ack, { success: true, data: pool });
    } catch (error) {
      socket.emit('pool:error', { message: error.message });
      sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:lock', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');
      const pool = await updateOutsideFoodPoolStatus({
        poolId,
        user,
        status: 'LOCKED',
        statusMessage: payload.statusMessage || 'Pool locked',
        io,
      });
      sendAck(ack, { success: true, data: pool });
    } catch (error) {
      socket.emit('pool:error', { message: error.message });
      sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:coordinator-update', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');
      const pool = await volunteerAsCoordinator({ poolId, user, io });
      sendAck(ack, { success: true, data: pool });
    } catch (error) {
      socket.emit('pool:error', { message: error.message });
      sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:status-update', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');
      if (payload.status) {
        const pool = await updateOutsideFoodPoolStatus({
          poolId,
          user,
          status: payload.status,
          statusMessage: payload.statusMessage,
          io,
        });
        return sendAck(ack, { success: true, data: pool });
      }
      await postPoolStatusUpdate({
        poolId,
        user,
        content: payload.statusMessage,
        io,
      });
      return sendAck(ack, { success: true });
    } catch (error) {
      socket.emit('pool:error', { message: error.message });
      return sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('pool:status', async (payload = {}, ack) => {
    try {
      const poolId = payload.poolId;
      if (!poolId) throw new Error('poolId is required');
      const user = await getSocketUser(socket);
      if (!user) throw new Error('User not found');
      const access = await assertRoomAccess(poolId, user);
      const pool = await serializePool(access.pool, user._id, user.role);
      socket.emit('pool:status', pool);
      sendAck(ack, { success: true, data: pool });
    } catch (error) {
      sendAck(ack, { success: false, message: error.message });
    }
  });

  socket.on('disconnect', async () => {
    if (!joinedPools.size) return;
    try {
      const user = await getSocketUser(socket);
      if (!user || user.role === 'admin') return;

      await Promise.all(Array.from(joinedPools).map(async (poolId) => {
        const wentOffline = removePresence(poolId, user._id, socket.id);
        if (wentOffline) {
          await setParticipantOnline(poolId, user._id, false, io);
        }
      }));
      joinedPools.clear();
    } catch (error) {
      console.error('Outside food socket cleanup error:', error.message);
    }
  });
}

module.exports = setupOutsideFoodSocketHandlers;
