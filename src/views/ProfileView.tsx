import React, { useState } from 'react';
import { 
  User, 
  MessageSquare, 
  ShieldCheck, 
  Check, 
  Send, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Monitor, 
  RefreshCw, 
  Share2, 
  Copy, 
  ExternalLink, 
  MessageCircle, 
  Phone, 
  Lock, 
  Heart,
  LogOut,
  Edit2,
  Camera,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UserProfile, AdminMessage, AppBannerConfig } from '../types';
import { soundFX } from '../utils/audio';
import { AdBanner } from '../components/AdBanner';
import { compressImageFile } from '../utils/imageCompressor';
import { copyToClipboard } from '../utils/clipboard';
import { shareAppWithLogo, downloadShareLogoCard } from '../utils/share';
import { LoginModal } from '../components/LoginModal';

interface ProfileViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onUserLogin?: (name: string, phone: string, avatarUrl?: string) => void;
  onUserLogout?: () => void;
  adminMessages: AdminMessage[];
  onSendMessageToAdmin: (text: string, category: 'General' | 'Photo Request' | 'Video Upload' | 'Sponsorship' | 'Bug Report') => void;
  viewMode: 'mobile' | 'wide';
  onToggleViewMode: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onResetData: () => void;
  photoLikesCount: number;
  videoLikesCount: number;
  onNavigateToAdmin: () => void;
  bannerConfig?: AppBannerConfig;
  isAdmin?: boolean;
  isPwaInstalled?: boolean;
  onOpenInstallModal?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  onUserLogin,
  onUserLogout,
  adminMessages,
  onSendMessageToAdmin,
  viewMode,
  onToggleViewMode,
  soundEnabled,
  onToggleSound,
  onResetData,
  photoLikesCount = 0,
  videoLikesCount = 0,
  onNavigateToAdmin,
  bannerConfig,
  isAdmin = false,
  isPwaInstalled = false,
  onOpenInstallModal,
}) => {
  // Login pop-up modal state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);

  // Profile bio / name editing state
  const [nameInput, setNameInput] = useState(userProfile.name || '');
  const [bioInput, setBioInput] = useState(userProfile.bio || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Admin messaging state
  const [adminMsgText, setAdminMsgText] = useState('');
  const [msgCategory, setMsgCategory] = useState<'General' | 'Photo Request' | 'Video Upload' | 'Sponsorship' | 'Bug Report'>('General');
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  // In-app confirmation states (no window.confirm in iframe)
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmResetData, setConfirmResetData] = useState(false);

  const isLoggedIn = Boolean(userProfile.isLoggedIn && (userProfile.phone || userProfile.name));

  // Prefer customShareUrl if configured; automatically use own custom domain when hosted outside run.app
  const getPublicAppUrl = () => {
    let url = bannerConfig?.customShareUrl?.trim();
    const isCustomDomain =
      typeof window !== 'undefined' &&
      !window.location.hostname.includes('.run.app') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    if (url && !url.includes('vercel.app') && !(isCustomDomain && url.includes('ais-pre-'))) {
      if (url.includes('ais-dev-')) {
        url = url.replace('ais-dev-', 'ais-pre-');
      }
      return url;
    }
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin.includes('ais-dev-')) {
        return origin.replace('ais-dev-', 'ais-pre-');
      }
      return origin;
    }
    return 'https://suzika-call-pic.web.app';
  };

  const PUBLIC_APP_URL = getPublicAppUrl();

  const handleCopyAppLink = async () => {
    soundFX.playSuccess();
    await copyToClipboard(PUBLIC_APP_URL);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const [shareStatusNote, setShareStatusNote] = useState<string | null>(null);

  const handleNativeShare = async () => {
    soundFX.playSuccess();
    setShareStatusNote(null);
    const result = await shareAppWithLogo(PUBLIC_APP_URL);
    if (result.method === 'clipboard' && result.ok) {
      setCopiedLink(true);
      setShareStatusNote('এই ব্রাউজারে সরাসরি ইমেজ শেয়ার সাপোর্ট নেই—লিংক কপি হয়েছে। নিচ থেকে লোগো সেভ করে ইমুতে পাঠাতে পারেন।');
      setTimeout(() => setCopiedLink(false), 2500);
    } else if (result.method === 'native-url' && result.ok) {
      setShareStatusNote('শেয়ার করা হয়েছে! ইমুতে লোগো সহ পাঠাতে নিচ থেকে "লোগো ছবি সেভ" করে লিংকের সাথে দিন।');
    }
  };

  const handleDownloadLogoCard = async () => {
    soundFX.playSuccess();
    await copyToClipboard(PUBLIC_APP_URL);
    const ok = await downloadShareLogoCard();
    if (ok) {
      setCopiedLink(true);
      setShareStatusNote('SUZIKA লোগো ছবি সেভ হয়েছে ও লিংক কপি হয়েছে! এখন ইমুতে ছবি+লিংক একসাথে পাঠান।');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  // User Logout
  const handleUserLogoutClick = () => {
    soundFX.playPop();
    if (onUserLogout) {
      onUserLogout();
    } else {
      onUpdateProfile({
        isLoggedIn: false,
        phone: '',
        name: '',
        avatarUrl: '',
      });
    }
    setIsEditingAccount(false);
    setConfirmLogout(false);
  };

  // Save updated bio/name
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    soundFX.playSuccess();
    const trimmed = nameInput.trim() || userProfile.name || 'SUZIKA User';
    onUpdateProfile({
      name: trimmed,
      bio: bioInput.trim(),
      avatarText: trimmed.charAt(0).toUpperCase(),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Send message to Suzika / Admin
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMsgText.trim()) return;
    soundFX.playSuccess();
    onSendMessageToAdmin(adminMsgText.trim(), msgCategory);
    setAdminMsgText('');
    setSentNotice('মেসেজটি সফলভাবে সুজিকার এডমিন ডেস্কে পাঠানো হয়েছে। খুব দ্রুত রিপ্লাই পাবেন!');
    setTimeout(() => setSentNotice(null), 4000);
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className="pb-2 border-b border-[#252a3d] flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Your Profile & Account</h1>
          <p className="text-xs text-[#9da4b8] mt-0.5">
            ইউজার একাউন্ট পরিচালনা করুন ও সুজিকার সাথে সরাসরি যোগাযোগ রাখুন।
          </p>
        </div>
        {isLoggedIn && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>লগইন একাউন্ট</span>
          </span>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. LOGIN / REGISTRATION FORM (WHEN NOT LOGGED IN OR EDITING) */}
      {/* ========================================================================= */}
      {!isLoggedIn ? (
        /* ========================================================================= */
        /* 1. GUEST STATE - CLEAN, COMPACT (NO ESSAYS OR WALL OF TEXT) */
        /* ========================================================================= */
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#1b1430] via-[#12162a] to-[#0c0f1c] border border-[#ff35bb]/40 shadow-xl text-center space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#ff35bb]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-full mx-auto bg-gradient-to-tr from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] p-0.5 shadow-lg shadow-[#ff35bb]/30 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#111524] flex items-center justify-center text-white">
              <User className="w-8 h-8 text-[#ff35bb]" />
            </div>
          </div>

          <div>
            <h2 className="font-display font-black text-xl text-white">আপনার প্রোফাইল</h2>
            <p className="text-xs text-[#d5cce7] mt-1">
              ছবি ও ভিডিওতে লাইক দেওয়া এবং কমেন্ট করার জন্য লগইন করুন।
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                setIsEditingAccount(false);
                setIsLoginModalOpen(true);
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-black shadow-lg shadow-[#ff35bb]/25 hover:opacity-95 active:scale-95 transition-all inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>লগইন করুন (Login)</span>
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. ACTIVE LOGGED IN USER PROFILE CARD */
        /* ========================================================================= */
        <div className="p-6 rounded-3xl bg-[#111522] border border-[#252a3d] shadow-xl relative overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              {/* Profile Avatar / Photo */}
              <div className="relative">
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#ff35bb] shadow-lg shadow-[#ff35bb]/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] shadow-lg shadow-[#ff35bb]/20 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#111522] flex items-center justify-center font-display font-black text-2xl text-white">
                      {userProfile.avatarText || userProfile.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#111522] flex items-center justify-center text-black font-bold text-[10px]">
                  ✓
                </span>
              </div>

              {/* User Identity Details */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="font-display font-black text-xl text-white">{userProfile.name}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>ভেরিফায়েড মেম্বার</span>
                  </span>
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-emerald-300 font-mono">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>মোবাইল: {userProfile.phone || 'যুক্ত করা নেই'}</span>
                </div>

                <p className="text-xs text-[#9da4b8] max-w-sm">
                  {userProfile.bio || 'SUZIKA গ্যালারি মেম্বার'}
                </p>
              </div>
            </div>

            {/* Action Buttons: Edit & Logout */}
            <div className="flex items-center gap-2 self-center sm:self-start">
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setIsEditingAccount(true);
                  setIsLoginModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1b2138] hover:bg-[#252c48] text-[#00d2ff] text-xs font-bold border border-[#00d2ff]/30 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>এডিট</span>
              </button>

              {confirmLogout ? (
                <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 p-1 rounded-xl animate-in zoom-in-95">
                  <span className="text-[11px] text-red-200 px-1 font-bold">লগআউট?</span>
                  <button
                    type="button"
                    onClick={handleUserLogoutClick}
                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black"
                  >
                    হ্যাঁ
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(false)}
                    className="px-2 py-1 bg-[#252a3d] hover:bg-[#323952] text-white rounded-lg text-[10px]"
                  >
                    না
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>লগআউট</span>
                </button>
              )}
            </div>
          </div>

          {/* Activity Stats */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#252a3d] text-center">
            <div className="p-3 rounded-2xl bg-[#151a2d] border border-[#252a3d]">
              <div className="font-mono-numbers font-bold text-lg text-[#ff35bb] flex items-center justify-center gap-1">
                <Heart className="w-4 h-4 fill-[#ff35bb]" />
                <span>{photoLikesCount}</span>
              </div>
              <div className="text-[10px] text-[#9da4b8] mt-0.5">পছন্দ করা ছবি</div>
            </div>

            <div className="p-3 rounded-2xl bg-[#151a2d] border border-[#252a3d]">
              <div className="font-mono-numbers font-bold text-lg text-[#00d2ff]">
                {videoLikesCount}
              </div>
              <div className="text-[10px] text-[#9da4b8] mt-0.5">পছন্দ করা ভিডিও</div>
            </div>

            <div className="p-3 rounded-2xl bg-[#151a2d] border border-[#252a3d]">
              <div className="font-mono-numbers font-bold text-lg text-emerald-400">
                Active
              </div>
              <div className="text-[10px] text-[#9da4b8] mt-0.5">অ্যাক্সেস স্ট্যাটাস</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. USER APP LINK & SHARE CARD */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#171333] via-[#12192d] to-[#0f2438] border border-[#00d2ff]/40 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/40 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm text-white">User App Share Link (ইউজারদের শেয়ার করার লিংক)</h2>
              <p className="text-[11px] text-[#9da4b8]">যে কেউ এই লিংকে ঢুকলে সরাসরি আপনার ফটো ও ভিডিও গ্যালারি দেখতে পারবে।</p>
            </div>
          </div>
          <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            ✓ Public Web & PWA
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#0b0e18] p-2 rounded-2xl border border-[#252a3d]">
          <div className="flex-1 px-3 py-1.5 font-mono text-xs text-[#00d2ff] truncate select-all">
            {PUBLIC_APP_URL}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyAppLink}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all ${
                copiedLink
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-[#00d2ff] to-[#8b4dff] text-white hover:opacity-95 active:scale-95'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>লিংক কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <a
              href={PUBLIC_APP_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[#1b223c] hover:bg-[#252f52] text-[#00d2ff] border border-[#00d2ff]/30 flex items-center gap-1 transition-all active:scale-95"
              title="Open and test in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test</span>
            </a>
          </div>
        </div>

        {/* Action Buttons: Share With Logo, WhatsApp, Browser Open */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleNativeShare}
            className="flex-1 min-w-[150px] px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white flex items-center justify-center gap-1.5 shadow-lg shadow-[#ff35bb]/20 hover:opacity-95 active:scale-95 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>লোগোসহ শেয়ার করুন</span>
          </button>

          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent('SUZIKA Call Pic — HD ফটো ও ভিডিও রিলস দেখুন:\n' + PUBLIC_APP_URL)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-w-[130px] px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp এ পাঠান</span>
          </a>

          <a
            href={PUBLIC_APP_URL}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#1b223c] hover:bg-[#252f52] text-[#00d2ff] border border-[#00d2ff]/30 flex items-center justify-center gap-1.5 transition-all active:scale-95"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>ব্রাউজারে খুলুন</span>
          </a>

          <button
            type="button"
            onClick={handleDownloadLogoCard}
            className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-[#151a2d] hover:bg-[#1e2642] text-[#ff80d5] border border-[#ff35bb]/35 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>SUZIKA লোগো ছবি সেভ + লিংক কপি (ইমুতে পাঠাতে)</span>
          </button>
        </div>

        {shareStatusNote && (
          <p className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 leading-relaxed">
            {shareStatusNote}
          </p>
        )}

        <p className="text-[11px] text-[#9da4b8] bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-2 leading-relaxed">
          💡 ইমুতে <strong className="text-white">ais-pre-...run.app</strong> লিংক একা পাঠালে Google-এর গেটওয়ে &quot;Cookie check&quot; দেখায়। স্থায়ীভাবে যেকোনো লিংক পেস্টে অটো-লোগো দেখাতে চাইলে অ্যাপটি পাবলিক ডোমেইনে (যেমন Firebase Hosting) ডিপ্লয় করতে হবে, অথবা উপরের <strong className="text-[#ff80d5]">&quot;SUZIKA লোগো ছবি সেভ + লিংক কপি&quot;</strong> দিয়ে পাঠাতে পারেন।
        </p>

        {/* Vital Instruction: Address Bar vs Google Search */}
        <div className="p-3.5 rounded-2xl bg-[#0e1428] border border-[#00d2ff]/30 text-xs space-y-2">
          <div className="flex items-center gap-2 text-[#00d2ff] font-bold text-xs">
            <Sparkles className="w-4 h-4 text-[#00d2ff] shrink-0" />
            <span>অন্য ডিভাইসে লিংক কাজ করানোর সঠিক নিয়ম:</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-[#c7d2fe] leading-relaxed">
            <p className="flex items-start gap-1.5">
              <span className="text-red-400 font-bold shrink-0">❌ ভুল পদ্ধতি:</span>
              <span>গুগল সার্চ বক্সে খুঁজবেন না। এটি লাইভ অ্যাপ্লিকেশন।</span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold shrink-0">✅ সঠিক পদ্ধতি:</span>
              <span>মোবাইলের Chrome ব্রাউজারের একেবারে উপরের <strong>Address Bar</strong>-এ লিংকটি পেস্ট করে কিবোর্ডের <strong>Go / Enter (⏎)</strong> চাপুন।</span>
            </p>
          </div>
        </div>

        {/* AdMob Banner inside Profile */}
        <div className="pt-2">
          <AdBanner slotName="profile-banner" format="banner" config={bannerConfig} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DIRECT CHAT & SMS WITH SUZIKA (ADMIN CONTACT DESK) */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-3xl bg-gradient-to-b from-[#1b122c] via-[#111524] to-[#0c0f1c] border border-[#ff35bb]/40 shadow-2xl space-y-4">
        {/* Suzika's Creator Card Header */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2c0e3a] via-[#1a1430] to-[#121f3a] border border-[#ff35bb]/30 flex flex-col sm:flex-row items-center sm:items-start gap-3.5 text-center sm:text-left">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-[#ff35bb] via-[#f72585] to-[#00d2ff] shadow-lg shadow-[#ff35bb]/30 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#101426] flex items-center justify-center text-2xl font-black text-white font-display">
                S
              </div>
            </div>
            {/* Green glowing online dot */}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#101426]"></span>
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="font-display font-black text-lg text-white">Suzika / সুজিকা</h2>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin & Creator</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                ● 100% সততা গ্যারান্টি
              </span>
            </div>

            {/* Suzika's exact bio message */}
            <div className="mt-2 p-3 rounded-xl bg-[#090c18]/80 border border-[#ff35bb]/20 text-xs text-[#f1d7ec] leading-relaxed">
              &ldquo;👌আমি সবার মত না 100% সততার সাথে কাজ করে টাকা নেই কাউকে মিথ্যা বলে টাকা নেই না!!!!👌 যেভাবে বলবেন মজা দিয়ে কাজ করবো।।👉👌🤳 কথা কাজে মিল থাকলে কাজের কথা বলেন ???💯 আমাকে পাশে পাবে রিপ্লাই পাবে সব সময় 100% গ্যারান্টি💋❤️🙋🙋&rdquo;
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-[#9da4b8] mt-2">
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                অনলাইনে আছি · সরাসরি মেসেজ দিন
              </span>
              <span>·</span>
              <span className="text-[#00d2ff]">24/7 লাইভ চ্যাট রেসপন্স</span>
            </div>
          </div>
        </div>

        {/* Quick Message Chips */}
        <div>
          <span className="text-[11px] font-bold text-[#d5cce7] mb-1.5 block">
            দ্রুত মেসেজ পাঠান (ট্যাপ করে লিখুন):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'হাই সুজিকা! 👋',
              'কাজের কথা বলতে চাই 📞',
              'তোমার নতুন এক্সক্লুসিভ ছবি দেখতে চাই ❤️',
              'ভিডিও কল সুবিধা ও ডিটেইলস দাও 🎥',
              'ইমো / হোয়াটসঅ্যাপ নাম্বার দাও 💬',
            ].map((quickText) => (
              <button
                key={quickText}
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setAdminMsgText(quickText);
                }}
                className="px-2.5 py-1 rounded-xl bg-[#161a2b] hover:bg-[#232b47] border border-[#252a3d] text-xs text-[#00d2ff] hover:text-white transition-colors text-left"
              >
                + {quickText}
              </button>
            ))}
          </div>
        </div>

        {/* Live Chat Message Input */}
        <form onSubmit={handleAdminSubmit} className="space-y-2.5">
          <div className="flex gap-2">
            <select
              value={msgCategory}
              onChange={(e) => setMsgCategory(e.target.value as any)}
              className="bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
            >
              <option value="General">সরাসরি চ্যাট</option>
              <option value="Photo Request">কাজের কথা / ফটো রিকোয়েস্ট</option>
              <option value="Video Upload">ভিডিও কল অনুসন্ধান</option>
              <option value="Sponsorship">স্পন্সর / ভিআইপি</option>
            </select>
            <input
              type="text"
              required
              value={adminMsgText}
              onChange={(e) => setAdminMsgText(e.target.value)}
              placeholder="সুজিকাকে সরাসরি মেসেজ লিখুন..."
              className="flex-1 bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold shadow-md shadow-[#ff35bb]/30 hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SMS পাঠান</span>
            </button>
          </div>

          {sentNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 text-center animate-in fade-in">
              ✓ {sentNotice}
            </div>
          )}
        </form>

        {/* Live Chat Message Stream */}
        {adminMessages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#252a3d] space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-[#ff35bb]" />
                <span>সুজিকার সাথে চ্যাট হিস্ট্রি ({adminMessages.length})</span>
              </h4>
              <span className="text-[10px] text-emerald-400">রিয়েল-টাইম সিঙ্ক</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {adminMessages.map((msg) => (
                <div key={msg.id} className="p-3 rounded-2xl bg-[#0e1222] border border-[#252a3d] text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-[#9da4b8]">
                    <span className="font-bold text-[#00d2ff]">{msg.senderName} ({msg.category})</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="text-white leading-relaxed pl-1">{msg.message}</p>
                  
                  {msg.reply && (
                    <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-[#2a0e3a] to-[#151a30] border border-[#ff35bb]/40 text-xs">
                      <div className="flex items-center gap-1 font-bold text-[#ff8ce4] mb-0.5 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#ff35bb]" />
                        <span>{msg.reply.adminName || 'Suzika (সুজিকা)'}</span>
                        <span className="text-[9px] text-[#9da4b8] font-normal ml-auto">{msg.reply.timestamp}</span>
                      </div>
                      <p className="text-[#f1d7ec] leading-relaxed">{msg.reply.text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. APP PREFERENCES & SETTINGS */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-3xl bg-[#111522] border border-[#252a3d] space-y-4">
        <h3 className="font-display font-bold text-base text-white">App Experience & Settings</h3>

        <div className="divide-y divide-[#252a3d] text-xs">
          {/* View Mode */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Simulator Layout</span>
              <span className="text-[11px] text-[#9da4b8]">
                {viewMode === 'mobile' ? 'Mobile App Shell (480px)' : 'Responsive Multi-Column'}
              </span>
            </div>
            <button
              onClick={() => {
                soundFX.playPop();
                onToggleViewMode();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181d30] border border-[#252a3d] text-white hover:bg-[#222a45]"
            >
              {viewMode === 'mobile' ? <Monitor className="w-3.5 h-3.5 text-[#00d2ff]" /> : <Smartphone className="w-3.5 h-3.5 text-[#ff35bb]" />}
              <span>{viewMode === 'mobile' ? 'Expand to Wide' : 'Compact Mobile'}</span>
            </button>
          </div>

          {/* Sound FX */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Interactive Sound FX</span>
              <span className="text-[11px] text-[#9da4b8]">Tactile audio pops on taps & likes</span>
            </div>
            <button
              onClick={() => {
                onToggleSound();
                soundFX.playPop();
              }}
              className={`p-2 rounded-xl border transition-colors ${
                soundEnabled
                  ? 'bg-[#ff35bb]/20 border-[#ff35bb]/50 text-[#ff35bb]'
                  : 'bg-[#181d30] border-[#252a3d] text-[#9da4b8]'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Phone App Installation Status */}
          <div className="py-3 flex items-center justify-between gap-2">
            <div>
              <span className="font-bold text-white block">SUZIKA Phone App (PWA)</span>
              <span className="text-[11px] text-[#9da4b8]">
                {isPwaInstalled
                  ? 'ফোনে অ্যাপ হিসেবে সফলভাবে ইনস্টল করা আছে'
                  : 'ফোনের হোমস্ক্রিনে অ্যাপ আইকন যুক্ত করে ফুল-স্ক্রিনে ব্যবহার করুন'}
              </span>
            </div>
            {isPwaInstalled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Installed</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  onOpenInstallModal?.();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#00d2ff] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>অ্যাপ ইনস্টল</span>
              </button>
            )}
          </div>

          {/* Reset App Data */}
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Reset Applet Cache</span>
              <span className="text-[11px] text-[#9da4b8]">Restore original 500 photo & 50 video slots</span>
            </div>
            {confirmResetData ? (
              <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 p-1.5 rounded-xl animate-in zoom-in-95">
                <span className="text-[11px] text-red-200 font-bold">সব রিসেট করবেন?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetData();
                    soundFX.playSuccess();
                    setConfirmResetData(false);
                  }}
                  className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold"
                >
                  হ্যাঁ, রিসেট
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetData(false)}
                  className="px-2.5 py-1 bg-[#252a3d] hover:bg-[#323952] text-white rounded-lg text-xs"
                >
                  বাতিল
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetData(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Data</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AdMob Banner in Profile */}
      <AdBanner slotName="profile-bottom" format="banner" config={bannerConfig} />

      {/* Clean Visitor Footer */}
      <div className="pt-6 pb-2 text-center text-xs text-[#9da4b8]/60 select-none">
        <span>© 2026 SUZIKA Call Pic · Photo · Video · Community</span>
      </div>

      {/* Clean Login / Edit Pop-up Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setIsEditingAccount(false);
        }}
        onLogin={(name, phone, avatarUrl) => {
          if (onUserLogin) {
            onUserLogin(name, phone, avatarUrl);
          } else {
            onUpdateProfile({
              name,
              phone,
              avatarUrl,
              avatarText: name.charAt(0).toUpperCase() || 'U',
              isLoggedIn: true,
            });
          }
          setIsLoginModalOpen(false);
          setIsEditingAccount(false);
        }}
        initialName={userProfile.name}
        initialPhone={userProfile.phone}
        initialAvatarUrl={userProfile.avatarUrl}
        isEditing={isEditingAccount}
      />
    </div>
  );
};
