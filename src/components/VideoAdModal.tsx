import React from 'react';

// VideoAdModal has been retired in compliance with Google AdMob & AdSense policy:
// All simulated, fake commercial ads and countdown blockers have been removed.
// Real AdMob ads are delivered via native Android SDK in the APK build.
export const VideoAdModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdComplete: () => void;
  targetItemTitle?: string;
  targetType?: string;
  totalDuration?: number;
  bannerConfig?: any;
}> = ({ isOpen, onAdComplete }) => {
  React.useEffect(() => {
    if (isOpen) {
      onAdComplete();
    }
  }, [isOpen, onAdComplete]);

  return null;
};
