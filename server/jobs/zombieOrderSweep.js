const cron = require('node-cron');
const Order = require('../models/Order');

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('[Cron] Running Zombie Order Sweep...');
  try {
    // Assuming maxTprep is 15 minutes, 3 * 15 = 45 mins. (45 * 60 * 1000 = 2700000ms)
    const MAX_PREP_MS = 2700000; 
    const thresholdDate = new Date(Date.now() - MAX_PREP_MS);

    const zombieOrders = await Order.find({
      status: 'PREPARING',
      startedAt: { $lt: thresholdDate }
    }).select('_id startedAt');

    if (zombieOrders.length > 0) {
      console.warn(`[Cron] Found ${zombieOrders.length} zombie PREPARING orders! Alerting kitchen admin.`);
      // Ideally inject io instance or require it properly from your server initialization
      const io = global.io; // Ensure io is set globally in server.js
      if (io) {
        io.to('kitchen').emit('order:zombieAlert', {
          message: `${zombieOrders.length} orders stuck in PREPARING for over 45 minutes!`,
          orders: zombieOrders.map(o => ({ id: o._id, startedAt: o.startedAt }))
        });
      }
    }
  } catch (error) {
    console.error('[Cron] Zombie Order Sweep Error:', error);
  }
});
