import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAUpa-fB_19rJikt32YrfLxZD5MUJbEf9o",
  authDomain: "suzika-call-pic.firebaseapp.com",
  projectId: "suzika-call-pic",
  storageBucket: "suzika-call-pic.firebasestorage.app",
  messagingSenderId: "234829978977",
  appId: "1:234829978977:web:e818627a428c5b1b03b920",
  measurementId: "G-PXPLE27797"
};

const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const fbDb = getFirestore(fbApp);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const apkDir = path.join(__dirname, 'public', 'apk');
if (!fs.existsSync(apkDir)) {
  fs.mkdirSync(apkDir, { recursive: true });
}

// Serve uploaded media & APK files publicly over HTTP/HTTPS
const setApkHeaders = (res: express.Response, filePath: string) => {
  if (filePath.toLowerCase().endsWith('.apk')) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="SUZIKA-Call-Pic.apk"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
  }
};

app.use('/uploads', express.static(uploadsDir, { setHeaders: setApkHeaders }));
app.use('/uploads', (_req, res) => {
  res.status(404).send('File not found');
});

app.use('/apk', express.static(apkDir, { setHeaders: setApkHeaders }));
app.use('/apk', (_req, res) => {
  res.status(404).send('APK file not found');
});

// Permanent Cloud Firestore chunked video streaming cache + HTTP Range endpoint
const pendingVideoAssemblies = new Map<string, Promise<string | null>>();

async function resolveOrAssembleCloudVideo(videoId: string, requestedExt = 'mp4'): Promise<string | null> {
  const safeId = path.basename(videoId).replace(/[^a-zA-Z0-9._-]/g, '');
  const cleanExt = requestedExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp4';
  if (!safeId) return null;

  const cachePath = path.join(uploadsDir, `stream_${safeId}.${cleanExt}`);
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    return cachePath;
  }

  if (pendingVideoAssemblies.has(safeId)) {
    return pendingVideoAssemblies.get(safeId)!;
  }

  const assemblyPromise = (async () => {
    try {
      const manifestSnap = await getDoc(doc(fbDb, 'videoFiles', safeId));
      if (!manifestSnap.exists()) return null;

      const manifest = manifestSnap.data() as { totalChunks?: number; ext?: string };
      const totalChunks = Number(manifest.totalChunks) || 0;
      if (totalChunks <= 0) return null;

      const finalExt = (manifest.ext || cleanExt || 'mp4').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp4';
      const targetPath = path.join(uploadsDir, `stream_${safeId}.${finalExt}`);
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
        return targetPath;
      }

      const buffers: Buffer[] = new Array(totalChunks);
      const batchSize = 6;
      for (let start = 0; start < totalChunks; start += batchSize) {
        const indices: number[] = [];
        for (let idx = start; idx < Math.min(start + batchSize, totalChunks); idx++) {
          indices.push(idx);
        }
        const snaps = await Promise.all(
          indices.map((idx) => getDoc(doc(fbDb, 'videoChunks', `${safeId}_c_${idx}`)))
        );
        for (let i = 0; i < snaps.length; i++) {
          const snap = snaps[i];
          if (!snap.exists()) return null;
          const b64 = snap.data()?.data;
          if (typeof b64 !== 'string' || !b64) return null;
          buffers[indices[i]] = Buffer.from(b64, 'base64');
        }
      }

      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(targetPath, Buffer.concat(buffers));
      return targetPath;
    } catch (err) {
      console.warn('Cloud video stream assembly notice:', err);
      return null;
    } finally {
      pendingVideoAssemblies.delete(safeId);
    }
  })();

  pendingVideoAssemblies.set(safeId, assemblyPromise);
  return assemblyPromise;
}

