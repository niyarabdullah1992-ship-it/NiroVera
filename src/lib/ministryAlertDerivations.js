/** Named ministry / statutory alerts derived from the live register — no invented counts. */
import {
  checkContractTermGate,
  deriveExpiringDocs,
  deriveNitaqat,
  deriveSaudiStatus,
  daysUntilExpiry,
  docLabel,
  EXPIRY_WARN_DAYS,
  localDateKey,
} from "./complianceDerivations.js";
import { isHeatBanDate } from "./contractLawDerivations.js";
import { deriveWpsStatus, isWpsLate, wpsDeadline } from "./payrollDerivations.js";
import { citeRule, ruleValue } from "./laborRules.js";

const PROFILE_EXPIRY = [
  { keys: ["idExpiry", "iqamaExpiry"], kind: "iqama" },
  { keys: ["workPermitExpiry"], kind: "work_permit" },
  { keys: ["passportExpiry"], kind: "passport" },
  { keys: ["medicalInsuranceExpiry"], kind: "medical" },
];

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonthKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return monthKey(x);
}

function getPayrollRun(data, month) {
  const list = data?.payrollRuns || data?.payroll || [];
  return (Array.isArray(list) ? list : []).find((r) => r && r.month === month) || null;
}

function profileExpiryRows(employees, today) {
  const out = [];
  for (const emp of employees || []) {
    const profile = emp?.profile && typeof emp.profile === "object" ? emp.profile : {};
    for (const field of PROFILE_EXPIRY) {
      const iso = field.keys.map((k) => profile[k]).find(Boolean);
      if (!iso) continue;
      const days = daysUntilExpiry(String(iso).slice(0, 10), today);
      if (days == null || days > EXPIRY_WARN_DAYS) continue;
      const label = field.kind === "passport"
        ? { ar: "الجواز", en: "Passport" }
        : field.kind === "medical"
          ? { ar: "التأمين الطبي", en: "Medical insurance" }
          : docLabel(field.kind);
      out.push({
        employeeId: emp.employeeId || emp.id,
        name: emp.name,
        kind: field.kind,
        docLabelAr: label.ar,
        docLabelEn: label.en,
        expiryDate: String(iso).slice(0, 10),
        days,
      });
    }
  }
  return out;
}

