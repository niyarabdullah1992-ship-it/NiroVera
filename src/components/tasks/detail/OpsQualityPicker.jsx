import React, { useMemo, useState } from "react";
import RightHint from "@/components/shared/RightHint";
import { PERF_LEVELS } from "@/lib/perfReport";
import { modelLaw } from "@/lib/modelArticleTexts";
import { taskPoints } from "@/lib/opsDerivations";
import {
  QUALITY_REASON_MIN,
  TASK_QUALITY_WEIGHTS,
  checkTaskQualityGate,
  qualityPoints,
  qualityReasonRequired,
} from "@/lib/taskQuality";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${BORDER}`,
  borderRadius: 9,
  background: CARD,
  padding: "8px 11px",
  fontSize: 12,
  color: NAVY,
  fontFamily: "inherit",
};

/** The approver's duty at the picker: the five-level scale of the report itself (م18–19), the worker's copy (م20). */
export function qualityApproverHint(ar = true) {
  return {
    view: "manager",
    right: ar
      ? "تقيّم جودة الإنجاز على المقياس نفسه الذي يُبنى عليه تقرير الأداء السنوي: خمسة مستويات (م19)، ومتوسطها في الفترة يملأ عنصر «الكفاءة» (م18). المنفّذ يرى المستوى وسببه فور الاعتماد (م20)."
      : "You rate the work on the same five-level scale the annual report uses (Art. 19); its period mean fills «competence» (Art. 18). The worker sees the level and its reason on approval (Art. 20).",
    ifNot: ar
      ? "لا اعتماد بلا مستوى، ولا «ممتاز» أو «دون المتوسط» أو «ضعيف» بلا سبب في سطر."
      : "No approval without a level; «excellent», «below average» and «weak» need a one-line reason.",
    law: modelLaw(["18", "19", "20"], ar),
  };
}

/**
 * Approval with a quality level. Levels 1, 2 and 5 carry a reason; with several assignees the approver
 * may set one person's level apart from the task level (each with its reason). Points = the task's
 * points × the level's weight — who receives them does not change.
 */
export default function OpsQualityPicker({ ar = true, task, assignees = [], busy = false, onConfirm, onCancel, confirmLabel }) {
  const [level, setLevel] = useState(null);
  const [reason, setReason] = useState("");
  const [overrides, setOverrides] = useState({});
  const [touched, setTouched] = useState(false);
  const base = taskPoints(task?.priority, task?.effortWeight);
  const ids = useMemo(() => assignees.map((a) => String(a.id)).filter(Boolean), [assignees]);
  const gate = checkTaskQualityGate({ level, reason, overrides, assigneeIds: ids });
  const many = ids.length >= 2;
  const reasonNeeded = level != null && qualityReasonRequired(level);

  const setOverride = (id, patch) => setOverrides((prev) => {
    const next = { ...prev, [id]: { ...(prev[id] || {}), ...patch } };
    if (next[id].level === "" || next[id].level == null) delete next[id];
    return next;
  });

  return (
    <div data-quality-picker="1" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: NAVY }}>{ar ? "مستوى جودة الإنجاز" : "Quality of the work"}</span>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? `النقاط = ${base} × وزن المستوى` : `Points = ${base} × the level's weight`}</span>
        <span style={{ marginInlineStart: "auto" }}><RightHint ar={ar} hint={qualityApproverHint(ar)} /></span>
      </div>
      <div role="radiogroup" aria-label={ar ? "مستوى الجودة" : "Quality level"} style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        {PERF_LEVELS.map((row, i) => {
          const on = level === row.level;
          return (
            <button
              key={row.level}
              type="button"
              role="radio"
              aria-checked={on}
              data-quality-level={row.level}
              onClick={() => { setLevel(row.level); setTouched(true); }}
              style={{
                display: "grid",
                gridTemplateColumns: "22px minmax(0,1fr) auto",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                border: "none",
                borderTop: i ? `1px solid ${BORDER}` : "none",
                background: on ? SURFACE : CARD,
                color: NAVY,
                fontFamily: "inherit",
                fontSize: 12.5,
                textAlign: "start",
                cursor: "pointer",
              }}
            >
              <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${on ? NAVY_FILL : BORDER}`, boxShadow: on ? `inset 0 0 0 3px ${CARD}` : "none", background: on ? NAVY_FILL : "transparent" }} />
              <span style={{ fontWeight: on ? 700 : 500 }}>
                {row.level} — {ar ? row.ar : row.en}
                {qualityReasonRequired(row.level) ? <span style={{ fontWeight: 400, color: MUTED }}>{ar ? " · بسبب" : " · with reason"}</span> : null}
              </span>
              <span dir="ltr" style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                {qualityPoints(base, row.level)} {ar ? "نقطة" : "pts"} · {TASK_QUALITY_WEIGHTS[row.level]}%
              </span>
            </button>
          );
        })}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: MUTED }}>
          {reasonNeeded
            ? (ar ? `السبب في سطر (${QUALITY_REASON_MIN} أحرف فأكثر) — يقرؤه المنفّذ مع المستوى` : `One-line reason (${QUALITY_REASON_MIN}+ characters) — the assignee reads it with the level`)
            : (ar ? "ملاحظة للمنفّذ (اختيارية)" : "Note to the assignee (optional)")}
        </span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} style={fieldStyle} />
      </label>
      {many ? (
        <details style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px" }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: NAVY, fontWeight: 600 }}>
            {ar ? `مستوى مختلف لأحد المنفّذين (${ids.length}) — اختياري` : `A different level for one assignee (${ids.length}) — optional`}
          </summary>
          <p style={{ margin: "6px 0 8px", fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
            {ar
              ? "كل منفّذ يحصل على نقاط المهمة كما هو اليوم؛ الافتراضي مستوى المهمة. إن اختلف عمل أحدهم فحدّد مستواه وسببه، فتتبع نقاطه مستواه."
              : "Every assignee still gets the task's points; the default is the task level. If one person's work differed, set his level and reason — his points follow it."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assignees.map((a) => {
              const id = String(a.id);
              const o = overrides[id] || {};
              return (
                <div key={id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: NAVY, minWidth: 0, overflowWrap: "anywhere" }}>{a.name || id}</span>
                  <select value={o.level || ""} onChange={(e) => setOverride(id, { level: e.target.value ? Number(e.target.value) : "" })} style={fieldStyle}>
                    <option value="">{ar ? "مستوى المهمة" : "Task level"}</option>
                    {PERF_LEVELS.map((row) => <option key={row.level} value={row.level}>{`${row.level} — ${ar ? row.ar : row.en}`}</option>)}
                  </select>
                  {o.level ? (
                    <input value={o.reason || ""} onChange={(e) => setOverride(id, { reason: e.target.value })} placeholder={ar ? "سبب الاختلاف" : "Why it differs"} style={{ ...fieldStyle, gridColumn: "1 / -1" }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
      {touched && !gate.ok ? (
        <span data-quality-gate={gate.error} style={{ fontSize: 11.5, color: "var(--nv-warn-ink)", lineHeight: 1.6 }}>{ar ? gate.reason : gate.reasonEn}</span>
      ) : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {onCancel ? (
          <button type="button" onClick={onCancel} style={{ padding: "8px 14px", borderRadius: 9, fontSize: 12, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontFamily: "inherit", cursor: "pointer" }}>
            {ar ? "إلغاء" : "Cancel"}
          </button>
        ) : null}
        <button
          type="button"
          data-quality-confirm="1"
          disabled={busy || !gate.ok}
          onClick={() => { setTouched(true); if (gate.ok) onConfirm?.({ level: gate.level, reason: gate.reason, overrides: gate.overrides }); }}
          style={{ padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "none", background: "var(--nv-ok-fill)", color: "#fff", fontFamily: "inherit", cursor: busy || !gate.ok ? "not-allowed" : "pointer", opacity: busy || !gate.ok ? 0.5 : 1 }}
        >
          {confirmLabel || (ar
            ? (gate.ok ? `اعتمد — ${qualityPoints(base, gate.level)} نقطة` : "اعتمد الإنجاز")
            : (gate.ok ? `Approve — ${qualityPoints(base, gate.level)} pts` : "Approve"))}
        </button>
      </div>
    </div>
  );
}
