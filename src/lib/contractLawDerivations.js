/** Confirmed Labour Law contract path — Arts 37, 53, 75, 79, 74/80/81.
 *  Numbers come from laborRules. Verify-tagged rows stay unencoded.
 */

import { citeRule, ruleAt, ruleValue } from "./laborRules.js";
import { daysUntilExpiry, deriveSaudiStatus, localDateKey, nationalityIsSaudi } from "./complianceDerivations.js";
import { leaveTypesForProfile, statutoryLeaveFloor } from "./leaveTypes.js";

export const WORK_PATTERN_OPTIONS = [
  { value: "ordinary", ar: "دائم / عادي", en: "Permanent / ordinary" },
  { value: "part_time", ar: "جزئي", en: "Part-time" },
  { value: "temporary", ar: "مؤقت / عرضي", en: "Temporary / casual" },
  { value: "seasonal", ar: "موسمي", en: "Seasonal" },
  { value: "flexible", ar: "مرن", en: "Flexible" },
  { value: "remote", ar: "عن بُعد", en: "Remote" },
];

export const TERMINATION_REASONS = [
  { id: "mutual", article: "74", ar: "اتفاق الطرفين", en: "Mutual agreement" },
  { id: "contract_end", article: "74", ar: "انتهاء المدة", en: "End of term" },
  { id: "resignation", article: "74", ar: "استقالة", en: "Resignation" },
  { id: "force_majeure", article: "74", ar: "قوة قاهرة", en: "Force majeure" },
  { id: "closure", article: "74", ar: "إغلاق المنشأة / الإفلاس", en: "Closure / insolvency" },
  { id: "retirement", article: "74", ar: "بلوغ سن التقاعد", en: "Retirement age" },
  { id: "death", article: "74", ar: "وفاة العامل", en: "Worker's death" },
  { id: "article_80", article: "80", ar: "فصل بلا مكافأة — المادة 80", en: "Dismissal without award — Art. 80" },
  { id: "article_81", article: "81", ar: "ترك العمل مع حفظ الحقوق — المادة 81", en: "Leaving with rights preserved — Art. 81" },
];

