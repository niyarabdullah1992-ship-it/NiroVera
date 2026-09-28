import React, { useMemo } from "react";
import { ClipboardCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { profileCompletionStats as computeProfileCompletion } from "@/lib/employeeProfileFields";
import { CARD, INK, MUTED } from "@/lib/platformStyles";

/** Required MHRSD file fields — drives the “complete your file” path. */
export function profileCompletionStats(employee) {
  return computeProfileCompletion(employee);
}

export default function ProfileCompletionCard({ employee, isSelf, ar, onContinue }) {
  const { missing, filled, fields, pct, done } = useMemo(
    () => profileCompletionStats(employee),
    [employee],
  );
  const next = missing.slice(0, 3);
  const Chevron = ar ? ChevronLeft : ChevronRight;

  return (
    <div
      style={{
        borderRadius: "16px",
        border: `1px solid ${done ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
        background: done ? "var(--nv-accent-soft)" : CARD,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: done ? "var(--nv-accent-soft)" : "var(--nv-accent-soft)",
            color: "var(--nv-ok-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ClipboardCheck style={{ width: 16, height: 16 }} strokeWidth={1.75} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
            {ar ? "اكتمال ملف الموظف" : "Employee file completeness"}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            {filled}/{fields.length} {ar ? "حقلًا مطلوبًا" : "required fields"}
          </div>
        </div>
        <span
          dir="ltr"
          style={{ fontSize: 18, fontWeight: 600, color: done ? "var(--nv-ok-ink)" : "var(--nv-ok-ink)" }}
        >
          {pct}%
        </span>
      </div>

      <div style={{ height: 8, borderRadius: 99, background: "var(--nv-soft)", overflow: "hidden", marginTop: 12 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 99,
            background: done ? "#22C55E" : "var(--nv-btn-fill)",
            transition: "width .25s ease",
          }}
        />
      </div>

      {!done && (
        <>
          {next.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
              {ar ? "التالي: " : "Next: "}
              {next.map((f) => (ar ? f.ar : f.en)).join(ar ? " · " : " · ")}
            </div>
          )}
          {!isSelf && (
            <button
              type="button"
              onClick={onContinue}
              style={{
                marginTop: 12,
                height: 38,
                width: "100%",
                borderRadius: 9,
                border: "none",
                background: "var(--nv-btn-fill)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {ar ? "أكمل الملف الآن" : "Complete file now"}
              <Chevron style={{ width: 16, height: 16 }} />
            </button>
          )}
          <p style={{ margin: "10px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
            {isSelf
              ? (ar
                ? "الملف للعرض فقط — تُكمل الإدارة أو الموارد البشرية كل البيانات."
                : "View only — management or HR completes all of this file.")
              : (ar
                ? "كل حقول المعلومات المهنية للإدارة أو الموارد البشرية."
                : "All professional-info fields are for management or HR.")}
          </p>
        </>
      )}
    </div>
  );
}
