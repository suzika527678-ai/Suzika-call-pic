/**
 * Client-side uploader to send real video & photo files to server disk.
 * Returns persistent public URL e.g. /uploads/video_12345.mp4
 * which is accessible to all users across all devices.
 */

export const MAX_INLINE_VIDEO_BYTES = 620 * 1024; // ~620 KB raw -> ~827 KB base64 (+ thumb <= 70KB fits safely under 1MB Firestore limit)

export function blobToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadMediaToServer(
  file: File | Blob,
  prefix = 'media',
  originalName?: string,
  exactFilename?: string
): Promise<string | null> {
  try {
    const rawName = originalName || (file instanceof File ? file.name : `file_${Date.now()}`);
    const ext = rawName.split('.').pop() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
    const filename =
      exactFilename && exactFilename.trim()
        ? exactFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
        : `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;

    // 1. Primary Strategy: Fast raw binary streaming (no base64 overhead, perfect for large MP4 videos)
    try {
      const rawRes = await fetch('/api/upload-raw', {
        method: 'POST',
        headers: {
          'x-filename': filename,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (rawRes.ok) {
        const rawData = await rawRes.json();
        if (rawData && rawData.url) {
          return rawData.url;
        }
      }
    } catch (rawErr) {
      console.warn('Raw streaming upload error, trying base64 fallback:', rawErr);
    }

    // 2. Secondary Strategy: Base64 JSON POST fallback
    const base64Data = await blobToDataUrl(file);

    const response = await fetch('/api/upload-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        dataUrl: base64Data,
        type: file.type.startsWith('video/') ? 'video' : 'photo',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.url) {
        return data.url;
      }
    }
  } catch (err) {
    console.warn('Server upload failed, fallback to local storage:', err);
  }
  return null;
}
