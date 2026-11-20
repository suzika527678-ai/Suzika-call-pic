import { copyToClipboard } from './clipboard';

export interface ShareAppResult {
  method: 'native-with-logo' | 'native-url' | 'clipboard' | 'cancelled';
  ok: boolean;
}

let cachedLogoFile: File | null = null;
let preloadPromise: Promise<File | null> | null = null;

/**
 * Generates a crisp PNG SUZIKA Call Pic branded logo card directly in-memory
 * if the static /og-image.png fetch isn't cached yet, guaranteeing zero async delay
 * so mobile browsers never drop the user-gesture token before navigator.share().
 */
function buildInstantCanvasLogoFile(): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      // Dark neon background
      const bg = ctx.createLinearGradient(0, 0, 1200, 630);
      bg.addColorStop(0, '#0c0f1d');
      bg.addColorStop(0.5, '#080a12');
      bg.addColorStop(1, '#120b24');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1200, 630);

      // Outer border glow
      const borderGrad = ctx.createLinearGradient(0, 0, 1200, 0);
      borderGrad.addColorStop(0, '#ff35bb');
      borderGrad.addColorStop(0.5, '#8b4dff');
      borderGrad.addColorStop(1, '#00d2ff');
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(24, 24, 1152, 582, 36);
      ctx.stroke();

      // Z Badge box
      ctx.fillStyle = '#0d101b';
      ctx.beginPath();
      ctx.roundRect(120, 185, 260, 260, 56);
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = borderGrad;
      ctx.stroke();

      // Z Path
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 34;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(190, 255);
      ctx.lineTo(310, 255);
      ctx.lineTo(195, 375);
      ctx.lineTo(310, 375);
      ctx.stroke();

      // Title
      ctx.fillStyle = '#ff35bb';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('OFFICIAL WEB & ANDROID APP', 435, 235);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 72px sans-serif';
      ctx.fillText('SUZIKA Call Pic', 435, 325);

      ctx.fillStyle = '#b4bdd6';
      ctx.font = '500 30px sans-serif';
      ctx.fillText('HD Photo Gallery • Full-Screen Video Reels', 435, 382);

      ctx.fillStyle = '#00d2ff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('Photo  ·  Video  ·  Community', 435, 434);

      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        resolve(new File([blob], 'suzika-call-pic-logo.png', { type: 'image/png' }));
      }, 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Preloads /og-image.png?v=5 into memory so tapping Share has 0 network wait
 * and preserves the browser's user-gesture requirement for navigator.share({ files }).
 */
export function preloadShareLogoFile(): Promise<File | null> {
  if (cachedLogoFile) return Promise.resolve(cachedLogoFile);
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      const res = await fetch('/og-image.png?v=5', { credentials: 'include' });
      if (res.ok) {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('text/html')) {
          const blob = await res.blob();
          cachedLogoFile = new File([blob], 'suzika-call-pic-logo.png', {
            type: blob.type || 'image/png',
          });
          return cachedLogoFile;
        }
      }
    } catch {
      // Fallback below
    }
    const fallbackFile = await buildInstantCanvasLogoFile();
    if (fallbackFile) cachedLogoFile = fallbackFile;
    return cachedLogoFile;
  })();

  return preloadPromise;
}

if (typeof window !== 'undefined') {
  preloadShareLogoFile().catch(() => {});
}

/**
 * Downloads the SUZIKA branded logo card PNG directly to phone storage
 * so users can attach it directly in IMO/Messenger if their browser restricts Web Share files.
 */
export async function downloadShareLogoCard(): Promise<boolean> {
  try {
    const file = cachedLogoFile || (await preloadShareLogoFile());
    if (!file) return false;
    const blobUrl = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'SUZIKA-Call-Pic-Logo.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shares the SUZIKA branded logo card + link via Android Web Share API.
 * Crucially omits `url` when passing `files` because Android Chrome/IMO drops or rejects
 * attached logo images when `url` is passed alongside `files`.
 */
export async function shareAppWithLogo(appUrl: string): Promise<ShareAppResult> {
  const shareTitle = 'SUZIKA Call Pic';
  const shareTextWithLink = `SUZIKA Call Pic — HD ছবি ও ফুল-স্ক্রিন ভিডিও রিলস দেখতে নিচের লিংকে ক্লিক করুন:\n${appUrl}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    // 1. Try attaching preloaded logo File synchronously within the user-gesture window
    try {
      const logoFile = cachedLogoFile || (await preloadShareLogoFile());
      if (logoFile && typeof navigator.canShare === 'function') {
        const mediaPayload: ShareData = {
          title: shareTitle,
          text: shareTextWithLink,
          files: [logoFile],
        };
        if (navigator.canShare(mediaPayload)) {
          await navigator.share(mediaPayload);
          return { method: 'native-with-logo', ok: true };
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { method: 'cancelled', ok: false };
      }
      // Continue to URL-only fallback
    }

    // 2. Standard Web Share fallback (title + text + url)
    try {
      await navigator.share({
        title: shareTitle,
        text: 'SUZIKA Call Pic — HD Photo Gallery & Video Reels',
        url: appUrl,
      });
      return { method: 'native-url', ok: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { method: 'cancelled', ok: false };
      }
    }
  }

  // 3. Clipboard fallback
  const copied = await copyToClipboard(appUrl);
  return { method: 'clipboard', ok: copied };
}
