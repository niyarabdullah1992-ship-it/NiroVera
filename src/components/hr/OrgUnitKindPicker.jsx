import React from "react";
import { hintText, labelText, segmentBtn } from "@/lib/orgModalStyles";
import { normalizeUnitKind } from "@/lib/stationTree";

export default function OrgUnitKindPicker({ value, onChange, ar, compact = false }) {
  const kind = normalizeUnitKind(value);
  return (
    <div>
      {!compact ? (
        <span style={labelText}>{ar ? "هذه العقدة" : "This node"}</span>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, padding: 3, borderRadius: 8, background: "var(--nv-hover)" }}>
        <button type="button" onClick={() => onChange("branch")} style={segmentBtn(kind === "branch")}>
          {ar ? "فرع" : "Branch"}
        </button>
        <button type="button" onClick={() => onChange("manager")} style={segmentBtn(kind === "manager")}>
          {ar ? "إدارة" : "Admin"}
        </button>
      </div>
      {!compact ? (
        <p style={hintText}>
          {kind === "manager"
            ? (ar
              ? "إدارة: مقعد في الشجرة تتبعه فروع — ليس مكان توظيف أو حضور."
              : "Admin seat: on the tree with child branches — not a hire or attendance workplace.")
            : (ar
              ? "فرع عمل: يظهر في نطاق الرأس والحضور ويمكن التوظيف عليه."
              : "Workplace branch: appears in header scope and attendance; you can hire on it.")}
        </p>
      ) : null}
    </div>
  );
}
