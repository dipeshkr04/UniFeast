const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}`;
const CONFIGURED_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const FALLBACK_GEMINI_MODELS = [
  CONFIGURED_GEMINI_MODEL,
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];

const LOW_CONFIDENCE_THRESHOLD = Number(process.env.GEMINI_NUTRITION_CONFIDENCE_THRESHOLD || 0.65);
const MAX_IMAGE_BYTES = Number(process.env.GEMINI_MAX_IMAGE_BYTES || 8 * 1024 * 1024);
let cachedGeminiModel = null;

function requireGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return apiKey;
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

function normalizeModelName(modelName) {
  return String(modelName || '').trim().replace(/^models\//, '');
}

function buildGenerateContentUrl(modelName) {
  return `${GEMINI_BASE_URL}/models/${normalizeModelName(modelName)}:generateContent`;
}

function uniqueModels(models) {
  const seen = new Set();
  return models
    .filter(Boolean)
    .map(normalizeModelName)
    .filter((model) => {
      if (!model || seen.has(model)) return false;
      seen.add(model);
      return true;
    });
}

function isModelAvailabilityError(error) {
  const status = error.response?.status;
  const message = String(error.response?.data?.error?.message || error.message || '').toLowerCase();
  return status === 404 ||
    message.includes('is not found') ||
    message.includes('not supported for generatecontent') ||
    message.includes('models/') && message.includes('not found');
}

function supportsGenerateContent(model) {
  return Array.isArray(model.supportedGenerationMethods) &&
    model.supportedGenerationMethods.includes('generateContent');
}

async function discoverAvailableGeminiModel(apiKey, alreadyTried = new Set()) {
  const response = await axios.get(`${GEMINI_BASE_URL}/models?key=${encodeURIComponent(apiKey)}`, {
    timeout: 15000,
  });

  const models = (response.data?.models || [])
    .filter(supportsGenerateContent)
    .map((model) => ({
      ...model,
      shortName: normalizeModelName(model.name),
    }));

  const preferred = uniqueModels(FALLBACK_GEMINI_MODELS);
  for (const candidate of preferred) {
    const found = models.find((model) => model.shortName === candidate && !alreadyTried.has(candidate));
    if (found) return found.shortName;
  }

  const flashModel = models.find((model) =>
    model.shortName.toLowerCase().includes('flash') && !alreadyTried.has(model.shortName)
  );
  if (flashModel) return flashModel.shortName;

  const anyModel = models.find((model) => !alreadyTried.has(model.shortName));
  return anyModel?.shortName || null;
}

function inferMimeType(imageUrl, contentType) {
  if (contentType && contentType.startsWith('image/')) return contentType.split(';')[0];
  const lower = String(imageUrl || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function downloadImageAsInlineData(imageUrl) {
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
    inline_data: {
      mime_type: inferMimeType(imageUrl, response.headers['content-type']),
      data: buffer.toString('base64'),
    },
  };
}

function extractText(responseData) {
  const parts = responseData?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('\n').trim();
}

function parseGeminiJson(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini response did not contain JSON');
    return JSON.parse(jsonMatch[0]);
  }
}

function parseNutritionNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function normalizeGeminiResult(raw, modelName) {
  const confidence = clampConfidence(raw.confidence);
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
    servingSize: raw.servingSize || raw.serving_size || 'visible serving',
    detectedItems: Array.isArray(raw.detectedItems || raw.detected_items)
      ? (raw.detectedItems || raw.detected_items).map((item) => ({
        name: String(item.name || 'Food item').trim(),
        quantity: Number(item.quantity || 1),
        unit: item.unit || 'serving',
        confidence: clampConfidence(item.confidence ?? confidence),
      }))
      : [],
    notes: Array.isArray(raw.notes) ? raw.notes.map((note) => String(note)) : [],
    source: 'gemini_flash',
    model: modelName,
    isLowConfidenceWarning: confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

function buildNutritionPrompt() {
  return `Analyze this image and identify the food. Provide its approximate nutritional content for the full visible serving.
Prioritize Indian college canteen foods such as paratha, chai, dosa, idli, poha, samosa, thali, rice, dal, paneer, noodles, sandwiches, snacks, and beverages.
Please respond ONLY with a valid JSON object strictly following this structure. No markdown, no backticks, just the raw JSON object:
{
  "name": "Name of the food",
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
  const apiKey = requireGeminiKey();
  const imagePart = await downloadImageAsInlineData(imageUrl);

  const payload = {
    contents: [
      {
        parts: [
          { text: buildNutritionPrompt() },
          imagePart,
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
      topP: 0.8,
      topK: 32,
      maxOutputTokens: 700,
    },
  };

  const triedModels = new Set();
  let lastModelError = null;
  let candidates = uniqueModels([cachedGeminiModel, ...FALLBACK_GEMINI_MODELS]);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const modelName of candidates) {
      if (triedModels.has(modelName)) continue;
      triedModels.add(modelName);

      try {
        const response = await axios.post(`${buildGenerateContentUrl(modelName)}?key=${encodeURIComponent(apiKey)}`, payload, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        cachedGeminiModel = modelName;
        const text = extractText(response.data);
        const raw = parseGeminiJson(text);
        return normalizeGeminiResult(raw, modelName);
      } catch (error) {
        if (!isModelAvailabilityError(error)) throw error;
        lastModelError = error;
      }
    }

    const discoveredModel = await discoverAvailableGeminiModel(apiKey, triedModels);
    if (!discoveredModel) break;
    candidates = [discoveredModel];
  }

  throw lastModelError || new Error('No Gemini model that supports generateContent is available for this API key');
}

async function analyzeFoodComplete(imageUrl) {
  try {
    return await analyzeFoodImage(imageUrl);
  } catch (error) {
    const detail = error.response?.data?.error?.message || error.message;
    console.error('Gemini nutrition analysis error:', detail);
    throw new Error(detail || 'Gemini nutrition analysis failed');
  }
}

module.exports = {
  analyzeFoodImage,
  analyzeFoodComplete,
};
