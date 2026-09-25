import React, { useRef, useState } from "react";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import { consentRowHref, consentSealFace, consentStatus, consentTopicMeta } from "@/lib/writtenConsent";
import { BORDER, BRAND, CARD, INK, MUTED, NAVY } from "@/lib/platformStyles";
import AttachFileButton from "@/components/shared/AttachFileButton";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

const GRID = "minmax(200px, 2.2fr) minmax(0, 1.2fr) 140px 118px";
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

function stamp(value, ar) {
  return value
    ? new Date(value).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
      timeZone: "Asia/Riyadh",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "—";
}

export default function ConsentSignRow({
  item,
  ar,
  party,
  canAct = false,
  onPaper,
  onAccept,
  onRefuse,
  paperBusy,
  glow = "off",
}) {
  const face = consentSealFace(item, ar);
  const open = consentStatus(item) === "open";
  const file = item.senderFile;
  const paper = item.paper;
  const fileName = file?.name || (ar ? item.titleAr : item.titleEn);
  const [ack, setAck] = useState(false);
  const paperRef = useRef(null);
  const href = consentRowHref(item);
  const topic = consentTopicMeta(item.topic);
  const article = item.article || topic.article;
  const decisionId = item.decisionId || topic.decisionId;

  return (
    <div id={`consent-${item.id}`} style={{ borderBottom: "1px solid #F1F5F9" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          gap: 16,
          padding: "13px 18px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "30px minmax(0, 1fr)", gap: 11, alignItems: "center", minWidth: 0 }}>
          <span style={{ width: 30, height: 38, border: `1px solid ${BORDER}`, borderRadius: 3, background: CARD, display: "inline-flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 8, color: MUTED, flexShrink: 0 }}>
            {ar ? "ملف" : "PDF"}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <a href={href} style={{ fontSize: 13, fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: "none" }}>{fileName}</a>
            <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED, textAlign: ar ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {face.ref || item.citeAr || item.requestedBy || "—"}
            </span>
          </span>
        </div>

        <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {party || item.requestedBy || item.employee?.name || "—"}
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: face.tone, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: open ? BRAND : face.tone, flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{face.label}</span>
        </span>

        <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED, textAlign: ar ? "right" : "left" }}>
          {stamp(item.answeredAt || item.createdAt, ar)}
        </span>
      </div>
      <div style={{ padding: "0 18px 12px" }}>
        <LaborArticleCite
          article={article}
          decisionId={decisionId}
          productOnly={!article && !decisionId}
          ar={ar}
          showOfficial
          entitlement={item.topic === "night" || item.topic === "ot"}
          glow={glow}
        />
      </div>

      {open ? (
        <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <ConsentFileLink file={file} ar={ar}>
              {ar ? "نزّل الملف المصدر" : "Download the source file"}
            </ConsentFileLink>
            {paper?.name ? (
              <ConsentFileLink file={paper} ar={ar}>
                {ar ? `النسخة المرفوعة: ${paper.name}` : `Uploaded copy: ${paper.name}`}
              </ConsentFileLink>
            ) : null}
          </span>
          {canAct ? (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "ارفع النسخة الموقّعة على هذا الطلب" : "Upload the signed copy on this request"}</span>
                <AttachFileButton
                  ref={paperRef}
                  ar={ar}
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  busy={paperBusy}
                  label={ar ? "أرفق النسخة الموقّعة" : "Attach the signed copy"}
                  onPick={onPaper}
                />
                {paperBusy ? <span style={{ fontSize: 10, color: MUTED }}>{ar ? "جارٍ رفع النسخة…" : "Uploading the copy…"}</span> : null}
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: NAVY, lineHeight: 1.7, cursor: "pointer" }}>
                <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} style={{ marginTop: 2 }} />
                <span>{ar ? "أقرّ بأنني كتبت موافقة خطية ووقّعت الملف في قسم التوقيع وأرفع النسخة هنا." : "I acknowledge that I wrote a written consent, signed the file in Digital signing, and upload the copy here."}</span>
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={paperBusy || !paper?.name || !ack}
                  onClick={() => onAccept?.({ ack, paper })}
                  style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "7px 11px", border: "none", background: paper?.name && ack ? "#137a49" : "#eef0f4", color: paper?.name && ack ? "#fff" : MUTED, cursor: paper?.name && ack ? "pointer" : "default" }}
                >
                  {ar ? "اعتماد" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={paperBusy}
                  onClick={() => onRefuse?.({})}
                  style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "7px 11px", border: "1px solid #e9c4c9", background: CARD, color: "#8a1c2b", cursor: "pointer" }}
                >
                  {ar ? "أرفض مباشرة" : "Refuse directly"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : file?.url || paper?.url ? (
        <div style={{ padding: "0 18px 12px", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ConsentFileLink file={file} ar={ar} />
          {paper?.url ? <ConsentFileLink file={paper} ar={ar}>{ar ? "نزّل النسخة الموقّعة" : "Download the signed copy"}</ConsentFileLink> : null}
        </div>
      ) : null}
    </div>
  );
}
