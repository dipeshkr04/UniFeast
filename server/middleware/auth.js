const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isRoleEmailAllowed } = require('../services/email-validation.service');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!isRoleEmailAllowed(req.user.email, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `This account is not allowed for ${req.user.role} access.`
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized - invalid token' });
  }
};

module.exports = { protect };