function parseDay(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addDays(iso, n) {
  const d = parseDay(iso);
  if (!d) return "";
  d.setDate(d.getDate() + Number(n));
  return localDateKey(d);
}

function profileOf(input) {
  const row = input?.employee || input || {};
  const profile = row.profile && typeof row.profile === "object" ? row.profile : {};
  return { row, profile };
}

function isTruthy(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return value === true || s === "1" || s === "true" || s === "yes" || s === "حامل";
}

export function workPatternForcesFixed(pattern) {
  const p = String(pattern || "").trim().toLowerCase();
  return p === "temporary" || p === "seasonal";
}

export function checkProbationGate(input = {}) {
  const { row, profile } = profileOf(input);
  const flagged = Boolean(row.probation ?? profile.probation);
  if (!flagged) return { ok: true, active: false };
  const days = Number(row.probationDays ?? profile.probationDays ?? 0);
  const max = ruleValue("contract.probation.maxDays", input.today);
  const cite = citeRule("contract.probation.maxDays", input.today);
  if (!days || days < 1) {
    return {
      ok: false,
      error: "PROBATION_TERM_REQUIRED",
      reason: "موقوف — فترة التجربة تُذكر صراحة بعدد الأيام (المادة 53).",
      reasonEn: "Blocked — probation must be stated as a number of days (Article 53).",
      cite,
    };
  }
  if (days > max) {
    return {
      ok: false,
      error: "PROBATION_OVER_MAX",
      reason: `موقوف — فترة التجربة لا تتجاوز ${max} يوماً (المادة 53).`,
      reasonEn: `Blocked — probation may not exceed ${max} days (Article 53).`,
      cite,
      days,
      max,
    };
  }
  const prior = isTruthy(row.probationPriorAtEmployer ?? profile.probationPriorAtEmployer ?? input.probationPriorAtEmployer);
  const otherJob = isTruthy(row.probationOtherProfession ?? profile.probationOtherProfession ?? input.probationOtherProfession);
  const gap = Number(row.probationRehireGapMonths ?? profile.probationRehireGapMonths ?? input.probationRehireGapMonths ?? 0);
  const minGap = ruleValue("contract.probation.rehireGapMonths", input.today);
  if (prior && !(otherJob || gap >= minGap)) {
    return {
      ok: false,
      error: "PROBATION_REPEAT",
      reason: "موقوف — لا تجوز التجربة أكثر من مرة لدى صاحب العمل نفسه إلا في مهنة أخرى أو بعد انقطاع ستة أشهر (المادة 54).",
      reasonEn: "Blocked — probation may not be repeated with the same employer except in another occupation or after a six-month break (Article 54).",
      cite: citeRule("contract.probation.once.cite", input.today),
    };
  }
  return { ok: true, active: true, days, max, cite };
}

/** Counted probation days exclude National Day, Founding Day, listed Eids, and approved sick leave. */
export function isExcludedProbationDay(iso, extras = []) {
  const key = String(iso || "").slice(0, 10);
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const md = `${m[2]}-${m[3]}`;
  if (md === "09-23" || md === "02-22") return true;
  return (extras || []).includes(key);
}

export function deriveProbationProgress(input = {}) {
  const gate = checkProbationGate(input);
  if (!gate.active || !gate.ok) return { ...gate, remaining: null, warning: null };
  const { row, profile } = profileOf(input);
  const start = String(profile.hireDate || row.hireDate || input.startDate || "").slice(0, 10);
  const today = input.today || localDateKey();
  if (!parseDay(start)) return { ...gate, remaining: gate.days, warning: null };
  const sick = new Set(
    (row.leaveRequests || profile.leaveRequests || input.sickDates || [])
      .filter((r) => (r.type === "sick" || r === "sick") && (r.status === "approved" || typeof r === "string"))
      .flatMap((r) => {
        if (typeof r === "string") return [r];
        const out = [];
        let d = parseDay(r.startDate);
        const end = parseDay(r.endDate);
        if (!d || !end) return [];
        while (d <= end) {
          out.push(localDateKey(d));
          d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        }
        return out;
      }),
  );
  const eids = input.eidDates || profile.eidDates || [];
  let counted = 0;
  let cursor = parseDay(start);
  const last = parseDay(today);
  while (cursor && last && cursor <= last && counted < gate.days) {
    const key = localDateKey(cursor);
    if (!isExcludedProbationDay(key, eids) && !sick.has(key)) counted += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  const remaining = Math.max(0, gate.days - counted);
  const warnAt = ruleValue("contract.probation.warnDays", today);
  const warning = remaining > 0 && remaining <= warnAt ? "PROBATION_ENDING" : remaining === 0 ? "PROBATION_ENDED" : null;
  return { ...gate, counted, remaining, warning, start };
}

export function noticeRuleId({ term, payCycle = "monthly", party = "employer" } = {}) {
  const indefinite = String(term || "") === "indefinite";
  const monthly = String(payCycle || "monthly") === "monthly";
  if (indefinite && monthly) {
    return party === "worker" ? "contract.notice.workerMonthlyDays" : "contract.notice.employerMonthlyDays";
  }
  return "contract.notice.otherDays";
}

export function noticeDaysRequired({ term, payCycle = "monthly", party = "employer", onDate } = {}) {
  return ruleValue(noticeRuleId({ term, payCycle, party }), onDate);
}

export function deriveNotice(input = {}) {
  const converted = input.employee ? deriveArt55Conversion({ ...input.employee, today: input.onDate }).converts : false;
  const term = converted ? "indefinite" : input.term;
  const required = noticeDaysRequired({ ...input, term });
  const given = String(input.noticeGivenDate || "").slice(0, 10);
  const last = String(input.lastWorkDate || input.effectiveDate || "").slice(0, 10);
  const cite = citeRule(noticeRuleId({ ...input, term }), input.onDate);
  if (!given || !last) {
    return { ok: true, required, shortfall: 0, compensationDays: 0, cite, pending: true };
  }
  const span = daysUntilExpiry(last, given);
  const served = span == null ? 0 : Math.max(0, span);
  const shortfall = Math.max(0, required - served);
  const payCite = shortfall > 0
    ? citeRule("contract.notice.compensation.cite", input.onDate) || cite
    : cite;
  return {
    ok: true,
    required,
    served,
    shortfall,
    compensationDays: shortfall,
    cite: payCite,
    pending: false,
    effectiveDate: last,
  };
}

export function checkResignationGate(input = {}) {
  const today = input.today || localDateKey();
  const submitted = String(input.submittedAt || "").slice(0, 10);
  const cite = citeRule("contract.resignation.autoAcceptDays", today);
  if (!ruleAt("contract.resignation.autoAcceptDays", today)) {
    if (!submitted) {
      return {
        ok: false,
        error: "RESIGNATION_WRITTEN_REQUIRED",
        reason: "الاستقالة مكتوبة بتاريخ تقديم.",
        reasonEn: "Resignation must be written with a submission date.",
        cite: citeRule("contract.termination.cite", today),
      };
    }
    return { ok: true, cite: null, elapsed: 0, autoAcceptDays: null, withdrawDays: null, postponeMaxDays: null, canWithdraw: false, deemedAccepted: false, status: input.status || "pending" };
  }
  if (!submitted) {
    return { ok: false, error: "RESIGNATION_WRITTEN_REQUIRED", reason: "الاستقالة مكتوبة بتاريخ تقديم (المادة 79 مكرر).", reasonEn: "Resignation must be written with a submission date (Article 79 bis).", cite };
  }
  if (input.deferredDate) {
    return { ok: false, error: "RESIGNATION_FUTURE_DATE", reason: "لا تُقبل استقالة بتاريخ مؤجّل (المادة 79 مكرر).", reasonEn: "A resignation with a deferred future date is not allowed (Article 79 bis).", cite };
  }
  const auto = ruleValue("contract.resignation.autoAcceptDays", today);
  const postponeMax = ruleValue("contract.resignation.postponeMaxDays", today);
  const withdraw = ruleValue("contract.resignation.withdrawDays", today);
  const since = daysUntilExpiry(today, submitted);
  const elapsed = since == null ? 0 : Math.max(0, since);
  const canWithdraw = elapsed <= withdraw && input.status !== "accepted";
  const postponed = input.status === "postponed";
  if (postponed && !String(input.postponeNote || "").trim()) {
    return { ok: false, error: "RESIGNATION_POSTPONE_NOTE", reason: "تأجيل القبول يحتاج مسوغاً مكتوباً (المادة 79 مكرر).", reasonEn: "Postponing acceptance needs a written justification (Article 79 bis).", cite };
  }
  if (postponed) {
    const until = String(input.postponeUntil || addDays(submitted, postponeMax)).slice(0, 10);
    const cap = addDays(submitted, postponeMax);
    if (until > cap) {
      return { ok: false, error: "RESIGNATION_POSTPONE_OVER_MAX", reason: `لا يتجاوز التأجيل ${postponeMax} يوماً.`, reasonEn: `Postponement may not exceed ${postponeMax} days.`, cite };
    }
  }
  const deemedAccepted = !postponed && input.status !== "withdrawn" && input.status !== "accepted" && elapsed >= auto;
  return {
    ok: true,
    cite,
    elapsed,
    autoAcceptDays: auto,
    withdrawDays: withdraw,
    postponeMaxDays: postponeMax,
    canWithdraw,
    deemedAccepted,
    status: input.status === "withdrawn" ? "withdrawn" : deemedAccepted ? "deemed_accepted" : (input.status || "pending"),
  };
}

export function checkTerminationGate(input = {}) {
  const reason = TERMINATION_REASONS.find((r) => r.id === String(input.reason || "").trim());
  const cite = citeRule("contract.termination.cite", input.today);
  if (!reason) {
    return {
      ok: false,
      error: "TERMINATION_REASON_REQUIRED",
      reason: "موقوف — اختر سبباً نظامياً لإنهاء العقد (المواد 74 و80 و81).",
      reasonEn: "Blocked — pick a statutory reason to end the contract (Articles 74, 80 and 81).",
      cite,
    };
  }
  const art155 = isArt155Protected(input);
  if (art155 && reason.id === "article_80") {
    return {
      ok: false,
      error: "MATERNITY_DISMISSAL_FORBIDDEN",
      reason: "موقوف — يحظر فصل العاملة أثناء الحمل أو إجازة الوضع (المادة 155).",
      reasonEn: "Blocked — a female worker may not be dismissed during pregnancy or maternity leave (Article 155).",
      cite: citeRule("contract.maternity.noDismissal.cite", input.today),
    };
  }
  if (reason.id === "article_80") {
    const files = input.evidenceFiles || input.files || [];
    if (!files.length) {
      return {
        ok: false,
        error: "ARTICLE_80_EVIDENCE_REQUIRED",
        reason: "موقوف — الفصل وفق المادة 80 يحتاج محضر تحقيق وإتاحة فرصة المعارضة.",
        reasonEn: "Blocked — Article 80 dismissal needs hearing minutes and a chance for the worker to object.",
        cite: { ...cite, article: "80", labelAr: "المادة 80", labelEn: "Art. 80" },
      };
    }
  }
  return { ok: true, reason, cite };
}

function isArt155Protected(input = {}) {
  const today = input.today || localDateKey();
  const { row, profile } = profileOf(input);
  const gender = String(profile.gender || row.gender || "").toLowerCase();
  const female = /^(f|female|أنثى|انثى|woman)$/.test(gender);
  const pregnant = isTruthy(profile.pregnant ?? row.pregnant ?? input.pregnant);
  const requests = input.leaveRequests || row.leaveRequests || profile.leaveRequests || [];
  const maternityNow = (Array.isArray(requests) ? requests : []).some((r) => {
    if (String(r?.type || "").toLowerCase() !== "maternity" || r?.status !== "approved") return false;
    const a = String(r.startDate || "").slice(0, 10);
    const b = String(r.endDate || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b) && a <= today && today <= b;
  });
  if (maternityNow) return true;
  return female && pregnant;
}

export function shiftOverlapsNight(start, end) {
  const nightStart = ruleValue("hours.night.startHour") * 60;
  const nightEnd = ruleValue("hours.night.endHour") * 60;
  const [sh, sm] = String(start || "0:0").split(":").map(Number);
  const [eh, em] = String(end || "0:0").split(":").map(Number);
  let a = sh * 60 + sm;
  let b = eh * 60 + em;
  if (b <= a) b += 1440;
  const wrap = (m) => ((m % 1440) + 1440) % 1440;
  for (let t = a; t < b; t += 15) {
    const m = wrap(t);
    if (m >= nightStart || m < nightEnd) return true;
  }
  return false;
}

export function isHeatBanDate(value) {
  const raw = value instanceof Date && !Number.isNaN(value.getTime())
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const pad = (n) => String(n).padStart(2, "0");
  const from = `${pad(ruleValue("hours.heat.fromMonth"))}-${pad(ruleValue("hours.heat.fromDay"))}`;
  const to = `${pad(ruleValue("hours.heat.toMonth"))}-${pad(ruleValue("hours.heat.toDay"))}`;
  const mmdd = raw.slice(5);
  return mmdd >= from && mmdd <= to;
}

export function monthHasHeatBanDay(year, monthIndex) {
  const days = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isHeatBanDate(key)) return true;
  }
  return false;
}

