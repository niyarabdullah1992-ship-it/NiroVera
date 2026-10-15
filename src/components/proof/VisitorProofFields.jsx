import React from "react";
import { Plus } from "lucide-react";
import { ACCENT, MUTED, NAVY, CARD, field, ui } from "@/lib/platformStyles";
import { workplaceStations } from "@/lib/stationTree";
import { ID_TYPE_OPTIONS, GENDER_OPTIONS } from "@/lib/employeeProfileFields";
import {
  EMPTY_PERSON,
  EMPTY_VEHICLE,
  canAddCrewItem,
  duplicatePersonIdIndex,
  PROOF_PEOPLE_LIMIT,
  formPeople,
  formVehicles,
} from "@/lib/workProofCrew";
import PlatformDateField from "@/components/shared/PlatformDateField";
import OpsStationMultiSelect from "@/components/tasks/OpsStationMultiSelect";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { VISITOR_NATIONALITIES, visitDateKey, visitStationIds } from "@/lib/visitorProof";
import { ProofAttachPicker } from "@/components/proof/ProofAttachments";

const CSS = `
  .vp-raise-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .vp-repeat { display: grid; gap: 10px; }
  @media (max-width: 520px) {
    .vp-raise-2 { grid-template-columns: 1fr; }
  }
`;

const box = { ...field, height: 40, padding: "0 10px" };

function Field({ label, required, children, as: Tag = "label" }) {
  return (
    <Tag style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>
        {label}{required ? <span style={{ color: ACCENT, marginInlineStart: 3 }}>•</span> : null}
      </span>
      {children}
    </Tag>
  );
}

function RepeatHead({ title, canRemove, onRemove, ar }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 650, color: NAVY }}>{title}</span>
      {canRemove ? (
        <button type="button" onClick={onRemove} style={{ ...ui.btnGhost, padding: "4px 8px", fontSize: 11 }}>
          {ar ? "حذف" : "Remove"}
        </button>
      ) : null}
    </div>
  );
}

