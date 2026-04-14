const { ClarifaiStub, grpc } = require("clarifai-nodejs-grpc");
const axios = require('axios');
const MenuItem = require('../models/MenuItem');

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

async function analyzeFoodComplete(imageUrl) {
  try {
    const food = await analyzeFoodImage(imageUrl);

    if (!food) {
      throw new Error("Could not detect food in image");
    }

    let nutrition = await getNutritionByName(food.name);

    if (!nutrition || nutrition.calories === 0) {
      // Fallback: search local MenuItem DB
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
      nutrition
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
