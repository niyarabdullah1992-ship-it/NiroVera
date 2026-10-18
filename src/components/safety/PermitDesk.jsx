import React, { useMemo, useState } from "react";
import TwoPaneWorkspace, { ListStack } from "@/components/shared/TwoPaneWorkspace";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";
import TimeField from "@/components/shared/TimeField";
import { DisciplineNewFrame, DisciplineRow, DisciplineRowList, AttentionChip, ArticleBadge } from "@/components/discipline/DisciplineRows";
import { Checklist, FieldLabel, GateLine, LawLine, SendButton, StepHead, inputStyle, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import {
  PERMIT_MAX_HOURS,
  PERMIT_STATUS_LABEL,
  checkPermitActionGate,
  checkPermitIssueGate,
  permitBoard,
  permitControlRows,
  permitTypeRow,
  riyadhLocalMs,
} from "@/lib/safetyOps";
import { PERMIT_TYPES } from "@/lib/safetyStandards";
import { SafetyKpiRow } from "@/components/safety/SafetyOpsKit";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const LETTERS = { excavation: "ح", height: "ر", electrical: "ك", confined: "م", hot: "س" };
const HINTS = {
  excavation: ["حفر وخنادق · حواجز وفحص غاز", "Trenches · barricades, gas test"],
  height: ["سقالات وأسطح · حواجز وخطة إنقاذ", "Scaffolds, roofs · barricades, rescue"],
  electrical: ["لوحات وكابلات · عزل وتأمين الطاقة", "Panels, cables · isolation / LOTO"],
  confined: ["خزانات وغرف مغلقة · غاز وعزل وإنقاذ", "Tanks, pits · gas, isolation, rescue"],
  hot: ["لحام وقطع · مراقب حريق وفحص غاز", "Welding, cutting · fire watch, gas"],
};

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function windowText(permit) {
  const s = String(permit.startAt || "").replace("T", " ");
  const e = String(permit.endAt || "");
  const sameDay = s.slice(0, 10) === e.slice(0, 10);
  return `${s} → ${sameDay ? e.slice(11) : e.replace("T", " ")}`;
}

function PermitComposer({ ar, stations, staffOf, today, onIssue, request = null, onCancel }) {
  const L = (a, e) => (ar ? a : e);
  const [form, setForm] = useState(request
    ? { type: request.type, stationId: request.stationId, description: request.description || "", holderId: String(request.holderId || ""), team: request.team || "", date: String(request.startAt || "").slice(0, 10), from: String(request.startAt || "").slice(11, 16), to: String(request.endAt || "").slice(11, 16), outdoor: Boolean(request.outdoor), controls: [] }
    : { type: "hot", stationId: stations[0]?.id || "", description: "", holderId: "", team: "", date: today, from: "", to: "", outdoor: false, controls: [] });
  const patch = (next) => setForm((cur) => ({ ...cur, ...next }));
  const startAt = form.date && form.from ? `${form.date}T${form.from}` : "";
  const endAt = form.date && form.to ? `${form.to <= form.from ? addDays(form.date, 1) : form.date}T${form.to}` : "";
  const draft = { ...form, startAt, endAt, requestId: request?.id || "" };
  const gate = checkPermitIssueGate(draft);
  const controls = permitControlRows(form.type);
  const staff = staffOf(form.stationId);
  const tiles = PERMIT_TYPES.map(([id, a, e]) => ({ id, letter: LETTERS[id], title: ar ? a : e, hint: ar ? HINTS[id][0] : HINTS[id][1] }));
  const hours = Number.isFinite(riyadhLocalMs(startAt)) && Number.isFinite(riyadhLocalMs(endAt)) ? (riyadhLocalMs(endAt) - riyadhLocalMs(startAt)) / 3600000 : null;
  const checklist = [
    { ok: Boolean(form.stationId && form.description.trim().length >= 8), text: L("العمل وموقعه موصوفان", "Work and place described") },
    { ok: Boolean(form.holderId), text: L("منفّذ مسؤول مسمّى", "A named responsible holder") },
    { ok: hours != null && hours > 0 && hours <= PERMIT_MAX_HOURS, text: L(`وردية واحدة — ${PERMIT_MAX_HOURS} ساعة كحدّ أقصى`, `One shift — ${PERMIT_MAX_HOURS} h at most`) },
    { ok: controls.every((row) => form.controls.includes(row.id)), text: L("الضوابط مؤكّدة كلها", "Every control confirmed") },
  ];
  return (
    <DisciplineNewFrame
      dataKey={request ? "permit-from-request" : "permit"}
      title={request ? (ar ? `إصدار التصريح ${request.id}` : `Issue permit ${request.id}`) : L("تصريح عمل جديد", "New permit to work")}
      note={request
        ? (ar ? `طلبه ${request.holderName || "—"} · راجع الوقت والمكان، وأكّد الضوابط، ثم أصدر — أو ارفض بسبب.` : `Requested by ${request.holderName || "—"} · check time and place, confirm the controls, then issue — or decline with a reason.`)
        : L("لا يبدأ العمل الخطِر قبل تصريح موقّع — ويُغلق بتوقيع عند انتهائه.", "Hazardous work does not start before a signed permit — it closes with a signature.")}
      tiles={tiles}
      value={form.type}
      onPick={(id) => patch({ type: id, controls: [] })}
    >
      <LawLine cite={L("المادتان 121–122", "Arts. 121–122")}>
        {L("على صاحب العمل حماية العمال من أخطار العمل وتوفير وسائل الوقاية دون أن يتحمّل العامل كلفتها.", "The employer protects workers from work hazards and provides protection at no cost to them.")}
      </LawLine>

      <StepHead first label={L("العمل والموقع", "Work and place")} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>{L("الفرع", "Branch")}</FieldLabel>
        <select data-permit-field="station" value={form.stationId} onChange={(e) => patch({ stationId: e.target.value, holderId: "" })} style={inputStyle}>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel note={L("8 أحرف على الأقل", "8+ characters")}>{L("وصف العمل وموقعه الدقيق", "The work and its exact place")}</FieldLabel>
        <textarea data-permit-field="description" value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder={L("مثال: لحام خط التغذية في غرفة المضخات رقم 2", "e.g. Welding the feed line in pump room 2")} style={{ ...textareaStyle, minHeight: 64 }} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("المنفّذ المسؤول", "Responsible holder")}</FieldLabel>
          <select data-permit-field="holder" value={form.holderId} onChange={(e) => patch({ holderId: e.target.value })} style={inputStyle}>
            <option value="">{L("— اختر —", "— Pick —")}</option>
            {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel note={L("اختياري", "Optional")}>{L("الفريق أو المقاول", "Team or contractor")}</FieldLabel>
          <input data-permit-field="team" value={form.team} onChange={(e) => patch({ team: e.target.value })} style={inputStyle} />
        </label>
      </div>

      <StepHead label={L("الوقت", "Time")} note={L("ينتهي بعد منتصف الليل إن كانت النهاية قبل البداية", "Ends after midnight if the end is before the start")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("اليوم", "Day")}</FieldLabel>
          <input data-permit-field="date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} style={{ ...inputStyle, fontFamily: MONO }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("من", "From")}</FieldLabel>
          <TimeField ar={ar} dataKey="permit-from" value={form.from} onChange={(v) => patch({ from: v })} step={15} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>{L("إلى", "To")}</FieldLabel>
          <TimeField ar={ar} dataKey="permit-to" value={form.to} onChange={(v) => patch({ to: v })} step={15} />
        </label>
      </div>
      <label data-permit-field="outdoor" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink)", cursor: "pointer" }}>
        <input type="checkbox" checked={form.outdoor} onChange={(e) => patch({ outdoor: e.target.checked })} style={{ marginTop: 5 }} />
        <span>
          {L("عمل مكشوف تحت الشمس", "Sun-exposed outdoor work")}
          <span style={{ display: "block", fontSize: 11.5, color: "var(--nv-muted)" }}>{L("القرار 3337: لا يغطي التصريح 12:00–15:00 من 15 يونيو إلى 15 سبتمبر.", "Decision 3337: the permit cannot cover 12:00–15:00, 15 June – 15 September.")}</span>
        </span>
      </label>

      <StepHead label={L("الضوابط قبل البدء", "Controls before starting")} note={ar ? `${permitTypeRow(form.type)?.ar} — ${controls.length} ضوابط` : `${permitTypeRow(form.type)?.en} — ${controls.length} controls`} />
      <div data-permit-controls="1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 8 }}>
        {controls.map((row) => {
          const on = form.controls.includes(row.id);
          return (
            <label key={row.id} data-control={row.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${on ? "var(--nv-ok-line, #BFD9C8)" : "var(--nv-line)"}`, background: on ? "var(--nv-ok-soft)" : "var(--nv-card)", fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={on} onChange={(e) => patch({ controls: e.target.checked ? [...form.controls, row.id] : form.controls.filter((id) => id !== row.id) })} />
              {ar ? row.ar : row.en}
            </label>
          );
        })}
      </div>

      <Checklist dataKey="permit" items={checklist} />
      <GateLine gate={gate} ar={ar} dataAttr={{ "data-permit-gate": "1" }} />
      <SendButton ready={gate.ok} dataAttr={{ "data-permit-issue": "1" }} onClick={() => { if (onIssue(draft)) { if (request) onCancel?.(); else setForm((cur) => ({ ...cur, description: "", holderId: "", team: "", from: "", to: "", controls: [], outdoor: false })); } }}>
        {L("أصدر التصريح", "Issue the permit")}
      </SendButton>
      {request ? (
        <button type="button" data-permit-back="1" onClick={onCancel} style={{ fontFamily: "inherit", height: 36, borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {L("رجوع دون إصدار", "Back without issuing")}
        </button>
      ) : null}
    </DisciplineNewFrame>
  );
}

function PermitActions({ ar, row, onAct, onReview, actorId }) {
  const L = (a, e) => (ar ? a : e);
  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [areaSafe, setAreaSafe] = useState(false);
  const state = row.state;
  const permit = row.permit;
  const live = ["open", "active", "closing"].includes(state);
  const choices = [
    state === "requested" ? { id: "issue", label: L("راجع وأصدر", "Review and issue") } : null,
    state === "requested" ? { id: "decline", label: L("ارفض بسبب", "Decline with reason") } : null,
    live ? { id: "suspend", label: L("أوقف العمل", "Stop the work") } : null,
    state === "suspended" ? { id: "resume", label: L("استأنف", "Resume") } : null,
    live || ["suspended", "expired"].includes(state) ? { id: "close", label: L("أغلق بتوقيع", "Close with signature") } : null,
    live || state === "suspended" ? { id: "cancel", label: L("ألغِ", "Cancel") } : null,
  ].filter(Boolean);
  const gate = mode && mode !== "issue" ? checkPermitActionGate(permit, mode, { note, areaSafe, actorId }) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 8 }}>
        {[
          [L("المنفّذ", "Holder"), permit.holderName || "—"],
          [L("الفريق", "Team"), permit.team || "—"],
          [L("أصدره", "Issued by"), permit.issuedBy || "—"],
          [L("توقيع المنفّذ", "Holder's signature"), permit.acknowledgedAt ? `${permit.acknowledgedBy || permit.holderName} · ${String(permit.acknowledgedAt).slice(0, 16).replace("T", " ")}` : (state === "open" ? L("لم يوقّع بعد — لا يبدأ العمل", "Not yet — work may not start") : "—")],
          [L("الضوابط", "Controls"), permitControlRows(permit.type).filter((c) => (permit.controls || []).includes(c.id)).map((c) => (ar ? c.ar : c.en)).join("، ") || "—"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px", borderRadius: 8, background: "var(--nv-soft)" }}>
            <dt style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{k}</dt>
            <dd style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)" }}>{v}</dd>
          </div>
        ))}
      </dl>
      {(permit.trail || []).length ? (
        <ol style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 2, fontSize: 11.5, color: "var(--nv-muted)" }}>
          {permit.trail.map((t, i) => (
            <li key={i}>
              <span dir="ltr" style={{ fontFamily: MONO }}>{String(t.at).slice(0, 16).replace("T", " ")}</span>
              {" · "}{{ request: L("طُلب", "Requested"), issue: L("صدر", "Issued"), decline: L("رُفض", "Declined"), acknowledge: L("وقّع المنفّذ على الاستلام", "Holder signed"), requestClose: L("أنهى المنفّذ العمل", "Holder finished"), suspend: L("أوقف", "Stopped"), resume: L("استؤنف", "Resumed"), close: L("أُغلق", "Closed"), cancel: L("أُلغي", "Cancelled") }[t.type] || t.type}
              {t.by ? ` — ${t.by}` : ""}{t.note ? `: ${t.note}` : ""}
            </li>
          ))}
        </ol>
      ) : null}
      {choices.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {choices.map((c) => (
            <button key={c.id} type="button" data-permit-action={c.id} onClick={() => { if (c.id === "issue") { onReview?.(permit); return; } setMode(mode === c.id ? "" : c.id); setNote(""); setAreaSafe(false); }} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${mode === c.id ? "var(--nv-navy, #0B3D27)" : "var(--nv-line)"}`, background: mode === c.id ? "var(--nv-navy, #0B3D27)" : "var(--nv-card)", color: mode === c.id ? "#fff" : "var(--nv-ink)" }}>
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      {mode ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mode === "close" ? (
            <label data-permit-safe="1" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--nv-ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={areaSafe} onChange={(e) => setAreaSafe(e.target.checked)} style={{ marginTop: 4 }} />
              {L("تُرك الموقع آمناً: أُزيلت المخلّفات، وأُعيدت العوازل والطاقة، وأُبلغ الفريق.", "The site was left safe: debris cleared, isolations and power restored, the team told.")}
            </label>
          ) : null}
          <textarea data-permit-note="1" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "close" ? L("ملاحظة الإغلاق (اختياري)", "Closing note (optional)") : L("السبب — يبقى في سجل التصريح", "The reason — kept on the permit's trail")} style={{ ...textareaStyle, minHeight: 56 }} />
          <GateLine gate={gate} ar={ar} />
          <SendButton ready={Boolean(gate?.ok)} dataAttr={{ "data-permit-confirm": mode }} onClick={() => { if (onAct(row, mode, { note, areaSafe })) setMode(""); }}>
            {choices.find((c) => c.id === mode)?.label}
          </SendButton>
        </div>
      ) : null}
    </div>
  );
}

