const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleId: {
    type: String,
    sparse: true,
  },
  role: {
    type: String,
    enum: ['student', 'kitchen', 'admin'],
    default: 'student',
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  dailyCalorieGoal: {
    type: Number,
    default: 2200, // WHO base
  },
  dailyProteinGoal: {
    type: Number,
    default: 55,   // WHO base
  },
  dailyCarbGoal: {
    type: Number,
    default: 275,  // WHO base
  },
  dailyFatGoal: {
    type: Number,
    default: 70,   // WHO base
  },
  dailyFiberGoal: {
    type: Number,
    default: 30,   // WHO base
  },
  nutritionStreak: {
    type: Number,
    default: 0,
  },
  lastLoggedDate: {
    type: String,  // YYYY-MM-DD format
  },
}, {
  timestamps: true,
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = mongoose.model('User', userSchema);
