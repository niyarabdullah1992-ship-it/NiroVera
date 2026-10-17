import React from "react";
import NvIcon from "@/components/shared/NvIcon";

/**
 * The pieces every form under «طلب جديد» / «إجراء جديد» in الجزاءات shares with طلباتي and صوت الموظف:
 * a sub-head with a hairline, radius-8 inputs, one checklist block and one green send button.
 */
export const inputStyle = {
  fontFamily: "inherit",
  fontSize: 13,
  height: 42,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
};

export const textareaStyle = { ...inputStyle, height: "auto", minHeight: 84, padding: "10px 12px", resize: "vertical", lineHeight: 1.7 };

export function FieldLabel({ children, note }) {
  return (
    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>
      <span>{children}</span>
      {note ? <span style={{ fontWeight: 400, color: "var(--nv-muted)", fontSize: 11 }}>{note}</span> : null}
    </span>
  );
}

/** A sub-step inside the frame («أي جزاء؟», «السبب») — label, muted note, hairline above. */
export function StepHead({ first = false, label, note }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "4px 8px", paddingTop: first ? 0 : 14, borderTop: first ? "none" : "1px solid var(--nv-line2, #EEF1EF)" }}>
      <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{label}</strong>
      {note ? <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{note}</span> : null}
    </div>
  );
}

/** One quiet line naming the article and its window — the law, not a paragraph about it. */
export function LawLine({ cite, children }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, padding: "10px 12px" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", flex: "none" }}>{cite}</span>
      <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{children}</span>
    </div>
  );
}

export function Checklist({ items = [], dataKey }) {
  return (
    <div data-form-checklist={dataKey || ""} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 6, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, padding: "12px 14px" }}>
      {items.map((row) => (
        <span key={row.text} data-check={row.ok ? "ok" : "todo"} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: row.ok ? "var(--nv-ok-ink)" : "var(--nv-muted)", lineHeight: 1.6 }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none", background: row.ok ? "var(--nv-ok-soft)" : "var(--nv-mute-soft)", color: row.ok ? "var(--nv-ok-ink)" : "var(--nv-muted)" }}>
            {row.ok ? <NvIcon name="check" size={11} strokeWidth={2.25} inline={false} /> : "·"}
          </span>
          {row.text}
        </span>
      ))}
    </div>
  );
}

/** The named blocking reason under the checklist — shown only while the gate refuses. */
export function GateLine({ gate, ar, dataAttr }) {
  if (!gate || gate.ok) return null;
  return (
    <span {...dataAttr} style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-warn-ink)", lineHeight: 1.7 }}>
      {ar ? gate.reason : gate.reasonEn}
    </span>
  );
}

export function SendButton({ ready, onClick, children, dataAttr }) {
  return (
    <button
      type="button"
      {...dataAttr}
      disabled={!ready}
      onClick={() => ready && onClick?.()}
      style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40, width: "100%", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: ready ? "var(--nv-ok-fill, #3C7D50)" : "var(--nv-soft, #E4E9E6)", color: ready ? "#fff" : "var(--nv-muted)", cursor: ready ? "pointer" : "default" }}
    >
      {children}
    </button>
  );
}
