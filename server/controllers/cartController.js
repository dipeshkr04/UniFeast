const {
  setCartReservation,
  releaseUserCartReservation,
  releaseUserCartReservations,
} = require('../utils/cartReservations');

exports.holdCartItem = async (req, res) => {
  try {
    const { menuItemId, quantity } = req.body;
    if (!menuItemId) {
      return res.status(400).json({ success: false, message: 'menuItemId is required' });
    }

    const result = await setCartReservation({
      userId: req.user.id,
      menuItemId,
      quantity,
      io: req.app.get('io'),
    });

    res.json({
      success: true,
      data: {
        menuItem: result.menuItem,
        reservation: result.reservation,
        holdMs: result.holdMs,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.releaseCartItem = async (req, res) => {
  try {
    await releaseUserCartReservation(req.user.id, req.params.menuItemId, req.app.get('io'));
    res.json({ success: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.clearCartHolds = async (req, res) => {
  try {
    await releaseUserCartReservations(req.user.id, req.app.get('io'));
    res.json({ success: true });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
