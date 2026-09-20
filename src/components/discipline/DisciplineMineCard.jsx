import React, { useState } from "react";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import DisciplineRelatedLinks from "@/components/discipline/DisciplineRelatedLinks";

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "9px 10px",
  border: "1px solid #DFE3EA",
  borderRadius: 10,
  background: "#fff",
  color: "#14213D",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function DisciplineMineCard({ card, ar, draft, onDraft, onObject, onWithdraw }) {
  const [file, setFile] = useState(null);
  const ready = Boolean(String(draft || "").trim());
  return (
    <article style={{ padding: "14px 20px", borderBottom: "1px solid #F7F8FA", borderTop: `3px solid ${card.tone.accent}`, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, color: "#14213D" }}>{card.mineTitle}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: card.tone.color, whiteSpace: "nowrap" }}>{card.mineState}</span>
      </div>
      <span style={{ fontSize: 11, color: "#3C4657", lineHeight: 1.9 }}>{card.mineLine}</span>
      {card.objectBlocked ? (
        <span style={{ fontSize: 11, color: "#8A1C2B", background: "#FBF1F2", border: "1px solid #E9C4C9", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>{card.objectBlocked}</span>
      ) : null}
      {card.hasObjGate ? (
        <span style={{ fontSize: 11, color: "#4B5567", background: "#F5F6F8", border: "1px solid #DFE3EA", borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>{card.objGate}</span>
      ) : null}
      {card.canObject ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, background: "#FFFDF8", border: "1px solid #ECD9A8", borderRadius: 10, padding: "11px 12px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#8A6516" }}>{ar ? "اعتراضي على هذا الجزاء" : "My objection to this sanction"}</span>
          <input
            value={draft}
            onChange={(event) => onDraft?.(event.target.value)}
            placeholder={ar ? "اكتب اعتراضك — يُحال إلى من لم يوقّع الجزاء" : "Write your objection — it goes to whoever did not sign"}
            style={field}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 10, color: "#6B7280" }}>{ar ? "أرفق مستنداً يسند اعتراضك — اختياري" : "Attach a document that supports your objection — optional"}</span>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              style={{ fontFamily: "inherit", fontSize: 11, padding: "8px 9px", border: "1px dashed #C7CCD6", background: "#fff", color: "#4B5567", outline: "none", width: "100%", boxSizing: "border-box" }}
            />
            <span style={{ fontSize: 10, color: file ? "#137A49" : "#6B7280", lineHeight: 1.8 }}>
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
              background: ready ? "#8A6516" : "#EEF0F4",
              color: ready ? "#fff" : "#6B7280",
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
          color: card.newsColor || (card.item.rulingNote ? "#137A49" : "#8A6516"),
          background: card.newsBg || (card.item.rulingNote ? "#F2FAF6" : "#FDF6E8"),
          border: `1px solid ${card.newsBorder || (card.item.rulingNote ? "#BFE6D2" : "#ECD9A8")}`,
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
          style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 12px", border: "1px solid #DFE3EA", borderRadius: 10, background: "#fff", color: "#4B5567", cursor: "pointer", alignSelf: "flex-start" }}
        >
          {ar ? "اسحب اعتراضي" : "Withdraw my objection"}
        </button>
      ) : null}
      <DisciplineRelatedLinks links={card.related} ar={ar} />
    </article>
  );
}
