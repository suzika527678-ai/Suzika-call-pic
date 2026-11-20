import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

/// Comprehensive Google Mobile Ads (AdMob) Service for SUZIKA Video Player Android APK.
/// 
/// COMPLIANCE WITH USER SPECIFICATIONS & GOOGLE POLICY:
/// 1. Uses official Google Test Ad IDs during development/testing.
/// 2. Banners are anchored at screen edges and NEVER overlap video controls.
/// 3. Interstitial ads are displayed ONLY at natural transitions (e.g. navigation back to home).
/// 4. Rewarded Ads are full-screen and grant content unblur/unlock ONLY after onUserEarnedReward.
/// 5. Private phone gallery videos are NEVER locked or monetized.
/// 6. No fake advertisers, fake countdowns, or fake revenues.
class AdMobService {
  AdMobService._privateConstructor();
  static final AdMobService instance = AdMobService._privateConstructor();

  // ===========================================================================
  // CONFIGURATION: TEST vs PRODUCTION
  // Set isTestMode to false for release production build
  // ===========================================================================
  bool isTestMode = false;

  // ===========================================================================
  // PRODUCTION ADMOB IDs (SUZika Call Pic Production Ad Units)
  // ===========================================================================
  static const String _realAppIdAndroid = 'ca-app-pub-8091473961803972~1084906325';
  static const String _realBannerUnitIdAndroid = 'ca-app-pub-8091473961803972/3707200236';
  static const String _realInterstitialUnitIdAndroid = 'ca-app-pub-8091473961803972/5711593220';
  static const String _realRewardedUnitIdAndroid = 'ca-app-pub-8091473961803972/6716506951';
  static const String _realAppOpenUnitIdAndroid = 'ca-app-pub-8091473961803972/3707200236';
  static const String _realNativeUnitIdAndroid = 'ca-app-pub-8091473961803972/3707200236';

  // ===========================================================================
  // GOOGLE OFFICIAL TEST AD UNIT IDs (Never trigger policy violations)
  // Docs: https://developers.google.com/admob/android/test-ads
  // ===========================================================================
  static const String _testBannerUnitIdAndroid = 'ca-app-pub-3940256099942544/6300978111';
  static const String _testInterstitialUnitIdAndroid = 'ca-app-pub-3940256099942544/1033173712';
  static const String _testRewardedUnitIdAndroid = 'ca-app-pub-3940256099942544/5224354917';
  static const String _testAppOpenUnitIdAndroid = 'ca-app-pub-3940256099942544/9257390723';
  static const String _testNativeUnitIdAndroid = 'ca-app-pub-3940256099942544/2247696110';

  bool _isInitialized = false;

  // Interstitial Ad state
  InterstitialAd? _interstitialAd;
  bool _isInterstitialLoading = false;
  DateTime? _lastInterstitialShownAt;
  static const Duration _interstitialCooldown = Duration(minutes: 3);

  // Rewarded Ad state
  RewardedAd? _rewardedAd;
  bool _isRewardedLoading = false;

  // App Open Ad state
  AppOpenAd? _appOpenAd;
  bool _isAppOpenLoading = false;

  /// 1. Initialize the Google Mobile Ads SDK
  Future<void> initialize({bool enableTestMode = false}) async {
    if (_isInitialized) return;
    isTestMode = enableTestMode;

    try {
      final initStatus = await MobileAds.instance.initialize();
      _isInitialized = true;

      if (kDebugMode) {
        debugPrint('[AdMob] Google Mobile Ads SDK Initialized.');
        initStatus.adapterStatuses.forEach((key, status) {
          debugPrint('[AdMob] Adapter: $key -> ${status.state.name}');
        });
      }

      // Preload ads for smooth user experience
      loadInterstitialAd();
      loadRewardedAd();
      loadAppOpenAd();
    } catch (e) {
      debugPrint('[AdMob] Error initializing Google Mobile Ads SDK: $e');
    }
  }

  // --- Ad Unit ID Getters ---
  String get bannerAdUnitId {
    if (isTestMode || !Platform.isAndroid) return _testBannerUnitIdAndroid;
    return _realBannerUnitIdAndroid.contains('XXXXX') ? _testBannerUnitIdAndroid : _realBannerUnitIdAndroid;
  }

