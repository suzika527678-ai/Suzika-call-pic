import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Heart,
  Film,
  Share2,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Play,
  Upload,
  Link2,
  RefreshCw,
  FileVideo,
  Loader2,
  Volume2,
  VolumeX,
  Download,
  Trash2,
  Edit3,
  Lock,
  Award,
  CheckCircle2,
} from 'lucide-react';
import { VideoItem, AppBannerConfig, UserProfile } from '../types';
import { soundFX } from '../utils/audio';
import { AdBanner } from './AdBanner';
import { triggerMediaDownload } from '../utils/downloadHelper';
import { getLocalVideoBlob, saveLocalVideoBlob, parseYouTubeUrl, extractVideoMeta } from '../utils/videoStorage';
import { formatLikes } from '../utils/formatters';
import { isVideoLocked } from '../utils/unlockStore';
import { copyToClipboard } from '../utils/clipboard';
import { MAX_INLINE_VIDEO_BYTES, blobToDataUrl } from '../utils/mediaUploader';
import {
  uploadVideoToFirestoreChunks,
  fetchVideoBlobFromFirestoreChunks,
  extractStreamVideoId,
} from '../utils/cloudMediaStore';

interface VideoPlayerModalProps {
  video: VideoItem | null;
  onClose: () => void;
  onToggleLike: (videoId: string) => void;
  bannerConfig?: AppBannerConfig;
  onUpdateVideo?: (updated: VideoItem) => Promise<void> | void;
  isAdmin?: boolean;
  onDeleteVideo?: (videoId: string) => void;
  userProfile?: UserProfile;
  onRequireLogin?: () => void;
  onRequestUnlockVideo?: (video: VideoItem) => void;
  onRequestDownloadVideo?: (video: VideoItem, onEarnedReward: () => void) => void;
  onOpenUpload?: (defaultType?: 'photo' | 'video') => void;
  onUploadThisVideo?: (video: VideoItem, fileBlob?: Blob) => Promise<boolean> | void;
  totalVideosCount?: number;
  nextVideoSlotNumber?: number;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  video,
  onClose,
  onToggleLike,
  bannerConfig,
  onUpdateVideo,
  isAdmin = false,
  onDeleteVideo,
  userProfile,
  onRequireLogin,
  onRequestUnlockVideo,
  onRequestDownloadVideo,
  onOpenUpload,
  onUploadThisVideo,
  totalVideosCount = 15,
  nextVideoSlotNumber,
}) => {
  // Private phone videos are NEVER locked or blurred
  const isLocked = video ? (video.isPrivatePhoneVideo ? false : isVideoLocked(video, bannerConfig)) : false;
  const [copied, setCopied] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>('');
  const [isLocalDeviceMissing, setIsLocalDeviceMissing] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [customLinkInput, setCustomLinkInput] = useState('');
  const [isUpdatingSource, setIsUpdatingSource] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isUploadingDirect, setIsUploadingDirect] = useState(false);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const triedIndexedDbRef = useRef<string | null>(null);
  const triedCloudChunksRef = useRef<string | null>(null);

  const handleDirectUploadFromPlayer = async () => {
    if (!video) return;
    try {
      setIsUploadingDirect(true);
      soundFX.playPop();

      // Retrieve blob from attached raw file or fetch object URL
      let fileBlob: Blob | undefined = (video as any).rawFile;
      if (!fileBlob && (resolvedVideoUrl || video.videoUrl)) {
        try {
          const resp = await fetch(resolvedVideoUrl || video.videoUrl);
          fileBlob = await resp.blob();
        } catch (e) {
          console.warn('Could not fetch blob from url', e);
        }
      }

      const assignedSlot = Math.max(nextVideoSlotNumber || 0, (totalVideosCount || 0) + 1);
      const newVideoId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      let finalVideoUrl = '';
      let isCloudChunked = false;
      let cloudChunkCount: number | undefined;
      let fileSizeBytes: number | undefined;
      let extractedThumb = video.thumbnailUrl || '';
      let extractedDuration = video.duration || '0:30';

      if (fileBlob && fileBlob.size > 0) {
        try {
          const metaFile = fileBlob instanceof File ? fileBlob : new File([fileBlob], `${newVideoId}.mp4`, { type: fileBlob.type || 'video/mp4' });
          const meta = await extractVideoMeta(metaFile);
          if (meta.thumbnailUrl) extractedThumb = meta.thumbnailUrl;
          if (meta.durationStr) extractedDuration = meta.durationStr;
        } catch {}

        if (fileBlob.size <= MAX_INLINE_VIDEO_BYTES) {
          finalVideoUrl = await blobToDataUrl(fileBlob);
        } else {
          const cloudRes = await uploadVideoToFirestoreChunks(newVideoId, fileBlob, video.title);
          finalVideoUrl = cloudRes.streamUrl;
          isCloudChunked = true;
          cloudChunkCount = cloudRes.totalChunks;
          fileSizeBytes = cloudRes.sizeBytes;
        }
        await saveLocalVideoBlob(newVideoId, fileBlob).catch(() => {});
      }

      const uploadedItem: VideoItem = {
        ...video,
        id: newVideoId,
        title: video.title || `Video Reel Slot #${assignedSlot}`,
        slotNumber: assignedSlot,
        category: video.category === 'All' ? 'Cinematic' : video.category,
        author: userProfile?.name || 'Phone User',
        isPrivatePhoneVideo: false,
        videoUrl: finalVideoUrl,
        thumbnailUrl: extractedThumb,
        duration: extractedDuration,
        createdAt: 'Just now',
        createdAtMs: Date.now(),
        views: 1,
        likes: 1,
        isLocalIndexedDB: false,
        isCloudChunked,
        ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
        ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
        videoType: 'direct',
      };

      if (onUploadThisVideo) {
        await onUploadThisVideo(uploadedItem, fileBlob);
      } else if (onUpdateVideo) {
        await onUpdateVideo(uploadedItem);
      }

      soundFX.playSuccess();
      setUploadSuccessToast(`✓ ভিডিওটি স্থায়ীভাবে ক্লাউড ও গ্যালারিতে আপলোড হয়েছে (Slot #${assignedSlot})!`);
      setTimeout(() => {
        setUploadSuccessToast(null);
      }, 4000);
    } catch (err: any) {
      console.error('Direct upload error:', err);
    } finally {
      setIsUploadingDirect(false);
    }
  };

  const handleDownloadVideo = async () => {
    soundFX.playPop();
    const shouldGateWithAd =
      bannerConfig?.enableAds !== false &&
      bannerConfig?.requireAdForDownloads !== false &&
      Boolean(onRequestDownloadVideo);
    if (shouldGateWithAd && video && onRequestDownloadVideo) {
      onRequestDownloadVideo(video, () => {
        executeVideoDownload();
      });
      return;
    }
    await executeVideoDownload();
  };

  const executeVideoDownload = async () => {
    if (!video) return;
    soundFX.playSuccess();
    const filename = `SUZIKA_${(video.title || 'Video').replace(/\s+/g, '_')}_Slot${video.slotNumber}.mp4`;
    const targetUrl = resolvedVideoUrl || video.videoUrl;
    await triggerMediaDownload(targetUrl, filename);
  };

  // Silently restore missing /uploads/ or local-blob video permanently into Cloud Firestore!
  const tryHealVideoInBackground = (blob: Blob, currentUrl: string, currentVideo: VideoItem) => {
    if (!blob || blob.size === 0 || currentVideo.isPrivatePhoneVideo) return;
    if (currentUrl.startsWith('/api/video-stream/') || currentVideo.isCloudChunked || currentUrl.startsWith('data:video/')) {
      return;
    }

    if (blob.size <= MAX_INLINE_VIDEO_BYTES) {
      blobToDataUrl(blob)
        .then((dataUrl) => {
          if (dataUrl && onUpdateVideo) {
            onUpdateVideo({
              ...currentVideo,
              videoUrl: dataUrl,
              isLocalIndexedDB: false,
              isCloudChunked: false,
              videoType: 'direct',
            });
          }
        })
        .catch(() => {});
      return;
    }

    // Upgrade ephemeral /uploads/ or local-blob video to permanent Cloud Firestore chunk storage
    uploadVideoToFirestoreChunks(currentVideo.id, blob, currentVideo.title)
      .then((cloudRes) => {
        if (onUpdateVideo) {
          onUpdateVideo({
            ...currentVideo,
            videoUrl: cloudRes.streamUrl,
            isLocalIndexedDB: false,
            isCloudChunked: true,
            cloudChunkCount: cloudRes.totalChunks,
            fileSizeBytes: cloudRes.sizeBytes,
            videoType: 'direct',
          });
        }
      })
      .catch(() => {});
  };

  // Resolve video source whenever video changes
  const loadSource = async () => {
    if (!video) return;
    setIsLoadingVideo(true);
    setVideoError(false);
    setIsLocalDeviceMissing(false);
    setShowLinkInput(false);
    triedIndexedDbRef.current = null;
    triedCloudChunksRef.current = null;

    const rawUrl = (video.videoUrl || '').trim();

    // 1. Check if it's a private phone gallery video with raw File
    if (video.isPrivatePhoneVideo) {
      if ((video as any).rawFile instanceof Blob) {
        const objUrl = URL.createObjectURL((video as any).rawFile);
        setResolvedVideoUrl(objUrl);
        setIsLoadingVideo(false);
        return;
      }
      if (rawUrl && rawUrl.startsWith('blob:')) {
        setResolvedVideoUrl(rawUrl);
        setIsLoadingVideo(false);
        return;
      }
    }

    // 2. Check if YouTube URL (Watch, Shorts, Embed, youtu.be)
    const yt = parseYouTubeUrl(rawUrl);
    if (yt.isYouTube && yt.embedUrl) {
      setResolvedVideoUrl(yt.embedUrl);
      setIsLoadingVideo(false);
      return;
    }

    const streamVideoId = extractStreamVideoId(rawUrl);
    const isServerUploadPath = rawUrl.startsWith('/uploads/');
    const hasPublicRemoteOrServerUrl = Boolean(
      rawUrl &&
      (isServerUploadPath ||
        rawUrl.startsWith('/api/video-stream/') ||
        rawUrl.startsWith('http://') ||
        rawUrl.startsWith('https://') ||
        rawUrl.startsWith('data:'))
    );

    const checkIndexedDbBlob = async (timeoutMs = 1200): Promise<Blob | null> => {
      triedIndexedDbRef.current = video.id;
      try {
        const blobPromise = getLocalVideoBlob(video.id);
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), timeoutMs)
        );
        const blob = await Promise.race([blobPromise, timeoutPromise]);
        if (blob && blob.size > 0) return blob;
      } catch (err) {
        console.warn('Could not read video blob from IndexedDB:', err);
      }
      return null;
    };

    // 3. Permanent Cloud Firestore /api/video-stream/ videos: serve stream directly, or fallback to client reassembly
    if (streamVideoId || video.isCloudChunked) {
      const targetStreamUrl = streamVideoId ? rawUrl : `/api/video-stream/${video.id}.mp4`;
      try {
        const headRes = await fetch(targetStreamUrl, { method: 'HEAD' });
        const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
        if (headRes.ok && !contentType.includes('text/html')) {
          setResolvedVideoUrl(targetStreamUrl);
          setIsLoadingVideo(false);
          return;
        }
      } catch {}

      // Fallback 1: check local IndexedDB cache
      const cachedLocal = await checkIndexedDbBlob(900);
      if (cachedLocal) {
        setResolvedVideoUrl(URL.createObjectURL(cachedLocal));
        setIsLoadingVideo(false);
        return;
      }

      // Fallback 2: reassemble directly from Firestore chunks in browser
      triedCloudChunksRef.current = video.id;
      const cloudBlob = await fetchVideoBlobFromFirestoreChunks(streamVideoId || video.id);
      if (cloudBlob && cloudBlob.size > 0) {
        saveLocalVideoBlob(video.id, cloudBlob).catch(() => {});
        setResolvedVideoUrl(URL.createObjectURL(cloudBlob));
        setIsLoadingVideo(false);
        return;
      }

      setResolvedVideoUrl('');
      setIsLocalDeviceMissing(true);
      setIsLoadingVideo(false);
      return;
    }

    // 4. Check IndexedDB if flagged or local-only; fall back cleanly to public server/remote URL if reachable
    const shouldCheckIndexedDB =
      video.isLocalIndexedDB ||
      rawUrl === 'local-blob' ||
      rawUrl === 'local-indexeddb' ||
      rawUrl.startsWith('indexeddb:') ||
      rawUrl.startsWith('blob:');

    if (shouldCheckIndexedDB) {
      const localBlob = await checkIndexedDbBlob(hasPublicRemoteOrServerUrl ? 650 : 2000);
      if (localBlob) {
        const activeBlobUrl = URL.createObjectURL(localBlob);
        setResolvedVideoUrl(activeBlobUrl);
        setIsLoadingVideo(false);
        tryHealVideoInBackground(localBlob, rawUrl, video);
        return;
      }
    }

    // 5. For legacy server disk /uploads/ paths, verify existence via HEAD before mounting <video>;
    //    if missing on server (e.g. after restart), recover seamlessly from browser IndexedDB or Firestore chunks
    if (isServerUploadPath) {
      let serverFileExists = false;
      try {
        const headRes = await fetch(rawUrl, { method: 'HEAD' });
        const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
        serverFileExists = headRes.ok && !contentType.includes('text/html');
      } catch {
        serverFileExists = false;
      }

      if (serverFileExists) {
        setResolvedVideoUrl(rawUrl);
        setIsLoadingVideo(false);
        return;
      }

      if (triedIndexedDbRef.current !== video.id) {
        const localBlob = await checkIndexedDbBlob(1800);
        if (localBlob) {
          const activeBlobUrl = URL.createObjectURL(localBlob);
          setResolvedVideoUrl(activeBlobUrl);
          setIsLoadingVideo(false);
          tryHealVideoInBackground(localBlob, rawUrl, video);
          return;
        }
      }

      triedCloudChunksRef.current = video.id;
      const cloudBlob = await fetchVideoBlobFromFirestoreChunks(video.id);
      if (cloudBlob && cloudBlob.size > 0) {
        saveLocalVideoBlob(video.id, cloudBlob).catch(() => {});
        setResolvedVideoUrl(URL.createObjectURL(cloudBlob));
        setIsLoadingVideo(false);
        return;
      }

      setResolvedVideoUrl('');
      setIsLocalDeviceMissing(true);
      setIsLoadingVideo(false);
      return;
    }

    // 6. Normal remote MP4/WebM or inline data URL (Cloud Firestore / DataURL / CDN)
    if (hasPublicRemoteOrServerUrl && !rawUrl.startsWith('blob:')) {
      setResolvedVideoUrl(rawUrl);
      setIsLoadingVideo(false);
      return;
    }

    // 7. Final safety check in IndexedDB & Firestore chunks if local-only or invalid URL
    if (triedIndexedDbRef.current !== video.id) {
      const localBlob = await checkIndexedDbBlob(1200);
      if (localBlob) {
        const activeBlobUrl = URL.createObjectURL(localBlob);
        setResolvedVideoUrl(activeBlobUrl);
        setIsLoadingVideo(false);
        tryHealVideoInBackground(localBlob, rawUrl, video);
        return;
      }
    }

    if (triedCloudChunksRef.current !== video.id) {
      triedCloudChunksRef.current = video.id;
      const cloudBlob = await fetchVideoBlobFromFirestoreChunks(video.id);
      if (cloudBlob && cloudBlob.size > 0) {
        saveLocalVideoBlob(video.id, cloudBlob).catch(() => {});
        setResolvedVideoUrl(URL.createObjectURL(cloudBlob));
        setIsLoadingVideo(false);
        return;
      }
    }

    setResolvedVideoUrl('');
    setIsLocalDeviceMissing(true);
    setIsLoadingVideo(false);
  };

  useEffect(() => {
    loadSource();

    return () => {
      if (resolvedVideoUrl && resolvedVideoUrl.startsWith('blob:') && !video?.isPrivatePhoneVideo) {
        URL.revokeObjectURL(resolvedVideoUrl);
      }
    };
  }, [video?.id, video?.videoUrl]);

  // If video is locked, directly trigger Rewarded Ad without needing extra clicks
  useEffect(() => {
    if (isLocked && video && onRequestUnlockVideo) {
      onRequestUnlockVideo(video);
    }
  }, [isLocked, video?.id]);

  if (!video) return null;

  const handleShare = async () => {
    soundFX.playPop();
    const url = typeof window !== 'undefined' ? window.location.href : '';
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Relink device file with permanent Cloud Firestore storage (inline DataURL <=520KB or chunked stream) + IndexedDB
  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUpdatingSource(true);
      await saveLocalVideoBlob(video.id, file);
      const meta = await extractVideoMeta(file);

      let persistedUrl = '';
      let isCloudChunked = false;
      let cloudChunkCount: number | undefined;
      let fileSizeBytes: number | undefined;

      if (file.size <= MAX_INLINE_VIDEO_BYTES) {
        persistedUrl = await blobToDataUrl(file);
      } else {
        const cloudRes = await uploadVideoToFirestoreChunks(video.id, file, file.name);
        persistedUrl = cloudRes.streamUrl;
        isCloudChunked = true;
        cloudChunkCount = cloudRes.totalChunks;
        fileSizeBytes = cloudRes.sizeBytes;
      }

      setResolvedVideoUrl(persistedUrl || URL.createObjectURL(file));
      setVideoError(false);
      setIsLocalDeviceMissing(false);
      soundFX.playSuccess();

      if (onUpdateVideo) {
        const updated: VideoItem = {
          ...video,
          videoUrl: persistedUrl,
          isLocalIndexedDB: false,
          isCloudChunked,
          ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
          ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
          videoType: 'direct',
          duration: meta.durationStr || video.duration,
          thumbnailUrl: meta.thumbnailUrl || video.thumbnailUrl,
        };
        await onUpdateVideo(updated);
      }
    } catch (err) {
      console.error('Failed to save re-linked video permanently:', err);
    } finally {
      setIsUpdatingSource(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Apply new web URL or YouTube Shorts/Video link
  const handleApplyCustomLink = async () => {
    const clean = customLinkInput.trim();
    if (!clean) return;

    setIsUpdatingSource(true);
    const yt = parseYouTubeUrl(clean);
    const finalUrl = yt.isYouTube ? yt.embedUrl! : clean;

    setResolvedVideoUrl(finalUrl);
    setVideoError(false);
    setIsLocalDeviceMissing(false);
    setShowLinkInput(false);
    soundFX.playSuccess();

    if (onUpdateVideo) {
      const updated: VideoItem = {
        ...video,
        videoUrl: finalUrl,
        videoType: yt.isYouTube ? 'youtube' : 'direct',
        isLocalIndexedDB: false,
        thumbnailUrl: yt.isYouTube && yt.thumbnailUrl ? yt.thumbnailUrl : video.thumbnailUrl,
      };
      await onUpdateVideo(updated);
    }
    setIsUpdatingSource(false);
  };

  const isYouTubeEmbed = parseYouTubeUrl(resolvedVideoUrl || video.videoUrl).isYouTube;
  const youtubeEmbedUrl = parseYouTubeUrl(resolvedVideoUrl || video.videoUrl).embedUrl;
  const isRecoveryOrLockView = isLocked || isLocalDeviceMissing || videoError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-md p-2.5 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#111522] border border-[#252a3d] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col my-auto max-h-[94vh] overflow-y-auto">
        {/* Header / Top Bar */}
        <div className="flex items-center justify-between p-4 border-b border-[#252a3d] bg-[#0c0f1c]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] flex items-center justify-center text-white">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-white truncate max-w-[200px] sm:max-w-md">
                  {video.title}
                </h3>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#1e2338] text-[#ff35bb] font-semibold border border-[#252a3d]">
                  Slot #{String(video.slotNumber).padStart(2, '0')}/500
                </span>
              </div>
              <p className="text-xs text-[#9da4b8]">By {video.author} · {video.category}</p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFX.playPop();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-[#1c2237] hover:bg-[#28314e] text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Controls Bar (Edit & Delete Video) */}
        {isAdmin && (
          <div className="px-4 py-2.5 bg-[#ffd700]/10 border-b border-[#ffd700]/30 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#ffd700] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" />
              <span>Admin Video Controls</span>
            </span>

            <div className="flex items-center gap-2">
              {onDeleteVideo && (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    onDeleteVideo(video.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors active:scale-95"
                  title="সরাসরি ভিডিও মুছুন (Delete Video)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ভিডিও ডিলিট (Delete Video)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload Success Banner */}
        {uploadSuccessToast && (
          <div className="mx-4 my-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{uploadSuccessToast}</span>
          </div>
        )}

        {/* Private Phone Video Helper Banner */}
        {video.isPrivatePhoneVideo && !uploadSuccessToast && (
          <div className="mx-4 my-2 p-3 rounded-2xl bg-gradient-to-r from-[#ff35bb]/20 via-[#8b4dff]/25 to-[#00d2ff]/20 border border-[#ff35bb]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] text-white flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>ফোন থেকে ভিডিও লোড হয়েছে!</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.2 rounded-full font-bold">প্রাইভেট প্রিভিউ</span>
                </p>
                <p className="text-[11px] text-[#9da4b8]">
                  এই ভিডিওটি কি অ্যাপের ভিডিও গ্যালারিতে সরাসরি আপলোড ও সেভ করতে চান?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDirectUploadFromPlayer}
                disabled={isUploadingDirect}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:brightness-110 text-white text-xs font-extrabold shadow-lg shadow-[#ff35bb]/30 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUploadingDirect ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>গ্যালারিতে আপলোড করুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Video Player Frame — expands naturally for lock/error recovery cards so icons & buttons never clip on mobile */}
        <div
          className={`relative bg-black flex items-center justify-center ${
            isRecoveryOrLockView ? 'min-h-[250px] py-5 px-3 sm:p-6' : 'aspect-video overflow-hidden'
          }`}
        >
          {/* Hidden File Input for Device Video Relinking */}
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            onChange={handleFilePicked}
            className="hidden"
          />

          {isLocked ? (
            /* Locked Video Screen */
            <div className="flex flex-col items-center justify-center p-4 sm:p-8 text-center max-w-md mx-auto space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-xl shadow-amber-500/20 animate-pulse">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-bold text-white">
                  অনলাইন ভিডিও রিল লক করা আছে
                </h4>
                <p className="text-xs text-[#9da4b8] leading-relaxed">
                  ভিডিওটি উপভোগ করতে একটি Google AdMob রিওয়ার্ডেড বিজ্ঞাপন দেখুন। বিজ্ঞাপন শেষ হলেই সম্পূর্ণ ভিডিও প্লেয়ার উন্মুক্ত হবে।
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  if (onRequestUnlockVideo) onRequestUnlockVideo(video);
                }}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-[#ff35bb] to-[#8b4dff] hover:opacity-95 text-white text-xs font-extrabold shadow-xl shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-2 border border-white/20"
              >
                <Award className="w-4 h-4 text-amber-200 fill-amber-200" />
                <span>Watch Ad to Unlock Video</span>
              </button>
            </div>
          ) : (!resolvedVideoUrl && isLoadingVideo) ? (
            /* Loading Video Indicator - only before video URL is resolved */
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="w-10 h-10 text-[#8b4dff] animate-spin mb-3" />
              <p className="text-sm font-semibold text-white">ভিডিও প্রস্তুত হচ্ছে...</p>
              <p className="text-xs text-[#9da4b8] mt-1">HD স্ট্রিমিং ও স্টোরেজ লোড হচ্ছে</p>
            </div>
          ) : isLocalDeviceMissing || videoError ? (
            /* Clean Real Error & Recovery Card (No Fake Demo Buttons) */
            <div className="flex flex-col items-center justify-center p-3 sm:p-6 text-center max-w-md w-full mx-auto animate-in fade-in">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-lg shadow-rose-500/10">
                <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 text-rose-400" />
              </div>

              <h4 className="text-sm sm:text-base font-bold text-white">
                ভিডিও ফাইল পাওয়া যায়নি / প্লে হচ্ছে না
              </h4>
              <p className="text-xs text-[#9da4b8] mt-1.5 leading-relaxed">
                এই ভিডিওটির উৎস ফাইল এই ব্রাউজারে সংরক্ষিত নেই অথবা ওয়েব লিংকটি সাময়িকভাবে অনুপলব্ধ। নিচে থেকে ফাইল প্রদান করুন অথবা লিংক আপডেট করুন।
              </p>

              {/* Action Buttons: Real Relink / Web Link / Retry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 w-full">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUpdatingSource}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-[#ff35bb]/20 active:scale-95 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUpdatingSource ? 'প্রসেসিং...' : 'ডিভাইস ফাইল নির্বাচন করুন'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadSource()}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#1e2338] hover:bg-[#28314e] text-white border border-[#3b4260] text-xs font-semibold active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4 text-[#00d2ff]" />
                  <span>পুনরায় চেষ্টা করুন (Retry)</span>
                </button>
              </div>

              {/* Toggle YouTube or MP4 Link input */}
              {!showLinkInput ? (
                <button
                  type="button"
                  onClick={() => setShowLinkInput(true)}
                  className="mt-3 text-xs text-[#00d2ff] hover:underline flex items-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>ওয়েব MP4 বা YouTube Shorts লিংক দিন</span>
                </button>
              ) : (
                <div className="mt-3 w-full p-2.5 bg-[#161a2b] border border-[#2d3450] rounded-xl flex flex-col gap-2 animate-in fade-in">
                  <input
                    type="url"
                    placeholder="https://... direct .mp4 or youtube.com/shorts/..."
                    value={customLinkInput}
                    onChange={(e) => setCustomLinkInput(e.target.value)}
                    className="w-full bg-[#0d101c] border border-[#2d3450] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#606984] focus:outline-none focus:border-[#00d2ff]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLinkInput(false)}
                      className="px-2.5 py-1 text-xs text-[#9da4b8] hover:text-white"
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCustomLink}
                      disabled={!customLinkInput.trim() || isUpdatingSource}
                      className="px-3 py-1 bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                    >
                      সেভ ও প্লে করুন
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : isYouTubeEmbed ? (
            /* YouTube Iframe */
            <iframe
              src={youtubeEmbedUrl}
              title={video.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            /* Standard HTML5 Video Player */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                key={resolvedVideoUrl}
                src={resolvedVideoUrl}
                poster={video.thumbnailUrl}
                controls
                autoPlay
                playsInline
                preload="auto"
                onWaiting={() => {
                  setIsLoadingVideo(true);
                  setTimeout(() => setIsLoadingVideo(false), 4000);
                }}
                onPlaying={() => setIsLoadingVideo(false)}
                onCanPlay={() => setIsLoadingVideo(false)}
                onLoadedMetadata={() => setIsLoadingVideo(false)}
                onLoadedData={() => setIsLoadingVideo(false)}
                onTimeUpdate={() => {
                  if (isLoadingVideo) setIsLoadingVideo(false);
                }}
                onEnded={() => setIsLoadingVideo(false)}
                onError={async (e) => {
                  console.warn('Video element playback error for:', resolvedVideoUrl, e);
                  if (triedIndexedDbRef.current !== video.id && !resolvedVideoUrl.startsWith('blob:')) {
                    triedIndexedDbRef.current = video.id;
                    try {
                      const localBlob = await getLocalVideoBlob(video.id);
                      if (localBlob && localBlob.size > 0) {
                        const activeBlobUrl = URL.createObjectURL(localBlob);
                        setResolvedVideoUrl(activeBlobUrl);
                        setVideoError(false);
                        setIsLoadingVideo(false);
                        tryHealVideoInBackground(localBlob, resolvedVideoUrl, video);
                        return;
                      }
                    } catch {}
                  }
                  if (triedCloudChunksRef.current !== video.id) {
                    triedCloudChunksRef.current = video.id;
                    try {
                      const targetId = extractStreamVideoId(resolvedVideoUrl) || video.id;
                      const cloudBlob = await fetchVideoBlobFromFirestoreChunks(targetId);
                      if (cloudBlob && cloudBlob.size > 0) {
                        saveLocalVideoBlob(video.id, cloudBlob).catch(() => {});
                        setResolvedVideoUrl(URL.createObjectURL(cloudBlob));
                        setVideoError(false);
                        setIsLoadingVideo(false);
                        return;
                      }
                    } catch {}
                  }
                  setVideoError(true);
                  setIsLoadingVideo(false);
                }}
                className="w-full h-full object-contain"
              />
              {isLoadingVideo && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                  <Loader2 className="w-8 h-8 text-[#ff35bb] animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video Footer Actions & Info */}
        <div className="p-4 bg-[#111522] flex flex-wrap items-center justify-between gap-3 border-b border-[#252a3d]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!userProfile?.isLoggedIn || !userProfile?.phone) {
                  soundFX.playPop();
                  if (onRequireLogin) onRequireLogin();
                  else onToggleLike(video.id);
                  return;
                }
                soundFX.playHeart();
                onToggleLike(video.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                video.isLiked
                  ? 'bg-[#ff35bb]/20 text-[#ff35bb] border border-[#ff35bb]/40'
                  : 'bg-[#161a2b] hover:bg-[#1f2642] text-[#9da4b8] hover:text-white border border-[#252a3d]'
              }`}
            >
              <Heart className={`w-4 h-4 ${video.isLiked ? 'fill-[#ff35bb]' : ''}`} />
              <span className="font-mono-numbers">{formatLikes(video.likes, video.slotNumber, video.id)} Likes</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#161a2b] hover:bg-[#1f2642] text-[#9da4b8] hover:text-white border border-[#252a3d] text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>

            {/* If from phone gallery / private, show prominent Upload to Gallery button instead of download! */}
            {video.isPrivatePhoneVideo ? (
              <button
                type="button"
                onClick={handleDirectUploadFromPlayer}
                disabled={isUploadingDirect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:brightness-110 text-white text-xs font-extrabold transition-all shadow-lg shadow-[#ff35bb]/35 active:scale-95 disabled:opacity-50"
                title="এই ভিডিওটি অ্যাপের ভিডিও গ্যালারি স্লটে সংরক্ষণ করুন"
              >
                {isUploadingDirect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>গ্যালারিতে আপলোড করুন (Upload Video)</span>
              </button>
            ) : (
              <button
                onClick={handleDownloadVideo}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/40 hover:to-teal-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-md active:scale-95"
                title="ভিডিও বিজ্ঞাপন দেখে HD ভিডিও ফাইল ডাউনলোড করুন"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>ডাউনলোড (Save Video)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#9da4b8]">
            <span className="font-mono-numbers font-medium">{video.views.toLocaleString()} views</span>
            <span>·</span>
            <span>
              Duration: <b className="text-white font-mono-numbers">{video.duration}</b>
            </span>

            {/* File replacement trigger (Admin only on working videos) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-[#00d2ff] hover:underline flex items-center gap-1 ml-2"
                title="ডিভাইসের নতুন MP4 ফাইল দিয়ে রিপ্লেস করুন"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Replace File</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Banner Ad under Video */}
        <div className="px-4 py-2 bg-[#0c0f1c]">
          <AdBanner slotName="video-modal-bottom" format="compact" config={bannerConfig} />
        </div>
      </div>
    </div>
  );
};
