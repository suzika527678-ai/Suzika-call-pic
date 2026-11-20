import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import '../admob_service.dart';

/// Clean, real Adaptive Banner Widget for native Android APK.
/// 
/// Complies with Google AdMob policy:
/// - Anchored at the bottom of the home screen.
/// - Never overlaps buttons, text inputs, or video playback controls.
/// - Gracefully collapses when ads are loading or if loading fails.
class AdMobAdaptiveBannerWidget extends StatefulWidget {
  const AdMobAdaptiveBannerWidget({Key? key}) : super(key: key);

  @override
  State<AdMobAdaptiveBannerWidget> createState() => _AdMobAdaptiveBannerWidgetState();
}

class _AdMobAdaptiveBannerWidgetState extends State<AdMobAdaptiveBannerWidget> {
  BannerAd? _bannerAd;
  bool _isLoaded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadAdaptiveBanner();
  }

  Future<void> _loadAdaptiveBanner() async {
    // Calculate adaptive banner width based on current screen orientation
    final mediaQuery = MediaQuery.of(context);
    final width = mediaQuery.size.width.truncate();

    final AdSize? adaptiveSize = await AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(width);
    if (adaptiveSize == null || !mounted) return;

    _bannerAd = AdMobService.instance.createAdaptiveBanner(
      adSize: adaptiveSize,
      onLoaded: () {
        if (mounted) {
          setState(() {
            _isLoaded = true;
          });
        }
      },
      onFailed: (error) {
        if (mounted) {
          setState(() {
            _isLoaded = false;
          });
        }
      },
    );

    await _bannerAd?.load();
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoaded || _bannerAd == null) {
      // Return zero-height container until real ad is received so layout does not jump
      return const SizedBox.shrink();
    }

    return SafeArea(
      top: false,
      child: Container(
        alignment: Alignment.center,
        width: _bannerAd!.size.width.toDouble(),
        height: _bannerAd!.size.height.toDouble(),
        color: const Color(0xFF080A12),
        child: AdWidget(ad: _bannerAd!),
      ),
    );
  }
}
