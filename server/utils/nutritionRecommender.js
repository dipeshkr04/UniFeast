const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const HF_DEFAULT_MODEL = 'google/gemma-4-31B-it:together';
const HF_DEFAULT_BASE_URL = 'https://router.huggingface.co/v1';
const HF_TIMEOUT_MS = Number(getEnv('HF_RECOMMENDATION_TIMEOUT_MS', 'HF_TIMEOUT_MS') || 90000);
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Kolkata';

const NUTRITION_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
const NON_VEG_PATTERN = /\b(chicken|egg|eggs|anda|omelette|fish|mutton|meat|keema|prawn|non\s*-?\s*veg)\b/i;
const MEAL_WINDOWS = {
  breakfast: { label: 'Breakfast', startsAt: '07:00', endsAt: '11:00' },
  lunch: { label: 'Lunch', startsAt: '12:00', endsAt: '16:00' },
  snack: { label: 'Snacks', startsAt: '16:30', endsAt: '19:00' },
  dinner: { label: 'Dinner', startsAt: '19:30', endsAt: '00:00' },
};

const GENERIC_DIET_ITEMS = {
  veg: [
    { itemName: 'Poha with curd', mealType: 'breakfast', quantity: 1, estimatedNutrition: { calories: 360, protein: 13, carbs: 58, fat: 9, fiber: 6 }, reason: 'Balanced breakfast with steady carbs and extra protein from curd.' },
    { itemName: 'Dal rice with mixed sabzi', mealType: 'lunch', quantity: 1, estimatedNutrition: { calories: 620, protein: 22, carbs: 96, fat: 14, fiber: 12 }, reason: 'Covers the main calorie, carb, protein, and fiber targets without heavy fat.' },
    { itemName: 'Sprouts chaat', mealType: 'snack', quantity: 1, estimatedNutrition: { calories: 220, protein: 14, carbs: 34, fat: 4, fiber: 9 }, reason: 'Adds protein and fiber while keeping calories controlled.' },
    { itemName: 'Roti with paneer bhurji and salad', mealType: 'dinner', quantity: 1, estimatedNutrition: { calories: 560, protein: 28, carbs: 58, fat: 22, fiber: 8 }, reason: 'Finishes the day with a stronger protein serving and moderate carbs.' },
  ],
  'non-veg': [
    { itemName: 'Egg bhurji with toast', mealType: 'breakfast', quantity: 1, estimatedNutrition: { calories: 430, protein: 24, carbs: 38, fat: 20, fiber: 5 }, reason: 'Starts the day with high-quality protein and moderate carbs.' },
    { itemName: 'Chicken rice bowl with salad', mealType: 'lunch', quantity: 1, estimatedNutrition: { calories: 680, protein: 42, carbs: 78, fat: 18, fiber: 7 }, reason: 'Efficiently covers protein while still supporting the calorie target.' },
    { itemName: 'Curd with fruit and roasted chana', mealType: 'snack', quantity: 1, estimatedNutrition: { calories: 300, protein: 17, carbs: 42, fat: 7, fiber: 8 }, reason: 'Fills fiber and protein gaps between larger meals.' },
    { itemName: 'Roti with chicken curry and vegetables', mealType: 'dinner', quantity: 1, estimatedNutrition: { calories: 590, protein: 36, carbs: 52, fat: 22, fiber: 7 }, reason: 'Keeps dinner protein-forward without overshooting carbs.' },
  ],
};

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function requireHuggingFaceConfig() {
  const apiKey = getEnv('HF_API_TOKEN', 'HF_TOKEN', 'hf_api_token', 'hf_token');
  if (!apiKey) {
    throw new Error('HF_API_TOKEN is not configured');
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(getEnv('HF_ROUTER_BASE_URL', 'HF_BASE_URL', 'hf_router_base_url', 'hf_base_url') || HF_DEFAULT_BASE_URL),
    model: getEnv('HF_RECOMMENDATION_MODEL', 'HF_MODEL', 'hf_recommendation_model', 'hf_model') || HF_DEFAULT_MODEL,
  };
}

function buildHuggingFaceChatUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : fallback;
}

