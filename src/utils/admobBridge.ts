import { AppBannerConfig } from '../types';
import { REAL_ADMOB_CONFIG, TEST_ADMOB_CONFIG } from '../data/initialData';

/**
 * Unified Native Android AdMob Bridge for SUZIKA Call Pic.
 * Connects cleanly to:
 *  1) Capacitor (@capacitor-community/admob) when packaged as a Capacitor Android APK
 *  2) Android / Flutter WebView JavascriptChannel ("SuzikaAndroidAds") when wrapped in native WebView
 * Falls back cleanly on standard Web browsers without errors or fake ads.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: {
        AdMob?: {
          initialize?: (opts: any) => Promise<void>;
          showBanner?: (opts: any) => Promise<void>;
          hideBanner?: () => Promise<void>;
          prepareInterstitial?: (opts: any) => Promise<void>;
          showInterstitial?: () => Promise<void>;
          prepareRewardVideoAd?: (opts: any) => Promise<void>;
          showRewardVideoAd?: () => Promise<{ type?: string; amount?: number } | void>;
        };
      };
    };
    SuzikaAndroidAds?: {
      syncConfig?: (jsonConfig: string) => void;
      showInterstitial?: () => void;
      showAppOpen?: () => void;
      showRewarded?: (callbackId: string) => void;
    };
    __suzikaAdCallbacks?: Record<string, (status: 'rewarded' | 'dismissed' | 'unavailable') => void>;
  }
}

let isCapacitorAdMobInitialized = false;
let isBannerVisible = false;
let mediaViewCounter = 0;
let lastInterstitialTimestamp = 0;
let lastAppOpenTimestamp = 0;
const APP_OPEN_COOLDOWN_MS = 180000; // 3 minutes minimum between App Open ads

export function getActiveAdMobIds(config?: AppBannerConfig) {
  const isTest = config?.isTestMode === true;
  if (isTest) {
    return {
      appId: TEST_ADMOB_CONFIG.appId,
      bannerUnitId: TEST_ADMOB_CONFIG.bannerUnitId,
      interstitialUnitId: TEST_ADMOB_CONFIG.interstitialUnitId,
      rewardedUnitId: TEST_ADMOB_CONFIG.rewardedUnitId,
      appOpenUnitId: TEST_ADMOB_CONFIG.appOpenUnitId,
      nativeUnitId: TEST_ADMOB_CONFIG.nativeUnitId,
      isTesting: true,
    };
  }
  return {
    appId: config?.admobAppId || REAL_ADMOB_CONFIG.appId,
    bannerUnitId: config?.admobBannerUnitId || REAL_ADMOB_CONFIG.bannerUnitId,
    interstitialUnitId: config?.admobInterstitialUnitId || REAL_ADMOB_CONFIG.interstitialUnitId,
    rewardedUnitId: config?.admobRewardedUnitId || REAL_ADMOB_CONFIG.rewardedUnitId,
    appOpenUnitId: config?.admobAppOpenUnitId || REAL_ADMOB_CONFIG.bannerUnitId,
    nativeUnitId: config?.admobNativeUnitId || REAL_ADMOB_CONFIG.bannerUnitId,
    isTesting: false,
  };
}

export function isNativeAndroidAdMobAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const hasCapacitor = Boolean(
    window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.AdMob
  );
  const hasAndroidBridge = Boolean(window.SuzikaAndroidAds);
  return hasCapacitor || hasAndroidBridge;
}

export async function syncAdMobConfig(config?: AppBannerConfig): Promise<void> {
  if (typeof window === 'undefined') return;
  const ids = getActiveAdMobIds(config);

  // Sync to Flutter/Android native WebView JavascriptInterface if present
  if (window.SuzikaAndroidAds?.syncConfig) {
    try {
      window.SuzikaAndroidAds.syncConfig(
        JSON.stringify({
          ...ids,
          enableBanner: config?.enableAndroidBanner !== false,
          enableInterstitial: config?.enableAndroidInterstitial !== false,
          enableRewarded: config?.enableAndroidRewarded !== false,
          enableAppOpen: Boolean(config?.enableAndroidAppOpen),
          enableNative: config?.enableAndroidNative !== false,
          interstitialFrequency: config?.interstitialFrequency ?? 5,
        })
      );
    } catch {}
  }

  // Initialize Capacitor AdMob SDK if running inside native Capacitor APK
  const admob = window.Capacitor?.Plugins?.AdMob;
  if (!admob || !window.Capacitor?.isNativePlatform?.()) return;

  try {
    if (!isCapacitorAdMobInitialized && admob.initialize) {
      await admob.initialize({
        initializeForTesting: ids.isTesting,
      });
      isCapacitorAdMobInitialized = true;
    }

    // Show bottom adaptive banner safely if enabled
    if (config?.enableAndroidBanner !== false && admob.showBanner && !isBannerVisible) {
      await admob.showBanner({
        adId: ids.bannerUnitId,
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 64, // Clear bottom navigation bar so controls are never covered
        isTesting: ids.isTesting,
      });
      isBannerVisible = true;
    } else if (config?.enableAndroidBanner === false && admob.hideBanner && isBannerVisible) {
      await admob.hideBanner();
      isBannerVisible = false;
    }

    // Preload next Interstitial & Rewarded Ad silently
    if (config?.enableAndroidInterstitial !== false && admob.prepareInterstitial) {
      admob.prepareInterstitial({
        adId: ids.interstitialUnitId,
        isTesting: ids.isTesting,
      }).catch(() => {});
    }

    if (config?.enableAndroidRewarded !== false && admob.prepareRewardVideoAd) {
      admob.prepareRewardVideoAd({
        adId: ids.rewardedUnitId,
        isTesting: ids.isTesting,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Capacitor AdMob sync notice:', err);
  }
}

export function showAppOpenAdIfEnabled(config?: AppBannerConfig): void {
  if (typeof window === 'undefined') return;
  if (!config?.enableAndroidAppOpen) return;

  const now = Date.now();
  if (now - lastAppOpenTimestamp < APP_OPEN_COOLDOWN_MS) return;

  if (window.SuzikaAndroidAds?.showAppOpen) {
    lastAppOpenTimestamp = now;
    try {
      window.SuzikaAndroidAds.showAppOpen();
    } catch {}
  }
}

/**
 * Track photo/video opens/closes and trigger native AdMob Interstitial every N (3-10) transitions
 * at natural break moments (never interrupting active video playback).
 */
