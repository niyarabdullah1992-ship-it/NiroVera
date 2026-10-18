import React, { useState } from "react";
import { citeRule } from "@/lib/laborRules";
import { FieldLabel, GateLine, SendButton, inputStyle, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import { ArticleBadge, AttentionChip } from "@/components/discipline/DisciplineRows";
import { DRILL_TYPES, checkDrillGate, drillState } from "@/lib/safetyOps";
import { SafetyPanel } from "@/components/safety/SafetyOpsKit";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

function DrillForm({ ar, stations, today, onSave, onCancel, preset }) {
  const L = (a, e) => (ar ? a : e);
  const [form, setForm] = useState({ type: preset?.type || "evacuation", stationId: preset?.stationId || stations[0]?.id || "", date: today, participants: "", evacuationMinutes: "", outcome: "", findings: "" });
  const patch = (next) => setForm((cur) => ({ ...cur, ...next }));
  const draft = { ...form, participants: form.participants === "" ? "" : Number(form.participants), evacuationMinutes: form.evacuationMinutes === "" ? "" : Number(form.evacuationMinutes) };
  const gate = checkDrillGate(draft);
  const pick = (on) => ({ fontFamily: "inherit", height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", border: `1px solid ${on ? "var(--nv-navy, #0B3D27)" : "var(--nv-line)"}`, background: on ? "var(--nv-navy, #0B3D27)" : "var(--nv-card)", color: on ? "#fff" : "var(--nv-ink)" });
  return (
    <div data-drill-form="1" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", borderTop: "1px solid var(--nv-line)", background: "var(--nv-soft)" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {DRILL_TYPES.map((t) => <button key={t.id} type="button" data-drill-type={t.id} onClick={() => patch({ type: t.id })} style={pick(form.type === t.id)}>{ar ? t.ar : t.en}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("الفرع", "Branch")}</FieldLabel>
          <select data-drill-field="station" value={form.stationId} onChange={(e) => patch({ stationId: e.target.value })} style={inputStyle}>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("التاريخ", "Date")}</FieldLabel>
          <input data-drill-field="date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} style={{ ...inputStyle, fontFamily: MONO }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("المشاركون", "Participants")}</FieldLabel>
          <input data-drill-field="participants" inputMode="numeric" value={form.participants} onChange={(e) => patch({ participants: e.target.value.replace(/[^0-9]/g, "") })} style={{ ...inputStyle, fontFamily: MONO }} />
        </label>
        {form.type === "evacuation" ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel>{L("زمن الإخلاء الكامل (دقائق)", "Full evacuation (minutes)")}</FieldLabel>
            <input data-drill-field="minutes" inputMode="decimal" value={form.evacuationMinutes} onChange={(e) => patch({ evacuationMinutes: e.target.value.replace(/[^0-9.]/g, "") })} style={{ ...inputStyle, fontFamily: MONO }} />
          </label>
        ) : null}
      </div>
      <div role="radiogroup" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{L("النتيجة:", "Outcome:")}</span>
        <button type="button" data-drill-outcome="met" onClick={() => patch({ outcome: "met" })} style={pick(form.outcome === "met")}>{L("الهدف تحقق", "Objective met")}</button>
        <button type="button" data-drill-outcome="gaps" onClick={() => patch({ outcome: "gaps" })} style={pick(form.outcome === "gaps")}>{L("ظهرت ثغرات", "Gaps found")}</button>
      </div>
      {form.outcome === "gaps" ? <textarea data-drill-field="findings" value={form.findings} onChange={(e) => patch({ findings: e.target.value })} placeholder={L("ما الثغرات؟ — تُرفع بلاغاً في «بلاغات السلامة»", "What gaps? — raised as a report in Safety reports")} style={{ ...textareaStyle, minHeight: 52 }} /> : null}
      <GateLine gate={gate} ar={ar} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><SendButton ready={gate.ok} dataAttr={{ "data-drill-save": "1" }} onClick={() => { if (onSave(draft)) onCancel(); }}>{L("سجّل التمرين", "Record the drill")}</SendButton></div>
        <button type="button" onClick={onCancel} style={{ fontFamily: "inherit", height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{L("إلغاء", "Cancel")}</button>
      </div>
    </div>
  );
}

/** Emergency preparedness (ISO 45001 §8.2) — the drill cadence per branch and the log. */
export default function DrillLog({ ar, stations, recFor, canEdit, today, onSave }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const [open, setOpen] = useState(null);
  const rows = stations.map((s) => ({ station: s, st: drillState(recFor(s.id) || {}, now) }));
  const log = rows.flatMap((r) => r.st.drills.map((d) => ({ d, station: r.station }))).sort((a, b) => String(b.d.date).localeCompare(String(a.d.date))).slice(0, 10);
  const fire = citeRule("safety.fire.cite");
  return (
    <SafetyPanel
      dataKey="drills"
      title={L("الاستعداد للطوارئ — التمارين", "Emergency preparedness — drills")}
      note={L("إخلاء كل 6 أشهر، ومكافحة حريق وإسعاف أولي كل 12 شهراً. ثغرات التمرين تُرفع بلاغاً يُعالج.", "Evacuation every 6 months; fire-fighting and first aid every 12. Drill gaps are raised as a report to fix.")}
      trailing={canEdit ? <button type="button" data-drill-new="1" onClick={() => setOpen(open ? null : { type: "evacuation" })} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-navy, #0B3D27)", background: open ? "var(--nv-card)" : "var(--nv-navy, #0B3D27)", color: open ? "var(--nv-ink)" : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{open ? L("أغلق النموذج", "Close the form") : L("سجّل تمريناً", "Record a drill")}</button> : null}
      pad={false}
    >
      {open && canEdit ? <DrillForm key={`${open.type}-${open.stationId || ""}`} ar={ar} stations={stations} today={today} onSave={onSave} onCancel={() => setOpen(null)} preset={open} /> : null}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 560 }}>
          <div style={{ display: "grid", gridTemplateColumns: `minmax(140px,1.3fr) repeat(${DRILL_TYPES.length}, minmax(130px,1fr))`, padding: "8px 16px", background: "var(--nv-soft)", fontSize: 11, fontWeight: 700, color: "var(--nv-ink3)" }}>
            <span>{L("الفرع", "Branch")}</span>
            {DRILL_TYPES.map((t) => <span key={t.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>{ar ? t.ar : t.en}{t.cite && fire ? <ArticleBadge>{ar ? fire.labelAr : fire.labelEn}</ArticleBadge> : null}</span>)}
          </div>
          {rows.map((r) => (
            <div key={r.station.id} data-drill-branch={r.station.id} style={{ display: "grid", gridTemplateColumns: `minmax(140px,1.3fr) repeat(${DRILL_TYPES.length}, minmax(130px,1fr))`, padding: "10px 16px", borderTop: "1px solid var(--nv-line2)", alignItems: "center", fontSize: 12.5 }}>
              <strong>{r.station.name}</strong>
              {r.st.types.map((t) => (
                <span key={t.type.id} data-drill-cell={t.type.id} style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                  {t.last ? <span dir="ltr" style={{ fontFamily: MONO, fontSize: 12 }}>{t.last.date}{t.last.evacuationMinutes ? ` · ${t.last.evacuationMinutes} min` : ""}</span> : null}
                  {t.due
                    ? <AttentionChip tone={t.last ? "bad" : "warn"}>{t.last ? L("متأخر", "Overdue") : L("لم يُجرَ", "Not held")}</AttentionChip>
                    : <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? `التالي بعد ${t.dueIn} يوماً` : `Next in ${t.dueIn} days`}</span>}
                  {canEdit && t.due ? <button type="button" data-drill-start={`${r.station.id}:${t.type.id}`} onClick={() => setOpen({ type: t.type.id, stationId: r.station.id })} style={{ fontFamily: "inherit", height: 24, padding: "0 8px", borderRadius: 6, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{L("سجّل", "Record")}</button> : null}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      {log.length ? (
        <div style={{ borderTop: "1px solid var(--nv-line)" }}>
          {log.map(({ d, station }) => (
            <div key={d.id} data-drill-row={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderTop: "1px solid var(--nv-line2)", flexWrap: "wrap", fontSize: 12 }}>
              <span dir="ltr" style={{ fontFamily: MONO }}>{d.date}</span>
              <strong>{station.name}</strong>
              <span>{ar ? DRILL_TYPES.find((t) => t.id === d.type)?.ar : DRILL_TYPES.find((t) => t.id === d.type)?.en}</span>
              <span style={{ color: "var(--nv-muted)" }}>{ar ? `${d.participants} مشاركاً` : `${d.participants} took part`}{d.evacuationMinutes ? (ar ? ` · إخلاء في ${d.evacuationMinutes} د` : ` · evacuated in ${d.evacuationMinutes} min`) : ""}</span>
              <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: d.outcome === "met" ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)" }}>{d.outcome === "met" ? L("الهدف تحقق", "Met") : L("ثغرات — رُفع بلاغ", "Gaps — report raised")}</span>
            </div>
          ))}
        </div>
      ) : null}
    </SafetyPanel>
  );
}
