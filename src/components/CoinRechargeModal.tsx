import React, { useState } from 'react';
import { X, Coins, Copy, Check, Send, Clock, CheckCircle2, XCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { AppBannerConfig, CoinPackage, CoinRechargeRequest, UserProfile } from '../types';
import { COIN_PACKAGES } from '../data/initialData';
import { soundFX } from '../utils/audio';
import { copyToClipboard } from '../utils/clipboard';

interface CoinRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  bannerConfig?: AppBannerConfig;
  userProfile: UserProfile;
  userRequests: CoinRechargeRequest[];
  onSubmitRechargeRequest: (payload: {
    name: string;
    phone: string;
    method: 'bkash' | 'nagad' | 'rocket';
    pkg: CoinPackage;
    trxId: string;
    targetNumber: string;
  }) => Promise<void> | void;
}

const PAYMENT_METHODS: Array<{
  id: 'bkash' | 'nagad' | 'rocket';
  name: string;
  bangla: string;
  badgeColor: string;
  borderActive: string;
  bgActive: string;
}> = [
  {
    id: 'bkash',
    name: 'bKash',
    bangla: 'বিকাশ (Personal)',
    badgeColor: 'text-[#ff4da6]',
    borderActive: 'border-[#e2136e]',
    bgActive: 'bg-[#e2136e]/15',
  },
  {
    id: 'nagad',
    name: 'Nagad',
    bangla: 'নগদ (Personal)',
    badgeColor: 'text-[#fb923c]',
    borderActive: 'border-[#f6921e]',
    bgActive: 'bg-[#f6921e]/15',
  },
  {
    id: 'rocket',
    name: 'Rocket',
    bangla: 'রকেট (Personal)',
    badgeColor: 'text-[#c084fc]',
    borderActive: 'border-[#8c3494]',
    bgActive: 'bg-[#8c3494]/20',
  },
];

