import React, { useMemo, useState } from "react";
import TwoPaneWorkspace, { ListStack } from "@/components/shared/TwoPaneWorkspace";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";
import TimeField from "@/components/shared/TimeField";
import { DisciplineNewFrame, DisciplineRow, DisciplineRowList, AttentionChip } from "@/components/discipline/DisciplineRows";
import { Checklist, FieldLabel, GateLine, LawLine, SendButton, StepHead, inputStyle, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import { PERMIT_MAX_HOURS, PERMIT_STATUS_LABEL, checkPermitActionGate, checkPermitRequestGate, permitControlRows, permitStatus, permitTypeRow, riyadhLocalMs } from "@/lib/safetyOps";
import { PERMIT_TYPES } from "@/lib/safetyStandards";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const LETTERS = { excavation: "ح", height: "ر", electrical: "ك", confined: "م", hot: "س" };
const HINTS = {
  excavation: ["حفر وخنادق", "Trenches, digging"],
  height: ["سقالات وأسطح وسلالم", "Scaffolds, roofs, ladders"],
  electrical: ["لوحات وكابلات مُشغَّلة", "Live panels and cables"],
  confined: ["خزانات وحفر وغرف مغلقة", "Tanks, pits, closed rooms"],
  hot: ["لحام وقطع وشرر", "Welding, cutting, sparks"],
};

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function RequestForm({ ar, station, today, onRequest }) {
  const L = (a, e) => (ar ? a : e);
  const [form, setForm] = useState({ type: "height", description: "", team: "", date: today, from: "", to: "", outdoor: false });
  const patch = (next) => setForm((cur) => ({ ...cur, ...next }));
  const startAt = form.date && form.from ? `${form.date}T${form.from}` : "";
  const endAt = form.date && form.to ? `${form.to <= form.from ? addDays(form.date, 1) : form.date}T${form.to}` : "";
  const draft = { ...form, stationId: station?.id || "", startAt, endAt };
  const gate = checkPermitRequestGate(draft);
  const controls = permitControlRows(form.type);
  const hours = Number.isFinite(riyadhLocalMs(startAt)) && Number.isFinite(riyadhLocalMs(endAt)) ? (riyadhLocalMs(endAt) - riyadhLocalMs(startAt)) / 3600000 : null;
  return (
    <DisciplineNewFrame
      dataKey="permit-request"
      title={L("طلب تصريح عمل", "Request a permit to work")}
      note={L("قبل أي عمل خطِر: اطلب التصريح، ولا تبدأ قبل أن يصدر وتوقّع على استلام ضوابطه.", "Before any hazardous work: request the permit; do not start before it is issued and you sign its controls.")}
      tiles={PERMIT_TYPES.map(([id, a, e]) => ({ id, letter: LETTERS[id], title: ar ? a : e, hint: ar ? HINTS[id][0] : HINTS[id][1] }))}
      value={form.type}
      onPick={(id) => patch({ type: id })}
    >
      <LawLine cite={L("المادة 122", "Art. 122")}>
        {L("حماية العامل من أخطار العمل التزام على صاحب العمل — ولك أن ترفض عملاً خطِراً بلا تصريح.", "Protecting the worker from work hazards is the employer's duty — you may refuse hazardous work without a permit.")}
      </LawLine>
      <StepHead first label={L("العمل", "The work")} note={station?.name || ""} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel note={L("8 أحرف على الأقل", "8+ characters")}>{L("ماذا ستعمل وأين بالضبط؟", "What will you do, and where exactly?")}</FieldLabel>
        <textarea data-req-field="description" value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder={L("مثال: استبدال كشّافات السقف في المستودع الرئيسي من سقالة", "e.g. Replace the ceiling floodlights in the main store from a scaffold")} style={{ ...textareaStyle, minHeight: 64 }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel note={L("اختياري", "Optional")}>{L("من معك؟", "Who is with you?")}</FieldLabel>
        <input data-req-field="team" value={form.team} onChange={(e) => patch({ team: e.target.value })} style={inputStyle} />
      </label>
      <StepHead label={L("الوقت", "Time")} note={ar ? `وردية واحدة — ${PERMIT_MAX_HOURS} ساعة كحدّ أقصى` : `One shift — ${PERMIT_MAX_HOURS} h at most`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("اليوم", "Day")}</FieldLabel>
          <input data-req-field="date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} style={{ ...inputStyle, fontFamily: MONO }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("من", "From")}</FieldLabel>
          <TimeField ar={ar} dataKey="req-from" value={form.from} onChange={(v) => patch({ from: v })} step={15} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("إلى", "To")}</FieldLabel>
          <TimeField ar={ar} dataKey="req-to" value={form.to} onChange={(v) => patch({ to: v })} step={15} />
        </label>
      </div>
      <label data-req-field="outdoor" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink)", cursor: "pointer" }}>
        <input type="checkbox" checked={form.outdoor} onChange={(e) => patch({ outdoor: e.target.checked })} style={{ marginTop: 5 }} />
        <span>
          {L("العمل مكشوف تحت الشمس", "The work is sun-exposed")}
          <span style={{ display: "block", fontSize: 11.5, color: "var(--nv-muted)" }}>{L("القرار 3337: لا عمل مكشوف 12:00–15:00 من 15 يونيو إلى 15 سبتمبر.", "Decision 3337: no sun-exposed work 12:00–15:00, 15 June – 15 September.")}</span>
        </span>
      </label>
      <StepHead label={L("ما سيؤكّده المُصدر قبل أن يبدأ عملك", "What the issuer confirms before your work starts")} note={ar ? permitTypeRow(form.type)?.ar : permitTypeRow(form.type)?.en} />
      <Checklist dataKey="req-controls" items={controls.map((row) => ({ ok: false, text: ar ? row.ar : row.en }))} />
      <Checklist dataKey="req-ready" items={[
        { ok: form.description.trim().length >= 8, text: L("العمل وموقعه موصوفان", "Work and place described") },
        { ok: hours != null && hours > 0 && hours <= PERMIT_MAX_HOURS, text: L("الوقت ضمن وردية واحدة", "Time within one shift") },
      ]} />
      <GateLine gate={gate} ar={ar} dataAttr={{ "data-req-gate": "1" }} />
      <SendButton ready={gate.ok} dataAttr={{ "data-req-send": "1" }} onClick={() => { if (onRequest(draft)) setForm((cur) => ({ ...cur, description: "", team: "", from: "", to: "", outdoor: false })); }}>
        {L("أرسل طلب التصريح", "Send the permit request")}
      </SendButton>
    </DisciplineNewFrame>
  );
}