app.get('/api/video-stream/:name', async (req, res) => {
  try {
    const safeName = path.basename(req.params.name || '');
    const dotIdx = safeName.lastIndexOf('.');
    const videoId = dotIdx > 0 ? safeName.slice(0, dotIdx) : safeName;
    const ext = dotIdx > 0 ? safeName.slice(dotIdx + 1) : 'mp4';

    const filePath = await resolveOrAssembleCloudVideo(videoId, ext);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('Video stream not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const fileExt = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.m4v': 'video/mp4',
      '.ogg': 'video/ogg',
    };
    res.setHeader('Content-Type', mimeMap[fileExt] || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=604800');

    const rangeHeader = req.headers?.range;
    if (rangeHeader && typeof rangeHeader === 'string' && fileSize > 0) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (!isNaN(start) && start < fileSize) {
        const safeEnd = Math.min(isNaN(end) ? fileSize - 1 : end, fileSize - 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${fileSize}`);
        res.setHeader('Content-Length', safeEnd - start + 1);
        fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
        return;
      }
    }

    res.status(200);
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Video stream failed');
  }
});

// Permanent Cloud Firestore chunked APK download cache + HTTP Range endpoint
const pendingApkAssemblies = new Map<string, Promise<string | null>>();

async function resolveOrAssembleCloudApk(apkId: string): Promise<string | null> {
  const safeId = path.basename(apkId).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeId) return null;

  const cachePath = path.join(uploadsDir, `stream_apk_${safeId}.apk`);
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    return cachePath;
  }

  if (pendingApkAssemblies.has(safeId)) {
    return pendingApkAssemblies.get(safeId)!;
  }

  const assemblyPromise = (async () => {
    try {
      const manifestSnap = await getDoc(doc(fbDb, 'apkFiles', safeId));
      if (!manifestSnap.exists()) return null;

      const totalChunks = Number(manifestSnap.data()?.totalChunks) || 0;
      if (totalChunks <= 0) return null;

      if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
        return cachePath;
      }

      const buffers: Buffer[] = new Array(totalChunks);
      const batchSize = 6;
      for (let start = 0; start < totalChunks; start += batchSize) {
        const indices: number[] = [];
        for (let idx = start; idx < Math.min(start + batchSize, totalChunks); idx++) {
          indices.push(idx);
        }
        const snaps = await Promise.all(
          indices.map((idx) => getDoc(doc(fbDb, 'apkChunks', `${safeId}_c_${idx}`)))
        );
        for (let i = 0; i < snaps.length; i++) {
          const snap = snaps[i];
          if (!snap.exists()) return null;
          const b64 = snap.data()?.data;
          if (typeof b64 !== 'string' || !b64) return null;
          buffers[indices[i]] = Buffer.from(b64, 'base64');
        }
      }

      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(cachePath, Buffer.concat(buffers));
      return cachePath;
    } catch (err) {
      console.warn('Cloud APK stream assembly notice:', err);
      return null;
    } finally {
      pendingApkAssemblies.delete(safeId);
    }
  })();

  pendingApkAssemblies.set(safeId, assemblyPromise);
  return assemblyPromise;
}

app.get('/api/apk-stream/:name', async (req, res) => {
  try {
    const safeName = path.basename(req.params.name || '');
    const apkId = safeName.replace(/\.apk$/i, '');
    const filePath = await resolveOrAssembleCloudApk(apkId);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('APK file not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="SUZIKA-Call-Pic.apk"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    const rangeHeader = req.headers?.range;
    if (rangeHeader && typeof rangeHeader === 'string' && fileSize > 0) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (!isNaN(start) && start < fileSize) {
        const safeEnd = Math.min(isNaN(end) ? fileSize - 1 : end, fileSize - 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${fileSize}`);
        res.setHeader('Content-Length', safeEnd - start + 1);
        fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
        return;
      }
    }

    res.status(200);
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  } catch (err: any) {
    return res.status(500).send(err?.message || 'APK download failed');
  }
});

// Verify local or Cloud-stored APK presence and file size before users attempt download
app.get('/api/apk-status', async (req, res) => {
  try {
    const target = String(req.query.url || '').trim();
    const cleanTarget = target.split('?')[0];

    if (cleanTarget.startsWith('/api/apk-stream/')) {
      const safeName = path.basename(cleanTarget);
      const apkId = safeName.replace(/\.apk$/i, '').replace(/[^a-zA-Z0-9._-]/g, '');
      const cachePath = path.join(uploadsDir, `stream_apk_${apkId}.apk`);
      if (fs.existsSync(cachePath) && fs.statSync(cachePath).isFile()) {
        return res.json({ exists: true, sizeBytes: fs.statSync(cachePath).size, url: target });
      }
      const manifestSnap = await getDoc(doc(fbDb, 'apkFiles', apkId));
      if (manifestSnap.exists()) {
        const sizeBytes = Number(manifestSnap.data()?.sizeBytes) || 0;
        return res.json({ exists: true, sizeBytes, url: target });
      }
      return res.json({ exists: false, sizeBytes: 0, url: target });
    }

    let resolvedPath = '';
    if (cleanTarget.startsWith('/uploads/')) {
      resolvedPath = path.resolve(uploadsDir, path.basename(cleanTarget));
    } else if (cleanTarget.startsWith('/apk/')) {
      resolvedPath = path.resolve(apkDir, path.basename(cleanTarget));
    }
    const exists =
      Boolean(resolvedPath) &&
      (resolvedPath.startsWith(uploadsDir) || resolvedPath.startsWith(apkDir)) &&
      fs.existsSync(resolvedPath) &&
      fs.statSync(resolvedPath).isFile();
    const sizeBytes = exists ? fs.statSync(resolvedPath).size : 0;
    res.json({ exists, sizeBytes, url: target });
  } catch {
    res.json({ exists: false, sizeBytes: 0, url: '' });
  }
});

