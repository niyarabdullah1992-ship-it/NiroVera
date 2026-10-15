import React, { useState } from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { DISCIPLINE_DELIVERY_METHODS } from "@/lib/disciplineDerivations";
import { Link } from "react-router-dom";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import DisciplineRelatedLinks from "@/components/discipline/DisciplineRelatedLinks";
import { printDisciplinePaper } from "@/lib/disciplineDoc";
import { regulationDate } from "@/lib/workRegulation";
import { DetailHero, HeroBar, HeroFigure, HeroPill, HeroPrintButton } from "@/components/tasks/detail/DetailKit";
import EscalationLadder from "@/components/shared/EscalationLadder";

const ACTION = "#3C7D50";
const GOLD = "#C8A45A";
const DANGER = "#9B2335";

function actionStyle(kind) {
  if (kind === "go") {
    return {
      background: ACTION,
      color: "var(--nv-btn-ink)",
      border: `1px solid ${ACTION}`,
      cursor: "pointer",
    };
  }
  if (kind === "bad") {
    return {
      background: "var(--nv-card)",
      color: "var(--nv-muted)",
      border: "1px solid var(--nv-line)",
      cursor: "default",
    };
  }
  return {
    background: "var(--nv-card)",
    color: "var(--nv-ink)",
    border: "1px solid var(--nv-line)",
    cursor: "pointer",
  };
}

