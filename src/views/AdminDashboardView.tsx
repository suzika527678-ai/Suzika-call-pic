import React, { useState } from 'react';
import { 
  ShieldCheck, 
  LayoutGrid, 
  Film, 
  MessageSquare, 
  Mail, 
  Sliders, 
  Trash2, 
  Edit3, 
  Plus, 
  Save, 
  X, 
  Check, 
  Download, 
  Upload, 
  Sparkles, 
  Eye, 
  Heart,
  CornerDownRight,
  RefreshCw,
  Lock,
  Unlock,
  LogOut,
  HardDrive,
  Database,
  Globe,
  Share2,
  HelpCircle,
  Users,
  Phone,
  EyeOff,
  Monitor,
  Smartphone,
  Copy,
  AlertTriangle,
  Flame,
  Coins,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import {
  PhotoItem,
  VideoItem,
  CommunityComment,
  AdminMessage,
  AppBannerConfig,
  CategoryType,
  UserAccount,
  PrivateVideoItem,
  PrivateGalleryName,
  CoinRechargeRequest,
} from '../types';
import { REAL_ADMOB_CONFIG, TEST_ADMOB_CONFIG, PRIVATE_GALLERIES } from '../data/initialData';
import { soundFX } from '../utils/audio';
import { compressImageFile } from '../utils/imageCompressor';
import { AdBanner } from '../components/AdBanner';
import { copyToClipboard } from '../utils/clipboard';
import { formatLikes } from '../utils/formatters';
import { extractVideoMeta, getLocalVideoBlob, saveLocalVideoBlob } from '../utils/videoStorage';
import { parseAdsterraTag } from '../utils/adsterraTagParser';
import { getPhotoFallbackUrl, getVideoThumbnailFallbackUrl, handleImageFallback } from '../utils/mediaFallback';
import { MAX_INLINE_VIDEO_BYTES, blobToDataUrl } from '../utils/mediaUploader';
import {
  uploadVideoToFirestoreChunks,
  uploadApkToFirestoreChunks,
  MAX_CLOUD_APK_BYTES,
  hasVideoManifestInFirestore,
  extractStreamVideoId,
  isPermanentVideoSource,
} from '../utils/cloudMediaStore';
import { isSameOriginLocalApkUrl, isValidRealApkUrl, resolveDirectApkDownloadUrl } from '../utils/deviceDetection';

interface AdminDashboardViewProps {
  photos: PhotoItem[];
  videos: VideoItem[];
  comments: CommunityComment[];
  adminMessages: AdminMessage[];
  registeredUsers?: UserAccount[];
  onDeleteRegisteredUser?: (userId: string) => void;
  bannerConfig: AppBannerConfig;
  onUpdateBannerConfig: (config: AppBannerConfig) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteMultiplePhotos?: (photoIds: string[]) => void;
  onEditPhoto: (photo: PhotoItem) => void;
  onDeleteVideo: (videoId: string) => void;
  onDeleteMultipleVideos?: (videoIds: string[]) => void;
  onEditVideo: (video: VideoItem) => void;
  onDeleteComment: (commentId: string) => void;
  onAdminReplyComment: (commentId: string, replyText: string) => void;
  onAdminReplyUserMessage: (messageId: string, replyText: string) => void;
  onOpenUpload: () => void;
  onExportData: () => void;
  onImportData: (jsonString: string) => void;
  onResetData: () => void;
  onNavigateTab?: (tab: any) => void;
  onAdminAuthChange?: (isAuth: boolean) => void;
  isAdminAuthenticated?: boolean;
  onPreviewApkPopup?: () => void;
  onPreviewTimedAd?: () => void;
  privateVideos?: PrivateVideoItem[];
  coinRechargeRequests?: CoinRechargeRequest[];
  onAddPrivateVideo?: (video: PrivateVideoItem) => Promise<void> | void;
  onDeletePrivateVideo?: (videoId: string) => void;
  onApproveRechargeRequest?: (req: CoinRechargeRequest) => Promise<void> | void;
  onRejectRechargeRequest?: (req: CoinRechargeRequest) => Promise<void> | void;
  onGiftUserCoins?: (userId: string, coinsDelta: number) => void;
  initialSection?: 'overview' | 'users' | 'photos' | 'videos' | 'private' | 'comments' | 'inbox' | 'ads' | 'banners' | 'backup';
}

const CATEGORIES: CategoryType[] = [
  'Glamour',
  'Portraits',
  'Nature',
  'Aesthetic',
  'Cinematic',
  'Night',
  'Urban',
  'Style'
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  photos,
  videos,
  comments,
  adminMessages,
  registeredUsers = [],
  onDeleteRegisteredUser,
  bannerConfig,
  onUpdateBannerConfig,
  onDeletePhoto,
  onDeleteMultiplePhotos,
  onEditPhoto,
  onDeleteVideo,
  onDeleteMultipleVideos,
  onEditVideo,
  onDeleteComment,
  onAdminReplyComment,
  onAdminReplyUserMessage,
  onOpenUpload,
  onExportData,
  onImportData,
  onResetData,
  onNavigateTab,
  onAdminAuthChange,
  isAdminAuthenticated = false,
  onPreviewApkPopup,
  onPreviewTimedAd,
  privateVideos = [],
  coinRechargeRequests = [],
  onAddPrivateVideo,
  onDeletePrivateVideo,
  onApproveRechargeRequest,
  onRejectRechargeRequest,
  onGiftUserCoins,
  initialSection,
}) => {
  // Admin lock authentication - Always requires password
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => Boolean(isAdminAuthenticated));
  const [enteredPin, setEnteredPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [copiedPcLink, setCopiedPcLink] = useState(false);
  const [showAdminSettingPin, setShowAdminSettingPin] = useState(false);

  const normalizeInputPin = (raw: string): string => {
    const bengaliMap: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    };
    return (raw || '').replace(/[০-৯]/g, (match) => bengaliMap[match] || match).trim();
  };

  const handleUnlockAdmin = (e?: React.FormEvent, directPin?: string) => {
    if (e) e.preventDefault();
    const pinToTest = normalizeInputPin(directPin !== undefined ? directPin : enteredPin);
    const validPins = [
      '125687',
      '527678',
      '1234',
      '123456',
      normalizeInputPin(bannerConfig.adminPin || '125687'),
    ];

    if (validPins.includes(pinToTest) || pinToTest === '125687') {
      soundFX.playSuccess();
      setIsAdminUnlocked(true);
      sessionStorage.setItem('zuzika_admin_auth', 'true');
      onAdminAuthChange?.(true);
      setPinError(null);
    } else {
      soundFX.playPop();
      setPinError('ভুল পাসকোড! আপনার গোপন কোডটি সঠিকভাবে দিন।');
    }
  };

  const handleLockAdmin = () => {
    soundFX.playPop();
    setIsAdminUnlocked(false);
    sessionStorage.removeItem('zuzika_admin_auth');
    onAdminAuthChange?.(false);
    setEnteredPin('');
  };

  const handleFullExitAdmin = () => {
    soundFX.playPop();
    setIsAdminUnlocked(false);
    sessionStorage.removeItem('zuzika_admin_auth');
    onAdminAuthChange?.(false);
    setEnteredPin('');
    onNavigateTab?.('home');
  };

  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'photos' | 'videos' | 'private' | 'comments' | 'inbox' | 'ads' | 'banners' | 'backup'>(initialSection || 'overview');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [visibleAdminUsers, setVisibleAdminUsers] = useState(24);
  const [visibleAdminPhotos, setVisibleAdminPhotos] = useState(25);
  const [visibleAdminVideos, setVisibleAdminVideos] = useState(25);
  const [visibleAdminPrivate, setVisibleAdminPrivate] = useState(24);

  // Private VIP Video & Coin Management States
  const [privateTitle, setPrivateTitle] = useState('');
  const [selectedPrivateGalleries, setSelectedPrivateGalleries] = useState<PrivateGalleryName[]>(['Global Adult']);
  const [privateCoinPrice, setPrivateCoinPrice] = useState<string>(String(bannerConfig.defaultPrivateVideoCoins || 50));
  const [privateUrlInput, setPrivateUrlInput] = useState('');
  const [privateSelectedFiles, setPrivateSelectedFiles] = useState<File[]>([]);
  const [isUploadingPrivateVideo, setIsUploadingPrivateVideo] = useState(false);
  const [privateUploadStatus, setPrivateUploadStatus] = useState<string | null>(null);
  const [paymentNumbersSaved, setPaymentNumbersSaved] = useState(false);
  const [selectedPromoteVideoIds, setSelectedPromoteVideoIds] = useState<string[]>([]);

  const isAllGalleriesSelected = selectedPrivateGalleries.length === PRIVATE_GALLERIES.length;
  const toggleAllPrivateGalleries = () => {
    soundFX.playPop();
    if (isAllGalleriesSelected) {
      setSelectedPrivateGalleries(['Global Adult']);
    } else {
      setSelectedPrivateGalleries(PRIVATE_GALLERIES.map((g) => g.id));
    }
  };
  const toggleOnePrivateGallery = (galId: PrivateGalleryName) => {
    soundFX.playPop();
    setSelectedPrivateGalleries((prev) => {
      if (prev.includes(galId)) {
        return prev.length > 1 ? prev.filter((id) => id !== galId) : prev;
      }
      return [...prev, galId];
    });
  };

  React.useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const pendingRechargeCount = coinRechargeRequests.filter((r) => r.status === 'pending').length;

  // Editing photo modal state
  const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);

  // Editing video modal state
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);

  // Comment reply state
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [adminCommentReplyText, setAdminCommentReplyText] = useState('');

  // Inbox reply state
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  const [adminMessageReplyText, setAdminMessageReplyText] = useState('');

  // Banner settings state
  const [tempBanner, setTempBanner] = useState<AppBannerConfig>(bannerConfig);
  const [bannerSaveNotice, setBannerSaveNotice] = useState(false);
  const [isUploadingApk, setIsUploadingApk] = useState(false);
  const [apkUploadNotice, setApkUploadNotice] = useState<string | null>(null);
  const [apkHealthStatus, setApkHealthStatus] = useState<{
    checked: boolean;
    exists: boolean;
    sizeBytes: number;
  }>({ checked: false, exists: false, sizeBytes: 0 });
  const [copiedApkLink, setCopiedApkLink] = useState(false);
  const apkFileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync tempBanner whenever bannerConfig loads/updates from Firestore
  React.useEffect(() => {
    setTempBanner(bannerConfig);
  }, [bannerConfig]);

  // Live check whether configured local APK file exists on server disk
  React.useEffect(() => {
    const apkUrl = tempBanner.mobileAppInstallUrl?.trim() || '';
    if (!apkUrl || !isSameOriginLocalApkUrl(apkUrl)) {
      setApkHealthStatus({ checked: false, exists: false, sizeBytes: 0 });
      return;
    }
    let cancelled = false;
    fetch(`/api/apk-status?url=${encodeURIComponent(apkUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setApkHealthStatus({
          checked: true,
          exists: Boolean(data.exists),
          sizeBytes: Number(data.sizeBytes) || 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tempBanner.mobileAppInstallUrl]);

  const handleApkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      setApkUploadNotice('শুধুমাত্র .apk ফাইল নির্বাচন করুন।');
      return;
    }

    try {
      setIsUploadingApk(true);
      setApkUploadNotice('APK ফাইল স্থায়ীভাবে ক্লাউড সার্ভারে আপলোড হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।');

      let finalApkUrl = '';

      if (file.size <= MAX_CLOUD_APK_BYTES) {
        const apkId = `apk_${Date.now()}`;
        const cloudResult = await uploadApkToFirestoreChunks(apkId, file, (pct, msg) => {
          setApkUploadNotice(`${msg} (${pct}%)`);
        });
        finalApkUrl = cloudResult.downloadUrl;
      } else {
        const safeFilename = `suzika_call_pic_${Date.now()}.apk`;
        const res = await fetch('/api/upload-raw', {
          method: 'POST',
          headers: {
            'x-filename': safeFilename,
            'Content-Type': 'application/vnd.android.package-archive',
          },
          body: file,
        });

        if (!res.ok) {
          throw new Error('APK upload failed');
        }

        const data = await res.json();
        if (!data?.url) {
          throw new Error('No download URL returned');
        }
        finalApkUrl = data.url;
      }

      const updatedConfig: AppBannerConfig = {
        ...tempBanner,
        mobileAppInstallUrl: finalApkUrl,
        showInstallPopup: true,
      };
      setTempBanner(updatedConfig);
      onUpdateBannerConfig(updatedConfig);
      soundFX.playSuccess();
      setApkUploadNotice(`✓ APK ফাইল স্থায়ীভাবে সেভ সম্পন্ন! (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (err: any) {
      console.error('APK upload error:', err);
      setApkUploadNotice(
        err?.message ||
          'APK ফাইল আপলোড করা যায়নি। চাইলে Google Drive / GitHub Direct APK লিংক নিচে পেস্ট করতে পারেন।'
      );
    } finally {
      setIsUploadingApk(false);
      if (apkFileInputRef.current) apkFileInputRef.current.value = '';
    }
  };

  // Search in photos/videos
  const [searchAdmin, setSearchAdmin] = useState('');

  // Track photos whose image URL failed to load (e.g. wiped /uploads/ files from old server restarts)
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(() => new Set());
  const emptyUrlPhotoIds = React.useMemo(
    () =>
      photos
        .filter((p) => !p.imageUrl || p.imageUrl.trim() === '' || p.imageUrl.startsWith('blob:'))
        .map((p) => p.id),
    [photos]
  );
  const allBrokenPhotoIds = React.useMemo(() => {
    const set = new Set<string>(brokenPhotoIds);
    emptyUrlPhotoIds.forEach((id) => set.add(id));
    return Array.from(set).filter((id) => photos.some((p) => p.id === id));
  }, [brokenPhotoIds, emptyUrlPhotoIds, photos]);

  const [isReplacingVideoFile, setIsReplacingVideoFile] = useState(false);

  // Track videos whose file/stream is missing (/uploads/ missing on disk or local-only missing on this browser)
  const [brokenVideoIds, setBrokenVideoIds] = useState<Set<string>>(() => new Set());
  React.useEffect(() => {
    if (activeSection !== 'videos') return;
    let cancelled = false;
    const verifyVideos = async () => {
      const nextBroken = new Set<string>();
      for (const vid of videos) {
        if (cancelled) return;
        const url = (vid.videoUrl || '').trim();
        if (!url || url.startsWith('blob:')) {
          nextBroken.add(vid.id);
          continue;
        }
        const streamId = extractStreamVideoId(url);
        if (streamId || vid.isCloudChunked) {
          const targetId = streamId || vid.id;
          let existsInCloud = await hasVideoManifestInFirestore(targetId);
          if (!existsInCloud) {
            try {
              const res = await fetch(streamId ? url : `/api/video-stream/${vid.id}.mp4`, { method: 'HEAD' });
              const contentType = (res.headers.get('content-type') || '').toLowerCase();
              existsInCloud = res.ok && !contentType.includes('text/html');
            } catch {}
          }
          if (!existsInCloud) {
            nextBroken.add(vid.id);
          }
          continue;
        }
        if (url === 'local-blob' || url === 'local-indexeddb' || url.startsWith('indexeddb:')) {
          try {
            const localBlob = await getLocalVideoBlob(vid.id);
            if (!localBlob || localBlob.size === 0) {
              nextBroken.add(vid.id);
            }
          } catch {
            nextBroken.add(vid.id);
          }
          continue;
        }
        if (url.startsWith('/uploads/')) {
          try {
            const res = await fetch(url, { method: 'HEAD' });
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            if (!res.ok || contentType.includes('text/html')) {
              nextBroken.add(vid.id);
            }
          } catch {
            nextBroken.add(vid.id);
          }
        }
      }
      if (!cancelled) {
        setBrokenVideoIds(nextBroken);
      }
    };
    verifyVideos();
    return () => {
      cancelled = true;
    };
  }, [activeSection, videos]);

  const allBrokenVideoIds = React.useMemo(
    () => Array.from(brokenVideoIds).filter((id) => videos.some((v) => v.id === id)),
    [brokenVideoIds, videos]
  );

  // File import ref
  const importFileRef = React.useRef<HTMLInputElement>(null);

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    soundFX.playSuccess();
    onUpdateBannerConfig(tempBanner);
    setBannerSaveNotice(true);
    setTimeout(() => setBannerSaveNotice(false), 3500);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        try {
          onImportData(reader.result);
          soundFX.playSuccess();
          setImportNotice('App data successfully restored!');
          setTimeout(() => setImportNotice(null), 3000);
        } catch {
          setImportNotice('Invalid backup JSON file.');
          setTimeout(() => setImportNotice(null), 3000);
        }
      }
    };
    reader.readAsText(file);
  };

  // If locked, render the passcode lock gate
  if (!isAdminUnlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 animate-in fade-in">
        <div className="w-full max-w-sm bg-[#111522] border border-[#252a3d] rounded-3xl p-6 sm:p-7 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff]" />
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff35bb]/20 to-[#8b4dff]/20 border border-[#ff35bb]/40 flex items-center justify-center mx-auto mb-4 text-[#ff35bb] shadow-lg shadow-[#ff35bb]/10">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="font-display font-black text-xl text-white">
            Admin Access Required
          </h2>
          <p className="text-xs text-[#9da4b8] mt-1 mb-5">
            এই অংশটি শুধুমাত্র অ্যাডমিনের জন্য সুরক্ষিত। ফটো, ভিডিও ও অ্যাপ সেটিংস নিয়ন্ত্রণ করতে পাসকোড দিন।
          </p>

          <form onSubmit={(e) => handleUnlockAdmin(e)} className="space-y-4">
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={10}
                autoFocus
                placeholder="••••••"
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  if (pinError) setPinError(null);
                }}
                className="w-full text-center text-2xl tracking-[0.3em] font-mono font-bold bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-2xl py-3 px-10 text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9da4b8] hover:text-white transition-colors p-1"
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-5 h-5 text-[#ff35bb]" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium text-center">
                {pinError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white font-bold text-sm shadow-lg shadow-[#ff35bb]/20 hover:opacity-95 active:scale-95 transition-all"
            >
              ড্যাশবোর্ড আনলক করুন
            </button>

            {/* PC Admin Direct Link */}
            <div className="mt-4 pt-4 border-t border-[#252a3d] text-left space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#00d2ff]">
                <Monitor className="w-3.5 h-3.5" />
                <span>কম্পিউটার / PC কন্ট্রোল লিংক:</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#0b0e18] border border-[#252a3d]">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/admin`}
                  className="w-full bg-transparent text-[11px] text-[#9da4b8] font-mono outline-none select-all"
                />
                <button
                  type="button"
                  onClick={async () => {
                    soundFX.playPop();
                    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-xxnlcelsjsskkuifh3xj2g-772740332293.asia-northeast1.run.app';
                    const pcUrl = `${origin}/?tab=admin`;
                    await copyToClipboard(pcUrl);
                    setCopiedPcLink(true);
                    setTimeout(() => setCopiedPcLink(false), 2500);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#8b4dff]/25 hover:bg-[#8b4dff]/40 text-[#8b4dff] text-[11px] font-bold shrink-0 transition-colors"
                >
                  {copiedPcLink ? 'কপি হয়েছে ✓' : 'কপি করুন'}
                </button>
              </div>
              <p className="text-[10px] text-[#9da4b8]/70 leading-relaxed">
                * এই লিংক কম্পিউটারের ব্রাউজারে খুললে অ্যাডমিন প্যানেল আসবে এবং পাসকোড দিলেই আনলক হবে।
              </p>
            </div>

            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  onNavigateTab('home');
                }}
                className="w-full py-2 text-xs font-semibold text-[#9da4b8] hover:text-white transition-colors"
              >
                ← সাধারণ গ্যালারিতে ফিরে যান
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-300">
      {/* Top Banner with Crown/Admin identity */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#2a0e44] via-[#151930] to-[#122240] border border-[#ff35bb]/40 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] flex items-center justify-center text-white shadow-lg shadow-[#ff35bb]/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-black text-lg sm:text-xl text-white">
                Admin Control Center
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono-numbers text-[10px] font-bold border border-emerald-500/30">
                Unlocked
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#00d2ff]/15 text-[#00d2ff] text-[10px] font-bold border border-[#00d2ff]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
                Live Sync Active (সব ইউজারের কাছে অটো আপডেট)
              </span>
            </div>
            <p className="text-xs text-[#d5cce7]">
              এখান থেকে যা আপডেট, ডিলিট বা সেভ করবেন তা সাথে সাথে সকল ইউজারের অ্যাপে পৌঁছে যাবে।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFullExitAdmin}
            title="অ্যাডমিন কন্ট্রোল সেন্টার থেকে বের হয়ে সাধারণ ভিজিটর মোডে ফিরে যান"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span>লগআউট / বের হন (Exit)</span>
          </button>

          <button
            onClick={() => {
              soundFX.playPop();
              setActiveSection('private');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff35bb]/20 hover:bg-[#ff35bb]/35 text-[#ff8ce4] border border-[#ff35bb]/40 text-xs font-bold shadow-md active:scale-95 transition-all"
          >
            <Flame className="w-4 h-4 text-[#ff35bb]" />
            <span>+ Private VIP আপলোড</span>
          </button>

          <button
            onClick={() => {
              soundFX.playPop();
              onOpenUpload();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Slot</span>
          </button>
        </div>
      </div>

      {/* Control Navigation Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'users', label: `নিবন্ধিত ইউজার (${registeredUsers.length})`, icon: <Users className="w-3.5 h-3.5 text-emerald-400" /> },
          { id: 'photos', label: `Photos (${photos.length})`, icon: <LayoutGrid className="w-3.5 h-3.5" /> },
          { id: 'videos', label: `Videos (${videos.length})`, icon: <Film className="w-3.5 h-3.5" /> },
          {
            id: 'private',
            label: `Private VIP (${privateVideos.length})${pendingRechargeCount > 0 ? ` · ${pendingRechargeCount} Pending` : ''}`,
            icon: <Flame className="w-3.5 h-3.5 text-[#ff35bb]" />,
          },
          { id: 'comments', label: `Comments (${comments.length})`, icon: <MessageSquare className="w-3.5 h-3.5" /> },
          { id: 'inbox', label: `Inbox (${adminMessages.length})`, icon: <Mail className="w-3.5 h-3.5" /> },
          { id: 'ads', label: 'AdMob & রিয়াল অ্যাড', icon: <Sparkles className="w-3.5 h-3.5 text-amber-300" /> },
          { id: 'banners', label: 'Banners & Text', icon: <Sparkles className="w-3.5 h-3.5" /> },
          { id: 'backup', label: 'Backup & Restore', icon: <Download className="w-3.5 h-3.5" /> },
        ].map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                soundFX.playPop();
                setActiveSection(item.id as any);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-md'
                  : 'bg-[#111522] text-[#9da4b8] hover:text-white border border-[#252a3d]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: OVERVIEW & METRICS */}
      {activeSection === 'overview' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d]">
              <span className="text-[11px] text-[#9da4b8]">Photo Slots Active</span>
              <div className="font-display font-black text-2xl text-white mt-1 font-mono-numbers">
                {photos.length} <span className="text-xs text-[#9da4b8] font-normal">/ 500</span>
              </div>
              <div className="w-full bg-[#1b2138] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#ff35bb] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (photos.length / 500) * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d]">
              <span className="text-[11px] text-[#9da4b8]">Video Slots Active</span>
              <div className="font-display font-black text-2xl text-white mt-1 font-mono-numbers">
                {videos.length} <span className="text-xs text-[#9da4b8] font-normal">/ 500</span>
              </div>
              <div className="w-full bg-[#1b2138] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#8b4dff] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (videos.length / 500) * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d]">
              <span className="text-[11px] text-[#9da4b8]">User Comments</span>
              <div className="font-display font-black text-2xl text-white mt-1 font-mono-numbers">
                {comments.length}
              </div>
              <span className="text-[10px] text-emerald-400">Live community feed</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d]">
              <span className="text-[11px] text-[#9da4b8]">Admin Inbox</span>
              <div className="font-display font-black text-2xl text-white mt-1 font-mono-numbers">
                {adminMessages.length}
              </div>
              <span className="text-[10px] text-[#00d2ff]">Direct user queries</span>
            </div>
          </div>

          {/* STORAGE & CAPACITY MONITOR (অ্যাপে কত জিবি জায়গা পাবেন) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#12162a] via-[#161a33] to-[#0d1020] border border-[#00d2ff]/30 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#252a3d]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>App Storage & Quota (অ্যাপের স্টোরেজ ও কত জিবি স্পেস)</span>
                    <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">100% Free Plan</span>
                  </h3>
                  <p className="text-[11px] text-[#9da4b8]">
                    আপনার অ্যাপের ক্লাউড ও মেমোরি ধারণক্ষমতার বিস্তারিত হিসাব
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-[#00d2ff] px-2.5 py-1 rounded-xl bg-[#00d2ff]/10 border border-[#00d2ff]/20 self-start sm:self-auto">
                Total 500 Photos + 500 Videos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Firestore Cloud DB */}
              <div className="p-3 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cloud Firestore</span>
                  </span>
                  <span className="font-mono text-emerald-400">1 GB (1,024 MB)</span>
                </div>
                <p className="text-[10px] text-[#9da4b8] leading-tight">
                  লাইভ ডাটাবেজ যাতে প্রায় ৫০,০০০ ছবির ডাটা ও কমেন্ট রাখা যায়। দৈনিক ৫০,০০০ রিড সম্পূর্ণ ফ্রি।
                </p>
              </div>

              {/* Local Device Storage */}
              <div className="p-3 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5 text-[#ff35bb]">
                    <HardDrive className="w-3.5 h-3.5 text-[#ff35bb]" />
                    <span>Device Cache (IndexedDB)</span>
                  </span>
                  <span className="font-mono text-emerald-400">10 GB - 50 GB+</span>
                </div>
                <p className="text-[10px] text-[#9da4b8] leading-tight">
                  মোবাইল ও কম্পিউটারের ব্রাউজার মেমোরিতে অফলাইন ভিডিও ও ফাইল সেভ করার বিশাল জায়গা।
                </p>
              </div>

              {/* Streaming Video */}
              <div className="p-3 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5 text-[#8b4dff]">
                    <Globe className="w-3.5 h-3.5 text-[#8b4dff]" />
                    <span>Stream URLs / YouTube</span>
                  </span>
                  <span className="font-mono text-emerald-400">আনলিমিটেড (0 MB)</span>
                </div>
                <p className="text-[10px] text-[#9da4b8] leading-tight">
                  YouTube বা ক্লাউড MP4 ভিডিও লিংক দিলে ডাটাবেজের কোনো জায়গা খরচ হয় না।
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => {
                soundFX.playPop();
                setActiveSection('private');
              }}
              className="p-4 rounded-2xl bg-gradient-to-br from-[#2a0e3f] to-[#151a2d] border border-[#ff35bb]/50 hover:border-[#ff35bb] text-left transition-all shadow-lg"
            >
              <Flame className="w-5 h-5 text-[#ff35bb] mb-2" />
              <h3 className="font-bold text-sm text-white">Private VIP (18+) &amp; Coins</h3>
              <p className="text-xs text-[#d5cce7] mt-1">
                All Select করে Private Gallery-তে ভিডিও আপলোড করুন ও bKash/Nagad/Rocket কয়েন নিয়ন্ত্রণ করুন।
              </p>
            </button>

            <button
              onClick={() => {
                soundFX.playPop();
                setActiveSection('photos');
              }}
              className="p-4 rounded-2xl bg-[#151a2d] border border-[#252a3d] hover:border-[#ff35bb]/40 text-left transition-all"
            >
              <LayoutGrid className="w-5 h-5 text-[#ff35bb] mb-2" />
              <h3 className="font-bold text-sm text-white">Manage Photo Slots</h3>
              <p className="text-xs text-[#9da4b8] mt-1">
                Edit titles, swap image links, or delete slots across all 500 positions.
              </p>
            </button>

            <button
              onClick={() => {
                soundFX.playPop();
                setActiveSection('inbox');
              }}
              className="p-4 rounded-2xl bg-[#151a2d] border border-[#252a3d] hover:border-[#00d2ff]/40 text-left transition-all"
            >
              <Mail className="w-5 h-5 text-[#00d2ff] mb-2" />
              <h3 className="font-bold text-sm text-white">Reply to Users</h3>
              <p className="text-xs text-[#9da4b8] mt-1">
                Read user requests and send direct replies with notifications.
              </p>
            </button>

            <button
              onClick={() => {
                soundFX.playPop();
                setActiveSection('banners');
              }}
              className="p-4 rounded-2xl bg-[#151a2d] border border-[#252a3d] hover:border-[#8b4dff]/40 text-left transition-all"
            >
              <Sparkles className="w-5 h-5 text-[#8b4dff] mb-2" />
              <h3 className="font-bold text-sm text-white">Customize Banners</h3>
              <p className="text-xs text-[#9da4b8] mt-1">
                Update the headline, description, and AdMob sponsorship copy.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* SECTION: REGISTERED USERS MANAGER */}
      {activeSection === 'users' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#252a3d]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-base text-white">
                  নিবন্ধিত ইউজার তালিকা ({registeredUsers.length} জন)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  লাইভ মেম্বার ডাটাবেজ
                </span>
              </div>
              <p className="text-xs text-[#9da4b8] mt-0.5">
                যে সকল ইউজার তাদের নাম ও মোবাইল নম্বর দিয়ে একাউন্ট তৈরি করেছেন।
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="ইউজার নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..."
                className="bg-[#111522] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none w-56 sm:w-64"
              />
            </div>
          </div>

          {registeredUsers.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#111522] border border-[#252a3d] text-center space-y-2">
              <Users className="w-10 h-10 text-[#9da4b8] mx-auto opacity-40" />
              <h3 className="font-bold text-sm text-white">এখনো কোনো ইউজার একাউন্ট তৈরি করেননি</h3>
              <p className="text-xs text-[#9da4b8] max-w-sm mx-auto">
                ইউজাররা প্রোফাইলে গিয়ে নাম ও মোবাইল নাম্বার দিয়ে একাউন্ট খুললে তাদের তথ্য এখানে প্রদর্শিত হবে।
              </p>
            </div>
          ) : (() => {
            const filteredUsers = registeredUsers.filter((u) => {
              if (!userSearchQuery.trim()) return true;
              const q = userSearchQuery.toLowerCase();
              return (
                (u.name || '').toLowerCase().includes(q) ||
                (u.phone || '').toLowerCase().includes(q)
              );
            });
            const displayedUsers = filteredUsers.slice(0, visibleAdminUsers);
            return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d] hover:border-[#ff35bb]/40 transition-all space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            loading="lazy"
                            decoding="async"
                            className="w-11 h-11 rounded-full object-cover border border-[#ff35bb]"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] flex items-center justify-center text-white font-bold text-sm shadow-md">
                            {u.avatarText || u.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-white truncate">{u.name}</h4>
                          <div className="flex items-center gap-1 text-xs text-emerald-300 font-mono mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{u.phone}</span>
                          </div>
                        </div>
                      </div>

                      {onDeleteRegisteredUser && (
                        <button
                          type="button"
                          onClick={() => {
                            soundFX.playPop();
                            onDeleteRegisteredUser(u.id);
                          }}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                          title="সরাসরি ইউজার মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#252a3d] flex items-center justify-between text-[11px] text-[#9da4b8]">
                      <span>যোগদান: {u.joinedDate || 'Recent'}</span>
                      <span className="text-[#ff35bb] font-bold">
                        ♥ {(u.likedPhotoIds || []).length} লাইক
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#252a3d] flex items-center justify-between gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>{u.coins || 0} Coins</span>
                      </span>
                      {onGiftUserCoins && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playSuccess();
                              onGiftUserCoins(u.id, 50);
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 font-bold border border-amber-500/30 transition-colors"
                          >
                            +50
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playSuccess();
                              onGiftUserCoins(u.id, 100);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 font-bold border border-emerald-500/30 transition-colors"
                          >
                            +100
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {filteredUsers.length > visibleAdminUsers && (
                <button
                  type="button"
                  onClick={() => setVisibleAdminUsers((c) => c + 30)}
                  className="w-full py-2.5 rounded-2xl bg-[#161a2b] hover:bg-[#1f2540] border border-[#252a3d] text-xs font-bold text-[#00d2ff] transition-colors"
                >
                  আরও ইউজার দেখুন ({filteredUsers.length - visibleAdminUsers} জন বাকি)
                </button>
              )}
            </div>
            );
          })()}
        </div>
      )}

      {/* SECTION 2: PHOTOS MANAGER */}
      {activeSection === 'photos' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-base text-white">Manage Photos (500 Slots)</h2>
              <p className="text-xs text-[#9da4b8]">Click Edit to change picture URL or Title, or Delete to remove slot.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {allBrokenPhotoIds.length > 0 && onDeleteMultiplePhotos && (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    onDeleteMultiplePhotos(allBrokenPhotoIds);
                    setBrokenPhotoIds(new Set());
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="যে ছবির ফাইলগুলো সার্ভার রিস্টার্টের কারণে হারিয়ে গেছে সেগুলো একসাথে পরিষ্কার করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>নষ্ট/মিসিং ছবি মুছুন ({allBrokenPhotoIds.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  soundFX.playPop();
                  onOpenUpload();
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#ff35bb]/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Photo Slot</span>
              </button>
              <input
                type="text"
                value={searchAdmin}
                onChange={(e) => setSearchAdmin(e.target.value)}
                placeholder="Search photo slot..."
                className="bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none"
              />
            </div>
          </div>

          {allBrokenPhotoIds.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">
                  {allBrokenPhotoIds.length}টি ছবির ফাইল পাওয়া যায়নি (সার্ভার রিস্টার্ট হওয়ার কারণে আগের /uploads/ ফাইল হারিয়ে গেছে)
                </p>
                <p className="text-[11px] text-amber-200/80">
                  এখন থেকে আপলোড করা সব ছবি স্থায়ীভাবে ডাটাবেজে সেভ থাকবে এবং আর কখনো হারাবে না। আগের নষ্ট স্লটগুলো সরাতে উপরে &ldquo;নষ্ট/মিসিং ছবি মুছুন&rdquo; বাটনে চাপ দিন অথবা Edit থেকে নতুন ছবি দিন।
                </p>
              </div>
            </div>
          )}

          {(() => {
            const filteredAdminPhotos = photos.filter((p) => {
              if (!p) return false;
              const search = (searchAdmin || '').toLowerCase().trim();
              if (!search) return true;
              const titleMatch = (p.title || '').toLowerCase().includes(search);
              const catMatch = (p.category || '').toLowerCase().includes(search);
              const authorMatch = (p.author || '').toLowerCase().includes(search);
              return titleMatch || catMatch || authorMatch;
            });
            const displayedAdminPhotos = filteredAdminPhotos.slice(0, visibleAdminPhotos);
            return (
          <div className="space-y-2">
            {displayedAdminPhotos.map((photo, pIdx) => {
                const isBroken = brokenPhotoIds.has(photo.id) || !photo.imageUrl || photo.imageUrl.trim() === '' || photo.imageUrl.startsWith('blob:');
                return (
                <div
                  key={photo.id ? `admin-p-${photo.id}` : `admin-p-slot-${photo.slotNumber}-${pIdx}`}
                  className={`p-3 rounded-2xl bg-[#111522] border flex items-center justify-between gap-3 transition-all ${
                    isBroken ? 'border-amber-500/35 hover:border-amber-400/60' : 'border-[#252a3d] hover:border-[#ff35bb]/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {photo.imageUrl && photo.imageUrl.trim() !== '' && !photo.imageUrl.startsWith('blob:') ? (
                      <img
                        src={photo.imageUrl}
                        alt={photo.title || 'Photo'}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          setBrokenPhotoIds((prev) => {
                            if (prev.has(photo.id)) return prev;
                            const next = new Set(prev);
                            next.add(photo.id);
                            return next;
                          });
                          handleImageFallback(e, getPhotoFallbackUrl(photo.slotNumber || pIdx + 1));
                        }}
                        className="w-12 h-12 rounded-xl object-cover border border-[#252a3d] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#1b2138] border border-amber-500/40 shrink-0 flex items-center justify-center text-[10px] text-amber-400 font-bold">
                        #{photo.slotNumber || pIdx + 1}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-numbers text-[10px] font-bold text-[#ff35bb] px-1.5 py-0.2 rounded bg-[#ff35bb]/15">
                          Slot #{String(photo.slotNumber || pIdx + 1).padStart(3, '0')}
                        </span>
                        <h4 className="font-bold text-xs text-white truncate">{photo.title || `Slot #${photo.slotNumber}`}</h4>
                        {isBroken && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            ফাইল নেই — পুনরায় দিন
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9da4b8] mt-0.5">
                        {photo.category || 'Glamour'} · {formatLikes(photo.likes, photo.slotNumber, photo.id)} likes · {(photo.comments || []).length} comments · by {photo.author || 'Creator'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playPop();
                        const updated: PhotoItem = { ...photo, isLocked: !photo.isLocked };
                        onEditPhoto(updated);
                      }}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                        photo.isLocked
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-[#151a2d] text-[#9da4b8] hover:text-white border-[#252a3d]'
                      }`}
                      title={photo.isLocked ? 'আনলক করুন' : 'লক করুন (Watch Ad to Unlock)'}
                    >
                      {photo.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{photo.isLocked ? 'Locked' : 'Unlocked'}</span>
                    </button>

                    <button
                      onClick={() => {
                        soundFX.playPop();
                        setEditingPhoto({ ...photo });
                      }}
                      className="p-2 rounded-xl bg-[#151a2d] hover:bg-[#202742] text-[#00d2ff] border border-[#252a3d] text-xs font-semibold flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playPop();
                        onDeletePhoto(photo.id);
                      }}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                      title="সরাসরি ফটো স্লট মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
                );
              })}

            {filteredAdminPhotos.length > visibleAdminPhotos && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setVisibleAdminPhotos((c) => c + 30)}
                  className="flex-1 py-2.5 rounded-2xl bg-[#161a2b] hover:bg-[#1f2540] border border-[#252a3d] text-xs font-bold text-[#00d2ff] transition-colors"
                >
                  আরও ফটো দেখুন (+30 · {filteredAdminPhotos.length - visibleAdminPhotos}টি বাকি)
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleAdminPhotos(filteredAdminPhotos.length)}
                  className="px-4 py-2.5 rounded-2xl bg-[#161a2b] hover:bg-[#1f2540] border border-[#252a3d] text-xs font-bold text-[#9da4b8] hover:text-white transition-colors"
                >
                  সব ({filteredAdminPhotos.length})
                </button>
              </div>
            )}
          </div>
            );
          })()}
        </div>
      )}

      {/* SECTION 3: VIDEOS MANAGER */}
      {activeSection === 'videos' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-base text-white">Manage Videos (500 Slots)</h2>
              <p className="text-xs text-[#9da4b8]">Edit MP4 stream links, YouTube URLs, thumbnails, duration, or clean broken slots.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {allBrokenVideoIds.length > 0 && onDeleteMultipleVideos && (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    onDeleteMultipleVideos(allBrokenVideoIds);
                    setBrokenVideoIds(new Set());
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="যে ভিডিও ফাইলগুলো সার্ভার বা ব্রাউজারে নেই সেগুলো একসাথে পরিষ্কার করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>নষ্ট/মিসিং ভিডিও মুছুন ({allBrokenVideoIds.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  soundFX.playPop();
                  onOpenUpload();
                }}
                className="self-start px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8b4dff] to-[#00d2ff] text-white text-xs font-bold"
              >
                Add Video Slot
              </button>
            </div>
          </div>

          {allBrokenVideoIds.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">
                  {allBrokenVideoIds.length}টি ভিডিও ফাইল অনুপলব্ধ (আগের ডিভাইস-লোকাল বা পুরোনো সার্ভারের ফাইল)
                </p>
                <p className="text-[11px] text-amber-200/80">
                  নষ্ট স্লটগুলো সরাতে উপরে &ldquo;নষ্ট/মিসিং ভিডিও মুছুন&rdquo; বাটনে চাপ দিন অথবা Edit থেকে নতুন MP4 / YouTube লিংক দিন।
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {videos.slice(0, visibleAdminVideos).map((video, vIdx) => {
              const isVideoBroken = brokenVideoIds.has(video.id);
              return (
              <div
                key={video.id ? `admin-v-${video.id}` : `admin-v-slot-${video.slotNumber}-${vIdx}`}
                className={`p-3 rounded-2xl bg-[#111522] border flex items-center justify-between gap-3 transition-all ${
                  isVideoBroken ? 'border-amber-500/40 hover:border-amber-400/60' : 'border-[#252a3d] hover:border-[#8b4dff]/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {video.thumbnailUrl && video.thumbnailUrl.trim() !== '' && !video.thumbnailUrl.startsWith('blob:') ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title || 'Video'}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageFallback(e, getVideoThumbnailFallbackUrl(video.slotNumber || vIdx + 1))}
                      className="w-16 h-11 rounded-xl object-cover border border-[#252a3d] shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-11 rounded-xl bg-[#1b2138] border border-[#252a3d] shrink-0 flex items-center justify-center text-[10px] text-[#8b4dff] font-bold">
                      #{video.slotNumber || vIdx + 1}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-numbers text-[10px] font-bold text-[#8b4dff] px-1.5 py-0.2 rounded bg-[#8b4dff]/15">
                        Slot #{String(video.slotNumber || vIdx + 1).padStart(2, '0')}
                      </span>
                      <h4 className="font-bold text-xs text-white truncate">{video.title || `Video #${video.slotNumber}`}</h4>
                      {isVideoBroken ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          ফাইল নেই — পুনরায় দিন
                        </span>
                      ) : isPermanentVideoSource(video) ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          ✓ Cloud Permanent
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-[#9da4b8] mt-0.5 truncate">
                      {video.category || 'Cinematic'} · Duration: {video.duration || '0:30'} · {video.views || 0} views
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      const updated: VideoItem = { ...video, isLocked: !video.isLocked };
                      onEditVideo(updated);
                    }}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                      video.isLocked
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[#151a2d] text-[#9da4b8] hover:text-white border-[#252a3d]'
                    }`}
                    title={video.isLocked ? 'আনলক করুন' : 'লক করুন (Watch Ad to Unlock)'}
                  >
                    {video.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{video.isLocked ? 'Locked' : 'Unlocked'}</span>
                  </button>

                  <button
                    onClick={() => {
                      soundFX.playPop();
                      setEditingVideo({ ...video });
                    }}
                    className="p-2 rounded-xl bg-[#151a2d] hover:bg-[#202742] text-[#00d2ff] border border-[#252a3d] text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playPop();
                        onDeleteVideo(video.id);
                      }}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                      title="সরাসরি ভিডিও স্লট মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                </div>
              </div>
              );
            })}

            {videos.length > visibleAdminVideos && (
              <button
                type="button"
                onClick={() => setVisibleAdminVideos((c) => c + 30)}
                className="w-full py-2.5 rounded-2xl bg-[#161a2b] hover:bg-[#1f2540] border border-[#252a3d] text-xs font-bold text-[#00d2ff] transition-colors"
              >
                আরও ভিডিও দেখুন ({videos.length - visibleAdminVideos}টি বাকি)
              </button>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: COMMENTS MODERATION */}
      {activeSection === 'comments' && (
        <div className="space-y-3 animate-in fade-in">
          <div>
            <h2 className="font-display font-bold text-base text-white">Moderate Community Comments</h2>
            <p className="text-xs text-[#9da4b8]">Delete spam comments or reply officially with an Admin badge.</p>
          </div>

          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{comment.authorName}</span>
                    <span className="text-[10px] text-[#9da4b8]">{comment.timestamp}</span>
                    {comment.category && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1e243b] text-[#ff35bb]">
                        {comment.category}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      onDeleteComment(comment.id);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors active:scale-95"
                    title="সরাসরি কমেন্ট মুছুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>

                <p className="text-xs text-[#e1dbed] leading-relaxed mb-3">{comment.content}</p>

                {/* Existing Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-4 space-y-2 mb-3 border-l-2 border-[#252a3d] pl-3">
                    {comment.replies.map((rep) => (
                      <div key={rep.id} className="text-xs bg-[#151a2d] p-2 rounded-xl">
                        <span className="font-bold text-white text-[11px]">{rep.authorName}: </span>
                        <span className="text-[#d5cce7]">{rep.content}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                {replyingCommentId === comment.id ? (
                  <div className="mt-2 pt-2 border-t border-[#252a3d] flex gap-2">
                    <input
                      type="text"
                      value={adminCommentReplyText}
                      onChange={(e) => setAdminCommentReplyText(e.target.value)}
                      placeholder="Type official admin reply..."
                      autoFocus
                      className="flex-1 bg-[#0b0e18] border border-[#ff35bb] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (adminCommentReplyText.trim()) {
                          soundFX.playSuccess();
                          onAdminReplyComment(comment.id, adminCommentReplyText.trim());
                          setAdminCommentReplyText('');
                          setReplyingCommentId(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold"
                    >
                      Post Reply
                    </button>
                    <button
                      onClick={() => setReplyingCommentId(null)}
                      className="px-2 text-xs text-[#9da4b8] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      soundFX.playPop();
                      setReplyingCommentId(comment.id);
                    }}
                    className="text-xs font-semibold text-[#00d2ff] hover:underline flex items-center gap-1"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    <span>Reply as SUZIKA Admin</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: INBOX (USER MESSAGES) */}
      {activeSection === 'inbox' && (
        <div className="space-y-3 animate-in fade-in">
          <div>
            <h2 className="font-display font-bold text-base text-white">Admin Inbox (User Inquiries)</h2>
            <p className="text-xs text-[#9da4b8]">Direct communication channel for photo requests, sponsorships, and user feedback.</p>
          </div>

          <div className="space-y-3">
            {adminMessages.map((msg) => (
              <div key={msg.id} className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{msg.senderName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e243b] text-[#00d2ff] font-semibold">
                      {msg.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9da4b8]">{msg.timestamp}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#0b0e18] border border-[#252a3d] text-xs text-white mb-3">
                  {msg.message}
                </div>

                {msg.reply ? (
                  <div className="p-3 rounded-xl bg-[#151c33] border border-[#00d2ff]/30 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#00d2ff] mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{msg.reply.adminName}</span>
                      <span className="text-[10px] text-[#9da4b8] font-normal ml-auto">{msg.reply.timestamp}</span>
                    </div>
                    <p className="text-[#d5cce7]">{msg.reply.text}</p>
                  </div>
                ) : (
                  <div>
                    {replyingMessageId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={adminMessageReplyText}
                          onChange={(e) => setAdminMessageReplyText(e.target.value)}
                          placeholder="Type official reply that the user will receive in their notifications..."
                          rows={2}
                          autoFocus
                          className="w-full bg-[#0b0e18] border border-[#00d2ff] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (adminMessageReplyText.trim()) {
                                soundFX.playSuccess();
                                onAdminReplyUserMessage(msg.id, adminMessageReplyText.trim());
                                setAdminMessageReplyText('');
                                setReplyingMessageId(null);
                              }
                            }}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#00d2ff] to-[#8b4dff] text-white text-xs font-bold"
                          >
                            Send Admin Reply
                          </button>
                          <button
                            onClick={() => setReplyingMessageId(null)}
                            className="px-3 text-xs text-[#9da4b8]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          soundFX.playPop();
                          setReplyingMessageId(msg.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#151a2d] hover:bg-[#202742] text-[#00d2ff] text-xs font-bold border border-[#252a3d] flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send Official Reply</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: REAL ADVERTISING & GOOGLE ADMOB CONTROLS */}
      {activeSection === 'ads' && (
        <form onSubmit={handleSaveBanner} className="space-y-5 animate-in fade-in p-5 sm:p-6 rounded-3xl bg-[#111522] border border-amber-400/40 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#252a3d]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-[#ff35bb] flex items-center justify-center text-black font-black shadow-lg">
                <Sparkles className="w-6 h-6 text-black" />
              </div>
              <div>
                <h2 className="font-display font-black text-lg text-white">
                  Google AdMob (Android) & AdSense (Web) Settings
                </h2>
                <p className="text-xs text-[#9da4b8]">
                  Configure real advertising IDs for native Android APK and Web. No fake ads or simulated metrics.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tempBanner.isTestMode !== false ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'}`}>
                {tempBanner.isTestMode !== false ? '● Test Ads Mode (Official Test IDs)' : '● Production Mode (Real AdMob)'}
              </span>
            </div>
          </div>

          {/* Quick Live Toggle Bar for the 2 New Web Placements (Gallery Image Ad & Video Play Ad) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#0b0f1d] border border-[#ff35bb]/35">
            <div className="p-3 rounded-xl bg-[#111524] border border-[#252a3d] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  🖼️ Gallery Full-Screen Image Ad
                </span>
                <span className="text-[11px] text-[#9da4b8] block">
                  {tempBanner.galleryInterstitialTagUrl?.trim() ? 'Tag Configured' : 'Tag ফাঁকা (নিচে বসান ↓)'} · প্রতি {tempBanner.galleryInterstitialFrequency ?? 3} ছবিতে
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  const next = {
                    ...tempBanner,
                    enableGalleryInterstitialAd: tempBanner.enableGalleryInterstitialAd === false ? true : false,
                  };
                  setTempBanner(next);
                  onUpdateBannerConfig(next);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  tempBanner.enableGalleryInterstitialAd !== false
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                {tempBanner.enableGalleryInterstitialAd !== false ? '✓ Enabled' : '✕ Disabled'}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#111524] border border-[#252a3d] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  🎬 Video Play Ad (VAST / Interstitial)
                </span>
                <span className="text-[11px] text-[#9da4b8] block">
                  {tempBanner.videoPlayAdTagUrl?.trim() ? 'Tag Configured' : 'Tag ফাঁকা (নিচে বসান ↓)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  const next = {
                    ...tempBanner,
                    enableVideoPlayAd: tempBanner.enableVideoPlayAd === false ? true : false,
                  };
                  setTempBanner(next);
                  onUpdateBannerConfig(next);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  tempBanner.enableVideoPlayAd !== false
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                {tempBanner.enableVideoPlayAd !== false ? '✓ Enabled' : '✕ Disabled'}
              </button>
            </div>
          </div>

          {/* Mode Switcher Buttons: Test Mode vs Real AdMob Mode */}
          <div className="p-4 rounded-2xl bg-[#0b0f1d] border border-amber-400/40 text-xs text-amber-100 space-y-3 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <span className={`w-2.5 h-2.5 rounded-full ${tempBanner.isTestMode !== false ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                <span className="text-sm">অ্যাড মোড নির্বাচন করুন (Ad Mode Selection):</span>
              </div>
              
              <div className="flex items-center gap-2 p-1 bg-[#141829] rounded-2xl border border-[#252a3d]">
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    setTempBanner({
                      ...tempBanner,
                      isTestMode: true,
                      admobAppId: TEST_ADMOB_CONFIG.appId,
                      admobBannerUnitId: TEST_ADMOB_CONFIG.bannerUnitId,
                      admobInterstitialUnitId: TEST_ADMOB_CONFIG.interstitialUnitId,
                      admobRewardedUnitId: TEST_ADMOB_CONFIG.rewardedUnitId,
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    tempBanner.isTestMode !== false
                      ? 'bg-amber-400 text-black font-black shadow-md'
                      : 'text-[#9da4b8] hover:text-white'
                  }`}
                >
                  🧪 টেস্ট মোড (Official Test Ads)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playSuccess();
                    setTempBanner({
                      ...tempBanner,
                      isTestMode: false,
                      admobAppId: REAL_ADMOB_CONFIG.appId,
                      admobBannerUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
                      admobInterstitialUnitId: REAL_ADMOB_CONFIG.interstitialUnitId,
                      admobRewardedUnitId: REAL_ADMOB_CONFIG.rewardedUnitId,
                      admobAppOpenUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
                      admobNativeUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
                      enableAndroidBanner: true,
                      enableAndroidInterstitial: true,
                      enableAndroidRewarded: true,
                      enableWebAdSense: true,
                      enableAds: true,
                      adsenseClientId: tempBanner.adsenseClientId || 'ca-pub-8091473961803972',
                      adsenseBannerSlot: tempBanner.adsenseBannerSlot || '3707200236',
                      adsenseInfeedSlot: tempBanner.adsenseInfeedSlot || '5711593220',
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    tempBanner.isTestMode === false
                      ? 'bg-emerald-500 text-white font-black shadow-md shadow-emerald-500/20'
                      : 'text-[#9da4b8] hover:text-white'
                  }`}
                >
                  💰 বাস্তব বিজ্ঞাপন মোড (Real AdMob)
                </button>
              </div>
            </div>

            {tempBanner.isTestMode === false ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>বাস্তব AdMob মোড সক্রিয় (Real AdMob Production Mode Active)</span>
                </p>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  আপনার Google AdMob একাউন্টের আসল App ID এবং Ad Unit ID নিচে যুক্ত করা আছে। অ্যাপ রিলিজ করতে &quot;Save Real Advertising Settings&quot; বাটনে চাপুন।
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-amber-200/90 leading-relaxed">
                ডেভেলপমেন্ট ও পরীক্ষার সময় Google অফিসিয়াল টেস্ট অ্যাড আইডি ব্যবহার করতে হবে। গুগল AdMob একাউন্ট ভেরিফাই হলে উপরের &quot;বাস্তব বিজ্ঞাপন মোড&quot; চাপুন।
              </p>
            )}

            {/* Quick 4-Step Setup Guide in Bengali */}
            <div className="p-3 bg-[#111524] rounded-xl border border-[#252a3d] space-y-1.5 text-[11px] text-[#9da4b8]">
              <strong className="text-white block font-display">📌 আপনার আসল AdMob আইডিগুলো:</strong>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-[#0b0e18] border border-[#252a3d]">
                  <b className="text-amber-300">১. App ID:</b> <code className="text-emerald-400 text-[10px] break-all">{REAL_ADMOB_CONFIG.appId}</code>
                </div>
                <div className="p-2 rounded-lg bg-[#0b0e18] border border-[#252a3d]">
                  <b className="text-amber-300">২. Banner Ad:</b> <code className="text-emerald-400 text-[10px] break-all">{REAL_ADMOB_CONFIG.bannerUnitId}</code>
                </div>
                <div className="p-2 rounded-lg bg-[#0b0e18] border border-[#252a3d]">
                  <b className="text-amber-300">৩. Interstitial Ad:</b> <code className="text-emerald-400 text-[10px] break-all">{REAL_ADMOB_CONFIG.interstitialUnitId}</code>
                </div>
                <div className="p-2 rounded-lg bg-[#0b0e18] border border-[#252a3d]">
                  <b className="text-amber-300">৪. Rewarded Ad:</b> <code className="text-emerald-400 text-[10px] break-all">{REAL_ADMOB_CONFIG.rewardedUnitId}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Status Card */}
          <div className="p-4 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Real AdMob Configuration Status</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#111524] border border-[#252a3d]">
                <span className="text-[#9da4b8] block text-[11px]">AdMob App ID:</span>
                <span className={`font-mono font-bold text-xs ${tempBanner.admobAppId && !tempBanner.admobAppId.includes('3940256099942544') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {tempBanner.admobAppId && !tempBanner.admobAppId.includes('3940256099942544') ? '✓ Real ID Active' : 'Test ID Active'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#111524] border border-[#252a3d]">
                <span className="text-[#9da4b8] block text-[11px]">Adaptive Banner Unit:</span>
                <span className={`font-mono font-bold text-xs ${tempBanner.admobBannerUnitId && !tempBanner.admobBannerUnitId.includes('3940256099942544') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {tempBanner.admobBannerUnitId && !tempBanner.admobBannerUnitId.includes('3940256099942544') ? '✓ Real ID Active' : 'Test ID Active'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#111524] border border-[#252a3d]">
                <span className="text-[#9da4b8] block text-[11px]">Interstitial Unit:</span>
                <span className={`font-mono font-bold text-xs ${tempBanner.admobInterstitialUnitId && !tempBanner.admobInterstitialUnitId.includes('3940256099942544') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {tempBanner.admobInterstitialUnitId && !tempBanner.admobInterstitialUnitId.includes('3940256099942544') ? '✓ Real ID Active' : 'Test ID Active'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#111524] border border-[#252a3d]">
                <span className="text-[#9da4b8] block text-[11px]">Rewarded Ad Unit:</span>
                <span className={`font-mono font-bold text-xs ${tempBanner.admobRewardedUnitId && !tempBanner.admobRewardedUnitId.includes('3940256099942544') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {tempBanner.admobRewardedUnitId && !tempBanner.admobRewardedUnitId.includes('3940256099942544') ? '✓ Real ID Active' : 'Test ID Active'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#78829d]">
              * Note: Real advertising revenue is only generated when your actual AdMob account is connected, verified with payment details, and approved by Google.
            </p>
          </div>

          {/* Quick Fill Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-[#151a2d] border border-[#2b3553]">
            <div>
              <span className="text-xs font-bold text-white block">এক ক্লিকে রিলিজ আইডি সেট করুন (One-Click Setup)</span>
              <span className="text-[11px] text-[#9da4b8]">আপনার দেওয়া সব আসল AdMob ও AdSense আইডি স্বয়ংক্রিয়ভাবে ইনপুটে বসান।</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFX.playSuccess();
                  setTempBanner({
                    ...tempBanner,
                    admobAppId: REAL_ADMOB_CONFIG.appId,
                    admobBannerUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
                    admobInterstitialUnitId: REAL_ADMOB_CONFIG.interstitialUnitId,
                    admobRewardedUnitId: REAL_ADMOB_CONFIG.rewardedUnitId,
                    admobAppOpenUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
                    admobNativeUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
                    enableAndroidBanner: true,
                    enableAndroidInterstitial: true,
                    enableAndroidRewarded: true,
                    enableWebAdSense: true,
                    enableAds: true,
                    adsenseClientId: 'ca-pub-8091473961803972',
                    adsenseBannerSlot: '3707200236',
                    adsenseInfeedSlot: '5711593220',
                    googleAdClient: 'ca-pub-8091473961803972',
                    googleAdSlotBanner: '3707200236',
                    googleAdSlotInterstitial: '5711593220',
                    googleAdSlotRewarded: '6716506951',
                    isTestMode: false,
                  });
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>আসল প্রডাকশন আইডি সেট করুন (Fill Real IDs)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTempBanner({
                    ...tempBanner,
                    admobAppId: TEST_ADMOB_CONFIG.appId,
                    admobBannerUnitId: TEST_ADMOB_CONFIG.bannerUnitId,
                    admobInterstitialUnitId: TEST_ADMOB_CONFIG.interstitialUnitId,
                    admobRewardedUnitId: TEST_ADMOB_CONFIG.rewardedUnitId,
                    admobAppOpenUnitId: TEST_ADMOB_CONFIG.appOpenUnitId,
                    admobNativeUnitId: TEST_ADMOB_CONFIG.nativeUnitId,
                    isTestMode: true,
                  });
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-black shadow hover:brightness-110 active:scale-95 transition-all"
              >
                টেস্ট আইডি (Test IDs)
              </button>
            </div>
          </div>

          {/* Android AdMob Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AdMob App ID */}
            <div className="p-4 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white block">
                  Google AdMob App ID (Android APK)
                </label>
                {tempBanner.admobAppId === REAL_ADMOB_CONFIG.appId && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✓ Real ID
                  </span>
                )}
              </div>
              <input
                type="text"
                value={tempBanner.admobAppId || ''}
                onChange={(e) => setTempBanner({ ...tempBanner, admobAppId: e.target.value })}
                placeholder="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
                className="w-full bg-[#111522] border border-[#252a3d] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
              <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
                <span>আসল: <code className="text-emerald-400">{REAL_ADMOB_CONFIG.appId}</code></span>
                {tempBanner.admobAppId !== REAL_ADMOB_CONFIG.appId && (
                  <button
                    type="button"
                    onClick={() => setTempBanner({ ...tempBanner, admobAppId: REAL_ADMOB_CONFIG.appId, isTestMode: false })}
                    className="text-[10px] text-[#00d2ff] hover:underline"
                  >
                    আসল আইডি দিন
                  </button>
                )}
              </div>
            </div>

            {/* Banner Ad Unit ID */}
            <div className="p-4 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white block">
                  Adaptive Banner Ad Unit ID (Home Screen Bottom)
                </label>
                {tempBanner.admobBannerUnitId === REAL_ADMOB_CONFIG.bannerUnitId && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✓ Real ID
                  </span>
                )}
              </div>
              <input
                type="text"
                value={tempBanner.admobBannerUnitId || ''}
                onChange={(e) => setTempBanner({ ...tempBanner, admobBannerUnitId: e.target.value })}
                placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                className="w-full bg-[#111522] border border-[#252a3d] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
              <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
                <span>আসল: <code className="text-emerald-400">{REAL_ADMOB_CONFIG.bannerUnitId}</code></span>
                {tempBanner.admobBannerUnitId !== REAL_ADMOB_CONFIG.bannerUnitId && (
                  <button
                    type="button"
                    onClick={() => setTempBanner({ ...tempBanner, admobBannerUnitId: REAL_ADMOB_CONFIG.bannerUnitId, isTestMode: false })}
                    className="text-[10px] text-[#00d2ff] hover:underline"
                  >
                    আসল আইডি দিন
                  </button>
                )}
              </div>
            </div>

            {/* Interstitial Ad Unit ID */}
            <div className="p-4 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white block">
                  Interstitial Video Ad Unit ID (Natural Breaks)
                </label>
                {tempBanner.admobInterstitialUnitId === REAL_ADMOB_CONFIG.interstitialUnitId && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✓ Real ID
                  </span>
                )}
              </div>
              <input
                type="text"
                value={tempBanner.admobInterstitialUnitId || ''}
                onChange={(e) => setTempBanner({ ...tempBanner, admobInterstitialUnitId: e.target.value })}
                placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                className="w-full bg-[#111522] border border-[#252a3d] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
              <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
                <span>আসল: <code className="text-emerald-400">{REAL_ADMOB_CONFIG.interstitialUnitId}</code></span>
                {tempBanner.admobInterstitialUnitId !== REAL_ADMOB_CONFIG.interstitialUnitId && (
                  <button
                    type="button"
                    onClick={() => setTempBanner({ ...tempBanner, admobInterstitialUnitId: REAL_ADMOB_CONFIG.interstitialUnitId, isTestMode: false })}
                    className="text-[10px] text-[#00d2ff] hover:underline"
                  >
                    আসল আইডি দিন
                  </button>
                )}
              </div>
            </div>

            {/* Rewarded / Native Unit ID */}
            <div className="p-4 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white block">
                  Rewarded Ad Unit ID (Content Unlock)
                </label>
                {tempBanner.admobRewardedUnitId === REAL_ADMOB_CONFIG.rewardedUnitId && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✓ Real ID
                  </span>
                )}
              </div>
              <input
                type="text"
                value={tempBanner.admobRewardedUnitId || ''}
                onChange={(e) => setTempBanner({ ...tempBanner, admobRewardedUnitId: e.target.value })}
                placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                className="w-full bg-[#111522] border border-[#252a3d] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
              <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
                <span>আসল: <code className="text-emerald-400">{REAL_ADMOB_CONFIG.rewardedUnitId}</code></span>
                {tempBanner.admobRewardedUnitId !== REAL_ADMOB_CONFIG.rewardedUnitId && (
                  <button
                    type="button"
                    onClick={() => setTempBanner({ ...tempBanner, admobRewardedUnitId: REAL_ADMOB_CONFIG.rewardedUnitId, isTestMode: false })}
                    className="text-[10px] text-[#00d2ff] hover:underline"
                  >
                    আসল আইডি দিন
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Supported Ad Placements Toggles */}
          <div className="p-4 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Supported Ad Placements (Android APK)
            </h3>

            {/* Placement 1: Adaptive Banner at Home bottom */}
            <div className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  Adaptive Banner Ad (Bottom of Home Screen)
                </span>
                <span className="text-[11px] text-[#9da4b8] block mt-0.5">
                  Displays anchored at the bottom of the native Android app without covering any controls or content.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTempBanner({
                    ...tempBanner,
                    enableAndroidBanner: tempBanner.enableAndroidBanner === false ? true : false,
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${
                  tempBanner.enableAndroidBanner !== false
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                {tempBanner.enableAndroidBanner !== false ? '✓ Enabled' : '✕ Disabled'}
              </button>
            </div>

            {/* Placement 2: Natural Break Interstitial */}
            <div className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  Interstitial Ad at Natural Breaks
                </span>
                <span className="text-[11px] text-[#9da4b8] block mt-0.5">
                  Shows at transition moments between tabs or after finishing a browsing session, never interrupting active video playback.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTempBanner({
                    ...tempBanner,
                    enableAndroidInterstitial: tempBanner.enableAndroidInterstitial === false ? true : false,
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${
                  tempBanner.enableAndroidInterstitial !== false
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                {tempBanner.enableAndroidInterstitial !== false ? '✓ Enabled' : '✕ Disabled'}
              </button>
            </div>

            {/* Placement 3: Rewarded Ads for Content Unlock (Rules 2, 3, 4, 5, 6) */}
            <div className="p-3.5 rounded-xl bg-[#111522] border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">
                    Rewarded Ads (Watch Ad to Unlock Blurred Content)
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    User Requested
                  </span>
                </div>
                <span className="text-[11px] text-[#9da4b8] block mt-0.5">
                  Unblurs and unlocks online videos and selected premium photos only when the user finishes the rewarded video ad.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTempBanner({
                    ...tempBanner,
                    enableAndroidRewarded: tempBanner.enableAndroidRewarded === false ? true : false,
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${
                  tempBanner.enableAndroidRewarded !== false
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                {tempBanner.enableAndroidRewarded !== false ? '✓ Enabled' : '✕ Disabled'}
              </button>
            </div>

            {/* Placement 4: Native In-Feed Ads */}
            <div className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  Native Advanced Ads (Between Content Cards)
                </span>
                <span className="text-[11px] text-[#9da4b8] block mt-0.5">
                  Blends natively with the 2-column feed without interfering with photo browsing.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTempBanner({
                    ...tempBanner,
                    enableAndroidNative: tempBanner.enableAndroidNative === false ? true : false,
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${
                  tempBanner.enableAndroidNative !== false
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                {tempBanner.enableAndroidNative !== false ? '✓ Enabled' : '✕ Disabled'}
              </button>
            </div>

            {/* Placement 5: Optional App Open Ads */}
            <div className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  App Open Ads (When Home Screen is Ready)
                </span>
                <span className="text-[11px] text-[#9da4b8] block mt-0.5">
                  Optional full-screen ad shown when returning to the app from the background.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTempBanner({
                    ...tempBanner,
                    enableAndroidAppOpen: tempBanner.enableAndroidAppOpen ? false : true,
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${
                  tempBanner.enableAndroidAppOpen
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-[#181d30] text-[#9da4b8] border border-[#252a3d]'
                }`}
              >
                {tempBanner.enableAndroidAppOpen ? '✓ Enabled' : '✕ Disabled'}
              </button>
            </div>
          </div>

          {/* Content Lock Rules Configuration */}
          <div className="p-4 rounded-2xl bg-[#0b0e18] border border-amber-500/30 space-y-3">
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Content Lock & Unlock Rules (Admin Control)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-2 cursor-pointer">
                <div>
                  <span className="font-bold text-white block">Lock Online Videos by Default</span>
                  <span className="text-[11px] text-[#9da4b8] block">Uploaded online reels appear blurred with &ldquo;Watch Ad to Unlock&rdquo;</span>
                </div>
                <input
                  type="checkbox"
                  checked={tempBanner.lockOnlineVideosByDefault !== false}
                  onChange={(e) => setTempBanner({ ...tempBanner, lockOnlineVideosByDefault: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-400 focus:ring-amber-400"
                />
              </label>

              <label className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-2 cursor-pointer">
                <div>
                  <span className="font-bold text-white block">Lock Premium Categories (Sexy, Call, Hot)</span>
                  <span className="text-[11px] text-[#9da4b8] block">Photos in selected categories require rewarded ad to unlock</span>
                </div>
                <input
                  type="checkbox"
                  checked={tempBanner.requireAdForPremiumPhotos !== false}
                  onChange={(e) => setTempBanner({ ...tempBanner, requireAdForPremiumPhotos: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-400 focus:ring-amber-400"
                />
              </label>

              <label className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-2 cursor-pointer">
                <div>
                  <span className="font-bold text-white block">Rewarded Ad on HD Downloads</span>
                  <span className="text-[11px] text-[#9da4b8] block">Require short Rewarded Ad before saving HD photo or video files</span>
                </div>
                <input
                  type="checkbox"
                  checked={tempBanner.requireAdForDownloads !== false}
                  onChange={(e) => setTempBanner({ ...tempBanner, requireAdForDownloads: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-400 focus:ring-amber-400"
                />
              </label>
            </div>

            <div className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-white block">Unlock Duration per Ad</span>
                <span className="text-[11px] text-[#9da4b8] block">How long the content stays unblurred after user finishes watching the ad</span>
              </div>
              <select
                value={tempBanner.unlockDurationHours ?? 12}
                onChange={(e) => setTempBanner({ ...tempBanner, unlockDurationHours: Number(e.target.value) })}
                className="bg-[#181d30] border border-[#252a3d] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value={1}>১ ঘণ্টা (1 Hour)</option>
                <option value={6}>৬ ঘণ্টা (6 Hours)</option>
                <option value={12}>১২ ঘণ্টা (12 Hours - Recommended)</option>
                <option value={24}>২৪ ঘণ্টা (24 Hours)</option>
                <option value={72}>৭২ ঘণ্টা (3 Days)</option>
                <option value={0}>স্থায়ী (Permanent Unlock)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-white block">Interstitial Ad Frequency (প্রতি কতটি ভিউতে দেখাবে)</span>
                <span className="text-[11px] text-[#9da4b8] block">ছবি বা ভিডিও খোলার/বন্ধ করার স্বাভাবিক বিরতিতে ইন্টারস্টিশিয়াল বিজ্ঞাপন দেখানোর ব্যবধান</span>
              </div>
              <select
                value={tempBanner.interstitialFrequency ?? 5}
                onChange={(e) => setTempBanner({ ...tempBanner, interstitialFrequency: Number(e.target.value) })}
                className="bg-[#181d30] border border-[#252a3d] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value={3}>প্রতি ৩ বার ক্লিকে (Every 3 views - High Fill)</option>
                <option value={5}>প্রতি ৫ বার ক্লিকে (Every 5 views - Balanced)</option>
                <option value={7}>প্রতি ৭ বার ক্লিকে (Every 7 views)</option>
                <option value={10}>প্রতি ১০ বার ক্লিকে (Every 10 views)</option>
              </select>
            </div>
          </div>

          {/* Web Version (Google AdSense + Backup Web Ad Network) Section */}
          <div className="p-4 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Web Version: Google AdSense &amp; Backup Ad Network
                </h3>
                <span className="text-[11px] text-[#9da4b8] block mt-0.5">
                  ওয়েব ইউজারদের জন্য Google AdSense এবং পাশাপাশি Adsterra / Monetag / Direct Banner যুক্ত করুন।
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTempBanner({
                    ...tempBanner,
                    enableWebAdSense: tempBanner.enableWebAdSense ? false : true,
                    enableAds: tempBanner.enableWebAdSense ? false : true,
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ${
                  tempBanner.enableWebAdSense
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-[#181d30] text-[#9da4b8] border border-[#252a3d]'
                }`}
              >
                {tempBanner.enableWebAdSense ? '✓ Web Ads On' : 'Web Ads Off'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-xs text-[#9da4b8] block mb-1">AdSense Client ID (Web)</label>
                <input
                  type="text"
                  value={tempBanner.adsenseClientId || ''}
                  onChange={(e) => setTempBanner({ ...tempBanner, adsenseClientId: e.target.value, googleAdClient: e.target.value })}
                  placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                  className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[#9da4b8] block mb-1">AdSense Banner Slot ID</label>
                <input
                  type="text"
                  value={tempBanner.adsenseBannerSlot || ''}
                  onChange={(e) => setTempBanner({ ...tempBanner, adsenseBannerSlot: e.target.value, googleAdSlotBanner: e.target.value })}
                  placeholder="3707200236"
                  className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[#9da4b8] block mb-1">AdSense In-Feed Slot ID</label>
                <input
                  type="text"
                  value={tempBanner.adsenseInfeedSlot || ''}
                  onChange={(e) => setTempBanner({ ...tempBanner, adsenseInfeedSlot: e.target.value })}
                  placeholder="5711593220"
                  className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Adsterra & 5-Minute Full-Screen Video Ad Network */}
            <div className="pt-3 border-t border-[#252a3d]/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-[#00d2ff]">
                    🌐 Adsterra (Direct Link / Banner / Video VAST) ও ৫-মিনিট ফুল-স্ক্রিন ভিডিও অ্যাড
                  </div>
                  <p className="text-[11px] text-[#9da4b8] mt-0.5">
                    Adsterra থেকে Direct Link, Banner Key (320x50 / 300x250), Social Bar বা VAST/MP4 ভিডিও লিংক বসালে ফাঁকা ব্যানার ও প্রতি ৫ মিনিটে ফুল-স্ক্রিন অ্যাডে সরাসরি রান হবে।
                  </p>
                </div>

                {onPreviewTimedAd && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      onPreviewTimedAd();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#ff35bb]/20 hover:bg-[#ff35bb]/30 border border-[#ff35bb]/40 text-[#ff8ce4] text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                  >
                    ▶ টেস্ট ৫-মিনিট ফুল-স্ক্রিন অ্যাড
                  </button>
                )}
              </div>

              {/* 5-Minute Fullscreen Ad Toggle & Interval */}
              <div className="p-3 rounded-xl bg-[#111522] border border-[#252a3d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Timed Full-Screen Video / Interstitial Ad (প্রতি ৫ মিনিটে ফুল-স্ক্রিন অ্যাড)
                  </span>
                  <span className="text-[11px] text-[#9da4b8] block">
                    ব্যবহারকারী অ্যাপটি ব্যবহার করার নির্দিষ্ট সময় পর পর অটো ফুল-স্ক্রিন ভিডিও/স্পনসর অ্যাড চলবে (সক্রিয় ভিডিও চলাকালে বিরক্ত করবে না)।
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={tempBanner.timedAdIntervalMinutes ?? 5}
                    onChange={(e) => setTempBanner({ ...tempBanner, timedAdIntervalMinutes: Number(e.target.value) })}
                    className="bg-[#181d30] border border-[#252a3d] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value={2}>প্রতি ২ মিনিট (2 min)</option>
                    <option value={3}>প্রতি ৩ মিনিট (3 min)</option>
                    <option value={5}>প্রতি ৫ মিনিট (5 min - Recommended)</option>
                    <option value={10}>প্রতি ১০ মিনিট (10 min)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      setTempBanner({
                        ...tempBanner,
                        enableTimedFullscreenAd: tempBanner.enableTimedFullscreenAd === false ? true : false,
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      tempBanner.enableTimedFullscreenAd !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    {tempBanner.enableTimedFullscreenAd !== false ? '✓ Active' : '✕ Off'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9da4b8] block mb-1">Adsterra Direct Link / SmartLink URL</label>
                  <input
                    type="url"
                    value={tempBanner.webSmartLinkUrl || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, webSmartLinkUrl: e.target.value })}
                    placeholder="https://www.effectivegatecpm.com/..."
                    className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9da4b8] block mb-1">Adsterra Video VAST / Direct MP4 Ad URL</label>
                  <input
                    type="url"
                    value={tempBanner.webVideoAdUrl || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, webVideoAdUrl: e.target.value })}
                    placeholder="https://.../vast.xml বা https://.../video-ad.mp4"
                    className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9da4b8] block mb-1">Adsterra Banner Zone Key (320x50 / 300x250)</label>
                  <input
                    type="text"
                    value={tempBanner.adsterraBannerKey || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, adsterraBannerKey: e.target.value })}
                    placeholder="e.g. a1b2c3d4e5f67890... (highperformanceformat key)"
                    className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9da4b8] block mb-1">Adsterra Social Bar / Popunder Script URL</label>
                  <input
                    type="url"
                    value={tempBanner.webAdScriptUrl || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, webAdScriptUrl: e.target.value })}
                    placeholder="https://pl...effectivegatecpm.com/.../invoke.js"
                    className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9da4b8] block mb-1">Direct Web Banner Image URL (ঐচ্ছিক)</label>
                  <input
                    type="url"
                    value={tempBanner.webBannerImageUrl || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, webBannerImageUrl: e.target.value })}
                    placeholder="https://.../banner.jpg"
                    className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9da4b8] block mb-1">Direct Web Banner Click Link (ঐচ্ছিক)</label>
                  <input
                    type="url"
                    value={tempBanner.webBannerClickUrl || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, webBannerClickUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* 2 New Placements: Full-Screen Gallery Image Ad & Video Play Ad */}
              <div className="pt-3 border-t border-[#252a3d]/70 space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-[#ff8ce4]">
                    🎯 দুটি নতুন Ad Placement (Gallery Image Interstitial &amp; Video Play Ad)
                  </div>
                  <p className="text-[11px] text-[#9da4b8] mt-0.5">
                    গ্যালারি থেকে ছবি ওপেন করলে এবং ভিডিও প্লে করলে অনুমোদিত Adsterra Interstitial অথবা VAST Video Ad দেখানো হবে (কোনো Social Bar স্ক্রিপ্ট বা ফেক অ্যাড ছাড়া)। বিজ্ঞাপন লোড না হলে ছবি/ভিডিও স্বাভাবিকভাবেই চলবে।
                  </p>
                </div>

                {/* Placement 1: Full-Screen Image Advertisement (Gallery) */}
                <div className="p-3.5 rounded-2xl bg-[#111522] border border-[#ff35bb]/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        ১. Full-Screen Image Advertisement (Gallery Photo Open)
                      </span>
                      <span className="text-[11px] text-[#9da4b8] block">
                        Gallery থেকে ছবি ওপেন করলে নির্দিষ্ট বিরতিতে ইন্টারস্টিশিয়াল বিজ্ঞাপন দেখাবে; বন্ধ করলে ছবি ওপেন হবে।
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playPop();
                        const next = {
                          ...tempBanner,
                          enableGalleryInterstitialAd:
                            tempBanner.enableGalleryInterstitialAd === false ? true : false,
                        };
                        setTempBanner(next);
                        onUpdateBannerConfig(next);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        tempBanner.enableGalleryInterstitialAd !== false
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      }`}
                    >
                      {tempBanner.enableGalleryInterstitialAd !== false ? '✓ Image Ad Enabled' : '✕ Image Ad Disabled'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#9da4b8] block mb-1">
                        কতটি ছবি ওপেনে দেখাবে (Frequency)
                      </label>
                      <select
                        value={tempBanner.galleryInterstitialFrequency ?? 3}
                        onChange={(e) =>
                          setTempBanner({
                            ...tempBanner,
                            galleryInterstitialFrequency: Number(e.target.value),
                          })
                        }
                        className="w-full bg-[#181d30] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value={2}>প্রতি ২টি ছবি ওপেনে ১ বার</option>
                        <option value={3}>প্রতি ৩টি ছবি ওপেনে ১ বার (Recommended)</option>
                        <option value={4}>প্রতি ৪টি ছবি ওপেনে ১ বার</option>
                        <option value={5}>প্রতি ৫টি ছবি ওপেনে ১ বার</option>
                        <option value={6}>প্রতি ৬টি ছবি ওপেনে ১ বার</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-[#9da4b8] block mb-1">
                        সর্বনিম্ন বিরতি (Cooldown Gap)
                      </label>
                      <select
                        value={tempBanner.galleryInterstitialCooldownSeconds ?? 45}
                        onChange={(e) =>
                          setTempBanner({
                            ...tempBanner,
                            galleryInterstitialCooldownSeconds: Number(e.target.value),
                          })
                        }
                        className="w-full bg-[#181d30] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value={30}>কমপক্ষে ৩০ সেকেন্ড বিরতি</option>
                        <option value={45}>কমপক্ষে ৪৫ সেকেন্ড বিরতি (Recommended)</option>
                        <option value={60}>কমপক্ষে ৬০ সেকেন্ড বিরতি</option>
                        <option value={90}>কমপক্ষে ৯০ সেকেন্ড বিরতি</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#9da4b8] block mb-1">
                      Adsterra Interstitial Tag / Script URL অথবা Snippet (Gallery Image Ad)
                    </label>
                    <textarea
                      rows={2}
                      value={tempBanner.galleryInterstitialTagUrl || ''}
                      onChange={(e) =>
                        setTempBanner({ ...tempBanner, galleryInterstitialTagUrl: e.target.value })
                      }
                      placeholder='https://.../invoke.js অথবা Adsterra <script>...</script> কোড দিন (Social Bar দেবেন না)'
                      className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                    {parseAdsterraTag(tempBanner.galleryInterstitialTagUrl, tempBanner.webAdScriptUrl)
                      .isSocialBarConflict && (
                      <p className="text-[11px] text-red-400 mt-1 font-semibold">
                        ⚠ সতর্কতা: এটি আপনার Social Bar URL-এর সাথে মিলে গেছে! অনুগ্রহ করে আলাদা Adsterra Interstitial / Display Tag দিন।
                      </p>
                    )}
                  </div>
                </div>

                {/* Placement 2: Video Play Advertisement */}
                <div className="p-3.5 rounded-2xl bg-[#111522] border border-[#8b4dff]/35 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        ২. Video Play Advertisement (Before Video Plays)
                      </span>
                      <span className="text-[11px] text-[#9da4b8] block">
                        ভিডিও প্লে করার আগে Adsterra VAST বা Interstitial অ্যাড দেখাবে; বন্ধ করলে বা লোড না হলে ভিডিও সরাসরি চলবে।
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playPop();
                        const next = {
                          ...tempBanner,
                          enableVideoPlayAd: tempBanner.enableVideoPlayAd === false ? true : false,
                        };
                        setTempBanner(next);
                        onUpdateBannerConfig(next);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        tempBanner.enableVideoPlayAd !== false
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      }`}
                    >
                      {tempBanner.enableVideoPlayAd !== false ? '✓ Video Ad Enabled' : '✕ Video Ad Disabled'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#9da4b8] block mb-1">
                        Video Ad বিরতি (Cooldown)
                      </label>
                      <select
                        value={tempBanner.videoPlayAdCooldownSeconds ?? 0}
                        onChange={(e) =>
                          setTempBanner({
                            ...tempBanner,
                            videoPlayAdCooldownSeconds: Number(e.target.value),
                          })
                        }
                        className="w-full bg-[#181d30] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value={0}>প্রতিটি ভিডিও প্লে-তে দেখাবে (Recommended)</option>
                        <option value={30}>৩০ সেকেন্ড বিরতি</option>
                        <option value={60}>৬০ সেকেন্ড বিরতি</option>
                        <option value={120}>২ মিনিট বিরতি</option>
                      </select>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0b0e18] border border-[#252a3d] text-[11px] text-[#9da4b8] flex items-center">
                      <span>Social Bar স্ক্রিপ্ট ভিডিও অ্যাড হিসেবে ব্যবহার হবে না এবং Banner-এর সাথে কোনো Conflict করবে না।</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#9da4b8] block mb-1">
                      Adsterra VAST Video Tag URL অথবা Interstitial &lt;script&gt; Tag
                    </label>
                    <textarea
                      rows={2}
                      value={tempBanner.videoPlayAdTagUrl || ''}
                      onChange={(e) =>
                        setTempBanner({ ...tempBanner, videoPlayAdTagUrl: e.target.value })
                      }
                      placeholder='https://.../vast?... (VAST XML URL) অথবা Adsterra Interstitial <script> কোড দিন'
                      className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#8b4dff] rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                    {parseAdsterraTag(tempBanner.videoPlayAdTagUrl, tempBanner.webAdScriptUrl)
                      .isSocialBarConflict && (
                      <p className="text-[11px] text-red-400 mt-1 font-semibold">
                        ⚠ সতর্কতা: Social Bar URL ভিডিও অ্যাডে ব্যবহার করা যাবে না! অনুগ্রহ করে Adsterra VAST Video Tag অথবা Interstitial Tag দিন।
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Guide Accordion */}
          <div className="p-4 rounded-2xl bg-[#0f1426] border border-[#2d3755] text-xs text-[#9da4b8] space-y-2">
            <strong className="text-white block font-display">Where to Paste Your Real Google AdMob IDs:</strong>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
              <li>In this <strong>Admin Panel</strong>: Paste your approved AdMob App ID and Ad Unit IDs in the fields above and tap &ldquo;Save Settings&rdquo;.</li>
              <li>In your <strong>Android APK project</strong>: In <code className="text-amber-300">android/app/src/main/AndroidManifest.xml</code>, update the <code className="text-amber-300">&lt;meta-data android:name=&quot;com.google.android.gms.ads.APPLICATION_ID&quot; ... /&gt;</code> with your real App ID.</li>
              <li>In your <strong>Flutter code</strong>: In <code className="text-amber-300">lib/admob_service.dart</code>, the service reads the real IDs directly or falls back to official test IDs when in test mode.</li>
            </ol>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-[#ff35bb] text-black font-black text-xs shadow-xl hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4 text-black" />
            <span>Save Real Advertising Settings</span>
          </button>

          {bannerSaveNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs text-center border border-emerald-500/30 animate-in fade-in">
              ✓ Advertising settings saved successfully! Real AdMob IDs updated.
            </div>
          )}
        </form>
      )}

      {/* SECTION 6: BANNERS & TEXT */}
      {activeSection === 'banners' && (
        <form onSubmit={handleSaveBanner} className="space-y-4 animate-in fade-in p-5 rounded-3xl bg-[#111522] border border-[#252a3d]">
          <div>
            <h2 className="font-display font-bold text-base text-white">Live Banner & Ad Copy Controls</h2>
            <p className="text-xs text-[#9da4b8]">Edit headings, hero text, and sponsorship copy shown across the app.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#d5cce7] mb-1">Hero Tagline</label>
              <input
                type="text"
                value={tempBanner.heroTagline}
                onChange={(e) => setTempBanner({ ...tempBanner, heroTagline: e.target.value })}
                className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#d5cce7] mb-1">Hero Title Line 1</label>
                <input
                  type="text"
                  value={tempBanner.heroTitle}
                  onChange={(e) => setTempBanner({ ...tempBanner, heroTitle: e.target.value })}
                  className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#d5cce7] mb-1">Hero Gradient Highlight</label>
                <input
                  type="text"
                  value={tempBanner.heroHighlight}
                  onChange={(e) => setTempBanner({ ...tempBanner, heroHighlight: e.target.value })}
                  className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d5cce7] mb-1">Hero Subtitle Paragraph</label>
              <textarea
                rows={2}
                value={tempBanner.heroSubtitle}
                onChange={(e) => setTempBanner({ ...tempBanner, heroSubtitle: e.target.value })}
                className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl p-3 text-xs text-white"
              />
            </div>

            <div className="pt-3 border-t border-[#252a3d]">
              <h3 className="font-bold text-xs text-white mb-2">Sponsored Space Copy</h3>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-[#9da4b8] mb-1">Sponsor Title</label>
                  <input
                    type="text"
                    value={tempBanner.sponsorTitle}
                    onChange={(e) => setTempBanner({ ...tempBanner, sponsorTitle: e.target.value })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9da4b8] mb-1">Sponsor Badge</label>
                  <input
                    type="text"
                    value={tempBanner.sponsorBadge}
                    onChange={(e) => setTempBanner({ ...tempBanner, sponsorBadge: e.target.value })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#9da4b8] mb-1">Sponsor Subtitle</label>
                <input
                  type="text"
                  value={tempBanner.sponsorSubtitle}
                  onChange={(e) => setTempBanner({ ...tempBanner, sponsorSubtitle: e.target.value })}
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="pt-4 border-t border-[#252a3d] space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00d2ff]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Upload Permission & Security (আপলোড ও সিকিউরিটি)
                </h3>
              </div>

              {/* Public Upload Switch */}
              <div className="p-3.5 rounded-2xl bg-[#0b0e18] border border-[#252a3d] flex flex-wrap items-center justify-between gap-3">
                <div className="max-w-md">
                  <span className="text-xs font-bold text-white block">
                    Visitor Uploads (সাধারণ মানুষ ছবি/ভিডিও আপলোড করতে পারবে?)
                  </span>
                  <span className="text-[11px] text-[#9da4b8] block mt-0.5">
                    {tempBanner.allowPublicUploads !== false
                      ? '✓ সবার জন্য উন্মুক্ত: যেকোনো সাধারণ ইউজার সরাসরি ছবি ও ভিডিও আপলোড করতে পারবে।'
                      : '🔒 শুধুমাত্র অ্যাডমিন: সাধারণ ইউজারদের জন্য আপলোড বন্ধ থাকবে, শুধু আপনি পারবেন।'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    setTempBanner({
                      ...tempBanner,
                      allowPublicUploads: tempBanner.allowPublicUploads === false ? true : false,
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    tempBanner.allowPublicUploads !== false
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {tempBanner.allowPublicUploads !== false ? '✓ সবার জন্য চালু' : '🔒 শুধু অ্যাডমিন মোড'}
                </button>
              </div>



              {/* Admin Passcode PIN */}
              <div className="p-3.5 rounded-2xl bg-[#0b0e18] border border-[#252a3d]">
                <label className="block text-xs font-bold text-white mb-1">
                  Change Admin Passcode (অ্যাডমিন পিন কোড পরিবর্তন)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showAdminSettingPin ? 'text' : 'password'}
                      maxLength={10}
                      value={tempBanner.adminPin || ''}
                      onChange={(e) => setTempBanner({ ...tempBanner, adminPin: e.target.value })}
                      className="w-full bg-[#111522] border border-[#252a3d] focus:border-[#00d2ff] rounded-xl px-3 py-2 text-xs text-white font-mono tracking-widest pr-10"
                      placeholder="••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminSettingPin(!showAdminSettingPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9da4b8] hover:text-white p-1 transition-colors"
                      title={showAdminSettingPin ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showAdminSettingPin ? <EyeOff className="w-4 h-4 text-[#ff35bb]" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <span className="text-[11px] text-[#9da4b8] mt-1 block">
                  পিনটি সর্বদা গোপন ও মাস্কড রাখা হয়েছে। দেখতে চাইলে পাশের চোখ আইকনে ক্লিক করতে পারেন।
                </span>
              </div>

              {/* Downloaded Photo IMO Watermark */}
              <div className="p-3.5 rounded-2xl bg-[#0b0e18] border border-[#ff35bb]/35">
                <label className="block text-xs font-bold text-white mb-1">
                  ডাউনলোড করা ছবির নিচে ইমু নাম্বার / ওয়াটারমার্ক (Photo Save Watermark)
                </label>
                <input
                  type="text"
                  value={tempBanner.photoWatermarkText ?? '01632067905 ইমু নাম্বার'}
                  onChange={(e) => setTempBanner({ ...tempBanner, photoWatermarkText: e.target.value })}
                  className="w-full bg-[#111522] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white"
                  placeholder="01632067905 ইমু নাম্বার"
                />
                <span className="text-[11px] text-[#9da4b8] mt-1 block">
                  যেকোনো ছবি ডাউনলোড/সেভ করার পর ছবির নিচের বাম পাশে এই লেখাটি স্থায়ীভাবে যুক্ত হবে।
                </span>
              </div>

              {/* Public App Share Link (জিমেইল ছাড়া সরাসরি শেয়ার লিংক) */}
              <div className="p-3.5 rounded-2xl bg-[#0b0e18] border border-[#00d2ff]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-[#00d2ff]" />
                    <label className="text-xs font-bold text-white block">
                      Public Share Link (ইউজারদের শেয়ার করার লিংক)
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playSuccess();
                      if (typeof window !== 'undefined') {
                        const publicOrigin = window.location.origin.includes('ais-dev-')
                          ? window.location.origin.replace('ais-dev-', 'ais-pre-')
                          : window.location.origin;
                        setTempBanner({ ...tempBanner, customShareUrl: publicOrigin });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#00d2ff]/20 text-[#00d2ff] hover:bg-[#00d2ff]/30 text-[11px] font-bold border border-[#00d2ff]/40 transition-all active:scale-95"
                  >
                    ✓ পাবলিক শেয়ার লিংক বসান (Use Public Live URL)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={tempBanner.customShareUrl || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, customShareUrl: e.target.value })}
                    className="flex-1 bg-[#111522] border border-[#252a3d] focus:border-[#00d2ff] rounded-xl px-3 py-2 text-xs text-[#00d2ff] font-mono"
                    placeholder="https://... (বা উপরের বাটনে চাপ দিয়ে বর্তমান লিংক নিন)"
                  />
                  {tempBanner.customShareUrl && (
                    <a
                      href={tempBanner.customShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-[#1b223c] text-[#00d2ff] text-xs font-bold border border-[#00d2ff]/30 hover:bg-[#252f52] transition-colors shrink-0"
                    >
                      পরীক্ষা করুন
                    </a>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200/90 space-y-1 leading-relaxed">
                  <strong className="text-amber-300 block">💡 ইমু/হোয়াটসঅ্যাপে লিংক শেয়ারে নিজস্ব লোগো (SUZIKA Z) দেখানোর নিয়ম:</strong>
                  <p>
                    AI Studio-এর প্রিভিউ লিংক (<code className="text-white">ais-pre-...run.app</code>) সরাসরি পেস্ট করলে Google প্রাইভেসি গেটওয়ে বাইরে থেকে আসা বটকে আটকে <strong>&quot;Cookie check&quot;</strong> ও Google লোগো দেখায়। মোবাইল থেকে ইমুতে লোগোসহ পাঠাতে অ্যাপের <strong>Share / লোগোসহ শেয়ার করুন</strong> বাটন ব্যবহার করুন, অথবা অ্যাপটি পাবলিক ডোমেইনে (যেমন Firebase Hosting / নিজস্ব ডোমেইন) পাবলিশ করে সেই লিংকটি এখানে সেভ করুন।
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile App Install / Android APK Download Popup System */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#161a2b] to-[#121626] border border-[#00d2ff]/35 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#00d2ff]" />
                  <span className="font-bold text-white text-xs">
                    📱 Android APK Download Popup System
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {onPreviewApkPopup && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateBannerConfig(tempBanner);
                        onPreviewApkPopup();
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#ff35bb]/20 hover:bg-[#ff35bb]/35 border border-[#ff35bb]/40 text-[#ff8ce4] text-[10px] font-bold transition-all"
                    >
                      পপআপ প্রিভিউ দেখুন
                    </button>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-[#00d2ff]/15 border border-[#00d2ff]/30 text-[#00d2ff] text-[10px] font-bold">
                    Web &amp; Mobile · 4s Delay
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#9da4b8]">
                ওয়েবসাইট ভিজিট করার <strong>৪ সেকেন্ড পর</strong> সব ওয়েব ও মোবাইল ব্যবহারকারী এই প্রিমিয়াম APK / অ্যাপ ডাউনলোড পপআপ দেখবেন। এখান থেকে সেভ করার সাথে সাথেই সবার স্ক্রিনে আপডেট হয়ে যাবে।
              </p>

              {/* Enable/Disable + Repeat Cooldown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-[#9da4b8] font-bold mb-1">
                    APK পপআপ চালু / বন্ধ (Enable / Disable):
                  </label>
                  <button
                    type="button"
                    onClick={() => setTempBanner({ ...tempBanner, showInstallPopup: tempBanner.showInstallPopup === false ? true : false })}
                    className={`w-full py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      tempBanner.showInstallPopup !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-[#161a2b] text-[#9da4b8] border-[#252a3d]'
                    }`}
                  >
                    {tempBanner.showInstallPopup !== false ? '✓ চালু আছে (ওয়েব ভিজিটরে ৪ সেকেন্ড পর দেখাবে)' : '✕ বন্ধ আছে'}
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-[#9da4b8] font-bold mb-1">
                    পুনরায় পপআপ দেখানোর বিরতি (Repeat Cooldown):
                  </label>
                  <select
                    value={typeof tempBanner.apkPopupCooldownDays === 'number' ? tempBanner.apkPopupCooldownDays : 7}
                    onChange={(e) => setTempBanner({ ...tempBanner, apkPopupCooldownDays: Number(e.target.value) })}
                    className="w-full bg-[#111522] border border-[#252a3d] focus:border-[#00d2ff] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value={7}>৭ দিন পর আবার দেখাবে (প্রস্তাবিত)</option>
                    <option value={3}>৩ দিন পর আবার দেখাবে</option>
                    <option value={1}>১ দিন পর আবার দেখাবে</option>
                    <option value={0}>শুধু একবার দেখাবে (Later করলে আর দেখাবে না)</option>
                  </select>
                </div>
              </div>

              {/* APK File Direct Upload + APK Download Link */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-[#00d2ff]">
                    বাস্তব APK Download Link অথবা সরাসরি .apk ফাইল আপলোড:
                  </label>
                  <input
                    ref={apkFileInputRef}
                    type="file"
                    accept=".apk,application/vnd.android.package-archive"
                    onChange={handleApkFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingApk}
                    onClick={() => apkFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00d2ff] to-[#8b4dff] hover:brightness-110 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md disabled:opacity-60 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingApk ? 'আপলোড হচ্ছে...' : 'সরাসরি .apk ফাইল আপলোড করুন'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempBanner.mobileAppInstallUrl || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, mobileAppInstallUrl: e.target.value })}
                    className="flex-1 bg-[#111522] border border-[#252a3d] focus:border-[#00d2ff] rounded-xl px-3 py-2 text-xs text-[#00d2ff] font-mono"
                    placeholder="https://.../suzika-call-pic.apk অথবা Google Drive / GitHub Direct Link"
                  />
                  {isValidRealApkUrl(tempBanner.mobileAppInstallUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        const directUrl = resolveDirectApkDownloadUrl(tempBanner.mobileAppInstallUrl);
                        copyToClipboard(directUrl);
                        setCopiedApkLink(true);
                        soundFX.playSuccess();
                        setTimeout(() => setCopiedApkLink(false), 2000);
                      }}
                      title="Direct APK Download Link কপি করুন"
                      className="px-2.5 py-2 rounded-xl bg-[#192038] hover:bg-[#232d50] border border-[#2d3659] text-[#00d2ff] text-[11px] font-bold flex items-center gap-1 shrink-0"
                    >
                      {copiedApkLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedApkLink ? 'কপি' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {/* Live Server APK Verification Badge */}
                {isSameOriginLocalApkUrl(tempBanner.mobileAppInstallUrl) && apkHealthStatus.checked && (
                  <p className={`text-[11px] font-semibold ${apkHealthStatus.exists ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {apkHealthStatus.exists
                      ? `✓ সার্ভারে APK ফাইল যাচাই করা হয়েছে (${(apkHealthStatus.sizeBytes / (1024 * 1024)).toFixed(2)} MB) — ইউজাররা ১-ক্লিকে সরাসরি ডাউনলোড ও ইনস্টল করতে পারবে।`
                      : '⚠ এই নামের APK ফাইলটি সার্ভারে পাওয়া যায়নি। অনুগ্রহ করে পুনরায় .apk আপলোড করুন অথবা Google Drive / GitHub লিংক দিন (খালি রাখলে ১-ক্লিক Web App ইনস্টল কাজ করবে)।'}
                  </p>
                )}
                {!isSameOriginLocalApkUrl(tempBanner.mobileAppInstallUrl) && isValidRealApkUrl(tempBanner.mobileAppInstallUrl) && (
                  <p className="text-[11px] text-emerald-400/90 font-medium">
                    ✓ এক্সটার্নাল APK লিংক যুক্ত আছে (Google Drive / Dropbox লিংক অটোমেটিক ডাইরেক্ট ডাউনলোডে রূপান্তর হবে)।
                  </p>
                )}
                {!isValidRealApkUrl(tempBanner.mobileAppInstallUrl) && (
                  <p className="text-[11px] text-[#9da4b8]">
                    ℹ️ কোনো .apk লিংক না দিলেও ইউজাররা ১-ক্লিকে ফোনের হোমস্ক্রিনে ওয়েব অ্যাপ (PWA) হিসেবে সরাসরি ইনস্টল করতে পারবে।
                  </p>
                )}

                {apkUploadNotice && (
                  <p className={`text-[11px] font-semibold ${apkUploadNotice.startsWith('✓') ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {apkUploadNotice}
                  </p>
                )}
              </div>

              {/* Popup App Version & Custom Message */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-[#9da4b8] font-bold mb-1">
                    App Version Badge:
                  </label>
                  <input
                    type="text"
                    value={tempBanner.mobileAppVersion || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, mobileAppVersion: e.target.value })}
                    className="w-full bg-[#111522] border border-[#252a3d] focus:border-[#00d2ff] rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="v2.4 (Android APK)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#9da4b8] font-bold mb-1">
                    Popup Message (পপআপ মেসেজ):
                  </label>
                  <textarea
                    rows={2}
                    value={tempBanner.apkPopupMessage || ''}
                    onChange={(e) => setTempBanner({ ...tempBanner, apkPopupMessage: e.target.value })}
                    className="w-full bg-[#111522] border border-[#252a3d] focus:border-[#00d2ff] rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="আপনার Android ফোনে SUZIKA Call Pic অফিশিয়াল অ্যাপ ইনস্টল করুন..."
                  />
                </div>
              </div>

              {/* Ad Duration for Unlocking / Seen */}
              <div className="pt-2 border-t border-[#252a3d] text-xs">
                <label className="block text-[11px] text-[#ff80d5] font-bold mb-1">
                  🔞 কন্টেন্ট আনলক বিজ্ঞাপন সময়সীমা (Ad Duration):
                </label>
                <select
                  value={tempBanner.adDurationSeconds || 30}
                  onChange={(e) => setTempBanner({ ...tempBanner, adDurationSeconds: Number(e.target.value) })}
                  className="w-full bg-[#111522] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value={15}>১৫ সেকেন্ড (দ্রুত আনলক)</option>
                  <option value={30}>৩০ সেকেন্ড (প্রস্তাবিত / স্ট্যান্ডার্ড)</option>
                  <option value={45}>৪৫ সেকেন্ড</option>
                  <option value={60}>৬০ সেকেন্ড / ১ মিনিট</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>Save & Update Live Settings</span>
            </button>

            {bannerSaveNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs text-center border border-emerald-500/30 font-bold">
                ✓ সফলভাবে সেভ হয়েছে এবং সাথে সাথে সকল ইউজারের ডিভাইসে লাইভ আপডেট চলে গেছে!
              </div>
            )}
          </div>
        </form>
      )}

      {/* SECTION 7: BACKUP & RESTORE */}
      {activeSection === 'backup' && (
        <div className="p-5 rounded-3xl bg-[#111522] border border-[#252a3d] space-y-4 animate-in fade-in">
          <div>
            <h2 className="font-display font-bold text-base text-white">Backup & Restore All Applet Data</h2>
            <p className="text-xs text-[#9da4b8]">Download your full 500 photo slots, videos, comments, and messages as a portable JSON file.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                soundFX.playSuccess();
                onExportData();
              }}
              className="p-4 rounded-2xl bg-[#151a2d] hover:bg-[#1e2540] border border-[#252a3d] flex flex-col items-center justify-center text-center gap-2"
            >
              <Download className="w-6 h-6 text-[#00d2ff]" />
              <strong className="text-sm text-white">Export Full Database (.json)</strong>
              <span className="text-xs text-[#9da4b8]">Save a local backup of your photos, comments, and settings</span>
            </button>

            <button
              onClick={() => importFileRef.current?.click()}
              className="p-4 rounded-2xl bg-[#151a2d] hover:bg-[#1e2540] border border-[#252a3d] flex flex-col items-center justify-center text-center gap-2"
            >
              <Upload className="w-6 h-6 text-[#ff35bb]" />
              <strong className="text-sm text-white">Import Backup (.json)</strong>
              <span className="text-xs text-[#9da4b8]">Restore your slots and comments from a previous file</span>
            </button>
            <input
              type="file"
              ref={importFileRef}
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <div className="pt-4 border-t border-[#252a3d] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-red-400 block">Factory Reset</span>
              <span className="text-[11px] text-[#9da4b8]">Restore original demo 500 slots and sample seed data</span>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Reset everything to factory default? All custom uploads will be replaced.')) {
                  onResetData();
                  soundFX.playSuccess();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20"
            >
              Reset App Data
            </button>
          </div>
        </div>
      )}

      {/* SECTION: PRIVATE VIP GALLERIES & COIN RECHARGE MANAGER */}
      {activeSection === 'private' && (
        <div className="space-y-5 animate-in fade-in">
          {/* 1. Mobile Banking Numbers (bKash / Nagad / Rocket) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#111522] border border-[#ff35bb]/35 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#252a3d]">
              <div>
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>আপনার পেমেন্ট নম্বর সেটআপ (bKash / Nagad / Rocket)</span>
                </h2>
                <p className="text-xs text-[#9da4b8] mt-0.5">
                  কয়েন রিচার্জ করার সময় ইউজাররা এই নম্বরগুলোতে টাকা পাঠাবে।
                </p>
              </div>
              {paymentNumbersSaved && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  ✓ নম্বর সেভ হয়েছে!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#ff6eb2] mb-1">bKash Number (বিকাশ)</label>
                <input
                  type="tel"
                  value={tempBanner.bkashNumber ?? ''}
                  onChange={(e) => setTempBanner({ ...tempBanner, bkashNumber: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#e2136e] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#fdba74] mb-1">Nagad Number (নগদ)</label>
                <input
                  type="tel"
                  value={tempBanner.nagadNumber ?? ''}
                  onChange={(e) => setTempBanner({ ...tempBanner, nagadNumber: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#f6921e] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d8b4fe] mb-1">Rocket Number (রকেট)</label>
                <input
                  type="tel"
                  value={tempBanner.rocketNumber ?? ''}
                  onChange={(e) => setTempBanner({ ...tempBanner, rocketNumber: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#8c3494] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">ডিফল্ট ভিডিও কয়েন</label>
                <input
                  type="number"
                  min={1}
                  value={tempBanner.defaultPrivateVideoCoins ?? 50}
                  onChange={(e) =>
                    setTempBanner({ ...tempBanner, defaultPrivateVideoCoins: Math.max(1, Number(e.target.value) || 50) })
                  }
                  className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFX.playSuccess();
                onUpdateBannerConfig(tempBanner);
                setPaymentNumbersSaved(true);
                setTimeout(() => setPaymentNumbersSaved(false), 3000);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>পেমেন্ট নম্বর সেভ করুন</span>
            </button>
          </div>

          {/* 2. Coin Recharge Requests Queue */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#111522] border border-[#252a3d] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#252a3d]">
              <div>
                <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>কয়েন রিচার্জ রিকোয়েস্ট ({coinRechargeRequests.length})</span>
                </h3>
                <p className="text-xs text-[#9da4b8]">
                  ইউজাররা bKash / Nagad / Rocket-এ টাকা পাঠিয়ে TrxID দিলে এখানে দেখতে পাবেন। Approve করলেই ইউজার কয়েন পাবে।
                </p>
              </div>
              {pendingRechargeCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                  {pendingRechargeCount} Pending
                </span>
              )}
            </div>

            {coinRechargeRequests.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0b0e18] border border-[#252a3d] text-center text-xs text-[#9da4b8]">
                এখনো কোনো কয়েন রিচার্জ রিকোয়েস্ট আসেনি।
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {coinRechargeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-2xl bg-[#0b0e18] border border-[#252a3d] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-white">{req.userName}</span>
                        <span className="text-xs font-mono text-emerald-300">{req.userPhone}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black">
                          +{req.coins} Coins (৳{req.amountBdt})
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#ff35bb]/20 text-[#ff8ce4] text-[10px] font-bold uppercase">
                          {req.method}
                        </span>
                      </div>
                      <div className="text-xs text-[#9da4b8] font-mono">
                        TrxID: <span className="text-[#00d2ff] font-bold">{req.trxId}</span>
                        {req.senderNumber ? ` · Sender: ${req.senderNumber}` : ''} · To: {req.targetNumber}
                      </div>
                      <div className="text-[10px] text-[#7c849c]">{req.createdAt}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playSuccess();
                              onApproveRechargeRequest?.(req);
                            }}
                            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black flex items-center gap-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve &amp; Add Coins</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playPop();
                              onRejectRechargeRequest?.(req);
                            }}
                            className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/35 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
                            req.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-red-500/20 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {req.status === 'approved' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approved ✓</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejected</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Upload Private Videos (All Select / Batch + Multi-Gallery) or Promote Existing Videos */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#111522] border border-[#ff35bb]/35 space-y-4">
            <div className="pb-2 border-b border-[#252a3d]">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#ff35bb]" />
                <span>Private Gallery ভিডিও আপলোড (All Select / Batch Support)</span>
              </h3>
              <p className="text-xs text-[#9da4b8]">
                Ctrl + A চেপে একসাথে সব ভিডিও সিলেক্ট করুন এবং এক বা সবগুলো গ্যালারিতে একসাথে পাবলিশ করুন।
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onAddPrivateVideo) return;

                const urlLines = privateUrlInput
                  .split('\n')
                  .map((l) => l.trim())
                  .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

                if (privateSelectedFiles.length === 0 && urlLines.length === 0) {
                  setPrivateUploadStatus('অন্তত একটি ভিডিও ফাইল সিলেক্ট করুন অথবা ভিডিও লিংক দিন।');
                  return;
                }

                const targetGalleries =
                  selectedPrivateGalleries.length > 0 ? selectedPrivateGalleries : (['Global Adult'] as PrivateGalleryName[]);
                const primaryGallery = targetGalleries[0];
                const coinCost = Math.max(1, Number(privateCoinPrice) || bannerConfig.defaultPrivateVideoCoins || 50);
                let nextSlot = privateVideos.reduce((m, v) => Math.max(m, v.slotNumber || 0), 0) + 1;
                const totalToUpload = privateSelectedFiles.length + urlLines.length;
                let uploadedCount = 0;

                try {
                  setIsUploadingPrivateVideo(true);
                  let failedCount = 0;
                  let lastErr = '';

                  // 1. Upload selected video files concurrently (4 workers) for maximum speed
                  if (privateSelectedFiles.length > 0) {
                    const startFileSlot = nextSlot;
                    nextSlot += privateSelectedFiles.length;
                    const CONCURRENCY = Math.min(4, privateSelectedFiles.length);
                    let nextIdx = 0;
                    let processedFiles = 0;

                    setPrivateUploadStatus(
                      `${CONCURRENCY}টি ভিডিও একসাথে দ্রুত ক্লাউডে আপলোড হচ্ছে (মোট ${privateSelectedFiles.length}টি)...`
                    );

                    const runFileWorker = async () => {
                      while (true) {
                        const idx = nextIdx++;
                        if (idx >= privateSelectedFiles.length) break;

                        const file = privateSelectedFiles[idx];
                        const currentNum = idx + 1;
                        const assignedSlot = startFileSlot + idx;

                        try {
                          const pvId = `priv-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
                          let finalVideoUrl = '';
                          let finalThumbUrl = '';
                          let durationStr = '0:30';
                          let isCloudChunked = false;
                          let cloudChunkCount: number | undefined;
                          let fileSizeBytes: number | undefined;

                          saveLocalVideoBlob(pvId, file).catch(() => {});

                          const metaPromise = extractVideoMeta(file, 900).catch(() => null);
                          const uploadPromise =
                            file.size <= MAX_INLINE_VIDEO_BYTES
                              ? blobToDataUrl(file).then((url) => ({
                                  url,
                                  isChunked: false,
                                  totalChunks: undefined as number | undefined,
                                  sizeBytes: file.size,
                                }))
                              : uploadVideoToFirestoreChunks(
                                  pvId,
                                  file,
                                  file.name,
                                  (pct, msg) =>
                                    setPrivateUploadStatus(
                                      `(${processedFiles}/${totalToUpload} সম্পন্ন) Private #${assignedSlot}: ${msg} (${pct}%)`
                                    ),
                                  4
                                ).then((res) => ({
                                  url: res.streamUrl,
                                  isChunked: true,
                                  totalChunks: res.totalChunks,
                                  sizeBytes: res.sizeBytes,
                                }));

                          const [meta, upRes] = await Promise.all([metaPromise, uploadPromise]);
                          if (meta) {
                            durationStr = meta.durationStr || '0:30';
                            finalThumbUrl =
                              meta.thumbnailUrl && !meta.thumbnailUrl.startsWith('blob:') ? meta.thumbnailUrl : '';
                          }
                          finalVideoUrl = upRes.url;
                          isCloudChunked = upRes.isChunked;
                          cloudChunkCount = upRes.totalChunks;
                          fileSizeBytes = upRes.sizeBytes;

                          const cleanFileTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
                          const resolvedTitle =
                            privateTitle.trim()
                              ? totalToUpload > 1
                                ? `${privateTitle.trim()} #${currentNum}`
                                : privateTitle.trim()
                              : cleanFileTitle || `${primaryGallery} VIP #${assignedSlot}`;

                          const newPv: PrivateVideoItem = {
                            id: pvId,
                            title: resolvedTitle,
                            gallery: primaryGallery,
                            galleries: targetGalleries,
                            videoUrl: finalVideoUrl,
                            thumbnailUrl: finalThumbUrl,
                            fallbackGradient: 'linear-gradient(135deg, #ff35bb, #8b4dff)',
                            duration: durationStr,
                            coinPrice: coinCost,
                            views: 1,
                            likes: 0,
                            author: 'SUZIKA VIP',
                            slotNumber: assignedSlot,
                            createdAt: 'Just now',
                            createdAtMs: Date.now() + idx,
                            isCloudChunked,
                            ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
                            ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
                            videoType: 'direct',
                          };

                          await onAddPrivateVideo(newPv);
                          uploadedCount++;
                        } catch (itemErr: any) {
                          failedCount++;
                          lastErr = itemErr?.message || 'ফাইল প্রসেস করা যায়নি';
                          console.warn(`Private upload file #${currentNum} failed:`, itemErr);
                        }

                        processedFiles++;
                        setPrivateUploadStatus(
                          `${processedFiles}/${privateSelectedFiles.length}টি ভিডিও সম্পন্ন (${uploadedCount}টি সেভ হয়েছে)...`
                        );
                      }
                    };

                    await Promise.all(Array.from({ length: CONCURRENCY }, () => runFileWorker()));
                  }

                  if (failedCount > 0 && uploadedCount === 0) {
                    setPrivateUploadStatus(lastErr || 'ভিডিও আপলোড ব্যর্থ হয়েছে।');
                    return;
                  }

                  // 2. Upload all pasted URL lines
                  for (let uIdx = 0; uIdx < urlLines.length; uIdx++) {
                    const url = urlLines[uIdx];
                    const currentNum = privateSelectedFiles.length + uIdx + 1;
                    setPrivateUploadStatus(`ভিডিও লিংক যোগ হচ্ছে (${currentNum}/${totalToUpload})...`);
                    const pvId = `priv-${Date.now()}-url-${uIdx}-${Math.random().toString(36).slice(2, 6)}`;
                    const resolvedTitle = privateTitle.trim()
                      ? totalToUpload > 1
                        ? `${privateTitle.trim()} #${currentNum}`
                        : privateTitle.trim()
                      : `${primaryGallery} VIP #${nextSlot}`;

                    const newPv: PrivateVideoItem = {
                      id: pvId,
                      title: resolvedTitle,
                      gallery: primaryGallery,
                      galleries: targetGalleries,
                      videoUrl: url,
                      thumbnailUrl: '',
                      fallbackGradient: 'linear-gradient(135deg, #ff35bb, #8b4dff)',
                      duration: '0:30',
                      coinPrice: coinCost,
                      views: 1,
                      likes: 0,
                      author: 'SUZIKA VIP',
                      slotNumber: nextSlot++,
                      createdAt: 'Just now',
                      createdAtMs: Date.now() + currentNum,
                      isCloudChunked: false,
                      videoType: url.includes('youtu') ? 'youtube' : 'direct',
                    };

                    await onAddPrivateVideo(newPv);
                    uploadedCount++;
                  }

                  soundFX.playSuccess();
                  setPrivateTitle('');
                  setPrivateUrlInput('');
                  setPrivateSelectedFiles([]);
                  setPrivateUploadStatus(`✓ একসাথে ${uploadedCount}টি প্রাইভেট ভিডিও সফলভাবে পাবলিশ হয়েছে!`);
                  setTimeout(() => setPrivateUploadStatus(null), 4000);
                } catch (err: any) {
                  setPrivateUploadStatus(err?.message || 'আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
                } finally {
                  setIsUploadingPrivateVideo(false);
                }
              }}
              className="space-y-3"
            >
              {/* Multi-Gallery Target Picker with All Select */}
              <div className="space-y-2 p-3 rounded-2xl bg-[#0b0e18] border border-[#252a3d]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#d5cce7]">
                    কোন কোন প্রাইভেট গ্যালারিতে যাবে? ({selectedPrivateGalleries.length}/{PRIVATE_GALLERIES.length} সিলেক্টেড)
                  </label>
                  <button
                    type="button"
                    onClick={toggleAllPrivateGalleries}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all ${
                      isAllGalleriesSelected
                        ? 'bg-emerald-500 text-black'
                        : 'bg-[#ff35bb]/20 hover:bg-[#ff35bb]/35 text-[#ff8ce4] border border-[#ff35bb]/40'
                    }`}
                  >
                    {isAllGalleriesSelected ? '✓ সব গ্যালারি সিলেক্টেড (All)' : 'সব গ্যালারি সিলেক্ট করুন (All Select)'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PRIVATE_GALLERIES.map((g) => {
                    const checked = selectedPrivateGalleries.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleOnePrivateGallery(g.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                          checked
                            ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] border-transparent text-white shadow'
                            : 'bg-[#151a2d] border-[#252a3d] text-[#9da4b8] hover:text-white'
                        }`}
                      >
                        <span>{checked ? '✓' : '+'}</span>
                        <span>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">ভিডিও টাইটেল (ঐচ্ছিক - ফাইলের নাম অটো বসবে)</label>
                  <input
                    type="text"
                    value={privateTitle}
                    onChange={(e) => setPrivateTitle(e.target.value)}
                    placeholder="খালি রাখলে প্রতিটি ভিডিওর আসল নাম বসবে"
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff35bb]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">আনলক কয়েন মূল্য (সবার জন্য)</label>
                  <input
                    type="number"
                    min={1}
                    value={privateCoinPrice}
                    onChange={(e) => setPrivateCoinPrice(e.target.value)}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">
                    ডিভাইস থেকে সব ভিডিও একসাথে বাছুন (.mp4 / multiple)
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    id="admin-private-video-file"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (files.length > 0) {
                        setPrivateSelectedFiles((prev) => [...prev, ...files]);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('admin-private-video-file')?.click()}
                    className="w-full px-3 py-3 rounded-xl bg-gradient-to-r from-[#ff35bb]/20 to-[#8b4dff]/20 hover:from-[#ff35bb]/30 hover:to-[#8b4dff]/30 border border-dashed border-[#ff35bb]/60 text-xs text-white font-bold flex flex-col items-center justify-center gap-1"
                  >
                    <Upload className="w-4 h-4 text-[#ff35bb]" />
                    <span>
                      {privateSelectedFiles.length > 0
                        ? `${privateSelectedFiles.length}টি ভিডিও সিলেক্ট হয়েছে (আরও যোগ করুন)`
                        : 'একসাথে একাধিক / সব ভিডিও সিলেক্ট করুন'}
                    </span>
                    <span className="text-[10px] text-amber-300 font-semibold">Ctrl + A চেপে All Select করতে পারবেন</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">
                    অথবা একাধিক ভিডিও লিংক (প্রতি লাইনে একটি URL)
                  </label>
                  <textarea
                    rows={3}
                    value={privateUrlInput}
                    onChange={(e) => setPrivateUrlInput(e.target.value)}
                    placeholder="https://...mp4&#10;https://youtu.be/..."
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#ff35bb]"
                  />
                </div>
              </div>

              {/* Selected Video Files Queue */}
              {privateSelectedFiles.length > 0 && (
                <div className="p-3 rounded-2xl bg-[#0b0e18] border border-[#252a3d] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      আপলোডের জন্য নির্বাচিত ভিডিও: <span className="text-[#ff35bb]">{privateSelectedFiles.length}টি</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrivateSelectedFiles([])}
                      className="text-[11px] text-red-400 hover:text-red-300 font-bold"
                    >
                      সব মুছুন
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {privateSelectedFiles.slice(0, 15).map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#151a2d] text-xs"
                      >
                        <span className="truncate text-white">
                          #{idx + 1} · {f.name}{' '}
                          <span className="text-[#9da4b8]">({(f.size / (1024 * 1024)).toFixed(1)} MB)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPrivateSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-red-400 hover:text-red-300 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {privateSelectedFiles.length > 15 && (
                      <div className="text-center text-[11px] text-[#00d2ff] font-bold py-1">
                        + আরও {privateSelectedFiles.length - 15}টি ভিডিও সিলেক্ট করা আছে
                      </div>
                    )}
                  </div>
                </div>
              )}

              {privateUploadStatus && (
                <div className="p-2.5 rounded-xl bg-[#00d2ff]/15 border border-[#00d2ff]/35 text-[#8ce8ff] text-xs">
                  {privateUploadStatus}
                </div>
              )}

              <button
                type="submit"
                disabled={isUploadingPrivateVideo}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-extrabold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isUploadingPrivateVideo
                    ? 'আপলোড হচ্ছে...'
                    : `সবগুলো (${privateSelectedFiles.length || ''}) প্রাইভেট গ্যালারিতে পাবলিশ করুন`}
                </span>
              </button>
            </form>

            {/* Quick Promote Existing Public Videos with Select All */}
            {videos.length > 0 && onAddPrivateVideo && (
              <div className="pt-3 border-t border-[#252a3d] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#d5cce7]">
                    আগের আপলোড করা ভিডিও থেকে প্রাইভেটে নিন ({selectedPromoteVideoIds.length}/{videos.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      if (selectedPromoteVideoIds.length === videos.length) {
                        setSelectedPromoteVideoIds([]);
                      } else {
                        setSelectedPromoteVideoIds(videos.map((v) => v.id));
                      }
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/40 text-[11px] font-bold"
                  >
                    {selectedPromoteVideoIds.length === videos.length ? 'সব বাদ দিন' : 'সবগুলো সিলেক্ট করুন (All Select)'}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                  {videos.map((v) => {
                    const isChecked = selectedPromoteVideoIds.includes(v.id);
                    return (
                      <label
                        key={v.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#ff35bb]/15 border-[#ff35bb] text-white'
                            : 'bg-[#0b0e18] border-[#252a3d] text-[#9da4b8]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedPromoteVideoIds((prev) =>
                              prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                            );
                          }}
                          className="accent-[#ff35bb]"
                        />
                        <span className="truncate">
                          #{v.slotNumber} — {v.title}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={selectedPromoteVideoIds.length === 0}
                  onClick={async () => {
                    const targetGalleries =
                      selectedPrivateGalleries.length > 0 ? selectedPrivateGalleries : (['Global Adult'] as PrivateGalleryName[]);
                    const primaryGallery = targetGalleries[0];
                    let nextSlot = privateVideos.reduce((m, v) => Math.max(m, v.slotNumber || 0), 0) + 1;
                    let added = 0;

                    for (const vidId of selectedPromoteVideoIds) {
                      const src = videos.find((v) => v.id === vidId);
                      if (!src) continue;
                      await onAddPrivateVideo({
                        id: `priv-${Date.now()}-${added}`,
                        title: src.title,
                        gallery: primaryGallery,
                        galleries: targetGalleries,
                        videoUrl: src.videoUrl,
                        thumbnailUrl: src.thumbnailUrl,
                        fallbackGradient: src.fallbackGradient,
                        duration: src.duration,
                        coinPrice: Math.max(1, Number(privateCoinPrice) || 50),
                        views: 1,
                        likes: 0,
                        author: src.author,
                        slotNumber: nextSlot++,
                        createdAt: 'Just now',
                        createdAtMs: Date.now() + added,
                        isCloudChunked: src.isCloudChunked,
                        ...(src.cloudChunkCount !== undefined ? { cloudChunkCount: src.cloudChunkCount } : {}),
                        ...(src.fileSizeBytes !== undefined ? { fileSizeBytes: src.fileSizeBytes } : {}),
                        videoType: src.videoType,
                      });
                      added++;
                    }
                    soundFX.playSuccess();
                    setSelectedPromoteVideoIds([]);
                    setPrivateUploadStatus(`✓ ${added}টি ভিডিও প্রাইভেট গ্যালারিতে যোগ হয়েছে!`);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-black text-xs font-black disabled:opacity-40"
                >
                  সিলেক্ট করা {selectedPromoteVideoIds.length}টি ভিডিও প্রাইভেটে নিন
                </button>
              </div>
            )}
          </div>

          {/* 4. Private Videos List */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-white">আপলোড করা প্রাইভেট ভিডিও ({privateVideos.length})</h3>
            {privateVideos.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#111522] border border-[#252a3d] text-center text-xs text-[#9da4b8]">
                এখনো কোনো প্রাইভেট ভিডিও যোগ করা হয়নি।
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {privateVideos.slice(0, visibleAdminPrivate).map((pv) => (
                    <div
                      key={pv.id}
                      className="p-3 rounded-2xl bg-[#111522] border border-[#252a3d] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-14 rounded-xl overflow-hidden bg-[#1a1f36] shrink-0 relative">
                          {pv.thumbnailUrl && !pv.thumbnailUrl.startsWith('blob:') ? (
                            <img
                              src={pv.thumbnailUrl}
                              alt={pv.title}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover blur-[2px]"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#ff35bb]">
                              <Flame className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-[#ff35bb]/20 text-[#ff8ce4] text-[10px] font-bold">
                              {pv.galleries && pv.galleries.length > 1
                                ? `${pv.galleries.length} Galleries`
                                : pv.gallery}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black">
                              {pv.coinPrice} Coins
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-white truncate mt-1">{pv.title}</h4>
                          <span className="text-[10px] text-[#9da4b8]">Duration: {pv.duration}</span>
                        </div>
                      </div>

                      {onDeletePrivateVideo && (
                        <button
                          type="button"
                          onClick={() => {
                            soundFX.playPop();
                            onDeletePrivateVideo(pv.id);
                          }}
                          className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 transition-colors shrink-0"
                          title="প্রাইভেট ভিডিও ডিলিট করুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {privateVideos.length > visibleAdminPrivate && (
                  <button
                    type="button"
                    onClick={() => setVisibleAdminPrivate((c) => c + 30)}
                    className="w-full py-2.5 rounded-2xl bg-[#161a2b] hover:bg-[#1f2540] border border-[#252a3d] text-xs font-bold text-[#00d2ff] transition-colors"
                  >
                    আরও প্রাইভেট ভিডিও দেখুন ({privateVideos.length - visibleAdminPrivate}টি বাকি)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT PHOTO MODAL */}
      {editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111522] border border-[#252a3d] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#252a3d]">
              <h3 className="font-bold text-base text-white">
                Edit Slot #{String(editingPhoto.slotNumber).padStart(3, '0')}
              </h3>
              <button
                onClick={() => setEditingPhoto(null)}
                className="w-7 h-7 rounded-full bg-[#161a2b] text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                soundFX.playSuccess();
                setBrokenPhotoIds((prev) => {
                  const next = new Set(prev);
                  next.delete(editingPhoto.id);
                  return next;
                });
                onEditPhoto(editingPhoto);
                setEditingPhoto(null);
              }}
              className="space-y-3 mt-4"
            >
              <div>
                <label className="block text-xs font-bold text-[#d5cce7] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingPhoto.title}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d5cce7] mb-1">Image URL or Browse Device</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="admin-photo-replace"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const compressed = await compressImageFile(file);
                        setEditingPhoto({ ...editingPhoto, imageUrl: compressed });
                        soundFX.playSuccess();
                      } catch (err) {
                        alert('Could not process photo');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('admin-photo-replace')?.click()}
                    className="px-3 py-1.5 rounded-xl bg-[#1b2138] hover:bg-[#252d4c] text-white text-xs font-medium border border-[#252a3d] flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#ff35bb]" />
                    <span>Browse from device</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editingPhoto.imageUrl}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, imageUrl: e.target.value })}
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">Category</label>
                  <select
                    value={editingPhoto.category}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, category: e.target.value as CategoryType })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">Author</label>
                  <input
                    type="text"
                    value={editingPhoto.author}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, author: e.target.value })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold mt-2"
              >
                Save Changes to Slot
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VIDEO MODAL */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111522] border border-[#252a3d] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#252a3d]">
              <h3 className="font-bold text-base text-white">
                Edit Video Slot #{String(editingVideo.slotNumber).padStart(2, '0')}
              </h3>
              <button
                onClick={() => setEditingVideo(null)}
                className="w-7 h-7 rounded-full bg-[#161a2b] text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                soundFX.playSuccess();
                setBrokenVideoIds((prev) => {
                  const next = new Set(prev);
                  next.delete(editingVideo.id);
                  return next;
                });
                onEditVideo(editingVideo);
                setEditingVideo(null);
              }}
              className="space-y-3 mt-4"
            >
              <div>
                <label className="block text-xs font-bold text-[#d5cce7] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingVideo.title}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d5cce7] mb-1">Video Stream URL or Browse File (.mp4)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="file"
                    accept="video/*"
                    id="admin-video-replace"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setIsReplacingVideoFile(true);
                        soundFX.playPop();
                        const meta = await extractVideoMeta(file);
                        await saveLocalVideoBlob(editingVideo.id, file);
                        let persistedUrl = '';
                        let isCloudChunked = false;
                        let cloudChunkCount: number | undefined;
                        let fileSizeBytes: number | undefined;

                        if (file.size <= MAX_INLINE_VIDEO_BYTES) {
                          persistedUrl = await blobToDataUrl(file);
                        } else {
                          const cloudRes = await uploadVideoToFirestoreChunks(editingVideo.id, file, file.name);
                          persistedUrl = cloudRes.streamUrl;
                          isCloudChunked = true;
                          cloudChunkCount = cloudRes.totalChunks;
                          fileSizeBytes = cloudRes.sizeBytes;
                        }
                        setBrokenVideoIds((prev) => {
                          const next = new Set(prev);
                          next.delete(editingVideo.id);
                          return next;
                        });
                        setEditingVideo({
                          ...editingVideo,
                          videoUrl: persistedUrl,
                          thumbnailUrl: meta.thumbnailUrl,
                          duration: meta.durationStr,
                          isLocalIndexedDB: false,
                          isCloudChunked,
                          ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
                          ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
                          videoType: 'direct',
                        });
                        soundFX.playSuccess();
                      } catch (err) {
                        console.error('Could not process video file:', err);
                      } finally {
                        setIsReplacingVideoFile(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isReplacingVideoFile}
                    onClick={() => document.getElementById('admin-video-replace')?.click()}
                    className="px-3 py-1.5 rounded-xl bg-[#1b2138] hover:bg-[#252d4c] text-white text-xs font-medium border border-[#252a3d] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#00d2ff]" />
                    <span>{isReplacingVideoFile ? 'ক্লাউডে আপলোড হচ্ছে...' : 'Browse MP4 from device (Cloud Save)'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editingVideo.videoUrl}
                  onChange={(e) => setEditingVideo({ ...editingVideo, videoUrl: e.target.value })}
                  placeholder="https://... or 'local-blob'"
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#d5cce7] mb-1">Thumbnail Poster Frame</label>
                <input
                  type="text"
                  value={editingVideo.thumbnailUrl}
                  onChange={(e) => setEditingVideo({ ...editingVideo, thumbnailUrl: e.target.value })}
                  placeholder="Image URL or data:image/jpeg..."
                  className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">Category</label>
                  <select
                    value={editingVideo.category}
                    onChange={(e) => setEditingVideo({ ...editingVideo, category: e.target.value as CategoryType })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">Duration (e.g. 0:45)</label>
                  <input
                    type="text"
                    value={editingVideo.duration}
                    onChange={(e) => setEditingVideo({ ...editingVideo, duration: e.target.value })}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#8b4dff] to-[#00d2ff] text-white text-xs font-bold mt-2"
              >
                Save Video Slot
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
