import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import { AppBannerConfig } from '../types';
import {
  buildIsolatedAdsterraSrcDoc,
  fireVastTrackingUrls,
  isLikelyVastUrl,
  parseAdsterraTag,
  ResolvedVastCreative,
  resolveVastXml,
} from '../utils/adsterraTagParser';
import { soundFX } from '../utils/audio';

interface AdsterraInterstitialModalProps {
  isOpen: boolean;
  placement: 'gallery_image' | 'video_play';
  bannerConfig?: AppBannerConfig;
  mediaTitle?: string;
  onCloseAndProceed: () => void;
}

export const AdsterraInterstitialModal: React.FC<AdsterraInterstitialModalProps> = ({
  isOpen,
  placement,
  bannerConfig,
  mediaTitle,
  onCloseAndProceed,
}) => {
  const instanceId = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const proceededRef = useRef(false);
  const impressionFiredRef = useRef(false);

  const [adMode, setAdMode] = useState<'loading' | 'iframe' | 'vast'>('loading');
  const [vastCreative, setVastCreative] = useState<ResolvedVastCreative | null>(null);
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string>('');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  const rawTag = useMemo(() => {
    if (placement === 'gallery_image') {
      return (bannerConfig?.galleryInterstitialTagUrl || '').trim();
    }
    const primaryVideoTag = (bannerConfig?.videoPlayAdTagUrl || '').trim();
    if (primaryVideoTag) return primaryVideoTag;
    const fallbackVast = (bannerConfig?.webVideoAdUrl || '').trim();
    return isLikelyVastUrl(fallbackVast) ? fallbackVast : '';
  }, [
    placement,
    bannerConfig?.galleryInterstitialTagUrl,
    bannerConfig?.videoPlayAdTagUrl,
    bannerConfig?.webVideoAdUrl,
  ]);

  const parsedTag = useMemo(
    () => parseAdsterraTag(rawTag, bannerConfig?.webAdScriptUrl),
    [rawTag, bannerConfig?.webAdScriptUrl]
  );

  const safeProceed = () => {
    if (proceededRef.current) return;
    proceededRef.current = true;
    onCloseAndProceed();
  };

  // Resolve real Adsterra Interstitial or VAST Video Ad when opened
  useEffect(() => {
    if (!isOpen) {
      proceededRef.current = false;
      impressionFiredRef.current = false;
      setAdMode('loading');
      setVastCreative(null);
      setIframeSrcDoc('');
      setIframeLoaded(false);
      setVideoDuration(0);
      setVideoCurrentTime(0);
      return;
    }

    proceededRef.current = false;
    impressionFiredRef.current = false;
    setIframeLoaded(false);
    setVastCreative(null);

    if (parsedTag.kind === 'none' || parsedTag.kind === 'conflict') {
      safeProceed();
      return;
    }

    if (parsedTag.kind === 'script_snippet') {
      setIframeSrcDoc(buildIsolatedAdsterraSrcDoc(instanceId, parsedTag.snippet));
      setAdMode('iframe');
      return;
    }

    if (parsedTag.kind === 'vast_or_script_url') {
      const shouldTryVast =
        isLikelyVastUrl(parsedTag.url) ||
        (placement === 'video_play' && !parsedTag.isDefinitelyScriptUrl);

      if (!shouldTryVast || parsedTag.isDefinitelyScriptUrl) {
        setIframeSrcDoc(
          buildIsolatedAdsterraSrcDoc(instanceId, {
            scriptSrcs: [{ src: parsedTag.url }],
            containerIds: [],
          })
        );
        setAdMode('iframe');
        return;
      }

      let cancelled = false;
      setAdMode('loading');

      resolveVastXml(parsedTag.url).then((creative) => {
        if (cancelled) return;
        if (creative && creative.mediaUrl) {
          setVastCreative(creative);
          setAdMode('vast');
        } else {
          // VAST failed, blocked, or returned empty: let user open photo / play video seamlessly
          safeProceed();
        }
      });

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, parsedTag, instanceId, placement]);

  // Listen for iframe load / fail events from isolated Adsterra sandbox
  useEffect(() => {
    if (!isOpen || adMode !== 'iframe') return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.id !== instanceId) return;
      if (event.data.type === 'suzika-interstitial-loaded') {
        setIframeLoaded(true);
      } else if (event.data.type === 'suzika-interstitial-failed') {
        // Real ad blocked or failed to fill -> never block user, proceed to photo/video
        safeProceed();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, adMode, instanceId]);

  // Escape key allows closing ad cleanly to continue to photo/video
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (vastCreative) {
          fireVastTrackingUrls([...vastCreative.closeUrls, ...vastCreative.skipUrls]);
        }
        safeProceed();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, vastCreative]);

  if (!isOpen || parsedTag.kind === 'none' || parsedTag.kind === 'conflict') {
    return null;
  }

  const handleCloseClick = () => {
    soundFX.playPop();
    if (vastCreative) {
      fireVastTrackingUrls([...vastCreative.closeUrls, ...vastCreative.skipUrls]);
    }
    safeProceed();
  };

  const progressPct =
    videoDuration > 0 ? Math.min(100, Math.round((videoCurrentTime / videoDuration) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-[320] bg-[#060810]/96 backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={
        placement === 'gallery_image'
          ? 'Gallery Interstitial Advertisement'
          : 'Video Play Advertisement'
      }
    >
      {/* Top Disclosure & Close Control */}
      <div className="px-4 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#151a2d] border border-[#2a314d] text-[10px] font-bold uppercase tracking-wider text-[#00d2ff]">
            <ShieldCheck className="w-3 h-3" />
            <span>Advertisement</span>
          </span>
          {mediaTitle && (
            <span className="text-xs text-[#9da4b8] truncate hidden sm:inline">
              {placement === 'gallery_image' ? 'ছবি ওপেন হচ্ছে:' : 'ভিডিও লোড হচ্ছে:'} {mediaTitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {adMode === 'vast' && vastCreative && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute video ad' : 'Mute video ad'}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleCloseClick}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-extrabold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <span>{placement === 'video_play' ? 'বন্ধ করে ভিডিও দেখুন' : 'বন্ধ করে ছবি দেখুন'}</span>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Responsive Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-2xl mx-auto overflow-y-auto">
        {adMode === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6 rounded-2xl bg-[#111524]/90 border border-[#252a3d]">
            <Loader2 className="w-7 h-7 text-[#ff35bb] animate-spin" />
            <p className="text-xs text-[#d5cce7] font-medium">
              {placement === 'video_play' ? 'ভিডিও বিজ্ঞাপন প্রস্তুত হচ্ছে...' : 'বিজ্ঞাপন লোড হচ্ছে...'}
            </p>
          </div>
        )}

        {adMode === 'vast' && vastCreative && (
          <div className="w-full space-y-3">
            <div className="relative w-full aspect-video max-h-[70dvh] rounded-2xl overflow-hidden bg-black border border-[#2a314d] shadow-2xl">
              <video
                src={vastCreative.mediaUrl}
                autoPlay
                playsInline
                muted={muted}
                onPlay={() => {
                  if (!impressionFiredRef.current) {
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
                  fireVastTrackingUrls(vastCreative.completeUrls);
                  safeProceed();
                }}
                onError={() => {
                  // Video stream failed to decode/load -> never block user video
                  safeProceed();
                }}
                className="w-full h-full object-contain bg-black"
              />

              {vastCreative.clickThrough && (
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

            {videoDuration > 0 && (
              <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>
        )}

        {adMode === 'iframe' && iframeSrcDoc && (
          <div className="w-full max-w-md sm:max-w-lg rounded-2xl bg-[#0e1220] border border-[#252a3d] p-3 sm:p-4 shadow-2xl flex flex-col items-center justify-center relative">
            {!iframeLoaded && (
              <div className="flex items-center gap-2 text-[11px] text-[#9da4b8] mb-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00d2ff]" />
                <span>Adsterra স্পনসর লোড হচ্ছে...</span>
              </div>
            )}
            <div className="w-full h-[280px] sm:h-[340px] flex items-center justify-center overflow-hidden rounded-xl bg-[#090c16]">
              <iframe
                ref={iframeRef}
                title={`Adsterra Interstitial ${placement}`}
                srcDoc={iframeSrcDoc}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
                className="w-full h-[280px] sm:h-[340px] border-0 bg-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Helpful Return Bar */}
      <div className="px-4 pb-5 pt-2 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-between max-w-2xl w-full mx-auto text-[11px] text-[#9da4b8]">
        <span>বিজ্ঞাপন বন্ধ করলে সাথে সাথে আপনার {placement === 'video_play' ? 'ভিডিও চালু হবে' : 'ছবি ওপেন হবে'}।</span>
        <button
          type="button"
          onClick={handleCloseClick}
          className="text-white font-bold hover:underline shrink-0 ml-3"
        >
          Skip &amp; Continue →
        </button>
      </div>
    </div>
  );
};
