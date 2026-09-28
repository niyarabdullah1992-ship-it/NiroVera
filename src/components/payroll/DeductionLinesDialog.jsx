import React from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import DeductionLineForm from "@/components/payroll/DeductionLineForm";
import DeductionDisputeForm from "@/components/payroll/DeductionDisputeForm";
import { deductionLines, deductionsTotal, sourceLabel } from "@/lib/payrollDeductions";
import { article90MaxDeduction, checkArticle90Gate } from "@/lib/payrollDerivations";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { formatDate } from "@/lib/dateFormat";
import { MUTED, NAVY, BORDER, SURFACE, DANGER, dialogOverlay, dialogCard, ui, CARD } from "@/lib/platformStyles";

// The deduction breakdown: every line carries its source, reason, author and dispute state.
export default function DeductionLinesDialog({ open, onOpenChange, item, employeeName, ar, canEdit, onAdd, onRemove, onResolve, currentUserId, onDispute }) {
  if (!item || !open) return null;
  const lines = deductionLines(item);
  const total = deductionsTotal(item);
  const a90 = checkArticle90Gate({ ...item, deductions: total });

  return (
    <div
      style={dialogOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange?.(false);
      }}
    >
      <div style={{ ...dialogCard, maxWidth: "540px" }} dir={ar ? "rtl" : "ltr"} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: NAVY }}>
            {ar ? "بنود الخصم" : "Deduction lines"} — {employeeName}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            aria-label={ar ? "إغلاق" : "Close"}
            style={{ ...ui.btnGhost, padding: "6px", color: MUTED }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
          {lines.length === 0 ? (
            <p style={{ margin: 0, padding: "28px 0", textAlign: "center", fontSize: "13px", color: MUTED }}>
              {ar ? "لا توجد بنود خصم لهذا الشهر." : "No deduction lines this month."}
            </p>
          ) : lines.map((line) => (
            <div key={line.id} style={{ borderRadius: "11px", border: `1px solid ${BORDER}`, background: CARD, padding: "12px 13px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: NAVY }}>
                    <span dir="ltr">{Number(line.amount).toLocaleString()} {item.currency}</span>
                    <span style={{ marginInlineStart: "8px", fontSize: "11px", fontWeight: 500, color: MUTED }}>{sourceLabel(line.source, ar)}</span>
                  </p>
                  {line.reason && <p style={{ margin: "6px 0 0", fontSize: "12px", color: MUTED }}>{line.reason}</p>}
                  {line.sourceRefId && <p style={{ margin: "2px 0 0", fontSize: "11px", color: MUTED }} dir="ltr">ref: {line.sourceRefId}</p>}
                  <p style={{ margin: "6px 0 0", fontSize: "11px", color: MUTED }}>
                    {line.createdByName || line.createdBy} · {formatDate(line.createdAt, ar ? "ar" : "en")}
                  </p>
                  {line.disputeStatus === "open" && (
                    <p style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: DANGER }}>
                      <AlertTriangle style={{ width: 12, height: 12 }} /> {ar ? "اعتراض مفتوح" : "Dispute open"}
                      {line.disputeNote && <span style={{ color: MUTED }}>— {line.disputeNote}</span>}
                    </p>
                  )}
                  {line.disputeStatus === "accepted" && (
                    <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--nv-ok-ink)" }}>
                      {ar ? "اعتراض مقبول — أُلغي الخصم" : "Dispute accepted — deduction cancelled"}
                      {line.originalAmount > 0 && (
                        <span style={{ color: MUTED }}>
                          {" "}({ar ? "كان" : "was"} <span dir="ltr">{Number(line.originalAmount).toLocaleString()} {item.currency}</span>)
                        </span>
                      )}
                    </p>
                  )}
                  {line.disputeStatus === "rejected" && (
                    <p style={{ margin: "6px 0 0", fontSize: "11px", color: MUTED }}>{ar ? "اعتراض مرفوض" : "Dispute rejected"}</p>
                  )}
                  {line.disputeNote && line.disputeStatus !== "open" && line.disputeStatus !== "none" && (
                    // The objection is the employee's side of the record; settling it
                    // must not wipe what they said from the screen.
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: MUTED }}>
                      {ar ? "نص الاعتراض" : "Objection"}: {line.disputeNote}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemove(line.id)}
                    title={ar ? "حذف البند" : "Remove line"}
                    style={{ ...ui.btnGhost, padding: "8px", color: MUTED }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
              {canEdit && line.disputeStatus === "open" && (
                <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => onResolve(line.id, "accepted")} style={ui.btnSecondary}>
                    {ar ? "قبول الاعتراض وإلغاء الخصم" : "Accept & cancel deduction"}
                  </button>
                  <button type="button" onClick={() => onResolve(line.id, "rejected")} style={ui.btnGhost}>
                    {ar ? "رفض الاعتراض" : "Reject dispute"}
                  </button>
                </div>
              )}
              {onDispute && item.employeeId === currentUserId && !item.paid && line.disputeStatus === "none" && Number(line.amount) > 0 && (
                <DeductionDisputeForm ar={ar} onSubmit={(note) => onDispute(line.id, note)} />
              )}
            </div>
          ))}
        </div>

        <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: NAVY }}>
          {ar ? "إجمالي الخصم" : "Total deduction"}: <span dir="ltr">{total.toLocaleString()} {item.currency}</span>
          <span style={{ display: "flex", marginTop: "4px", fontSize: "11px", fontWeight: 500, color: a90.ok ? MUTED : DANGER, alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            {ar
              ? `سقف الخصم ${article90MaxDeduction(item).toLocaleString()} ${item.currency}`
              : `Deduction cap ${article90MaxDeduction(item).toLocaleString()} ${item.currency}`}
            <LaborArticleCite ruleId="payroll.deduction.capRatio" ar={ar} showText />
            {!a90.ok && (ar ? " — تجاوز الحد." : " — over cap.")}
          </span>
        </p>

        {canEdit && !item.paid && <DeductionLineForm ar={ar} item={item} onAdd={onAdd} />}
        {item.paid && (
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: MUTED, background: SURFACE, borderRadius: "9px", padding: "10px 12px", border: `1px solid ${BORDER}` }}>
            {ar ? "الراتب مدفوع — البنود مغلقة للتعديل." : "Salary is paid — lines are locked."}
          </p>
        )}
      </div>
    </div>
  );
}
