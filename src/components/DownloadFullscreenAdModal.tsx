import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Clock, Download, Loader2, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import { AppBannerConfig } from '../types';
import {
  buildIsolatedAdsterraSrcDoc,
  fireVastTrackingUrls,
  isLikelyVastUrl,
  parseAdsterraTag,
  ResolvedVastCreative,
  resolveVastXml,
} from '../utils/adsterraTagParser';
import { isNativeAndroidAdMobAvailable, showImmediateNativeInterstitial } from '../utils/admobBridge';
import { soundFX } from '../utils/audio';

export const DEFAULT_SOCIAL_BAR_SCRIPT_URL =
  'https://bicea.org/14/093a72dbe61f55a96cba26f6e5414547';
const DEFAULT_ADSTERRA_300X250_KEY = '7582598bfa55ed10e25bb7bba1896fab';

// Adsterra Social Bar / Video Ad runs 10-15 seconds cleanly before auto-download
const AD_WAIT_SECONDS = 15;
const MIN_MANDATORY_AD_SECONDS = 10;

const isDirectVideoFile = (url: string) =>
  /\.(mp4|webm|m4v|mov)(\?.*)?$/i.test(url.trim());

interface DownloadFullscreenAdModalProps {
  isOpen: boolean;
  mediaTitle: string;
  mediaType: 'photo' | 'video';
  bannerConfig?: AppBannerConfig;
  onCompleteDownload: () => void;
  onCancel: () => void;
}

/**
 * Full-Screen Download Ad Modal:
 * Runs for 10-15 seconds before unlocking / auto-triggering download.
 * Priority:
 *  1. Native Android AdMob Interstitial (inside APK)
 *  2. Full-Screen Video Ad (VAST XML or direct MP4/WebM or Video Interstitial tag)
 *  3. Real Adsterra Social Bar + Live 300x250 Sponsored Ad (15s active timer, skip unlocks after 10s)
 */
