const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {OAuth2Client} = require('google-auth-library');
const { sendLoginOtpEmail } = require('../services/mail.service');
const {
    validateRegistrationEmail,
    validateInstitutionEmail,
    getReservedRoleForEmail,
    isRoleEmailAllowed
} = require('../services/email-validation.service');

const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const registerOtpStore = new Map();
const googleClient = new OAuth2Client();


function createSixDigitOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function clearExpiredOtpAttempts() {
    const now = Date.now();
    for (const [attemptToken, value] of registerOtpStore.entries()) {
        if (value.expiresAt <= now) {
            registerOtpStore.delete(attemptToken);
        }
    }
}

// @desc    Register user (Step 1: Check and send OTP)
// @route   POST /api/auth/register/request
async function requestRegisterOtp(req, res) {
    clearExpiredOtpAttempts();

    const { name, email, password, phone } = req.body;
    
    const emailValidation = await validateRegistrationEmail(email);
    if (!emailValidation.acceptable) {
        return res.status(400).json({ message: emailValidation.reason });
    }

    const normalizedEmail = emailValidation.normalizedEmail;
    const reservedRole = getReservedRoleForEmail(normalizedEmail);

    if (reservedRole) {
        return res.status(403).json({
            message: `This email is reserved for ${reservedRole} access and cannot be used for student self-registration.`
        });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
    }

    const otpCode = createSixDigitOtp();
    const attemptToken = crypto.randomBytes(32).toString('hex');
    const otpHash = await bcrypt.hash(otpCode, 8);
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const allowDevOtpFallback = process.env.ALLOW_DEV_OTP_FALLBACK === 'true';
    let devOtp = '';

    registerOtpStore.set(attemptToken, {
        name,
        email: normalizedEmail,
        password,
        role: 'student',
        phone: phone || '',
        otpHash,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
        attempts: 0
    });

    try {
        await sendLoginOtpEmail({
            to: normalizedEmail,
            otpCode,
            expiryMinutes: Math.floor(OTP_EXPIRY_MS / 60000)
        });
    } catch (error) {
        if (isDevelopment && allowDevOtpFallback) {
            devOtp = otpCode;
            console.warn('OTP email failed, using development fallback OTP.', error.message);
        } else {
            registerOtpStore.delete(attemptToken);
            return res.status(500).json({
                message: 'Unable to send OTP. Please configure SMTP_USER and SMTP_PASS in backend .env.'
            });
        }
    }

    return res.status(200).json({
        message: 'OTP sent to your email to confirm registration.',
        attemptToken,
        expiresInMs: OTP_EXPIRY_MS,
        ...(devOtp ? { devOtp } : {})
    });
}

