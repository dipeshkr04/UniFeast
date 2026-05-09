const express = require('express');
const router = express.Router();
const {
  getMenuItems,
  getMenuItem,
  analyzeMenuNutrition,
  updateMenuStock,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
} = require('../controllers/menuController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const upload = require('../middleware/upload');

router.get('/', getMenuItems);
router.post('/analyze-nutrition', protect, authorize('admin', 'kitchen'), upload.single('image'), analyzeMenuNutrition);
router.get('/:id', getMenuItem);
router.patch('/:id/stock', protect, authorize('admin', 'kitchen'), updateMenuStock);
router.post('/', protect, authorize('admin', 'kitchen'), upload.single('image'), createMenuItem);
router.put('/:id', protect, authorize('admin', 'kitchen'), upload.single('image'), updateMenuItem);
router.delete('/:id', protect, authorize('admin', 'kitchen'), deleteMenuItem);
router.patch('/:id/toggle', protect, authorize('admin', 'kitchen'), toggleAvailability);

module.exports = router;