export function shiftOverlapsHeatBan(start, end, { outdoor = false, summer = false } = {}) {
  if (!outdoor || !summer) return false;
  const from = ruleValue("hours.heat.startHour") * 60;
  const to = ruleValue("hours.heat.endHour") * 60;
  const [sh, sm] = String(start || "0:0").split(":").map(Number);
  const [eh, em] = String(end || "0:0").split(":").map(Number);
  let a = sh * 60 + sm;
  let b = eh * 60 + em;
  if (b <= a) b += 1440;
  const wrap = (m) => ((m % 1440) + 1440) % 1440;
  for (let t = a; t < b; t += 15) {
    const m = wrap(t);
    if (m >= from && m < to) return true;
  }
  return false;
}

const HEAT_MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const HEAT_MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Every heat-ban figure in one place, read from laborRules — the roster and the task board share it. */
export function heatBanWindow(onDate) {
  const startHour = ruleValue("hours.heat.startHour", onDate);
  const endHour = ruleValue("hours.heat.endHour", onDate);
  const fromMonth = ruleValue("hours.heat.fromMonth", onDate);
  const fromDay = ruleValue("hours.heat.fromDay", onDate);
  const toMonth = ruleValue("hours.heat.toMonth", onDate);
  const toDay = ruleValue("hours.heat.toDay", onDate);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    startHour,
    endHour,
    fromMonth,
    fromDay,
    toMonth,
    toDay,
    startLabel: `${pad(startHour)}:00`,
    endLabel: `${pad(endHour)}:00`,
    seasonAr: `من ${fromDay} ${HEAT_MONTHS_AR[fromMonth - 1]} إلى ${toDay} ${HEAT_MONTHS_AR[toMonth - 1]}`,
    seasonEn: `from ${fromDay} ${HEAT_MONTHS_EN[fromMonth - 1]} to ${toDay} ${HEAT_MONTHS_EN[toMonth - 1]}`,
  };
}

