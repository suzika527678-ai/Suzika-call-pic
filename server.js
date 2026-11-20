import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, setDoc } from "firebase/firestore";
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
const PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const setApkHeaders = (res, filePath) => {
  if (filePath.toLowerCase().endsWith(".apk")) {
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="SUZIKA-Call-Pic.apk"');
    res.setHeader("Cache-Control", "no-cache");
  }
};
app.use("/uploads", express.static(uploadsDir, { setHeaders: setApkHeaders }));
app.use("/uploads", (_req, res) => {
  res.status(404).send("File not found");
});
const apkDir = path.join(__dirname, "public", "apk");
if (!fs.existsSync(apkDir)) {
  fs.mkdirSync(apkDir, { recursive: true });
}
app.use("/apk", express.static(apkDir, { setHeaders: setApkHeaders }));
app.use("/apk", (_req, res) => {
  res.status(404).send("APK file not found");
});
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    name: "ZUZika Call Pic",
    version: "1.0.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const mediaDbPath = path.join(dataDir, "media_db.json");
function readLocalMediaDb() {
  try {
    if (fs.existsSync(mediaDbPath)) {
      return JSON.parse(fs.readFileSync(mediaDbPath, "utf-8"));
    }
  } catch (e) {
    console.warn("Error reading media_db.json:", e);
  }
  return { photos: [], videos: [] };
}
function writeLocalMediaDb(dbData) {
  try {
    fs.writeFileSync(mediaDbPath, JSON.stringify(dbData, null, 2), "utf-8");
  } catch (e) {
    console.warn("Error writing media_db.json:", e);
  }
}
let feedCache = null;
app.get("/api/feed", async (_req, res) => {
  try {
    const now = Date.now();
    if (feedCache && now - feedCache.timestamp < 1e4) {
      return res.json(feedCache.data);
    }
    const localDb = readLocalMediaDb();
    let cloudPhotos = [];
    let cloudVideos = [];
    try {
      const [pSnap, vSnap] = await Promise.all([
        getDocs(collection(fbDb, "photos")),
        getDocs(collection(fbDb, "videos"))
      ]);
      cloudPhotos = pSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
      cloudVideos = vSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    } catch (fsErr) {
      console.warn("Firestore feed read notice (using local db):", fsErr);
    }
    const photoMap = /* @__PURE__ */ new Map();
    localDb.photos.forEach((p) => photoMap.set(p.id, p));
    cloudPhotos.forEach((p) => photoMap.set(p.id, p));
    const videoMap = /* @__PURE__ */ new Map();
    localDb.videos.forEach((v) => videoMap.set(v.id, v));
    cloudVideos.forEach((v) => videoMap.set(v.id, v));
    const photos = Array.from(photoMap.values()).filter((p) => {
      if (p.imageUrl && p.imageUrl.startsWith("/uploads/")) {
        return fs.existsSync(path.join(uploadsDir, path.basename(p.imageUrl)));
      }
      return true;
    });
    photos.sort((a, b) => (b.slotNumber || 0) - (a.slotNumber || 0));
    const videos = Array.from(videoMap.values()).map((v) => {
      const hasPublicUrl = Boolean(
        v.videoUrl && (v.videoUrl.startsWith("/") || v.videoUrl.startsWith("http://") || v.videoUrl.startsWith("https://") || v.videoUrl.startsWith("data:"))
      );
      return hasPublicUrl ? { ...v, isLocalIndexedDB: false } : v;
    });
    videos.sort((a, b) => (b.slotNumber || 0) - (a.slotNumber || 0));
    feedCache = { timestamp: now, data: { photos, videos } };
    return res.json({ photos, videos });
  } catch (err) {
    console.error("Error in /api/feed:", err);
    const localDb = readLocalMediaDb();
    return res.json(localDb);
  }
});
app.post("/api/save-photo", async (req, res) => {
  try {
    const photo = req.body;
    if (!photo || !photo.id) {
      return res.status(400).json({ error: "Missing photo item" });
    }
    const localDb = readLocalMediaDb();
    const existingIndex = localDb.photos.findIndex((p) => p.id === photo.id);
    if (existingIndex >= 0) {
      localDb.photos[existingIndex] = photo;
    } else {
      localDb.photos.unshift(photo);
    }
    writeLocalMediaDb(localDb);
    try {
      await setDoc(doc(fbDb, "photos", photo.id), photo);
    } catch (fsErr) {
      console.warn("Firestore save-photo notice:", fsErr);
    }
    feedCache = null;
    return res.json({ success: true, photo });
  } catch (err) {
    console.error("Error saving photo on server:", err);
    return res.status(500).json({ error: err.message || "Failed to save photo" });
  }
});
app.post("/api/save-video", async (req, res) => {
  try {
    const video = req.body;
    if (!video || !video.id) {
      return res.status(400).json({ error: "Missing video item" });
    }
    const localDb = readLocalMediaDb();
    const existingIndex = localDb.videos.findIndex((v) => v.id === video.id);
    if (existingIndex >= 0) {
      localDb.videos[existingIndex] = video;
    } else {
      localDb.videos.unshift(video);
    }
    writeLocalMediaDb(localDb);
    try {
      await setDoc(doc(fbDb, "videos", video.id), video);
    } catch (fsErr) {
      console.warn("Firestore save-video notice:", fsErr);
    }
    feedCache = null;
    return res.json({ success: true, video });
  } catch (err) {
    console.error("Error saving video on server:", err);
    return res.status(500).json({ error: err.message || "Failed to save video" });
  }
});
app.post("/api/upload-media", (req, res) => {
  try {
    const { filename, dataUrl } = req.body;
    if (!filename || !dataUrl) {
      return res.status(400).json({ error: "Missing filename or dataUrl" });
    }
    const safeName = path.basename(filename);
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = matches ? Buffer.from(matches[2], "base64") : Buffer.from(dataUrl, "base64");
    fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
    const distPath2 = path.join(__dirname, "dist");
    if (fs.existsSync(distPath2)) {
      const distUploads = path.join(distPath2, "uploads");
      if (!fs.existsSync(distUploads)) fs.mkdirSync(distUploads, { recursive: true });
      fs.writeFileSync(path.join(distUploads, safeName), buffer);
    }
    feedCache = null;
    return res.json({ success: true, url: `/uploads/${safeName}` });
  } catch (err) {
    console.error("Server upload error:", err);
    return res.status(500).json({ error: err.message || "Upload failed" });
  }
});
app.post("/api/upload-raw", express.raw({ type: "*/*", limit: "250mb" }), (req, res) => {
  try {
    const rawFilename = req.headers["x-filename"] || `media_${Date.now()}.mp4`;
    const safeName = path.basename(rawFilename);
    const buffer = req.body;
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "Empty file payload" });
    }
    fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
    const distPath2 = path.join(__dirname, "dist");
    if (fs.existsSync(distPath2)) {
      const distUploads = path.join(distPath2, "uploads");
      if (!fs.existsSync(distUploads)) fs.mkdirSync(distUploads, { recursive: true });
      fs.writeFileSync(path.join(distUploads, safeName), buffer);
    }
    feedCache = null;
    return res.json({ success: true, url: `/uploads/${safeName}` });
  } catch (err) {
    console.error("Server raw upload error:", err);
    return res.status(500).json({ error: err.message || "Raw upload failed" });
  }
});
app.delete("/api/photo/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const localDb = readLocalMediaDb();
    localDb.photos = localDb.photos.filter((p) => p.id !== id);
    writeLocalMediaDb(localDb);
    try {
      await deleteDoc(doc(fbDb, "photos", id));
    } catch {
    }
    feedCache = null;
    return res.json({ success: true, id });
  } catch (err) {
    console.error("Server photo delete error:", err);
    return res.status(500).json({ error: err.message || "Delete failed" });
  }
});
app.delete("/api/video/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const localDb = readLocalMediaDb();
    localDb.videos = localDb.videos.filter((v) => v.id !== id);
    writeLocalMediaDb(localDb);
    try {
      await deleteDoc(doc(fbDb, "videos", id));
    } catch {
    }
    feedCache = null;
    return res.json({ success: true, id });
  } catch (err) {
    console.error("Server video delete error:", err);
    return res.status(500).json({ error: err.message || "Delete failed" });
  }
});
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { index: false }));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.get("*", (_req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>ZUZika Call Pic</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="background:#080a12;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;">
            <h1 style="color:#ff35bb;">ZUZika Call Pic</h1>
            <p>Ready to deploy. Run <code>npm run build</code> to generate production bundle.</p>
          </div>
        </body>
      </html>
    `);
  });
}
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ZUZika Call Pic server running at http://0.0.0.0:${PORT}`);
});
