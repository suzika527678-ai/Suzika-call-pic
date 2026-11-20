import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1.5rem)] flex items-center justify-center gap-2 rounded-full bg-amber-500/95 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-black shadow-lg shadow-amber-500/30 backdrop-blur-md border border-amber-300/60 text-center"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>অফলাইন মোড — সেভ করা কনটেন্ট দেখানো হচ্ছে</span>
    </div>
  );
};
