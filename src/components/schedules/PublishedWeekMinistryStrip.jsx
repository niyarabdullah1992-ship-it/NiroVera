import React from "react";
import { Link } from "react-router-dom";
import { DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";

// Block-level values must NOT set direction:ltr or unicode-bidi:plaintext — in an RTL column either one
// pins a digits-only value to the left edge. Digits inside an RTL block already align to the start (right).
const mono = {
  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  fontVariantNumeric: "tabular-nums",
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
export default function PublishedWeekMinistryStrip({ facts, ar = true, manageHref = "", tilesOnly = false }) {
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
      <div className="nv-sched-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 12 }}>
        {cells.map((cell) => (
          <div
            key={cell.key}
            data-stat={cell.key}
            data-tone={cell.tone}
            style={{
              background: "var(--nv-card)",
              border: "1px solid var(--nv-line)",
              borderRadius: DS_RADIUS,
              boxShadow: DS_SHADOW,
              padding: "12px 16px 13px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* status lives on the 3px top edge only — never a filled card */}
            <span aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 3, background: toneEdge(cell.tone) }} />
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.4 }}>{cell.label}</span>
            <strong style={{ ...(/^[\d.,%—–-]+$/.test(String(cell.value || "—")) ? mono : { letterSpacing: 0 }), fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: "var(--nv-ink)", textAlign: "start" }}>{cell.value || "—"}</strong>
            <span style={{ fontSize: 11, color: "var(--nv-ink3, var(--nv-muted))", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{cell.note || "—"}</span>
          </div>
        ))}
      </div>
      {!tilesOnly && facts.constraints?.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {facts.constraints.slice(0, 4).map((row) => (
            <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink)" }}>{row.cite}</span>
              <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.65 }}>{row.note}</span>
            </div>
          ))}
        </div>
      ) : null}
      {!tilesOnly && manageHref ? (
        <Link to={manageHref} style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink, var(--nv-ink))", textDecoration: "none", alignSelf: "flex-start" }}>
          {ar ? "افتح الجدول ←" : "Open the roster →"}
        </Link>
      ) : null}
    </section>
  );
}
