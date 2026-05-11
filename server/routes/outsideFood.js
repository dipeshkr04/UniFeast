const express = require('express');
const router = express.Router();
const {
  getRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getPools,
  createPool,
  getPoolDetails,
  joinPool,
  createJoinRequest,
  resolveJoinRequest,
  leavePool,
  kickParticipant,
  getChatMessages,
  sendChatMessage,
  sendBroadcastMessage,
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
router.delete('/restaurants/:id', protect, authorize('admin'), deleteRestaurant);

router.get('/pools', protect, getPools);
router.post('/pools', protect, authorize('student'), createPool);
router.get('/pools/:poolId', protect, getPoolDetails);
router.post('/pools/:poolId/join', protect, authorize('student'), joinPool);
router.post('/pools/:poolId/requests', protect, authorize('student'), createJoinRequest);
router.patch('/pools/:poolId/requests/:requestId', protect, authorize('student'), resolveJoinRequest);
router.delete('/pools/:poolId/participants/me', protect, authorize('student'), leavePool);
router.delete('/pools/:poolId/participants/:userId', protect, authorize('student'), kickParticipant);
router.patch('/pools/:poolId/status', protect, updatePoolStatus);
router.patch('/pools/:poolId/archive', protect, archivePool);
router.post('/pools/:poolId/coordinators', protect, authorize('student'), volunteerCoordinator);

router.get('/chat/:poolId', protect, getChatMessages);
router.post('/chat/:poolId', protect, sendChatMessage);
router.post('/chat/:poolId/broadcast', protect, sendBroadcastMessage);

module.exports = router;
