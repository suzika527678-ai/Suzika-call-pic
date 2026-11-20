import { db, doc, getDoc, setDoc, deleteDoc, firebaseConfig } from '../firebase';

/**
 * Permanent Cloud Firestore Binary Chunk Storage for ZUZika Call Pic.
 * Uses Direct Firestore REST API parallel HTTP/2 streams (~4x-8x faster than Firestore SDK WriteBatch)
 * so large videos (up to 40 MB) upload rapidly and persist 100% permanently in Cloud Firestore.
 */

const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

export const CHUNK_RAW_BYTES = 680 * 1024; // 680 KB binary -> ~906 KB base64 (safely < 1 MiB Firestore doc limit)
export const MAX_CLOUD_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB max per cloud-chunked video

async function writeFirestoreDocFast(
  collectionName: string,
  docId: string,
  restFields: Record<string, { stringValue?: string; integerValue?: string }>,
  sdkData: Record<string, any>
): Promise<void> {
  const url = `${FIRESTORE_REST_BASE}/${collectionName}/${encodeURIComponent(docId)}`;
  const body = JSON.stringify({ fields: restFields });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) return;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        break;
      }
    } catch {
      // Retry once after short backoff
    }
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 220));
    }
  }

  // Fallback to Firestore Web SDK if REST call failed
  await setDoc(doc(db, collectionName, docId), sdkData);
}

export interface CloudVideoUploadResult {
  streamUrl: string;
  totalChunks: number;
  sizeBytes: number;
  mimeType: string;
  ext: string;
}

export function sortMediaNewestFirst<T extends { slotNumber?: number; createdAtMs?: number }>(a: T, b: T): number {
  const slotDiff = (Number(b.slotNumber) || 0) - (Number(a.slotNumber) || 0);
  if (slotDiff !== 0) return slotDiff;
  return (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0);
}

export function extractStreamVideoId(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim().split('?')[0];
  if (!trimmed.startsWith('/api/video-stream/')) return null;
  const filename = trimmed.slice('/api/video-stream/'.length);
  if (!filename) return null;
  return filename.replace(/\.[^.]+$/, '');
}

