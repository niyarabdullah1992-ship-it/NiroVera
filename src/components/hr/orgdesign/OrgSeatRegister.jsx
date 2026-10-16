import React, { useMemo, useState } from "react";
import { deriveSeatRegister, SEAT_STATES, SEAT_STATE_LABELS, todayKey } from "@/lib/orgDesign";
import { patchSeatDesign } from "@/lib/orgDesignStore";
import { endActingAssignment, openHireDrawer, setActingAssignment } from "@/lib/orgHire";
import { EmptyInvite, Face, GateLine, SectionHead, StateChip, ToneChip, fmtDay, levelLabel, seatOptionLabel } from "./orgDesignUi";

const NAT = {
  saudi: { ar: "سعودي", en: "Saudi" },
  non_saudi: { ar: "غير سعودي", en: "Non-Saudi" },
  unknown: { ar: "غير محدد", en: "Unknown" },
  none: { ar: "—", en: "—" },
};

const ACTING_ERRORS = {
  FIELDS: { ar: "حدّد الموظف وتاريخ النهاية — التكليف ينتهي تلقائياً في تاريخه.", en: "Pick the person and an end date — the acting role ends by itself." },
  HOME: { ar: "التكليف على وحدة أخرى غير وحدة الموظف الأصلية — في وحدته يُنقل أو يُعيَّن.", en: "Acting is for another unit — within their own unit, assign or transfer instead." },
  MISSING: { ar: "الموظف أو الوحدة غير موجودة.", en: "Person or unit not found." },
};

/**
 * «المناصب» — the establishment table: positions separate from people. Filters by unit, grade,
 * state and nationality; one seat opens its card (code, Qiwa title, Saudi-only, deputy, dotted
 * line, frozen/planned, acting cover). Structural moves go through «التغييرات».
 */
