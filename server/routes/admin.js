const express = require('express');
const router = express.Router();
const {
  getUsers,
  updateUserRole,
  deleteUser,
  getDashboardStats,
  getCanteenStatus,
  toggleCanteenStatus,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// Canteen status - GET is accessible by any logged-in user, PATCH is kitchen/admin
router.get('/canteen-status', protect, getCanteenStatus);
router.patch('/canteen-status', protect, authorize('admin', 'kitchen'), toggleCanteenStatus);

// Stats are visible to both kitchen and admin roles
router.get('/stats', protect, authorize('admin', 'kitchen'), getDashboardStats);

// User management is admin-only
router.get('/users', protect, authorize('admin'), getUsers);
router.patch('/users/:id/role', protect, authorize('admin'), updateUserRole);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

module.exports = router;
