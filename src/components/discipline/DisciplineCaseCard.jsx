import React from "react";
import { Link } from "react-router-dom";
import EmployeeNameLink from "@/components/employees/EmployeeNameLink";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import DisciplineRelatedLinks from "@/components/discipline/DisciplineRelatedLinks";
import { downloadDisciplineNotice } from "@/lib/disciplineDoc";

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

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((part) => part.slice(0, 1)).join("");
}

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

export default function DisciplineCaseCard({ card, ar, onAction, onUploadSigned }) {
  const current = card.steps.findIndex((step) => !step.done);
  const currentId = current >= 0 ? card.steps[current].id : "";
  const primary = card.actions.find((action) => action.kind === "go") || card.actions[0] || null;
  const rest = card.actions.filter((action) => action !== primary);
  const fact = String(card.item?.note || card.item?.reason || "").trim() || "—";
  const discovered = String(card.item?.discoveredAt || "").slice(0, 10) || "—";
  const stageOpen = card.face?.id !== "closed";

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
      <div aria-hidden style={{ height: 4, background: `linear-gradient(90deg, ${GOLD}, #E3CB8F)` }} />
      <header style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderBottom: "1px solid var(--nv-line3)" }}>
        <span
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#0B3D27,#0F5535)",
            color: "var(--nv-btn-ink)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            fontWeight: 700,
            flex: "none",
          }}
        >
          {initials(card.employee?.name)}
        </span>
        <div style={{ flex: "1 1 200px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <EmployeeNameLink
              employeeId={card.employee?.id || card.item.employeeId}
              employeeName={card.employee?.name || "—"}
              style={{ fontSize: 17, fontWeight: 700, color: "var(--nv-ink)", minWidth: 0, textDecoration: "none" }}
            />
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: 11.5, color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 6, padding: "1px 8px", unicodeBidi: "isolate" }}>
              {card.item?.id || "—"}
            </span>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>
            {card.jobTitle || "—"}
            {" · "}
            {card.station?.name || "—"}
            {" · "}
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", unicodeBidi: "isolate" }}>{card.fileCode || "—"}</span>
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            height: 26,
            padding: "0 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: stageOpen ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)",
            background: stageOpen ? "var(--nv-warn-soft)" : "var(--nv-ok-soft)",
            border: `1px solid ${stageOpen ? "var(--nv-warn-line)" : "var(--nv-ok-line)"}`,
          }}
          >
            {ar ? card.face.shortAr : card.face.shortEn}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: DANGER }}>{card.penalty ? `${card.penalty} — ${ar ? "المادة 66" : "Article 66"}` : "—"}</span>
        </div>
      </header>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "12px 14px" }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 8, background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flex: "none" }}>!</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{fact}</strong>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
              {ar ? `كُشفت ${discovered}` : `Discovered ${discovered}`}
              {" · "}
              {card.steps[0]?.done ? (ar ? "أُبلغ بها كتابةً" : "Notified in writing") : (ar ? "لم يُبلَغ بعد" : "Not yet notified")}
              {" · "}
              <span style={{ whiteSpace: "nowrap" }}>{ar ? "(المادة 68)" : "(Article 68)"}</span>
            </span>
          </div>
        </div>

        <div className="nv-disc-steps" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", padding: "4px 0" }}>
          {card.steps.map((step, index) => {
            const on = step.id === currentId;
            const done = step.done;
            return (
              <div key={step.id} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, minWidth: 0 }}>
                {index < card.steps.length - 1 ? (
                  <span aria-hidden style={{ position: "absolute", top: 16, insetInlineStart: "50%", width: "100%", height: 2, background: done ? ACTION : "var(--nv-line)" }} />
                ) : null}
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontWeight: 700,
                  fontSize: 13,
                  position: "relative",
                  zIndex: 1,
                  color: done ? "var(--nv-btn-ink)" : on ? "var(--nv-warn-ink)" : "var(--nv-muted)",
                  background: done ? ACTION : "var(--nv-card)",
                  border: done ? `1px solid ${ACTION}` : on ? `2px solid ${GOLD}` : "1.5px solid var(--nv-line)",
                  boxShadow: on ? "0 0 0 4px var(--nv-warn-soft)" : "none",
                }}
                >
                  {done ? "✓" : String(index + 1)}
                </span>
                <span style={{ fontSize: 12, textAlign: "center", fontWeight: on ? 700 : 500, color: done || on ? "var(--nv-ink)" : "var(--nv-muted)", lineHeight: 1.35 }}>{step.name}</span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 500, color: "var(--nv-muted)", minHeight: 14, textAlign: "center", unicodeBidi: "isolate" }}>
                  {done ? (step.when || "—") : on ? (ar ? "الآن" : "Now") : "—"}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 10 }}>
          {(card.meters || []).map((meter) => {
            const tone = METER[meterTone(meter)];
            return (
              <div key={meter.id} style={{ border: "1px solid var(--nv-line)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, background: "var(--nv-card)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{meter.label}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", borderRadius: 999, padding: "1px 8px" }}>
                    {ar ? `المادة ${meter.article}` : `Art. ${meter.article}`}
                  </span>
                </div>
                <strong dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 700, color: tone.ink, textAlign: "end", unicodeBidi: "isolate" }}>{meter.text || "—"}</strong>
                <div style={{ height: 5, borderRadius: 999, background: "var(--nv-soft)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${meter.pct || 0}%`, borderRadius: 999, background: tone.bar }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--nv-ink2)" }}>
                  {!meter.text || meter.text === "—"
                    ? "—"
                    : meter.over
                      ? (ar ? "تجاوز السقف" : "Over the cap")
                      : (ar ? "ضمن المهلة" : "Within the window")}
                </span>
              </div>
            );
          })}
        </div>
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
        <button type="button" title={card.dlTip} onClick={() => downloadDisciplineNotice(card, ar)} style={quietBtn}>
          {card.dlLabel}
        </button>
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