/** Minutes past midnight inside the banned midday window — half-open, so the end hour is free. */
export function isHeatBanMinuteOfDay(minutes, onDate) {
  const m = Number(minutes);
  if (!Number.isFinite(m)) return false;
  const win = heatBanWindow(onDate);
  return m >= win.startHour * 60 && m < win.endHour * 60;
}

/**
 * The four states the sun ban can be in against a Riyadh wall clock, and the
 * severity each one earns. Red is owed to the whole season, because inside it
 * the ban bites today: `alert` before the window opens and after it closes, and
 * `block` — the heavier red — while an open-air action is actually being refused.
 * Outside the season the same figures are reference and nothing alarms. Surfaces
 * read the level from here instead of inferring a tone from an absent notice.
 */
export const HEAT_BAN_STATE_LEVEL = {
  off_season: "cite",
  before_window: "alert",
  in_window: "block",
  after_window: "alert",
};

export function heatBanClockState(clock) {
  const dayKey = clock?.dayKey;
  const minutes = Number(clock?.minutes);
  if (!dayKey || !Number.isFinite(minutes)) return "off_season";
  if (!isHeatBanDate(dayKey)) return "off_season";
  if (isHeatBanMinuteOfDay(minutes, dayKey)) return "in_window";
  return minutes >= heatBanWindow(dayKey).endHour * 60 ? "after_window" : "before_window";
}

