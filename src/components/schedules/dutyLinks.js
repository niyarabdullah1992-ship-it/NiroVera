/**
 * One link language for الحضور والدوام: every alert, row and card says where it is handled
 * with a small «افتح ›» in the same green, and every address is built here — so a row on
 * حضور الفريق, a card on جدول الدوام and an alert on بصمتي all point at the same places.
 *
 * Query params read by the pages (nothing else is invented):
 *   /app/shifts?lane=manage&emp=<id>&week=<yyyy-mm-dd>   → that person's row on the roster week
 *   /app/shifts?lane=manage&src=18632|3337|labour|all     → the compliance panel, filtered
 *   /app/shifts?week=<yyyy-mm-dd>&day=<yyyy-mm-dd>        → جدولي on that week, the day outlined
 *   /app/employees/<id>?tab=duty                          → the file's duty tab
 *   /app/employees/<id>?tab=duty&day=<yyyy-mm-dd>         → the file's duty tab on that day's week + year
 *   /app/attendance?tab=record&day=<yyyy-mm-dd>           → سجلي on that month, the day open
 *   /app/attendance?tab=record&focus=career               → سجلي, scrolled to «مسيرتي»
 *   /app/attendance?lane=manage&focus=queue               → حضور الفريق, scrolled to «يحتاج قرارك»
 */

export function openLinkStyle(extra = {}) {
  return {
    fontFamily: "inherit",
    fontSize: 11.5,
    fontWeight: 700,
    padding: "2px 0",
    border: "none",
    background: "transparent",
    color: "var(--nv-ok-ink)",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    letterSpacing: 0,
    ...extra,
  };
}

export function fileDutyHref(employeeId, { day = "", focus = "" } = {}) {
  if (!employeeId) return "";
  const qs = new URLSearchParams({ tab: "duty" });
  if (day) qs.set("day", String(day));
  if (focus) qs.set("focus", String(focus));
  return `/app/employees/${encodeURIComponent(employeeId)}?${qs.toString()}`;
}

/** سجلي on one day (its month, the day card open) — or on «مسيرتي» with `focus: "career"`. */
export function myRecordHref({ day = "", focus = "" } = {}) {
  const qs = new URLSearchParams({ tab: "record" });
  if (day) qs.set("day", String(day));
  if (focus) qs.set("focus", String(focus));
  return `/app/attendance?${qs.toString()}`;
}

export function rosterPersonHref(employeeId, weekKey = "") {
  const qs = new URLSearchParams({ lane: "manage" });
  if (employeeId) qs.set("emp", String(employeeId));
  if (weekKey) qs.set("week", String(weekKey));
  return `/app/shifts?${qs.toString()}`;
}

export function complianceHref(source = "all") {
  return `/app/shifts?lane=manage&src=${encodeURIComponent(source || "all")}`;
}

export function myRosterDayHref(dayKey = "") {
  if (!dayKey) return "/app/shifts";
  return `/app/shifts?week=${encodeURIComponent(dayKey)}&day=${encodeURIComponent(dayKey)}`;
}

export const TEAM_QUEUE_HREF = "/app/attendance?lane=manage&focus=queue";

/** Parse a yyyy-mm-dd query value into a local Date, or null. */
export function dateFromKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Scroll a node into view and flash it (respects reduced motion). */
export function revealNode(node, { block = "center" } = {}) {
  if (!node) return;
  let reduce = false;
  try {
    reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    reduce = false;
  }
  try {
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
  } catch {
    node.scrollIntoView();
  }
}
