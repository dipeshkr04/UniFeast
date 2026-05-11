/**
 * Socket.io Event Handler
 * Manages real-time communication between clients and server
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getQueueStats } = require('./queueEngine');
const { getKitchenSummary } = require('../services/queueService');
const setupOutsideFoodSocketHandlers = require('./outsideFoodSocketHandler');

function setupSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id role');
      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.user = {
        id: user._id.toString(),
        role: user.role,
      };
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user;
    console.log(`[socket] client connected: ${socket.id} (${role}:${userId})`);

    socket.join(`user:${userId}`);
    socket.join(`student:${userId}`);
    if (role === 'kitchen' || role === 'admin') socket.join('kitchen');
    if (role === 'admin') socket.join('admin');
    setupOutsideFoodSocketHandlers(io, socket);

    // Compatibility event: room membership is derived from the verified token, not client payload.
    socket.on('join-room', () => {
      socket.join(`user:${userId}`);
      socket.join(`student:${userId}`);
      if (role === 'kitchen' || role === 'admin') socket.join('kitchen');
      if (role === 'admin') socket.join('admin');
    });

    socket.on('kitchen:join', async () => {
      if (role !== 'kitchen' && role !== 'admin') {
        return socket.emit('kitchen:error', { message: 'Kitchen access denied' });
      }
      socket.join('kitchen');
      getKitchenSummary().then(summary => socket.emit('kitchen:summary', summary)).catch(console.error);
    });

    socket.on('kitchen:requestSummary', async () => {
      if (role !== 'kitchen' && role !== 'admin') return;
      getKitchenSummary().then(summary => socket.emit('kitchen:summary', summary)).catch(console.error);
    });

    socket.on('get-queue-stats', async () => {
      try {
        const stats = await getQueueStats();
        socket.emit('queue-stats', stats);
      } catch (err) {
        console.error('Queue stats error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return {
    notifyNewOrder: (order) => {
      io.to('kitchen').emit('order:new', { order });
    },

    notifyOrderUpdate: (userId, orderUpdate) => {
      io.to(`user:${userId}`).emit('order-update', orderUpdate);
      io.to(`user:${userId}`).emit('order:statusChanged', orderUpdate);
      io.to('kitchen').emit('order-update', orderUpdate);
    },

    notifyETAUpdate: (userId, etaData) => {
      io.to(`user:${userId}`).emit('eta-update', etaData);
    },

    notifyAllETAUpdates: async (updates) => {
      updates.forEach(update => {
        io.to(`user:${update.userId}`).emit('eta-update', update);
      });
    },

    notifyPoolUpdate: (poolUpdate) => {
      io.emit('pool-update', poolUpdate);
    },

    notifyQueueStats: async () => {
      try {
        const stats = await getQueueStats();
        io.to('kitchen').emit('queue-stats', stats);
      } catch (err) {
        console.error('Queue stats broadcast error:', err.message);
      }
    },
  };
}

module.exports = setupSocketHandlers;