export function checkHeatBanGate(input = {}) {
  const hit = shiftOverlapsHeatBan(input.start, input.end, { outdoor: input.outdoor, summer: input.summer });
  if (!hit) return { ok: true };
  const win = heatBanWindow(input.onDate);
  return {
    ok: false,
    error: "HEAT_BAN",
    reason: `موقوف — حظر العمل في الميدان المكشوف من ${win.startLabel} إلى ${win.endLabel} ${win.seasonAr}.`,
    reasonEn: `Blocked — outdoor field work is banned from ${win.startLabel} to ${win.endLabel} ${win.seasonEn}.`,
  };
}

export function isNonSaudiNationality(input) {
  const row = input?.employee || input || {};
  const profile = row.profile && typeof row.profile === "object" ? row.profile : {};
  return nationalityIsSaudi(row.nationality ?? profile.nationality) === false;
}

function serviceYears(start, today) {
  const a = parseDay(start);
  const b = parseDay(today);
  if (!a || !b || b < a) return 0;
  return (b.getTime() - a.getTime()) / 31557600000;
}

/** Article 55 — Saudi fixed-term continuation. Converts the file when the statutory test is met. */
export function deriveArt55Conversion(input = {}) {
  const { row, profile } = profileOf(input);
  const type = String(profile.contractType || row.contractType || profile.contract?.type || "").toLowerCase();
  const today = input.today || localDateKey();
  const cite = citeRule("contract.fixed.continuation.cite", today);
  if (type !== "fixed") return { ok: true, applies: false, converts: false, approaching: false, cite };
  if (workPatternForcesFixed(profile.workPattern || profile.contract?.workPattern || row.workPattern)) {
    return { ok: true, applies: false, converts: false, approaching: false, seasonal: true, cite };
  }
  const identity = deriveSaudiStatus(row);
  if (identity.saudi !== true) {
    return {
      ok: true,
      applies: false,
      converts: false,
      approaching: false,
      nonSaudi: identity.nationalitySaudi === false || identity.idKind === "iqama",
      cite: identity.nationalitySaudi === false
        ? citeRule("contract.nonSaudi.fixed.cite", today)
        : cite,
    };
  }
  const renewals = Math.max(0, Number(profile.contractRenewalCount ?? profile.contract?.renewalCount ?? row.renewalCount ?? 0) || 0);
  const start = String(profile.contract?.startDate || profile.hireDate || row.hireDate || "").slice(0, 10);
  const end = String(profile.contract?.endDate || profile.contractEndDate || row.contractEndDate || "").slice(0, 10);
  const maxRenewals = ruleValue("contract.fixed.maxConsecutiveRenewals", today);
  const maxYears = ruleValue("contract.fixed.maxYearsBeforeIndefinite", today);
  const years = start ? serviceYears(start, today) : 0;
  const continued = Boolean(end && today > end);
  const hitCount = renewals >= maxRenewals;
  const hitYears = years >= maxYears;
  const converts = continued && (renewals === 0 || hitCount || hitYears);
  const daysLeft = end ? daysUntilExpiry(end, today) : null;
  const approaching = !converts && (
    hitCount
    || hitYears
    || renewals >= Math.max(0, maxRenewals - 1)
    || years >= maxYears - 0.5
    || (continued && renewals > 0 && !hitCount && !hitYears)
    || (typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 60 && (renewals >= 2 || years >= 3))
  );
  const trigger = converts
    ? (renewals === 0 ? "continued" : hitCount ? "renewals" : "years")
    : (continued && renewals > 0 ? "record_renewal" : approaching ? "watch" : null);
  return {
    ok: true,
    applies: true,
    converts,
    approaching,
    continued,
    renewals,
    years,
    maxRenewals,
    maxYears,
    trigger,
    cite,
    reason: converts
      ? "يُعد العقد غير محدد المدة وفق المادة 55 — يُكتب النوع في الملف."
      : "",
    reasonEn: converts
      ? "The contract is deemed indefinite under Article 55 — the file type is rewritten."
      : "",
  };
}