export async function trackMediaViewAndMaybeShowInterstitial(config?: AppBannerConfig): Promise<void> {
  if (typeof window === 'undefined') return;
  if (config?.enableAndroidInterstitial === false) return;

  const threshold = Math.max(3, Math.min(10, Number(config?.interstitialFrequency || 5)));
  const cooldownMs = threshold <= 3 ? 30000 : 45000;
  mediaViewCounter += 1;

  if (mediaViewCounter < threshold) return;

  const now = Date.now();
  if (now - lastInterstitialTimestamp < cooldownMs) {
    return;
  }

  mediaViewCounter = 0;
  lastInterstitialTimestamp = now;

  // 1. Android WebView native bridge
  if (window.SuzikaAndroidAds?.showInterstitial) {
    try {
      window.SuzikaAndroidAds.showInterstitial();
      return;
    } catch {}
  }

  // 2. Capacitor AdMob SDK
  const admob = window.Capacitor?.Plugins?.AdMob;
  if (admob && window.Capacitor?.isNativePlatform?.() && admob.showInterstitial) {
    const ids = getActiveAdMobIds(config);
    try {
      await admob.showInterstitial();
    } catch {
      // Fail safely and preload for next natural break
    } finally {
      admob.prepareInterstitial?.({
        adId: ids.interstitialUnitId,
        isTesting: ids.isTesting,
      }).catch(() => {});
    }
  }
}

/**
 * Trigger native Android AdMob Interstitial directly for the timed (5-minute) break.
 * Returns true if native ad handled it, false if web browser should display the full-screen modal.
 */
export async function triggerTimedNativeInterstitial(config?: AppBannerConfig): Promise<boolean> {
  if (typeof window === 'undefined' || !isNativeAndroidAdMobAvailable()) return false;
  if (config?.enableAndroidInterstitial === false) return true;

  lastInterstitialTimestamp = Date.now();
  mediaViewCounter = 0;

  if (window.SuzikaAndroidAds?.showInterstitial) {
    try {
      window.SuzikaAndroidAds.showInterstitial();
      return true;
    } catch {}
  }

  const admob = window.Capacitor?.Plugins?.AdMob;
  if (admob && window.Capacitor?.isNativePlatform?.() && admob.showInterstitial) {
    const ids = getActiveAdMobIds(config);
    try {
      await admob.showInterstitial();
    } catch {} finally {
      admob.prepareInterstitial?.({
        adId: ids.interstitialUnitId,
        isTesting: ids.isTesting,
      }).catch(() => {});
    }
    return true;
  }

  return false;
}

/**
 * Trigger native Android AdMob Interstitial immediately (e.g. gallery photo or video play break).
 * Returns true if native ad handled it, false on regular web browsers.
 */
export async function showImmediateNativeInterstitial(config?: AppBannerConfig): Promise<boolean> {
  return triggerTimedNativeInterstitial(config);
}

/**
 * Show native Android AdMob Rewarded Ad when running inside APK.
 * Returns 'web_fallback' when running inside a regular browser so UI handles web cleanly.
 */
export async function showNativeRewardedAd(
  config?: AppBannerConfig
): Promise<'rewarded' | 'dismissed' | 'unavailable' | 'web_fallback'> {
  if (typeof window === 'undefined') return 'web_fallback';

  // 1. Capacitor native APK
  const admob = window.Capacitor?.Plugins?.AdMob;
  if (admob && window.Capacitor?.isNativePlatform?.()) {
    const ids = getActiveAdMobIds(config);
    try {
      if (admob.prepareRewardVideoAd) {
        await admob.prepareRewardVideoAd({
          adId: ids.rewardedUnitId,
          isTesting: ids.isTesting,
        });
      }
      if (admob.showRewardVideoAd) {
        const reward = await admob.showRewardVideoAd();
        // Preload next rewarded ad
        admob.prepareRewardVideoAd?.({
          adId: ids.rewardedUnitId,
          isTesting: ids.isTesting,
        }).catch(() => {});
        return reward !== undefined ? 'rewarded' : 'dismissed';
      }
    } catch {
      return 'unavailable';
    }
  }

  // 2. Flutter / Android WebView bridge
  if (window.SuzikaAndroidAds?.showRewarded) {
    return new Promise((resolve) => {
      const cbId = `rew_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      window.__suzikaAdCallbacks = window.__suzikaAdCallbacks || {};
      const timeout = setTimeout(() => {
        delete window.__suzikaAdCallbacks?.[cbId];
        resolve('unavailable');
      }, 65000);

      window.__suzikaAdCallbacks[cbId] = (status) => {
        clearTimeout(timeout);
        delete window.__suzikaAdCallbacks?.[cbId];
        resolve(status);
      };

      try {
        window.SuzikaAndroidAds!.showRewarded!(cbId);
      } catch {
        clearTimeout(timeout);
        delete window.__suzikaAdCallbacks?.[cbId];
        resolve('unavailable');
      }
    });
  }

  return 'web_fallback';
}
