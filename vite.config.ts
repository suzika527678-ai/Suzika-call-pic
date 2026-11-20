import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import fs from 'fs';
import {fileURLToPath} from 'url';

const rootDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'upload-api-dev-middleware',
        configureServer(server) {
          const uploadsDir = path.resolve(rootDir, 'public/uploads');
          const dataDir = path.resolve(rootDir, 'data');
          const mediaDbPath = path.join(dataDir, 'media_db.json');

          const readLocalDb = () => {
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
            } catch {}
            return { photos: [], videos: [], bannerConfig: null, deletedPhotoIds: [], deletedVideoIds: [] };
          };

          const writeLocalDb = (dbData: {
            photos: any[];
            videos: any[];
            bannerConfig?: any;
            deletedPhotoIds?: string[];
            deletedVideoIds?: string[];
          }) => {
            try {
              if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
              fs.writeFileSync(mediaDbPath, JSON.stringify(dbData, null, 2), 'utf-8');
            } catch {}
          };

          const sseClients = new Set<any>();
          const broadcastSyncEvent = (eventType: string, payload: Record<string, any> = {}) => {
            const msg = `event: sync\ndata: ${JSON.stringify({ type: eventType, ts: Date.now(), ...payload })}\n\n`;
            sseClients.forEach((clientRes) => {
              try {
                clientRes.write(msg);
              } catch {
                sseClients.delete(clientRes);
              }
            });
          };

          let firestoreWatcherStarted = false;
          const ensureFirestoreBroadcastWatcher = () => {
            if (firestoreWatcherStarted) return;
            firestoreWatcherStarted = true;

            Promise.all([import('firebase/firestore'), import('./src/firebase.ts')])
              .then(([{ collection, doc, onSnapshot }, { db }]) => {
                let photosReady = false;
                let videosReady = false;
                let privateReady = false;
                let bannerReady = false;
                let syncMetaReady = false;

                onSnapshot(collection(db, 'photos'), (snap) => {
                  if (!photosReady) {
                    photosReady = true;
                    return;
                  }
                  const changes = snap.docChanges();
                  if (changes.length === 0) return;
                  const removed = changes.filter((c) => c.type === 'removed');
                  if (removed.length > 0 && removed.length === changes.length) {
                    removed.forEach((c) => broadcastSyncEvent('photo_deleted', { id: c.doc.id, source: 'firestore' }));
                  } else {
                    broadcastSyncEvent('photo_saved', { source: 'firestore' });
                  }
                }, () => {});

                onSnapshot(collection(db, 'videos'), (snap) => {
                  if (!videosReady) {
                    videosReady = true;
                    return;
                  }
                  const changes = snap.docChanges();
                  if (changes.length === 0) return;
                  const removed = changes.filter((c) => c.type === 'removed');
                  if (removed.length > 0 && removed.length === changes.length) {
                    removed.forEach((c) => broadcastSyncEvent('video_deleted', { id: c.doc.id, source: 'firestore' }));
                  } else {
                    broadcastSyncEvent('video_saved', { source: 'firestore' });
                  }
                }, () => {});

                onSnapshot(collection(db, 'privateVideos'), (snap) => {
                  if (!privateReady) {
                    privateReady = true;
                    return;
                  }
                  const changes = snap.docChanges();
                  if (changes.length === 0) return;
                  const removed = changes.filter((c) => c.type === 'removed');
                  if (removed.length > 0 && removed.length === changes.length) {
                    removed.forEach((c) => broadcastSyncEvent('private_video_deleted', { id: c.doc.id, source: 'firestore' }));
                  } else {
                    broadcastSyncEvent('private_video_saved', { source: 'firestore' });
                  }
                }, () => {});

                onSnapshot(doc(db, 'settings', 'bannerConfig'), (docSnap) => {
                  if (!bannerReady) {
                    bannerReady = true;
                    return;
                  }
                  if (docSnap.exists()) {
                    broadcastSyncEvent('banner_updated', { bannerConfig: docSnap.data(), source: 'firestore' });
                  }
                }, () => {});

                onSnapshot(doc(db, 'settings', 'syncMeta'), (docSnap) => {
                  if (!syncMetaReady) {
                    syncMetaReady = true;
                    return;
                  }
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
                firestoreWatcherStarted = false;
              });
          };

          server.middlewares.use('/api/events', (req, res) => {
            ensureFirestoreBroadcastWatcher();
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

          // Serve static uploaded files (/uploads/*) with HTTP Range streaming & correct MIME types
          const serveStaticMedia = (baseDir: string, defaultApkName: string) => (req: any, res: any) => {
            const cleanUrl = decodeURIComponent((req.url || '').split('?')[0]);
            const filePath = path.resolve(baseDir, cleanUrl.replace(/^\/+/, ''));
            if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'text/plain');
              res.end('File not found');
              return;
            }

            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp',
              '.gif': 'image/gif',
              '.mp4': 'video/mp4',
              '.webm': 'video/webm',
              '.mov': 'video/quicktime',
              '.m4v': 'video/mp4',
              '.apk': 'application/vnd.android.package-archive',
            };
            const contentType = mimeMap[ext] || 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Accept-Ranges', 'bytes');
            if (ext === '.apk') {
              res.setHeader('Content-Disposition', `attachment; filename="${defaultApkName}"`);
              res.setHeader('X-Content-Type-Options', 'nosniff');
              res.setHeader('Cache-Control', 'no-cache');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=86400');
            }

            if (req.method === 'HEAD') {
              res.statusCode = 200;
              res.setHeader('Content-Length', fileSize);
              res.end();
              return;
            }

            const rangeHeader = req.headers?.range;
            if (rangeHeader && typeof rangeHeader === 'string' && fileSize > 0) {
              const parts = rangeHeader.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
              if (!isNaN(start) && start < fileSize) {
                const safeEnd = Math.min(isNaN(end) ? fileSize - 1 : end, fileSize - 1);
                const chunkSize = safeEnd - start + 1;
                res.statusCode = 206;
                res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${fileSize}`);
                res.setHeader('Content-Length', chunkSize);
                fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
                return;
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Length', fileSize);
            fs.createReadStream(filePath).pipe(res);
          };

          const apkDir = path.resolve(rootDir, 'public/apk');
          server.middlewares.use('/uploads', serveStaticMedia(uploadsDir, 'SUZIKA-Call-Pic.apk'));
          server.middlewares.use('/apk', serveStaticMedia(apkDir, 'SUZIKA-Call-Pic.apk'));

          // Ensure PWA manifests and service worker serve with proper MIME & scope headers in dev
          server.middlewares.use((req, res, next) => {
            const pathname = (req.url || '').split('?')[0];
            if (pathname === '/manifest.webmanifest' || pathname === '/manifest.json') {
              const manifestFile = path.resolve(rootDir, 'public', pathname.replace(/^\//, ''));
              if (fs.existsSync(manifestFile)) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(fs.readFileSync(manifestFile, 'utf-8'));
                return;
              }
            } else if (pathname === '/sw.js') {
              const swFile = path.resolve(rootDir, 'public', 'sw.js');
              if (fs.existsSync(swFile)) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                res.setHeader('Service-Worker-Allowed', '/');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(fs.readFileSync(swFile, 'utf-8'));
                return;
              }
            }
            next();
          });

          // Permanent Cloud Firestore chunked video streaming cache + HTTP Range endpoint
          const pendingVideoAssemblies = new Map<string, Promise<string | null>>();

          const resolveOrAssembleCloudVideo = async (videoId: string, requestedExt = 'mp4'): Promise<string | null> => {
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
                const { getDoc, doc } = await import('firebase/firestore');
                const { db } = await import('./src/firebase.ts');
                const manifestSnap = await getDoc(doc(db, 'videoFiles', safeId));
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
                    indices.map((idx) => getDoc(doc(db, 'videoChunks', `${safeId}_c_${idx}`)))
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
          };

          server.middlewares.use('/api/video-stream/', async (req, res) => {
            try {
              const rawName = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
              const safeName = path.basename(rawName);
              const dotIdx = safeName.lastIndexOf('.');
              const videoId = dotIdx > 0 ? safeName.slice(0, dotIdx) : safeName;
              const ext = dotIdx > 0 ? safeName.slice(dotIdx + 1) : 'mp4';

              const filePath = await resolveOrAssembleCloudVideo(videoId, ext);
              if (!filePath || !fs.existsSync(filePath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Video stream not found');
                return;
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

              if (req.method === 'HEAD') {
                res.statusCode = 200;
                res.setHeader('Content-Length', fileSize);
                res.end();
                return;
              }

              const rangeHeader = req.headers?.range;
              if (rangeHeader && typeof rangeHeader === 'string' && fileSize > 0) {
                const parts = rangeHeader.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                if (!isNaN(start) && start < fileSize) {
                  const safeEnd = Math.min(isNaN(end) ? fileSize - 1 : end, fileSize - 1);
                  res.statusCode = 206;
                  res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${fileSize}`);
                  res.setHeader('Content-Length', safeEnd - start + 1);
                  fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
                  return;
                }
              }

              res.statusCode = 200;
              res.setHeader('Content-Length', fileSize);
              fs.createReadStream(filePath).pipe(res);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(err?.message || 'Video stream failed');
            }
          });

          // Permanent Cloud Firestore chunked APK download cache + HTTP Range endpoint
          const pendingApkAssemblies = new Map<string, Promise<string | null>>();

          const resolveOrAssembleCloudApk = async (apkId: string): Promise<string | null> => {
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
                const { getDoc, doc } = await import('firebase/firestore');
                const { db } = await import('./src/firebase.ts');
                const manifestSnap = await getDoc(doc(db, 'apkFiles', safeId));
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
                    indices.map((idx) => getDoc(doc(db, 'apkChunks', `${safeId}_c_${idx}`)))
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
          };

          server.middlewares.use('/api/apk-stream/', async (req, res) => {
            try {
              const rawName = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
              const safeName = path.basename(rawName);
              const apkId = safeName.replace(/\.apk$/i, '');

              const filePath = await resolveOrAssembleCloudApk(apkId);
              if (!filePath || !fs.existsSync(filePath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain');
                res.end('APK file not found');
                return;
              }

              const stat = fs.statSync(filePath);
              const fileSize = stat.size;
              res.setHeader('Content-Type', 'application/vnd.android.package-archive');
              res.setHeader('Content-Disposition', 'attachment; filename="SUZIKA-Call-Pic.apk"');
              res.setHeader('X-Content-Type-Options', 'nosniff');
              res.setHeader('Accept-Ranges', 'bytes');
              res.setHeader('Cache-Control', 'no-cache');

              if (req.method === 'HEAD') {
                res.statusCode = 200;
                res.setHeader('Content-Length', fileSize);
                res.end();
                return;
              }

              const rangeHeader = req.headers?.range;
              if (rangeHeader && typeof rangeHeader === 'string' && fileSize > 0) {
                const parts = rangeHeader.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                if (!isNaN(start) && start < fileSize) {
                  const safeEnd = Math.min(isNaN(end) ? fileSize - 1 : end, fileSize - 1);
                  res.statusCode = 206;
                  res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${fileSize}`);
                  res.setHeader('Content-Length', safeEnd - start + 1);
                  fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
                  return;
                }
              }

              res.statusCode = 200;
              res.setHeader('Content-Length', fileSize);
              fs.createReadStream(filePath).pipe(res);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(err?.message || 'APK download failed');
            }
          });

          server.middlewares.use('/api/apk-status', async (req, res) => {
            try {
              const reqUrl = new URL(req.url || '', 'http://localhost');
              const target = decodeURIComponent(reqUrl.searchParams.get('url') || '').trim();
              const cleanTarget = target.split('?')[0];

              if (cleanTarget.startsWith('/api/apk-stream/')) {
                const safeName = path.basename(cleanTarget);
                const apkId = safeName.replace(/\.apk$/i, '').replace(/[^a-zA-Z0-9._-]/g, '');
                const cachePath = path.join(uploadsDir, `stream_apk_${apkId}.apk`);
                if (fs.existsSync(cachePath) && fs.statSync(cachePath).isFile()) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ exists: true, sizeBytes: fs.statSync(cachePath).size, url: target }));
                  return;
                }
                const { getDoc, doc } = await import('firebase/firestore');
                const { db } = await import('./src/firebase.ts');
                const manifestSnap = await getDoc(doc(db, 'apkFiles', apkId));
                if (manifestSnap.exists()) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ exists: true, sizeBytes: Number(manifestSnap.data()?.sizeBytes) || 0, url: target }));
                  return;
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ exists: false, sizeBytes: 0, url: target }));
                return;
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
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ exists, sizeBytes, url: target }));
            } catch {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ exists: false, sizeBytes: 0, url: '' }));
            }
          });

          const mirrorToDistIfPresent = (safeName: string, buffer: Buffer) => {
            const distPath = path.resolve(rootDir, 'dist');
            if (fs.existsSync(distPath)) {
              const distUploads = path.join(distPath, 'uploads');
              if (!fs.existsSync(distUploads)) fs.mkdirSync(distUploads, { recursive: true });
              fs.writeFileSync(path.join(distUploads, safeName), buffer);
            }
          };

          server.middlewares.use('/api/upload-raw', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            req.on('end', () => {
              try {
                const rawFilename = String(req.headers['x-filename'] || `media_${Date.now()}.mp4`);
                const safeName = path.basename(rawFilename);
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                const buffer = Buffer.concat(chunks);
                fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
                mirrorToDistIfPresent(safeName, buffer);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, url: `/uploads/${safeName}` }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e?.message || 'Raw upload failed' }));
              }
            });
          });

          server.middlewares.use('/api/upload-media', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const { filename, dataUrl } = JSON.parse(body);
                const safeName = path.basename(filename);
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(dataUrl, 'base64');
                fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
                mirrorToDistIfPresent(safeName, buffer);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, url: `/uploads/${safeName}` }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e?.message || 'Upload failed' }));
              }
            });
          });

          server.middlewares.use('/api/save-banner', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                const bannerConfig = JSON.parse(body);
                const localDb = readLocalDb();
                localDb.bannerConfig = bannerConfig;
                writeLocalDb(localDb);
                broadcastSyncEvent('banner_updated', { bannerConfig });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, bannerConfig }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e?.message || 'Save banner failed' }));
              }
            });
          });

          server.middlewares.use('/api/save-photo', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                const photo = JSON.parse(body);
                if (!photo || !photo.id) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing photo item' }));
                  return;
                }
                const localDb = readLocalDb();
                const idx = localDb.photos.findIndex((p: any) => p.id === photo.id);
                if (idx >= 0) localDb.photos[idx] = photo;
                else localDb.photos.unshift(photo);
                localDb.deletedPhotoIds = (localDb.deletedPhotoIds || []).filter((id: string) => id !== photo.id);
                writeLocalDb(localDb);
                broadcastSyncEvent('photo_saved', { id: photo.id });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, photo }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e?.message || 'Save failed' }));
              }
            });
          });

          server.middlewares.use('/api/save-video', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                const video = JSON.parse(body);
                if (!video || !video.id) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing video item' }));
                  return;
                }
                const localDb = readLocalDb();
                const idx = localDb.videos.findIndex((v: any) => v.id === video.id);
                if (idx >= 0) localDb.videos[idx] = video;
                else localDb.videos.unshift(video);
                localDb.deletedVideoIds = (localDb.deletedVideoIds || []).filter((id: string) => id !== video.id);
                writeLocalDb(localDb);
                broadcastSyncEvent('video_saved', { id: video.id });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, video }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e?.message || 'Save failed' }));
              }
            });
          });

          server.middlewares.use('/api/photo/', (req, res, next) => {
            if (req.method !== 'DELETE') return next();
            const id = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0]);
            const localDb = readLocalDb();
            localDb.photos = localDb.photos.filter((p: any) => p.id !== id);
            localDb.deletedPhotoIds = Array.from(new Set([...(localDb.deletedPhotoIds || []), id])).slice(-500);
            writeLocalDb(localDb);
            broadcastSyncEvent('photo_deleted', { id });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, id }));
          });

          server.middlewares.use('/api/video/', (req, res, next) => {
            if (req.method !== 'DELETE') return next();
            const id = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0]);
            const localDb = readLocalDb();
            localDb.videos = localDb.videos.filter((v: any) => v.id !== id);
            localDb.deletedVideoIds = Array.from(new Set([...(localDb.deletedVideoIds || []), id])).slice(-500);
            writeLocalDb(localDb);
            try {
              const safeId = path.basename(id).replace(/[^a-zA-Z0-9._-]/g, '');
              ['mp4', 'webm', 'mov', 'm4v', 'ogg'].forEach((ext) => {
                const cachedFile = path.join(uploadsDir, `stream_${safeId}.${ext}`);
                if (fs.existsSync(cachedFile)) fs.unlinkSync(cachedFile);
              });
            } catch {}
            broadcastSyncEvent('video_deleted', { id });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, id }));
          });

          server.middlewares.use('/api/feed', async (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            ensureFirestoreBroadcastWatcher();
            try {
              const localDb = readLocalDb();
              let cloudPhotos: any[] = [];
              let cloudVideos: any[] = [];
              let cloudPrivateVideos: any[] = [];
              let cloudBannerConfig: any = null;
              let cloudDeletedPhotos: string[] = [];
              let cloudDeletedVideos: string[] = [];
              try {
                const { getDocs, getDoc, doc, collection } = await import('firebase/firestore');
                const { db } = await import('./src/firebase.ts');
                const [pSnap, vSnap, pvSnap, bSnap, syncSnap] = await Promise.all([
                  getDocs(collection(db, 'photos')),
                  getDocs(collection(db, 'videos')),
                  getDocs(collection(db, 'privateVideos')),
                  getDoc(doc(db, 'settings', 'bannerConfig')),
                  getDoc(doc(db, 'settings', 'syncMeta')),
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
              } catch {}

              const deletedPhotoIds = Array.from(new Set([...(localDb.deletedPhotoIds || []), ...cloudDeletedPhotos]));
              const deletedVideoIds = Array.from(new Set([...(localDb.deletedVideoIds || []), ...cloudDeletedVideos]));
              const deletedPhotoSet = new Set(deletedPhotoIds);
              const deletedVideoSet = new Set(deletedVideoIds);

              const photoMap = new Map<string, any>();
              localDb.photos.forEach((p: any) => {
                if (!deletedPhotoSet.has(p.id)) photoMap.set(p.id, p);
              });
              cloudPhotos.forEach((p: any) => {
                if (!deletedPhotoSet.has(p.id)) photoMap.set(p.id, p);
              });

              const videoMap = new Map<string, any>();
              localDb.videos.forEach((v: any) => {
                if (!deletedVideoSet.has(v.id)) videoMap.set(v.id, v);
              });
              cloudVideos.forEach((v: any) => {
                if (!deletedVideoSet.has(v.id)) videoMap.set(v.id, v);
              });

              const photos = Array.from(photoMap.values()).filter((p: any) => {
                if (!p || !p.id) return false;
                if (p.imageUrl && p.imageUrl.startsWith('/uploads/')) {
                  return fs.existsSync(path.join(uploadsDir, path.basename(p.imageUrl.split('?')[0])));
                }
                return Boolean(p.imageUrl && !String(p.imageUrl).startsWith('blob:'));
              });
              photos.sort((a: any, b: any) => ((b.slotNumber || 0) - (a.slotNumber || 0)) || ((b.createdAtMs || 0) - (a.createdAtMs || 0)));

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
              videos.sort((a: any, b: any) => ((b.slotNumber || 0) - (a.slotNumber || 0)) || ((b.createdAtMs || 0) - (a.createdAtMs || 0)));

              const privateVideos = cloudPrivateVideos
                .filter((pv: any) => pv && pv.id && !deletedVideoSet.has(pv.id))
                .map((pv: any) => ({
                  ...pv,
                  gallery: pv.gallery || 'Global Adult',
                  galleries: Array.isArray(pv.galleries) ? pv.galleries : undefined,
                  coinPrice: typeof pv.coinPrice === 'number' ? pv.coinPrice : 50,
                  slotNumber: typeof pv.slotNumber === 'number' ? pv.slotNumber : 1,
                }));
              privateVideos.sort((a: any, b: any) => ((b.slotNumber || 0) - (a.slotNumber || 0)) || ((b.createdAtMs || 0) - (a.createdAtMs || 0)));

              // Cloud Firestore bannerConfig takes precedence over any older localDb copy
              const mergedBannerConfig = localDb.bannerConfig || cloudBannerConfig
                ? { ...(localDb.bannerConfig || {}), ...(cloudBannerConfig || {}) }
                : null;

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
              res.end(JSON.stringify({
                photos,
                videos,
                privateVideos,
                bannerConfig: mergedBannerConfig,
                deletedPhotoIds,
                deletedVideoIds,
                ts: Date.now(),
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store');
              res.end(JSON.stringify({ error: err?.message, photos: [], videos: [], privateVideos: [] }));
            }
          });
        },
        transformIndexHtml(html) {
          const envOrigin = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
          if (!envOrigin) return html;
          const ogImageAbs = `${envOrigin}/og-image.png?v=5`;
          return html
            .replace('<!-- CANONICAL_TAG -->', `<link rel="canonical" href="${envOrigin}/" />`)
            .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${envOrigin}/" />`)
            .replace(/<link rel="image_src" href="[^"]*" \/>/, `<link rel="image_src" href="${ogImageAbs}" />`)
            .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImageAbs}" />`)
            .replace(/<meta property="og:image:secure_url" content="[^"]*" \/>/, `<meta property="og:image:secure_url" content="${ogImageAbs}" />`)
            .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImageAbs}" />`)
            .replace(/"image":\s*"[^"]*"/, `"image": "${ogImageAbs}"`);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
