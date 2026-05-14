const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LOW_CONFIDENCE_THRESHOLD = Number(getEnv('HF_NUTRITION_CONFIDENCE_THRESHOLD', 'OLLAMA_NUTRITION_CONFIDENCE_THRESHOLD') || 0.65);
const MAX_IMAGE_BYTES = Number(getEnv('HF_MAX_IMAGE_BYTES', 'OLLAMA_MAX_IMAGE_BYTES') || 8 * 1024 * 1024);
const HF_TIMEOUT_MS = Number(getEnv('HF_TIMEOUT_MS', 'OLLAMA_TIMEOUT_MS') || 60000);
const HF_DEFAULT_MODEL = 'google/gemma-4-31B-it:together';
const HF_DEFAULT_BASE_URL = 'https://router.huggingface.co/v1';

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function requireHuggingFaceConfig() {
  const apiKey = getEnv('HF_API_TOKEN', 'HF_TOKEN', 'hf_api_token', 'hf_token');
  if (!apiKey) {
    throw new Error('HF_API_TOKEN is not configured');
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(getEnv('HF_ROUTER_BASE_URL', 'HF_BASE_URL', 'hf_router_base_url', 'hf_base_url') || HF_DEFAULT_BASE_URL),
    model: getEnv('HF_MODEL', 'hf_model') || HF_DEFAULT_MODEL,
  };
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function buildHuggingFaceChatUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}

function buildHuggingFaceHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function requestHuggingFaceJson(prompt, imageUrls = []) {
  const { apiKey, baseUrl, model } = requireHuggingFaceConfig();
  const content = [{ type: 'text', text: prompt }];
  imageUrls.forEach((url) => {
    content.push({
      type: 'image_url',
      image_url: { url },
    });
  });

  const payload = {
    model,
    messages: [{ role: 'user', content }],
    temperature: 0.1,
    top_p: 0.8,
    max_tokens: 700,
  };

  const response = await axios.post(buildHuggingFaceChatUrl(baseUrl), payload, {
    timeout: HF_TIMEOUT_MS,
    headers: buildHuggingFaceHeaders(apiKey),
  });

  const text = extractText(response.data);
  return {
    raw: parseProviderJson(text),
    model,
  };
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
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'UniFeast/1.0 nutrition-image-analyzer',
    },
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

function toImageDataUrl(image) {
  if (!image?.data) {
    throw new Error('Image data is required for nutrition analysis');
  }

  return `data:${image.mimeType || 'image/jpeg'};base64,${image.data}`;
}

function extractText(responseData) {
  const choiceContent = responseData?.choices?.[0]?.message?.content;
  if (typeof choiceContent === 'string') {
    return choiceContent.trim();
  }

  if (Array.isArray(choiceContent)) {
    return choiceContent
      .map((part) => part.text || '')
      .join('\n')
      .trim();
  }

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

function parseProviderJson(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI response did not contain JSON');
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

function normalizeFoodNameForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(plate|bowl|cup|glass|piece|pieces|serving|food|item|with|and|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foodNamesMatch(enteredName, detectedName) {
  const entered = normalizeFoodNameForMatch(enteredName);
  const detected = normalizeFoodNameForMatch(detectedName);
  if (!entered || !detected) return false;
  if (entered === detected) return true;
  if (entered.length > 3 && detected.length > 3 && (entered.includes(detected) || detected.includes(entered))) {
    return true;
  }

  const enteredTokens = new Set(entered.split(' ').filter((token) => token.length > 2));
  const detectedTokens = new Set(detected.split(' ').filter((token) => token.length > 2));
  if (!enteredTokens.size || !detectedTokens.size) return false;

  let overlap = 0;
  enteredTokens.forEach((token) => {
    if (detectedTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(enteredTokens.size, detectedTokens.size) >= 0.6;
}

function normalizeProviderResult(raw, modelName) {
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
    source: 'huggingface',
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

function buildNameNutritionPrompt(foodName) {
  return `Estimate nutritional content for one standard Indian college canteen serving of "${foodName}".
Use the menu item name as the source of truth. Return nutrition for exactly 1 serving, not multiple servings.
Please respond ONLY with a valid JSON object strictly following this structure. No markdown, no backticks, just the raw JSON object:
{
  "name": "${foodName}",
  "quantity": 1,
  "quantityUnit": "serving",
  "calories": "value with unit (e.g., 250 kcal)",
  "protein": "value with unit (e.g., 10g)",
  "fiber": "value with unit (e.g., 5g)",
  "fat": "value with unit (e.g., 12g)",
  "carbs": "value with unit (e.g., 30g)",
  "confidence": 0.85,
  "servingSize": "one standard serving"
}`;
}

async function analyzeFoodImage(imageUrl) {
  const image = await downloadImageAsBase64(imageUrl);
  const { raw, model } = await requestHuggingFaceJson(buildNutritionPrompt(), [toImageDataUrl(image)]);
  return normalizeProviderResult(raw, model);
}

async function analyzeFoodName(foodName) {
  const normalizedName = String(foodName || '').trim();
  if (!normalizedName) {
    throw new Error('Food name is required for nutrition analysis');
  }

  const { raw, model } = await requestHuggingFaceJson(buildNameNutritionPrompt(normalizedName));
  const result = normalizeProviderResult({ ...raw, quantity: 1, quantityUnit: raw.quantityUnit || 'serving' }, model);
  return {
    ...result,
    quantity: 1,
    quantityUnit: result.quantityUnit || 'serving',
    source: 'huggingface_name_lookup',
  };
}

async function analyzeMenuItemNutrition({ name, imageUrl }) {
  const menuName = String(name || '').trim();
  if (!menuName) {
    throw new Error('Menu item name is required for nutrition analysis');
  }

  let imageResult = null;
  if (imageUrl) {
    try {
      imageResult = await analyzeFoodImage(imageUrl);
      if (foodNamesMatch(menuName, imageResult.foodName)) {
        return {
          ...imageResult,
          quantity: 1,
          quantityUnit: 'serving',
          source: 'huggingface_image_match',
          menuNameMatch: true,
          requestedName: menuName,
          imageDetectedFoodName: imageResult.foodName,
        };
      }
    } catch (error) {
      console.warn('Hugging Face image nutrition lookup failed, falling back to name:', error.message);
    }
  }

  const nameResult = await analyzeFoodName(menuName);
  return {
    ...nameResult,
    foodName: menuName,
    quantity: 1,
    quantityUnit: 'serving',
    source: imageResult ? 'huggingface_name_lookup_after_image_mismatch' : 'huggingface_name_lookup',
    menuNameMatch: !imageUrl,
    requestedName: menuName,
    imageDetectedFoodName: imageResult?.foodName || '',
  };
}

async function analyzeFoodComplete(imageUrl) {
  try {
    return await analyzeFoodImage(imageUrl);
  } catch (error) {
    const detail = error.response?.data?.error || error.response?.data?.message || error.message;
    console.error('Hugging Face nutrition analysis error:', detail);
    throw new Error(detail || 'Hugging Face nutrition analysis failed');
  }
}

module.exports = {
  analyzeFoodImage,
  analyzeFoodName,
  analyzeMenuItemNutrition,
  analyzeFoodComplete,
};
