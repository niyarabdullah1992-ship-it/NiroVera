import React, { useMemo } from "react";
import OtDecisionBoard from "@/components/schedules/OtDecisionBoard";
import { isOtDecisionOpen } from "@/lib/attendanceDerivations";
import { weekKeyFromDate } from "@/lib/shiftWeek";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { plannedOtWeeks } from "@/lib/otDecisionPlan";
import { toRiyadhDateKey } from "@/lib/riyadhDate";

/**
 * Art. 107 — where overtime decisions actually get made. One OtDecisionBoard per (week, station)
 * that has an open decision (pending pay/comp-leave, or a Regs Art. 22 cap-consent request).
 *  - manage: every week with an open entry, for the people this manager sees.
 *  - mine: only weeks with an open entry for the viewer — so a worker answers his cap-consent request
 *    and sees the overtime that waits for a decision. Nothing open → nothing rendered.
 *  - both: the current and next week's PLANNED overtime from the published roster (plannedOtWeeks) also
 *    shows — labelled «مخطط — لم يُعمل بعد», not payable until the punches prove it (Art. 107).
 */
export default function OtDecisionsPanel({ data, companyId: companyIdProp, currentUser, employees = [], mode = "manage", canEdit = false, ar = true, onSaved }) {
  const companyId = companyIdProp || data?.id || data?.companyId || "";
  const laborCalendar = useMemo(() => laborCalendarOf(data), [data]);
  const otDecisions = data?.otDecisions || {};
  const today = toRiyadhDateKey();
  const groups = useMemo(() => {
    const ids = new Set((employees || []).map((employee) => String(employee?.id || "")).filter(Boolean));
    const weeks = new Map();
    const openWeeks = new Set();
    const plannedRows = new Map();
    const add = (weekKey, employee, rosterStationId) => {
      if (!weeks.has(weekKey)) weeks.set(weekKey, new Map());
      const stationId = String(rosterStationId || employee?.profile?.workStationId || employee?.stationId || data?.stations?.[0]?.id || "");
      const byStation = weeks.get(weekKey);
      if (!byStation.has(stationId)) byStation.set(stationId, []);
      const list = byStation.get(stationId);
      if (!list.some((row) => row.id === employee.id)) list.push(employee);
    };
    for (const [key, entry] of Object.entries(otDecisions)) {
      if (!isOtDecisionOpen(entry) || !entry) continue;
      const cut = key.lastIndexOf(":");
      const employeeId = key.slice(0, cut);
      const day = key.slice(cut + 1);
      if (!ids.has(employeeId) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const employee = employees.find((row) => String(row.id) === employeeId);
      add(weekKeyFromDate(day), employee);
      openWeeks.add(weekKeyFromDate(day));
    }
    // Planned roster overtime for the current and next week — shown before it is punched, never payable yet.
    for (const planned of plannedOtWeeks(data, employees, { today })) {
      if (!ids.has(planned.employeeId)) continue;
      const employee = employees.find((row) => String(row.id) === planned.employeeId);
      add(planned.weekKey, employee, planned.stationId);
      plannedRows.set(planned.weekKey, [...(plannedRows.get(planned.weekKey) || []), ...planned.rows]);
    }
    return [...weeks.entries()]
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .flatMap(([weekKey, byStation]) => [...byStation.entries()].map(([stationId, list]) => ({
        key: `${weekKey}:${stationId}`,
        weekKey,
        schedule: (data?.schedules || []).find((row) => String(row.stationId) === stationId) || null,
        employees: list,
        // Nothing to answer yet — only roster overtime that is planned, not worked.
        plannedOnly: !openWeeks.has(weekKey),
        planned: plannedRows.get(weekKey) || [],
      })));
  }, [employees, otDecisions, data, mode, today]);

  // طلباتي shows only overtime waiting for an answer; planned roster overtime lives in جدولي.
  if (!groups.some((group) => !(mode === "mine" && group.plannedOnly))) return null;
  return (
    <div data-ot-decisions={mode} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
      {groups.filter((group) => !(mode === "mine" && group.plannedOnly)).map((group) => (
        <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--nv-muted, #6B7280)" }}>
            {ar ? `أسبوع ${group.weekKey}` : `Week of ${group.weekKey}`}
          </span>
          <OtDecisionBoard
            schedule={group.schedule}
            employees={group.employees}
            weekStart={group.weekKey}
            company={data}
            companyId={companyId}
            laborCalendar={laborCalendar}
            otDecisions={otDecisions}
            currentUser={currentUser}
            canEdit={canEdit}
            mode={mode}
            ar={ar}
            onSaved={onSaved}
            today={today}
          />
        </div>
      ))}
    </div>
  );
}
