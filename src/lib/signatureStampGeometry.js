export const STAMP_CANVAS_WIDTH = 900;
export const STAMP_CANVAS_HEIGHT = 240;
export const STAMP_WIDTH_PERCENT = 32;
export const STAMP_MIN_SCALE = 65;
export const STAMP_MAX_SCALE = 135;
export const STAMP_FALLBACK_SPOT = Object.freeze({ page: -1, x: 70, y: 85 });

export const clampStampScale = (value) =>
  Math.min(STAMP_MAX_SCALE, Math.max(STAMP_MIN_SCALE, Number(value) || 100));

export const stampAspectRatio = STAMP_CANVAS_HEIGHT / STAMP_CANVAS_WIDTH;