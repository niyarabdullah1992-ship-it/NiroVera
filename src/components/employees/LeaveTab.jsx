import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { BORDER, MUTED, NAVY, CARD } from "@/lib/platformStyles";
import LeaveBalanceCard from "@/components/employees/LeaveBalanceCard";
import LeaveTotalsEditor from "@/components/employees/LeaveTotalsEditor";
import LeaveRequestItem from "@/components/employees/LeaveRequestItem";
import {
  hasPendingLeaveFilePointer,
  leaveOnFile,
  pendingLeavePointerCopy,
} from "@/lib/employeeFileView";
import { requestReplyHref } from "@/lib/requestWorkspace";

/** File leave tab: balances + approved/settled on file. Raise and decide live in طلباتي. */
export default function LeaveTab({ employee, companyId, isSelf, canApprove }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const requests = employee.leaveRequests || [];
  const filed = leaveOnFile(requests);
  const pending = hasPendingLeaveFilePointer(employee);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={ar ? "rtl" : "ltr"}>
      <LeaveBalanceCard profile={employee.profile} requests={requests} />

      {(isSelf || canApprove || filed.length > 0 || pending) && (
        <details
          open={isSelf ? true : undefined}
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: "16px",
            padding: "14px 18px",
          }}
        >
          <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: NAVY, listStyle: "none" }}>
            {ar ? "الرصيد والإجازات المثبتة" : "Balance and leave on the file"}
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
            {canApprove && <LeaveTotalsEditor employee={employee} companyId={companyId} />}

            {(isSelf || canApprove) && (
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                padding: "12px 14px",
                border: `1px solid ${BORDER}`,
                background: CARD,
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
                    {ar ? "تقديم إجازة جديدة" : "Raise new leave"}
                  </span>
                  <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                    {ar
                      ? "الطلب يُرفع من طلباتي — الإقرار والمستند إن لزم يُعبَّآن هناك. الملف يعرض الرصيد والسجل المعتمد فقط."
                      : "Leave is raised in My Requests — acknowledgement and any required paper are completed there. This file shows balance and approved history only."}
                  </span>
                </div>
                <Link
                  to="/app/requests/leave"
                  style={{ fontSize: 12, fontWeight: 700, color: "#137a49", textDecoration: "none", whiteSpace: "nowrap", alignSelf: "center" }}
                >
                  {ar ? "قدّم من طلباتي" : "Raise from My Requests"}
                </Link>
              </div>
            )}

            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "10px" }}>
                {ar ? "المعتمد / المستقر على الملف" : "Approved / settled on the file"}
              </div>
              {pending && (
                <Link
                  to={requestReplyHref({ manage: !!canApprove })}
                  style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8A6516", lineHeight: 1.8, marginBottom: filed.length ? 10 : 8, textDecoration: "none" }}
                >
                  {pendingLeavePointerCopy(ar)}
                </Link>
              )}
              {filed.length === 0 ? (
                <div style={{ fontSize: "13px", color: MUTED }}>{t("noLeaveRequests")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filed.map((r) => (
                    <LeaveRequestItem key={r.id} request={r} profile={employee.profile} mine={!!isSelf} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
