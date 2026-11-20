import React, { useState, useRef } from 'react';
import { Search, Bell, PlusCircle, Smartphone, Monitor, X, ShieldCheck, Share2, Check } from 'lucide-react';
import { TabType, UserProfile, AppBannerConfig, UserAccount } from '../types';
import { soundFX } from '../utils/audio';
import { shareAppWithLogo } from '../utils/share';
import { SuzikaLogo } from './SuzikaLogo';

interface HeaderProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  userProfile: UserProfile;
  currentUserAccount?: UserAccount | null;
  onOpenAccountModal?: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenUpload: () => void;
  viewMode: 'mobile' | 'wide';
  onToggleViewMode: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showUpload?: boolean;
  bannerConfig?: AppBannerConfig;
  onOpenLogin?: () => void;
  onOpenInstallModal?: () => void;
  onOpenAdminPin?: () => void;
  isPwaInstalled?: boolean;
  isPwaPromptReady?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  userProfile,
  unreadCount,
  onOpenNotifications,
  onOpenUpload,
  viewMode,
  onToggleViewMode,
  searchQuery,
  onSearchChange,
  showUpload = false,
  bannerConfig,
  onOpenLogin,
  onOpenInstallModal,
  onOpenAdminPin,
  isPwaInstalled = false,
  isPwaPromptReady = false,
}) => {
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [adminTapCount, setAdminTapCount] = useState(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://suzika-call-pic.web.app';
  const configuredShareUrl = bannerConfig?.customShareUrl?.trim() || '';
  const isCustomHostedDomain =
    typeof window !== 'undefined' &&
    !window.location.hostname.includes('.run.app') &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';
  const PUBLIC_APP_URL =
    configuredShareUrl && !(isCustomHostedDomain && configuredShareUrl.includes('ais-pre-'))
      ? configuredShareUrl
      : originUrl.includes('ais-dev-')
      ? originUrl.replace('ais-dev-', 'ais-pre-')
      : originUrl;

  const handleLogoTap = () => {
    soundFX.playPop();
    const nextCount = adminTapCount + 1;
    setAdminTapCount(nextCount);

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    if (nextCount >= 8) {
      setAdminTapCount(0);
      soundFX.playSuccess();
      if (onOpenAdminPin) {
        onOpenAdminPin();
      } else {
        onSelectTab('admin');
      }
    } else {
      if (nextCount === 1) {
        onSelectTab('home');
      }
      tapTimerRef.current = setTimeout(() => {
        setAdminTapCount(0);
      }, 3500);
    }
  };

  const handleShareApp = async () => {
    soundFX.playSuccess();
    const result = await shareAppWithLogo(PUBLIC_APP_URL);
    if (result.ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-hidden bg-[#080a12]/90 backdrop-blur-md border-b border-[#252a3d] px-2 sm:px-4 py-2.5 sm:py-3 transition-all">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
        {/* Brand & Subtitle */}
        <div 
          onClick={handleLogoTap}
          className="cursor-pointer group flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 select-none"
          title="SUZIKA Call Pic"
        >
          <SuzikaLogo size="sm" className="sm:w-9 sm:h-9 sm:rounded-xl group-hover:scale-105 transition-transform" />
          <div className="min-w-0 flex-1">
            <div className="font-display font-black text-[14px] sm:text-lg tracking-tight leading-none text-white truncate">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff35bb] via-[#a855f7] to-[#00d2ff]">
                SUZIKA
              </span>{' '}
              Call Pic
            </div>
            <div className="text-[8px] sm:text-[10px] tracking-wider sm:tracking-widest font-semibold text-[#9da4b8] mt-0.5 uppercase truncate">
              Photo · Video · Community
            </div>
          </div>
        </div>

        {/* Action Controls (Admin button removed for visitor privacy) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search Trigger */}
          <button
            onClick={() => {
              soundFX.playPop();
              setShowSearchInput(!showSearchInput);
            }}
            aria-label="Search gallery"
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-colors ${
              showSearchInput ? 'bg-[#ff35bb]/20 text-[#ff35bb]' : 'text-[#9da4b8] hover:text-white hover:bg-[#161a2b]'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Share App Link Button */}
          <button
            onClick={handleShareApp}
            title="Copy & Share User App Link"
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
              copiedLink
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-[#161a2b] hover:bg-[#202742] text-[#00d2ff] border-[#252a3d]'
            }`}
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] sm:text-[11px] font-bold">Done!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Share</span>
              </>
            )}
          </button>

          {/* Mobile App Install Modal Trigger (hidden once installed & running as standalone app) */}
          {!isPwaInstalled && (
            <button
              onClick={() => {
                soundFX.playPop();
                if (onOpenInstallModal) onOpenInstallModal();
              }}
              title="ফোনে অ্যাপ হিসেবে ইনস্টল করুন (Install App)"
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold active:scale-95 transition-all shadow-sm cursor-pointer shrink-0 ${
                isPwaPromptReady
                  ? 'bg-gradient-to-r from-[#ff35bb]/25 to-[#00d2ff]/25 text-white border-[#00d2ff]/60 shadow-[#00d2ff]/20'
                  : 'bg-gradient-to-r from-emerald-500/20 to-[#00d2ff]/20 text-[#00d2ff] hover:text-white border-[#00d2ff]/40'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-[#00d2ff] shrink-0" />
              <span className="text-[10px] sm:text-[11px] whitespace-nowrap">ইনস্টল</span>
            </button>
          )}

          {/* View Mode Toggle (Desktop only so phones/tablets stay edge-to-edge full cover) */}
          <button
            onClick={() => {
              soundFX.playPop();
              onToggleViewMode();
            }}
            title={viewMode === 'mobile' ? 'Switch to Full-Width Responsive View' : 'Switch to Smartphone App View'}
            className="hidden lg:flex w-9 h-9 rounded-xl items-center justify-center text-[#9da4b8] hover:text-white hover:bg-[#161a2b] transition-colors shrink-0"
          >
            {viewMode === 'mobile' ? (
              <Monitor className="w-4 h-4" />
            ) : (
              <Smartphone className="w-4 h-4 text-[#00d2ff]" />
            )}
          </button>

          {/* User Account / Login Button */}
          {userProfile?.isLoggedIn ? (
            <button
              onClick={() => {
                soundFX.playPop();
                onSelectTab('profile');
              }}
              title={`Logged in as ${userProfile.name} (${userProfile.phone || ''})`}
              className="flex items-center gap-1.5 p-1 sm:pr-2.5 rounded-full bg-[#161a2b] border border-[#ff35bb]/40 hover:border-[#ff35bb] transition-all active:scale-95 shrink-0"
            >
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name}
                  className="w-7 h-7 rounded-full object-cover border border-[#ff35bb]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] flex items-center justify-center text-white text-xs font-bold">
                  {userProfile.avatarText || userProfile.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <span className="text-[11px] font-bold text-white max-w-[70px] truncate hidden sm:inline">
                {userProfile.name}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                soundFX.playPop();
                if (onOpenLogin) {
                  onOpenLogin();
                } else {
                  onSelectTab('profile');
                }
              }}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-[10px] sm:text-[11px] font-bold hover:opacity-95 active:scale-95 transition-all shadow-md shadow-[#ff35bb]/20 flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <span>লগইন</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Search Input Bar */}
      {showSearchInput && (
        <div className="mt-3 pt-2 border-t border-[#252a3d]/80 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9da4b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search 500+ photos & 50 videos (e.g. Neon, Nature, Tokyo)..."
              autoFocus
              className="w-full bg-[#111522] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-[#9da4b8]/60 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9da4b8] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              soundFX.playPop();
              setShowSearchInput(false);
            }}
            className="px-2.5 py-1.5 text-xs text-[#9da4b8] hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </header>
  );
};
