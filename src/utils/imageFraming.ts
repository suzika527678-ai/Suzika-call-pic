/**
 * Computes a Tailwind object-position class based on the natural image aspect ratio
 * and its rendered container aspect ratio so subjects/faces stay dynamically centered
 * without important areas being cropped when using `object-cover`.
 */
export function getDynamicObjectPositionClass(
  naturalWidth?: number | null,
  naturalHeight?: number | null,
  containerWidth?: number | null,
  containerHeight?: number | null
): string {
  if (!naturalWidth || !naturalHeight || naturalWidth <= 0 || naturalHeight <= 0) {
    return 'object-[50%_24%]';
  }

  const natRatio = naturalWidth / naturalHeight;
  const boxRatio =
    containerWidth && containerHeight && containerHeight > 0
      ? containerWidth / containerHeight
      : 0.75;

  // Image is noticeably taller than its container -> vertical crop occurs:
  // Bias upward so heads, faces, and upper-body subjects stay centered in frame.
  if (natRatio < boxRatio * 0.8) {
    return 'object-[50%_18%]';
  }
  if (natRatio < boxRatio * 0.96) {
    return 'object-[50%_24%]';
  }

  // Image is noticeably wider than its container -> horizontal crop occurs:
  // Keep horizontal center, with slight upper bias for portraits/squares and dead center for wide landscapes.
  if (natRatio > boxRatio * 1.25) {
    return natRatio < 1.15 ? 'object-[50%_35%]' : 'object-center';
  }

  // Balanced aspect ratio: keep portraits slightly high and squares/landscapes centered.
  return natRatio < 0.95 ? 'object-[50%_28%]' : 'object-center';
}
