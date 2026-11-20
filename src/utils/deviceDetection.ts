import { AppBannerConfig } from '../types';

const SESSION_DISMISS_KEY = 'zuzika_apk_popup_session_dismissed';
const STORAGE_DISMISS_AT_KEY = 'zuzika_apk_popup_dismissed_at';

/**
 * Detects whether the app is already running in an installed/standalone mode
 * (Capacitor native Android APK, installed PWA standalone window, or iOS home-screen app).
 */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (Boolean((window as any).Capacitor?.isNativePlatform?.())) return true;

  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return true;
  } catch {}

  if ((navigator as any).standalone === true) return true;
  return false;
}

/**
 * Detects iOS / iPadOS devices (which use Safari Share -> Add to Home Screen for PWA install).
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detects whether the visitor is using an Android mobile/tablet web browser.
 * Returns false for Desktop OS (Windows, macOS, Desktop Linux), iOS, and native APK WebViews.
 */
export function isAndroidMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isDesktopOS = /Windows NT|Macintosh|CrOS/i.test(ua) || (/Linux/i.test(ua) && !isAndroid);
  const isNativeCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.());

  return isAndroid && !isDesktopOS && !isNativeCapacitor;
}

/**
 * Detects social media / messenger in-app browsers (Facebook, Messenger, Instagram,
 * Imo, WhatsApp, Telegram, Line, WeChat, Android WebView) that often block .apk
 * downloads or hide Chrome's PWA install prompt.
 */
export function isInAppSocialBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|WhatsApp|Telegram|Snapchat|Twitter|imo|; wv\)|\bwv\b/i.test(
    ua
  );
}

/**
 * Builds an Android intent:// URI that breaks out of Facebook/Messenger/Imo WebViews
 * and opens the current site (or target URL) directly inside Google Chrome.
 */
export function getOpenInChromeIntentUrl(targetUrl?: string): string {
  if (typeof window === 'undefined') return '#';
  const raw = (targetUrl || window.location.href).trim();
  try {
    const parsed = new URL(raw, window.location.origin);
    const scheme = parsed.protocol.replace(':', '') || 'https';
    const hostAndPath = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    const fallback = encodeURIComponent(parsed.toString());
    return `intent://${hostAndPath}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  } catch {
    return raw;
  }
}

/**
 * Validates that a configured APK download URL is a genuine download link
 * (and not empty or merely pointing back to the plain website homepage).
 */
export function isValidRealApkUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject bare origin URL if someone left the default homepage URL instead of an APK file/link
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/+$/, '');
    const normalized = trimmed.replace(/\/+$/, '');
    if (
      normalized === origin ||
      normalized === `${origin}/` ||
      normalized === 'https://ais-pre-xxnlcelsjsskkuifh3xj2g-772740332293.asia-northeast1.run.app'
    ) {
      return false;
    }
  }

  return (
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/apk/') ||
    trimmed.startsWith('/api/apk-stream/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  );
}

/**
 * Converts common cloud viewer URLs (Google Drive, Dropbox) into direct file
 * download URLs so Android phones download the .apk directly instead of opening a web preview.
 */
export function resolveDirectApkDownloadUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Resolve relative paths (/uploads/... or /apk/...) to full current origin
  if (trimmed.startsWith('/')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${trimmed}`;
  }

  // Google Drive: convert view/open links to drive.usercontent direct download URL (bypasses large-file HTML warning)
  const gdriveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (gdriveFileMatch && gdriveFileMatch[1]) {
    return `https://drive.usercontent.google.com/download?id=${gdriveFileMatch[1]}&export=download&confirm=t`;
  }

  const gdriveOpenMatch = trimmed.match(/drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([a-zA-Z0-9_-]+)/i);
  if (gdriveOpenMatch && gdriveOpenMatch[1]) {
    return `https://drive.usercontent.google.com/download?id=${gdriveOpenMatch[1]}&export=download&confirm=t`;
  }

  // Dropbox: convert ?dl=0 (or missing dl param) to ?dl=1 for instant download
  if (/dropbox\.com\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      u.searchParams.set('dl', '1');
      return u.toString();
    } catch {
      return trimmed.replace(/dl=0/gi, 'dl=1');
    }
  }

  return trimmed;
}

/**
 * Checks whether the URL points to a same-origin server file under /uploads/ or /apk/.
 */
export function isSameOriginLocalApkUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/apk/') ||
    trimmed.startsWith('/api/apk-stream/')
  ) {
    return true;
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (
      trimmed.startsWith(`${origin}/uploads/`) ||
      trimmed.startsWith(`${origin}/apk/`) ||
      trimmed.startsWith(`${origin}/api/apk-stream/`)
    ) {
      return true;
    }
  }
  return false;
}

export function isInsideIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Checks whether the automatic Web App / Android APK download popup should appear
 * for the current web visitor based on Admin settings, installed check,
 * single-visit session lock, and repeat cooldown.
 */
export function shouldShowAndroidApkPopup(bannerConfig?: AppBannerConfig): boolean {
  if (!bannerConfig) return false;
  if (bannerConfig.showInstallPopup === false) return false;

  // Never show download popup if user is already running inside an installed APK or PWA
  if (isStandaloneApp()) {
    return false;
  }

  try {
    // 1. Never show again in the same visit once closed or postponed
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true') {
      return false;
    }

    // 2. Check repeat cooldown after user taps Later / Close
    const dismissedAtRaw = localStorage.getItem(STORAGE_DISMISS_AT_KEY);
    if (dismissedAtRaw) {
      const dismissedAt = Number(dismissedAtRaw);
      if (!Number.isNaN(dismissedAt) && dismissedAt > 0) {
        const repeatDays =
          typeof bannerConfig.apkPopupCooldownDays === 'number'
            ? bannerConfig.apkPopupCooldownDays
            : 7;

        // repeatDays <= 0 means show only once ever (until cleared)
        if (repeatDays <= 0) {
          return false;
        }

        const cooldownMs = repeatDays * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedAt < cooldownMs) {
          return false;
        }
      }
    }
  } catch {
    // Ignore storage access errors in private mode
  }

  return true;
}

/**
 * Records dismissal when user taps "Later", "Close", or starts APK download.
 * Prevents repeated popups in the same session and starts the cooldown timer.
 */
export function dismissAndroidApkPopup(): void {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    localStorage.setItem(STORAGE_DISMISS_AT_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors
  }
}
