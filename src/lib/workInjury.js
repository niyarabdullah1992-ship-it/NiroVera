/**
 * Work injury — Labour Law Arts. 132–141.
 *
 * Art. 132: Arts. 133–141 do not apply to an establishment covered by the occupational-hazards
 * branch of the Social Insurance Law — there, treatment and the daily compensation come from GOSI.
 * When the establishment is NOT covered, the employer carries:
 *   Art. 133 — all treatment costs (hospital, tests, x-ray, prosthetics, transport to treatment).
 *   Art. 137 — temporary disability: the full wage for 60 days, then 75% for the rest of treatment;
 *              at one year of treatment (or a medical finding of no recovery) it is total disability:
 *              the contract ends and Art. 138 applies; what was paid in that year is not recovered.
 *   Art. 138 — total permanent disability or death: three years' wage, at least SAR 54,000;
 *              partial permanent disability: its rated percentage of that figure.
 *   Art. 139 — none of 133/137/138 if the worker injured himself on purpose, by deliberate
 *              misconduct, or refused the doctor or the treatment without a lawful reason.
 * Pure helpers only; the store writes, payroll and the file read.
 */

export const INJURY_FULL_DAYS = 60;
export const INJURY_REDUCED_RATE = 0.75;
export const INJURY_TOTAL_DISABILITY_DAYS = 365;
export const INJURY_TOTAL_MIN_SAR = 54000;

export const ART139_GROUNDS = [
  { key: "self", ar: "تعمّد إصابة نفسه", en: "Injured himself on purpose" },
  { key: "misconduct", ar: "سوء سلوك مقصود من جانبه", en: "Deliberate misconduct" },
  { key: "refusedTreatment", ar: "امتنع عن الطبيب أو العلاج دون سبب مشروع", en: "Refused the doctor or treatment without a lawful reason" },
];

