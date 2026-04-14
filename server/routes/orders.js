const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  getOrder,
  getOrderStats,
  addProducedStock,
  getKitchenStock,
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/stats/summary', protect, authorize('admin', 'kitchen'), getOrderStats);
router.get('/kitchen/stock', protect, authorize('admin', 'kitchen'), getKitchenStock);
router.post('/kitchen/produce', protect, authorize('admin', 'kitchen'), addProducedStock);
router.get('/', protect, authorize('admin', 'kitchen'), getAllOrders);
router.get('/:id', protect, getOrder);
router.patch('/:id/status', protect, authorize('admin', 'kitchen'), updateOrderStatus);

module.exports = router;
