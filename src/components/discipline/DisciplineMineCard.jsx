import React, { useState } from "react";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import DisciplineRelatedLinks from "@/components/discipline/DisciplineRelatedLinks";
import AttachDropzone from "@/components/shared/AttachDropzone";
import { Checklist, FieldLabel, LawLine, SendButton, textareaStyle } from "@/components/discipline/DisciplineFormKit";

const noteLine = {
  fontSize: 12.5,
  lineHeight: 1.7,
  padding: "10px 14px",
  color: "var(--nv-ink2)",
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
};

/**
 * «اعتراضي على هذا الجزاء» (Art. 72) — the in-file objection on a signed sanction while its window is open.
 * It is the body of the grievance tile in «طلب جديد» when the picked sanction can still be objected to;
 * the send runs the page's appeal gate (checkAdvanceDisciplineGate "appeal") unchanged.
 */
export function DisciplineObjectionForm({ card, ar, draft, onDraft, onObject }) {
  const [file, setFile] = useState(null);
  const ready = Boolean(String(draft || "").trim());
  return (
    <div data-discipline-objection="" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <LawLine cite={ar ? "نظام العمل م72" : "Labour Law Art. 72"}>
        {ar ? "يُحال إلى من لم يوقّع الجزاء، ويُبتّ فيه كتابةً خلال 15 يوماً." : "It goes to whoever did not sign, and is decided in writing within 15 days."}
      </LawLine>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>{ar ? "اعتراضك ووقائعه" : "Your objection and its facts"}</FieldLabel>
        <textarea rows={3} value={draft} onChange={(event) => onDraft?.(event.target.value)} style={textareaStyle} />
      </label>
      <AttachDropzone
        ar={ar}
        file={file}
        label={ar ? "أرفق ما يسند الاعتراض" : "Attach a supporting document"}
        onPick={(picked) => setFile(picked || null)}
        onClear={() => setFile(null)}
      />
      <Checklist
        dataKey="objection"
        items={[
          { ok: true, text: ar ? "الجزاء موقَّع ومهلة الاعتراض مفتوحة" : "Signed, and the window is open" },
          { ok: ready, text: ar ? "الاعتراض مكتوب" : "The objection is written" },
        ]}
      />
      <SendButton ready={ready} onClick={() => onObject?.(card.item, file)}>
        {ar ? "أرسل الاعتراض" : "Send the objection"}
      </SendButton>
    </div>
  );
}

/** What sits under a sanction once it is opened: why objecting is closed, the ruling news, withdraw, related links. */
export default function DisciplineMineCard({ card, ar, onWithdraw }) {
  const extra = card.objectBlocked || card.hasObjGate || card.hasNews || card.canWithdraw || (card.related || []).length;
  if (!extra) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {card.objectBlocked ? (
        <span style={{ ...noteLine, color: "var(--nv-bad-ink)", borderColor: "var(--nv-bad-line)" }}>{card.objectBlocked}</span>
      ) : null}
      {card.hasObjGate ? (
        <span style={noteLine}>{card.objGate}</span>
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
