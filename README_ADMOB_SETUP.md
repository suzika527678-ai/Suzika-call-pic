# SUZIKA Video Player — Real Google AdMob & AdSense Integration Guide

This guide explains how real Google Mobile Ads (AdMob) is integrated into your native Android APK and how Google AdSense operates on the web version.

---

## 🚫 1. All Fake & Simulated Ads Have Been Removed
- **No fake advertiser names** (all mock sponsors like "Google Pixel 9 Pro" or "SpeedDownloader" have been removed).
- **No fake 30-second pre-roll countdown blockers** on video playback (your videos stream immediately without interrupting controls).
- **No fake download blockers** (photos and videos download cleanly and directly).
- **No fabricated revenue metrics or invented impressions**.
- **No hardcoded secret keys**.

---

## 📱 2. Android APK: Google Mobile Ads (Flutter / Native)

### Files Prepared in this Project:
1. **`android/app/src/main/AndroidManifest.xml`**:
   Configured with the Google Mobile Ads application meta-data tag:
   ```xml
   <meta-data
       android:name="com.google.android.gms.ads.APPLICATION_ID"
       android:value="ca-app-pub-3940256099942544~3347511713" />
   ```
2. **`lib/admob_service.dart`**:
   Initializes the official `google_mobile_ads` SDK, configures test IDs, adaptive banner loading, and natural-break interstitial ads.
3. **`lib/widgets/admob_banner_widget.dart`**:
   Responsive adaptive banner anchored at the bottom of the home screen that respects safe areas and never covers video playback controls.

---

## 🔑 3. Exactly Where to Paste Your Real Production AdMob IDs

### Step A: In the Admin Panel (Web / Mobile)
1. Log in to the Admin Dashboard (tap the lock / profile icon).
2. Go to the **AdMob & Ads Settings** tab.
3. Switch **Test Mode** to **Production Mode**.
4. Paste:
   - **AdMob App ID**: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`
   - **Adaptive Banner Unit ID**: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`
   - **Interstitial Video Unit ID**: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`
5. Tap **"Save Real Advertising Settings"**.

### Step B: In the Native Android APK Code
When building your release Android APK:
1. Open `android/app/src/main/AndroidManifest.xml`.
2. Replace:
   ```xml
   <meta-data
       android:name="com.google.android.gms.ads.APPLICATION_ID"
       android:value="PASTE_YOUR_REAL_ADMOB_APP_ID_HERE" />
   ```
3. Open `lib/admob_service.dart`.
4. Update the production constants:
   ```dart
   static const String _realBannerUnitIdAndroid = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';
   static const String _realInterstitialUnitIdAndroid = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';
   ```
5. Set `isTestMode = false;`.

---

## 🧪 4. Google Official Test Ad IDs (Active by Default)

During development and testing, Google strictly mandates using test ad IDs to prevent account suspensions:

| Ad Type | Official Google Test ID |
| :--- | :--- |
| **Android App ID** | `ca-app-pub-3940256099942544~3347511713` |
| **Adaptive Banner** | `ca-app-pub-3940256099942544/6300978111` |
| **Interstitial Video** | `ca-app-pub-3940256099942544/1033173712` |
| **Rewarded Ad** | `ca-app-pub-3940256099942544/5224354917` |

---

## 🌐 5. Web Version: Google AdSense Ready
- **AdMob does not run in web browsers**: The React web preview does not simulate fake mobile AdMob banners.
- If you wish to monetize the web version, enable **Web Version: Google AdSense** in the Admin Panel and enter your verified `ca-pub-XXXXXXXXXXXXXXXX` client ID.

---

## ⚠️ 6. AdMob Account Approval Checklist
To begin earning real revenue on Android:
1. **Complete Payments Profile**: Go to AdMob > Payments and verify your name, tax information, and bank details.
2. **App Review**: Once published on Google Play Store, link your app in AdMob > Apps.
3. **app-ads.txt**: Place your `app-ads.txt` file at the root of your developer domain (e.g., `https://yourdomain.com/app-ads.txt`).
