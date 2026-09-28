
import React from "react";
import { AlertTriangle, BadgeCheck, ArrowLeftRight } from "lucide-react";
import { formatDateTime } from "@/lib/dateFormat";
import FlowSwipeAction from "@/components/flow/FlowSwipeAction";
import { ACCENT, MUTED, NAVY, CARD } from "@/lib/platformStyles";

const DAY_MS = 24 * 60 * 60 * 1000;

function isHazardIssue(issue) {
  return /open hazard|مخاطر مفتوحة/i.test(issue);
}

export default function SafetyApprovalControl({
  rec,
  canApprove,
  approvalIssues = [],
  openHazardCount = 0,
  lang,
  onApprove,
  onRevoke,
}) {
  const ar = lang === "ar";
  const L = (a, e) => (ar ? a : e);
  const hazardCount = openHazardCount || (rec?.hazards || []).length;
  const softIssues = approvalIssues.filter((issue) => !isHazardIssue(issue));
  const hardBlock = hazardCount > 0;

  if (rec?.approvedBy) {
    const approvedAt = new Date(rec.approvedAt).getTime();
    const canRevoke =
      canApprove && Number.isFinite(approvedAt) && Date.now() - approvedAt >= 0 && Date.now() - approvedAt <= DAY_MS;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 12px",
            borderRadius: 11,
            border: "1px solid var(--nv-ok-line)",
            background: "var(--nv-accent-soft)",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: CARD,
              color: ACCENT,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "1px solid var(--nv-ok-line)",
            }}
          >
            <BadgeCheck style={{ width: 15, height: 15 }} strokeWidth={1.75} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-ok-ink)" }}>{L("معتمد", "Approved")}</div>
            <div style={{ fontSize: 12, color: NAVY, marginTop: 2, lineHeight: 1.5 }}>
              {rec.approvedBy}
              {rec.approvedAt ? (
                <span style={{ display: "block", fontSize: 10, color: MUTED, marginTop: 2 }}>
                  {formatDateTime(rec.approvedAt, lang)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {canRevoke && (
          <FlowSwipeAction
            sensitive
            label={L("اسحب للتراجع عن الاعتماد", "Swipe to revoke approval")}
            onAction={onRevoke}
            confirmLabel={L("تأكيد التراجع", "Confirm revocation")}
            cancelLabel={L("إلغاء", "Cancel")}
          />
        )}
      </div>
    );
  }

  if (canApprove) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {hardBlock && (
          <div
            style={{
              borderRadius: 11,
              border: "1px solid var(--nv-line)",
              background: "var(--nv-bad-soft)",
              padding: "11px 12px",
            }}
          >
            <p
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--nv-bad-ink)",
              }}
            >
              <AlertTriangle style={{ width: 14, height: 14 }} strokeWidth={1.75} />
              {L("موقوف عن الاعتماد", "Approval blocked")}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.55, color: "var(--nv-bad-ink)" }}>
              {L(
                `${hazardCount} مخاطر مفتوحة — أغلقها من بطاقة العمل أولًا.`,
                `${hazardCount} open hazard${hazardCount === 1 ? "" : "s"} — close them in the work card first.`
              )}
            </p>
            <p
              style={{
                margin: "8px 0 0",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                fontWeight: 600,
                color: "var(--nv-bad-ink)",
                opacity: 0.85,
              }}
            >
              <ArrowLeftRight style={{ width: 12, height: 12 }} strokeWidth={1.75} />
              {L("العمل ← ثم الاعتماد", "Work → then approve")}
            </p>
          </div>
        )}

        {!hardBlock && softIssues.length > 0 && (
          <div
            style={{
              borderRadius: 11,
              border: "1px solid var(--nv-line)",
              background: "var(--nv-warn-soft)",
              padding: "11px 12px",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--nv-warn-ink)",
              }}
            >
              <AlertTriangle style={{ width: 14, height: 14 }} strokeWidth={1.75} />
              {L("تحذيرات قبل الاعتماد", "Warnings before approval")}
            </p>
            <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {softIssues.map((issue) => (
                <li key={issue} style={{ fontSize: 11, lineHeight: 1.5, color: "var(--nv-warn-ink)" }}>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hardBlock && (
          <FlowSwipeAction
            sensitive
            label={L("اسحب لاعتماد بيانات السلامة", "Swipe to approve safety data")}
            onAction={onApprove}
            confirmLabel={L("تأكيد المتابعة والاعتماد", "Confirm and approve")}
            cancelLabel={L("إلغاء", "Cancel")}
          />
        )}
      </div>
    );
  }

  return (
    <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.55 }}>
      {L("بانتظار اعتماد الإدارة", "Awaiting approval")}
    </p>
  );
}
