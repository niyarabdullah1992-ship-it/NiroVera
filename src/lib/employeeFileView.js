import { collectEmployeeValidityDocs, daysUntilExpiry, EXPIRY_WARN_DAYS, localDateKey } from "./complianceDerivations.js";
import {
  optionLabel,
  CONTRACT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ID_TYPE_OPTIONS,
  MARITAL_OPTIONS,
  RELIGION_OPTIONS,
  displayProfileField,
  isFixedContractType,
  isIqamaIdType,
  isNationalIdType,
  isRamadanHoursSubject,
  profileFieldValue,
  profileGender,
} from "./employeeProfileFields.js";
import { remainingLeaveDays, serviceYearsFromHire, statutoryLeaveFloor, usedLeaveDays, leaveTypeLabel } from "./leaveTypes.js";
import { pendingNightRotate } from "./nightRotateCycle.js";
import { nightAllowanceKind, payableNightAllowance } from "./shiftWeek.js";
import { collectRequestAuditLogs, hasPendingLeaveTopup } from "./otherRequestDerivations.js";
import { statutoryGlowState } from "./statutoryItem.js";

function employeeFileStatus(employee, ar) {
  const hireIso = employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "";
  const hireDate = hireIso ? new Date(`${String(hireIso).slice(0, 10)}T00:00:00`) : null;
  const preStart = hireDate && hireDate > new Date();
  if (preStart) return { label: ar ? "قيد المباشرة" : "Pending start", kind: "warn" };
  if (employee?.active === false) return { label: ar ? "غير نشط" : "Inactive", kind: "bad" };
  return { label: ar ? "نشط" : "Active", kind: "ok" };
}
import { eosGratuity } from "./offboardingDerivations.js";
import { citeRule, ruleValue } from "./laborRules.js";
import { effectiveCutDays, effectivePenalty, faceOf, fmtDisciplineDate, isErasedFromEmployeeRecord, penaltyShiftLabel } from "./disciplineBoard.js";

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
  if (kind === "ok") return { color: "#137A49", bg: "#F2FAF6", border: "#BFE6D2" };
  if (kind === "warn") return { color: "#8A6516", bg: "#FDF6E8", border: "#ECD9A8" };
  if (kind === "bad") return { color: "#8A1C2B", bg: "#FBF1F2", border: "#E9C4C9" };
  return { color: "#4B5567", bg: "#F5F6F8", border: "#E6E9EF" };
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