function mergeExpiryRows(fromDocs, fromProfile) {
  const seen = new Set();
  const out = [];
  for (const row of [...fromDocs, ...fromProfile]) {
    const key = `${row.employeeId || ""}:${row.kind}:${row.expiryDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((a, b) => a.days - b.days);
}

export function canSeeMinistryAlerts(user, data) {
  if (!user) return false;
  if (user.role === "owner" || user.isOwner || (data?.ownerId && String(user.id) === String(data.ownerId))) return true;
  return ["director", "ops_manager", "pgm", "station_manager", "safety_officer", "financial_officer"].includes(user.role);
}

/**
 * @returns {{ alerts: Array<{ id, gate, level, count, to, textAr, textEn, actionAr, actionEn, ruleId }>, count: number }}
 */
export function deriveMinistryAlerts(data, { now = new Date(), today = localDateKey(now) } = {}) {
  const employees = data?.employees || [];
  const alerts = [];

  const expiries = mergeExpiryRows(deriveExpiringDocs(employees, today), profileExpiryRows(employees, today));
  const expired = expiries.filter((d) => d.days < 0);
  const expiring = expiries.filter((d) => d.days >= 0);
  const iqamaExpired = expired.filter((d) => d.kind === "iqama" || d.kind === "work_permit");
  const iqamaExpiring = expiring.filter((d) => d.kind === "iqama" || d.kind === "work_permit");

  if (expired.length) {
    alerts.push({
      id: "doc_expired",
      gate: "DOC_EXPIRED",
      level: "critical",
      count: expired.length,
      to: "/app/hr",
      ruleId: "compliance.doc.expiryWarnDays",
      textAr: `${expired.length} وثيقة نظامية منتهية — لا إسناد قبل التجديد.`,
      textEn: `${expired.length} statutory document(s) expired — no assignment before renewal.`,
      actionAr: "الملف",
      actionEn: "File",
    });
  }
  if (iqamaExpired.length === 0 && iqamaExpiring.length) {
    alerts.push({
      id: "iqama_expiring",
      gate: "DOC_EXPIRING",
      level: "warn",
      count: iqamaExpiring.length,
      to: "/app/hr",
      ruleId: "compliance.doc.expiryWarnDays",
      textAr: `${iqamaExpiring.length} إقامة / رخصة عمل تنتهي خلال ${EXPIRY_WARN_DAYS} يومًا.`,
      textEn: `${iqamaExpiring.length} iqama / work-permit document(s) expire within ${EXPIRY_WARN_DAYS} days.`,
      actionAr: "تجديد",
      actionEn: "Renew",
    });
  } else if (expiring.length && !expired.length) {
    alerts.push({
      id: "doc_expiring",
      gate: "DOC_EXPIRING",
      level: "warn",
      count: expiring.length,
      to: "/app/hr",
      ruleId: "compliance.doc.expiryWarnDays",
      textAr: `${expiring.length} وثيقة تنتهي خلال ${EXPIRY_WARN_DAYS} يومًا.`,
      textEn: `${expiring.length} document(s) expire within ${EXPIRY_WARN_DAYS} days.`,
      actionAr: "الملف",
      actionEn: "File",
    });
  }

  let contractExpired = 0;
  let contractExpiring = 0;
  let contractEndMissing = 0;
  for (const emp of employees) {
    const gate = checkContractTermGate(emp);
    if (gate.error === "CONTRACT_EXPIRED") contractExpired += 1;
    else if (gate.error === "CONTRACT_END_REQUIRED") contractEndMissing += 1;
    else if (gate.warning === "CONTRACT_EXPIRING") contractExpiring += 1;
  }
  if (contractExpired) {
    alerts.push({
      id: "contract_expired",
      gate: "CONTRACT_EXPIRED",
      level: "critical",
      count: contractExpired,
      to: "/app/hr",
      ruleId: "contract.fixed.cite",
      textAr: `${contractExpired} عقد محدد المدة منتهٍ.`,
      textEn: `${contractExpired} fixed-term contract(s) expired.`,
      actionAr: "العقود",
      actionEn: "Contracts",
    });
  } else if (contractEndMissing) {
    alerts.push({
      id: "contract_end_required",
      gate: "CONTRACT_END_REQUIRED",
      level: "warn",
      count: contractEndMissing,
      to: "/app/hr",
      ruleId: "contract.fixed.cite",
      textAr: `${contractEndMissing} عقد محدد المدة بلا تاريخ نهاية.`,
      textEn: `${contractEndMissing} fixed-term contract(s) missing an end date.`,
      actionAr: "تصحيح",
      actionEn: "Correct",
    });
  } else if (contractExpiring) {
    alerts.push({
      id: "contract_expiring",
      gate: "CONTRACT_EXPIRING",
      level: "warn",
      count: contractExpiring,
      to: "/app/hr",
      ruleId: "contract.fixed.cite",
      textAr: `${contractExpiring} عقد ينتهي خلال ${EXPIRY_WARN_DAYS} يومًا.`,
      textEn: `${contractExpiring} contract(s) end within ${EXPIRY_WARN_DAYS} days.`,
      actionAr: "العقود",
      actionEn: "Contracts",
    });
  }

  const entitlement = prevMonthKey(now);
  const run = getPayrollRun(data, entitlement);
  const wps = deriveWpsStatus(run, now);
  const late = isWpsLate(entitlement, now);
  if (!run && late) {
    alerts.push({
      id: "wps_missing",
      gate: "WPS_FILE_MISSING",
      level: "critical",
      count: 1,
      to: "/app/payroll",
      ruleId: "payroll.wps.fileWindowDays",
      textAr: `لا مسير / ملف حماية أجور لشهر ${entitlement} — المهلة ${wpsDeadline(entitlement) || "—"}.`,
      textEn: `No payroll / WPS file for ${entitlement} — deadline ${wpsDeadline(entitlement) || "—"}.`,
      actionAr: "حماية الأجور",
      actionEn: "WPS",
    });
  } else if (run && wps.status !== "sent" && (wps.late || late)) {
    alerts.push({
      id: "wps_late",
      gate: "WPS_LATE",
      level: "critical",
      count: 1,
      to: "/app/payroll",
      ruleId: "payroll.wps.fileWindowDays",
      textAr: `ملف حماية الأجور لـ ${entitlement} لم يُرفع — المهلة ${wps.deadline || wpsDeadline(entitlement) || "—"}.`,
      textEn: `WPS file for ${entitlement} not sent — deadline ${wps.deadline || wpsDeadline(entitlement) || "—"}.`,
      actionAr: "رفع الملف",
      actionEn: "File WPS",
    });
  } else if (run && wps.status !== "sent" && wps.status === "ready") {
    alerts.push({
      id: "wps_ready",
      gate: "WPS_READY",
      level: "warn",
      count: 1,
      to: "/app/payroll",
      ruleId: "payroll.wps.fileWindowDays",
      textAr: `مسير ${entitlement} معتمد — ملف حماية الأجور لم يُبنَ بعد.`,
      textEn: `Payroll ${entitlement} is approved — WPS file not built yet.`,
      actionAr: "بناء الملف",
      actionEn: "Build file",
    });
  }

  if (isHeatBanDate(today)) {
    const startH = String(ruleValue("hours.heat.startHour")).padStart(2, "0");
    const endH = String(ruleValue("hours.heat.endHour")).padStart(2, "0");
    alerts.push({
      id: "heat_ban",
      gate: "HEAT_BAN",
      level: "info",
      count: 1,
      to: "/app/schedules",
      ruleId: "hours.heat.fromDay",
      textAr: `اليوم ضمن حظر الشمس — الميدان المكشوف موقوف من ${startH}:00 إلى ${endH}:00.`,
      textEn: `Heat-ban day — outdoor field work blocked from ${startH}:00 to ${endH}:00.`,
      actionAr: "الوردية",
      actionEn: "Rota",
    });
  }

  const nitaqat = deriveNitaqat(employees);
  if (nitaqat.mismatch > 0) {
    alerts.push({
      id: "identity_mismatch",
      gate: "SAUDI_IDENTITY_MISMATCH",
      level: "warn",
      count: nitaqat.mismatch,
      to: "/app/hr",
      ruleId: null,
      textAr: `${nitaqat.mismatch} ملفًا فيه تعارض جنسية / رقم هوية — لا يُحسب في النطاقات.`,
      textEn: `${nitaqat.mismatch} file(s) have a nationality / ID mismatch — excluded from Nitaqat.`,
      actionAr: "الهوية",
      actionEn: "Identity",
    });
  } else {
    const mismatches = employees.filter((e) => deriveSaudiStatus(e).mismatch).length;
    if (mismatches) {
      alerts.push({
        id: "identity_mismatch",
        gate: "SAUDI_IDENTITY_MISMATCH",
        level: "warn",
        count: mismatches,
        to: "/app/hr",
        ruleId: null,
        textAr: `${mismatches} ملفًا فيه تعارض جنسية / رقم هوية.`,
        textEn: `${mismatches} file(s) have a nationality / ID mismatch.`,
        actionAr: "الهوية",
        actionEn: "Identity",
      });
    }
  }

  return {
    alerts,
    count: alerts.reduce((n, a) => n + (Number(a.count) || 0), 0),
    today,
    cite: alerts.map((a) => (a.ruleId ? citeRule(a.ruleId) : null)).filter(Boolean),
  };
}
