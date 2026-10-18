/**
 * The platform's one archive rule — every section, both lanes.
 *
 * An item has one place at a time:
 *   pending                → «بانتظار» (or the section's open faces)
 *   decided (approved / refused / done / closed)
 *                          → its own face («معتمدة» · «مرفوضة» · «منجزة» · «مغلقة») until its effect ends:
 *                            ARCHIVE_AFTER_DAYS after the decision, and never before the effect itself ends
 *                            (an approved leave's last day, an open withdraw / objection window)
 *   then                   → «الأرشيف» only — it leaves the decided face.
 *   withdrawn / lapsed / void → «الأرشيف» at once: nothing is left to follow.
 *
 * Pure: callers pass the dates they own; nothing here reads a store.
 */

export const ARCHIVE_AFTER_DAYS = 30;
const DAY_MS = 86400000;

function toMs(value) {
  if (value == null || value === "") return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const text = String(value);
  // A bare day key holds until that day's end.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(`${text}T23:59:59`);
  return Date.parse(text);
}

/** When a decided item leaves its face for the archive (ms), or NaN when the decision time is unknown. */
export function archiveDueAt({ settledAt, holdUntil } = {}) {
  const settled = toMs(settledAt);
  if (!Number.isFinite(settled)) return NaN;
  const base = settled + ARCHIVE_AFTER_DAYS * DAY_MS;
  const holds = (Array.isArray(holdUntil) ? holdUntil : [holdUntil]).map(toMs).filter(Number.isFinite);
  return Math.max(base, ...holds);
}

/**
 * Is a settled item in the archive now?
 *  - `immediate` (withdrawn · lapsed · void): yes at once.
 *  - otherwise: once archiveDueAt has passed. An unknown decision time stays on its face (never lost).
 */
export function isPastArchiveDue({ settledAt, holdUntil, immediate = false } = {}, now = Date.now()) {
  if (immediate) return true;
  const due = archiveDueAt({ settledAt, holdUntil });
  return Number.isFinite(due) && toMs(now) > due;
}

/** Days left on the decided face — for a quiet «ينتقل للأرشيف بعد N يوماً» line. */
export function daysUntilArchive({ settledAt, holdUntil } = {}, now = Date.now()) {
  const due = archiveDueAt({ settledAt, holdUntil });
  if (!Number.isFinite(due)) return null;
  return Math.max(0, Math.ceil((due - toMs(now)) / DAY_MS));
}
