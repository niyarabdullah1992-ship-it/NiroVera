import React, { useEffect, useMemo, useState } from "react";
import { Camera, Plus } from "lucide-react";
import { ACCENT, BRAND, BRAND_DEEP, BRAND_SOFT, MUTED, NAVY, CARD, field, ui } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import HeatBanNotice from "@/components/shared/HeatBanNotice";
import { TASK_MODES, taskModeConsequence } from "@/lib/opsDerivations";
import { deriveProofHeatBanNotice, normalizeProofPlace } from "@/lib/workProofDerivations";
import { vehicleLabel } from "@/lib/proofVehicle";
import { workplaceStations } from "@/lib/stationTree";
import {
  EMPTY_PERSON,
  EMPTY_VEHICLE,
  canAddCrewItem,
  formPeople,
  formVehicles,
} from "@/lib/workProofCrew";
import { ID_TYPE_OPTIONS } from "@/lib/employeeProfileFields";
import { VISITOR_NATIONALITIES } from "@/lib/visitorProof";
import { ProofAttachPicker } from "@/components/proof/ProofAttachments";

export { EMPTY_PERSON, EMPTY_VEHICLE };

export function formatProofDateTime(value, ar) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function dateTimeDateKey(value) {
  return String(value || "").slice(0, 10);
}

