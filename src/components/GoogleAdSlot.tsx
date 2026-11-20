import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Play, Smartphone, Sparkles } from 'lucide-react';
import { AppBannerConfig } from '../types';

interface GoogleAdSlotProps {
  slotName?: string;
  format?: 'banner' | 'infeed' | 'rectangle' | 'compact';
  config?: AppBannerConfig;
  className?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
}

const SLOT_PROMO_COPY: Record<string, { kicker: string; title: string; subtitle: string; cta: string }> = {
  'home-top': {
    kicker: 'Partner · SUZIKA Stream',
    title: '৫০০+ এক্সক্লুসিভ HD ফটো ও ফুলস্ক্রিন রিলস',
    subtitle: 'অ্যান্ড্রয়েড অ্যাপে দ্রুত লোডিং এবং স্মুথ প্লেব্যাক উপভোগ করুন',
    cta: 'অ্যাপ দেখুন',
  },
  'home-middle': {
    kicker: 'Sponsored · Native',
    title: 'নতুন ভিডিও রিলস ও প্রিমিয়াম গ্যালারি কালেকশন',
    subtitle: 'প্রতিদিন নতুন স্লট ও লাইভ কমিউনিটি আপডেট যুক্ত হচ্ছে',
    cta: 'বিস্তারিত',
  },
  'home-bottom': {
    kicker: 'Partner · Mobile',
    title: 'SUZIKA Call Pic অফিশিয়াল Android APK',
    subtitle: 'এক ক্লিকে ফোনে ইনস্টল করে সম্পূর্ণ গ্যালারি আনলক করুন',
    cta: 'ইনস্টল করুন',
  },
  'sponsored-banner': {
    kicker: 'Sponsored Partner',
    title: 'বিশেষ স্পনসরড অফার ও HD রিলস',
    subtitle: 'অ্যাডস্টেরা ও গুগল পার্টনার নেটওয়ার্ক স্লট',
    cta: 'ভিজিট করুন',
  },
};

