import React from "react";
import { NAVY, BORDER, ACCENT, CARD } from "@/lib/platformStyles";

export default function OwnerPayrollToggle({ checked, onChange, ar }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      borderRadius: "14px",
      border: `1px solid ${BORDER}`,
      background: CARD,
      padding: "14px 16px",
    }}>
      <div>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: NAVY }}>
          {ar ? "إدراج المالك في مسير الرواتب" : "Include owner in payroll"}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ar ? "إدراج المالك في الرواتب" : "Include owner in payroll"}
        onClick={() => onChange?.(!checked)}
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "999px",
          border: "none",
          background: checked ? ACCENT : "#CBD5E1",
          position: "relative",
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <span style={{
          position: "absolute",
          top: "3px",
          insetInlineStart: checked ? "23px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "999px",
          background: CARD,
          transition: "inset-inline-start .15s",
          boxShadow: "0 1px 2px rgba(20,40,75,.2)",
        }} />
      </button>
    </div>
  );
}
