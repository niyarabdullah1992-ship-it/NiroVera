import React, { useMemo, useState } from "react";
import TwoPaneWorkspace, { ListStack } from "@/components/shared/TwoPaneWorkspace";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";
import { DisciplineRow, DisciplineRowList, AttentionChip, ArticleBadge } from "@/components/discipline/DisciplineRows";
import { FieldLabel, GateLine, LawLine, SendButton, StepHead, inputStyle, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import { SAFETY_LIKELIHOOD, SAFETY_SEVERITY } from "@/lib/safetyReportCard";
import { RISK_BAND_LABEL, RISK_CONTROL_LEVELS, RISK_REVIEW_MONTHS, checkRiskAssessmentGate, riskBand, riskRegisterState } from "@/lib/safetyOps";
import { SafetyKpiRow, SafetyPanel, safetyShell } from "@/components/safety/SafetyOpsKit";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

function bandInk(band) {
  if (band === "critical" || band === "high") return "var(--nv-bad-ink, #9B2335)";
  if (band === "medium") return "var(--nv-warn-ink, #8A5A12)";
  if (band === "low") return "var(--nv-ok-ink, #3C7D50)";
  return "var(--nv-muted)";
}

function Scale({ ar, label, value, onChange, words, dataKey }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel note={value ? (ar ? words[value - 1].ar : words[value - 1].en) : ""}>{label}</FieldLabel>
      <div role="radiogroup" data-scale={dataKey} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <button key={n} type="button" role="radio" aria-checked={on} data-grade={n} onClick={() => onChange(n)} style={{ fontFamily: MONO, height: 34, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${on ? "var(--nv-navy, #0B3D27)" : "var(--nv-line)"}`, background: on ? "var(--nv-navy, #0B3D27)" : "var(--nv-card)", color: on ? "#fff" : "var(--nv-ink2)" }}>
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoreChip({ ar, score }) {
  const band = riskBand(score);
  return (
    <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999, border: "1px solid var(--nv-line)", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: bandInk(band), background: "var(--nv-card)" }}>
      {score || "—"}/25
      {band ? <span style={{ fontFamily: "inherit", fontSize: 10.5, fontWeight: 600 }}>{ar ? RISK_BAND_LABEL[band].ar : RISK_BAND_LABEL[band].en}</span> : null}
    </span>
  );
}

const EMPTY = { activity: "", hazard: "", likelihood: 0, severity: 0, controlId: "", control: "", residualLikelihood: 0, residualSeverity: 0, owner: "" };

function RiskForm({ ar, stations, editing, onSave, onCancel }) {
  const L = (a, e) => (ar ? a : e);
  const [form, setForm] = useState(editing ? { ...EMPTY, ...editing.item, stationId: editing.stationId } : { ...EMPTY, stationId: stations[0]?.id || "" });
  const patch = (next) => setForm((cur) => ({ ...cur, ...next }));
  const gate = checkRiskAssessmentGate(form);
  const inherent = form.likelihood * form.severity;
  const residual = form.residualLikelihood * form.residualSeverity;
  return (
    <section data-risk-form={editing ? editing.item.id : "new"} style={{ ...safetyShell, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "12px 16px", borderBottom: "1px solid var(--nv-line)" }}>
        <strong style={{ fontSize: 13.5 }}>{editing ? L("مراجعة تقييم", "Review an assessment") : L("تقييم خطر جديد", "New risk assessment")}</strong>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>{L("قدّر الخطر قبل الضابط، اختر مستواه من الهرم، ثم قدّر ما يبقى. ما يبقى حرجاً لا يُقبل.", "Grade the risk before the control, pick its level on the hierarchy, then grade what remains. A critical residual is not accepted.")}</span>
      </header>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <LawLine cite="ISO 45001 · 6.1.2 / 8.1.2">{L("تحديد الأخطار وتقييم المخاطر، وخفضها بهرم الضوابط: إزالة، استبدال، ضابط هندسي، ضابط إداري، ثم معدات الوقاية أخيراً.", "Hazard identification and risk assessment; reduce by the hierarchy: eliminate, substitute, engineer, administer, then PPE last.")}</LawLine>
        <StepHead first label={L("النشاط والخطر", "Activity and hazard")} />
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("الفرع", "Branch")}</FieldLabel>
          <select data-risk-field="station" value={form.stationId} disabled={Boolean(editing)} onChange={(e) => patch({ stationId: e.target.value })} style={inputStyle}>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("النشاط أو المهمة", "Activity or task")}</FieldLabel>
          <input data-risk-field="activity" value={form.activity} onChange={(e) => patch({ activity: e.target.value })} placeholder={L("مثال: تفريغ الشاحنات بالرافعة الشوكية", "e.g. Unloading trucks by forklift")} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("الخطر — وكيف يقع الضرر", "The hazard — and how harm occurs")}</FieldLabel>
          <textarea data-risk-field="hazard" value={form.hazard} onChange={(e) => patch({ hazard: e.target.value })} placeholder={L("مثال: اصطدام المشاة بالرافعة في ممر مشترك", "e.g. Pedestrians struck by the forklift in a shared aisle")} style={{ ...textareaStyle, minHeight: 56 }} />
        </label>
        <StepHead label={L("الخطر قبل الضابط", "Risk before the control")} note={inherent ? <ScoreChip ar={ar} score={inherent} /> : null} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
          <Scale ar={ar} dataKey="L" label={L("الاحتمال", "Likelihood")} value={form.likelihood} onChange={(n) => patch({ likelihood: n })} words={SAFETY_LIKELIHOOD} />
          <Scale ar={ar} dataKey="S" label={L("الشدة", "Severity")} value={form.severity} onChange={(n) => patch({ severity: n })} words={SAFETY_SEVERITY} />
        </div>
        <StepHead label={L("الضابط — من هرم الضوابط", "The control — on the hierarchy")} />
        <div role="radiogroup" data-risk-controls="1" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {RISK_CONTROL_LEVELS.map((row) => {
            const on = form.controlId === row.id;
            return (
              <button key={row.id} type="button" role="radio" aria-checked={on} data-control-level={row.id} onClick={() => patch({ controlId: row.id })} style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, height: 36, padding: "0 12px", borderRadius: 8, cursor: "pointer", textAlign: "start", border: `1px solid ${on ? "var(--nv-navy, #0B3D27)" : "var(--nv-line)"}`, background: on ? "var(--nv-navy, #0B3D27)" : "var(--nv-card)", color: on ? "#fff" : "var(--nv-ink)" }}>
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 11, opacity: 0.8 }}>{row.rank}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{ar ? row.ar : row.en}</span>
                {row.id === "ppe" ? <span style={{ marginInlineStart: "auto", fontSize: 10.5, opacity: 0.8 }}>{L("الملاذ الأخير", "Last resort")}</span> : null}
              </button>
            );
          })}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("ما الذي يُفعل بالضبط؟", "What exactly is done?")}</FieldLabel>
          <textarea data-risk-field="control" value={form.control} onChange={(e) => patch({ control: e.target.value })} placeholder={L("مثال: فصل ممر المشاة بحاجز معدني وخط أصفر، وبوق عند المنعطفات", "e.g. Separate the walkway with a steel barrier and a yellow line; horn at corners")} style={{ ...textareaStyle, minHeight: 56 }} />
        </label>
        <StepHead label={L("الخطر المتبقي بعد الضابط", "Residual risk after the control")} note={residual ? <ScoreChip ar={ar} score={residual} /> : null} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
          <Scale ar={ar} dataKey="rL" label={L("الاحتمال", "Likelihood")} value={form.residualLikelihood} onChange={(n) => patch({ residualLikelihood: n })} words={SAFETY_LIKELIHOOD} />
          <Scale ar={ar} dataKey="rS" label={L("الشدة", "Severity")} value={form.residualSeverity} onChange={(n) => patch({ residualSeverity: n })} words={SAFETY_SEVERITY} />
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("مسؤول الضابط", "Control owner")}</FieldLabel>
          <input data-risk-field="owner" value={form.owner} onChange={(e) => patch({ owner: e.target.value })} style={inputStyle} />
        </label>
        <GateLine gate={gate} ar={ar} dataAttr={{ "data-risk-gate": "1" }} />
        <SendButton ready={gate.ok} dataAttr={{ "data-risk-save": "1" }} onClick={() => { if (onSave(form)) { if (editing) onCancel(); else setForm({ ...EMPTY, stationId: form.stationId }); } }}>
          {editing ? L("اعتمد المراجعة", "Record the review") : L("سجّل التقييم", "Record the assessment")}
        </SendButton>
        {editing ? <button type="button" onClick={onCancel} style={{ fontFamily: "inherit", height: 36, borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{L("إلغاء", "Cancel")}</button> : null}
      </div>
    </section>
  );
}

/** تقييم المخاطر — the branch risk registers: inherent → control level → residual, reviewed yearly. */
export default function RiskRegister({ ar, stations, recFor, canEdit, onSave }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const rows = useMemo(() => stations.flatMap((s) => riskRegisterState(recFor(s.id)?.riskItems || [], now).rows.map((row) => ({ ...row, stationId: s.id, stationName: s.name }))), [stations, recFor, now]);
  const state = { total: rows.length, high: rows.filter((r) => r.band === "high" || r.band === "critical").length, reviewDue: rows.filter((r) => r.reviewDue).length, ppeOnly: rows.filter((r) => r.ppeOnly).length };
  const [face, setFace] = useState("all");
  const [editing, setEditing] = useState(null);
  const faces = [
    { id: "all", label: L("الكل", "All"), n: rows.length, test: () => true },
    { id: "high", label: L("مرتفعة", "High"), n: state.high, test: (r) => r.band === "high" || r.band === "critical" },
    { id: "review", label: L("تحتاج مراجعة", "Review due"), n: state.reviewDue, test: (r) => r.reviewDue },
    { id: "ppe", label: L("معدات الوقاية وحدها", "PPE only"), n: state.ppeOnly, test: (r) => r.ppeOnly },
  ];
  const shown = rows.filter((faces.find((f) => f.id === face) || faces[0]).test).sort((a, b) => b.residual - a.residual);
  const fold = useCollapsibleItems(shown.map((r) => r.item.id));
  return (
    <div data-hse="admin-risks" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SafetyKpiRow items={[
        { key: "total", label: L("أخطار مقيَّمة", "Hazards assessed"), value: state.total, sub: L("في سجلات الفروع", "Across the branch registers"), tone: null },
        { key: "high", label: L("خطر متبقٍ مرتفع", "High residual"), value: state.high, sub: L("يحتاج ضابطاً أعلى في الهرم", "Needs a higher control on the hierarchy"), tone: state.high ? "bad" : "ok" },
        { key: "review", label: L("مراجعة مستحقة", "Review due"), value: state.reviewDue, sub: ar ? `كل ${RISK_REVIEW_MONTHS} شهراً أو بعد حادث` : `Every ${RISK_REVIEW_MONTHS} months or after an incident`, tone: state.reviewDue ? "warn" : "ok" },
        { key: "ppe", label: L("تعتمد على معدات الوقاية", "Relying on PPE"), value: state.ppeOnly, sub: L("ضابط من المستوى الأخير وخطر ≥ 10", "Last-level control with residual ≥ 10"), tone: state.ppeOnly ? "warn" : "ok" },
      ]} />
      <TwoPaneWorkspace
        dataKey="safety-risks"
        raise={canEdit && stations.length ? <RiskForm key={editing?.item.id || "new"} ar={ar} stations={stations} editing={editing} onSave={onSave} onCancel={() => setEditing(null)} /> : null}
        list={(
          <ListStack data-risk-list="1">
            <StatusFilterPills card dataKey="risks" title={L("سجل المخاطر", "Risk register")} value={face} onChange={setFace} items={faces} />
            <DisciplineRowList dataKey="risks" empty={L("لا تقييم بعد — ابدأ بأخطر نشاط في الفرع.", "No assessment yet — start with the branch's most hazardous activity.")}>
              {shown.map((row) => (
                <DisciplineRow
                  key={row.item.id}
                  id={row.item.id}
                  dataKey="risk"
                  ar={ar}
                  badge={<ScoreChip ar={ar} score={row.residual} />}
                  title={row.item.activity}
                  sub={`${row.stationName} · ${row.item.hazard}`}
                  date={String(row.item.reviewedAt || "").slice(0, 10)}
                  chip={row.reviewDue ? <AttentionChip tone="warn">{L("مراجعة مستحقة", "Review due")}</AttentionChip> : row.ppeOnly ? <AttentionChip tone="warn">{L("معدات الوقاية وحدها", "PPE only")}</AttentionChip> : null}
                  open={fold.isOpen(row.item.id)}
                  onOpen={() => fold.toggle(row.item.id)}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 8 }}>
                      {[
                        [L("قبل الضابط", "Before control"), <ScoreChip ar={ar} score={row.inherent} />],
                        [L("مستوى الضابط", "Control level"), <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ArticleBadge>{row.level?.rank || "—"}</ArticleBadge>{row.level ? (ar ? row.level.ar : row.level.en) : "—"}</span>],
                        [L("بعد الضابط", "After control"), <ScoreChip ar={ar} score={row.residual} />],
                        [L("المسؤول", "Owner"), row.item.owner || "—"],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px", borderRadius: 8, background: "var(--nv-soft)" }}>
                          <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{k}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: "var(--nv-ink2)" }}>{row.item.control}</p>
                    <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? `آخر مراجعة ${String(row.item.reviewedAt || "").slice(0, 10)} · ${row.item.reviewedBy || "—"}` : `Last review ${String(row.item.reviewedAt || "").slice(0, 10)} · ${row.item.reviewedBy || "—"}`}</span>
                    {canEdit ? (
                      <button type="button" data-risk-review={row.item.id} onClick={() => { setEditing(row); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ fontFamily: "inherit", alignSelf: "flex-start", height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-navy, #0B3D27)", background: "var(--nv-navy, #0B3D27)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {L("راجع التقييم", "Review")}
                      </button>
                    ) : null}
                  </div>
                </DisciplineRow>
              ))}
            </DisciplineRowList>
          </ListStack>
        )}
      />
      <SafetyPanel dataKey="risk-matrix" title={L("مصفوفة الخطر المتبقي", "Residual-risk matrix")} note={L("كل خانة تعدّ التقييمات بخطرها المتبقي — الاحتمال أفقياً والشدة من الأعلى.", "Each cell counts assessments by residual risk — likelihood across, severity from the top.")}>
        <div style={{ display: "grid", gridTemplateColumns: "18px repeat(5, 40px)", gap: 4, justifyContent: "center", alignItems: "center" }}>
          {[5, 4, 3, 2, 1].map((sev) => (
            <React.Fragment key={sev}>
              <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--nv-ink3)", textAlign: "center" }}>{sev}</span>
              {[1, 2, 3, 4, 5].map((lik) => {
                const n = rows.filter((r) => Number(r.item.residualLikelihood) === lik && Number(r.item.residualSeverity) === sev).length;
                const band = riskBand(lik * sev);
                const bg = band === "critical" ? "#C74B5E" : band === "high" ? "#E7A0AA" : band === "medium" ? "#EFD08F" : "#A9D4B7";
                return <span key={lik} dir="ltr" data-risk-cell={`${lik}x${sev}`} style={{ width: 40, height: 30, borderRadius: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 13, fontWeight: 700, background: bg, color: n ? (band === "critical" ? "#fff" : "#111418") : "transparent", outline: n ? "2px solid var(--nv-ink)" : "none", outlineOffset: 1 }}>{n || ""}</span>;
              })}
            </React.Fragment>
          ))}
          <span />
          {[1, 2, 3, 4, 5].map((lik) => <span key={lik} dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--nv-ink3)", textAlign: "center" }}>{lik}</span>)}
        </div>
      </SafetyPanel>
    </div>
  );
}
