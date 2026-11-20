import React, { useId } from 'react';

interface SuzikaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SuzikaLogoProps['size']>, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
  xl: 'w-16 h-16 rounded-2xl',
};

export const SuzikaLogo: React.FC<SuzikaLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradId = `suzikaLogoGrad_${uid}`;
  const glowId = `suzikaLogoGlow_${uid}`;

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#0d101b] select-none flex items-center justify-center shadow-[0_0_18px_rgba(255,53,187,0.35)] ${SIZE_CLASSES[size]} ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        className="w-full h-full block"
        aria-label="SUZIKA Call Pic Logo"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff35bb" />
            <stop offset="50%" stopColor="#8b4dff" />
            <stop offset="100%" stopColor="#00d2ff" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          x="20"
          y="20"
          width="472"
          height="472"
          rx="112"
          fill="#0d101b"
          stroke={`url(#${gradId})`}
          strokeWidth="26"
        />
        <path
          d="M150 154 H362 L176 358 H362"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="64"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />
      </svg>
    </div>
  );
};

