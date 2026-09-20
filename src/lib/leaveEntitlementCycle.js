import { formatDate } from "./dateFormat.js";
import { ruleValue } from "./laborRules.js";
import {
  anniversaryYearWindow,
  leaveTypeLabel,
  remainingLeaveDays,
  statutoryLeaveFloor,
} from "./leaveTypes.js";

/** Warm approval copy — تهنئة/مباركة, not a cold status line. Compassionate for sick and bereavement. */
export const LEAVE_APPROVAL_BLESSING = {
  annual: {
    ar: "تهانينا — اعتُمدت إجازتك السنوية. بارك الله لك فيها؛ هذا حقك فاستمتع به.",
    en: "Congratulations — your annual leave is approved. This is your right; enjoy it.",
  },
  grant: {
    ar: "تهانينا — اعتُمدت أيام الرصيد التقديرية. بارك الله لك فيها.",
    en: "Congratulations — your granted leave days are approved. May they serve you well.",
  },
  sick: {
    ar: "شفاك الله وعافاك. اعتُمدت إجازتك المرضية — ارتَحْ واستعدّ.",
    en: "May you recover well. Your sick leave is approved — rest and return when ready.",
  },
  exam: {
    ar: "وُفّقت. اعتُمدت إجازة الامتحان. يسّر الله أمرك وبارك سعيك.",
    en: "Wishing you success. Your exam leave is approved — may the work go smoothly.",
  },
  marriage: {
    ar: "مبارك الزواج. اعتُمدت إجازة الزواج — ألف مبارك وعقبال الدوام.",
    en: "Congratulations on your marriage. Your marriage leave is approved — blessings on the union.",
  },
  bereavement: {
    ar: "عظّم الله أجركم وأحسن عزاءكم. اعتُمدت إجازة الوفاة — صبركم الله.",
    en: "May God magnify your reward. Bereavement leave is approved — we share your grief.",
  },
  bereavement_sibling: {
    ar: "عظّم الله أجركم. اعتُمدت إجازة وفاة الأخ أو الأخت — صبركم الله.",
    en: "May God magnify your reward. Sibling bereavement leave is approved.",
  },
  maternity: {
    ar: "مبارك القدوم. اعتُمدت إجازة الأمومة — رعاك الله وولدك.",
    en: "Blessings on the arrival. Maternity leave is approved — care for yourself and your child.",
  },
  maternity_extend: {
    ar: "اعتُمد تمديد إجازة الوضع بلا أجر. بارك الله لك ورعاك وولدك.",
    en: "The unpaid maternity extension is approved. Care for yourself and your child.",
  },
  maternity_companion: {
    ar: "اعتُمدت إجازة مرافقة المولود. بارك الله لك ورعاك وولدك.",
    en: "Companion leave for the newborn is approved. Care for yourself and your child.",
  },
  iddah: {
    ar: "عظّم الله أجركم وأحسن عزاءكم. اعتُمدت عدّة وفاة الزوج — صبركم الله.",
    en: "May God magnify your reward. Iddah leave is approved — we share your grief.",
  },
  paternity: {
    ar: "مبارك المولود. اعتُمدت إجازة الأبوة — بارك الله لكم.",
    en: "Congratulations on the newborn. Paternity leave is approved — blessings on your family.",
  },
  hajj: {
    ar: "تقبّل الله حجك. اعتُمدت إجازة الحج — حج مبرور وذنب مغفور.",
    en: "May God accept your Hajj. Hajj leave is approved — a blessed pilgrimage.",
  },
  eid: {
    ar: "تقبّل الله. اعتُمدت إجازة العيد أو العطلة الرسمية — بأجر كامل ولا تُخصم من السنوية.",
    en: "Your Eid or official-holiday leave is approved — full pay, and it is not taken from annual leave.",
  },
  emergency: {
    ar: "يسّر الله أمرك. اعتُمدت إجازتك الاضطرارية. بارك الله وقتك.",
    en: "May the matter be eased. Your emergency leave is approved.",
  },
  unpaid: {
    ar: "تهانينا بالاعتماد. اعتُمدت إجازتك بدون راتب. بارك الله وقتك — الحق ثابت في تاريخه.",
    en: "Your unpaid leave is approved. The dates are now a fixed right — use the time well.",
  },
};

export function leaveApprovalBlessing(type, lang = "ar") {
  const ar = lang === "ar";
  const key = String(type || "").trim().toLowerCase();
  const row = LEAVE_APPROVAL_BLESSING[key];
  if (row) return ar ? row.ar : row.en;
  return ar
    ? "تهانينا — اعتُمدت إجازتك. بارك الله لك فيها."
    : "Congratulations — your leave is approved. May it serve you well.";
}

export function leaveApprovalCardNote(request, lang = "ar") {
  const ar = lang === "ar";
  const blessing = leaveApprovalBlessing(request?.type, lang);
  const roster = ar
    ? "تظهر أيامها في التقويم التشغيلي وجدول الدوام."
    : "The days appear on the operational calendar and the week roster.";
  return `${blessing} ${roster}`;
}

