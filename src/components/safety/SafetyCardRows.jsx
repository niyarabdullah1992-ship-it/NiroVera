import React, { useState } from "react";
import CollapsibleItemCard from "@/components/shared/CollapsibleItemCard";
import AttachDropzone from "@/components/shared/AttachDropzone";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import { FieldLabel, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import { SAFETY_REPORT_CONTROLS, SAFETY_REPORT_STEPS, safetyReportSlaHours, safetyReportSlaLine } from "@/lib/safetyReportCard";
import { SAFETY_ESCALATION_LEVELS, SAFETY_STAGE_LABEL, checkSafetyDecisionGate, safetyCardAuditTrail } from "@/lib/safetyBranchVisibility";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const dash = (value) => (value == null || value === "" ? "—" : value);

function levelTone(tone) {
  if (tone === "crit") return { color: "#fff", background: "#9B2335" };
  if (tone === "bad") return { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" };
  if (tone === "warn") return { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  if (tone === "ok") return { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" };
  return { color: "var(--nv-ink3)", background: "var(--nv-soft)" };
}

const chip = (style) => ({ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, flex: "none", whiteSpace: "nowrap", ...style });

export function safetyCardElapsed(item, now = Date.now()) {
  const card = item?.card;
  if (!card || card.positive || item.status === "closed" || !item.at) return false;
  const hours = safetyReportSlaHours(card.levelKey);
  return hours > 0 && new Date(item.at).getTime() + hours * 3600000 <= now;
}

function Fact({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px", minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{label}</span>
      <strong style={{ fontSize: 12.5, color: "var(--nv-ink)", overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}

/** What a viewer reads in an open card: facts, the named redactions, the steps, the decisions, the trail. */
export function SafetyCardBody({ row, ar, now = Date.now() }) {
  const L = (a, e) => (ar ? a : e);
  const { item } = row;
  const card = item.card || {};
  const step = Number(item.step ?? card.step ?? 0);
  const anonymous = Boolean(item.anonymous || card.anonymous);
  const reporter = anonymous ? (row.mine ? L("أنت — بلا اسم", "You — anonymous") : L("بلا اسم", "Anonymous")) : dash(item.by);
  const injured = card.injured
    ? (card.injuredSelf ? L("نعم — المُبلِّغ", "Yes — the reporter") : (card.injuredName ? `${L("نعم", "Yes")} — ${card.injuredName}` : L("نعم", "Yes")))
    : L("بلا إصابة", "No injury");
  const trail = safetyCardAuditTrail(item, ar ? "ar" : "en").map((event) => ({
    at: event.at,
    actor: event.by || (event.type === "raised" ? L("المُبلِّغ", "Reporter") : "—"),
    text: event.label,
    detail: event.note && event.type !== "escalate" ? event.note : "",
  }));
  return (
    <div data-safety-card-body={item.id} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, background: "var(--nv-soft)" }}>
        <Fact label={L("الموقع", "Place")} value={dash(card.where)} />
        <Fact label={L("المُبلِّغ", "Reporter")} value={reporter} />
        <Fact label={L("إصابة", "Injury")} value={injured} />
        <Fact label={L("الضابط المقترح", "Proposed control")} value={dash(ar ? card.controlAr : card.controlEn)} />
        <Fact label={L("الصورة", "Photo")} value={dash(card.photoName)} />
        {card.stopped ? <Fact label={L("إيقاف العمل", "Work stop")} value={L("أُوقف العمل", "Work stopped")} /> : null}
      </div>
      {row.redactions?.length ? (
        <div data-safety-redacted={row.redactions.map((r) => r.key).join(" ")} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {row.redactions.map((r) => (
            <span key={r.key} style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>🔒 {L(r.ar, r.en)}</span>
          ))}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {SAFETY_REPORT_STEPS.map((label, index) => (
          <div key={label.ar} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
            {index < 3 ? <span style={{ position: "absolute", top: 4, insetInlineStart: "50%", width: "100%", height: 2, background: index < step ? "#3C7D50" : "var(--nv-line)" }} /> : null}
            <span style={{ width: 10, height: 10, borderRadius: "50%", position: "relative", zIndex: 1, boxShadow: "0 0 0 3px var(--nv-card)", background: index <= step ? "#3C7D50" : "var(--nv-line)" }} />
            <span style={{ fontSize: 10.5, color: index <= step ? "var(--nv-ink)" : "var(--nv-muted)" }}>{L(label.ar, label.en)}</span>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{item.status === "closed" ? L("أُغلق البلاغ", "Report closed") : safetyReportSlaLine(card, item.at, now, ar)}</span>
      {item.assignedTo?.name || item.correctiveAction?.text || item.closeReason || item.escalationLevel ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--nv-line2, #EEF1EF)", paddingTop: 10 }}>
          {item.assignedTo?.name ? <span style={{ fontSize: 12, color: "var(--nv-ink)" }}>{L("يتولّاه", "Handled by")}: <strong>{item.assignedTo.name}</strong></span> : null}
          {item.escalationLevel ? <span style={{ fontSize: 12, color: "var(--nv-ink)" }}>{L("صُعّد إلى", "Escalated to")}: <strong>{L((SAFETY_ESCALATION_LEVELS.find((l) => l.level === item.escalationLevel) || {}).ar, (SAFETY_ESCALATION_LEVELS.find((l) => l.level === item.escalationLevel) || {}).en)}</strong></span> : null}
          {item.correctiveAction?.text ? <span style={{ fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.7 }}>{L("الإجراء التصحيحي", "Corrective action")}: {item.correctiveAction.text}</span> : null}
          {item.closeReason ? <span data-safety-close-reason="" style={{ fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.7 }}>{L("سبب الإغلاق", "Closing reason")}: {item.closeReason}{item.afterPhoto?.name ? ` · ${L("صورة بعد", "After photo")}: ${item.afterPhoto.name}` : ""}</span> : null}
        </div>
      ) : null}
      <VoiceAuditTrail events={trail} ar={ar} />
    </div>
  );
}

const btn = (kind, off) => ({
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  minHeight: 40,
  padding: "8px 12px",
  width: "100%",
  borderRadius: 8,
  cursor: off ? "default" : "pointer",
  border: `1px solid ${kind === "go" && !off ? "#0B3D27" : "var(--nv-line)"}`,
  background: kind === "go" && !off ? "#0B3D27" : "var(--nv-card)",
  color: off ? "var(--nv-muted)" : kind === "go" ? "#fff" : "var(--nv-ink)",
});

const DECISIONS = [
  { id: "assign", ar: "إسناد", en: "Assign", subAr: "من يتولّى المعالجة", subEn: "Who handles it" },
  { id: "action", ar: "إجراء تصحيحي", en: "Corrective action", subAr: "الضابط وما نُفّذ", subEn: "The control and what was done" },
  { id: "close", ar: "إغلاق", en: "Close", subAr: "بسبب مكتوب وصورة بعد", subEn: "With a written reason and an after photo" },
  { id: "escalate", ar: "تصعيد", en: "Escalate", subAr: "للمستوى التالي", subEn: "To the next level" },
];

/**
 * The manager's decision on one card — the طلباتي الإدارة composer: pick the decision, write it, send it.
 * The gate (checkSafetyDecisionGate) names what blocks; the send runs onDecide({ action, note, … }).
 */
export function SafetyDecisionComposer({ row, ar, actor, staff = [], onDecide }) {
  const L = (a, e) => (ar ? a : e);
  const { item } = row;
  const [action, setAction] = useState(item.assignedTo?.id ? (item.correctiveAction?.text || item.actionApprovedAt ? "close" : "action") : "assign");
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [controlId, setControlId] = useState(item.card?.controlId || "");
  const [photo, setPhoto] = useState(null);
  if (item.status === "closed") return null;
  const assignee = staff.find((person) => String(person.id) === String(assigneeId)) || null;
  const gate = checkSafetyDecisionGate({ item, action, actor, note, assignee, afterPhotoName: photo?.name || "" });
  const send = async () => {
    if (!gate.ok) return;
    const result = await onDecide({ action, note, assignee, controlId, afterPhotoName: photo?.name || "" });
    if (result?.ok) { setNote(""); setPhoto(null); }
  };
  const label = { assign: L("أسند البلاغ", "Assign the report"), action: L("سجّل الإجراء التصحيحي", "Record the corrective action"), close: L("أغلق بسبب مكتوب", "Close with a written reason"), escalate: L("صعّد للمستوى التالي", "Escalate to the next level") }[action];
  return (
    <div data-safety-decision={item.id} style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--nv-line2, #EEF1EF)", paddingTop: 12 }}>
      <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{L("القرار", "Decision")}</strong>
      <SubTypeGrid label={L("القرار", "Decision")}>
        {DECISIONS.map((d) => (
          <SubTypeOption key={d.id} dataKey={`safety-decide-${d.id}`} on={action === d.id} title={L(d.ar, d.en)} sub={L(d.subAr, d.subEn)} onClick={() => setAction(d.id)} />
        ))}
      </SubTypeGrid>
      {action === "assign" ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("من يتولّى المعالجة؟", "Who handles it?")}</FieldLabel>
          <select data-safety-assignee="" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} style={{ fontFamily: "inherit", fontSize: 13, height: 42, padding: "0 10px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)" }}>
            <option value="">{L("— اختر —", "— Pick —")}</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
      ) : null}
      {action === "action" ? (
        <SubTypeGrid label={L("الضابط", "Control")}>
          {SAFETY_REPORT_CONTROLS.map((ctrl, index) => (
            <SubTypeOption key={ctrl.id} dataKey={`safety-fix-${ctrl.id}`} on={controlId === ctrl.id} title={L(ctrl.ar, ctrl.en)} badge={<span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--nv-muted)" }}>{index + 1}</span>} onClick={() => setControlId(ctrl.id)} />
          ))}
        </SubTypeGrid>
      ) : null}
      {action !== "assign" ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel note={action === "escalate" ? L("اختياري", "Optional") : L("يصل المُبلِّغ برقم البلاغ", "Reaches the reporter by the report's number")}>
            {action === "action" ? L("ما الذي نُفّذ؟", "What was done?") : action === "close" ? L("سبب الإغلاق", "Reason for closing") : L("سبب التصعيد", "Reason for escalating")}
          </FieldLabel>
          <textarea data-safety-note="" rows={3} value={note} onChange={(event) => setNote(event.target.value)} style={textareaStyle} />
        </label>
      ) : null}
      {action === "close" && !item.card?.positive ? (
        <AttachDropzone
          ar={ar}
          required
          accept="image/jpeg,image/png,image/webp,image/*"
          file={photo}
          label={L("صورة بعد المعالجة", "After photo")}
          typesLabel={L("صورة · حتى 25 ميجابايت", "Image · up to 25 MB")}
          onPick={(file) => setPhoto(file && Number(file.size) <= 25 * 1024 * 1024 ? { name: String(file.name || ""), size: Number(file.size) || 0 } : null)}
          onClear={() => setPhoto(null)}
        />
      ) : null}
      <span data-safety-decision-gate={gate.ok ? "ok" : gate.error} style={{ fontSize: 11.5, fontWeight: 600, color: gate.ok ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7 }}>
        {gate.ok ? `✓ ${L("جاهز للإرسال", "Ready to send")}` : L(gate.reason, gate.reasonEn)}
      </span>
      <button type="button" data-safety-decide="" disabled={!gate.ok} onClick={send} style={btn("go", !gate.ok)}>{label}</button>
    </div>
  );
}

/** One card in a list: folded to its row (dot, what, category · branch, number, stage and level chips). */
export function SafetyCardRow({ row, ar, open, onToggle, now = Date.now(), children }) {
  const L = (a, e) => (ar ? a : e);
  const card = row.item.card || {};
  const tone = levelTone(card.levelTone || "");
  const stage = SAFETY_STAGE_LABEL[row.stage] || SAFETY_STAGE_LABEL.open;
  const elapsed = safetyCardElapsed(row.item, now);
  return (
    <CollapsibleItemCard
      data-safety-card={row.item.id}
      data-safety-stage={row.stage}
      open={open}
      onToggle={onToggle}
      dot={row.stage === "closed" || row.stage === "archive" ? "#3C7D50" : card.levelTone === "crit" ? "#9B2335" : "#C8A45A"}
      title={dash(row.item.description || card.what)}
      person={`${dash(ar ? card.categoryAr : (card.categoryEn || card.categoryAr))} · ${dash(row.stationName)}`}
      date={<span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{dash(card.code)}</span>}
      status={(
        <>
          {elapsed ? <span style={chip({ color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" })}>{L("انتهت المهلة", "SLA elapsed")}</span> : null}
          {card.levelAr ? <span style={chip(tone)}>{L(card.levelAr, card.levelEn || card.levelAr)}</span> : null}
          <span style={chip({ color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)" })}>{L(stage.ar, stage.en)}</span>
        </>
      )}
      ar={ar}
    >
      {children}
    </CollapsibleItemCard>
  );
}
