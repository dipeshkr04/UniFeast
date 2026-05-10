const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrder,
  getOrderStats,
  addProducedStock,
  getKitchenStock,
  markOrderItemReady,
  getOrderQr,
  scanOrderQr,
} = require('../controllers/orderController');

const { updateOrderStatus } = require('../controllers/orderStatusController');
const { getKitchenSummary } = require('../services/queueService');
const Order = require('../models/Order');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/stats/summary', protect, authorize('admin', 'kitchen'), getOrderStats);
router.get('/kitchen/stock', protect, authorize('admin', 'kitchen'), getKitchenStock);
router.post('/kitchen/produce', protect, authorize('admin', 'kitchen'), addProducedStock);
router.post('/kitchen/qr/scan', protect, authorize('admin', 'kitchen'), scanOrderQr);

router.get('/kitchen/live', protect, authorize('admin', 'kitchen'), async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      createdAt: { $gte: startOfDay },
      status: { $ne: 'cancelled' },
    })
      .populate('user', 'name email phone _id btId')
      .populate('items.menuItem', 'name imageUrl')
      .sort({ createdAt: 1 });

    res.json(orders);
  } catch (err) {
    console.error('kitchen/live error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

router.get('/kitchen/summary', protect, authorize('admin', 'kitchen'), async (req, res) => {
  try {
    const summary = await getKitchenSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

router.get('/', protect, authorize('admin', 'kitchen'), getAllOrders);
router.patch('/:id/items/:itemId/ready', protect, authorize('admin', 'kitchen'), markOrderItemReady);
router.get('/:id/qr', protect, getOrderQr);
router.get('/:id', protect, getOrder);
router.patch('/:id/status', protect, authorize('admin', 'kitchen'), updateOrderStatus);

module.exports = router;