// Cloud Run health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'SUZIKA Call Pic',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Persistent server-side JSON storage for uploaded media & live banner/APK settings
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const mediaDbPath = path.join(dataDir, 'media_db.json');

interface LocalMediaDb {
  photos: any[];
  videos: any[];
  bannerConfig?: any;
  deletedPhotoIds?: string[];
  deletedVideoIds?: string[];
}

function readLocalMediaDb(): LocalMediaDb {
  try {
    if (fs.existsSync(mediaDbPath)) {
      const parsed = JSON.parse(fs.readFileSync(mediaDbPath, 'utf-8'));
      return {
        photos: Array.isArray(parsed.photos) ? parsed.photos : [],
        videos: Array.isArray(parsed.videos) ? parsed.videos : [],
        bannerConfig: parsed.bannerConfig || null,
        deletedPhotoIds: Array.isArray(parsed.deletedPhotoIds) ? parsed.deletedPhotoIds : [],
        deletedVideoIds: Array.isArray(parsed.deletedVideoIds) ? parsed.deletedVideoIds : [],
      };
    }
  } catch (e) {
    console.warn('Error reading media_db.json:', e);
  }
  return { photos: [], videos: [], bannerConfig: null, deletedPhotoIds: [], deletedVideoIds: [] };
}

function writeLocalMediaDb(dbData: LocalMediaDb) {
  try {
    fs.writeFileSync(mediaDbPath, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing media_db.json:', e);
  }
}

// SSE live sync clients for instant Admin-to-Users updates
const sseClients = new Set<express.Response>();
function broadcastSyncEvent(eventType: string, payload: Record<string, any> = {}) {
  const msg = `event: sync\ndata: ${JSON.stringify({ type: eventType, ts: Date.now(), ...payload })}\n\n`;
  sseClients.forEach((clientRes) => {
    try {
      clientRes.write(msg);
    } catch {
      sseClients.delete(clientRes);
    }
  });
}

let firestoreServerWatcherStarted = false;
function ensureServerFirestoreWatcher() {
  if (firestoreServerWatcherStarted) return;
  firestoreServerWatcherStarted = true;
  import('firebase/firestore')
    .then(({ onSnapshot: fsOnSnapshot }) => {
      let photosReady = false;
      let videosReady = false;
      let privateReady = false;
      let bannerReady = false;
      let syncMetaReady = false;

      fsOnSnapshot(collection(fbDb, 'photos'), (snap) => {
        if (!photosReady) {
          photosReady = true;
          return;
        }
        feedCache = null;
        const changes = snap.docChanges();
        if (changes.length === 0) return;
        const removed = changes.filter((c) => c.type === 'removed');
        if (removed.length > 0 && removed.length === changes.length) {
          removed.forEach((c) => broadcastSyncEvent('photo_deleted', { id: c.doc.id, source: 'firestore' }));
        } else {
          broadcastSyncEvent('photo_saved', { source: 'firestore' });
        }
      }, () => {});

      fsOnSnapshot(collection(fbDb, 'videos'), (snap) => {
        if (!videosReady) {
          videosReady = true;
          return;
        }
        feedCache = null;
        const changes = snap.docChanges();
        if (changes.length === 0) return;
        const removed = changes.filter((c) => c.type === 'removed');
        if (removed.length > 0 && removed.length === changes.length) {
          removed.forEach((c) => broadcastSyncEvent('video_deleted', { id: c.doc.id, source: 'firestore' }));
        } else {
          broadcastSyncEvent('video_saved', { source: 'firestore' });
        }
      }, () => {});

      fsOnSnapshot(collection(fbDb, 'privateVideos'), (snap) => {
        if (!privateReady) {
          privateReady = true;
          return;
        }
        feedCache = null;
        const changes = snap.docChanges();
        if (changes.length === 0) return;
        const removed = changes.filter((c) => c.type === 'removed');
        if (removed.length > 0 && removed.length === changes.length) {
          removed.forEach((c) => broadcastSyncEvent('private_video_deleted', { id: c.doc.id, source: 'firestore' }));
        } else {
          broadcastSyncEvent('private_video_saved', { source: 'firestore' });
        }
      }, () => {});

      fsOnSnapshot(doc(fbDb, 'settings', 'bannerConfig'), (docSnap) => {
        if (!bannerReady) {
          bannerReady = true;
          return;
        }
        feedCache = null;
        if (docSnap.exists()) {
          broadcastSyncEvent('banner_updated', { bannerConfig: docSnap.data(), source: 'firestore' });
        }
      }, () => {});

      fsOnSnapshot(doc(fbDb, 'settings', 'syncMeta'), (docSnap) => {
        if (!syncMetaReady) {
          syncMetaReady = true;
          return;
        }
        feedCache = null;
        if (docSnap.exists()) {
          const sData = docSnap.data();
          broadcastSyncEvent('sync_meta_updated', {
            deletedPhotoIds: Array.isArray(sData?.deletedPhotoIds) ? sData.deletedPhotoIds : [],
            deletedVideoIds: Array.isArray(sData?.deletedVideoIds) ? sData.deletedVideoIds : [],
            source: 'firestore',
          });
        }
      }, () => {});
    })
    .catch(() => {
      firestoreServerWatcherStarted = false;
    });
}

app.get('/api/events', (req, res) => {
  ensureServerFirestoreWatcher();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`: connected\n\n`);
  sseClients.add(res);
  const keepAlive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Fast in-memory feed cache (invalidated immediately on local or Firestore changes)
let feedCache: { timestamp: number; data: any } | null = null;

// Public feed endpoint returning all synced photos, videos, privateVideos, and banner/APK config
app.get('/api/feed', async (_req, res) => {
  ensureServerFirestoreWatcher();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const now = Date.now();
    if (feedCache && now - feedCache.timestamp < 5000) {
      return res.json(feedCache.data);
    }

    const localDb = readLocalMediaDb();

    let cloudPhotos: any[] = [];
    let cloudVideos: any[] = [];
    let cloudPrivateVideos: any[] = [];
    let cloudBannerConfig: any = null;
    let cloudDeletedPhotos: string[] = [];
    let cloudDeletedVideos: string[] = [];
    try {
      const [pSnap, vSnap, pvSnap, bSnap, syncSnap] = await Promise.all([
        getDocs(collection(fbDb, 'photos')),
        getDocs(collection(fbDb, 'videos')),
        getDocs(collection(fbDb, 'privateVideos')),
        getDoc(doc(fbDb, 'settings', 'bannerConfig')),
        getDoc(doc(fbDb, 'settings', 'syncMeta')),
      ]);
      cloudPhotos = pSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
      cloudVideos = vSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
      cloudPrivateVideos = pvSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
      if (bSnap.exists()) cloudBannerConfig = bSnap.data();
      if (syncSnap.exists()) {
        const sData = syncSnap.data();
        if (Array.isArray(sData.deletedPhotoIds)) cloudDeletedPhotos = sData.deletedPhotoIds;
        if (Array.isArray(sData.deletedVideoIds)) cloudDeletedVideos = sData.deletedVideoIds;
      }
    } catch (fsErr) {
      console.warn('Firestore feed read notice (using local db):', fsErr);
    }

    const deletedPhotoIds = Array.from(new Set([...(localDb.deletedPhotoIds || []), ...cloudDeletedPhotos]));
    const deletedVideoIds = Array.from(new Set([...(localDb.deletedVideoIds || []), ...cloudDeletedVideos]));
    const deletedPhotoSet = new Set(deletedPhotoIds);
    const deletedVideoSet = new Set(deletedVideoIds);

    const photoMap = new Map<string, any>();
    localDb.photos.forEach((p) => {
      if (!deletedPhotoSet.has(p.id)) photoMap.set(p.id, p);
    });
    cloudPhotos.forEach((p) => {
      if (!deletedPhotoSet.has(p.id)) photoMap.set(p.id, p);
    });

    const videoMap = new Map<string, any>();
    localDb.videos.forEach((v) => {
      if (!deletedVideoSet.has(v.id)) videoMap.set(v.id, v);
    });
    cloudVideos.forEach((v) => {
      if (!deletedVideoSet.has(v.id)) videoMap.set(v.id, v);
    });

    const photos = Array.from(photoMap.values()).filter((p: any) => {
      if (!p || !p.id) return false;
      if (p.imageUrl && p.imageUrl.startsWith('/uploads/')) {
        return fs.existsSync(path.join(uploadsDir, path.basename(p.imageUrl.split('?')[0])));
      }
      return Boolean(p.imageUrl && !String(p.imageUrl).startsWith('blob:'));
    });
    photos.sort((a, b) => ((b.slotNumber || 0) - (a.slotNumber || 0)) || ((b.createdAtMs || 0) - (a.createdAtMs || 0)));

    const videos = Array.from(videoMap.values())
      .filter((v: any) => {
        if (!v || !v.id || v.isPrivatePhoneVideo || String(v.id).startsWith('private-local-')) return false;
        const url = String(v.videoUrl || '').trim();
        if (!url || url.startsWith('blob:')) return false;
        if (url.startsWith('/uploads/')) {
          return fs.existsSync(path.join(uploadsDir, path.basename(url.split('?')[0])));
        }
        if (url === 'local-blob' || url === 'local-indexeddb' || url.startsWith('indexeddb:')) {
          return false;
        }
        return true;
      })
      .map((v: any) => {
        const url = String(v.videoUrl || '').trim();
        const hasPublicUrl = Boolean(
          url &&
          (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))
        );
        return hasPublicUrl ? { ...v, isLocalIndexedDB: false } : v;
      });
    videos.sort((a, b) => ((b.slotNumber || 0) - (a.slotNumber || 0)) || ((b.createdAtMs || 0) - (a.createdAtMs || 0)));

    const privateVideos = cloudPrivateVideos
      .filter((pv: any) => pv && pv.id && !deletedVideoSet.has(pv.id))
      .map((pv: any) => ({
        ...pv,
        gallery: pv.gallery || 'Global Adult',
        galleries: Array.isArray(pv.galleries) ? pv.galleries : undefined,
        coinPrice: typeof pv.coinPrice === 'number' ? pv.coinPrice : 50,
        slotNumber: typeof pv.slotNumber === 'number' ? pv.slotNumber : 1,
      }));
    privateVideos.sort((a, b) => ((b.slotNumber || 0) - (a.slotNumber || 0)) || ((b.createdAtMs || 0) - (a.createdAtMs || 0)));

    const mergedBannerConfig = localDb.bannerConfig || cloudBannerConfig
      ? { ...(localDb.bannerConfig || {}), ...(cloudBannerConfig || {}) }
      : null;

    const payload = {
      photos,
      videos,
      privateVideos,
      bannerConfig: mergedBannerConfig,
      deletedPhotoIds,
      deletedVideoIds,
      ts: now,
    };
    feedCache = { timestamp: now, data: payload };
    return res.json(payload);
  } catch (err: any) {
    console.error('Error in /api/feed:', err);
    const localDb = readLocalMediaDb();
    return res.json({ ...localDb, privateVideos: [] });
  }
});