export const CoinRechargeModal: React.FC<CoinRechargeModalProps> = ({
  isOpen,
  onClose,
  bannerConfig,
  userProfile,
  userRequests,
  onSubmitRechargeRequest,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage>(COIN_PACKAGES[1]);
  const [method, setMethod] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [accountPhone, setAccountPhone] = useState(userProfile.phone || '');
  const [trxId, setTrxId] = useState('');
  const [copiedNum, setCopiedNum] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedNotice, setSubmittedNotice] = useState('');

  if (!isOpen) return null;

  const targetNumber =
    method === 'bkash'
      ? (bannerConfig?.bkashNumber || '').trim()
      : method === 'nagad'
      ? (bannerConfig?.nagadNumber || '').trim()
      : (bannerConfig?.rocketNumber || '').trim();

  const isLoggedInUser = Boolean(userProfile.isLoggedIn && userProfile.phone);

  const handleCopyNumber = async () => {
    if (!targetNumber) return;
    soundFX.playPop();
    await copyToClipboard(targetNumber);
    setCopiedNum(true);
    setTimeout(() => setCopiedNum(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmittedNotice('');

    if (!targetNumber) {
      setErrorMsg(`অ্যাডমিন এখনো ${method.toUpperCase()} পেমেন্ট নম্বর সেট করেননি।`);
      return;
    }

    const finalPhone = (userProfile.phone || accountPhone).trim();
    const finalName = (userProfile.name || `User ${finalPhone.slice(-4) || 'VIP'}`).trim();
    const cleanTrx = trxId.trim().toUpperCase();

    if (finalPhone.length < 6) {
      setErrorMsg('আপনার ইউজার একাউন্ট নম্বর (মোবাইল) দিন যাতে কয়েন ওই একাউন্টে যোগ হয়।');
      return;
    }
    if (cleanTrx.length < 4) {
      setErrorMsg('সঠিক Transaction ID (TrxID) লিখুন।');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitRechargeRequest({
        name: finalName,
        phone: finalPhone,
        method,
        pkg: selectedPackage,
        trxId: cleanTrx,
        targetNumber,
      });
      soundFX.playSuccess();
      setTrxId('');
      setSubmittedNotice(
        `ধন্যবাদ! আপনার ${selectedPackage.coins} কয়েনের (${method.toUpperCase()} · TrxID: ${cleanTrx}) রিকোয়েস্ট জমা হয়েছে। অ্যাডমিন অ্যাপ্রুভ করলেই আপনার একাউন্টে কয়েন যোগ হবে।`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'পেমেন্ট রিকোয়েস্ট পাঠানো যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[370] bg-black/90 backdrop-blur-xl flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Coin Recharge"
    >
      <div className="relative w-full max-w-lg bg-[#111522] border border-[#ff35bb]/40 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Bar */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-[#231036] via-[#151a2e] to-[#112238] border-b border-[#252a3d] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-[#ff35bb] flex items-center justify-center text-black shadow-lg">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">Coin Recharge (কয়েন কিনুন)</h2>
              <p className="text-[11px] text-[#9da4b8]">
                বর্তমান ব্যালেন্স: <span className="text-amber-300 font-bold">{userProfile.coins || 0} Coins</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Close recharge modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Step 1: Coin Packages */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white block">
              ১. কয়েন প্যাকেজ সিলেক্ট করুন:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COIN_PACKAGES.map((pkg) => {
                const isSelected = selectedPackage.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      setSelectedPackage(pkg);
                    }}
                    className={`relative p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#ff35bb]/20 to-[#8b4dff]/20 border-[#ff35bb] shadow-lg shadow-[#ff35bb]/15'
                        : 'bg-[#151a2d] border-[#252a3d] hover:border-[#3c4666]'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black uppercase">
                        Popular
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 font-display font-black text-base text-white">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>{pkg.coins}</span>
                    </div>
                    <div className="text-xs font-bold text-[#00d2ff] mt-0.5">
                      ৳{pkg.priceBdt} টাকা
                    </div>
                    {pkg.bonusLabel && (
                      <div className="text-[10px] text-[#9da4b8] mt-0.5">{pkg.bonusLabel}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Choose Payment Method (bKash / Nagad / Rocket) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white block">
              ২. পেমেন্ট মাধ্যম নির্বাচন করুন (bKash / Nagad / Rocket):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const active = method === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      soundFX.playPop();
                      setMethod(pm.id);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      active
                        ? `${pm.bgActive} ${pm.borderActive} shadow-md`
                        : 'bg-[#151a2d] border-[#252a3d] hover:border-[#3c4666]'
                    }`}
                  >
                    <div className={`text-sm font-black ${pm.badgeColor}`}>{pm.name}</div>
                    <div className="text-[10px] text-[#9da4b8] mt-0.5">{pm.bangla}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin Payment Number Box */}
          <div className="p-3.5 rounded-2xl bg-[#080a12] border border-emerald-500/35 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#9da4b8]">
              <span className="font-semibold text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>এই {method.toUpperCase()} নম্বরে Send Money করুন:</span>
              </span>
              <span className="font-bold text-amber-300">৳{selectedPackage.priceBdt}</span>
            </div>

            {targetNumber ? (
              <>
                <div className="flex items-center justify-between gap-2 bg-[#111522] border border-[#252a3d] rounded-xl px-3 py-2">
                  <span className="font-mono text-base sm:text-lg font-black text-white tracking-wider">
                    {targetNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyNumber}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    {copiedNum ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedNum ? 'Copied' : 'কপি করুন'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-[#9da4b8] leading-relaxed">
                  উপরের নম্বরে <span className="text-white font-bold">৳{selectedPackage.priceBdt} টাকা Send Money</span> করার পর নিচে আপনার <span className="text-white font-bold">Transaction ID (TrxID)</span> দিন।
                </p>
              </>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                অ্যাডমিন প্যানেল থেকে এখনো {method.toUpperCase()} নম্বর সেট করা হয়নি।
              </div>
            )}
          </div>

          {/* Step 3: User Account + ONLY Transaction ID (TrxID) */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {isLoggedInUser ? (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#151a2d] border border-emerald-500/35 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-[#9da4b8] truncate">
                    ইউজার একাউন্ট: <strong className="text-white">{userProfile.name || 'Member'}</strong>{' '}
                    <span className="font-mono text-emerald-300">({userProfile.phone})</span>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                  Active
                </span>
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-bold text-[#d5cce7] block mb-1">
                  ইউজার একাউন্ট (আপনার মোবাইল নম্বর) *
                </label>
                <div className="relative">
                  <Smartphone className="w-3.5 h-3.5 text-[#9da4b8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={accountPhone}
                    onChange={(e) => setAccountPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-[#080a12] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl pl-8 pr-3 py-2.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-[#d5cce7] block mb-1">
                Transaction ID (TrxID) *
              </label>
              <input
                type="text"
                required
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder="যেমন: 9GH7K2M1P4"
                className="w-full bg-[#080a12] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2.5 text-xs text-white uppercase font-mono focus:outline-none"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
                {errorMsg}
              </div>
            )}

            {submittedNotice && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs leading-relaxed">
                {submittedNotice}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !targetNumber}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-[#ff35bb]/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'জমা হচ্ছে...'
                  : `পেমেন্ট কনফার্ম করুন (${selectedPackage.coins} Coins - ৳${selectedPackage.priceBdt})`}
              </span>
            </button>
          </form>

          {/* Recent User Recharge History */}
          {userRequests.length > 0 && (
            <div className="pt-2 border-t border-[#252a3d] space-y-2">
              <h3 className="text-xs font-bold text-[#d5cce7]">আপনার সাম্প্রতিক রিচার্জ রিকোয়েস্ট:</h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {userRequests.slice(0, 6).map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-xl bg-[#0b0e18] border border-[#252a3d] flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {req.coins} Coins · ৳{req.amountBdt} ({req.method.toUpperCase()})
                      </div>
                      <div className="text-[10px] text-[#9da4b8] font-mono">
                        TrxID: {req.trxId} · {req.createdAt}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                        req.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : req.status === 'rejected'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {req.status === 'approved' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : req.status === 'rejected' ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>
                        {req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
