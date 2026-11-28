import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { chip, mono, slab } from "@/components/schedules/scheduleChrome";
import { deriveHrOverview, dueWord } from "@/lib/hrOverview";
import { localDateKey } from "@/lib/complianceDerivations";

const row = { display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderTop: "1px solid var(--nv-line2, #EEF2F7)", minWidth: 0, textDecoration: "none", color: "inherit" };

function Chevron({ color = "var(--nv-muted)" }) {
  return <span aria-hidden style={{ fontSize: 15, lineHeight: 1, color, flexShrink: 0 }}>›</span>;
}

/**
 * «نظرة عامة» — the «طلباتي» face: the dark slab on the start side holds what needs a decision by a
 * date (nearest first), the white card beside it holds one line per thing that needs action. Every
 * row is the link to where it is settled — no separate buttons; figures mono; a chip only when late.
 */
export default function HrOverviewBoard({ ar = true, data, scopeIds = null, orgWrite = true }) {
  const today = localDateKey();
  const view = useMemo(
    () => deriveHrOverview(data, { today, ar, scopeIds, orgWrite }),
    [data, today, ar, scopeIds, orgWrite],
  );
  // Five first; the rest on demand — the list reads at a glance.
  const [showAll, setShowAll] = useState(false);
  const decisions = showAll ? view.decisions : view.decisions.slice(0, 5);
  const lateCount = view.decisions.filter((d) => d.days < 0).length;

  const total = view.decisions.length + view.rows.length;
  const group = (label) => (
    <div style={{ padding: "10px 18px 6px", fontSize: 11.5, fontWeight: 600, color: "var(--nv-muted)", borderTop: "1px solid var(--nv-line2, #EEF2F7)", background: "var(--nv-soft, #F6F8F7)" }}>{label}</div>
  );

  // one list: what is due by a date first (nearest first), then the open items — each line opens where it is settled
  return (
    <section data-hr-overview="1" aria-label={ar ? "ما يحتاج قرارك" : "Needs your decision"} style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 12px" }}>
        <strong style={{ fontSize: 15, color: "var(--nv-ink)", flex: 1 }}>{ar ? "ما يحتاج قرارك" : "Needs your decision"}</strong>
        <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {lateCount ? <span title={ar ? "متأخر" : "Late"} style={{ ...mono, height: 20, padding: "0 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--nv-bad-soft, #FDECEC)", color: "var(--nv-bad-ink, #9B1C1C)", display: "inline-flex", alignItems: "center" }}>{lateCount}</span> : null}
          <span style={{ ...mono, height: 20, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--nv-soft)", color: "var(--nv-ink2)", display: "inline-flex", alignItems: "center" }}>{total}</span>
        </span>
      </div>

      {decisions.length ? (
        <>
          {group(ar ? "بموعد — الأقرب أولاً" : "By date — nearest first")}
          {decisions.map((d) => {
            const late = d.days < 0;
            return (
              <Link key={d.id} to={d.to} data-hr-decision={d.kind} className="nv-hr-row" style={{ ...row, flexWrap: "wrap" }}>
                <span dir="ltr" style={{ ...mono, fontSize: 11.5, color: "var(--nv-muted)", minWidth: 80, unicodeBidi: "isolate" }}>{d.due}</span>
                <span style={{ flex: "1 1 180px", minWidth: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--nv-ink)", overflowWrap: "anywhere" }}>{d.title}</span>
                <span style={chip(late ? "bad" : "warn")}>{dueWord(d.days, ar)}</span>
                <Chevron />
              </Link>
            );
          })}
          {view.decisions.length > 5 ? (
            <button type="button" onClick={() => setShowAll((v) => !v)} style={{ fontFamily: "inherit", border: "none", borderTop: "1px solid var(--nv-line2)", background: "transparent", padding: "9px 18px", fontSize: 12, fontWeight: 700, color: "var(--nv-accent, #1E9E63)", cursor: "pointer", textAlign: "start" }}>
              {showAll ? (ar ? "اعرض أقل" : "Show less") : (ar ? `اعرض الكل (${view.decisions.length})` : `Show all (${view.decisions.length})`)}
            </button>
          ) : null}
        </>
      ) : null}

      {view.rows.length ? (
        <>
          {group(ar ? "بنود مفتوحة" : "Open items")}
          <div data-hr-tiles="1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8, padding: "10px 18px 14px", borderTop: "1px solid var(--nv-line2, #EEF2F7)" }}>
            {view.rows.map((r) => (
              <Link key={r.id} to={r.to} data-hr-row={r.id} title={r.note} className="nv-hr-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--nv-line, #E4E9E6)", textDecoration: "none", color: "inherit", minWidth: 0 }}>
                <span dir="ltr" style={{ ...mono, fontSize: 16, fontWeight: 700, color: r.tone === "bad" ? "var(--nv-bad-ink)" : "var(--nv-ink)", minWidth: 30, textAlign: "center", unicodeBidi: "isolate" }}>{r.count != null ? r.count : r.value}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.5 }}>{r.label}</span>
                <Chevron />
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {!total ? (
        <p style={{ margin: 0, padding: "14px 18px", fontSize: 12.5, color: "var(--nv-ok-ink)", borderTop: "1px solid var(--nv-line2)" }}>
          {ar ? "لا شيء ينتظر قرارك." : "Nothing awaits your decision."}
        </p>
      ) : null}
      {view.clear.length ? (
        <p data-hr-clear="1" style={{ margin: 0, padding: "10px 18px", fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8, borderTop: "1px solid var(--nv-line2)" }}>
          {ar ? "مستوفى: " : "Clear: "}
          {view.clear.map((r) => r.label).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
