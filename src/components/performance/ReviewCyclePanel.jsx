import React, { useState } from "react";
import { CALIBRATION_BAND, CYCLE_FLOW, CYCLE_STATUS_LABELS, RATING_JUSTIFICATION_MIN, todayKey } from "@/lib/hcmDerivations";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { ACCENT, MUTED, NAVY, cardShell, ui, field, SURFACE } from "@/lib/platformStyles";
import { PERF_ELEMENTS, PERF_LEVELS, checkReportElementsGate, perfLevelOf } from "@/lib/perfReport";

const labelText = { display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" };

/** Review cycle — a cycle consumes proven evidence; a manager may only calibrate it. */
export default function ReviewCyclePanel({ ar, isSenior, cycle, cycles = [], progress, board = [], band = CALIBRATION_BAND, busy, onRun, grievances = [] }) {
  const [newCycle, setNewCycle] = useState({ period: "", from: todayKey(), to: todayKey() });
  const [rating, setRating] = useState({ employeeId: "", value: "", justification: "", elements: {} });
  const [decide, setDecide] = useState({ ratingId: "", decision: "", note: "", newRating: "" });
  const elementsGate = checkReportElementsGate(rating.elements);
  const ratedLevel = rating.value === "" ? null : perfLevelOf(rating.value);
  const nameOf = (id) => board.find((r) => String(r.employeeId) === String(id))?.name || id;

  const status = cycle ? String(cycle.status) : null;
  const nextStates = status ? CYCLE_FLOW[status] || [] : [];
  const selected = board.find((r) => r.employeeId === rating.employeeId) || null;
  const derived = selected ? selected.score : null;
  const low = derived == null ? null : Math.max(0, derived - band);
  const high = derived == null ? null : Math.min(100, derived + band);

  return (
    <div style={cardShell}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", fontSize: "13px", fontWeight: 600, color: NAVY }}>
          {ar ? "دورة التقييم" : "Review cycle"}
        </div>
        {cycle ? (
          <span style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "4px 11px",
            borderRadius: 999,
            background: status === "closed" ? "var(--nv-mute-soft)" : "var(--nv-ok-soft)",
            color: status === "closed" ? MUTED : "var(--nv-ok-ink)",
            border: `1px solid ${status === "closed" ? "var(--nv-mute-line)" : "var(--nv-ok-line)"}`,
          }}
          >
            {cycle.period} · {ar ? CYCLE_STATUS_LABELS[status]?.ar || status : CYCLE_STATUS_LABELS[status]?.en || status}
          </span>
        ) : null}
      </div>

      {cycle ? (
        <div style={{ marginTop: "12px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <span dir="ltr" style={{ fontSize: "11px", color: MUTED }}>{cycle.from} → {cycle.to}</span>
          {progress ? (
            <span style={{ fontSize: "11px", color: MUTED }}>
              {ar ? `قُيِّم ${progress.rated} من ${progress.total}` : `${progress.rated} of ${progress.total} rated`}
              {" · "}
              <span style={{ color: progress.pct === 100 ? ACCENT : "var(--nv-warn-ink)" }}>{progress.pct}%</span>
            </span>
          ) : null}
          {isSenior && nextStates.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              style={{ ...ui.btnRow, opacity: busy ? 0.6 : 1 }}
              onClick={() => onRun(
                { action: "advanceCycle", cycleId: cycle.id, status: s },
                ar ? `انتقلت الدورة إلى ${CYCLE_STATUS_LABELS[s]?.ar || s}` : `Cycle moved to ${CYCLE_STATUS_LABELS[s]?.en || s}`,
              )}
            >
              {ar ? `انقل إلى ${CYCLE_STATUS_LABELS[s]?.ar || s}` : `Move to ${CYCLE_STATUS_LABELS[s]?.en || s}`}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: "10px", fontSize: "11px", color: MUTED }}>
          {ar ? "لا دورة مفتوحة." : "No open cycle."}
        </div>
      )}

      {isSenior && (
        <details style={{ marginTop: "14px" }}>
          <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600, color: NAVY, listStyle: "none" }}>
            {ar ? "افتح دورة جديدة" : "Open a new cycle"}
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "11px", marginTop: "12px" }}>
            <label>
              <span style={labelText}>{ar ? "الفترة" : "Period"}</span>
              <input style={field} placeholder="2026-Q4" value={newCycle.period} onChange={(e) => setNewCycle((f) => ({ ...f, period: e.target.value }))} />
            </label>
            <label>
              <span style={labelText}>{ar ? "من" : "From"}</span>
              <PlatformDateField ar={ar} value={newCycle.from} onChange={(next) => setNewCycle((f) => ({ ...f, from: next }))} />
            </label>
            <label>
              <span style={labelText}>{ar ? "إلى" : "To"}</span>
              <PlatformDateField ar={ar} value={newCycle.to} min={newCycle.from} onChange={(next) => setNewCycle((f) => ({ ...f, to: next }))} />
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                disabled={busy}
                style={{ ...ui.btnPrimary, opacity: busy ? 0.6 : 1 }}
                onClick={() => onRun({ action: "createCycle", ...newCycle }, ar ? "فُتحت الدورة" : "Cycle opened")}
              >
                {ar ? "افتح الدورة" : "Open cycle"}
              </button>
            </div>
          </div>
        </details>
      )}

      {isSenior && cycle && ["manager_review", "calibration"].includes(status) && (
        <div style={{ marginTop: "14px", padding: "15px 16px", borderRadius: "12px", background: SURFACE, border: "1px solid var(--nv-line)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>{ar ? "معايرة درجة موظف" : "Calibrate an employee score"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "11px", marginTop: "11px" }}>
            <label>
              <span style={labelText}>{ar ? "الموظف" : "Employee"}</span>
              <select
                style={field}
                value={rating.employeeId}
                onChange={(e) => {
                  const employeeId = e.target.value;
                  const row = board.find((r) => r.employeeId === employeeId);
                  setRating({ employeeId, value: row ? String(row.score) : "", justification: "", elements: {} });
                }}
              >
                <option value="">{ar ? "اختر موظفًا" : "Select an employee"}</option>
                {board.map((r) => <option key={r.employeeId} value={r.employeeId}>{r.name}</option>)}
              </select>
            </label>
            <label>
              <span style={labelText}>
                {ar ? "التقييم" : "Rating"}
                {derived != null ? (
                  <span dir="ltr" style={{ fontWeight: 400 }}> · {ar ? "المشتق" : "derived"} {derived} ({low}–{high})</span>
                ) : null}
              </span>
              <input type="number" min="0" max="100" style={field} value={rating.value} onChange={(e) => setRating((f) => ({ ...f, value: e.target.value }))} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={labelText}>
                {ar ? `المبرر (${RATING_JUSTIFICATION_MIN} حرفًا فأكثر عند تعديل الدرجة)` : `Justification (${RATING_JUSTIFICATION_MIN}+ characters when adjusting)`}
              </span>
              <input style={field} value={rating.justification} onChange={(e) => setRating((f) => ({ ...f, justification: e.target.value }))} />
            </label>
            {PERF_ELEMENTS.map((el) => (
              <label key={el.key}>
                <span style={labelText}>{ar ? el.ar : el.en}</span>
                <select style={field} value={rating.elements[el.key] || ""} onChange={(e) => setRating((f) => ({ ...f, elements: { ...f.elements, [el.key]: e.target.value } }))}>
                  <option value="">{ar ? "المستوى" : "Level"}</option>
                  {PERF_LEVELS.map((lv) => <option key={lv.level} value={lv.level}>{ar ? `${lv.level} — ${lv.ar}` : `${lv.level} — ${lv.en}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div style={{ marginTop: "8px", fontSize: "11px", color: MUTED, lineHeight: 1.7 }}>
            {ar
              ? `التقدير العام: ${ratedLevel ? ratedLevel.ar : "—"} (مقياس من خمسة مستويات — النموذج الموحد م19). يعدّه الرئيس المباشر، ويُعتمد بإقفال الدورة، فتصل صورته للموظف في «أدائي» وله التظلم منه خلال 30 يوماً (م20 · م71).`
              : `Overall: ${ratedLevel ? ratedLevel.en : "—"} (five-level scale, model Art. 19). Approved when the cycle closes; the worker then sees his copy in My performance and may grieve within 30 days (Arts. 20 · 71).`}
            {!elementsGate.ok && rating.employeeId ? <span style={{ display: "block", color: "var(--nv-warn-ink)" }}>{ar ? elementsGate.reason : elementsGate.reasonEn}</span> : null}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
            <button
              type="button"
              disabled={busy || !rating.employeeId || !elementsGate.ok}
              style={{ ...ui.btnPrimary, opacity: busy || !rating.employeeId || !elementsGate.ok ? 0.6 : 1 }}
              onClick={() => onRun(
                {
                  action: "submitRating",
                  cycleId: cycle.id,
                  employeeId: rating.employeeId,
                  derivedScore: derived,
                  rating: Number(rating.value),
                  justification: rating.justification,
                  elements: elementsGate.elements,
                },
                ar ? "سُجِّل التقييم" : "Rating recorded",
              )}
            >
              {ar ? "سجّل التقييم" : "Record rating"}
            </button>
          </div>
        </div>
      )}

      {isSenior && grievances.length ? (
        <div data-perf-grievances="1" style={{ marginTop: "14px", padding: "15px 16px", borderRadius: "12px", background: SURFACE, border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>
            {ar ? `تظلمات من تقارير الأداء (${grievances.length}) — النموذج الموحد م20 · م71` : `Grievances on performance reports (${grievances.length}) — model Arts. 20 · 71`}
          </div>
          {grievances.map((g) => {
            const open = decide.ratingId === g.ratingId;
            return (
              <div key={g.ratingId} style={{ borderTop: "1px dashed var(--nv-line)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: NAVY }}>{`${nameOf(g.employeeId)} · ${g.period} · ${g.rating}`}</span>
                <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>{g.reason}</span>
                <span style={{ fontSize: 11, color: g.replyBy && g.replyBy < todayKey() ? "var(--nv-bad-ink)" : MUTED }}>{ar ? `يُبلَّغ بالنتيجة كتابةً حتى ${g.replyBy || "—"}` : `Answer in writing by ${g.replyBy || "—"}`}</span>
                {open ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 8 }}>
                    <select style={field} value={decide.decision} onChange={(e) => setDecide((d) => ({ ...d, decision: e.target.value }))}>
                      <option value="">{ar ? "القرار" : "Decision"}</option>
                      <option value="upheld">{ar ? "قبول التظلم" : "Uphold"}</option>
                      <option value="refused">{ar ? "رفض التظلم" : "Refuse"}</option>
                    </select>
                    {decide.decision === "upheld" ? (
                      <input type="number" min="0" max="100" dir="ltr" style={field} placeholder={ar ? "الدرجة المعدّلة (اختياري)" : "Revised rating (optional)"} value={decide.newRating} onChange={(e) => setDecide((d) => ({ ...d, newRating: e.target.value }))} />
                    ) : null}
                    <input style={{ ...field, gridColumn: "1 / -1" }} placeholder={ar ? "نتيجة البتّ وسببها — تُبلَّغ للموظف" : "Decision and reason — sent to the worker"} value={decide.note} onChange={(e) => setDecide((d) => ({ ...d, note: e.target.value }))} />
                    <button type="button" disabled={busy} style={{ ...ui.btnPrimary, justifySelf: "start" }} onClick={() => onRun(
                      { action: "decidePerfGrievance", ratingId: g.ratingId, decision: decide.decision, note: decide.note, newRating: decide.newRating },
                      ar ? "سُجّل البتّ في التظلم" : "Decision recorded",
                    ).then((done) => { if (done) setDecide({ ratingId: "", decision: "", note: "", newRating: "" }); })}>
                      {ar ? "سجّل البتّ" : "Record decision"}
                    </button>
                  </div>
                ) : (
                  <button type="button" style={{ ...ui.btnRow, alignSelf: "flex-start" }} onClick={() => setDecide({ ratingId: g.ratingId, decision: "", note: "", newRating: "" })}>
                    {ar ? "ابتّ في التظلم" : "Decide"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {cycles.length > 1 ? (
        <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed var(--nv-line)", fontSize: "11px", color: MUTED }}>
          {ar ? "دورات سابقة: " : "Earlier cycles: "}
          {cycles.filter((c) => c.id !== cycle?.id).map((c) => `${c.period} (${ar ? CYCLE_STATUS_LABELS[c.status]?.ar || c.status : CYCLE_STATUS_LABELS[c.status]?.en || c.status})`).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