export const GoogleAdSlot: React.FC<GoogleAdSlotProps> = ({
  slotName = 'general-ad',
  format = 'banner',
  config,
  className = '',
  title,
  subtitle,
  ctaText,
}) => {
  const insRef = useRef<HTMLModElement>(null);
  const [adsenseFilled, setAdsenseFilled] = useState(false);

  const isEnabled = Boolean(config?.enableAds || config?.enableWebAdSense);
  const adsenseClient = (config?.adsenseClientId || config?.googleAdClient || '').trim();
  const rawSlot =
    format === 'infeed'
      ? config?.adsenseInfeedSlot || config?.googleAdSlotRewarded || ''
      : config?.adsenseBannerSlot || config?.googleAdSlotBanner || '';
  const adsenseSlot = rawSlot.includes('/') ? rawSlot.split('/').pop() || '' : rawSlot.trim();
  const isTestMode = config?.isTestMode === true;

  const webAdScriptUrl = (config?.webAdScriptUrl || '').trim() || 'https://bicea.org/14/093a72dbe61f55a96cba26f6e5414547';
  const adsterraBannerKey = (config?.adsterraBannerKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const webBannerImageUrl = (config?.webBannerImageUrl || '').trim();
  const webSmartLinkUrl = (config?.webSmartLinkUrl || '').trim();
  const webBannerClickUrl = (config?.webBannerClickUrl || webSmartLinkUrl || '').trim();
  const hasExternalLink = Boolean(webBannerClickUrl && webBannerClickUrl.startsWith('http'));

  // Inject AdSense script once and push slot; detect genuine fill vs empty box
  useEffect(() => {
    setAdsenseFilled(false);
    if (!isEnabled || !adsenseClient || !adsenseClient.startsWith('ca-pub-') || !adsenseSlot) return;

    const scriptId = 'google-adsense-script';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`;
      scriptTag.async = true;
      scriptTag.crossOrigin = 'anonymous';
      document.head.appendChild(scriptTag);
    }

    const insEl = insRef.current;
    const checkFillStatus = () => {
      if (!insEl) return;
      const status = insEl.getAttribute('data-ad-status');
      const hasIframe = Boolean(insEl.querySelector('iframe'));
      if (status === 'filled' && hasIframe && insEl.offsetHeight > 24) {
        setAdsenseFilled(true);
      } else if (status === 'unfilled') {
        setAdsenseFilled(false);
      }
    };

    const observer = insEl
      ? new MutationObserver(() => checkFillStatus())
      : null;
    if (insEl && observer) {
      observer.observe(insEl, { attributes: true, childList: true, subtree: true });
    }

    const pushTimer = window.setTimeout(() => {
      try {
        if (
          insEl &&
          !insEl.getAttribute('data-adsbygoogle-status') &&
          !insEl.dataset.suzikaPushed
        ) {
          insEl.dataset.suzikaPushed = 'true';
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        }
      } catch {
        // Ignore AdSense domain / blocker errors cleanly
      }
      window.setTimeout(checkFillStatus, 1400);
    }, 60);

    return () => {
      window.clearTimeout(pushTimer);
      observer?.disconnect();
    };
  }, [isEnabled, adsenseClient, adsenseSlot, slotName]);

  // Inject optional Adsterra Social Bar / Popunder script globally once & keep floating overlays inside viewport width
  useEffect(() => {
    if (!isEnabled || !webAdScriptUrl || !webAdScriptUrl.startsWith('https://')) return;
    const existing = document.querySelector(`script[data-suzika-web-ad="${webAdScriptUrl}"]`);
    if (!existing) {
      const s = document.createElement('script');
      s.src = webAdScriptUrl;
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      s.setAttribute('data-suzika-web-ad', webAdScriptUrl);
      document.head.appendChild(s);
    }

    const clampInjectedOverlays = () => {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      if (!vw) return;
      Array.from(document.body.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (child.id === 'root' || child.id === 'suzika-boot-splash' || child.tagName === 'SCRIPT') return;
        const maxAllowed = `${vw - 12}px`;
        if (child.style.maxWidth !== maxAllowed) {
          child.style.maxWidth = maxAllowed;
        }
        if (child.style.boxSizing !== 'border-box') {
          child.style.boxSizing = 'border-box';
        }
        const rect = child.getBoundingClientRect();
        if (rect.width > vw - 8 && child.style.width !== maxAllowed) {
          child.style.width = maxAllowed;
        }
        if (rect.right > vw) {
          child.style.left = '6px';
          child.style.right = '6px';
        } else if (rect.left < 0) {
          child.style.left = '6px';
        }
      });
    };

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(clampInjectedOverlays);
    });
    observer.observe(document.body, { childList: true, subtree: false });
    window.addEventListener('resize', clampInjectedOverlays);
    const settleTimer = window.setInterval(clampInjectedOverlays, 1200);
    clampInjectedOverlays();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', clampInjectedOverlays);
      window.clearInterval(settleTimer);
    };
  }, [isEnabled, webAdScriptUrl]);

  // Isolated srcDoc for Adsterra Banner (320x50 or 300x250)
  const adsterraIframeDoc = useMemo(() => {
    if (!adsterraBannerKey) return '';
    const isRect = format === 'infeed' || format === 'rectangle';
    const w = isRect ? 300 : 320;
    const h = isRect ? 250 : 50;
    return `<!doctype html><html><body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden;"><script type="text/javascript">atOptions={'key':'${adsterraBannerKey}','format':'iframe','height':${h},'width':${w},'params':{}};</script><script type="text/javascript" src="https://bicea.org/22/${adsterraBannerKey}"></script></body></html>`;
  }, [adsterraBannerKey, format]);

  if (!isEnabled) {
    return null;
  }

  const promoCopy = SLOT_PROMO_COPY[slotName] || {
    kicker: hasExternalLink ? 'Sponsored · Adsterra Partner' : 'SUZIKA · Mobile Showcase',
    title: title || config?.sponsorTitle || 'এক্সক্লুসিভ গ্যালারি ও ভিডিও রিলস',
    subtitle: subtitle || config?.sponsorSubtitle || 'দ্রুততম অভিজ্ঞতার জন্য অফিশিয়াল Android APK ব্যবহার করুন',
    cta: ctaText || (hasExternalLink ? 'অফার দেখুন' : 'ওপেন করুন'),
  };

  const handleFallbackClick = () => {
    if (hasExternalLink) {
      window.open(webBannerClickUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (config?.mobileAppInstallUrl && config.mobileAppInstallUrl.trim()) {
      window.dispatchEvent(new CustomEvent('suzika-open-install-modal'));
      return;
    }
    window.dispatchEvent(new CustomEvent('suzika-navigate-tab', { detail: slotName.includes('video') ? 'videos' : 'gallery' }));
  };

  const isCompact = format === 'compact';
  const isInfeed = format === 'infeed' || format === 'rectangle';

  // For ultra-compact sticky areas (like footer sticky bar above bottom nav):
  // If AdSense didn't fill AND no custom banner/Adsterra key/SmartLink is configured, stay completely collapsed
  // so it never clutters the mobile bottom viewport!
  const hasRealWebAdOrSponsor = adsenseFilled || Boolean(adsterraBannerKey) || Boolean(webBannerImageUrl && webBannerClickUrl) || hasExternalLink;
  if (isCompact && !hasRealWebAdOrSponsor && !isTestMode) {
    return (
      adsenseClient.startsWith('ca-pub-') && adsenseSlot ? (
        <div className="h-0 overflow-hidden opacity-0 pointer-events-none" aria-hidden="true">
          <ins
            key={`${adsenseClient}-${adsenseSlot}-${slotName}`}
            ref={insRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%' }}
            data-ad-client={adsenseClient}
            data-ad-slot={adsenseSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      ) : null
    );
  }

  return (
    <div className={`my-2.5 w-full max-w-full overflow-hidden ${className}`}>
      {/* Hidden AdSense probe until Google actually serves an ad; expands automatically when filled */}
      {adsenseClient && adsenseClient.startsWith('ca-pub-') && adsenseSlot && (
        <div
          className={
            adsenseFilled
              ? 'w-full max-w-full overflow-hidden rounded-2xl bg-[#111524] border border-[#252a3d] p-2 text-center mb-2'
              : 'h-0 overflow-hidden opacity-0 pointer-events-none'
          }
        >
          {adsenseFilled && (
            <div className="text-[10px] text-[#9da4b8] tracking-wide mb-1">
              Sponsored · Google Ad
            </div>
          )}
          <ins
            key={`${adsenseClient}-${adsenseSlot}-${slotName}`}
            ref={insRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: adsenseFilled ? (isCompact ? '50px' : '90px') : '0px' }}
            data-ad-client={adsenseClient}
            data-ad-slot={adsenseSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      )}

      {/* Priority 2: Adsterra Live Banner Zone (iframe 320x50 or 300x250) */}
      {!adsenseFilled && adsterraBannerKey && (
        <div className="w-full max-w-full overflow-hidden rounded-2xl bg-[#111524] border border-[#252a3d] p-2 flex flex-col items-center justify-center gap-1.5">
          <div className="w-full flex items-center justify-between px-1 text-[10px] text-[#9da4b8]">
            <span>Sponsored · Adsterra Network</span>
            {hasExternalLink && (
              <a
                href={webBannerClickUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="text-[#00d2ff] hover:underline font-medium"
              >
                Partner Offer
              </a>
            )}
          </div>
          <iframe
            title={`adsterra-${slotName}`}
            srcDoc={adsterraIframeDoc}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
            width={isInfeed ? 300 : 320}
            height={isInfeed ? 250 : 50}
            className="border-0 overflow-hidden max-w-full rounded-lg bg-[#0b0e18]"
          />
        </div>
      )}

      {/* Priority 3: Direct Uploaded / Partner Banner Image */}
      {!adsenseFilled && !adsterraBannerKey && webBannerImageUrl && webBannerClickUrl && (
        <a
          href={webBannerClickUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block w-full max-w-full overflow-hidden rounded-2xl bg-[#111524] border border-[#252a3d] hover:border-[#ff35bb]/50 transition-colors p-1.5"
        >
          <div className="flex items-center justify-between px-2 pb-1 text-[10px] text-[#9da4b8]">
            <span>Sponsored</span>
            <span className="inline-flex items-center gap-0.5 text-[#00d2ff]">
              Visit <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <img
            src={webBannerImageUrl}
            alt="Sponsored Banner"
            referrerPolicy="no-referrer"
            loading="lazy"
            className={`w-full rounded-xl object-cover ${isCompact ? 'max-h-14' : isInfeed ? 'max-h-48' : 'max-h-28'}`}
          />
        </a>
      )}

      {/* Priority 4: Sleek Compact Branded / Adsterra SmartLink Banner (Zero Empty Void!) */}
      {!adsenseFilled && !adsterraBannerKey && !(webBannerImageUrl && webBannerClickUrl) && (
        isCompact ? (
          <div
            onClick={handleFallbackClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleFallbackClick();
            }}
            className="w-full max-w-full min-h-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-[#111524] border border-[#252a3d] hover:border-[#ff35bb]/40 transition-colors flex items-center justify-between gap-2 sm:gap-3 cursor-pointer overflow-hidden"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-[#1a2038] border border-[#2b3456] flex items-center justify-center shrink-0 text-[#ff35bb]">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-white truncate">
                  {hasExternalLink ? 'Sponsored Partner Offer' : promoCopy.title}
                </div>
                <div className="text-[10px] text-[#9da4b8] truncate">
                  {hasExternalLink ? 'Adsterra Direct · ক্লিক করে দেখুন' : 'SUZIKA Official Mobile Experience'}
                </div>
              </div>
            </div>
            <span className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-[10px] sm:text-[11px] font-bold whitespace-nowrap shrink-0 flex items-center gap-1">
              <span>{hasExternalLink ? 'দেখুন' : 'ওপেন'}</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        ) : (
          <div
            onClick={handleFallbackClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleFallbackClick();
            }}
            className={`w-full max-w-full rounded-2xl bg-gradient-to-r from-[#13182b] via-[#111524] to-[#19142b] border border-[#272e47] hover:border-[#ff35bb]/45 transition-all cursor-pointer overflow-hidden ${
              isInfeed ? 'p-3 sm:p-4' : 'px-2.5 sm:px-3.5 py-2.5 sm:py-3'
            }`}
          >
            <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#ff35bb]/20 to-[#8b4dff]/20 border border-[#ff35bb]/30 flex items-center justify-center shrink-0 text-[#ff6cd0]">
                  {hasExternalLink ? (
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : slotName.includes('video') ? (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-[#8b4dff] text-[#8b4dff]" />
                  ) : (
                    <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#00d2ff]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#9da4b8] truncate">
                    <span className="truncate">{isTestMode ? 'Test Mode' : promoCopy.kicker}</span>
                    {hasExternalLink && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-300 font-medium shrink-0">Direct Link</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                    {title || promoCopy.title}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-[#9da4b8] truncate">
                    {subtitle || promoCopy.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFallbackClick();
                }}
                className="min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] hover:brightness-110 active:scale-95 text-white text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 shadow-md shadow-[#ff35bb]/20 transition-all"
              >
                <span>{ctaText || promoCopy.cta}</span>
                <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};
