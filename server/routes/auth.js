const express = require('express');
const router = express.Router();
const { 
    requestRegisterOtp, 
    verifyRegisterOtp, 
    loginUser, 
    googleSignin, 
    getMe, 
    updateProfile 
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register/request', requestRegisterOtp);
router.post('/register/verify', verifyRegisterOtp);
router.post('/login', loginUser);
router.post('/google', googleSignin);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
