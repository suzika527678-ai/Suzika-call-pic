import { PhotoItem, VideoItem, CommunityComment, UserProfile, AdminMessage, AppBannerConfig, ChatMessage, PrivateGalleryName, CoinPackage } from '../types';

export const REAL_ADMOB_CONFIG = {
  appId: 'ca-app-pub-8091473961803972~1084906325',
  bannerUnitId: 'ca-app-pub-8091473961803972/3707200236',
  interstitialUnitId: 'ca-app-pub-8091473961803972/5711593220',
  rewardedUnitId: 'ca-app-pub-8091473961803972/6716506951',
  publisherId: 'pub-8091473961803972',
};

export const TEST_ADMOB_CONFIG = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
  appOpenUnitId: 'ca-app-pub-3940256099942544/9257390723',
  nativeUnitId: 'ca-app-pub-3940256099942544/2247696110',
};

export const DEFAULT_BANNER_CONFIG: AppBannerConfig = {
  heroTagline: 'SUZIKA Daily Stream',
  heroTitle: 'Your daily dose of',
  heroHighlight: 'photos & videos.',
  heroSubtitle: 'Discover the ultimate gallery, inspect HD slots, share community comments, and stay connected with creators.',
  sponsorTitle: 'Sponsored Space',
  sponsorSubtitle: 'SUZIKA Partner Network · Adaptive Banner',
  sponsorBadge: 'AdMob Partner',
  sponsorButtonText: 'Details',
  sponsorInfoBody: 'Configured for real Google Mobile Ads (AdMob) in Android APK and Google AdSense in Web.',
  allowPublicUploads: false,
  adminPin: '125687',
  adDurationSeconds: 30,
  adSkipAfterSeconds: 5,
  mobileAppInstallUrl: '',
  mobileAppVersion: 'v2.4 (Android APK)',
  showInstallPopup: true,
  apkPopupTitle: 'SUZIKA Call Pic',
  apkPopupMessage: 'আপনার Android ফোনে SUZIKA Call Pic অফিশিয়াল অ্যাপ ইনস্টল করুন! দ্রুততম HD ছবি, ফুল-স্ক্রিন ভিডিও রিলস এবং স্মুথ মোবাইল অভিজ্ঞতা উপভোগ করুন।',
  apkPopupCooldownDays: 7,
  photoWatermarkText: '01632067905 ইমু নাম্বার',
  bkashNumber: '',
  nagadNumber: '',
  rocketNumber: '',
  defaultPrivateVideoCoins: 50,
  // Google Real Production AdMob IDs (Android)
  admobAppId: REAL_ADMOB_CONFIG.appId,
  admobBannerUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
  admobInterstitialUnitId: REAL_ADMOB_CONFIG.interstitialUnitId,
  admobRewardedUnitId: REAL_ADMOB_CONFIG.rewardedUnitId,
  admobAppOpenUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
  admobNativeUnitId: REAL_ADMOB_CONFIG.bannerUnitId,
  enableAndroidBanner: true,
  enableAndroidInterstitial: true,
  enableAndroidRewarded: true,
  enableAndroidAppOpen: false,
  enableAndroidNative: true,
  interstitialFrequency: 5,
  isTestMode: false, // Production Real Ads for release

  // Content Lock & Rewarded Ad Rules
  lockOnlineVideosByDefault: true,
  requireAdForPremiumPhotos: true,
  requireAdForDownloads: true,
  lockedCategories: ['Sexy', 'Call', 'Hot'],
  unlockDurationHours: 12, // 12 hours persistent unlock per rewarded ad (drives healthy repeat ad views)
  // Web AdSense & Adsterra Backup Network
  enableWebAdSense: true,
  enableAds: true,
  adsenseClientId: 'ca-pub-8091473961803972',
  adsenseBannerSlot: '3707200236',
  adsenseInfeedSlot: '5711593220',
  webAdScriptUrl: 'https://bicea.org/14/093a72dbe61f55a96cba26f6e5414547',
  adsterraBannerKey: '',
  webVideoAdUrl: '',
  webSmartLinkUrl: '',
  webBannerImageUrl: '',
  webBannerClickUrl: '',
  enableTimedFullscreenAd: true,
  timedAdIntervalMinutes: 5,
  enableGalleryInterstitialAd: true,
  galleryInterstitialTagUrl: '',
  galleryInterstitialFrequency: 3,
  galleryInterstitialCooldownSeconds: 45,
  enableVideoPlayAd: true,
  videoPlayAdTagUrl: '',
  videoPlayAdCooldownSeconds: 0,
  // Legacy fields
  googleAdClient: 'ca-pub-8091473961803972',
  googleAdSlotBanner: '3707200236',
  googleAdSlotInterstitial: '5711593220',
  googleAdSlotRewarded: '6716506951',
  adMode: 'google_adsense',
  customShareUrl: 'https://ais-pre-xxnlcelsjsskkuifh3xj2g-772740332293.asia-northeast1.run.app',
};

export const INITIAL_PROFILE: UserProfile = {
  name: '',
  bio: 'SUZIKA গ্যালারি মেম্বার',
  avatarColor: 'from-[#ff35bb] via-[#8b4dff] to-[#00d2ff]',
  avatarText: 'U',
  joinedDate: 'October 2026',
  likedPhotoIds: [],
  likedVideoIds: [],
  isLoggedIn: false,
  phone: '',
  avatarUrl: '',
  coins: 0,
  unlockedPrivateVideoIds: [],
};

