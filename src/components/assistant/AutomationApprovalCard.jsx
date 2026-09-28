import React from "react";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import IdentityCard from "@/components/shared/IdentityCard";
import { BORDER, MUTED, NAVY, ui, CARD } from "@/lib/platformStyles";

const labels = {
  create_task: ["إنشاء مهمة", "Create task"], log_progress: ["تحديث تقدم مهمة", "Update task progress"],
  report_task_issue: ["تسجيل مشكلة مهمة", "Report task issue"], log_safety_incident: ["تسجيل حادث سلامة", "Log safety incident"],
  create_inventory_item: ["تسجيل صنف مخزون", "Create inventory item"], request_inventory: ["طلب مواد", "Request inventory"],
  issue_inventory: ["صرف مخزون", "Issue inventory"], review_inventory_request: ["مراجعة طلب مواد", "Review material request"],
  review_expense: ["مراجعة مصروف", "Review expense"], submit_leave: ["إرسال طلب إجازة", "Submit leave request"],
  review_leave: ["مراجعة طلب إجازة", "Review leave request"], send_email: ["إرسال بريد", "Send email"],
};

export default function AutomationApprovalCard({ actions, loading, ar, onApprove, onReject }) {
  if (!actions?.length) return null;
  return (
    <IdentityCard
      icon={ShieldCheck}
      kicker={ar ? "موافقة" : "Approval"}
      title={ar ? "بانتظار موافقتك" : "Waiting for your approval"}
      subtitle={ar ? "لن ينفذ نيرو أي إجراء قبل موافقتك." : "Niro will not execute anything before you approve."}
      dir={ar ? "rtl" : "ltr"}
      bodySurface
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {actions.map((action, index) => (
          <div key={`${action.type}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, fontSize: 13, color: NAVY }}>
            <CheckCircle2 style={{ width: 16, height: 16, color: "var(--nv-ok-ink)", flexShrink: 0 }} />
            <span>{labels[action.type]?.[ar ? 0 : 1] || action.title || action.type}</span>
            {(action.title || action.station) ? <span style={{ color: MUTED, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>— {action.title || action.station}</span> : null}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" onClick={onReject} disabled={loading} style={ui.btnSecondary}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <X style={{ width: 14, height: 14 }} />{ar ? "رفض" : "Reject"}
          </span>
        </button>
        <button type="button" onClick={onApprove} disabled={loading} style={ui.btnPrimary}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <ShieldCheck style={{ width: 14, height: 14 }} />}
            {ar ? "موافقة وتنفيذ" : "Approve & execute"}
          </span>
        </button>
      </div>
    </IdentityCard>
  );
}
