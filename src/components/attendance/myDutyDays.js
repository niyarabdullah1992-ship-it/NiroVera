import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";
import { isLocalPreviewActive } from "@/lib/localPreview";

// The day derivation itself is pure and shared: src/lib/dutyDay.js.
export { dutyPersonState, isoDay, monthTotals, myDutyDay, rowsByDateKey } from "@/lib/dutyDay";

/**
 * The viewer's own attendance rows for a date range — the same source كشفي read
 * (server range merged over the local register; local only in preview).
 */
export function useMyAttendanceRange({ employee, company, data, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!employee?.id || !startDate || !endDate) return undefined;
    let active = true;
    const local = listLocalRangeAttendance(company?.id, startDate, endDate, data);
    if (isLocalPreviewActive() || !company?.id) {
      setRows(local);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    base44.functions
      .invoke("supabaseAttendance", { action: "listRange", employeeId: employee.id, startDate, endDate })
      .then((res) => { if (active) setRows(mergeAttendanceRangeRows(res?.data?.rows || [], local)); })
      .catch(() => { if (active) setRows(local); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employee?.id, company?.id, startDate, endDate, data]);
  const mine = rows.filter((row) => {
    const id = row?.employee_id ?? row?.employeeId;
    return id == null || String(id) === String(employee?.id);
  });
  return { rows: mine, loading };
}

