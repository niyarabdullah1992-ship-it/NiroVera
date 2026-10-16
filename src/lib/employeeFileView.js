import { collectEmployeeValidityDocs, daysUntilExpiry, EXPIRY_WARN_DAYS, localDateKey } from "./complianceDerivations.js";
import {
  optionLabel,
  CONTRACT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ID_TYPE_OPTIONS,
  MARITAL_OPTIONS,
  RELIGION_OPTIONS,
  displayProfileField,
  religionEffectNote,
  isFixedContractType,
  isIqamaIdType,
  isNationalIdType,
  isRamadanHoursSubject,
  profileFieldValue,
  profileGender,
} from "./employeeProfileFields.js";
import { isOnLeaveToday, remainingLeaveDays, serviceYearsFromHire, statutoryLeaveFloor, usedLeaveDays, leaveTypeLabel } from "./leaveTypes.js";
import { pendingNightRotate } from "./nightRotateCycle.js";
import { nightAllowanceKind, payableNightAllowance } from "./shiftWeek.js";
import { collectRequestAuditLogs, hasPendingLeaveTopup, presentRequestAuditText, requestAuditActorLabel } from "./otherRequestDerivations.js";
import { statutoryGlowState } from "./statutoryItem.js";
import { assignWageFields, gosiRegistrationIso, gosiSubscriberClass, readGosiRegisteredAt, readSubscriberNumber, readWageFields, WAGE_FIELD_KEYS } from "./facts/index.js";

function employeeFileStatus(employee, ar) {
  const hireIso = employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "";
  const hireDate = hireIso ? new Date(`${String(hireIso).slice(0, 10)}T00:00:00`) : null;
  const today = localDateKey();
  const preStart = hireDate && hireDate > new Date();
  if (preStart) return { label: ar ? "قيد المباشرة" : "Pending start", kind: "warn" };
  if (employee?.active === false) return { label: ar ? "غير نشط" : "Inactive", kind: "bad" };
  if (isOnLeaveToday(employee)) return { label: ar ? "في إجازة" : "On leave", kind: "warn" };
  const acting = (employee?.actingAssignments || []).some((item) => {
    if (item?.endedAt) return false;
    const until = String(item.until || "").slice(0, 10);
    return !until || until >= today;
  });
  if (acting) return { label: ar ? "مكلَّف" : "Acting", kind: "ok" };
  const probationEnd = String(employee?.profile?.probationEnd || employee?.profile?.contract?.probationEnd || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(probationEnd) && probationEnd >= today) {
    return { label: ar ? "فترة تجربة" : "Probation", kind: "warn" };
  }
  return { label: ar ? "على رأس العمل" : "On the job", kind: "ok" };
}
import { eosGratuity } from "./offboardingDerivations.js";
import { citeRule, laborDayKey, ruleValue, religionOnFile } from "./laborRules.js";
import { officialHolidayList } from "./ummAlQuraCalendar.js";
import { effectiveCutDays, effectivePenalty, faceOf, fmtDisciplineDate, isErasedFromEmployeeRecord, penaltyShiftLabel } from "./disciplineBoard.js";
import { HOSPITAL_FAR_MINUTES } from "./allowanceKinds.js";
import { WAGE_TYPE_OPTIONS } from "./consentEffects.js";

export function countAr(n, one, two, few, many, zero) {
  if (n === 0) return zero || "لا شيء";
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Personnel file: approved / settled leave only — pending lives in طلباتي. */
export function isLeaveOnFile(row) {
  const status = String(row?.status || "").toLowerCase();
  return status === "approved" || status === "settled";
}

export function isLeavePendingDecision(row) {
  return String(row?.status || "pending").toLowerCase() === "pending";
}

export function leaveOnFile(requests = []) {
  return (requests || []).filter(isLeaveOnFile);
}

export function hasPendingLeaveDecision(requests = []) {
  return (requests || []).some(isLeavePendingDecision);
}

export function hasPendingLeaveFilePointer(employee) {
  return hasPendingLeaveDecision(employee?.leaveRequests) || hasPendingLeaveTopup(employee?.otherRequests);
}

export const PENDING_LEAVE_HREF = "/app/requests";

/** Signed-in person: `employee.id === currentUser.employeeId`, with `id` when the session user is the employee row. */
export function viewerEmployeeId(currentUser) {
  if (!currentUser) return "";
  return String(currentUser.employeeId || currentUser.id || "").trim();
}

/** Non-empty ids that name this actor — never an empty string that could match every coworker. */
export function viewerActorIds(currentUser) {
  if (!currentUser) return [];
  return [...new Set([
    viewerEmployeeId(currentUser),
    String(currentUser.id || "").trim(),
    String(currentUser.employeeId || "").trim(),
  ].filter(Boolean))];
}

export function isViewerOwnFile(employee, currentUser) {
  if (!employee || !currentUser) return false;
  const fileIds = [employee.id, employee.employeeId].map((value) => String(value || "").trim()).filter(Boolean);
  const viewerIds = viewerActorIds(currentUser);
  if (!fileIds.length || !viewerIds.length) return false;
  return fileIds.some((id) => viewerIds.includes(id));
}

/** طلباتي ملفي subject — roster row for the signed-in person, even when session id ≠ employee.id. */
export function requestSelfEmployee(user, roster) {
  if (!user) return null;
  const people = Array.isArray(roster) ? roster : [];
  const want = viewerEmployeeId(user);
  const sessionId = String(user.id || "").trim();
  if (want) {
    const exact = people.find((row) => String(row?.id || "").trim() === want);
    if (exact) return exact;
  }
  const matches = people.filter((row) => isViewerOwnFile(row, user));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return matches.find((row) => String(row.id || "").trim() === want)
      || matches.find((row) => String(row.id || "").trim() === sessionId)
      || matches.find((row) => String(row.employeeId || "").trim() === sessionId)
      || matches.find((row) => String(row.employeeId || "").trim() === want)
      || null;
  }
  if (!people.length) return user;
  return isViewerOwnFile(user, user) ? user : null;
}

/**
 * How the open file speaks to the viewer.
 * Own file: ملفي / تنبيهاتي. Someone else: ملف {الاسم} / تنبيهاته — never «ملفي».
 * Hours-board left rail: تنبيهات of the open file only.
 */
export function employeeFileVoice({ employee, currentUser, ar = true } = {}) {
  const own = isViewerOwnFile(employee, currentUser);
  const name = String(employee?.name || "").trim();
  const alerts = own
    ? (ar ? "تنبيهاتي" : "My alerts")
    : (ar ? "تنبيهاته" : (name ? `${name}'s alerts` : "Their alerts"));
  return {
    own,
    title: own
      ? (ar ? "ملفي" : "My file")
      : (ar ? `ملف ${name || "الموظف"}` : (name ? `${name}'s file` : "Employee file")),
    warnings: alerts,
    alerts,
    inbox: ar ? "إشعاراتي" : "My notices",
    badge: ar ? "أنت" : "You",
    fileBadge: ar ? "ملفي" : "My file",
    nightSubject: own ? (ar ? "ملفي" : "My file") : name,
    emptyAlert: ar ? "لا تنبيه مستحق" : "No alert due",
  };
}

export function pendingLeavePointerCopy(ar = true) {
  return ar
    ? "طلب بانتظار القرار — الرد في طلباتي"
    : "A request is awaiting a decision — reply in My Requests";
}

/**
 * Hours-board left rail: short chips for the open file only.
 * Green = this person is in_scope and not owed. Red = this person is due.
 * Station `nightCompensation` and coworker night duty never open a chip.
 */
export function employeeFileHoursAlerts({
  employee,
  schedule,
  weekStart,
  ar = true,
  laborCalendar,
} = {}) {
  const chips = [];
  const glow = statutoryGlowState({
    kind: "18632",
    employee,
    schedule,
    weekStart,
    laborCalendar,
  });
  const nightPending = !!pendingNightRotate(employee);
  const personNight = glow === "due" || glow === "in_scope" || nightPending;
  if (personNight) {
    const due = glow === "due" || nightPending;
    chips.push({
      id: "18632",
      label: ar ? "موافقة العمل الليلي" : "Night-work consent",
      due,
      glow: due ? "due" : "in_scope",
      href: "/app/requests",
      decisionId: "18632",
    });
  }
  if (hasPendingLeaveFilePointer(employee)) {
    chips.push({
      id: "pending-request",
      label: ar ? "طلب بانتظار القرار" : "Request awaiting a decision",
      due: true,
      glow: "due",
      href: PENDING_LEAVE_HREF,
    });
  }
  return {
    chips,
    anyDue: chips.some((row) => row.due),
    empty: chips.length === 0,
    text: chips.map((row) => row.label).join("\n"),
  };
}

/**
 * إدارة الجدول: تنبيهات فقط لمن حان استحقاقه (3 أشهر / موافقة معلّقة).
 * النظام يشتقها — الموظف لا يرسل إشعاراً. صفر أشهر ≠ تنبيه.
 */
export function managerHoursAlerts({
  employees = [],
  schedule,
  weekStart,
  ar = true,
  laborCalendar,
} = {}) {
  const chips = [];
  for (const employee of employees) {
    const glow = statutoryGlowState({
      kind: "18632",
      employee,
      schedule,
      weekStart,
      laborCalendar,
    });
    const nightPending = !!pendingNightRotate(employee);
    if (glow !== "due" && !nightPending) continue;
    chips.push({
      id: `18632-${employee.id}`,
      name: employee.name,
      label: ar
        ? `${employee.name} — موافقة ليلية مستحقة`
        : `${employee.name} — night consent due`,
      due: true,
      glow: "due",
      href: "/app/requests/manage",
      decisionId: "18632",
    });
  }
  return {
    chips,
    anyDue: chips.length > 0,
    empty: chips.length === 0,
    text: chips.map((row) => row.label).join("\n"),
  };
}

