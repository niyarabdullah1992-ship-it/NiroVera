import React, { useEffect, useMemo, useState } from "react";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import {
  canEditOrgDesign,
  CHANGE_OP_LABELS,
  CHANGE_OPS,
  CHANGE_STATUS_LABELS,
  checkOrgChangeGate,
  deriveChangeImpact,
  deriveSeatRegister,
  DOA_KIND_LABELS,
  isOrgOwner,
  ORG_LEVELS,
  orgAsOf,
  orgDesignOf,
  todayKey,
  unitSeatTree,
} from "@/lib/orgDesign";
import { saveOrgChangeDraft, transitionOrgChange } from "@/lib/orgDesignStore";
import { printReport } from "@/lib/printReport";
import RightHint from "@/components/shared/RightHint";
import { mono } from "@/components/schedules/scheduleChrome";
import { EmptyInvite, GateLine, Note, Slab, SlabBody, StateChip, SubHead, ToneChip, btnGhost, btnPrimary, btnQuiet, fmtDay, levelLabel, seatOptionLabel } from "./orgDesignUi";

const RESIDENCE = [
  ["same", "لا يغيّر محل الإقامة", "Residence unchanged"],
  ["change", "يغيّر محل الإقامة — بموافقته الكتابية", "Changes residence — written consent"],
  ["necessity", "ضرورة عارضة مؤقتة (حتى 30 يوماً في السنة)", "Temporary necessity (≤ 30 days a year)"],
];

const blankOp = (type = "moveSeat") => ({ type });

/** Plain words for one step, for lists and the decision print. */
function opLine(op, ctx, ar) {
  const unit = (id) => ctx.stations.find((s) => String(s.id) === String(id))?.name || (op.type === "moveSeat" && op.toStationId === ctx.newUnitId ? ctx.newUnitName : "") || id || "—";
  const seat = (id) => ctx.seatById.get(String(id))?.title || id || "—";
  switch (op.type) {
    case "moveSeat": return ar ? `نقل «${seat(op.seatId)}» إلى ${unit(op.toStationId)}` : `Move “${seat(op.seatId)}” to ${unit(op.toStationId)}`;
    case "reparentUnit": return ar ? `${unit(op.stationId)} تتبع ${unit(op.toParentId)}` : `${unit(op.stationId)} under ${unit(op.toParentId)}`;
    case "createUnit": return ar ? `إنشاء «${op.name || "—"}» تحت ${unit(op.parentId)}` : `Create “${op.name || "—"}” under ${unit(op.parentId)}`;
    case "closeUnit": return ar ? `إغلاق ${unit(op.stationId)}` : `Close ${unit(op.stationId)}`;
    case "setBudget": return ar ? `ميزانية ${unit(op.stationId)}: ${op.budget === "" ? "بلا" : op.budget}` : `Budget of ${unit(op.stationId)}: ${op.budget === "" ? "none" : op.budget}`;
    case "freezeSeat": return ar ? `${op.frozen === false ? "فك تجميد" : "تجميد"} «${seat(op.seatId)}»` : `${op.frozen === false ? "Unfreeze" : "Freeze"} “${seat(op.seatId)}”`;
    case "setDotted": return ar ? `خط منقّط من «${seat(op.seatId)}» إلى «${seat(op.toSeatId)}»` : `Dotted line from “${seat(op.seatId)}” to “${seat(op.toSeatId)}”`;
    default: return op.type;
  }
}

/**
 * «التغييرات» — structural change requests with an effective date: draft, preview impact,
 * approval by another HR member or the owner, publication on the date as a signed org decision,
 * and the structure as of any day (past decisions undone, approved plans applied).
 */
const CHANGE_FACE_LABELS = {
  pending: { ar: "بانتظار الاعتماد", en: "Awaiting approval" },
  approved: { ar: "معتمدة", en: "Approved" },
  draft: { ar: "مسودات", en: "Drafts" },
  rejected: { ar: "مرفوضة", en: "Rejected" },
  published: { ar: "منشورة", en: "Published" },
};

