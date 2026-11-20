import React, { useState, useRef } from 'react';
import { Play, Plus, Film, Heart, Eye, Download, Trash2, Smartphone, Lock, Award, Upload } from 'lucide-react';
import { VideoItem, CategoryType, AppBannerConfig } from '../types';
import { soundFX } from '../utils/audio';
import { AdBanner } from '../components/AdBanner';
import { BannerAd300x250 } from '../components/BannerAd300x250';
import { BannerAd320x50 } from '../components/BannerAd320x50';
import { triggerMediaDownload } from '../utils/downloadHelper';
import { formatLikes } from '../utils/formatters';
import { isVideoLocked } from '../utils/unlockStore';
import { getLocalVideoBlob } from '../utils/videoStorage';
import { getVideoThumbnailFallbackUrl, handleImageFallback } from '../utils/mediaFallback';
import { isAuthenticUserVideo } from '../utils/persistentMediaStore';
import { sortMediaNewestFirst, fetchVideoBlobFromFirestoreChunks, extractStreamVideoId } from '../utils/cloudMediaStore';

interface VideoViewProps {
  videos: VideoItem[];
  onSelectVideo: (video: VideoItem) => void;
  onOpenUpload: () => void;
  searchQuery: string;
  showUpload?: boolean;
  bannerConfig?: AppBannerConfig;
  isAdmin?: boolean;
  onDeleteVideo?: (videoId: string) => void;
  onRequestUnlockVideo?: (video: VideoItem) => void;
  onRequestDownloadVideo?: (video: VideoItem, onEarnedReward: () => void) => void;
}

const CATEGORIES: CategoryType[] = [
  'All',
  'Aesthetic',
  'Nature',
  'Night',
  'Cinematic',
  'Glamour',
];

