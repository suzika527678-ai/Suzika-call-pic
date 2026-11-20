import React, { useState, useEffect, useRef } from 'react';
import { X, Award, ShieldCheck, Play, CheckCircle2, AlertCircle, Sparkles, Smartphone } from 'lucide-react';
import { soundFX } from '../utils/audio';
import { recordMediaUnlocked } from '../utils/unlockStore';
import { showNativeRewardedAd } from '../utils/admobBridge';
import { REAL_ADMOB_CONFIG, TEST_ADMOB_CONFIG } from '../data/initialData';
import { AppBannerConfig } from '../types';
import { GoogleAdSlot } from './GoogleAdSlot';

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle: string;
  mediaType: 'photo' | 'video';
  purpose?: 'unlock' | 'download';
  onRewardEarned: () => void;
  bannerConfig?: AppBannerConfig;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  onClose,
  mediaId,
  mediaTitle,
  mediaType,
  purpose = 'unlock',
  onRewardEarned,
  bannerConfig,
}) => {
  const [adState, setAdState] = useState<'loading' | 'ready' | 'playing' | 'rewarded' | 'no_ad'>('loading');
  const totalAdSeconds = bannerConfig?.adDurationSeconds && bannerConfig.adDurationSeconds >= 10
    ? bannerConfig.adDurationSeconds
    : 30;
  const [secondsRemaining, setSecondsRemaining] = useState(totalAdSeconds);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const hasRewardFiredRef = useRef(false);

  // Reset and prepare ad when modal opens
  useEffect(() => {
    if (!isOpen) {
      setAdState('loading');
      setSecondsRemaining(totalAdSeconds);
      setShowExitConfirm(false);
      hasRewardFiredRef.current = false;
      return;
    }

    let cancelled = false;
    hasRewardFiredRef.current = false;

    const prepareAndRunAd = async () => {
      // If running inside native Android APK (Capacitor / Flutter WebView), launch real Google Mobile Ads SDK RewardedAd
      const nativeResult = await showNativeRewardedAd(bannerConfig);
      if (cancelled) return;

      if (nativeResult === 'rewarded') {
        if (!hasRewardFiredRef.current) {
          hasRewardFiredRef.current = true;
          soundFX.playSuccess();
          if (purpose === 'unlock') {
            recordMediaUnlocked(mediaId, mediaType, bannerConfig?.unlockDurationHours ?? 24);
          }
          onRewardEarned();
          onClose();
        }
        return;
      }

      if (nativeResult === 'unavailable') {
        setAdState('no_ad');
        return;
      }

      if (nativeResult === 'dismissed') {
        onClose();
        return;
      }

      // Standard Web Browser fallback lifecycle
      if (purpose === 'unlock') {
        setAdState('playing');
        setSecondsRemaining(totalAdSeconds);
        soundFX.playPop();
      } else {
        setAdState('ready');
        soundFX.playPop();
      }
    };

    const loadTimer = setTimeout(() => {
      prepareAndRunAd();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
    };
  }, [isOpen, purpose]);

  // Handle countdown during ad playback
  useEffect(() => {
    if (adState !== 'playing') return;

    if (secondsRemaining <= 0) {
      // Reward granted! Prevent duplicate callbacks (Rule 7)
      if (hasRewardFiredRef.current) return;
      hasRewardFiredRef.current = true;

      soundFX.playSuccess();

      if (purpose === 'unlock') {
        const durationHours = bannerConfig?.unlockDurationHours ?? 24;
        recordMediaUnlocked(mediaId, mediaType, durationHours);
      }

      // Trigger reward callback to unblur/download immediately
      onRewardEarned();

      // "ad ses holei seen hobe": Close modal immediately with zero delay
      // so the unblurred content or video/photo is seen instantly on screen!
      onClose();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [adState, secondsRemaining, mediaId, mediaType, bannerConfig, onRewardEarned, purpose]);

  if (!isOpen) return null;

  const handleStartAd = () => {
    soundFX.playPop();
    setAdState('playing');
    setSecondsRemaining(totalAdSeconds);
  };

  const handleAttemptClose = () => {
    soundFX.playPop();
    if (adState === 'rewarded' || adState === 'no_ad' || adState === 'loading') {
      onClose();
      return;
    }

    if (adState === 'playing') {
      // RULE 5: Never unlock content just because an ad was opened or skipped!
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExitWithoutReward = () => {
    soundFX.playPop();
    setShowExitConfirm(false);
    onClose();
  };

  const isTestMode = bannerConfig?.isTestMode === true;
  const activeUnitId = isTestMode
    ? TEST_ADMOB_CONFIG.rewardedUnitId
    : (bannerConfig?.admobRewardedUnitId || REAL_ADMOB_CONFIG.rewardedUnitId);

  return (
    <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-200">
      {/* Top Bar: Official AdMob Disclosure & Controls */}
      <div className="p-3.5 bg-gradient-to-b from-black via-black/80 to-transparent flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold flex items-center gap-1 border ${
            isTestMode
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
          }`}>
            <Award className={`w-3 h-3 ${isTestMode ? 'text-amber-400' : 'text-emerald-400'}`} />
            {isTestMode ? 'AdMob Rewarded Test' : 'Google AdMob Rewarded'}
          </span>
          <span className="text-[11px] text-[#9da4b8] hidden sm:inline">
            Unit: {activeUnitId}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAttemptClose}
            className="w-8 h-8 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
            title="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative max-w-lg mx-auto w-full">
        {/* State 1: Loading */}
        {adState === 'loading' && (
          <div className="text-center space-y-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#ff35bb]/15 border border-[#ff35bb]/30 flex items-center justify-center mx-auto text-[#ff35bb] animate-spin">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Google AdMob বিজ্ঞাপন লোড হচ্ছে...</h3>
              <p className="text-xs text-[#9da4b8]">
                স্লট আনলক করতে রিওয়ার্ডেড ভিডিও প্রস্তুত হচ্ছে
              </p>
            </div>
          </div>
        )}

        {/* State 2: Ready to Play */}
        {adState === 'ready' && (
          <div className="w-full bg-[#111524] border border-[#ff35bb]/30 rounded-3xl p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff35bb]/20 to-[#8b4dff]/20 border border-[#ff35bb]/40 flex items-center justify-center mx-auto text-[#ff35bb]">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">
                {purpose === 'download'
                  ? 'Watch a short ad to download this photo'
                  : mediaType === 'video'
                  ? 'ভিডিও আনলক করতে বিজ্ঞাপন দেখুন'
                  : 'ছবি আনলক করতে বিজ্ঞাপন দেখুন'}
              </h3>
              <p className="text-xs text-[#9da4b8]">
                &ldquo;<span className="text-white font-medium">{mediaTitle}</span>&rdquo; {purpose === 'download' ? 'হাই-রেজ্যুলুশন (Full-HD) ছবি ডাউনলোড করতে একটি ছোট বিজ্ঞাপন দেখুন।' : 'আনলক করতে একটি সম্পূর্ণ রিওয়ার্ডেড বিজ্ঞাপন দেখা প্রয়োজন।'}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[#080a12] border border-[#252a3d] text-left text-xs space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Google AdMob Rewarded Ad পলিসি:</span>
              </div>
              <ul className="text-[11px] text-[#9da4b8] space-y-1 pl-5 list-disc">
                <li>বিজ্ঞাপনটি সম্পূর্ণ দেখার পরই {purpose === 'download' ? 'ছবি ডাউনলোড শুরু হবে।' : 'স্বয়ংক্রিয়ভাবে কন্টেন্ট আনলক হবে।'}</li>
                <li>মাঝপথে বিজ্ঞাপন কেটে দিলে বা স্কিপ করলে ডাউনলোড হবে না।</li>
                <li>কোনো ফেক বা ডুপ্লিকেট রিওয়ার্ড প্রদান করা হয় না।</li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleStartAd}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:opacity-95 active:scale-95 text-white font-bold text-sm shadow-xl shadow-[#ff35bb]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{purpose === 'download' ? 'Watch Ad & Download' : 'বিজ্ঞাপন শুরু করুন (Watch Ad Now)'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#1b2138] hover:bg-[#252d4c] text-[#9da4b8] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* State 3: Active Web Sponsored / Google AdSense View with Countdown */}
        {adState === 'playing' && (
          <div className="w-full rounded-3xl overflow-hidden relative border border-[#ff35bb]/40 shadow-2xl bg-gradient-to-b from-[#13172b] via-[#0c1020] to-[#080a12] p-4 sm:p-5 space-y-4">
            {/* Top Status Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="px-3 py-1.5 rounded-full bg-black/80 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg">
                <Award className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>আনলক হতে বাকি: {secondsRemaining}s</span>
              </div>

              <div className="px-2.5 py-1 rounded-full bg-black/80 border border-[#ff35bb]/40 text-[#ff80d5] text-[11px] font-bold">
                <span>{totalAdSeconds}s Ad Timer</span>
              </div>
            </div>

            {/* Real Google AdSense Web Container (In Android APK, native AdMob RewardedAd runs full-screen before this) */}
            <div className="min-h-[250px] flex flex-col items-center justify-center rounded-2xl bg-[#090c17] border border-[#252a3d] p-3 space-y-3">
              <GoogleAdSlot
                slotName={`rewarded-web-${mediaId}`}
                format="banner"
                config={bannerConfig}
                className="!my-0 w-full"
              />

              {bannerConfig?.webSmartLinkUrl && bannerConfig.webSmartLinkUrl.startsWith('http') && (
                <a
                  href={bannerConfig.webSmartLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-extrabold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>স্পনসরড অফার দেখুন (Sponsored Offer)</span>
                </a>
              )}

              <div className="text-center space-y-1 px-2">
                <p className="text-xs font-bold text-white truncate max-w-xs mx-auto">
                  {mediaTitle}
                </p>
                <p className="text-[11px] text-[#9da4b8] leading-relaxed">
                  {purpose === 'download'
                    ? 'সময় শেষ হলেই ফুল-এইচডি ডাউনলোড শুরু হবে।'
                    : `সময় শেষ হলেই কন্টেন্টটি ${(bannerConfig?.unlockDurationHours ?? 12) === 0 ? 'স্থায়ীভাবে' : `${bannerConfig?.unlockDurationHours ?? 12} ঘণ্টার জন্য`} আনলক হয়ে যাবে।`}
                </p>
              </div>

              {bannerConfig?.mobileAppInstallUrl && (
                <a
                  href={bannerConfig.mobileAppInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161b30] hover:bg-[#1e2542] border border-[#00d2ff]/30 text-[#00d2ff] text-[11px] font-bold transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Android APK ইনস্টল করলে দ্রুত ভিডিও দেখুন</span>
                </a>
              )}
            </div>

            {/* Linear Countdown Bar */}
            <div className="space-y-2">
              <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#ffd700] transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min(100, Math.max(0, ((totalAdSeconds - secondsRemaining) / totalAdSeconds) * 100))}%` }}
                />
              </div>

              <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold shrink-0">SPONSORED</span>
                  <span className="truncate text-xs font-medium">
                    {isTestMode ? 'Google Ad Test Mode' : 'Google AdSense / AdMob'}
                  </span>
                </div>
                <span className={`text-[10px] font-bold shrink-0 ${isTestMode ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {isTestMode ? 'Test Mode' : 'Production Unit'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* State 4: Rewarded & Unlocked/Downloaded! */}
        {adState === 'rewarded' && (
          <div className="w-full bg-[#111524] border border-emerald-500/40 rounded-3xl p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white">
                {purpose === 'download' ? 'Reward Earned! Photo Download Started 🎉' : 'অভিনন্দন! কন্টেন্ট আনলক হয়েছে 🎉'}
              </h3>
              <p className="text-xs text-[#9da4b8]">
                &ldquo;<span className="text-white font-medium">{mediaTitle}</span>&rdquo; {purpose === 'download' ? 'এর আসল ফুল রেজ্যুলুশন ফাইলটি ডাউনলোড করা হয়েছে।' : 'সফলভাবে আনলক হয়েছে। এখন আপনি সম্পূর্ণ কন্টেন্ট দেখতে পারবেন।'}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 flex items-center gap-2 justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{purpose === 'download' ? 'ডাউনলোড সম্পূর্ণ হয়েছে। চেক করুন আপনার ডিভাইস গ্যালারি।' : 'এই কন্টেন্টটি আপনার জন্য আনলক অবস্থায় সংরক্ষণ করা হয়েছে।'}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:opacity-95 active:scale-95 text-black font-extrabold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{purpose === 'download' ? 'ঠিক আছে (Done)' : 'এখনই উপভোগ করুন (Watch Content Now)'}</span>
            </button>
          </div>
        )}

        {/* State 5: Friendly No Ad Available (Rule 5 & Requirement 5) */}
        {adState === 'no_ad' && (
          <div className="w-full bg-[#111524] border border-amber-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Ad is not available right now. Please try again later.</h3>
              <p className="text-xs text-[#9da4b8]">
                বিজ্ঞাপন বর্তমানে প্রস্তুত নেই। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#1b2138] hover:bg-[#252d4c] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              OK (Close)
            </button>
          </div>
        )}
      </div>

      {/* Early Exit Confirmation Modal (Rule 5: Never unlock if skipped or closed early) */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-xs w-full bg-[#161a2b] border border-amber-500/40 rounded-2xl p-5 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">বিজ্ঞাপন বন্ধ করতে চান?</h4>
              <p className="text-xs text-[#9da4b8]">
                বিজ্ঞাপন সম্পূর্ণ না দেখলে কন্টেন্টটি লক থাকবে এবং কোনো রিওয়ার্ড যুক্ত হবে না।
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold"
              >
                দেখতে থাকুন
              </button>
              <button
                type="button"
                onClick={handleConfirmExitWithoutReward}
                className="flex-1 py-2 rounded-xl bg-[#252a3d] text-[#9da4b8] hover:text-white text-xs font-medium"
              >
                বের হয়ে যান
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info Notice: Native APK vs Web Preview Disclosure (Rule 12) */}
      <div className="p-3 text-center bg-black/60 border-t border-white/5 text-[11px] text-[#9da4b8]">
        <div className="flex items-center justify-center gap-1.5 text-xs text-[#c084fc] font-medium">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Android APK তে Google Mobile Ads SDK এর আসল Rewarded Ad রান হয়</span>
        </div>
      </div>
    </div>
  );
};
