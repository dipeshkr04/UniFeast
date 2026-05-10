const express = require('express');
const router = express.Router();
const {
  holdCartItem,
  releaseCartItem,
  clearCartHolds,
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.post('/hold', protect, authorize('student'), holdCartItem);
router.delete('/hold/:menuItemId', protect, authorize('student'), releaseCartItem);
router.delete('/holds', protect, authorize('student'), clearCartHolds);

module.exports = router;
