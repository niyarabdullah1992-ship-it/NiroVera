import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { chip, mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { ui } from "@/lib/platformStyles";
import { deriveHrOverview, dueWord } from "@/lib/hrOverview";
import { localDateKey } from "@/lib/complianceDerivations";

const openBtn = { ...ui.btnRow, padding: "0 14px", height: 30, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 600, flexShrink: 0 };

function Num({ children, tone }) {
  return (
    <span dir="ltr" style={{ ...mono, fontSize: 15, fontWeight: 700, color: tone === "bad" ? "var(--nv-bad-ink)" : "var(--nv-ink)", minWidth: 32, textAlign: "center", unicodeBidi: "isolate" }}>
      {children}
    </span>
  );
}

/**
 * «نظرة عامة» — the HR decision glance: «ما يحتاج قرارك اليوم» (dated, nearest first), then one line
 * per thing that needs action with a green «افتح» to where it is fixed, then the clean checks in
 * one muted line. Rows, not tiles; numbers mono in ink; a chip only when something is already late.
 */
export default function HrOverviewBoard({ ar = true, data, scopeIds = null, orgWrite = true }) {
  const today = localDateKey();
  const view = useMemo(
    () => deriveHrOverview(data, { today, ar, scopeIds, orgWrite }),
    [data, today, ar, scopeIds, orgWrite],
  );
  const decisions = view.decisions.slice(0, 8);

  return (
    <div data-hr-overview="1" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <section aria-label={ar ? "ما يحتاج قرارك اليوم" : "Needs your decision today"} style={{ ...slab, display: "flex", flexDirection: "column" }}>
        <SectionHead
          title={ar ? "ما يحتاج قرارك اليوم" : "Needs your decision today"}
          note={ar ? "الأقرب موعداً أولاً — كل سطر يفتح المكان الذي يُحسم فيه." : "Nearest deadline first — each line opens where it is decided."}
        />
        {decisions.length ? decisions.map((d) => {
          const late = d.days < 0;
          return (
            <div key={d.id} data-hr-decision={d.kind} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", flexWrap: "wrap", minWidth: 0 }}>
              <span dir="ltr" style={{ ...mono, fontSize: 12, color: "var(--nv-ink)", minWidth: 86, unicodeBidi: "isolate" }}>{d.due}</span>
              <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 13, color: "var(--nv-ink)", lineHeight: 1.6, overflowWrap: "anywhere" }}>{d.title}</span>
              <span style={{ fontSize: 12, fontWeight: late ? 600 : 400, color: late ? "var(--nv-bad-ink)" : "var(--nv-muted)", whiteSpace: "nowrap" }}>{dueWord(d.days, ar)}</span>
              <Link to={d.to} style={openBtn}>{ar ? "افتح" : "Open"}</Link>
            </div>
          );
        }) : (
          <p style={{ margin: 0, padding: "14px 18px", fontSize: 12.5, color: "var(--nv-muted)" }}>
            {ar ? "لا موعد قريب ينتظر قراراً." : "No near deadline awaits a decision."}
          </p>
        )}
        {view.decisions.length > decisions.length ? (
          <p style={{ margin: 0, padding: "10px 18px", fontSize: 12, color: "var(--nv-muted)" }}>
            {ar ? <>و<span dir="ltr" style={mono}>{view.decisions.length - decisions.length}</span> بعدها — في الأسطر أدناه.</> : <>and <span style={mono}>{view.decisions.length - decisions.length}</span> more — in the lines below.</>}
          </p>
        ) : null}
      </section>

      <section aria-label={ar ? "ما يحتاج إجراء" : "Needs action"} style={{ ...slab, display: "flex", flexDirection: "column" }}>
        <SectionHead
          title={ar ? "ما يحتاج إجراء" : "Needs action"}
          note={ar
            ? <>سطر لكل بند، مشتق من الملفات والهيكل — <span dir="ltr" style={mono}>{view.staff}</span> ملفاً في النطاق.</>
            : <>One line per item, derived from the files and the structure — <span style={mono}>{view.staff}</span> files in scope.</>}
        />
        {view.rows.map((row) => (
          <div key={row.id} data-hr-row={row.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", flexWrap: "wrap", minWidth: 0 }}>
            <Num tone={row.tone}>{row.count != null ? row.count : row.value}</Num>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 220px", minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{row.label}</b>
                {row.chip ? <span style={chip(row.tone === "bad" ? "bad" : "warn")}>{row.chip}</span> : null}
              </span>
              <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.65 }}>{row.note}</span>
            </span>
            <Link to={row.to} style={openBtn}>{ar ? "افتح" : "Open"}</Link>
          </div>
        ))}
        {!view.rows.length ? (
          <p style={{ margin: 0, padding: "14px 18px", fontSize: 12.5, color: "var(--nv-ok-ink)" }}>
            {ar ? "لا بند ينتظر إجراء." : "Nothing awaits action."}
          </p>
        ) : null}
        {view.clear.length ? (
          <p data-hr-clear="1" style={{ margin: 0, padding: "11px 18px", fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
            {ar ? "مستوفى: " : "Clear: "}
            {view.clear.map((row) => row.label).join(ar ? " · " : " · ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
