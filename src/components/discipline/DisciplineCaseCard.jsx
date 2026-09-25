import React from "react";
import { Link } from "react-router-dom";
import EmployeeNameLink from "@/components/employees/EmployeeNameLink";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import DisciplineRelatedLinks from "@/components/discipline/DisciplineRelatedLinks";
import { downloadDisciplineNotice } from "@/lib/disciplineDoc";

function actionStyle(kind) {
  if (kind === "go") return { background: "var(--nv-ok-fill)", color: "var(--nv-btn-ink)", border: "1px solid var(--nv-ok-fill)", borderRadius: 10, cursor: "pointer" };
  if (kind === "bad") return { background: "var(--nv-card)", color: "var(--nv-muted)", border: "1px solid var(--nv-line)", borderRadius: 10, cursor: "default" };
  return { background: "var(--nv-card)", color: "var(--nv-ink)", border: "1px solid var(--nv-line)", borderRadius: 10, cursor: "pointer" };
}

const docBtn = {
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  padding: "8px 12px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none",
};

export default function DisciplineCaseCard({ card, ar, onAction, onUploadSigned }) {
  return (
    <article style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", borderTop: `3px solid ${card.tone.accent}`, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 11, alignItems: "baseline" }}>
        <EmployeeNameLink
          employeeId={card.employee?.id || card.item.employeeId}
          employeeName={card.employee?.name || card.item.employeeId}
          style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", minWidth: 0, textDecoration: "none" }}
        />
        <span style={{ fontSize: 11, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>{card.station?.name || "—"}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: card.tone.color, background: card.tone.bg, border: `1px solid ${card.tone.border}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
          {ar ? card.face.shortAr : card.face.shortEn}
        </span>
      </div>
      <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>{card.line}</span>
      <div style={{ display: "flex", gap: 0, flexWrap: "wrap", border: "1px solid var(--nv-line3)", borderRadius: 10, overflow: "hidden" }}>
        {card.steps.map((step) => (
          <span key={step.id} style={{ flex: "1 1 92px", minWidth: 0, padding: "7px 9px", borderInlineStart: "1px solid var(--nv-line3)", background: step.bg, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: step.color, lineHeight: 1.5 }}>{step.name}</span>
            <span style={{ fontSize: 9, color: "var(--nv-muted)", lineHeight: 1.6 }}>{step.when}</span>
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 11, alignItems: "center", background: "var(--nv-soft)", border: "1px solid var(--nv-line3)", borderRadius: 10, padding: "9px 11px" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{card.docTitle}</span>
          <span style={{ fontSize: 10, color: card.docColor, lineHeight: 1.75 }}>{card.docNote}</span>
        </span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" title={card.dlTip} onClick={() => downloadDisciplineNotice(card, ar)} style={docBtn}>
            {card.dlLabel}
          </button>
          {card.signedPaper?.url ? (
            <ConsentFileLink file={card.signedPaper} ar={ar}>{ar ? "نزّل الموقَّعة" : "Download the signed copy"}</ConsentFileLink>
          ) : null}
          {card.canSignDoc ? (
            <>
              <label className="nv-attach nv-attach--inline">
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
              <Link to="/app/signing" style={docBtn}>{ar ? "وقّعها في التوقيع الرقمي" : "Sign it in Digital signing"}</Link>
            </>
          ) : null}
        </span>
      </div>
      {card.hasObj ? (
        <span style={{ fontSize: 11, color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>
          {card.objText}
          {card.appealFile?.url ? (
            <>
              {" · "}
              <ConsentFileLink file={card.appealFile} ar={ar}>{ar ? "نزّل مرفق الاعتراض" : "Download the objection file"}</ConsentFileLink>
            </>
          ) : null}
        </span>
      ) : null}
      {card.actions.length ? (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {card.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              title={action.tip}
              onClick={() => onAction?.(card.item, action.id)}
              style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 13px", whiteSpace: "nowrap", ...actionStyle(action.kind) }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {card.blocked ? (
        <span style={{ fontSize: 11, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>{card.blocked}</span>
      ) : null}
      <DisciplineRelatedLinks links={card.related} ar={ar} />
    </article>
  );
}