export default function OrgChangesBoard({ ar, data, actor, companyId, canEdit, seed, onSeedConsumed }) {
  const today = todayKey();
  const design = orgDesignOf(data);
  const seats = useMemo(() => deriveSeatRegister(data, today), [data, today]);
  const seatById = useMemo(() => new Map(seats.map((s) => [s.seatId, s])), [seats]);
  const stations = (data?.stations || []).filter((s) => !s.closedAt);
  const [draft, setDraft] = useState(null);
  const [gate, setGate] = useState(null);
  const [notes, setNotes] = useState({});
  const [rowGate, setRowGate] = useState({});
  const [asOf, setAsOf] = useState(today);
  const [changesFace, setChangesFace] = useState("all");

  useEffect(() => {
    if (!seed) return;
    setDraft({ id: "", title: "", reason: "", effectiveDate: today, ops: [{ ...blankOp(seed.type), ...seed }] });
    setGate(null);
    onSeedConsumed?.();
  }, [seed]);

  const ctx = { stations: data?.stations || [], seatById };
  const groups = ["pending", "approved", "draft", "rejected", "published"].map((status) => ({
    status,
    rows: design.changes.filter((c) => (c.status || "draft") === status),
  }));

  const liveGate = draft ? checkOrgChangeGate(data, draft, { today }) : null;
  const impact = useMemo(() => (draft && liveGate?.ok ? deriveChangeImpact(data, draft, { day: today }) : null), [data, draft, liveGate?.ok, today]);

  const setOp = (i, patch) => setDraft((d) => ({ ...d, ops: d.ops.map((op, j) => (j === i ? { ...op, ...patch } : op)) }));
  const saveDraft = (submit = false) => {
    const res = saveOrgChangeDraft(companyId, actor, draft);
    if (!res.ok) { setGate(res); return; }
    if (submit) {
      const next = transitionOrgChange(companyId, actor, res.id, "pending", { today });
      if (!next.ok) { setGate(next); setDraft((d) => ({ ...d, id: res.id })); return; }
    }
    setGate(null);
    setDraft(null);
  };
  const act = (change, next) => {
    const res = transitionOrgChange(companyId, actor, change.id, next, { note: notes[change.id] || "", today });
    setRowGate((g) => ({ ...g, [change.id]: res }));
  };

  const asOfData = useMemo(() => orgAsOf(data, asOf, { today }), [data, asOf, today]);
  const tree = useMemo(() => unitSeatTree(asOfData, asOf), [asOfData, asOf]);

  const printAsOf = () => {
    const rows = [];
    const walk = (node, path) => {
      const here = [...path, node.name];
      node.seats.forEach((s) => rows.push([here.join(" › "), s.code, s.title, ar ? ({ filled: "مشغول", vacant: "شاغر", frozen: "مجمّد", planned: "مخطط" }[s.state]) : s.state, s.holder || s.acting || "—"]));
      node.children.forEach((c) => walk(c, here));
    };
    tree.forEach((n) => walk(n, []));
    printReport({
      title: ar ? `الهيكل التنظيمي كما في ${asOf}` : `Org structure as of ${asOf}`,
      companyName: data?.name || "",
      periodLabel: asOf,
      dir: ar ? "rtl" : "ltr",
      sections: [{ heading: ar ? "الوحدات والمناصب" : "Units and seats", headers: ar ? ["الوحدة", "الرمز", "المنصب", "الحالة", "الشاغل"] : ["Unit", "Code", "Seat", "State", "Holder"], rows }],
    });
  };
  const printDecision = (c) => {
    printReport({
      title: ar ? `قرار تنظيمي ${c.decision?.seal || ""}` : `Org decision ${c.decision?.seal || ""}`,
      companyName: data?.name || "",
      periodLabel: c.effectiveDate,
      dir: ar ? "rtl" : "ltr",
      sections: [
        { heading: c.title, headers: ar ? ["البند", "القيمة"] : ["Item", "Value"], rows: [
          [ar ? "السبب" : "Reason", c.reason],
          [ar ? "يسري من" : "Effective", c.effectiveDate],
          [ar ? "أعدّه" : "Prepared by", c.createdBy || "—"],
          [ar ? "اعتمده" : "Approved by", c.approvedBy || "—"],
          [ar ? "نُشر" : "Published", `${c.publishedBy || "—"} · ${String(c.publishedAt || "").slice(0, 16).replace("T", " ")}`],
          [ar ? "الختم" : "Seal", c.decision?.seal || "—"],
          [ar ? "بصمة المحتوى" : "Content hash", c.decision?.hash || "—"],
        ] },
        { heading: ar ? "خطوات القرار" : "Steps", headers: ["#", ar ? "الخطوة" : "Step"], rows: (c.ops || []).map((op, i) => [String(i + 1), opLine(op, ctx, ar)]) },
      ],
    });
  };

  const canApprove = (c) => canEditOrgDesign(actor, data) && (String(c.createdById || "") !== String(actor?.id || "") || isOrgOwner(actor, data));

  return (
    <div className="nv-od">
      <Slab
        label={ar ? "التغييرات التنظيمية" : "Org changes"}
        title={ar ? "التغييرات التنظيمية" : "Org changes"}
        note={ar
          ? "التغيير البنيوي يُكتب أولاً: ماذا يتغير، لماذا، ومتى يسري. ترى أثره قبل اعتماده — من يتغير مديره ومن يتغير معتمِد طلباته — ثم يعتمده مسؤول آخر، ويُنشر في تاريخه قراراً موقّعاً في سجل التدقيق."
          : "A structural change is written first: what, why, and from when. See its impact before approval — who changes manager, whose approvals move — another HR member approves, and it publishes on its date as a signed decision."}
        trailing={canEdit && !draft ? <button type="button" style={btnPrimary()} onClick={() => { setDraft({ id: "", title: "", reason: "", effectiveDate: today, ops: [blankOp()] }); setGate(null); }}>{ar ? "＋ تغيير تنظيمي" : "+ Org change"}</button> : null}
      >
        {draft ? (
          <SlabBody style={{ gap: 14, borderBottom: "1px solid var(--nv-line2, var(--nv-line))" }}>
            <SubHead>{draft.id ? (ar ? "تعديل التغيير" : "Edit the change") : (ar ? "تغيير جديد" : "New change")}</SubHead>
            <div className="nv-od-form">
              <label className="nv-od-field">{ar ? "العنوان" : "Title"}
                <input className="nv-od-input" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
              </label>
              <label className="nv-od-field">{ar ? "يسري من" : "Effective from"}
                <input className="nv-od-input" type="date" value={draft.effectiveDate} onChange={(e) => setDraft((d) => ({ ...d, effectiveDate: e.target.value }))} />
              </label>
              <label className="nv-od-field nv-od-field--wide">{ar ? "السبب (يظهر في القرار)" : "Reason (shown on the decision)"}
                <textarea className="nv-od-input" rows={2} value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {draft.ops.map((op, i) => (
                <StepEditor key={i} ar={ar} op={op} index={i} seats={seats} stations={stations} onChange={(patch) => setOp(i, patch)} onRemove={draft.ops.length > 1 ? () => setDraft((d) => ({ ...d, ops: d.ops.filter((_, j) => j !== i) })) : null} newUnits={draft.ops.filter((o, j) => j < i && o.type === "createUnit")} />
              ))}
              <div style={{ paddingTop: 12 }}><button type="button" style={btnGhost()} onClick={() => setDraft((d) => ({ ...d, ops: [...d.ops, blankOp()] }))}>{ar ? "＋ خطوة" : "+ Step"}</button></div>
            </div>
            {liveGate && !liveGate.ok ? <GateLine gate={liveGate} ar={ar} /> : null}
            {impact ? <ImpactBlock ar={ar} impact={impact} /> : null}
            <GateLine gate={gate} ar={ar} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" style={btnPrimary(!liveGate?.ok)} disabled={!liveGate?.ok} onClick={() => saveDraft(true)}>{ar ? "أرسل للاعتماد" : "Submit for approval"}</button>
              <button type="button" style={btnGhost()} onClick={() => saveDraft(false)}>{ar ? "احفظ مسودة" : "Save draft"}</button>
              <button type="button" style={btnQuiet()} onClick={() => { setDraft(null); setGate(null); }}>{ar ? "إلغاء" : "Cancel"}</button>
            </div>
          </SlabBody>
        ) : null}

        {!design.changes.length && !draft ? (
          <EmptyInvite text={ar ? "لا تغييرات بعد. حين تنقل منصباً أو تنشئ وحدة أو تغيّر تبعيتها، اكتبها هنا بتاريخ سريان — ليبقى كل تغيير قراراً له أثر وتاريخ." : "No changes yet. When you move a seat, create a unit or change its parent, write it here with an effective date."} />
        ) : null}

        {/* «طلبات التغيير» filter as in طلباتي: الكل, what waits on approval, then the settled states. */}
        {design.changes.length ? (
          <StatusFilterPills
            dataKey="org-changes"
            title={ar ? "طلبات التغيير" : "Change requests"}
            value={changesFace}
            onChange={setChangesFace}
            items={[
              { id: "all", label: ar ? "الكل" : "All", n: groups.reduce((n, g) => n + g.rows.length, 0) },
              ...groups.map((g) => ({ id: g.status, label: ar ? CHANGE_FACE_LABELS[g.status].ar : CHANGE_FACE_LABELS[g.status].en, n: g.rows.length })),
            ]}
          />
        ) : null}

        {groups.filter((g) => g.rows.length && (changesFace === "all" || g.status === changesFace)).map((g) => (
          <div key={g.status} style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "9px 18px", background: "var(--nv-soft)", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? CHANGE_STATUS_LABELS[g.status].ar : CHANGE_STATUS_LABELS[g.status].en}</span>
              <span dir="ltr" style={{ ...mono, fontSize: 11.5, color: "var(--nv-muted)" }}>{g.rows.length}</span>
            </div>
            {g.rows.map((c) => (
              <ChangeCard
                key={c.id}
                ar={ar}
                change={c}
                data={data}
                ctx={ctx}
                today={today}
                canEdit={canEdit}
                canApprove={canApprove(c)}
                note={notes[c.id] || ""}
                onNote={(v) => setNotes((n) => ({ ...n, [c.id]: v }))}
                gate={rowGate[c.id]}
                onAct={(next) => act(c, next)}
                onEdit={() => setDraft({ id: c.id, title: c.title, reason: c.reason, effectiveDate: c.effectiveDate, ops: (c.ops || []).map((op) => ({ ...op })) })}
                onPrint={() => printDecision(c)}
              />
            ))}
          </div>
        ))}
      </Slab>

      <Slab
        title={ar ? "الهيكل في تاريخ" : "The structure on a date"}
        note={ar
          ? "تاريخ ماضٍ: تُعاد القرارات المنشورة بعده. تاريخ قادم: تُطبَّق التغييرات المعتمدة حتى ذلك اليوم — معاينة الخطة قبل سريانها."
          : "A past day undoes decisions published after it. A future day applies approved changes up to that day — a preview of the plan."}
        trailing={(
          <>
            <input className="nv-od-input" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || today)} aria-label={ar ? "التاريخ" : "Date"} style={{ height: 32 }} />
            <button type="button" style={btnGhost()} onClick={printAsOf}>{ar ? "طباعة / PDF" : "Print / PDF"}</button>
          </>
        )}
      >
        <SlabBody>
          <UnitTree ar={ar} nodes={tree} />
        </SlabBody>
      </Slab>
    </div>
  );
}

