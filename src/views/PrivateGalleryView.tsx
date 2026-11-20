import React from 'react';
import { Flame, Lock, Unlock, Coins, Play, Clock, ShieldCheck, Sparkles, PlusCircle } from 'lucide-react';
import { AppBannerConfig, CoinRechargeRequest, PrivateGalleryName, PrivateVideoItem, UserProfile } from '../types';
import { PRIVATE_GALLERIES } from '../data/initialData';
import { soundFX } from '../utils/audio';
import { BannerAd320x50 } from '../components/BannerAd320x50';
import { BannerAd300x250 } from '../components/BannerAd300x250';
import { sortMediaNewestFirst } from '../utils/cloudMediaStore';

interface PrivateGalleryViewProps {
  privateVideos: PrivateVideoItem[];
  selectedGallery: PrivateGalleryName | 'All';
  onSelectGallery: (gallery: PrivateGalleryName | 'All') => void;
  userProfile: UserProfile;
  userRequests: CoinRechargeRequest[];
  onSelectVideo: (video: PrivateVideoItem) => void;
  onOpenRecharge: () => void;
  isAdmin?: boolean;
  onOpenAdminPrivate?: () => void;
  bannerConfig?: AppBannerConfig;
}

export const PrivateGalleryView: React.FC<PrivateGalleryViewProps> = ({
  privateVideos,
  selectedGallery,
  onSelectGallery,
  userProfile,
  userRequests,
  onSelectVideo,
  onOpenRecharge,
  isAdmin = false,
  onOpenAdminPrivate,
}) => {
  const [visibleCount, setVisibleCount] = React.useState(24);
  React.useEffect(() => {
    setVisibleCount(24);
  }, [selectedGallery]);

  const unlockedIds = userProfile.unlockedPrivateVideoIds || [];
  const userCoins = userProfile.coins || 0;
  const pendingCount = userRequests.filter((r) => r.status === 'pending').length;

  const filteredVideos = [...privateVideos]
    .filter(
      (v) =>
        selectedGallery === 'All' ||
        v.gallery === selectedGallery ||
        (Array.isArray(v.galleries) && v.galleries.includes(selectedGallery))
    )
    .sort(sortMediaNewestFirst);

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Top Wallet & Private VIP Header */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#2a0e3f] via-[#15182c] to-[#0e1e36] border border-[#ff35bb]/40 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-black uppercase">
                <Flame className="w-3 h-3" />
                <span>18+ Global Adult &amp; VIP</span>
              </span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                  {pendingCount} Pending Request
                </span>
              )}
            </div>
            <h1 className="font-display font-black text-xl text-white mt-1.5">
              Private VIP Galleries
            </h1>
            <p className="text-xs text-[#c8cde0]">
              প্রতিটি ভিডিওতে ২ সেকেন্ড ফ্রি প্রিভিউ — পুরো ভিডিও আনলক করতে কয়েন ব্যবহার করুন।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-2xl bg-[#080a12]/90 border border-amber-400/40 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <div className="text-left leading-tight">
                <span className="text-[10px] text-[#9da4b8] block">আপনার কয়েন</span>
                <span className="text-sm font-black text-white font-mono-numbers">{userCoins} Coins</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                onOpenRecharge();
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-extrabold shadow-lg shadow-[#ff35bb]/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>কয়েন রিচার্জ</span>
            </button>
          </div>
        </div>

        {/* Supported Mobile Payment Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px] text-[#b8bfd2]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>পেমেন্ট সাপোর্ট:</span>
            <span className="px-2 py-0.5 rounded-md bg-[#e2136e]/20 text-[#ff6eb2] font-bold">bKash</span>
            <span className="px-2 py-0.5 rounded-md bg-[#f6921e]/20 text-[#fdba74] font-bold">Nagad</span>
            <span className="px-2 py-0.5 rounded-md bg-[#8c3494]/25 text-[#d8b4fe] font-bold">Rocket</span>
          </div>

          {isAdmin && onOpenAdminPrivate && (
            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                onOpenAdminPrivate();
              }}
              className="px-3 py-1 rounded-xl bg-amber-400 text-black font-black text-[11px] flex items-center gap-1 shadow"
            >
              <Sparkles className="w-3 h-3" />
              <span>Admin: Add Private Video</span>
            </button>
          )}
        </div>
      </div>

      {/* Private Gallery Selector Cards */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => {
            soundFX.playPop();
            onSelectGallery('All');
          }}
          className={`px-3.5 py-2.5 rounded-2xl border text-left shrink-0 transition-all cursor-pointer ${
            selectedGallery === 'All'
              ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] border-transparent text-white shadow-lg shadow-[#ff35bb]/25'
              : 'bg-[#111522] border-[#252a3d] text-[#9da4b8] hover:text-white'
          }`}
        >
          <div className="text-xs font-extrabold">সব গ্যালারি (All)</div>
          <div className="text-[10px] opacity-80">{privateVideos.length} Videos</div>
        </button>

        {PRIVATE_GALLERIES.map((gal) => {
          const active = selectedGallery === gal.id;
          const count = privateVideos.filter(
            (v) => v.gallery === gal.id || (Array.isArray(v.galleries) && v.galleries.includes(gal.id))
          ).length;
          return (
            <button
              key={gal.id}
              type="button"
              onClick={() => {
                soundFX.playPop();
                onSelectGallery(gal.id);
              }}
              className={`px-3.5 py-2 rounded-2xl border text-left shrink-0 min-w-[140px] transition-all cursor-pointer ${
                active
                  ? `bg-gradient-to-r ${gal.gradient} border-transparent text-white shadow-lg`
                  : 'bg-[#111522] border-[#252a3d] text-[#9da4b8] hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold">{gal.label}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/30 text-white">
                  {gal.badge}
                </span>
              </div>
              <div className="text-[10px] opacity-80 mt-0.5">
                {gal.subtitle} · {count}
              </div>
            </button>
          );
        })}
      </div>

      <BannerAd320x50 placement="private-top" />

      {/* Blurred Private Videos Grid */}
      {filteredVideos.length === 0 ? (
        <div className="p-8 rounded-3xl bg-[#111522] border border-dashed border-[#ff35bb]/35 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#ff35bb]/15 border border-[#ff35bb]/35 flex items-center justify-center mx-auto text-[#ff35bb]">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-display font-bold text-base text-white">
            {selectedGallery === 'All'
              ? 'প্রাইভেট গ্যালারিতে এখনো ভিডিও যোগ করা হয়নি'
              : `${selectedGallery} গ্যালারিতে এখনো কোনো ভিডিও নেই`}
          </h3>
          <p className="text-xs text-[#9da4b8] max-w-sm mx-auto leading-relaxed">
            অ্যাডমিন প্যানেল থেকে <strong>Private VIP &amp; Coins</strong> সেকশনে গিয়ে Global Adult ও অন্যান্য প্রাইভেট গ্যালারির ভিডিও আপলোড করলেই এখানে ২ সেকেন্ড ফ্রি প্রিভিউ ও কয়েন লকসহ দেখা যাবে।
          </p>
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              onOpenRecharge();
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>কয়েন রিচার্জ দেখুন</span>
          </button>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full max-w-3xl mx-auto">
          {filteredVideos.slice(0, visibleCount).map((video) => {
            const isUnlocked = isAdmin || unlockedIds.includes(video.id);

            return (
              <div
                key={video.id}
                onClick={() => {
                  soundFX.playPop();
                  onSelectVideo(video);
                }}
                className={`aspect-[3/4] rounded-2xl overflow-hidden relative cursor-pointer group border bg-[#151a2d] shadow-xl transition-all active:scale-[0.98] ${
                  isUnlocked
                    ? 'border-emerald-500/45 hover:border-emerald-400'
                    : 'border-[#ff35bb]/35 hover:border-[#ff35bb]'
                }`}
              >
                {/* Fallback gradient */}
                <div
                  className="absolute inset-0"
                  style={{ background: video.fallbackGradient || 'linear-gradient(135deg, #2d1447, #6e184b)' }}
                />

                {/* Blurred Video Thumbnail (Unblurred if unlocked) */}
                {video.thumbnailUrl && !video.thumbnailUrl.startsWith('blob:') ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-300 ${
                      isUnlocked ? 'group-hover:scale-105' : 'blur-xl scale-125 opacity-65'
                    }`}
                  />
                ) : null}

                {/* Dark Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />

                {/* Top Badges: Gallery + Coin Cost */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10">
                  <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[9px] font-bold text-[#ff8ce4] truncate">
                    {video.gallery}
                  </span>

                  {isUnlocked ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-[9px] font-bold flex items-center gap-0.5 shrink-0">
                      <Unlock className="w-2.5 h-2.5" />
                      <span>Open</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black flex items-center gap-0.5 shrink-0 shadow">
                      <Coins className="w-2.5 h-2.5" />
                      <span>{video.coinPrice}</span>
                    </span>
                  )}
                </div>

                {/* Center Lock / Free 2s Preview CTA */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center z-10 space-y-2">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xl ${
                      isUnlocked
                        ? 'bg-emerald-500/25 border-emerald-400/60 text-white'
                        : 'bg-black/65 border-[#ff35bb]/60 text-amber-300 backdrop-blur-md'
                    }`}
                  >
                    {isUnlocked ? <Play className="w-5 h-5 fill-white ml-0.5" /> : <Lock className="w-5 h-5" />}
                  </div>

                  {!isUnlocked && (
                    <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-[10px] font-extrabold shadow-lg flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>2s ফ্রি দেখুন</span>
                    </span>
                  )}
                </div>

                {/* Bottom Title & Duration */}
                <div className="absolute bottom-2 left-2.5 right-2.5 z-10">
                  <h3 className="text-xs font-bold text-white truncate drop-shadow">{video.title}</h3>
                  <div className="flex items-center justify-between text-[10px] text-[#cbd5e1] mt-0.5">
                    <span>{video.duration || '0:30'}</span>
                    <span>{isUnlocked ? 'Full HD Unlocked' : `${video.coinPrice} Coins`}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filteredVideos.length > visibleCount && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                setVisibleCount((c) => c + 24);
              }}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#ff35bb]/20 to-[#8b4dff]/20 hover:from-[#ff35bb]/35 hover:to-[#8b4dff]/35 border border-[#ff35bb]/40 text-xs font-extrabold text-white transition-all"
            >
              আরও প্রাইভেট ভিডিও দেখুন (+24 · {filteredVideos.length - visibleCount}টি বাকি)
            </button>
          </div>
        )}
        </>
      )}

      <BannerAd300x250 placement="private-bottom" />
    </div>
  );
};
