const express = require('express');
const router = express.Router();
const { getWidget, getFullLeaderboard } = require('../controllers/leaderboardController');
const { protect } = require('../middleware/auth');

router.get('/widget', protect, getWidget);
router.get('/full', protect, getFullLeaderboard);

module.exports = router;
