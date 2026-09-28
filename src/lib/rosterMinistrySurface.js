/** Published-week ministry surface — the same week-publish gates, not a second rule set. */

import { citeRule } from "./laborRules.js";
import { deriveMinistryAlerts } from "./ministryAlertDerivations.js";
import { checkWeekPublishGates, weekMinistrySurfaceChecks, weekStartDate } from "./shiftWeek.js";

function citeOf(alert, ar) {
  const cite = alert?.ruleId ? citeRule(alert.ruleId) : null;
  if (cite) return ar ? cite.labelAr : cite.labelEn;
  if (alert?.gate === "HEAT_BAN") return ar ? "قرار 3337" : "Decision 3337";
  return "—";
}

/**
 * Hours, official holidays, open article constraints, and publish compliance
 * for one week gate pack. Empty figures stay «—».
 */
export function publishedWeekMinistryFacts(gates, { ar = true, viewerName = "", viewerHours } = {}) {
  const checks = weekMinistrySurfaceChecks(gates?.checks || []);
  const hoursCheck = checks.find((row) => row.id === "hours_48");
  const holidayCount = Number(gates?.officialHolidayLeaveDays) || 0;
  const names = Array.isArray(gates?.holidayLeaveNames) ? gates.holidayLeaveNames.filter(Boolean) : [];
  const open = checks.filter((row) => row && row.ok === false && (row.block || row.id === "heat_ban" || row.id === "heat_place" || row.id === "eid_rest_compensate"));
  const who = String(viewerName || "").trim();
  const scoped = who
    ? open.filter((row) => String(row.note || "").includes(who) || String(row.title || "").includes(who))
    : open;
  const ownHours = Number.isFinite(Number(viewerHours)) ? Math.round(Number(viewerHours)) : null;
  const weekHours = gates && Number.isFinite(Number(gates.totalHours)) ? Math.round(Number(gates.totalHours)) : null;
  const hours = ownHours != null ? String(ownHours) : (weekHours != null ? String(weekHours) : "—");
  const blocked = scoped.some((row) => row.block);
  return {
    hours,
    hoursNote: who
      ? (ar ? "ساعاتك المجدولة هذا الأسبوع" : "Your scheduled hours this week")
      : (hoursCheck?.title || (ar ? "ساعات الأسبوع" : "Week hours")),
    hoursTone: hoursCheck && !hoursCheck.ok && (!who || String(hoursCheck.note || "").includes(who)) ? "bad" : "ok",
    holidays: holidayCount ? String(holidayCount) : "—",
    holidayNote: holidayCount
      ? (ar
        ? `${names.join(" · ") || "إجازة رسمية"} · المادة 112 · مقفلة`
        : `${names.join(" · ") || "Official holiday"} · Art. 112 · locked`)
      : (ar ? "لا إجازة اليوم الوطني أو يوم التأسيس أو العيد هذا الأسبوع" : "No National Day, Founding Day, or Eid leave this week"),
    constraints: scoped.map((row) => ({
      id: row.id,
      cite: (ar ? row.article : row.articleEn) || "—",
      title: row.title || "—",
      note: row.note || "—",
      tone: row.block ? "bad" : "warn",
    })),
    compliance: !gates ? "—" : (blocked ? (ar ? "موقوف" : "Blocked") : (ar ? "بلا مانع" : "Clear")),
    complianceNote: !gates
      ? (ar ? "لا جدول يُفحص" : "No roster to check")
      : (scoped.length
        ? (ar ? `${scoped.length} قيد من فحص هذا الأسبوع` : `${scoped.length} constraint(s) on this week`)
        : (ar ? "قيود المادة على هذا الأسبوع بلا مانع" : "No open article constraint this week")),
    complianceTone: !gates ? "idle" : (blocked ? "bad" : "ok"),
  };
}

export function stationWeekMinistryFacts({
  data,
  station,
  employees = [],
  weekStart,
  ar = true,
  laborCalendar,
  today,
  viewerName = "",
  viewerHours,
} = {}) {
  if (!station?.id) return publishedWeekMinistryFacts(null, { ar, viewerName, viewerHours });
  const schedule = (data?.schedules || []).find((row) => String(row.stationId) === String(station.id))
    || { stationId: station.id, shiftTypes: [], assignments: {} };
  const gates = checkWeekPublishGates({
    schedule,
    employees,
    weekStart: weekStart || weekStartDate(today || new Date()),
    stationId: station.id,
    station,
    settings: data?.settings,
    company: data,
    ar,
    laborCalendar,
    today: today || new Date(),
  });
  return publishedWeekMinistryFacts(gates, { ar, viewerName, viewerHours });
}

/** One inspection pass: week gates per station, then the existing ministry alert pack. */
export function scanMinistryCompliance({
  data,
  stations = [],
  employees = [],
  weekStart,
  ar = true,
  laborCalendar,
  today,
} = {}) {
  const findings = [];
  const start = weekStart || weekStartDate(today || new Date());
  for (const station of stations) {
    if (!station?.id) continue;
    const facts = stationWeekMinistryFacts({
      data,
      station,
      employees,
      weekStart: start,
      ar,
      laborCalendar,
      today,
    });
    for (const row of facts.constraints) {
      findings.push({
        id: `${station.id}:${row.id}`,
        tone: row.tone,
        title: row.title,
        cite: row.cite,
        detail: `${station.name || "—"} — ${row.note}`,
        to: "/app/shifts?lane=manage",
        actionAr: "افتح الجدول",
        actionEn: "Open the roster",
      });
    }
  }
  const clock = typeof today === "string" ? new Date(`${String(today).slice(0, 10)}T12:00:00+03:00`) : (today || new Date());
  const ministry = deriveMinistryAlerts(data || {}, { now: clock, today: typeof today === "string" ? String(today).slice(0, 10) : undefined });
  for (const alert of ministry.alerts || []) {
    findings.push({
      id: alert.id,
      tone: alert.level === "critical" ? "bad" : "warn",
      title: ar ? alert.textAr : alert.textEn,
      cite: citeOf(alert, ar),
      detail: Number.isFinite(Number(alert.count))
        ? (ar ? `${alert.count} في السجل` : `${alert.count} on the register`)
        : "—",
      to: alert.to || "/app/hr?tab=compliance",
      actionAr: alert.actionAr || "افتح",
      actionEn: alert.actionEn || "Open",
    });
  }
  return {
    findings,
    stations: stations.filter((row) => row?.id).length,
    blocked: findings.filter((row) => row.tone === "bad").length,
    notes: findings.filter((row) => row.tone !== "bad").length,
  };
}
