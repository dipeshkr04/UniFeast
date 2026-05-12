const { getWidgetLeaderboard, getSortedLeaderboard } = require('../utils/leaderboardEngine');

// @desc    Get top 5 widget leaderboard
// @route   GET /api/leaderboard/widget
exports.getWidget = async (req, res) => {
  try {
    const period = req.query.period || 'allTime';
    const data = await getWidgetLeaderboard(req.user.id, period);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get full paginated leaderboard
// @route   GET /api/leaderboard/full
exports.getFullLeaderboard = async (req, res) => {
  try {
    const category = req.query.category || 'rank';
    const period = req.query.period || 'allTime';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 200;

    const data = await getSortedLeaderboard(category, limit, page, period, req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