export const PRIVATE_GALLERIES: Array<{
  id: PrivateGalleryName;
  label: string;
  subtitle: string;
  badge: string;
  gradient: string;
}> = [
  {
    id: 'Global Adult',
    label: 'Global Adult',
    subtitle: 'International 18+ VIP Reels',
    badge: '18+ GLOBAL',
    gradient: 'from-[#ff35bb] to-[#8b4dff]',
  },
  {
    id: 'VIP Exclusive',
    label: 'VIP Exclusive',
    subtitle: 'Uncut Private Premium Shows',
    badge: 'VIP',
    gradient: 'from-[#f59e0b] to-[#ef4444]',
  },
  {
    id: 'Midnight Live',
    label: 'Midnight Live',
    subtitle: 'Late Night Call & Cam Clips',
    badge: 'LIVE',
    gradient: 'from-[#8b4dff] to-[#00d2ff]',
  },
  {
    id: 'Desi Hot',
    label: 'Desi Hot',
    subtitle: 'Bangla & Desi Private Collection',
    badge: 'HOT',
    gradient: 'from-[#ec4899] to-[#f43f5e]',
  },
  {
    id: 'Secret Room',
    label: 'Secret Room',
    subtitle: 'Members Only Locked Vault',
    badge: 'SECRET',
    gradient: 'from-[#06b6d4] to-[#6366f1]',
  },
];

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pack-100', coins: 100, priceBdt: 50, bonusLabel: 'Starter Pack' },
  { id: 'pack-250', coins: 250, priceBdt: 100, bonusLabel: '+50 Bonus Coins', popular: true },
  { id: 'pack-600', coins: 600, priceBdt: 200, bonusLabel: 'Best Value (+200)' },
  { id: 'pack-1500', coins: 1500, priceBdt: 500, bonusLabel: 'VIP Mega Pack' },
];

// Initial Photos: Empty by default so only user-uploaded photos are displayed
export const INITIAL_PHOTOS: PhotoItem[] = [];

// Initial Videos: Empty by default so only user-uploaded videos are displayed
export const INITIAL_VIDEOS: VideoItem[] = [];

export const INITIAL_COMMENTS: CommunityComment[] = [
  {
    id: 'comm-1',
    authorName: 'Rhea Chakraborty',
    authorAvatarText: 'R',
    avatarColor: 'from-pink-500 to-rose-600',
    content: 'Love this app interface! The picture quality and colors match the mood so well ✨ Keep updating the gallery!',
    timestamp: '15 mins ago',
    likes: 24,
    category: 'General',
    replies: [
      {
        id: 'rep-1',
        authorName: 'SUZIKA Admin',
        content: 'Thank you Rhea! We are uploading new slots daily.',
        timestamp: '10 mins ago'
      }
    ]
  },
  {
    id: 'comm-2',
    authorName: 'Tariqul Islam',
    authorAvatarText: 'T',
    avatarColor: 'from-purple-500 to-indigo-600',
    content: 'The video reel player is super smooth. Can you add more night photography from Bangladesh and Tokyo?',
    timestamp: '1 hour ago',
    likes: 18,
    category: 'Photo'
  },
  {
    id: 'comm-3',
    authorName: 'Samiul Hasan',
    authorAvatarText: 'S',
    avatarColor: 'from-cyan-500 to-blue-600',
    content: 'Awesome gallery slots! 500 photo slots gives huge space for full albums. Loving the call pic layout.',
    timestamp: '3 hours ago',
    likes: 31,
    category: 'VIP'
  },
  {
    id: 'comm-4',
    authorName: 'Priya Sharma',
    authorAvatarText: 'P',
    avatarColor: 'from-amber-500 to-orange-600',
    content: 'I saved three wallpapers directly to my device. The neon portraits are next level.',
    timestamp: '5 hours ago',
    likes: 14,
    category: 'Photo'
  }
];

export const INITIAL_MESSAGES: AdminMessage[] = [
  {
    id: 'msg-welcome',
    senderName: 'SUZIKA Admin',
    category: 'General',
    message: 'Welcome to SUZIKA Call Pic! You can message us anytime with requests for new photo slots, video clips, or feedback.',
    timestamp: 'System',
    status: 'replied',
    reply: {
      adminName: 'Chief Curator',
      text: 'Our inbox is monitored daily. Have fun exploring the galleries!',
      timestamp: 'Active'
    }
  }
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'chat-init-1',
    userId: '@visitor_7721',
    userName: 'Tanvir',
    userAvatarText: 'T',
    photoId: 'photo-user-1',
    photoTitle: 'Gallery Photo',
    photoUrl: '',
    text: 'Hi Suzika! Your new photo looks stunning 🔥 Are you free to chat?',
    sender: 'user',
    timestamp: '10:45 AM',
    createdAt: Date.now() - 3600000,
    read: true,
  },
  {
    id: 'chat-init-2',
    userId: '@visitor_7721',
    userName: 'Tanvir',
    userAvatarText: 'T',
    photoId: 'photo-user-1',
    photoTitle: 'Gallery Photo',
    photoUrl: '',
    text: 'Hello Tanvir! Thank you so much for the love 💕 I am uploading new photos & videos today. Keep watching and chatting!',
    sender: 'admin',
    timestamp: '10:48 AM',
    createdAt: Date.now() - 3400000,
    read: true,
  }
];
