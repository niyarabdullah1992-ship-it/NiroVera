import { chip as baseChip } from "@/components/schedules/scheduleChrome";

/**
 * One colour and one word for every duty status in the employee lane
 * (بصمتي · سجلي · جدولي and the file duty tab):
 *   أخضر = في الوقت / مستوفى · ذهبي = متأخر / تنبيه · أحمر = غائب / مانع / مكشوف
 *   بيج = إجازة · رمادي = راحة
 * Tiles, calendar cells, day cards, rows and chips all read from here.
 */
export const DUTY_TONES = {
  ok: { soft: "var(--nv-ok-soft)", line: "var(--nv-ok-line)", ink: "var(--nv-ok-ink)", fill: "var(--nv-ok-fill)" },
  warn: { soft: "var(--nv-warn-soft)", line: "var(--nv-warn-line)", ink: "var(--nv-warn-ink)", fill: "var(--nv-warn-fill)" },
  bad: { soft: "var(--nv-bad-soft)", line: "var(--nv-bad-line)", ink: "var(--nv-bad-ink)", fill: "var(--nv-bad-fill)" },
  leave: { soft: "var(--nv-shift-leave)", line: "var(--nv-shift-leave-line)", ink: "var(--nv-shift-holiday-ink)", fill: "var(--nv-shift-leave-line)" },
  rest: { soft: "var(--nv-shift-rest)", line: "var(--nv-mute-line)", ink: "var(--nv-mute-ink)", fill: "var(--nv-mute-fill)" },
};

/** The status words — one per state, shared by every surface. */
export const DUTY_STATUS = {
  ontime: { ar: "في الوقت", en: "On time", tone: "ok" },
  present: { ar: "حاضر", en: "Present", tone: "ok" },
  out: { ar: "انصرفت", en: "Checked out", tone: "ok" },
  met: { ar: "مستوفى", en: "Met", tone: "ok" },
  manual: { ar: "اعتُمد يدوياً", en: "Approved manually", tone: "ok" },
  late: { ar: "متأخر", en: "Late", tone: "warn" },
  open: { ar: "بلا انصراف", en: "No checkout", tone: "warn" },
  pending: { ar: "لم يُسجَّل", en: "Not punched", tone: "warn" },
  alert: { ar: "تنبيه", en: "Alert", tone: "warn" },
  absent: { ar: "غائب", en: "Absent", tone: "bad" },
  blocked: { ar: "مانع", en: "Blocked", tone: "bad" },
  exposed: { ar: "مكشوف", en: "Exposed", tone: "bad" },
  leave: { ar: "إجازة", en: "Leave", tone: "leave" },
  holiday: { ar: "إجازة رسمية", en: "Official holiday", tone: "leave" },
  rest: { ar: "راحة", en: "Rest", tone: "rest" },
  notStarted: { ar: "لم تبدأ", en: "Not started", tone: "rest" },
  unscheduled: { ar: "بلا جدول", en: "No roster", tone: "rest" },
  upcoming: { ar: "مجدول", en: "Scheduled", tone: "rest" },
};

export function dutyStatus(key) {
  return DUTY_STATUS[key] || DUTY_STATUS.rest;
}

export function dutyLabel(key, ar = true) {
  const status = dutyStatus(key);
  return ar ? status.ar : status.en;
}

export function dutyTone(toneOrKey) {
  if (DUTY_TONES[toneOrKey]) return DUTY_TONES[toneOrKey];
  if (toneOrKey === "mute") return DUTY_TONES.rest;
  return DUTY_TONES[dutyStatus(toneOrKey).tone] || DUTY_TONES.rest;
}

/** 3px top edge of a tile / card. `mute` keeps the neutral hairline. */
export function dutyEdge(tone) {
  if (!tone || tone === "mute") return "var(--nv-line)";
  return dutyTone(tone).fill;
}

/** Chip in the schedule geometry (24px, control radius), coloured by a status key or a tone. */
export function dutyChip(toneOrKey = "rest", extra = {}) {
  const tone = dutyTone(toneOrKey);
  return baseChip("mute", {
    background: tone.soft,
    color: tone.ink,
    border: `1px solid ${tone.line}`,
    ...extra,
  });
}

/** Cell / day-card surface for a status: soft fill, toned hairline. */
export function dutySurface(toneOrKey) {
  const tone = dutyTone(toneOrKey);
  return { background: tone.soft, border: `1px solid ${tone.line}`, color: tone.ink };
}

/** Week-card style pairs (MyWeekDays / branch roster) on the same palette. */
export const DUTY_LEAVE_STYLE = { color: DUTY_TONES.leave.line, bg: DUTY_TONES.leave.soft, fg: DUTY_TONES.leave.ink };
export const DUTY_REST_STYLE = { color: DUTY_TONES.rest.line, bg: DUTY_TONES.rest.soft, fg: DUTY_TONES.rest.ink };

/** Legend order used under every calendar / week. */
export const DUTY_LEGEND = ["ontime", "late", "absent", "leave", "rest"];