function StepEditor({ ar, op, index, seats, stations, onChange, onRemove, newUnits }) {
  const unitOptions = [...stations.map((s) => ({ id: s.id, name: s.name })), ...newUnits.map((u) => ({ id: u.unitId, name: `${u.name} ${ar ? "(جديدة)" : "(new)"}` }))].filter((u) => u.id);
  const seat = seats.find((s) => s.seatId === op.seatId);
  const filledMove = op.type === "moveSeat" && seat?.holderId;
  const unitSelect = (key, label) => (
    <label className="nv-od-field">{label}
      <select className="nv-od-select" value={op[key] || ""} onChange={(e) => onChange({ [key]: e.target.value })}>
        <option value="">{ar ? "— اختر —" : "— pick —"}</option>
        {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </label>
  );
  const seatSelect = (key, label, filter = () => true) => (
    <label className="nv-od-field">{label}
      <select className="nv-od-select" value={op[key] || ""} onChange={(e) => onChange({ [key]: e.target.value })}>
        <option value="">{ar ? "— اختر —" : "— pick —"}</option>
        {seats.filter(filter).map((s) => <option key={s.seatId} value={s.seatId}>{seatOptionLabel(s, ar)}</option>)}
      </select>
    </label>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0", borderTop: index ? "1px solid var(--nv-line2, var(--nv-line))" : "none" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <label className="nv-od-field" style={{ flex: "1 1 220px" }}>{ar ? `الخطوة ${index + 1}` : `Step ${index + 1}`}
          <select className="nv-od-select" value={op.type} onChange={(e) => onChange({ type: e.target.value })}>
            {CHANGE_OPS.map((t) => <option key={t} value={t}>{ar ? CHANGE_OP_LABELS[t].ar : CHANGE_OP_LABELS[t].en}</option>)}
          </select>
        </label>
        {onRemove ? <button type="button" style={btnQuiet({ padding: "8px 0" })} onClick={onRemove}>{ar ? "حذف الخطوة" : "Remove step"}</button> : null}
      </div>
      <div className="nv-od-form">
        {op.type === "moveSeat" ? (
          <>
            {seatSelect("seatId", ar ? "المنصب" : "Seat")}
            {unitSelect("toStationId", ar ? "إلى الوحدة" : "To unit")}
            {filledMove ? (
              <label className="nv-od-field nv-od-field--wide">{ar ? `المنصب يشغله ${seat.holderName} — هل يغيّر النقل محل إقامته؟ (المادة 58)` : `Held by ${seat.holderName} — does the move change residence? (Art. 58)`}
                <select className="nv-od-select" value={op.residence || ""} onChange={(e) => onChange({ residence: e.target.value })}>
                  <option value="">{ar ? "— حدّد —" : "— say —"}</option>
                  {RESIDENCE.map(([id, a, e]) => <option key={id} value={id}>{ar ? a : e}</option>)}
                </select>
              </label>
            ) : null}
            {filledMove && op.residence === "necessity" ? (
              <label className="nv-od-field">{ar ? "حتى" : "Until"}
                <input className="nv-od-input" type="date" value={op.necessityUntil || ""} onChange={(e) => onChange({ necessityUntil: e.target.value })} />
              </label>
            ) : null}
          </>
        ) : null}
        {op.type === "reparentUnit" ? (<>{unitSelect("stationId", ar ? "الوحدة" : "Unit")}{unitSelect("toParentId", ar ? "تتبع" : "Under")}</>) : null}
        {op.type === "createUnit" ? (
          <>
            <label className="nv-od-field">{ar ? "اسم الوحدة" : "Unit name"}
              <input className="nv-od-input" value={op.name || ""} onChange={(e) => onChange({ name: e.target.value, unitId: op.unitId || `st_new_${Date.now().toString(36)}` })} />
            </label>
            {unitSelect("parentId", ar ? "تحت" : "Under")}
            <label className="nv-od-field">{ar ? "المستوى" : "Level"}
              <select className="nv-od-select" value={op.orgLevel || "department"} onChange={(e) => onChange({ orgLevel: e.target.value })}>
                {ORG_LEVELS.filter((l) => l !== "company").map((l) => <option key={l} value={l}>{levelLabel(l, ar)}</option>)}
              </select>
            </label>
            <label className="nv-od-field">{ar ? "ميزانية العدد" : "Headcount budget"}
              <input className="nv-od-input nv-od-num" inputMode="numeric" value={op.budget ?? ""} onChange={(e) => onChange({ budget: e.target.value })} />
            </label>
          </>
        ) : null}
        {op.type === "closeUnit" ? unitSelect("stationId", ar ? "الوحدة" : "Unit") : null}
        {op.type === "setBudget" ? (
          <>
            {unitSelect("stationId", ar ? "الوحدة" : "Unit")}
            <label className="nv-od-field">{ar ? "الميزانية" : "Budget"}
              <input className="nv-od-input nv-od-num" inputMode="numeric" value={op.budget ?? ""} onChange={(e) => onChange({ budget: e.target.value })} />
            </label>
          </>
        ) : null}
        {op.type === "freezeSeat" ? (
          <>
            {seatSelect("seatId", ar ? "المنصب" : "Seat", (s) => !s.holderId)}
            <label className="nv-od-field">{ar ? "الإجراء" : "Action"}
              <select className="nv-od-select" value={op.frozen === false ? "unfreeze" : "freeze"} onChange={(e) => onChange({ frozen: e.target.value !== "unfreeze" })}>
                <option value="freeze">{ar ? "تجميد" : "Freeze"}</option>
                <option value="unfreeze">{ar ? "فك التجميد" : "Unfreeze"}</option>
              </select>
            </label>
          </>
        ) : null}
        {op.type === "setDotted" ? (<>{seatSelect("seatId", ar ? "المنصب" : "Seat")}{seatSelect("toSeatId", ar ? "خط منقّط إلى" : "Dotted line to", (s) => s.seatId !== op.seatId)}</>) : null}
      </div>
    </div>
  );
}

function art58Hint(m, ar) {
  return {
    view: "manager",
    right: ar ? m.ar : m.en,
    ifNot: m.residence === "change"
      ? (ar ? "لا يُنشر القرار حتى تُرفق موافقته الكتابية — المنصة توقف النشر." : "The decision does not publish until the written consent is attached — the platform holds it.")
      : m.residence === "necessity"
        ? (ar ? "ما زاد على 30 يوماً في السنة يحتاج موافقته الكتابية." : "Anything beyond 30 days a year needs the worker's written consent.")
        : (ar ? "إن تبيّن أن النقل يغيّر محل الإقامة فهو بموافقته الكتابية فقط." : "If the move turns out to change residence, it needs written consent."),
    law: { article: "58", label: ar ? "المادة 58" : "Art. 58" },
  };
}

function ImpactBlock({ ar, impact }) {
  const none = !impact.managerChanges.length && !impact.approvalChanges.length && !impact.budget.length && !impact.ministry.length;
  return (
    <div style={{ borderTop: "1px solid var(--nv-line2, var(--nv-line))", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
      <SubHead>{ar ? "أثر التغيير" : "Impact"}</SubHead>
      {none ? <Note>{ar ? "لا يتغير مدير أحد ولا مسار اعتماده." : "Nobody changes manager or approval path."}</Note> : null}
      <ul className="nv-od-list nv-od-list--inset">
        {impact.managerChanges.map((c) => (
          <li key={`m-${c.employeeId}`}><span className="nv-od-dot" aria-hidden /><span>{ar ? `${c.name}: مديره ${c.fromName || "—"} ← ${c.toName || "—"}` : `${c.name}: manager ${c.fromName || "—"} → ${c.toName || "—"}`}</span></li>
        ))}
        {impact.approvalChanges.map((c) => (
          <li key={`a-${c.kind}-${c.employeeId}`}><span className="nv-od-dot" aria-hidden /><span>{ar ? `${c.name} — ${DOA_KIND_LABELS[c.kind]?.ar}: ${c.fromName || "مدير الوحدة"} ← ${c.toName || "مدير الوحدة"}` : `${c.name} — ${DOA_KIND_LABELS[c.kind]?.en}: ${c.fromName || "unit manager"} → ${c.toName || "unit manager"}`}</span></li>
        ))}
        {impact.budget.map((b) => (
          <li key={`b-${b.stationId}`}><span className="nv-od-dot" aria-hidden /><span style={{ flex: "1 1 200px" }}>{ar ? `${b.name}: ${b.before} ← ${b.after}${b.budget != null ? ` من ميزانية ${b.budget}` : ""}` : `${b.name}: ${b.before} → ${b.after}${b.budget != null ? ` of ${b.budget}` : ""}`}</span>{b.over ? <ToneChip tone="bad">{ar ? "فوق الميزانية" : "Over budget"}</ToneChip> : null}</li>
        ))}
        {impact.ministry.map((m) => (
          <li key={`l-${m.employeeId}`} data-ministry-row="org-58">
            <span className="nv-od-dot" aria-hidden />
            <span style={{ flex: "1 1 220px", minWidth: 0 }}>{ar ? m.ar : m.en}</span>
            <RightHint hint={art58Hint(m, ar)} ar={ar} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangeCard({ ar, change: c, data, ctx, today, canEdit, canApprove, note, onNote, gate, onAct, onEdit, onPrint }) {
  const [open, setOpen] = useState(c.status === "pending");
  const status = c.status || "draft";
  const impact = useMemo(() => (open && ["pending", "approved", "draft"].includes(status) ? deriveChangeImpact(data, c, { day: today }) : null), [open, status, data, c, today]);
  const due = status === "approved" && String(c.effectiveDate || "") <= today;
  const fullCtx = { ...ctx, newUnitId: (c.ops || []).find((o) => o.type === "createUnit")?.unitId, newUnitName: (c.ops || []).find((o) => o.type === "createUnit")?.name };
  return (
    <div data-change-status={status} style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--nv-line2, var(--nv-line))" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ fontFamily: "inherit", textAlign: "start", background: "none", border: "none", cursor: "pointer", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", color: "inherit" }}>
        <span style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0, flex: "1 1 260px" }}>
          <span aria-hidden style={{ fontSize: 11, color: "var(--nv-muted)", marginTop: 4, display: "inline-block", transform: open ? "rotate(90deg)" : (ar ? "scaleX(-1)" : "none") }}>▸</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <b style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{c.title}</b>
            <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>
              {ar ? `يسري ${fmtDay(c.effectiveDate, ar)} · أعدّه ${c.createdBy || "—"}` : `Effective ${fmtDay(c.effectiveDate, ar)} · by ${c.createdBy || "—"}`}
              {c.approvedBy ? (ar ? ` · اعتمده ${c.approvedBy}` : ` · approved by ${c.approvedBy}`) : ""}
            </span>
          </span>
        </span>
        {status === "published" && c.decision?.seal ? <span className="nv-od-code" dir="ltr">{c.decision.seal}</span> : null}
        {c.publishBlocked ? <ToneChip tone="bad">{ar ? "النشر موقوف" : "Publish held"}</ToneChip> : null}
      </button>
      {open ? (
        <div style={{ padding: "0 18px 14px", paddingInlineStart: 39, display: "flex", flexDirection: "column", gap: 10 }}>
          {c.reason ? <Note>{c.reason}</Note> : null}
          <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 12.5, lineHeight: 1.9, color: "var(--nv-ink)" }}>
            {(c.ops || []).map((op, i) => <li key={i}>{opLine(op, fullCtx, ar)}</li>)}
          </ol>
          {impact ? <ImpactBlock ar={ar} impact={impact} /> : null}
          {c.publishBlocked ? <GateLine gate={{ ok: false, ...c.publishBlocked }} ar={ar} /> : null}
          {status === "rejected" && c.rejectReason ? <Note>{ar ? `سبب الرفض: ${c.rejectReason}` : `Rejected: ${c.rejectReason}`}</Note> : null}
          {status === "published" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
              <span style={{ color: "var(--nv-muted)" }}>{ar ? "بصمة القرار" : "Decision hash"}</span>
              <span className="nv-od-code" dir="ltr" style={{ overflowWrap: "anywhere", whiteSpace: "normal" }}>{c.decision?.hash || "—"}</span>
            </div>
          ) : null}
          <GateLine gate={gate} ar={ar} />
          {canEdit ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {status === "draft" || status === "rejected" ? (
                <>
                  <button type="button" style={btnGhost()} onClick={onEdit}>{ar ? "تعديل" : "Edit"}</button>
                  {status === "draft" ? <button type="button" style={btnPrimary()} onClick={() => onAct("pending")}>{ar ? "أرسل للاعتماد" : "Submit"}</button> : <button type="button" style={btnGhost()} onClick={() => onAct("draft")}>{ar ? "أعده مسودة" : "Back to draft"}</button>}
                </>
              ) : null}
              {status === "pending" ? (
                canApprove ? (
                  <>
                    <button type="button" style={btnPrimary()} onClick={() => onAct("approved")}>{ar ? "اعتمد" : "Approve"}</button>
                    <input className="nv-od-input" style={{ flex: "1 1 200px", height: 32 }} value={note} onChange={(e) => onNote(e.target.value)} placeholder={ar ? "سبب الرفض (مطلوب للرفض)" : "Rejection reason (required)"} aria-label={ar ? "سبب الرفض" : "Rejection reason"} />
                    <button type="button" style={btnGhost()} onClick={() => onAct("rejected")}>{ar ? "ارفض" : "Reject"}</button>
                  </>
                ) : <Note>{ar ? "فصل المهام: يعتمده مسؤول آخر أو المالك." : "Segregation of duties: another HR member or the owner approves."}</Note>
              ) : null}
              {status === "approved" ? (
                due
                  ? <button type="button" style={btnPrimary()} onClick={() => onAct("published")}>{ar ? "انشر الآن" : "Publish now"}</button>
                  : <Note>{ar ? `يُنشر تلقائياً في ${fmtDay(c.effectiveDate, ar)}.` : `Publishes itself on ${fmtDay(c.effectiveDate, ar)}.`}</Note>
              ) : null}
              {["draft", "pending", "approved"].includes(status) ? <button type="button" style={btnQuiet()} onClick={() => onAct("cancelled")}>{ar ? "إلغاء التغيير" : "Cancel change"}</button> : null}
              {status === "published" ? <button type="button" style={btnGhost()} onClick={onPrint}>{ar ? "طباعة القرار" : "Print decision"}</button> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UnitTree({ ar, nodes }) {
  if (!nodes.length) return <Note>{ar ? "لا وحدات في هذا التاريخ." : "No units on this date."}</Note>;
  return (
    <ul className="nv-od-tree">
      {nodes.map((n) => (
        <li key={n.stationId}>
          <div className="nv-od-unit"><b>{n.name}</b><span className="nv-od-muted" style={{ fontSize: 11 }}>{levelLabel(n.level, ar)}</span></div>
          {n.seats.length ? (
            <div className="nv-od-seats">
              {n.seats.map((s) => (
                <div key={s.seatId} className="nv-od-seat">
                  <span className="nv-od-code" dir="ltr">{s.code}</span>
                  <span>{s.title}</span>
                  <span className="nv-od-muted">— {s.holder || (s.acting ? `${s.acting} ${ar ? "(تكليف)" : "(acting)"}` : (ar ? "شاغر" : "vacant"))}</span>
                  {s.state !== "filled" ? <StateChip state={s.state} ar={ar} /> : null}
                </div>
              ))}
            </div>
          ) : null}
          {n.children.length ? <UnitTree ar={ar} nodes={n.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
