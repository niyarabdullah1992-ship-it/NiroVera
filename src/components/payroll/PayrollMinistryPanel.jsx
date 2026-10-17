import React from "react";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/**
 * «أنظمة الوزارة — ما يخص الأجور / راتبي» — the shared frame on the wage run (manage) and on قسيمتي
 * (self). Payday and overdue come from payrollLaw exactly as «مواعيد الأجر وحمايته» reads them; the
 * self view leaves them to «حقوق راتبي».
 */
export default function PayrollMinistryPanel({ ar = true, data, month, items = [], employeeForItem, self = false }) {
  return (
    <MinistrySectionPanel
      sectionKey="payroll"
      lane={self ? "employee" : "manage"}
      ar={ar}
      today={todayIso()}
      inputs={{ data, month, items, employeeForItem }}
      id={self ? "nv-ministry-payslip" : "nv-ministry-payroll"}
    />
  );
}