export default function OrgSeatRegister({ ar, data, actor, companyId, canEdit, onOpenChanges }) {
  const day = todayKey();
  const rows = useMemo(() => deriveSeatRegister(data, day), [data, day]);
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("");
  const [grade, setGrade] = useState("");
  const [state, setState] = useState("");
  const [nat, setNat] = useState("");
  const [selected, setSelected] = useState("");

  const units = useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => { if (r.stationId && !seen.has(r.stationId)) seen.set(r.stationId, r.unitName); });
    return [...seen.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "ar"));
  }, [rows]);
  const grades = useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => { if (r.gradeId && !seen.has(r.gradeId)) seen.set(r.gradeId, r.gradeLabel); });
    return [...seen.entries()];
  }, [rows]);

  const shown = rows.filter((r) => {
    if (unit && r.stationId !== unit) return false;
    if (grade && r.gradeId !== grade) return false;
    if (state && r.state !== state) return false;
    if (nat && r.nationality !== nat) return false;
    const needle = q.trim().toLowerCase();
    if (needle && ![r.code, r.title, r.holderName, r.unitName, r.actingName].join(" ").toLowerCase().includes(needle)) return false;
    return true;
  });
  const counts = SEAT_STATES.reduce((acc, s) => ({ ...acc, [s]: rows.filter((r) => r.state === s).length }), {});
  const current = rows.find((r) => r.seatId === selected) || null;

  return (
    <section className="nv-od" aria-label={ar ? "المناصب" : "Seats"}>
      <SectionHead
        title={ar ? "المناصب المعتمدة" : "Approved seats"}
        hint={ar
          ? "المنصب ثابت والشخص يتغيّر. الحالة مشتقة: مشغول من شاغله، وشاغر منذ إخلائه، والمجمّد والمخطط قرار مسجّل. النقل بين الوحدات يمر عبر «التغييرات» بتاريخ سريان."
          : "The seat stays, the person changes. Filled/vacant follow the holder; frozen and planned are recorded decisions. Moving a seat goes through Changes with an effective date."}
      >
        {canEdit ? (
          <button type="button" className="nv-od-btn" onClick={() => openHireDrawer({ stationId: unit || "" })}>
            {ar ? "＋ منصب أو تعيين" : "+ Seat or hire"}
          </button>
        ) : null}
      </SectionHead>

      <div className="nv-od-filters">
        <input className="nv-od-input" style={{ flex: "1 1 200px", maxWidth: 280 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث برمز أو مسمى أو اسم" : "Search code, title or name"} aria-label={ar ? "بحث" : "Search"} />
        <select className="nv-od-select" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label={ar ? "الوحدة" : "Unit"}>
          <option value="">{ar ? "كل الوحدات" : "All units"}</option>
          {units.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        {grades.length ? (
          <select className="nv-od-select" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label={ar ? "الدرجة" : "Grade"}>
            <option value="">{ar ? "كل الدرجات" : "All grades"}</option>
            {grades.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        ) : null}
        <select className="nv-od-select" value={nat} onChange={(e) => setNat(e.target.value)} aria-label={ar ? "الجنسية" : "Nationality"}>
          <option value="">{ar ? "كل الجنسيات" : "All nationalities"}</option>
          {["saudi", "non_saudi", "unknown"].map((k) => <option key={k} value={k}>{ar ? NAT[k].ar : NAT[k].en}</option>)}
        </select>
      </div>
      <div className="nv-od-filters" role="group" aria-label={ar ? "الحالة" : "State"}>
        <button type="button" className="nv-od-chip" aria-pressed={!state} onClick={() => setState("")}>{ar ? "الكل" : "All"} <span className="nv-od-num">{rows.length}</span></button>
        {SEAT_STATES.map((s) => (
          <button key={s} type="button" className="nv-od-chip" aria-pressed={state === s} onClick={() => setState(state === s ? "" : s)}>
            {ar ? SEAT_STATE_LABELS[s].ar : SEAT_STATE_LABELS[s].en} <span className="nv-od-num">{counts[s] || 0}</span>
          </button>
        ))}
      </div>

      {!rows.length ? (
        <EmptyInvite
          text={ar ? "لا مناصب بعد. أنشئ المنصب أولاً ثم وظّف عليه — هكذا يبقى الشاغر صادقاً في الهيكل." : "No seats yet. Create the seat first, then hire onto it — vacancies stay honest."}
          action={canEdit ? <button type="button" className="nv-od-btn nv-od-btn--primary" onClick={() => openHireDrawer({})}>{ar ? "أنشئ أول منصب" : "Create the first seat"}</button> : null}
        />
      ) : (
        <div className="nv-od-paper nv-od-paper--flush">
          <table className="nv-od-table">
            <thead>
              <tr>
                <th>{ar ? "الرمز" : "Code"}</th>
                <th>{ar ? "المنصب" : "Seat"}</th>
                <th>{ar ? "الشاغل" : "Holder"}</th>
                <th>{ar ? "الوحدة" : "Unit"}</th>
                <th>{ar ? "الدرجة" : "Grade"}</th>
                <th>{ar ? "يتبع" : "Reports to"}</th>
                <th>{ar ? "الحالة" : "State"}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.seatId}
                  data-clickable="1"
                  tabIndex={0}
                  aria-selected={selected === r.seatId}
                  onClick={() => setSelected(selected === r.seatId ? "" : r.seatId)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(selected === r.seatId ? "" : r.seatId); } }}
                >
                  <td data-label={ar ? "الرمز" : "Code"}><span className="nv-od-code" dir="ltr">{r.code}</span></td>
                  <td data-label={ar ? "المنصب" : "Seat"}>
                    <span style={{ fontWeight: 600 }}>{r.title}</span>
                    {r.saudiOnly ? <span className="nv-od-muted" style={{ fontSize: 11 }}> · {ar ? "للسعوديين" : "Saudi-only"}</span> : null}
                    {r.dottedTitle ? <div className="nv-od-muted" style={{ fontSize: 11 }}>┄ {r.dottedTitle}</div> : null}
                  </td>
                  <td data-label={ar ? "الشاغل" : "Holder"}>
                    <Face
                      ar={ar}
                      name={r.holderName}
                      vacant={!r.holderName}
                      sub={r.actingName ? (ar ? `تكليف: ${r.actingName} حتى ${fmtDay(r.actingUntil, ar)}` : `Acting: ${r.actingName} until ${fmtDay(r.actingUntil, ar)}`) : (r.nationality !== "none" ? (ar ? NAT[r.nationality].ar : NAT[r.nationality].en) : "")}
                    />
                  </td>
                  <td data-label={ar ? "الوحدة" : "Unit"}>{r.unitName || "—"} <span className="nv-od-muted" style={{ fontSize: 11 }}>{levelLabel(r.unitLevel, ar)}</span></td>
                  <td data-label={ar ? "الدرجة" : "Grade"}>{r.gradeLabel || <span className="nv-od-muted">—</span>}</td>
                  <td data-label={ar ? "يتبع" : "Reports to"}>{r.reportsToName || <span className="nv-od-muted">—</span>}</td>
                  <td data-label={ar ? "الحالة" : "State"}>
                    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <StateChip state={r.state} ar={ar} />
                      {r.state === "vacant" ? <span className="nv-od-num nv-od-muted" style={{ fontSize: 11 }}>{r.daysVacant}{ar ? " يوماً" : "d"}</span> : null}
                      {r.state === "planned" && r.plannedFrom ? <span className="nv-od-muted" style={{ fontSize: 11 }}>{fmtDay(r.plannedFrom, ar)}</span> : null}
                      {r.qiwaMismatch ? <ToneChip tone="warn">{ar ? "قوى ≠" : "Qiwa ≠"}</ToneChip> : null}
                      {r.saudiOnly && r.nationality === "non_saudi" ? <ToneChip tone="bad">{ar ? "توطين" : "Saudi-only"}</ToneChip> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length ? <p className="nv-od-note" style={{ padding: 16 }}>{ar ? "لا منصب يطابق الفلاتر." : "No seat matches the filters."}</p> : null}
        </div>
      )}

      {current ? (
        <SeatCard key={current.seatId} ar={ar} row={current} rows={rows} data={data} actor={actor} companyId={companyId} canEdit={canEdit} onClose={() => setSelected("")} onOpenChanges={onOpenChanges} />
      ) : null}
    </section>
  );
}

