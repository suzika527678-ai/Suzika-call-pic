import React from 'react';
import { AppBannerConfig } from '../types';
import { GoogleAdSlot } from './GoogleAdSlot';

interface SponsoredBannerProps {
  config?: AppBannerConfig;
}

export const SponsoredBanner: React.FC<SponsoredBannerProps> = ({ config }) => {
  return <GoogleAdSlot slotName="sponsored-banner" format="banner" config={config} />;
};
