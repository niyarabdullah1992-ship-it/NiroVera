import { base44 } from "@/api/base44Client";
import { getCompanyData } from "@/lib/store";
import { expensesCall } from "@/lib/expensesApi";
import { localInventoryCall } from "@/lib/localInventoryFallback";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";

function asList(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
}

async function loadAttendanceRange({ companyId, employees, dateFrom, dateTo, data }) {
  const localRows = listLocalRangeAttendance(companyId, dateFrom, dateTo, data);
  const team = employees.length ? employees : asList(data?.employees);
  const cloudChunks = await Promise.all(
    team.map((employee) =>
      base44.functions
        .invoke("supabaseAttendance", {
          action: "listRange",
          employeeId: employee.id,
          startDate: dateFrom,
          endDate: dateTo,
        })
        .then((res) =>
          asList(res?.data?.rows || res?.rows).map((row) => ({
            ...row,
            employeeId: row.employeeId || row.employee_id || employee.id,
            employeeName: row.employeeName || employee.name,
          })),
        )
        .catch(() => []),
    ),
  );
  return mergeAttendanceRangeRows(cloudChunks.flat(), localRows);
}

/** Live arrays the section pages already use — not just leftover store keys. */
export async function collectSectionReportData({
  companyId,
  session,
  data,
  employees = [],
  dateFrom,
  dateTo,
}) {
  const store = (companyId && getCompanyData(companyId)) || {};
  const merged = {
    ...store,
    ...data,
    stations: asList(data?.stations?.length ? data.stations : store.stations),
    employees: asList(data?.employees?.length ? data.employees : store.employees),
    tasks: asList(store.tasks?.length ? store.tasks : data?.tasks),
    safety: asList(store.safety?.length ? store.safety : data?.safety),
    reports: asList(store.reports?.length ? store.reports : data?.reports),
    payrollRuns: asList(store.payrollRuns?.length ? store.payrollRuns : data?.payrollRuns),
    personalAttendance: asList(store.personalAttendance?.length ? store.personalAttendance : data?.personalAttendance),
    disciplinaryCases: asList(store.disciplinaryCases?.length ? store.disciplinaryCases : data?.disciplinaryCases),
    schedules: asList(data?.schedules?.length ? data.schedules : store.schedules),
    attendanceSettings: data?.attendanceSettings || store.attendanceSettings || {},
  };

  try {
    merged.personalAttendance = await loadAttendanceRange({
      companyId,
      employees: employees.length ? employees : merged.employees,
      dateFrom,
      dateTo,
      data: merged,
    });
  } catch {
    merged.personalAttendance = listLocalRangeAttendance(companyId, dateFrom, dateTo, merged);
  }

  try {
    const exp = await expensesCall(session, "list");
    merged.expenseClaims = asList(exp?.claims);
  } catch {
    merged.expenseClaims = asList(store.expenseClaims || data?.expenseClaims || data?.expenses);
  }

  try {
    const inv = localInventoryCall(session, "list", { stations: merged.stations });
    merged.inventoryItems = asList(inv?.items);
    merged.stockMovements = asList(inv?.movements);
  } catch {
    merged.inventoryItems = asList(store.inventoryItems);
    merged.stockMovements = asList(store.stockMovements);
  }

  return merged;
}

export function safeReportFilename(name) {
  const cleaned = String(name || "report")
    .replace(/[^\w\u0600-\u06FF.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return cleaned || "report";
}