// Save live Admin banner / ad / APK popup settings & broadcast instantly
app.post('/api/save-banner', async (req, res) => {
  try {
    const bannerConfig = req.body;
    const localDb = readLocalMediaDb();
    localDb.bannerConfig = bannerConfig;
    writeLocalMediaDb(localDb);
    try {
      await setDoc(doc(fbDb, 'settings', 'bannerConfig'), bannerConfig);
    } catch {}
    feedCache = null;
    broadcastSyncEvent('banner_updated', { bannerConfig });
    return res.json({ success: true, bannerConfig });
  } catch (err: any) {
    console.error('Error saving banner on server:', err);
    return res.status(500).json({ error: err.message || 'Save banner failed' });
  }
});

// Endpoint to permanently save photo metadata on server
app.post('/api/save-photo', async (req, res) => {
  try {
    const photo = req.body;
    if (!photo || !photo.id) {
      return res.status(400).json({ error: 'Missing photo item' });
    }

    const localDb = readLocalMediaDb();
    const existingIndex = localDb.photos.findIndex((p) => p.id === photo.id);
    if (existingIndex >= 0) {
      localDb.photos[existingIndex] = photo;
    } else {
      localDb.photos.unshift(photo);
    }
    localDb.deletedPhotoIds = (localDb.deletedPhotoIds || []).filter((id) => id !== photo.id);
    writeLocalMediaDb(localDb);

    try {
      await setDoc(doc(fbDb, 'photos', photo.id), photo);
    } catch (fsErr) {
      console.warn('Firestore save-photo notice:', fsErr);
    }

    feedCache = null;
    broadcastSyncEvent('photo_saved', { id: photo.id });
    return res.json({ success: true, photo });
  } catch (err: any) {
    console.error('Error saving photo on server:', err);
    return res.status(500).json({ error: err.message || 'Failed to save photo' });
  }
});