function normalizeMacroObject(value = {}) {
  return NUTRITION_KEYS.reduce((acc, key) => {
    acc[key] = toNumber(value[key]);
    return acc;
  }, {});
}

function calculateRemaining(goals = {}, totals = {}) {
  return NUTRITION_KEYS.reduce((acc, key) => {
    acc[key] = Math.max(0, toNumber(goals[key]) - toNumber(totals[key]));
    return acc;
  }, {});
}

function isDailyGoalAchieved(goals = {}, totals = {}) {
  return NUTRITION_KEYS.every((key) => toNumber(totals[key]) >= toNumber(goals[key]));
}

function getLocalTimeParts(value = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(value).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    hour: Number(parts.hour) || 0,
    minute: Number(parts.minute) || 0,
  };
}

function getCurrentMealWindow(value = new Date(), timeZone = APP_TIME_ZONE) {
  const { hour, minute } = getLocalTimeParts(value, timeZone);
  const minutes = hour * 60 + minute;
  let mealType = 'breakfast';

  if (minutes >= 420 && minutes <= 660) mealType = 'breakfast';
  else if (minutes >= 720 && minutes <= 960) mealType = 'lunch';
  else if (minutes >= 990 && minutes <= 1140) mealType = 'snack';
  else if (minutes >= 1170 || minutes === 0) mealType = 'dinner';
  else if (minutes > 660 && minutes < 720) mealType = 'lunch';
  else if (minutes > 960 && minutes < 990) mealType = 'snack';
  else if (minutes > 1140 && minutes < 1170) mealType = 'dinner';

  const window = MEAL_WINDOWS[mealType];
  return {
    mealType,
    label: window.label,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    timeZone,
    localTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function isNonVegItem(item = {}) {
  const text = `${item.name || item.itemName || ''} ${(item.tags || []).join(' ')}`;
  return NON_VEG_PATTERN.test(text);
}

function normalizeDietPreference(value) {
  return String(value || '').toLowerCase().includes('non') ? 'non-veg' : 'veg';
}

function filterMenuItemsByPreference(menuItems = [], dietPreference = 'veg') {
  const normalizedPreference = normalizeDietPreference(dietPreference);
  return menuItems
    .filter((item) => item?.name && item?.nutrition)
    .filter((item) => normalizedPreference !== 'veg' || !isNonVegItem(item))
    .filter((item) => NUTRITION_KEYS.some((key) => toNumber(item.nutrition[key]) > 0))
    .slice(0, 40);
}

function serializeMenuItem(item) {
  return {
    menuItemId: item._id?.toString?.() || String(item._id || ''),
    name: item.name,
    category: item.category,
    price: toNumber(item.price),
    nutrition: normalizeMacroObject(item.nutrition),
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
  };
}

function serializeMeal(meal) {
  const quantity = toNumber(meal.quantity, 1) || 1;
  return {
    name: meal.customName || meal.menuItem?.name || 'Logged meal',
    mealType: meal.mealType || 'snack',
    quantity,
    nutrition: {
      calories: toNumber(meal.calories) * quantity,
      protein: toNumber(meal.protein) * quantity,
      carbs: toNumber(meal.carbs) * quantity,
      fat: toNumber(meal.fat) * quantity,
      fiber: toNumber(meal.fiber) * quantity,
    },
  };
}

function parseJsonFromText(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Recommendation response did not contain JSON');
    return JSON.parse(jsonMatch[0]);
  }
}

async function requestHuggingFaceRecommendation(prompt) {
  const { apiKey, baseUrl, model } = requireHuggingFaceConfig();
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a practical Indian college canteen nutrition planner. Return only valid JSON. Use approximate nutrition. Respect vegetarian/non-vegetarian preference strictly.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.25,
    top_p: 0.85,
    max_tokens: 1200,
  };

  const response = await axios.post(buildHuggingFaceChatUrl(baseUrl), payload, {
    timeout: HF_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  return {
    raw: parseJsonFromText(response.data?.choices?.[0]?.message?.content || ''),
    model,
  };
}

function buildRecommendationPrompt(context) {
  const hasMeals = context.meals.length > 0;
  const mode = hasMeals ? 'remaining_goal' : 'day_plan';
  return `Create food recommendations for a UniFeast student.

Rules:
- mode must be "${mode}".
- If mode is "remaining_goal", recommend 1 to 4 items that best fill the remaining goals after already logged meals.
- If mode is "remaining_goal", every recommendation mealType must be "${context.currentMealWindow.mealType}" because the current local window is ${context.currentMealWindow.label} (${context.currentMealWindow.startsAt}-${context.currentMealWindow.endsAt}, ${context.currentMealWindow.timeZone}).
- If mode is "day_plan", recommend a complete day plan across breakfast, lunch, snack, and dinner.
- Use these meal windows: Breakfast 07:00-11:00, Lunch 12:00-16:00, Snacks 16:30-19:00, Dinner 19:30-00:00.
- Prefer availableMenuItems when they fit. If none fit, use common Indian college canteen foods.
- For dietPreference "veg", do not include egg, chicken, fish, meat, mutton, or non-veg items.
- For dietPreference "non-veg", non-vegetarian options are allowed but still keep the plan balanced.
- Avoid pushing fat far above the remaining or daily target.
- Return concise reasons.
- Return ONLY a JSON object with this exact shape:
{
  "mode": "${mode}",
  "title": "short title",
  "summary": "one sentence",
  "remaining": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0 },
  "recommendations": [
    {
      "itemName": "Food name",
      "menuItemId": "",
      "fromMenu": false,
      "quantity": 1,
      "mealType": "breakfast",
      "estimatedNutrition": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0 },
      "reason": "short reason"
    }
  ],
  "notes": ["short note"]
}

Context:
${JSON.stringify(context, null, 2)}`;
}

function normalizeRecommendationItem(item = {}, menuById = new Map()) {
  const menuItemId = String(item.menuItemId || item.menu_item_id || '');
  const matchedMenu = menuById.get(menuItemId);
  const quantity = Math.max(0.5, Math.min(5, toNumber(item.quantity, 1) || 1));
  const estimatedNutrition = normalizeMacroObject(matchedMenu?.nutrition || item.estimatedNutrition || item.nutrition || {});

  return {
    itemName: String(item.itemName || item.name || matchedMenu?.name || 'Recommended item').trim(),
    menuItemId,
    fromMenu: Boolean(item.fromMenu ?? item.from_menu ?? matchedMenu),
    quantity,
    mealType: ['breakfast', 'lunch', 'snack', 'dinner'].includes(item.mealType) ? item.mealType : 'snack',
    estimatedNutrition,
    reason: String(item.reason || 'Fits the remaining nutrition target.').trim(),
  };
}

function normalizeRecommendationResponse(raw = {}, context, model) {
  const menuById = new Map(context.availableMenuItems.map((item) => [item.menuItemId, item]));
  const mode = raw.mode === 'day_plan' || raw.mode === 'remaining_goal'
    ? raw.mode
    : (context.meals.length > 0 ? 'remaining_goal' : 'day_plan');
  const recommendations = Array.isArray(raw.recommendations)
    ? raw.recommendations.map((item) => normalizeRecommendationItem(item, menuById)).filter((item) => item.itemName)
    : [];
  const timeAwareRecommendations = mode === 'remaining_goal'
    ? recommendations.map((item) => ({ ...item, mealType: context.currentMealWindow.mealType }))
    : recommendations;

  if (!timeAwareRecommendations.length) {
    throw new Error('Recommendation response did not include suggestions');
  }

  return {
    mode,
    title: String(raw.title || (mode === 'day_plan' ? 'Suggested Day Plan' : 'Best Remaining Picks')).trim(),
    summary: String(raw.summary || 'Recommendations are tuned to your current goals.').trim(),
    dietPreference: context.dietPreference,
    remaining: normalizeMacroObject(raw.remaining || context.remaining),
    currentMealWindow: context.currentMealWindow,
    recommendations: timeAwareRecommendations.slice(0, mode === 'day_plan' ? 5 : 4),
    notes: Array.isArray(raw.notes) ? raw.notes.map((note) => String(note)).slice(0, 3) : [],
    source: 'huggingface',
    model,
  };
}

function scoreCandidate(item, remaining) {
  const n = normalizeMacroObject(item.nutrition || item.estimatedNutrition);
  const proteinNeed = Math.max(1, remaining.protein);
  const carbNeed = Math.max(1, remaining.carbs);
  const fiberNeed = Math.max(1, remaining.fiber);
  const calorieNeed = Math.max(1, remaining.calories);
  const fatLimit = Math.max(8, remaining.fat || 8);

  return (
    Math.min(n.protein / proteinNeed, 1) * 34 +
    Math.min(n.carbs / carbNeed, 1) * 18 +
    Math.min(n.fiber / fiberNeed, 1) * 24 +
    Math.min(n.calories / calorieNeed, 1) * 14 -
    Math.max(0, n.fat - fatLimit) * 1.5
  );
}

function buildGenericItems(dietPreference) {
  return GENERIC_DIET_ITEMS[normalizeDietPreference(dietPreference)].map((item) => ({
    ...item,
    fromMenu: false,
    menuItemId: '',
  }));
}

function buildFallbackRecommendations(context, reason = '') {
  const mode = context.meals.length > 0 ? 'remaining_goal' : 'day_plan';
  const menuCandidates = context.availableMenuItems.map((item) => ({
    itemName: item.name,
    menuItemId: item.menuItemId,
    fromMenu: true,
    quantity: 1,
    mealType: mode === 'remaining_goal'
      ? context.currentMealWindow.mealType
      : item.category === 'beverages' || item.category === 'snacks' ? 'snack' : 'lunch',
    estimatedNutrition: item.nutrition,
    reason: 'Available in the canteen and fits your current target gaps.',
  }));
  const candidates = menuCandidates.length ? menuCandidates : buildGenericItems(context.dietPreference);

  let recommendations;
  if (mode === 'day_plan') {
    const genericPlan = buildGenericItems(context.dietPreference);
    recommendations = genericPlan.map((item) => ({
      ...item,
      reason: item.reason,
    }));
  } else {
    recommendations = candidates
      .sort((a, b) => scoreCandidate(b, context.remaining) - scoreCandidate(a, context.remaining))
      .slice(0, 4)
      .map((item) => ({
        ...item,
        reason: item.reason || 'Targets the strongest remaining macro gaps for today.',
      }));
  }

  return {
    mode,
    title: mode === 'day_plan' ? 'Suggested Day Plan' : 'Best Remaining Picks',
    summary: mode === 'day_plan'
      ? 'A balanced plan for the day based on your selected preference.'
      : 'These picks focus on the macros still left in your goal.',
    dietPreference: context.dietPreference,
    remaining: context.remaining,
    currentMealWindow: context.currentMealWindow,
    recommendations,
    notes: [reason || 'Approximate values; adjust quantity before logging if your serving differs.'],
    source: 'local_fallback',
    model: null,
  };
}

async function generateFoodRecommendations({ goals, totals, meals = [], menuItems = [], dietPreference }) {
  const normalizedPreference = normalizeDietPreference(dietPreference);
  const availableMenuItems = filterMenuItemsByPreference(menuItems, normalizedPreference).map(serializeMenuItem);
  const context = {
    dietPreference: normalizedPreference,
    goals: normalizeMacroObject(goals),
    totals: normalizeMacroObject(totals),
    remaining: calculateRemaining(goals, totals),
    currentMealWindow: getCurrentMealWindow(),
    meals: meals.map(serializeMeal),
    availableMenuItems,
  };

  try {
    const { raw, model } = await requestHuggingFaceRecommendation(buildRecommendationPrompt(context));
    return normalizeRecommendationResponse(raw, context, model);
  } catch (error) {
    const detail = error.response?.data?.error || error.response?.data?.message || error.message;
    console.warn('Hugging Face recommendation failed, using fallback:', detail);
    return buildFallbackRecommendations(context, detail);
  }
}

module.exports = {
  calculateRemaining,
  generateFoodRecommendations,
  getCurrentMealWindow,
  isDailyGoalAchieved,
  normalizeDietPreference,
};
