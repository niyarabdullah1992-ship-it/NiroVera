/** Assets / custody offboarding — return gate + Articles 80/81/84/85/87 EOS.
 *  Keep in sync with base44/shared/offboardingDerivations.ts
 */

import { checkResignationGate, checkTerminationGate } from "./contractLawDerivations.js";
import { citeRule, ruleValue } from "./laborRules.js";
import { accruedAnnualDaysAtExit } from "./leaveTypes.js";
import { checkExitCloseoutGate, eosWageBase } from "./laborProtectionGates.js";

export const ANNUAL_ENTITLEMENT_DAYS = 21;
export const MS_PER_YEAR = 31557600000;

function parseLocalDate(isoDate) {
  const s = String(isoDate || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function serviceYears(hireDate, nowMs = Date.now()) {
  const d = parseLocalDate(hireDate);
  if (!d) return 0;
  return Math.max(0, (nowMs - d.getTime()) / MS_PER_YEAR);
}

export function isPreStart(hireDate, nowMs = Date.now()) {
  const d = parseLocalDate(hireDate);
  if (!d) return false;
  return d.getTime() > nowMs;
}

export function finalWage(base, allowances) {
  return Math.max(0, Number(base) || 0) + Math.max(0, Number(allowances) || 0);
}

export function eosGratuity(years, wage) {
  const yrs = Math.max(0, Number(years) || 0);
  const w = Math.max(0, Number(wage) || 0);
  return Math.round((Math.min(yrs, 5) * 0.5 + Math.max(0, yrs - 5)) * w);
}

function isFemale(value) {
  const g = String(value || "").toLowerCase();
  return g === "female" || g.includes("أنثى");
}

function monthsBetween(fromIso, toIso) {
  const a = parseLocalDate(fromIso);
  const b = parseLocalDate(toIso);
  if (!a || !b) return Infinity;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() < a.getDate() ? -1 : 0);
}

export function eosResignationFraction(years, onDate) {
  const yrs = Math.max(0, Number(years) || 0);
  const oneThird = ruleValue("eos.resignation.oneThirdYears", onDate);
  const twoThirds = ruleValue("eos.resignation.twoThirdsYears", onDate);
  const full = ruleValue("eos.resignation.fullYears", onDate);
  if (yrs < oneThird) return 0;
  if (yrs < twoThirds) return 1 / 3;
  if (yrs < full) return 2 / 3;
  return 1;
}

export function art87FullAward(caseRow, nowMs = Date.now()) {
  const exit = caseRow.contractExit || {};
  const reason = String(exit.reason || caseRow.exitReason || "").trim();
  if (reason && reason !== "resignation") return false;
  if (!isFemale(caseRow.gender || caseRow.profile?.gender)) return false;
  const endIso = localIso(nowMs);
  const marriageMonths = ruleValue("eos.art87.marriageMonths", endIso);
  const birthMonths = ruleValue("eos.art87.birthMonths", endIso);
  const marriageDate = caseRow.marriageDate || caseRow.profile?.marriageDate;
  const birthDate = caseRow.childBirthDate || caseRow.profile?.childBirthDate;
  if (marriageDate && monthsBetween(marriageDate, endIso) >= 0 && monthsBetween(marriageDate, endIso) <= marriageMonths) return true;
  if (birthDate && monthsBetween(birthDate, endIso) >= 0 && monthsBetween(birthDate, endIso) <= birthMonths) return true;
  return false;
}

function localIso(nowMs) {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addCalendarDays(iso, n) {
  const s = String(iso || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function deriveSettlementDeadline(input = {}, nowMs = Date.now()) {
  const onDate = input.today || localIso(nowMs);
  const reason = String(input.reason || input.contractExit?.reason || "").trim();
  const last = String(input.lastWorkDate || input.effectiveDate || input.contractExit?.effectiveDate || "").slice(0, 10);
  const workerEnded = reason === "resignation" || reason === "article_81";
  const days = workerEnded
    ? ruleValue("eos.settlement.workerDays", onDate)
    : ruleValue("eos.settlement.employerDays", onDate);
  const cite = citeRule(workerEnded ? "eos.settlement.workerDays" : "eos.settlement.employerDays", onDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) {
    return { ok: true, pending: true, days, workerEnded, due: null, late: false, cite };
  }
  const due = addCalendarDays(last, days);
  const late = onDate > due;
  return {
    ok: true,
    pending: false,
    days,
    workerEnded,
    lastWorkDate: last,
    due,
    late,
    cite,
    warning: late ? "SETTLEMENT_LATE" : null,
    reason: late ? `تنبيه — تجاوزت مهلة تصفية الحقوق (${due}).` : undefined,
    reasonEn: late ? `Notice — the entitlement settlement window (${due}) has passed.` : undefined,
  };
}

export function unusedAnnualDays(annualLeaveUsed, entitlement = ANNUAL_ENTITLEMENT_DAYS) {
  return Math.max(0, entitlement - Math.max(0, Number(annualLeaveUsed) || 0));
}

function contractTypeOf(caseRow) {
  const raw = String(
    caseRow.contractType
    || caseRow.profile?.contractType
    || caseRow.profile?.contract?.type
    || "",
  ).toLowerCase();
  return raw === "fixed" ? "fixed" : "indefinite";
}

function remainingTermDays(endIso, onDate) {
  const a = parseLocalDate(onDate);
  const b = parseLocalDate(endIso);
  if (!a || !b || b.getTime() <= a.getTime()) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Article 77 unlawful-termination indemnity — informational, never added to eos.total. */
export function deriveArt77Compensation(caseRow, nowMs = Date.now()) {
  const onDate = localIso(nowMs);
  const hireDate = caseRow.hireDate || caseRow.profile?.hireDate || null;
  const preStart = isPreStart(hireDate, nowMs);
  const years = preStart ? 0 : serviceYears(hireDate, nowMs);
  const wage = finalWage(Number(caseRow.base) || 0, Number(caseRow.allowances) || 0);
  const cite = citeRule("eos.unlawful.cite", onDate);
  const perYearDays = ruleValue("eos.unlawful.perYearDays", onDate);
  const minMonths = ruleValue("eos.unlawful.minMonths", onDate);
  const reason = String(caseRow.contractExit?.reason || caseRow.exitReason || "").trim();
  const applies = !preStart && reason !== "article_80";
  const term = contractTypeOf(caseRow);
  const endIso = caseRow.contractEndDate || caseRow.profile?.contractEndDate || caseRow.profile?.contract?.endDate;
  let raw = 0;
  if (applies && wage > 0) {
    if (term === "fixed" && endIso) {
      raw = (wage / 30) * remainingTermDays(endIso, onDate);
    } else {
      raw = (wage / 30) * perYearDays * years;
    }
  }
  const floor = applies ? wage * minMonths : 0;
  const amount = Math.max(Math.round(raw), Math.round(floor));
  return {
    applies,
    term,
    perYearDays,
    minMonths,
    amount,
    includedInTotal: false,
    cite,
    citeRuleId: "eos.unlawful.cite",
  };
}

export function leaveCashout(wage, unusedDays) {
  const w = Math.max(0, Number(wage) || 0);
  const days = Math.max(0, Number(unusedDays) || 0);
  return Math.round((w / 30) * days);
}

export function enrichAsset(asset) {
  const status = asset.status === "returned" || asset.returnedAt ? "returned" : "outstanding";
  return {
    ...asset,
    serial: asset.serial || null,
    status,
    outstanding: status === "outstanding",
    returnedAt: status === "returned" ? asset.returnedAt || null : null,
  };
}

export function outstandingAssets(assets = []) {
  return assets.map(enrichAsset).filter((a) => a.outstanding);
}

export function outstandingCount(assets = []) {
  return outstandingAssets(assets).length;
}

export function isOffboardingGateOpen(assets = []) {
  return outstandingCount(assets) === 0;
}

function annualEntitlementDays(caseRow, onDate, nowMs) {
  const hireDate = caseRow.hireDate || caseRow.profile?.hireDate;
  const years = isPreStart(hireDate, nowMs) ? 0 : serviceYears(hireDate, nowMs);
  const floor = years >= 5
    ? ruleValue("leave.annual.afterFiveYearsDays", onDate)
    : ruleValue("leave.annual.days", onDate);
  const custom = caseRow.leaveTotals?.annual ?? caseRow.profile?.leaveTotals?.annual;
  if (custom == null) return floor;
  return Math.max(Number(custom) || 0, floor);
}

export function deriveEos(caseRow, nowMs = Date.now()) {
  const hireDate = caseRow.hireDate || caseRow.profile?.hireDate || null;
  const preStart = isPreStart(hireDate, nowMs);
  const years = preStart ? 0 : serviceYears(hireDate, nowMs);
  const eosBase = eosWageBase({
    ...caseRow,
    profile: caseRow.profile || {},
    base: caseRow.base ?? caseRow.profile?.baseSalary ?? caseRow.profile?.base,
    allowances: caseRow.allowances ?? caseRow.profile?.allowances,
    bonus: caseRow.bonus ?? caseRow.profile?.bonus,
  });
  const wage = eosBase.wage;
  const onDate = localIso(nowMs);
  const entitlement = annualEntitlementDays(caseRow, onDate, nowMs);
  const accrued = preStart ? 0 : accruedAnnualDaysAtExit(hireDate, entitlement, onDate);
  const unused = Math.round(unusedAnnualDays(Number(caseRow.annualLeaveUsed) || 0, accrued) * 10) / 10;
  const full = preStart ? 0 : eosGratuity(years, wage);
  const leave = preStart ? 0 : leaveCashout(wage, unused);
  const exit = caseRow.contractExit || {};
  const reason = String(exit.reason || caseRow.exitReason || "").trim();
  const art80 = reason === "article_80";
  const art81 = reason === "article_81";
  const art87 = !preStart && !art80 && art87FullAward(caseRow, nowMs);
  const resigning = reason === "resignation";
  let fraction = 1;
  let citeId = eosBase.citeRuleId || "eos.gratuity.cite";
  if (preStart) {
    citeId = eosBase.citeRuleId || "eos.gratuity.cite";
  } else if (art80) {
    fraction = 0;
    citeId = "eos.art80.cite";
  } else if (art81) {
    citeId = "eos.art81.cite";
  } else if (art87) {
    citeId = "eos.art87.cite";
  } else if (resigning) {
    fraction = eosResignationFraction(years, onDate);
    citeId = "eos.resignation.cite";
  }
  const gratuity = Math.round(full * fraction);
  return {
    hireDate,
    preStart,
    years,
    wage,
    unusedAnnualDays: unused,
    firstFive: preStart ? 0 : Math.round(Math.min(years, 5) * 0.5 * wage),
    beyondFive: preStart ? 0 : Math.round(Math.max(0, years - 5) * wage),
    article84Full: full,
    fraction,
    art80,
    art81,
    art87,
    citeRuleId: citeId,
    cite: citeRule(citeId, onDate),
    leaveCiteRuleId: "eos.unusedLeave.cite",
    leaveCite: citeRule("eos.unusedLeave.cite", onDate),
    unlawful: deriveArt77Compensation(caseRow, nowMs),
    gratuity,
    leaveCash: leave,
    total: gratuity + leave,
    allWageElements: eosBase.agreed,
  };
}

export function deriveOffboardingSteps(caseRow) {
  const assets = (caseRow.assets || []).map(enrichAsset);
  const outstanding = outstandingCount(assets);
  const completed = caseRow.status === "completed";
  const assetsDone = outstanding === 0 && assets.length > 0;
  const safetyDone = caseRow.safetyCleared !== false;
  const accessDone = !!(caseRow.accessRevoked || completed);
  const qiwaDone = !!(caseRow.qiwaNotified || completed);

  return [
    { id: "assets", state: assetsDone ? "done" : "blocked" },
    { id: "safety", state: safetyDone ? "done" : "blocked" },
    { id: "settlement", state: "ready" },
    { id: "access", state: accessDone ? "done" : "on_completion" },
    { id: "qiwa", state: qiwaDone ? "done" : "on_completion" },
    { id: "certificate", state: completed ? "done" : "on_completion" },
  ];
}

export function enrichOffboardingCase(caseRow, nowMs = Date.now()) {
  const assets = (caseRow.assets || []).map(enrichAsset);
  const outstanding = outstandingCount(assets);
  const gateOpen = isOffboardingGateOpen(assets) && assets.length > 0;
  const status = caseRow.status === "completed" ? "completed" : "in_progress";
  return {
    ...caseRow,
    status,
    assets,
    outstandingCount: outstanding,
    gateOpen: status === "completed" ? false : gateOpen,
    eos: deriveEos(caseRow, nowMs),
    steps: deriveOffboardingSteps({ ...caseRow, assets, status }),
    accessRevoked: !!(caseRow.accessRevoked || status === "completed"),
    qiwaNotified: !!(caseRow.qiwaNotified || status === "completed"),
  };
}

export function checkMarkReturnedGate(caseRow, assetId) {
  if (!caseRow) {
    return {
      ok: false,
      error: "CASE_NOT_FOUND",
      reason: "ملف إنهاء الخدمة غير موجود.",
      reasonEn: "Offboarding case not found.",
    };
  }
  if (caseRow.status === "completed") {
    return {
      ok: false,
      error: "ALREADY_COMPLETED",
      reason: "الخدمة منتهية بالفعل.",
      reasonEn: "Offboarding already completed.",
    };
  }
  const id = String(assetId || "").trim();
  const asset = (caseRow.assets || []).find((a) => a.id === id);
  if (!asset) {
    return {
      ok: false,
      error: "ASSET_NOT_FOUND",
      reason: "العهدة غير موجودة.",
      reasonEn: "Asset not found.",
    };
  }
  if (enrichAsset(asset).status === "returned") {
    return {
      ok: false,
      error: "ALREADY_RETURNED",
      reason: "هذه العهدة مُستلمة مسبقًا.",
      reasonEn: "Asset already marked returned.",
    };
  }
  return { ok: true, asset };
}

export function checkCompleteOffboardingGate(caseRow, extras = {}) {
  if (!caseRow) {
    return {
      ok: false,
      error: "CASE_NOT_FOUND",
      reason: "ملف إنهاء الخدمة غير موجود.",
      reasonEn: "Offboarding case not found.",
    };
  }
  if (caseRow.status === "completed") {
    return {
      ok: false,
      error: "ALREADY_COMPLETED",
      reason: "الخدمة منتهية بالفعل.",
      reasonEn: "Already completed.",
    };
  }
  const assets = caseRow.assets || [];
  if (assets.length === 0) {
    return {
      ok: false,
      error: "NO_ASSETS",
      reason: "لا عهد مسجّلة لهذا الموظف.",
      reasonEn: "No custody assets registered for this employee.",
    };
  }
  const n = outstandingCount(assets);
  if (n > 0) {
    return {
      ok: false,
      error: "ASSETS_OUTSTANDING",
      reason: `${n} عهدة لم تُستلم — إنهاء الخدمة موقوف.`,
      reasonEn: `${n} assets outstanding — offboarding is blocked.`,
    };
  }
  const exit = extras.contractExit || caseRow.contractExit || {};
  const term = checkTerminationGate({
    reason: exit.reason,
    evidenceFiles: exit.evidenceFiles || (exit.evidenceName ? [exit.evidenceName] : []),
    employee: extras.employee || caseRow,
    leaveRequests: extras.leaveRequests || extras.employee?.leaveRequests || caseRow.leaveRequests,
    pregnant: extras.employee?.profile?.pregnant || caseRow.profile?.pregnant,
    today: extras.today,
  });
  if (!term.ok) return term;
  if (exit.reason === "resignation") {
    const resg = checkResignationGate({
      submittedAt: exit.submittedAt || exit.resignAt,
      postponeNote: exit.postponeNote,
      status: exit.status,
      deferredDate: exit.deferredDate,
    });
    if (!resg.ok) return resg;
  }
  const closeout = checkExitCloseoutGate({
    serviceCertificateIssued: extras.serviceCertificateIssued ?? exit.serviceCertificateIssued,
    documentsReturned: extras.documentsReturned ?? exit.documentsReturned,
  });
  if (!closeout.ok) return closeout;
  return { ok: true };
}
