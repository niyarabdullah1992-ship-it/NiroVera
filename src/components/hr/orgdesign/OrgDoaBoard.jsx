import React, { useMemo, useState } from "react";
import {
  deriveSeatRegister,
  DOA_KINDS,
  DOA_KIND_LABELS,
  orgDesignOf,
  seatOccupant,
  todayKey,
} from "@/lib/orgDesign";
import { removeDoaRow, upsertDoaRow } from "@/lib/orgDesignStore";
import { EmptyInvite, GateLine, Slab, SlabBody, SubHead, btnGhost, btnPrimary, btnQuiet, seatOptionLabel } from "./orgDesignUi";

const VIA = {
  holder: { ar: "شاغل المنصب", en: "holder" },
  acting: { ar: "بالتكليف", en: "acting" },
  deputy: { ar: "النائب", en: "deputy" },
};

const blank = { id: "", kind: "leave", unitId: "", approverSeatId: "", limit: "", escalateToSeatId: "", note: "" };

/**
 * «الصلاحيات» — delegation of authority: which seat decides which request type, up to what
 * limit, and where it escalates. Authority follows the seat; today's occupant is the holder,
 * else the acting cover, else the deputy. No row for a type = the manager chain stays.
 * Complaints and employee voice are never in this matrix.
 */
