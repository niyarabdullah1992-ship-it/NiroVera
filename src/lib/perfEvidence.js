/**
 * The annual report's evidence for one person over the report period (النموذج الموحد م18):
 *   الكفاءة  ← the mean quality level of his approved tasks in the period (lib/taskQuality)
 *   المواظبة ← his duty days in the period, each derived by lib/dutyDay exactly as «شهري» and the
 *              file derive them, totalled by monthTotals, then mapped by ATTENDANCE_LEVEL_MAP
 *   السلوك   ← no level — the manager judges; signed sanctions and proven complaints in the period
 *              are shown beside it for information, never deducted automatically.
 * Pure (no React). The server re-derives competence from its own task store (hcm.submitRating).
 */
import { monthTotals, myDutyDay, rowsByDateKey } from "./dutyDay.js";
import { deriveEmployeeTaskFacts } from "./hcmDerivations.js";
import { caseCountsAsPenalty } from "./disciplineDerivations.js";
import { reportPrefill } from "./perfReport.js";

const day = (v) => String(v || "").slice(0, 10);
const inRange = (d, from, to) => Boolean(d) && (!from || d >= from) && (!to || d <= to);

export function eachDay(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  const d = new Date(`${from}T00:00:00Z`);
  let guard = 0;
  while (guard < 800) {
    const key = d.toISOString().slice(0, 10);
    if (key > to) break;
    out.push(key);
    d.setUTCDate(d.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}

/** The period's duty totals — scheduled, attended, absent, late — from the shared duty-day derivation. */
export function periodDutyTotals({ employee, data, rows = [], from, to, todayKey, calendar } = {}) {
  if (!employee?.id || !from || !to) return monthTotals([]);
  const end = todayKey && to > todayKey ? todayKey : to;
  const byDate = rowsByDateKey((rows || []).filter((row) => {
    const id = row?.employee_id ?? row?.employeeId;
    return id == null || String(id) === String(employee.id);
  }));
  const days = eachDay(from, end).map((key) => myDutyDay({ employee, data, row: byDate[key], key, todayKey: todayKey || end, calendar }));
  return monthTotals(days.filter((d) => d.key <= (todayKey || end)));
}

/** For information beside «السلوك»: penalties signed in the period and abuse complaints proven against him. */
export function conductInfo({ employeeId, data, from, to } = {}) {
  const id = String(employeeId || "");
  const sanctions = (data?.disciplinaryCases || []).filter((row) => (
    String(row?.employeeId) === id
    && row?.signedAt
    && caseCountsAsPenalty(row)
    && inRange(day(row.signedAt), from, to)
  )).length;
  const complaints = (data?.abuseCases || []).filter((row) => (
    String(row?.accusedId) === id
    && row?.outcome?.id === "proven"
    && inRange(day(row.outcome.at), from, to)
  )).length;
  return { sanctions, complaints };
}

/** The report pre-filled from evidence — the same shape the server stores (perfReport.reportPrefill). */
export function annualReportPrefill({ employee, data, rows = [], from, to, todayKey, calendar } = {}) {
  const id = String(employee?.employeeId || employee?.id || "");
  const facts = deriveEmployeeTaskFacts({ tasks: data?.tasks || [], employeeId: id, stationId: employee?.stationId, period: { from, to } });
  const attendance = periodDutyTotals({ employee, data, rows, from, to, todayKey, calendar });
  return reportPrefill({ quality: facts.quality, attendance, conduct: conductInfo({ employeeId: id, data, from, to }) });
}
