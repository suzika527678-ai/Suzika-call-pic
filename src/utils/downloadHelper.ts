export const DEFAULT_PHOTO_WATERMARK_TEXT = '01632067905 ইমু নাম্বার';

/**
 * Utility to reliably trigger downloads for images and videos
 * Handles Base64 data URLs, Blob URLs, and cross-origin media files
 */
export async function triggerMediaDownload(url: string, filename: string): Promise<boolean> {
  if (!url) {
    console.error('Download failed: URL is empty');
    return false;
  }

  try {
    // 1. If it's a data URL or blob URL, directly download via <a> tag
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 200);
      return true;
    }

    // 2. For external HTTP/HTTPS files, attempt fetching as blob so browser triggers a save file prompt
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          } catch {}
        }, 5000);
        return true;
      }
    } catch {
      // CORS or network failure fallback
    }

    // 3. Fallback anchor click with target blank
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {}
    }, 200);
    return true;
  } catch (err) {
    console.error('Media download trigger failed:', err);
    return false;
  }
}

function loadImageElement(src: string, useCors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCors) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws the transparent SUZIKA PNG logo (neon Z emblem + SUZIKA wordmark)
 * directly on top of the photo with NO opaque background box or dark strip.
 */
function drawTransparentPngLogoOnPhoto(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const minDim = Math.min(w, h);
  const marginX = Math.max(14, Math.round(w * 0.036));
  const marginTop = Math.max(14, Math.round(h * 0.036));

  // Scale neon Z emblem and wordmark cleanly to any resolution
  const zSize = Math.max(28, Math.round(minDim * 0.085));
  const textSize = Math.max(18, Math.round(zSize * 0.62));
  const gap = Math.max(8, Math.round(zSize * 0.24));

  ctx.save();
  ctx.font = `900 ${textSize}px 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif`;
  const brandText = 'SUZIKA';
  const textWidth = ctx.measureText(brandText).width;
  const totalLogoWidth = zSize + gap + textWidth;

  // Position cleanly at top-right on top of the photo
  const startX = Math.max(marginX, w - marginX - totalLogoWidth);
  const startY = marginTop;

  // Neon gradient for the Z emblem (no background fill behind it)
  const neonGrad = ctx.createLinearGradient(startX, startY + zSize, startX + zSize, startY);
  neonGrad.addColorStop(0, '#ff35bb');
  neonGrad.addColorStop(0.5, '#8b4dff');
  neonGrad.addColorStop(1, '#00d2ff');

  // Subtle shadow so the transparent PNG logo stands out over any photo background
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = Math.max(8, Math.round(zSize * 0.28));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(2, Math.round(zSize * 0.08));

  // Draw crisp transparent neon Z stroke (zero square/card background)
  const pad = zSize * 0.12;
  ctx.strokeStyle = neonGrad;
  ctx.lineWidth = Math.max(4, Math.round(zSize * 0.19));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(startX + pad, startY + pad);
  ctx.lineTo(startX + zSize - pad, startY + pad);
  ctx.lineTo(startX + pad, startY + zSize - pad);
  ctx.lineTo(startX + zSize - pad, startY + zSize - pad);
  ctx.stroke();

  // Draw crisp transparent "SUZIKA" wordmark next to Z (with subtle dark outline for bright backgrounds)
  const textX = startX + zSize + gap;
  const textCenterY = startY + zSize / 2 + textSize * 0.04;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2.5, Math.round(textSize * 0.14));
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeText(brandText, textX, textCenterY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(brandText, textX, textCenterY);

  ctx.restore();
}

/**
 * Stamps the transparent SUZIKA PNG logo directly on top of the photo (no background),
 * keeps the IMO number watermark cleanly in the bottom-left corner,
 * and exports the final image as a crisp PNG file.
 */