export function employeeWageSplit(profile = {}, employee) {
  const person = employee || { profile };
  const night = payableNightAllowance(person);
  const nightKind = nightAllowanceKind(person.profile?.nightRemedy?.allowanceKind);
  const base = Number(profile.baseSalary) || 0;
  const housing = Number(profile.housingAllowance);
  const transport = Number(profile.transportAllowance);
  const other = Number(profile.otherAllowances);
  const lump = Number(profile.allowances) || 0;
  const split = (Number.isFinite(housing) && housing > 0) || (Number.isFinite(transport) && transport > 0) || (Number.isFinite(other) && other > 0);
  if (split) {
    const h = Math.max(0, housing || 0);
    const t = Math.max(0, transport || 0);
    const o = Math.max(0, other || 0);
    return { base, housing: h, transport: t, other: o, allowances: h + t + o + night, total: base + h + t + o + night, night, nightKind, split: true };
  }
  return { base, housing: 0, transport: 0, other: 0, allowances: lump + night, total: base + lump + night, night, nightKind, split: false };
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

export function leaveCatalogFor(profile, ar = true) {
  const gender = profileGender(profile);
  const female = gender === "female";
  const male = gender === "male";
  const muslim = isRamadanHoursSubject({ profile });
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
        { name: ar ? "زواج" : "Marriage", art: "113", ent: ar ? "5 أيام — مرة واحدة" : "5 days — once", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "عقد الزواج" : "Marriage contract" },
        ...(male ? [{ name: leaveTypeLabel("paternity", ar), art: "113", ent: ar ? "3 أيام" : "3 days", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "شهادة الميلاد" : "Birth certificate" }] : []),
        ...(muslim ? [{ name: ar ? "حج" : "Hajj", art: "114", ent: ar ? "10 إلى 15 يوماً — مرة في الخدمة" : "10 to 15 days — once in service", wage: ar ? "بأجر كامل" : "Full pay", cond: ar ? "سنتان خدمة متصلة، ولم يؤدِّه قبلاً" : "Two continuous years, and Hajj not performed before" }] : []),
        { name: ar ? "امتحان" : "Exam", art: "115", ent: ar ? "أيام الامتحان الفعلية" : "The actual exam days", wage: ar ? "بأجر كامل — وبغير أجر إن كان معاداً" : "Full pay — unpaid if a repeat", cond: ar ? "طلب قبل 15 يوماً أو ورقة مواعيد متأخرة في يوم صدورها. إثبات أداء بعد الامتحان. صاحب العمل لا يرفض المستوفي" : "Request 15 days ahead or a late timetable paper that day. Sitting proof after the exam. Employer cannot refuse a qualifying file" },
        { name: ar ? "أعياد وعطل رسمية" : "Eids and official holidays", art: "112", ent: ar ? "الفطر 4 · الأضحى 4 · الوطني 1 · التأسيس 1" : "Fitr 4 · Adha 4 · National 1 · Founding 1", wage: ar ? "بأجر كامل — لا تُخصم من السنوية" : "Full pay — not taken from annual", cond: ar ? "بطلب على أيام العطلة" : "Requested on the holiday dates" },
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
        { name: leaveTypeLabel("iddah", ar), art: "160", ent: isRamadanHoursSubject({ profile }) ? (ar ? "4 أشهر وعشرة أيام — بطلب" : "4 months and 10 days — by request") : (ar ? "15 يوماً — بطلب" : "15 days — by request"), wage: isRamadanHoursSubject({ profile }) ? (ar ? "بأجر كامل — وتمديد بغير أجر عند الحمل حتى الوضع" : "Full pay — unpaid extension if pregnant until birth") : (ar ? "بأجر كامل" : "Full pay"), cond: ar ? "وثيقة الوفاة · لا عمل لدى الغير" : "Death certificate · no other employer" },
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
  const push = (name, ref, exp) => {
    const days = daysUntilExpiry(exp, today);
    rows.push({
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
    push(cert.name || (ar ? "شهادة" : "Certificate"), cert.code || cert.fileName || cert.id, cert.expiryDate);
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
} = {}) {
  const day = today || localDateKey();
  const profile = employee?.profile || {};
  const status = employeeFileStatus(employee, ar);
  const hireIso = profile.hireDate || employee?.hireDate || employee?.startDate || "";
  const years = serviceYearsFromHire(hireIso, day);
  const wage = employeeWageSplit(profile, employee);
  const eosNow = eosGratuity(years, wage.total);
  const contractType = optionLabel(CONTRACT_TYPE_OPTIONS, profileFieldValue(profile, "contractType", employee), ar) || (ar ? "—" : "—");
  const fixed = isFixedContractType(profileFieldValue(profile, "contractType", employee));
  const annualLeft = remainingLeaveDays(profile, employee?.leaveRequests || [], "annual", day);
  const statutory = statutoryLeaveFloor("annual", profile, day) || 21;
  const usedSick = usedLeaveDays(employee?.leaveRequests || [], "sick", day, hireIso);
  const sickFull = ruleValue("leave.sick.fullPayDays", day);
  const sickMid = ruleValue("leave.sick.halfPayDays", day);
  const sickFullLeft = Math.max(0, sickFull - usedSick);
  const sickMidLeft = Math.max(0, sickMid - Math.max(0, usedSick - sickFull));
  const gosi = String(profileFieldValue(profile, "gosiNumber", employee) || "").trim();
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
      note: gosi ? (ar ? `مشترك · الأجر الخاضع ${moneySar(wage.base + (wage.split ? wage.housing : wage.allowances), ar)}` : `Registered · contributory ${moneySar(wage.base + (wage.split ? wage.housing : wage.allowances), ar)}`) : (ar ? "لا رقم اشتراك" : "No GOSI number"),
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
      tab: "docs",
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
    { k: ar ? "رصيد الإجازة السنوية" : "Annual leave", v: annualLeft == null ? "—" : (ar ? countAr(annualLeft, "يوم متبقٍ", "يومان متبقيان", "أيام متبقية", "يوماً متبقياً") : `${annualLeft} left`), note: ar ? `من ${statutory} — المادة 109` : `of ${statutory} — Art. 109` },
    { k: ar ? "مكافأة نهاية الخدمة" : "End-of-service", v: wage.total > 0 && hireIso ? moneySar(eosNow, ar) : "—", note: ar ? "تقدير على الأجر الأخير — المادة 84" : "Estimate on last wage — Art. 84" },
    { k: ar ? "العهد بحوزته" : "Custody in hand", v: ar ? countAr(inHand.length, "عهدة واحدة", "عهدتان", "عهد", "عهدة", "لا عهدة") : `${inHand.length} in hand`, note: ar ? "تُستعاد في إخلاء الطرف" : "Returned at clearance" },
  ];

  const mineCases = (cases || []).filter((item) => String(item.employeeId) === String(employee?.id));
  const openCases = mineCases.filter((item) => !["ruling", "closed"].includes(item.status));
  const todos = [];
  for (const doc of validityWarn) {
    todos.push({
      tab: "docs",
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
      type: leaveTypeLabel(row.type, ar),
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
  const muslim = isRamadanHoursSubject({ profile });
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
        row(ar ? "رقم الهوية" : "ID number", profileFieldValue(profile, "nationalId", employee), "", "", "nationalId", "text", { raw: profileFieldValue(profile, "nationalId", employee) }),
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
          ar ? "الدين — رمضان والحج والعدّة" : "Religion — Ramadan, Hajj and iddah",
          displayProfileField({ key: "religion", options: "religion" }, profileFieldValue(profile, "religion", employee), ar),
          isRamadanHoursSubject(employee) ? (ar ? "مسلم — رمضان · حج · عدّة 130 يوماً" : "Muslim — Ramadan · Hajj · 130-day iddah") : (ar ? "غير مسلم — عدّة 15 يوماً بلا حج" : "Non-Muslim — 15-day iddah, no Hajj"),
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
      tag: ar ? "يُحدّثه الموظف" : "The employee updates this",
      rows: [
        row(ar ? "الجوال" : "Mobile", employee?.phone, "", "", "phone", "text", { raw: employee?.phone || "" }),
        row(ar ? "البريد" : "Email", employee?.email),
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
        row(ar ? "الآيبان" : "IBAN", iban, iban ? (ar ? "مطابق" : "On file") : (ar ? "ناقص" : "Missing"), iban ? "ok" : "bad", "iban", "text", { raw: iban }),
        row(ar ? "البنك" : "Bank", profile.bankName || profile.bank, "", "", "bankName", "text", { raw: profile.bankName || profile.bank || "" }),
        row(ar ? "طريقة الصرف" : "Pay method", ar ? "تحويل بنكي — لا نقد" : "Bank transfer — not cash"),
      ],
    },
  ];

  const probationEnd = profile.probationEnd || profile.contract?.probationEnd;
  const contract = [
    row(ar ? "نوع العقد" : "Contract type", contractType, citeRule(fixed ? "contract.fixed.cite" : "contract.indefinite.cite")?.labelAr || (ar ? "المادة 75" : "Art. 75"), "mute", "contractType", "text", { raw: profileFieldValue(profile, "contractType", employee), options: opts(CONTRACT_TYPE_OPTIONS) }),
    row(ar ? "تاريخ البداية" : "Start", niceFileDate(hireIso, ar), "", "", "hireDate", "date", { raw: hireIso || "" }),
    row(ar ? "تاريخ النهاية" : "End", fixed ? niceFileDate(profile.contractEndDate || profile.contract?.endDate, ar) : (ar ? "غير محدد" : "Open"), fixed ? "" : (ar ? "مفتوح" : "Open"), fixed ? "warn" : "ok", fixed ? "contractEndDate" : "", "date", { raw: profile.contractEndDate || profile.contract?.endDate || "" }),
    row(ar ? "فترة التجربة" : "Probation", probationEnd ? niceFileDate(probationEnd, ar) : (ar ? "—" : "—"), citeRule("contract.probation.warnDays")?.labelAr || (ar ? "المادة 53" : "Art. 53"), "mute"),
    row(ar ? "ساعات العمل" : "Hours", ar ? "من جدول الدوام المنشور" : "From the published rota", citeRule("hours.week.ordinaryMaxHours")?.labelAr || (ar ? "المادة 98" : "Art. 98"), "mute"),
    row(ar ? "مسجَّل في قوى" : "On Qiwa", qiwa || (ar ? "—" : "—"), qiwa ? (ar ? "مطابق" : "Aligned") : (ar ? "يحتاج تسجيلاً" : "Needs registration"), qiwa ? "ok" : "bad", "qiwaTitle", "text", { raw: qiwa }),
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
    row(ar ? "المستحق التقديري اليوم" : "Estimate today", wage.total > 0 && hireIso ? moneySar(eosNow, ar) : "—", ar ? "يُحسب من الأجر الأخير" : "From last wage", "ok"),
  ];

  const wageRows = [
    { k: ar ? "الأجر الأساسي" : "Base wage", field: "baseSalary", val: wage.base, note: ar ? "أساس حساب الاستحقاقات" : "The basis for entitlements", color: "#14213D", weight: 600 },
    ...(wage.split
      ? [
        { k: ar ? "بدل السكن" : "Housing", field: "housingAllowance", val: wage.housing, note: ar ? "بدل ثابت شهرياً" : "A fixed monthly allowance", color: "#4B5567", weight: 500 },
        { k: ar ? "بدل النقل" : "Transport", field: "transportAllowance", val: wage.transport, note: ar ? "ثابت شهرياً" : "Fixed monthly", color: "#4B5567", weight: 500 },
        { k: ar ? "بدلات أخرى" : "Other allowances", field: "otherAllowances", val: wage.other, note: ar ? "طبيعة عمل" : "Work nature", color: "#4B5567", weight: 500 },
      ]
      : [{ k: ar ? "البدلات" : "Allowances", field: "allowances", val: (wage.allowances || 0) - (wage.night || 0), note: ar ? "مجموع البدلات الشهرية" : "Monthly allowances total", color: "#4B5567", weight: 500 }]),
    ...(wage.night > 0
      ? [{
        k: wage.nightKind === "transport" ? (ar ? "بدل نقل ليلي" : "Night transport") : (ar ? "أجر ليلي" : "Night pay"),
        field: "",
        val: wage.night,
        note: ar ? "من قرار الجدول — القرار 18632" : "From the roster decision — 18632",
        color: "#137A49",
        weight: 600,
        derived: true,
      }]
      : []),
    { k: ar ? "الإجمالي الشهري" : "Monthly total", field: "", val: wage.total, note: ar ? "مشتق من البنود أعلاه" : "Derived from the lines above", color: "#137A49", weight: 700, derived: true },
  ].map((item) => ({
    ...item,
    v: moneySar(item.val, ar),
    bg: item.derived ? "#FAFBFC" : "#fff",
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
      note: ar ? "الأجر الخاضع للاشتراك = الأساسي + بدل السكن. نسبة الاشتراك قرار نظامي مستقل عن نظام العمل." : "Contributory wage = base + housing. The rate is a separate statutory decision, not a Labour Law article.",
      rows: [
        row(ar ? "رقم المشترك" : "Member number", gosi, "", "", "gosiNumber", "text", { raw: gosi }),
        row(ar ? "الأجر الخاضع" : "Contributory wage", moneySar(wage.base + (wage.split ? wage.housing : wage.allowances), ar), ar ? "مشتق" : "Derived", "mute"),
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
        row(ar ? "الآيبان" : "IBAN", iban, iban ? (ar ? "مطابق" : "On file") : (ar ? "ناقص" : "Missing"), iban ? "ok" : "bad", "iban", "text", { raw: iban }),
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
        color: live ? "#8A6516" : "#4B5567",
        bg: live ? "#FDF6E8" : "#F5F6F8",
        border: live ? "#ECD9A8" : "#DFE3EA",
      };
    });

  const seenLog = new Set();
  const fileLog = [];
  for (const row of [...collectRequestAuditLogs(employee, ar), ...(employee?.fileLog || [])]) {
    const text = row.text || "";
    const at = row.at || "";
    const key = `${text}|${at}`;
    if (!text || seenLog.has(key)) continue;
    seenLog.add(key);
    fileLog.push({
      text,
      by: row.by || (ar ? "الموارد البشرية" : "HR"),
      at,
      dot: row.dot || "#14213D",
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
    leaveGroups: leaveCatalogFor(profile, ar),
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

const FILE_NUMBER_KEYS = new Set(["dependents", "baseSalary", "housingAllowance", "transportAllowance", "otherAllowances", "allowances"]);
const FILE_EMPLOYEE_KEYS = new Set(["name", "phone"]);

export function employeeFileDraftSeed(employee) {
  const profile = employee?.profile || {};
  return {
    name: employee?.name || "",
    phone: employee?.phone || "",
    idType: profileFieldValue(profile, "idType", employee),
    nationalId: profileFieldValue(profile, "nationalId", employee),
    idExpiry: profileFieldValue(profile, "idExpiry", employee),
    birthDate: profileFieldValue(profile, "birthDate", employee),
    position: profile.position || "",
    hireDate: profile.hireDate || employee?.hireDate || employee?.startDate || "",
    nationality: profile.nationality || "",
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
    contractEndDate: profile.contractEndDate || profile.contract?.endDate || "",
    gosiNumber: profileFieldValue(profile, "gosiNumber", employee),
    baseSalary: profile.baseSalary ?? "",
    housingAllowance: profile.housingAllowance ?? "",
    transportAllowance: profile.transportAllowance ?? "",
    otherAllowances: profile.otherAllowances ?? "",
    allowances: profile.allowances ?? "",
  };
}

export { employeeFileHoursView, employeeFileNightPanel } from "./shiftWeek.js";

export function splitEmployeeFileDraft(draft = {}) {
  const profile = {};
  let name;
  let phone;
  for (const [key, value] of Object.entries(draft)) {
    if (FILE_EMPLOYEE_KEYS.has(key)) {
      if (key === "name") name = value;
      if (key === "phone") phone = value;
      continue;
    }
    if (FILE_NUMBER_KEYS.has(key)) {
      profile[key] = value === "" || value == null ? "" : Number(value);
      continue;
    }
    profile[key] = value;
  }
  return { profile, name, phone };
}