export default function VisitorProofFields({
  form,
  setForm,
  stations,
  headerScope,
  ar,
  employees = [],
}) {
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const people = formPeople(form);
  const vehicles = formVehicles(form);
  const setPeople = (next) => setForm({ ...form, people: next });
  const setVehicles = (next) => setForm({ ...form, vehicles: next });
  const patchPerson = (index, key) => (event) => {
    const value = event.target.value;
    setPeople(people.map((person, i) => {
      if (i !== index) return person;
      const next = { ...person, [key]: value };
      if (key === "nationality" && !person.idType && /سعود|saudi/i.test(value)) {
        next.idType = "national_id";
      }
      return next;
    }));
  };
  const patchVehicle = (index, key) => (event) => {
    setVehicles(vehicles.map((vehicle, i) => (i === index ? { ...vehicle, [key]: event.target.value } : vehicle)));
  };

  const workplaces = workplaceStations(stations);
  const branchList = workplaces.length ? workplaces : (stations || []);
  const selectedStationIds = visitStationIds(form);
  const lockedStation = headerScope !== "all" ? String(headerScope || "") : "";
  const hosts = (employees || []).filter((emp) => {
    if (!emp?.id || !emp?.name) return false;
    if (!selectedStationIds.length) return true;
    return selectedStationIds.includes(String(emp.stationId || ""));
  });
  const lockedStationName = branchList.find((s) => String(s.id) === lockedStation)?.name
    || (stations || []).find((s) => String(s.id) === lockedStation)?.name
    || "";
  const addBtn = {
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    height: 40,
    marginTop: 4,
    borderRadius: 10,
    border: "1.5px dashed #0F5535",
    background: "transparent",
    color: "#0F5535",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  };
  const dupIndex = duplicatePersonIdIndex(people);
  // The next one of the same crew or group usually shares the nationality and ID type.
  const nextPerson = () => {
    const last = people[people.length - 1] || {};
    return { ...EMPTY_PERSON, nationality: last.nationality || "", idType: last.idType || "" };
  };
  const setBriefed = (index) => (event) => {
    const checked = event.target.checked;
    setPeople(people.map((person, i) => (i === index ? { ...person, briefed: checked } : person)));
  };

  return (
    <>
      <style>{CSS}</style>
      <OpsTaskSection title={ar ? "الزيارة" : "Visit"}>
        <Field label={ar ? "سبب الزيارة" : "Visit reason"} required>
          <input
            required
            value={form.visitReason}
            onChange={set("visitReason")}
            placeholder={ar ? "لماذا يحضر الزائر إلى الفرع؟" : "Why is the visitor coming to the station?"}
            style={box}
          />
        </Field>
        <div className="vp-raise-2">
          <Field label={ar ? "من تاريخ" : "From"} required>
            <PlatformDateField
              ar={ar}
              value={visitDateKey(form.visitFrom)}
              onChange={(next) => {
                const from = visitDateKey(next);
                const to = visitDateKey(form.visitTo);
                setForm({
                  ...form,
                  visitFrom: from,
                  visitTo: to && to < from ? from : to,
                });
              }}
            />
          </Field>
          <Field label={ar ? "إلى تاريخ" : "To"} required>
            <PlatformDateField
              ar={ar}
              value={visitDateKey(form.visitTo)}
              onChange={(next) => {
                const to = visitDateKey(next);
                const from = visitDateKey(form.visitFrom);
                setForm({
                  ...form,
                  visitTo: to,
                  visitFrom: from && to && to < from ? to : from,
                });
              }}
            />
          </Field>
        </div>
        {lockedStation ? (
          <div className="vp-raise-2">
            <Field label={ar ? "فرع الزيارة" : "Visit station"} required>
              <div style={{ ...box, display: "flex", alignItems: "center", color: NAVY }}>
                {lockedStationName || lockedStation}
              </div>
            </Field>
            <Field label={ar ? "المضيف في الفرع" : "Host at the station"}>
              <select
                value={form.hostId}
                onChange={(event) => {
                  const id = event.target.value;
                  const emp = hosts.find((item) => String(item.id) === id);
                  setForm({ ...form, hostId: id, hostName: emp?.name || "" });
                }}
                style={box}
              >
                <option value="">{ar ? "اختياري" : "Optional"}</option>
                {hosts.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <>
            <Field as="div" label={ar ? "فروع الزيارة" : "Visit stations"} required>
              <OpsStationMultiSelect
                stations={branchList}
                value={selectedStationIds}
                onChange={(ids) => setForm({ ...form, stationIds: ids, stationId: ids[0] || "" })}
                ar={ar}
              />
              <div style={{ fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.55 }}>
                {ar
                  ? "تحديد الكل يضع بطاقة إثبات في كل فرع مختار."
                  : "Select all places a proof card on each chosen station."}
              </div>
            </Field>
            <Field label={ar ? "المضيف في الفرع" : "Host at the station"}>
              <select
                value={form.hostId}
                onChange={(event) => {
                  const id = event.target.value;
                  const emp = hosts.find((item) => String(item.id) === id);
                  setForm({ ...form, hostId: id, hostName: emp?.name || "" });
                }}
                style={box}
              >
                <option value="">{ar ? "اختياري" : "Optional"}</option>
                {hosts.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </OpsTaskSection>

      <OpsTaskSection
        title={ar ? "الزائرون" : "Visitors"}
        hint={ar
          ? "عدة أشخاص في الإثبات نفسه. الجنسية مطلوبة — سعودي أو غيرها."
          : "Several people on the same proof. Nationality is required — Saudi or other."}
      >
        <div className="vp-repeat">
          {people.map((person, index) => (
            <div
              key={`visitor-${index}`}
              style={{ padding: 12, borderRadius: 12, border: "1px solid var(--nv-line, #E2E8F0)", background: CARD }}
            >
              <RepeatHead
                title={ar ? `زائر ${index + 1}` : `Visitor ${index + 1}`}
                extra={index === dupIndex ? (
                  <span data-dup-id="1" style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", borderRadius: 999, padding: "1px 8px" }}>
                    {ar ? "رقم الهوية مكرر" : "Repeated ID"}
                  </span>
                ) : null}
                canRemove={people.length > 1}
                onRemove={() => setPeople(people.filter((_, i) => i !== index))}
                ar={ar}
              />
              <div className="vp-raise-2">
                <Field label={ar ? "الاسم" : "Name"} required={index === 0}>
                  <input required={index === 0} value={person.name} onChange={patchPerson(index, "name")} style={box} />
                </Field>
                <Field label={ar ? "الجنسية" : "Nationality"} required={index === 0}>
                  <input
                    required={index === 0}
                    list="nv-visitor-nationalities"
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
                <Field label={ar ? "رقم الهوية / الإقامة" : "ID / Iqama number"}>
                  <input value={person.id} onChange={patchPerson(index, "id")} dir="ltr" style={box} />
                </Field>
                <Field label={ar ? "الجوال" : "Phone"}>
                  <input value={person.phone} onChange={patchPerson(index, "phone")} dir="ltr" style={box} />
                </Field>
                <Field label={ar ? "الجنس" : "Gender"}>
                  <select value={person.gender || ""} onChange={patchPerson(index, "gender")} style={box}>
                    <option value="">{ar ? "اختر" : "Pick"}</option>
                    {GENDER_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{ar ? item.ar : item.en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={ar ? "المسمى" : "Title"}>
                  <input value={person.title} onChange={patchPerson(index, "title")} style={box} />
                </Field>
                <Field label={ar ? "رقم بطاقة الزائر" : "Visitor badge no."}>
                  <input value={person.badge || ""} onChange={patchPerson(index, "badge")} dir="ltr" placeholder={ar ? "تُسلَّم عند البوابة" : "Handed at the gate"} style={box} />
                </Field>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--nv-ink2)", cursor: "pointer" }}>
                <input type="checkbox" checked={!!person.briefed} onChange={setBriefed(index)} />
                {ar ? "تلقّى تعريف السلامة قبل الدخول" : "Safety briefing given before entry"}
              </label>
            </div>
          ))}
        </div>
        <datalist id="nv-visitor-nationalities">
          {VISITOR_NATIONALITIES.map((item) => <option key={item} value={item} />)}
        </datalist>
        {canAddCrewItem(people) ? (
          <button
            type="button"
            onClick={() => setPeople([...people, nextPerson()])}
            data-add-person="1"
            style={addBtn}
          >
            <Plus style={{ width: 14, height: 14 }} />
            {ar ? "إضافة زائر" : "Add visitor"}
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, opacity: 0.75 }}>{people.length}/{PROOF_PEOPLE_LIMIT}</span>
          </button>
        ) : null}
      </OpsTaskSection>

      <OpsTaskSection title={ar ? "السيارات" : "Vehicles"}>
        <div className="vp-repeat">
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
              <div className="vp-raise-2">
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
      </OpsTaskSection>

      <OpsTaskSection title={ar ? "المستندات" : "Documents"} hint={ar ? "هوية أو تصريح يظهر على بطاقة الزيارة." : "An ID or permit that stays on the visit card."}>
        <ProofAttachPicker
          files={Array.isArray(form.files) ? form.files : []}
          onChange={(files) => setForm({ ...form, files })}
          ar={ar}
        />
      </OpsTaskSection>
    </>
  );
}