export async function triggerPhotoDownloadWithWatermark(
  url: string,
  filename: string,
  watermarkText: string = DEFAULT_PHOTO_WATERMARK_TEXT
): Promise<boolean> {
  if (!url) return false;
  const label = (watermarkText || DEFAULT_PHOTO_WATERMARK_TEXT).trim();
  const pngFilename = /\.(jpe?g|webp|gif|bmp)$/i.test(filename)
    ? filename.replace(/\.(jpe?g|webp|gif|bmp)$/i, '.png')
    : filename.toLowerCase().endsWith('.png')
    ? filename
    : `${filename}.png`;

  let tempBlobUrl: string | null = null;
  try {
    let img: HTMLImageElement;

    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
      img = await loadImageElement(url, false);
    } else {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();
        tempBlobUrl = URL.createObjectURL(blob);
        img = await loadImageElement(tempBlobUrl, false);
      } catch {
        img = await loadImageElement(url, true);
      }
    }

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) {
      return triggerMediaDownload(url, pngFilename);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return triggerMediaDownload(url, pngFilename);
    }

    // 1. Draw full-bleed photo
    ctx.drawImage(img, 0, 0, w, h);

    // 2. Overlay transparent SUZIKA PNG logo directly on top of the pic (no background)
    drawTransparentPngLogoOnPhoto(ctx, w, h);

    // 3. Stamp IMO number watermark badge in bottom-left corner of photo
    if (label) {
      const marginX = Math.max(12, Math.round(w * 0.038));
      const marginBottom = Math.max(14, Math.round(h * 0.042));
      const maxBadgeW = w - marginX * 2;
      let fontSize = Math.max(16, Math.round(Math.min(w, h) * 0.038));

      ctx.font = `700 ${fontSize}px 'Noto Sans Bengali', 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif`;
      let padX = Math.round(fontSize * 0.72);
      let iconSize = Math.round(fontSize * 0.48);
      let iconGap = Math.round(fontSize * 0.45);
      let textWidth = ctx.measureText(label).width;

      while (textWidth + padX * 2 + iconSize + iconGap > maxBadgeW && fontSize > 11) {
        fontSize -= 1;
        ctx.font = `700 ${fontSize}px 'Noto Sans Bengali', 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif`;
        padX = Math.round(fontSize * 0.72);
        iconSize = Math.round(fontSize * 0.48);
        iconGap = Math.round(fontSize * 0.45);
        textWidth = ctx.measureText(label).width;
      }

      const padY = Math.round(fontSize * 0.44);
      const badgeW = Math.min(maxBadgeW, Math.ceil(textWidth + padX * 2 + iconSize + iconGap));
      const badgeH = Math.ceil(fontSize + padY * 2);
      const boxX = marginX;
      const boxY = h - badgeH - marginBottom;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = Math.max(8, Math.round(fontSize * 0.5));
      ctx.shadowOffsetY = Math.max(2, Math.round(fontSize * 0.14));
      drawRoundedRectPath(ctx, boxX, boxY, badgeW, badgeH, Math.round(badgeH / 2));
      ctx.fillStyle = 'rgba(8, 10, 18, 0.84)';
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawRoundedRectPath(ctx, boxX, boxY, badgeW, badgeH, Math.round(badgeH / 2));
      ctx.lineWidth = Math.max(1.5, fontSize * 0.08);
      ctx.strokeStyle = 'rgba(255, 53, 187, 0.9)';
      ctx.stroke();

      const dotX = boxX + padX + iconSize / 2;
      const dotY = boxY + badgeH / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#00d2ff';
      ctx.fill();

      ctx.font = `700 ${fontSize}px 'Noto Sans Bengali', 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + padX + iconSize + iconGap, boxY + badgeH / 2 + fontSize * 0.04);
      ctx.restore();
    }

    // 4. Export as PNG
    const outBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    );
    if (!outBlob) {
      return triggerMediaDownload(url, pngFilename);
    }

    const outUrl = URL.createObjectURL(outBlob);
    const ok = await triggerMediaDownload(outUrl, pngFilename);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(outUrl);
      } catch {}
    }, 6000);
    return ok;
  } catch (err) {
    console.warn('Watermarked photo export fell back to direct download:', err);
    return triggerMediaDownload(url, pngFilename);
  } finally {
    if (tempBlobUrl) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(tempBlobUrl!);
        } catch {}
      }, 2000);
    }
  }
}
