import React, { useState } from "react";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import DisciplineRelatedLinks from "@/components/discipline/DisciplineRelatedLinks";
import AttachFileButton from "@/components/shared/AttachFileButton";

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "9px 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function DisciplineMineCard({ card, ar, draft, onDraft, onObject, onWithdraw }) {
  const [file, setFile] = useState(null);
  const ready = Boolean(String(draft || "").trim());
  return (
    <article style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", borderTop: `3px solid ${card.tone.accent}`, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, color: "var(--nv-ink)" }}>{card.mineTitle}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: card.tone.color, whiteSpace: "nowrap" }}>{card.mineState}</span>
      </div>
      <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>{card.mineLine}</span>
      {card.objectBlocked ? (
        <span style={{ fontSize: 11, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>{card.objectBlocked}</span>
      ) : null}
      {card.hasObjGate ? (
        <span style={{ fontSize: 11, color: "var(--nv-ink2)", background: "var(--nv-mute-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>{card.objGate}</span>
      ) : null}
      {card.canObject ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)", borderRadius: 10, padding: "11px 12px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-warn-ink)" }}>{ar ? "اعتراضي على هذا الجزاء" : "My objection to this sanction"}</span>
          <input
            value={draft}
            onChange={(event) => onDraft?.(event.target.value)}
            placeholder={ar ? "اكتب اعتراضك — يُحال إلى من لم يوقّع الجزاء" : "Write your objection — it goes to whoever did not sign"}
            style={field}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 10, color: "var(--nv-muted)" }}>{ar ? "أرفق مستنداً يسند اعتراضك — اختياري" : "Attach a document that supports your objection — optional"}</span>
            <AttachFileButton
              ar={ar}
              label={file ? (ar ? `المختار: ${file.name}` : `Chosen: ${file.name}`) : (ar ? "أرفق المستند" : "Attach the document")}
              onPick={setFile}
            />
            <span style={{ fontSize: 10, color: file ? "var(--nv-ok-ink)" : "var(--nv-muted)", lineHeight: 1.8 }}>
              {file
                ? (ar ? `مرفق: ${file.name}` : `Attached: ${file.name}`)
                : (ar ? "تُحسب بصمته على جهازك، ويُحال مع اعتراضك كما هو." : "Its hash is taken on your device, and it travels with your objection as it is.")}
            </span>
          </label>
          <button
            type="button"
            onClick={() => ready && onObject?.(card.item, file)}
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: "9px 13px",
              border: "none",
              background: ready ? "var(--nv-warn-fill)" : "var(--nv-line3)",
              color: ready ? "var(--nv-btn-ink)" : "var(--nv-muted)",
              cursor: ready ? "pointer" : "default",
              alignSelf: "flex-start",
              borderRadius: 10,
            }}
          >
            {ready ? (ar ? "أرسل الاعتراض" : "Send the objection") : (ar ? "اكتب اعتراضك أولاً" : "Write the objection first")}
          </button>
        </div>
      ) : null}
      {card.hasNews ? (
        <span style={{
          fontSize: 11,
          lineHeight: 1.9,
          padding: "9px 11px",
          color: card.newsColor || (card.item.rulingNote ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)"),
          background: card.newsBg || (card.item.rulingNote ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)"),
          border: `1px solid ${card.newsBorder || (card.item.rulingNote ? "var(--nv-ok-line)" : "var(--nv-warn-line)")}`,
          borderRadius: 10,
        }}
        >
          {card.news}
          {card.appealFile?.url ? (
            <>
              {" · "}
              <ConsentFileLink file={card.appealFile} ar={ar}>{ar ? "نزّل مرفق الاعتراض" : "Download the objection file"}</ConsentFileLink>
            </>
          ) : null}
        </span>
      ) : null}
      {card.canWithdraw ? (
        <button
          type="button"
          onClick={() => onWithdraw?.(card.item)}
          style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 12px", border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)", color: "var(--nv-ink2)", cursor: "pointer", alignSelf: "flex-start" }}
        >
          {ar ? "اسحب اعتراضي" : "Withdraw my objection"}
        </button>
      ) : null}
      <DisciplineRelatedLinks links={card.related} ar={ar} />
    </article>
  );
}
