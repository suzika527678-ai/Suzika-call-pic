import React, { useState } from 'react';
import { Heart, Search, Filter, Plus, Sparkles, Layers, Download, Eye, Lock, Award } from 'lucide-react';
import { PhotoItem, CategoryType, AppBannerConfig, UserProfile } from '../types';
import { soundFX } from '../utils/audio';
import { AdBanner } from '../components/AdBanner';
import { BannerAd300x250 } from '../components/BannerAd300x250';
import { BannerAd320x50 } from '../components/BannerAd320x50';
import { triggerMediaDownload } from '../utils/downloadHelper';
import { formatLikes, formatViews } from '../utils/formatters';
import { isPhotoLocked } from '../utils/unlockStore';
import { getPhotoFallbackUrl, handleImageFallback } from '../utils/mediaFallback';
import { isAuthenticUserPhoto } from '../utils/persistentMediaStore';
import { sortMediaNewestFirst } from '../utils/cloudMediaStore';
import { getDynamicObjectPositionClass } from '../utils/imageFraming';

interface GalleryViewProps {
  photos: PhotoItem[];
  onSelectPhoto: (photo: PhotoItem) => void;
  selectedCategory: CategoryType | 'Favorites';
  onSelectCategory: (cat: CategoryType | 'Favorites') => void;
  onOpenUpload: () => void;
  searchQuery: string;
  showUpload?: boolean;
  bannerConfig?: AppBannerConfig;
  userProfile?: UserProfile;
  onToggleLike?: (photoId: string) => void;
  onRequireLogin?: () => void;
  onRequestUnlockPhoto?: (photo: PhotoItem) => void;
}

const CATEGORIES: (CategoryType | 'Favorites')[] = [
  'All',
  'Style',
  'Hot',
  'Sexy',
  'Call',
  'Glamour',
  'Portraits',
  'Nature',
  'Aesthetic',
  'Cinematic',
  'Night',
  'Urban',
  'Favorites'
];

