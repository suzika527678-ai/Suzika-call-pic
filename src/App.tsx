/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TabType,
  CategoryType,
  PhotoItem,
  VideoItem,
  CommunityComment,
  UserProfile,
  AdminMessage,
  AppBannerConfig,
  UserAccount,
  PrivateGalleryName,
  PrivateVideoItem,
  CoinPackage,
  CoinRechargeRequest,
} from './types';
import { INITIAL_PHOTOS, INITIAL_VIDEOS, INITIAL_COMMENTS, INITIAL_PROFILE, INITIAL_MESSAGES, DEFAULT_BANNER_CONFIG, REAL_ADMOB_CONFIG } from './data/initialData';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from './firebase';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { PhotoLightbox } from './components/PhotoLightbox';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { UploadModal } from './components/UploadModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { HomeView } from './views/HomeView';
import { GalleryView } from './views/GalleryView';
import { VideoView } from './views/VideoView';
import { PrivateGalleryView } from './views/PrivateGalleryView';
import { CommentsView } from './views/CommentsView';
import { ProfileView } from './views/ProfileView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { LoginModal } from './components/LoginModal';
import { RewardedAdModal } from './components/RewardedAdModal';
import { MobileInstallModal } from './components/MobileInstallModal';
import { TimedFullscreenAdModal } from './components/TimedFullscreenAdModal';
import { AdsterraInterstitialModal } from './components/AdsterraInterstitialModal';
import { DownloadFullscreenAdModal } from './components/DownloadFullscreenAdModal';
import { PrivateVideoModal } from './components/PrivateVideoModal';
import { CoinRechargeModal } from './components/CoinRechargeModal';
import { AdminPinModal } from './components/AdminPinModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { usePWAInstall } from './hooks/usePWAInstall';
import { shouldShowAndroidApkPopup, dismissAndroidApkPopup } from './utils/deviceDetection';
import { soundFX } from './utils/audio';
import { LogOut, Crown } from 'lucide-react';
import { AdBanner } from './components/AdBanner';
import { deleteLocalVideoBlob, saveLocalVideoBlob } from './utils/videoStorage';
import { formatLikes } from './utils/formatters';
import {
  savePersistentPhoto,
  getAllPersistentPhotos,
  deletePersistentPhoto,
  savePersistentVideo,
  getAllPersistentVideos,
  deletePersistentVideo,
  saveMultiplePersistentPhotos,
  saveMultiplePersistentVideos,
  isAuthenticUserPhoto,
  isAuthenticUserVideo,
  purgeAllLegacyMediaCaches,
} from './utils/persistentMediaStore';
import { cleanFirestoreDoc } from './utils/cleanFirestoreDoc';
import { sortMediaNewestFirst, deleteVideoChunksFromFirestore } from './utils/cloudMediaStore';
import { isVideoLocked } from './utils/unlockStore';
import { isLikelyVastUrl, parseAdsterraTag } from './utils/adsterraTagParser';
import {
  syncAdMobConfig,
  trackMediaViewAndMaybeShowInterstitial,
  triggerTimedNativeInterstitial,
  showImmediateNativeInterstitial,
  showAppOpenAdIfEnabled,
  isNativeAndroidAdMobAvailable,
} from './utils/admobBridge';

// Lightweight localStorage cache helper: strips huge base64 data URLs (>24KB) so UI never freezes
function safeCacheMediaLight<T extends Record<string, any>>(key: string, items: T[], maxItems = 40): void {
  try {
    const slim = items.slice(0, maxItems).map((item) => {
      const copy: Record<string, any> = { ...item };
      if (typeof copy.imageUrl === 'string' && copy.imageUrl.startsWith('data:') && copy.imageUrl.length > 24_000) {
        copy.imageUrl = '';
      }
      if (typeof copy.videoUrl === 'string' && copy.videoUrl.startsWith('data:') && copy.videoUrl.length > 24_000) {
        copy.videoUrl = '';
      }
      if (typeof copy.thumbnailUrl === 'string' && copy.thumbnailUrl.startsWith('data:') && copy.thumbnailUrl.length > 24_000) {
        copy.thumbnailUrl = '';
      }
      return copy;
    });
    localStorage.setItem(key, JSON.stringify(slim));
  } catch {}
}

