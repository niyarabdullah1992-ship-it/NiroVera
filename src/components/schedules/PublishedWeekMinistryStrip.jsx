import React from "react";
import { Link } from "react-router-dom";

const mono = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontVariantNumeric: "tabular-nums",
  direction: "ltr",
  unicodeBidi: "isolate",
};

function toneEdge(tone) {
  if (tone === "bad") return "var(--nv-bad-fill)";
  if (tone === "warn") return "var(--nv-warn-fill)";
  if (tone === "ok") return "var(--nv-ok-fill)";
  return "var(--nv-line)";
}

/**
 * Four derived facts on the published week: hours, official holidays,
 * article constraints, and whether publish compliance is clear.
 */
export default function PublishedWeekMinistryStrip({ facts, ar = true, manageHref = "" }) {
  if (!facts) return null;
  const cells = [
    {
      key: "hours",
      label: ar ? "ساعات" : "Hours",
      value: facts.hours || "—",
      note: facts.hoursNote,
      tone: facts.hoursTone,
    },
    {
      key: "holidays",
      label: ar ? "إجازات رسمية" : "Official holidays",
      value: facts.holidays || "—",
      note: facts.holidayNote,
      tone: facts.holidays && facts.holidays !== "—" ? "warn" : "ok",
    },
    {
      key: "rules",
      label: ar ? "قيود المادة" : "Article constraints",
      value: facts.constraints?.length ? String(facts.constraints.length) : "—",
      note: facts.constraints?.length
        ? facts.constraints.map((row) => row.cite).filter((cite) => cite && cite !== "—").slice(0, 3).join(" · ") || facts.constraints[0].title
        : (ar ? "لا قيد مفتوح" : "No open constraint"),
      tone: facts.constraints?.some((row) => row.tone === "bad") ? "bad" : (facts.constraints?.length ? "warn" : "ok"),
    },
    {
      key: "compliance",
      label: ar ? "امتثال" : "Compliance",
      value: facts.compliance || "—",
      note: facts.complianceNote,
      tone: facts.complianceTone,
    },
  ];
  return (
    <section data-published-ministry="" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 8 }}>
        {cells.map((cell) => (
          <div
            key={cell.key}
            style={{
              background: "var(--nv-card)",
              border: "1px solid var(--nv-line)",
              borderTop: `3px solid ${toneEdge(cell.tone)}`,
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{cell.label}</span>
            <strong style={{ ...mono, fontSize: 18, fontWeight: 700, color: "var(--nv-ink)", textAlign: "start" }}>{cell.value || "—"}</strong>
            <span style={{ fontSize: 10.5, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.65 }}>{cell.note || "—"}</span>
          </div>
        ))}
      </div>
      {facts.constraints?.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {facts.constraints.slice(0, 4).map((row) => (
            <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink)" }}>{row.cite}</span>
              <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.65 }}>{row.note}</span>
            </div>
          ))}
        </div>
      ) : null}
      {manageHref ? (
        <Link to={manageHref} style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink, var(--nv-ink))", textDecoration: "none", alignSelf: "flex-start" }}>
          {ar ? "افتح الجدول ←" : "Open the roster →"}
        </Link>
      ) : null}
    </section>
  );
}
