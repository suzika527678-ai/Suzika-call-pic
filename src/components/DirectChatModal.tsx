import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, MessageCircle, Phone, Sparkles, Check, Edit2, ShieldAlert } from 'lucide-react';
import { PhotoItem, ChatMessage } from '../types';
import { soundFX } from '../utils/audio';

interface DirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: PhotoItem | null;
  messages: ChatMessage[];
  onSendMessage: (text: string, photo?: PhotoItem | null) => void;
  currentUserId: string;
  currentUserName: string;
  onUpdateUserId: (userId: string, userName: string) => void;
}

export const DirectChatModal: React.FC<DirectChatModalProps> = ({
  isOpen,
  onClose,
  photo,
  messages,
  onSendMessage,
  currentUserId,
  currentUserName,
  onUpdateUserId,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSettingUpId, setIsSettingUpId] = useState(false);
  const [tempUserId, setTempUserId] = useState(currentUserId || '');
  const [tempUserName, setTempUserName] = useState(currentUserName || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if User ID is missing
  useEffect(() => {
    if (!currentUserId || currentUserId.trim() === '') {
      const defaultId = `@user_${Math.floor(1000 + Math.random() * 9000)}`;
      setTempUserId(defaultId);
      setTempUserName(currentUserName || 'Visitor');
      setIsSettingUpId(true);
    } else {
      setTempUserId(currentUserId);
      setTempUserName(currentUserName);
      setIsSettingUpId(false);
    }
  }, [currentUserId, currentUserName, isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Filter messages for this user (or all if user is talking to Suzika)
  const userMessages = messages.filter(
    (m) => m.userId === currentUserId || (m.sender === 'admin' && m.userId === currentUserId)
  );

  const handleSaveUserId = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanedId = tempUserId.trim();
    if (!cleanedId.startsWith('@')) {
      cleanedId = `@${cleanedId}`;
    }
    const cleanedName = tempUserName.trim() || 'Visitor';
    soundFX.playSuccess();
    onUpdateUserId(cleanedId, cleanedName);
    setIsSettingUpId(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (!currentUserId) {
      setIsSettingUpId(true);
      return;
    }
    soundFX.playPop();
    onSendMessage(inputText.trim(), photo);
    setInputText('');
  };

  const handleQuickPrompt = (prompt: string) => {
    soundFX.playPop();
    if (!currentUserId) {
      setIsSettingUpId(true);
      return;
    }
    onSendMessage(prompt, photo);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#0e1220] border border-[#2c334d] rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px] max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#252a3d] bg-gradient-to-r from-[#171c30] to-[#121626] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-[#ff35bb]/30">
                S
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0e1220]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-white text-sm">Suzika (সুজিকা)</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-[#ff8ce4] font-semibold border border-pink-500/30">
                  Owner
                </span>
              </div>
              <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Now · Direct SMS & Chat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* User ID Pill */}
            {currentUserId && !isSettingUpId && (
              <button
                onClick={() => setIsSettingUpId(true)}
                className="px-2.5 py-1 rounded-xl bg-[#1b2238] border border-[#2e3758] text-[11px] font-mono text-[#00d2ff] flex items-center gap-1 hover:border-[#00d2ff]/50"
                title="Change User ID"
              >
                <span>{currentUserId}</span>
                <Edit2 className="w-3 h-3 text-[#9da4b8]" />
              </button>
            )}
            <button
              onClick={() => {
                soundFX.playPop();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-[#1b2238] hover:bg-[#252d4a] text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User ID Setup Modal Overlay (if setting ID) */}
        {isSettingUpId ? (
          <div className="flex-1 p-6 flex flex-col justify-center items-center bg-[#0e1220]/95 backdrop-blur-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff35bb]/20 to-[#00d2ff]/20 border border-[#ff35bb]/40 flex items-center justify-center text-[#ff35bb] mb-3">
              <User className="w-7 h-7" />
            </div>
            <h3 className="font-display text-lg font-bold text-white mb-1">
              সুজিকার সাথে চ্যাট করতে User ID দিন
            </h3>
            <p className="text-xs text-[#9da4b8] max-w-xs mb-5">
              Enter your unique User ID & Name so Suzika can identify and reply to your messages.
            </p>

            <form onSubmit={handleSaveUserId} className="w-full max-w-xs space-y-3">
              <div className="text-left">
                <label className="text-[11px] font-semibold text-[#9da4b8] block mb-1">
                  User ID (ইউজার আইডি)
                </label>
                <input
                  type="text"
                  value={tempUserId}
                  onChange={(e) => setTempUserId(e.target.value)}
                  placeholder="@your_username"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151a2d] border border-[#2f3856] focus:border-[#ff35bb] text-sm font-mono text-white placeholder-white/30 focus:outline-none"
                />
              </div>

              <div className="text-left">
                <label className="text-[11px] font-semibold text-[#9da4b8] block mb-1">
                  Your Name (আপনার নাম)
                </label>
                <input
                  type="text"
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  placeholder="e.g. Tanvir / Fahim"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151a2d] border border-[#2f3856] focus:border-[#ff35bb] text-sm text-white placeholder-white/30 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                {currentUserId && (
                  <button
                    type="button"
                    onClick={() => setIsSettingUpId(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[#161b2e] border border-[#2c3450] text-xs font-semibold text-[#9da4b8] hover:text-white"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold shadow-lg shadow-[#ff35bb]/30 hover:opacity-95"
                >
                  Confirm & Chat
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Active Photo Reference Banner (if user came from a photo) */}
            {photo && (
              <div className="px-3.5 py-2 bg-[#14192b] border-b border-[#252a3d] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-[#2f3856] shrink-0">
                    {photo.imageUrl ? (
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">📸</div>
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-[11px] font-bold text-white truncate">{photo.title}</div>
                    <div className="text-[10px] text-[#ff35bb] font-mono">
                      Slot #{String(photo.slotNumber || 1).padStart(3, '0')} · {photo.category}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] bg-pink-500/20 text-[#ff8ce4] px-2 py-0.5 rounded-md shrink-0 font-medium border border-pink-500/30">
                  SMS on this photo
                </span>
              </div>
            )}

            {/* Chat Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0a0d17]/60">
              {userMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#9da4b8]">
                  <div className="w-12 h-12 rounded-full bg-[#171c30] flex items-center justify-center text-[#ff35bb] mb-2">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-white text-sm font-bold mb-1">সুজিকাকে সরাসরি মেসেজ পাঠান</h4>
                  <p className="text-xs max-w-xs text-[#9da4b8] mb-4">
                    Send a private SMS to Suzika regarding this photo, custom requests, or say hello!
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
                    <button
                      onClick={() => handleQuickPrompt(`Hi Suzika! Loved your ${photo?.title || 'photo'} 😍`)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#151a2d] border border-[#252a3d] text-[11px] text-[#d5cce7] hover:border-[#ff35bb] hover:text-white transition-all"
                    >
                      😍 Loved this picture!
                    </button>
                    <button
                      onClick={() => handleQuickPrompt('Are you free for video call? 📞')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#151a2d] border border-[#252a3d] text-[11px] text-[#d5cce7] hover:border-[#ff35bb] hover:text-white transition-all"
                    >
                      📞 Video call available?
                    </button>
                    <button
                      onClick={() => handleQuickPrompt('Hot look Suzika! 🔥')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#151a2d] border border-[#252a3d] text-[11px] text-[#d5cce7] hover:border-[#ff35bb] hover:text-white transition-all"
                    >
                      🔥 Hot look!
                    </button>
                  </div>
                </div>
              ) : (
                userMessages.map((msg) => {
                  const isMe = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in`}
                    >
                      {/* Photo preview attached to message if applicable */}
                      {msg.photoTitle && (
                        <div className="mb-1 text-[10px] text-[#9da4b8] flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#161b2e] border border-[#252a3d]">
                          <span>📸 Photo:</span>
                          <span className="text-white font-medium truncate max-w-[150px]">
                            {msg.photoTitle}
                          </span>
                        </div>
                      )}

                      <div className="flex items-end gap-1.5 max-w-[85%]">
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] flex items-center justify-center text-white text-[11px] font-bold shrink-0 mb-1">
                            S
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-xs ${
                            isMe
                              ? 'bg-gradient-to-r from-[#8b4dff] to-[#ff35bb] text-white rounded-br-sm shadow-md shadow-[#ff35bb]/20'
                              : 'bg-[#181d30] border border-[#2c3452] text-[#f7f7fb] rounded-bl-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1">
                            <span className="font-bold">
                              {isMe ? `${msg.userName || 'You'} (${msg.userId})` : 'Suzika (Owner)'}
                            </span>
                            <span>{msg.timestamp}</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Bar */}
            <div className="px-3 pt-2 bg-[#0e1220] flex gap-1.5 overflow-x-auto no-scrollbar border-t border-[#252a3d]/60">
              <button
                onClick={() => handleQuickPrompt('Loved this pic! 😍')}
                className="px-2.5 py-1 rounded-full bg-[#151a2d] hover:bg-[#1f2642] border border-[#252a3d] text-[10px] text-[#d5cce7] whitespace-nowrap"
              >
                😍 Loved this!
              </button>
              <button
                onClick={() => handleQuickPrompt('Call request 📞')}
                className="px-2.5 py-1 rounded-full bg-[#151a2d] hover:bg-[#1f2642] border border-[#252a3d] text-[10px] text-[#00d2ff] whitespace-nowrap"
              >
                📞 Call request
              </button>
              <button
                onClick={() => handleQuickPrompt('Hot photo 🔥')}
                className="px-2.5 py-1 rounded-full bg-[#151a2d] hover:bg-[#1f2642] border border-[#252a3d] text-[10px] text-[#ff8ce4] whitespace-nowrap"
              >
                🔥 Super hot
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-3 bg-[#0e1220] flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Type SMS to Suzika as ${currentUserId}...`}
                className="flex-1 bg-[#151a2d] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity shadow-md shadow-[#ff35bb]/20 font-semibold text-xs gap-1"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
