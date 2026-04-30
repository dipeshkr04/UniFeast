const { ClarifaiStub, grpc } = require("clarifai-nodejs-grpc");
const axios = require('axios');
const MenuItem = require('../models/MenuItem');
const { INDIAN_FOOD_NUTRITION } = require('./indianFoodNutrition');

// ── Local ResNet inference service configuration ──
const RESNET_SERVICE_URL = process.env.RESNET_SERVICE_URL || 'http://localhost:8000';
const RESNET_CONFIDENCE_THRESHOLD = parseFloat(process.env.RESNET_CONFIDENCE_THRESHOLD || '0.45');

const stub = ClarifaiStub.grpc();

// ── Common single-serving weights (grams) for foods USDA reports per 100g ──
const SERVING_WEIGHTS = {
  egg: 50, apple: 182, banana: 118, orange: 131, mango: 200,
  sandwich: 150, burger: 200, pizza: 107, sushi: 30, rice: 158,
  bread: 30, cookie: 30, donut: 60, cake: 80, pie: 125,
  chicken: 140, steak: 170, salmon: 170, bacon: 8,
  potato: 150, tomato: 123, broccoli: 91, carrot: 61,
  samosa: 50, idli: 40, dosa: 100, poha: 200, paneer: 40,
  noodles: 200, pasta: 200, ramen: 200, soup: 240,
  milk: 244, coffee: 240, tea: 240, juice: 248,
  default: 100 // fallback: per-100g as-is
};

function getServingWeight(foodName) {
  const lower = foodName.toLowerCase();
  for (const [key, weight] of Object.entries(SERVING_WEIGHTS)) {
    if (lower.includes(key)) return weight;
  }
  return SERVING_WEIGHTS.default;
}

