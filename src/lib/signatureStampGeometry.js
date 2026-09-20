export const STAMP_CANVAS_WIDTH = 900;
export const STAMP_CANVAS_HEIGHT = 240;
export const STAMP_WIDTH_PERCENT = 32;
/** Seals may be tall (badge, hexagon, dark card) — cap their page footprint too. */
export const STAMP_HEIGHT_PERCENT = 14;
/** Text fields occupy this slice of the page, on screen and in the written PDF. */
export const TEXT_WIDTH_PERCENT = 26;
export const TEXT_HEIGHT_PERCENT = 5.5;
export const STAMP_MIN_SCALE = 65;
export const STAMP_MAX_SCALE = 135;
export const STAMP_FALLBACK_SPOT = Object.freeze({ page: -1, x: 70, y: 85 });

export const clampStampScale = (value) =>
  Math.min(STAMP_MAX_SCALE, Math.max(STAMP_MIN_SCALE, Number(value) || 100));

export const stampAspectRatio = STAMP_CANVAS_HEIGHT / STAMP_CANVAS_WIDTH;

/**
 * Fits a seal of any shape inside the same page budget: a wide row is bound by
 * width, a tall badge by height, so switching seal design never changes how much
 * of the page the signature swallows.
 */
export function fitStampSize(pageWidth, pageHeight, ratio, fieldScale = 1) {
  const maxWidth = pageWidth * (STAMP_WIDTH_PERCENT / 100) * fieldScale;
  const maxHeight = pageHeight * (STAMP_HEIGHT_PERCENT / 100) * fieldScale;
  const safeRatio = Number(ratio) > 0 ? Number(ratio) : stampAspectRatio;
  const width = Math.min(maxWidth, maxHeight / safeRatio);
  return { width, height: width * safeRatio };
}