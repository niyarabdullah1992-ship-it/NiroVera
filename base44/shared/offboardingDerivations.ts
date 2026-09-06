/** Assets / custody offboarding — return gate + Articles 80/81/84/85/87 EOS.
 *  Design: NiroVera Platform.dc.html (offboarding / offAssets / eos / offComplete).
 */

import { checkResignationGate, checkTerminationGate } from "./contractLawDerivations.ts";
import { citeRule, ruleValue } from "./laborRules.ts";
import { accruedAnnualDaysAtExit } from "./leaveDerivations.ts";

export const ANNUAL_ENTITLEMENT_DAYS = 21;
/** Milliseconds in a mean Gregorian year (365.25d) — matches design svcYears. */
export const MS_PER_YEAR = 31557600000;

export type CustodyAssetStatus = "outstanding" | "returned";

export type CustodyAssetLike = {
  id: string;
  name: string;
  serial?: string | null;
  status?: CustodyAssetStatus;
  returnedAt?: string | null;
  returnedBy?: string | null;
};

export type OffboardingCaseLike = {
  id?: string;
  companyId?: string;
  employeeId: string;
  employeeName?: string;
  stationId?: string | null;
  hireDate?: string | null;
  gender?: string;
  marriageDate?: string;
  childBirthDate?: string;
  exitReason?: string;
  profile?: {
    gender?: string;
    marriageDate?: string;
    childBirthDate?: string;
    pregnant?: unknown;
    hireDate?: string;
    leaveTotals?: { annual?: number };
    contractType?: string;
    contractEndDate?: string;
    contract?: { type?: string; endDate?: string };
  };
  leaveTotals?: { annual?: number };
  contractType?: string;
  contractEndDate?: string;
  /** Monthly base wage (SAR). */
  base?: number;
  /** Monthly allowances (SAR). */
  allowances?: number;
  /** Annual leave days already used in the entitlement year. */
  annualLeaveUsed?: number;
  status?: "in_progress" | "completed";
  accessRevoked?: boolean;
  qiwaNotified?: boolean;
  safetyCleared?: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  assets?: CustodyAssetLike[];
  contractExit?: {
    reason?: string;
    evidenceName?: string;
    evidenceFiles?: unknown[];
    submittedAt?: string;
    resignAt?: string;
    postponeNote?: string;
    status?: string;
    deferredDate?: string;
    effectiveDate?: string;
  };
  leaveRequests?: Array<{ type?: string; status?: string; startDate?: string; endDate?: string }>;
};

export type OffboardingStepId =
  | "assets"
  | "safety"
  | "settlement"
  | "access"
  | "qiwa"
  | "certificate";

export type OffboardingStepState = "blocked" | "done" | "ready" | "on_completion";