async function analyzeFoodImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const metadata = new grpc.Metadata();
    metadata.set("authorization", `Key ${process.env.CLARIFAI_PAT}`);

    stub.PostModelOutputs(
      {
        user_app_id: {
          user_id: 'clarifai',
          app_id: 'main'
        },
        model_id: "food-item-recognition",
        inputs: [
          { data: { image: { url: imageUrl } } }
        ]
      },
      metadata,
      (err, response) => {
        if (err) {
          console.error("Clarifai Error:", err);
          return reject(err);
        }

        if (response.status.code !== 10000) {
          console.error("Clarifai Request failed:", response.status.description);
          return reject(new Error(response.status.description));
        }

        const concepts = response.outputs[0].data.concepts;
        if (concepts && concepts.length > 0) {
          resolve({
            name: concepts[0].name,
            confidence: concepts[0].value
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function getNutritionByName(foodName) {
  try {
    // USDA FoodData Central — free, no key required with DEMO_KEY
    // First try searching for the raw/whole version for accurate base values
    let response = await axios.get(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(foodName + ' raw whole')}&pageSize=5`
    );

    if (!response.data.foods || response.data.foods.length === 0) {
      // Retry with just the food name
      response = await axios.get(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(foodName)}&pageSize=5`
      );
      if (!response.data.foods || response.data.foods.length === 0) return null;
    }

    // Prefer "raw" / "fresh" / "whole" matches for unprocessed foods
    let bestMatch = response.data.foods[0];
    for (const food of response.data.foods) {
      const desc = food.description.toLowerCase();
      const query = foodName.toLowerCase();
      if (desc.includes(query) && (desc.includes('raw') || desc.includes('fresh') || desc.includes('whole'))) {
        bestMatch = food;
        break;
      }
    }

    // USDA values are ALWAYS per 100g — scale to a typical single serving
    const servingGrams = getServingWeight(foodName);
    const scale = servingGrams / 100;

    const raw = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    bestMatch.foodNutrients.forEach(n => {
      if (n.nutrientName === 'Energy' && (n.unitName === 'KCAL' || n.unitName === 'kcal')) raw.calories = n.value;
      if (n.nutrientName === 'Protein') raw.protein = n.value;
      if (n.nutrientName.includes('Carbohydrate')) raw.carbs = n.value;
      if (n.nutrientName === 'Total lipid (fat)') raw.fat = n.value;
      if (n.nutrientName.includes('Fiber')) raw.fiber = n.value;
    });

    return {
      calories: Math.round(raw.calories * scale),
      protein: Math.round(raw.protein * scale * 10) / 10,
      carbs: Math.round(raw.carbs * scale * 10) / 10,
      fat: Math.round(raw.fat * scale * 10) / 10,
      fiber: Math.round(raw.fiber * scale * 10) / 10,
    };
  } catch (error) {
    console.error("USDA API Error:", error.message);
    return null;
  }
}

// ── Call local ResNet Python service ──
async function analyzeWithLocalResNet(imageUrl) {
  try {
    const response = await axios.post(
      `${RESNET_SERVICE_URL}/predict-url`,
      { url: imageUrl },
      { timeout: 15000 }
    );
    return response.data; // { label, confidence }
  } catch (error) {
    console.warn('Local ResNet service unavailable or failed:', error.message);
    return null;
  }
}

async function analyzeFoodComplete(imageUrl) {
  try {
    // ── STEP 1: Try local ResNet first (free, fast, Indian-food specialist) ──
    const localResult = await analyzeWithLocalResNet(imageUrl);

    if (localResult && localResult.confidence >= RESNET_CONFIDENCE_THRESHOLD) {
      // ── STEP 2: Check hardcoded nutrition map ──
      const localNutrition = INDIAN_FOOD_NUTRITION[localResult.label];
      if (localNutrition) {
        console.log(`✅ Local ResNet identified: ${localResult.label} (${(localResult.confidence * 100).toFixed(1)}%)`);
        return {
          foodName: localResult.label.replace(/_/g, ' '),
          confidence: localResult.confidence,
          nutrition: localNutrition,
          source: 'local_resnet',
          isLowConfidenceWarning: localResult.confidence < 0.50,
        };
      }
    }

    // ── STEP 3: Fallback to Clarifai (broad-spectrum) ──
    console.log('⚠️  Local model low-confidence or unavailable. Falling back to Clarifai...');
    const food = await analyzeFoodImage(imageUrl);

    if (!food) {
      throw new Error("Could not detect food in image");
    }

    const clarifaiThresh = 0.85;
    if (food.confidence < clarifaiThresh) {
      if (localResult && INDIAN_FOOD_NUTRITION[localResult.label]) {
        const localDev = RESNET_CONFIDENCE_THRESHOLD - localResult.confidence;
        const clarifaiDev = clarifaiThresh - food.confidence;

        if (localDev < clarifaiDev) {
          console.log(`⚠️ Using Local ResNet fallback (Deviation: Local ${localDev.toFixed(2)} < Clarifai ${clarifaiDev.toFixed(2)})`);
          return {
            foodName: localResult.label.replace(/_/g, ' '),
            confidence: localResult.confidence,
            nutrition: INDIAN_FOOD_NUTRITION[localResult.label],
            source: 'local_resnet_deviation_fallback',
            isLowConfidenceWarning: localResult.confidence < 0.50,
          };
        }
      }
      throw new Error("LOW_CONFIDENCE");
    }

    // ── STEP 4: Fetch nutrition via USDA ──
    let nutrition = await getNutritionByName(food.name);

    if (!nutrition || nutrition.calories === 0) {
      // ── STEP 5: Final fallback — MenuItem DB ──
      const localItem = await MenuItem.findOne({
        name: { $regex: food.name, $options: 'i' }
      });

      if (localItem) {
        nutrition = {
          calories: localItem.nutrition.calories,
          protein: localItem.nutrition.protein,
          carbs: localItem.nutrition.carbs,
          fat: localItem.nutrition.fat,
          fiber: localItem.nutrition.fiber,
        };
      } else {
        nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      }
    }

    return {
      foodName: food.name,
      confidence: food.confidence,
      nutrition,
      source: 'clarifai_usda',
    };
  } catch (error) {
    console.error("analyzeFoodComplete Error:", error);
    throw error;
  }
}

module.exports = {
  analyzeFoodImage,
  getNutritionByName,
  analyzeFoodComplete
};