  String get interstitialAdUnitId {
    if (isTestMode || !Platform.isAndroid) return _testInterstitialUnitIdAndroid;
    return _realInterstitialUnitIdAndroid.contains('XXXXX') ? _testInterstitialUnitIdAndroid : _realInterstitialUnitIdAndroid;
  }

  String get rewardedAdUnitId {
    if (isTestMode || !Platform.isAndroid) return _testRewardedUnitIdAndroid;
    return _realRewardedUnitIdAndroid.contains('XXXXX') ? _testRewardedUnitIdAndroid : _realRewardedUnitIdAndroid;
  }

  String get appOpenAdUnitId {
    if (isTestMode || !Platform.isAndroid) return _testAppOpenUnitIdAndroid;
    return _realAppOpenUnitIdAndroid.contains('XXXXX') ? _testAppOpenUnitIdAndroid : _realAppOpenUnitIdAndroid;
  }

  String get nativeAdUnitId {
    if (isTestMode || !Platform.isAndroid) return _testNativeUnitIdAndroid;
    return _realNativeUnitIdAndroid.contains('XXXXX') ? _testNativeUnitIdAndroid : _realNativeUnitIdAndroid;
  }

  // ===========================================================================
  // REWARDED ADS (Unlock Blurred Photos & Videos)
  // ===========================================================================
  void loadRewardedAd({VoidCallback? onLoaded, Function(LoadAdError)? onFailed}) {
    if (_isRewardedLoading || _rewardedAd != null) return;
    _isRewardedLoading = true;

    RewardedAd.load(
      adUnitId: rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewardedAd = ad;
          _isRewardedLoading = false;
          debugPrint('[AdMob] Rewarded Ad loaded successfully.');
          onLoaded?.call();

          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              _rewardedAd = null;
              loadRewardedAd();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              debugPrint('[AdMob] Failed to show Rewarded Ad: $error');
              ad.dispose();
              _rewardedAd = null;
              loadRewardedAd();
            },
          );
        },
        onAdFailedToLoad: (LoadAdError error) {
          debugPrint('[AdMob] Rewarded Ad failed to load: $error');
          _isRewardedLoading = false;
          _rewardedAd = null;
          onFailed?.call(error);
        },
      ),
    );
  }

  /// Show Rewarded Ad and invoke callback ONLY when reward is earned
  /// RULE 5: Never unlock content just because an ad was opened or skipped!
  void showRewardedAd({
    required Function(RewardItem reward) onUserEarnedReward,
    VoidCallback? onAdUnavailable,
  }) {
    if (_rewardedAd != null) {
      _rewardedAd!.show(
        onUserEarnedReward: (AdWithoutView ad, RewardItem reward) {
          debugPrint('[AdMob] User earned reward: ${reward.amount} ${reward.type}');
          onUserEarnedReward(reward);
        },
      );
    } else {
      debugPrint('[AdMob] Rewarded Ad not ready. Loading for next time.');
      onAdUnavailable?.call();
      loadRewardedAd();
    }
  }

  /// Real AdMob Rewarded Ad for photo download (User Request Specifications)
  /// 1. Triggered after user agrees: "Watch a short ad to download this photo?"
  /// 2. Executes onRewardEarnedDownload ONLY after full ad completion.
  /// 3. Prevents duplicate downloads and duplicate reward triggers.
  /// 4. Handles onAdUnavailable with exact message: "Ad is not available right now. Please try again later."
  bool _isDownloadAdInProgress = false;

  void showRewardedAdForPhotoDownload({
    required String photoId,
    required VoidCallback onRewardEarnedDownload,
    required Function(String errorMessage) onAdUnavailableOrFailed,
    VoidCallback? onAdDismissedEarly,
  }) {
    if (_isDownloadAdInProgress) {
      debugPrint('[AdMob] Download ad already in progress. Preventing duplicate request.');
      return;
    }

    if (_rewardedAd == null) {
      debugPrint('[AdMob] Rewarded Ad not available for download.');
      onAdUnavailableOrFailed('Ad is not available right now. Please try again later.');
      loadRewardedAd();
      return;
    }

    _isDownloadAdInProgress = true;
    bool rewardGranted = false;

    _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _rewardedAd = null;
        _isDownloadAdInProgress = false;
        loadRewardedAd();

        if (!rewardGranted) {
          debugPrint('[AdMob] User closed ad early or skipped. NO reward granted for download.');
          onAdDismissedEarly?.call();
        }
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        debugPrint('[AdMob] Failed to show Rewarded Ad: $error');
        ad.dispose();
        _rewardedAd = null;
        _isDownloadAdInProgress = false;
        loadRewardedAd();
        onAdUnavailableOrFailed('Ad is not available right now. Please try again later.');
      },
    );

    _rewardedAd!.show(
      onUserEarnedReward: (AdWithoutView ad, RewardItem reward) {
        if (rewardGranted) return; // Prevent duplicate callback
        rewardGranted = true;
        debugPrint('[AdMob] User earned reward for photo download: $photoId');
        onRewardEarnedDownload();
      },
    );
  }

  // ===========================================================================
  // INTERSTITIAL ADS (Natural Transitions Only)
  // ===========================================================================
  void loadInterstitialAd() {
    if (_isInterstitialLoading || _interstitialAd != null) return;
    _isInterstitialLoading = true;

    InterstitialAd.load(
      adUnitId: interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          _isInterstitialLoading = false;
          debugPrint('[AdMob] Interstitial Ad loaded successfully.');

          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              _interstitialAd = null;
              _lastInterstitialShownAt = DateTime.now();
              loadInterstitialAd();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              debugPrint('[AdMob] Failed to show interstitial: $error');
              ad.dispose();
              _interstitialAd = null;
              loadInterstitialAd();
            },
          );
        },
        onAdFailedToLoad: (LoadAdError error) {
          debugPrint('[AdMob] Interstitial failed to load: $error');
          _isInterstitialLoading = false;
          _interstitialAd = null;
        },
      ),
    );
  }

  bool showInterstitialAtNaturalBreak({VoidCallback? onComplete}) {
    if (_lastInterstitialShownAt != null) {
      final diff = DateTime.now().difference(_lastInterstitialShownAt!);
      if (diff < _interstitialCooldown) {
        onComplete?.call();
        return false;
      }
    }

    if (_interstitialAd != null) {
      _interstitialAd!.show();
      onComplete?.call();
      return true;
    } else {
      loadInterstitialAd();
      onComplete?.call();
      return false;
    }
  }

  // ===========================================================================
  // APP OPEN ADS (Optional when app becomes foreground)
  // ===========================================================================
  void loadAppOpenAd() {
    if (_isAppOpenLoading || _appOpenAd != null) return;
    _isAppOpenLoading = true;

    AppOpenAd.load(
      adUnitId: appOpenAdUnitId,
      request: const AdRequest(),
      adLoadCallback: AppOpenAdLoadCallback(
        onAdLoaded: (ad) {
          _appOpenAd = ad;
          _isAppOpenLoading = false;
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              _appOpenAd = null;
              loadAppOpenAd();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              ad.dispose();
              _appOpenAd = null;
              loadAppOpenAd();
            },
          );
        },
        onAdFailedToLoad: (error) {
          _isAppOpenLoading = false;
          _appOpenAd = null;
        },
      ),
    );
  }

  void showAppOpenAdIfAvailable() {
    if (_appOpenAd != null) {
      _appOpenAd!.show();
    } else {
      loadAppOpenAd();
    }
  }

  // ===========================================================================
  // ADAPTIVE BANNER ADS
  // ===========================================================================
  BannerAd createAdaptiveBanner({
    required AdSize adSize,
    VoidCallback? onLoaded,
    Function(LoadAdError)? onFailed,
  }) {
    return BannerAd(
      adUnitId: bannerAdUnitId,
      size: adSize,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) {
          debugPrint('[AdMob] Adaptive Banner loaded.');
          onLoaded?.call();
        },
        onAdFailedToLoad: (ad, error) {
          debugPrint('[AdMob] Adaptive Banner failed to load: $error');
          ad.dispose();
          onFailed?.call(error);
        },
      ),
    );
  }
}