function dayKey(value) {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function toUtc(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(key, n) {
  const d = new Date(toUtc(key) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** null = not set (treated as covered, the common case, and flagged); true / false as declared. */
export function gosiHazardCoverage(company) {
  const raw = company?.hoursPolicy?.gosiOccupationalHazards ?? company?.workInjuryPolicy?.gosiCovered;
  if (raw === true || raw === "yes") return true;
  if (raw === false || raw === "no") return false;
  return null;
}

/** Approved work-injury leave rows of one person, each with the injury (episode) date it belongs to. */
export function injuryLeaves(employee) {
  return (employee?.leaveRequests || [])
    .filter((row) => String(row?.type || "").toLowerCase() === "work_injury" && (row.status || "") === "approved")
    .map((row) => ({
      ...row,
      start: dayKey(row.startDate),
      end: dayKey(row.endDate) || dayKey(row.startDate),
      injuryDate: dayKey(row.injuryDate || row.eventDate) || dayKey(row.startDate),
    }))
    .filter((row) => row.start);
}

/** The first treatment day of each injury: the earliest approved start among leaves of the same injury date. */
function episodeStarts(leaves) {
  const map = {};
  for (const row of leaves) {
    if (!map[row.injuryDate] || row.start < map[row.injuryDate]) map[row.injuryDate] = row.start;
  }
  return map;
}

/**
 * One month of injury leave (Art. 137 when not covered): days on full pay, days at 75%, and the
 * statutory reduction of the wage — a quarter of the daily actual wage for every day past the 60th.
 * Not an Art. 92 deduction and not leave: the law sets the compensation itself.
 */
export function injuryMonth({ employee, company, month, monthlyWage = 0, skipDays }) {
  const skip = new Set(skipDays || []);
  const dayKeys = [];
  const covered = gosiHazardCoverage(company);
  const leaves = injuryLeaves(employee);
  const starts = episodeStarts(leaves);
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  let fullDays = 0;
  let reducedDays = 0;
  let excludedDays = 0;
  for (const row of leaves) {
    for (let key = row.start < first ? first : row.start; key <= row.end && key <= last; key = addDays(key, 1)) {
      // Counted once: a day already not due under unpaid leave or detention is not charged again.
      if (skip.has(key)) continue;
      dayKeys.push(key);
      if (row.art139) { excludedDays += 1; continue; }
      const index = daysBetween(starts[row.injuryDate], key) + 1;
      if (index > INJURY_FULL_DAYS) reducedDays += 1; else fullDays += 1;
    }
  }
  const daily = (Number(monthlyWage) || 0) / 30;
  const reduction = covered === false ? Math.round(daily * (1 - INJURY_REDUCED_RATE) * reducedDays * 100) / 100 : 0;
  const unpaid = covered === false ? Math.round(daily * excludedDays * 100) / 100 : 0;
  const days = fullDays + reducedDays + excludedDays;
  // Covered: the allowance cannot be combined with the wage — if the company stops the wage, these days are off payroll.
  const hospitalDays = covered === false ? 0 : leaves.reduce((sum, row) => sum + Math.max(0, Number(row.hospitalDays) || 0), 0);
  const wageStop = covered !== false && gosiInjuryWageMode(company) === "stop" ? Math.round(daily * days * 100) / 100 : 0;
  const allowance = covered !== false ? gosiAllowance({ dailyWage: daily, days, hospitalDays: Math.min(hospitalDays, days) }) : 0;
  return { covered, fullDays, reducedDays, excludedDays, days, reduction, unpaid, wageStop, allowance, hospitalDays, dayKeys };
}

/**
 * Where a person stands on an injury today: day of treatment, phase, the 60-day and one-year marks,
 * and the Art. 138 figure on the current wage.
 */
export function injuryStatus({ employee, company, today, monthlyWage = 0 }) {
  const leaves = injuryLeaves(employee);
  if (!leaves.length) return null;
  const starts = episodeStarts(leaves);
  const latest = leaves.slice().sort((a, b) => (a.end < b.end ? 1 : -1))[0];
  const start = starts[latest.injuryDate];
  const on = today < latest.end ? today : latest.end;
  const dayIndex = Math.max(1, daysBetween(start, on) + 1);
  const active = today >= latest.start && today <= latest.end;
  const covered = gosiHazardCoverage(company);
  const wage = Number(monthlyWage) || 0;
  const total138 = Math.max(INJURY_TOTAL_MIN_SAR, wage * 36);
  return {
    covered,
    active,
    injuryDate: latest.injuryDate,
    treatmentStart: start,
    lastDay: latest.end,
    dayIndex,
    phase: dayIndex > INJURY_TOTAL_DISABILITY_DAYS - 1 ? "year" : dayIndex > INJURY_FULL_DAYS ? "reduced" : "full",
    fullUntil: addDays(start, INJURY_FULL_DAYS - 1),
    reducedFrom: addDays(start, INJURY_FULL_DAYS),
    yearMark: addDays(start, INJURY_TOTAL_DISABILITY_DAYS),
    total138,
    art139: latest.art139 || "",
  };
}

/* ------------------------------------------------------------------------------------------------
 * Covered establishments — GOSI occupational hazards (as GOSI states it):
 *   daily allowance 100% of the daily wage during temporary disability, 75% while treated at GOSI's
 *   expense (in hospital); it cannot be combined with the wage. Permanent disability: Saudi — monthly
 *   pension 100% of the average wage of the three months before the injury (total), proportional for
 *   50–99%; care assistance 50% of the pension, at most SAR 3,500. Non-Saudi — lump sum: 84 months
 *   (total or death) at most SAR 330,000; 60 months × the rate (50–99%) at most SAR 165,000.
 * These are estimates for planning; the medical committee and GOSI decide.
 * --------------------------------------------------------------------------------------------- */
export const GOSI_HOSPITAL_RATE = 0.75;
export const GOSI_CARE_RATE = 0.5;
export const GOSI_CARE_CAP = 3500;
export const GOSI_DEATH_PENSION_MIN = 1983.75;
export const GOSI_NON_SAUDI_TOTAL_MONTHS = 84;
export const GOSI_NON_SAUDI_TOTAL_CAP = 330000;
export const GOSI_NON_SAUDI_PARTIAL_MONTHS = 60;
export const GOSI_NON_SAUDI_PARTIAL_CAP = 165000;

/** "continue" (default): the employer keeps paying the wage; "stop": the wage stops and GOSI pays the allowance. */
export function gosiInjuryWageMode(company) {
  return company?.hoursPolicy?.gosiInjuryWageMode === "stop" ? "stop" : "continue";
}

/** GOSI daily allowance for a span: 100% of the daily wage, 75% on hospital days at GOSI's expense. */
export function gosiAllowance({ dailyWage = 0, days = 0, hospitalDays = 0 }) {
  const h = Math.min(Math.max(0, Number(hospitalDays) || 0), Math.max(0, Number(days) || 0));
  const plain = Math.max(0, (Number(days) || 0) - h);
  return Math.round(((Number(dailyWage) || 0) * plain + (Number(dailyWage) || 0) * GOSI_HOSPITAL_RATE * h) * 100) / 100;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * What a permanent outcome is worth. kind: "total" | "partial" | "death"; percent for partial (0–100).
 * covered === false → Labour Law Art. 138; otherwise GOSI (Saudi pension / non-Saudi lump sum).
 */
export function disabilityOutcome({ covered, saudi = true, kind, percent = 0, monthlyWage = 0, avgWage3 = 0, needsCare = false }) {
  const rate = Math.min(100, Math.max(0, Number(percent) || 0)) / 100;
  if (covered === false) {
    const total = Math.max(INJURY_TOTAL_MIN_SAR, (Number(monthlyWage) || 0) * 36);
    const amount = kind === "partial" ? round2(total * rate) : total;
    return { regime: "labour", lump: amount, monthly: 0, article: "138", endsContract: kind !== "partial" };
  }
  const avg = Number(avgWage3) || Number(monthlyWage) || 0;
  if (kind === "partial" && rate < 0.5) {
    return { regime: "gosi", lump: 0, monthly: 0, belowThreshold: true, endsContract: false };
  }
  if (saudi) {
    const pension = kind === "death"
      ? Math.max(GOSI_DEATH_PENSION_MIN, avg)
      : round2(avg * (kind === "partial" ? rate : 1));
    const care = needsCare && kind !== "death" ? Math.min(GOSI_CARE_CAP, round2(pension * GOSI_CARE_RATE)) : 0;
    return { regime: "gosi", lump: 0, monthly: round2(pension + care), care, endsContract: kind !== "partial" };
  }
  const pension = avg * (kind === "partial" ? rate : 1);
  const care = needsCare && kind !== "death" ? Math.min(GOSI_CARE_CAP, pension * GOSI_CARE_RATE) : 0;
  const lump = kind === "partial"
    ? Math.min(GOSI_NON_SAUDI_PARTIAL_CAP, (pension + care) * GOSI_NON_SAUDI_PARTIAL_MONTHS)
    : Math.min(GOSI_NON_SAUDI_TOTAL_CAP, (pension + care) * GOSI_NON_SAUDI_TOTAL_MONTHS);
  return { regime: "gosi", lump: round2(lump), monthly: 0, care: round2(care), endsContract: kind !== "partial" };
}