export const VideoView: React.FC<VideoViewProps> = ({
  videos,
  onSelectVideo,
  onOpenUpload,
  searchQuery,
  showUpload = false,
  bannerConfig,
  isAdmin = false,
  onDeleteVideo,
  onRequestUnlockVideo,
  onRequestDownloadVideo,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [visibleCount, setVisibleCount] = useState(24);
  const privateFileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setVisibleCount(24);
  }, [selectedCategory, searchQuery]);

  const handlePlayPrivatePhoneVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const privateItem: VideoItem = {
      id: `private-local-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      category: 'All',
      videoUrl: objectUrl,
      thumbnailUrl: '',
      fallbackGradient: 'linear-gradient(135deg, #8b4dff, #00d2ff)',
      duration: 'Gallery',
      views: 1,
      likes: 1,
      author: 'Phone Gallery',
      slotNumber: 0,
      tags: ['Private', 'Local'],
      createdAt: 'Just now',
      videoType: 'direct',
      isPrivatePhoneVideo: true,
      isLocked: false,
    };
    (privateItem as any).rawFile = file;
    soundFX.playSuccess();
    onSelectVideo(privateItem);
    if (privateFileInputRef.current) privateFileInputRef.current.value = '';
  };

  const filtered = videos.filter((video) => {
    if (!video || !isAuthenticUserVideo(video)) return false;
    if (selectedCategory !== 'All' && video.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (video.title || '').toLowerCase().includes(q);
      const matchTag = Array.isArray(video.tags) && video.tags.some((t) => (t || '').toLowerCase().includes(q));
      const matchAuthor = (video.author || '').toLowerCase().includes(q);
      if (!matchTitle && !matchTag && !matchAuthor) return false;
    }
    return true;
  });

  // Sort newest uploaded videos first so newly added slots appear at the top
  const sortedVideos = [...filtered].sort(sortMediaNewestFirst);

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Title & 50 Slots counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#252a3d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-white">Video Gallery</h1>
            <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#8b4dff]/15 border border-[#8b4dff]/30 text-[#c084fc] font-bold">
              {videos.length} / 500 Slots
            </span>
          </div>
          <p className="text-xs text-[#9da4b8] mt-0.5">
            High definition video clips, cinematic loops & reels. Tap any slot to stream.
          </p>
        </div>

        {/* Action Controls: Upload Video & Phone Play */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Direct Video Upload Button */}
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              onOpenUpload();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:brightness-110 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-[#ff35bb]/25 active:scale-95 transition-all"
            title="নতুন ভিডিও গ্যালারিতে আপলোড ও পাবলিশ করুন"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>ভিডিও আপলোড করুন (Upload Video)</span>
          </button>

          {/* Play from Phone Gallery Privately */}
          <input
            type="file"
            ref={privateFileInputRef}
            accept="video/*"
            onChange={handlePlayPrivatePhoneVideo}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              privateFileInputRef.current?.click();
            }}
            className="px-3 py-1.5 rounded-xl bg-[#151a2d] hover:bg-[#1f2642] text-[#9da4b8] hover:text-white border border-[#252a3d] text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            title="আপনার ফোনের যেকোনো পার্সোনাল ভিডিও সরাসরি প্লেয়ারে চালান"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#00d2ff]" />
            <span>📱 ফোন থেকে প্লে</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                soundFX.playPop();
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#8b4dff] to-[#00d2ff] text-white shadow-md shadow-[#8b4dff]/30'
                  : 'bg-[#151a2d] text-[#9da4b8] hover:text-white hover:bg-[#1f2642] border border-[#252a3d]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Top 320x50 Mobile Display Banner in Video Reels */}
      <BannerAd320x50 placement="videos" />

      {/* Video Grid: 2 videos per line */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full max-w-2xl mx-auto">
        {sortedVideos.slice(0, visibleCount).map((video, index) => {
          const isLocked = isVideoLocked(video, bannerConfig);

          return (
            <React.Fragment key={video.id ? `video-${video.id}` : `video-slot-${video.slotNumber}-${index}`}>
              <div
                onClick={() => {
                  soundFX.playPop();
                  if (isLocked) {
                    if (onRequestUnlockVideo) onRequestUnlockVideo(video);
                  } else {
                    onSelectVideo(video);
                  }
                }}
                className={`group relative rounded-xl sm:rounded-2xl overflow-hidden bg-[#151a2d] border cursor-pointer transition-all flex flex-col shadow-md ${
                  isLocked
                    ? 'border-amber-500/40 hover:border-amber-500/70 shadow-amber-500/10'
                    : 'border-[#252a3d] hover:border-[#8b4dff]/60'
                }`}
              >
                {/* Thumbnail aspect */}
                <div className="relative aspect-video bg-[#0b0e18] overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{ background: video.fallbackGradient || 'linear-gradient(135deg, #1b2138, #5a1c72)' }}
                  />
                  {video.thumbnailUrl && video.thumbnailUrl.trim() !== '' ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title || 'Video'}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => handleImageFallback(e, getVideoThumbnailFallbackUrl(video.slotNumber))}
                      className={`w-full h-full object-cover transition-transform duration-300 ${
                        isLocked ? 'blur-md scale-110 opacity-55' : 'group-hover:scale-105 opacity-90'
                      }`}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  {/* Play Icon or Locked Overlay */}
                  {!isLocked ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-black/60 group-hover:bg-[#ff35bb] text-white flex items-center justify-center backdrop-blur-md transition-all group-hover:scale-110 shadow-lg">
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center z-20 space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Lock className="w-4 h-4 text-amber-400" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundFX.playPop();
                          if (onRequestUnlockVideo) onRequestUnlockVideo(video);
                        }}
                        className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 via-[#ff35bb] to-[#8b4dff] hover:opacity-95 text-white text-[9px] font-extrabold shadow-md shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-1 border border-white/20"
                      >
                        <Award className="w-3 h-3 text-amber-200 fill-amber-200" />
                        <span>Watch Ad to Unlock</span>
                      </button>
                    </div>
                  )}

                  {/* Top slot pill */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-mono-numbers text-white/90">
                    Slot #{String(video.slotNumber).padStart(2, '0')}/500
                  </div>

                {/* Direct Download Button */}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const runDownload = async () => {
                      soundFX.playSuccess();
                      const filename = `SUZIKA_${(video.title || 'Video').replace(/\s+/g, '_')}_Slot${video.slotNumber}.mp4`;
                      let targetUrl = video.videoUrl;
                      if (!targetUrl || targetUrl === 'local-blob' || targetUrl === 'local-indexeddb' || (!targetUrl.startsWith('http') && !targetUrl.startsWith('data:') && !targetUrl.startsWith('blob:') && !targetUrl.startsWith('/'))) {
                        const blob = (await getLocalVideoBlob(video.id)) || (await fetchVideoBlobFromFirestoreChunks(video.id));
                        if (blob) {
                          targetUrl = URL.createObjectURL(blob);
                        }
                      } else if (targetUrl.startsWith('/api/video-stream/')) {
                        try {
                          const headRes = await fetch(targetUrl, { method: 'HEAD' });
                          if (!headRes.ok) {
                            const chunkId = extractStreamVideoId(targetUrl) || video.id;
                            const blob = (await getLocalVideoBlob(video.id)) || (await fetchVideoBlobFromFirestoreChunks(chunkId));
                            if (blob) targetUrl = URL.createObjectURL(blob);
                          }
                        } catch {}
                      }
                      if (targetUrl) {
                        await triggerMediaDownload(targetUrl, filename);
                      }
                    };
                    if (bannerConfig?.enableAds !== false && bannerConfig?.requireAdForDownloads !== false && onRequestDownloadVideo) {
                      soundFX.playPop();
                      onRequestDownloadVideo(video, () => {
                        runDownload();
                      });
                    } else {
                      await runDownload();
                    }
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/70 hover:bg-emerald-600 text-emerald-400 hover:text-white flex items-center justify-center backdrop-blur-md transition-all shadow-md z-10"
                  title="ভিডিও ডাউনলোড করুন (Download Video)"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {/* Admin Delete Video Button */}
                {isAdmin && onDeleteVideo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFX.playPop();
                      onDeleteVideo(video.id);
                    }}
                    className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-red-900/70 hover:bg-red-600 text-red-300 hover:text-white flex items-center justify-center backdrop-blur-md transition-all shadow-md z-10 active:scale-95"
                    title="সরাসরি ভিডিও ডিলিট করুন (Delete Video)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[9px] font-mono-numbers text-white font-semibold">
                  ▶ {video.duration}
                </div>
              </div>

              {/* Video Card Details */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-display font-bold text-xs text-white line-clamp-1 group-hover:text-[#ff35bb] transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-[11px] text-[#9da4b8] mt-0.5">{video.author} · {video.category}</p>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#9da4b8] pt-2 border-t border-[#252a3d]/60 mt-2 font-mono-numbers">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-[#00d2ff]" />
                    {video.views.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className={`w-3 h-3 ${video.isLiked ? 'text-[#ff35bb] fill-[#ff35bb]' : ''}`} />
                    {formatLikes(video.likes, video.slotNumber, video.id)}
                  </span>
                </div>
              </div>
            </div>

            {/* In-feed Video Ad Banner every 4 videos */}
            {(index + 1) % 4 === 0 && (
              <div className="col-span-full">
                <AdBanner slotName={`video-infeed-${index}`} format="infeed" config={bannerConfig} title="Sponsored High-CPM Video Ad" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>

      {sortedVideos.length > visibleCount && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              setVisibleCount((c) => c + 24);
            }}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#8b4dff]/20 to-[#00d2ff]/20 hover:from-[#8b4dff]/35 hover:to-[#00d2ff]/35 border border-[#8b4dff]/40 text-xs font-extrabold text-white transition-all"
          >
            আরও ভিডিও দেখুন (+24 · {sortedVideos.length - visibleCount}টি বাকি)
          </button>
        </div>
      )}

      {/* 300x250 Display Banner Advertisement (Videos) */}
      <BannerAd300x250 placement="videos" />

      {/* Bottom Ad Banner */}
      <AdBanner slotName="video-bottom" format="banner" config={bannerConfig} />
    </div>
  );
};
