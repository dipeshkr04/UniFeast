const User = require('../models/User');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Settings = require('../models/Settings');
const { isRoleEmailAllowed } = require('../services/email-validation.service');

const RECOGNIZED_ORDER_MATCH = { status: { $ne: 'cancelled' } };

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDateRange(query = {}) {
  const preset = query.preset || 'month';
  const now = new Date();
  let start = null;
  let end = endOfDay(now);

  if (preset === 'custom') {
    if (query.startDate) start = startOfDay(new Date(query.startDate));
    if (query.endDate) end = endOfDay(new Date(query.endDate));
  } else if (preset === 'today') {
    start = startOfDay(now);
  } else if (preset === 'week') {
    start = startOfDay(addDays(now, -6));
  } else if (preset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (preset === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (preset === 'all') {
    start = null;
    end = null;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (start && Number.isNaN(start.getTime())) start = null;
  if (end && Number.isNaN(end.getTime())) end = endOfDay(now);

  return { preset, start, end };
}

function withDateRange(match, start, end) {
  if (!start && !end) return { ...match };
  const createdAt = {};
  if (start) createdAt.$gte = start;
  if (end) createdAt.$lte = end;
  return { ...match, createdAt };
}

function getBtId(email = '') {
  const local = String(email).split('@')[0] || '';
  const match = local.match(/bt\d{2}[a-z0-9]+/i);
  return match ? match[0].toUpperCase() : local.toUpperCase();
}

function getCohort(email = '') {
  const btid = getBtId(email);
  const match = btid.match(/^BT(\d{2})/i);
  return match ? `BT${match[1]}` : 'UNKNOWN';
}

function enrichStudent(row) {
  const email = row.email || '';
  const orders = row.orders || 0;
  const totalSpent = row.totalSpent || 0;
  return {
    ...row,
    name: row.name || 'Unknown student',
    email,
    btId: getBtId(email),
    cohort: getCohort(email),
    totalSpent,
    orders,
    averageOrderValue: orders ? Math.round((totalSpent / orders) * 100) / 100 : 0,
  };
}

function toDateLabel(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function aggregateItemSales(match, limit = 5, sortDirection = -1) {
  return Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: { $ifNull: ['$items.name', 'Unnamed item'] },
        quantity: { $sum: '$items.quantity' },
        revenue: {
          $sum: {
            $multiply: [
              '$items.quantity',
              { $ifNull: ['$items.price', 0] },
            ],
          },
        },
        orders: { $sum: 1 },
      },
    },
    { $sort: { quantity: sortDirection, revenue: sortDirection } },
    { $limit: limit },
  ]);
}

async function aggregateStudentSpending(match) {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$user',
        totalSpent: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        name: '$student.name',
        email: '$student.email',
        totalSpent: 1,
        orders: 1,
      },
    },
    { $sort: { totalSpent: -1 } },
  ]);

  return rows.map(enrichStudent);
}

async function aggregateNightSpending(match) {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $addFields: {
        orderHour: { $hour: { date: '$createdAt', timezone: '+05:30' } },
      },
    },
    {
      $match: {
        $or: [
          { orderHour: { $gte: 20 } },
          { orderHour: { $lt: 5 } },
        ],
      },
    },
    {
      $group: {
        _id: '$user',
        totalSpent: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        name: '$student.name',
        email: '$student.email',
        totalSpent: 1,
        orders: 1,
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 },
  ]);

  return rows.map(enrichStudent);
}

