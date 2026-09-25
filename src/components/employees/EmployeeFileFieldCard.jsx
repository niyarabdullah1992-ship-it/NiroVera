import React from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { MUTED, NAVY } from "@/lib/platformStyles";

const input = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "6px 8px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: NAVY,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minWidth: 0,
};

export function FileRow({ row, editing, draft, onDraft, ar = true }) {
  const editable = Boolean(editing && row.field);
  const value = editable ? String(draft?.[row.field] ?? row.raw ?? "") : row.v;
  return (
    <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(88px,1fr) minmax(0,1.3fr)", gap: 12, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{row.k}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap", minWidth: 0 }}>
        {editable && row.options?.length ? (
          <select value={value} onChange={(event) => onDraft?.(row.field, event.target.value)} style={input}>
            <option value="">—</option>
            {row.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : editable && row.type === "date" ? (
          <PlatformDateField compact ar={ar} value={value} onChange={(next) => onDraft?.(row.field, next)} />
        ) : editable ? (
          <input
            type={row.type || "text"}
            value={value}
            onChange={(event) => onDraft?.(row.field, event.target.value)}
            style={input}
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.7, color: NAVY }}>{row.v}</span>
        )}
        {row.hasChip ? (
          <span style={{ fontSize: 10, fontWeight: 600, color: row.color, background: row.bg, border: `1px solid ${row.border}`, borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>{row.chip}</span>
        ) : null}
        {editing && row.locked ? (
          <span style={{ fontSize: 10, color: MUTED, background: "#FAFBFC", border: "1px dashed #DFE3EA", padding: "1px 7px", whiteSpace: "nowrap" }}>
            لا يُحرَّر من هنا
          </span>
        ) : null}
      </span>
    </div>
  );
}

export default function EmployeeFileFieldCard({ card, editing, draft, onDraft, children, ar = true }) {
  return (
    <section className="nv-paper" style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEF0F4", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          {card.kicker ? <span style={{ fontSize: 11, letterSpacing: ".1em", color: MUTED }}>{card.kicker}</span> : null}
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#111418" }}>{card.title}</span>
          {card.what ? <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{card.what}</span> : null}
        </div>
        {card.tag || card.state ? (
          <span style={{ marginInlineStart: "auto", fontSize: 10, fontWeight: 600, color: card.tagColor || card.color || MUTED, background: card.tagBg || card.bg || "#F5F6F8", border: `1px solid ${card.tagBorder || card.border || "#E6E9EF"}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
            {card.tag || card.state}
          </span>
        ) : null}
      </div>
      {(card.rows || []).map((row) => (
        <FileRow key={`${card.title}-${row.k}`} row={row} editing={editing} draft={draft} onDraft={onDraft} ar={ar} />
      ))}
      {children}
      {card.note ? (
        <div style={{ padding: "11px 18px", fontSize: 11, color: "#4B5567", lineHeight: 1.85 }}>{card.note}</div>
      ) : null}
    </section>
  );
}

const wageInput = {
  ...input,
  fontFamily: "'IBM Plex Mono',monospace",
  width: 110,
};

export function EmployeeFileWageCard({ title, what, rows = [], note, editing, draft, onDraft, canEditWage }) {
  return (
    <section className="nv-paper" style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#111418" }}>{title}</span>
        {what ? <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{what}</span> : null}
      </div>
      {rows.map((item) => {
        const open = Boolean(editing && canEditWage && item.field && !item.derived);
        return (
          <div key={item.k} style={{ padding: "11px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "baseline", background: item.bg || "var(--nv-card)" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: item.weight || 500, color: NAVY }}>{item.k}</span>
              <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>{item.note}</span>
            </span>
            {open ? (
              <input
                type="number"
                value={String(draft?.[item.field] ?? item.val ?? "")}
                onChange={(event) => onDraft?.(item.field, event.target.value)}
                style={wageInput}
              />
            ) : (
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: item.color || NAVY, whiteSpace: "nowrap" }}>{item.v}</span>
            )}
          </div>
        );
      })}
      {note ? <div style={{ padding: "13px 20px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>{note}</div> : null}
    </section>
  );
}