export default function OrgDoaBoard({ ar, data, actor, companyId, canEdit }) {
  const day = todayKey();
  const rows = orgDesignOf(data).doa;
  const seats = useMemo(() => deriveSeatRegister(data, day), [data, day]);
  const seatById = useMemo(() => new Map(seats.map((s) => [s.seatId, s])), [seats]);
  const stations = data?.stations || [];
  const [form, setForm] = useState(null);
  const [gate, setGate] = useState(null);

  const unitName = (id) => (id ? stations.find((s) => String(s.id) === String(id))?.name || "—" : (ar ? "كل المنشأة" : "Whole company"));
  const seatFace = (id) => {
    const seat = seatById.get(String(id || ""));
    if (!seat) return "—";
    const occ = seatOccupant(data, id, day);
    return `${seat.title} — ${occ ? `${occ.name}${occ.via !== "holder" ? ` (${ar ? VIA[occ.via].ar : VIA[occ.via].en})` : ""}` : (ar ? "شاغر" : "vacant")}`;
  };
  const unitWord = (kind) => (ar ? DOA_KIND_LABELS[kind]?.unitAr : DOA_KIND_LABELS[kind]?.unitEn) || "";

  const save = () => {
    const res = upsertDoaRow(companyId, actor, form);
    setGate(res);
    if (res.ok) setForm(null);
  };


  return (
    <div className="nv-od">
      <Slab
        label={ar ? "مصفوفة الصلاحيات" : "Delegation of authority"}
        title={ar ? "مصفوفة تفويض الصلاحيات" : "Delegation of authority"}
        note={ar
          ? "أي منصب يقرر أي طلب، حتى أي حد، وإلى أين يُصعَّد. الصلاحية للمنصب لا للشخص: يقرر شاغله، وإن شغر فالمكلَّف، ثم النائب. نوع بلا سطر يبقى على مسار مدير الوحدة الحالي. الشكاوى وصوت الموظف لا تدخل هذه المصفوفة أبداً."
          : "Which seat decides which request, up to what limit, and where it escalates. Authority follows the seat: its holder, else the acting cover, else the deputy. A type with no row keeps the unit-manager path. Complaints and employee voice never enter this matrix."}
        trailing={canEdit && !form ? <button type="button" style={btnPrimary()} onClick={() => { setForm({ ...blank }); setGate(null); }}>{ar ? "＋ سطر صلاحية" : "+ Authority row"}</button> : null}
      >
      {!rows.length && !form ? (
        <EmptyInvite
          text={ar ? "لا أسطر بعد — كل الطلبات تمشي على مدير الوحدة في الهيكل. أضف سطراً حين تريد أن يعتمد منصبٌ محدد نوعاً من القرارات حتى حدٍّ معيّن." : "No rows yet — every request follows the unit manager. Add a row when a specific seat should decide a type up to a limit."}
          action={canEdit ? <button type="button" style={btnGhost()} onClick={() => setForm({ ...blank })}>{ar ? "أضف أول سطر" : "Add the first row"}</button> : null}
        />
      ) : null}

      {rows.length ? (
        <div>
          <table className="nv-od-table">
            <thead>
              <tr>
                <th>{ar ? "القرار" : "Decision"}</th>
                <th>{ar ? "الوحدة" : "Unit"}</th>
                <th>{ar ? "يعتمده" : "Approved by"}</th>
                <th>{ar ? "حتى" : "Up to"}</th>
                <th>{ar ? "يُصعَّد إلى" : "Escalates to"}</th>
                {canEdit ? <th aria-label={ar ? "إجراء" : "Action"} /> : null}
              </tr>
            </thead>
            <tbody>
              {DOA_KINDS.flatMap((kind) => rows.filter((r) => r.kind === kind)).map((r) => (
                <tr key={r.id}>
                  <td data-label={ar ? "القرار" : "Decision"} style={{ fontWeight: 600 }}>
                    {ar ? DOA_KIND_LABELS[r.kind]?.ar : DOA_KIND_LABELS[r.kind]?.en}
                    {r.note ? <div className="nv-od-muted" style={{ fontSize: 11, fontWeight: 400 }}>{r.note}</div> : null}
                  </td>
                  <td data-label={ar ? "الوحدة" : "Unit"}>{unitName(r.unitId)}</td>
                  <td data-label={ar ? "يعتمده" : "Approved by"}>{seatFace(r.approverSeatId)}</td>
                  <td data-label={ar ? "حتى" : "Up to"}>{r.limit == null ? <span className="nv-od-muted">{ar ? "بلا حد" : "No limit"}</span> : <span><span className="nv-od-num">{r.limit}</span> {unitWord(r.kind)}</span>}</td>
                  <td data-label={ar ? "يُصعَّد إلى" : "Escalates to"}>{r.escalateToSeatId ? seatFace(r.escalateToSeatId) : <span className="nv-od-muted">{ar ? "المسار الحالي" : "Default path"}</span>}</td>
                  {canEdit ? (
                    <td>
                      <span style={{ display: "inline-flex", gap: 12 }}>
                        <button type="button" style={btnQuiet()} onClick={() => { setForm({ ...blank, ...r, unitId: r.unitId || "", limit: r.limit ?? "", escalateToSeatId: r.escalateToSeatId || "", note: r.note || "" }); setGate(null); }}>{ar ? "تعديل" : "Edit"}</button>
                        <button type="button" style={btnQuiet({ color: "var(--nv-bad-ink)" })} onClick={() => setGate(removeDoaRow(companyId, actor, r.id))}>{ar ? "حذف" : "Remove"}</button>
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {form ? (
        <SlabBody style={{ borderTop: rows.length ? "1px solid var(--nv-line2, var(--nv-line))" : "none" }}>
          <SubHead>{form.id ? (ar ? "تعديل سطر" : "Edit row") : (ar ? "سطر جديد" : "New row")}</SubHead>
          <div className="nv-od-form">
            <label className="nv-od-field">{ar ? "نوع القرار" : "Decision type"}
              <select className="nv-od-select" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                {DOA_KINDS.map((k) => <option key={k} value={k}>{ar ? DOA_KIND_LABELS[k].ar : DOA_KIND_LABELS[k].en}</option>)}
              </select>
            </label>
            <label className="nv-od-field">{ar ? "على أي وحدة" : "For which unit"}
              <select className="nv-od-select" value={form.unitId} onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}>
                <option value="">{ar ? "كل المنشأة" : "Whole company"}</option>
                {stations.filter((s) => !s.closedAt).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="nv-od-field">{ar ? "المنصب المعتمِد" : "Approving seat"}
              <select className="nv-od-select" value={form.approverSeatId} onChange={(e) => setForm((f) => ({ ...f, approverSeatId: e.target.value }))}>
                <option value="">{ar ? "— اختر منصباً —" : "— pick a seat —"}</option>
                {seats.filter((s) => s.state !== "frozen").map((s) => <option key={s.seatId} value={s.seatId}>{seatOptionLabel(s, ar)}</option>)}
              </select>
            </label>
            {DOA_KIND_LABELS[form.kind]?.unit ? (
              <label className="nv-od-field">{ar ? `الحد (${unitWord(form.kind)})` : `Limit (${unitWord(form.kind)})`}
                <input className="nv-od-input nv-od-num" inputMode="decimal" value={form.limit} onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))} placeholder={ar ? "بلا حد" : "No limit"} />
              </label>
            ) : null}
            <label className="nv-od-field">{ar ? "يُصعَّد فوق الحد إلى" : "Escalates over the limit to"}
              <select className="nv-od-select" value={form.escalateToSeatId} onChange={(e) => setForm((f) => ({ ...f, escalateToSeatId: e.target.value }))}>
                <option value="">{ar ? "المسار الحالي (مدير الوحدة)" : "Default path (unit manager)"}</option>
                {seats.filter((s) => s.seatId !== form.approverSeatId && s.state !== "frozen").map((s) => <option key={s.seatId} value={s.seatId}>{seatOptionLabel(s, ar)}</option>)}
              </select>
            </label>
            <label className="nv-od-field nv-od-field--wide">{ar ? "ملاحظة" : "Note"}
              <input className="nv-od-input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </label>
          </div>
          <GateLine gate={gate} ar={ar} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnPrimary()} onClick={save}>{ar ? "حفظ السطر" : "Save row"}</button>
            <button type="button" style={btnGhost()} onClick={() => { setForm(null); setGate(null); }}>{ar ? "إلغاء" : "Cancel"}</button>
          </div>
        </SlabBody>
      ) : (gate && !gate.ok ? <div style={{ padding: "10px 18px" }}><GateLine gate={gate} ar={ar} /></div> : null)}
      </Slab>

    </div>
  );
}
