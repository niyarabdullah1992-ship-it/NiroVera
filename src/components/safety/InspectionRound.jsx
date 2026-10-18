import React, { useMemo, useState } from "react";
import { citeRule } from "@/lib/laborRules";
import { GateLine, SendButton, inputStyle } from "@/components/discipline/DisciplineFormKit";
import { ArticleBadge, AttentionChip } from "@/components/discipline/DisciplineRows";
import { INSPECTION_EVERY_DAYS, branchInspectionState, checkInspectionGate, inspectionItems, inspectionScore } from "@/lib/safetyOps";
import { SafetyKpiRow, SafetyPanel } from "@/components/safety/SafetyOpsKit";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const VERDICTS = [
  { id: "yes", ar: "مطابق", en: "Met" },
  { id: "no", ar: "غير مطابق", en: "Not met" },
  { id: "na", ar: "لا ينطبق", en: "N/A" },
];

function verdictStyle(id, on) {
  const fill = id === "yes" ? "var(--nv-ok-fill, #3C7D50)" : id === "no" ? "var(--nv-bad-ink, #9B2335)" : "var(--nv-ink3, #6B7A72)";
  return {
    fontFamily: "inherit",
    height: 28,
    padding: "0 10px",
    borderRadius: 7,
    fontSize: 11.5,
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    border: `1px solid ${on ? fill : "var(--nv-line)"}`,
    background: on ? fill : "var(--nv-card)",
    color: on ? "#fff" : "var(--nv-ink2)",
    whiteSpace: "nowrap",
  };
}

function scoreTone(pct) {
  if (pct == null) return null;
  if (pct >= 90) return "ok";
  if (pct >= 75) return "warn";
  return "bad";
}

