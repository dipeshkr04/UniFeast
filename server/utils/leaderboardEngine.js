const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');

// Simple in-memory cache to prevent DB overload. 5 minute TTL per period.
let cache = {};
const CACHE_TTL_MS = 5 * 60 * 1000;
const PERIODS = Object.freeze({
  weekly: 7,
  monthly: 30,
});

function normalizePeriod(period = 'weekly') {
  return Object.prototype.hasOwnProperty.call(PERIODS, period) ? period : 'weekly';
}

/**
 * Normalizes daily macros based on goals.
 */
function computeDailyScore(log, user) {
  // Goals
  const Gp = user.dailyProteinGoal || 50;
  const Gf = user.dailyFatGoal || 65;
  const Gcarb = user.dailyCarbGoal || 250;
  const Gfib = user.dailyFiberGoal || 30;
  const Gc = user.dailyCalorieGoal || 2000;

  // Actual Intake
  const t = log.dailyTotals;
  const Ap = t.protein || 0;
  const Af = t.fat || 0;
  const Acarb = t.carbs || 0;
  const Afib = t.fiber || 0;
  const Ac = t.calories || 0;

  // Clamped at 1
  const Sp = Math.min(Ap / Gp, 1);
  const Sfib = Math.min(Afib / Gfib, 1);
  
  // Clamped between 0 and 1
  const Sf = Math.max(0, 1 - Math.abs(Af - Gf) / Gf);
  const Scarb = Math.max(0, 1 - Math.abs(Acarb - Gcarb) / Gcarb);
  const Sc = Math.max(0, 1 - Math.abs(Ac - Gc) / Gc);

  const Sdaily = (0.3 * Sp) + (0.3 * Sc) + (0.2 * Sfib) + (0.1 * Sf) + (0.1 * Scarb);

  return { Sdaily, Sp, Sc, Sfib, Sf, Scarb };
}

/**
 * Calculates current tier based on normalized average score per day.
 */
function getTier(averageDailyScore) {
  if (averageDailyScore >= 0.9) return 'Elite';
  if (averageDailyScore >= 0.7) return 'Gold';
  if (averageDailyScore >= 0.5) return 'Silver';
  return 'Bronze';
}

/**
 * Computes all leaderboard vectors.
 */
async function computeLeaderboard(period = 'weekly') {
  const normalizedPeriod = normalizePeriod(period);
  const periodDays = PERIODS[normalizedPeriod];
  const users = await User.find({ role: 'student' }).select('name avatarUrl dailyCalorieGoal dailyProteinGoal dailyCarbGoal dailyFatGoal dailyFiberGoal nutritionStreak lastLoggedDate');
  
  // Date window logic (includes today)
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - (periodDays - 1));

  const logs = await NutritionLog.find({
    date: {
      $gte: windowStart.toISOString().split('T')[0],
      $lte: today.toISOString().split('T')[0],
    }
  });

  const results = users.map(user => {
    const userLogs = logs.filter(l => l.user.toString() === user._id.toString());
    
    let totalSdaily = 0;
    let totalSp = 0;
    let totalSc = 0;

    userLogs.forEach(log => {
      const { Sdaily, Sp, Sc } = computeDailyScore(log, user);
      totalSdaily += Sdaily;
      totalSp += Sp;
      totalSc += Sc;
    });

    const daysLogged = userLogs.length;
    const consistencyC = daysLogged / periodDays;

    // Final Aggregate Score with consistency multiplier
    let finalScore = totalSdaily * (0.7 + 0.3 * consistencyC);

    // Apply streak bonus capped at +7.0
    // We only apply streak bonus if the streak is active (logged yesterday or today)
    let activeStreak = 0;
    if (user.lastLoggedDate) {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      if (user.lastLoggedDate === todayStr || user.lastLoggedDate === yesterdayStr) {
        activeStreak = user.nutritionStreak || 0;
      }
    }
    
    const streakBonus = Math.min(activeStreak * 0.5, 7.0);
    finalScore += streakBonus;

    // Averages for categories and tier
    const averageSdaily = daysLogged > 0 ? (totalSdaily / daysLogged) : 0;
    const tier = getTier(averageSdaily);

    return {
      userId: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      score: Number(finalScore.toFixed(2)),
      proteinScore: Number(totalSp.toFixed(2)),
      calorieScore: Number(totalSc.toFixed(2)),
      consistency: Number((consistencyC * 100).toFixed(0)), // Percentage
      streak: activeStreak,
      tier,
      daysLogged,
      period: normalizedPeriod,
      periodDays
    };
  });

  return results;
}

/**
 * Returns sorted leaderboard. Uses 5-minute cache.
 */
async function getLeaderboardData(period = 'weekly') {
  const normalizedPeriod = normalizePeriod(period);
  const now = Date.now();
  const cachedPeriod = cache[normalizedPeriod];
  if (cachedPeriod?.data && cachedPeriod.timestamp && (now - cachedPeriod.timestamp) < CACHE_TTL_MS) {
    return cachedPeriod.data;
  }

  const data = await computeLeaderboard(normalizedPeriod);
  cache[normalizedPeriod] = {
    data,
    timestamp: now,
  };
  
  return data;
}

/**
 * Get sorted specific category
 */
async function getSortedLeaderboard(category = 'adherence', limit = 20, page = 1, period = 'weekly') {
  const normalizedPeriod = normalizePeriod(period);
  const data = await getLeaderboardData(normalizedPeriod);
  
  let sortedData = [...data];

  // Sorting
  switch (category) {
    case 'protein':
      sortedData.sort((a, b) => b.proteinScore - a.proteinScore);
      break;
    case 'calories':
      sortedData.sort((a, b) => b.calorieScore - a.calorieScore);
      break;
    case 'consistency':
      sortedData.sort((a, b) => b.consistency - a.consistency);
      break;
    case 'adherence':
    default:
      sortedData.sort((a, b) => b.score - a.score);
      break;
  }

  // Pagination
  const totalStudents = sortedData.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = sortedData.slice(startIndex, startIndex + limit);

  // Assign Ranks based on FULL sorted list
  const rankedPaginatedData = paginatedData.map(item => {
      const rankIndex = sortedData.findIndex(sd => sd.userId === item.userId);
      return { ...item, rank: rankIndex + 1 };
  });

  return {
    data: rankedPaginatedData,
    total: totalStudents,
    pages: Math.ceil(totalStudents / limit),
    period: normalizedPeriod,
    periodDays: PERIODS[normalizedPeriod]
  };
}

/**
 * Gets a specific user's rank context (top 5 + where user fits)
 */
async function getWidgetLeaderboard(userId, period = 'weekly') {
  const normalizedPeriod = normalizePeriod(period);
  const data = await getLeaderboardData(normalizedPeriod);
  let sortedData = [...data].sort((a, b) => b.score - a.score);
  
  // Assign ranks
  sortedData = sortedData.map((item, index) => ({ ...item, rank: index + 1 }));

  const top5 = sortedData.slice(0, 5);
  
  const userRankIndex = sortedData.findIndex(u => u.userId.toString() === userId.toString());
  const userStats = userRankIndex !== -1 ? sortedData[userRankIndex] : null;

  return { top5, userStats, period: normalizedPeriod, periodDays: PERIODS[normalizedPeriod] };
}

module.exports = {
  getSortedLeaderboard,
  getWidgetLeaderboard,
  computeLeaderboard // exported for testing/forcing cache refresh if needed
};
