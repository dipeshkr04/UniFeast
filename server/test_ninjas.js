const axios = require('axios');

async function test() {
  try {
    const response = await axios.get(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=apple&pageSize=1`);
    if(response.data.foods && response.data.foods.length > 0) {
       const food = response.data.foods[0];
       console.log("Found:", food.description);
       
       const nutrients = {};
       food.foodNutrients.forEach(n => {
           if(n.nutrientName === 'Energy') nutrients.calories = n.value;
           if(n.nutrientName === 'Protein') nutrients.protein = n.value;
           if(n.nutrientName.includes('Carbohydrate')) nutrients.carbs = n.value;
           if(n.nutrientName.includes('Total lipid (fat)')) nutrients.fat = n.value;
           if(n.nutrientName.includes('Fiber')) nutrients.fiber = n.value;
       });
       console.log(nutrients);
    }
  } catch (err) {
    console.error(err.message);
  }
}

test();