function parseLocalDate(isoDate: string | null | undefined) {
  const s = String(isoDate || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Service years from hire date (local midnight) — design: Date.now − hire / 31557600000. */
export function serviceYears(hireDate: string | null | undefined, nowMs = Date.now()) {
  const d = parseLocalDate(hireDate);
  if (!d) return 0;
  return Math.max(0, (nowMs - d.getTime()) / MS_PER_YEAR);
}

export function isPreStart(hireDate: string | null | undefined, nowMs = Date.now()) {
  const d = parseLocalDate(hireDate);
  if (!d) return false;
  return d.getTime() > nowMs;
}

export function finalWage(base: number, allowances: number) {
  return Math.max(0, Number(base) || 0) + Math.max(0, Number(allowances) || 0);
}

/**
 * Article 84 EOS gratuity on final total wage:
 * half month × first 5 years + full month × years beyond 5.
 */
export function eosGratuity(years: number, wage: number) {
  const yrs = Math.max(0, Number(years) || 0);
  const w = Math.max(0, Number(wage) || 0);
  return Math.round((Math.min(yrs, 5) * 0.5 + Math.max(0, yrs - 5)) * w);
}

function isFemale(value?: string) {
  const g = String(value || "").toLowerCase();
  return g === "female" || g.includes("أنثى");
}

function monthsBetween(fromIso: string | undefined, toIso: string) {
  const a = parseLocalDate(fromIso);
  const b = parseLocalDate(toIso);
  if (!a || !b) return Infinity;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() < a.getDate() ? -1 : 0);
}

function localIso(nowMs: number) {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addCalendarDays(iso: unknown, n: number) {
  const s = String(iso || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(n));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function deriveSettlementDeadline(input: {
  today?: string;
  reason?: string;
  lastWorkDate?: string;
  effectiveDate?: string;
  contractExit?: OffboardingCaseLike["contractExit"];
} = {}, nowMs = Date.now()) {
  const onDate = input.today || localIso(nowMs);
  const reason = String(input.reason || input.contractExit?.reason || "").trim();
  const last = String(input.lastWorkDate || input.effectiveDate || input.contractExit?.effectiveDate || "").slice(0, 10);
  const workerEnded = reason === "resignation" || reason === "article_81";
  const days = workerEnded
    ? ruleValue("eos.settlement.workerDays", onDate)
    : ruleValue("eos.settlement.employerDays", onDate);
  const cite = citeRule(workerEnded ? "eos.settlement.workerDays" : "eos.settlement.employerDays", onDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) {
    return { ok: true as const, pending: true, days, workerEnded, due: null as string | null, late: false, cite, warning: null as string | null };
  }
  const due = addCalendarDays(last, days);
  const late = onDate > due;
  return {
    ok: true as const,
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

export function eosResignationFraction(years: number, onDate?: string) {
  const yrs = Math.max(0, Number(years) || 0);
  const oneThird = ruleValue("eos.resignation.oneThirdYears", onDate);
  const twoThirds = ruleValue("eos.resignation.twoThirdsYears", onDate);
  const full = ruleValue("eos.resignation.fullYears", onDate);
  if (yrs < oneThird) return 0;
  if (yrs < twoThirds) return 1 / 3;
  if (yrs < full) return 2 / 3;
  return 1;
}

export function art87FullAward(caseRow: OffboardingCaseLike, nowMs = Date.now()) {
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

export function unusedAnnualDays(annualLeaveUsed: number, entitlement = ANNUAL_ENTITLEMENT_DAYS) {
  return Math.max(0, entitlement - Math.max(0, Number(annualLeaveUsed) || 0));
}

function contractTypeOf(caseRow: OffboardingCaseLike) {
  const raw = String(
    caseRow.contractType
    || caseRow.profile?.contractType
    || caseRow.profile?.contract?.type
    || "",
  ).toLowerCase();
  return raw === "fixed" ? "fixed" as const : "indefinite" as const;
}

function remainingTermDays(endIso: string | undefined, onDate: string) {
  const a = parseLocalDate(onDate);
  const b = parseLocalDate(endIso);
  if (!a || !b || b.getTime() <= a.getTime()) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Article 77 unlawful-termination indemnity — informational, never added to eos.total. */
export function deriveArt77Compensation(caseRow: OffboardingCaseLike, nowMs = Date.now()) {
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
    citeRuleId: "eos.unlawful.cite" as const,
  };
}

/** Unused annual leave cash: (wage / 30) × unused days. */
export function leaveCashout(wage: number, unusedDays: number) {
  const w = Math.max(0, Number(wage) || 0);
  const days = Math.max(0, Number(unusedDays) || 0);
  return Math.round((w / 30) * days);
}

export function enrichAsset(asset: CustodyAssetLike) {
  const status: CustodyAssetStatus =
    asset.status === "returned" || asset.returnedAt ? "returned" : "outstanding";
  return {
    ...asset,
    serial: asset.serial || null,
    status,
    outstanding: status === "outstanding",
    returnedAt: status === "returned" ? asset.returnedAt || null : null,
  };
}

export function outstandingAssets(assets: CustodyAssetLike[] = []) {
  return assets.map(enrichAsset).filter((a) => a.outstanding);
}

export function outstandingCount(assets: CustodyAssetLike[] = []) {
  return outstandingAssets(assets).length;
}

/** Gate open only when every assigned asset is returned. */
export function isOffboardingGateOpen(assets: CustodyAssetLike[] = []) {
  return outstandingCount(assets) === 0;
}

function annualEntitlementDays(caseRow: OffboardingCaseLike, onDate: string, nowMs: number) {
  const hireDate = caseRow.hireDate || caseRow.profile?.hireDate;
  const years = isPreStart(hireDate, nowMs) ? 0 : serviceYears(hireDate, nowMs);
  const floor = years >= 5
    ? ruleValue("leave.annual.afterFiveYearsDays", onDate)
    : ruleValue("leave.annual.days", onDate);
  const custom = caseRow.leaveTotals?.annual ?? caseRow.profile?.leaveTotals?.annual;
  if (custom == null) return floor;
  return Math.max(Number(custom) || 0, floor);
}

export function deriveEos(caseRow: OffboardingCaseLike, nowMs = Date.now()) {
  const hireDate = caseRow.hireDate || caseRow.profile?.hireDate || null;
  const preStart = isPreStart(hireDate, nowMs);
  const years = preStart ? 0 : serviceYears(hireDate, nowMs);
  const wage = finalWage(Number(caseRow.base) || 0, Number(caseRow.allowances) || 0);
  const onDate = localIso(nowMs);
  const entitlement = annualEntitlementDays(caseRow, onDate, nowMs);
  const accrued = preStart ? 0 : accruedAnnualDaysAtExit(hireDate || undefined, entitlement, onDate);
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
  let citeId = "eos.gratuity.cite";
  if (preStart) {
    citeId = "eos.gratuity.cite";
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
  };
}

export function deriveOffboardingSteps(caseRow: OffboardingCaseLike) {
  const assets = (caseRow.assets || []).map(enrichAsset);
  const outstanding = outstandingCount(assets);
  const completed = caseRow.status === "completed";
  const assetsDone = outstanding === 0 && assets.length > 0;
  const safetyDone = caseRow.safetyCleared !== false; // design demo: safety already cleared
  const accessDone = !!(caseRow.accessRevoked || completed);
  const qiwaDone = !!(caseRow.qiwaNotified || completed);

  const steps: Array<{ id: OffboardingStepId; state: OffboardingStepState }> = [
    { id: "assets", state: assetsDone ? "done" : "blocked" },
    { id: "safety", state: safetyDone ? "done" : "blocked" },
    { id: "settlement", state: "ready" },
    { id: "access", state: accessDone ? "done" : "on_completion" },
    { id: "qiwa", state: qiwaDone ? "done" : "on_completion" },
    { id: "certificate", state: completed ? "done" : "on_completion" },
  ];
  return steps;
}

export function enrichOffboardingCase(caseRow: OffboardingCaseLike, nowMs = Date.now()) {
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

export function checkMarkReturnedGate(
  caseRow: OffboardingCaseLike | null | undefined,
  assetId: string,
) {
  if (!caseRow) {
    return {
      ok: false as const,
      error: "CASE_NOT_FOUND",
      reason: "ملف إنهاء الخدمة غير موجود.",
      reasonEn: "Offboarding case not found.",
    };
  }
  if (caseRow.status === "completed") {
    return {
      ok: false as const,
      error: "ALREADY_COMPLETED",
      reason: "الخدمة منتهية بالفعل.",
      reasonEn: "Offboarding already completed.",
    };
  }
  const id = String(assetId || "").trim();
  const asset = (caseRow.assets || []).find((a) => a.id === id);
  if (!asset) {
    return {
      ok: false as const,
      error: "ASSET_NOT_FOUND",
      reason: "العهدة غير موجودة.",
      reasonEn: "Asset not found.",
    };
  }
  if (enrichAsset(asset).status === "returned") {
    return {
      ok: false as const,
      error: "ALREADY_RETURNED",
      reason: "هذه العهدة مُستلمة مسبقًا.",
      reasonEn: "Asset already marked returned.",
    };
  }
  return { ok: true as const, asset };
}

export function checkCompleteOffboardingGate(
  caseRow: OffboardingCaseLike | null | undefined,
  extras: {
    contractExit?: OffboardingCaseLike["contractExit"];
    employee?: { leaveRequests?: OffboardingCaseLike["leaveRequests"]; profile?: { pregnant?: unknown } };
    leaveRequests?: OffboardingCaseLike["leaveRequests"];
    today?: string;
  } = {},
) {
  if (!caseRow) {
    return {
      ok: false as const,
      error: "CASE_NOT_FOUND",
      reason: "ملف إنهاء الخدمة غير موجود.",
      reasonEn: "Offboarding case not found.",
    };
  }
  if (caseRow.status === "completed") {
    return {
      ok: false as const,
      error: "ALREADY_COMPLETED",
      reason: "الخدمة منتهية بالفعل.",
      reasonEn: "Already completed.",
    };
  }
  const assets = caseRow.assets || [];
  if (assets.length === 0) {
    return {
      ok: false as const,
      error: "NO_ASSETS",
      reason: "لا عهد مسجّلة لهذا الموظف.",
      reasonEn: "No custody assets registered for this employee.",
    };
  }
  const n = outstandingCount(assets);
  if (n > 0) {
    return {
      ok: false as const,
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
  return { ok: true as const };
}