export function spliceDateIntoDateTime(prev, nextDate) {
  if (!nextDate) return "";
  const time = /T\d{2}:\d{2}/.exec(String(prev || ""))?.[0];
  if (time) return `${nextDate}${time}`;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${nextDate}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function workPeriodLabel(startedAt, endedAt, ar) {
  const start = formatProofDateTime(startedAt, ar);
  const end = formatProofDateTime(endedAt, ar);
  if (!start && !end) return "";
  if (start && end) return `${start} → ${end}`;
  return start || end;
}

export function workSpanLabel(startedAt, endedAt, ar) {
  const from = new Date(startedAt);
  const to = new Date(endedAt);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return "";
  const mins = Math.max(1, Math.round((to - from) / 6e4));
  if (mins < 60) return ar ? `${mins} د` : `${mins} min`;
  const hours = Math.round((mins / 60) * 10) / 10;
  if (hours === 1) return ar ? "ساعة" : "1 h";
  return ar ? `${hours} ساعة` : `${hours} h`;
}

export function workDurationLabel(startedAt, endedAt, ar) {
  return [workPeriodLabel(startedAt, endedAt, ar), workSpanLabel(startedAt, endedAt, ar)].filter(Boolean).join(" · ");
}

export function proofPersonLabel(proof) {
  const names = Array.isArray(proof?.people) && proof.people.length
    ? proof.people.map((person) => person?.name).filter(Boolean)
    : [proof?.personName].filter(Boolean);
  return names.join(" · ") || proof?.client || "";
}

export function proofVehicleText(proof) {
  const list = Array.isArray(proof?.vehicles) && proof.vehicles.length
    ? proof.vehicles
    : (proof?.vehicle ? [proof.vehicle] : []);
  return list.map(vehicleLabel).filter(Boolean).join(" · ");
}

export function isInternalEntityScope(proof) {
  return String(proof?.entityScope || "") === "internal" || String(proof?.entityKind || "") === "branch";
}

export function proofEntityPlaceLabel(proof, stationName, ar) {
  const name = proof?.entityName || proof?.client || "";
  if (isInternalEntityScope(proof)) {
    const resolved = typeof stationName === "function" ? stationName(proof?.entityStationId) : "";
    const branch = (resolved && resolved !== "—" ? resolved : "") || name;
    return ar ? `داخل الشركة · ${branch || "فرع"}` : `Inside company · ${branch || "branch"}`;
  }
  return name
    ? (ar ? `خارج الشركة · ${name}` : `Outside company · ${name}`)
    : (ar ? "خارج الشركة" : "Outside company");
}

export function workProofEntityFields(form) {
  const entityName = String(form?.entityName || "").trim();
  return {
    ok: Boolean(entityName),
    errorAr: "اكتب الاسم الرسمي للمنشأة الخارجية.",
    errorEn: "Enter the official name of the external establishment.",
    fields: {
      entityScope: "external",
      entityStationId: "",
      entityKind: form?.entityKind === "individual" ? "individual" : "company",
      entityName,
      entityUnified: String(form?.entityUnified || "").trim(),
      entityCr: String(form?.entityCr || "").trim(),
      entityQiwa: String(form?.entityQiwa || "").trim(),
      entitySite: String(form?.entitySite || "").trim(),
      entityProject: String(form?.entityProject || "").trim(),
      entityContact: String(form?.entityContact || "").trim(),
      entityPhone: String(form?.entityPhone || "").trim(),
      entityEmail: String(form?.entityEmail || "").trim(),
    },
  };
}

export function proofRaiserLabel(proof, ar) {
  const name = String(proof?.raiserName || "").trim();
  if (!name) return "";
  return ar ? `أنشأها ${name}` : `Created by ${name}`;
}

export function proofCompanyBits(proof) {
  return [
    proof?.entityUnified,
    proof?.entityCr,
    proof?.entityQiwa,
    proof?.entityProject,
    proof?.entitySite,
  ].filter(Boolean);
}

export function proofWorkerIdentityLine(person) {
  if (!person?.name) return "";
  return [person.name, person.nationality, person.id].filter(Boolean).join(" · ");
}

const CSS = `
  .wp-raise-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .wp-fold > summary::-webkit-details-marker { display: none; }
  .wp-fold > summary { list-style: none; }
  .wp-fold > summary::before { content: "+"; display: inline-block; width: 14px; color: var(--nv-muted); font-weight: 600; }
  .wp-fold[open] > summary::before { content: "−"; }
  .wp-repeat { display: grid; gap: 10px; }
  @media (max-width: 520px) {
    .wp-raise-2 { grid-template-columns: 1fr; }
  }
`;

const box = { ...field, height: 40, padding: "0 10px" };

/** Same chip as the tasks place picker — one look for one vocabulary. */
function placeBtnStyle(active) {
  return {
    flex: 1,
    height: 36,
    borderRadius: 9,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP, fontWeight: 600 }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

function SectionCard({ title, hint, children }) {
  return (
    <section
      style={{
        borderRadius: 16,
        border: "1px solid var(--nv-line, #E2E8F0)",
        background: "var(--nv-inset, var(--nv-soft, #F7F8FA))",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {(title || hint) && (
        <div>
          {title ? (
            <div style={{ fontSize: 12, fontWeight: 650, color: MUTED, letterSpacing: "0.01em" }}>{title}</div>
          ) : null}
          {hint ? (
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: 4 }}>{hint}</div>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <label>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>
        {label}{required ? <span style={{ color: ACCENT, marginInlineStart: 3 }}>•</span> : null}
      </span>
      {children}
    </label>
  );
}

function Fold({ title, hint, children }) {
  return (
    <details className="wp-fold" style={{ borderTop: "1px solid var(--nv-line, #E2E8F0)", paddingTop: 10, marginTop: 2 }}>
      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: NAVY, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{title}</span>
        {hint ? <span style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>{hint}</span> : null}
      </summary>
      <div className="wp-raise-2" style={{ marginTop: 10 }}>{children}</div>
    </details>
  );
}

function PhotoSlot({ file, title, required, onFile, ar }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) { setUrl(""); return undefined; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: url ? 132 : 88,
        borderRadius: 12,
        border: file ? `1px solid ${BRAND}` : "1px dashed var(--nv-line, #D5DCE6)",
        background: file ? BRAND_SOFT : CARD,
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: "100%", height: 88, objectFit: "cover", display: "block" }} />
      ) : null}
      <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
        <Camera style={{ width: 15, height: 15, color: file ? ACCENT : MUTED }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>
          {title}{required ? "" : ` · ${ar ? "اختياري" : "optional"}`}
        </span>
        <span style={{ fontSize: 11, color: MUTED, marginInlineStart: "auto" }}>
          {file?.name || (ar ? "اختيار" : "Choose")}
        </span>
      </span>
      <input
        type="file"
        accept="image/*"
        required={required}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        style={{ display: "none" }}
      />
    </label>
  );
}

function RepeatHead({ title, extra, onRemove, canRemove, ar }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, fontSize: 12, fontWeight: 600, color: MUTED }}>
        {title}
        {extra}
      </span>
      {canRemove ? (
        <button type="button" onClick={onRemove} style={{ ...ui.btnGhost, padding: "4px 8px", fontSize: 11 }}>
          {ar ? "حذف" : "Remove"}
        </button>
      ) : null}
    </div>
  );
}

