import { ruleValue } from "./laborRules.js";
import { isOnApprovedLeave } from "./leaveTypes.js";
import { checkConfirmConsentPaperGate, isNightWrittenConsent, isOpenConsent } from "./writtenConsent.js";
import { hasWrittenNightConsent } from "./decision18632.js";
import {
  activeNightRemedy,
  checkNightAllowanceGate,
  checkNightReduceHoursGate,
  employeeShiftOnDay,
  isNightWorker,
  nightRemedyIsWithdrawable,
  nightStreakWeeks,
  remapEmployeeNightWorkerDays,
  weekDays,
  weekStartDate,
} from "./shiftWeek.js";

export const NIGHT_CONSENT_FORM = {
  name: "موافقة-ليلية-18632.pdf",
  url: "/signing-preview-pumps.pdf",
};

export function nightRotateWeeks(onDate) {
  return ruleValue("hours.night.rotateWeeks", onDate) || 13;
}

/** Calendar month key for one written-consent cycle. */
export function nightCycleKey(onDate) {
  const start = weekStartDate(onDate || new Date());
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Dated night weeks only. A single current week (weekday template, no history) is 0 months — never 4.8. */
export function nightMonthsFromWeeks(weeks) {
  const n = Number(weeks) || 0;
  if (n <= 1) return 0;
  return Math.round(n / 4.33 * 10) / 10;
}

export function isNightRotateRequest(request) {
  return request?.type === "night_consent";
}

export function pendingNightRotate(emp) {
  return (emp?.otherRequests || []).find((row) => isNightRotateRequest(row) && (row.status || "pending") === "pending") || null;
}

/** سارية حمراء until the worker chooses this month. Manager silence does not close it. */
export function nightRotateStage(request) {
  if (!isNightRotateRequest(request)) return null;
  const status = request.status || "pending";
  if (request.lapsed || status === "lapsed") return "lapsed";
  if (request.withdrawnAt || status === "withdrawn") return "withdrawn";
  if (status === "approved" && request.decision === "agree") return "agreed_month";
  if (status === "approved" && request.decision === "reduce") return "reduced_hours";
  if (status === "rejected" || request.decision === "refuse") return "refused";
  if (status !== "pending") return status;
  return "active";
}

export function isNightRotateViolation(request) {
  return nightRotateStage(request) === "active";
}

export function isNightRotateAwaitingManager(request) {
  return false;
}

export function checkNightAgreeGate({ decision, acknowledged, paper, note } = {}) {
  if (decision !== "agree" && decision !== "refuse" && decision !== "reduce") {
    return { ok: false, error: "DECISION_REQUIRED", reason: "وافق أو قلّص الساعات أو ارفض.", reasonEn: "Agree, reduce hours, or refuse." };
  }
  if (decision === "refuse") {
    void note;
    return { ok: true };
  }
  return checkConfirmConsentPaperGate({ paper, ack: acknowledged });
}

/** 18632 — consent on file may be withdrawn at any time. */
/** 18632 — only the worker acts. Management is notified and may remind, never decide. */
export function checkNightEmployeeActorGate({ employeeId, actorId } = {}) {
  if (!actorId || String(actorId) !== String(employeeId)) {
    return {
      ok: false,
      error: "EMPLOYEE_ONLY",
      reason: "الموافقة أو الرفض أو السحب من ملفي فقط. الإدارة تُبلَّغ ولا تتدخل في النظام.",
      reasonEn: "Agree, refuse, or withdraw only from My file. Management is notified and does not act in the system.",
    };
  }
  return { ok: true };
}

/** Reduce / allowance / change-night-work — establishment on the roster, never My file. */
export function checkNightManagementActorGate({ employeeId, actorId } = {}) {
  if (!actorId) {
    return { ok: false, error: "ACTOR_REQUIRED", reason: "حدّد من يقرر.", reasonEn: "Name who is deciding." };
  }
  if (String(actorId) === String(employeeId)) {
    return {
      ok: false,
      error: "MANAGEMENT_ONLY",
      reason: "تقليص الساعات أو البدل أو تغيير العمل الليلي قرار المنشأة من الجدول. موافقة الاستمرار الخطية تبقى من ملفي فقط.",
      reasonEn: "Reducing hours, the allowance, or changing night work is an establishment decision on the roster. Written continuation consent stays on My file only.",
    };
  }
  return { ok: true };
}

export function checkDecideNightRemedyGate({ kind, employeeId, actorId, cutHours, shift, amount, allowanceKind } = {}) {
  const actor = checkNightManagementActorGate({ employeeId, actorId });
  if (!actor.ok) return actor;
  if (kind !== "allowance" && kind !== "reduce" && kind !== "rotate") {
    return {
      ok: false,
      error: "DECISION_REQUIRED",
      reason: "اختَر تقليص الساعات أو بدلاً أو تغيير العمل الليلي.",
      reasonEn: "Choose reduced hours, an allowance, or a change of night work.",
    };
  }
  if (kind === "reduce") return checkNightReduceHoursGate({ cutHours, shift });
  if (kind === "allowance") return checkNightAllowanceGate({ amount, allowanceKind });
  return { ok: true };
}

export function checkWithdrawNightRemedyGate({ employee, employeeId, actorId } = {}) {
  const actor = checkNightManagementActorGate({ employeeId: employeeId || employee?.id, actorId });
  if (!actor.ok) return actor;
  if (!nightRemedyIsWithdrawable(activeNightRemedy(employee))) {
    return {
      ok: false,
      error: "NOT_WITHDRAWABLE",
      reason: "لا تقليص ولا بدل مسجّل يُسحب. تغيير العمل الليلي يبقى على الجدول حتى يُعاد إسناد الليل.",
      reasonEn: "There is no recorded reduction or allowance to withdraw. A change of night work stays on the roster until night is assigned again.",
    };
  }
  return { ok: true };
}

export function checkWithdrawNightConsentGate({ request, acknowledged } = {}) {
  if (nightRotateStage(request) !== "agreed_month") {
    return {
      ok: false,
      error: "NOT_CONSENTED",
      reason: "لا موافقة محفوظة تُسحب.",
      reasonEn: "There is no consent on file to withdraw.",
    };
  }
  if (!acknowledged) {
    return {
      ok: false,
      error: "ACK_REQUIRED",
      reason: "أقرّ بسحب الموافقة الخطية.",
      reasonEn: "Acknowledge the withdrawal of written consent.",
    };
  }
  return { ok: true };
}

export function answeredNightRotateThisMonth(emp, cycleKey) {
  return (emp?.otherRequests || []).some((row) => (
    isNightRotateRequest(row)
    && row.cycleKey === cycleKey
    && row.status !== "pending"
    && row.status !== "withdrawn"
    && row.status !== "rejected"
    && row.decision !== "refuse"
    && !row.withdrawnAt
  ));
}

export function onNightsThisWeek(employee, schedule, weekStart) {
  if (!employee) return false;
  return weekDays(weekStart).some((day) => {
    if (isOnApprovedLeave(employee, day.key)) return false;
    return isNightWorker(employeeShiftOnDay(schedule, employee.id, day.key), day.key);
  });
}

/**
 * 18632 cadence:
 * first notice after 3 months as a night worker (13 dated night-worker weeks);
 * written consent stays on file until withdrawn (حق التراجع) — no monthly legal re-consent;
 * reset only after ≥1 month (~4 weeks) of ordinary hours.
 * Weekday keys 0–4 are this week's pattern, not lookback history.
 * One pending request at a time.
 */
export function nightRotateDue({ employee, schedule, weekStart } = {}) {
  if (!employee || employee.status === "inactive") return { due: false, reason: "inactive" };
  const start = weekStartDate(weekStart || new Date());
  const rotateWeeks = nightRotateWeeks(start);
  if (!onNightsThisWeek(employee, schedule, start)) {
    return { due: false, reason: "period_changed" };
  }
  const weeks = nightStreakWeeks(schedule, employee.id, start) + 1;
  const cycleKey = nightCycleKey(start);
  if (weeks <= rotateWeeks) return { due: false, reason: "under_limit", weeks, cycleKey };
  if (hasWrittenNightConsent(employee)) return { due: false, reason: "consented", weeks, cycleKey };
  if (pendingNightRotate(employee)) return { due: false, reason: "pending", weeks, cycleKey };
  if (answeredNightRotateThisMonth(employee, cycleKey)) {
    return { due: false, reason: "answered_month", weeks, cycleKey };
  }
  return {
    due: true,
    weeks,
    months: nightMonthsFromWeeks(weeks),
    cycleKey,
    reason: "over_three_months",
  };
}

export function shouldLapseNightRotate(employee, schedule, weekStart) {
  return !!(pendingNightRotate(employee) && !onNightsThisWeek(employee, schedule, weekStart));
}

export function openNightWrittenConsents(employee) {
  return (employee?.otherRequests || []).filter((row) => isNightWrittenConsent(row) && isOpenConsent(row));
}

/** 18632 written consent is not a problem without a night assignment this week. */
export function shouldLapseNightWrittenConsent(employee, schedule, weekStart) {
  return !!(openNightWrittenConsents(employee).length && !onNightsThisWeek(employee, schedule, weekStart));
}

export function collectLapsedNightWrittenConsents(data, weekStart) {
  const start = weekStartDate(weekStart || new Date());
  return (data?.employees || []).flatMap((employee) => {
    const schedule = (data.schedules || []).find((row) => row.stationId === employee.stationId)
      || { shiftTypes: [], assignments: {} };
    if (!shouldLapseNightWrittenConsent(employee, schedule, start)) return [];
    return openNightWrittenConsents(employee).map((request) => ({ employee, request }));
  });
}

function markNightConsentLapsed(request, at) {
  if (!request || request.status === "lapsed") return false;
  request.status = "lapsed";
  request.lapsed = true;
  request.lapsedAt = at;
  return true;
}

/** Close 18632 night files that have no night week under them. */
export function applyLapsedNightConsents(data, weekStart) {
  if (!data) return false;
  const start = weekStartDate(weekStart || new Date());
  const at = new Date().toISOString();
  let changed = false;
  for (const row of [...collectLapsedNightRotates(data, start), ...collectLapsedNightWrittenConsents(data, start)]) {
    const emp = (data.employees || []).find((item) => item.id === row.employee.id);
    const request = (emp?.otherRequests || []).find((item) => item.id === row.request?.id);
    if (markNightConsentLapsed(request, at)) changed = true;
  }
  return changed;
}

export function collectLapsedNightRotates(data, weekStart) {
  const start = weekStartDate(weekStart || new Date());
  return (data?.employees || []).flatMap((employee) => {
    const schedule = (data.schedules || []).find((row) => row.stationId === employee.stationId)
      || { shiftTypes: [], assignments: {} };
    return shouldLapseNightRotate(employee, schedule, start)
      ? [{ employee, request: pendingNightRotate(employee) }]
      : [];
  });
}

export function collectDueNightRotates(data, weekStart) {
  const start = weekStartDate(weekStart || new Date());
  return (data?.employees || []).flatMap((employee) => {
    const schedule = (data.schedules || []).find((row) => row.stationId === employee.stationId)
      || { shiftTypes: [], assignments: {} };
    const due = nightRotateDue({ employee, schedule, weekStart: start });
    return due.due ? [{ employee, due, schedule }] : [];
  });
}

export function applyNightWorkerDecision(schedule, employeeId, decision, weekStart, { ordinaryKind, cutHours } = {}) {
  if (decision === "reduce") return remapEmployeeNightWorkerDays(schedule, employeeId, weekStart, "reduce", { cutHours });
  if (decision === "refuse" || decision === "rotate") {
    return remapEmployeeNightWorkerDays(
      schedule,
      employeeId,
      weekStart,
      ordinaryKind === "evening" ? "evening" : "rotate",
    );
  }
  return { ok: true, moved: 0, mode: "agree" };
}

export function nightRotateRequestDraft(due, onDate = new Date()) {
  const months = due.months ?? nightMonthsFromWeeks(due.weeks);
  const createdAt = onDate instanceof Date ? onDate.toISOString() : String(onDate);
  return {
    type: "night_consent",
    status: "pending",
    createdAt,
    auto: true,
    actor: "employee",
    phase: "employee",
    violation: true,
    cycleKey: due.cycleKey,
    weeks: due.weeks,
    months,
    titleAr: "موافقة الاستمرار في العمل الليلي",
    titleEn: "Night-work continuation consent",
    senderFile: { ...NIGHT_CONSENT_FORM },
    reason: `سارية بعد ${months} أشهر كعامل ليلي (قرار 18632). اكتب موافقة خطية، وقّع الملف في قسم التوقيع، ثم ارفع النسخة هنا للاعتماد. الرفض مباشر. الموافقة تبقى محفوظة مع حق التراجع في أي وقت — لا تجديد شهري واجب. التدوير لساعات عادية شهراً على الأقل يصفّر العدّ — أسبوع صباحي واحد لا يكفي.`,
  };
}

export function nightRotateAlert(employee, schedule, weekStart, lang = "ar") {
  const pending = pendingNightRotate(employee);
  const start = weekStartDate(weekStart || new Date());
  const weeks = onNightsThisWeek(employee, schedule, start)
    ? nightStreakWeeks(schedule, employee.id, start) + 1
    : 0;
  if (weeks <= nightRotateWeeks(start) && !pending) return null;
  const months = nightMonthsFromWeeks(weeks || pending?.weeks || 0);
  const ar = lang === "ar";
  if (pending) {
    return {
      kind: "active",
      weeks,
      months,
      requestId: pending.id,
      title: ar ? "سارية — حتى تختار الليل" : "In force — until you choose on nights",
      body: ar
        ? `${months} أشهر كعامل ليلي. اكتب موافقة خطية → وقّع الملف في قسم التوقيع → ارفع النسخة هنا للاعتماد. رفض = زر مباشر. الموافقة محفوظة مع حق التراجع — لا تجديد شهري واجب. التدوير شهر عادي على الأقل يصفّر العدّ.`
        : `${months} months as a night worker. Write a written consent → sign in Digital signing → upload here to approve. Refuse is one button. Consent stays on file with the right to withdraw — monthly renewal is not a legal duty. A full ordinary month resets the clock.`,
    };
  }
  if (weeks > nightRotateWeeks(start)) {
    return {
      kind: "due",
      weeks,
      months,
      title: ar ? "سارية بعد ثلاثة أشهر ليلاً" : "In force after three months on nights",
      body: ar
        ? `${months} أشهر كعامل ليلي. تُفتح موافقة خطية في طلباتي بعد ثلاثة أشهر، أو يُدوَّر لساعات عادية شهراً على الأقل. أسبوع صباحي واحد لا يصفّر العدّ.`
        : `${months} months as a night worker. Written consent opens in My Requests after three months, or rotate to ordinary hours for at least one month. One morning week does not reset the clock.`,
    };
  }
  return null;
}
