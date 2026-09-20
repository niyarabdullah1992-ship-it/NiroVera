import React from "react";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import SectionBackLink from "@/components/shared/SectionBackLink";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { BRAND, BRAND_DEEP, BRAND_SOFT, CARD, MUTED, field } from "@/lib/platformStyles";
import ProofAttachments from "@/components/proof/ProofAttachments";
import { cleanedPeople, cleanedVehicles } from "@/lib/workProofCrew";
import {
  deriveVisitorProofStage,
  visitDurationLabel,
  visitRangeLabel,
  visitorGenderLabel,
  visitorIdTypeLabel,
} from "@/lib/visitorProof";

const FIELD = { ...field, height: 40 };
const LABEL_SPAN = { fontSize: 12, fontWeight: 600, color: MUTED };

function ReadField({ label, children, ltr }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minWidth: 160 }}>
      <span style={LABEL_SPAN}>{label}</span>
      <div style={{ ...FIELD, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <span
          dir={ltr ? "ltr" : undefined}
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}
        >
          {children || "—"}
        </span>
      </div>
    </div>
  );
}

function modeStyle(active) {
  return {
    flex: 1,
    height: 36,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    borderRadius: 9,
    fontFamily: "inherit",
    fontSize: 12,
    lineHeight: 1.3,
    textAlign: "center",
    cursor: "default",
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP, fontWeight: 600 }
      : { border: `1px solid var(--nv-line, #E2E8F0)`, background: CARD, color: MUTED }),
  };
}

function plateOf(vehicle) {
  return [vehicle.plateLetters, vehicle.plateNumbers].filter(Boolean).join(" ") || vehicle.plate || "";
}