function SeatCard({ ar, row, rows, data, actor, companyId, canEdit, onClose, onOpenChanges }) {
  const seat = (data?.orgSeats || []).find((s) => String(s.id) === row.seatId) || {};
  const [form, setForm] = useState({
    code: seat.code || "",
    qiwaTitle: seat.qiwaTitle || "",
    saudiOnly: Boolean(seat.saudiOnly),
    deputySeatId: seat.deputySeatId || "",
    dottedToSeatId: seat.dottedToSeatId || "",
    state: seat.state || "",
    plannedFrom: seat.plannedFrom || "",
  });
  const [gate, setGate] = useState(null);
  const [saved, setSaved] = useState(false);
  const [acting, setActing] = useState({ employeeId: "", from: todayKey(), until: "" });
  const [actingGate, setActingGate] = useState(null);
  const others = rows.filter((r) => r.seatId !== row.seatId);
  const people = (data?.employees || []).filter((e) => e?.id && e.active !== false && e.role !== "system" && String(e.id) !== row.holderId);
  const actingRow = (() => {
    if (!row.actingId) return null;
    const person = (data?.employees || []).find((e) => String(e.id) === row.actingId);
    return (person?.actingAssignments || []).find((a) => String(a.seatId) === row.seatId && !a.endedAt) || null;
  })();

  const set = (key) => (e) => {
    const value = e?.target?.type === "checkbox" ? e.target.checked : e?.target?.value;
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };
  const save = () => {
    const res = patchSeatDesign(companyId, actor, row.seatId, form);
    setGate(res);
    setSaved(res.ok);
  };
  const assignActing = () => {
    const res = setActingAssignment(companyId, acting.employeeId, { stationId: row.stationId, seatId: row.seatId, title: row.title, from: acting.from, until: acting.until });
    if (!res.ok) {
      const msg = ACTING_ERRORS[res.error] || ACTING_ERRORS.FIELDS;
      setActingGate({ ok: false, error: res.error, reason: msg.ar, reasonEn: msg.en });
    } else {
      setActingGate(null);
      setActing({ employeeId: "", from: todayKey(), until: "" });
    }
  };

  return (
    <div className="nv-od-paper" style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-label={ar ? "بطاقة المنصب" : "Seat card"}>
      <SectionHead title={`${row.code} · ${row.title}`} hint={`${row.unitName} · ${ar ? "يتبع" : "reports to"} ${row.reportsToName || "—"}`}>
        <button type="button" className="nv-od-btn nv-od-btn--quiet" onClick={onClose}>{ar ? "إغلاق" : "Close"}</button>
      </SectionHead>

      <div className="nv-od-form">
        <label className="nv-od-field">{ar ? "رمز المنصب" : "Seat code"}
          <input className="nv-od-input" dir="ltr" value={form.code} onChange={set("code")} disabled={!canEdit} placeholder={row.code} />
        </label>
        <label className="nv-od-field">{ar ? "المسمى في قوى" : "Qiwa job title"}
          <input className="nv-od-input" value={form.qiwaTitle} onChange={set("qiwaTitle")} disabled={!canEdit} placeholder={row.title} />
        </label>
        <label className="nv-od-field">{ar ? "النائب (التعاقب)" : "Deputy (succession)"}
          <select className="nv-od-select" value={form.deputySeatId} onChange={set("deputySeatId")} disabled={!canEdit}>
            <option value="">{ar ? "— بلا نائب —" : "— none —"}</option>
            {others.map((r) => <option key={r.seatId} value={r.seatId}>{seatOptionLabel(r, ar)}</option>)}
          </select>
        </label>
        <label className="nv-od-field">{ar ? "خط منقّط (تبعية فنية)" : "Dotted line"}
          <select className="nv-od-select" value={form.dottedToSeatId} onChange={set("dottedToSeatId")} disabled={!canEdit}>
            <option value="">{ar ? "— لا يوجد —" : "— none —"}</option>
            {others.map((r) => <option key={r.seatId} value={r.seatId}>{seatOptionLabel(r, ar)}</option>)}
          </select>
        </label>
        <label className="nv-od-field">{ar ? "حالة المنصب الشاغر" : "Vacant seat state"}
          <select className="nv-od-select" value={form.state} onChange={set("state")} disabled={!canEdit || Boolean(row.holderId)}>
            <option value="">{ar ? "شاغر مفتوح للتعيين" : "Open vacancy"}</option>
            <option value="frozen">{ar ? "مجمّد — لا يُعيَّن عليه" : "Frozen — no hiring"}</option>
            <option value="planned">{ar ? "مخطط — يُفتح من تاريخ" : "Planned — opens on a date"}</option>
          </select>
        </label>
        {form.state === "planned" ? (
          <label className="nv-od-field">{ar ? "يُفتح في" : "Opens on"}
            <input className="nv-od-input" type="date" value={form.plannedFrom} onChange={set("plannedFrom")} disabled={!canEdit} />
          </label>
        ) : null}
        <label className="nv-od-field" style={{ flexDirection: "row", alignItems: "center", gap: 8, color: "var(--nv-ink)" }}>
          <input type="checkbox" checked={form.saudiOnly} onChange={set("saudiOnly")} disabled={!canEdit} />
          {ar ? "مقصور على السعوديين (مهنة موطّنة)" : "Saudi-only (localised occupation)"}
        </label>
      </div>
      {row.holderId ? <p className="nv-od-note">{ar ? "المنصب مشغول — حالته تتبع شاغله، ولا يُجمَّد قبل إخلائه." : "Filled — its state follows the holder; it cannot be frozen before it is vacated."}</p> : null}
      <GateLine gate={gate} ar={ar} />
      {saved ? <p className="nv-od-ok">{ar ? "حُفظ — ويظهر في صحة الهيكل ومصفوفة الصلاحيات فوراً." : "Saved — health and the authority matrix use it right away."}</p> : null}
      {canEdit ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="nv-od-btn nv-od-btn--primary" onClick={save}>{ar ? "حفظ بيانات المنصب" : "Save seat"}</button>
          <button type="button" className="nv-od-btn" onClick={() => onOpenChanges?.({ type: "moveSeat", seatId: row.seatId })}>{ar ? "نقل المنصب بقرار…" : "Move by decision…"}</button>
        </div>
      ) : <p className="nv-od-note">{ar ? "التعديل للمالك والموارد البشرية." : "Edits are made by the owner and HR."}</p>}

      <div style={{ borderTop: "1px solid var(--nv-line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="nv-od-sub">{ar ? "التكليف على المنصب" : "Acting cover"}</p>
        {row.actingName ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Face ar={ar} name={row.actingName} sub={ar ? `ينتهي تلقائياً ${fmtDay(row.actingUntil, ar)}` : `Ends by itself ${fmtDay(row.actingUntil, ar)}`} />
            {canEdit && actingRow ? (
              <button type="button" className="nv-od-btn" onClick={() => endActingAssignment(companyId, row.actingId, actingRow.id)}>{ar ? "إنهاء التكليف الآن" : "End acting now"}</button>
            ) : null}
          </div>
        ) : <p className="nv-od-note">{ar ? "لا تكليف ساري على هذا المنصب." : "No acting cover on this seat."}</p>}
        {canEdit && !row.holderId && !row.actingName ? (
          <div className="nv-od-form">
            <label className="nv-od-field">{ar ? "المكلَّف" : "Acting person"}
              <select className="nv-od-select" value={acting.employeeId} onChange={(e) => setActing((a) => ({ ...a, employeeId: e.target.value }))}>
                <option value="">{ar ? "— اختر —" : "— pick —"}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="nv-od-field">{ar ? "من" : "From"}
              <input className="nv-od-input" type="date" value={acting.from} onChange={(e) => setActing((a) => ({ ...a, from: e.target.value }))} />
            </label>
            <label className="nv-od-field">{ar ? "حتى (ينتهي تلقائياً)" : "Until (ends by itself)"}
              <input className="nv-od-input" type="date" value={acting.until} onChange={(e) => setActing((a) => ({ ...a, until: e.target.value }))} />
            </label>
            <div className="nv-od-field" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="nv-od-btn" onClick={assignActing}>{ar ? "اسند التكليف" : "Assign acting"}</button>
            </div>
          </div>
        ) : null}
        <GateLine gate={actingGate} ar={ar} />
      </div>
    </div>
  );
}