function MyPermitBody({ ar, permit, state, actorId, onAct }) {
  const L = (a, e) => (ar ? a : e);
  const [note, setNote] = useState("");
  const controls = permitControlRows(permit.type).filter((c) => (permit.controls || []).includes(c.id));
  const ackGate = checkPermitActionGate(permit, "acknowledge", { actorId });
  const closeGate = checkPermitActionGate(permit, "requestClose", { actorId, note });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: "var(--nv-ink2)" }}>{permit.description}</p>
      {state === "requested" ? <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{L("وصل طلبك لمسؤول السلامة ومدير الفرع. لا تبدأ قبل الإصدار وتوقيعك.", "Your request reached the safety officer and the branch manager. Do not start before issue and your signature.")}</span> : null}
      {state === "declined" ? <span style={{ fontSize: 12, color: "var(--nv-bad-ink)" }}>{ar ? `رُفض: ${permit.declineReason || "—"}` : `Declined: ${permit.declineReason || "—"}`}</span> : null}
      {["open", "active", "closing", "suspended"].includes(state) ? (
        <>
          <StepHead first label={L("الضوابط التي أكّدها المُصدر", "Controls the issuer confirmed")} note={permit.issuedBy ? (ar ? `أصدره ${permit.issuedBy}` : `Issued by ${permit.issuedBy}`) : ""} />
          <Checklist dataKey="my-controls" items={controls.map((row) => ({ ok: true, text: ar ? row.ar : row.en }))} />
        </>
      ) : null}
      {state === "suspended" ? <AttentionChip tone="warn">{ar ? `العمل موقوف: ${permit.suspendReason || "—"}` : `Work stopped: ${permit.suspendReason || "—"}`}</AttentionChip> : null}
      {state === "open" ? (
        <>
          <GateLine gate={ackGate} ar={ar} />
          <SendButton ready={ackGate.ok} dataAttr={{ "data-my-ack": permit.id }} onClick={() => onAct(permit, "acknowledge", {})}>
            {L("قرأت الضوابط وأوقّع على الاستلام — يبدأ العمل", "I read the controls and sign — work starts")}
          </SendButton>
        </>
      ) : null}
      {state === "active" ? (
        <>
          <StepHead label={L("عند الانتهاء", "When done")} />
          <textarea data-my-close-note={permit.id} value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("ملاحظة ختامية (اختياري): ما تُرك في الموقع", "Closing note (optional): what was left on site")} style={{ ...textareaStyle, minHeight: 52 }} />
          <GateLine gate={closeGate} ar={ar} />
          <SendButton ready={closeGate.ok} dataAttr={{ "data-my-close": permit.id }} onClick={() => onAct(permit, "requestClose", { note })}>
            {L("أنهيت العمل — اطلب الإغلاق", "Work finished — ask to close")}
          </SendButton>
        </>
      ) : null}
      {state === "closing" ? <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{L("بانتظار أن يوقّع المُصدر على سلامة الموقع.", "Waiting for the issuer's site-safe signature.")}</span> : null}
    </div>
  );
}

