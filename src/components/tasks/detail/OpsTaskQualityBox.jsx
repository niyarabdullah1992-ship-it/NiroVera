import React, { useState } from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import RightHint from "@/components/shared/RightHint";
import { PERF_LEVELS } from "@/lib/perfReport";
import { modelLaw } from "@/lib/modelArticleTexts";
import {
  QUALITY_OBJECTION_REASON_MIN,
  checkDecideQualityObjectionGate,
  checkQualityObjectionGate,
  qualityLevel,
  qualityObjectionBy,
  qualityObjectionOf,
  qualityObjectionState,
  taskQualityFor,
} from "@/lib/taskQuality";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
const fieldStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 9, background: CARD, padding: "8px 11px", fontSize: 12, color: NAVY, fontFamily: "inherit" };
const quietBtn = { padding: "7px 13px", borderRadius: 9, fontSize: 11.5, fontWeight: 600, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontFamily: "inherit", cursor: "pointer", alignSelf: "flex-start" };

/** The worker's right on his task level: the copy at once (م20), the report's competence (م18), the objection (م71 principle). */
export function qualityWorkerHint(ar = true, by = "") {
  return {
    view: "employee",
    right: ar
      ? "ترى مستوى جودة كل مهمة وسببه فور اعتمادها (النموذج الموحد م20)، ومتوسط مستوياتك في الفترة يملأ عنصر «الكفاءة» في تقرير أدائك السنوي (م18). لك الاعتراض على المستوى خلال خمسة أيام عمل — سياسة المنصة المستمدة من مبدأ التظلم في م71، لا مدة نظامية — ويبقى لك التظلم من التقرير السنوي خلال 30 يوماً (م20 · م71)."
      : "You see each task's level and reason on approval (model Art. 20); their period mean fills «competence» in your annual report (Art. 18). You may object within five working days — platform policy after the grievance principle of Art. 71, not a statutory period — and you may still grieve the annual report within 30 days (Arts. 20 · 71).",
    ifNot: ar
      ? (by ? `اعترض كتابةً حتى ${by}؛ يبتّ رئيس المعتمِد أو الموارد البشرية كتابةً، ولا تُضار من اعتراضك.` : "اعترض كتابةً؛ يبتّ رئيس المعتمِد أو الموارد البشرية، ولا تُضار من اعتراضك.")
      : "Object in writing; the approver's superior or HR decides in writing, and you are not harmed for objecting.",
    law: modelLaw(["18", "20", "71"], ar),
  };
}

function levelText(level, ar) {
  const row = qualityLevel(level);
  return row ? `${row.level} — ${ar ? row.ar : row.en}` : "—";
}

/**
 * The approved task's quality: the level and its reason, each person's own level, the employee's
 * objection inside its window, and — for the approver's superior or HR — the written decision.
 */
