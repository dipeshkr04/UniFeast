const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const setupSocketHandlers = require('./utils/socketHandler');
const { startPoolCleanup } = require('./utils/poolEngine');
const { startDailyStockReset } = require('./utils/dailyStock');
const { startCartReservationCleanup } = require('./utils/cartReservations');
const { startOutsideFoodPoolSweep } = require('./jobs/outsideFoodPoolSweep');

// Import routes
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const poolRoutes = require('./routes/pools');
const nutritionRoutes = require('./routes/nutrition');
const adminRoutes = require('./routes/admin');
const leaderboardRoutes = require('./routes/leaderboard');
const paymentRoutes = require('./routes/payment');
const cartRoutes = require('./routes/cart');
const outsideFoodRoutes = require('./routes/outsideFood');
const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup socket handlers and store reference
const socketHandlers = setupSocketHandlers(io);
app.set('socketHandlers', socketHandlers);
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/payments',paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/outside-food', outsideFoodRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Start pool cleanup timer
    startPoolCleanup(io);
    startDailyStockReset(io);
    startCartReservationCleanup(io);
    startOutsideFoodPoolSweep(io);
    
    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║         🍽️  UniFeast Server Running          ║
║──────────────────────────────────────────────║
║  Port:     ${PORT}                             ║
║  Mode:     ${process.env.NODE_ENV || 'development'}                    ║
║  API:      http://localhost:${PORT}/api          ║
║  Socket:   ws://localhost:${PORT}                ║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