function dateOnly(iso) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function todayRiyadh(onDate) {
  if (onDate instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(onDate);
  }
  return dateOnly(onDate) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

function inclusiveDays(a, b) {
  const d0 = dateOnly(a);
  const d1 = dateOnly(b);
  if (!d0 || !d1 || d1 < d0) return 0;
  return Math.round((new Date(`${d1}T00:00:00`) - new Date(`${d0}T00:00:00`)) / 86400000) + 1;
}

export function annualEntitlementState(employee, onDate) {
  const day = todayRiyadh(onDate);
  const profile = employee?.profile || {};
  const win = anniversaryYearWindow(profile.hireDate, day);
  const remaining = remainingLeaveDays(profile, employee?.leaveRequests, "annual", day);
  const floor = statutoryLeaveFloor("annual", profile, day);
  if (!win || remaining == null) {
    return { ok: false, reason: "no_hire_or_balance", remaining: remaining ?? null, window: win };
  }
  return {
    ok: true,
    remaining,
    floor,
    window: win,
    daysLeft: inclusiveDays(day, win.end),
    daysIn: inclusiveDays(win.start, day),
  };
}

/** Art. 109: take leave in its year. Notice the worker at year open and when 30 days remain. */
export function annualEntitlementDue(employee, onDate) {
  if (!employee || employee.status === "inactive") return { due: false, reason: "inactive" };
  const state = annualEntitlementState(employee, onDate);
  if (!state.ok) return { due: false, reason: state.reason };
  if (state.remaining <= 0) return { due: false, reason: "taken", ...state };
  const kind = state.daysLeft <= 30 ? "year_end" : state.daysIn <= 14 ? "year_start" : null;
  if (!kind) return { due: false, reason: "mid_year", ...state };
  const noticeKey = `${state.window.start}:${kind}`;
  if (employee.profile?.annualEntitlementNoticeKey === noticeKey) {
    return { due: false, reason: "notified", kind, noticeKey, ...state };
  }
  return { due: true, kind, noticeKey, ...state };
}

export function collectDueAnnualLeaveNotices(data, onDate) {
  return (data?.employees || []).flatMap((employee) => {
    const due = annualEntitlementDue(employee, onDate);
    return due.due ? [{ employee, due }] : [];
  });
}

export function annualEntitlementNoticeText(due, name, lang = "ar") {
  const ar = lang === "ar";
  const days = due.remaining;
  if (due.kind === "year_end") {
    return ar
      ? `${name ? `${name} — ` : ""}تبقى ${due.daysLeft} يوماً على نهاية سنة استحقاق إجازتك و${days} يوماً سنوية لم تُؤخذ. المادة 109: تُؤخذ في سنة استحقاقها.`
      : `${name ? `${name} — ` : ""}${due.daysLeft} days left in the leave year and ${days} unused annual days. Article 109: take them in the year they fall due.`;
  }
  return ar
    ? `${name ? `${name} — ` : ""}سنة استحقاق إجازتك السنوية بدأت. رصيدك ${days} يوماً (المادة 109). يجب أن تتمتع بها في سنتها.`
    : `${name ? `${name} — ` : ""}Your annual leave year has started. Balance ${days} days (Art. 109). Take them in this year.`;
}

export function leaveDateSpanText(startDate, endDate, lang = "ar") {
  const a = formatDate(dateOnly(startDate), lang, { day: "numeric", month: "long", year: "numeric" });
  const b = formatDate(dateOnly(endDate), lang, { day: "numeric", month: "long", year: "numeric" });
  if (a && b) return a === b ? a : `${a} → ${b}`;
  return a || b || "";
}

export function leaveDecisionNoticeText({ status, type, startDate, endDate, recordedBy, daysUntilStart } = {}, lang = "ar") {
  const ar = lang === "ar";
  const label = type ? leaveTypeLabel(type, ar) : "";
  const span = leaveDateSpanText(startDate, endDate, lang);
  if (status === "rejected") {
    return ar
      ? `رُفض طلب إجازتك${label ? ` (${label})` : ""}.`
      : `Your leave request${label ? ` (${label})` : ""} was rejected.`;
  }
  if (status === "revise") {
    return ar
      ? `إجازتك تحتاج تعديلاً${label ? ` (${label})` : ""}.`
      : `Your leave needs a change${label ? ` (${label})` : ""}.`;
  }
  if (status === "withdrawn") {
    return ar
      ? `سُحبت إجازتك المعتمدة${span ? ` ${span}` : ""} قبل موعد بدئها. الرصيد عاد، والجدول يُعدَّل.`
      : `Your approved leave${span ? ` ${span}` : ""} was withdrawn before it started. The balance is restored and the roster will be adjusted.`;
  }
  const blessing = leaveApprovalBlessing(type, lang);
  const noticeNeed = ruleValue("leave.annual.noticeDays");
  if (recordedBy && type === "annual" && Number(daysUntilStart) < noticeNeed) {
    return ar
      ? `${blessing} ${span}. المادة 109 توجب إشعارك قبل ${noticeNeed} يوماً إن حدّد صاحب العمل الميعاد — أُشعِرت الآن.`
      : `${blessing} ${span}. Article 109 requires ${noticeNeed} days' notice when the employer sets the date — you are being notified now.`;
  }
  return span ? `${blessing} ${span}` : blessing;
}

export function daysUntilLeaveStart(startDate, onDate) {
  const start = dateOnly(startDate);
  const day = todayRiyadh(onDate);
  if (!start) return null;
  return inclusiveDays(day, start) - 1;
}
