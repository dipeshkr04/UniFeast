/**
 * Socket.io Event Handler
 * Manages real-time communication between clients and server
 */

const { recalculateAllETAs, getQueueStats } = require('./queueEngine');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join-room', (data) => {
      const { userId, role } = data;
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`  → User ${userId} joined their room`);
      }
      if (role === 'kitchen' || role === 'admin') {
        socket.join('kitchen');
        console.log(`  → ${role} joined kitchen room`);
      }
      if (role === 'admin') {
        socket.join('admin');
        console.log(`  → Admin joined admin room`);
      }
    });

    // Request queue stats
    socket.on('get-queue-stats', async () => {
      try {
        const stats = await getQueueStats();
        socket.emit('queue-stats', stats);
      } catch (err) {
        console.error('Queue stats error:', err.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return {
    // Emit new order to kitchen
    notifyNewOrder: (order) => {
      io.to('kitchen').emit('new-order', order);
    },

    // Emit order status update to specific user and kitchen
    notifyOrderUpdate: (userId, orderUpdate) => {
      io.to(`user:${userId}`).emit('order-update', orderUpdate);
      io.to('kitchen').emit('order-update', orderUpdate);
    },

    // Emit ETA update to specific user
    notifyETAUpdate: (userId, etaData) => {
      io.to(`user:${userId}`).emit('eta-update', etaData);
    },

    // Emit ETA updates to all active order users
    notifyAllETAUpdates: async (updates) => {
      updates.forEach(update => {
        io.to(`user:${update.userId}`).emit('eta-update', update);
      });
    },

    // Emit pool updates
    notifyPoolUpdate: (poolUpdate) => {
      io.emit('pool-update', poolUpdate);
    },

    // Emit queue stats to kitchen
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