export function niceFileDate(iso, ar = true) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso || "—";
  const months = ar
    ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(s.slice(8, 10))} ${months[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
}

export function moneySar(n, ar = true) {
  return `${Math.round(Number(n) || 0).toLocaleString("en-US")} ${ar ? "ر.س" : "SAR"}`;
}

function tone(kind) {
  if (kind === "ok") return { color: "var(--nv-ok-ink)", bg: "var(--nv-ok-soft)", border: "var(--nv-ok-line)" };
  if (kind === "warn") return { color: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)" };
  if (kind === "bad") return { color: "var(--nv-bad-ink)", bg: "var(--nv-bad-soft)", border: "var(--nv-bad-line)" };
  return { color: "var(--nv-ink3)", bg: "var(--nv-soft)", border: "var(--nv-line)" };
}

function chipOf(text, kind) {
  return { hasChip: Boolean(text), chip: text || "", ...tone(kind || "mute") };
}

export function serviceParts(hireIso, today) {
  const years = serviceYearsFromHire(hireIso, today);
  const whole = Math.floor(years);
  const months = Math.min(11, Math.round((years - whole) * 12));
  return { years, whole, months };
}

export function serviceLabel(hireIso, ar, today) {
  if (!hireIso) return "—";
  const { whole, months } = serviceParts(hireIso, today);
  if (!ar) return `${whole}y ${months}m`;
  return `${countAr(whole, "سنة", "سنتان", "سنوات", "سنة", "أقل من سنة")}${months ? ` و${countAr(months, "شهر", "شهران", "أشهر", "شهراً")}` : ""}`;
}

function moneyOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function namedAllowanceParts(source) {
  if (!source || typeof source !== "object") return null;
  const housing = moneyOrNull(source.housingAllowance ?? source.housing);
  const transport = moneyOrNull(source.transportAllowance ?? source.transport);
  const other = moneyOrNull(source.otherAllowances ?? source.other);
  if (![housing, transport, other].some((n) => n != null && n > 0)) return null;
  return {
    housing: Math.max(0, housing || 0),
    transport: Math.max(0, transport || 0),
    other: Math.max(0, other || 0),
  };
}

/**
 * Housing, transport, and other allowances from the file.
 * A nested contract split is used only when it already equals the lump allowance
 * within 1 SAR. A lump with empty housing/transport keys stays a lump.
 */
export function contractAllowanceSplit(profile = {}, allowanceTotal) {
  const direct = namedAllowanceParts(profile);
  if (direct) return { ...direct, from: "profile" };
  const lump = Number(allowanceTotal ?? profile.allowances);
  const target = Number.isFinite(lump) ? lump : 0;
  const candidates = [profile.contract, profile.contract?.wage, profile.wage];
  for (const source of candidates) {
    const nested = namedAllowanceParts(source);
    if (!nested) continue;
    const sum = nested.housing + nested.transport + nested.other;
    if (Math.abs(sum - target) <= 1) return { ...nested, from: "contract" };
  }
  return null;
}

/**
 * Contributory wage for GOSI (employer guide): basic + housing + commissions, capped at 45,000 and
 * floored at 1,500 (annuity) / 400 (hazards only). Without a split, housing cannot be told apart and
 * the lump is used.
 */
export function contributoryWage(wage = {}, saudi = true) {
  const base = Number(wage.base) || 0;
  const raw = wage.split
    ? base + (Number(wage.housing) || 0) + (Number(wage.commission) || 0)
    : base + (Number(wage.allowances) || 0);
  if (raw <= 0) return 0;
  const cap = Number(ruleValue("compliance.gosi.wageCeiling")) || 45000;
  const floor = saudi === false
    ? Number(ruleValue("compliance.gosi.wageFloorHazard")) || 400
    : Number(ruleValue("compliance.gosi.wageFloorAnnuity")) || 1500;
  return Math.min(cap, Math.max(floor, raw));
}

/**
 * Named Art. 2 lines kept apart from «بدلات أخرى»: effort/hazard (2/2), cost of living or family (2/3),
 * and the month's commission (2/1). They are always added — never folded into a lump.
 */
export function wageExtras(profile = {}) {
  const n = (v) => Math.max(0, Number(v) || 0);
  const hazard = n(profile.hazardAllowance);
  const living = n(profile.livingAllowance);
  const commission = n(profile.commissionAmount);
  // Site allowances (contract, Art. 2) — the cash side of the remote-site duties in Arts. 146–147.
  const remote = n(profile.remoteAreaAllowance);
  const medical = n(profile.medicalDistanceAllowance);
  const meals = n(profile.mealAllowance);
  return { hazard, living, commission, remote, medical, meals, sum: hazard + living + commission + remote + medical + meals };
}

/**
 * In-kind benefits (Art. 2/5): valued at most two months of basic wage a year unless the contract sets more;
 * housing provided in kind satisfies Art. 61/5, transport provided in kind satisfies Art. 148.
 */
export function inKindOf(profile = {}) {
  const base = Math.max(0, Number(profile.baseSalary) || 0);
  const asked = Math.max(0, Number(profile.inKindMonthly) || 0);
  const cap = Math.round((base * 2 / 12) * 100) / 100;
  const value = profile.inKindByContract ? asked : Math.min(asked, cap);
  return {
    housingProvided: profile.housingMode === "provided",
    transportProvided: profile.transportMode === "provided",
    transportRegular: profile.transportMode === "regular",
    monthly: value,
    capped: !profile.inKindByContract && asked > cap,
    cap,
  };
}

export function employeeWageSplit(profile = {}, employee) {
  const person = employee || { profile };
  const night = payableNightAllowance(person);
  const nightKind = nightAllowanceKind(person.profile?.nightRemedy?.allowanceKind);
  const base = Number(profile.baseSalary) || 0;
  const extras = wageExtras(profile);
  const parts = contractAllowanceSplit(profile, profile.allowances);
  if (parts) {
    const h = parts.housing;
    const t = parts.transport;
    const o = parts.other + extras.sum;
    return {
      base, housing: h, transport: t, other: o, otherPlain: parts.other,
      hazard: extras.hazard, living: extras.living, commission: extras.commission,
      remote: extras.remote, medical: extras.medical, meals: extras.meals, extras: extras.sum,
      allowances: h + t + o + night,
      total: base + h + t + o + night,
      night, nightKind, split: true, splitFrom: parts.from,
    };
  }
  const lump = Number(profile.allowances) || 0;
  return {
    base, housing: 0, transport: 0, other: 0, otherPlain: 0,
    hazard: extras.hazard, living: extras.living, commission: extras.commission,
    remote: extras.remote, medical: extras.medical, meals: extras.meals, extras: extras.sum,
    allowances: lump + extras.sum + night, total: base + lump + extras.sum + night, night, nightKind, split: false, splitFrom: "",
  };
}

export function employeeCustodyRows(assets = [], employeeId, ar = true) {
  return (assets || [])
    .filter((asset) => String(asset.holderId || asset.assignedTo || "") === String(employeeId) || String(asset.holderName || "") === String(employeeId))
    .map((asset) => {
      const open = asset.status === "in_custody" || asset.status === "handed" || !asset.returnedAt;
      return {
        name: asset.name || asset.title || "—",
        ref: asset.code || asset.serial || asset.id || "—",
        at: niceFileDate(asset.handedAt || asset.assignedAt || asset.createdAt, ar),
        state: open ? (ar ? "بحوزته" : "In hand") : (ar ? "أُعيد" : "Returned"),
        open,
        color: open ? "#8A6516" : "#137A49",
      };
    });
}

function art112Rows(ar, calendar, onDate) {
  return officialHolidayList(onDate || laborDayKey(new Date()), calendar).map((row) => {
    const leaveName = ar ? row.ar : row.en;
    return {
      name: leaveName,
      art: "112",
      ent: ar ? row.noteAr : row.noteEn,
      wage: ar ? "بأجر كامل — لا تُخصم من السنوية" : "Full pay — not taken from annual",
      cond: ar
        ? `${leaveName} — مقفلة في الجدول (${row.from}) بلا طلب من طلباتي · المادة 112`
        : `${leaveName} — locked on the roster (${row.from}), not a My Requests leave · Art. 112`,
    };
  });
}

/**
 * Allowances and what the Labour Law does with each — Art. 2 (actual wage), 84 (end of service on the
 * last actual wage), 109 (annual leave paid on the actual wage), 107 (overtime: hourly wage + 50% of the
 * basic hourly wage), 18632 (night pay or night transport from the roster decision).
 * The overtime hour is an estimate on 30 days × 8 hours, labelled as such.
 */
export function allowanceLawRows(wage = {}, ar = true, inKind = null) {
  const n = (v) => Number(v) || 0;
  const base = n(wage.base);
  const extras = n(wage.extras);
  const yes = ar ? "يدخل" : "Counts";
  const no = ar ? "لا يدخل" : "Excluded";
  const inHour = ar ? "في أجر الساعة فقط" : "In the hourly wage only";
  const fixed = wage.split
    ? [
      ["housing", ar ? "بدل السكن" : "Housing", n(wage.housing), ar ? "م 61" : "Art. 61"],
      ["transport", ar ? "بدل النقل" : "Transport", n(wage.transport), ar ? "م 2" : "Art. 2"],
      ["other", ar ? "بدلات أخرى" : "Other allowances", n(wage.otherPlain ?? (n(wage.other) - extras)), ar ? "م 2" : "Art. 2"],
    ]
    : [["lump", ar ? "البدلات (مجموع)" : "Allowances (lump)", Math.max(0, n(wage.allowances) - n(wage.night) - extras), ar ? "م 2" : "Art. 2"]];
  fixed.push(
    ["hazard", ar ? "بدل طبيعة عمل أو خطر" : "Effort or hazard allowance", n(wage.hazard), ar ? "م 2" : "Art. 2"],
    ["living", ar ? "بدل غلاء معيشة أو عائلي" : "Cost-of-living or family allowance", n(wage.living), ar ? "م 2" : "Art. 2"],
    ["remote", ar ? "بدل منطقة نائية" : "Remote-area allowance", n(wage.remote), ar ? "م 2 · 146" : "Art. 2 · 146"],
    ["medical", ar ? "بدل بُعد الخدمات الطبية" : "Distance-from-care allowance", n(wage.medical), ar ? "م 144 · 146/3" : "Art. 144 · 146/3"],
    ["meals", ar ? "بدل إعاشة" : "Meals allowance", n(wage.meals), ar ? "م 147" : "Art. 147"],
  );
  const rows = fixed.filter(([, , amount]) => amount > 0).map(([key, name, amount, cite]) => ({
    key, name, amount, cite, eos: yes, leave: yes, ot: inHour, cash: true,
  }));
  if (n(wage.commission) > 0) {
    rows.push({
      key: "commission", name: ar ? "العمولة" : "Commission", amount: n(wage.commission), cite: ar ? "م 2 · 86" : "Art. 2 · 86",
      eos: ar ? "يدخل ما لم يُستثنَ كتابةً" : "Counts unless excluded in writing", leave: yes, ot: inHour, cash: true,
    });
  }
  if (n(wage.night) > 0) {
    rows.push({
      key: "night",
      name: wage.nightKind === "transport" ? (ar ? "بدل نقل ليلي" : "Night transport") : (ar ? "أجر ليلي" : "Night pay"),
      amount: n(wage.night), cite: "18632",
      eos: yes, leave: yes, ot: inHour, cash: true,
    });
  }
  if (inKind && inKind.monthly > 0) {
    rows.push({
      key: "inkind", name: ar ? "ميزات عينية" : "In-kind benefits", amount: inKind.monthly, cite: ar ? "م 2" : "Art. 2",
      eos: yes, leave: ar ? "لا تُصرف نقداً" : "Not paid in cash", ot: no, cash: false,
    });
  }
  const cash = base + rows.filter((row) => row.cash).reduce((sum, row) => sum + row.amount, 0);
  const total = cash + rows.filter((row) => !row.cash).reduce((sum, row) => sum + row.amount, 0);
  const otHour = cash / 240 + (base / 240) * 0.5;
  return {
    rows,
    base,
    total,
    cash,
    otHour: Math.round(otHour * 100) / 100,
    note: ar
      ? "الأجر الفعلي = الأساسي + البدلات والعمولات والميزات العينية (المادة 2). عليه تُحسب مكافأة نهاية الخدمة (84). ساعة الإضافي = أجر الساعة + 50٪ من أجر الساعة الأساسي (107) — تقدير على 30 يوماً × 8 ساعات."
      : "Actual wage = base + allowances, commission and in-kind benefits (Art. 2). End of service (84) uses it. An overtime hour = the hourly wage + 50% of the basic hourly wage (107) — estimated on 30 days × 8 hours.",
    no,
  };
}

export function leaveCatalogFor(profile, ar = true, calendar, onDate) {
  const gender = profileGender(profile);
  const female = gender === "female";
  const male = gender === "male";
  // Hajj and the iddah length follow the religion on file — nothing is assumed when it is empty.
  const muslim = religionOnFile({ profile }) === "muslim";
  const groups = [
    {
      title: ar ? "رصيد يتراكم" : "A balance that accumulates",
      rule: ar ? "تُحسب وتُرحَّل وتُعوَّض نقداً عند نهاية الخدمة." : "Counted, carried, and paid in cash at the end of service.",
      rows: [
        { name: ar ? "سنوية" : "Annual", art: "109", ent: ar ? "21 يوماً — 30 بعد خمس سنوات خدمة متصلة" : "21 days — 30 after five continuous years", wage: ar ? "بأجر كامل يُدفع مقدماً" : "Full pay, in advance", cond: ar ? "مدة الخدمة تحدّد الاستحقاق" : "Service length sets the entitlement" },
        { name: ar ? "تأجيل أو تجزئة" : "Deferral or split", art: "110", ent: ar ? "تأجيل إلى السنة التالية بموافقة، وللعمل حتى 90 يوماً" : "Postpone to next year with consent; employer up to 90 days", wage: ar ? "يتبع وقت الاستخدام" : "Follows when it is taken", cond: ar ? "موافقة مكتوبة" : "Written consent" },
        { name: ar ? "مقابل نهاية الخدمة" : "On exit", art: "111", ent: ar ? "أجر أيام الإجازة غير المستخدمة" : "Pay for unused leave days", wage: ar ? "يُصرف على الأجر الأخير" : "Paid on last wage", cond: ar ? "عند انتهاء الخدمة" : "When service ends" },
      ],
    },
    {
      title: ar ? "بحكم النظام — بواقعة لا برصيد" : "By the Law — an event, not a balance",
      rule: ar ? "لا رصيد لها: استحقاقها واقعة ومستند مؤيد." : "No running balance: the event and its paper open the right.",
      rows: [
        { name: ar ? "مرضية" : "Sick", art: "117", ent: ar ? "30 كامل · 60 بثلاثة أرباع · 30 بغير أجر في السنة" : "30 full · 60 at three-quarters · 30 unpaid in the year", wage: ar ? "متدرّج حسب المستنفد" : "Stepped by what was used", cond: ar ? "تقرير طبي معتمد" : "Approved medical report" },
        { name: female ? (ar ? "وفاة أصل أو فرع" : "Death of parent or child") : (ar ? "وفاة زوج أو أصل أو فرع" : "Death of spouse, parent or child"), art: "113", ent: ar ? "5 أيام" : "5 days", wage: ar ? "بأجر كامل" : "Full pay", cond: female ? (ar ? "وثيقة الوفاة · وفاة الزوج من العدّة 160" : "Death certificate · husband death is iddah 160") : (ar ? "وثيقة الوفاة" : "Death certificate") },
        { name: ar ? "وفاة أخ أو أخت" : "Death of a sibling", art: "113", ent: ar ? "3 أيام" : "3 days", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "وثيقة الوفاة" : "Death certificate" },
        { name: ar ? "زواج" : "Marriage", art: "113", ent: ar ? "5 أيام — مرة واحدة" : "5 days — once", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "عقد الزواج" : "Marriage contract" },
        ...(male ? [{ name: leaveTypeLabel("paternity", ar), art: "113", ent: ar ? "3 أيام" : "3 days", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "شهادة الميلاد" : "Birth certificate" }] : []),
        ...(muslim ? [{ name: ar ? "حج" : "Hajj", art: "114", ent: ar ? "10 إلى 15 يوماً — مرة في الخدمة" : "10 to 15 days — once in service", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "سنتان خدمة متصلة، ولم يؤدِّه قبلاً" : "Two continuous years, and Hajj not performed before" }] : []),
        { name: ar ? "امتحان" : "Exam", art: "115", ent: ar ? "أيام الامتحان الفعلية" : "The actual exam days", wage: ar ? "بأجر كامل — وبغير أجر إن كان معاداً" : "Full pay — unpaid if a repeat", cond: ar ? "طلب قبل 15 يوماً أو ورقة مواعيد متأخرة في يوم صدورها. إثبات أداء بعد الامتحان. صاحب العمل لا يرفض المستوفي" : "Request 15 days ahead or a late timetable paper that day. Sitting proof after the exam. Employer cannot refuse a qualifying file" },
        ...art112Rows(ar, calendar, onDate),
      ],
    },
    {
      title: ar ? "بحكم نظام التأمينات" : "Under the social insurance law",
      rule: ar ? "لا تُخصم من رصيد الإجازات؛ التعويض عبر فرع الأخطار المهنية." : "Not taken from the leave balance; compensated through occupational hazards.",
      rows: [
        { name: ar ? "إصابة عمل" : "Work injury", art: ar ? "تأمينات" : "GOSI", ent: ar ? "مدة العجز المؤقت بتقرير طبي" : "The temporary-disability period on a medical report", wage: ar ? "من التأمينات — أو من صاحب العمل إن لم تكن المنشأة مسجّلة: كامل 60 يوماً ثم 75٪ (المادة 137)" : "From GOSI — or, if not covered, the employer: full for 60 days then 75% (Art. 137)", cond: ar ? "تقرير طبي وتاريخ الإصابة" : "Medical report and the injury date" },
      ],
    },
    {
      title: ar ? "بغير أجر" : "Unpaid",
      rule: ar ? "توقف تراكم السنوية وتُنشئ بنداً في المسير." : "Stops annual accrual and opens a payroll line.",
      rows: [
        { name: ar ? "إجازة بغير أجر" : "Unpaid leave", art: "116", ent: ar ? "باتفاق الطرفين" : "By agreement", wage: ar ? "تُحسم من المسير" : "Deducted on the payroll", cond: ar ? "العقد يُوقف إن زادت على 20 يوماً" : "The contract suspends beyond 20 days" },
      ],
    },
  ];
  if (female) {
    groups.push({
      title: ar ? "خاصة بالمرأة" : "Specific to a woman",
      rule: ar ? "أحكامها لا تُقاس على غيرها." : "These rules are not measured against others.",
      rows: [
        { name: leaveTypeLabel("maternity", ar), art: "151", ent: ar ? "12 أسبوعاً توزّعها كيف شاءت" : "12 weeks she may place as she chooses", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "يُحظر تشغيلها 6 أسابيع بعد الوضع" : "She may not be put to work for 6 weeks after birth" },
        { name: leaveTypeLabel("maternity_extend", ar), art: "151", ent: ar ? "شهر بلا أجر بعد انتهاء الوضع" : "One unpaid month after maternity ends", wage: ar ? "بغير أجر — بلا إيقاف عقد 116" : "Unpaid — not an Art. 116 suspension", cond: ar ? "بعد وضع معتمد" : "After approved maternity" },
        { name: leaveTypeLabel("maternity_companion", ar), art: "151", ent: ar ? "شهر بأجر · وشهر بلا أجر" : "One paid month · one unpaid month", wage: ar ? "بأجر كامل ثم بغير أجر" : "Full pay then unpaid", cond: ar ? "مولود مريض أو ذو إعاقة يحتاج مرافقاً · تقرير طبي" : "Sick or disabled newborn needing a companion · medical report" },
        { name: leaveTypeLabel("iddah", ar), art: "160", ent: !religionOnFile({ profile }) ? (ar ? "حسب الديانة: 130 يوماً للمسلمة و15 لغيرها — حدّد الديانة في الملف" : "By religion: 130 days for a Muslim, 15 otherwise — set the religion on file") : religionOnFile({ profile }) === "muslim" ? (ar ? "4 أشهر وعشرة أيام — بطلب" : "4 months and 10 days — by request") : (ar ? "15 يوماً — بطلب" : "15 days — by request"), wage: isRamadanHoursSubject({ profile }) ? (ar ? "بأجر كامل — وتمديد بغير أجر عند الحمل حتى الوضع" : "Full pay — unpaid extension if pregnant until birth") : (ar ? "بأجر كامل" : "Full pay"), cond: ar ? "وثيقة الوفاة · لا عمل لدى الغير" : "Death certificate · no other employer" },
      ],
    });
  }
  return groups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({
      ...row,
      wageColor: /بغير أجر|تُحسم|متدرّج|unpaid|deduct|stepped/i.test(row.wage) ? "#8A6516" : "#137A49",
    })),
  }));
}