export default function WorkProofRaiseFields({
  form,
  setForm,
  stations,
  headerScope,
  ar,
  hidePhotos,
  raiserName = "",
}) {
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const people = formPeople(form);
  const vehicles = formVehicles(form);
  const setPeople = (next) => setForm((current) => ({ ...current, people: next }));
  const setVehicles = (next) => setForm((current) => ({ ...current, vehicles: next }));
  const patchPerson = (index, key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const list = formPeople(current);
      return {
        ...current,
        people: list.map((person, i) => {
          if (i !== index) return person;
          const next = { ...person, [key]: value };
          if (key === "nationality" && !person.idType && /سعود|saudi/i.test(value)) {
            next.idType = "national_id";
          }
          return next;
        }),
      };
    });
  };
  const patchVehicle = (index, key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const list = formVehicles(current);
      return {
        ...current,
        vehicles: list.map((vehicle, i) => (i === index ? { ...vehicle, [key]: value } : vehicle)),
      };
    });
  };

  const entityKind = form.entityKind === "individual" ? "individual" : "company";
  const place = normalizeProofPlace(form.place);
  const heatNotice = deriveProofHeatBanNotice({ place });
  const workplaces = useMemo(() => {
    const list = workplaceStations(stations);
    return list.length ? list : (stations || []);
  }, [stations]);
  const entityExtra = useMemo(
    () => [form.entityProject, form.entityCr, form.entityQiwa, form.entityContact, form.entityPhone].filter(Boolean).length,
    [form.entityProject, form.entityCr, form.entityQiwa, form.entityContact, form.entityPhone],
  );

  const addBtn = {
    ...ui.btnGhost,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  };

  return (
    <>
      <style>{CSS}</style>
      <SectionCard title={ar ? "العمل" : "Work"}>
        <Field label={ar ? "سبب العمل" : "Reason for work"} required>
          <input
            required
            value={form.workReason}
            onChange={set("workReason")}
            placeholder={ar ? "لماذا يُنفَّذ هذا العمل؟" : "Why is this work being done?"}
            style={box}
          />
        </Field>
        <Field label={ar ? "وصف العمل" : "Work"} required>
          <input
            required
            value={form.title}
            onChange={set("title")}
            placeholder={ar ? "ما العمل الذي سيُنفَّذ؟" : "What work is starting?"}
            style={box}
          />
        </Field>
        <Field label={ar ? "تاريخ البداية" : "Start date"} required>
          <PlatformDateField
            ar={ar}
            value={dateTimeDateKey(form.startedAt)}
            onChange={(next) => setForm((current) => ({ ...current, startedAt: spliceDateIntoDateTime(current.startedAt, next) }))}
          />
        </Field>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED }}>
            {ar ? "مكان التنفيذ — مطلوب" : "Where the work happens — required"}
            <span style={{ color: ACCENT, marginInlineStart: 3 }}>•</span>
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TASK_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setForm((current) => ({ ...current, place: m.id }))}
                style={placeBtnStyle(place === m.id)}
              >
                {ar ? m.ar : m.en}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: place ? NAVY : MUTED, lineHeight: 1.6 }}>
            {place
              ? taskModeConsequence(place, { ar, onDate: form.startedAt })
              : (ar
                ? "المكان يحدّد سريان حظر العمل تحت أشعة الشمس على هذا الإثبات: العمل المكشوف لا يُفتح داخل النافذة، وما وقع منه فيها يُقيَّد كما حدث ويُوسم مخالفة."
                : "The place decides whether the sun ban reaches this proof: open-air work is not opened inside the window, and any that ran through it is recorded as it happened and flagged as a breach.")}
          </span>
          {/* «الهواء الطلق» always carries the decision; the notice's own level decides
              whether it reads as off-season reference, as the season's red alert, or as
              the live refusal, so the tone cannot drift from what the save gate will do. */}
          <HeatBanNotice notice={heatNotice} ar={ar} />
        </div>
        <div className="wp-raise-2">
          <Field label={ar ? "فرع التنفيذ" : "Executing branch"} required>
            <select required value={form.stationId} onChange={set("stationId")} disabled={headerScope !== "all"} style={box}>
              <option value="">{ar ? "اختر فرعًا" : "Pick a branch"}</option>
              {workplaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={ar ? "الموقع عند الالتقاط" : "Capture location"}>
            <select value={form.geoVerdict} onChange={set("geoVerdict")} style={box}>
              <option value="in">{ar ? "داخل نطاق الفرع" : "Inside the branch"}</option>
              <option value="out">{ar ? "خارج النطاق" : "Outside geofence"}</option>
            </select>
          </Field>
        </div>
        {!hidePhotos && (
          <PhotoSlot
            file={form.beforeFile}
            title={ar ? "صورة قبل — عند البداية" : "Before — at start"}
            required
            ar={ar}
            onFile={(file) => setForm((current) => ({ ...current, beforeFile: file }))}
          />
        )}
        {raiserName ? (
          <div style={{ fontSize: 12, color: NAVY }}>
            {ar ? "من أنشأ الإثبات:" : "Raised by:"} <span style={{ fontWeight: 650 }}>{raiserName}</span>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title={ar ? "الشركة الخارجية" : "External company"}
        hint={ar
          ? "إثبات العمل لجهة خارج الشركة فقط. زوّار فروعك يُسجَّلون في إثبات زائر."
          : "Work proof is for an outside company only. Branch visitors go on Visitor proof."}
      >
        <div className="wp-raise-2">
          <Field label={ar ? "نوع المنشأة" : "Establishment type"} required>
            <select required value={entityKind} onChange={set("entityKind")} style={box}>
              <option value="company">{ar ? "شركة / مؤسسة" : "Company"}</option>
              <option value="individual">{ar ? "مؤسسة فردية" : "Sole establishment"}</option>
            </select>
          </Field>
          <Field label={ar ? "الاسم الرسمي" : "Official name"} required>
            <input required value={form.entityName} onChange={set("entityName")} placeholder={ar ? "كما في السجل أو القرار" : "As on the register"} style={box} />
          </Field>
          <Field label={ar ? "الرقم الوطني الموحد" : "Unified national no."}>
            <input value={form.entityUnified} onChange={set("entityUnified")} dir="ltr" placeholder="700xxxxxxxx" style={box} />
          </Field>
          <Field label={ar ? "موقع التنفيذ" : "Work site"}>
            <input value={form.entitySite} onChange={set("entitySite")} placeholder={ar ? "المبنى / الوحدة / المدينة" : "Building / unit / city"} style={box} />
          </Field>
        </div>
        <Fold
          title={ar ? "عقد وهوية وتواصل" : "Contract, IDs & contact"}
          hint={entityExtra ? (ar ? `${entityExtra} مُعبّأة` : `${entityExtra} filled`) : (ar ? "اختياري" : "optional")}
        >
          <Field label={ar ? "رقم العقد / أمر العمل" : "Contract / work order"}>
            <input value={form.entityProject} onChange={set("entityProject")} style={box} />
          </Field>
          <Field label={ar ? "السجل التجاري" : "Commercial registration"}>
            <input value={form.entityCr} onChange={set("entityCr")} dir="ltr" placeholder="10 أرقام" style={box} />
          </Field>
          <Field label={ar ? "رقم المنشأة في قوى" : "Qiwa establishment no."}>
            <input value={form.entityQiwa} onChange={set("entityQiwa")} dir="ltr" placeholder="7-1104829" style={box} />
          </Field>
          <Field label={ar ? "مسؤول التواصل" : "Contact"}>
            <input value={form.entityContact} onChange={set("entityContact")} style={box} />
          </Field>
          <Field label={ar ? "جوال المسؤول" : "Contact phone"}>
            <input value={form.entityPhone} onChange={set("entityPhone")} dir="ltr" placeholder="05xxxxxxxx" style={box} />
          </Field>
        </Fold>
      </SectionCard>

      <SectionCard
        title={ar ? "عمال الجهة الخارجية" : "External workers"}
        hint={ar
          ? "هويات عمال الشركة الخارجية — ليسوا موظفي منشأتك."
          : "IDs of the outside company's workers — not your staff."}
      >
        <div className="wp-repeat">
          {people.map((person, index) => (
            <div
              key={`worker-${index}`}
              style={{ padding: 12, borderRadius: 12, border: "1px solid var(--nv-line, #E2E8F0)", background: CARD }}
            >
              <RepeatHead
                title={ar ? `عامل ${index + 1}` : `Worker ${index + 1}`}
                canRemove={people.length > 1}
                onRemove={() => setPeople(people.filter((_, i) => i !== index))}
                ar={ar}
              />
              <div className="wp-raise-2">
                <Field label={ar ? "الاسم" : "Name"} required={index === 0}>
                  <input required={index === 0} value={person.name} onChange={patchPerson(index, "name")} style={box} />
                </Field>
                <Field label={ar ? "الجنسية" : "Nationality"}>
                  <input
                    list="nv-workproof-nationalities"
                    value={person.nationality || ""}
                    onChange={patchPerson(index, "nationality")}
                    placeholder={ar ? "سعودي" : "Saudi"}
                    style={box}
                  />
                </Field>
                <Field label={ar ? "نوع الهوية" : "ID type"}>
                  <select value={person.idType || ""} onChange={patchPerson(index, "idType")} style={box}>
                    <option value="">{ar ? "اختر" : "Pick"}</option>
                    {ID_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{ar ? item.ar : item.en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={ar ? "رقم الهوية / الإقامة" : "ID / Iqama number"} required={index === 0}>
                  <input required={index === 0} value={person.id} onChange={patchPerson(index, "id")} dir="ltr" style={box} />
                </Field>
                <Field label={ar ? "الجوال" : "Phone"}>
                  <input value={person.phone} onChange={patchPerson(index, "phone")} dir="ltr" style={box} />
                </Field>
                <Field label={ar ? "المسمى" : "Title"}>
                  <input value={person.title} onChange={patchPerson(index, "title")} style={box} />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <datalist id="nv-workproof-nationalities">
          {VISITOR_NATIONALITIES.map((item) => <option key={item} value={item} />)}
        </datalist>
        {canAddCrewItem(people) ? (
          <button
            type="button"
            onClick={() => setPeople([...people, { ...EMPTY_PERSON }])}
            style={addBtn}
          >
            <Plus style={{ width: 14, height: 14 }} />
            {ar ? "إضافة عامل" : "Add worker"}
          </button>
        ) : null}
      </SectionCard>

      <SectionCard
        title={ar ? "سيارات الجهة الخارجية" : "Their vehicles"}
        hint={ar ? "سيارات عمال الشركة الخارجية، ليست أصول فرعك." : "Vehicles of the outside company, not your branch assets."}
      >
        <div className="wp-repeat">
          {vehicles.map((vehicle, index) => (
            <div
              key={`vehicle-${index}`}
              style={{ padding: 12, borderRadius: 12, border: "1px solid var(--nv-line, #E2E8F0)", background: CARD }}
            >
              <RepeatHead
                title={ar ? `سيارة ${index + 1}` : `Vehicle ${index + 1}`}
                canRemove={vehicles.length > 1}
                onRemove={() => setVehicles(vehicles.filter((_, i) => i !== index))}
                ar={ar}
              />
              <div className="wp-raise-2">
                <Field label={ar ? "الشركة المصنعة" : "Maker"}>
                  <input value={vehicle.maker} onChange={patchVehicle(index, "maker")} style={box} />
                </Field>
                <Field label={ar ? "الموديل" : "Model"}>
                  <input value={vehicle.model} onChange={patchVehicle(index, "model")} style={box} />
                </Field>
                <Field label={ar ? "نوع السيارة" : "Type"}>
                  <input value={vehicle.type} onChange={patchVehicle(index, "type")} style={box} />
                </Field>
                <Field label={ar ? "سنة الصنع" : "Year"}>
                  <input value={vehicle.year} onChange={patchVehicle(index, "year")} dir="ltr" style={box} />
                </Field>
                <Field label={ar ? "حروف اللوحة" : "Plate letters"}>
                  <input value={vehicle.plateLetters} onChange={patchVehicle(index, "plateLetters")} style={box} />
                </Field>
                <Field label={ar ? "أرقام اللوحة" : "Plate numbers"}>
                  <input value={vehicle.plateNumbers} onChange={patchVehicle(index, "plateNumbers")} dir="ltr" style={box} />
                </Field>
              </div>
            </div>
          ))}
        </div>
        {canAddCrewItem(vehicles) ? (
          <button
            type="button"
            onClick={() => setVehicles([...vehicles, { ...EMPTY_VEHICLE }])}
            style={addBtn}
          >
            <Plus style={{ width: 14, height: 14 }} />
            {ar ? "إضافة سيارة" : "Add vehicle"}
          </button>
        ) : null}
      </SectionCard>

      <SectionCard
        title={ar ? "المستندات" : "Documents"}
        hint={ar ? "تصريح أو عقد يظهر على بطاقة الإثبات — صورة قبل/بعد تبقى مسار العمل." : "A permit or contract on the proof card — before/after photos stay the work path."}
      >
        <ProofAttachPicker
          files={Array.isArray(form.files) ? form.files : []}
          onChange={(files) => setForm((current) => ({ ...current, files }))}
          ar={ar}
        />
      </SectionCard>
    </>
  );
}
