/**
 * IndexedDB Local Video Storage & Video Processing Utilities
 * Allows saving device videos (up to several GBs) directly in browser storage
 * without hitting Firestore's 1MB document size limit.
 */

const DB_NAME = 'zuzika_media_store_v1';
const STORE_NAME = 'video_blobs';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this browser.'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

import { getPersistentMediaBlob, savePersistentMediaBlob } from './persistentMediaStore';

/**
 * Save a raw video File/Blob to local IndexedDB (both primary and legacy stores)
 */
export async function saveLocalVideoBlob(videoId: string, blob: Blob): Promise<void> {
  // Save once to primary persistent store (zuzika_persistent_db_v2) to avoid double disk I/O
  try {
    await savePersistentMediaBlob(videoId, blob);
  } catch (err) {
    console.warn('Persistent store blob save error:', err);
  }
}

/**
 * Retrieve a video Blob from local IndexedDB (checks persistentMediaStore first, then legacy store)
 */
export async function getLocalVideoBlob(videoId: string): Promise<Blob | null> {
  if (!videoId) return null;

  // 1. Check primary persistent storage (zuzika_persistent_db_v2)
  try {
    const pBlob = await getPersistentMediaBlob(videoId);
    if (pBlob && pBlob.size > 0) {
      return pBlob;
    }
  } catch (e) {
    console.warn('Error reading from persistentMediaStore:', e);
  }

  // 2. Check legacy store (zuzika_media_store_v1)
  try {
    const db = await openDB();
    const lBlob = await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(videoId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (lBlob && lBlob.size > 0) {
      // Sync forward to persistent store
      savePersistentMediaBlob(videoId, lBlob).catch(() => {});
      return lBlob;
    }
  } catch (e) {
    console.warn('Error reading from legacy IndexedDB:', e);
  }

  return null;
}

/**
 * Delete a video Blob from local IndexedDB across all stores
 */
export async function deleteLocalVideoBlob(videoId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(videoId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Error deleting from legacy IndexedDB:', e);
  }
}

const DEFAULT_VIDEO_FALLBACK_THUMB =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 750'%3E%3Crect width='100%25' height='100%25' fill='%23111424'/%3E%3Cpolygon points='290,360 322,375 290,390' fill='%2300d2ff'/%3E%3C/svg%3E";

/**
 * Generate a thumbnail and duration from a video file (timeout-safe, never hangs on unsupported codecs)
 */
export function extractVideoMeta(
  file: File,
  timeoutMs = 3200
): Promise<{ thumbnailUrl: string; durationStr: string; durationSec: number }> {
  return new Promise((resolve) => {
    let settled = false;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      try {
        video.onloadedmetadata = null;
        video.onseeked = null;
        video.onerror = null;
        video.removeAttribute('src');
        video.load();
        video.remove();
      } catch {}
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    };

    const finish = (result: { thumbnailUrl: string; durationStr: string; durationSec: number }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      cleanup();
      resolve(result);
    };

    const getFormattedDuration = () => {
      const raw = Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : 30;
      const mins = Math.floor(raw / 60);
      const secs = raw % 60;
      return {
        durationSec: raw,
        durationStr: `${mins}:${secs < 10 ? '0' : ''}${secs}`,
      };
    };

    const timerId = window.setTimeout(() => {
      const dur = getFormattedDuration();
      finish({
        thumbnailUrl: DEFAULT_VIDEO_FALLBACK_THUMB,
        ...dur,
      });
    }, timeoutMs);

    video.src = objectUrl;

    video.onloadedmetadata = () => {
      if (settled) return;
      const rawDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      try {
        video.currentTime = Math.min(1.2, rawDur * 0.25 || 0.2);
      } catch {
        const dur = getFormattedDuration();
        finish({ thumbnailUrl: DEFAULT_VIDEO_FALLBACK_THUMB, ...dur });
      }
    };

    video.onseeked = () => {
      if (settled) return;
      try {
        const canvas = document.createElement('canvas');
        const maxW = 320;
        const scale = maxW / Math.max(video.videoWidth || 320, 1);
        canvas.width = Math.min(video.videoWidth || 320, maxW);
        canvas.height = Math.round((video.videoHeight || 240) * (scale < 1 ? scale : 1));

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          let q = 0.68;
          let thumbnailUrl = canvas.toDataURL('image/jpeg', q);
          while (thumbnailUrl.length > 70_000 && q > 0.3) {
            q -= 0.12;
            thumbnailUrl = canvas.toDataURL('image/jpeg', q);
          }
          const dur = getFormattedDuration();
          finish({ thumbnailUrl, ...dur });
          return;
        }
      } catch (e) {
        console.warn('Canvas video capture failed:', e);
      }

      const dur = getFormattedDuration();
      finish({ thumbnailUrl: DEFAULT_VIDEO_FALLBACK_THUMB, ...dur });
    };

    video.onerror = () => {
      finish({
        thumbnailUrl: DEFAULT_VIDEO_FALLBACK_THUMB,
        durationStr: '0:30',
        durationSec: 30,
      });
    };
  });
}

/**
 * Detect YouTube URLs (Watch, Shorts, Embed, youtu.be)
 */
export function parseYouTubeUrl(url: string): { isYouTube: boolean; videoId?: string; embedUrl?: string; thumbnailUrl?: string } {
  if (!url) return { isYouTube: false };

  // Match youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);

  if (match && match[1]) {
    const videoId = match[1];
    return {
      isYouTube: true,
      videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  return { isYouTube: false };
}
