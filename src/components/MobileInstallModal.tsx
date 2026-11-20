import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Share,
  Chrome,
} from 'lucide-react';
import { soundFX } from '../utils/audio';
import { AppBannerConfig } from '../types';
import {
  isValidRealApkUrl,
  resolveDirectApkDownloadUrl,
  isSameOriginLocalApkUrl,
  isInAppSocialBrowser,
  isAndroidMobileDevice,
  isIOSDevice,
  isStandaloneApp,
  getOpenInChromeIntentUrl,
} from '../utils/deviceDetection';
import { SuzikaLogo } from './SuzikaLogo';

interface MobileInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLater?: () => void;
  bannerConfig?: AppBannerConfig;
  deferredPrompt?: any;
  isPwaInstalled?: boolean;
  onTriggerPwaInstall?: () => Promise<boolean> | void;
}

export const MobileInstallModal: React.FC<MobileInstallModalProps> = ({
  isOpen,
  onClose,
  onLater,
  bannerConfig,
  deferredPrompt,
  isPwaInstalled = false,
  onTriggerPwaInstall,
}) => {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [showManualHomeGuide, setShowManualHomeGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [localApkCheck, setLocalApkCheck] = useState<{
    checked: boolean;
    exists: boolean;
    sizeBytes: number;
  }>({ checked: false, exists: true, sizeBytes: 0 });
  const [installSuccess, setInstallSuccess] = useState(false);
  const [guideHighlight, setGuideHighlight] = useState(false);
  const guideBoxRef = useRef<HTMLDivElement>(null);

  const rawApkUrl = bannerConfig?.mobileAppInstallUrl?.trim() || '';
  const hasRealApk = isValidRealApkUrl(rawApkUrl);
  const resolvedApkUrl = resolveDirectApkDownloadUrl(rawApkUrl);
  const isSameOriginLocal = isSameOriginLocalApkUrl(rawApkUrl);

  // Verify local /uploads/*.apk or /apk/*.apk actually exists on disk so users never hit a dead 404
  useEffect(() => {
    if (!isOpen || !hasRealApk || !isSameOriginLocal) {
      setLocalApkCheck({ checked: true, exists: true, sizeBytes: 0 });
      return;
    }

    let cancelled = false;
    setLocalApkCheck((prev) => ({ ...prev, checked: false }));

    fetch(`/api/apk-status?url=${encodeURIComponent(rawApkUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data.exists === 'boolean') {
          setLocalApkCheck({
            checked: true,
            exists: data.exists,
            sizeBytes: Number(data.sizeBytes) || 0,
          });
        } else {
          setLocalApkCheck({ checked: true, exists: true, sizeBytes: 0 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalApkCheck({ checked: true, exists: true, sizeBytes: 0 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, hasRealApk, isSameOriginLocal, rawApkUrl]);

  useEffect(() => {
    if (isPwaInstalled || isStandaloneApp()) {
      setInstallSuccess(true);
    }
  }, [isPwaInstalled]);

  if (!isOpen) return null;

  const isInAppBrowser = isInAppSocialBrowser();
  const isAndroid = isAndroidMobileDevice();
  const isIOS = isIOSDevice();
  const canDownloadApkFile = hasRealApk && (!isSameOriginLocal || localApkCheck.exists);
  const isDirectApkExtension =
    /\.apk(\?.*)?$/i.test(resolvedApkUrl) || isSameOriginLocal;
  const formattedApkSize =
    localApkCheck.sizeBytes > 0
      ? `${(localApkCheck.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : '';

  const appName = bannerConfig?.apkPopupTitle?.trim() || 'SUZIKA Call Pic';
  const configuredVersion = bannerConfig?.mobileAppVersion?.trim() || '';
  const appVersion = canDownloadApkFile
    ? configuredVersion || 'v2.4 · Android APK'
    : 'Official Web App (PWA)';
  const popupMessage =
    bannerConfig?.apkPopupMessage?.trim() ||
    'আপনার ফোনে SUZIKA Call Pic অফিশিয়াল অ্যাপ ইনস্টল করুন! দ্রুততম HD ছবি, ফুল-স্ক্রিন ভিডিও রিলস এবং স্মুথ মোবাইল অভিজ্ঞতা উপভোগ করুন।';

  const handleCloseAction = () => {
    soundFX.playPop();
    onClose();
  };

  const handleLaterAction = () => {
    soundFX.playPop();
    if (onLater) {
      onLater();
    } else {
      onClose();
    }
  };

  const handleCopyCurrentUrl = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLink(true);
      soundFX.playSuccess();
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      soundFX.playPop();
    }
  };

  const handleApkDownloadClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    setDownloadError('');
    soundFX.playSuccess();
    setDownloadStarted(true);

    // If same-origin file was deleted on server while modal was open, prevent broken navigation
    if (isSameOriginLocal && localApkCheck.checked && !localApkCheck.exists) {
      e.preventDefault();
      setDownloadStarted(false);
      setDownloadError('সার্ভারে APK ফাইলটি পাওয়া যায়নি। নিচ থেকে ১-ক্লিকে ওয়েব অ্যাপ ইনস্টল করুন।');
      return;
    }

    // For same-origin .apk, verify via HEAD first ONLY silently on background or let native browser download handle Content-Disposition: attachment
    if (isSameOriginLocal) {
      try {
        const headRes = await fetch(resolvedApkUrl, { method: 'HEAD' });
        if (!headRes.ok) {
          setDownloadError('ডাউনলোড লিংকে সমস্যা পাওয়া গেছে। ওয়েব অ্যাপ হিসেবে সরাসরি ইনস্টল করুন।');
        }
      } catch {
        // Ignore network head errors and allow browser download manager to handle
      }
    }
  };

  const handlePwaInstallClick = async () => {
    soundFX.playSuccess();
    const promptEvt =
      deferredPrompt ||
      (typeof window !== 'undefined' ? (window as any).__suzikaDeferredInstallPrompt : null);

    if (promptEvt && onTriggerPwaInstall) {
      const accepted = await onTriggerPwaInstall();
      if (accepted) {
        setInstallSuccess(true);
        return;
      }
    }

    setShowManualHomeGuide(true);
    setGuideHighlight(true);
    guideBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => setGuideHighlight(false), 1800);
  };

  const currentOriginHref =
    typeof window !== 'undefined' ? window.location.href : '/';
  const isIframeEnv =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
  const publicUserAppUrl = (() => {
    const configured = bannerConfig?.customShareUrl?.trim();
    if (configured && configured.startsWith('http') && !configured.includes('ais-dev-')) {
      return configured;
    }
    if (currentOriginHref.includes('ais-dev-')) {
      return currentOriginHref.replace('ais-dev-', 'ais-pre-');
    }
    return currentOriginHref;
  })();
  const chromeIntentUrl = getOpenInChromeIntentUrl(publicUserAppUrl);

  return (
    <div
      className="fixed inset-0 z-50 w-full max-w-[100vw] overflow-x-hidden flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/82 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleCloseAction}
    >
      <div
        className="w-full max-w-[calc(100vw-1rem)] sm:max-w-md mx-auto bg-gradient-to-b from-[#151932] via-[#0e1222] to-[#080b14] border border-[#ff35bb]/35 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(255,53,187,0.3)] flex flex-col relative max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glowing Brand Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] shrink-0" />

        {/* Top Badge + Close Button */}
        <div className="absolute top-3.5 left-3.5 right-3.5 z-10 flex items-center justify-between pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-bold text-emerald-300 backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Official App</span>
          </span>

          <button
            type="button"
            onClick={handleCloseAction}
            aria-label="Close"
            title="বন্ধ করুন (Close)"
            className="pointer-events-auto w-8 h-8 rounded-full bg-[#1a2035]/95 hover:bg-[#273052] border border-[#323b5e] text-[#c2cae2] hover:text-white flex items-center justify-center transition-all active:scale-95 shadow"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 pt-11 overflow-y-auto overflow-x-hidden space-y-3.5 min-w-0">
          {/* App Identity: SUZIKA Call Pic Logo + Name */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="absolute -inset-2.5 rounded-3xl bg-gradient-to-tr from-[#ff35bb]/45 via-[#8b4dff]/40 to-[#00d2ff]/45 blur-xl opacity-85" />
              <SuzikaLogo size="xl" className="relative shadow-2xl" />
              <span className="absolute -bottom-1.5 -right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-[#00d2ff] text-black text-[9px] font-black tracking-wide uppercase shadow-md">
                {canDownloadApkFile ? 'APK' : 'APP'}
              </span>
            </div>

            <h3 className="font-display font-black text-xl sm:text-2xl text-white tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff35bb] via-[#c084fc] to-[#00d2ff]">
                SUZIKA
              </span>{' '}
              {appName.replace(/^SUZIKA\s*/i, '') || 'Call Pic'}
            </h3>

            <div className="mt-1.5 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#192038] border border-[#2d3659] text-[10px] sm:text-[11px] font-semibold text-[#00d2ff]">
                <Smartphone className="w-3 h-3 shrink-0" />
                <span>{formattedApkSize ? `${appVersion} · ${formattedApkSize}` : appVersion}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] sm:text-[11px] font-semibold text-emerald-400">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>Verified & Safe</span>
              </span>
            </div>
          </div>

          {/* 3 Mini Feature Highlights */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
            <div className="p-1.5 sm:p-2 rounded-2xl bg-[#11162b] border border-[#252d4a] min-w-0">
              <div className="text-sm mb-0.5">⚡</div>
              <div className="text-[10px] font-bold text-white truncate">সুপার ফাস্ট</div>
              <div className="text-[9px] text-[#9da4b8] truncate">HD স্ট্রিমিং</div>
            </div>
            <div className="p-1.5 sm:p-2 rounded-2xl bg-[#11162b] border border-[#252d4a] min-w-0">
              <div className="text-sm mb-0.5">🎬</div>
              <div className="text-[10px] font-bold text-white truncate">ভিডিও রিলস</div>
              <div className="text-[9px] text-[#9da4b8] truncate">ফুল-স্ক্রিন ভিউ</div>
            </div>
            <div className="p-1.5 sm:p-2 rounded-2xl bg-[#11162b] border border-[#252d4a] min-w-0">
              <div className="text-sm mb-0.5">📥</div>
              <div className="text-[10px] font-bold text-white truncate">১-ট্যাপ সেভ</div>
              <div className="text-[9px] text-[#9da4b8] truncate">অফলাইন গ্যালারি</div>
            </div>
          </div>

          {/* In-App WebView Warning (Facebook, Messenger, Instagram, Imo, WhatsApp) */}
          {isInAppBrowser && (
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-left space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Facebook / ইন-অ্যাপ ব্রাউজারে</strong> APK ডাউনলোড বা ইনস্টল আটকে যেতে পারে। নির্বিঘ্নে ইনস্টল করতে Google Chrome-এ খুলুন:
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAndroid && (
                  <a
                    href={chromeIntentUrl}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Chrome className="w-3.5 h-3.5" />
                    <span>Chrome ব্রাউজারে খুলুন</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyCurrentUrl(currentOriginHref)}
                  className="py-2 px-3 rounded-xl bg-[#1a2038] border border-amber-500/35 text-amber-200 font-bold text-[11px] flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Custom Admin Popup Message */}
          <div className="p-3.5 rounded-2xl bg-[#13182b]/95 border border-[#272f4d] text-center">
            <p className="text-xs sm:text-[13px] text-[#d5dcf0] leading-relaxed">
              {popupMessage}
            </p>
          </div>

          {/* PWA Install Success Banner */}
          {installSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-2.5 text-left animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-emerald-300">অ্যাপ সফলভাবে ইনস্টল হয়েছে!</p>
                <p className="text-[11px] text-emerald-200/85">
                  আপনার ফোনের হোমস্ক্রিনে SUZIKA Call Pic আইকন থেকে সরাসরি ওপেন করতে পারবেন।
                </p>
              </div>
            </div>
          )}

          {/* Missing Server APK Warning */}
          {hasRealApk && isSameOriginLocal && localApkCheck.checked && !localApkCheck.exists && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/35 flex items-start gap-2 text-left text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">APK ফাইল সাময়িকভাবে সার্ভারে নেই</p>
                <p className="text-[11px] text-amber-200/85">
                  কোনো সমস্যা নেই — নিচের বাটন থেকে ১-ক্লিকে হোমস্ক্রিন অ্যাপ হিসেবে সরাসরি ইনস্টল করুন।
                </p>
              </div>
            </div>
          )}

          {/* Download Error Banner */}
          {downloadError && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-start gap-2 text-left text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* Download Started Banner */}
          {downloadStarted && canDownloadApkFile && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-start gap-2.5 text-left animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 flex-1">
                <p className="font-bold text-emerald-300">APK ডাউনলোড শুরু হয়েছে!</p>
                <p className="text-[11px] text-emerald-200/85">
                  ডাউনলোড শেষ হলে ফোনের নোটিফিকেশন বার বা <strong>Files → Downloads</strong> থেকে{' '}
                  <strong>SUZIKA-Call-Pic.apk</strong>-তে ট্যাপ করে <strong>Install</strong> করুন।
                </p>
                <button
                  type="button"
                  onClick={() => handleCopyCurrentUrl(resolvedApkUrl)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00d2ff] hover:underline pt-0.5"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'ডাউনলোড লিংক কপি হয়েছে!' : 'ডাউনলোড না হলে ডাইরেক্ট লিংক কপি করুন'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {/* Primary Phone App (PWA) Install CTA — automatically adapts for Native Prompt, In-App WebView, or Preview Iframe */}
            {!installSuccess && (
              deferredPrompt ? (
                <button
                  type="button"
                  onClick={handlePwaInstallClick}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:brightness-110 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff35bb]/35 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 animate-bounce" />
                  <span>১-ক্লিকে হোম স্ক্রিনে অ্যাপ ইনস্টল করুন (Install)</span>
                </button>
              ) : isInAppBrowser && isAndroid ? (
                <a
                  href={chromeIntentUrl}
                  onClick={() => soundFX.playSuccess()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:brightness-110 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff35bb]/35 active:scale-[0.98] transition-all"
                >
                  <Chrome className="w-4 h-4" />
                  <span>Chrome-এ খুলে ফোনের হোম স্ক্রিনে নিন</span>
                </a>
              ) : isIframeEnv ? (
                <a
                  href={publicUserAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    soundFX.playSuccess();
                    setShowManualHomeGuide(true);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:brightness-110 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff35bb]/35 active:scale-[0.98] transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>ব্রাউজারে খুলে হোম স্ক্রিনে ইনস্টল করুন</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handlePwaInstallClick}
                  className="w-full py-3.5 px-3.5 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:brightness-110 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff35bb]/35 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>
                    {isIOS
                      ? 'iPhone হোমস্ক্রিনে ইনস্টলের নিয়ম দেখুন'
                      : 'হোম স্ক্রিনে অ্যাপ অ্যাড করার নিয়ম দেখুন (Install)'}
                  </span>
                </button>
              )
            )}

            {/* Optional Direct Android APK Download when Admin configured a real APK file */}
            {canDownloadApkFile && (
              <a
                href={resolvedApkUrl}
                download={isSameOriginLocal && isDirectApkExtension ? 'SUZIKA-Call-Pic.apk' : undefined}
                target={isSameOriginLocal && !isIframeEnv ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={handleApkDownloadClick}
                className="w-full py-3 px-4 rounded-2xl bg-[#19213c] hover:bg-[#232d52] text-[#00d2ff] font-bold text-xs flex items-center justify-center gap-2 border border-[#00d2ff]/35 active:scale-[0.98] transition-all"
              >
                <Download className="w-4 h-4" />
                <span>
                  {formattedApkSize
                    ? `অথবা Android APK ডাউনলোড (${formattedApkSize})`
                    : 'অথবা Android APK ডাউনলোড করুন'}
                </span>
                {!isSameOriginLocal && <ExternalLink className="w-3.5 h-3.5 opacity-85" />}
              </a>
            )}

            {/* Inline Home Screen Install Guide when browser native prompt isn't active yet or on iOS */}
            {!installSuccess && (showManualHomeGuide || isIOS || !deferredPrompt) && (
              <div
                ref={guideBoxRef}
                className={`p-3 rounded-2xl bg-[#0e1326] border text-[11px] text-[#d0daf5] space-y-2 animate-in fade-in text-left transition-all ${
                  guideHighlight
                    ? 'border-[#00d2ff] ring-2 ring-[#00d2ff]/60 shadow-lg shadow-[#00d2ff]/25'
                    : 'border-[#00d2ff]/35'
                }`}
              >
                <div className="font-bold text-[#00d2ff] flex items-center gap-1.5">
                  {isIOS ? <Share className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>
                    {isIOS
                      ? 'iPhone / Safari-তে অ্যাপ হিসেবে ইনস্টল করার নিয়ম:'
                      : isIframeEnv
                      ? 'প্রিভিউ বক্সের ভেতর সরাসরি ইনস্টল হয় না — নতুন ট্যাবে খুলুন:'
                      : 'ফোনের হোমস্ক্রিনে অ্যাপ আইকন যুক্ত করার সহজ উপায়:'}
                  </span>
                </div>
                {isIOS ? (
                  <>
                    <p>১. Safari ব্রাউজারের নিচে থাকা <strong>Share (□↑)</strong> বাটনে ট্যাপ করুন।</p>
                    <p>২. নিচে স্ক্রল করে <strong>&ldquo;Add to Home Screen&rdquo;</strong> চাপুন এবং <strong>Add</strong> দিন — ফোন স্ক্রিনে অ্যাপ চলে আসবে।</p>
                  </>
                ) : isIframeEnv ? (
                  <>
                    <p>১. উপরের <strong>&ldquo;ব্রাউজারে খুলে অ্যাপ ইনস্টল করুন&rdquo;</strong> বাটনে চাপুন বা লিংকটি ফোনের Chrome-এ ওপেন করুন।</p>
                    <p>২. নতুন ট্যাবে খোলার পর ব্রাউজারের মেনু (<strong>⋮</strong>) থেকে <strong>&ldquo;Add to Home screen / Install app&rdquo;</strong> চাপুন।</p>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5 leading-relaxed">
                      <p>১. আপনার ফোনের Chrome ব্রাউজারের একদম উপরের ডানদিকে <strong>⋮ (৩ ডট মেনু)</strong> চাপুন।</p>
                      <p>২. মেনু থেকে <strong>&ldquo;Add to Home screen&rdquo;</strong> চাপুন এবং <strong>&ldquo;Install&rdquo;</strong> (বা <strong>Add</strong>) চাপুন — ফোনের হোমস্ক্রিনে সরাসরি <strong>SUZIKA Call Pic</strong> আইকন চলে আসবে।</p>
                    </div>
                    {isAndroid && (
                      <a
                        href={chromeIntentUrl}
                        onClick={() => soundFX.playPop()}
                        className="mt-1.5 w-full py-2 px-3 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Chrome className="w-3.5 h-3.5 text-amber-300" />
                        <span>এটি অন্য ব্রাউজার হলে Chrome-এ খুলুন</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyCurrentUrl(publicUserAppUrl)}
                      className="mt-1 w-full py-1.5 px-3 rounded-xl bg-[#18213d] hover:bg-[#222f55] border border-[#00d2ff]/35 text-[#00d2ff] font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'লিংক কপি হয়েছে!' : 'Chrome-এ খোলার জন্য লিংক কপি করুন'}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Later / Close Button */}
            <button
              type="button"
              onClick={handleLaterAction}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#13182a] hover:bg-[#1c233c] text-[#a7b0ca] hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-[#252c47] active:scale-[0.98] transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{installSuccess ? 'বন্ধ করুন (Done)' : 'পরে ডাউনলোড করবো (Later)'}</span>
            </button>
          </div>

          {/* Simple Android APK Installation Steps (handles Unknown Sources + Play Protect cleanly) */}
          {canDownloadApkFile && (
            <div className="p-3.5 rounded-2xl bg-[#080b14] border border-[#20263d] space-y-2 text-xs text-left">
              <div className="font-bold text-white flex items-center gap-1.5 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>সহজ APK ইনস্টলেশন গাইড (কোনো সমস্যা ছাড়াই):</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-[#9da4b8]">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#ff35bb]/20 text-[#ff35bb] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span><strong>Download Official Android APK</strong> বাটনে ট্যাপ করুন ও ডাউনলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন।</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#8b4dff]/20 text-[#8b4dff] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>যদি <em>&ldquo;File might be harmful&rdquo;</em> দেখায় তবে <strong>Download anyway</strong> চাপুন, তারপর ফাইলটি ওপেন করুন।</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#00d2ff]/20 text-[#00d2ff] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>প্রথমবার ইনস্টলে <strong>Settings → Allow from this source</strong> অন করে <strong>Install</strong> চাপুন।</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
