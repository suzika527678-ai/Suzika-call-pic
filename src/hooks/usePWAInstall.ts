import { useCallback, useEffect, useState } from 'react';
import {
  isAndroidMobileDevice,
  isInAppSocialBrowser,
  isIOSDevice,
  isStandaloneApp,
} from '../utils/deviceDetection';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? ((window as any).__suzikaDeferredInstallPrompt as BeforeInstallPromptEvent) || null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneApp());
  const [isIOS] = useState<boolean>(() => isIOSDevice());
  const [isAndroid] = useState<boolean>(() => isAndroidMobileDevice());
  const [isInAppBrowser] = useState<boolean>(() => isInAppSocialBrowser());

  useEffect(() => {
    setIsInstalled(isStandaloneApp());

    if (typeof window !== 'undefined' && (window as any).__suzikaDeferredInstallPrompt) {
      setDeferredPrompt((window as any).__suzikaDeferredInstallPrompt as BeforeInstallPromptEvent);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__suzikaDeferredInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handlePromptReady = () => {
      if ((window as any).__suzikaDeferredInstallPrompt) {
        setDeferredPrompt((window as any).__suzikaDeferredInstallPrompt as BeforeInstallPromptEvent);
      }
    };

    const handleAppInstalled = () => {
      (window as any).__suzikaDeferredInstallPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('suzika-pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('suzika-pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    const promptEvt =
      deferredPrompt ||
      (typeof window !== 'undefined'
        ? ((window as any).__suzikaDeferredInstallPrompt as BeforeInstallPromptEvent | null)
        : null);

    if (!promptEvt) return false;

    try {
      await promptEvt.prompt();
      const { outcome } = await promptEvt.userChoice;
      if (outcome === 'accepted') {
        (window as any).__suzikaDeferredInstallPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        return true;
      }
    } catch {
      // Browser declined or prompt already consumed
    }
    return false;
  }, [deferredPrompt]);

  return {
    deferredPrompt,
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isInAppBrowser,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
