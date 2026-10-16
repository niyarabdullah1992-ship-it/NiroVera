import React, { useMemo } from "react";
import MinistryLawPanel from "@/components/schedules/MinistryLawPanel";
import { PAYROLL_MINISTRY_CARDS, payrollPanelRows } from "@/lib/payrollMinistryRows";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/**
 * «أنظمة الوزارة — ما يخص الأجر» — the ministry frame on قسيمتي (self) and on the wage run (manage).
 * Payday and overdue come from payrollLaw exactly as «مواعيد الأجر وحمايته» reads them; the self view
 * omits them (and the deduction cap) because «حقوق راتبي» above already shows them.
 */
export default function PayrollMinistryPanel({ ar = true, data, month, items = [], employeeForItem, self = false }) {
  const today = todayIso();
  const rows = useMemo(
    () => payrollPanelRows({ data, month, items, employeeForItem, self, today, ar }),
    [data, month, items, employeeForItem, self, ar, today],
  );
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
