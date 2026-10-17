import React, { useState } from "react";
import { LogOut, Plus, ShieldCheck } from "lucide-react";
import { ID_TYPE_OPTIONS } from "@/lib/employeeProfileFields";
import { VISITOR_NATIONALITIES, visitorIdTypeLabel } from "@/lib/visitorProof";
import { PROOF_PEOPLE_LIMIT } from "@/lib/workProofCrew";

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };
const box = { fontFamily: "inherit", fontSize: 12.5, height: 36, padding: "0 10px", border: "1px solid var(--nv-line)", borderRadius: 9, background: "var(--nv-card)", color: "var(--nv-ink)", boxSizing: "border-box", width: "100%", minWidth: 0 };

function clock(iso) {
  return /T(\d{2}:\d{2})/.exec(String(iso || ""))?.[1] || "";
}

function markOf(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("") || "·";
}

const blank = { name: "", nationality: "", idType: "", id: "", phone: "", badge: "", briefed: false };

/**
 * Everyone on an open proof, each with their own time in and out — a crew or a group of guests
 * rarely arrive or leave together. Late arrivals are added here, early leavers are let out here.
 */
export default function ProofPeoplePanel({
  ar = true,
  kind = "work",
  people = [],
  fallbackIn = "",
  canEdit = false,
  busy = false,
  onAdd,
  onOut,
  bare = false,
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const visitor = kind === "visitor";
  const inside = people.filter((p) => !p.outAt).length;
  const full = people.length >= PROOF_PEOPLE_LIMIT;
  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "nationality" && !d.idType && /سعود|saudi/i.test(String(value))) next.idType = "national_id";
      return next;
    });
  };
  const submit = async () => {
    const res = await onAdd?.(draft);
    if (res?.ok) {
      // The next one of the same crew is usually the same nationality.
      setDraft({ ...blank, nationality: draft.nationality, idType: draft.idType });
    }
  };

  return (
    <section data-proof-people={kind} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        {bare ? null : <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{visitor ? (ar ? "الزوار" : "Visitors") : (ar ? "عمال الجهة" : "The party's workers")}</strong>}
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>
          {ar ? `${inside} في الموقع من ${people.length}` : `${inside} on site of ${people.length}`}
        </span>
        <span style={{ ...MONO, marginInlineStart: "auto", fontSize: 11, color: "var(--nv-muted)" }}>{people.length}/{PROOF_PEOPLE_LIMIT}</span>
      </div>

      {people.length ? (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {people.map((p, i) => {
            const out = !!p.outAt;
            const inAt = clock(p.inAt) || clock(fallbackIn);
            return (
              <li
                key={`${p.id || p.name}-${i}`}
                data-person-row={i}
                data-out={out ? "1" : "0"}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--nv-line)", background: out ? "var(--nv-soft)" : "var(--nv-card)", flexWrap: "wrap" }}
              >
                <span aria-hidden style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: out ? "var(--nv-line2, #EEF1EF)" : "var(--nv-ok-soft)", color: out ? "var(--nv-muted)" : "var(--nv-ok-ink)" }}>
                  {markOf(p.name)}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 180px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13, color: out ? "var(--nv-ink2)" : "var(--nv-ink)" }}>{p.name}</strong>
                    {p.title ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{p.title}</span> : null}
                    {p.briefed ? (
                      <span title={ar ? "تلقّى تعريف السلامة" : "Safety briefing given"} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)", borderRadius: 999, padding: "1px 7px" }}>
                        <ShieldCheck size={11} strokeWidth={2} aria-hidden />
                        {ar ? "السلامة" : "Safety"}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--nv-muted)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[p.nationality, visitorIdTypeLabel(p.idType, ar)].filter(Boolean).join(" · ")}
                    {p.id ? <span style={MONO}>{p.id}</span> : null}
                    {p.badge ? <span>{ar ? "بطاقة" : "Badge"} <span style={MONO}>{p.badge}</span></span> : null}
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--nv-ink2)" }}>
                  <span>{ar ? "دخل" : "In"} <span style={MONO}>{inAt || "—"}</span></span>
                  {out ? <span>{ar ? "خرج" : "Out"} <span style={MONO}>{clock(p.outAt)}</span></span> : null}
                </span>
                {!out && canEdit && onOut ? (
                  <button
                    type="button"
                    data-person-out={i}
                    disabled={busy}
                    onClick={() => onOut(i)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 12, fontWeight: 600, height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink2)", cursor: "pointer" }}
                  >
                    <LogOut size={13} strokeWidth={1.75} aria-hidden />
                    {ar ? "خرج" : "Left"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{visitor ? (ar ? "لا زوار مسجّلون بعد." : "No visitors recorded yet.") : (ar ? "لم يُسجَّل عمال للجهة بعد — أضفهم بهوياتهم." : "No workers recorded yet — add them with their IDs.")}</span>
      )}

      {canEdit && onAdd && !full ? (
        adding ? (
          <div data-person-add-form="1" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 12, border: "1px dashed #0F5535", background: "var(--nv-ok-soft)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <input aria-label={ar ? "الاسم" : "Name"} placeholder={ar ? "الاسم" : "Name"} value={draft.name} onChange={set("name")} style={box} />
              <input aria-label={ar ? "الجنسية" : "Nationality"} placeholder={ar ? "الجنسية" : "Nationality"} list="nv-people-nationalities" value={draft.nationality} onChange={set("nationality")} style={box} />
              <select aria-label={ar ? "نوع الهوية" : "ID type"} value={draft.idType} onChange={set("idType")} style={box}>
                <option value="">{ar ? "نوع الهوية" : "ID type"}</option>
                {ID_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>)}
              </select>
              <input aria-label={ar ? "رقم الهوية" : "ID number"} placeholder={ar ? "رقم الهوية / الإقامة" : "ID / iqama"} dir="ltr" value={draft.id} onChange={set("id")} style={box} />
              <input aria-label={ar ? "الجوال" : "Phone"} placeholder={ar ? "الجوال" : "Phone"} dir="ltr" value={draft.phone} onChange={set("phone")} style={box} />
              {visitor ? <input aria-label={ar ? "رقم بطاقة الزائر" : "Badge no."} placeholder={ar ? "رقم بطاقة الزائر" : "Badge no."} dir="ltr" value={draft.badge} onChange={set("badge")} style={box} /> : null}
            </div>
            <datalist id="nv-people-nationalities">
              {VISITOR_NATIONALITIES.map((n) => <option key={n} value={n} />)}
            </datalist>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--nv-ink2)" }}>
              <input type="checkbox" checked={!!draft.briefed} onChange={set("briefed")} />
              {ar ? "تلقّى تعريف السلامة قبل الدخول" : "Safety briefing given before entry"}
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" data-person-save="1" disabled={busy} onClick={submit} style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, height: 36, padding: "0 16px", borderRadius: 9, border: "none", background: "#0B3D27", color: "#fff", cursor: "pointer" }}>
                {ar ? "سجّل دخوله الآن" : "Check in now"}
              </button>
              <button type="button" onClick={() => { setAdding(false); setDraft(blank); }} style={{ fontFamily: "inherit", fontSize: 12.5, height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink2)", cursor: "pointer" }}>
                {ar ? "انتهيت" : "Done"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-person-add="1"
            onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, height: 40, borderRadius: 10, border: "1.5px dashed #0F5535", background: "transparent", color: "#0F5535", cursor: "pointer" }}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            {visitor ? (ar ? "أضف زائراً وصل الآن" : "Add a visitor who just arrived") : (ar ? "أضف عاملاً وصل الآن" : "Add a worker who just arrived")}
          </button>
        )
      ) : null}
    </section>
  );
}
