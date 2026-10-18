import React from "react";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import SectionBackLink from "@/components/shared/SectionBackLink";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { DetailHero, Fact, HeroBar, HeroFigure, HeroPill, HeroPrintButton } from "@/components/tasks/detail/DetailKit";
import { printSheet } from "@/lib/printSheet";
import { visitorPassSheet } from "@/lib/printRecords";
import { BRAND, BRAND_DEEP, BRAND_SOFT, CARD, MUTED, field } from "@/lib/platformStyles";
import ProofAttachments from "@/components/proof/ProofAttachments";
import ProofPeoplePanel from "@/components/proof/ProofPeoplePanel";
import { cleanedPeople, cleanedVehicles } from "@/lib/workProofCrew";
import { visitPassState } from "@/components/proof/VisitorPassCard";
import {
  todayVisitDateKey,
  visitBounds,
  visitDurationDays,
  deriveVisitorProofStage,
  visitDurationLabel,
} from "@/lib/visitorProof";

const FIELD = { ...field, height: 40 };
const LABEL_SPAN = { fontSize: 12, fontWeight: 600, color: MUTED };

// Facts read as label-over-value cells, not read-only input boxes.
function ReadField({ label, children, ltr, multiline }) {
  return (
    <div style={{ flex: "1 1 160px", minWidth: 0, display: "grid" }}>
      <Fact label={label} ltr={ltr} multiline={multiline}>{children}</Fact>
    </div>
  );
}


