export type TabType = 'home' | 'gallery' | 'videos' | 'private' | 'comments' | 'profile' | 'admin';

export type PrivateGalleryName =
  | 'Global Adult'
  | 'VIP Exclusive'
  | 'Midnight Live'
  | 'Desi Hot'
  | 'Secret Room';

export interface AppBannerConfig {
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroTagline: string;
  sponsorTitle: string;
  sponsorSubtitle: string;
  sponsorBadge: string;
  sponsorButtonText: string;
  sponsorInfoBody: string;
  allowPublicUploads?: boolean;
  adminPin?: string;
  enableAds?: boolean;
  adDurationSeconds?: number;
  adSkipAfterSeconds?: number;
  customShareUrl?: string;
  mobileAppInstallUrl?: string;
  mobileAppVersion?: string;
  showInstallPopup?: boolean;
  apkPopupTitle?: string;
  apkPopupMessage?: string;
  apkPopupCooldownDays?: number;
  photoWatermarkText?: string;

  // Private Gallery Coin & Mobile Banking Settings (bKash / Nagad / Rocket)
  bkashNumber?: string;
  nagadNumber?: string;
  rocketNumber?: string;
  defaultPrivateVideoCoins?: number;
  
  // Real Google AdMob (Android APK) Configuration
  admobAppId?: string; // e.g. ca-app-pub-3940256099942544~3347511713 (Test)
  admobBannerUnitId?: string; // e.g. ca-app-pub-3940256099942544/6300978111 (Adaptive Banner Test)
  admobInterstitialUnitId?: string; // e.g. ca-app-pub-3940256099942544/1033173712 (Interstitial Test)
  admobRewardedUnitId?: string; // e.g. ca-app-pub-3940256099942544/5224354917 (Rewarded Test)
  admobAppOpenUnitId?: string; // e.g. ca-app-pub-3940256099942544/9257390723 (App Open Test)
  admobNativeUnitId?: string; // e.g. ca-app-pub-3940256099942544/2247696110 (Native Advanced Test)
  enableAndroidBanner?: boolean;
  enableAndroidInterstitial?: boolean;
  enableAndroidRewarded?: boolean;
  enableAndroidAppOpen?: boolean;
  enableAndroidNative?: boolean;
  interstitialFrequency?: number; // Show interstitial after every N views (5-10 recommended)
  isTestMode?: boolean; // Clearly distinguish test vs real production ads

  // Content Blur & Lock Rules (Rewarded Ad to Unlock & Download)
  lockOnlineVideosByDefault?: boolean; // When true, all uploaded online videos require ad unlock
  requireAdForPremiumPhotos?: boolean; // When true, selected premium categories require ad unlock
  requireAdForDownloads?: boolean; // When true, HD photo/video downloads require a Rewarded Ad
  lockedCategories?: CategoryType[]; // Categories that require ad to unlock (default: Sexy, Call, Hot)
  unlockDurationHours?: number; // How long reward unlock persists (e.g. 6, 12, 24 hours, 0 for permanent)

  // Web Version (Google AdSense + Adsterra / Direct Partner Web Ad Network) Configuration
  enableWebAdSense?: boolean;
  adsenseClientId?: string; // e.g. ca-pub-XXXXXXXXXXXXXXXX
  adsenseBannerSlot?: string;
  adsenseInfeedSlot?: string;
  webAdScriptUrl?: string; // Optional external HTTPS script URL (e.g. Adsterra Social Bar / Popunder)
  adsterraBannerKey?: string; // Optional Adsterra Banner 320x50 / 300x250 invoke.js zone key
  webVideoAdUrl?: string; // Optional Adsterra VAST XML Tag URL or direct MP4/WebM video ad URL
  webSmartLinkUrl?: string; // Optional Adsterra Direct Link / SmartLink URL
  webBannerImageUrl?: string; // Optional direct sponsor banner image URL for web
  webBannerClickUrl?: string; // Optional direct sponsor banner destination URL
  enableTimedFullscreenAd?: boolean; // Trigger full-screen ad after active usage interval
  timedAdIntervalMinutes?: number; // Default: 5 minutes

  // Placement 1: Gallery Photo Open Full-Screen Interstitial Ad
  enableGalleryInterstitialAd?: boolean;
  galleryInterstitialTagUrl?: string; // Adsterra Interstitial Script URL or HTML Snippet (never Social Bar)
  galleryInterstitialFrequency?: number; // Show after every N photo opens (default: 3)
  galleryInterstitialCooldownSeconds?: number; // Minimum gap in seconds between image ads (default: 45)

