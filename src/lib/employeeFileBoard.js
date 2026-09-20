import { profileCompletionStats, profileFieldValue, profileGender, optionLabel, CONTRACT_TYPE_OPTIONS, isFixedContractType, isRamadanHoursSubject } from "@/lib/employeeProfileFields";
import { remainingLeaveDays, serviceYearsFromHire } from "@/lib/leaveTypes";
import { collectEmployeeValidityDocs, EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";
import { payableNightAllowance } from "@/lib/shiftWeek";

function daysTo(iso) {
  if (!iso) return null;
  const d = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`) - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function niceDate(iso, ar) {
  if (!iso) return "—";
  try {
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(
      ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
      { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return String(iso).slice(0, 10);
  }
}

function money(n, ar) {
  const v = Number(n) || 0;
  return `${v.toLocaleString(ar ? "en-US" : "en-US")} ${ar ? "ر.س" : "SAR"}`;
}

function yearsWord(n, ar) {
  if (!ar) return n === 1 ? "1 year of service" : `${n} years of service`;
  if (n === 0) return "أقل من سنة";
  if (n === 1) return "سنة خدمة";
  if (n === 2) return "سنتا خدمة";
  if (n <= 10) return `${n} سنوات خدمة`;
  return `${n} سنة خدمة`;
}

function tone(kind) {
  if (kind === "ok") return { color: "#15803D", bg: "#F2FAF6", border: "#BFE6D2" };
  if (kind === "warn") return { color: "#8A6516", bg: "#FDF6E8", border: "#ECD9A8" };
  if (kind === "bad") return { color: "#8A1C2B", bg: "#FBF1F2", border: "#E9C4C9" };
  return { color: "#5A6B85", bg: "#F5F6F8", border: "#E6E9EF" };
}

export function employeeFileStatus(employee, ar) {
  const hireIso = employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "";
  const hireDate = hireIso ? new Date(`${String(hireIso).slice(0, 10)}T00:00:00`) : null;
  const preStart = hireDate && hireDate > new Date();
  if (preStart) return { label: ar ? "قيد المباشرة" : "Pending start", kind: "warn" };
  if (employee?.active === false) return { label: ar ? "غير نشط" : "Inactive", kind: "bad" };
  return { label: ar ? "نشط" : "Active", kind: "ok" };
}

/** Rules encoded on this file — shown to the employee with official text, starting from the summary. */
export function employeeFileAppliedLaw(employee, { ar = true } = {}) {
  const profile = employee?.profile || {};
  const typeRaw = profileFieldValue(profile, "contractType", employee);
  const fixed = isFixedContractType(typeRaw);
  const probation = profile.probationEnd || profile.probationDays || profile.contract?.probationEnd || profile.contract?.probationDays;
  const female = profileGender(profile) === "female";
  const muslim = isRamadanHoursSubject({ profile });
  return [
    {
      id: "contract",
      tab: "contract",
      title: ar ? "العقد والأجر" : "Contract and wage",
      ruleIds: [
        "contract.written.cite",
        typeRaw ? (fixed ? "contract.fixed.cite" : "contract.indefinite.cite") : null,
        fixed ? "contract.fixed.continuation.cite" : null,
        probation ? "contract.probation.warnDays" : null,
        "payroll.wage.payment.cite",
      ].filter(Boolean),
    },
    {
      id: "leave",
      tab: "leave",
      title: ar ? "الإجازات" : "Leave",
      ruleIds: [
        "leave.annual.days",
        "leave.annual.noticeDays",
        "leave.annual.carry.cite",
        "leave.eid.cite",
        "leave.noOtherEmployer.cite",
        muslim ? "leave.hajj.days" : null,
        female ? "leave.maternity.days" : null,
        female ? "leave.maternity.unpaidExtendDays" : null,
        female ? "leave.maternity.disabledChildDays" : null,
        female ? "leave.iddah.cite" : null,
        female ? "leave.nursing.dailyMinutes" : null,
      ].filter(Boolean),
    },
    {
      id: "hours",
      tab: "identity",
      title: ar ? "وقت العمل والليل" : "Hours and night work",
      ruleIds: [
        "hours.week.ordinaryMaxHours",
        "hours.ramadan.ordinaryHours",
        "hours.rest.maxConsecutiveHours",
        "hours.workplace.maxHours",
        "hours.rest.notWorkingHours.cite",
        "hours.rest.weeklyHours",
        "hours.ot.premium",
        "hours.night.workerHours",
        "hours.night.compensateOrReduce",
        "hours.night.restHours",
        "hours.night.rotateWeeks",
        "hours.night.rotateOrdinaryWeeks",
        "hours.night.pregnancyBanWeeks",
        "hours.night.medicalYearMonths",
      ],
    },
    {
      id: "discipline",
      tab: "growth",
      title: ar ? "حقوقك عند الجزاء" : "Your rights in a sanction",
      ruleIds: [
        "discipline.hearing.cite",
        "discipline.appeal.internalDays",
        "discipline.charge.maxDays",
        "discipline.fine.maxDays",
        "discipline.listedOnly.cite",
        "discipline.repeat.cooloffDays",
      ],
    },
  ];
}

export function deriveEmployeeFileBoard({ employee, stationName, roleLabel, cases = [], ar = true } = {}) {
  const profile = employee?.profile || {};
  const completion = profileCompletionStats(employee);
  const status = employeeFileStatus(employee, ar);
  const hireIso = profile.hireDate || employee?.hireDate || employee?.startDate || "";
  const years = serviceYearsFromHire(hireIso);
  const contractType = optionLabel(CONTRACT_TYPE_OPTIONS, profileFieldValue(profile, "contractType", employee), ar) || (ar ? "—" : "—");
  const annualLeft = remainingLeaveDays(profile, employee?.leaveRequests || [], "annual");
  const annualLabel = annualLeft == null ? "—" : String(annualLeft);
  const base = Number(profile.baseSalary) || 0;
  const allow = Number(profile.allowances) || 0;
  const wage = base + allow + payableNightAllowance(employee);
  const gosi = String(profileFieldValue(profile, "gosiNumber", employee) || "").trim();
  const iban = String(profileFieldValue(profile, "iban", employee) || "").trim();
  const qiwa = String(profileFieldValue(profile, "qiwaTitle", employee) || "").trim();
  const medicalExp = profileFieldValue(profile, "medicalInsuranceExpiry", employee);
  const medicalDays = daysTo(medicalExp);
  const idExp = profileFieldValue(profile, "idExpiry", employee);
  const idDays = daysTo(idExp);

  const chips = [
    {
      id: "file",
      tab: "compliance",
      label: ar ? "اكتمال الملف" : "File completeness",
      state: completion.done ? (ar ? "مستوفى" : "Complete") : `${completion.pct}%`,
      note: completion.done
        ? (ar ? `${completion.fields.length} حقلاً إلزامياً` : `${completion.fields.length} required fields`)
        : (ar
          ? `ينقص ${completion.missing.length}: ${completion.missing.slice(0, 3).map((f) => f.ar).join("، ")}`
          : `${completion.missing.length} missing: ${completion.missing.slice(0, 3).map((f) => f.en).join(", ")}`),
      kind: completion.done ? "ok" : completion.pct >= 50 ? "warn" : "bad",
    },
    {
      id: "id",
      tab: "identity",
      label: ar ? "الهوية" : "ID",
      state: idDays == null ? (ar ? "غير مؤرّخ" : "No date") : idDays < 0 ? (ar ? "منتهية" : "Expired") : (ar ? "سارية" : "Valid"),
      note: idExp ? (ar ? `تنتهي ${niceDate(idExp, ar)}` : `Ends ${niceDate(idExp, ar)}`) : (ar ? "أضيفوا تاريخ الانتهاء" : "Add the expiry date"),
      kind: idDays == null ? "warn" : idDays < 0 ? "bad" : idDays <= EXPIRY_WARN_DAYS ? "warn" : "ok",
    },
    {
      id: "gosi",
      tab: "compliance",
      label: ar ? "التأمينات" : "GOSI",
      state: gosi ? (ar ? "مسجّل" : "On file") : (ar ? "ناقص" : "Missing"),
      note: ar ? "منصّة — بلا شارة مادة" : "A platform — no Labour Law chip",
      kind: gosi ? "ok" : "warn",
    },
    {
      id: "wps",
      tab: "contract",
      label: ar ? "حماية الأجور" : "WPS",
      state: iban ? (ar ? "آيبان في الملف" : "IBAN on file") : (ar ? "ناقص" : "Missing"),
      note: ar ? "مدد — بلا شارة مادة" : "Mudad — no Labour Law chip",
      kind: iban ? "ok" : "warn",
    },
  ].map((row) => ({ ...row, ...tone(row.kind) }));

  const facts = [
    { k: ar ? "نوع العقد" : "Contract", v: contractType || "—", note: ar ? "من نظام العمل" : "From the Labour Law" },
    { k: ar ? "مدة الخدمة" : "Service", v: hireIso ? yearsWord(Math.floor(years), ar) : "—", note: hireIso ? niceDate(hireIso, ar) : (ar ? "لا تاريخ تعيين" : "No hire date") },
    { k: ar ? "الأجر الإجمالي" : "Total wage", v: wage > 0 ? money(wage, ar) : "—", note: ar ? "مشتق من الأساسي والبدلات" : "Derived from base and allowances" },
    { k: ar ? "الرصيد السنوي" : "Annual leave", v: annualLabel, note: ar ? "أيام متبقية في الملف" : "Days left on the file" },
    { k: ar ? "الفرع" : "Station", v: stationName || "—", note: ar ? "من الهيكل — لا يُحرَّر هنا" : "From the org tree — not edited here" },
    { k: ar ? "المسمّى" : "Title", v: roleLabel || profile.position || "—", note: qiwa ? (ar ? `قوى: ${qiwa}` : `Qiwa: ${qiwa}`) : (ar ? "يطابق المسمّى في قوى" : "Should match Qiwa") },
  ];

  const openCases = (cases || []).filter((item) => item.employeeId === employee?.id && item.status !== "ruling" && item.status !== "closed");
  const pendingLeave = (employee?.leaveRequests || []).filter((item) => item.status === "pending");
  const todos = [];
  if (!completion.done) {
    todos.push({
      tab: "identity",
      text: ar
        ? `استكمال الملف — ${completion.missing.slice(0, 3).map((f) => f.ar).join("، ")}`
        : `Complete the file — ${completion.missing.slice(0, 3).map((f) => f.en).join(", ")}`,
      tag: ar ? "ناقص" : "Gap",
      kind: "warn",
    });
  }
  if (pendingLeave.length) {
    todos.push({
      tab: "leave",
      text: ar ? `${pendingLeave.length} طلب إجازة بانتظار القرار` : `${pendingLeave.length} leave request(s) awaiting a decision`,
      tag: ar ? "قرار" : "Decide",
      kind: "warn",
    });
  }
  if (openCases.length) {
    todos.push({
      tab: "growth",
      text: ar ? `${openCases.length} ملف جزاء مفتوح` : `${openCases.length} open sanction file(s)`,
      tag: ar ? "تحقيق" : "Hearing",
      kind: "bad",
    });
  }
  if (medicalDays != null && medicalDays <= EXPIRY_WARN_DAYS) {
    todos.push({
      tab: "compliance",
      text: ar ? `الضمان الصحي ${medicalDays < 0 ? "منتهٍ" : `ينتهي ${niceDate(medicalExp, ar)}`}` : `Medical cover ${medicalDays < 0 ? "expired" : `ends ${niceDate(medicalExp, ar)}`}`,
      tag: medicalDays < 0 ? (ar ? "منتهٍ" : "Expired") : (ar ? "تجديد" : "Renew"),
      kind: medicalDays < 0 ? "bad" : "warn",
    });
  }
  for (const doc of collectEmployeeValidityDocs(employee)) {
    const d = daysTo(doc.expiryDate);
    if (d == null || d > EXPIRY_WARN_DAYS) continue;
    todos.push({
      tab: "docs",
      text: `${ar ? doc.docLabelAr : doc.docLabelEn} — ${d < 0 ? (ar ? "منتهٍ" : "expired") : niceDate(doc.expiryDate, ar)}`,
      tag: d < 0 ? (ar ? "منتهٍ" : "Expired") : (ar ? "تجديد" : "Renew"),
      kind: d < 0 ? "bad" : "warn",
    });
  }

  const audit = [];
  if (hireIso) {
    audit.push({ text: ar ? "تعيين على الملف" : "Hire written to the file", at: niceDate(hireIso, ar), by: ar ? "الموارد البشرية" : "HR" });
  }
  const lastLeave = [...(employee?.leaveRequests || [])].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
  if (lastLeave) {
    audit.push({
      text: ar ? `إجازة ${lastLeave.type || ""} — ${lastLeave.status || ""}` : `Leave ${lastLeave.type || ""} — ${lastLeave.status || ""}`,
      at: niceDate(lastLeave.updatedAt || lastLeave.createdAt, ar),
      by: lastLeave.decidedByName || (ar ? "الطلب" : "Request"),
    });
  }
  const lastCase = [...(cases || []).filter((item) => item.employeeId === employee?.id)]
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
  if (lastCase) {
    audit.push({
      text: lastCase.note || lastCase.reason || (ar ? "حركة على ملف الجزاء" : "Movement on the sanction file"),
      at: niceDate(lastCase.updatedAt || lastCase.createdAt, ar),
      by: lastCase.updatedByName || (ar ? "التحقيق" : "Investigation"),
    });
  }

  return {
    status,
    completion,
    chips,
    facts,
    todos: todos.slice(0, 6).map((row) => ({ ...row, ...tone(row.kind) })),
    audit: audit.slice(0, 5),
    todoNote: todos.length
      ? (ar ? `${todos.length} يحتاج إجراءً` : `${todos.length} need action`)
      : (ar ? "لا إجراء معلّق على الملف" : "Nothing pending on the file"),
  };
}