function fileDocs(employee, ar, today) {
  const profile = employee?.profile || {};
  const saudi = /سعود|saudi/i.test(String(profile.nationality || employee?.nationality || ""));
  const idType = profileFieldValue(profile, "idType", employee);
  const rows = [];
  const push = (name, ref, exp, kind = "doc") => {
    const days = daysUntilExpiry(exp, today);
    rows.push({
      kind,
      name,
      ref: ref || "—",
      exp: exp ? niceFileDate(exp, ar) : "—",
      expiry: exp || "",
      days,
      state: days == null ? (ar ? "دائم" : "Standing") : days < 0 ? (ar ? "منتهية" : "Expired") : days <= EXPIRY_WARN_DAYS ? (ar ? `تنتهي بعد ${countAr(days, "يوم", "يومين", "أيام", "يوماً")}` : `Ends in ${days}d`) : (ar ? "سارية" : "Valid"),
      color: days == null ? "#4B5567" : days < 0 ? "#8A1C2B" : days <= EXPIRY_WARN_DAYS ? "#8A6516" : "#137A49",
    });
  };
  push(
    saudi || isNationalIdType(idType) ? (ar ? "الهوية الوطنية" : "National ID") : (ar ? "الإقامة" : "Iqama"),
    profileFieldValue(profile, "nationalId", employee),
    profileFieldValue(profile, "idExpiry", employee),
  );
  const contractRef = profile.contractPdf || profile.contractFileName || profile.contractUrl || "";
  if (contractRef) push(ar ? "عقد العمل الموقّع" : "Signed contract", String(contractRef).slice(0, 28), profile.contractEndDate || profile.contract?.endDate || "");
  if (isIqamaIdType(idType) || (!saudi && profile.workPermitNumber)) {
    push(ar ? "رخصة العمل" : "Work permit", profile.workPermitNumber, profile.workPermitExpiry);
  }
  for (const cert of employee?.certificates || []) {
    push(cert.name || (ar ? "شهادة" : "Certificate"), cert.code || cert.fileName || cert.id, cert.expiryDate, "cert");
  }
  return rows;
}

