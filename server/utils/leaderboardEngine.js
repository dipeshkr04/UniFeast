const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');

// Simple in-memory cache to prevent DB overload. 5 minute TTL per period.
let cache = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

const PERIODS = Object.freeze({
  weekly: 7,
  monthly: 30,
  allTime: null,
});

const BADGE_TIERS = Object.freeze([
  { id: 'bronze', name: 'Begin', days: 0, xp: 0, adherence: 0 },
  { id: 'silver', name: 'Build', days: 14, xp: 1000, adherence: 60 },
  { id: 'gold', name: 'Balance', days: 28, xp: 2500, adherence: 65 },
  { id: 'diamond', name: 'Steady', days: 50, xp: 5000, adherence: 70 },
  { id: 'platinum', name: 'Aligned', days: 100, xp: 12000, adherence: 75 },
  { id: 'elite', name: 'Sustain', days: 200, xp: 28000, adherence: 80 },
  { id: 'legend', name: 'Thrive', days: 365, xp: 60000, adherence: 85 },
]);

const ADHERENCE_WEIGHTS = Object.freeze({
  calories: 0.35,
  protein: 0.25,
  fiber: 0.15,
  carbs: 0.15,
  fat: 0.10,
});

const PROGRESS_WEIGHTS = Object.freeze({
  consistency: 0.40,
  adherence: 0.35,
  xp: 0.25,
});

function normalizePeriod(period = 'allTime') {
  return Object.prototype.hasOwnProperty.call(PERIODS, period) ? period : 'allTime';
}

