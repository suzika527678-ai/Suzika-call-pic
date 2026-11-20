import React, { useState } from 'react';
import { X, User, Phone, Camera, Check, AlertCircle, Sparkles } from 'lucide-react';
import { soundFX } from '../utils/audio';
import { compressImageFile } from '../utils/imageCompressor';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (name: string, phone: string, avatarUrl?: string) => void;
  initialName?: string;
  initialPhone?: string;
  initialAvatarUrl?: string;
  isEditing?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  initialName = '',
  initialPhone = '',
  initialAvatarUrl = '',
  isEditing = false,
}) => {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError('অনুগ্রহ করে আপনার নাম লিখুন।');
      soundFX.playPop();
      return;
    }

    if (!cleanPhone || cleanPhone.length < 6) {
      setError('সঠিক মোবাইল নম্বর দিন (কমপক্ষে ৬-১৫ সংখ্যা)।');
      soundFX.playPop();
      return;
    }

    setError(null);
    soundFX.playSuccess();
    onLogin(cleanName, cleanPhone, avatarUrl);
    onClose();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressed = await compressImageFile(file, 400, 0.7);
      setAvatarUrl(compressed);
      soundFX.playSuccess();
    } catch {
      setError('ছবি প্রসেস করা যায়নি। অনুগ্রহ করে অন্য ছবি নির্বাচন করুন।');
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#1b152d] via-[#111422] to-[#0c0f1a] border border-[#ff35bb]/40 shadow-2xl shadow-[#ff35bb]/20 p-5 relative overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Glow ambient accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff35bb]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252a3d] relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-[10px] bg-[#111524] flex items-center justify-center text-white">
                <User className="w-4 h-4 text-[#ff35bb]" />
              </div>
            </div>
            <div>
              <h3 className="font-display font-black text-base text-white">
                {isEditing ? 'প্রোফাইল তথ্য এডিট' : 'ইউজার লগইন'}
              </h3>
              <p className="text-[11px] text-[#9da4b8]">
                {isEditing ? 'আপনার নাম ও মোবাইল আপডেট করুন' : 'নাম ও মোবাইল নম্বর দিয়ে প্রবেশ করুন'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#1b2034] hover:bg-[#28304f] text-[#9da4b8] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 relative z-10">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Avatar Preview & Upload */}
          <div className="flex items-center gap-3 bg-[#0d101c] p-2.5 rounded-2xl border border-[#252a3d]">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#ff35bb]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#ff35bb]/30 to-[#8b4dff]/30 border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                  {name ? name.charAt(0).toUpperCase() : <User className="w-5 h-5 text-[#9da4b8]" />}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <input
                type="file"
                accept="image/*"
                id="login-modal-pic-input"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                type="button"
                onClick={() => document.getElementById('login-modal-pic-input')?.click()}
                disabled={isCompressing}
                className="px-2.5 py-1.5 rounded-xl bg-[#1a2034] hover:bg-[#252e4b] text-white text-xs font-semibold border border-[#2d3550] flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Camera className="w-3.5 h-3.5 text-[#ff35bb]" />
                <span>{isCompressing ? 'প্রসেসিং...' : avatarUrl ? 'ছবি পরিবর্তন' : 'ছবি যোগ করুন (ঐচ্ছিক)'}</span>
              </button>
            </div>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl('')}
                className="text-[11px] text-red-400 hover:text-red-300 px-1"
              >
                মুছুন
              </button>
            )}
          </div>

          {/* Name Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white flex items-center gap-1">
              <span>আপনার নাম</span>
              <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="যেমন: সাকিব হাসান / Sakib"
              className="w-full bg-[#0d101c] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Mobile Number Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white flex items-center gap-1">
              <Phone className="w-3 h-3 text-emerald-400" />
              <span>মোবাইল নম্বর</span>
              <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError(null);
              }}
              placeholder="যেমন: 017XXXXXXXX বা 018XXXXXXXX"
              className="w-full bg-[#0d101c] border border-[#252a3d] focus:border-[#00d2ff] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-[#9da4b8]/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-black shadow-lg shadow-[#ff35bb]/20 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isEditing ? 'তথ্য আপডেট করুন' : 'লগইন করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