export function buildEmployeeFileView({
  employee,
  stationName,
  roleLabel,
  cases = [],
  assets = [],
  managerName,
  ar = true,
  today,
  canEditFile = false,
  manageRequests = false,
  isSelf = false,
  laborCalendar,
} = {}) {
  const day = today || localDateKey();
  const profile = employee?.profile || {};
  const status = employeeFileStatus(employee, ar);
  const hireIso = profile.hireDate || employee?.hireDate || employee?.startDate || "";
  const years = serviceYearsFromHire(hireIso, day);
  const wage = employeeWageSplit(profile, employee);
  const inKind = inKindOf(profile);
  // Art. 2: the wage for end of service is the actual wage — cash lines plus in-kind benefits.
  const eosNow = eosGratuity(years, wage.total + inKind.monthly);
  const contractType = optionLabel(CONTRACT_TYPE_OPTIONS, profileFieldValue(profile, "contractType", employee), ar) || (ar ? "—" : "—");
  const fixed = isFixedContractType(profileFieldValue(profile, "contractType", employee));
  const annualLeft = remainingLeaveDays(profile, employee?.leaveRequests || [], "annual", day);
  const statutory = statutoryLeaveFloor("annual", profile, day) || 21;
  const usedSick = usedLeaveDays(employee?.leaveRequests || [], "sick", day, hireIso);
  const sickFull = ruleValue("leave.sick.fullPayDays", day);
  const sickMid = ruleValue("leave.sick.halfPayDays", day);
  const sickFullLeft = Math.max(0, sickFull - usedSick);
  const sickMidLeft = Math.max(0, sickMid - Math.max(0, usedSick - sickFull));
  const gosi = readSubscriberNumber(employee);
  const gosiRegisteredAt = readGosiRegisteredAt(employee);
  const gosiClass = gosiSubscriberClass(gosiRegisteredAt);
  const iban = String(profileFieldValue(profile, "iban", employee) || "").trim();
  const qiwa = String(profileFieldValue(profile, "qiwaTitle", employee) || profile.qiwaStatus || "").trim();
  const medicalExp = profileFieldValue(profile, "medicalInsuranceExpiry", employee);
  const medicalDays = daysUntilExpiry(medicalExp, day);
  const idExp = profileFieldValue(profile, "idExpiry", employee);
  const idDays = daysUntilExpiry(idExp, day);
  const written = profile.contractPdf || profile.contractFileName || profile.contractUrl || profile.contract?.fileName;
  const docs = fileDocs(employee, ar, day);
  const custody = employeeCustodyRows(assets, employee?.id, ar);
  const inHand = custody.filter((row) => row.open);
  const validityWarn = collectEmployeeValidityDocs(employee, day);
  const saudi = /سعود|saudi/i.test(String(profile.nationality || ""));
  const marital = optionLabel(MARITAL_OPTIONS, profileFieldValue(profile, "maritalStatus", employee), ar);
  const dependents = Number(profile.dependents) || 0;
  const idKind = optionLabel(ID_TYPE_OPTIONS, profileFieldValue(profile, "idType", employee), ar);

  const worstDoc = docs.reduce((min, row) => {
    if (row.days == null) return min;
    return Math.min(min, row.days);
  }, 9999);

  const compliance = [
    {
      id: "contract",
      tab: "contract",
      label: ar ? "العقد" : "Contract",
      ok: Boolean(qiwa || written),
      warn: false,
      state: (qiwa || written) ? (ar ? "مطابق" : "Aligned") : (ar ? "يحتاج إجراءً" : "Needs action"),
      note: `${qiwa ? (ar ? "مسجَّل في قوى" : "On Qiwa") : (ar ? "غير مسجَّل في قوى" : "Not on Qiwa")} · ${written ? (ar ? "نسخة مكتوبة" : "Written copy") : (ar ? "لا نسخة مكتوبة — المادة 51" : "No written copy — Art. 51")}`,
    },
    {
      id: "gosi",
      tab: "compliance",
      label: ar ? "التأمينات" : "GOSI",
      ok: Boolean(gosi),
      warn: false,
      state: gosi ? (ar ? "مطابق" : "On file") : (ar ? "يحتاج إجراءً" : "Needs action"),
      note: gosi ? (ar ? `مشترك · الأجر الخاضع ${moneySar(contributoryWage(wage), ar)}` : `Registered · contributory ${moneySar(contributoryWage(wage), ar)}`) : (ar ? "لا رقم اشتراك" : "No GOSI number"),
    },
    {
      id: "cchi",
      tab: "compliance",
      label: ar ? "الضمان الصحي" : "CCHI",
      ok: medicalDays != null && medicalDays > 0,
      warn: medicalDays != null && medicalDays <= 60,
      state: medicalDays == null ? (ar ? "يحتاج إجراءً" : "Needs action") : medicalDays < 0 ? (ar ? "منتهٍ" : "Expired") : medicalDays <= 60 ? (ar ? "ينتهي قريباً" : "Ending soon") : (ar ? "مطابق" : "Valid"),
      note: medicalExp ? (ar ? `ينتهي ${niceFileDate(medicalExp, ar)}` : `Ends ${niceFileDate(medicalExp, ar)}`) : (ar ? "لا تاريخ تغطية" : "No cover date"),
    },
    {
      id: "docs",
      tab: "identity",
      label: ar ? "الوثائق" : "Documents",
      ok: worstDoc >= 0,
      warn: worstDoc <= EXPIRY_WARN_DAYS,
      state: worstDoc < 0 ? (ar ? "يحتاج إجراءً" : "Needs action") : worstDoc <= EXPIRY_WARN_DAYS ? (ar ? "ينتهي قريباً" : "Ending soon") : (ar ? "مطابق" : "In date"),
      note: worstDoc === 9999 ? (ar ? "لا وثيقة مؤرّخة" : "No dated document") : worstDoc < 0 ? (ar ? "وثيقة منتهية" : "An expired document") : (ar ? `أقرب انتهاء بعد ${countAr(worstDoc, "يوم واحد", "يومين", "أيام", "يوماً")}` : `Nearest end in ${worstDoc}d`),
    },
  ].map((row) => ({
    ...row,
    ...tone(row.ok ? (row.warn ? "warn" : "ok") : "bad"),
  }));

  const facts = [
    { k: ar ? "العقد" : "Contract", v: contractType || "—", note: ar ? `${citeRule(fixed ? "contract.fixed.cite" : "contract.indefinite.cite")?.labelAr || "المادة 75"} · ${qiwa ? "مسجَّل في قوى" : "قوى"}` : `${fixed ? "Art. 50" : "Art. 75"} · Qiwa` },
    { k: ar ? "الأجر الشهري" : "Monthly wage", v: wage.total > 0 ? moneySar(wage.total, ar) : "—", note: ar ? `أساسي ${moneySar(wage.base, ar)} + بدلات` : `Base ${moneySar(wage.base, ar)} + allowances` },
    { k: ar ? "مدة الخدمة" : "Service", v: serviceLabel(hireIso, ar, day), note: hireIso ? (ar ? `منذ ${niceFileDate(hireIso, ar)}` : `Since ${niceFileDate(hireIso, ar)}`) : (ar ? "لا تاريخ تعيين" : "No hire date") },
    { k: ar ? "مكافأة نهاية الخدمة" : "End-of-service", v: wage.total > 0 && hireIso ? moneySar(eosNow, ar) : "—", note: ar ? "تقدير على الأجر الأخير — المادة 84" : "Estimate on last wage — Art. 84" },
    { k: ar ? "العهد بحوزته" : "Custody in hand", v: ar ? countAr(inHand.length, "عهدة واحدة", "عهدتان", "عهد", "عهدة", "لا عهدة") : `${inHand.length} in hand`, note: ar ? "تُستعاد في إخلاء الطرف" : "Returned at clearance" },
  ];

  // On his own file the worker sees no sanction: no to-do, no penalty rows, no count — they live in «الجزاءات».
  const mineCases = isSelf ? [] : (cases || []).filter((item) => String(item.employeeId) === String(employee?.id));
  const openCases = mineCases.filter((item) => !["ruling", "closed"].includes(item.status));
  const todos = [];
  if (!inKind.housingProvided && !(wage.housing > 0) && !(Number(profile.allowances) > 0)) {
    todos.push({ tab: "contract", text: ar ? "لا بدل سكن ولا سكن مؤمَّن — المادة 61 تُلزم بأحدهما" : "No housing allowance and no housing provided — Art. 61 requires one", tag: ar ? "المادة 61" : "Art. 61", kind: "warn" });
  }
  for (const doc of validityWarn) {
    todos.push({
      tab: "identity",
      text: `${ar ? doc.docLabelAr : doc.docLabelEn} — ${doc.days < 0 ? (ar ? "منتهية" : "expired") : niceFileDate(doc.expiryDate, ar)}`,
      tag: doc.days < 0 ? (ar ? "منتهية" : "Expired") : (ar ? "تجديد" : "Renew"),
      kind: doc.days < 0 ? "bad" : "warn",
    });
  }
  for (const item of mineCases.filter((row) => faceOf(row.status).id === "signed" || faceOf(row.status).id === "objected")) {
    todos.push({
      tab: "growth",
      text: ar ? `جزاء ${effectivePenalty(item, true)} — ${item.note || item.reason || ""}` : `Sanction ${effectivePenalty(item, false)} — ${item.note || item.reason || ""}`,
      tag: faceOf(item.status).id === "objected" ? (ar ? "ينتظر قراراً" : "Awaiting a ruling") : (ar ? "نافذ" : "In force"),
      kind: faceOf(item.status).id === "objected" ? "bad" : "warn",
    });
  }
  for (const row of inHand) {
    todos.push({ tab: "docs", text: ar ? `عهدة بحوزته: ${row.name}` : `In hand: ${row.name}`, tag: ar ? "متابعة" : "Watch", kind: "mute" });
  }
  const pendingLeave = hasPendingLeaveFilePointer(employee);
  if (pendingLeave) {
    todos.push({
      tab: "leave",
      text: pendingLeavePointerCopy(ar),
      tag: ar ? "طلباتي" : "Requests",
      kind: "warn",
      href: PENDING_LEAVE_HREF,
    });
  }

  const filed = leaveOnFile(employee?.leaveRequests)
    .sort((a, b) => String(b.reviewedAt || b.updatedAt || b.createdAt || "").localeCompare(String(a.reviewedAt || a.updatedAt || a.createdAt || "")))
    .map((row) => ({
      type: leaveTypeLabel(row.type, ar, undefined, row.startDate),
      art: citeRule(`leave.${row.type}.days`)?.article || citeRule(`leave.${row.type}.cite`)?.article || "—",
      days: ar ? countAr(Number(row.days) || 0, "يوم واحد", "يومان", "أيام", "يوماً") : `${row.days || 0}d`,
      meta: `${niceFileDate(row.startDate, ar)} → ${niceFileDate(row.endDate, ar)}${row.decidedByName ? ` · ${ar ? "اعتمدها" : "approved by"} ${row.decidedByName}` : ""}`,
      hasAt: Boolean(row.reviewedAt || row.updatedAt),
      atDate: niceFileDate(row.reviewedAt || row.updatedAt, ar),
      atTime: String(row.reviewedAt || row.updatedAt || "").slice(11, 16),
    }));

  const pct = (left, total) => {
    const t = Number(total) || 0;
    const l = Math.max(0, Number(left) || 0);
    if (!t) return { pct: "0%", color: "#6B7280" };
    const p = Math.round((l / t) * 100);
    return { pct: `${Math.max(0, Math.min(100, p))}%`, color: p > 50 ? "#1D9A5B" : p > 0 ? "#C9962B" : "#8A1C2B" };
  };
  const annualBar = pct(annualLeft ?? 0, statutory);
  const sick1 = pct(sickFullLeft, sickFull);
  const sick2 = pct(sickMidLeft, sickMid);
  const usedHajj = usedLeaveDays(employee?.leaveRequests || [], "hajj", day, hireIso);
  // Hajj and the iddah length follow the religion on file — nothing is assumed when it is empty.
  const muslim = religionOnFile({ profile }) === "muslim";
  const balances = [
    { name: ar ? "سنوية — المستحق النظامي" : "Annual — statutory", art: ar ? "المادة 109" : "Art. 109", val: ar ? `من ${statutory} — ${countAr(annualLeft ?? 0, "يوم متبقٍ", "يومان متبقيان", "أيام متبقية", "يوماً متبقياً")}` : `${annualLeft ?? 0} of ${statutory}`, ...annualBar },
    { name: ar ? "مرضية — المرتبة الأولى" : "Sick — first band", art: ar ? "المادة 117" : "Art. 117", val: ar ? `من ${sickFull} — ${countAr(sickFullLeft, "يوم متبقٍ", "يومان متبقيان", "أيام متبقية", "يوماً متبقياً")}` : `${sickFullLeft} of ${sickFull}`, ...sick1 },
    { name: ar ? "مرضية — المرتبة الثانية" : "Sick — second band", art: ar ? "المادة 117" : "Art. 117", val: ar ? `من ${sickMid} — ${countAr(sickMidLeft, "يوم متبقٍ", "يومان متبقيان", "أيام متبقية", "يوماً متبقياً")}` : `${sickMidLeft} of ${sickMid}`, ...sick2 },
    ...(muslim ? [{ name: ar ? "حج" : "Hajj", art: ar ? "المادة 114" : "Art. 114", val: usedHajj ? (ar ? "استُخدمت في الخدمة" : "Used in service") : (ar ? "متاحة — مرة واحدة في الخدمة" : "Available — once in service"), pct: usedHajj ? "0%" : "100%", color: usedHajj ? "#8A1C2B" : "#1D9A5B" }] : []),
  ];

  const opts = (list) => (list || []).map((item) => ({ value: item.value, label: ar ? item.ar : item.en }));
  const row = (k, v, chip, kind, field, type = "text", extra = {}) => ({
    k,
    v: v || "—",
    field: field || "",
    type,
    locked: extra.locked ?? !field,
    secret: Boolean(extra.secret),
    raw: extra.raw != null ? extra.raw : "",
    options: extra.options || null,
    ...chipOf(chip, kind),
  });

  const idCards = [
    {
      kicker: ar ? "الهوية" : "Identity",
      title: ar ? "من هو الموظف" : "Who the employee is",
      tag: ar ? "بيان أساسي" : "Core record",
      rows: [
        row(ar ? "الاسم الكامل" : "Full name", employee?.name, "", "", "name", "text", { raw: employee?.name || "" }),
        row(ar ? "نوع الهوية" : "ID type", idKind, "", "", "idType", "text", { raw: profileFieldValue(profile, "idType", employee), options: opts(ID_TYPE_OPTIONS) }),
        row(ar ? "رقم الهوية" : "ID number", profileFieldValue(profile, "nationalId", employee), "", "", "nationalId", "text", { raw: profileFieldValue(profile, "nationalId", employee), secret: true }),
        row(ar ? "انتهاء الهوية" : "ID expiry", niceFileDate(idExp, ar), idDays == null ? "" : idDays > 0 ? (ar ? "ساري" : "Valid") : (ar ? "منتهية" : "Expired"), idDays == null ? "mute" : idDays > 0 ? "ok" : "bad", "idExpiry", "date", { raw: idExp || "" }),
        row(ar ? "تاريخ الميلاد" : "Birth date", niceFileDate(profileFieldValue(profile, "birthDate", employee), ar), "", "", "birthDate", "date", { raw: profileFieldValue(profile, "birthDate", employee) }),
        row(
          ar ? "الجنس" : "Gender",
          displayProfileField({ key: "gender", options: "gender" }, profileFieldValue(profile, "gender", employee), ar) || (ar ? "غير مصنّف — صنّفه لإجازات الأمومة أو الأبوة" : "Unclassified — set it for maternity or paternity"),
          profileGender(profile) === "female" ? (ar ? "إجازات المرأة" : "Women's leave") : profileGender(profile) === "male" ? (ar ? "إجازة أبوة" : "Paternity") : (ar ? "يلزم التصنيف" : "Classification required"),
          profileGender(profile) ? "ok" : "warn",
          "gender",
          "text",
          { raw: profileFieldValue(profile, "gender", employee), options: opts(GENDER_OPTIONS) },
        ),
      ],
    },
    {
      kicker: ar ? "التوظيف" : "Employment",
      title: ar ? "الموقع في الهيكل" : "Place in the structure",
      tag: ar ? "من الهيكل — لا يُحرَّر هنا" : "From the org tree — not edited here",
      note: ar ? "المسمى يجب أن يطابق المسجَّل في منصة قوى؛ الاختلاف يمنع إصدار الوثائق." : "The title must match Qiwa; a mismatch blocks letters.",
      rows: [
        row(ar ? "المسمى الوظيفي" : "Title", roleLabel || profile.position, "", "", "position", "text", { raw: profile.position || "" }),
        row(ar ? "الإدارة" : "Department", profile.department, ar ? "من الهيكل — لا يُحرَّر هنا" : "From the org tree", "mute"),
        row(ar ? "الفرع" : "Station", stationName, ar ? "من الهيكل — لا يُحرَّر هنا" : "From the org tree", "mute"),
        row(ar ? "تاريخ التعيين" : "Hire date", niceFileDate(hireIso, ar), hireIso ? serviceLabel(hireIso, ar, day) : "", hireIso ? "ok" : "warn", "hireDate", "date", { raw: hireIso || "" }),
        row(ar ? "المدير المباشر" : "Line manager", managerName || "—"),
      ],
    },
    {
      kicker: ar ? "الجنسية والحالة النظامية" : "Nationality and legal status",
      title: ar ? "ما يخصّ الموظف من النظام" : "What the Law sees on this person",
      tag: ar ? "يؤثر في رخصة العمل والتوطين" : "Affects the work permit and localization",
      note: ar ? "نسبة التوطين (نطاقات) سجلُّ منشأة لا سجل موظف. ما يخصّ الموظف هنا هو جنسيته ومهنته النظامية." : "Nitaqat is a company register, not an employee one. What stays here is nationality and the official profession.",
      rows: [
        row(ar ? "الجنسية" : "Nationality", profile.nationality, saudi ? (ar ? "يُحتسب في نسبة التوطين" : "Counted in localization") : (ar ? "غير محتسب" : "Not counted"), saudi ? "ok" : "mute", "nationality", "text", { raw: profile.nationality || "" }),
        row(ar ? "نوع الهوية" : "ID type", idKind),
        row(ar ? "رخصة العمل" : "Work permit", saudi ? (ar ? "غير مطلوبة للسعودي" : "Not required for a Saudi") : (profile.workPermitNumber || "—"), saudi ? "" : (profile.workPermitExpiry ? `${ar ? "تنتهي" : "Ends"} ${niceFileDate(profile.workPermitExpiry, ar)}` : ""), saudi ? "mute" : "warn", saudi ? "" : "workPermitNumber", "text", { raw: profile.workPermitNumber || "" }),
        row(ar ? "المهنة النظامية" : "Official profession", profile.qiwaTitle || profile.position, ar ? "تطابق قوى" : "Matches Qiwa", "ok", "qiwaTitle", "text", { raw: profile.qiwaTitle || "" }),
      ],
    },
    {
      kicker: ar ? "البيانات الشخصية" : "Personal",
      title: ar ? "الحالة الاجتماعية والمعالون" : "Marital status and dependents",
      tag: ar ? "يؤثر في التغطية الطبية والإجازات" : "Affects medical cover and leave",
      rows: [
        row(ar ? "الحالة الاجتماعية" : "Marital status", marital, "", "", "maritalStatus", "text", { raw: profileFieldValue(profile, "maritalStatus", employee), options: opts(MARITAL_OPTIONS) }),
        row(
          ar ? "الدين" : "Religion",
          displayProfileField({ key: "religion", options: "religion" }, profileFieldValue(profile, "religion", employee), ar),
          religionEffectNote(employee, ar),
          isRamadanHoursSubject(employee) ? "ok" : "mute",
          "religion",
          "text",
          { raw: profileFieldValue(profile, "religion", employee), options: opts(RELIGION_OPTIONS) },
        ),
        row(ar ? "عدد المعالين" : "Dependents", dependents ? (ar ? countAr(dependents, "معال واحد", "معالان", "معالين", "معالاً") : String(dependents)) : "—", "", "", "dependents", "number", { raw: dependents || "" }),
        row(ar ? "التغطية الطبية" : "Medical cover", medicalExp ? niceFileDate(medicalExp, ar) : "—", medicalDays != null && medicalDays > 0 ? (ar ? "ساري" : "Valid") : "", medicalDays != null && medicalDays > 0 ? "ok" : "warn", "medicalInsuranceExpiry", "date", { raw: medicalExp || "" }),
      ],
    },
    {
      kicker: ar ? "الاتصال" : "Contact",
      title: ar ? "التواصل والطوارئ" : "Reach and emergency",
      tag: ar ? "يطلب الموظف تحديثه" : "The employee asks to update it",
      rows: [
        row(ar ? "الجوال" : "Mobile", employee?.phone, "", "", "phone", "text", { raw: employee?.phone || "", secret: true }),
        row(ar ? "البريد" : "Email", employee?.email, "", "", "", "text", { secret: true }),
        row(ar ? "جهة الطوارئ" : "Emergency contact", profile.emergencyName, "", "", "emergencyName", "text", { raw: profile.emergencyName || "" }),
        row(ar ? "جوال الطوارئ" : "Emergency phone", profile.emergencyPhone, "", "", "emergencyPhone", "text", { raw: profile.emergencyPhone || "" }),
        row(ar ? "المؤهل" : "Qualification", profile.qualification, "", "", "qualification", "text", { raw: profile.qualification || "" }),
      ],
    },
    {
      kicker: ar ? "حماية الأجور" : "Wage protection",
      title: ar ? "الحساب البنكي" : "Bank account",
      tag: ar ? "منصة لا مادة" : "A platform, not an article",
      note: ar ? "حماية الأجور نظام رفع ملفات لوزارة الموارد البشرية، وليست مادة في نظام العمل — فلا شارة لها." : "Wage protection is a ministry file-upload system, not a Labour Law article — so it has no chip.",
      rows: [
        row(ar ? "الآيبان" : "IBAN", iban, iban ? (ar ? "مطابق" : "On file") : (ar ? "ناقص" : "Missing"), iban ? "ok" : "bad", "iban", "text", { raw: iban, secret: true }),
        row(ar ? "البنك" : "Bank", profile.bankName || profile.bank, "", "", "bankName", "text", { raw: profile.bankName || profile.bank || "" }),
        row(ar ? "طريقة الصرف" : "Pay method", ar ? "تحويل بنكي — لا نقد" : "Bank transfer — not cash"),
      ],
    },
  ];

  const probationEnd = profile.probationEnd || profile.contract?.probationEnd;
  const contract = [
    row(ar ? "نوع العقد" : "Contract type", contractType, citeRule(fixed ? "contract.fixed.cite" : "contract.indefinite.cite")?.labelAr || (ar ? "المادة 75" : "Art. 75"), "mute", "contractType", "text", { raw: profileFieldValue(profile, "contractType", employee), options: opts(CONTRACT_TYPE_OPTIONS) }),
    row(
      ar ? "فئة الأجر" : "Wage type",
      (WAGE_TYPE_OPTIONS.find((o) => o.value === (profile.wageType || "monthly")) || WAGE_TYPE_OPTIONS[0])[ar ? "ar" : "en"],
      ar ? "المادة 59 — لا تحويل من الشهري إلا بموافقته الكتابية" : "Art. 59 — off monthly only with written consent",
      "mute",
      "wageType",
      "text",
      { raw: profile.wageType || "monthly", options: WAGE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: ar ? o.ar : o.en })) },
    ),
    row(ar ? "تاريخ البداية" : "Start", niceFileDate(hireIso, ar), "", "", "hireDate", "date", { raw: hireIso || "" }),
    row(ar ? "تاريخ النهاية" : "End", fixed ? niceFileDate(profile.contractEndDate || profile.contract?.endDate, ar) : (ar ? "غير محدد" : "Open"), fixed ? "" : (ar ? "مفتوح" : "Open"), fixed ? "warn" : "ok", fixed ? "contractEndDate" : "", "date", { raw: profile.contractEndDate || profile.contract?.endDate || "" }),
    row(ar ? "فترة التجربة" : "Probation", probationEnd ? niceFileDate(probationEnd, ar) : (ar ? "—" : "—"), citeRule("contract.probation.warnDays")?.labelAr || (ar ? "المادة 53" : "Art. 53"), "mute"),
    row(ar ? "ساعات العمل" : "Hours", ar ? "من جدول الدوام المنشور" : "From the published rota", citeRule("hours.week.ordinaryMaxHours")?.labelAr || (ar ? "المادة 98" : "Art. 98"), "mute"),
    row(ar ? "مسجَّل في قوى" : "On Qiwa", qiwa || (ar ? "—" : "—"), qiwa ? (ar ? "مطابق" : "Aligned") : (ar ? "يحتاج تسجيلاً" : "Needs registration"), qiwa ? "ok" : "bad", "qiwaTitle", "text", { raw: qiwa }),
    row(ar ? "السكن" : "Housing", inKind.housingProvided ? (ar ? "سكن مؤمَّن من المنشأة" : "Housing provided") : (wage.housing > 0 ? (ar ? "بدل نقدي مع الأجر" : "Cash allowance with the wage") : (ar ? "لم يُحدَّد" : "Not set")), ar ? "المادة 61" : "Art. 61", inKind.housingProvided || wage.housing > 0 ? "ok" : "warn", "housingMode", "text", { raw: profile.housingMode || "", options: [["cash", ar ? "بدل نقدي مع الأجر" : "Cash allowance"], ["provided", ar ? "سكن مؤمَّن من المنشأة" : "Housing provided"]].map(([value, label]) => ({ value, label })) }),
    row(ar ? "النقل" : "Transport", inKind.transportProvided ? (ar ? "وسيلة نقل مؤمَّنة" : "Transport provided") : inKind.transportRegular ? (ar ? "مواصلات منتظمة تصل الموقع" : "Regular transport reaches the site") : (wage.transport > 0 ? (ar ? "بدل نقدي" : "Cash allowance") : (ar ? "لم يُحدَّد" : "Not set")), ar ? "المادة 148" : "Art. 148", inKind.transportProvided || inKind.transportRegular || wage.transport > 0 ? "ok" : "warn", "transportMode", "text", { raw: profile.transportMode || "", options: [["cash", ar ? "بدل نقدي" : "Cash allowance"], ["provided", ar ? "وسيلة نقل مؤمَّنة" : "Transport provided"], ["regular", ar ? "مواصلات منتظمة تصل الموقع" : "Regular transport"]].map(([value, label]) => ({ value, label })) }),
    row(ar ? "ميزات عينية — قيمة شهرية" : "In-kind benefits — monthly value", inKind.monthly > 0 ? moneySar(inKind.monthly, ar) : "—", ar ? "المادة 2" : "Art. 2", "mute", "inKindMonthly", "text", { raw: profile.inKindMonthly ?? "" }),
    row(ar ? "النسخة المكتوبة" : "Written copy", written ? String(written).slice(0, 36) : (ar ? "غير مرفوعة" : "Not uploaded"), written ? (ar ? "موقّع" : "Signed") : (ar ? "يخالف المادة 51" : "Breaks Art. 51"), written ? "ok" : "bad"),
  ];

  const eos = [
    row(ar ? "مدة الخدمة حتى اليوم" : "Service to date", serviceLabel(hireIso, ar, day)),
    row(ar ? "أساس الحساب" : "Basis", ar ? "الأجر الأخير — الأساسي والبدلات" : "Last wage — base and allowances", ar ? "المادة 84" : "Art. 84", "mute"),
    row(ar ? "الخمس سنوات الأولى" : "First five years", ar ? "نصف شهر لكل سنة" : "Half a month per year", ar ? "المادة 84" : "Art. 84", "mute"),
    row(ar ? "ما بعد الخمس" : "After five", ar ? "شهر كامل لكل سنة" : "A full month per year", ar ? "المادة 84" : "Art. 84", "mute"),
    row(ar ? "الاستقالة قبل سنتين" : "Resign before 2 years", ar ? "لا مكافأة" : "No award", ar ? "المادة 85" : "Art. 85", "mute"),
    row(ar ? "الاستقالة بين 2 و5" : "Resign 2–5 years", ar ? "الثلث" : "One third", ar ? "المادة 85" : "Art. 85", "mute"),
    row(ar ? "الاستقالة بين 5 و10" : "Resign 5–10 years", ar ? "الثلثان" : "Two thirds", ar ? "المادة 85" : "Art. 85", "mute"),
    row(ar ? "الاستقالة بعد 10" : "Resign after 10", ar ? "المكافأة كاملة" : "Full award", ar ? "المادة 85" : "Art. 85", "mute"),
    row(ar ? "العمولات" : "Commissions", ar ? "تدخل ما لم يُتفق كتابةً على استثنائها" : "Included unless excluded in writing", ar ? "المادة 86" : "Art. 86", "mute"),
    row(ar ? "المكافأة كاملة رغم الاستقالة" : "Full award despite resigning", ar ? "قوة قاهرة، أو العاملة خلال 6 أشهر من الزواج أو 3 من الوضع" : "Force majeure, or a woman within 6 months of marriage or 3 of giving birth", ar ? "المادة 87" : "Art. 87", "mute"),
    row(ar ? "مهلة التصفية" : "Settlement window", ar ? "أسبوع من الانتهاء — وأسبوعان إن أنهى العامل العقد" : "A week from the end — two if the worker ended it", ar ? "المادة 88" : "Art. 88", "mute"),
    row(ar ? "المستحق التقديري اليوم" : "Estimate today", wage.total > 0 && hireIso ? moneySar(eosNow, ar) : "—", ar ? "يُحسب من الأجر الأخير" : "From last wage", "ok"),
  ];

  const wageRows = [
    { k: ar ? "الأجر الأساسي" : "Base wage", field: "baseSalary", val: wage.base, note: ar ? "أساس حساب الاستحقاقات" : "The basis for entitlements", color: "var(--nv-ink)", weight: 600 },
    { k: ar ? "بدل السكن" : "Housing", field: "housingAllowance", val: wage.housing, note: ar ? "بدل ثابت شهرياً" : "A fixed monthly allowance", color: "#4B5567", weight: 500 },
    { k: ar ? "بدل النقل" : "Transport", field: "transportAllowance", val: wage.transport, note: ar ? "ثابت شهرياً" : "Fixed monthly", color: "#4B5567", weight: 500 },
    { k: ar ? "بدلات أخرى" : "Other allowances", field: "otherAllowances", val: wage.otherPlain ?? wage.other, note: ar ? "بدل لا يندرج تحت بند مسمّى" : "An allowance with no named line", color: "#4B5567", weight: 500 },
    { k: ar ? "بدل طبيعة عمل أو خطر" : "Effort or hazard allowance", field: "hazardAllowance", val: wage.hazard || 0, note: ar ? "لقاء جهد أو مخاطر — من الأجر الفعلي (المادة 2)" : "For effort or risk — part of the actual wage (Art. 2)", color: "#4B5567", weight: 500 },
    { k: ar ? "بدل غلاء معيشة أو عائلي" : "Cost-of-living or family allowance", field: "livingAllowance", val: wage.living || 0, note: ar ? "زيادة لمستوى المعيشة أو أعباء العائلة (المادة 2)" : "For living costs or family burden (Art. 2)", color: "#4B5567", weight: 500 },
    { k: ar ? "بدل منطقة نائية" : "Remote-area allowance", field: "remoteAreaAllowance", val: wage.remote || 0, note: ar ? "العمل بعيداً عن العمران — بالعقد (المادة 2)، ومعه التزامات المادتين 146 و147" : "Work far from towns — by contract (Art. 2), alongside the duties in Arts. 146–147", color: "#4B5567", weight: 500 },
    { k: ar ? "بدل بُعد الخدمات الطبية" : "Distance-from-care allowance", field: "medicalDistanceAllowance", val: wage.medical || 0, note: ar ? `أقرب مستشفى أبعد من ${HOSPITAL_FAR_MINUTES} دقيقة (معيار المنشأة) — بدل عن الترتيبات الطبية (المادتان 144 و146/3)` : `Nearest hospital past ${HOSPITAL_FAR_MINUTES} minutes (establishment criterion) — in place of medical arrangements (Arts. 144, 146/3)`, color: "#4B5567", weight: 500 },
    { k: ar ? "بدل إعاشة" : "Meals allowance", field: "mealAllowance", val: wage.meals || 0, note: ar ? "الوجبات في الأماكن البعيدة والمناجم والمحاجر (المادة 147)" : "Meals at remote sites, mines and quarries (Art. 147)", color: "#4B5567", weight: 500 },
    { k: ar ? "العمولة" : "Commission", field: "commissionAmount", val: wage.commission || 0, note: ar ? "عمولة الشهر أو نسبة المبيعات (المادة 2) — يجوز استثناؤها من نهاية الخدمة باتفاق (المادة 86)" : "The month's commission (Art. 2) — may be excluded from end of service by agreement (Art. 86)", color: "#4B5567", weight: 500 },
    ...(!wage.split && (Number(profile.allowances) || 0) > 0
      ? [{ k: ar ? "البدلات" : "Allowances", field: "allowances", val: (wage.allowances || 0) - (wage.night || 0) - (wage.extras || 0), note: ar ? "مجموع البدلات الشهرية" : "Monthly allowances total", color: "#4B5567", weight: 500 }]
      : []),
    {
      k: ar ? "تاريخ التسجيل في التأمينات" : "GOSI registration date",
      field: "gosiRegisteredAt",
      type: "date",
      val: gosiRegisteredAt,
      v: gosiRegisteredAt ? niceFileDate(gosiRegisteredAt, ar) : "—",
      note: ar
        ? "أول تسجيل للشخص في التأمينات، لا تاريخ التعيين ولا بداية الاشتراك."
        : "The person's first GOSI registration, not the hire date and not subscription start.",
      color: "var(--nv-ink)",
      weight: 600,
      ...chipOf(
        gosiClass === "old" ? (ar ? "قديم" : "Old") : gosiClass === "new" ? (ar ? "جديد" : "New") : "",
        gosiClass === "unset" ? "mute" : "ok",
      ),
    },
    ...(wage.night > 0
      ? [{
        k: wage.nightKind === "transport" ? (ar ? "بدل نقل ليلي" : "Night transport") : (ar ? "أجر ليلي" : "Night pay"),
        field: "",
        val: wage.night,
        note: ar ? "من قرار الجدول — القرار 18632" : "From the roster decision — 18632",
        color: "#3C7D50",
        weight: 600,
        derived: true,
      }]
      : []),
    ...(inKind.monthly > 0
      ? [{
        k: ar ? "ميزات عينية (تقدير شهري)" : "In-kind benefits (monthly value)",
        field: "",
        val: inKind.monthly,
        note: inKind.capped
          ? (ar ? `بسقف شهرين من الأساسي سنوياً (المادة 2) = ${moneySar(inKind.cap, ar)} شهرياً — لا تُصرف نقداً` : `Capped at two months of basic a year (Art. 2) = ${moneySar(inKind.cap, ar)} a month — not paid in cash`)
          : (ar ? "تدخل في الأجر الفعلي لنهاية الخدمة (المادة 2) — لا تُصرف نقداً" : "Part of the actual wage for end of service (Art. 2) — not paid in cash"),
        color: "#3C7D50",
        weight: 500,
        derived: true,
      }]
      : []),
    { k: ar ? "الإجمالي الشهري" : "Monthly total", field: "", val: wage.total, note: ar ? "مشتق من البنود أعلاه" : "Derived from the lines above", color: "#3C7D50", weight: 700, derived: true },
  ].map((item) => ({
    ...item,
    v: item.type === "date" ? (item.v || "—") : moneySar(item.val, ar),
    bg: item.derived ? "var(--nv-soft)" : "var(--nv-card)",
  }));

  const platforms = [
    {
      name: ar ? "منصة قوى" : "Qiwa",
      what: ar ? "التوظيف والعقود ونقل الخدمات" : "Hiring, contracts, and service transfer",
      state: qiwa ? (ar ? "مطابق" : "Aligned") : (ar ? "يحتاج إجراءً" : "Needs action"),
      kind: qiwa ? "ok" : "bad",
      note: ar ? "اختلاف المسمى بين الملف وقوى يمنع إصدار شهادة التعريف." : "A title mismatch with Qiwa blocks the employment letter.",
      rows: [
        row(ar ? "حالة التسجيل" : "Registration", qiwa || (ar ? "—" : "—"), "", "", "qiwaTitle", "text", { raw: qiwa }),
        row(ar ? "مطابقة المسمى" : "Title match", `${roleLabel || profile.position || "—"} = ${qiwa || (ar ? "قوى" : "Qiwa")}`, ar ? "مشتق" : "Derived", "mute"),
      ],
    },
    {
      name: ar ? "التأمينات الاجتماعية" : "GOSI",
      what: ar ? "الاشتراك وحساب الأجر الخاضع" : "Subscription and contributory wage",
      state: gosi ? (ar ? "نشط" : "Active") : (ar ? "ناقص" : "Missing"),
      kind: gosi ? "ok" : "warn",
      note: ar
        ? "الأجر الخاضع = الأساسي + بدل السكن + العمولات، بسقف 45,000 وحد أدنى 1,500 (400 لغير الخاضع للمعاشات). لا يدخله النقل ولا البدلات الأخرى ولا الليلي ولا الإضافي ولا المكافأة. تاريخ التسجيل في التأمينات هو أول تسجيل للشخص، لا تاريخ تعيينه هنا: قبل 3 يوليو 2024 مشترك قديم، ومنه مشترك جديد. إن خلا التاريخ لا يُعامل كجديد وتبقى حصة السعودي 9.75٪."
        : "Contributory wage = basic + housing + commissions, capped at 45,000 with a 1,500 floor (400 outside the annuity branch). Transport, other allowances, night pay, overtime and bonus stay out. The GOSI registration date is the person's first registration, not the hire date here: before 3 July 2024 an old subscriber, and from that day a new one. An empty date is not treated as new, and a confirmed Saudi stays at 9.75%.",
      rows: [
        row(ar ? "رقم المشترك" : "Member number", gosi, "", "", "gosiNumber", "text", { raw: gosi, secret: true }),
        row(
          ar ? "تاريخ التسجيل في التأمينات" : "GOSI registration date",
          gosiRegisteredAt ? niceFileDate(gosiRegisteredAt, ar) : "—",
          gosiClass === "old" ? (ar ? "قديم" : "Old") : gosiClass === "new" ? (ar ? "جديد" : "New") : "",
          gosiClass === "unset" ? "mute" : "ok",
          "gosiRegisteredAt",
          "date",
          { raw: gosiRegisteredAt },
        ),
        row(ar ? "الأجر الخاضع" : "Contributory wage", moneySar(contributoryWage(wage), ar), ar ? "مشتق" : "Derived", "mute"),
        row(ar ? "بداية الاشتراك" : "Subscription start", niceFileDate(hireIso, ar), ar ? "من تاريخ التعيين" : "From hire", "mute"),
      ],
    },
    {
      name: ar ? "الضمان الصحي" : "CCHI",
      what: ar ? "التغطية الطبية للعامل ومن يعوله" : "Medical cover for the worker and dependents",
      state: medicalDays != null && medicalDays > 0 ? (ar ? "ساري" : "Valid") : (ar ? "يحتاج إجراءً" : "Needs action"),
      kind: medicalDays != null && medicalDays > 0 ? (medicalDays <= 60 ? "warn" : "ok") : "bad",
      note: ar ? "التغطية شرط لاستمرار رخصة العمل، ومصدرها مجلس الضمان الصحي لا نظام العمل." : "Cover is a condition of the work permit. Its source is CCHI, not the Labour Law.",
      rows: [
        row(ar ? "رقم البوليصة" : "Policy number", profile.medicalInsuranceNumber, "", "", "medicalInsuranceNumber", "text", { raw: profile.medicalInsuranceNumber || "" }),
        row(ar ? "انتهاء التغطية" : "Cover ends", niceFileDate(medicalExp, ar), "", "", "medicalInsuranceExpiry", "date", { raw: medicalExp || "" }),
      ],
    },
    {
      name: ar ? "حماية الأجور" : "Wage protection",
      what: ar ? "رفع ملف الرواتب شهرياً" : "Monthly payroll file",
      state: iban ? (ar ? "مطابق" : "On file") : (ar ? "ناقص" : "Missing"),
      kind: iban ? "ok" : "warn",
      note: ar ? "عدم المطابقة يوقف خدمات المنشأة في قوى — أثره تشغيلي لا عقابي على الموظف." : "A mismatch stops the company's Qiwa services — an operational effect, not a penalty on the worker.",
      rows: [
        row(ar ? "الآيبان" : "IBAN", iban, iban ? (ar ? "مطابق" : "On file") : (ar ? "ناقص" : "Missing"), iban ? "ok" : "bad", "iban", "text", { raw: iban, secret: true }),
        row(ar ? "طريقة الصرف" : "Pay method", ar ? "تحويل بنكي" : "Bank transfer"),
      ],
    },
    {
      name: ar ? "سجلات المنشأة — لا سجل الموظف" : "Company registers — not the employee file",
      what: ar ? "ما يُحسب على الشركة لا على الفرد" : "What is counted on the company, not the person",
      state: ar ? "مرجع" : "Reference",
      kind: "mute",
      note: ar ? "أُخرجت نطاقات من بطاقات الموظف لأنها تُقاس على المنشأة. ما يبقى في ملفه جنسيته ومهنته النظامية." : "Nitaqat is measured on the establishment. What stays on the file is nationality and the official profession.",
      rows: [
        row(ar ? "نطاقات والسعودة" : "Nitaqat", ar ? "تصنيف المنشأة ونسبة التوطين — سجل شركة" : "Company band and localization rate"),
        row(ar ? "أثره على الموظف" : "Effect on the worker", ar ? "غير مباشر: يمسّ خدمات المنشأة في قوى" : "Indirect: it touches the company's Qiwa services"),
      ],
    },
  ].map((card) => ({ ...card, ...tone(card.kind) }));

  const growth = [];
  if (hireIso) {
    growth.push({
      t: ar ? "تعيين" : "Hire",
      move: ar ? `التعيين على: ${roleLabel || profile.position || "—"}` : `Hired as ${roleLabel || profile.position || "—"}`,
      at: niceFileDate(hireIso, ar),
      by: ar ? "الموارد البشرية" : "HR",
      note: contractType || "",
      dot: "#4B5567",
    });
  }
  for (const move of employee?.stationMoves || employee?.transfers || []) {
    growth.push({
      t: ar ? "نقل" : "Transfer",
      move: `${move.fromName || move.from || "—"} → ${move.toName || move.to || "—"}`,
      at: niceFileDate(move.at || move.createdAt, ar),
      by: move.by || (ar ? "الموارد البشرية" : "HR"),
      note: move.note || (ar ? "نقل داخلي" : "Internal move"),
      dot: "#C9962B",
    });
  }

  const penalties = mineCases
    .filter((item) => !isErasedFromEmployeeRecord(item, day))
    .map((item) => {
      const face = faceOf(item.status);
      const live = face.id === "signed" || face.id === "objected";
      return {
        t: penaltyShiftLabel(item, ar),
        art: ar ? "المادة 71" : "Art. 71",
        at: fmtDisciplineDate(item.signedAt || item.notifiedAt || item.createdAt, ar),
        by: item.signedBy || item.rulingBy || (ar ? "الإدارة" : "Management"),
        reason: item.note || item.reason || "",
        state: item.rulingLabel || (face.id === "objected" ? (ar ? "نافذ — تحت اعتراض الموظف" : "In force — under objection") : (live ? (ar ? "نافذ" : "In force") : (ar ? face.shortAr : face.shortEn))),
        wageEff: effectiveCutDays(item) > 0 ? (ar ? `حسم ${effectiveCutDays(item)} يوم` : `${effectiveCutDays(item)}-day cut`) : (ar ? "لا حسم" : "No deduction"),
        color: live ? "var(--nv-warn-ink)" : "var(--nv-ink3)",
        bg: live ? "var(--nv-warn-soft)" : "var(--nv-soft)",
        border: live ? "var(--nv-warn-line)" : "var(--nv-line)",
        tone: live ? "warn" : null,
      };
    });

  const seenLog = new Set();
  const fileLog = [];
  for (const row of [...collectRequestAuditLogs(employee, ar), ...(employee?.fileLog || [])]) {
    const text = presentRequestAuditText(row.text || "", ar);
    const at = row.at || "";
    const key = `${text}|${at}`;
    if (!text || seenLog.has(key)) continue;
    seenLog.add(key);
    const rawBy = String(row.by || "").trim();
    const actor = requestAuditActorLabel(rawBy);
    const by = actor
      || (/^(system|unknown)$/i.test(rawBy) ? (ar ? "النظام" : "Platform") : (ar ? "الموارد البشرية" : "HR"));
    fileLog.push({
      text,
      by,
      at,
      dot: row.dot || "#3C7D50",
    });
  }
  fileLog.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  if (hireIso) fileLog.push({ text: ar ? "إنشاء الملف" : "File opened", by: ar ? "الموارد البشرية" : "HR", at: hireIso, dot: "#4B5567" });

  return {
    status,
    canEditFile,
    compliance,
    facts,
    todos: todos.slice(0, 8).map((row) => ({ ...row, ...tone(row.kind) })),
    todoNote: todos.length ? (ar ? `${todos.length} يحتاج إجراءً` : `${todos.length} need action`) : (ar ? "لا إجراء معلّق على الملف" : "Nothing pending on the file"),
    auditTop: fileLog.slice(0, 3),
    audit: fileLog.slice(0, 12),
    idCards,
    contract,
    eos,
    wageRows,
    allowanceLaw: allowanceLawRows(wage, ar, inKind),
    leaveGroups: leaveCatalogFor(profile, ar, laborCalendar, day),
    leaveScope: ar ? "أربع مجموعات بحسب سلوك الإجازة لا بحسب اسمها — لأن الرصيد والشرط وأثر الأجر يختلف بين المجموعات." : "Grouped by how leave behaves, not by its name — balance, condition, and wage effect differ.",
    balances,
    balanceNote: ar ? "الرصيد مشتق من تاريخ التعيين والإجازات المعتمدة — لا يُكتب يدوياً." : "The balance is derived from hire date and approved leave — it is not typed by hand.",
    filed,
    noFiled: filed.length === 0,
    hasPendingLeave: pendingLeave,
    pendingPointer: pendingLeave ? pendingLeavePointerCopy(ar) : "",
    pendingHref: (Boolean(manageRequests) && !isSelf) ? "/app/requests/manage" : PENDING_LEAVE_HREF,
    filedEmpty: ar ? "لا توجد طلبات إجازة بعد" : "No leave written on the file yet",
    filedNote: filed.length
      ? (ar ? `${countAr(filed.length, "إجازة واحدة مثبتة", "إجازتان مثبتتان", "إجازات مثبتة", "إجازة مثبتة")} — المعتمد / المستقر من طلباتي.` : `${filed.length} approved / settled leave item(s) from My requests.`)
      : (ar ? "المعتمد والمستقر من طلباتي يُثبَّت هنا. ما زال بانتظار القرار لا يظهر في الملف." : "Approved and settled leave from My requests is written here. What is still awaiting a decision does not appear on the file."),
    platforms,
    docs,
    docsScope: ar ? "وثائق الملف ومراجعها وتواريخ انتهائها. ما يُصدر للموظف يُطلب من طلباتي ويُختم هناك." : "Documents, references, and end dates. Letters are requested in My Requests and sealed there.",
    docsNote: ar ? "الوثيقة المنتهية تمنع إصدار الشهادات وتظهر تنبيهاً أعلى الملف." : "An expired document blocks letters and raises an alert on the file.",
    custody,
    custodyNote: ar ? "العهد تُسلَّم بإقرار وتُستعاد في إخلاء الطرف. لا تُحسم قيمتها من الأجر إلا بحكم أو إقرار — والحسم لا يتجاوز نصف الأجر المستحق (المادة 93)." : "Custody is handed with an acknowledgement and returned at clearance. Its value is not cut from wages except by a ruling or an acknowledgement — and the cut may not exceed half the wage due (Art. 93).",
    growth,
    penalties,
    penaltyNote: ar
      ? "الجزاء لا يُوقَّع إلا بعد إبلاغ العامل كتابةً وسماع أقواله وتحقيق دفاعه — المادة 71. ولا يُتَّهم بمخالفة مضى على كشفها أكثر من 30 يوماً — المادة 69."
      : "No sanction without written notice and a recorded defence — Article 71. A worker may not be accused more than 30 days after discovery — Article 69.",
    contractNote: ar
      ? "النسخة المكتوبة والتوثيق من المادة 51: العقد من نسختين ولكل طرف نسخة. والنسخة هنا إن وُجدت تُختم في التوقيع الرقمي."
      : "The written copy is Article 51: two copies, one for each party. The copy here, if present, is sealed in Digital signing.",
    eosNote: ar
      ? "المكافأة تُحسب على الأجر الأخير، ونصيب سنة الخدمة الأخيرة بنسبة ما عمله منها — المادة 84. والاستقالة تُخفّض المستحق بحسب المدة — المادة 85. هذا تقدير تشغيلي."
      : "The award is on last wage, and the last year is pro-rated — Article 84. Resignation reduces it by length of service — Article 85. This is an operating estimate.",
    wageNote: ar
      ? "حدّ الحسم من الأجر لا يتجاوز نصف الأجر المستحق — المادة 93. والتأمينات وحماية الأجور منصّات لا مواد، فتُشرح نصّاً بلا شارة."
      : "A wage deduction may not exceed half the wage due — Article 93. GOSI and wage protection are platforms, not articles.",
    openCases: openCases.length,
    eosNow,
    wage,
  };
}