export function isPermanentVideoSource(video?: { videoUrl?: string; isCloudChunked?: boolean } | null): boolean {
  if (!video) return false;
  const url = (video.videoUrl || '').trim();
  if (!url) return false;
  if (video.isCloudChunked || url.startsWith('/api/video-stream/')) return true;
  if (url.startsWith('data:video/') || url.startsWith('http://') || url.startsWith('https://')) return true;
  return false;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function detectVideoExtension(fileOrBlob: Blob, originalName?: string): { ext: string; mimeType: string } {
  const mimeType = fileOrBlob.type && fileOrBlob.type.startsWith('video/') ? fileOrBlob.type : 'video/mp4';
  const rawName = originalName || (typeof File !== 'undefined' && fileOrBlob instanceof File ? fileOrBlob.name : '');
  const rawExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const mimeExt = mimeType.split('/')[1]?.split(';')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = rawExt && ['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(rawExt)
    ? rawExt
    : mimeExt && ['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(mimeExt)
    ? mimeExt
    : 'mp4';
  return { ext, mimeType };
}

/**
 * Upload a video Blob permanently to Cloud Firestore (`videoChunks` + `videoFiles` collections)
 * using 680 KB chunks & parallel HTTP/2 REST PATCH streams for maximum upload speed.
 */
export async function uploadVideoToFirestoreChunks(
  videoId: string,
  fileOrBlob: Blob,
  originalName?: string,
  onProgress?: (percent: number, message: string) => void,
  chunkConcurrency = 6
): Promise<CloudVideoUploadResult> {
  if (!videoId || !fileOrBlob || fileOrBlob.size === 0) {
    throw new Error('ভিডিও ফাইলটি খালি বা অকার্যকর।');
  }

  if (fileOrBlob.size > MAX_CLOUD_VIDEO_BYTES) {
    throw new Error(
      `ভিডিও সাইজ ${(fileOrBlob.size / (1024 * 1024)).toFixed(1)} MB, যা ক্লাউড স্টোরেজের সর্বোচ্চ সীমা (40 MB) ছাড়িয়ে গেছে। ছোট ক্লিপ বা YouTube লিংক দিন।`
    );
  }

  const { ext, mimeType } = detectVideoExtension(fileOrBlob, originalName);
  const totalChunks = Math.ceil(fileOrBlob.size / CHUNK_RAW_BYTES);

  onProgress?.(5, `ক্লাউডে পাঠানো হচ্ছে (${totalChunks} খণ্ড)...`);

  let nextChunkIdx = 0;
  let completedChunks = 0;
  const workers = Math.min(Math.max(1, chunkConcurrency), totalChunks);

  const runChunkWorker = async () => {
    while (true) {
      const idx = nextChunkIdx++;
      if (idx >= totalChunks) break;

      const byteStart = idx * CHUNK_RAW_BYTES;
      const byteEnd = Math.min(byteStart + CHUNK_RAW_BYTES, fileOrBlob.size);
      const sliceBuf = await fileOrBlob.slice(byteStart, byteEnd).arrayBuffer();
      const slice = new Uint8Array(sliceBuf);
      const base64Data = uint8ArrayToBase64(slice);
      const chunkDocId = `${videoId}_c_${idx}`;

      await writeFirestoreDocFast(
        'videoChunks',
        chunkDocId,
        {
          videoId: { stringValue: videoId },
          index: { integerValue: String(idx) },
          sizeBytes: { integerValue: String(slice.length) },
          data: { stringValue: base64Data },
        },
        {
          videoId,
          index: idx,
          sizeBytes: slice.length,
          data: base64Data,
        }
      );

      completedChunks++;
      const pct = Math.min(95, Math.round((completedChunks / totalChunks) * 88) + 6);
      onProgress?.(pct, `ক্লাউডে সেভ হচ্ছে (${completedChunks}/${totalChunks})...`);
    }
  };

  await Promise.all(Array.from({ length: workers }, () => runChunkWorker()));

  const nowMs = Date.now();
  await writeFirestoreDocFast(
    'videoFiles',
    videoId,
    {
      videoId: { stringValue: videoId },
      totalChunks: { integerValue: String(totalChunks) },
      sizeBytes: { integerValue: String(fileOrBlob.size) },
      mimeType: { stringValue: mimeType },
      ext: { stringValue: ext },
      updatedAt: { integerValue: String(nowMs) },
    },
    {
      videoId,
      totalChunks,
      sizeBytes: fileOrBlob.size,
      mimeType,
      ext,
      updatedAt: nowMs,
    }
  );

  onProgress?.(100, 'ক্লাউড স্টোরেজে স্থায়ীভাবে সংরক্ষিত হয়েছে!');

  return {
    streamUrl: `/api/video-stream/${videoId}.${ext}`,
    totalChunks,
    sizeBytes: fileOrBlob.size,
    mimeType,
    ext,
  };
}

/**
 * Reassemble a chunked video Blob directly from Cloud Firestore.
 */
export async function fetchVideoBlobFromFirestoreChunks(videoId: string): Promise<Blob | null> {
  try {
    const manifestSnap = await getDoc(doc(db, 'videoFiles', videoId));
    if (!manifestSnap.exists()) return null;

    const manifest = manifestSnap.data() as {
      totalChunks?: number;
      mimeType?: string;
    };
    const totalChunks = Number(manifest.totalChunks) || 0;
    if (totalChunks <= 0) return null;

    const parts: Uint8Array[] = new Array(totalChunks);
    const batchSize = 6;

    for (let start = 0; start < totalChunks; start += batchSize) {
      const indices: number[] = [];
      for (let idx = start; idx < Math.min(start + batchSize, totalChunks); idx++) {
        indices.push(idx);
      }

      const snaps = await Promise.all(
        indices.map((idx) => getDoc(doc(db, 'videoChunks', `${videoId}_c_${idx}`)))
      );

      for (let i = 0; i < snaps.length; i++) {
        const snap = snaps[i];
        if (!snap.exists()) return null;
        const data = snap.data()?.data;
        if (typeof data !== 'string' || !data) return null;
        parts[indices[i]] = base64ToUint8Array(data);
      }
    }

    const totalLen = parts.reduce((sum, p) => sum + p.byteLength, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.byteLength;
    }

    return new Blob([combined], { type: manifest.mimeType || 'video/mp4' });
  } catch (err) {
    console.warn('Could not reassemble video from Firestore chunks:', err);
    return null;
  }
}

export async function hasVideoManifestInFirestore(videoId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'videoFiles', videoId));
    return snap.exists() && Number(snap.data()?.totalChunks) > 0;
  } catch {
    return false;
  }
}