// Endpoint to permanently save video metadata on server
app.post('/api/save-video', async (req, res) => {
  try {
    const video = req.body;
    if (!video || !video.id) {
      return res.status(400).json({ error: 'Missing video item' });
    }

    const localDb = readLocalMediaDb();
    const existingIndex = localDb.videos.findIndex((v) => v.id === video.id);
    if (existingIndex >= 0) {
      localDb.videos[existingIndex] = video;
    } else {
      localDb.videos.unshift(video);
    }
    localDb.deletedVideoIds = (localDb.deletedVideoIds || []).filter((id) => id !== video.id);
    writeLocalMediaDb(localDb);

    try {
      await setDoc(doc(fbDb, 'videos', video.id), video);
    } catch (fsErr) {
      console.warn('Firestore save-video notice:', fsErr);
    }

    feedCache = null;
    broadcastSyncEvent('video_saved', { id: video.id });
    return res.json({ success: true, video });
  } catch (err: any) {
    console.error('Error saving video on server:', err);
    return res.status(500).json({ error: err.message || 'Failed to save video' });
  }
});

// Upload media endpoint for persistent public video, photo, and APK hosting
app.post('/api/upload-media', (req, res) => {
  try {
    const { filename, dataUrl } = req.body;
    if (!filename || !dataUrl) {
      return res.status(400).json({ error: 'Missing filename or dataUrl' });
    }
    const safeName = path.basename(filename);
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(dataUrl, 'base64');

    fs.writeFileSync(path.join(uploadsDir, safeName), buffer);

    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      const distUploads = path.join(distPath, 'uploads');
      if (!fs.existsSync(distUploads)) fs.mkdirSync(distUploads, { recursive: true });
      fs.writeFileSync(path.join(distUploads, safeName), buffer);
    }

    feedCache = null;
    return res.json({ success: true, url: `/uploads/${safeName}` });
  } catch (err: any) {
    console.error('Server upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Fast raw binary streaming upload endpoint (ideal for large MP4/WebM videos and .apk files)
app.post('/api/upload-raw', express.raw({ type: '*/*', limit: '250mb' }), (req, res) => {
  try {
    const rawFilename = (req.headers['x-filename'] as string) || `media_${Date.now()}.mp4`;
    const safeName = path.basename(rawFilename);
    const buffer = req.body;

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Empty file payload' });
    }

    fs.writeFileSync(path.join(uploadsDir, safeName), buffer);

    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      const distUploads = path.join(distPath, 'uploads');
      if (!fs.existsSync(distUploads)) fs.mkdirSync(distUploads, { recursive: true });
      fs.writeFileSync(path.join(distUploads, safeName), buffer);
    }

    feedCache = null;
    return res.json({ success: true, url: `/uploads/${safeName}` });
  } catch (err: any) {
    console.error('Server raw upload error:', err);
    return res.status(500).json({ error: err.message || 'Raw upload failed' });
  }
});

// Delete photo endpoint with local DB and Firestore sync
app.delete('/api/photo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const localDb = readLocalMediaDb();
    localDb.photos = localDb.photos.filter((p) => p.id !== id);
    localDb.deletedPhotoIds = Array.from(new Set([...(localDb.deletedPhotoIds || []), id])).slice(-500);
    writeLocalMediaDb(localDb);

    try {
      await deleteDoc(doc(fbDb, 'photos', id));
    } catch {}

    feedCache = null;
    broadcastSyncEvent('photo_deleted', { id });
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('Server photo delete error:', err);
    return res.status(500).json({ error: err.message || 'Delete failed' });
  }
});

