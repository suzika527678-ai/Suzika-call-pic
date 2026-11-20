import { PhotoItem, VideoItem } from '../types';

/**
 * Robust IndexedDB Persistent Storage for ZUZika Call Pic (v4 Clean Storage).
 * Stores ONLY real user-uploaded photos, video reels, and media binary blobs.
 * Completely purges and ignores any legacy dummy/Unsplash databases.
 */

const DB_NAME = 'zuzika_media_storage_v4';
const DB_VERSION = 1;

const PHOTO_STORE = 'photos';
const VIDEO_STORE = 'videos';
const BLOB_STORE = 'media_blobs';

/**
 * Validates that an item is a genuine user upload and NOT an old internet/demo item
 */
export function isAuthenticUserPhoto(p: PhotoItem | any): boolean {
  if (!p || typeof p !== 'object' || !p.id) return false;
  const id = String(p.id);
  // Only filter out legacy sample curated mocks
  if (id.startsWith('curated-') || id.startsWith('photo-curated-')) return false;
  return true;
}

/**
 * Validates that a video is a genuine user upload
 */
export function isAuthenticUserVideo(v: VideoItem | any): boolean {
  if (!v || typeof v !== 'object' || !v.id) return false;
  const id = String(v.id);
  if (id.startsWith('video-slot-') || id.startsWith('private-local-') || v.isPrivatePhoneVideo) return false;
  return true;
}

/**
 * Purge all legacy databases and stale client storages
 */
export async function purgeAllLegacyMediaCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Purge legacy localStorage keys
  const legacyKeys = [
    'zuzika_photos_v1',
    'zuzika_photos_v2',
    'zuzika_photos_v3',
    'zuzika_photos',
    'zuzika_videos_v1',
    'zuzika_videos_v2',
    'zuzika_videos_v3',
    'zuzika_videos',
  ];
  for (const k of legacyKeys) {
    try {
      localStorage.removeItem(k);
    } catch {}
  }

  // 2. Delete legacy IndexedDB databases
  if (window.indexedDB) {
    const legacyDBs = [
      'zuzika_persistent_db_v2',
      'zuzika_persistent_db_v1',
      'zuzika_persistent_db',
    ];
    for (const dbName of legacyDBs) {
      try {
        window.indexedDB.deleteDatabase(dbName);
      } catch {}
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open persistent storage'));
  });
}

/**
 * Save a photo item to persistent IndexedDB (only if authentic)
 */
export async function savePersistentPhoto(photo: PhotoItem): Promise<void> {
  if (!isAuthenticUserPhoto(photo)) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PHOTO_STORE], 'readwrite');
    const store = tx.objectStore(PHOTO_STORE);
    const req = store.put(photo);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to save photo to IndexedDB'));
  });
}

/**
 * Get all user-uploaded photos from persistent IndexedDB
 */
export async function getAllPersistentPhotos(): Promise<PhotoItem[]> {
  try {
    const db = await openDatabase();
    return new Promise<PhotoItem[]>((resolve) => {
      const tx = db.transaction([PHOTO_STORE], 'readonly');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const raw = (req.result || []) as PhotoItem[];
        resolve(raw.filter(isAuthenticUserPhoto));
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Failed to load persistent photos from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete a photo from persistent IndexedDB
 */
export async function deletePersistentPhoto(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PHOTO_STORE], 'readwrite');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete persistent photo from IndexedDB:', err);
  }
}

/**
 * Save a video item and optional binary Blob to persistent IndexedDB
 */
export async function savePersistentVideo(video: VideoItem, blob?: Blob): Promise<void> {
  if (!isAuthenticUserVideo(video)) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const storesToOpen = blob ? [VIDEO_STORE, BLOB_STORE] : [VIDEO_STORE];
    const tx = db.transaction(storesToOpen, 'readwrite');

    const videoStore = tx.objectStore(VIDEO_STORE);
    videoStore.put(video);

    if (blob) {
      const blobStore = tx.objectStore(BLOB_STORE);
      blobStore.put(blob, video.id);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save video to IndexedDB'));
  });
}

/**
 * Get all user-uploaded videos from persistent IndexedDB
 */
export async function getAllPersistentVideos(): Promise<VideoItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([VIDEO_STORE], 'readonly');
      const store = tx.objectStore(VIDEO_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const raw = (req.result || []) as VideoItem[];
        resolve(raw.filter(isAuthenticUserVideo));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load persistent videos from IndexedDB:', err);
    return [];
  }
}

/**
 * Retrieve a stored media blob (e.g. offline video or image) by ID
 */
export async function getPersistentMediaBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE], 'readonly');
      const store = tx.objectStore(BLOB_STORE);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load media blob from IndexedDB:', err);
    return null;
  }
}

/**
 * Save a raw media blob (video or image) directly to persistent IndexedDB
 */
export async function savePersistentMediaBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BLOB_STORE], 'readwrite');
    const store = tx.objectStore(BLOB_STORE);
    store.put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save media blob to IndexedDB'));
  });
}

/**
 * Delete a video and its associated blob from persistent IndexedDB
 */
export async function deletePersistentVideo(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([VIDEO_STORE, BLOB_STORE], 'readwrite');
      tx.objectStore(VIDEO_STORE).delete(id);
      tx.objectStore(BLOB_STORE).delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete persistent video from IndexedDB:', err);
  }
}

/**
 * Save multiple photos to persistent IndexedDB in a single batch transaction
 */
export async function saveMultiplePersistentPhotos(photos: PhotoItem[]): Promise<void> {
  const validPhotos = (photos || []).filter(isAuthenticUserPhoto);
  if (validPhotos.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PHOTO_STORE], 'readwrite');
    const store = tx.objectStore(PHOTO_STORE);
    for (const photo of validPhotos) {
      store.put(photo);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save multiple photos to IndexedDB'));
  });
}

/**
 * Save multiple videos and their optional binary Blobs in a single batch transaction
 */
export async function saveMultiplePersistentVideos(
  items: Array<{ video: VideoItem; blob?: Blob }>
): Promise<void> {
  const validItems = (items || []).filter((item) => isAuthenticUserVideo(item.video));
  if (validItems.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const hasBlobs = validItems.some((item) => Boolean(item.blob));
    const stores = hasBlobs ? [VIDEO_STORE, BLOB_STORE] : [VIDEO_STORE];
    const tx = db.transaction(stores, 'readwrite');
    const videoStore = tx.objectStore(VIDEO_STORE);
    const blobStore = hasBlobs ? tx.objectStore(BLOB_STORE) : null;

    for (const item of validItems) {
      videoStore.put(item.video);
      if (item.blob && blobStore) {
        blobStore.put(item.blob, item.video.id);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save multiple videos to IndexedDB'));
  });
}
