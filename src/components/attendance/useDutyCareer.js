import { useMemo } from "react";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { listLocalRangeAttendance } from "@/lib/localAttendanceFallback";
import { contractYearAnchor, dutyRecordStart, dutyYears, eachDayKey } from "@/lib/dutyYears";
import { myDutyDay, rowsByDateKey, useMyAttendanceRange } from "@/components/attendance/myDutyDays";

function rowEmployeeId(row) {
  const id = row?.employee_id ?? row?.employeeId;
  return id == null ? "" : String(id);
}

/**
 * One person's whole duty record since the contract start — every day derived exactly as سجلي
 * derives it (myDutyDay over the same attendance rows, leave and roster), from the first day the
 * platform holds a duty record. Years are bucketed by dutyYears (contract or calendar).
 */
export default function useDutyCareer({ employee, data, company, ar = true }) {
  const todayKey = toRiyadhDateKey();
  const person = useMemo(() => (employee ? hydrateEmployeesLeave([employee], data)[0] || employee : null), [employee, data]);
  const calendar = useMemo(() => laborCalendarOf(data), [data]);
  const ownLocal = useMemo(() => {
    if (!person?.id) return [];
    return listLocalRangeAttendance(company?.id, "1900-01-01", todayKey, data).filter((row) => rowEmployeeId(row) === String(person.id));
  }, [company?.id, data, person?.id, todayKey]);
  const coverage = useMemo(
    () => dutyRecordStart({ schedules: data?.schedules || [], rows: ownLocal, employee: person }),
    [data?.schedules, ownLocal, person],
  );
  const anchor = useMemo(() => contractYearAnchor(person, coverage), [person, coverage]);
  const from = [anchor.key, coverage].filter(Boolean).sort().pop() || todayKey;
  const startDate = from > todayKey ? todayKey : from;
  const { rows, loading } = useMyAttendanceRange({ employee: person, company, data, startDate, endDate: todayKey });
  const byDate = useMemo(() => rowsByDateKey(rows), [rows]);
  const days = useMemo(() => {
    if (!person?.id) return [];
    return eachDayKey(startDate, todayKey).map((key) => myDutyDay({ employee: person, data, row: byDate[key], key, todayKey, calendar, ar }));
  }, [person, data, byDate, startDate, todayKey, calendar, ar]);
  const contract = useMemo(() => dutyYears({ days, anchorKey: anchor.key, todayKey, mode: "contract", coverageStart: coverage }), [days, anchor.key, todayKey, coverage]);
  const calendarYears = useMemo(() => dutyYears({ days, anchorKey: anchor.key, todayKey, mode: "calendar", coverageStart: coverage }), [days, anchor.key, todayKey, coverage]);
  return {
    person,
    todayKey,
    anchor,
    coverage,
    days,
    loading,
    years: (mode) => (mode === "calendar" ? calendarYears : contract),
  };
}