/** «تصاريحي» — the worker's side of the permit: request, sign the controls, report the work finished. */
export default function MyPermits({ ar, station, rec, actorId, today, onRequest, onAct }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const mine = useMemo(() => (rec?.permits || []).filter((p) => String(p.holderId) === String(actorId)).map((p) => ({ permit: p, state: permitStatus(p, now) })), [rec, actorId, now]);
  const [face, setFace] = useState("now");
  const faces = [
    { id: "now", label: L("الحالية", "Current"), n: mine.filter((r) => ["requested", "open", "active", "closing", "suspended"].includes(r.state)).length, test: (r) => ["requested", "open", "active", "closing", "suspended"].includes(r.state) },
    { id: "done", label: L("المنتهية", "Finished"), n: mine.filter((r) => ["closed", "cancelled", "declined", "expired"].includes(r.state)).length, test: (r) => ["closed", "cancelled", "declined", "expired"].includes(r.state) },
  ];
  const shown = mine.filter((faces.find((f) => f.id === face) || faces[0]).test);
  const fold = useCollapsibleItems(shown.map((r) => r.permit.id));
  return (
    <TwoPaneWorkspace
      dataKey="safety-my-permits"
      raise={station ? <RequestForm ar={ar} station={station} today={today} onRequest={onRequest} /> : null}
      list={(
        <ListStack data-my-permits="1">
          <StatusFilterPills card dataKey="my-permits" title={L("تصاريحي", "My permits")} value={face} onChange={setFace} items={faces} />
          <DisciplineRowList dataKey="my-permits" empty={L("لا تصاريح هنا. اطلب تصريحاً قبل أي عمل خطِر.", "Nothing here. Request a permit before any hazardous work.")}>
            {shown.map(({ permit, state }) => {
              const label = PERMIT_STATUS_LABEL[state] || PERMIT_STATUS_LABEL.open;
              const chip = state === "open"
                ? <AttentionChip tone="warn">{L("وقّع قبل أن تبدأ", "Sign before you start")}</AttentionChip>
                : label.tone === "bad" ? <AttentionChip tone="bad">{ar ? label.ar : label.en}</AttentionChip>
                  : <span style={{ fontSize: 11, fontWeight: 700, color: label.tone === "ok" ? "var(--nv-ok-ink)" : "var(--nv-muted)" }}>{ar ? label.ar : label.en}</span>;
              return (
                <DisciplineRow
                  key={permit.id}
                  id={permit.id}
                  dataKey="my-permit"
                  ar={ar}
                  badge={<span dir="ltr" style={{ fontFamily: MONO }}>{permit.id}</span>}
                  title={ar ? permitTypeRow(permit.type)?.ar || "—" : permitTypeRow(permit.type)?.en || "—"}
                  sub={`${String(permit.startAt || "").replace("T", " ")} → ${String(permit.endAt || "").slice(11)}`}
                  chip={chip}
                  open={fold.isOpen(permit.id)}
                  onOpen={() => fold.toggle(permit.id)}
                >
                  <MyPermitBody ar={ar} permit={permit} state={state} actorId={actorId} onAct={onAct} />
                </DisciplineRow>
              );
            })}
          </DisciplineRowList>
        </ListStack>
      )}
    />
  );
}
