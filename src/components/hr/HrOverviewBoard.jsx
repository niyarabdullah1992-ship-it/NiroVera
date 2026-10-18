import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { chip, mono, slab } from "@/components/schedules/scheduleChrome";
import { DK } from "@/components/tasks/OpsSideSlab";
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
  const decisions = view.decisions.slice(0, 8);
  const lateCount = view.decisions.filter((d) => d.days < 0).length;

  return (
    <div data-hr-overview="1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 16, alignItems: "start", minWidth: 0 }}>
      <section aria-label={ar ? "ما يحتاج قرارك اليوم" : "Needs your decision today"} data-hr-decisions="1" style={{ background: DK.bg, color: DK.ink, borderRadius: 14, boxShadow: "0 8px 24px rgba(6,61,38,.18)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 15.5 }}>{ar ? "ما يحتاج قرارك اليوم" : "Needs your decision today"}</strong>
            <span style={{ fontSize: 11.5, color: DK.soft, lineHeight: 1.6 }}>{ar ? "الأقرب موعداً أولاً — كل سطر يفتح المكان الذي يُحسم فيه." : "Nearest deadline first — each line opens where it is decided."}</span>
          </span>
          <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {lateCount ? <span style={{ ...mono, height: 20, padding: "0 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#FDECEC", color: "#9B1C1C", display: "inline-flex", alignItems: "center" }}>{lateCount}</span> : null}
            <span style={{ ...mono, height: 20, padding: "0 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: DK.gold, color: "#0B3D27", display: "inline-flex", alignItems: "center" }}>{view.decisions.length}</span>
          </span>
        </div>
        {decisions.length ? decisions.map((d) => {
          const late = d.days < 0;
          return (
            <Link key={d.id} to={d.to} data-hr-decision={d.kind} style={{ ...row, borderTop: `1px solid ${DK.line}`, flexWrap: "wrap" }}>
              <span dir="ltr" style={{ ...mono, fontSize: 11.5, color: DK.soft, minWidth: 80, unicodeBidi: "isolate" }}>{d.due}</span>
              <span style={{ flex: "1 1 180px", minWidth: 0, fontSize: 12.5, lineHeight: 1.6, overflowWrap: "anywhere" }}>{d.title}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: late ? DK.bad : DK.gold, whiteSpace: "nowrap" }}>{dueWord(d.days, ar)}</span>
              <Chevron color={DK.soft} />
            </Link>
          );
        }) : (
          <p style={{ margin: 0, padding: "14px 18px", fontSize: 12.5, color: DK.soft, borderTop: `1px solid ${DK.line}` }}>
            {ar ? "لا موعد قريب ينتظر قراراً." : "No near deadline awaits a decision."}
          </p>
        )}
        {view.decisions.length > decisions.length ? (
          <p style={{ margin: 0, padding: "10px 18px 14px", fontSize: 11.5, color: DK.faint, borderTop: `1px solid ${DK.line}` }}>
            {ar ? <>و<span dir="ltr" style={mono}>{view.decisions.length - decisions.length}</span> بعدها — في البنود المجاورة.</> : <>and <span style={mono}>{view.decisions.length - decisions.length}</span> more — in the lines beside.</>}
          </p>
        ) : null}
      </section>

      <section aria-label={ar ? "ما يحتاج إجراء" : "Needs action"} data-hr-actions="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px" }}>
          <span aria-hidden style={{ width: 14, height: 2, background: DK.gold, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "ما يحتاج إجراء" : "Needs action"}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>
              {ar
                ? <>سطر لكل بند، مشتق من الملفات والهيكل — <span dir="ltr" style={mono}>{view.staff}</span> ملفاً في النطاق.</>
                : <>One line per item, derived from the files and the structure — <span style={mono}>{view.staff}</span> files in scope.</>}
            </span>
          </span>
          <span dir="ltr" style={{ ...mono, fontSize: 11, fontWeight: 700, color: "var(--nv-ink2)", background: "var(--nv-soft)", borderRadius: 999, padding: "0 8px", height: 20, display: "inline-flex", alignItems: "center" }}>{view.rows.length}</span>
        </div>
        {view.rows.map((r) => (
          <Link key={r.id} to={r.to} data-hr-row={r.id} className="nv-hr-row" style={{ ...row, padding: "12px 18px" }}>
            <span dir="ltr" style={{ ...mono, fontSize: 15, fontWeight: 700, color: r.tone === "bad" ? "var(--nv-bad-ink)" : "var(--nv-ink)", minWidth: 44, textAlign: "center", unicodeBidi: "isolate" }}>{r.count != null ? r.count : r.value}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{r.label}</b>
                {r.chip ? <span style={chip(r.tone === "bad" ? "bad" : "warn")}>{r.chip}</span> : null}
              </span>
              <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.65 }}>{r.note}</span>
            </span>
            <Chevron />
          </Link>
        ))}
        {!view.rows.length ? (
          <p style={{ margin: 0, padding: "14px 18px", fontSize: 12.5, color: "var(--nv-ok-ink)", borderTop: "1px solid var(--nv-line2)" }}>
            {ar ? "لا بند ينتظر إجراء." : "Nothing awaits action."}
          </p>
        ) : null}
        {view.clear.length ? (
          <p data-hr-clear="1" style={{ margin: 0, padding: "11px 18px", fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8, borderTop: "1px solid var(--nv-line2)", background: "var(--nv-soft, #F6F8F7)" }}>
            {ar ? "مستوفى: " : "Clear: "}
            {view.clear.map((r) => r.label).join(" · ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
