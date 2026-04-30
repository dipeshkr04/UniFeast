/**
 * Hardcoded per-serving nutrition data for all 80 Indian food classes.
 *
 * Source: approximate values from USDA FoodData Central and
 * Indian Food Composition Tables (IFCT 2017).
 *
 * Each entry provides a typical single-serving estimate.
 * All numeric values are per serving:
 *   - calories: kcal
 *   - protein:  grams
 *   - carbs:    grams
 *   - fat:      grams
 *   - fiber:    grams
 */

const INDIAN_FOOD_NUTRITION = Object.freeze({
  adhirasam:                     { calories: 150, protein: 2,    carbs: 22,  fat: 6,   fiber: 0.5 },
  aloo_gobi:                     { calories: 180, protein: 4,    carbs: 20,  fat: 10,  fiber: 3   },
  aloo_matar:                    { calories: 200, protein: 5,    carbs: 22,  fat: 10,  fiber: 4   },
  aloo_methi:                    { calories: 190, protein: 4,    carbs: 20,  fat: 10,  fiber: 3   },
  aloo_shimla_mirch:             { calories: 170, protein: 3,    carbs: 18,  fat: 9,   fiber: 2.5 },
  aloo_tikki:                    { calories: 250, protein: 5,    carbs: 30,  fat: 12,  fiber: 3   },
  anarsa:                        { calories: 200, protein: 3,    carbs: 35,  fat: 6,   fiber: 0.5 },
  ariselu:                       { calories: 220, protein: 3,    carbs: 38,  fat: 7,   fiber: 1   },
  bandar_laddu:                  { calories: 180, protein: 4,    carbs: 28,  fat: 7,   fiber: 1   },
  basundi:                       { calories: 250, protein: 7,    carbs: 30,  fat: 12,  fiber: 0   },
  bhatura:                       { calories: 300, protein: 6,    carbs: 40,  fat: 14,  fiber: 1.5 },
  bhindi_masala:                 { calories: 150, protein: 3,    carbs: 12,  fat: 10,  fiber: 4   },
  biryani:                       { calories: 350, protein: 15,   carbs: 45,  fat: 12,  fiber: 2   },
  boondi:                        { calories: 160, protein: 3,    carbs: 20,  fat: 8,   fiber: 1   },
  butter_chicken:                { calories: 400, protein: 28,   carbs: 12,  fat: 25,  fiber: 1   },
  chak_hao_kheer:                { calories: 220, protein: 5,    carbs: 35,  fat: 7,   fiber: 1   },
  cham_cham:                     { calories: 200, protein: 5,    carbs: 30,  fat: 7,   fiber: 0   },
  chana_masala:                  { calories: 250, protein: 10,   carbs: 32,  fat: 10,  fiber: 8   },
  chapati:                       { calories: 120, protein: 4,    carbs: 20,  fat: 3,   fiber: 2   },
  chhena_kheeri:                 { calories: 230, protein: 6,    carbs: 32,  fat: 9,   fiber: 0   },
  chicken_razala:                { calories: 350, protein: 25,   carbs: 8,   fat: 24,  fiber: 1   },
  chicken_tikka:                 { calories: 250, protein: 30,   carbs: 5,   fat: 12,  fiber: 0.5 },
  chicken_tikka_masala:          { calories: 380, protein: 26,   carbs: 14,  fat: 22,  fiber: 2   },
  chikki:                        { calories: 180, protein: 5,    carbs: 22,  fat: 8,   fiber: 1   },
  daal_baati_churma:             { calories: 450, protein: 12,   carbs: 55,  fat: 20,  fiber: 5   },
  daal_puri:                     { calories: 280, protein: 8,    carbs: 35,  fat: 12,  fiber: 4   },
  dal_makhani:                   { calories: 350, protein: 12,   carbs: 35,  fat: 18,  fiber: 5   },
  dal_tadka:                     { calories: 250, protein: 12,   carbs: 30,  fat: 8,   fiber: 6   },
  dharwad_pedha:                 { calories: 200, protein: 5,    carbs: 28,  fat: 8,   fiber: 0   },
  doodhpak:                      { calories: 250, protein: 7,    carbs: 32,  fat: 10,  fiber: 0   },
  double_ka_meetha:              { calories: 280, protein: 6,    carbs: 38,  fat: 12,  fiber: 0.5 },
  dum_aloo:                      { calories: 220, protein: 4,    carbs: 25,  fat: 12,  fiber: 3   },
  gajar_ka_halwa:                { calories: 300, protein: 5,    carbs: 40,  fat: 14,  fiber: 2   },
  gavvalu:                       { calories: 170, protein: 3,    carbs: 22,  fat: 8,   fiber: 0.5 },
  ghevar:                        { calories: 350, protein: 4,    carbs: 45,  fat: 18,  fiber: 0.5 },
  gulab_jamun:                   { calories: 300, protein: 5,    carbs: 45,  fat: 12,  fiber: 0   },
  imarti:                        { calories: 280, protein: 4,    carbs: 40,  fat: 12,  fiber: 1   },
  jalebi:                        { calories: 300, protein: 3,    carbs: 48,  fat: 12,  fiber: 0   },
  kachori:                       { calories: 280, protein: 6,    carbs: 30,  fat: 15,  fiber: 2   },
  kadai_paneer:                  { calories: 320, protein: 14,   carbs: 10,  fat: 24,  fiber: 2   },
  kadhi_pakoda:                  { calories: 200, protein: 6,    carbs: 18,  fat: 12,  fiber: 2   },
  kajjikaya:                     { calories: 200, protein: 3,    carbs: 28,  fat: 9,   fiber: 1   },
  kakinada_khaja:                { calories: 250, protein: 3,    carbs: 35,  fat: 12,  fiber: 0.5 },
  kalakand:                      { calories: 220, protein: 6,    carbs: 28,  fat: 10,  fiber: 0   },
  karela_bharta:                 { calories: 120, protein: 3,    carbs: 10,  fat: 8,   fiber: 3   },
  kofta:                         { calories: 300, protein: 12,   carbs: 15,  fat: 22,  fiber: 2   },
  kuzhi_paniyaram:               { calories: 160, protein: 4,    carbs: 25,  fat: 5,   fiber: 1   },
  lassi:                         { calories: 180, protein: 6,    carbs: 25,  fat: 6,   fiber: 0   },
  ledikeni:                      { calories: 250, protein: 5,    carbs: 35,  fat: 10,  fiber: 0   },
  litti_chokha:                  { calories: 350, protein: 10,   carbs: 45,  fat: 14,  fiber: 5   },
  lyangcha:                      { calories: 230, protein: 5,    carbs: 32,  fat: 9,   fiber: 0   },
  maach_jhol:                    { calories: 250, protein: 20,   carbs: 10,  fat: 14,  fiber: 2   },
  makki_di_roti_sarson_da_saag:  { calories: 300, protein: 8,    carbs: 35,  fat: 14,  fiber: 5   },
  malapua:                       { calories: 280, protein: 5,    carbs: 38,  fat: 12,  fiber: 1   },
  misi_roti:                     { calories: 150, protein: 6,    carbs: 22,  fat: 4,   fiber: 3   },
  misti_doi:                     { calories: 200, protein: 6,    carbs: 30,  fat: 6,   fiber: 0   },
  modak:                         { calories: 200, protein: 3,    carbs: 30,  fat: 8,   fiber: 1.5 },
  mysore_pak:                    { calories: 350, protein: 5,    carbs: 35,  fat: 22,  fiber: 1   },
  naan:                          { calories: 260, protein: 8,    carbs: 45,  fat: 5,   fiber: 2   },
  navrattan_korma:               { calories: 320, protein: 10,   carbs: 22,  fat: 22,  fiber: 4   },
  palak_paneer:                  { calories: 300, protein: 14,   carbs: 10,  fat: 22,  fiber: 3   },
  paneer_butter_masala:          { calories: 380, protein: 14,   carbs: 14,  fat: 28,  fiber: 2   },
  phirni:                        { calories: 200, protein: 5,    carbs: 30,  fat: 7,   fiber: 0.5 },
  pithe:                         { calories: 180, protein: 3,    carbs: 28,  fat: 7,   fiber: 1   },
  poha:                          { calories: 250, protein: 5,    carbs: 40,  fat: 8,   fiber: 2   },
  poornalu:                      { calories: 220, protein: 4,    carbs: 32,  fat: 9,   fiber: 1   },
  pootharekulu:                  { calories: 200, protein: 3,    carbs: 30,  fat: 8,   fiber: 0.5 },
  qubani_ka_meetha:              { calories: 220, protein: 3,    carbs: 35,  fat: 8,   fiber: 2   },
  rabri:                         { calories: 300, protein: 8,    carbs: 35,  fat: 14,  fiber: 0   },
  rasgulla:                      { calories: 180, protein: 5,    carbs: 30,  fat: 4,   fiber: 0   },
  ras_malai:                     { calories: 250, protein: 7,    carbs: 32,  fat: 10,  fiber: 0   },
  sandesh:                       { calories: 200, protein: 6,    carbs: 25,  fat: 8,   fiber: 0   },
  shankarpali:                   { calories: 200, protein: 3,    carbs: 25,  fat: 10,  fiber: 0.5 },
  sheera:                        { calories: 250, protein: 4,    carbs: 35,  fat: 12,  fiber: 1   },
  sheer_korma:                   { calories: 350, protein: 8,    carbs: 40,  fat: 18,  fiber: 1   },
  shrikhand:                     { calories: 280, protein: 6,    carbs: 38,  fat: 12,  fiber: 0   },
  sohan_halwa:                   { calories: 300, protein: 5,    carbs: 35,  fat: 16,  fiber: 1   },
  sohan_papdi:                   { calories: 250, protein: 4,    carbs: 30,  fat: 14,  fiber: 0.5 },
  sutar_feni:                    { calories: 280, protein: 3,    carbs: 32,  fat: 16,  fiber: 0   },
  unni_appam:                    { calories: 180, protein: 3,    carbs: 28,  fat: 7,   fiber: 1   },
});

module.exports = { INDIAN_FOOD_NUTRITION };
