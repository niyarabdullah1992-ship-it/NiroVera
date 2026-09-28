import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { CommentAttachments } from "@/components/tasks/CommentFiles";
import { formatDateTime } from "@/lib/dateFormat";
import { ACCENT, BORDER, MUTED, NAVY, SURFACE, BAD } from "@/lib/platformStyles";

export default function EscalationSteps({ steps, t, lang }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "10px", borderTop: `1px solid ${BORDER}` }}>
      <p style={{ margin: 0, fontSize: "10px", letterSpacing: "0.06em", color: MUTED, fontWeight: 600 }}>{t("escalationChain")}</p>
      {steps.map((s) => (
        <div key={s.idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", opacity: s.state === "done" ? 0.55 : 1 }}>
          <div style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: s.reply ? ACCENT : s.state === "current" ? "var(--nv-warn-soft)" : SURFACE,
            color: s.reply ? "#fff" : s.state === "current" ? "var(--nv-warn-ink)" : MUTED,
            border: s.state === "current" && !s.reply ? "1px solid var(--nv-line)" : `1px solid ${BORDER}`,
          }}
          >
            {s.reply ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : <span style={{ fontSize: "9px" }}>{s.idx + 1}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, color: s.state === "current" ? NAVY : MUTED, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
              {s.label}
              {s.state === "current" && !s.reply ? <span style={{ fontWeight: 400, color: "var(--nv-warn-ink)" }}>— {t("waitingReply")}</span> : null}
              {!s.hasHandler && s.state !== "done" ? (
                <span title={t("noHandlerAssigned")} style={{ ...BAD, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <AlertTriangle style={{ width: 10, height: 10 }} /> {t("noHandlerAssigned")}
                </span>
              ) : null}
            </p>
            {s.reply && (
              <div style={{ marginTop: "4px", padding: "8px 10px", borderRadius: "8px", background: SURFACE }}>
                <p style={{ margin: 0, fontSize: "10px", color: MUTED }}>{s.reply.authorName} · {formatDateTime(s.reply.createdAt, lang)}</p>
                <p style={{ margin: "4px 0 0", color: NAVY }}>{s.reply.text}</p>
                <CommentAttachments files={s.reply.files} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