function dmy(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** A new end date and why — the old date stays on the record. */
function ExtendVisit({ ar, proof, busy, onExtend }) {
  const [to, setTo] = React.useState("");
  const [reason, setReason] = React.useState("");
  const input = { fontFamily: "inherit", fontSize: 12.5, height: 38, padding: "0 10px", border: "1px solid var(--nv-line)", borderRadius: 9, background: "var(--nv-card)", color: "var(--nv-ink)", boxSizing: "border-box" };
  return (
    <div data-vp-extend="1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
        {ar
          ? `التصريح الحالي حتى ${dmy(proof.visitTo || proof.visitFrom) || "—"}. التمديد يُسجَّل بسببه وباسمك، والتاريخ السابق يبقى في السجل.`
          : `The pass currently ends ${dmy(proof.visitTo || proof.visitFrom) || "—"}. The extension is logged with its reason and your name.`}
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="date" dir="ltr" aria-label={ar ? "النهاية الجديدة" : "New end"} value={to} min={proof.visitTo || undefined} onChange={(e) => setTo(e.target.value)} style={{ ...input, flex: "0 0 170px" }} />
        <input aria-label={ar ? "سبب التمديد" : "Reason"} placeholder={ar ? "سبب التمديد" : "Why the visit runs longer"} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...input, flex: "1 1 200px" }} />
        <button
          type="button"
          data-vp-extend-save="1"
          disabled={busy}
          onClick={async () => { const r = await onExtend?.({ to, reason }); if (r?.ok) { setTo(""); setReason(""); } }}
          style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, height: 38, padding: "0 16px", borderRadius: 9, border: "1px solid #0B3D27", background: "var(--nv-card)", color: "#0B3D27", cursor: "pointer" }}
        >
          {ar ? "مدّد التصريح" : "Extend"}
        </button>
      </div>
    </div>
  );
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
  onAddPerson,
  onPersonOut,
  onExtend,
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
      tinted
      wide
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
          {ar ? "تسجيل مغادرة الجميع" : "Everyone left"}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          {left
            ? (ar ? "سُجّلت المغادرة — البطاقة في الأرشيف." : "Departure is recorded — this card is in the archive.")
            : (ar ? "لا إجراء مطلوب منك على هذه البطاقة." : "No action is required from you on this card.")}
        </div>
      )}
    >
      {(() => {
        const st = visitPassState(proof);
        const { from, to } = visitBounds(proof);
        const span = visitDurationDays(proof) || 1;
        const startMs = Date.parse(`${from}T00:00:00`);
        const nowKey = todayVisitDateKey();
        const nth = Number.isFinite(startMs) ? Math.min(span, Math.max(0, Math.round((Date.parse(`${nowKey}T00:00:00`) - startMs) / 86400000) + 1)) : 0;
        const inside = shownPeople.filter((p) => !p.outAt).length;
        const lead = shownPeople[0];
        const arrived = /T(\d{2}:\d{2})/.exec(String(proof.arrivedAt || ""))?.[1] || "";
        const label = { on_site: ["في الفرع", "On site"], last: ["آخر يوم", "Last day"], overstay: ["تجاوز موعده", "Past the date"], upcoming: ["زيارة قادمة", "Upcoming"], left: ["غادر", "Left"] }[st.key];
        return (
          <DetailHero
            kind={ar ? "تصريح زائر" : "Visitor pass"}
            pills={<HeroPill tone={st.tone === "ok" ? "ok" : st.tone === "bad" ? "bad" : st.tone === "warn" ? "warn" : "mute"} live={st.key === "on_site"} data="state">{ar ? label[0] : label[1]}</HeroPill>}
            menu={(
              <HeroPrintButton
                ar={ar}
                label={ar ? "طباعة التصريح" : "Print pass"}
                onClick={() => printSheet(visitorPassSheet({
                  proof,
                  ar,
                  stateLabel: ar ? label[0] : label[1],
                  tone: st.tone === "ok" ? "ok" : st.tone === "bad" ? "bad" : st.tone === "warn" ? "warn" : "mute",
                  branch: stationName || proof.stationId || "",
                  people: shownPeople,
                  vehicles,
                  from,
                  to,
                  duration,
                }))}
              />
            )}
            figure={(
              <HeroFigure
                mono={false}
                value={lead?.name || proof.personName || "—"}
                unit={shownPeople.length > 1 ? (ar ? `ومعه ${shownPeople.length - 1}` : `+${shownPeople.length - 1}`) : ""}
                line={st.key === "left"
                  ? (ar ? "سُجّلت المغادرة — التصريح في الأرشيف" : "Left — the pass is archived")
                  : st.key === "overstay"
                    ? (ar ? "انتهى التصريح ولم تُسجَّل المغادرة" : "The pass ended with no leaving recorded")
                    : (ar ? `اليوم ${nth} من ${span}` : `Day ${nth} of ${span}`)}
                lineTone={st.key === "overstay" ? "bad" : st.key === "last" ? "warn" : "ok"}
              />
            )}
            facts={[
              { label: ar ? "الفرع" : "Branch", value: stationName || proof.stationId || "—" },
              { label: ar ? "المضيف" : "Host", value: proof.hostName || (ar ? "بدون مضيف" : "No host") },
              { label: ar ? "وصل" : "Arrived", value: arrived || "—", mono: true },
              { label: ar ? "حتى" : "Until", value: dmy(to || from) || "—", mono: true, tone: st.key === "overstay" ? "bad" : undefined },
              shownPeople.length > 1 ? { label: ar ? "في الفرع" : "Inside", value: `${inside}/${shownPeople.length}`, mono: true, tone: "gold" } : null,
            ]}
          >
            {left ? null : <HeroBar pct={st.key === "overstay" ? 100 : Math.round((nth / span) * 100)} tone={st.key === "overstay" ? "bad" : st.key === "last" ? "gold" : "ok"} />}
          </DetailHero>
        );
      })()}

      <OpsTaskSection title={ar ? "الزيارة" : "Visit"}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ReadField label={ar ? "سبب الزيارة" : "Visit reason"} multiline>{proof.visitReason}</ReadField>
          <ReadField label={ar ? "مدة التصريح" : "Pass length"}>{duration}</ReadField>
          {proof.raiserName ? <ReadField label={ar ? "سجّلها" : "Recorded by"}>{proof.raiserName}</ReadField> : null}
        </div>
      </OpsTaskSection>

      <OpsTaskSection title={ar ? "الزوار" : "Visitors"}>
        <ProofPeoplePanel
          ar={ar}
          bare
          kind="visitor"
          people={shownPeople}
          fallbackIn={proof.arrivedAt}
          canEdit={!left && !!canClose}
          busy={busy}
          onAdd={onAddPerson}
          onOut={onPersonOut}
        />
      </OpsTaskSection>

      {!left && canClose && onExtend ? (
        <OpsTaskSection title={ar ? "تمديد التصريح" : "Extend the pass"}>
          <ExtendVisit ar={ar} proof={proof} busy={busy} onExtend={onExtend} />
        </OpsTaskSection>
      ) : null}
      {Array.isArray(proof.extensions) && proof.extensions.length ? (
        <OpsTaskSection title={ar ? "التمديدات" : "Extensions"} count={proof.extensions.length}>
          {proof.extensions.map((x, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{dmy(x.from)} → {dmy(x.to)}</span>
              {" · "}{x.reason}{x.by ? (ar ? ` · ${x.by}` : ` · ${x.by}`) : ""}
            </div>
          ))}
        </OpsTaskSection>
      ) : null}

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
          <div style={{ fontSize: 12, color: "var(--nv-ok-ink)", lineHeight: 1.65 }}>
            {ar ? "الزائر غادر الفرع، والبطاقة في الأرشيف." : "The visitor left the station, and the card is in the archive."}
          </div>
        </OpsTaskSection>
      ) : null}
    </ComposerModalShell>
  );
}
