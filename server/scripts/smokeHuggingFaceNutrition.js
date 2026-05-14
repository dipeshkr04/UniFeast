const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.HF_TIMEOUT_MS = process.env.HF_TIMEOUT_MS || '180000';

const { analyzeFoodImage, analyzeFoodName } = require('../utils/foodAnalyzer');

async function main() {
  const args = process.argv.slice(2);
  const imageFlagIndex = args.indexOf('--image');
  const explicitImageUrl = imageFlagIndex >= 0 ? args[imageFlagIndex + 1] : '';
  const firstUrlArg = args.find((arg) => /^https?:\/\//i.test(arg));
  const imageUrl = explicitImageUrl || firstUrlArg || '';
  const foodName = args
    .filter((arg, index) => index !== imageFlagIndex && index !== imageFlagIndex + 1 && arg !== imageUrl)
    .join(' ')
    .trim() || 'samosa';
  const result = imageUrl ? await analyzeFoodImage(imageUrl) : await analyzeFoodName(foodName);

  console.log(JSON.stringify({
    success: true,
    foodName: result.foodName,
    source: result.source,
    model: result.model,
    nutrition: result.nutrition,
  }, null, 2));
}

main().catch((error) => {
  const detail = error.response?.data || error.message;
  console.error(JSON.stringify({
    success: false,
    status: error.response?.status || null,
    detail,
  }, null, 2));
  process.exit(1);
});