export const GalleryView: React.FC<GalleryViewProps> = ({
  photos,
  onSelectPhoto,
  selectedCategory,
  onSelectCategory,
  onOpenUpload,
  searchQuery,
  showUpload = false,
  bannerConfig,
  userProfile,
  onToggleLike,
  onRequireLogin,
  onRequestUnlockPhoto,
}) => {
  const [sortBy, setSortBy] = useState<'newest' | 'slot' | 'likes' | 'views'>('newest');
  const [visibleCount, setVisibleCount] = useState(24);
  const [objectPositions, setObjectPositions] = useState<Record<string, string>>({});

  React.useEffect(() => {
    setVisibleCount(24);
  }, [selectedCategory, searchQuery, sortBy]);

  // Filter photos
  const filtered = photos.filter((photo) => {
    if (!photo || !isAuthenticUserPhoto(photo)) return false;
    if (selectedCategory === 'Favorites') {
      if (!photo.isLiked) return false;
    } else if (selectedCategory !== 'All') {
      if (photo.category !== selectedCategory) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (photo.title || '').toLowerCase().includes(q);
      const matchTag = Array.isArray(photo.tags) && photo.tags.some((t) => (t || '').toLowerCase().includes(q));
      const matchCat = (photo.category || '').toLowerCase().includes(q);
      const matchAuthor = (photo.author || '').toLowerCase().includes(q);
      if (!matchTitle && !matchTag && !matchCat && !matchAuthor) return false;
    }

    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return sortMediaNewestFirst(a, b);
    if (sortBy === 'likes') return b.likes - a.likes;
    if (sortBy === 'views') return b.views - a.views;
    return (a.slotNumber || 0) - (b.slotNumber || 0);
  });

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Title & Slot Capacity Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#252a3d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-white">Photo Gallery</h1>
            <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#ff35bb]/15 border border-[#ff35bb]/30 text-[#ff8ce4] font-bold">
              {photos.length} টি ফটো
            </span>
          </div>
          <p className="text-xs text-[#9da4b8] mt-0.5">
            আপনার আপলোড করা সমস্ত এইচডি ফটো গ্যালারি
          </p>
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
                onSelectCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-md shadow-[#ff35bb]/30'
                  : 'bg-[#151a2d] text-[#9da4b8] hover:text-white hover:bg-[#1f2642] border border-[#252a3d]'
              }`}
            >
              {cat === 'Favorites' ? '❤️ Favorites' : cat}
            </button>
          );
        })}
      </div>

      {/* Top 320x50 Mobile Display Banner in Gallery */}
      <BannerAd320x50 placement="gallery" />

      {/* Controls Bar: Results count & Sort */}
      <div className="flex items-center justify-between text-xs text-[#9da4b8]">
        <div>
          Showing <span className="text-white font-mono-numbers font-bold">{sorted.length}</span> photos
          {searchQuery && <span> for &ldquo;{searchQuery}&rdquo;</span>}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'slot' | 'likes' | 'views')}
            className="bg-[#111522] border border-[#252a3d] text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
          >
            <option value="newest">✨ Newest First (Uploaded)</option>
            <option value="slot">Slot Number (1-500)</option>
            <option value="likes">Most Liked</option>
            <option value="views">Most Views</option>
          </select>
        </div>
      </div>

      {/* Photos Grid: 3 columns matching original prototype */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 bg-[#111522] border border-dashed border-[#252a3d] rounded-2xl p-6">
          <Layers className="w-8 h-8 text-[#9da4b8] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-white mb-1">No photos in this view</h3>
          <p className="text-xs text-[#9da4b8] max-w-xs mx-auto mb-4">
            {selectedCategory === 'Favorites'
              ? "You haven't liked any photos yet. Tap the heart icon on any photo to save it here!"
              : 'Try clearing your search query or upload a new photo to this category.'}
          </p>
          {showUpload && (
            <button
              onClick={() => {
                soundFX.playPop();
                onOpenUpload();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold"
            >
              Upload a Photo
            </button>
          )}
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full max-w-2xl mx-auto">
          {sorted.slice(0, visibleCount).map((photo, index) => {
            const isLocked = isPhotoLocked(photo, bannerConfig);
            const photoKey = photo.id || `slot-${photo.slotNumber}-${index}`;
            const objectPosClass = objectPositions[photoKey] || 'object-[50%_24%]';

            return (
              <React.Fragment key={photo.id ? `gallery-photo-${photo.id}` : `gallery-slot-${photo.slotNumber}-${index}`}>
                <div
                  onClick={() => {
                    soundFX.playPop();
                    if (isLocked) {
                      if (onRequestUnlockPhoto) onRequestUnlockPhoto(photo);
                    } else {
                      onSelectPhoto(photo);
                    }
                  }}
                  className={`aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden relative flex items-center justify-center cursor-pointer group border bg-[#161a2b] shadow-lg transition-all active:scale-[0.98] ${
                    isLocked
                      ? 'border-amber-500/40 hover:border-amber-500/70 shadow-amber-500/10'
                      : 'border-[#252a3d] hover:border-[#ff35bb]/70 hover:shadow-[#ff35bb]/20'
                  }`}
                >
                  {/* Fallback stylized gradient */}
                  <div
                    className="absolute inset-0"
                    style={{ background: photo.fallbackGradient || 'linear-gradient(135deg, #1f253d, #622055)' }}
                  />

                  {/* Pure Clean Photo - Blurred if locked */}
                  {photo.imageUrl && photo.imageUrl.trim() !== '' ? (
                    <img
                      src={photo.imageUrl}
                      alt={photo.title || 'Photo'}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const computed = getDynamicObjectPositionClass(
                          img.naturalWidth,
                          img.naturalHeight,
                          img.clientWidth || 3,
                          img.clientHeight || 4
                        );
                        setObjectPositions((prev) =>
                          prev[photoKey] === computed ? prev : { ...prev, [photoKey]: computed }
                        );
                      }}
                      onError={(e) => handleImageFallback(e, getPhotoFallbackUrl(photo.slotNumber))}
                      className={`absolute inset-0 w-full h-full object-cover ${objectPosClass} transition-all duration-300 ${
                        isLocked ? 'blur-xl scale-125 opacity-70' : 'group-hover:scale-105'
                      }`}
                    />
                  ) : null}

                  {/* Subtle shine overlay */}
                  {!isLocked && (
                    <div className="absolute inset-0 photo-shine-overlay opacity-60 group-hover:opacity-40 transition-opacity" />
                  )}

                  {/* Lock Overlay with "Watch Ad to Unlock" Button (30s Ad Requirement) */}
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-md flex flex-col items-center justify-center p-3 text-center z-20 space-y-2">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#ff35bb]/30 to-amber-500/30 border border-[#ff35bb]/50 text-[#ff35bb] flex items-center justify-center shadow-lg shadow-[#ff35bb]/20 animate-pulse">
                        <Lock className="w-5 h-5 text-amber-400" />
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] font-extrabold text-[#ff80d5] block drop-shadow flex items-center justify-center gap-1">
                          <span>🔞</span>
                          <span>{photo.category} ব্লার করা কন্টেন্ট</span>
                        </span>
                        <span className="text-[10px] text-[#b8bfd2] block">
                          দেখতে ৩০ সেকেন্ড বিজ্ঞাপন দেখুন
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundFX.playPop();
                          if (onRequestUnlockPhoto) onRequestUnlockPhoto(photo);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] hover:opacity-95 text-white text-[10px] font-extrabold shadow-lg shadow-[#ff35bb]/30 active:scale-95 transition-all flex items-center gap-1.5 border border-white/20"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
                        <span>আনলক করুন (30s Ad)</span>
                      </button>
                    </div>
                  )}

                  {/* Subtle bottom gradient for contrast */}
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                  {/* Clean Bottom Bar: ONLY Likes and Views ~1k as requested */}
                  <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between z-10 text-[10px] font-mono-numbers text-white drop-shadow">
                    {/* Like Counter */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!userProfile?.isLoggedIn || !userProfile?.phone) {
                          soundFX.playPop();
                          if (onRequireLogin) onRequireLogin();
                          return;
                        }
                        soundFX.playHeart();
                        if (onToggleLike) onToggleLike(photo.id);
                      }}
                      className="flex items-center gap-1 bg-black/60 hover:bg-[#ff35bb]/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 active:scale-95 transition-all cursor-pointer pointer-events-auto"
                      title={userProfile?.isLoggedIn ? 'লাইক দিন' : 'লাইক দিতে লগইন করুন'}
                    >
                      <Heart className={`w-3 h-3 ${photo.isLiked ? 'fill-[#ff35bb] text-[#ff35bb]' : 'text-[#ff35bb]'}`} />
                      <span>{formatLikes(photo.likes, photo.slotNumber, photo.id)}</span>
                    </button>

                    {/* Views Counter (showing ~1k) */}
                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-white/90 pointer-events-none">
                      <Eye className="w-3 h-3 text-[#00d2ff]" />
                      <span>{formatViews(photo.views, photo.slotNumber)}</span>
                    </div>
                  </div>
                </div>

              {/* In-Feed Banner Ad periodically every 8 photos while scrolling */}
              {(index + 1) % 8 === 0 && index < sorted.length - 1 && (
                <div className="col-span-full my-1">
                  {Math.floor((index + 1) / 8) % 3 === 1 ? (
                    <BannerAd320x50 placement={`gallery-scroll-${Math.floor((index + 1) / 8)}`} />
                  ) : Math.floor((index + 1) / 8) % 3 === 2 ? (
                    <BannerAd300x250 placement={`gallery-scroll-${Math.floor((index + 1) / 8)}`} />
                  ) : (
                    <AdBanner slotName={`gallery-infeed-${index}`} format="infeed" config={bannerConfig} />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {sorted.length > visibleCount && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              setVisibleCount((c) => c + 24);
            }}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#ff35bb]/20 to-[#8b4dff]/20 hover:from-[#ff35bb]/35 hover:to-[#8b4dff]/35 border border-[#ff35bb]/40 text-xs font-extrabold text-white transition-all"
          >
            আরও ফটো দেখুন (+24 · {sorted.length - visibleCount}টি বাকি)
          </button>
        </div>
      )}
      </>
      )}

      {/* 300x250 Display Banner Advertisement (Gallery) */}
      <BannerAd300x250 placement="gallery" />

      {/* Bottom Google AdMob / AdSense Banner */}
      <AdBanner slotName="gallery-bottom" format="banner" config={bannerConfig} />
    </div>
  );
};
