import React from "react";
import { Building2, Network } from "lucide-react";
import { ACCENT, BORDER, MUTED, NAVY, field, SURFACE } from "@/lib/platformStyles";

/**
 * Official admin communication targets:
 * - Company HR is always first (guaranteed path).
 * - Tree managers are optional extras when the org chart is configured.
 */
export default function TreeCommunicationTargetPicker({ targets, value, onChange, ar }) {
  const company = targets.filter((t) => t.kind === "company" || t.always);
  const tree = targets.filter((t) => t.kind === "tree");
  const hasTree = tree.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={{ display: "flex", minWidth: 0, alignItems: "center", gap: "8px", fontSize: "12px", color: MUTED }}>
        <Building2 style={{ width: 16, height: 16, flexShrink: 0, color: ACCENT }} />
        <span style={{ flexShrink: 0 }}>{ar ? "إرسال إلى:" : "Send to:"}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...field, flex: 1, minWidth: 0, height: "34px", color: NAVY, borderColor: BORDER }}
        >
          {company.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}{target.title ? ` — ${target.title}` : ""}
            </option>
          ))}
          {hasTree && (
            <optgroup label={ar ? "عبر الشجرة التنظيمية (اختياري)" : "Via organization tree (optional)"}>
              {tree.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}{target.title ? ` — ${target.title}` : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {!hasTree && (
        <p style={{
          margin: 0,
          borderRadius: "9px",
          border: "1px solid var(--nv-line)",
          background: SURFACE,
          padding: "8px 12px",
          fontSize: "11px",
          color: MUTED,
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          lineHeight: 1.55,
        }}
        >
          <Network style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: MUTED }} />
          <span>
            {ar
              ? "لا مدير أعلى مضبوط في الشجرة بعد — يمكنك الإرسال مباشرة إلى موارد بشرية الشركة. عند اكتمال الهيكل يظهر مديرك كخيار إضافي."
              : "No higher manager is configured in the tree yet — you can still send directly to Company HR. When the org chart is complete, your manager appears as an extra option."}
          </span>
        </p>
      )}
    </div>
  );
}
