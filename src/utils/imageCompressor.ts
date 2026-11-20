/**
 * Helper utility to resize and compress user-selected images client-side
 * before storing them in Cloud Firestore documents or IndexedDB.
 * Cloud Firestore has a hard 1MB limit per document.
 * This compressor guarantees photos are always well under ~450KB while retaining crisp clarity.
 */

export async function compressImageFile(
  file: File,
  maxDimension = 960,
  initialQuality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name)) {
      reject(new Error('Selected file is a video, not an image'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const cleanup = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    };

    const processImageElement = (loadedImg: HTMLImageElement) => {
      try {
        let width = loadedImg.naturalWidth || loadedImg.width;
        let height = loadedImg.naturalHeight || loadedImg.height;

        if (!width || !height) {
          cleanup();
          reject(new Error('Invalid image dimensions'));
          return;
        }

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.fillStyle = '#080a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(loadedImg, 0, 0, canvas.width, canvas.height);

        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Adaptive compression loop: guarantee Data URL is <= 460,000 chars (~345KB binary)
        // so it ALWAYS fits comfortably inside Firestore 1MB docs and IndexedDB.
        let scale = 1.0;
        while (dataUrl.length > 460_000 && (quality > 0.45 || scale > 0.35)) {
          if (quality > 0.5) {
            quality = Math.max(0.45, quality - 0.12);
          } else {
            scale = scale * 0.78;
            canvas.width = Math.max(160, Math.round(width * scale));
            canvas.height = Math.max(160, Math.round(height * scale));
            ctx.fillStyle = '#080a12';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(loadedImg, 0, 0, canvas.width, canvas.height);
          }
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onload = () => processImageElement(img);
    img.onerror = () => {
      // Fallback to FileReader if ObjectURL fails
      cleanup();
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = () => {
        const fallbackImg = new Image();
        fallbackImg.onerror = () => reject(new Error('Image failed to decode'));
        fallbackImg.onload = () => processImageElement(fallbackImg);
        fallbackImg.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}
