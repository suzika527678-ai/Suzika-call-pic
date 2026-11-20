import React from 'react';

// Sleek dark-mode branded placeholder for photos
const PHOTO_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 750'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23191c2b'/%3E%3Cstop offset='50%25' stop-color='%23131726'/%3E%3Cstop offset='100%25' stop-color='%230b0d17'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3Ccircle cx='300' cy='340' r='54' fill='%23ff35bb' fill-opacity='0.12' stroke='%23ff35bb' stroke-width='2' stroke-dasharray='4 4'/%3E%3Cpath d='M285 340h30M300 325v30' stroke='%23ff35bb' stroke-width='3' stroke-linecap='round'/%3E%3Ctext x='300' y='430' fill='%238890aa' font-family='sans-serif' font-size='16' text-anchor='middle' font-weight='500'%3ESUZIKA Media%3C/text%3E%3C/svg%3E";

// Sleek dark-mode branded placeholder for video reels
const VIDEO_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 750'%3E%3Cdefs%3E%3ClinearGradient id='vg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%231d1633'/%3E%3Cstop offset='50%25' stop-color='%23111424'/%3E%3Cstop offset='100%25' stop-color='%23080a12'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23vg)'/%3E%3Ccircle cx='300' cy='340' r='54' fill='%2300d2ff' fill-opacity='0.12' stroke='%2300d2ff' stroke-width='2'/%3E%3Cpolygon points='290,320 322,340 290,360' fill='%2300d2ff'/%3E%3Ctext x='300' y='430' fill='%238890aa' font-family='sans-serif' font-size='16' text-anchor='middle' font-weight='500'%3ESUZIKA Reel%3C/text%3E%3C/svg%3E";

/**
 * Returns a guaranteed valid branded SVG fallback image URL for a given photo slot.
 */
export function getPhotoFallbackUrl(_slotNumber?: number): string {
  return PHOTO_PLACEHOLDER;
}

/**
 * Returns a guaranteed valid branded SVG fallback thumbnail URL for a given video slot.
 */
export function getVideoThumbnailFallbackUrl(_slotNumber?: number): string {
  return VIDEO_PLACEHOLDER;
}

/**
 * Gracefully handles img onError by swapping to fallback without recursive loops.
 */
export function handleImageFallback(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackUrl: string
): void {
  const img = event.currentTarget;
  if (!img) return;
  if (img.src !== fallbackUrl) {
    img.src = fallbackUrl;
  }
}