function isTerminatedProfile(profile) {
  return String(profile?.employmentStatus || "").trim().toLowerCase() === "terminated";
}

/** Patch that writes Article 55 onto the employee file. Empty when the test is not met. */
export function art55FilePatch(employee, onDate) {
  const profile = employee?.profile && typeof employee.profile === "object" ? employee.profile : {};
  const art55 = deriveArt55Conversion({ ...employee, profile, today: onDate });
  if (isTerminatedProfile(profile) || !art55.converts) return { patch: {}, art55 };
  const previousEnd = String(profile.contract?.endDate || profile.contractEndDate || "");
  return {
    art55,
    patch: {
      contractType: "indefinite",
      contractEndDate: "",
      art55AppliedAt: onDate || localDateKey(),
      art55AppliedTrigger: art55.trigger,
      art55PreviousEndDate: previousEnd,
      contract: {
        ...(profile.contract || {}),
        type: "indefinite",
        endDate: "",
      },
    },
  };
}

/** Article 55 rewrite plus statutory leave floors. A future end date is a written renewal — no conversion. */
export function laborFilePatch(employee, onDate) {
  const today = onDate || localDateKey();
  const profile = employee?.profile && typeof employee.profile === "object" ? employee.profile : {};
  const { patch, art55 } = art55FilePatch(employee, today);
  if (isTerminatedProfile(profile)) return { patch: {}, art55, floors: false };
  const floorProfile = { ...profile, ...patch };
  const totals = { ...(profile.leaveTotals || {}) };
  let floors = false;
  for (const ty of leaveTypesForProfile(floorProfile)) {
    const floor = statutoryLeaveFloor(ty.key, floorProfile, today);
    if (floor == null) continue;
    const current = Number(totals[ty.key]);
    if (ty.key === "iddah") {
      if (!Number.isFinite(current) || current !== floor) {
        totals[ty.key] = floor;
        floors = true;
      }
      continue;
    }
    if (!Number.isFinite(current) || current < floor) {
      totals[ty.key] = floor;
      floors = true;
    }
  }
  if (floors) patch.leaveTotals = totals;
  return { patch, art55, floors };
}
