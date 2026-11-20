import { PhotoItem, VideoItem, AppBannerConfig, CategoryType } from '../types';

/**
 * Storage and management of unlocked media items.
 * Tracks content unlocked via Google AdMob Rewarded Ads.
 * Complies with AdMob Reward policies:
 * - Unlocks ONLY after onUserEarnedReward is confirmed.
 * - Never unlocks private phone gallery videos (which are always free and private).
 * - Persists unlocked state based on configured unlock duration (Session, 24h, or Permanent).
 */

const UNLOCKED_ITEMS_STORAGE_KEY = 'suzika_unlocked_media_v1';

export interface UnlockedRecord {
  id: string;
  type: 'photo' | 'video';
  unlockedAt: number; // timestamp ms
  expiresAt: number | null; // null for permanent, or ms timestamp
}

// Memory cache for instantaneous sync checks
let memoryUnlockedMap = new Map<string, UnlockedRecord>();

function initStore(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(UNLOCKED_ITEMS_STORAGE_KEY);
    if (raw) {
      const records: UnlockedRecord[] = JSON.parse(raw);
      const now = Date.now();
      const valid = records.filter((r) => r.expiresAt === null || r.expiresAt > now);
      memoryUnlockedMap.clear();
      valid.forEach((r) => memoryUnlockedMap.set(r.id, r));
    }
  } catch (err) {
    console.warn('Failed to load unlocked media store:', err);
  }
}

// Initialize on module load
initStore();

function persistStore(): void {
  if (typeof window === 'undefined') return;
  try {
    const list = Array.from(memoryUnlockedMap.values());
    localStorage.setItem(UNLOCKED_ITEMS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to persist unlocked media store:', err);
  }
}

/**
 * Record a reward-earned unlock for a photo or video
 */
export function recordMediaUnlocked(
  id: string,
  type: 'photo' | 'video',
  durationHours: number = 24
): void {
  const now = Date.now();
  const expiresAt = durationHours === 0 || durationHours > 720
    ? null // Permanent
    : now + durationHours * 60 * 60 * 1000;

  memoryUnlockedMap.set(id, {
    id,
    type,
    unlockedAt: now,
    expiresAt,
  });

  persistStore();
}

/**
 * Check if a specific ID is currently unlocked
 */
export function isIdUnlocked(id: string): boolean {
  const record = memoryUnlockedMap.get(id);
  if (!record) return false;
  if (record.expiresAt !== null && record.expiresAt <= Date.now()) {
    memoryUnlockedMap.delete(id);
    persistStore();
    return false;
  }
  return true;
}

/**
 * Check if a Photo should be blurred/locked
 * Premium photos: Explicitly locked by admin, or belonging to configured premium categories
 * (e.g. 'Sexy', 'Call', 'Hot' as indicated in the UI)
 */
export function isPhotoLocked(
  photo: PhotoItem,
  config?: AppBannerConfig
): boolean {
  if (!photo) return false;

  // If already unlocked by watching a rewarded ad, return false
  if (isIdUnlocked(photo.id)) {
    return false;
  }

  // If photo is explicitly marked locked in its document
  if (photo.isLocked === true) {
    return true;
  }
  if (photo.isLocked === false) {
    return false;
  }

  // Check category lock rule from config or default premium categories ('Sexy', 'Call', 'Hot')
  const lockedCategories: CategoryType[] = config?.lockedCategories || ['Sexy', 'Call', 'Hot'];
  if (config?.requireAdForPremiumPhotos !== false && lockedCategories.includes(photo.category)) {
    return true;
  }

  return false;
}

/**
 * Check if a Video should be blurred/locked
 * Online videos: Locked by default unless unlocked by watching Rewarded Ad.
 * PRIVATE PHONE VIDEOS: NEVER LOCKED OR BLURRED (Requirement 10).
 */
export function isVideoLocked(
  video: VideoItem,
  config?: AppBannerConfig
): boolean {
  if (!video) return false;

  // RULE 10: Private phone gallery videos are NEVER locked or blurred!
  if (video.videoUrl?.startsWith('blob:') || video.isPrivatePhoneVideo === true) {
    return false;
  }

  // If user already earned reward for this video, it is unlocked
  if (isIdUnlocked(video.id)) {
    return false;
  }

  // Explicit admin flag
  if (video.isLocked === false) {
    return false;
  }
  if (video.isLocked === true) {
    return true;
  }

  // Online uploaded videos require ad unlock if enabled in config (default: true)
  if (config?.lockOnlineVideosByDefault !== false) {
    return true;
  }

  return false;
}

/**
 * Reset unlocked items (e.g. from Admin or Profile)
 */
export function clearUnlockedMedia(): void {
  memoryUnlockedMap.clear();
  persistStore();
}
