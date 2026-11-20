import React from 'react';
import { Home, LayoutGrid, Film, Flame, User } from 'lucide-react';
import { TabType } from '../types';
import { soundFX } from '../utils/audio';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  photoCount: number;
  videoCount: number;
  privateVideoCount?: number;
  commentsCount?: number;
  viewMode?: 'mobile' | 'wide';
  isAdmin?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  photoCount,
  videoCount,
  privateVideoCount = 0,
  viewMode = 'wide',
  isAdmin = false,
}) => {
  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'gallery',
      label: 'Gallery',
      icon: <LayoutGrid className="w-5 h-5" />,
      badge: photoCount,
    },
    {
      id: 'videos',
      label: 'Videos',
      icon: <Film className="w-5 h-5" />,
      badge: videoCount,
    },
    {
      id: 'private',
      label: 'Private',
      icon: <Flame className="w-5 h-5" />,
      badge: privateVideoCount > 0 ? privateVideoCount : '18+',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav className={`z-40 w-full max-w-full overflow-hidden backdrop-blur-xl px-1 sm:px-2 py-2 safe-area-bottom transition-all duration-300 ${
      isAdmin 
        ? 'bg-[#140b02]/95 border-t border-[#ffd700]/40 shadow-[0_-5px_25px_rgba(255,183,3,0.15)]' 
        : 'bg-[#0c0f1c]/95 border-t border-[#252a3d]'
    } ${
      viewMode === 'mobile' ? 'sticky bottom-0 left-0 right-0 mt-auto' : 'fixed bottom-0 left-0 right-0'
    }`}>
      <div className="w-full max-w-2xl mx-auto grid grid-cols-5 items-center">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                soundFX.playPop();
                onSelectTab(item.id);
              }}
              className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 min-h-[48px] ${
                isActive
                  ? isAdmin ? 'text-[#ffd700]' : 'text-[#ff35bb]'
                  : 'text-[#8e96ad] hover:text-[#d5d9e8] hover:bg-[#151a2d]/40'
              }`}
            >
              {/* Icon with optional notification pill */}
              <div className="relative">
                <div className={`transition-transform duration-200 ${
                  isActive 
                    ? isAdmin 
                      ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]' 
                      : 'scale-110 drop-shadow-[0_0_8px_rgba(255,53,187,0.5)]' 
                    : ''
                }`}>
                  {item.icon}
                </div>
                {item.badge !== undefined && (
                  <span className={`absolute -top-1.5 -right-2 text-[9px] font-mono-numbers font-bold px-1 py-0.2 rounded-full min-w-[14px] text-center ${
                    isActive 
                      ? isAdmin ? 'bg-[#ffd700] text-black font-black' : 'bg-[#ff35bb] text-white' 
                      : 'bg-[#222941] text-[#9da4b8]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[11px] font-medium tracking-tight mt-1 transition-colors ${
                isActive ? 'font-bold text-white' : 'text-[#8e96ad]'
              }`}>
                {item.label}
              </span>

              {/* Active Bottom Glow Indicator */}
              {isActive && (
                <div className={`absolute -bottom-1 w-6 h-0.5 rounded-full ${
                  isAdmin 
                    ? 'bg-gradient-to-r from-[#ffd700] via-[#ff9800] to-[#ff35bb]' 
                    : 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff]'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
