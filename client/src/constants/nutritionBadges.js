export const NUTRITION_BADGES = [
  { id: 'bronze', name: 'Begin', days: 0, xp: 0, adherence: 0 },
  { id: 'silver', name: 'Build', days: 14, xp: 1000, adherence: 60 },
  { id: 'gold', name: 'Balance', days: 28, xp: 2500, adherence: 65 },
  { id: 'diamond', name: 'Steady', days: 50, xp: 5000, adherence: 70 },
  { id: 'platinum', name: 'Aligned', days: 100, xp: 12000, adherence: 75 },
  { id: 'elite', name: 'Sustain', days: 200, xp: 28000, adherence: 80 },
  { id: 'legend', name: 'Thrive', days: 365, xp: 60000, adherence: 85 },
];

export const BADGE_ASSETS = {
  bronze: '/badges/nutrition/begin.svg',
  silver: '/badges/nutrition/build.svg',
  gold: '/badges/nutrition/balance.svg',
  diamond: '/badges/nutrition/steady.svg',
  platinum: '/badges/nutrition/aligned.svg',
  elite: '/badges/nutrition/sustain.svg',
  legend: '/badges/nutrition/thrive.svg',
};

export function getBadgeAsset(badge) {
  const id = typeof badge === 'string' ? badge : badge?.id;
  return BADGE_ASSETS[id] || BADGE_ASSETS.bronze;
}
