/**
 * Indian Food Detection — Class Index Mapping
 * 
 * This file maps the integer class indices returned by the deep learning model
 * (VGG16 / ResNet trained on the Indian Food Images dataset) to their
 * human-readable food names.
 *
 * The model outputs a probability vector of length 80. The predicted class is
 * obtained via argmax:
 *   const predictedIndex = predictions.indexOf(Math.max(...predictions));
 *
 * The indices correspond to the alphabetically-sorted subdirectory names of the
 * training dataset, which is the default ordering used by
 * `tf.keras.preprocessing.image_dataset_from_directory` and
 * `ImageDataGenerator.flow_from_directory`.
 *
 * Total classes: 80
 */

const FOOD_CLASS_MAP = Object.freeze({
  0:  'adhirasam',
  1:  'aloo_gobi',
  2:  'aloo_matar',
  3:  'aloo_methi',
  4:  'aloo_shimla_mirch',
  5:  'aloo_tikki',
  6:  'anarsa',
  7:  'ariselu',
  8:  'bandar_laddu',
  9:  'basundi',
  10: 'bhatura',
  11: 'bhindi_masala',
  12: 'biryani',
  13: 'boondi',
  14: 'butter_chicken',
  15: 'chak_hao_kheer',
  16: 'cham_cham',
  17: 'chana_masala',
  18: 'chapati',
  19: 'chhena_kheeri',
  20: 'chicken_razala',
  21: 'chicken_tikka',
  22: 'chicken_tikka_masala',
  23: 'chikki',
  24: 'daal_baati_churma',
  25: 'daal_puri',
  26: 'dal_makhani',
  27: 'dal_tadka',
  28: 'dharwad_pedha',
  29: 'doodhpak',
  30: 'double_ka_meetha',
  31: 'dum_aloo',
  32: 'gajar_ka_halwa',
  33: 'gavvalu',
  34: 'ghevar',
  35: 'gulab_jamun',
  36: 'imarti',
  37: 'jalebi',
  38: 'kachori',
  39: 'kadai_paneer',
  40: 'kadhi_pakoda',
  41: 'kajjikaya',
  42: 'kakinada_khaja',
  43: 'kalakand',
  44: 'karela_bharta',
  45: 'kofta',
  46: 'kuzhi_paniyaram',
  47: 'lassi',
  48: 'ledikeni',
  49: 'litti_chokha',
  50: 'lyangcha',
  51: 'maach_jhol',
  52: 'makki_di_roti_sarson_da_saag',
  53: 'malapua',
  54: 'misi_roti',
  55: 'misti_doi',
  56: 'modak',
  57: 'mysore_pak',
  58: 'naan',
  59: 'navrattan_korma',
  60: 'palak_paneer',
  61: 'paneer_butter_masala',
  62: 'phirni',
  63: 'pithe',
  64: 'poha',
  65: 'poornalu',
  66: 'pootharekulu',
  67: 'qubani_ka_meetha',
  68: 'rabri',
  69: 'rasgulla',
  70: 'ras_malai',
  71: 'sandesh',
  72: 'shankarpali',
  73: 'sheera',
  74: 'sheer_korma',
  75: 'shrikhand',
  76: 'sohan_halwa',
  77: 'sohan_papdi',
  78: 'sutar_feni',
  79: 'unni_appam',
});

/**
 * Total number of food classes the model can predict.
 */
const TOTAL_CLASSES = Object.keys(FOOD_CLASS_MAP).length;

/**
 * Converts a class index (0–79) to its food name string.
 * @param {number} index — The argmax index from the model's prediction vector.
 * @returns {string} The human-readable food name, e.g. "butter_chicken".
 * @throws {RangeError} If the index is out of bounds.
 */
function getFoodNameByIndex(index) {
  const name = FOOD_CLASS_MAP[index];
  if (name === undefined) {
    throw new RangeError(
      `Index ${index} is out of range. Valid range: 0–${TOTAL_CLASSES - 1}`
    );
  }
  return name;
}

/**
 * Converts a food name string back to its class index.
 * @param {string} name — The food name, e.g. "biryani".
 * @returns {number} The corresponding class index (0–79).
 * @throws {Error} If the name is not found in the map.
 */
function getIndexByFoodName(name) {
  const lowerName = name.toLowerCase();
  for (const [idx, foodName] of Object.entries(FOOD_CLASS_MAP)) {
    if (foodName === lowerName) {
      return Number(idx);
    }
  }
  throw new Error(`Food name "${name}" not found in the class map.`);
}

/**
 * Given the raw prediction array from the model, returns the top-N predictions
 * with their food names and confidence scores.
 * @param {number[]} predictions — Array of 80 probabilities from the model.
 * @param {number} [topN=5] — How many top predictions to return.
 * @returns {{ index: number, name: string, confidence: number }[]}
 */
function getTopPredictions(predictions, topN = 5) {
  if (!Array.isArray(predictions) || predictions.length !== TOTAL_CLASSES) {
    throw new Error(
      `Expected an array of ${TOTAL_CLASSES} probabilities, got ${
        Array.isArray(predictions) ? predictions.length : typeof predictions
      }.`
    );
  }

  const indexed = predictions.map((confidence, index) => ({
    index,
    name: FOOD_CLASS_MAP[index],
    confidence,
  }));

  indexed.sort((a, b) => b.confidence - a.confidence);

  return indexed.slice(0, topN);
}

module.exports = {
  FOOD_CLASS_MAP,
  TOTAL_CLASSES,
  getFoodNameByIndex,
  getIndexByFoodName,
  getTopPredictions,
};