const quietBtn = {
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  height: 42,
  padding: "0 16px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};


function meterTone(meter) {
  if (!meter?.text || meter.text === "—") return "mute";
  if (meter.over) return "bad";
  if (meter.id === "appeal") return "warn";
  return "ok";
}

const METER = {
  ok: { ink: "var(--nv-ok-ink)", bar: ACTION },
  warn: { ink: "var(--nv-warn-ink)", bar: GOLD },
  bad: { ink: "var(--nv-bad-ink)", bar: DANGER },
  mute: { ink: "var(--nv-muted)", bar: "var(--nv-line)" },
};

/**
 * The file's head in the platform's dark green: who, what was found and when, the penalty and what it
 * takes, the five stages as one ladder, and the three statutory clocks (Arts. 69, 72, 70).
 */
export function DisciplineHero({ card, ar = true, mine = false, companyName = "" }) {
  const current = card.steps.findIndex((step) => !step.done);
  const fact = String(card.item?.note || card.item?.reason || "").trim() || "—";
  const discovered = regulationDate(card.item?.discoveredAt, ar) || "—";
  const faceTone = card.face?.id === "closed" ? "ok" : card.face?.id === "objected" ? "bad" : card.face?.id === "signed" ? "ok" : "warn";
  const ladder = card.steps.map((step, i) => ({
    name: step.name,
    role: "",
    state: step.done ? "passed" : i === current ? "now" : "later",
    note: step.done ? (step.when || "—") : i === current ? (ar ? "الآن" : "Now") : (ar ? "لاحقاً" : "Later"),
  }));
  const meterTone = (m) => (!m?.text || m.text === "—" ? "mute" : m.over ? "bad" : m.id === "appeal" ? "warn" : "ok");
  return (
    <DetailHero
      kind={mine ? (ar ? "جزاء على ملفي" : "A sanction on my file") : (ar ? "ملف جزاء" : "Sanction file")}
      pills={(
        <>
          <HeroPill tone={faceTone} live={faceTone === "warn"} data="stage">{ar ? card.face.shortAr : card.face.shortEn}</HeroPill>
          {card.penalty ? <HeroPill tone="bad" data="penalty">{card.penalty}</HeroPill> : null}
        </>
      )}
      menu={<HeroPrintButton ar={ar} label={card.dlLabel} onClick={() => printDisciplinePaper(card, ar, { company: companyName })} />}
      figure={(
        <HeroFigure
          mono={false}
          value={mine ? fact : (card.employee?.name || "—")}
          unit={mine ? "" : [card.jobTitle, card.station?.name].filter(Boolean).join(" · ")}
          line={mine
            ? [discovered !== "—" ? (ar ? `كُشفت ${discovered}` : `Found ${discovered}`) : "", card.steps[0]?.done ? (ar ? "أُبلغتَ بها كتابةً" : "Notified in writing") : (ar ? "لم تُبلَّغ بعد" : "Not notified yet")].filter(Boolean).join(" · ")
            : [fact, discovered !== "—" ? (ar ? `كُشفت ${discovered}` : `found ${discovered}`) : ""].filter(Boolean).join(" — ")}
          lineTone={card.blocked ? "bad" : undefined}
        />
      )}
      facts={[
        { label: ar ? "الجزاء (المادة 66)" : "Penalty (Art. 66)", value: card.penalty || "—", tone: "gold" },
        card.item?.regulationRef ? {
          label: ar ? "بند اللائحة (المادة 67)" : "Regulation clause (Art. 67)",
          value: `${card.item.regulationOffence || "—"}${card.item.regulationTime ? (ar ? ` · المرة ${["الأولى", "الثانية", "الثالثة", "الرابعة"][card.item.regulationTime - 1] || card.item.regulationTime}` : ` · time ${card.item.regulationTime}`) : ""}`,
        } : null,
        card.cut > 0 ? { label: ar ? "الحسم" : "The cut", value: `${Math.round(card.cut).toLocaleString("en-US")} ${ar ? "ر.س" : "SAR"}`, mono: true, tone: "bad" } : null,
        ...(card.meters || []).map((m) => ({ label: `${m.label} · ${ar ? "م" : "Art."} ${m.article}`, value: m.text || "—", mono: true, tone: m.over ? "bad" : undefined })),
      ]}
    >
      <div style={{ background: "var(--nv-card)", borderRadius: 12, padding: "12px 12px 6px" }}>
        <EscalationLadder steps={ladder} ar={ar} dataKey="discipline" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {(card.meters || []).map((m) => (
          <span key={m.id} data-disc-meter={m.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#A9CDB8" }}>
              <span>{m.label}</span>
              <span>{m.over ? (ar ? "تجاوز" : "Over") : (!m.text || m.text === "—") ? "—" : (ar ? "ضمن المهلة" : "Within")}</span>
            </span>
            <HeroBar pct={m.pct || 0} tone={meterTone(m) === "bad" ? "bad" : meterTone(m) === "warn" ? "gold" : "ok"} />
          </span>
        ))}
      </div>
    </DetailHero>
  );
}

/** Model regulation Art. 68 · Law Art. 72 — record how and when the signed decision reached the worker. */
function DeliveryProof({ item, ar, today, onDelivery }) {
  const [method, setMethod] = useState("hand");
  const [at, setAt] = useState(today || "");
  const [ref, setRef] = useState("");
  const done = DISCIPLINE_DELIVERY_METHODS.find((m) => m.id === item.notifyMethod);
  if (done) {
    return (
      <div data-disc-delivery="done" style={{ margin: "0 20px 12px", fontSize: 12.5, color: "var(--nv-ink)", border: "1px solid var(--nv-ok-line)", borderRadius: 8, padding: "10px 14px", lineHeight: 1.7 }}>
        {ar ? "أُبلغ بالقرار: " : "Decision delivered: "}{ar ? done.ar : done.en} · {regulationDate(item.notifyDeliveredAt, ar)}{item.notifyRef ? ` · ${item.notifyRef}` : ""}
      </div>
    );
  }
  const input = { fontFamily: "inherit", fontSize: 13, height: 38, padding: "0 10px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-page)", color: "var(--nv-ink)", boxSizing: "border-box", minWidth: 0 };
  return (
    <div data-disc-delivery="" style={{ margin: "0 20px 12px", display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--nv-line)", borderInlineStart: `3px solid ${GOLD}`, borderRadius: 8, padding: "10px 14px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{ar ? "إثبات إبلاغ العامل بالقرار (المادة 72 · النموذج م68)" : "Proof the decision reached the worker (Art. 72 · model Art. 68)"}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 8 }}>
        <select value={method} onChange={(e) => setMethod(e.target.value)} style={input} aria-label={ar ? "طريقة الإبلاغ" : "Delivery method"}>
          {DISCIPLINE_DELIVERY_METHODS.map((m) => <option key={m.id} value={m.id}>{ar ? m.ar : m.en}</option>)}
        </select>
        <PlatformDateField ar={ar} value={at} onChange={setAt} style={{ height: 38, minHeight: 38, fontSize: 13, background: "var(--nv-page)", borderRadius: 8 }} />
        {method !== "hand" ? <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={ar ? "رقم الإرسال / مرجع البريد" : "Tracking / message ref."} style={input} /> : null}
        <button type="button" onClick={() => onDelivery?.(item, { method, at, ref })} style={{ ...quietBtn, height: 38, justifyContent: "center" }}>{ar ? "سجّل الإبلاغ" : "Record delivery"}</button>
      </div>
    </div>
  );
}

export default function DisciplineCaseCard({ card, ar, onAction, onUploadSigned, onDelivery, today = "", companyName = "" }) {
  const primary = card.actions.find((action) => action.kind === "go") || card.actions[0] || null;
  const rest = card.actions.filter((action) => action !== primary);

  return (
    <article
      data-discipline-case=""
      style={{
        background: "var(--nv-card)",
        border: "1px solid var(--nv-line)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "var(--nv-paper)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: 14 }}>
        <DisciplineHero card={card} ar={ar} companyName={companyName} />
      </div>
      <footer style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--nv-line)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "var(--nv-page)" }}>
        {primary ? (
          <button
            type="button"
            title={primary.tip}
            onClick={() => onAction?.(card.item, primary.id)}
            style={{ fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, height: 42, padding: "0 22px", borderRadius: 10, whiteSpace: "nowrap", ...actionStyle(primary.kind) }}
          >
            {primary.label}
          </button>
        ) : null}
        {rest.map((action) => (
          <button
            key={action.id}
            type="button"
            title={action.tip}
            onClick={() => onAction?.(card.item, action.id)}
            style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, height: 42, padding: "0 16px", borderRadius: 10, whiteSpace: "nowrap", ...actionStyle(action.kind) }}
          >
            {action.label}
          </button>
        ))}
        {card.canSignDoc ? (
          <Link to="/app/signing" style={{ ...quietBtn, borderColor: "#0B3D27", color: "var(--nv-ink)" }}>
            {ar ? "وقّعها في التوقيع الرقمي" : "Sign it in Digital signing"}
          </Link>
        ) : null}
        {card.canSignDoc ? (
          <label className="nv-attach nv-attach--inline" style={{ height: 42, display: "inline-flex", alignItems: "center" }}>
            {ar ? "ارفع الموقَّعة" : "Upload the signed copy"}
            <input
              type="file"
              className="nv-attach-native"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUploadSigned?.(card.item, file);
              }}
            />
          </label>
        ) : null}
        {card.signedPaper?.url ? (
          <ConsentFileLink file={card.signedPaper} ar={ar}>{ar ? "نزّل الموقَّعة" : "Download the signed copy"}</ConsentFileLink>
        ) : null}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--nv-ink2)" }}>{ar ? "كل خطوة تُسجَّل باسمك ووقتها في التدقيق." : "Every step is stored with your name and time."}</span>
      </footer>

      {card.signedAt && onDelivery ? <DeliveryProof item={card.item} ar={ar} today={today} onDelivery={onDelivery} /> : null}
      {card.hasObj ? (
        <span style={{ margin: "0 20px 12px", fontSize: 12.5, color: "var(--nv-ink)", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderInlineStart: "3px solid #C8A45A", borderRadius: 8, padding: "10px 14px", lineHeight: 1.7 }}>
          {card.objText}
          {card.appealFile?.url ? (
            <>
              {" · "}
              <ConsentFileLink file={card.appealFile} ar={ar}>{ar ? "نزّل مرفق الاعتراض" : "Download the objection file"}</ConsentFileLink>
            </>
          ) : null}
        </span>
      ) : null}
      {card.blocked ? (
        <span style={{ margin: "0 20px 12px", fontSize: 12.5, color: "var(--nv-bad-ink)", background: "var(--nv-card)", border: "1px solid var(--nv-bad-line)", borderRadius: 8, padding: "10px 14px", lineHeight: 1.7 }}>{card.blocked}</span>
      ) : null}
      <div style={{ padding: "0 20px 14px" }}>
        <DisciplineRelatedLinks links={card.related} ar={ar} />
      </div>
    </article>
  );
}
