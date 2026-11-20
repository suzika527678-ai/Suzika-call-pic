/**
 * Utility functions for displaying likes and views uniformly across the app.
 * Guarantees likes always appear between 100 and 600 as requested:
 * "Like 100 থেকে 600 মধ্যে দেখাবে"
 */

export const formatLikes = (
  rawLikes: number = 0,
  slotNumber: number = 1,
  id: string = ''
): number => {
  // If rawLikes is already in the target 100 to 600 range, return as is
  if (rawLikes >= 100 && rawLikes <= 600) {
    return rawLikes;
  }

  // If rawLikes is greater than 600, normalize within 100 to 600
  if (rawLikes > 600) {
    return 100 + (rawLikes % 501);
  }

  // If rawLikes is under 100 (e.g. 0, 1, 8, or unseeded),
  // generate a stable, natural base between 120 and 580 using deterministic hashing
  const slotVal = typeof slotNumber === 'number' && !isNaN(slotNumber) ? slotNumber : 1;
  const str = `${slotVal}-${id || 'slot'}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 100000;
  }

  const seed = (Math.abs(hash) + slotVal * 73 + 47) % 461; // 0 to 460
  const baseLikes = 120 + seed; // 120 to 580
  const userDelta = rawLikes > 0 ? (rawLikes % 20) : 0;
  const result = baseLikes + userDelta;

  // Strict clamp: guarantees 100 <= likes <= 600
  return Math.min(600, Math.max(100, result));
};

export const formatViews = (views: number = 0, slotNumber: number = 1): string => {
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1).replace('.0', '')}k`;
  }
  const slotVal = typeof slotNumber === 'number' && !isNaN(slotNumber) ? slotNumber : 1;
  const fallbackK = (1.1 + (slotVal % 8) * 0.1).toFixed(1);
  return `${fallbackK}k`;
};

export const generateInitialLikes = (slotNumber: number = 1): number => {
  const slotVal = typeof slotNumber === 'number' && !isNaN(slotNumber) ? slotNumber : 1;
  const seed = (slotVal * 83 + 127) % 451;
  return 120 + seed; // strictly 120 to 571
};
