const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LOW_CONFIDENCE_THRESHOLD = Number(getEnv('OLLAMA_NUTRITION_CONFIDENCE_THRESHOLD') || 0.65);
const MAX_IMAGE_BYTES = Number(getEnv('OLLAMA_MAX_IMAGE_BYTES') || 8 * 1024 * 1024);
const OLLAMA_TIMEOUT_MS = Number(getEnv('OLLAMA_TIMEOUT_MS') || 60000);

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function requireOllamaConfig() {
  const model = getEnv('OLLAMA_MODEL', 'ollama_model');
  if (!model) {
    throw new Error('OLLAMA_MODEL is not configured');
  }

  return {
    apiKey: getEnv('OLLAMA_API_KEY', 'ollama_api_key'),
    baseUrl: normalizeBaseUrl(getEnv('OLLAMA_BASE_URL', 'ollama_base_url') || 'http://localhost:11434'),
    model,
  };
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function buildOllamaGenerateUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith('/api/generate')) return normalized;
  if (normalized.endsWith('/api')) return `${normalized}/generate`;
  return `${normalized}/api/generate`;
}

function buildOllamaHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  return headers;
}

function clampConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

function roundMacro(value, decimals = 1) {
  const parsed = typeof value === 'string'
    ? Number(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] || 0)
    : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
}

function normalizeNutrition(nutrition = {}) {
  return {
    calories: Math.round(roundMacro(nutrition.calories, 0)),
    protein: roundMacro(nutrition.protein),
    carbs: roundMacro(nutrition.carbs),
    fat: roundMacro(nutrition.fat),
    fiber: roundMacro(nutrition.fiber),
  };
}

function inferMimeType(imageUrl, contentType) {
  if (contentType && contentType.startsWith('image/')) return contentType.split(';')[0];
  const lower = String(imageUrl || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function downloadImageAsBase64(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
  });

  const buffer = Buffer.from(response.data);
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large for nutrition analysis');
  }

  return {
    data: buffer.toString('base64'),
    mimeType: inferMimeType(imageUrl, response.headers['content-type']),
  };
}

function extractText(responseData) {
  if (typeof responseData?.response === 'string') {
    return responseData.response.trim();
  }

  if (typeof responseData?.message?.content === 'string') {
    return responseData.message.content.trim();
  }

  if (Array.isArray(responseData?.message?.content)) {
    return responseData.message.content
      .map((part) => part.text || '')
      .join('\n')
      .trim();
  }

  return '';
}

function parseOllamaJson(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Ollama response did not contain JSON');
    return JSON.parse(jsonMatch[0]);
  }
}

function parseNutritionNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function normalizeQuantity(value) {
  const parsed = parseNutritionNumber(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.min(20, Math.round(parsed * 10) / 10));
}

function normalizeOllamaResult(raw, modelName) {
  const confidence = clampConfidence(raw.confidence);
  const detectedItems = Array.isArray(raw.detectedItems || raw.detected_items)
    ? (raw.detectedItems || raw.detected_items).map((item) => ({
      name: String(item.name || 'Food item').trim(),
      quantity: normalizeQuantity(item.quantity),
      unit: item.unit || 'serving',
      confidence: clampConfidence(item.confidence ?? confidence),
    }))
    : [];
  const quantity = normalizeQuantity(
    raw.quantity ??
    raw.detectedQuantity ??
    raw.detected_quantity ??
    raw.servingQuantity ??
    raw.serving_quantity ??
    detectedItems[0]?.quantity
  );
  const nutrition = normalizeNutrition(raw.nutrition || {
    calories: parseNutritionNumber(raw.calories),
    protein: parseNutritionNumber(raw.protein),
    carbs: parseNutritionNumber(raw.carbs),
    fat: parseNutritionNumber(raw.fat),
    fiber: parseNutritionNumber(raw.fiber),
  });
  const foodName =
    String(raw.foodName || raw.food_name || raw.name || 'Detected food')
      .trim()
      .replace(/\s+/g, ' ');

  return {
    foodName,
    confidence,
    nutrition,
    quantity,
    quantityUnit: raw.quantityUnit || raw.quantity_unit || detectedItems[0]?.unit || 'serving',
    servingSize: raw.servingSize || raw.serving_size || 'visible serving',
    detectedItems,
    notes: Array.isArray(raw.notes) ? raw.notes.map((note) => String(note)) : [],
    source: 'ollama',
    model: modelName,
    isLowConfidenceWarning: confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

function buildNutritionPrompt() {
  return `Analyze this image and identify the food. Detect the visible quantity and provide approximate nutritional content for ONE item or ONE serving unit.
The app multiplies the nutrition values by "quantity", so if there are 2 samosas, return "quantity": 2 and nutrition for 1 samosa only. For a single plate/bowl/drink, return "quantity": 1.
Prioritize Indian college canteen foods such as paratha, chai, dosa, idli, poha, samosa, thali, rice, dal, paneer, noodles, sandwiches, snacks, and beverages.
Please respond ONLY with a valid JSON object strictly following this structure. No markdown, no backticks, just the raw JSON object:
{
  "name": "Name of the food",
  "quantity": 1,
  "quantityUnit": "piece/plate/bowl/cup/serving",
  "calories": "value with unit (e.g., 250 kcal)",
  "protein": "value with unit (e.g., 10g)",
  "fiber": "value with unit (e.g., 5g)",
  "fat": "value with unit (e.g., 12g)",
  "carbs": "value with unit (e.g., 30g)",
  "confidence": 0.85,
  "servingSize": "brief visible serving estimate"
}`;
}

async function analyzeFoodImage(imageUrl) {
  const { apiKey, baseUrl, model } = requireOllamaConfig();
  const image = await downloadImageAsBase64(imageUrl);

  const payload = {
    model,
    prompt: buildNutritionPrompt(),
    images: [image.data],
    stream: false,
    format: 'json',
    options: {
      temperature: 0.1,
      top_p: 0.8,
      top_k: 32,
      num_predict: 700,
    },
  };

  const response = await axios.post(buildOllamaGenerateUrl(baseUrl), payload, {
    timeout: OLLAMA_TIMEOUT_MS,
    headers: buildOllamaHeaders(apiKey),
  });

  const text = extractText(response.data);
  const raw = parseOllamaJson(text);
  return normalizeOllamaResult(raw, model);
}

async function analyzeFoodComplete(imageUrl) {
  try {
    return await analyzeFoodImage(imageUrl);
  } catch (error) {
    const detail = error.response?.data?.error || error.response?.data?.message || error.message;
    console.error('Ollama nutrition analysis error:', detail);
    throw new Error(detail || 'Ollama nutrition analysis failed');
  }
}

module.exports = {
  analyzeFoodImage,
  analyzeFoodComplete,
};