export async function deleteVideoChunksFromFirestore(videoId: string): Promise<void> {
  try {
    const manifestSnap = await getDoc(doc(db, 'videoFiles', videoId));
    const totalChunks = manifestSnap.exists() ? Number(manifestSnap.data()?.totalChunks) || 0 : 0;

    if (totalChunks > 0) {
      const batchSize = 8;
      for (let start = 0; start < totalChunks; start += batchSize) {
        const promises: Promise<void>[] = [];
        for (let idx = start; idx < Math.min(start + batchSize, totalChunks); idx++) {
          promises.push(deleteDoc(doc(db, 'videoChunks', `${videoId}_c_${idx}`)).catch(() => {}));
        }
        await Promise.all(promises);
      }
    }

    await deleteDoc(doc(db, 'videoFiles', videoId)).catch(() => {});
  } catch (err) {
    console.warn('Error deleting Firestore video chunks:', err);
  }
}

export const MAX_CLOUD_APK_BYTES = 60 * 1024 * 1024; // 60 MB max per cloud-chunked APK

export interface CloudApkUploadResult {
  downloadUrl: string;
  totalChunks: number;
  sizeBytes: number;
}

/**
 * Upload an Android .apk file permanently to Cloud Firestore (`apkChunks` + `apkFiles`)
 * and warm server disk cache so users can always download it permanently via /api/apk-stream/:name.
 */
export async function uploadApkToFirestoreChunks(
  apkId: string,
  fileOrBlob: Blob,
  onProgress?: (percent: number, message: string) => void
): Promise<CloudApkUploadResult> {
  if (!apkId || !fileOrBlob || fileOrBlob.size === 0) {
    throw new Error('APK ফাইলটি খালি বা অকার্যকর।');
  }

  if (fileOrBlob.size > MAX_CLOUD_APK_BYTES) {
    throw new Error(
      `APK সাইজ ${(fileOrBlob.size / (1024 * 1024)).toFixed(1)} MB (সর্বোচ্চ সরাসরি আপলোড সীমা 60 MB)। এর চেয়ে বড় APK হলে Google Drive বা GitHub Direct Link নিচে দিন।`
    );
  }

  const totalChunks = Math.ceil(fileOrBlob.size / CHUNK_RAW_BYTES);

  onProgress?.(5, `ক্লাউড সার্ভারে APK পাঠানো হচ্ছে (${totalChunks} খণ্ড)...`);

  let nextChunkIdx = 0;
  let completedChunks = 0;
  const workers = Math.min(6, totalChunks);

  const runApkWorker = async () => {
    while (true) {
      const idx = nextChunkIdx++;
      if (idx >= totalChunks) break;

      const byteStart = idx * CHUNK_RAW_BYTES;
      const byteEnd = Math.min(byteStart + CHUNK_RAW_BYTES, fileOrBlob.size);
      const sliceBuf = await fileOrBlob.slice(byteStart, byteEnd).arrayBuffer();
      const slice = new Uint8Array(sliceBuf);
      const base64Data = uint8ArrayToBase64(slice);
      const chunkDocId = `${apkId}_c_${idx}`;

      await writeFirestoreDocFast(
        'apkChunks',
        chunkDocId,
        {
          apkId: { stringValue: apkId },
          index: { integerValue: String(idx) },
          sizeBytes: { integerValue: String(slice.length) },
          data: { stringValue: base64Data },
        },
        {
          apkId,
          index: idx,
          sizeBytes: slice.length,
          data: base64Data,
        }
      );

      completedChunks++;
      const pct = Math.min(94, Math.round((completedChunks / totalChunks) * 88) + 5);
      onProgress?.(pct, `APK স্থায়ীভাবে সেভ হচ্ছে (${completedChunks}/${totalChunks})...`);
    }
  };

  await Promise.all(Array.from({ length: workers }, () => runApkWorker()));

  const nowMs = Date.now();
  await writeFirestoreDocFast(
    'apkFiles',
    apkId,
    {
      apkId: { stringValue: apkId },
      totalChunks: { integerValue: String(totalChunks) },
      sizeBytes: { integerValue: String(fileOrBlob.size) },
      updatedAt: { integerValue: String(nowMs) },
    },
    {
      apkId,
      totalChunks,
      sizeBytes: fileOrBlob.size,
      updatedAt: nowMs,
    }
  );

  // Warm the local disk stream cache so first user download starts immediately
  if (typeof fetch !== 'undefined') {
    const cacheName = `stream_apk_${apkId}.apk`;
    fetch('/api/upload-raw', {
      method: 'POST',
      headers: {
        'x-filename': cacheName,
        'Content-Type': 'application/vnd.android.package-archive',
      },
      body: fileOrBlob,
    }).catch(() => {});
  }

  onProgress?.(100, 'APK ফাইল স্থায়ীভাবে সংরক্ষিত হয়েছে!');

  return {
    downloadUrl: `/api/apk-stream/${apkId}.apk`,
    totalChunks,
    sizeBytes: fileOrBlob.size,
  };
}
