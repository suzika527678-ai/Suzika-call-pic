import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Clock, Play, Smartphone, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { AppBannerConfig } from '../types';
import { GoogleAdSlot } from './GoogleAdSlot';
import { soundFX } from '../utils/audio';

interface TimedFullscreenAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  bannerConfig?: AppBannerConfig;
}

const isDirectVideoFile = (url: string) =>
  /\.(mp4|webm|m4v|mov)(\?.*)?$/i.test(url.trim());

export const TimedFullscreenAdModal: React.FC<TimedFullscreenAdModalProps> = ({
  isOpen,
  onClose,
  bannerConfig,
}) => {
  const skipDelay = Math.max(3, Math.min(15, Number(bannerConfig?.adSkipAfterSeconds ?? 5)));
  const totalSeconds = 15;

  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(true);
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>('');
  const [vastClickUrl, setVastClickUrl] = useState<string>('');
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const rawVideoAdUrl = (bannerConfig?.webVideoAdUrl || '').trim();
  const smartLinkUrl = (bannerConfig?.webSmartLinkUrl || bannerConfig?.webBannerClickUrl || '').trim();
  const activeClickUrl = (vastClickUrl || smartLinkUrl).trim();
  const hasClickUrl = Boolean(activeClickUrl && activeClickUrl.startsWith('http'));

  // Resolve Direct MP4 or Adsterra VAST XML Tag URL safely
  useEffect(() => {
    if (!isOpen) {
      setElapsed(0);
      setResolvedVideoSrc('');
      setVastClickUrl('');
      setVideoFailed(false);
      return;
    }

    let cancelled = false;
    setElapsed(0);
    setVideoFailed(false);

    if (!rawVideoAdUrl || !rawVideoAdUrl.startsWith('http')) {
      setResolvedVideoSrc('');
      setVastClickUrl('');
      return;
    }

    if (isDirectVideoFile(rawVideoAdUrl)) {
      setResolvedVideoSrc(rawVideoAdUrl);
      return;
    }

    // Attempt to resolve VAST XML tag (Adsterra / VAST 2.0-4.0)
    const controller = new AbortController();
    const abortTimeout = window.setTimeout(() => controller.abort(), 4500);

    fetch(rawVideoAdUrl, { signal: controller.signal })
      .then((res) => res.text())
      .then((xmlText) => {
        if (cancelled) return;
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const mediaFiles = Array.from(doc.getElementsByTagName('MediaFile'));
        const mp4Node =
          mediaFiles.find((n) => (n.getAttribute('type') || '').toLowerCase().includes('mp4')) ||
          mediaFiles[0];
        const mediaSrc = mp4Node?.textContent?.trim() || '';
        const clickNode = doc.getElementsByTagName('ClickThrough')[0];
        const clickHref = clickNode?.textContent?.trim() || '';

        if (mediaSrc && mediaSrc.startsWith('http')) {
          setResolvedVideoSrc(mediaSrc);
          if (clickHref && clickHref.startsWith('http')) {
            setVastClickUrl(clickHref);
          }
        } else {
          setVideoFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // CORS or non-VAST URL: gracefully fall back to Sponsor Interstitial screen
          setVideoFailed(true);
        }
      })
      .finally(() => {
        window.clearTimeout(abortTimeout);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(abortTimeout);
      controller.abort();
    };
  }, [isOpen, rawVideoAdUrl]);

  // Countdown tick while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => {
      setElapsed((prev) => (prev < totalSeconds ? prev + 1 : prev));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const canSkip = elapsed >= skipDelay;
  const skipRemaining = Math.max(0, skipDelay - elapsed);
  const progressPct = Math.min(100, Math.round((elapsed / totalSeconds) * 100));
  const showRealVideo = Boolean(resolvedVideoSrc && !videoFailed);

  const handleSkipOrClose = () => {
    if (!canSkip) return;
    soundFX.playPop();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[310] bg-[#070911]/98 backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Full-Screen Sponsored Break"
    >
      {/* Top Bar */}
      <div className="px-4 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-white">Sponsored Video Ad</span>
          <span aria-hidden="true" className="text-[#7e859b]">·</span>
          <span className="text-[11px] text-[#9da4b8] inline-flex items-center gap-1 tabular-nums">
            <Clock className="w-3 h-3 text-[#ff35bb]" />
            <span>{bannerConfig?.timedAdIntervalMinutes ?? 5} min break</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showRealVideo && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute ad video' : 'Mute ad video'}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            disabled={!canSkip}
            onClick={handleSkipOrClose}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              canSkip
                ? 'bg-white text-black hover:bg-white/90 cursor-pointer shadow-lg'
                : 'bg-white/10 text-[#9da4b8] border border-white/10 cursor-not-allowed'
            }`}
          >
            {canSkip ? (
              <>
                <span>Skip Ad</span>
                <X className="w-3.5 h-3.5" />
              </>
            ) : (
              <span className="tabular-nums">Skip in {skipRemaining}s</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Full-Screen Ad Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-xl mx-auto overflow-y-auto">
        {showRealVideo ? (
          <div className="w-full space-y-4">
            <div className="relative w-full aspect-[9/12] sm:aspect-video max-h-[65vh] rounded-3xl overflow-hidden bg-black border border-[#2a314d] shadow-2xl">
              <video
                ref={videoRef}
                src={resolvedVideoSrc}
                autoPlay
                playsInline
                muted={muted}
                loop
                onEnded={() => setElapsed(totalSeconds)}
                onError={() => setVideoFailed(true)}
                className="w-full h-full object-contain bg-black"
              />

              {hasClickUrl && (
                <a
                  href={activeClickUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="absolute bottom-4 right-4 min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold shadow-xl flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all"
                >
                  <span>অফার দেখুন (Visit Sponsor)</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full rounded-3xl bg-[#111524] border border-[#2a314d] p-5 sm:p-6 space-y-5 shadow-2xl text-center">
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-[#9da4b8]">
                Sponsored Break · Adsterra &amp; Google Network
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white text-balance">
                SUZIKA Call Pic স্পনসরড বিরতি
              </h3>
              <p className="text-xs text-[#9da4b8] max-w-md mx-auto leading-relaxed">
                {hasClickUrl
                  ? 'নিচের স্পনসর বাটনে ক্লিক করে বিশেষ ভিডিও ও পার্টনার অফার দেখুন অথবা কাউন্টডাউন শেষে গ্যালারিতে ফিরে যান।'
                  : 'আপনি অ্যাপটি উপভোগ করছেন! কয়েক সেকেন্ড পর আবার ব্রাউজিং চালিয়ে যেতে পারবেন।'}
              </p>
            </div>

            {/* Embed Rectangle / In-Feed Banner (Adsterra 300x250 or AdSense or Direct Image) */}
            <GoogleAdSlot
              slotName="timed-fullscreen-break"
              format="rectangle"
              config={bannerConfig}
              className="!my-0"
              title="Adsterra Partner Video & Gallery"
              subtitle="এক্সক্লুসিভ ভিডিও ও অফার দেখতে ক্লিক করুন"
              ctaText="ভিডিও দেখুন"
            />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
              {hasClickUrl && (
                <a
                  href={activeClickUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-bold shadow-lg shadow-[#ff35bb]/25 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>স্পনসরড ভিডিও / অফার দেখুন</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              )}

              {bannerConfig?.mobileAppInstallUrl && bannerConfig.mobileAppInstallUrl.trim() !== '' && (
                <a
                  href={bannerConfig.mobileAppInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#181e34] hover:bg-[#212947] border border-[#2f3961] text-[#00d2ff] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Android APK ডাউনলোড</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Progress & Return Action */}
      <div className="px-4 pb-5 pt-3 bg-gradient-to-t from-black via-black/80 to-transparent max-w-xl w-full mx-auto space-y-3">
        <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#ff35bb]" />
            <span>{canSkip ? 'এখন বিজ্ঞাপনটি বন্ধ করতে পারবেন' : `স্কিপ আনলক হচ্ছে (${skipRemaining}s)...`}</span>
          </span>
          {canSkip && (
            <button
              type="button"
              onClick={handleSkipOrClose}
              className="text-white font-bold hover:underline"
            >
              Continue to App →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