export default function App() {
  // Navigation & View Mode - Supports direct PC admin URL (/admin or ?tab=admin or ?key=125687)
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (
        path.includes('/admin') ||
        tabParam === 'admin' ||
        params.get('admin') === 'true' ||
        window.location.hash === '#admin'
      ) {
        return 'admin';
      }
      if (tabParam === 'gallery' || tabParam === 'videos' || tabParam === 'private' || tabParam === 'comments' || tabParam === 'profile') {
        return tabParam;
      }
    }
    return 'home';
  });

  const [viewMode, setViewMode] = useState<'mobile' | 'wide'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (path.includes('/admin') || params.get('tab') === 'admin' || params.get('admin') === 'true') {
        return 'wide'; // Always open desktop PC view for admin
      }
      return window.innerWidth > 768 ? 'wide' : 'mobile';
    }
    return 'wide';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'Favorites'>('All');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(false);
  const [adminThemeColor, setAdminThemeColor] = useState<'gold' | 'ruby' | 'emerald' | 'cyber'>(() => {
    try {
      return (localStorage.getItem('zuzika_admin_theme') as any) || 'gold';
    } catch {
      return 'gold';
    }
  });

  const handleSelectAdminTheme = (theme: 'gold' | 'ruby' | 'emerald' | 'cyber') => {
    soundFX.playPop();
    setAdminThemeColor(theme);
    localStorage.setItem('zuzika_admin_theme', theme);
  };

  const handleExitAdminMode = () => {
    soundFX.playPop();
    sessionStorage.removeItem('zuzika_admin_auth');
    setIsAdminLoggedIn(false);
    setCurrentTab('home');
  };

  // Modals & Drawers
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [selectedPrivateVideo, setSelectedPrivateVideo] = useState<PrivateVideoItem | null>(null);
  const [selectedPrivateGallery, setSelectedPrivateGallery] = useState<PrivateGalleryName | 'All'>('Global Adult');
  const [isCoinRechargeOpen, setIsCoinRechargeOpen] = useState(false);
  const [adminRequestedSection, setAdminRequestedSection] = useState<'overview' | 'private' | undefined>(undefined);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGlobalLoginModalOpen, setIsGlobalLoginModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isTimedAdOpen, setIsTimedAdOpen] = useState(false);
  const [pendingInterstitialAd, setPendingInterstitialAd] = useState<{
    placement: 'gallery_image' | 'video_play';
    mediaTitle?: string;
    onProceed: () => void;
  } | null>(null);
  const [pendingDownloadAd, setPendingDownloadAd] = useState<{
    mediaTitle: string;
    mediaType: 'photo' | 'video';
    onDownload: () => void;
  } | null>(null);
  const activeUsageSecondsRef = React.useRef(0);
  const galleryPhotoOpenCountRef = React.useRef(0);
  const lastGalleryAdShownAtRef = React.useRef(0);
  const lastVideoPlayAdShownAtRef = React.useRef(0);
  const deletedPhotoIdsRef = React.useRef<Set<string>>(new Set());
  const deletedVideoIdsRef = React.useRef<Set<string>>(new Set());
  const {
    deferredPrompt,
    isInstallable,
    isInstalled: isPwaInstalled,
    install: handleTriggerPwaInstall,
  } = usePWAInstall();
  const [rewardedAdTarget, setRewardedAdTarget] = useState<{
    mediaId: string;
    mediaTitle: string;
    mediaType: 'photo' | 'video';
    purpose?: 'unlock' | 'download';
    onSuccess?: () => void;
  } | null>(null);
  const [unlockRevision, setUnlockRevision] = useState(0);

  // Photos Data - ONLY actual user-uploaded photos (purges legacy v1/v2/v3 caches)
  const [photos, setPhotos] = useState<PhotoItem[]>(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('zuzika_purged_old_dummy_v4') !== 'true') {
        purgeAllLegacyMediaCaches();
        localStorage.setItem('zuzika_purged_old_dummy_v4', 'true');
      }
      const saved = localStorage.getItem('zuzika_photos_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const userOnly = parsed.filter(isAuthenticUserPhoto);
          if (userOnly.length > 0) return userOnly;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [videos, setVideos] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('zuzika_videos_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(isAuthenticUserVideo);
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [comments, setComments] = useState<CommunityComment[]>(() => {
    try {
      const saved = localStorage.getItem('zuzika_comments_v1');
      return saved ? JSON.parse(saved) : INITIAL_COMMENTS;
    } catch {
      return INITIAL_COMMENTS;
    }
  });

  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>(() => {
    try {
      const saved = localStorage.getItem('zuzika_messages_v1');
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  const [bannerConfig, setBannerConfig] = useState<AppBannerConfig>(() => {
    try {
      const saved = localStorage.getItem('zuzika_banner_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.customShareUrl && parsed.customShareUrl.includes('suzika.vercel.app')) {
          parsed.customShareUrl = 'https://ais-pre-xxnlcelsjsskkuifh3xj2g-772740332293.asia-northeast1.run.app';
        }
        const merged: AppBannerConfig = {
          ...DEFAULT_BANNER_CONFIG,
          ...parsed,
          admobAppId: parsed.admobAppId && !parsed.admobAppId.includes('3940256099942544')
            ? parsed.admobAppId
            : REAL_ADMOB_CONFIG.appId,
          admobBannerUnitId: parsed.admobBannerUnitId && !parsed.admobBannerUnitId.includes('3940256099942544')
            ? parsed.admobBannerUnitId
            : REAL_ADMOB_CONFIG.bannerUnitId,
          admobInterstitialUnitId: parsed.admobInterstitialUnitId && !parsed.admobInterstitialUnitId.includes('3940256099942544')
            ? parsed.admobInterstitialUnitId
            : REAL_ADMOB_CONFIG.interstitialUnitId,
          admobRewardedUnitId: parsed.admobRewardedUnitId && !parsed.admobRewardedUnitId.includes('3940256099942544')
            ? parsed.admobRewardedUnitId
            : REAL_ADMOB_CONFIG.rewardedUnitId,
          admobAppOpenUnitId: parsed.admobAppOpenUnitId && !parsed.admobAppOpenUnitId.includes('3940256099942544')
            ? parsed.admobAppOpenUnitId
            : REAL_ADMOB_CONFIG.bannerUnitId,
          admobNativeUnitId: parsed.admobNativeUnitId && !parsed.admobNativeUnitId.includes('3940256099942544')
            ? parsed.admobNativeUnitId
            : REAL_ADMOB_CONFIG.bannerUnitId,
          adsenseClientId: parsed.adsenseClientId || DEFAULT_BANNER_CONFIG.adsenseClientId,
          adsenseBannerSlot: parsed.adsenseBannerSlot || DEFAULT_BANNER_CONFIG.adsenseBannerSlot,
          adsenseInfeedSlot: parsed.adsenseInfeedSlot || DEFAULT_BANNER_CONFIG.adsenseInfeedSlot,
        };
        return merged;
      }
      return DEFAULT_BANNER_CONFIG;
    } catch {
      return DEFAULT_BANNER_CONFIG;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('zuzika_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_PROFILE,
          ...parsed,
          likedPhotoIds: Array.isArray(parsed.likedPhotoIds) ? parsed.likedPhotoIds : [],
          likedVideoIds: Array.isArray(parsed.likedVideoIds) ? parsed.likedVideoIds : [],
          isLoggedIn: Boolean(parsed.isLoggedIn && (parsed.phone || parsed.name)),
          name: parsed.name || '',
          phone: parsed.phone || '',
          avatarUrl: parsed.avatarUrl || '',
          avatarText: parsed.avatarText || (parsed.name ? parsed.name.charAt(0).toUpperCase() : 'U'),
        };
      }
      return INITIAL_PROFILE;
    } catch {
      return INITIAL_PROFILE;
    }
  });

  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('zuzika_registered_users_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [privateVideos, setPrivateVideos] = useState<PrivateVideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('zuzika_private_videos_v1');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [coinRechargeRequests, setCoinRechargeRequests] = useState<CoinRechargeRequest[]>(() => {
    try {
      const saved = localStorage.getItem('zuzika_coin_requests_v1');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<Array<{ id: string; type: 'admin' | 'comment' | 'like'; title: string; message: string; time: string }>>([
    {
      id: 'notif-1',
      type: 'admin',
      title: 'Firebase Connected',
      message: 'Cloud Firestore is live on suzika-call-pic. All photos and comments sync in real time!',
      time: 'Just now'
    }
  ]);

  // Real-time Cloud Firestore + Server SSE Sync Listeners
  useEffect(() => {
    let active = true;
    let feedSyncTimer: number | null = null;

    const normalizeBannerConfig = (
      raw: Partial<AppBannerConfig>,
      prev?: AppBannerConfig
    ): AppBannerConfig => {
      const isProd = raw.isTestMode !== true;
      return {
        ...DEFAULT_BANNER_CONFIG,
        ...(prev || {}),
        ...raw,
        admobAppId: isProd && raw.admobAppId?.includes('3940256099942544') ? REAL_ADMOB_CONFIG.appId : (raw.admobAppId || REAL_ADMOB_CONFIG.appId),
        admobBannerUnitId: isProd && raw.admobBannerUnitId?.includes('3940256099942544') ? REAL_ADMOB_CONFIG.bannerUnitId : (raw.admobBannerUnitId || REAL_ADMOB_CONFIG.bannerUnitId),
        admobInterstitialUnitId: isProd && raw.admobInterstitialUnitId?.includes('3940256099942544') ? REAL_ADMOB_CONFIG.interstitialUnitId : (raw.admobInterstitialUnitId || REAL_ADMOB_CONFIG.interstitialUnitId),
        admobRewardedUnitId: isProd && raw.admobRewardedUnitId?.includes('3940256099942544') ? REAL_ADMOB_CONFIG.rewardedUnitId : (raw.admobRewardedUnitId || REAL_ADMOB_CONFIG.rewardedUnitId),
        admobAppOpenUnitId: isProd && raw.admobAppOpenUnitId?.includes('3940256099942544') ? REAL_ADMOB_CONFIG.bannerUnitId : (raw.admobAppOpenUnitId || REAL_ADMOB_CONFIG.bannerUnitId),
        admobNativeUnitId: isProd && raw.admobNativeUnitId?.includes('3940256099942544') ? REAL_ADMOB_CONFIG.bannerUnitId : (raw.admobNativeUnitId || REAL_ADMOB_CONFIG.bannerUnitId),
      };
    };

    const purgeDeletedFromLocalState = (delPhotos: string[], delVideos: string[]) => {
      if (delPhotos.length > 0) {
        const delSet = new Set(delPhotos);
        delPhotos.forEach((id) => {
          deletedPhotoIdsRef.current.add(id);
          deletePersistentPhoto(id).catch(() => {});
        });
        setPhotos((prev) => prev.filter((p) => !delSet.has(p.id)));
      }
      if (delVideos.length > 0) {
        const delSet = new Set(delVideos);
        delVideos.forEach((id) => {
          deletedVideoIdsRef.current.add(id);
          deletePersistentVideo(id).catch(() => {});
          deleteLocalVideoBlob(id);
        });
        setVideos((prev) => prev.filter((v) => !delSet.has(v.id)));
        setPrivateVideos((prev) => prev.filter((pv) => !delSet.has(pv.id)));
      }
    };

    const syncFromFeedEndpoint = () => {
      fetch('/api/feed', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!active || !data) return;

          if (Array.isArray(data.deletedPhotoIds) || Array.isArray(data.deletedVideoIds)) {
            purgeDeletedFromLocalState(
              Array.isArray(data.deletedPhotoIds) ? data.deletedPhotoIds : [],
              Array.isArray(data.deletedVideoIds) ? data.deletedVideoIds : []
            );
          }

          if (data.bannerConfig && typeof data.bannerConfig === 'object') {
            const raw = data.bannerConfig as Partial<AppBannerConfig>;
            setBannerConfig((prev) => normalizeBannerConfig(raw, prev));
          }

          if (Array.isArray(data.photos)) {
            const authenticPhotos = data.photos.filter(
              (p: PhotoItem) => isAuthenticUserPhoto(p) && !deletedPhotoIdsRef.current.has(p.id)
            );
            if (authenticPhotos.length > 0) {
              setPhotos((prev) => {
                const map = new Map<string, PhotoItem>();
                authenticPhotos.forEach((p: PhotoItem) => map.set(p.id, p));
                prev.forEach((p) => {
                  if (!map.has(p.id) && !deletedPhotoIdsRef.current.has(p.id)) map.set(p.id, p);
                });
                const merged = Array.from(map.values()).filter(isAuthenticUserPhoto);
                merged.sort(sortMediaNewestFirst);
                saveMultiplePersistentPhotos(merged).catch(() => {});
                return merged;
              });
            }
          }

          if (Array.isArray(data.videos)) {
            const authenticVideos = data.videos
              .filter((v: VideoItem) => isAuthenticUserVideo(v) && !deletedVideoIdsRef.current.has(v.id))
              .map((v: VideoItem) => {
                const url = (v.videoUrl || '').trim();
                const hasPublicUrl = Boolean(url && (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')));
                return hasPublicUrl ? { ...v, isLocalIndexedDB: false } : v;
              });
            if (authenticVideos.length > 0) {
              setVideos((prev) => {
                const map = new Map<string, VideoItem>();
                authenticVideos.forEach((v: VideoItem) => map.set(v.id, v));
                prev.forEach((v) => {
                  if (!map.has(v.id) && !deletedVideoIdsRef.current.has(v.id)) map.set(v.id, v);
                });
                const merged = Array.from(map.values()).filter(isAuthenticUserVideo);
                merged.sort(sortMediaNewestFirst);
                return merged;
              });
            }
          }

          if (Array.isArray(data.privateVideos)) {
            const feedPv = (data.privateVideos as PrivateVideoItem[]).filter(
              (pv) => pv && pv.id && !deletedVideoIdsRef.current.has(pv.id)
            );
            if (feedPv.length > 0) {
              setPrivateVideos((prev) => {
                const map = new Map<string, PrivateVideoItem>();
                feedPv.forEach((pv) => map.set(pv.id, pv));
                prev.forEach((pv) => {
                  if (!map.has(pv.id) && !deletedVideoIdsRef.current.has(pv.id)) map.set(pv.id, pv);
                });
                const merged = Array.from(map.values());
                merged.sort(sortMediaNewestFirst);
                return merged;
              });
            }
          }
        })
        .catch((err) => console.warn('REST feed fetch fallback notice:', err));
    };

    const scheduleFeedSync = () => {
      if (feedSyncTimer !== null) {
        window.clearTimeout(feedSyncTimer);
      }
      feedSyncTimer = window.setTimeout(() => {
        feedSyncTimer = null;
        if (active) syncFromFeedEndpoint();
      }, 250);
    };

    // Fast initial feed sync (~20ms)
    syncFromFeedEndpoint();

    // Instant Server-Sent Events (SSE) listener for live Admin & Cloud Firestore broadcasts across tabs & web visitors
    let eventSource: EventSource | null = null;
    let sseOpenedOnce = false;
    try {
      if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
        eventSource = new EventSource('/api/events');
        eventSource.onopen = () => {
          if (sseOpenedOnce && active) {
            scheduleFeedSync();
          }
          sseOpenedOnce = true;
        };
        eventSource.addEventListener('sync', (evt: MessageEvent) => {
          if (!active) return;
          try {
            const payload = JSON.parse(evt.data || '{}');
            if (payload.type === 'banner_updated' && payload.bannerConfig) {
              const raw = payload.bannerConfig as Partial<AppBannerConfig>;
              setBannerConfig((prev) => normalizeBannerConfig(raw, prev));
            } else if (payload.type === 'photo_deleted' && payload.id) {
              purgeDeletedFromLocalState([payload.id], []);
            } else if (payload.type === 'video_deleted' && payload.id) {
              purgeDeletedFromLocalState([], [payload.id]);
            } else if (payload.type === 'private_video_deleted' && payload.id) {
              purgeDeletedFromLocalState([], [payload.id]);
            } else if (payload.type === 'sync_meta_updated') {
              purgeDeletedFromLocalState(
                Array.isArray(payload.deletedPhotoIds) ? payload.deletedPhotoIds : [],
                Array.isArray(payload.deletedVideoIds) ? payload.deletedVideoIds : []
              );
            } else if (
              payload.type === 'photo_saved' ||
              payload.type === 'video_saved' ||
              payload.type === 'private_video_saved' ||
              payload.type === 'feed_updated'
            ) {
              scheduleFeedSync();
            }
          } catch {}
        });
      }
    } catch {}

    // 1. Real-time Photos Listener - Syncs additions/edits/removals in real time
    const photosCol = collection(db, 'photos');
    const unsubPhotos = onSnapshot(photosCol, async (snapshot) => {
      if (!active) return;

      const removedPhotoIds: string[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          removedPhotoIds.push(change.doc.id);
          deletedPhotoIdsRef.current.add(change.doc.id);
          deletePersistentPhoto(change.doc.id).catch(() => {});
        } else if (change.type === 'added' || change.type === 'modified') {
          deletedPhotoIdsRef.current.delete(change.doc.id);
        }
      });

      if (snapshot.empty) {
        if (removedPhotoIds.length > 0 && !snapshot.metadata.fromCache) {
          const delSet = new Set(removedPhotoIds);
          setPhotos((prev) => prev.filter((p) => !delSet.has(p.id)));
        } else {
          getAllPersistentPhotos().then((stored) => {
            if (!active) return;
            if (stored && stored.length > 0) {
              setPhotos((prev) => {
                if (prev.length > 0) return prev;
                const clean = stored.filter(
                  (p) => isAuthenticUserPhoto(p) && !deletedPhotoIdsRef.current.has(p.id)
                );
                clean.sort(sortMediaNewestFirst);
                return clean;
              });
            }
          });
        }
      } else {
        const cloudPhotos = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              ...data,
              id: data.id || docSnap.id,
              slotNumber: typeof data.slotNumber === 'number' ? data.slotNumber : 1,
              category: data.category || 'Style',
              title: data.title || `Slot Photo`,
              fallbackGradient: data.fallbackGradient || 'linear-gradient(135deg, #ff35bb, #8b4dff)',
              author: data.author || 'Suzika Creator',
              likes: typeof data.likes === 'number' ? data.likes : 0,
              views: typeof data.views === 'number' ? data.views : 1,
              tags: Array.isArray(data.tags) ? data.tags : [],
              comments: Array.isArray(data.comments) ? data.comments : [],
              createdAt: data.createdAt || 'Recent',
            } as PhotoItem;
          })
          .filter((p) => isAuthenticUserPhoto(p) && !deletedPhotoIdsRef.current.has(p.id));

        setPhotos((prev) => {
          const map = new Map<string, PhotoItem>();
          cloudPhotos.forEach((p) => map.set(p.id, p));
          if (snapshot.metadata.fromCache) {
            prev.forEach((p) => {
              if (!map.has(p.id) && !deletedPhotoIdsRef.current.has(p.id)) map.set(p.id, p);
            });
          } else {
            // Preserve only strictly local optimistic items not yet committed on server
            const removedSet = new Set(removedPhotoIds);
            prev.forEach((p) => {
              if (
                !map.has(p.id) &&
                !removedSet.has(p.id) &&
                !deletedPhotoIdsRef.current.has(p.id) &&
                snapshot.metadata.hasPendingWrites
              ) {
                map.set(p.id, p);
              }
            });
          }
          const merged = Array.from(map.values()).filter(isAuthenticUserPhoto);
          merged.sort(sortMediaNewestFirst);
          return merged;
        });
      }
      setFirebaseConnected(true);
    }, (error) => {
      console.warn('Firestore photos snapshot fallback to cache', error);
      setFirebaseConnected(false);
    });

    // 2. Real-time Videos Listener - Syncs additions/edits/removals in real time
    const videosCol = collection(db, 'videos');
    const unsubVideos = onSnapshot(videosCol, async (snapshot) => {
      if (!active) return;

      const removedVideoIds: string[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          removedVideoIds.push(change.doc.id);
          deletedVideoIdsRef.current.add(change.doc.id);
          deletePersistentVideo(change.doc.id).catch(() => {});
          deleteLocalVideoBlob(change.doc.id);
        } else if (change.type === 'added' || change.type === 'modified') {
          deletedVideoIdsRef.current.delete(change.doc.id);
        }
      });

      if (snapshot.empty) {
        if (removedVideoIds.length > 0 && !snapshot.metadata.fromCache) {
          const delSet = new Set(removedVideoIds);
          setVideos((prev) => prev.filter((v) => !delSet.has(v.id)));
        } else {
          getAllPersistentVideos().then((stored) => {
            if (!active) return;
            if (stored && stored.length > 0) {
              setVideos((prev) => {
                if (prev.length > 0) return prev;
                const clean = (stored || []).filter(
                  (v) => isAuthenticUserVideo(v) && !deletedVideoIdsRef.current.has(v.id)
                );
                clean.sort(sortMediaNewestFirst);
                return clean;
              });
            }
          });
        }
      } else {
        const cloudVideos = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            if (docSnap.id.startsWith('private-local-') || data.isPrivatePhoneVideo) {
              deleteDoc(doc(db, 'videos', docSnap.id)).catch(() => {});
            }
            const rawUrl = String(data.videoUrl || '').trim();
            const hasPublicUrl = Boolean(rawUrl && (rawUrl.startsWith('/') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')));
            return {
              ...data,
              id: data.id || docSnap.id,
              slotNumber: typeof data.slotNumber === 'number' ? data.slotNumber : 1,
              category: data.category || 'Cinematic',
              title: data.title || `Video Reel`,
              duration: data.duration || '0:30',
              fallbackGradient: data.fallbackGradient || 'linear-gradient(135deg, #8b4dff, #00d2ff)',
              author: data.author || 'SUZIKA User',
              likes: typeof data.likes === 'number' ? data.likes : 0,
              views: typeof data.views === 'number' ? data.views : 1,
              tags: Array.isArray(data.tags) ? data.tags : [],
              createdAt: data.createdAt || 'Recent',
              isLocalIndexedDB: hasPublicUrl ? false : Boolean(data.isLocalIndexedDB),
            } as VideoItem;
          })
          .filter((v) => isAuthenticUserVideo(v) && !deletedVideoIdsRef.current.has(v.id));

        setVideos((prev) => {
          const map = new Map<string, VideoItem>();
          cloudVideos.forEach((v) => map.set(v.id, v));
          if (snapshot.metadata.fromCache) {
            prev.forEach((v) => {
              if (!map.has(v.id) && !deletedVideoIdsRef.current.has(v.id)) map.set(v.id, v);
            });
          } else {
            const removedSet = new Set(removedVideoIds);
            prev.forEach((v) => {
              if (
                !map.has(v.id) &&
                !removedSet.has(v.id) &&
                !deletedVideoIdsRef.current.has(v.id) &&
                snapshot.metadata.hasPendingWrites
              ) {
                map.set(v.id, v);
              }
            });
          }
          const merged = Array.from(map.values()).filter(isAuthenticUserVideo);
          merged.sort(sortMediaNewestFirst);
          return merged;
        });
      }
    }, (err) => console.warn(err));

    // 3. Comments Listener
    const commentsCol = collection(db, 'comments');
    const unsubComments = onSnapshot(commentsCol, async (snapshot) => {
      if (!active) return;
      if (snapshot.empty) {
        if (!snapshot.metadata.fromCache) {
          setComments(INITIAL_COMMENTS);
        }
      } else {
        const cloudComments = snapshot.docs.map((docSnap) => docSnap.data() as CommunityComment);
        setComments(cloudComments);
      }
    }, (err) => console.warn(err));

    // 4. Admin Messages Listener
    const messagesCol = collection(db, 'adminMessages');
    const unsubMessages = onSnapshot(messagesCol, (snapshot) => {
      if (!active) return;
      if (!snapshot.empty || !snapshot.metadata.fromCache) {
        const cloudMsgs = snapshot.docs.map((docSnap) => docSnap.data() as AdminMessage);
        setAdminMessages(cloudMsgs);
      }
    }, (err) => console.warn(err));

    // 5. Settings / Banner Listener
    const bannerRef = doc(db, 'settings', 'bannerConfig');
    const unsubBanner = onSnapshot(bannerRef, (docSnap) => {
      if (!active) return;
      if (docSnap.exists()) {
        const raw = docSnap.data() as Partial<AppBannerConfig>;
        setBannerConfig((prev) => normalizeBannerConfig(raw, prev));
      }
    }, (err) => console.warn(err));

    // 6. SyncMeta Listener (propagates Admin deletions across all users in real time)
    const syncMetaRef = doc(db, 'settings', 'syncMeta');
    const unsubSyncMeta = onSnapshot(syncMetaRef, (docSnap) => {
      if (!active || !docSnap.exists()) return;
      const data = docSnap.data();
      purgeDeletedFromLocalState(
        Array.isArray(data?.deletedPhotoIds) ? data.deletedPhotoIds : [],
        Array.isArray(data?.deletedVideoIds) ? data.deletedVideoIds : []
      );
    }, (err) => console.warn(err));

    // 7. Registered Users Listener
    const usersCol = collection(db, 'registeredUsers');
    const unsubUsers = onSnapshot(usersCol, (snapshot) => {
      if (!active) return;
      if (!snapshot.empty || !snapshot.metadata.fromCache) {
        const cloudUsers = snapshot.docs.map((docSnap) => docSnap.data() as UserAccount);
        setRegisteredUsers(cloudUsers);
      }
    }, (err) => console.warn(err));

    // 8. Private VIP Videos Listener
    const privateVideosCol = collection(db, 'privateVideos');
    const unsubPrivateVideos = onSnapshot(privateVideosCol, (snapshot) => {
      if (!active) return;
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          deletedVideoIdsRef.current.add(change.doc.id);
          deleteLocalVideoBlob(change.doc.id);
        } else if (change.type === 'added' || change.type === 'modified') {
          deletedVideoIdsRef.current.delete(change.doc.id);
        }
      });
      const cloudPv = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          ...data,
          id: data.id || docSnap.id,
          gallery: data.gallery || 'Global Adult',
          galleries: Array.isArray(data.galleries) ? data.galleries : undefined,
          coinPrice: typeof data.coinPrice === 'number' ? data.coinPrice : 50,
          slotNumber: typeof data.slotNumber === 'number' ? data.slotNumber : 1,
        } as PrivateVideoItem;
      });
      cloudPv.sort(sortMediaNewestFirst);
      setPrivateVideos(cloudPv);
    }, (err) => console.warn(err));

    // 9. Coin Recharge Requests Listener
    const rechargeCol = collection(db, 'coinRechargeRequests');
    const unsubRecharge = onSnapshot(rechargeCol, (snapshot) => {
      if (!active) return;
      const cloudReqs = snapshot.docs.map((docSnap) => docSnap.data() as CoinRechargeRequest);
      cloudReqs.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      setCoinRechargeRequests(cloudReqs);
    }, (err) => console.warn(err));

    return () => {
      active = false;
      if (feedSyncTimer !== null) {
        window.clearTimeout(feedSyncTimer);
      }
      if (eventSource) {
        try {
          eventSource.close();
        } catch {}
      }
      unsubPhotos();
      unsubVideos();
      unsubComments();
      unsubMessages();
      unsubBanner();
      unsubSyncMeta();
      unsubUsers();
      unsubPrivateVideos();
      unsubRecharge();
    };
  }, []);

  // Load persistent IndexedDB photos and videos on mount (Requirement 5 & 6)
  useEffect(() => {
    let mounted = true;
    const loadIndexedDBMedia = async () => {
      try {
        const [storedPhotos, storedVideos] = await Promise.all([
          getAllPersistentPhotos(),
          getAllPersistentVideos()
        ]);
        if (!mounted) return;
        
        const cleanPhotos = (storedPhotos || []).filter(isAuthenticUserPhoto);
        const cleanVideos = (storedVideos || []).filter(isAuthenticUserVideo);

        if (cleanPhotos.length > 0) {
          setPhotos((prev) => {
            const map = new Map<string, PhotoItem>();
            prev.filter(isAuthenticUserPhoto).forEach((p) => map.set(p.id, p));
            cleanPhotos.forEach((p) => {
              if (!map.has(p.id)) map.set(p.id, p);
            });
            const merged = Array.from(map.values());
            merged.sort(sortMediaNewestFirst);
            return merged;
          });
        }

        if (cleanVideos.length > 0) {
          setVideos((prev) => {
            const map = new Map<string, VideoItem>();
            prev.filter(isAuthenticUserVideo).forEach((v) => map.set(v.id, v));
            cleanVideos.forEach((v) => {
              if (!map.has(v.id)) map.set(v.id, v);
            });
            const merged = Array.from(map.values());
            merged.sort(sortMediaNewestFirst);
            return merged;
          });
        }
      } catch (err) {
        console.warn('Failed to load from persistent media store:', err);
      }
    };
    loadIndexedDBMedia();
    return () => {
      mounted = false;
    };
  }, []);

  // Debounced lightweight LocalStorage cache (never blocks main thread on large base64 arrays)
  useEffect(() => {
    const t = window.setTimeout(() => {
      safeCacheMediaLight('zuzika_photos_v4', photos.filter(isAuthenticUserPhoto), 35);
    }, 900);
    return () => window.clearTimeout(t);
  }, [photos]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      safeCacheMediaLight('zuzika_videos_v4', videos.filter(isAuthenticUserVideo), 35);
    }, 900);
    return () => window.clearTimeout(t);
  }, [videos]);

  useEffect(() => {
    try {
      localStorage.setItem('zuzika_comments_v1', JSON.stringify(comments));
    } catch (e) {
      console.warn('Storage quota', e);
    }
  }, [comments]);

  useEffect(() => {
    try {
      localStorage.setItem('zuzika_messages_v1', JSON.stringify(adminMessages));
    } catch (e) {
      console.warn('Storage quota', e);
    }
  }, [adminMessages]);

  useEffect(() => {
    try {
      localStorage.setItem('zuzika_profile_v1', JSON.stringify(userProfile));
    } catch (e) {
      console.warn('Storage quota', e);
    }
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('zuzika_banner_config_v1', JSON.stringify(bannerConfig));
    } catch (e) {
      console.warn('Storage quota', e);
    }
    syncAdMobConfig(bannerConfig);
  }, [bannerConfig]);

  // Trigger App Open Ad on foreground resume inside Android APK when enabled
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        showAppOpenAdIfEnabled(bannerConfig);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [bannerConfig]);

  // Dismiss instant HTML startup splash screen once React renders with a smooth transition
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof (window as any).__dismissSuzikaSplash === 'function') {
        (window as any).__dismissSuzikaSplash();
      }
    }, 550);
    return () => clearTimeout(timer);
  }, []);

  // Keep Browser Tab & OpenGraph title consistent across Home, Gallery, Videos, Comments, and Profile
  useEffect(() => {
    const tabTitleMap: Record<TabType, string> = {
      home: 'SUZIKA Call Pic',
      gallery: 'SUZIKA Call Pic — Photo Gallery',
      videos: 'SUZIKA Call Pic — Video Reels',
      private: 'SUZIKA Call Pic — Private VIP 18+',
      comments: 'SUZIKA Call Pic — Community',
      profile: 'SUZIKA Call Pic — Profile',
      admin: 'SUZIKA Call Pic — Admin Control',
    };
    const nextTitle = tabTitleMap[currentTab] || 'SUZIKA Call Pic';
    if (typeof document !== 'undefined') {
      document.title = nextTitle;
    }
  }, [currentTab]);

  // Auto-show Web App / Android APK Download Popup 4 seconds after entering website
  useEffect(() => {
    if (currentTab === 'admin') return;
    if (!shouldShowAndroidApkPopup(bannerConfig)) return;

    const timer = setTimeout(() => {
      if (shouldShowAndroidApkPopup(bannerConfig)) {
        setIsInstallModalOpen(true);
        try {
          sessionStorage.setItem('zuzika_apk_popup_session_dismissed', 'true');
        } catch {}
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [currentTab, bannerConfig?.showInstallPopup, bannerConfig?.mobileAppInstallUrl, bannerConfig?.apkPopupCooldownDays]);

  // Listen to branded/sponsor banner slot actions (APK install or tab navigation)
  useEffect(() => {
    const handleOpenInstall = () => setIsInstallModalOpen(true);
    const handleNavTab = (e: Event) => {
      const detail = (e as CustomEvent<TabType>).detail;
      if (detail) setCurrentTab(detail);
    };
    window.addEventListener('suzika-open-install-modal', handleOpenInstall);
    window.addEventListener('suzika-navigate-tab', handleNavTab);
    return () => {
      window.removeEventListener('suzika-open-install-modal', handleOpenInstall);
      window.removeEventListener('suzika-navigate-tab', handleNavTab);
    };
  }, []);

  // 5-Minute Active App Usage Full-Screen Video / Interstitial Ad Timer
  useEffect(() => {
    const isTimedEnabled = bannerConfig.enableTimedFullscreenAd !== false && bannerConfig.enableAds !== false;
    if (!isTimedEnabled || currentTab === 'admin') return;

    const intervalSeconds = Math.max(60, Number(bannerConfig.timedAdIntervalMinutes ?? 5) * 60);

    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (isTimedAdOpen || rewardedAdTarget || pendingInterstitialAd || pendingDownloadAd) return;

      activeUsageSecondsRef.current += 1;

      if (activeUsageSecondsRef.current >= intervalSeconds) {
        // Never interrupt while actively playing a video, viewing lightbox, or uploading
        if (selectedVideo || selectedPhoto || isUploadOpen || isInstallModalOpen || pendingInterstitialAd || pendingDownloadAd) {
          return;
        }

        activeUsageSecondsRef.current = 0;
        triggerTimedNativeInterstitial(bannerConfig).then((handledByNative) => {
          if (!handledByNative) {
            setIsTimedAdOpen(true);
          }
        });
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [
    currentTab,
    bannerConfig,
    isTimedAdOpen,
    rewardedAdTarget,
    pendingInterstitialAd,
    pendingDownloadAd,
    selectedVideo,
    selectedPhoto,
    isUploadOpen,
    isInstallModalOpen,
  ]);

  const handleOneTapInstallOrModal = async () => {
    if (isInstallable) {
      const accepted = await handleTriggerPwaInstall();
      if (accepted) return;
    }
    setIsInstallModalOpen(true);
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem('zuzika_registered_users_v1', JSON.stringify(registeredUsers.slice(0, 100)));
      } catch {}
    }, 900);
    return () => window.clearTimeout(t);
  }, [registeredUsers]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      safeCacheMediaLight('zuzika_private_videos_v1', privateVideos, 40);
    }, 900);
    return () => window.clearTimeout(t);
  }, [privateVideos]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem('zuzika_coin_requests_v1', JSON.stringify(coinRechargeRequests.slice(0, 100)));
      } catch {}
    }, 900);
    return () => window.clearTimeout(t);
  }, [coinRechargeRequests]);

  // Live sync logged-in user's coin balance and unlocked private videos from registeredUsers (Cloud Firestore)
  useEffect(() => {
    if (!userProfile.isLoggedIn || !userProfile.phone) return;
    const cleanPhoneDigits = userProfile.phone.replace(/[^0-9]/g, '');
    const matched = registeredUsers.find(
      (u) => u.phone === userProfile.phone || (cleanPhoneDigits && u.id === `user-${cleanPhoneDigits}`)
    );
    if (!matched) return;

    const cloudCoins = typeof matched.coins === 'number' ? matched.coins : 0;
    const cloudUnlocked = Array.isArray(matched.unlockedPrivateVideoIds) ? matched.unlockedPrivateVideoIds : [];
    const currentUnlocked = Array.isArray(userProfile.unlockedPrivateVideoIds) ? userProfile.unlockedPrivateVideoIds : [];
    const sameUnlocked =
      cloudUnlocked.length === currentUnlocked.length &&
      cloudUnlocked.every((id) => currentUnlocked.includes(id));

    if (cloudCoins !== (userProfile.coins || 0) || !sameUnlocked) {
      setUserProfile((prev) => ({
        ...prev,
        coins: cloudCoins,
        unlockedPrivateVideoIds: Array.from(new Set([...(prev.unlockedPrivateVideoIds || []), ...cloudUnlocked])),
      }));
    }
  }, [registeredUsers, userProfile.isLoggedIn, userProfile.phone]);

  // User Login & Registration Handler (preserves existing Coins & Unlocked Private Videos)
  const handleUserLogin = (name: string, phone: string, avatarUrl?: string) => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const avatarInitial = cleanName.charAt(0).toUpperCase() || 'U';
    const userId = `user-${cleanPhone.replace(/[^0-9]/g, '') || Date.now()}`;

    const existingAccount = registeredUsers.find(
      (u) => u.id === userId || u.phone === cleanPhone
    );
    const preservedCoins = typeof existingAccount?.coins === 'number' ? existingAccount.coins : (userProfile.coins || 0);
    const preservedUnlocked = Array.isArray(existingAccount?.unlockedPrivateVideoIds)
      ? existingAccount.unlockedPrivateVideoIds
      : (userProfile.unlockedPrivateVideoIds || []);

    const updatedProfile: UserProfile = {
      ...userProfile,
      name: cleanName,
      phone: cleanPhone,
      avatarUrl: avatarUrl || existingAccount?.avatarUrl || '',
      avatarText: avatarInitial,
      isLoggedIn: true,
      likedPhotoIds: Array.isArray(userProfile.likedPhotoIds) ? userProfile.likedPhotoIds : [],
      likedVideoIds: Array.isArray(userProfile.likedVideoIds) ? userProfile.likedVideoIds : [],
      coins: preservedCoins,
      unlockedPrivateVideoIds: preservedUnlocked,
    };
    setUserProfile(updatedProfile);

    const userAcc: UserAccount = {
      id: userId,
      name: cleanName,
      phone: cleanPhone,
      avatarUrl: avatarUrl || existingAccount?.avatarUrl || '',
      avatarText: avatarInitial,
      joinedDate: existingAccount?.joinedDate || 'আজ (Just now)',
      createdAtMs: existingAccount?.createdAtMs || Date.now(),
      likedPhotoIds: updatedProfile.likedPhotoIds,
      likedVideoIds: updatedProfile.likedVideoIds,
      coins: preservedCoins,
      unlockedPrivateVideoIds: preservedUnlocked,
    };

    setRegisteredUsers((prev) => {
      const filtered = prev.filter((u) => u.phone !== cleanPhone && u.id !== userId);
      return [userAcc, ...filtered];
    });

    setDoc(doc(db, 'registeredUsers', userId), cleanFirestoreDoc(userAcc), { merge: true }).catch((err) => console.warn(err));

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        type: 'comment',
        title: 'লগইন সফল হয়েছে!',
        message: `স্বাগতম ${cleanName}! আপনার একাউন্ট সক্রিয় হয়েছে। (ব্যালেন্স: ${preservedCoins} Coins)`,
        time: 'Just now',
      },
      ...prev,
    ]);

    if (currentTab === 'profile') {
      setCurrentTab('home');
    }
  };

  const handleUserLogout = () => {
    setUserProfile((prev) => ({
      ...prev,
      isLoggedIn: false,
      name: '',
      phone: '',
      avatarUrl: '',
      coins: 0,
      unlockedPrivateVideoIds: [],
    }));
    setCurrentTab('profile');
  };

  const handleDeleteRegisteredUser = (userId: string) => {
    setRegisteredUsers((prev) => prev.filter((u) => u.id !== userId));
    deleteDoc(doc(db, 'registeredUsers', userId)).catch(() => {});
  };

  // Handlers with Firestore writes
  const handleTogglePhotoLike = (photoId: string) => {
    // Authentication guard
    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      setIsGlobalLoginModalOpen(true);
      return;
    }

    setPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id === photoId) {
          const isLiked = !photo.isLiked;
          const currentBase = formatLikes(photo.likes, photo.slotNumber, photo.id);
          const newLikes = isLiked ? Math.min(600, currentBase + 1) : Math.max(100, currentBase - 1);

          setUserProfile((p) => {
            const likedSet = new Set(p.likedPhotoIds || []);
            if (isLiked) likedSet.add(photoId);
            else likedSet.delete(photoId);
            return { ...p, likedPhotoIds: Array.from(likedSet) };
          });

          if (selectedPhoto && selectedPhoto.id === photoId) {
            setSelectedPhoto({ ...photo, isLiked, likes: newLikes });
          }

          // Update Firestore doc
          updateDoc(doc(db, 'photos', photoId), { likes: newLikes }).catch(() => {});

          return { ...photo, isLiked, likes: newLikes };
        }
        return photo;
      })
    );
  };

  const handleToggleVideoLike = (videoId: string) => {
    // Authentication guard
    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      setIsGlobalLoginModalOpen(true);
      return;
    }

    setVideos((prev) =>
      prev.map((video) => {
        if (video.id === videoId) {
          const isLiked = !video.isLiked;
          const currentBase = formatLikes(video.likes, video.slotNumber, video.id);
          const newLikes = isLiked ? Math.min(600, currentBase + 1) : Math.max(100, currentBase - 1);

          setUserProfile((p) => {
            const likedSet = new Set(p.likedVideoIds || []);
            if (isLiked) likedSet.add(videoId);
            else likedSet.delete(videoId);
            return { ...p, likedVideoIds: Array.from(likedSet) };
          });

          if (selectedVideo && selectedVideo.id === videoId) {
            setSelectedVideo({ ...video, isLiked, likes: newLikes });
          }

          updateDoc(doc(db, 'videos', videoId), { likes: newLikes }).catch(() => {});

          return { ...video, isLiked, likes: newLikes };
        }
        return video;
      })
    );
  };

  const handleSelectPhoto = (photo: PhotoItem) => {
    const isGallerySource = currentTab === 'gallery';
    const isAdsGloballyOn = bannerConfig.enableAds !== false;
    const isGalleryAdEnabled = bannerConfig.enableGalleryInterstitialAd !== false;

    if (isGallerySource && isAdsGloballyOn && isGalleryAdEnabled) {
      galleryPhotoOpenCountRef.current += 1;
      const freq = Math.max(2, Number(bannerConfig.galleryInterstitialFrequency ?? 3));
      const cooldownMs = Math.max(15, Number(bannerConfig.galleryInterstitialCooldownSeconds ?? 45)) * 1000;
      const now = Date.now();
      const cooldownElapsed =
        lastGalleryAdShownAtRef.current === 0 || now - lastGalleryAdShownAtRef.current >= cooldownMs;

      if (galleryPhotoOpenCountRef.current >= freq && cooldownElapsed) {
        const parsedGalleryTag = parseAdsterraTag(
          bannerConfig.galleryInterstitialTagUrl,
          bannerConfig.webAdScriptUrl
        );
        const hasRealWebAd = parsedGalleryTag.kind !== 'none' && parsedGalleryTag.kind !== 'conflict';
        const hasNativeAd =
          isNativeAndroidAdMobAvailable() && bannerConfig.enableAndroidInterstitial !== false;

        if (hasRealWebAd) {
          galleryPhotoOpenCountRef.current = 0;
          lastGalleryAdShownAtRef.current = now;
          setPendingInterstitialAd({
            placement: 'gallery_image',
            mediaTitle: photo.title,
            onProceed: () => setSelectedPhoto(photo),
          });
          return;
        }

        if (hasNativeAd) {
          galleryPhotoOpenCountRef.current = 0;
          lastGalleryAdShownAtRef.current = now;
          showImmediateNativeInterstitial(bannerConfig).finally(() => {
            setSelectedPhoto(photo);
          });
          return;
        }
      }
    }

    setSelectedPhoto(photo);
    trackMediaViewAndMaybeShowInterstitial(bannerConfig);
  };

  const handleSelectVideo = (video: VideoItem, skipPlayAd = false) => {
    soundFX.playPop();
    const isLocked = video.isPrivatePhoneVideo ? false : isVideoLocked(video, bannerConfig);
    if (isLocked) {
      // Directly launch Google AdMob Rewarded Ad
      setRewardedAdTarget({
        mediaId: video.id,
        mediaTitle: video.title,
        mediaType: 'video',
        purpose: 'unlock',
        onSuccess: () => {
          // Play immediately once reward is earned (no double ad right after rewarded unlock)
          setSelectedVideo(video);
        },
      });
      return;
    }

    const isAdsGloballyOn = bannerConfig.enableAds !== false;
    const isVideoPlayAdEnabled = bannerConfig.enableVideoPlayAd !== false;

    if (!skipPlayAd && !video.isPrivatePhoneVideo && isAdsGloballyOn && isVideoPlayAdEnabled) {
      const cooldownMs = Math.max(0, Number(bannerConfig.videoPlayAdCooldownSeconds ?? 0)) * 1000;
      const now = Date.now();
      const cooldownElapsed =
        lastVideoPlayAdShownAtRef.current === 0 || now - lastVideoPlayAdShownAtRef.current >= cooldownMs;

      if (cooldownElapsed) {
        const primaryVideoTag = (bannerConfig.videoPlayAdTagUrl || '').trim();
        const fallbackVast = (bannerConfig.webVideoAdUrl || '').trim();
        const candidateTag = primaryVideoTag || (isLikelyVastUrl(fallbackVast) ? fallbackVast : '');
        const parsedVideoTag = parseAdsterraTag(candidateTag, bannerConfig.webAdScriptUrl);
        const hasRealWebVideoAd =
          parsedVideoTag.kind !== 'none' && parsedVideoTag.kind !== 'conflict';
        const hasNativeAd =
          isNativeAndroidAdMobAvailable() && bannerConfig.enableAndroidInterstitial !== false;

        if (hasRealWebVideoAd) {
          lastVideoPlayAdShownAtRef.current = now;
          setPendingInterstitialAd({
            placement: 'video_play',
            mediaTitle: video.title,
            onProceed: () => setSelectedVideo(video),
          });
          return;
        }

        if (hasNativeAd) {
          lastVideoPlayAdShownAtRef.current = now;
          showImmediateNativeInterstitial(bannerConfig).finally(() => {
            setSelectedVideo(video);
          });
          return;
        }
      }
    }

    setSelectedVideo(video);
    trackMediaViewAndMaybeShowInterstitial(bannerConfig);
  };

  const handleAddPhotoComment = (photoId: string, text: string) => {
    // Authentication guard
    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      setIsGlobalLoginModalOpen(true);
      return;
    }

    const newComment = {
      id: `pc-${Date.now()}`,
      authorName: userProfile.name || 'Anonymous',
      content: text,
      timestamp: 'Just now',
    };

    setPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id === photoId) {
          const updated = {
            ...photo,
            comments: [newComment, ...(photo.comments || [])],
          };
          if (selectedPhoto && selectedPhoto.id === photoId) {
            setSelectedPhoto(updated);
          }
          setDoc(doc(db, 'photos', photoId), cleanFirestoreDoc(updated)).catch(() => {});
          return updated;
        }
        return photo;
      })
    );
  };

  const handleAddCommunityComment = (content: string, category: 'General' | 'Photo' | 'Video' | 'VIP') => {
    // Authentication guard
    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      setCurrentTab('profile');
      setRestrictedNotice('কমিউনিটিতে কমেন্ট করতে হলে অনুগ্রহ করে প্রোফাইলে আপনার নাম ও মোবাইল নম্বর দিয়ে লগইন করুন।');
      setTimeout(() => setRestrictedNotice(null), 5000);
      return;
    }

    const newComment: CommunityComment = {
      id: `comm-${Date.now()}`,
      authorName: userProfile.name || 'Member',
      authorAvatarText: userProfile.avatarText || userProfile.name?.charAt(0).toUpperCase() || 'U',
      avatarColor: 'from-[#ff35bb] to-[#8b4dff]',
      content,
      timestamp: 'Just now',
      likes: 1,
      isLiked: true,
      category,
      replies: [],
    };
    setComments((prev) => [newComment, ...prev]);
    setDoc(doc(db, 'comments', newComment.id), cleanFirestoreDoc(newComment)).catch(() => {});
  };

  const handleToggleCommentLike = (commentId: string) => {
    // Authentication guard
    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      setCurrentTab('profile');
      setRestrictedNotice('কমেন্টে লাইক দিতে হলে অনুগ্রহ করে প্রোফাইলে আপনার নাম ও মোবাইল নম্বর দিয়ে লগইন করুন।');
      setTimeout(() => setRestrictedNotice(null), 5000);
      return;
    }

    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const isLiked = !c.isLiked;
          const likes = isLiked ? c.likes + 1 : Math.max(0, c.likes - 1);
          updateDoc(doc(db, 'comments', commentId), { likes, isLiked }).catch(() => {});
          return {
            ...c,
            isLiked,
            likes,
          };
        }
        return c;
      })
    );
  };

  const handleAddReply = (commentId: string, replyText: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const updatedReplies = [
            ...(c.replies || []),
            {
              id: `rep-${Date.now()}`,
              authorName: userProfile.name,
              content: replyText,
              timestamp: 'Just now',
            },
          ];
          updateDoc(doc(db, 'comments', commentId), { replies: updatedReplies }).catch(() => {});
          return {
            ...c,
            replies: updatedReplies,
          };
        }
        return c;
      })
    );
  };

  const handleSendMessageToAdmin = (
    text: string,
    category: 'General' | 'Photo Request' | 'Video Upload' | 'Sponsorship' | 'Bug Report'
  ) => {
    const msgId = `msg-${Date.now()}`;
    const newMsg: AdminMessage = {
      id: msgId,
      senderName: userProfile.name,
      category,
      message: text,
      timestamp: 'Just now',
      status: 'sent',
    };

    setAdminMessages((prev) => [newMsg, ...prev]);
    setDoc(doc(db, 'adminMessages', msgId), cleanFirestoreDoc(newMsg)).catch(() => {});

    // Simulate smart Admin response after 1.8 seconds
    setTimeout(() => {
      soundFX.playSuccess();
      const adminReplyText =
        category === 'Photo Request'
          ? `Hi ${userProfile.name}, our curators received your photo suggestion! We will curate 5 new slots for this category in the next sync.`
          : category === 'Video Upload'
          ? `Thanks for your reel submission! We are reviewing the video format for HD compatibility.`
          : category === 'Sponsorship'
          ? `Hello from SUZIKA Partnerships! We have received your inquiry regarding banner slot integration.`
          : `Thanks for reaching out! The SUZIKA team has verified your note and is actively monitoring your account.`;

      const replyData = {
        adminName: 'SUZIKA Admin Desk',
        text: adminReplyText,
        timestamp: 'Just now',
      };

      setAdminMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: 'replied', reply: replyData } : m))
      );

      updateDoc(doc(db, 'adminMessages', msgId), {
        status: 'replied',
        reply: replyData,
      }).catch(() => {});

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          type: 'admin',
          title: 'Admin Replied to You',
          message: adminReplyText,
          time: 'Just now',
        },
        ...prev,
      ]);
    }, 1800);
  };

  const handleAddPhoto = async (photo: PhotoItem): Promise<boolean> => {
    try {
      // 1. Save to persistent storage (IndexedDB) first - Guaranteed persistent
      await savePersistentPhoto(photo);

      // 2. Save to local disk server DB for true multi-device/multi-reload persistence
      fetch('/api/save-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photo),
      }).catch((err) => console.warn('Server save photo notice:', err));

      // 3. Attempt Cloud Firestore sync in background
      let cloudSynced = false;
      try {
        await setDoc(doc(db, 'photos', photo.id), cleanFirestoreDoc(photo));
        cloudSynced = true;
      } catch (firestoreErr) {
        console.warn('Firestore cloud sync notice:', firestoreErr);
      }

      // 4. Update state only AFTER successful persistent save
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.id !== photo.id);
        const updated = [photo, ...filtered].sort(sortMediaNewestFirst);
        try {
          localStorage.setItem('zuzika_photos_v4', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 5. Navigate to gallery so user sees the newly published photo immediately
      setCurrentTab('gallery');
      setSelectedCategory('All');

      // 6. User notification
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          type: 'comment',
          title: 'ফটো সফলভাবে পাবলিশ হয়েছে! (Photo Published)',
          message: cloudSynced
            ? `Slot #${photo.slotNumber} "${photo.title}" Cloud Firestore ও পারসিস্টেন্ট মেমোরিতে সেভ হয়েছে।`
            : `Slot #${photo.slotNumber} "${photo.title}" ডিভাইসের পারসিস্টেন্ট মেমোরিতে (IndexedDB) সফলভাবে সেভ হয়েছে।`,
          time: 'Just now',
        },
        ...prev,
      ]);
      return true;
    } catch (err: any) {
      console.error('Failed to save photo persistently:', err);
      throw new Error(err?.message || 'ছবিটি পারসিস্টেন্ট স্টোরেজে সেভ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  const handleAddVideo = async (video: VideoItem, fileBlob?: Blob): Promise<boolean> => {
    try {
      // 1. Save to persistent storage (IndexedDB) first
      await savePersistentVideo(video, fileBlob);
      if (fileBlob) {
        await saveLocalVideoBlob(video.id, fileBlob).catch(() => {});
      }

      const rawUrl = (video.videoUrl || '').trim();
      const hasPublicUrl = Boolean(rawUrl && (rawUrl.startsWith('/') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')));
      const finalVideo: VideoItem = {
        ...video,
        isLocalIndexedDB: hasPublicUrl ? false : Boolean(fileBlob || video.isLocalIndexedDB),
      };

      // 2. Save to local disk server DB for true multi-device/multi-reload persistence
      fetch('/api/save-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalVideo),
      }).catch((err) => console.warn('Server save video notice:', err));

      // 3. Attempt Cloud Firestore metadata sync
      let cloudSynced = false;
      try {
        const firestoreMeta = { ...finalVideo };
        if (firestoreMeta.videoUrl === 'local-blob') {
          firestoreMeta.videoUrl = 'local-indexeddb';
        }
        await setDoc(doc(db, 'videos', finalVideo.id), cleanFirestoreDoc(firestoreMeta));
        cloudSynced = true;
      } catch (firestoreErr) {
        console.warn('Firestore video cloud sync notice:', firestoreErr);
      }

      // 4. Update state only AFTER successful persistent save
      setVideos((prev) => {
        const filtered = prev.filter((v) => v.id !== finalVideo.id);
        const updated = [finalVideo, ...filtered].sort(sortMediaNewestFirst);
        try {
          localStorage.setItem('zuzika_videos_v4', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 5. Navigate to videos tab so user sees the new video immediately
      setCurrentTab('videos');

      // 6. User notification
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          type: 'comment',
          title: 'ভিডিও রিল পাবলিশ হয়েছে! (Video Reel Published)',
          message: cloudSynced
            ? `Slot #${finalVideo.slotNumber} "${finalVideo.title}" ক্লাউড ডাটাবেজ ও পারসিস্টেন্ট স্টোরেজে যুক্ত হয়েছে।`
            : `Slot #${finalVideo.slotNumber} "${finalVideo.title}" ডিভাইসের পারসিস্টেন্ট স্টোরেজে (IndexedDB) সফলভাবে সেভ হয়েছে।`,
          time: 'Just now',
        },
        ...prev,
      ]);
      return true;
    } catch (err: any) {
      console.error('Failed to save video persistently:', err);
      throw new Error(err?.message || 'ভিডিওটি পারসিস্টেন্ট স্টোরেজে সেভ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  const handleAddBatchMedia = async (
    items: Array<{
      type: 'photo' | 'video';
      photo?: PhotoItem;
      video?: VideoItem;
      blob?: Blob;
    }>,
    onProgress?: (completed: number, total: number, message: string) => void
  ): Promise<{ succeeded: number; failed: number }> => {
    let succeeded = 0;
    let failed = 0;
    const newPhotosToAdd: PhotoItem[] = [];
    const newVideosToAdd: Array<{ video: VideoItem; blob?: Blob }> = [];

    const firestoreSyncQueue: Array<() => Promise<void>> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const slotNum = item.type === 'photo' ? item.photo?.slotNumber : item.video?.slotNumber;
      const title = item.type === 'photo' ? item.photo?.title : item.video?.title;
      const stepMsg = item.type === 'photo'
        ? `ফটো স্লট #${slotNum} ("${title}") সংরক্ষণ হচ্ছে...`
        : `ভিডিও স্লট #${slotNum} ("${title}") সংরক্ষণ হচ্ছে...`;
      
      onProgress?.(i, items.length, stepMsg);

      try {
        if (item.type === 'photo' && item.photo) {
          const p = item.photo;
          await savePersistentPhoto(p);
          fetch('/api/save-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          }).catch(() => {});
          firestoreSyncQueue.push(() => setDoc(doc(db, 'photos', p.id), cleanFirestoreDoc(p)));
          newPhotosToAdd.push(p);
          succeeded++;
        } else if (item.type === 'video' && item.video) {
          const videoBlob = item.blob || (item as any).file;
          await savePersistentVideo(item.video, videoBlob);
          if (videoBlob) {
            await saveLocalVideoBlob(item.video.id, videoBlob).catch(() => {});
          }
          const rawUrl = (item.video.videoUrl || '').trim();
          const hasPublicUrl = Boolean(rawUrl && (rawUrl.startsWith('/') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')));
          const finalBatchVideo: VideoItem = {
            ...item.video,
            isLocalIndexedDB: hasPublicUrl ? false : Boolean(videoBlob || item.video.isLocalIndexedDB),
          };
          const firestoreMeta = { ...finalBatchVideo };
          if (firestoreMeta.videoUrl === 'local-blob') {
            firestoreMeta.videoUrl = 'local-indexeddb';
          }
          fetch('/api/save-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalBatchVideo),
          }).catch(() => {});
          const vidId = finalBatchVideo.id;
          firestoreSyncQueue.push(() => setDoc(doc(db, 'videos', vidId), cleanFirestoreDoc(firestoreMeta)));
          newVideosToAdd.push({ video: finalBatchVideo, blob: videoBlob });
          succeeded++;
        }
      } catch (err) {
        console.error('Error saving batch item:', err);
        failed++;
      }
    }

    onProgress?.(items.length, items.length, 'ক্লাউড ডাটাবেজে সিঙ্ক সম্পন্ন হচ্ছে...');

    // Sync to Firestore in controlled chunks of 5 so large batch uploads don't drop items
    for (let i = 0; i < firestoreSyncQueue.length; i += 5) {
      const chunk = firestoreSyncQueue.slice(i, i + 5);
      await Promise.allSettled(chunk.map((fn) => fn()));
    }

    if (newPhotosToAdd.length > 0) {
      setPhotos((prev) => {
        const incomingIds = new Set(newPhotosToAdd.map((p) => p.id));
        const filtered = prev.filter((p) => !incomingIds.has(p.id));
        const updated = [...newPhotosToAdd, ...filtered];
        updated.sort(sortMediaNewestFirst);
        return updated;
      });
    }

    if (newVideosToAdd.length > 0) {
      setVideos((prev) => {
        const incomingIds = new Set(newVideosToAdd.map((v) => v.video.id));
        const filtered = prev.filter((v) => !incomingIds.has(v.id));
        const updated = [...newVideosToAdd.map((v) => v.video), ...filtered];
        updated.sort(sortMediaNewestFirst);
        return updated;
      });
    }

    if (newPhotosToAdd.length > 0) {
      setCurrentTab('gallery');
      setSelectedCategory('All');
    } else if (newVideosToAdd.length > 0) {
      setCurrentTab('videos');
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        type: 'comment',
        title: 'বাল্ক আপলোড সম্পন্ন! (All Slots Updated)',
        message: `একসাথে ${succeeded}টি স্লটে মিডিয়া সফলভাবে ডিভাইসের পারসিস্টেন্ট স্টোরেজে (IndexedDB) সংরক্ষণ ও পাবলিশ হয়েছে।${failed > 0 ? ` (${failed}টি ব্যর্থ হয়েছে)` : ''}`,
        time: 'Just now',
      },
      ...prev,
    ]);

    return { succeeded, failed };
  };

  const syncDeletedMetaToFirestore = () => {
    setDoc(
      doc(db, 'settings', 'syncMeta'),
      cleanFirestoreDoc({
        deletedPhotoIds: Array.from(deletedPhotoIdsRef.current).slice(-500),
        deletedVideoIds: Array.from(deletedVideoIdsRef.current).slice(-500),
        updatedAt: Date.now(),
      })
    ).catch((err) => console.warn('syncMeta write notice:', err));
  };

  const handleDeletePhoto = (photoId: string) => {
    deletedPhotoIdsRef.current.add(photoId);
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== photoId);
      try {
        localStorage.setItem('zuzika_photos_v4', JSON.stringify(next));
      } catch {}
      return next;
    });
    deletePersistentPhoto(photoId).catch(() => {});
    deleteDoc(doc(db, 'photos', photoId)).catch(() => {});
    fetch(`/api/photo/${encodeURIComponent(photoId)}`, { method: 'DELETE' }).catch(() => {});
    syncDeletedMetaToFirestore();
  };

  const handleDeleteMultiplePhotos = async (photoIds: string[]) => {
    if (!photoIds || photoIds.length === 0) return;
    const idSet = new Set(photoIds);
    photoIds.forEach((id) => deletedPhotoIdsRef.current.add(id));
    setPhotos((prev) => {
      const next = prev.filter((p) => !idSet.has(p.id));
      try {
        localStorage.setItem('zuzika_photos_v4', JSON.stringify(next));
      } catch {}
      return next;
    });
    for (let i = 0; i < photoIds.length; i += 10) {
      const chunk = photoIds.slice(i, i + 10);
      await Promise.allSettled(
        chunk.flatMap((id) => [
          deletePersistentPhoto(id),
          deleteDoc(doc(db, 'photos', id)),
          fetch(`/api/photo/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        ])
      );
    }
    syncDeletedMetaToFirestore();
  };

  const handleEditPhoto = (updatedPhoto: PhotoItem) => {
    setPhotos((prev) => prev.map((p) => (p.id === updatedPhoto.id ? updatedPhoto : p)));
    savePersistentPhoto(updatedPhoto).catch(() => {});
    fetch('/api/save-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPhoto),
    }).catch(() => {});
    setDoc(doc(db, 'photos', updatedPhoto.id), cleanFirestoreDoc(updatedPhoto)).catch(() => {});
    if (selectedPhoto && selectedPhoto.id === updatedPhoto.id) {
      setSelectedPhoto(updatedPhoto);
    }
  };

  const handleDeleteVideo = (videoId: string) => {
    deletedVideoIdsRef.current.add(videoId);
    setVideos((prev) => {
      const next = prev.filter((v) => v.id !== videoId);
      try {
        localStorage.setItem('zuzika_videos_v4', JSON.stringify(next));
      } catch {}
      return next;
    });
    deletePersistentVideo(videoId).catch(() => {});
    deleteDoc(doc(db, 'videos', videoId)).catch(() => {});
    deleteVideoChunksFromFirestore(videoId).catch(() => {});
    deleteLocalVideoBlob(videoId);
    fetch(`/api/video/${encodeURIComponent(videoId)}`, { method: 'DELETE' }).catch(() => {});
    syncDeletedMetaToFirestore();
  };

  const handleDeleteMultipleVideos = async (videoIds: string[]) => {
    if (!videoIds || videoIds.length === 0) return;
    const idSet = new Set(videoIds);
    videoIds.forEach((id) => deletedVideoIdsRef.current.add(id));
    setVideos((prev) => {
      const next = prev.filter((v) => !idSet.has(v.id));
      try {
        localStorage.setItem('zuzika_videos_v4', JSON.stringify(next));
      } catch {}
      return next;
    });
    for (let i = 0; i < videoIds.length; i += 10) {
      const chunk = videoIds.slice(i, i + 10);
      await Promise.allSettled(
        chunk.flatMap((id) => [
          deletePersistentVideo(id),
          deleteDoc(doc(db, 'videos', id)),
          deleteVideoChunksFromFirestore(id),
          Promise.resolve(deleteLocalVideoBlob(id)),
          fetch(`/api/video/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        ])
      );
    }
    syncDeletedMetaToFirestore();
  };

  const handleEditVideo = (updatedVideo: VideoItem) => {
    setVideos((prev) => {
      const next = prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v));
      try {
        localStorage.setItem('zuzika_videos_v4', JSON.stringify(next));
      } catch {}
      return next;
    });
    savePersistentVideo(updatedVideo).catch(() => {});
    fetch('/api/save-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedVideo),
    }).catch(() => {});
    setDoc(doc(db, 'videos', updatedVideo.id), cleanFirestoreDoc(updatedVideo)).catch(() => {});
    if (selectedVideo && selectedVideo.id === updatedVideo.id) {
      setSelectedVideo(updatedVideo);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    deleteDoc(doc(db, 'comments', commentId)).catch(() => {});
  };

  const handleAdminReplyComment = (commentId: string, replyText: string) => {
    const adminReply = {
      id: `rep-${Date.now()}`,
      authorName: 'SUZIKA Admin',
      content: replyText,
      timestamp: 'Just now',
    };
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const updatedReplies = [...(c.replies || []), adminReply];
          updateDoc(doc(db, 'comments', commentId), { replies: updatedReplies }).catch(() => {});
          return { ...c, replies: updatedReplies };
        }
        return c;
      })
    );
  };

  const handleAdminReplyUserMessage = (messageId: string, replyText: string) => {
    const replyData = {
      adminName: 'SUZIKA Admin Desk',
      text: replyText,
      timestamp: 'Just now',
    };
    setAdminMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'replied', reply: replyData } : m))
    );
    updateDoc(doc(db, 'adminMessages', messageId), {
      status: 'replied',
      reply: replyData,
    }).catch(() => {});

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        type: 'admin',
        title: 'New Admin Reply Dispatched',
        message: replyText,
        time: 'Just now',
      },
      ...prev,
    ]);
  };

  const handleUpdateBannerConfig = (newConfig: AppBannerConfig) => {
    const cleanedConfig = cleanFirestoreDoc(newConfig);
    setBannerConfig(newConfig);
    setDoc(doc(db, 'settings', 'bannerConfig'), cleanedConfig).catch((err) => {
      console.warn('Firestore bannerConfig save notice:', err);
    });
    fetch('/api/save-banner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanedConfig),
    }).catch((err) => console.warn('Server save-banner notice:', err));
  };

  // Private VIP Gallery & Coin Recharge Handlers
  const handleAddPrivateVideo = async (video: PrivateVideoItem) => {
    setPrivateVideos((prev) => {
      const filtered = prev.filter((v) => v.id !== video.id);
      const updated = [video, ...filtered];
      updated.sort(sortMediaNewestFirst);
      return updated;
    });
    await setDoc(doc(db, 'privateVideos', video.id), cleanFirestoreDoc(video)).catch((err) => {
      console.warn('Private video Firestore write error:', err);
    });
  };

  const handleDeletePrivateVideo = (videoId: string) => {
    setPrivateVideos((prev) => prev.filter((v) => v.id !== videoId));
    deleteDoc(doc(db, 'privateVideos', videoId)).catch(() => {});
    deleteVideoChunksFromFirestore(videoId).catch(() => {});
    deleteLocalVideoBlob(videoId);
    if (selectedPrivateVideo?.id === videoId) {
      setSelectedPrivateVideo(null);
    }
  };

  const handleSubmitRechargeRequest = async (payload: {
    name: string;
    phone: string;
    method: 'bkash' | 'nagad' | 'rocket';
    pkg: CoinPackage;
    trxId: string;
    targetNumber: string;
  }) => {
    const cleanPhone = payload.phone.trim();
    const userId = `user-${cleanPhone.replace(/[^0-9]/g, '') || Date.now()}`;

    if (!userProfile.isLoggedIn || !userProfile.phone) {
      handleUserLogin(payload.name, cleanPhone);
    }

    const reqDoc: CoinRechargeRequest = {
      id: `req-${Date.now()}`,
      userId,
      userName: payload.name,
      userPhone: cleanPhone,
      method: payload.method,
      packageId: payload.pkg.id,
      coins: payload.pkg.coins,
      amountBdt: payload.pkg.priceBdt,
      trxId: payload.trxId,
      targetNumber: payload.targetNumber,
      status: 'pending',
      createdAt: new Date().toLocaleString(),
      createdAtMs: Date.now(),
    };

    setCoinRechargeRequests((prev) => [reqDoc, ...prev]);
    await setDoc(doc(db, 'coinRechargeRequests', reqDoc.id), cleanFirestoreDoc(reqDoc));

    setNotifications((prev) => [
      {
        id: `notif-req-${Date.now()}`,
        type: 'admin',
        title: 'কয়েন রিচার্জ রিকোয়েস্ট জমা হয়েছে',
        message: `${payload.pkg.coins} Coins (৳${payload.pkg.priceBdt} - ${payload.method.toUpperCase()}) রিচার্জ রিকোয়েস্ট অ্যাডমিনের কাছে পাঠানো হয়েছে।`,
        time: 'Just now',
      },
      ...prev,
    ]);
  };

  const handleApproveRechargeRequest = async (req: CoinRechargeRequest) => {
    if (req.status !== 'pending') return;
    const processedAtMs = Date.now();

    setCoinRechargeRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: 'approved', processedAtMs } : r))
    );
    await setDoc(
      doc(db, 'coinRechargeRequests', req.id),
      cleanFirestoreDoc({ ...req, status: 'approved', processedAtMs }),
      { merge: true }
    ).catch(() => {});

    const existingUser = registeredUsers.find((u) => u.id === req.userId || u.phone === req.userPhone);
    const targetUserId = existingUser?.id || req.userId;
    const nextCoins = (existingUser?.coins || 0) + req.coins;

    const updatedUserAcc: UserAccount = {
      id: targetUserId,
      name: existingUser?.name || req.userName,
      phone: existingUser?.phone || req.userPhone,
      avatarUrl: existingUser?.avatarUrl || '',
      avatarText: existingUser?.avatarText || (req.userName?.charAt(0).toUpperCase() || 'U'),
      joinedDate: existingUser?.joinedDate || 'Recent',
      createdAtMs: existingUser?.createdAtMs || Date.now(),
      likedPhotoIds: existingUser?.likedPhotoIds || [],
      likedVideoIds: existingUser?.likedVideoIds || [],
      coins: nextCoins,
      unlockedPrivateVideoIds: existingUser?.unlockedPrivateVideoIds || [],
    };

    setRegisteredUsers((prev) => {
      const others = prev.filter((u) => u.id !== targetUserId && u.phone !== req.userPhone);
      return [updatedUserAcc, ...others];
    });

    await setDoc(doc(db, 'registeredUsers', targetUserId), cleanFirestoreDoc(updatedUserAcc), { merge: true }).catch(() => {});

    if (userProfile.phone && (userProfile.phone === req.userPhone || targetUserId === `user-${userProfile.phone.replace(/[^0-9]/g, '')}`)) {
      setUserProfile((p) => ({ ...p, coins: nextCoins }));
    }
  };

  const handleRejectRechargeRequest = async (req: CoinRechargeRequest) => {
    if (req.status !== 'pending') return;
    const processedAtMs = Date.now();
    setCoinRechargeRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: 'rejected', processedAtMs } : r))
    );
    await setDoc(
      doc(db, 'coinRechargeRequests', req.id),
      cleanFirestoreDoc({ ...req, status: 'rejected', processedAtMs }),
      { merge: true }
    ).catch(() => {});
  };

  const handleGiftUserCoins = (userId: string, coinsDelta: number) => {
    const targetUser = registeredUsers.find((u) => u.id === userId);
    if (!targetUser) return;
    const nextCoins = Math.max(0, (targetUser.coins || 0) + coinsDelta);

    setRegisteredUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, coins: nextCoins } : u))
    );
    setDoc(
      doc(db, 'registeredUsers', userId),
      cleanFirestoreDoc({ ...targetUser, coins: nextCoins }),
      { merge: true }
    ).catch(() => {});

    if (userProfile.phone && targetUser.phone === userProfile.phone) {
      setUserProfile((p) => ({ ...p, coins: nextCoins }));
    }
  };

  const handleUnlockPrivateVideoWithCoins = async (video: PrivateVideoItem): Promise<boolean> => {
    const currentCoins = userProfile.coins || 0;
    const alreadyUnlocked = (userProfile.unlockedPrivateVideoIds || []).includes(video.id);
    if (alreadyUnlocked) return true;

    if (!userProfile.isLoggedIn || !userProfile.phone) {
      setIsCoinRechargeOpen(true);
      return false;
    }

    if (currentCoins < video.coinPrice) {
      return false;
    }

    const nextCoins = currentCoins - video.coinPrice;
    const nextUnlocked = Array.from(new Set([...(userProfile.unlockedPrivateVideoIds || []), video.id]));

    setUserProfile((prev) => ({
      ...prev,
      coins: nextCoins,
      unlockedPrivateVideoIds: nextUnlocked,
    }));

    const cleanPhoneDigits = userProfile.phone.replace(/[^0-9]/g, '');
    const userId = `user-${cleanPhoneDigits || Date.now()}`;
    const existingUser = registeredUsers.find((u) => u.id === userId || u.phone === userProfile.phone);

    setRegisteredUsers((prev) =>
      prev.map((u) =>
        u.id === userId || u.phone === userProfile.phone
          ? { ...u, coins: nextCoins, unlockedPrivateVideoIds: nextUnlocked }
          : u
      )
    );

    await setDoc(
      doc(db, 'registeredUsers', existingUser?.id || userId),
      cleanFirestoreDoc({
        ...(existingUser || {
          id: userId,
          name: userProfile.name,
          phone: userProfile.phone,
          avatarUrl: userProfile.avatarUrl || '',
          avatarText: userProfile.avatarText || 'U',
          joinedDate: 'Recent',
          createdAtMs: Date.now(),
        }),
        coins: nextCoins,
        unlockedPrivateVideoIds: nextUnlocked,
      }),
      { merge: true }
    ).catch(() => {});

    setNotifications((prev) => [
      {
        id: `notif-unlock-${Date.now()}`,
        type: 'like',
        title: 'প্রাইভেট ভিডিও আনলক হয়েছে! 🔓',
        message: `"${video.title}" আনলক করতে ${video.coinPrice} Coins ব্যবহার হয়েছে। বাকি ব্যালেন্স: ${nextCoins} Coins।`,
        time: 'Just now',
      },
      ...prev,
    ]);

    return true;
  };

  const handleExportData = () => {
    const backupData = {
      photos,
      videos,
      comments,
      adminMessages,
      bannerConfig,
      userProfile,
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zuzika_call_pic_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (jsonString: string) => {
    const data = JSON.parse(jsonString);
    if (data.photos && Array.isArray(data.photos)) {
      setPhotos(data.photos);
      data.photos.forEach((p: PhotoItem) => setDoc(doc(db, 'photos', p.id), cleanFirestoreDoc(p)).catch(() => {}));
    }
    if (data.videos && Array.isArray(data.videos)) {
      setVideos(data.videos);
      data.videos.forEach((v: VideoItem) => setDoc(doc(db, 'videos', v.id), cleanFirestoreDoc(v)).catch(() => {}));
    }
    if (data.comments && Array.isArray(data.comments)) {
      setComments(data.comments);
      data.comments.forEach((c: CommunityComment) => setDoc(doc(db, 'comments', c.id), cleanFirestoreDoc(c)).catch(() => {}));
    }
    if (data.adminMessages && Array.isArray(data.adminMessages)) {
      setAdminMessages(data.adminMessages);
      data.adminMessages.forEach((m: AdminMessage) => setDoc(doc(db, 'adminMessages', m.id), cleanFirestoreDoc(m)).catch(() => {}));
    }
    if (data.bannerConfig) {
      handleUpdateBannerConfig(data.bannerConfig);
    }
    if (data.userProfile) setUserProfile(data.userProfile);
  };

  const handleResetData = () => {
    purgeAllLegacyMediaCaches();
    localStorage.removeItem('zuzika_photos_v4');
    localStorage.removeItem('zuzika_videos_v4');
    localStorage.removeItem('zuzika_comments_v1');
    localStorage.removeItem('zuzika_messages_v1');
    localStorage.removeItem('zuzika_profile_v1');
    localStorage.removeItem('zuzika_banner_config_v1');
    localStorage.removeItem('zuzika_registered_users_v1');
    setPhotos(INITIAL_PHOTOS);
    setVideos(INITIAL_VIDEOS);
    setComments(INITIAL_COMMENTS);
    setAdminMessages(INITIAL_MESSAGES);
    setUserProfile(INITIAL_PROFILE);
    setRegisteredUsers([]);
    setBannerConfig(DEFAULT_BANNER_CONFIG);
  };

  // Upload permission check
  const [restrictedNotice, setRestrictedNotice] = useState<string | null>(null);

  const handleOpenUpload = () => {
    const isPublicAllowed = bannerConfig.allowPublicUploads !== false;
    const isAdminAuth = typeof window !== 'undefined' && sessionStorage.getItem('zuzika_admin_auth') === 'true';

    if (!isPublicAllowed && !isAdminAuth) {
      setRestrictedNotice('পাবলিক আপলোড বর্তমানে বন্ধ রাখা হয়েছে। শুধুমাত্র অ্যাডমিন ছবি/ভিডিও আপলোড করতে পারবেন।');
      setTimeout(() => setRestrictedNotice(null), 6000);
      return;
    }
    setIsUploadOpen(true);
  };

  const getThemeWrapperClass = () => {
    if (!isAdminLoggedIn || currentTab !== 'admin') {
      return 'bg-[#080a12] text-[#f7f7fb] selection:bg-[#ff35bb]/30';
    }
    switch (adminThemeColor) {
      case 'gold':
        return 'bg-gradient-to-b from-[#180e02] via-[#0d0914] to-[#1a0808] text-[#fff9eb] selection:bg-[#ffd700]/40';
      case 'ruby':
        return 'bg-gradient-to-b from-[#24030d] via-[#100714] to-[#1c0512] text-[#ffebee] selection:bg-[#e63946]/40';
      case 'emerald':
        return 'bg-gradient-to-b from-[#031c12] via-[#071318] to-[#04121a] text-[#e8f5e9] selection:bg-[#2a9d8f]/40';
      case 'cyber':
        return 'bg-gradient-to-b from-[#16062b] via-[#0d0f24] to-[#051c24] text-[#f7f7fb] selection:bg-[#8338ec]/40';
    }
  };

  const getShellClass = () => {
    if (!isAdminLoggedIn || currentTab !== 'admin') {
      return viewMode === 'mobile'
        ? 'w-full sm:max-w-[480px] bg-[#090c16] sm:my-3 sm:rounded-[28px] sm:border sm:border-[#252a3d] sm:shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        : 'w-full max-w-6xl sm:px-6';
    }
    const borderGlow =
      adminThemeColor === 'gold'
        ? 'sm:border-[#ffd700]/60 sm:shadow-[0_0_50px_rgba(255,215,0,0.25)]'
        : adminThemeColor === 'ruby'
        ? 'sm:border-[#e63946]/60 sm:shadow-[0_0_50px_rgba(230,57,70,0.25)]'
        : adminThemeColor === 'emerald'
        ? 'sm:border-[#2a9d8f]/60 sm:shadow-[0_0_50px_rgba(42,157,143,0.25)]'
        : 'sm:border-[#8338ec]/60 sm:shadow-[0_0_50px_rgba(131,56,236,0.25)]';

    return viewMode === 'mobile'
      ? `w-full sm:max-w-[480px] bg-[#0c0803] sm:my-3 sm:rounded-[28px] sm:border ${borderGlow}`
      : 'w-full max-w-6xl sm:px-6';
  };

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-clip flex flex-col justify-between transition-colors duration-500 ${getThemeWrapperClass()}`}>
      {/* Outer Shell Wrapper (Mobile App Frame or Wide Multi-Column) */}
      <div className={`mx-auto w-full max-w-full min-w-0 transition-all duration-300 min-h-screen flex flex-col ${getShellClass()}`}>
        {/* Sticky Royal Admin Active Bar - ONLY shown when viewing Admin Tab */}
        {isAdminLoggedIn && currentTab === 'admin' && (
          <div className="sticky top-0 z-50 w-full max-w-full bg-gradient-to-r from-[#ffd700] via-[#ff9800] to-[#ff35bb] text-black px-3 py-1.5 text-xs font-black flex flex-wrap items-center justify-between gap-2 shadow-xl shadow-amber-500/25 select-none animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black"></span>
              </span>
              <span className="tracking-wide uppercase text-[11px] font-black flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 fill-black" />
                <span>Suzika Admin Active ({adminThemeColor.toUpperCase()} থিম)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Color Theme Selector for Admin */}
              <div className="flex items-center gap-1 bg-black/25 px-2 py-0.5 rounded-lg border border-black/20">
                <span className="text-[10px] text-black font-bold hidden xs:inline">রং:</span>
                <button
                  type="button"
                  onClick={() => handleSelectAdminTheme('gold')}
                  title="Royal Gold Theme (সোনালী থিম)"
                  className={`w-3.5 h-3.5 rounded-full bg-[#ffd700] border transition-transform ${adminThemeColor === 'gold' ? 'border-black scale-125 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                />
                <button
                  type="button"
                  onClick={() => handleSelectAdminTheme('ruby')}
                  title="Ruby Crimson Theme (রুবি লাল থিম)"
                  className={`w-3.5 h-3.5 rounded-full bg-[#e63946] border transition-transform ${adminThemeColor === 'ruby' ? 'border-black scale-125 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                />
                <button
                  type="button"
                  onClick={() => handleSelectAdminTheme('emerald')}
                  title="Emerald VIP Theme (পান্না সবুজ থিম)"
                  className={`w-3.5 h-3.5 rounded-full bg-[#2a9d8f] border transition-transform ${adminThemeColor === 'emerald' ? 'border-black scale-125 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                />
                <button
                  type="button"
                  onClick={() => handleSelectAdminTheme('cyber')}
                  title="Cyber Neon Theme (বেগুনি নিয়ন থিম)"
                  className={`w-3.5 h-3.5 rounded-full bg-[#8338ec] border transition-transform ${adminThemeColor === 'cyber' ? 'border-black scale-125 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                />
              </div>

              {currentTab !== 'admin' && (
                <button
                  onClick={() => {
                    soundFX.playPop();
                    setCurrentTab('admin');
                  }}
                  className="px-2.5 py-0.5 rounded-md bg-black/20 hover:bg-black/35 text-black text-[11px] font-bold"
                >
                  ড্যাশবোর্ড
                </button>
              )}

              {/* Prominent Exit Button */}
              <button
                onClick={handleExitAdminMode}
                className="px-3 py-1 rounded-lg bg-black text-[#ffd700] hover:bg-black/85 font-black text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all"
                title="অ্যাডমিন কন্ট্রোল থেকে বের হয়ে সাধারণ মোডে ফিরে যান"
              >
                <LogOut className="w-3.5 h-3.5 text-amber-400" />
                <span>বের হন (Exit)</span>
              </button>
            </div>
          </div>
        )}



        {/* Public Upload Restriction Notice */}
        {restrictedNotice && (
          <div className="mx-3 mt-2 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
            <span>{restrictedNotice}</span>
            <button
              onClick={() => setRestrictedNotice(null)}
              className="px-2.5 py-1 rounded-xl bg-amber-500 text-black font-bold shrink-0 hover:bg-amber-400 text-xs"
            >
              ঠিক আছে
            </button>
          </div>
        )}

        {/* Sticky App Header */}
        <Header
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab !== 'admin') {
              setIsAdminLoggedIn(false);
            }
            setCurrentTab(tab);
          }}
          userProfile={userProfile}
          unreadCount={notifications.length}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenUpload={handleOpenUpload}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode(viewMode === 'mobile' ? 'wide' : 'mobile')}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (q && currentTab === 'home') {
              setCurrentTab('gallery');
            }
          }}
          showUpload={isAdminLoggedIn || bannerConfig.allowPublicUploads === true}
          bannerConfig={bannerConfig}
          onOpenLogin={() => setIsGlobalLoginModalOpen(true)}
          onOpenInstallModal={() => handleOneTapInstallOrModal()}
          onOpenAdminPin={() => setIsAdminPinModalOpen(true)}
          isPwaInstalled={isPwaInstalled}
          isPwaPromptReady={isInstallable}
        />

        {/* Main Content View Switcher */}
        <main className="flex-1 min-w-0 w-full max-w-full px-1.5 py-2 sm:p-5 overflow-x-clip">
          {currentTab === 'home' && (
            <HomeView
              photos={photos}
              videos={videos}
              onSelectPhoto={handleSelectPhoto}
              onSelectVideo={handleSelectVideo}
              onNavigateTab={setCurrentTab}
              onOpenUpload={handleOpenUpload}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                setCurrentTab('gallery');
              }}
              bannerConfig={bannerConfig}
              isPwaInstalled={isPwaInstalled}
              isInstallable={isInstallable}
              onInstallAppClick={() => handleOneTapInstallOrModal()}
            />
          )}

          {currentTab === 'gallery' && (
            <GalleryView
              key={`gallery-${unlockRevision}`}
              photos={photos}
              onSelectPhoto={handleSelectPhoto}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onOpenUpload={handleOpenUpload}
              searchQuery={searchQuery}
              showUpload={isAdminLoggedIn || bannerConfig.allowPublicUploads === true}
              bannerConfig={bannerConfig}
              userProfile={userProfile}
              onToggleLike={handleTogglePhotoLike}
              onRequireLogin={() => setIsGlobalLoginModalOpen(true)}
              onRequestUnlockPhoto={(photo) => {
                setRewardedAdTarget({
                  mediaId: photo.id,
                  mediaTitle: photo.title,
                  mediaType: 'photo',
                  purpose: 'unlock',
                  onSuccess: () => {
                    setSelectedPhoto(photo);
                  },
                });
              }}
            />
          )}

          {currentTab === 'videos' && (
            <VideoView
              key={`videos-${unlockRevision}`}
              videos={videos}
              onSelectVideo={handleSelectVideo}
              onOpenUpload={handleOpenUpload}
              searchQuery={searchQuery}
              showUpload={isAdminLoggedIn || bannerConfig.allowPublicUploads === true}
              bannerConfig={bannerConfig}
              isAdmin={false}
              onDeleteVideo={handleDeleteVideo}
              onRequestUnlockVideo={(video) => {
                setRewardedAdTarget({
                  mediaId: video.id,
                  mediaTitle: video.title,
                  mediaType: 'video',
                  purpose: 'unlock',
                  onSuccess: () => {
                    setSelectedVideo(video);
                  },
                });
              }}
              onRequestDownloadVideo={(video, onRewardEarnedCallback) => {
                setPendingDownloadAd({
                  mediaTitle: video.title,
                  mediaType: 'video',
                  onDownload: onRewardEarnedCallback,
                });
              }}
            />
          )}

          {currentTab === 'private' && (
            <PrivateGalleryView
              privateVideos={privateVideos}
              selectedGallery={selectedPrivateGallery}
              onSelectGallery={setSelectedPrivateGallery}
              userProfile={userProfile}
              userRequests={coinRechargeRequests.filter(
                (r) => !userProfile.phone || r.userPhone === userProfile.phone
              )}
              onSelectVideo={(pv) => setSelectedPrivateVideo(pv)}
              onOpenRecharge={() => setIsCoinRechargeOpen(true)}
              isAdmin={isAdminLoggedIn}
              onOpenAdminPrivate={() => {
                setAdminRequestedSection('private');
                setCurrentTab('admin');
              }}
              bannerConfig={bannerConfig}
            />
          )}

          {currentTab === 'comments' && (
            <CommentsView
              comments={comments}
              userProfile={userProfile}
              onAddComment={handleAddCommunityComment}
              onToggleCommentLike={handleToggleCommentLike}
              onAddReply={handleAddReply}
              bannerConfig={bannerConfig}
              onRequireLogin={() => setIsGlobalLoginModalOpen(true)}
            />
          )}

          {currentTab === 'profile' && (
            <ProfileView
              userProfile={userProfile}
              onUpdateProfile={(updated) => setUserProfile((p) => ({ ...p, ...updated }))}
              onUserLogin={handleUserLogin}
              onUserLogout={handleUserLogout}
              adminMessages={adminMessages}
              onSendMessageToAdmin={handleSendMessageToAdmin}
              viewMode={viewMode}
              onToggleViewMode={() => setViewMode(viewMode === 'mobile' ? 'wide' : 'mobile')}
              soundEnabled={soundEnabled}
              onToggleSound={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                soundFX.enabled = next;
              }}
              onResetData={handleResetData}
              photoLikesCount={(userProfile?.likedPhotoIds || []).length}
              videoLikesCount={(userProfile?.likedVideoIds || []).length}
              onNavigateToAdmin={() => setIsAdminPinModalOpen(true)}
              bannerConfig={bannerConfig}
              isAdmin={isAdminLoggedIn}
              isPwaInstalled={isPwaInstalled}
              onOpenInstallModal={() => handleOneTapInstallOrModal()}
            />
          )}

          {currentTab === 'admin' && (
            <AdminDashboardView
              photos={photos}
              videos={videos}
              comments={comments}
              adminMessages={adminMessages}
              registeredUsers={registeredUsers}
              onDeleteRegisteredUser={handleDeleteRegisteredUser}
              bannerConfig={bannerConfig}
              onUpdateBannerConfig={handleUpdateBannerConfig}
              onDeletePhoto={handleDeletePhoto}
              onDeleteMultiplePhotos={handleDeleteMultiplePhotos}
              onEditPhoto={handleEditPhoto}
              onDeleteVideo={handleDeleteVideo}
              onDeleteMultipleVideos={handleDeleteMultipleVideos}
              onEditVideo={handleEditVideo}
              onDeleteComment={handleDeleteComment}
              onAdminReplyComment={handleAdminReplyComment}
              onAdminReplyUserMessage={handleAdminReplyUserMessage}
              onOpenUpload={() => setIsUploadOpen(true)}
              onExportData={handleExportData}
              onImportData={handleImportData}
              onResetData={handleResetData}
              onNavigateTab={(tab) => {
                if (tab !== 'admin') {
                  setIsAdminLoggedIn(false);
                  setAdminRequestedSection(undefined);
                }
                setCurrentTab(tab);
              }}
              onAdminAuthChange={setIsAdminLoggedIn}
              isAdminAuthenticated={isAdminLoggedIn}
              onPreviewApkPopup={() => setIsInstallModalOpen(true)}
              onPreviewTimedAd={() => setIsTimedAdOpen(true)}
              privateVideos={privateVideos}
              coinRechargeRequests={coinRechargeRequests}
              onAddPrivateVideo={handleAddPrivateVideo}
              onDeletePrivateVideo={handleDeletePrivateVideo}
              onApproveRechargeRequest={handleApproveRechargeRequest}
              onRejectRechargeRequest={handleRejectRechargeRequest}
              onGiftUserCoins={handleGiftUserCoins}
              initialSection={adminRequestedSection}
            />
          )}
        </main>

        {/* Web-Only Sticky Compact Ad Slot above Bottom Navigation (Android APK uses native AdMob Banner) */}
        {currentTab !== 'admin' && !isNativeAndroidAdMobAvailable() && (bannerConfig.enableAds || bannerConfig.enableWebAdSense) && (
          <div className="px-1.5 sm:px-3 pb-1">
            <AdBanner slotName="web-footer-compact" format="compact" config={bannerConfig} className="!my-1" />
          </div>
        )}

        {/* Bottom Tab Navigation Bar */}
        <Navigation
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab !== 'admin') {
              setIsAdminLoggedIn(false);
              setAdminRequestedSection(undefined);
            }
            setCurrentTab(tab);
          }}
          photoCount={photos.length}
          videoCount={videos.length}
          privateVideoCount={privateVideos.length}
          commentsCount={comments.length}
          viewMode={viewMode}
          isAdmin={isAdminLoggedIn && currentTab === 'admin'}
        />
      </div>

      {/* Modals & Overlays */}
      <PhotoLightbox
        key={`lightbox-${unlockRevision}-${selectedPhoto?.id || 'none'}`}
        photo={selectedPhoto}
        allPhotos={photos}
        onClose={() => {
          setSelectedPhoto(null);
          trackMediaViewAndMaybeShowInterstitial(bannerConfig);
        }}
        onToggleLike={handleTogglePhotoLike}
        onAddComment={handleAddPhotoComment}
        onSelectPhoto={setSelectedPhoto}
        userProfile={userProfile}
        isAdmin={isAdminLoggedIn && currentTab === 'admin'}
        onUpdatePhoto={handleEditPhoto}
        onDeletePhoto={handleDeletePhoto}
        bannerConfig={bannerConfig}
        onRequireLogin={() => setIsGlobalLoginModalOpen(true)}
        onRequestUnlockPhoto={(photo) => {
          setRewardedAdTarget({
            mediaId: photo.id,
            mediaTitle: photo.title,
            mediaType: 'photo',
            purpose: 'unlock',
          });
        }}
        onRequestDownloadPhoto={(photo, onRewardEarnedCallback) => {
          setPendingDownloadAd({
            mediaTitle: photo.title,
            mediaType: 'photo',
            onDownload: onRewardEarnedCallback,
          });
        }}
      />

      <VideoPlayerModal
        key={`videoplayer-${unlockRevision}-${selectedVideo?.id || 'none'}`}
        video={selectedVideo}
        onClose={() => {
          setSelectedVideo(null);
          trackMediaViewAndMaybeShowInterstitial(bannerConfig);
        }}
        onToggleLike={handleToggleVideoLike}
        bannerConfig={bannerConfig}
        onUpdateVideo={handleEditVideo}
        isAdmin={isAdminLoggedIn && currentTab === 'admin'}
        onDeleteVideo={handleDeleteVideo}
        userProfile={userProfile}
        onRequireLogin={() => setIsGlobalLoginModalOpen(true)}
        onRequestUnlockVideo={(video) => {
          setRewardedAdTarget({
            mediaId: video.id,
            mediaTitle: video.title,
            mediaType: 'video',
            purpose: 'unlock',
            onSuccess: () => {
              setSelectedVideo(video);
            },
          });
        }}
        onRequestDownloadVideo={(video, onRewardEarnedCallback) => {
          setPendingDownloadAd({
            mediaTitle: video.title,
            mediaType: 'video',
            onDownload: onRewardEarnedCallback,
          });
        }}
        onUploadThisVideo={handleAddVideo}
        onOpenUpload={handleOpenUpload}
        totalVideosCount={videos.length}
        nextVideoSlotNumber={videos.reduce((max, v) => Math.max(max, Number(v.slotNumber) || 0), 0) + 1}
      />

      {/* Google AdMob Rewarded Ad Modal */}
      <RewardedAdModal
        isOpen={Boolean(rewardedAdTarget)}
        onClose={() => setRewardedAdTarget(null)}
        mediaId={rewardedAdTarget?.mediaId || ''}
        mediaTitle={rewardedAdTarget?.mediaTitle || ''}
        mediaType={rewardedAdTarget?.mediaType || 'photo'}
        purpose={rewardedAdTarget?.purpose || 'unlock'}
        bannerConfig={bannerConfig}
        onRewardEarned={() => {
          if (rewardedAdTarget?.purpose === 'download') {
            rewardedAdTarget.onSuccess?.();
            setNotifications((prev) => [
              {
                id: `notif-download-${Date.now()}`,
                type: 'like',
                title: rewardedAdTarget?.mediaType === 'video' ? 'ভিডিও ডাউনলোড শুরু হয়েছে! 📥' : 'ছবি ডাউনলোড শুরু হয়েছে! 📥',
                message: `"${rewardedAdTarget?.mediaTitle || 'Media'}" সফলভাবে ফুল কোয়ালিটিতে আপনার ডিভাইসে সেভ করা হয়েছে।`,
                time: 'Just now',
              },
              ...prev,
            ]);
          } else {
            setUnlockRevision((r) => r + 1);
            if (rewardedAdTarget?.onSuccess) {
              rewardedAdTarget.onSuccess();
            }
            setNotifications((prev) => [
              {
                id: `notif-reward-${Date.now()}`,
                type: 'like',
                title: 'কন্টেন্ট সফলভাবে আনলক হয়েছে! 🎉',
                message: `"${rewardedAdTarget?.mediaTitle || 'কন্টেন্ট'}" আনলক করা হয়েছে। এখন আপনি সম্পূর্ণ কন্টেন্ট দেখতে পারেন।`,
                time: 'Just now',
              },
              ...prev,
            ]);
          }
        }}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onAddPhoto={handleAddPhoto}
        onAddVideo={handleAddVideo}
        onAddPrivateVideo={isAdminLoggedIn ? handleAddPrivateVideo : undefined}
        onAddBatchMedia={handleAddBatchMedia}
        onNavigateTab={(tab) => {
          setCurrentTab(tab);
          setIsUploadOpen(false);
        }}
        currentPhotoCount={photos.length}
        currentVideoCount={videos.length}
        nextPhotoSlotNumber={photos.reduce((max, p) => Math.max(max, Number(p.slotNumber) || 0), 0) + 1}
        nextVideoSlotNumber={videos.reduce((max, v) => Math.max(max, Number(v.slotNumber) || 0), 0) + 1}
        nextPrivateSlotNumber={privateVideos.reduce((max, v) => Math.max(max, Number(v.slotNumber) || 0), 0) + 1}
        defaultPrivateCoinPrice={bannerConfig.defaultPrivateVideoCoins || 50}
        userProfile={userProfile}
      />

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onClear={() => setNotifications([])}
      />

      {/* Global Compact Login Pop-up Modal */}
      <LoginModal
        isOpen={isGlobalLoginModalOpen}
        onClose={() => setIsGlobalLoginModalOpen(false)}
        onLogin={(name, phone, avatarUrl) => {
          handleUserLogin(name, phone, avatarUrl);
          setIsGlobalLoginModalOpen(false);
        }}
        initialName={userProfile?.name}
        initialPhone={userProfile?.phone}
        initialAvatarUrl={userProfile?.avatarUrl}
      />

      {/* Mobile App Install / APK Download Modal */}
      <MobileInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => {
          if (currentTab !== 'admin') {
            dismissAndroidApkPopup();
          }
          setIsInstallModalOpen(false);
        }}
        onLater={() => {
          if (currentTab !== 'admin') {
            dismissAndroidApkPopup();
          }
          setIsInstallModalOpen(false);
        }}
        bannerConfig={bannerConfig}
        deferredPrompt={deferredPrompt}
        isPwaInstalled={isPwaInstalled}
        onTriggerPwaInstall={handleTriggerPwaInstall}
      />

      {/* 5-Minute Active Usage Full-Screen Video / Sponsored Ad Modal */}
      <TimedFullscreenAdModal
        isOpen={isTimedAdOpen}
        onClose={() => {
          activeUsageSecondsRef.current = 0;
          setIsTimedAdOpen(false);
        }}
        bannerConfig={bannerConfig}
      />

      {/* Gallery Image Interstitial & Video Play VAST/Interstitial Ad Modal */}
      <AdsterraInterstitialModal
        isOpen={Boolean(pendingInterstitialAd)}
        placement={pendingInterstitialAd?.placement || 'gallery_image'}
        bannerConfig={bannerConfig}
        mediaTitle={pendingInterstitialAd?.mediaTitle}
        onCloseAndProceed={() => {
          const proceed = pendingInterstitialAd?.onProceed;
          setPendingInterstitialAd(null);
          if (proceed) proceed();
        }}
      />

      {/* Immediate Download Full-Screen Video Ad / Social Bar Fallback Modal */}
      <DownloadFullscreenAdModal
        isOpen={Boolean(pendingDownloadAd)}
        mediaTitle={pendingDownloadAd?.mediaTitle || ''}
        mediaType={pendingDownloadAd?.mediaType || 'photo'}
        bannerConfig={bannerConfig}
        onCompleteDownload={() => {
          const currentTarget = pendingDownloadAd;
          setPendingDownloadAd(null);
          if (currentTarget) {
            currentTarget.onDownload();
            setNotifications((prev) => [
              {
                id: `notif-download-${Date.now()}`,
                type: 'like',
                title: currentTarget.mediaType === 'video' ? 'ভিডিও ডাউনলোড শুরু হয়েছে! 📥' : 'ছবি ডাউনলোড শুরু হয়েছে! 📥',
                message: `"${currentTarget.mediaTitle || 'Media'}" সফলভাবে ফুল কোয়ালিটিতে আপনার ডিভাইসে সেভ করা হয়েছে।`,
                time: 'Just now',
              },
              ...prev,
            ]);
          }
        }}
        onCancel={() => setPendingDownloadAd(null)}
      />

      {/* Private VIP 2-Second Preview & Coin Unlock Modal */}
      <PrivateVideoModal
        video={selectedPrivateVideo}
        onClose={() => setSelectedPrivateVideo(null)}
        userCoins={userProfile.coins || 0}
        isUnlocked={Boolean(
          selectedPrivateVideo && (userProfile.unlockedPrivateVideoIds || []).includes(selectedPrivateVideo.id)
        )}
        isAdmin={isAdminLoggedIn}
        onUnlockWithCoins={handleUnlockPrivateVideoWithCoins}
        onOpenRecharge={() => setIsCoinRechargeOpen(true)}
      />

      {/* Coin Recharge Modal (bKash / Nagad / Rocket) */}
      <CoinRechargeModal
        isOpen={isCoinRechargeOpen}
        onClose={() => setIsCoinRechargeOpen(false)}
        bannerConfig={bannerConfig}
        userProfile={userProfile}
        userRequests={coinRechargeRequests.filter(
          (r) => !userProfile.phone || r.userPhone === userProfile.phone
        )}
        onSubmitRechargeRequest={handleSubmitRechargeRequest}
      />

      {/* Admin Passcode Gate Modal */}
      <AdminPinModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        onSuccess={() => {
          setIsAdminPinModalOpen(false);
          setIsAdminLoggedIn(true);
          setCurrentTab('admin');
        }}
        correctPin={bannerConfig.adminPin || '125687'}
      />

      {/* Non-intrusive offline mode banner for installed phone PWA */}
      <OfflineIndicator />
    </div>
  );
}
