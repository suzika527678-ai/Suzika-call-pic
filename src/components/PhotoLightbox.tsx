import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Download, Share2, MessageSquare, ChevronLeft, ChevronRight, Send, Check, MessageCircle, Edit3, Trash2, Upload, Save, Sparkles, Lock, Award } from 'lucide-react';
import { PhotoItem, UserProfile, CategoryType, AppBannerConfig } from '../types';
import { soundFX } from '../utils/audio';
import { AdBanner } from './AdBanner';
import { BannerAd320x50 } from './BannerAd320x50';
import { compressImageFile } from '../utils/imageCompressor';
import { triggerPhotoDownloadWithWatermark, DEFAULT_PHOTO_WATERMARK_TEXT } from '../utils/downloadHelper';
import { formatLikes } from '../utils/formatters';
import { getPhotoFallbackUrl } from '../utils/mediaFallback';
import { getDynamicObjectPositionClass } from '../utils/imageFraming';

const ALL_CATEGORIES: CategoryType[] = [
  'Glamour',
  'Portraits',
  'Nature',
  'Aesthetic',
  'Cinematic',
  'Night',
  'Urban',
  'Style',
  'Hot',
  'Call'
];

import { isPhotoLocked } from '../utils/unlockStore';
import { copyToClipboard } from '../utils/clipboard';

