const express = require('express');
const router = express.Router();
const {
  getRestaurants,
  createRestaurant,
  updateRestaurant,
  getPools,
  createPool,
  getPoolDetails,
  joinPool,
  getChatMessages,
  sendChatMessage,
  updatePoolStatus,
  archivePool,
  volunteerCoordinator,
  getSocketInfo,
} = require('../controllers/outsideFoodController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/socket', protect, getSocketInfo);

router.get('/restaurants', protect, getRestaurants);
router.post('/restaurants', protect, authorize('admin'), createRestaurant);
router.patch('/restaurants/:id', protect, authorize('admin'), updateRestaurant);

router.get('/pools', protect, getPools);
router.post('/pools', protect, authorize('admin'), createPool);
router.get('/pools/:poolId', protect, getPoolDetails);
router.post('/pools/:poolId/join', protect, authorize('student'), joinPool);
router.patch('/pools/:poolId/status', protect, updatePoolStatus);
router.patch('/pools/:poolId/archive', protect, authorize('admin'), archivePool);
router.post('/pools/:poolId/coordinators', protect, authorize('student'), volunteerCoordinator);

router.get('/chat/:poolId', protect, getChatMessages);
router.post('/chat/:poolId', protect, sendChatMessage);

module.exports = router;
