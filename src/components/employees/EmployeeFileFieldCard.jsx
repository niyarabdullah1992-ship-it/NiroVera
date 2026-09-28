import React from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { gosiRegistrationIso, gosiSubscriberClass } from "@/lib/facts";
import { MUTED, NAVY } from "@/lib/platformStyles";

const input = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "6px 8px",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
  background: "var(--nv-card)",
  color: NAVY,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minWidth: 0,
};

export function maskFileSecret(value) {
  const text = String(value || "").trim();
  if (!text || text === "—") return text || "—";
  const compact = text.replace(/\s+/g, "");
  if (compact.length <= 2) return "•".repeat(compact.length);
  return `${compact.slice(0, 1)}${"•".repeat(Math.min(8, Math.max(4, compact.length - 3)))}${compact.slice(-2)}`;
}

export function FileRow({ row, editing, draft, onDraft, ar = true, showFull = false }) {
  const editable = Boolean(editing && row.field);
  const value = editable ? String(draft?.[row.field] ?? row.raw ?? "") : row.v;
  const shown = !editable && row.secret && !showFull ? maskFileSecret(value) : value;
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
          <span dir={row.secret ? "ltr" : undefined} style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.7, color: NAVY, fontFamily: row.secret ? "'IBM Plex Mono', monospace" : "inherit" }}>{shown}</span>
        )}
        {row.hasChip ? (
          <span style={{ fontSize: 10, fontWeight: 600, color: row.color, background: row.bg, border: `1px solid ${row.border}`, borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>{row.chip}</span>
        ) : null}
        {editing && row.locked ? (
          <span style={{ fontSize: 10, color: MUTED, background: "var(--nv-soft)", border: "1px dashed var(--nv-line)", padding: "1px 7px", whiteSpace: "nowrap" }}>
            لا يُحرَّر من هنا
          </span>
        ) : null}
      </span>
    </div>
  );
}

export default function EmployeeFileFieldCard({ card, editing, draft, onDraft, children, ar = true, showFull = false }) {
  return (
    <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          {card.kicker ? <span style={{ fontSize: 11, letterSpacing: ".1em", color: MUTED }}>{card.kicker}</span> : null}
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" }}>{card.title}</span>
          {card.what ? <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{card.what}</span> : null}
        </div>
        {card.tag || card.state ? (
          <span style={{ marginInlineStart: "auto", fontSize: 10, fontWeight: 600, color: card.tagColor || card.color || MUTED, background: card.tagBg || card.bg || "var(--nv-soft)", border: `1px solid ${card.tagBorder || card.border || "var(--nv-line)"}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
            {card.tag || card.state}
          </span>
        ) : null}
      </div>
      {(card.rows || []).map((row) => (
        <FileRow key={`${card.title}-${row.k}`} row={row} editing={editing} draft={draft} onDraft={onDraft} ar={ar} showFull={showFull} />
      ))}
      {children}
      {card.note ? (
        <div style={{ padding: "11px 18px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.85 }}>{card.note}</div>
      ) : null}
    </section>
  );
}

const wageInput = {
  ...input,
  fontFamily: "'IBM Plex Mono',monospace",
  width: 110,
};

function registrationBadge(iso, ar) {
  const klass = gosiSubscriberClass(iso);
  if (klass === "old") return ar ? "قديم" : "Old";
  if (klass === "new") return ar ? "جديد" : "New";
  return "";
}

const classChip = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--nv-ok-ink)",
  background: "var(--nv-ok-soft)",
  border: "1px solid var(--nv-ok-line)",
  borderRadius: 999,
  padding: "1px 7px",
  whiteSpace: "nowrap",
};

export function EmployeeFileWageCard({ title, what, rows = [], note, editing, draft, onDraft, canEditWage, canEditDate = false, ar = true, onCommitDate }) {
  return (
    <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" }}>{title}</span>
        {what ? <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{what}</span> : null}
      </div>
      {rows.map((item) => {
        const isDate = item.type === "date";
        const open = Boolean(!isDate && editing && canEditWage && item.field && !item.derived);
        const dateOpen = Boolean(isDate && item.field && (canEditDate || editing));
        const drafted = editing && draft && Object.prototype.hasOwnProperty.call(draft, item.field);
        const dateIso = isDate ? gosiRegistrationIso(drafted ? draft[item.field] : item.val) : "";
        const badge = isDate ? registrationBadge(dateIso, ar) : "";
        return (
          <div key={item.k} style={{ padding: "11px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", background: item.bg || "var(--nv-card)" }}>
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
            ) : dateOpen ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 176, maxWidth: "46vw" }}>
                  <PlatformDateField
                    compact
                    ar={ar}
                    allowClear
                    value={dateIso}
                    onChange={(next) => {
                      const iso = gosiRegistrationIso(next);
                      if (editing) onDraft?.(item.field, iso);
                      else onCommitDate?.(item.field, iso);
                    }}
                  />
                </span>
                {badge ? <span style={classChip}>{badge}</span> : null}
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span dir={isDate ? undefined : "ltr"} style={{ fontFamily: isDate ? "inherit" : "'IBM Plex Mono',monospace", fontSize: 13, color: item.color || NAVY, whiteSpace: "nowrap" }}>{item.v}</span>
                {isDate && item.hasChip ? <span style={classChip}>{item.chip}</span> : null}
              </span>
            )}
          </div>
        );
      })}
      {note ? <div style={{ padding: "13px 20px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>{note}</div> : null}
    </section>
  );
}
