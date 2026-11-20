import React, { useState, useRef } from 'react';
import { X, Heart, User, Phone, Camera, Check, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { UserAccount } from '../types';
import { soundFX } from '../utils/audio';

interface UserAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (account: UserAccount) => void;
  actionReason?: string; // e.g. 'লাইক দিতে', 'কমেন্ট করতে'
}

// Preset attractive vector avatars for profile selection
const AVATAR_PRESETS = [
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23ff35bb'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23ffffff'/%3E%3Cpath d='M20 85c0-16.6 13.4-30 30-30s30 13.4 30 30' fill='%23ffffff'/%3E%3C/svg%3E",
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%238b4dff'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23ffffff'/%3E%3Cpath d='M20 85c0-16.6 13.4-30 30-30s30 13.4 30 30' fill='%23ffffff'/%3E%3C/svg%3E",
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%2300d2ff'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23ffffff'/%3E%3Cpath d='M20 85c0-16.6 13.4-30 30-30s30 13.4 30 30' fill='%23ffffff'/%3E%3C/svg%3E",
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23ff9900'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23ffffff'/%3E%3Cpath d='M20 85c0-16.6 13.4-30 30-30s30 13.4 30 30' fill='%23ffffff'/%3E%3C/svg%3E",
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%2300cc88'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23ffffff'/%3E%3Cpath d='M20 85c0-16.6 13.4-30 30-30s30 13.4 30 30' fill='%23ffffff'/%3E%3C/svg%3E",
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e02424'/%3E%3Ccircle cx='50' cy='40' r='20' fill='%23ffffff'/%3E%3Cpath d='M20 85c0-16.6 13.4-30 30-30s30 13.4 30 30' fill='%23ffffff'/%3E%3C/svg%3E"
];

export const UserAccountModal: React.FC<UserAccountModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  actionReason = 'লাইক দিতে',
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>(AVATAR_PRESETS[0]);
  const [isCustomPhoto, setIsCustomPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle uploading custom photo from mobile or computer
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('দয়া করে সঠিক ছবি (JPG, PNG) নির্বাচন করুন');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      if (dataUri) {
        setAvatarUrl(dataUri);
        setIsCustomPhoto(true);
        soundFX.playSuccess();
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg('দয়া করে আপনার সঠিক নাম লিখুন (কমপক্ষে ২ অক্ষর)');
      return;
    }

    // Phone validation - at least 8 digits
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 9) {
      setErrorMsg('দয়া করে সঠিক মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)');
      return;
    }

    setIsSubmitting(true);
    soundFX.playHeart();

    const newAccount: UserAccount = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      phone: trimmedPhone,
      avatarUrl: avatarUrl || AVATAR_PRESETS[0],
      avatarText: trimmedName.charAt(0).toUpperCase(),
      joinedDate: new Date().toLocaleDateString('bn-BD', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      createdAtMs: Date.now(),
      likedPhotoIds: [],
      likedVideoIds: [],
    };

    setTimeout(() => {
      onRegister(newAccount);
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#171c30] to-[#0c0f1c] border border-[#ff35bb]/40 rounded-3xl p-5 sm:p-6 shadow-[0_15px_50px_rgba(255,53,187,0.25)] text-white space-y-4 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-gradient-to-b from-[#ff35bb]/30 to-transparent blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => {
            soundFX.playPop();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-16 h-16 mx-auto rounded-2xl p-0.5 bg-gradient-to-tr from-[#ff35bb] via-[#f72585] to-[#00d2ff] shadow-lg shadow-[#ff35bb]/30 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-[#111526] flex items-center justify-center">
              <Heart className="w-8 h-8 text-[#ff35bb] fill-[#ff35bb] animate-pulse" />
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ff35bb]/20 border border-[#ff35bb]/40 text-[#ff8ce4] text-[10px] font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3 text-[#ff35bb]" />
              <span>একাউন্ট তৈরি আবশ্যক</span>
            </span>
            <h2 className="font-display font-black text-xl text-white">
              {actionReason} একাউন্ট খুলুন
            </h2>
            <p className="text-xs text-[#b8bfd6] max-w-xs mx-auto mt-1 leading-relaxed">
              ছবি ও ভিডিওতে লাইক দিতে আপনার নাম, মোবাইল নম্বর ও প্রোফাইল ছবি দিয়ে মাত্র ৩০ সেকেন্ডে ফ্রি একাউন্ট খুলুন।
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs text-center animate-in shake">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Profile Picture Chooser */}
          <div className="space-y-2 bg-[#0d1120] p-3 rounded-2xl border border-[#252c48]">
            <label className="block text-xs font-bold text-[#d5cce7] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#ff35bb]" />
                <span>প্রোফাইল ছবি নির্বাচন করুন (বা নিজের ছবি দিন)</span>
              </span>
              {isCustomPhoto && (
                <span className="text-[10px] text-emerald-400 font-normal">✓ ডিভাইসের ছবি নির্বাচিত</span>
              )}
            </label>

            {/* Current Selected Avatar Preview & Upload Trigger */}
            <div className="flex items-center gap-3">
              <div className="relative group shrink-0">
                <img
                  src={avatarUrl}
                  alt="Selected Avatar"
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#ff35bb] shadow-md shadow-[#ff35bb]/30"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="ছবি বদলান"
                >
                  <Upload className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="flex-1 space-y-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#1b223c] hover:bg-[#252f52] border border-[#2e3759] text-xs text-[#00d2ff] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>ফোন বা কম্পিউটার থেকে ছবি আপলোড</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <span className="text-[10px] text-[#8e98b7] block text-center">
                  বা নিচের যেকোনো একটি রেডি অবতার বেছে নিন:
                </span>
              </div>
            </div>

            {/* Ready Preset Avatars */}
            <div className="grid grid-cols-6 gap-1.5 pt-1">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    setAvatarUrl(preset);
                    setIsCustomPhoto(false);
                  }}
                  className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                    avatarUrl === preset && !isCustomPhoto
                      ? 'border-[#ff35bb] scale-105 shadow-md shadow-[#ff35bb]/40'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                  {avatarUrl === preset && !isCustomPhoto && (
                    <div className="absolute inset-0 bg-[#ff35bb]/30 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Full Name Input */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#d5cce7] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#00d2ff]" />
              <span>আপনার নাম *</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: সোহেল রানা বা রিয়া আক্তার"
              className="w-full bg-[#0d1120] border border-[#252c48] focus:border-[#ff35bb] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#606984] focus:outline-none transition-colors"
            />
          </div>

          {/* Mobile Phone Number Input */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#d5cce7] flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>মোবাইল নম্বর (Phone Number) *</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="017XXXXXXXX বা 01XXXXXXXXX"
                className="w-full bg-[#0d1120] border border-[#252c48] focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#606984] focus:outline-none transition-colors font-mono"
              />
            </div>
            <span className="text-[10px] text-[#8e98b7] block">
              🔒 আপনার নম্বর নিরাপদ থাকবে এবং সুজিকার ভিআইপি তালিকায় যুক্ত হবে।
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#f72585] to-[#8b4dff] text-white text-xs font-black shadow-lg shadow-[#ff35bb]/35 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Heart className="w-4 h-4 fill-white" />
            <span>
              {isSubmitting ? 'একাউন্ট তৈরি হচ্ছে...' : 'একাউন্ট তৈরি করুন এবং লাইক দিন ❤️'}
            </span>
          </button>

          {/* Secure & Privacy Note */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#8e98b7] pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>১০০% নিরাপদ ও ইনস্ট্যান্ট ভেরিফিকেশন</span>
          </div>
        </form>
      </div>
    </div>
  );
};