export default function VisitorProofCard({
  proof,
  ar,
  stationName,
  busy,
  canClose,
  canAttach = false,
  onClose,
  onLeave,
  onAddAttachment,
  onReplaceAttachment,
}) {
  if (!proof) return null;
  const stage = deriveVisitorProofStage(proof);
  const left = stage === "left";
  const duration = visitDurationLabel(proof, ar);
  const people = cleanedPeople(proof.people || [], proof.stationId);
  const shownPeople = people.length
    ? people
    : (proof.personName ? cleanedPeople([{
      name: proof.personName,
      id: proof.personId,
      title: proof.personTitle,
      phone: proof.personPhone,
    }], proof.stationId) : []);
  const vehicles = cleanedVehicles(proof.vehicles || []);
  const scopeLabel = shownPeople.length > 1
    ? (ar ? "عدة أشخاص" : "Several people")
    : (ar ? "شخص" : "Person");
  const stageLabel = left
    ? (ar ? "غادر" : "Left")
    : (ar ? "في الفرع" : "On site");
  const hint = [proof.ref, stageLabel].filter(Boolean).join(" · ");

  return (
    <ComposerModalShell
      ar={ar}
      asForm={false}
      zIndex={110}
      dataNv="task"
      title={proof.title || proof.personName || (ar ? "بطاقة الزائر" : "Visitor card")}
      hint={hint}
      onClose={onClose}
      back={<SectionBackLink ar={ar} label={ar ? "إثبات زائر" : "Visitor proof"} onClick={onClose} />}
      footer={canClose ? (
        <button
          type="button"
          disabled={busy}
          onClick={onLeave}
          style={{
            width: "100%",
            height: 44,
            borderRadius: 12,
            background: busy ? "var(--nv-soft, #E2E8F0)" : BRAND,
            color: busy ? MUTED : "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 650,
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {ar ? "تسجيل المغادرة" : "Mark left"}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          {left
            ? (ar ? "سُجّلت المغادرة — البطاقة في الأرشيف." : "Departure is recorded — this card is in the archive.")
            : (ar ? "لا إجراء مطلوب منك على هذه البطاقة." : "No action is required from you on this card.")}
        </div>
      )}
    >
      <OpsTaskSection title={ar ? "الإسناد" : "Assignment"}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ReadField label={ar ? "الفرع" : "Station"}>{stationName || proof.stationId || "—"}</ReadField>
          <ReadField label={ar ? "المسؤول" : "Owner"}>{shownPeople[0]?.name || proof.personName || "—"}</ReadField>
          <ReadField label={ar ? "أنشأها" : "Created by"}>{proof.raiserName || "—"}</ReadField>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ReadField label={ar ? "النطاق" : "Scope"}>{scopeLabel}</ReadField>
          <ReadField label={ar ? "المضيف في الفرع" : "Host at the station"}>{proof.hostName || (ar ? "بدون مضيف" : "No host")}</ReadField>
        </div>
      </OpsTaskSection>

      <OpsTaskSection title={ar ? "الزيارة" : "Visit"}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ReadField label={ar ? "سبب الزيارة" : "Visit reason"}>{proof.visitReason}</ReadField>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ReadField label={ar ? "الفترة" : "Period"} ltr>{visitRangeLabel(proof, ar) || "—"}</ReadField>
          <ReadField label={ar ? "المدة" : "Duration"}>{duration}</ReadField>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={LABEL_SPAN}>{ar ? "الحالة" : "Status"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={modeStyle(!left)}>{ar ? "في الفرع" : "On site"}</div>
            <div style={modeStyle(left)}>{ar ? "غادر" : "Left"}</div>
          </div>
        </div>
      </OpsTaskSection>

      <OpsTaskSection
        title={ar ? "الزائرون" : "Visitors"}
        count={shownPeople.length || undefined}
        hint={ar ? "ضيف على الفرع — ليس موظفاً ينفّذ من فرع آخر، وليست جهة خارجية." : "A guest at the station — not a company employee executing from another branch, and not an outside company."}
      >
        {shownPeople.length ? shownPeople.map((person, index) => (
          <div
            key={`${person.id || person.name}-${index}`}
            style={{ padding: 12, borderRadius: 12, border: "1px solid var(--nv-line, #E2E8F0)", background: CARD }}
          >
            <div style={{ fontSize: 12, fontWeight: 650, color: MUTED, marginBottom: 10 }}>
              {ar ? `زائر ${index + 1}` : `Visitor ${index + 1}`}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ReadField label={ar ? "الاسم" : "Name"}>{person.name}</ReadField>
              <ReadField label={ar ? "الجنسية" : "Nationality"}>{person.nationality}</ReadField>
              <ReadField label={ar ? "نوع الهوية" : "ID type"}>{visitorIdTypeLabel(person.idType, ar)}</ReadField>
              <ReadField label={ar ? "رقم الهوية / الإقامة" : "ID / Iqama"} ltr>{person.id}</ReadField>
              <ReadField label={ar ? "الجوال" : "Phone"} ltr>{person.phone}</ReadField>
              <ReadField label={ar ? "الجنس" : "Gender"}>{visitorGenderLabel(person.gender, ar)}</ReadField>
              <ReadField label={ar ? "المسمى" : "Title"}>{person.title}</ReadField>
            </div>
          </div>
        )) : (
          <div style={{ fontSize: 12, color: MUTED }}>{ar ? "لا زوار على هذه البطاقة." : "No visitors on this card."}</div>
        )}
      </OpsTaskSection>

      {vehicles.length ? (
        <OpsTaskSection title={ar ? "السيارات" : "Vehicles"} count={vehicles.length}>
          {vehicles.map((vehicle, index) => (
            <div
              key={`${plateOf(vehicle) || vehicle.maker}-${index}`}
              style={{ padding: 12, borderRadius: 12, border: "1px solid var(--nv-line, #E2E8F0)", background: CARD }}
            >
              <div style={{ fontSize: 12, fontWeight: 650, color: MUTED, marginBottom: 10 }}>
                {ar ? `سيارة ${index + 1}` : `Vehicle ${index + 1}`}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ReadField label={ar ? "الشركة المصنعة" : "Maker"}>{vehicle.maker}</ReadField>
                <ReadField label={ar ? "الموديل" : "Model"}>{vehicle.model}</ReadField>
                <ReadField label={ar ? "نوع السيارة" : "Type"}>{vehicle.type}</ReadField>
                <ReadField label={ar ? "سنة الصنع" : "Year"} ltr>{vehicle.year}</ReadField>
                <ReadField label={ar ? "حروف اللوحة" : "Plate letters"}>{vehicle.plateLetters}</ReadField>
                <ReadField label={ar ? "أرقام اللوحة" : "Plate numbers"} ltr>{vehicle.plateNumbers}</ReadField>
              </div>
            </div>
          ))}
        </OpsTaskSection>
      ) : null}

      <ProofAttachments
        attachments={proof.attachments}
        ar={ar}
        busy={busy}
        canEdit={!!canAttach}
        onAdd={onAddAttachment}
        onReplace={onReplaceAttachment}
      />

      {left ? (
        <OpsTaskSection tone="ok" title={ar ? "سُجّلت المغادرة" : "Departure recorded"}>
          <div style={{ fontSize: 12, color: "#15803D", lineHeight: 1.65 }}>
            {ar ? "الزائر غادر الفرع، والبطاقة في الأرشيف." : "The visitor left the station, and the card is in the archive."}
          </div>
        </OpsTaskSection>
      ) : null}
    </ComposerModalShell>
  );
}