function summarizeCohorts(students) {
  const map = new Map();
  students.forEach((student) => {
    const key = student.cohort || 'UNKNOWN';
    const current = map.get(key) || { cohort: key, totalSpent: 0, orders: 0, students: 0 };
    current.totalSpent += student.totalSpent || 0;
    current.orders += student.orders || 0;
    current.students += 1;
    map.set(key, current);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      averagePerStudent: row.students ? Math.round((row.totalSpent / row.students) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

async function aggregatePeriodSeries(match, start, end, preset) {
  let format = '%Y-%m-%d';
  if (preset === 'year' || preset === 'all') format = '%Y-%m';
  if (start && end) {
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    if (days > 370) format = '%Y';
    else if (days > 90) format = '%Y-%m';
  }

  return Order.aggregate([
    { $match: match },
    { $addFields: { itemCount: { $sum: '$items.quantity' } } },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt', timezone: '+05:30' } },
        sales: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
        itemsSold: { $sum: '$itemCount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function sumFoodSold(match) {
  const rows = await Order.aggregate([
    { $match: match },
    { $addFields: { itemCount: { $sum: '$items.quantity' } } },
    {
      $group: {
        _id: null,
        itemsSold: { $sum: '$itemCount' },
        sales: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
  ]);
  return rows[0] || { itemsSold: 0, sales: 0, orders: 0 };
}

// @desc    Get all users (admin only)
// @route   GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user role
// @route   PATCH /api/admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'kitchen', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!isRoleEmailAllowed(user.email, role)) {
      return res.status(400).json({
        success: false,
        message: `Email ${user.email} is not allowed for ${role} role.`
      });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const { preset, start, end } = parseDateRange(req.query);
    const rangeMatch = withDateRange(RECOGNIZED_ORDER_MATCH, start, end);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const currentWeekStart = startOfDay(addDays(new Date(), -6));
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const currentYearStart = new Date(new Date().getFullYear(), 0, 1);

    const [
      totalUsers,
      totalMenuItems,
      todayOrders,
      todayRevenue,
      popularItems,
      usersByRole,
      allTimeRevenue,
      rangeSummary,
      topItems,
      leastItems,
      todayTopItems,
      weekTopItems,
      monthTopItems,
      yearTopItems,
      studentSpending,
      nightSpending,
      periodSeries,
      weeklyFoodSold,
      monthlyFoodSold,
      yearlyFoodSold,
    ] = await Promise.all([
      User.countDocuments(),
      MenuItem.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      // Revenue = only COMPLETED orders (recognized on completion)
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.name', count: { $sum: '$items.quantity' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: RECOGNIZED_ORDER_MATCH },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      ]),
      sumFoodSold(rangeMatch),
      aggregateItemSales(rangeMatch, 5, -1),
      aggregateItemSales(rangeMatch, 5, 1),
      aggregateItemSales(withDateRange(RECOGNIZED_ORDER_MATCH, today, tomorrow), 5, -1),
      aggregateItemSales(withDateRange(RECOGNIZED_ORDER_MATCH, currentWeekStart, endOfDay(new Date())), 5, -1),
      aggregateItemSales(withDateRange(RECOGNIZED_ORDER_MATCH, currentMonthStart, endOfDay(new Date())), 5, -1),
      aggregateItemSales(withDateRange(RECOGNIZED_ORDER_MATCH, currentYearStart, endOfDay(new Date())), 5, -1),
      aggregateStudentSpending(rangeMatch),
      aggregateNightSpending(rangeMatch),
      aggregatePeriodSeries(rangeMatch, start, end, preset),
      sumFoodSold(withDateRange(RECOGNIZED_ORDER_MATCH, currentWeekStart, endOfDay(new Date()))),
      sumFoodSold(withDateRange(RECOGNIZED_ORDER_MATCH, currentMonthStart, endOfDay(new Date()))),
      sumFoodSold(withDateRange(RECOGNIZED_ORDER_MATCH, currentYearStart, endOfDay(new Date()))),
    ]);

    const cohortSpending = summarizeCohorts(studentSpending);
    const topStudentSpenders = studentSpending.slice(0, 10);
    const repeatStudents = studentSpending.filter((student) => student.orders > 1).length;
    const activeStudents = studentSpending.length;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMenuItems,
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        totalRevenue: allTimeRevenue[0]?.total || 0,
        totalOrders: allTimeRevenue[0]?.orders || 0,
        popularItems,
        usersByRole: usersByRole.reduce((acc, r) => {
          acc[r._id] = r.count;
          return acc;
        }, {}),
        analyticsRange: {
          preset,
          startDate: toDateLabel(start),
          endDate: toDateLabel(end),
        },
        rangeSummary: {
          grossSales: rangeSummary.sales || 0,
          orders: rangeSummary.orders || 0,
          itemsSold: rangeSummary.itemsSold || 0,
          averageOrderValue: rangeSummary.orders
            ? Math.round((rangeSummary.sales / rangeSummary.orders) * 100) / 100
            : 0,
          activeStudents,
          repeatStudents,
        },
        topItems,
        leastItems,
        topItemsByPeriod: {
          today: todayTopItems,
          week: weekTopItems,
          month: monthTopItems,
          year: yearTopItems,
          selectedRange: topItems,
        },
        foodSoldRollups: {
          week: weeklyFoodSold,
          month: monthlyFoodSold,
          year: yearlyFoodSold,
        },
        studentSpending: topStudentSpenders,
        cohortSpending,
        nightCanteenSpending: nightSpending,
        periodSeries,
        insights: {
          mostPurchasedItem: topItems[0] || null,
          leastPurchasedItem: leastItems[0] || null,
          strongestCohort: cohortSpending[0] || null,
          topSpender: topStudentSpenders[0] || null,
          nightCanteenLeader: nightSpending[0] || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get canteen live status
// @route   GET /api/admin/canteen-status
exports.getCanteenStatus = async (req, res) => {
  try {
    const isLive = await Settings.getCanteenStatus();
    res.json({ success: true, data: { isLive } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle canteen live status
// @route   PATCH /api/admin/canteen-status
exports.toggleCanteenStatus = async (req, res) => {
  try {
    const { isLive } = req.body;
    if (typeof isLive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isLive must be a boolean' });
    }

    await Settings.setCanteenStatus(isLive, req.user.id);

    // Broadcast to ALL connected clients via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('canteen-status', { isLive });
    }

    res.json({ success: true, data: { isLive } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get cart hold release window
// @route   GET /api/admin/cart-hold-window
exports.getCartHoldWindow = async (req, res) => {
  try {
    const holdMs = await Settings.getCartHoldMs();
    res.json({ success: true, data: { holdMs } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update cart hold release window
// @route   PATCH /api/admin/cart-hold-window
exports.updateCartHoldWindow = async (req, res) => {
  try {
    const minutes = Number(req.body.minutes || 0);
    const seconds = Number(req.body.seconds || 0);
    const holdMs = req.body.holdMs !== undefined
      ? Number(req.body.holdMs)
      : ((minutes * 60) + seconds) * 1000;

    const setting = await Settings.setCartHoldMs(holdMs, req.user.id);
    const io = req.app.get('io');
    if (io) {
      io.emit('cart-hold-window', { holdMs: setting.value });
    }

    res.json({ success: true, data: { holdMs: setting.value } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