// Delete video endpoint with local DB and Firestore sync
app.delete('/api/video/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const localDb = readLocalMediaDb();
    localDb.videos = localDb.videos.filter((v) => v.id !== id);
    localDb.deletedVideoIds = Array.from(new Set([...(localDb.deletedVideoIds || []), id])).slice(-500);
    writeLocalMediaDb(localDb);

    try {
      const safeId = path.basename(id).replace(/[^a-zA-Z0-9._-]/g, '');
      ['mp4', 'webm', 'mov', 'm4v', 'ogg'].forEach((ext) => {
        const cachedFile = path.join(uploadsDir, `stream_${safeId}.${ext}`);
        if (fs.existsSync(cachedFile)) fs.unlinkSync(cachedFile);
      });
    } catch {}

    try {
      await deleteDoc(doc(fbDb, 'videos', id));
      const mSnap = await getDoc(doc(fbDb, 'videoFiles', id));
      if (mSnap.exists()) {
        const total = Number(mSnap.data()?.totalChunks) || 0;
        for (let idx = 0; idx < total; idx++) {
          await deleteDoc(doc(fbDb, 'videoChunks', `${id}_c_${idx}`)).catch(() => {});
        }
        await deleteDoc(doc(fbDb, 'videoFiles', id)).catch(() => {});
      }
    } catch {}

    feedCache = null;
    broadcastSyncEvent('video_deleted', { id });
    return res.json({ success: true, id });
  } catch (err: any) {
    console.error('Server video delete error:', err);
    return res.status(500).json({ error: err.message || 'Delete failed' });
  }
});