// @desc    Verify OTP and Create Account
// @route   POST /api/auth/register/verify
async function verifyRegisterOtp(req, res) {
    clearExpiredOtpAttempts();

    const { attemptToken, otp } = req.body;
    const otpSession = registerOtpStore.get(String(attemptToken || ''));

    if (!otpSession) {
        return res.status(400).json({ message: 'OTP session expired. Restart registration.' });
    }

    if (otpSession.expiresAt <= Date.now()) {
        registerOtpStore.delete(attemptToken);
        return res.status(400).json({ message: 'OTP expired. Restart registration.' });
    }

    const isOtpValid = await bcrypt.compare(String(otp || ''), otpSession.otpHash);
    if (!isOtpValid) {
        otpSession.attempts += 1;

        if (otpSession.attempts >= OTP_MAX_ATTEMPTS) {
            registerOtpStore.delete(attemptToken);
        } else {
            registerOtpStore.set(attemptToken, otpSession);
        }

        return res.status(400).json({ message: 'Invalid OTP.' });
    }

    registerOtpStore.delete(attemptToken);
    
    try {
        const existingUser = await User.findOne({ email: otpSession.email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const user = await User.create({
            name: otpSession.name,
            email: otpSession.email,
            password: otpSession.password, 
            role: otpSession.role,
            phone: otpSession.phone,
            authProvider: 'local'
        });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.cookie('token', token, authCookieOptions);

        return res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                email: user.email,
                _id: user._id,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Registration failed internal error.' });
    }
}


// @desc    Login user Standard
// @route   POST /api/auth/login
async function loginUser(req, res) {
    try {
        const { email, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        const emailValidation = validateInstitutionEmail(normalizedEmail);
        if (!emailValidation.acceptable) {
            return res.status(400).json({ message: emailValidation.reason });
        }

        // Need to explicitly select password for comparison
        const user = await User.findOne({ email: normalizedEmail }).select('+password');

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        if (user.authProvider !== 'local' || !user.password) {
            return res.status(400).json({ message: 'This email is linked to a Google account. Please use Google Sign-In.' });
        }

        if (!isRoleEmailAllowed(user.email, user.role)) {
            return res.status(403).json({
                message: `This account is not allowed for ${user.role} access. Contact the system admin.`
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.cookie('token', token, authCookieOptions);

        return res.status(200).json({
            message: 'User logged in successfully',
            token,
            user: {
                email: user.email,
                _id: user._id,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


async function googleSignin(req, res) {
    try {
        const { idToken } = req.body;
        const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();

        if (!googleClientId) {
            return res.status(500).json({ message: 'GOOGLE_CLIENT_ID is not configured on server.' });
        }

        if (!idToken) {
            return res.status(400).json({ message: 'Google idToken is required.' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: googleClientId
        });

        const payload = ticket.getPayload();
        const email = String(payload?.email || '').trim().toLowerCase();
        const emailVerified = payload?.email_verified === true;
        const googleSub = String(payload?.sub || '').trim();

        if (!email || !emailVerified || !googleSub) {
            return res.status(400).json({ message: 'Invalid Google account payload.' });
        }

        const emailValidation = validateInstitutionEmail(email);
        if (!emailValidation.acceptable) {
            return res.status(400).json({ message: emailValidation.reason });
        }

        const reservedRole = getReservedRoleForEmail(email);

        let user = await User.findOne({ email });

        if (!user) {
            if (reservedRole) {
                return res.status(403).json({
                    message: `This email is reserved for ${reservedRole} access and must be registered by an admin.`
                });
            }

            const name = String(payload?.given_name || payload?.name || 'Google').trim() || 'Google';

            user = await User.create({
                email,
                authProvider: 'google',
                googleId: googleSub,
                name
            });
        } else {
            let shouldSave = false;
            
            if (!user.googleId) {
                user.googleId = googleSub;
                shouldSave = true;
            }

            if (user.authProvider !== 'google') {
                // If a local user logs in with google, we merge them and set authProvider
                user.authProvider = 'google';
                shouldSave = true;
            }

            if (shouldSave) {
                await user.save();
            }
        }

        if (!isRoleEmailAllowed(user.email, user.role)) {
            return res.status(403).json({
                message: `This account is not allowed for ${user.role} access. Contact the system admin.`
            });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.cookie('token', token, authCookieOptions);

        return res.status(200).json({
            message: 'Google sign-in successful',
            token,
            user: {
                email: user.email,
                _id: user._id,
                name: user.name,
                role: user.role
            }
        });
    } catch (_error) {
        return res.status(400).json({ message: 'Google sign-in failed. Try again.' });
    }
}

async function checkRegistrationEmail(req, res) {
    const { email } = req.body;
    const validation = await validateRegistrationEmail(email);

    if (!validation.acceptable) {
        return res.status(400).json({
            message: validation.reason,
            email: validation.normalizedEmail,
            exists: false
        });
    }

    const reservedRole = getReservedRoleForEmail(validation.normalizedEmail);
    if (reservedRole) {
        return res.status(403).json({
            message: `This email is reserved for ${reservedRole} access and cannot be used for student self-registration.`,
            email: validation.normalizedEmail,
            exists: true
        });
    }

    const existingUser = await User.findOne({ email: validation.normalizedEmail });

    return res.status(200).json({
        message: existingUser ? 'Email already registered.' : validation.reason,
        email: validation.normalizedEmail,
        exists: Boolean(existingUser)
    });
}


async function logoutUser(req, res) {
    res.clearCookie('token', authCookieOptions);
    return res.status(200).json({ message: 'Logged out successfully' });
}

// @desc    Get current logged in user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const fields = ['name', 'phone', 'dailyCalorieGoal', 'dailyProteinGoal', 'dailyCarbGoal', 'dailyFatGoal'];
    const updates = {};
    fields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
    requestRegisterOtp,
    verifyRegisterOtp,
    loginUser,
    logoutUser,
    checkRegistrationEmail,
    googleSignin,
    getMe,
    updateProfile
};