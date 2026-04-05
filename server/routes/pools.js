const express = require('express');
const router = express.Router();
const {
  getActivePools,
  getPoolDetails,
  joinOrCreatePool,
  checkPoolForItem,
  closePoolManually,
} = require('../controllers/poolController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/', protect, getActivePools);
router.get('/check/:menuItemId', protect, checkPoolForItem);
router.get('/:id', protect, getPoolDetails);
router.post('/join', protect, joinOrCreatePool);
router.patch('/:id/close', protect, authorize('admin', 'kitchen'), closePoolManually);

module.exports = router;