  // Placement 2: Video Play VAST / Interstitial Ad
  enableVideoPlayAd?: boolean;
  videoPlayAdTagUrl?: string; // Adsterra VAST Video Ad Tag URL or Interstitial Script/Snippet (never Social Bar)
  videoPlayAdCooldownSeconds?: number; // Minimum gap in seconds between video play ads (default: 0)

  // Legacy mappings for backward compatibility
  googleAdClient?: string;
  googleAdSlotBanner?: string;
  googleAdSlotInterstitial?: string;
  googleAdSlotRewarded?: string;
  googleAdmobAppId?: string;
  adMode?: 'all' | 'google_adsense' | 'sponsors';
}

export type CategoryType = 
  | 'All'
  | 'Sexy'
  | 'Hot'
  | 'Call'
  | 'Glamour'
  | 'Portraits'
  | 'Nature'
  | 'Aesthetic'
  | 'Cinematic'
  | 'Urban'
  | 'Night'
  | 'Style';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatarText?: string;
  photoId?: string;
  photoTitle?: string;
  photoUrl?: string;
  text: string;
  sender: 'user' | 'admin';
  timestamp: string;
  createdAt: number;
  read?: boolean;
}

export interface PhotoComment {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  timestamp: string;
}

export interface PhotoItem {
  id: string;
  title: string;
  category: CategoryType;
  imageUrl: string;
  fallbackGradient: string;
  author: string;
  views: number;
  likes: number;
  isLiked?: boolean;
  isLocked?: boolean;
  tags: string[];
  slotNumber: number;
  resolution?: string;
  comments: PhotoComment[];
  createdAt: string;
  createdAtMs?: number;
}

export interface VideoItem {
  id: string;
  title: string;
  category: CategoryType;
  videoUrl: string;
  thumbnailUrl: string;
  fallbackGradient: string;
  duration: string;
  views: number;
  likes: number;
  isLiked?: boolean;
  isLocked?: boolean;
  isPrivatePhoneVideo?: boolean;
  author: string;
  slotNumber: number;
  tags: string[];
  createdAt: string;
  createdAtMs?: number;
  isLocalIndexedDB?: boolean;
  isCloudChunked?: boolean;
  cloudChunkCount?: number;
  fileSizeBytes?: number;
  videoType?: 'youtube' | 'direct' | 'local';
}

export interface CommunityComment {
  id: string;
  authorName: string;
  authorAvatarText: string;
  avatarColor: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
  category?: 'General' | 'Photo' | 'Video' | 'VIP';
  replies?: {
    id: string;
    authorName: string;
    content: string;
    timestamp: string;
  }[];
}

export interface AdminMessage {
  id: string;
  senderName: string;
  category: 'General' | 'Photo Request' | 'Video Upload' | 'Sponsorship' | 'Bug Report';
  message: string;
  timestamp: string;
  status: 'sent' | 'replied';
  reply?: {
    adminName: string;
    text: string;
    timestamp: string;
  };
}

export interface UserProfile {
  name: string;
  bio: string;
  avatarColor: string;
  avatarText: string;
  joinedDate: string;
  likedPhotoIds: string[];
  likedVideoIds: string[];
  isLoggedIn?: boolean;
  phone?: string;
  avatarUrl?: string;
  coins?: number;
  unlockedPrivateVideoIds?: string[];
}

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string;
  avatarText: string;
  joinedDate: string;
  createdAtMs: number;
  likedPhotoIds?: string[];
  likedVideoIds?: string[];
  coins?: number;
  unlockedPrivateVideoIds?: string[];
}

export interface PrivateVideoItem {
  id: string;
  title: string;
  gallery: PrivateGalleryName;
  galleries?: PrivateGalleryName[];
  videoUrl: string;
  thumbnailUrl: string;
  fallbackGradient: string;
  duration: string;
  coinPrice: number;
  views: number;
  likes: number;
  author: string;
  slotNumber: number;
  createdAt: string;
  createdAtMs?: number;
  isCloudChunked?: boolean;
  cloudChunkCount?: number;
  fileSizeBytes?: number;
  videoType?: 'youtube' | 'direct' | 'local';
}

export interface CoinPackage {
  id: string;
  coins: number;
  priceBdt: number;
  bonusLabel?: string;
  popular?: boolean;
}

export interface CoinRechargeRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  method: 'bkash' | 'nagad' | 'rocket';
  packageId: string;
  coins: number;
  amountBdt: number;
  senderNumber?: string;
  trxId: string;
  targetNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  createdAtMs: number;
  processedAtMs?: number;
}

