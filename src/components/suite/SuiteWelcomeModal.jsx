import React from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { markSuiteWelcomeSeen } from "@/lib/suiteApps";
import { ACCENT, BORDER, CARD, INK, MUTED, NAVY } from "@/lib/platformStyles";

/**
 * First-run welcome after company signup — points into the Proof Cycle.
 */
export default function SuiteWelcomeModal({ ar, companyId, companyName, onClose }) {
  const dismiss = () => {
    markSuiteWelcomeSeen(companyId);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(20,40,75,.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: CARD,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          padding: "28px 26px",
          position: "relative",
          boxShadow: "0 24px 60px rgba(20,40,75,.22)",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          style={{ position: "absolute", top: 14, insetInlineEnd: 14, border: "none", background: "transparent", color: MUTED, cursor: "pointer" }}
          aria-label={ar ? "إغلاق" : "Close"}
        >
          <X size={16} />
        </button>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.12em", fontWeight: 600, color: ACCENT }}>
          NIROVERA SUITE
        </p>
        <h2 style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 600, color: NAVY, letterSpacing: "-0.02em" }}>
          {ar ? "مساحتك جاهزة" : "Your space is ready"}
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.65, color: MUTED }}>
          {ar
            ? `${companyName || "شركتك"} — ابدأ من دورة الإثبات: حضور، ثم مهمة، ثم إثبات وتوقيع. باقي التطبيقات في المبدّل أدناه.`
            : `${companyName || "Your company"} — start with the Proof Cycle: attendance, then task, then proof and signing. Other apps are in the launcher below.`}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
          <Link
            to="/app/attendance"
            onClick={dismiss}
            style={{
              height: 42,
              borderRadius: 9,
              background: ACCENT,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            {ar ? "ابدأ من الحضور" : "Start with attendance"}
          </Link>
          <Link
            to="/app/tasks"
            onClick={dismiss}
            style={{
              height: 42,
              borderRadius: 9,
              background: CARD,
              color: INK,
              border: `1px solid ${BORDER}`,
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            {ar ? "افتح المهام" : "Open operations"}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            style={{
              height: 40,
              border: "none",
              background: "transparent",
              color: MUTED,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {ar ? "متابعة إلى لوحة القيادة" : "Continue to the dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
