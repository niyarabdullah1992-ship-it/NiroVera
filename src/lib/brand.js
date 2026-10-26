/**
 * Brand assets live in /public. They are prefixed with Vite's BASE_URL so they
 * resolve both on the root deployment ("/") and in builds served from a
 * sub-path ("./"). Outside Vite (node scripts) the prefix falls back to "/".
 */
const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

/** Official NiroVera N mark (exact artwork). Icon-only on app chrome. */
export const POWERCARE_MARK_URL = `${BASE}nirovera-mark-v2.png`;

/** Same mark for green / dark surfaces: white body, gold slash, transparent ground. */
export const POWERCARE_MARK_ON_DARK_URL = `${BASE}nirovera-mark-ondark-v2.png`;

/** Full lockup — N mark + NiroVera wordmark (gold V). Marketing and legal. */
export const POWERCARE_LOGO_URL = `${BASE}nirovera-lockup-v2.svg`;