const FILE_NUMBER_KEYS = new Set(["dependents", ...WAGE_FIELD_KEYS]);
const FILE_EMPLOYEE_KEYS = new Set(["name", "phone"]);

export function employeeFileDraftSeed(employee) {
  const profile = employee?.profile || {};
  const wage = readWageFields(employee);
  return {
    name: employee?.name || "",
    phone: employee?.phone || "",
    idType: profileFieldValue(profile, "idType", employee),
    nationalId: profileFieldValue(profile, "nationalId", employee),
    idExpiry: profileFieldValue(profile, "idExpiry", employee),
    birthDate: profileFieldValue(profile, "birthDate", employee),
    position: profile.position || "",
    hireDate: profile.hireDate || employee?.hireDate || employee?.startDate || "",
    nationality: wage.nationality,
    workPermitNumber: profile.workPermitNumber || "",
    qiwaTitle: profile.qiwaTitle || "",
    gender: profileFieldValue(profile, "gender", employee),
    maritalStatus: profileFieldValue(profile, "maritalStatus", employee),
    religion: profileFieldValue(profile, "religion", employee),
    dependents: profile.dependents ?? "",
    medicalInsuranceExpiry: profileFieldValue(profile, "medicalInsuranceExpiry", employee),
    medicalInsuranceNumber: profile.medicalInsuranceNumber || "",
    emergencyName: profile.emergencyName || "",
    emergencyPhone: profile.emergencyPhone || "",
    qualification: profile.qualification || "",
    iban: profileFieldValue(profile, "iban", employee),
    bankName: profile.bankName || profile.bank || "",
    contractType: profileFieldValue(profile, "contractType", employee),
    wageType: profile.wageType || "monthly",
    contractEndDate: profile.contractEndDate || profile.contract?.endDate || "",
    gosiNumber: wage.gosiNumber,
    gosiRegisteredAt: wage.gosiRegisteredAt,
    baseSalary: wage.baseSalary,
    housingAllowance: wage.housingAllowance,
    transportAllowance: wage.transportAllowance,
    otherAllowances: wage.otherAllowances,
    allowances: wage.allowances,
  };
}

export { employeeFileHoursView, employeeFileNightPanel } from "./shiftWeek.js";

export function splitEmployeeFileDraft(draft = {}) {
  const profile = {};
  const wage = {};
  let name;
  let phone;
  for (const [key, value] of Object.entries(draft)) {
    if (FILE_EMPLOYEE_KEYS.has(key)) {
      if (key === "name") name = value;
      if (key === "phone") phone = value;
      continue;
    }
    if (WAGE_FIELD_KEYS.includes(key)) {
      wage[key] = value;
      continue;
    }
    if (FILE_NUMBER_KEYS.has(key)) {
      profile[key] = value === "" || value == null ? "" : Number(value);
      continue;
    }
    if (key === "gosiRegisteredAt") {
      profile.gosiRegisteredAt = gosiRegistrationIso(value);
      continue;
    }
    profile[key] = value;
  }
  assignWageFields(profile, wage);
  return { profile, name, phone };
}