interface PhotoLightboxProps {
  photo: PhotoItem | null;
  allPhotos: PhotoItem[];
  onClose: () => void;
  onToggleLike: (photoId: string) => void;
  onAddComment: (photoId: string, text: string) => void;
  onSelectPhoto: (photo: PhotoItem) => void;
  userProfile: UserProfile;
  onOpenChat?: (photo: PhotoItem) => void;
  isAdmin?: boolean;
  onUpdatePhoto?: (updated: PhotoItem) => void;
  onDeletePhoto?: (photoId: string) => void;
  bannerConfig?: AppBannerConfig;
  onRequireLogin?: () => void;
  onRequestUnlockPhoto?: (photo: PhotoItem) => void;
  onRequestDownloadPhoto?: (photo: PhotoItem, onEarnedReward: () => void) => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photo,
  allPhotos,
  onClose,
  onToggleLike,
  onAddComment,
  onSelectPhoto,
  userProfile,
  onOpenChat,
  isAdmin = false,
  onUpdatePhoto,
  onDeletePhoto,
  bannerConfig,
  onRequireLogin,
  onRequestUnlockPhoto,
  onRequestDownloadPhoto,
}) => {
  const isLocked = photo ? isPhotoLocked(photo, bannerConfig) : false;
  const [commentInput, setCommentInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);
  const isDownloadingRef = useRef(false);

  // Admin inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<PhotoItem | null>(null);
  const [editErrorMsg, setEditErrorMsg] = useState('');

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
    setNaturalSize(null);
  }, [photo?.id]);

  useEffect(() => {
    const el = mediaContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize((prev) =>
          Math.abs(prev.width - rect.width) < 2 && Math.abs(prev.height - rect.height) < 2
            ? prev
            : { width: rect.width, height: rect.height }
        );
      }
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [photo?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!photo) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, allPhotos]);

  if (!photo) return null;

  const currentIndex = allPhotos.findIndex((p) => p.id === photo.id);
  const handlePrev = () => {
    if (currentIndex > 0) {
      soundFX.playPop();
      onSelectPhoto(allPhotos[currentIndex - 1]);
    } else {
      soundFX.playPop();
      onSelectPhoto(allPhotos[allPhotos.length - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allPhotos.length - 1) {
      soundFX.playPop();
      onSelectPhoto(allPhotos[currentIndex + 1]);
    } else {
      soundFX.playPop();
      onSelectPhoto(allPhotos[0]);
    }
  };

  const handleDownload = () => {
    soundFX.playPop();
    if (bannerConfig?.enableAds === false || bannerConfig?.requireAdForDownloads === false || !onRequestDownloadPhoto) {
      executeDownload();
      return;
    }
    onRequestDownloadPhoto(photo, () => {
      executeDownload();
    });
  };

  const executeDownload = async () => {
    if (isDownloadingRef.current) return;
    isDownloadingRef.current = true;
    try {
      soundFX.playSuccess();
      const filename = `SUZIKA_${(photo.title || 'Photo').replace(/\s+/g, '_')}_Slot${photo.slotNumber}.png`;
      const watermarkText = bannerConfig?.photoWatermarkText?.trim() || DEFAULT_PHOTO_WATERMARK_TEXT;
      await triggerPhotoDownloadWithWatermark(photo.imageUrl, filename, watermarkText);
    } catch (err) {
      console.warn('Download error:', err);
    } finally {
      setTimeout(() => {
        isDownloadingRef.current = false;
      }, 2500);
    }
  };

  const handleShare = async () => {
    soundFX.playPop();
    const url = typeof window !== 'undefined' ? window.location.href : '';
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      if (onRequireLogin) onRequireLogin();
      return;
    }

    soundFX.playSuccess();
    onAddComment(photo.id, commentInput.trim());
    setCommentInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      {/* Lightbox Container */}
      <div className="relative w-full max-w-4xl bg-[#111522] border border-[#252a3d] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[92vh]">
        
        {/* Close Button */}
        <button
          onClick={() => {
            soundFX.playPop();
            onClose();
          }}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md transition-colors"
          aria-label="Close photo preview"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Media Side (Left / Center) */}
        <div
          ref={mediaContainerRef}
          className="relative w-full h-[44vh] min-h-[280px] sm:h-[52vh] md:h-auto md:flex-1 md:min-h-[540px] md:self-stretch bg-[#080a12] flex items-center justify-center overflow-hidden group shrink-0"
        >
          {/* Fallback stylized gradient behind image */}
          <div
            className="absolute inset-0 opacity-40 blur-xl"
            style={{ background: photo.fallbackGradient }}
          />

          {!imgLoaded && !imgFailed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#ff35bb] border-t-transparent animate-spin" />
            </div>
          )}

          {imgFailed || !photo.imageUrl || photo.imageUrl.trim() === '' ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
              style={{ background: photo.fallbackGradient || 'linear-gradient(135deg, #2d3654, #a13c8c)' }}
            >
              <div className="text-4xl mb-3">📸</div>
              <h3 className="text-lg font-bold text-white mb-1">{photo.title || 'Photo'}</h3>
              <p className="text-xs text-white/80">Slot #{String(photo.slotNumber || 1).padStart(3, '0')} · {photo.category || 'Glamour'}</p>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <img
                src={photo.imageUrl}
                alt={photo.title || 'Photo'}
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  setImgLoaded(true);
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                  }
                }}
                onError={(e) => {
                  const fallback = getPhotoFallbackUrl(photo.slotNumber);
                  if (e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  } else {
                    setImgFailed(true);
                  }
                }}
                className={`absolute inset-0 w-full h-full object-cover ${getDynamicObjectPositionClass(
                  naturalSize?.width,
                  naturalSize?.height,
                  containerSize.width,
                  containerSize.height
                )} transition-all duration-300 ${
                  imgLoaded ? 'opacity-100' : 'opacity-0'
                } ${isLocked ? 'blur-xl scale-110 opacity-60' : 'group-hover:scale-[1.02]'}`}
              />

              {/* Locked Overlay inside Lightbox */}
              {isLocked && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-2xl shadow-amber-500/20 animate-pulse">
                    <Lock className="w-8 h-8 text-amber-400" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">
                      {photo.category} প্রিমিয়াম ফটো লক করা আছে
                    </h3>
                    <p className="text-xs text-[#9da4b8] max-w-xs">
                      পুরো ফুল এইচডি রেজোলিউশনে দেখতে ও ডাউনলোড করতে Google AdMob রিওয়ার্ডেড বিজ্ঞাপন দেখুন।
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      if (onRequestUnlockPhoto) onRequestUnlockPhoto(photo);
                    }}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-[#ff35bb] to-[#8b4dff] hover:opacity-95 text-white text-xs font-extrabold shadow-xl shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-2 border border-white/20"
                  >
                    <Award className="w-4 h-4 text-amber-200 fill-amber-200" />
                    <span>Watch Ad to Unlock Photo</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation Arrows */}
          <button
            onClick={handlePrev}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff35bb] text-white flex items-center justify-center backdrop-blur-md transition-all opacity-80 hover:opacity-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff35bb] text-white flex items-center justify-center backdrop-blur-md transition-all opacity-80 hover:opacity-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Slot Number Tag in Image */}
          <div className="absolute bottom-3 left-3 bg-[#080a12]/80 backdrop-blur-md border border-[#252a3d] px-2.5 py-1 rounded-lg text-[11px] font-mono-numbers font-semibold text-white/90">
            Slot #{String(photo.slotNumber).padStart(3, '0')} / 500
          </div>
        </div>

        {/* Sidebar Info & Comments (Right Side) */}
        <div className="w-full flex-1 min-h-0 md:flex-none md:w-[360px] shrink-0 flex flex-col bg-[#111522] border-t md:border-t-0 md:border-l border-[#252a3d] p-4 overflow-y-auto">
          {/* 1. Top 320x50 Banner Ad (below photo / above title) */}
          <BannerAd320x50 placement="lightbox-top" className="mt-0 mb-3" />

          {/* Header Title & Author */}
          <div className="border-b border-[#252a3d] pb-3">
            <div className="flex items-center justify-between text-xs text-[#9da4b8] mb-1">
              <span>{photo.category}</span>
              <span className="font-mono-numbers text-[10px] text-[#ff35bb] font-bold">
                {photo.views.toLocaleString()} views
              </span>
            </div>
            <h2 className="font-display text-lg font-bold text-white leading-tight">
              {photo.title}
            </h2>
            <p className="text-xs text-[#9da4b8] mt-1">
              Curated by <span className="text-white font-medium">{photo.author}</span>
            </p>
          </div>

          {/* Action Row */}
          <div className="grid grid-cols-3 gap-2 py-3 border-b border-[#252a3d]">
            <button
              onClick={() => {
                if (!userProfile?.isLoggedIn || !userProfile?.phone) {
                  soundFX.playPop();
                  if (onRequireLogin) onRequireLogin();
                  else onToggleLike(photo.id);
                  return;
                }
                soundFX.playHeart();
                onToggleLike(photo.id);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                photo.isLiked
                  ? 'bg-[#ff35bb]/20 text-[#ff35bb] border border-[#ff35bb]/40'
                  : 'bg-[#151a2d] hover:bg-[#1f2642] text-[#9da4b8] hover:text-white border border-[#252a3d]'
              }`}
            >
              <Heart className={`w-4 h-4 ${photo.isLiked ? 'fill-[#ff35bb]' : ''}`} />
              <span className="font-mono-numbers">{formatLikes(photo.likes, photo.slotNumber, photo.id)}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-[#1c233c] to-[#14182b] hover:border-[#ff35bb]/60 text-white border border-[#ff35bb]/30 text-xs font-bold transition-all shadow-md active:scale-95"
              title="ভিডিও বিজ্ঞাপন দেখে HD ছবি ডাউনলোড করুন (Watch Ad & Download)"
            >
              <Download className="w-4 h-4 text-[#ff35bb]" />
              <span>ডাউনলোড (Save)</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#151a2d] hover:bg-[#1f2642] text-[#9da4b8] hover:text-white border border-[#252a3d] text-xs font-semibold transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>

          {/* Admin Instant Edit / Delete Bar */}
          {isAdmin && (
            <div className="p-2 rounded-2xl bg-[#ffd700]/10 border border-[#ffd700]/30 my-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-[#ffd700] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#ffd700]" />
                <span>Admin Controls</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    setEditForm({ ...photo });
                    setIsEditing(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#ffd700] hover:bg-[#ffea75] text-black font-black text-[11px] flex items-center gap-1 shadow"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Photo (এডিট)</span>
                </button>
                {onDeletePhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      onDeletePhoto(photo.id);
                      onClose();
                    }}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors active:scale-95"
                    title="সরাসরি ফটো স্লট মুছুন (Delete)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. Middle 320x50 Banner Ad (between action buttons and Tags & Info) */}
          <BannerAd320x50 placement="lightbox-mid" className="my-2.5" />

          {/* Photo Meta Tags */}
          <div className="py-3 border-y border-[#252a3d]">
            <div className="text-[11px] font-semibold text-[#9da4b8] mb-1.5">Tags & Info</div>
            <div className="flex flex-wrap gap-1.5">
              {(photo.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] bg-[#161a2b] border border-[#252a3d] text-[#d5cce7] px-2 py-0.5 rounded-md"
                >
                  #{tag}
                </span>
              ))}
              {photo.resolution && (
                <span className="text-[10px] bg-[#0c142b] border border-[#00d2ff]/30 text-[#00d2ff] px-2 py-0.5 rounded-md">
                  {photo.resolution}
                </span>
              )}
            </div>
          </div>

          {/* Comments Section for Photo */}
          <div className="flex-1 flex flex-col mt-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#ff35bb]" />
              <span>Comments ({(photo.comments || []).length})</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[160px] pr-1">
              {(!photo.comments || photo.comments.length === 0) ? (
                <p className="text-xs text-[#9da4b8] italic py-2">
                  No comments yet. Be the first to leave a thought on this photo!
                </p>
              ) : (
                photo.comments.map((comment) => (
                  <div key={comment.id} className="bg-[#151a2d] border border-[#252a3d] rounded-xl p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">{comment.authorName}</span>
                      <span className="text-[10px] text-[#9da4b8]">{comment.timestamp}</span>
                    </div>
                    <p className="text-[#d5cce7] leading-relaxed">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Ad Banner inside sidebar */}
            <AdBanner slotName={`lightbox-${photo.id}`} format="compact" config={bannerConfig} />

            {/* Comment Form or Login Requirement Prompt */}
            {!userProfile?.isLoggedIn ? (
              <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb]/15 via-[#8b4dff]/15 to-[#00d2ff]/15 border border-[#ff35bb]/30 flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/90">কমেন্ট ও লাইক দিতে লগইন করুন</span>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    if (onRequireLogin) onRequireLogin();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold shadow hover:opacity-95 active:scale-95 transition-all shrink-0"
                >
                  লগইন করুন
                </button>
              </div>
            ) : (
              <form onSubmit={handleCommentSubmit} className="mt-2 pt-2 border-t border-[#252a3d] flex gap-1.5">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={`Comment as ${userProfile.name}...`}
                  className="flex-1 bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white placeholder-[#9da4b8]/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="px-3 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* 3. Bottom 320x50 Banner Ad (bottom of comments / info panel) */}
            <BannerAd320x50 placement="lightbox-bottom" className="mt-3 mb-0" />
          </div>
        </div>
      </div>

      {/* Admin Edit Modal */}
      {isEditing && editForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-[#111522] border border-[#ffd700]/50 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#252a3d]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#ffd700] text-black flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Edit Photo Slot #{editForm.slotNumber}</h3>
                  <span className="text-[10px] text-[#ffd700]">Admin Instant Customizer</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-7 h-7 rounded-full bg-[#1b2138] text-white flex items-center justify-center hover:bg-[#252d4c]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                soundFX.playSuccess();
                if (onUpdatePhoto && editForm) {
                  onUpdatePhoto(editForm);
                }
                setIsEditing(false);
              }}
              className="space-y-3"
            >
              {editErrorMsg && (
                <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                  {editErrorMsg}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[#d5cce7] mb-1">Title (শিরোনাম)</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffd700]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#d5cce7] mb-1">Image URL or Browse Device (ছবি পরিবর্তন)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="lightbox-photo-replace"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEditErrorMsg('');
                      try {
                        const compressed = await compressImageFile(file);
                        setEditForm({ ...editForm, imageUrl: compressed });
                        soundFX.playSuccess();
                      } catch {
                        setEditErrorMsg('ছবি কম্প্রেস করা যায়নি। অনুগ্রহ করে ফাইল চেক করুন।');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('lightbox-photo-replace')?.click()}
                    className="px-3 py-1.5 rounded-xl bg-[#1b2138] hover:bg-[#252d4c] text-white text-xs font-medium border border-[#252a3d] flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#ffd700]" />
                    <span>গ্যালারি বা ফাইল থেকে ছবি নিন</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffd700]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#d5cce7] mb-1">Category (ক্যাটাগরি)</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as CategoryType })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#d5cce7] mb-1">Slot # (স্লট নম্বর)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={editForm.slotNumber}
                    onChange={(e) => setEditForm({ ...editForm, slotNumber: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#d5cce7] mb-1">Author / Curator</label>
                  <input
                    type="text"
                    value={editForm.author}
                    onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#d5cce7] mb-1">Resolution</label>
                  <input
                    type="text"
                    value={editForm.resolution || '4K UltraHD'}
                    onChange={(e) => setEditForm({ ...editForm, resolution: e.target.value })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#151a2d] hover:bg-[#1e2540] text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ffd700] to-[#ff9800] text-black text-xs font-black shadow-lg"
                >
                  সেভ করুন (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
