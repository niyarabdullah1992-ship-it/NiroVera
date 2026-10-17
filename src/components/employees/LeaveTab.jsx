import React from "react";
import { useI18n } from "@/lib/i18n";
import LeaveTotalsEditor from "@/components/employees/LeaveTotalsEditor";
import {
  hasPendingLeaveFilePointer,
  leaveOnFile,
  pendingLeavePointerCopy,
} from "@/lib/employeeFileView";

/** File leave tab: balances + approved/settled on file. Raise and decide live in طلباتي. */
export default function LeaveTab({ employee, companyId, isSelf, canApprove }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const requests = employee.leaveRequests || [];
  const filed = leaveOnFile(requests);
  const pending = hasPendingLeaveFilePointer(employee);

  // Balance and leave written on the file are shown once, above (EmployeeFileLeaveBoard); raising lives in طلباتي.
  // What stays here is the one file-only tool: the approver's balance editor.
  void t; void filed; void pending; void isSelf; void pendingLeavePointerCopy;
  if (!canApprove) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={ar ? "rtl" : "ltr"}>
      <LeaveTotalsEditor employee={employee} companyId={companyId} />
    </div>
  );
}