export default function OpsTaskQualityBox({ ar = true, task, points, viewerId, canDecide = false, busy = false, employees = [], onObject, onDecide }) {
  const [objecting, setObjecting] = useState(false);
  const [reason, setReason] = useState("");
  const [decide, setDecide] = useState({ id: "", decision: "", note: "", newLevel: "" });
  const today = todayIso();
  const nameOf = (id) => employees.find((e) => String(e.id || e.employeeId) === String(id))?.name || id;
  const q = task?.quality;

  if (!q || !qualityLevel(q.level)) {
    return (
      <OpsTaskSection tone="ok" title={ar ? "اعتُمد الإنجاز" : "Completion approved"}>
        <div style={{ fontSize: 12, color: "var(--nv-ok-ink)", lineHeight: 1.65 }}>
          {ar ? `مُنحت ${task.pointsAwarded || points} نقطة — دخلت في نسبة الأداء وسجل التدقيق.` : `${task.pointsAwarded || points} points granted — in the performance score and audit trail.`}
        </div>
        <div data-quality-legacy="1" style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
          {ar ? "اعتُمدت قبل مستويات الجودة — بلا مستوى، فلا تدخل متوسط الجودة." : "Approved before quality levels — no level, so it stays out of the quality mean."}
        </div>
      </OpsTaskSection>
    );
  }

  const mine = viewerId ? taskQualityFor(task, viewerId) : null;
  const isRecipient = mine && (Array.isArray(q.recipientIds) && q.recipientIds.length ? q.recipientIds.map(String).includes(String(viewerId)) : true);
  const own = isRecipient ? qualityObjectionOf(task, viewerId) : null;
  const ownState = qualityObjectionState(own, today);
  const by = qualityObjectionBy(task);
  const canObject = isRecipient && !own && today <= by;
  const objectGate = checkQualityObjectionGate({ task, employeeId: viewerId, reason, today });
  const overrides = Object.entries(q.overrides || {});
  const open = (task.qualityObjections || []).filter((o) => !o.decision);
  const shown = mine || taskQualityFor(task, null);

  return (
    <OpsTaskSection tone="ok" title={ar ? "اعتُمد الإنجاز — مستوى الجودة" : "Approved — quality level"}>
      <div data-task-quality={shown.level} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: NAVY, lineHeight: 1.7 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13 }}>{isRecipient ? (ar ? "مستواك: " : "Your level: ") : (ar ? "مستوى المهمة: " : "Task level: ")}{levelText(shown.level, ar)}</strong>
          <span dir="ltr" style={{ fontSize: 11, color: MUTED }}>{shown.weight}% · {shown.points} {ar ? "نقطة" : "pts"}</span>
          <span style={{ marginInlineStart: "auto" }}><RightHint ar={ar} hint={qualityWorkerHint(ar, canObject ? by : "")} /></span>
        </div>
        {shown.reason ? <span style={{ color: "var(--nv-ink2, var(--nv-ink))" }}>{ar ? "السبب: " : "Reason: "}{shown.reason}</span> : null}
        <span style={{ fontSize: 11, color: MUTED }}>
          {ar ? `اعتمده ${q.byName || "—"} · ${String(q.at || "").slice(0, 10)}` : `Approved by ${q.byName || "—"} · ${String(q.at || "").slice(0, 10)}`}
          {shown.override ? (ar ? " · مستوى فردي" : " · individual level") : ""}
          {shown.source === "objection" ? (ar ? " · بعد قبول الاعتراض" : " · after an upheld objection") : ""}
        </span>
        {!isRecipient && overrides.length ? (
          <span style={{ fontSize: 11.5, color: MUTED }}>
            {ar ? "مستويات فردية: " : "Individual levels: "}
            {overrides.map(([id, o]) => `${nameOf(id)} ${levelText(o.level, ar)} (${o.reason})`).join(" · ")}
          </span>
        ) : null}

        {ownState ? (
          <span data-quality-objection={ownState.stage} style={{ fontSize: 11.5, color: ownState.stage === "overdue" ? "var(--nv-bad-ink)" : "var(--nv-ink2, var(--nv-ink))" }}>
            {ownState.stage === "pending" ? (ar ? `اعتراضك بانتظار البتّ — حتى ${ownState.replyBy}` : `Your objection awaits a decision — by ${ownState.replyBy}`)
              : ownState.stage === "overdue" ? (ar ? `تجاوز البتّ موعده (${ownState.replyBy}) — لك التظلم من تقرير أدائك السنوي (م20 · م71).` : `Past its decision date (${ownState.replyBy}) — you may grieve the annual report (Arts. 20 · 71).`)
                : ownState.stage === "upheld" ? (ar ? `قُبل اعتراضك — المستوى الجديد ${levelText(own.newLevel, ar)}: ${own.note}` : `Upheld — new level ${levelText(own.newLevel, ar)}: ${own.note}`)
                  : (ar ? `رُفض اعتراضك: ${own.note}` : `Refused: ${own.note}`)}
          </span>
        ) : null}

        {canObject && !objecting ? (
          <button type="button" data-quality-object="1" onClick={() => setObjecting(true)} style={quietBtn}>
            {ar ? `اعترض على المستوى (حتى ${by})` : `Object to the level (until ${by})`}
          </button>
        ) : null}
        {canObject && objecting ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? `لماذا ترى المستوى غير صحيح؟ (${QUALITY_OBJECTION_REASON_MIN} حرفاً فأكثر)` : "Why is the level wrong?"} style={{ ...fieldStyle, resize: "vertical" }} />
            {reason && !objectGate.ok ? <span style={{ fontSize: 11, color: "var(--nv-warn-ink)" }}>{ar ? objectGate.reason : objectGate.reasonEn}</span> : null}
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" disabled={busy || !objectGate.ok} onClick={() => onObject?.(reason.trim())} style={{ ...quietBtn, opacity: busy || !objectGate.ok ? 0.5 : 1 }}>{ar ? "أرسل الاعتراض" : "Send"}</button>
              <button type="button" onClick={() => { setObjecting(false); setReason(""); }} style={{ ...quietBtn, color: MUTED, fontWeight: 400 }}>{ar ? "إلغاء" : "Cancel"}</button>
            </span>
          </div>
        ) : null}

        {canDecide && open.length ? (
          <div data-quality-decide="1" style={{ marginTop: 6, paddingTop: 8, borderTop: `1px dashed ${BORDER}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <strong style={{ fontSize: 12 }}>{ar ? `اعتراض على المستوى (${open.length}) — تبتّ فيه كتابةً` : `Objection to the level (${open.length}) — decide in writing`}</strong>
            {open.map((o) => {
              const editing = decide.id === o.id;
              const gate = editing ? checkDecideQualityObjectionGate({ task, objectionId: o.id, decision: decide.decision, note: decide.note, newLevel: decide.newLevel }) : null;
              return (
                <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span>{`${o.employeeName || nameOf(o.employeeId)} · ${levelText(o.level, ar)}`}</span>
                  <span style={{ color: MUTED, fontSize: 11.5 }}>{o.reason}</span>
                  <span style={{ fontSize: 11, color: o.replyBy && o.replyBy < today ? "var(--nv-bad-ink)" : MUTED }}>{ar ? `يُبلَّغ بالنتيجة كتابةً حتى ${o.replyBy || "—"}` : `Answer in writing by ${o.replyBy || "—"}`}</span>
                  {editing ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6 }}>
                      <select value={decide.decision} onChange={(e) => setDecide((d) => ({ ...d, decision: e.target.value }))} style={fieldStyle}>
                        <option value="">{ar ? "القرار" : "Decision"}</option>
                        <option value="upheld">{ar ? "قبول — مستوى جديد" : "Uphold — new level"}</option>
                        <option value="refused">{ar ? "رفض" : "Refuse"}</option>
                      </select>
                      {decide.decision === "upheld" ? (
                        <select value={decide.newLevel} onChange={(e) => setDecide((d) => ({ ...d, newLevel: e.target.value }))} style={fieldStyle}>
                          <option value="">{ar ? "المستوى الجديد" : "New level"}</option>
                          {PERF_LEVELS.map((row) => <option key={row.level} value={row.level}>{`${row.level} — ${ar ? row.ar : row.en}`}</option>)}
                        </select>
                      ) : null}
                      <input value={decide.note} onChange={(e) => setDecide((d) => ({ ...d, note: e.target.value }))} placeholder={ar ? "نتيجة البتّ وسببها — تُبلَّغ للموظف" : "Decision and reason — sent to the employee"} style={{ ...fieldStyle, gridColumn: "1 / -1" }} />
                      {gate && !gate.ok && (decide.decision || decide.note) ? <span style={{ gridColumn: "1 / -1", fontSize: 11, color: "var(--nv-warn-ink)" }}>{ar ? gate.reason : gate.reasonEn}</span> : null}
                      <button type="button" disabled={busy || !gate?.ok} onClick={() => onDecide?.({ objectionId: o.id, decision: decide.decision, note: decide.note.trim(), newLevel: decide.newLevel ? Number(decide.newLevel) : undefined })} style={{ ...quietBtn, opacity: busy || !gate?.ok ? 0.5 : 1 }}>
                        {ar ? "سجّل البتّ" : "Record decision"}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setDecide({ id: o.id, decision: "", note: "", newLevel: "" })} style={quietBtn}>{ar ? "ابتّ في الاعتراض" : "Decide"}</button>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </OpsTaskSection>
  );
}
