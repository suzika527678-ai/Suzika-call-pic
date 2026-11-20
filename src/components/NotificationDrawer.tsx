import React from 'react';
import { X, Bell, Heart, MessageSquare, ShieldCheck } from 'lucide-react';
import { soundFX } from '../utils/audio';

interface NotificationItem {
  id: string;
  type: 'admin' | 'comment' | 'like';
  title: string;
  message: string;
  time: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onClear: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#111522] border-l border-[#252a3d] h-full flex flex-col p-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#252a3d]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#ff35bb]" />
            <h3 className="font-display font-bold text-white text-base">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={onClear}
                className="text-[11px] text-[#9da4b8] hover:text-white underline"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => {
                soundFX.playPop();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-[#161a2b] hover:bg-[#252a3d] text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-[#9da4b8]">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">You are all caught up!</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#151a2d] border border-[#252a3d] hover:border-[#ff35bb]/40 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#202742] flex items-center justify-center shrink-0 mt-0.5">
                    {item.type === 'admin' && <ShieldCheck className="w-3.5 h-3.5 text-[#00d2ff]" />}
                    {item.type === 'like' && <Heart className="w-3.5 h-3.5 text-[#ff35bb]" />}
                    {item.type === 'comment' && <MessageSquare className="w-3.5 h-3.5 text-[#a855f7]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      <span className="text-[10px] text-[#9da4b8]">{item.time}</span>
                    </div>
                    <p className="text-xs text-[#d5cce7] mt-0.5 leading-relaxed">{item.message}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