function toDateString(date) {
  return date.toISOString().split('T')[0];
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function safeGoal(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasMealData(log) {
  if (Array.isArray(log.meals) && log.meals.length > 0) return true;
  const totals = log.dailyTotals || {};
  return ['calories', 'protein', 'carbs', 'fat', 'fiber'].some(key => Number(totals[key] || 0) > 0);
}

function getPeriodStart(period, today = new Date()) {
  const normalizedPeriod = normalizePeriod(period);
  const periodDays = PERIODS[normalizedPeriod];
  if (!periodDays) return null;

  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - (periodDays - 1));
  return toDateString(windowStart);
}

/**
 * Scores a daily log against the student's goals.
 * Protein and fiber reward reaching the target. Calories, carbs, and fat reward closeness.
 */
function computeDailyScore(log, user) {
  const goals = {
    protein: safeGoal(user.dailyProteinGoal, 55),
    fat: safeGoal(user.dailyFatGoal, 70),
    carbs: safeGoal(user.dailyCarbGoal, 275),
    fiber: safeGoal(user.dailyFiberGoal, 30),
    calories: safeGoal(user.dailyCalorieGoal, 2200),
  };
  const totals = log.dailyTotals || {};

  const protein = Math.min(Number(totals.protein || 0) / goals.protein, 1);
  const fiber = Math.min(Number(totals.fiber || 0) / goals.fiber, 1);
  const fat = Math.max(0, 1 - Math.abs(Number(totals.fat || 0) - goals.fat) / goals.fat);
  const carbs = Math.max(0, 1 - Math.abs(Number(totals.carbs || 0) - goals.carbs) / goals.carbs);
  const calories = Math.max(0, 1 - Math.abs(Number(totals.calories || 0) - goals.calories) / goals.calories);

  const dailyScore =
    (ADHERENCE_WEIGHTS.calories * calories) +
    (ADHERENCE_WEIGHTS.protein * protein) +
    (ADHERENCE_WEIGHTS.fiber * fiber) +
    (ADHERENCE_WEIGHTS.carbs * carbs) +
    (ADHERENCE_WEIGHTS.fat * fat);
  const adherence = Number((dailyScore * 100).toFixed(0));

  return {
    dailyScore,
    adherence,
    proteinScore: protein,
    calorieScore: calories,
    fiberScore: fiber,
  };
}

function computeDailyXp(log, user) {
  if (!hasMealData(log)) {
    return { xp: 0, breakdown: [] };
  }

  const { adherence } = computeDailyScore(log, user);
  const totals = log.dailyTotals || {};
  const mealTypes = new Set((log.meals || []).map(meal => meal.mealType).filter(Boolean));
  const breakdown = [{ label: 'Meal logged', xp: 20 }];

  if ((log.meals || []).length >= 2 || mealTypes.size >= 2) {
    breakdown.push({ label: 'Meaningful daily log', xp: 30 });
  }

  if (adherence >= 85) {
    breakdown.push({ label: 'Excellent adherence', xp: 70 });
  } else if (adherence >= 70) {
    breakdown.push({ label: 'Strong adherence', xp: 40 });
  }

  if (Number(totals.protein || 0) >= safeGoal(user.dailyProteinGoal, 55)) {
    breakdown.push({ label: 'Protein target', xp: 20 });
  }

  if (Number(totals.fiber || 0) >= safeGoal(user.dailyFiberGoal, 30)) {
    breakdown.push({ label: 'Fiber target', xp: 20 });
  }

  const calorieGoal = safeGoal(user.dailyCalorieGoal, 2200);
  const calories = Number(totals.calories || 0);
  const calorieAccuracy = calorieGoal > 0 ? Math.abs(calories - calorieGoal) / calorieGoal : 1;
  if (calorieAccuracy <= 0.1) {
    breakdown.push({ label: 'Calorie accuracy', xp: 20 });
  }

  const xp = Math.min(breakdown.reduce((sum, item) => sum + item.xp, 0), 200);
  return { xp, breakdown };
}

function countsForConsistency(log, user) {
  if (!hasMealData(log)) return false;
  return computeDailyScore(log, user).adherence >= 50;
}

function computeCurrentStreak(userLogs, user, today = new Date()) {
  const validDates = new Set(
    userLogs
      .filter(log => countsForConsistency(log, user))
      .map(log => log.date)
  );

  let cursor = new Date(today);
  let cursorDate = toDateString(cursor);
  if (!validDates.has(cursorDate)) {
    cursor.setDate(cursor.getDate() - 1);
    cursorDate = toDateString(cursor);
  }

  let streak = 0;
  while (validDates.has(cursorDate)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
    cursorDate = toDateString(cursor);
  }

  return streak;
}

function getBadge(totalConsistentDays, totalXp, averageAdherence) {
  return BADGE_TIERS.reduce((current, tier) => {
    const qualifies =
      totalConsistentDays >= tier.days &&
      totalXp >= tier.xp &&
      averageAdherence >= tier.adherence;

    return qualifies ? tier : current;
  }, BADGE_TIERS[0]);
}

function getNextBadge(currentBadge) {
  const index = BADGE_TIERS.findIndex(tier => tier.id === currentBadge.id);
  return BADGE_TIERS[index + 1] || null;
}

function buildBadgeProgress(nextBadge, totalConsistentDays, totalXp, averageAdherence) {
  if (!nextBadge) {
    return {
      overall: 100,
      days: 100,
      xp: 100,
      adherence: 100,
      remainingDays: 0,
      remainingXp: 0,
      remainingAdherence: 0,
    };
  }

  const days = nextBadge.days > 0 ? clamp((totalConsistentDays / nextBadge.days) * 100) : 100;
  const xp = nextBadge.xp > 0 ? clamp((totalXp / nextBadge.xp) * 100) : 100;
  const adherence = nextBadge.adherence > 0 ? clamp((averageAdherence / nextBadge.adherence) * 100) : 100;

  return {
    overall: Number(Math.min(days, xp, adherence).toFixed(0)),
    days: Number(days.toFixed(0)),
    xp: Number(xp.toFixed(0)),
    adherence: Number(adherence.toFixed(0)),
    remainingDays: Math.max(0, nextBadge.days - totalConsistentDays),
    remainingXp: Math.max(0, nextBadge.xp - totalXp),
    remainingAdherence: Math.max(0, Number((nextBadge.adherence - averageAdherence).toFixed(0))),
  };
}

function computeProgressScore(nextBadge, totalConsistentDays, totalXp, averageAdherence) {
  if (!nextBadge) return 100;

  const daysProgress = nextBadge.days > 0 ? clamp((totalConsistentDays / nextBadge.days) * 100) : 100;
  const xpProgress = nextBadge.xp > 0 ? clamp((totalXp / nextBadge.xp) * 100) : 100;
  const adherenceProgress = nextBadge.adherence > 0 ? clamp((averageAdherence / nextBadge.adherence) * 100) : 100;

  return Math.round(
    (PROGRESS_WEIGHTS.consistency * daysProgress) +
    (PROGRESS_WEIGHTS.xp * xpProgress) +
    (PROGRESS_WEIGHTS.adherence * adherenceProgress)
  );
}

function computeUserResult(user, allLogs, periodLogs, normalizedPeriod, today) {
  const userId = user._id.toString();
  const userAllLogs = allLogs.filter(log => log.user.toString() === userId);
  const userPeriodLogs = periodLogs.filter(log => log.user.toString() === userId);
  const scoredAllLogs = userAllLogs.filter(hasMealData);
  const scoredPeriodLogs = userPeriodLogs.filter(hasMealData);

  let totalXp = 0;
  let periodXp = 0;
  let totalAdherence = 0;
  let periodAdherenceTotal = 0;
  let totalProteinScore = 0;
  let periodProteinScore = 0;
  let totalCalorieScore = 0;
  let periodCalorieScore = 0;

  scoredAllLogs.forEach(log => {
    const score = computeDailyScore(log, user);
    totalAdherence += score.adherence;
    totalProteinScore += score.proteinScore;
    totalCalorieScore += score.calorieScore;
    totalXp += computeDailyXp(log, user).xp;
  });

  scoredPeriodLogs.forEach(log => {
    const score = computeDailyScore(log, user);
    periodAdherenceTotal += score.adherence;
    periodProteinScore += score.proteinScore;
    periodCalorieScore += score.calorieScore;
    periodXp += computeDailyXp(log, user).xp;
  });

  const totalConsistentDays = userAllLogs.filter(log => countsForConsistency(log, user)).length;
  const periodConsistentDays = userPeriodLogs.filter(log => countsForConsistency(log, user)).length;
  const averageAdherence = scoredAllLogs.length > 0 ? totalAdherence / scoredAllLogs.length : 0;
  const periodAdherence = scoredPeriodLogs.length > 0 ? periodAdherenceTotal / scoredPeriodLogs.length : 0;
  const periodDays = PERIODS[normalizedPeriod];
  const consistency =
    normalizedPeriod === 'allTime'
      ? clamp((totalConsistentDays / 365) * 100)
      : clamp((periodConsistentDays / periodDays) * 100);
  const activeStreak = computeCurrentStreak(userAllLogs, user, today);
  const badge = getBadge(totalConsistentDays, totalXp, averageAdherence);
  const nextBadge = getNextBadge(badge);
  const badgeProgress = buildBadgeProgress(nextBadge, totalConsistentDays, totalXp, averageAdherence);
  const progressScore = computeProgressScore(nextBadge, totalConsistentDays, totalXp, averageAdherence);

  return {
    userId: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    rankScore: progressScore,
    progressScore,
    score: progressScore,
    totalXP: totalXp,
    periodXP: periodXp,
    xp: totalXp,
    adherence: Number(averageAdherence.toFixed(0)),
    periodAdherence: Number(periodAdherence.toFixed(0)),
    consistency: Number(consistency.toFixed(0)),
    totalConsistentDays,
    periodConsistentDays,
    daysLogged: normalizedPeriod === 'allTime' ? totalConsistentDays : periodConsistentDays,
    streak: activeStreak,
    badge,
    nextBadge,
    badgeProgress,
    tier: badge.name,
    proteinScore: Number((normalizedPeriod === 'allTime' ? totalProteinScore : periodProteinScore).toFixed(2)),
    calorieScore: Number((normalizedPeriod === 'allTime' ? totalCalorieScore : periodCalorieScore).toFixed(2)),
    period: normalizedPeriod,
    periodDays: periodDays || 365,
  };
}

async function computeLeaderboard(period = 'allTime') {
  const normalizedPeriod = normalizePeriod(period);
  const today = new Date();
  const users = await User.find({ role: 'student' }).select(
    'name avatarUrl dailyCalorieGoal dailyProteinGoal dailyCarbGoal dailyFatGoal dailyFiberGoal'
  );

  const userIds = users.map(user => user._id);
  const allLogs = await NutritionLog.find({ user: { $in: userIds } });
  const periodStart = getPeriodStart(normalizedPeriod, today);
  const todayStr = toDateString(today);
  const periodLogs = periodStart
    ? allLogs.filter(log => log.date >= periodStart && log.date <= todayStr)
    : allLogs;

  return users.map(user => computeUserResult(user, allLogs, periodLogs, normalizedPeriod, today));
}

async function getLeaderboardData(period = 'allTime') {
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

function invalidateLeaderboardCache() {
  cache = {};
}

function compareByBadge(a, b) {
  const badgeRankA = BADGE_TIERS.findIndex(tier => tier.id === a.badge.id);
  const badgeRankB = BADGE_TIERS.findIndex(tier => tier.id === b.badge.id);
  return badgeRankB - badgeRankA;
}

function sortLeaderboard(data, category = 'rank') {
  const sortedData = [...data];

  switch (category) {
    case 'badge':
      sortedData.sort((a, b) =>
        compareByBadge(a, b) ||
        b.totalXP - a.totalXP ||
        b.totalConsistentDays - a.totalConsistentDays ||
        b.adherence - a.adherence
      );
      break;
    case 'xp':
      sortedData.sort((a, b) => b.totalXP - a.totalXP || b.rankScore - a.rankScore);
      break;
    case 'adherence':
      sortedData.sort((a, b) => b.adherence - a.adherence || b.rankScore - a.rankScore);
      break;
    case 'protein':
      sortedData.sort((a, b) => b.proteinScore - a.proteinScore || b.rankScore - a.rankScore);
      break;
    case 'calories':
      sortedData.sort((a, b) => b.calorieScore - a.calorieScore || b.rankScore - a.rankScore);
      break;
    case 'consistency':
      sortedData.sort((a, b) =>
        b.totalConsistentDays - a.totalConsistentDays ||
        b.streak - a.streak ||
        b.rankScore - a.rankScore
      );
      break;
    case 'rank':
    default:
      sortedData.sort((a, b) =>
        compareByBadge(a, b) ||
        b.totalXP - a.totalXP ||
        b.totalConsistentDays - a.totalConsistentDays ||
        b.adherence - a.adherence
      );
      break;
  }

  return sortedData;
}

async function getSortedLeaderboard(category = 'rank', limit = 200, page = 1, period = 'allTime', currentUserId = null) {
  const normalizedPeriod = normalizePeriod(period);
  const data = await getLeaderboardData(normalizedPeriod);
  const sortedData = sortLeaderboard(data, category).map((item, index) => ({ ...item, rank: index + 1 }));
  const totalStudents = sortedData.length;
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const startIndex = (safePage - 1) * safeLimit;
  const paginatedData = sortedData.slice(startIndex, startIndex + safeLimit);
  const currentUser = currentUserId
    ? sortedData.find(user => user.userId.toString() === currentUserId.toString()) || null
    : null;

  return {
    data: paginatedData,
    currentUser,
    total: totalStudents,
    pages: Math.ceil(totalStudents / safeLimit),
    period: normalizedPeriod,
    periodDays: PERIODS[normalizedPeriod] || 365,
    badgeTiers: BADGE_TIERS,
    formula: {
      primary: 'badgeTier',
      tieBreakers: ['totalXP', 'totalConsistentDays', 'averageAdherence'],
      progressScoreWeights: PROGRESS_WEIGHTS,
      adherenceWeights: ADHERENCE_WEIGHTS,
    },
  };
}

async function getWidgetLeaderboard(userId, period = 'allTime') {
  const normalizedPeriod = normalizePeriod(period);
  const data = await getLeaderboardData(normalizedPeriod);
  const sortedData = sortLeaderboard(data, 'rank').map((item, index) => ({ ...item, rank: index + 1 }));
  const top5 = sortedData.slice(0, 5);
  const userStats = sortedData.find(user => user.userId.toString() === userId.toString()) || null;

  return {
    top5,
    userStats,
    period: normalizedPeriod,
    periodDays: PERIODS[normalizedPeriod] || 365,
    badgeTiers: BADGE_TIERS,
  };
}

module.exports = {
  BADGE_TIERS,
  invalidateLeaderboardCache,
  getSortedLeaderboard,
  getWidgetLeaderboard,
  computeLeaderboard,
};