/** تصاريح العمل — issue, follow and close permits to work across the branches in scope. */
export default function PermitDesk({ ar, stations, recFor, staffOf, canEdit, today, onIssue, onAct, actorId = "" }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const permits = useMemo(() => stations.flatMap((s) => (recFor(s.id)?.permits || []).map((p) => ({ ...p, stationId: p.stationId || s.id, stationName: s.name }))), [stations, recFor]);
  const board = permitBoard(permits, now);
  const [face, setFace] = useState(board.requested ? "requested" : "live");
  const [review, setReview] = useState(null);
  const faces = [
    { id: "requested", label: L("طلبات", "Requests"), n: board.requested, test: (r) => r.state === "requested" },
    { id: "live", label: L("سارية", "Live"), n: board.live, test: (r) => ["open", "active", "closing"].includes(r.state) },
    { id: "suspended", label: L("موقوفة", "Stopped"), n: board.suspended, test: (r) => r.state === "suspended" },
    { id: "unclosed", label: L("تحتاج إغلاقاً", "Need closing"), n: board.unclosed, test: (r) => r.state === "expired" },
    { id: "closed", label: L("مغلقة", "Closed"), n: board.rows.filter((r) => ["closed", "cancelled", "declined"].includes(r.state)).length, test: (r) => ["closed", "cancelled", "declined"].includes(r.state) },
    { id: "all", label: L("الكل", "All"), n: board.rows.length, test: () => true },
  ];
  const shown = board.rows
    .filter((faces.find((f) => f.id === face) || faces[faces.length - 1]).test)
    .sort((a, b) => String(b.permit.startAt || "").localeCompare(String(a.permit.startAt || "")));
  const fold = useCollapsibleItems(shown.map((r) => r.permit.id));
  return (
    <div data-hse="admin-permits" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SafetyKpiRow items={[
        { label: L("طلبات بانتظارك", "Requests waiting"), value: board.requested, sub: L("طلبها العمال — راجع وأصدر أو ارفض", "Asked by workers — review, issue or decline"), tone: board.requested ? "warn" : null },
        { label: L("سارية الآن", "Live now"), value: board.live, sub: board.awaitingAck ? (ar ? `${board.awaitingAck} لم يوقّع منفّذها بعد` : `${board.awaitingAck} not yet signed by the holder`) : L("عمل خطِر جارٍ بتصريح موقّع", "Hazardous work under a signed permit"), tone: board.awaitingAck ? "warn" : "ok" },
        { label: L("انتهى العمل", "Work finished"), value: board.closing, sub: L("يطلب المنفّذ الإغلاق — وقّع على سلامة الموقع", "Holder asks to close — sign the site safe"), tone: board.closing ? "warn" : null },
        { label: L("موقوفة", "Stopped"), value: board.suspended, sub: L("أوقفها المشرف لسبب مكتوب", "Stopped with a written reason"), tone: board.suspended ? "warn" : null },
        { label: L("تنتهي خلال ساعتين", "End within 2 h"), value: board.endingSoon, sub: L("تُغلق أو تُجدّد بتصريح جديد", "Close, or renew with a new permit"), tone: board.endingSoon ? "warn" : null },
        { label: L("انتهت دون إغلاق", "Expired unclosed"), value: board.unclosed, sub: L("لم يُوقَّع على سلامة الموقع", "No site-safe signature"), tone: board.unclosed ? "bad" : "ok" },
      ]} />
      <TwoPaneWorkspace
        dataKey="safety-permits"
        raise={canEdit && stations.length ? <PermitComposer key={review?.id || "new"} ar={ar} stations={stations} staffOf={staffOf} today={today} onIssue={onIssue} request={review} onCancel={() => setReview(null)} /> : null}
        list={(
          <ListStack data-permit-list="1">
            <StatusFilterPills card dataKey="permits" title={L("سجل التصاريح", "Permit register")} value={face} onChange={setFace} items={faces} />
            <DisciplineRowList dataKey="permits" empty={L("لا تصاريح في هذا الترشيح.", "No permits in this filter.")}>
              {shown.map((row) => {
                const p = row.permit;
                const label = PERMIT_STATUS_LABEL[row.state] || PERMIT_STATUS_LABEL.open;
                const chip = label.tone === "bad"
                  ? <AttentionChip tone="bad">{ar ? label.ar : label.en}</AttentionChip>
                  : label.tone === "warn"
                    ? <AttentionChip tone="warn">{ar ? label.ar : label.en}</AttentionChip>
                    : <span style={{ fontSize: 11, fontWeight: 700, color: label.tone === "ok" ? "var(--nv-ok-ink)" : "var(--nv-muted)" }}>{ar ? label.ar : label.en}</span>;
                return (
                  <DisciplineRow
                    key={p.id}
                    id={p.id}
                    dataKey="permit"
                    ar={ar}
                    badge={<span dir="ltr" style={{ fontFamily: MONO }}>{p.id}</span>}
                    title={`${ar ? permitTypeRow(p.type)?.ar || "—" : permitTypeRow(p.type)?.en || "—"} — ${p.description || "—"}`}
                    sub={`${p.stationName}${p.holderName ? ` · ${p.holderName}` : ""} · ${windowText(p)}${p.outdoor ? (ar ? " · مكشوف" : " · outdoor") : ""}`}
                    chip={chip}
                    open={fold.isOpen(p.id)}
                    onOpen={() => fold.toggle(p.id)}
                  >
                    {canEdit ? <PermitActions ar={ar} row={row} onAct={onAct} actorId={actorId} onReview={(p) => { setReview(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} /> : null}
                  </DisciplineRow>
                );
              })}
            </DisciplineRowList>
            <p className="nv-cic" style={{ margin: 0, padding: "10px 14px", fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
              <ArticleBadge>{L("قاعدة", "Rule")}</ArticleBadge>{" "}
              {L(`دورة التصريح: يطلبه المنفّذ أو يُصدره المشرف مباشرة ← يؤكّد المُصدر الضوابط ← يوقّع المنفّذ على الاستلام فيبدأ العمل ← يُنهي المنفّذ ← يغلق المُصدر بتوقيع على سلامة الموقع. المُصدر والمنفّذ لا يكونان شخصاً واحداً. التصريح لوردية واحدة (${PERMIT_MAX_HOURS} ساعة).`, `Lifecycle: the holder requests or the supervisor issues directly → the issuer confirms the controls → the holder signs and work starts → the holder finishes → the issuer closes with a site-safe signature. Issuer and holder are never one person. One permit, one shift (${PERMIT_MAX_HOURS} h).`)}
            </p>
          </ListStack>
        )}
      />
    </div>
  );
}
