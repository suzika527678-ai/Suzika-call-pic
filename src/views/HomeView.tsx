import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Heart, Eye, Play, PlusCircle, Flame, Compass, ChevronLeft, ChevronRight, Maximize2, Lock, Smartphone, X } from 'lucide-react';
import { PhotoItem, VideoItem, TabType, CategoryType, AppBannerConfig } from '../types';
import { SuzikaLogo } from '../components/SuzikaLogo';
import { SponsoredBanner } from '../components/SponsoredBanner';
import { AdBanner } from '../components/AdBanner';
import { BannerAd300x250 } from '../components/BannerAd300x250';
import { BannerAd320x50 } from '../components/BannerAd320x50';
import { soundFX } from '../utils/audio';
import { formatLikes, formatViews } from '../utils/formatters';
import { getPhotoFallbackUrl, getVideoThumbnailFallbackUrl, handleImageFallback } from '../utils/mediaFallback';
import { isAuthenticUserPhoto, isAuthenticUserVideo } from '../utils/persistentMediaStore';
import { sortMediaNewestFirst } from '../utils/cloudMediaStore';
import { isPhotoLocked, isVideoLocked } from '../utils/unlockStore';

interface HomeViewProps {
  photos: PhotoItem[];
  videos: VideoItem[];
  onSelectPhoto: (photo: PhotoItem) => void;
  onSelectVideo: (video: VideoItem) => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenUpload: () => void;
  onSelectCategory: (cat: CategoryType) => void;
  bannerConfig?: AppBannerConfig;
  isPwaInstalled?: boolean;
  isInstallable?: boolean;
  onInstallAppClick?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  photos,
  videos,
  onSelectPhoto,
  onSelectVideo,
  onNavigateTab,
  onOpenUpload,
  onSelectCategory,
  bannerConfig,
  isPwaInstalled = false,
  isInstallable = false,
  onInstallAppClick,
}) => {
  type SlideItem =
    | { type: 'photo'; data: PhotoItem }
    | { type: 'video'; data: VideoItem };

  const [sliderFilter, setSliderFilter] = useState<'all' | 'photos' | 'videos'>('all');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissedInstallCard, setDismissedInstallCard] = useState(false);

  // Newest uploaded authentic photos & videos sorted by slotNumber
  const authenticPhotos = photos.filter(isAuthenticUserPhoto);
  const authenticVideos = videos.filter(isAuthenticUserVideo);

  const sortedPhotos = [...authenticPhotos].sort(sortMediaNewestFirst);
  const sortedVideos = [...authenticVideos].sort(sortMediaNewestFirst);

  const allSlideItems: SlideItem[] = [
    ...sortedPhotos.slice(0, 8).map((p) => ({ type: 'photo' as const, data: p })),
    ...sortedVideos.slice(0, 8).map((v) => ({ type: 'video' as const, data: v })),
  ].sort((a, b) => sortMediaNewestFirst(a.data, b.data));

  const sliderItems: SlideItem[] =
    sliderFilter === 'photos'
      ? sortedPhotos.slice(0, 8).map((p) => ({ type: 'photo' as const, data: p }))
      : sliderFilter === 'videos'
      ? sortedVideos.slice(0, 8).map((v) => ({ type: 'video' as const, data: v }))
      : allSlideItems.slice(0, 10);

  useEffect(() => {
    if (isPaused || sliderItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderItems.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [isPaused, sliderItems.length]);

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFX.playPop();
    setCurrentSlide((prev) => (prev === 0 ? sliderItems.length - 1 : prev - 1));
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFX.playPop();
    setCurrentSlide((prev) => (prev + 1) % sliderItems.length);
  };

  // Display newest uploads first so newly created slots are immediately visible on Home (up to 24 in 2-col grid)
  const featuredPhotos = sortedPhotos.slice(0, 24);
  const featuredVideos = sortedVideos.slice(0, 6);

  const categories: { name: CategoryType; icon: string }[] = [
    { name: 'Glamour', icon: '✨' },
    { name: 'Portraits', icon: '👤' },
    { name: 'Nature', icon: '🌿' },
    { name: 'Aesthetic', icon: '🔮' },
    { name: 'Night', icon: '🌙' },
    { name: 'Cinematic', icon: '🎬' },
  ];

  const activeSlide = sliderItems[currentSlide] || sliderItems[0];

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 pb-20 animate-in fade-in duration-300">
      {/* TOP STREAM CONTROLS: Switch between All, Photos, Uploaded Videos */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-[#ff35bb] animate-pulse" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            টপ ফিচার্ড স্ট্রীম (Top Stream)
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-[#111524] p-1 rounded-xl border border-[#252a3d]">
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              setSliderFilter('all');
              setCurrentSlide(0);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              sliderFilter === 'all'
                ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-sm'
                : 'text-[#9da4b8] hover:text-white'
            }`}
          >
            🔥 সব ({authenticPhotos.length + authenticVideos.length})
          </button>
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              setSliderFilter('photos');
              setCurrentSlide(0);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              sliderFilter === 'photos'
                ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-sm'
                : 'text-[#9da4b8] hover:text-white'
            }`}
          >
            📸 ফটো ({authenticPhotos.length})
          </button>
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              setSliderFilter('videos');
              setCurrentSlide(0);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              sliderFilter === 'videos'
                ? 'bg-gradient-to-r from-[#8b4dff] to-[#00d2ff] text-white shadow-sm'
                : 'text-[#9da4b8] hover:text-white'
            }`}
          >
            🎬 ভিডিও ({authenticVideos.length})
          </button>
        </div>
      </div>

      {/* Top 320x50 Mobile Display Banner */}
      <BannerAd320x50 placement="home" />

      {/* LARGE AUTO-ROTATING TOP SLIDESHOW (SHOWS BOTH PHOTOS AND UPLOADED VIDEOS) */}
      {sliderItems.length > 0 && activeSlide && (
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onClick={() => {
            soundFX.playPop();
            if (activeSlide.type === 'photo') {
              onSelectPhoto(activeSlide.data);
            } else {
              onSelectVideo(activeSlide.data);
            }
          }}
          className="relative w-full h-[320px] sm:h-[400px] md:h-[450px] rounded-3xl overflow-hidden border border-[#52376b]/70 shadow-[0_10px_40px_rgba(255,53,187,0.18)] group cursor-pointer bg-[#0b0e18] select-none"
        >
          {/* Ambient blurred glow background */}
          <div
            className="absolute inset-0 opacity-40 blur-2xl scale-110 transition-all duration-700 pointer-events-none"
            style={{ background: activeSlide.data.fallbackGradient || 'linear-gradient(135deg, #ff35bb, #8b4dff)' }}
          />

          {/* Active slide visual */}
          {activeSlide.type === 'photo' ? (
            activeSlide.data.imageUrl && activeSlide.data.imageUrl.trim() !== '' ? (
              <img
                key={activeSlide.data.id}
                src={activeSlide.data.imageUrl}
                alt={activeSlide.data.title || 'Top Photo'}
                referrerPolicy="no-referrer"
                onError={(e) => handleImageFallback(e, getPhotoFallbackUrl((activeSlide.data as any).slotNumber))}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 animate-in fade-in duration-500"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-4xl"
                style={{ background: activeSlide.data.fallbackGradient }}
              >
                📸
              </div>
            )
          ) : (
            /* Video Slide Visual with Center Pulsing Play Button */
            <div className="absolute inset-0">
              {activeSlide.data.thumbnailUrl && activeSlide.data.thumbnailUrl.trim() !== '' ? (
                <img
                  key={activeSlide.data.id}
                  src={activeSlide.data.thumbnailUrl}
                  alt={activeSlide.data.title || 'Top Video'}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageFallback(e, getVideoThumbnailFallbackUrl((activeSlide.data as any).slotNumber))}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: activeSlide.data.fallbackGradient || 'linear-gradient(135deg, #8b4dff, #00d2ff)' }}
                />
              )}

              {/* Pulsing Center Play Button for Videos */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#8b4dff] to-[#00d2ff] p-0.5 shadow-[0_0_35px_rgba(139,77,255,0.7)] group-hover:scale-110 transition-transform">
                  <div className="w-full h-full rounded-full bg-[#0a0d1a]/85 backdrop-blur-md flex items-center justify-center text-white">
                    <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-white ml-1 text-[#00d2ff]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deep cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080a12] via-[#080a12]/30 to-black/40" />

          {/* Top Status & Slot Badges */}
          <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10 pointer-events-none">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md border text-[11px] font-bold uppercase tracking-wider shadow-lg ${
                  activeSlide.type === 'video'
                    ? 'bg-black/75 border-[#8b4dff]/50 text-[#c084fc]'
                    : 'bg-black/75 border-[#ff35bb]/50 text-[#ff8ce4]'
                }`}
              >
                {activeSlide.type === 'video' ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-[#8b4dff] text-[#8b4dff]" />
                    <span>🎬 ভিডিও #{String(currentSlide + 1).padStart(2, '0')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#ff35bb]" />
                    <span>📸 ফটো #{String(currentSlide + 1).padStart(2, '0')}</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] font-mono font-medium">
                {activeSlide.type === 'video'
                  ? `⏱ ${activeSlide.data.duration || '0:30'}`
                  : activeSlide.data.resolution || '4K UltraHD'}
              </span>
              <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:bg-[#ff35bb] transition-colors">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Left / Right Carousel Navigation Buttons */}
          <button
            type="button"
            onClick={handlePrevSlide}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff35bb] text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all opacity-80 hover:opacity-100 active:scale-95 shadow-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNextSlide}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff35bb] text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all opacity-80 hover:opacity-100 active:scale-95 shadow-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Bottom Card Controls - Pure Clean Image, No Title Over Photo */}
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-10">
            <div className="flex items-center justify-between gap-3">
              {/* For Video show duration/likes; For Photo show likes only - NO title text covering image */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-xs text-white flex items-center gap-1.5 font-mono-numbers">
                  <Heart className="w-3.5 h-3.5 text-[#ff35bb] fill-[#ff35bb]" />
                  <span>{formatLikes(activeSlide.data.likes, activeSlide.data.slotNumber, activeSlide.data.id)}</span>
                </span>
              </div>

              {/* View/Play Button */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundFX.playPop();
                    if (activeSlide.type === 'photo') {
                      onSelectPhoto(activeSlide.data);
                    } else {
                      onSelectVideo(activeSlide.data);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-white font-display font-bold text-xs shadow-lg hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5 ${
                    activeSlide.type === 'video'
                      ? 'bg-gradient-to-r from-[#8b4dff] to-[#00d2ff] shadow-[#8b4dff]/40'
                      : 'bg-gradient-to-r from-[#ff35bb] via-[#f72585] to-[#8b4dff] shadow-[#ff35bb]/40'
                  }`}
                >
                  {activeSlide.type === 'video' ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>ভিডিওটি প্লে করুন</span>
                    </>
                  ) : (
                    <>
                      <span>ছবিটি বড় করে দেখুন</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Slider Dots Indicator */}
            <div className="flex items-center justify-center gap-1.5 mt-3 pt-2 border-t border-white/10">
              {sliderItems.map((item, idx) => (
                <button
                  key={item.data.id ? `slide-dot-${item.data.id}` : `slide-dot-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    soundFX.playPop();
                    setCurrentSlide(idx);
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentSlide
                      ? 'w-6 bg-gradient-to-r from-[#ff35bb] to-[#00d2ff] shadow-[0_0_8px_rgba(255,53,187,0.8)]'
                      : 'w-1.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED VIDEOS & REELS ROW */}
      {videos.length > 0 && (
        <div className="w-full max-w-full min-w-0 p-3.5 sm:p-5 rounded-3xl bg-gradient-to-r from-[#191330] via-[#101426] to-[#0d1c2d] border border-[#8b4dff]/40 shadow-xl space-y-3 overflow-hidden">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-[#8b4dff]/20 text-[#c084fc] border border-[#8b4dff]/40 flex items-center justify-center shrink-0">
                <Play className="w-4 h-4 fill-[#c084fc]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-sm text-white truncate">
                  🎬 ভিডিও রিলস ({videos.length})
                </h3>
                <p className="text-[11px] text-[#9da4b8] truncate">ক্লিক করে সরাসরি ফুলস্ক্রিনে প্লে করুন</p>
              </div>
            </div>

            <button
              onClick={() => {
                soundFX.playPop();
                onNavigateTab('videos');
              }}
              className="text-xs font-bold text-[#00d2ff] hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <span>সব ভিডিও ({videos.length}) →</span>
            </button>
          </div>

          {/* Horizontal Reel Cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar w-full max-w-full">
            {sortedVideos.slice(0, 10).map((vid) => (
              <div
                key={vid.id}
                onClick={() => {
                  soundFX.playPop();
                  onSelectVideo(vid);
                }}
                className="min-w-[170px] sm:min-w-[200px] rounded-2xl overflow-hidden aspect-[9/14] bg-[#0c0f1c] border border-[#252a3d] hover:border-[#8b4dff] transition-all cursor-pointer group relative flex flex-col justify-between p-3 select-none shrink-0 shadow-lg"
              >
                {/* Background Video Poster */}
                {vid.thumbnailUrl ? (
                  <img
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageFallback(e, getVideoThumbnailFallbackUrl(vid.slotNumber))}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: vid.fallbackGradient || 'linear-gradient(135deg, #8b4dff, #00d2ff)' }}
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/50" />

                {/* Top Badge */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono-numbers text-white font-bold border border-white/20">
                    Slot #{vid.slotNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#8b4dff]/80 text-[10px] font-bold text-white">
                    {vid.duration || '0:30'}
                  </span>
                </div>

                {/* Center Play Icon */}
                <div className="relative z-10 mx-auto w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#8b4dff] transition-all">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>

                {/* Bottom Title & Stats */}
                <div className="relative z-10 space-y-1">
                  <h4 className="font-bold text-xs text-white leading-tight truncate drop-shadow">
                    {vid.title}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-[#9da4b8]">
                    <span>{vid.category || 'Reel'}</span>
                    <span className="flex items-center gap-1 text-white font-mono-numbers">
                      <Heart className="w-3 h-3 text-[#ff35bb] fill-[#ff35bb]" />
                      {formatLikes(vid.likes, vid.slotNumber, vid.id)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#27103d] via-[#14182b] to-[#20153f] border border-[#52376b] shadow-xl">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-44 h-44 rounded-full bg-gradient-to-br from-[#ff35bb]/15 to-[#8b4dff]/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff35bb]/20 border border-[#ff35bb]/40 text-[#ff8ce4] text-[11px] font-bold tracking-wide uppercase mb-2">
            <Flame className="w-3.5 h-3.5" />
            <span>{bannerConfig?.heroTagline || 'Suzika Call Pic Official'}</span>
          </div>

          <h1 className="font-display text-xl sm:text-2xl font-black text-white leading-tight tracking-tight mb-2">
            {bannerConfig?.heroTitle || 'Your daily dose of'} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff35bb] via-[#f76ca0] to-[#8b4dff]">
              {bannerConfig?.heroHighlight || 'photos & videos.'}
            </span>
          </h1>

          <p className="text-xs text-[#d5cce7] leading-relaxed mb-4 max-w-md">
            {bannerConfig?.heroSubtitle || 'Discover the ultimate gallery, inspect HD slots, share community comments, and stay connected with creators.'}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                soundFX.playPop();
                onNavigateTab('gallery');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white font-display font-bold text-xs tracking-wide shadow-md shadow-[#ff35bb]/30 hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>সব ফটো দেখুন ({photos.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                soundFX.playPop();
                onNavigateTab('profile');
              }}
              className="px-4 py-2 rounded-xl bg-[#161a2b]/90 hover:bg-[#20263f] text-[#00d2ff] border border-[#3b4260] font-display font-semibold text-xs tracking-wide transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#ff35bb]" />
              <span>সুজিকার সাথে চ্যাট করুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats row displaying real uploaded media counts */}
      <div className="grid grid-cols-3 gap-2.5">
        <div 
          onClick={() => onNavigateTab('gallery')}
          className="cursor-pointer p-3.5 rounded-2xl bg-[#111522] border border-[#252a3d] hover:border-[#ff35bb]/40 transition-all group"
        >
          <div className="font-display font-black text-xl text-white group-hover:text-[#ff35bb] transition-colors font-mono-numbers">
            {photos.length}
          </div>
          <div className="text-[11px] font-medium text-[#9da4b8] mt-0.5">Uploaded photos</div>
          <div className="text-[10px] text-emerald-400 font-mono-numbers mt-1">
            {photos.length} active
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('videos')}
          className="cursor-pointer p-3.5 rounded-2xl bg-[#111522] border border-[#252a3d] hover:border-[#8b4dff]/40 transition-all group"
        >
          <div className="font-display font-black text-xl text-white group-hover:text-[#8b4dff] transition-colors font-mono-numbers">
            50
          </div>
          <div className="text-[11px] font-medium text-[#9da4b8] mt-0.5">Video slots</div>
          <div className="text-[10px] text-[#00d2ff] font-mono-numbers mt-1">
            {videos.length} active
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('private')}
          className="cursor-pointer p-3.5 rounded-2xl bg-[#111522] border border-[#252a3d] hover:border-[#ff35bb]/45 transition-all group"
        >
          <div className="font-display font-black text-xl text-white group-hover:text-[#ff35bb] transition-colors font-mono-numbers">
            18+
          </div>
          <div className="text-[11px] font-medium text-[#9da4b8] mt-0.5">Private VIP</div>
          <div className="text-[10px] text-[#ff35bb] font-mono-numbers mt-1">
            Global Adult
          </div>
        </div>
      </div>

      {/* Compact 1-Tap Phone App Install Card (automatically hidden once opened as installed app) */}
      {!isPwaInstalled && !dismissedInstallCard && onInstallAppClick && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-[#141a33] via-[#121629] to-[#1e1233] border border-[#00d2ff]/35 shadow-lg shadow-[#00d2ff]/10 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <SuzikaLogo size="sm" className="shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-white truncate">
                ফোনে অ্যাপ হিসেবে ব্যবহার করুন
              </div>
              <div className="text-[10px] text-[#9da4b8] truncate">
                {isInstallable
                  ? '১-ক্লিকে ফোনের হোমস্ক্রিনে সরাসরি ইনস্টল হবে'
                  : 'ব্রাউজার মেনু ছাড়াই দ্রুত ও ফুল-স্ক্রিনে চালাতে ইনস্টল করুন'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundFX.playSuccess();
                onInstallAppClick();
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#00d2ff] hover:brightness-110 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>ইনস্টল</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissedInstallCard(true)}
              aria-label="Dismiss install banner"
              className="p-1.5 rounded-lg text-[#9da4b8] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Category Rail */}
      <div className="w-full max-w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#d5cce7]">
            <Compass className="w-3.5 h-3.5 text-[#ff35bb]" />
            <span>Featured Vibes</span>
          </div>
          <button
            onClick={() => onNavigateTab('gallery')}
            className="text-[11px] text-[#9da4b8] hover:text-white"
          >
            All categories →
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full max-w-full">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => {
                soundFX.playPop();
                onSelectCategory(cat.name);
                onNavigateTab('gallery');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151a2d] hover:bg-[#202742] border border-[#252a3d] text-xs font-medium text-[#f7f7fb] whitespace-nowrap active:scale-95 transition-all"
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sponsored Slot (matching original HTML spec) */}
      <SponsoredBanner config={bannerConfig} />

      {/* Featured Photos Section (3-Column Grid matching original prototype) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-base font-bold text-white">Featured Photos</h2>
            <p className="text-[11px] text-[#9da4b8]">Curated slots & trending previews</p>
          </div>
          <button
            onClick={() => {
              soundFX.playPop();
              onNavigateTab('gallery');
            }}
            className="text-xs font-semibold text-[#ff35bb] hover:underline"
          >
            সব ছবি দেখুন ({photos.length}) →
          </button>
        </div>

        {/* 2 Pictures per line grid with periodic in-feed banner ads while scrolling */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-2xl mx-auto">
          {featuredPhotos.map((photo, idx) => {
            const isLocked = isPhotoLocked(photo, bannerConfig);
            const showScrollAd = (idx + 1) % 8 === 0 && idx < featuredPhotos.length - 1;
            const adStep = Math.floor((idx + 1) / 8);
            return (
              <React.Fragment key={photo.id ? `${photo.id}-${idx}` : `featured-photo-${idx}`}>
                <div
                  onClick={() => {
                    soundFX.playPop();
                    onSelectPhoto(photo);
                  }}
                  className={`aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden relative cursor-pointer group border bg-[#161a2b] shadow-lg transition-all active:scale-[0.98] ${
                    isLocked
                      ? 'border-amber-500/40 hover:border-amber-500/80 shadow-amber-500/10'
                      : 'border-[#252a3d] hover:border-[#ff35bb]/70 hover:shadow-[#ff35bb]/20'
                  }`}
                >
                  {/* Fallback stylized gradient */}
                  <div
                    className="absolute inset-0"
                    style={{ background: photo.fallbackGradient || 'linear-gradient(135deg, #2d3654, #a13c8c)' }}
                  />

                  {/* Pure Clean Photo - Blurred if locked */}
                  {photo.imageUrl && photo.imageUrl.trim() !== '' ? (
                    <img
                      src={photo.imageUrl}
                      alt={photo.title || 'Photo'}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => handleImageFallback(e, getPhotoFallbackUrl(photo.slotNumber))}
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
                        isLocked ? 'blur-xl scale-125 opacity-70' : 'group-hover:scale-105'
                      }`}
                    />
                  ) : null}

                  {/* Subtle shine overlay */}
                  {!isLocked && (
                    <div className="absolute inset-0 photo-shine-overlay opacity-60 group-hover:opacity-40 transition-opacity" />
                  )}

                  {/* Lock Overlay on Home Featured */}
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-2 text-center z-20 space-y-1.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff35bb]/30 to-amber-500/30 border border-[#ff35bb]/50 text-[#ff35bb] flex items-center justify-center shadow-lg animate-pulse">
                        <Lock className="w-4 h-4 text-amber-400" />
                      </div>
                      <span className="text-[10px] font-bold text-[#ff80d5] block drop-shadow">
                        🔞 {photo.category} ব্লার
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-[9px] font-extrabold shadow">
                        দেখতে ৩০s বিজ্ঞাপন দেখুন
                      </span>
                    </div>
                  )}

                  {/* Subtle bottom gradient for contrast */}
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                  {/* Clean Bottom Bar: ONLY Likes and Views ~1k */}
                  <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none z-10 text-[10px] font-mono-numbers text-white drop-shadow">
                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                      <Heart className={`w-3 h-3 ${photo.isLiked ? 'fill-[#ff35bb] text-[#ff35bb]' : 'text-[#ff35bb]'}`} />
                      <span>{formatLikes(photo.likes, photo.slotNumber, photo.id)}</span>
                    </div>

                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-white/90">
                      <Eye className="w-3 h-3 text-[#00d2ff]" />
                      <span>{formatViews(photo.views, photo.slotNumber || (idx + 1))}</span>
                    </div>
                  </div>
                </div>

                {showScrollAd && (
                  <div className="col-span-full my-1">
                    {adStep % 3 === 1 ? (
                      <BannerAd320x50 placement={`home-scroll-${adStep}`} />
                    ) : adStep % 3 === 2 ? (
                      <BannerAd300x250 placement={`home-scroll-${adStep}`} />
                    ) : (
                      <AdBanner slotName={`home-scroll-${adStep}`} format="infeed" config={bannerConfig} />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {sortedPhotos.length > featuredPhotos.length && (
          <div className="mt-4 text-center max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                onNavigateTab('gallery');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#161a2b] hover:bg-[#1e243b] border border-[#252a3d] hover:border-[#ff35bb]/60 text-xs font-bold text-[#ff80d5] transition-all active:scale-[0.99]"
            >
              আরও সব ছবি দেখুন ({sortedPhotos.length - featuredPhotos.length}+ বাকি আছে) →
            </button>
          </div>
        )}
      </section>

      {/* 300x250 Display Banner Advertisement (Home) */}
      <BannerAd300x250 placement="home" />

      {/* Middle Native Ad Banner (AdMob / Sponsor Network) */}
      <AdBanner slotName="home-middle" format="native" config={bannerConfig} />

      {/* Featured Video Reels */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-base font-bold text-white">Video Reels</h2>
            <p className="text-[11px] text-[#9da4b8]">Short clips & cinematic visuals</p>
          </div>
          <button
            onClick={() => {
              soundFX.playPop();
              onNavigateTab('videos');
            }}
            className="text-xs font-semibold text-[#8b4dff] hover:underline"
          >
            All 50 video slots →
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-2xl mx-auto">
          {featuredVideos.map((video, idx) => (
            <div
              key={video.id ? `${video.id}-${idx}` : `featured-video-${idx}`}
              onClick={() => {
                soundFX.playPop();
                onSelectVideo(video);
              }}
              className="relative rounded-xl sm:rounded-2xl overflow-hidden aspect-[16/10] bg-[#161a2b] border border-[#252a3d] cursor-pointer group hover:border-[#8b4dff]/60 transition-all"
            >
              <div
                className="absolute inset-0"
                style={{ background: video.fallbackGradient || 'linear-gradient(135deg, #8b4dff, #00d2ff)' }}
              />
              {video.thumbnailUrl && video.thumbnailUrl.trim() !== '' ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title || 'Video'}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={(e) => handleImageFallback(e, getVideoThumbnailFallbackUrl(video.slotNumber))}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Play Badge */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/60 group-hover:bg-[#ff35bb] text-white flex items-center justify-center backdrop-blur-md transition-all group-hover:scale-110 shadow-lg">
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </div>
              </div>

              {/* Video metadata tags */}
              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-mono-numbers text-white font-bold">
                {video.duration || '0:15'}
              </div>

              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {video.title}
                </p>
                <p className="text-[10px] text-[#9da4b8] font-mono-numbers">
                  Slot #{String(video.slotNumber).padStart(2, '0')} · {video.views.toLocaleString()} views
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Real Google Ad Banner */}
      <AdBanner slotName="home-bottom" format="banner" config={bannerConfig} />
    </div>
  );
};
