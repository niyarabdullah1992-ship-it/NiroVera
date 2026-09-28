import React, { useState } from "react";
import { deriveDisciplineLawBoard } from "@/lib/disciplineBoard";

const ACTION = "#3C7D50";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "6px 12px",
    border: `1px solid ${on ? ACTION : "var(--nv-line)"}`,
    background: on ? ACTION : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: 999,
  };
}

function effectLine(text) {
  const line = String(text || "")
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, "")
    .replace(/\b[a-z]+(?:\.[a-z0-9_]+)+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([،.])/g, "$1")
    .trim();
  return line || "—";
}

export default function DisciplineLawBoard({ cases, employees, ar, today }) {
  const [filter, setFilter] = useState("all");
  const board = deriveDisciplineLawBoard({ cases, employees, ar, today, filter });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section
        className="nv-paper"
        data-discipline-law=""
        style={{
          background: "var(--nv-card)",
          border: "1px solid var(--nv-line)",
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {board.filters.map((row) => (
            <button key={row.id} type="button" className="nv-chip" onClick={() => setFilter(row.id)} style={chip(filter === row.id)}>
              {row.label}
            </button>
          ))}
        </div>
        {board.rows.map((row) => {
          const art = String(row.art || "").includes(".") ? "—" : (row.art || "—");
          return (
            <div
              key={row.id}
              style={{
                padding: "8px 14px",
                borderBottom: "1px solid var(--nv-line)",
                display: "grid",
                gridTemplateColumns: "52px minmax(0,1fr) auto",
                gap: 10,
                alignItems: "center",
                background: "var(--nv-card)",
              }}
            >
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.1 }}>{art}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.4 }}>{row.head}</span>
                <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.5 }}>{effectLine(row.applied)}</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: row.tagColor, background: row.tagBg, border: `1px solid ${row.tagBorder}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
                {row.tag}
              </span>
            </div>
          );
        })}
        <div style={{ padding: "12px 16px", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
          {ar
            ? "أرقام المواد مرجعها النص الرسمي، والمنصة تعرضها ولا تُفتي بها. ما لا تنصّ عليه اللائحة لا يُوقَّع جزاء عليه."
            : "Article numbers follow the official text. The platform displays them and does not give a fatwa. What the regulations do not name is not signed."}
        </div>
      </section>
    </div>
  );
}
