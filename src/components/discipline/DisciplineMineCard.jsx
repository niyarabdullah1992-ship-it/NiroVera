import React, { useState } from "react";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import DisciplineRelatedLinks from "@/components/discipline/DisciplineRelatedLinks";
import AttachFileButton from "@/components/shared/AttachFileButton";

const field = {
  fontFamily: "inherit",
  fontSize: 14,
  height: 44,
  padding: "0 14px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-page)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const noteLine = {
  fontSize: 12.5,
  lineHeight: 1.7,
  padding: "10px 14px",
  color: "var(--nv-ink2)",
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
};

export default function DisciplineMineCard({ card, ar, draft, onDraft, onObject, onWithdraw }) {
  const [file, setFile] = useState(null);
  const ready = Boolean(String(draft || "").trim());
  const extra = card.objectBlocked || card.hasObjGate || card.hasNews || card.canWithdraw || (card.related || []).length;
  if (!card.canObject && !extra) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {card.objectBlocked ? (
        <span style={{ ...noteLine, color: "var(--nv-bad-ink)", borderColor: "var(--nv-bad-line)" }}>{card.objectBlocked}</span>
      ) : null}
      {card.hasObjGate ? (
        <span style={noteLine}>{card.objGate}</span>
      ) : null}
      {card.canObject ? (
        <article
          data-discipline-objection=""
          style={{
            maxWidth: 760,
            width: "100%",
            background: "var(--nv-card)",
            border: "1px solid var(--nv-line)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "var(--nv-paper)",
          }}
        >
          <header style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <strong style={{ fontSize: 17, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "اعتراضي على هذا الجزاء" : "My objection to this sanction"}</strong>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
                {ar ? "يُحال إلى من لم يوقّع الجزاء، ويُبتّ فيه خلال 15 يوماً (المادة 72)." : "It goes to whoever did not sign, and is decided within 15 days (Article 72)."}
              </span>
            </div>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              height: 28,
              padding: "0 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              flex: "none",
              color: ready ? "var(--nv-ok-ink)" : "var(--nv-ink2)",
              background: "transparent",
              border: `1px solid ${ready ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
            }}
            >
              {ready ? (ar ? "جاهز للإرسال" : "Ready to send") : (ar ? "اكتب اعتراضك أولاً" : "Write the objection first")}
            </span>
          </header>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "نص الاعتراض" : "Objection text"}</span>
              <input
                value={draft}
                onChange={(event) => onDraft?.(event.target.value)}
                placeholder={ar ? "اكتب اعتراضك ووقائعه" : "Write your objection and its facts"}
                style={field}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "مستند يسند الاعتراض — اختياري" : "A document that supports the objection — optional"}</span>
              <AttachFileButton
                ar={ar}
                label={file ? (ar ? `المختار: ${file.name}` : `Chosen: ${file.name}`) : (ar ? "أرفق المستند" : "Attach the document")}
                onPick={setFile}
              />
              <span style={{ fontSize: 11.5, color: file ? "var(--nv-ok-ink)" : "var(--nv-muted)", lineHeight: 1.7 }}>
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
                fontSize: 14,
                fontWeight: 700,
                height: 40,
                padding: "0 18px",
                border: "none",
                borderRadius: 8,
                background: ready ? "#3C7D50" : "var(--nv-line)",
                color: ready ? "var(--nv-btn-ink)" : "var(--nv-muted)",
                cursor: ready ? "pointer" : "default",
                alignSelf: "flex-start",
              }}
            >
              {ready ? (ar ? "أرسل الاعتراض" : "Send the objection") : (ar ? "اكتب اعتراضك أولاً" : "Write the objection first")}
            </button>
          </div>
        </article>
      ) : null}
      {card.hasNews ? (
        <span style={{ ...noteLine, color: "var(--nv-ink)", borderInlineStart: `3px solid ${card.item.rulingNote ? "var(--nv-ok-fill)" : "#C8A45A"}` }}>
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
          style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, height: 36, padding: "0 14px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", alignSelf: "flex-start" }}
        >
          {ar ? "اسحب اعتراضي" : "Withdraw my objection"}
        </button>
      ) : null}
      <DisciplineRelatedLinks links={card.related} ar={ar} />
    </div>
  );
}
