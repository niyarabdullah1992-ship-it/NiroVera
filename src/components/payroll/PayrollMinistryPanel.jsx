import React, { useMemo } from "react";
import MinistryLawPanel from "@/components/schedules/MinistryLawPanel";
import { isWeeklyRestDay } from "@/lib/laborHoursPolicy";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { companyPayday, wageOverdue } from "@/lib/payrollLaw";
import { PAYROLL_MINISTRY_CARDS, payrollMinistryRows } from "@/lib/payrollMinistryRows";
import { stationWithSite } from "@/lib/siteRemoteness";
import { preventedDaysInMonth } from "@/lib/modelRequests";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/**
 * «أنظمة الوزارة — ما يخص الأجر» — the ministry frame on قسيمتي (self) and on the wage run (manage).
 * Payday and overdue come from payrollLaw exactly as «مواعيد الأجر وحمايته» reads them; the self view
 * omits them (and the deduction cap) because «حقوق راتبي» above already shows them.
 */
export default function PayrollMinistryPanel({ ar = true, data, month, items = [], employeeForItem, self = false }) {
  const today = todayIso();
  const calendar = useMemo(() => laborCalendarOf(data), [data]);
  const rows = useMemo(() => {
    const isOff = (day) => isWeeklyRestDay(day, data) || isOfficialHoliday(day, calendar);
    const pay = self ? null : companyPayday(data?.settings, month, isOff);
    const overdue = self ? null : wageOverdue({ settings: data?.settings, month, items, today, isOff, employeeOf: employeeForItem });
    const personOf = (line) => (typeof employeeForItem === "function" ? employeeForItem(line) : null)
      || (data?.employees || []).find((row) => String(row.id) === String(line?.employeeId)) || null;
    const siteOf = (line) => {
      const person = personOf(line);
      return person ? stationWithSite(data, person.stationId) : null;
    };
    const preventedOf = (line) => preventedDaysInMonth(personOf(line), month).size;
    return payrollMinistryRows({ lines: items, self, pay, overdue, ar, onDate: today, siteOf, preventedOf });
  }, [data, calendar, month, items, employeeForItem, self, ar, today]);
  return (
    <MinistryLawPanel
      ar={ar}
      dataKey={self ? "payslip" : "payroll"}
      title={self ? (ar ? "أنظمة الوزارة — ما يخص راتبي" : "Ministry rules — my pay") : (ar ? "أنظمة الوزارة — ما يخص الأجور" : "Ministry rules — wages")}
      cards={PAYROLL_MINISTRY_CARDS(ar)}
      rows={rows}
      footer={self ? (ar ? "موعد راتبك وحد الخصم منه في «حقوق راتبي» أعلاه." : "Your payday and the deduction cap are in «My pay rights» above.") : null}
    />
  );
}
