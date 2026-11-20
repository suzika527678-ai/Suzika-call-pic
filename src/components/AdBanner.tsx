import React from 'react';
import { AppBannerConfig } from '../types';
import { GoogleAdSlot } from './GoogleAdSlot';

interface AdBannerProps {
  slotName?: string;
  format?: 'banner' | 'rectangle' | 'native' | 'compact' | 'infeed';
  config?: AppBannerConfig;
  className?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  slotName = 'general',
  format = 'banner',
  config,
  className = '',
  title,
  subtitle,
  ctaText,
}) => {
  // Map format to GoogleAdSlot format
  const mappedFormat = format === 'native' ? 'infeed' : format === 'rectangle' ? 'banner' : format;

  return (
    <GoogleAdSlot
      slotName={slotName}
      format={mappedFormat}
      config={config}
      className={className}
      title={title}
      subtitle={subtitle}
      ctaText={ctaText}
    />
  );
};
