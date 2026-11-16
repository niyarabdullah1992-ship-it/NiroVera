import React from "react";
import { ANNUAL_MIN, REST_MAX, REST_MIN, restDefaults } from "@/lib/contractLeave";

const box = { fontFamily: "inherit", height: 34, border: "1px solid var(--nv-line)", borderRadius: 8, padding: "0 10px", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 12.5 };
const chip = (on) => ({
  fontFamily: "inherit", height: 30, padding: "0 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  border: on ? "1px solid var(--nv-navy)" : "1px solid var(--nv-line)",
  background: on ? "var(--nv-navy)" : "var(--nv-card)",
  color: on ? "var(--nv-btn-ink, #fff)" : "var(--nv-ink2)",
});

/**
 * The contract's leave, as Qiwa asks for it: annual days (21 at least, more is allowed) and the
 * weekly rest (one day, two or three, and which weekdays). value = { annual, restCount, restDows }.
 */
export default function ContractLeaveFields({ value, onChange, disabled = false, hideTitle = false }) {
  const annual = value?.annual ?? ANNUAL_MIN;
  const count = Number(value?.restCount) || 1;
  const dows = Array.isArray(value?.restDows) && value.restDows.length ? value.restDows : restDefaults(count);
  const set = (patch) => onChange?.({ annual, restCount: count, restDows: dows, ...patch });
  const low = Number(annual) < ANNUAL_MIN;
  return (
    <div data-contract-leave="1" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px", border: "1px solid var(--nv-line)", borderRadius: 10 }}>
      {hideTitle ? null : <strong style={{ fontSize: 12.5 }}>الإجازات في العقد</strong>}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", fontWeight: 600 }}>الإجازة السنوية (يوماً)</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min={ANNUAL_MIN}
            value={annual}
            disabled={disabled}
            onChange={(e) => set({ annual: e.target.value === "" ? "" : Number(e.target.value) })}
            onBlur={() => { if (Number(annual) < ANNUAL_MIN) set({ annual: ANNUAL_MIN }); }}
            style={{ ...box, width: 90, borderColor: low ? "var(--nv-bad-ink)" : undefined }}
          />
          <span style={{ fontSize: 11, color: low ? "var(--nv-bad-ink)" : "var(--nv-muted)" }}>
            {low ? "لا تقل عن 21 يوماً." : "الحد الأدنى 21 يوماً، ولصاحب المنشأة أن يزيدها."}
          </span>
        </span>
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", fontWeight: 600 }}>الراحة الأسبوعية</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" disabled={disabled || count <= REST_MIN} onClick={() => set({ restCount: count - 1, restDows: restDefaults(count - 1) })} style={{ ...chip(false), width: 30, padding: 0 }}>−</button>
          <strong data-rest-count="1" style={{ minWidth: 70, textAlign: "center", fontSize: 13 }}>{count === 1 ? "يوم واحد" : count === 2 ? "يومان" : `${count} أيام`}</strong>
          <button type="button" disabled={disabled || count >= REST_MAX} onClick={() => set({ restCount: count + 1, restDows: restDefaults(count + 1) })} style={{ ...chip(false), width: 30, padding: 0 }}>＋</button>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>لا تقل عن يوم واحد، ولصاحب المنشأة أن يزيدها.</span>
        </span>
        <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>العدد فقط — الأيام نفسها تُحدَّد في جدول الدوام.</span>
      </div>
    </div>
  );
}