function RoundForm({ ar, station, onCancel, onSave }) {
  const L = (a, e) => (ar ? a : e);
  const items = useMemo(() => inspectionItems(), []);
  const groups = useMemo(() => {
    const out = [];
    items.forEach((item) => {
      let g = out.find((row) => row.id === item.group);
      if (!g) { g = { id: item.group, ar: item.groupAr, en: item.groupEn, items: [] }; out.push(g); }
      g.items.push(item);
    });
    return out;
  }, [items]);
  const [results, setResults] = useState({});
  const set = (id, next) => setResults((cur) => ({ ...cur, [id]: { ...(cur[id] || {}), ...next } }));
  const gate = checkInspectionGate({ stationId: station.id, results }, items);
  const score = inspectionScore(results, items);
  const answered = items.filter((item) => results[item.id]?.status).length;
  return (
    <SafetyPanel
      dataKey="inspection-round"
      title={ar ? `جولة تفتيش — ${station.name}` : `Inspection round — ${station.name}`}
      note={L("احكم على كل بند. كل «غير مطابق» يتحوّل إلى بلاغ سلامة بمهلته ويُسند من «بلاغات السلامة».", "Judge every item. Each «not met» becomes a safety report with its window, assigned from Safety reports.")}
      trailing={(
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? `${answered} من ${items.length}` : `${answered} of ${items.length}`}</span>
          <strong dir="ltr" data-round-score="1" style={{ font: `700 20px ${MONO}`, color: score.pct == null ? "var(--nv-muted)" : scoreTone(score.pct) === "ok" ? "var(--nv-ok-ink)" : scoreTone(score.pct) === "warn" ? "var(--nv-warn-ink)" : "var(--nv-bad-ink)" }}>
            {score.pct == null ? "—" : `${score.pct}%`}
          </strong>
        </span>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((group) => (
          <fieldset key={group.id} data-round-group={group.id} style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
            <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink2)", padding: "0 0 8px" }}>{ar ? group.ar : group.en}</legend>
            {group.items.map((item) => {
              const r = results[item.id] || {};
              const cite = item.ruleId ? citeRule(item.ruleId) : null;
              return (
                <div key={item.id} data-round-item={item.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {cite ? <ArticleBadge>{ar ? cite.labelAr : cite.labelEn}</ArticleBadge> : null}
                    <span style={{ flex: "1 1 220px", fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.6 }}>{ar ? item.ar : item.en}</span>
                    <span role="radiogroup" aria-label={ar ? item.ar : item.en} style={{ display: "inline-flex", gap: 4 }}>
                      {VERDICTS.map((v) => (
                        <button key={v.id} type="button" role="radio" aria-checked={r.status === v.id} data-verdict={v.id} onClick={() => set(item.id, { status: v.id })} style={verdictStyle(v.id, r.status === v.id)}>
                          {ar ? v.ar : v.en}
                        </button>
                      ))}
                    </span>
                  </div>
                  {r.status === "no" ? (
                    <input data-round-comment={item.id} value={r.comment || ""} onChange={(e) => set(item.id, { comment: e.target.value })} placeholder={L("ما الذي وجدته؟ — يُكتب في البلاغ", "What did you find? — goes on the report")} style={{ ...inputStyle, height: 36, fontSize: 12.5 }} />
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        ))}
        <GateLine gate={gate} ar={ar} dataAttr={{ "data-round-gate": "1" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SendButton ready={gate.ok} dataAttr={{ "data-round-save": "1" }} onClick={() => { if (onSave(station.id, results)) onCancel(); }}>
              {score.no
                ? (ar ? `اعتمد الجولة وارفع ${score.no} بلاغاً` : `Record the round and raise ${score.no} reports`)
                : L("اعتمد الجولة", "Record the round")}
            </SendButton>
          </div>
          <button type="button" onClick={onCancel} style={{ fontFamily: "inherit", height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {L("إلغاء", "Cancel")}
          </button>
        </div>
      </div>
    </SafetyPanel>
  );
}

/** التفتيش والجاهزية — the monthly round per branch, its score as the branch's readiness, findings as reports. */
export default function InspectionRound({ ar, stations, recFor, canEdit, onSave }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const [active, setActive] = useState("");
  const rows = stations.map((station) => {
    const rec = recFor(station.id) || {};
    const st = branchInspectionState(rec, now);
    const openFindings = (rec.incidentLog || []).filter((item) => item.source?.kind === "inspection" && item.status !== "closed").length;
    return { station, st, openFindings };
  });
  const known = rows.filter((row) => row.st.pct != null);
  const avg = known.length ? Math.round(known.reduce((sum, row) => sum + row.st.pct, 0) / known.length) : null;
  const due = rows.filter((row) => row.st.due).length;
  const openFindings = rows.reduce((sum, row) => sum + row.openFindings, 0);
  const history = rows
    .flatMap((row) => row.st.rounds.map((round) => ({ round, station: row.station })))
    .sort((a, b) => String(b.round.at).localeCompare(String(a.round.at)))
    .slice(0, 12);
  const activeStation = stations.find((s) => s.id === active);
  return (
    <div data-hse="admin-inspect" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SafetyKpiRow items={[
        { key: "readiness", label: L("جاهزية الفروع", "Branch readiness"), value: avg == null ? null : `${avg}%`, sub: L("متوسط آخر جولة لكل فرع", "Average of each branch's last round"), tone: scoreTone(avg) },
        { key: "due", label: L("جولات مستحقة", "Rounds due"), value: due, sub: ar ? `جولة كل ${INSPECTION_EVERY_DAYS} يوماً لكل فرع` : `One round every ${INSPECTION_EVERY_DAYS} days per branch`, tone: due ? "warn" : "ok" },
        { key: "findings", label: L("ملاحظات مفتوحة", "Open findings"), value: openFindings, sub: L("بلاغات من الجولات لم تُغلق", "Round reports not yet closed"), tone: openFindings ? "bad" : "ok" },
        { key: "rounds", label: L("جولات مسجّلة", "Rounds on record"), value: history.length, sub: L("آخر 12 جولة في النطاق", "Last 12 rounds in scope"), tone: null },
      ]} />

      {activeStation ? (
        <RoundForm ar={ar} station={activeStation} onCancel={() => setActive("")} onSave={onSave} />
      ) : null}

      <SafetyPanel dataKey="inspection-branches" title={L("الفروع والجولة الشهرية", "Branches and the monthly round")} note={L("آخر جولة ونتيجتها وموعد التالية. الجاهزية في لوحة السلامة تُقرأ من هنا.", "Last round, its score and when the next is due. Readiness on the board reads from here.")} pad={false}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.4fr) 120px 90px 110px 150px 130px", padding: "8px 16px", background: "var(--nv-soft)", fontSize: 11, fontWeight: 700, color: "var(--nv-ink3)" }}>
              {[L("الفرع", "Branch"), L("آخر جولة", "Last round"), L("النتيجة", "Score"), L("ملاحظات مفتوحة", "Open findings"), L("الموعد", "Next"), ""].map((h, i) => <span key={i}>{h}</span>)}
            </div>
            {rows.map((row) => (
              <div key={row.station.id} data-branch-round={row.station.id} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.4fr) 120px 90px 110px 150px 130px", gap: 0, padding: "10px 16px", borderTop: "1px solid var(--nv-line2)", alignItems: "center", fontSize: 12.5 }}>
                <strong style={{ color: "var(--nv-ink)" }}>{row.station.name}</strong>
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 12, textAlign: "start" }}>{row.st.last ? String(row.st.last.at).slice(0, 10) : "—"}</span>
                <span dir="ltr" style={{ fontFamily: MONO, fontWeight: 700, textAlign: "start", color: row.st.pct == null ? "var(--nv-muted)" : scoreTone(row.st.pct) === "ok" ? "var(--nv-ok-ink)" : scoreTone(row.st.pct) === "warn" ? "var(--nv-warn-ink)" : "var(--nv-bad-ink)" }}>{row.st.pct == null ? "—" : `${row.st.pct}%`}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "start" }}>{row.openFindings || "—"}</span>
                <span>
                  {row.st.due
                    ? <AttentionChip tone={row.st.last ? "bad" : "warn"}>{row.st.last ? L("متأخرة", "Overdue") : L("لم تُجرَ جولة", "No round yet")}</AttentionChip>
                    : <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? `بعد ${row.st.dueIn} يوماً` : `In ${row.st.dueIn} days`}</span>}
                </span>
                <span>
                  {canEdit ? (
                    <button type="button" data-start-round={row.station.id} onClick={() => setActive(row.station.id)} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid var(--nv-navy, #0B3D27)", background: active === row.station.id ? "var(--nv-card)" : "var(--nv-navy, #0B3D27)", color: active === row.station.id ? "var(--nv-ink)" : "#fff" }}>
                      {active === row.station.id ? L("الجولة مفتوحة", "Round open") : L("ابدأ جولة", "Start a round")}
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SafetyPanel>

      <SafetyPanel dataKey="inspection-history" title={L("سجل الجولات", "Round history")} pad={false}>
        {history.length ? history.map(({ round, station }) => (
          <div key={round.id} data-round-row={round.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--nv-line2)", flexWrap: "wrap", fontSize: 12.5 }}>
            <span dir="ltr" style={{ fontFamily: MONO, fontSize: 12 }}>{String(round.at).slice(0, 16).replace("T", " ")}</span>
            <strong style={{ color: "var(--nv-ink)" }}>{station.name}</strong>
            <span style={{ color: "var(--nv-muted)" }}>{round.by || "—"}</span>
            <span style={{ marginInlineStart: "auto", display: "inline-flex", gap: 12, alignItems: "center" }}>
              <span style={{ color: "var(--nv-muted)" }}>{ar ? `${round.no || 0} غير مطابق · ${round.na || 0} لا ينطبق` : `${round.no || 0} not met · ${round.na || 0} n/a`}</span>
              <strong dir="ltr" style={{ fontFamily: MONO }}>{round.score == null ? "—" : `${round.score}%`}</strong>
            </span>
          </div>
        )) : <p style={{ margin: 0, padding: "14px 16px", fontSize: 12.5, color: "var(--nv-muted)" }}>{L("لم تُسجَّل جولة بعد — ابدأ أول جولة من جدول الفروع.", "No round recorded yet — start the first from the branch table.")}</p>}
      </SafetyPanel>
    </div>
  );
}