// Production static assets serving
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  // Serve static files from dist with proper MIME types for manifest, icons & SW
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('manifest.webmanifest') || filePath.endsWith('manifest.json')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('sw.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Service-Worker-Allowed', '/');
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('og-image.png')) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    })
  );

  const distIndexPath = path.join(distPath, 'index.html');
  const sendBrandedHtml = (req: express.Request, res: express.Response) => {
    try {
      let html = fs.readFileSync(distIndexPath, 'utf-8');
      const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
      const rawHost = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
      const envOrigin = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
      const origin = envOrigin || (rawHost ? `${rawProto}://${rawHost}` : '');
      if (origin) {
        const pageUrl = `${origin}${req.originalUrl || '/'}`;
        const ogImageAbs = `${origin}/og-image.png?v=5`;
        html = html
          .replace('<!-- CANONICAL_TAG -->', `<link rel="canonical" href="${origin}/" />`)
          .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${pageUrl}" />`)
          .replace(/<link rel="image_src" href="[^"]*" \/>/, `<link rel="image_src" href="${ogImageAbs}" />`)
          .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImageAbs}" />`)
          .replace(/<meta property="og:image:secure_url" content="[^"]*" \/>/, `<meta property="og:image:secure_url" content="${ogImageAbs}" />`)
          .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImageAbs}" />`)
          .replace(/"image":\s*"[^"]*"/, `"image": "${ogImageAbs}"`);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch {
      res.sendFile(distIndexPath);
    }
  };

  // Explicit root route "/" and SPA fallback serve SUZIKA Call Pic with full absolute OG tags
  app.get('/', sendBrandedHtml);
  app.get('*', sendBrandedHtml);
} else {
  // Graceful fallback if dist is building
  app.get('*', (_req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>SUZIKA Call Pic</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="icon" href="/favicon.ico?v=4" sizes="any">
        </head>
        <body style="background:#080a12;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;">
            <img src="/pwa-192x192.png?v=4" alt="SUZIKA Call Pic" style="width:76px;height:76px;border-radius:18px;margin:0 auto 14px;display:block;" />
            <h1 style="color:#ff35bb;margin:0 0 8px;">SUZIKA Call Pic</h1>
            <p style="color:#9da4b8;font-size:14px;">Ready to deploy. Run <code>npm run build</code> to generate production bundle.</p>
          </div>
        </body>
      </html>
    `);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SUZIKA Call Pic server running at http://0.0.0.0:${PORT}`);
});
