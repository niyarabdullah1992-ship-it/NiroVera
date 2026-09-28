import React from "react";
import { Loader2 } from "lucide-react";
import { BORDER, BRAND, CARD, INK, MUTED, SURFACE } from "@/lib/platformStyles";
import { signGhostBtn as ghostBtn, signMono as mono, signPrimaryBtn as primaryBtn } from "./signingUi";

export default function SigningFinishDialog({
  ar,
  mode,
  fileName,
  fieldCount,
  pageCount,
  signers,
  intent,
  readOk = true,
  seenCount = 0,
  unreadPage = null,
  onGoUnread,
  onIntentChange,
  busy,
  error,
  receipt,
  onConfirm,
  onClose,
}) {
  const group = mode === "group";
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,40,75,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 60,
      }}
    >
      <div
        dir={ar ? "rtl" : "ltr"}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "88vh",
          overflow: "auto",
          background: CARD,
          border: "1px solid var(--nv-line)",
          borderRadius: 14,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 30px 80px rgba(0,0,0,.35)",
        }}
      >
        {!receipt ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: INK }}>
                {group ? (ar ? "إرسال للتوقيع" : "Send for signature") : (ar ? "إنهاء التوقيع؟" : "Finish signing?")}
              </span>
              <span style={{ fontSize: 12, color: MUTED }}>
                {ar
                  ? `${fieldCount} حقول على ${pageCount} صفحات · ${fileName}`
                  : `${fieldCount} fields across ${pageCount} pages · ${fileName}`}
              </span>
            </div>

            {group ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {signers.map((signer, index) => (
                  <div key={signer.key || index} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 10px" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: signer.color, flex: "none" }} />
                    <span style={{ fontSize: 13, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signer.name}</span>
                    <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED }}>{signer.fieldCount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: readOk ? "pointer" : "default", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, opacity: readOk ? 1 : 0.55 }}>
                <input
                  type="checkbox"
                  checked={intent && readOk}
                  disabled={!readOk}
                  onChange={(event) => readOk && onIntentChange(event.target.checked)}
                  style={{ marginTop: 3, accentColor: BRAND }}
                />
                <span style={{ lineHeight: 1.7, fontSize: 13, color: INK }}>
                  {ar
                    ? (readOk
                      ? "أقرّ بأنني راجعت المستند بالكامل، وأنّ وضع هذا الختم يعبّر عن نيّتي في التوقيع، وفق نظام التعاملات الإلكترونية."
                      : `تصفّح كل الصفحات قبل الإنهاء — ${seenCount} من ${pageCount}.`)
                    : (readOk
                      ? "I confirm that I reviewed the whole document and that placing this seal expresses my intent to sign, under the Electronic Transactions Law."
                      : `Go through every page first — acknowledgement unlocks after the read (${seenCount} of ${pageCount}).`)}
                </span>
              </label>
            )}
            {!group && !readOk && unreadPage && onGoUnread ? (
              <button type="button" onClick={onGoUnread} style={{ ...ghostBtn, alignSelf: "flex-start" }}>
                {ar ? `اذهب إلى الصفحة ${unreadPage}` : `Go to page ${unreadPage}`}
              </button>
            ) : null}

            <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
              {group
                ? (ar
                  ? "يُرسَل رابط خاص لكل موقّع. لا ترتيب: أي طرف يوقّع أولًا أو ثانيًا أو ثالثًا. البصمة تُثبَّت في سجل الشركة بعد إغلاق مهلة التراجع — ليست شهادة حكومية مؤهلة."
                  : "Each signer gets a private link. No queue: any party may sign first, second, or third. The fingerprint registers after retract windows close — not a qualified government certificate.")
                : (ar
                  ? "يُدمج الختم في PDF، تُحسب بصمة SHA-256، ويُسجَّل رقم التحقق في سجل الشركة. ليست شهادة حكومية مؤهلة؛ التحقق بمطابقة الملف مع السجل."
                  : "The seal is merged into the PDF, a SHA-256 fingerprint is computed, and the verification id is written to the company registry. Not a qualified government certificate — verification matches the file to the registry.")}
            </p>

            {error ? <p style={{ margin: 0, fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.6 }}>{error}</p> : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy || (!group && (!intent || !readOk))}
                style={{ ...primaryBtn, opacity: busy || (!group && !intent) ? 0.45 : 1 }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {group
                  ? (busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال الطلبات" : "Send requests"))
                  : (busy ? (ar ? "جارٍ الختم…" : "Sealing…") : (ar ? "إنهاء وتوقيع" : "Finish and sign"))}
              </button>
              <button type="button" onClick={onClose} disabled={busy} style={{ ...ghostBtn, opacity: busy ? 0.5 : 1 }}>
                {ar ? "رجوع" : "Back"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: receipt.kind === "group" ? INK : (receipt.registry === "none" ? "var(--nv-warn-ink)" : BRAND) }}>
                {receipt.kind === "group"
                  ? (ar ? "أُرسل الملف — الطلب في الحالة" : "File sent — request is on Status")
                  : receipt.registry === "company"
                    ? (ar ? "✓ مسجّل في سجل الشركة" : "✓ Registered in the company registry")
                    : receipt.registry === "local"
                      ? (ar ? "✓ مختوم · مسجّل على هذا الجهاز" : "✓ Sealed · registered on this device")
                      : (ar ? "مختوم · غير مسجّل" : "Sealed · not registered")}
              </span>
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                {receipt.kind === "group"
                  ? (ar
                    ? "التوقيع متوازٍ بلا ترتيب. يبقى الطلب في الحالة حتى يجيب الأطراف ويمرّر المنشئ التوقيع، ثم يُتاح التنزيل ويصل إشعار الاكتمال."
                    : "Signing is parallel — no queue. The request stays on Status until retract windows close, then the fingerprint registers.")
                  : receipt.registryNote
                    || (ar ? "تم دمج الختم وحساب البصمة." : "The seal was merged and the fingerprint computed.")}
              </span>
            </div>

            {receipt.kind === "group" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  dir="ltr"
                  style={{
                    border: `1px solid ${BORDER}`,
                    background: SURFACE,
                    padding: "12px 14px",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "6px 14px",
                    ...mono,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: MUTED }}>STATE</span>
                  <span style={{ color: "var(--nv-warn-ink)", fontWeight: 500 }}>PENDING · parallel</span>
                  <span style={{ color: MUTED }}>SHA-256</span>
                  <span style={{ color: MUTED }}>{ar ? "يُثبَّت بعد إغلاق المهلة" : "Registers after cooling closes"}</span>
                  <span style={{ color: MUTED }}>REF</span>
                  <span style={{ color: INK }}>{receipt.verificationId || "—"}</span>
                  <span style={{ color: MUTED }}>CREATED</span>
                  <span style={{ color: INK }}>{receipt.createdAt || "—"}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
                  {ar
                    ? "ليست شهادة حكومية مؤهلة. التحقق بمطابقة الملف مع سجل الشركة بعد إغلاق المهلة."
                    : "Not a qualified government certificate. Verification matches the file against the company registry after cooling closes."}
                </p>
                {receipt.local ? (
                  <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
                    {ar ? "المعاينة المحلية لا ترسل بريدًا — انسخ الرابط لكل موقّع." : "Local preview does not send email — copy each signer’s link."}
                  </p>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(receipt.links || []).map((link) => (
                    <div key={link.email || link.url} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 10px", background: SURFACE, display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 12, color: INK }}>{link.name}</span>
                      <span dir="ltr" style={{ ...mono, fontSize: 10, color: MUTED, wordBreak: "break-all" }}>{link.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                dir="ltr"
                style={{
                  border: `1px solid ${receipt.registry === "company" ? BRAND : BORDER}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "6px 14px",
                  ...mono,
                  fontSize: 12,
                  background: receipt.registry === "company"
                    ? "color-mix(in oklab, var(--nv-accent, #1E9E63) 6%, var(--nv-card, #fff))"
                    : SURFACE,
                }}
              >
                <span style={{ color: MUTED }}>REF</span>
                <span style={{ fontWeight: 500, color: INK }}>{receipt.verificationId}</span>
                <span style={{ color: MUTED }}>SHA-256</span>
                <span style={{ wordBreak: "break-all", color: INK }}>{receipt.fileHash}</span>
                <span style={{ color: MUTED }}>DATE</span>
                <span style={{ color: INK }}>{receipt.date}</span>
              </div>
            )}
            {receipt.kind !== "group" ? (
              <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
                {ar
                  ? "ليست شهادة حكومية مؤهلة. التحقق بمطابقة الملف مع سجل الشركة."
                  : "Not a qualified government certificate. Verification matches the file against the company registry."}
              </p>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {receipt.downloadUrl ? (
                <a href={receipt.downloadUrl} download={receipt.downloadName} style={{ ...primaryBtn, textDecoration: "none" }}>
                  {ar ? `تنزيل ${receipt.downloadName}` : `Download ${receipt.downloadName}`}
                </a>
              ) : null}
              {receipt.verifyUrl ? (
                <a href={receipt.verifyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: BRAND }}>
                  {ar ? "صفحة التحقق العامة" : "Public verify page"}
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                style={receipt.kind === "group" ? primaryBtn : { ...ghostBtn, marginInlineStart: "auto" }}
              >
                {receipt.kind === "group" ? (ar ? "عرض الحالة" : "View status") : (ar ? "إغلاق" : "Close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
