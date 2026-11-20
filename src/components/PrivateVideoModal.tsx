import React, { useEffect, useRef, useState } from 'react';
import { X, Lock, Coins, Clock, Unlock, Sparkles, Loader2, ShieldAlert, Play } from 'lucide-react';
import { PrivateVideoItem } from '../types';
import { soundFX } from '../utils/audio';
import { parseYouTubeUrl, getLocalVideoBlob, saveLocalVideoBlob } from '../utils/videoStorage';
import { extractStreamVideoId, fetchVideoBlobFromFirestoreChunks } from '../utils/cloudMediaStore';

const USED_PREVIEW_STORAGE_KEY = 'suzika_private_2s_used_v1';
const FREE_PREVIEW_SECONDS = 2;

function loadUsedPreviewIds(): string[] {
  try {
    const raw = localStorage.getItem(USED_PREVIEW_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markPreviewUsed(videoId: string) {
  try {
    const existing = loadUsedPreviewIds();
    if (!existing.includes(videoId)) {
      localStorage.setItem(USED_PREVIEW_STORAGE_KEY, JSON.stringify([...existing, videoId]));
    }
  } catch {}
}

interface PrivateVideoModalProps {
  video: PrivateVideoItem | null;
  onClose: () => void;
  userCoins: number;
  isUnlocked: boolean;
  isAdmin?: boolean;
  onUnlockWithCoins: (video: PrivateVideoItem) => Promise<boolean> | boolean;
  onOpenRecharge: () => void;
}

export const PrivateVideoModal: React.FC<PrivateVideoModalProps> = ({
  video,
  onClose,
  userCoins,
  isUnlocked,
  isAdmin = false,
  onUnlockWithCoins,
  onOpenRecharge,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewCountdownIntervalRef = useRef<number | null>(null);

  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isYouTube, setIsYouTube] = useState(false);
  const [isLoadingSource, setIsLoadingSource] = useState(true);
  const [previewLocked, setPreviewLocked] = useState(false);
  const [previewStarted, setPreviewStarted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(FREE_PREVIEW_SECONDS);
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const hasFullAccess = isUnlocked || isAdmin;

  const clearTimers = () => {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewCountdownIntervalRef.current) {
      window.clearInterval(previewCountdownIntervalRef.current);
      previewCountdownIntervalRef.current = null;
    }
  };

  const triggerAutoRelock = (videoId: string) => {
    clearTimers();
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {}
    }
    markPreviewUsed(videoId);
    setPreviewLocked(true);
    setRemainingSeconds(0);
  };

  const startTwoSecondTimer = (videoId: string) => {
    if (hasFullAccess || previewLocked || previewTimerRef.current) return;
    setPreviewStarted(true);
    setRemainingSeconds(FREE_PREVIEW_SECONDS);

    const startedAt = Date.now();
    previewCountdownIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, Number((FREE_PREVIEW_SECONDS - elapsed).toFixed(1)));
      setRemainingSeconds(left);
    }, 100);

    previewTimerRef.current = window.setTimeout(() => {
      triggerAutoRelock(videoId);
    }, FREE_PREVIEW_SECONDS * 1000);
  };

  // Resolve playable video source & check 2s free preview status on open
  useEffect(() => {
    clearTimers();
    setUnlockError('');
    setResolvedUrl('');
    setIsYouTube(false);
    setPreviewStarted(false);
    setRemainingSeconds(FREE_PREVIEW_SECONDS);

    if (!video) return;

    if (hasFullAccess) {
      setPreviewLocked(false);
    } else {
      const alreadyUsed = loadUsedPreviewIds().includes(video.id);
      setPreviewLocked(alreadyUsed);
    }

    let cancelled = false;

    const loadVideoSource = async () => {
      setIsLoadingSource(true);
      const rawUrl = (video.videoUrl || '').trim();

      const yt = parseYouTubeUrl(rawUrl);
      if (yt.isYouTube && yt.embedUrl) {
        if (!cancelled) {
          setIsYouTube(true);
          setResolvedUrl(`${yt.embedUrl}${yt.embedUrl.includes('?') ? '&' : '?'}autoplay=1`);
          setIsLoadingSource(false);
        }
        return;
      }

      const streamId = extractStreamVideoId(rawUrl);
      if (streamId || video.isCloudChunked) {
        const targetStreamUrl = streamId ? rawUrl : `/api/video-stream/${video.id}.mp4`;
        try {
          const headRes = await fetch(targetStreamUrl, { method: 'HEAD' });
          const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
          if (headRes.ok && !contentType.includes('text/html')) {
            if (!cancelled) {
              setResolvedUrl(targetStreamUrl);
              setIsLoadingSource(false);
            }
            return;
          }
        } catch {}

        try {
          const localBlob = await getLocalVideoBlob(video.id);
          if (localBlob && localBlob.size > 0) {
            if (!cancelled) {
              setResolvedUrl(URL.createObjectURL(localBlob));
              setIsLoadingSource(false);
            }
            return;
          }
        } catch {}

        const cloudBlob = await fetchVideoBlobFromFirestoreChunks(streamId || video.id);
        if (cloudBlob && cloudBlob.size > 0) {
          saveLocalVideoBlob(video.id, cloudBlob).catch(() => {});
          if (!cancelled) {
            setResolvedUrl(URL.createObjectURL(cloudBlob));
            setIsLoadingSource(false);
          }
          return;
        }
      }

      if (!cancelled) {
        setResolvedUrl(rawUrl);
        setIsLoadingSource(false);
      }
    };

    loadVideoSource();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [video?.id, hasFullAccess]);

  if (!video) return null;

  const handleUnlockClick = async () => {
    setUnlockError('');
    if (userCoins < video.coinPrice) {
      soundFX.playPop();
      onOpenRecharge();
      return;
    }

    try {
      setIsUnlocking(true);
      const ok = await onUnlockWithCoins(video);
      if (ok) {
        soundFX.playSuccess();
        clearTimers();
        setPreviewLocked(false);
      } else {
        setUnlockError('পর্যাপ্ত কয়েন নেই। অনুগ্রহ করে কয়েন রিচার্জ করুন।');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[340] bg-black/92 backdrop-blur-xl flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Private VIP Video Player"
    >
      <div className="relative w-full max-w-xl bg-[#111522] border border-[#ff35bb]/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#0c0f1c] border-b border-[#252a3d] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#ff35bb]/20 border border-[#ff35bb]/40 text-[#ff8ce4] text-[10px] font-bold uppercase">
                {video.gallery}
              </span>
              {hasFullAccess ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  <span>Unlocked</span>
                </span>
              ) : !previewLocked ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3 animate-pulse" />
                  <span>{previewStarted ? `ফ্রি প্রিভিউ: ${remainingSeconds.toFixed(1)}s` : '২ সেকেন্ড ফ্রি প্রিভিউ'}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Locked ({video.coinPrice} Coins)</span>
                </span>
              )}
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base text-white truncate mt-1">
              {video.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => {
              clearTimers();
              soundFX.playPop();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0"
            aria-label="Close private video"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Stage */}
        <div className="relative w-full aspect-[4/5] sm:aspect-video max-h-[60vh] bg-[#080a12] flex items-center justify-center overflow-hidden">
          {isLoadingSource && !previewLocked ? (
            <div className="flex flex-col items-center gap-2 text-center p-6">
              <Loader2 className="w-8 h-8 text-[#ff35bb] animate-spin" />
              <span className="text-xs text-[#9da4b8]">প্রাইভেট ভিডিও লোড হচ্ছে...</span>
            </div>
          ) : !previewLocked && resolvedUrl ? (
            isYouTube ? (
              <iframe
                src={resolvedUrl}
                title={video.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={() => {
                  if (!hasFullAccess) {
                    startTwoSecondTimer(video.id);
                  }
                }}
                className="w-full h-full border-0"
              />
            ) : (
              <video
                ref={videoRef}
                src={resolvedUrl}
                autoPlay
                playsInline
                controls={hasFullAccess}
                controlsList="nodownload"
                onPlaying={() => {
                  if (!hasFullAccess) {
                    startTwoSecondTimer(video.id);
                  }
                }}
                onTimeUpdate={(e) => {
                  if (!hasFullAccess && e.currentTarget.currentTime >= FREE_PREVIEW_SECONDS) {
                    triggerAutoRelock(video.id);
                  }
                }}
                className="w-full h-full object-cover bg-black"
              />
            )
          ) : (
            <>
              {/* Heavy Blurred Preview Backdrop when Locked */}
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover blur-2xl scale-125 opacity-55"
                />
              ) : (
                <div
                  className="w-full h-full blur-xl opacity-60"
                  style={{ background: video.fallbackGradient || 'linear-gradient(135deg, #ff35bb, #8b4dff)' }}
                />
              )}
            </>
          )}

          {/* Lock Overlay after 2-Second Free Preview expires */}
          {previewLocked && !hasFullAccess && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center space-y-4 z-20">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#ff35bb]/30 to-amber-500/30 border border-[#ff35bb]/50 flex items-center justify-center shadow-2xl">
                <Lock className="w-8 h-8 text-amber-300" />
              </div>

              <div className="space-y-1.5 max-w-sm">
                <h4 className="font-display font-black text-base sm:text-lg text-white">
                  ২ সেকেন্ড ফ্রি প্রিভিউ শেষ — ভিডিও লক হয়েছে!
                </h4>
                <p className="text-xs text-[#b9c0d4] leading-relaxed">
                  পুরো প্রাইভেট ভিডিও আনলক করে দেখতে <span className="text-amber-300 font-bold">{video.coinPrice} Coins</span> প্রয়োজন। আপনার বর্তমান ব্যালেন্স: <span className="text-[#00d2ff] font-bold">{userCoins} Coins</span>।
                </p>
              </div>

              {unlockError && (
                <div className="px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
                {userCoins >= video.coinPrice ? (
                  <button
                    type="button"
                    disabled={isUnlocking}
                    onClick={handleUnlockClick}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-extrabold shadow-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{isUnlocking ? 'আনলক হচ্ছে...' : `আনলক করুন (${video.coinPrice} Coins)`}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      onOpenRecharge();
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-[#ff35bb] to-[#8b4dff] text-white text-xs font-extrabold shadow-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    <Coins className="w-4 h-4 text-amber-200" />
                    <span>Coin Recharge করুন (bKash / Nagad / Rocket)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Info & Quick Recharge Bar */}
        <div className="p-3.5 bg-[#0c0f1c] border-t border-[#252a3d] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[#9da4b8]">
              ব্যালেন্স: <strong className="text-white">{userCoins} Coins</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              onOpenRecharge();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#151a2d] hover:bg-[#1f2642] border border-[#ff35bb]/40 text-[#ff8ce4] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ কয়েন রিচার্জ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