export const DownloadFullscreenAdModal: React.FC<DownloadFullscreenAdModalProps> = ({
  isOpen,
  mediaTitle,
  mediaType,
  bannerConfig,
  onCompleteDownload,
  onCancel,
}) => {
  const instanceId = useId();
  const completedRef = useRef(false);
  const impressionFiredRef = useRef(false);

  const [stage, setStage] = useState<'loading' | 'video_vast' | 'video_direct' | 'video_iframe' | 'social_bar'>('loading');
  const [vastCreative, setVastCreative] = useState<ResolvedVastCreative | null>(null);
  const [directVideoSrc, setDirectVideoSrc] = useState('');
  const [iframeSrcDoc, setIframeSrcDoc] = useState('');
  const [muted, setMuted] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [countdown, setCountdown] = useState(AD_WAIT_SECONDS);
  const [displayAdBlocked, setDisplayAdBlocked] = useState(false);

  const socialBarScriptUrl = useMemo(() => {
    const configured = (bannerConfig?.webAdScriptUrl || '').trim();
    return configured.startsWith('https://') ? configured : DEFAULT_SOCIAL_BAR_SCRIPT_URL;
  }, [bannerConfig?.webAdScriptUrl]);

  const activeBannerKey = useMemo(() => {
    const cleaned = (bannerConfig?.adsterraBannerKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return cleaned || DEFAULT_ADSTERRA_300X250_KEY;
  }, [bannerConfig?.adsterraBannerKey]);

  const rawVideoTag = useMemo(() => {
    const primary = (bannerConfig?.videoPlayAdTagUrl || '').trim();
    if (primary) return primary;
    return (bannerConfig?.webVideoAdUrl || '').trim();
  }, [bannerConfig?.videoPlayAdTagUrl, bannerConfig?.webVideoAdUrl]);

  const parsedVideoTag = useMemo(
    () => parseAdsterraTag(rawVideoTag, socialBarScriptUrl),
    [rawVideoTag, socialBarScriptUrl]
  );

  // Renders real Adsterra 300x250 Ad + Social Bar inside isolated iframe so center box is always an active live ad
  const socialBarAndDisplayAdSrcDoc = useMemo(() => {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .ad-box {
        width: 300px;
        height: 250px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="ad-box">
      <script type="text/javascript">
        window.atOptions = {
          'key': '${activeBannerKey}',
          'format': 'iframe',
          'height': 250,
          'width': 300,
          'params': {}
        };
      </script>
      <script
        type="text/javascript"
        src="https://bicea.org/22/${activeBannerKey}"
        onerror="try{window.parent.postMessage({type:'suzika-download-ad-blocked',id:'${instanceId}'},'*')}catch(e){}"
      ></script>
    </div>
    <script
      data-cfasync="false"
      src="${socialBarScriptUrl}"
      onerror="try{window.parent.postMessage({type:'suzika-socialbar-blocked',id:'${instanceId}'},'*')}catch(e){}"
    ></script>
  </body>
</html>`;
  }, [activeBannerKey, socialBarScriptUrl, instanceId]);

  const finishAndDownload = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteDownload();
  };

  // Inject/refresh global Social Bar script so floating Social Bar ads also activate immediately
  const activateGlobalSocialBarScript = () => {
    if (typeof document === 'undefined' || !socialBarScriptUrl.startsWith('https://')) return;
    try {
      const prevDownloadTag = document.querySelector('script[data-suzika-download-socialbar="true"]');
      if (prevDownloadTag) {
        prevDownloadTag.remove();
      }
      const existingGlobal = document.querySelector(`script[data-suzika-web-ad="${socialBarScriptUrl}"]`);
      if (!existingGlobal) {
        const s = document.createElement('script');
        s.src = socialBarScriptUrl;
        s.async = true;
        s.setAttribute('data-cfasync', 'false');
        s.setAttribute('data-suzika-web-ad', socialBarScriptUrl);
        document.head.appendChild(s);
      }
    } catch {}
  };

  const activateSocialBarFallback = () => {
    activateGlobalSocialBarScript();
    setStage('social_bar');
    setCountdown(AD_WAIT_SECONDS);
  };

  // Resolve Full-Screen Video Ad first, otherwise activate 15s Social Bar + Sponsored Ad
  useEffect(() => {
    if (!isOpen) {
      completedRef.current = false;
      impressionFiredRef.current = false;
      setStage('loading');
      setVastCreative(null);
      setDirectVideoSrc('');
      setIframeSrcDoc('');
      setVideoDuration(0);
      setVideoCurrentTime(0);
      setCountdown(AD_WAIT_SECONDS);
      setDisplayAdBlocked(false);
      return;
    }

    completedRef.current = false;
    impressionFiredRef.current = false;
    setVastCreative(null);
    setDirectVideoSrc('');
    setIframeSrcDoc('');
    setCountdown(AD_WAIT_SECONDS);
    setDisplayAdBlocked(false);

    let cancelled = false;

    const startFlow = async () => {
      // 1. Native Android APK AdMob Interstitial
      if (isNativeAndroidAdMobAvailable() && bannerConfig?.enableAndroidInterstitial !== false) {
        await showImmediateNativeInterstitial(bannerConfig);
        if (!cancelled) finishAndDownload();
        return;
      }

      // 2. Direct MP4/WebM Video Ad URL
      if (rawVideoTag && isDirectVideoFile(rawVideoTag)) {
        if (!cancelled) {
          setDirectVideoSrc(rawVideoTag);
          setStage('video_direct');
        }
        return;
      }

      // 3. Adsterra HTML <script> snippet (Interstitial/Video tag)
      if (parsedVideoTag.kind === 'script_snippet') {
        if (!cancelled) {
          setIframeSrcDoc(buildIsolatedAdsterraSrcDoc(instanceId, parsedVideoTag.snippet));
          setStage('video_iframe');
        }
        return;
      }

      // 4. VAST XML URL or Interstitial Script URL
      if (parsedVideoTag.kind === 'vast_or_script_url') {
        if (parsedVideoTag.isDefinitelyScriptUrl && !isLikelyVastUrl(parsedVideoTag.url)) {
          if (!cancelled) {
            setIframeSrcDoc(
              buildIsolatedAdsterraSrcDoc(instanceId, {
                scriptSrcs: [{ src: parsedVideoTag.url }],
                containerIds: [],
              })
            );
            setStage('video_iframe');
          }
          return;
        }

        const creative = await resolveVastXml(parsedVideoTag.url);
        if (cancelled) return;
        if (creative && creative.mediaUrl) {
          setVastCreative(creative);
          setStage('video_vast');
          return;
        }
      }

      // 5. Fallback: Run real Adsterra Social Bar + Live Sponsored Ad for 15 seconds
      if (!cancelled) {
        activateSocialBarFallback();
      }
    };

    startFlow();

    return () => {
      cancelled = true;
    };
  }, [isOpen, rawVideoTag, parsedVideoTag, instanceId]);

  // Listen for iframe fail / ad-blocked signals cleanly
  useEffect(() => {
    if (!isOpen) return;
    const handleMsg = (event: MessageEvent) => {
      if (!event.data || event.data.id !== instanceId) return;
      if (stage === 'video_iframe' && event.data.type === 'suzika-interstitial-failed') {
        activateSocialBarFallback();
      } else if (event.data.type === 'suzika-download-ad-blocked') {
        setDisplayAdBlocked(true);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [isOpen, stage, instanceId]);

  // 10-15 second timer for Social Bar / Video Iframe mode -> automatically downloads once finished
  useEffect(() => {
    if (!isOpen || (stage !== 'social_bar' && stage !== 'video_iframe')) return;

    if (countdown <= 0) {
      finishAndDownload();
      return;
    }

    const timer = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, stage, countdown]);

  // Escape key cancels safely
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (vastCreative) {
          fireVastTrackingUrls([...vastCreative.closeUrls, ...vastCreative.skipUrls]);
        }
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, vastCreative]);

  if (!isOpen) return null;

  const isVideoPlayerStage = stage === 'video_vast' || stage === 'video_direct';
  const elapsedSeconds = isVideoPlayerStage
    ? Math.floor(videoCurrentTime)
    : AD_WAIT_SECONDS - countdown;
  const canSkipToDownload = isVideoPlayerStage
    ? elapsedSeconds >= MIN_MANDATORY_AD_SECONDS || (videoDuration > 0 && videoCurrentTime >= videoDuration)
    : countdown <= AD_WAIT_SECONDS - MIN_MANDATORY_AD_SECONDS;

  const remainingToSkip = isVideoPlayerStage
    ? Math.max(0, MIN_MANDATORY_AD_SECONDS - elapsedSeconds)
    : Math.max(0, countdown - (AD_WAIT_SECONDS - MIN_MANDATORY_AD_SECONDS));

  const progressPct = isVideoPlayerStage
    ? videoDuration > 0
      ? Math.min(100, Math.round((videoCurrentTime / videoDuration) * 100))
      : Math.min(100, Math.round((elapsedSeconds / AD_WAIT_SECONDS) * 100))
    : Math.min(100, Math.round(((AD_WAIT_SECONDS - countdown) / AD_WAIT_SECONDS) * 100));

  return (
    <div
      className="fixed inset-0 z-[360] bg-[#05070e]/98 backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Full-Screen Download Advertisement"
    >
      {/* Full-Screen Top Bar */}
      <div className="px-4 py-3 bg-gradient-to-b from-black/95 via-black/70 to-transparent flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#151a2d] border border-[#2b3353] text-[10px] font-bold uppercase tracking-wider text-[#00d2ff]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {stage === 'social_bar'
                ? 'Adsterra Social Bar Ad'
                : stage === 'loading'
                ? 'Loading Video Ad...'
                : 'Full-Screen Video Ad'}
            </span>
          </span>
          <span className="text-xs text-[#a5acc2] truncate hidden sm:inline">
            ডাউনলোড: {mediaTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isVideoPlayerStage && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute video ad' : 'Mute video ad'}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {canSkipToDownload ? (
            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                if (vastCreative) {
                  fireVastTrackingUrls([...vastCreative.closeUrls, ...vastCreative.skipUrls]);
                }
                finishAndDownload();
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {!isVideoPlayerStage && countdown > 0
                  ? `ডাউনলোড করুন (${countdown}s)`
                  : mediaType === 'video'
                  ? 'এখনই ভিডিও ডাউনলোড করুন'
                  : 'এখনই ছবি ডাউনলোড করুন'}
              </span>
            </button>
          ) : (
            <div className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151a2d] border border-[#2b3353] text-white text-xs font-bold flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#ff35bb] animate-pulse" />
              <span>
                {stage === 'loading'
                  ? 'লোড হচ্ছে...'
                  : `বিজ্ঞাপন (${isVideoPlayerStage ? `${remainingToSkip}s` : `${countdown}s`})`}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              if (vastCreative) {
                fireVastTrackingUrls([...vastCreative.closeUrls, ...vastCreative.skipUrls]);
              }
              onCancel();
            }}
            aria-label="Cancel download"
            title="বাতিল করুন"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-red-500/30 border border-white/15 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Full-Screen Ad Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-2xl mx-auto overflow-y-auto">
        {stage === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-7 rounded-3xl bg-[#101424] border border-[#252c46]">
            <Loader2 className="w-8 h-8 text-[#ff35bb] animate-spin" />
            <p className="text-xs sm:text-sm text-white font-semibold">
              ভিডিও / Social Bar বিজ্ঞাপন লোড হচ্ছে...
            </p>
            <p className="text-[11px] text-[#9da4b8]">
              ১০–১৫ সেকেন্ডের বিজ্ঞাপন শেষে সাথে সাথেই ডাউনলোড শুরু হবে
            </p>
          </div>
        )}

        {(stage === 'video_vast' && vastCreative) || (stage === 'video_direct' && directVideoSrc) ? (
          <div className="w-full space-y-3">
            <div className="relative w-full aspect-video max-h-[72dvh] rounded-2xl overflow-hidden bg-black border border-[#2a314d] shadow-2xl">
              <video
                src={stage === 'video_vast' && vastCreative ? vastCreative.mediaUrl : directVideoSrc}
                autoPlay
                playsInline
                muted={muted}
                onPlay={() => {
                  if (stage === 'video_vast' && vastCreative && !impressionFiredRef.current) {
                    impressionFiredRef.current = true;
                    fireVastTrackingUrls([
                      ...vastCreative.impressionUrls,
                      ...vastCreative.startUrls,
                    ]);
                  }
                }}
                onLoadedMetadata={(e) => {
                  const vid = e.currentTarget;
                  if (vid.duration && Number.isFinite(vid.duration)) {
                    setVideoDuration(vid.duration);
                  }
                }}
                onTimeUpdate={(e) => {
                  setVideoCurrentTime(e.currentTarget.currentTime);
                }}
                onEnded={() => {
                  if (stage === 'video_vast' && vastCreative) {
                    fireVastTrackingUrls(vastCreative.completeUrls);
                  }
                  finishAndDownload();
                }}
                onError={() => {
                  // Video playback error -> seamlessly switch to 15s Social Bar + Sponsored Ad
                  activateSocialBarFallback();
                }}
                className="w-full h-full object-contain bg-black"
              />

              {stage === 'video_vast' && vastCreative?.clickThrough && (
                <a
                  href={vastCreative.clickThrough}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="absolute bottom-3 right-3 min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold shadow-xl flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all"
                >
                  <span>Visit Sponsor</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        ) : null}

        {stage === 'video_iframe' && iframeSrcDoc && (
          <div className="w-full max-w-lg rounded-3xl bg-[#0e1222] border border-[#283052] p-3 sm:p-4 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
              <span className="font-bold text-[#ff35bb]">Sponsored Video Advertisement</span>
              <span className="tabular-nums font-bold text-white">
                {countdown > 0 ? `ডাউনলোড শুরু হচ্ছে ${countdown}s...` : 'ডাউনলোড হচ্ছে!'}
              </span>
            </div>
            <div className="w-full h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden rounded-2xl bg-[#080a14]">
              <iframe
                title="Full-Screen Download Video Ad"
                srcDoc={iframeSrcDoc}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
                className="w-full h-full border-0 bg-transparent"
              />
            </div>
          </div>
        )}

        {stage === 'social_bar' && (
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#13182e] to-[#0b0e1b] border border-[#ff35bb]/35 p-4 sm:p-5 shadow-2xl space-y-3 text-center">
            <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
              <span className="font-bold text-[#00d2ff]">Sponsored · Adsterra Social Bar</span>
              <span className="tabular-nums font-bold text-white">
                {countdown > 0 ? `অটো ডাউনলোড ${countdown}s...` : 'ডাউনলোড হচ্ছে!'}
              </span>
            </div>

            <div className="w-full min-h-[260px] py-2 rounded-2xl bg-[#080b14] border border-[#242c47] overflow-hidden relative flex items-center justify-center">
              {!displayAdBlocked ? (
                <iframe
                  title="Adsterra Social Bar & Display Ad"
                  srcDoc={socialBarAndDisplayAdSrcDoc}
                  width={300}
                  height={250}
                  scrolling="no"
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
                  className="w-[300px] h-[250px] border-0 bg-transparent relative z-10 mx-auto"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-5 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff35bb]/25 to-[#00d2ff]/25 border border-[#ff35bb]/40 flex items-center justify-center text-[#00d2ff]">
                    <Download className="w-6 h-6 animate-bounce" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    &ldquo;{mediaTitle}&rdquo; প্রস্তুত হচ্ছে
                  </p>
                  <p className="text-[11px] text-[#9da4b8]">
                    {countdown} সেকেন্ডের মধ্যেই হাই-কোয়ালিটি ফাইল সেভ হয়ে যাবে।
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#9da4b8]">
              &ldquo;<span className="text-white font-semibold">{mediaTitle}</span>&rdquo; — বিজ্ঞাপন শেষে সাথে সাথেই PNG ফাইল ডাউনলোড হবে
            </p>
          </div>
        )}
      </div>

      {/* Bottom Progress Bar */}
      <div className="px-4 pb-5 pt-2 bg-gradient-to-t from-black via-black/80 to-transparent max-w-2xl w-full mx-auto space-y-2">
        <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
          <span>
            {stage === 'social_bar'
              ? `Adsterra Social Bar বিজ্ঞাপন শেষে (${countdown}s) অটো ডাউনলোড হবে`
              : 'বিজ্ঞাপন শেষে বা আনলক হলেই ডাউনলোড শুরু হবে'}
          </span>

          {canSkipToDownload ? (
            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                if (vastCreative) {
                  fireVastTrackingUrls([...vastCreative.closeUrls, ...vastCreative.skipUrls]);
                }
                finishAndDownload();
              }}
              className="text-white font-bold hover:underline shrink-0 ml-3 cursor-pointer"
            >
              Skip &amp; Download →
            </button>
          ) : (
            <span className="text-[#ff8ce4] font-semibold tabular-nums shrink-0 ml-3">
              Skip ({remainingToSkip}s)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
