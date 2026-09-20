import React, { useEffect, useMemo, useState } from "react";
import { hcmCall } from "@/lib/hcmApi";
import { useAuth } from "@/lib/PowerCareAuth";
import { toast } from "@/components/ui/use-toast";
import useStationScope from "@/hooks/useStationScope";
import {
  DEFAULT_OBJECTIVES,
  OBJECTIVE_SOURCES,
  OBJECTIVE_SOURCE_LABELS,
  WORK_KINDS,
  WORK_KIND_LABELS,
  checkGoalPlanGate,
  objectiveWeightTotal,
} from "@/lib/hcmDerivations";
import ReviewCyclePanel from "@/components/performance/ReviewCyclePanel";
import { ACCENT, MUTED, NAVY, bar, cardShell, tableShell, ui, field, CARD, SURFACE } from "@/lib/platformStyles";

const labelText = { display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" };
const gridCols = "minmax(150px,1.5fr) minmax(110px,1fr) 76px 84px minmax(120px,1fr) 76px";

const headRow = {
  display: "grid",
  gridTemplateColumns: gridCols,
  gap: "12px",
  padding: "10px 18px",
  background: SURFACE,
  borderTop: "1px solid #E2E8F0",
  borderBottom: "1px solid #E2E8F0",
  fontSize: "10px",
  letterSpacing: "0.06em",
  color: MUTED,
  fontWeight: 600,
};

const bodyRow = {
  display: "grid",
  gridTemplateColumns: gridCols,
  gap: "12px",
  padding: "12px 18px",
  borderBottom: "1px solid #F1F5F9",
  alignItems: "center",
  cursor: "pointer",
};

function newObjective(index) {
  return { id: `obj_${index}`, title: "", titleEn: "", source: "task", weight: 10, workKinds: [], targetPoints: "" };
}

/** Job-weighted objectives — approved task weight rolled into a scored plan per job. */
export default function JobObjectiveBoard({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, currentUser, data } = useAuth();
  const scope = useStationScope();
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [planJobId, setPlanJobId] = useState("");
  const [draft, setDraft] = useState([]);

  const isSenior = currentUser && (
    ["owner", "director", "ops_manager", "pgm", "admin", "hr_manager"].includes(currentUser.role)
    || data?.ownerId === currentUser?.id
  );

  const load = async () => {
    if (!company?.id) return;
    try {
      const remote = await hcmCall({
        action: "objectiveBoard",
        companyId: company.id,
        companyName: company.name,
        ...(scope !== "all" ? { stationId: scope } : {}),
      });
      if (remote?.ok) {
        setState(remote);
        setLoadError("");
        return;
      }
      setLoadError(ar ? (remote?.reason || "") : (remote?.reasonEn || ""));
      setState({ board: [], jobs: [], plans: {} });
    } catch {
      // Keep the weighting rules on screen even when the service is unreachable —
      // a bare error string hides the spine of task → weight → performance.
      setLoadError(ar
        ? "خطط أهداف الوظائف غير متصلة — لم تستجب خدمة HCM. الأوزان أدناه غير محمَّلة ولا تُعتمد درجة حتى تعود الخدمة."
        : "Job goal plans are offline — the HCM service did not respond. Weights below are not loaded and no score is approved until it returns.");
      setState({ board: [], jobs: [], plans: {} });
    }
  };

  useEffect(() => { load(); }, [company?.id, scope]);

  useEffect(() => {
    if (!planJobId || !state) return;
    const plan = state.plans?.[planJobId];
    setDraft(plan?.objectives?.length ? plan.objectives.map((o) => ({ ...o, targetPoints: o.targetPoints ?? "" })) : DEFAULT_OBJECTIVES.map((o) => ({ ...o, targetPoints: "" })));
  }, [planJobId, state]);

  const run = async (payload, okMsg) => {
    if (!company?.id) return false;
    setBusy(true);
    try {
      const remote = await hcmCall({ ...payload, companyId: company.id });
      if (remote?.error) {
        toast({ description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error), variant: "destructive" });
        return false;
      }
      if (okMsg) toast({ description: okMsg });
      await load();
      return true;
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const board = state?.board || [];
  const jobs = state?.jobs || [];
  const draftTotal = objectiveWeightTotal(draft);
  const draftGate = useMemo(
    () => (planJobId ? checkGoalPlanGate({ jobId: planJobId, objectives: draft, jobs }) : null),
    [planJobId, draft, jobs],
  );

  const companyScore = board.length ? Math.round(board.reduce((n, r) => n + r.score, 0) / board.length) : 0;

  if (!state) {
    return <div style={{ ...cardShell, fontSize: "12px", color: MUTED }}>{ar ? "تُحمَّل أهداف الوظائف…" : "Loading job objectives…"}</div>;
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
      {loadError ? (
        <div style={{
          borderRadius: "12px",
          border: "1px solid #FDE68A",
          background: "#FFFBEB",
          padding: "12px 16px",
          fontSize: "12px",
          lineHeight: 1.7,
          color: "#B45309",
        }}
        >
          <span style={{ fontWeight: 600 }}>{ar ? "الدرجة موقوفة · " : "Scoring held · "}</span>
          {loadError}
        </div>
      ) : null}
      <div style={cardShell}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "أهداف الوظيفة" : "Job objectives"}
          </div>
          <div style={{ textAlign: ar ? "left" : "right" }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.06em", color: MUTED, fontWeight: 600 }}>
              {ar ? "متوسط الدرجة الموزونة" : "AVG WEIGHTED SCORE"}
            </div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "30px", fontWeight: 600, color: NAVY, lineHeight: 1.2 }}>
              {companyScore}
            </div>
          </div>
        </div>
      </div>

      <div style={tableShell}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: "760px" }}>
            <div style={headRow}>
              <div>{ar ? "الموظف" : "EMPLOYEE"}</div>
              <div>{ar ? "الوظيفة" : "JOB"}</div>
              <div>{ar ? "الوزن" : "WEIGHT"}</div>
              <div>{ar ? "مهام مُثبتة" : "PROVEN"}</div>
              <div>{ar ? "الدرجة الموزونة" : "WEIGHTED"}</div>
              <div>{ar ? "التقييم" : "RATING"}</div>
            </div>
            {board.length === 0 ? (
              <div style={{ padding: "22px 18px", textAlign: "center", fontSize: "12px", color: MUTED }}>
                {ar ? "لا بيانات في هذا النطاق." : "No data in this scope."}
              </div>
            ) : board.map((r) => (
              <div key={r.employeeId}>
                <div
                  role="button"
                  tabIndex={0}
                  style={bodyRow}
                  onClick={() => setExpanded(expanded === r.employeeId ? "" : r.employeeId)}
                  onKeyDown={(e) => { if (e.key === "Enter") setExpanded(expanded === r.employeeId ? "" : r.employeeId); }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div style={{ fontSize: "10px", color: MUTED }}>
                      {r.positionRef ? `${r.positionRef} · ` : ""}
                      {r.orgUnitName || (ar ? "بلا وحدة" : "no unit")}
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", color: MUTED }}>
                    {r.jobTitle || (ar ? "بلا وظيفة" : "No job")}
                    {!r.planCustom ? (
                      <span style={{ display: "block", fontSize: "10px", color: "#B45309" }}>{ar ? "الخطة الافتراضية" : "default plan"}</span>
                    ) : null}
                  </div>
                  <div dir="ltr" style={{ fontSize: "12px", fontFamily: "'IBM Plex Sans',sans-serif", color: NAVY, textAlign: ar ? "right" : "left" }}>{r.points}</div>
                  <div dir="ltr" style={{ fontSize: "12px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: ar ? "right" : "left" }}>
                    {r.provenTasks}/{r.assignedTasks}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ flex: 1, height: "5px", borderRadius: "4px", background: "#F1F5F9", overflow: "hidden" }}>
                      <span style={bar(r.score, ACCENT)} />
                    </span>
                    <span dir="ltr" style={{ fontSize: "12px", fontWeight: 600, fontFamily: "'IBM Plex Sans',sans-serif", width: "24px", textAlign: "right", color: NAVY }}>{r.score}</span>
                  </div>
                  <div dir="ltr" style={{ fontSize: "12px", fontFamily: "'IBM Plex Sans',sans-serif", color: r.rating == null ? MUTED : ACCENT, textAlign: ar ? "right" : "left" }}>
                    {r.rating == null ? "—" : r.rating}
                  </div>
                </div>
                {expanded === r.employeeId && (
                  <div style={{ padding: "12px 18px 16px", background: SURFACE, borderBottom: "1px solid #E2E8F0" }}>
                    {r.objectives.map((o) => (
                      <div key={o.objectiveId} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "7px 0", flexWrap: "wrap" }}>
                        <span style={{ flex: "1 1 170px", fontSize: "11px", color: NAVY }}>
                          {ar ? OBJECTIVE_SOURCE_LABELS[o.source]?.ar || o.source : OBJECTIVE_SOURCE_LABELS[o.source]?.en || o.source}
                          <span style={{ color: MUTED }}> · {o.weight}%</span>
                        </span>
                        <span dir="ltr" style={{ flex: "0 0 110px", fontSize: "11px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                          {o.source === "task" ? `${o.earned} / ${o.target}` : `${o.attainmentPct}%`}
                          {o.source === "task" ? (
                            <span style={{ marginInlineStart: "6px", fontSize: "10px" }}>
                              {o.targetKind === "absolute" ? (ar ? "هدف" : "target") : (ar ? "أقران" : "peer")}
                            </span>
                          ) : null}
                        </span>
                        <span style={{ flex: "1 1 140px", height: "5px", borderRadius: "4px", background: "#E2E8F0", overflow: "hidden" }}>
                          <span style={bar(o.attainmentPct, o.source === "task" ? ACCENT : "#94A3B8")} />
                        </span>
                        <span dir="ltr" style={{ flex: "0 0 76px", fontSize: "11px", color: MUTED, textAlign: "end", fontFamily: "'IBM Plex Sans',sans-serif" }}>
                          +{o.contribution}
                        </span>
                      </div>
                    ))}
                    {r.ratingJustification ? (
                      <div style={{ marginTop: "8px", fontSize: "11px", color: MUTED, lineHeight: 1.7 }}>
                        {ar ? "مبرر المعايرة: " : "Calibration justification: "}{r.ratingJustification}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ReviewCyclePanel
        ar={ar}
        isSenior={isSenior}
        cycle={state.cycle}
        cycles={state.cycles || []}
        progress={state.progress}
        board={board}
        band={state.calibrationBand}
        busy={busy}
        onRun={run}
      />

      {/* goal plan editor */}
      {isSenior && (
        <div style={cardShell}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "خطة أهداف الوظيفة" : "Job goal plan"}</div>

          <div style={{ marginTop: "12px", maxWidth: "320px" }}>
            <span style={labelText}>{ar ? "الوظيفة" : "Job"}</span>
            <select style={field} value={planJobId} onChange={(e) => setPlanJobId(e.target.value)}>
              <option value="">{ar ? "اختر وظيفة" : "Select a job"}</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.title}</option>)}
            </select>
            {jobs.length === 0 ? (
              <div style={{ fontSize: "11px", color: "#B45309", marginTop: "6px" }}>
                {ar ? "لا وظائف في الكتالوج." : "No jobs in the catalogue."}
              </div>
            ) : null}
          </div>

          {planJobId ? (
            <div style={{ marginTop: "14px" }}>
              {draft.map((o, i) => (
                <div key={o.id || i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "10px", padding: "11px 0", borderTop: "1px solid #F1F5F9" }}>
                  <label>
                    <span style={labelText}>{ar ? "العنوان" : "Title"}</span>
                    <input
                      style={field}
                      value={o.title}
                      onChange={(e) => setDraft((rows) => rows.map((r, idx) => (idx === i ? { ...r, title: e.target.value } : r)))}
                    />
                  </label>
                  <label>
                    <span style={labelText}>{ar ? "المصدر" : "Source"}</span>
                    <select
                      style={field}
                      value={o.source}
                      onChange={(e) => setDraft((rows) => rows.map((r, idx) => (idx === i ? { ...r, source: e.target.value } : r)))}
                    >
                      {OBJECTIVE_SOURCES.map((s) => (
                        <option key={s} value={s}>{ar ? OBJECTIVE_SOURCE_LABELS[s].ar : OBJECTIVE_SOURCE_LABELS[s].en}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={labelText}>{ar ? "الوزن %" : "Weight %"}</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      style={field}
                      value={o.weight}
                      onChange={(e) => setDraft((rows) => rows.map((r, idx) => (idx === i ? { ...r, weight: Number(e.target.value) } : r)))}
                    />
                  </label>
                  {o.source === "task" ? (
                    <>
                      <label>
                        <span style={labelText}>{ar ? "أنواع العمل" : "Work kinds"}</span>
                        <select
                          multiple
                          style={{ ...field, height: "70px", padding: "6px 10px" }}
                          value={o.workKinds || []}
                          onChange={(e) => {
                            const picked = [...e.target.selectedOptions].map((opt) => opt.value);
                            setDraft((rows) => rows.map((r, idx) => (idx === i ? { ...r, workKinds: picked } : r)));
                          }}
                        >
                          {WORK_KINDS.map((k) => (
                            <option key={k} value={k}>{ar ? WORK_KIND_LABELS[k].ar : WORK_KIND_LABELS[k].en}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span style={labelText}>{ar ? "هدف النقاط (اختياري)" : "Points target (optional)"}</span>
                        <input
                          type="number"
                          min="0"
                          style={field}
                          value={o.targetPoints ?? ""}
                          onChange={(e) => setDraft((rows) => rows.map((r, idx) => (idx === i ? { ...r, targetPoints: e.target.value } : r)))}
                        />
                      </label>
                    </>
                  ) : null}
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                      type="button"
                      style={{ ...ui.btnRow, background: CARD, color: MUTED, border: "1px solid #E2E8F0" }}
                      onClick={() => setDraft((rows) => rows.filter((_, idx) => idx !== i))}
                    >
                      {ar ? "احذف" : "Remove"}
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "13px", flexWrap: "wrap" }}>
                <button type="button" style={{ ...ui.btnRow, background: CARD, color: NAVY, border: "1px solid #E2E8F0" }} onClick={() => setDraft((rows) => [...rows, newObjective(rows.length + 1)])}>
                  {ar ? "+ هدف" : "+ Objective"}
                </button>
                <span style={{ flex: "1 1 200px", fontSize: "11px", color: draftGate && !draftGate.ok ? "#B45309" : MUTED, lineHeight: 1.7 }}>
                  {draftGate && !draftGate.ok
                    ? (ar ? draftGate.reason : draftGate.reasonEn)
                    : (ar ? `المجموع ${draftTotal}%` : `Total ${draftTotal}%`)}
                </span>
                <button
                  type="button"
                  disabled={busy || !draftGate?.ok}
                  style={{ ...ui.btnPrimary, opacity: busy || !draftGate?.ok ? 0.5 : 1, cursor: draftGate?.ok ? "pointer" : "not-allowed" }}
                  onClick={() => run({ action: "setGoalPlan", jobId: planJobId, objectives: draft }, ar ? "حُفظت خطة الأهداف" : "Goal plan saved")}
                >
                  {ar ? "احفظ الخطة" : "Save plan"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
