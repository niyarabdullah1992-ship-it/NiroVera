import React from "react";
import { Loader2 } from "lucide-react";
import { BORDER, BRAND, CARD, INK, MUTED, SURFACE } from "@/lib/platformStyles";
import { signGhostBtn as ghostBtn, signMono as mono, signPrimaryBtn as primaryBtn } from "./signingUi";
import NvIcon from "@/components/shared/NvIcon";

const pad2 = (n) => String(n).padStart(2, "0");
/** «2026/10/18 · 13:55» in Riyadh time — Latin digits, one order, no mixed-direction locale string. */
function riyadhStamp(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const r = new Date(d.getTime() + 3 * 3600 * 1000);
  return `${r.getUTCFullYear()}/${pad2(r.getUTCMonth() + 1)}/${pad2(r.getUTCDate())} · ${pad2(r.getUTCHours())}:${pad2(r.getUTCMinutes())}`;
}
const initials = (name) => String(name || "").trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("");

/**
 * «إيصال الإرسال» — the sent envelope as an institutional receipt: a dark head with the reference, a ledger of
 * state · order · created · fingerprint in Arabic labels, then one row per signer with his link to copy.
 */
function GroupReceipt({ ar, receipt, orderMode }) {
  const [copied, setCopied] = React.useState("");
  const copy = async (url) => {
    try { await navigator.clipboard?.writeText(url); setCopied(url); setTimeout(() => setCopied(""), 1600); } catch { /* the field stays selectable */ }
  };
  const seq = orderMode === "sequential";
  const created = riyadhStamp(receipt.createdAtIso) || receipt.createdAt || "—";
  const rows = [
    [ar ? "الحالة" : "State", <span key="s" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--nv-warn-ink)", fontWeight: 700 }}><span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />{ar ? "بانتظار التوقيع" : "Awaiting signatures"}</span>],
    [ar ? "الترتيب" : "Order", ar ? (seq ? "بالتسلسل — يُذكَّر صاحب الدور" : "بالتوازي — يوقّع الجميع معاً") : (seq ? "Sequential — the one whose turn it is is reminded" : "Parallel — everyone signs at once")],
    [ar ? "تاريخ الإنشاء" : "Created", <span key="c" dir="ltr" style={{ ...mono }}>{created}</span>],
    [ar ? "بصمة SHA-256" : "SHA-256", <span key="h" style={{ color: MUTED }}>{ar ? "تُثبَّت بعد اكتمال التوقيع وإغلاق المهلة" : "Registers once signing completes and the window closes"}</span>],
  ];
  return (
    <div data-group-receipt="1" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", background: CARD }}>
        <div style={{ background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <NvIcon name="check" size={17} strokeWidth={2} inline={false} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: 15.5, fontWeight: 700 }}>{ar ? "أُرسل الطلب للتوقيع" : "Sent for signature"}</strong>
            <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>{ar ? "إيصال الإرسال · يبقى الطلب في «الحالة» حتى يكتمل" : "Dispatch receipt · the request stays on Status until complete"}</span>
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "none" }}>
            <span style={{ fontSize: 10.5, color: "#A9CDB8" }}>{ar ? "رقم المرجع" : "Reference"}</span>
            <span dir="ltr" style={{ ...mono, fontSize: 12.5, fontWeight: 700, letterSpacing: ".02em" }}>{receipt.verificationId || "—"}</span>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, auto) 1fr" }}>
          {rows.map(([label, value], i) => (
            <React.Fragment key={i}>
              <span style={{ padding: "10px 16px", fontSize: 12, color: MUTED, borderTop: i ? `1px solid ${BORDER}` : "none", background: SURFACE }}>{label}</span>
              <span style={{ padding: "10px 16px", fontSize: 12.5, color: INK, borderTop: i ? `1px solid ${BORDER}` : "none", lineHeight: 1.6 }}>{value}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ fontSize: 13, color: INK }}>{ar ? `الموقّعون (${(receipt.links || []).length})` : `Signers (${(receipt.links || []).length})`}</strong>
          {receipt.local ? <span style={{ fontSize: 11, color: MUTED }}>{ar ? "المعاينة لا ترسل بريداً — انسخ رابط كل موقّع" : "Preview sends no email — copy each link"}</span> : null}
        </span>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          {(receipt.links || []).map((link, i) => (
            <div key={link.email || link.url} data-receipt-signer={link.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i ? `1px solid ${BORDER}` : "none", background: CARD }}>
              {seq ? <span dir="ltr" style={{ ...mono, width: 20, fontSize: 11, color: MUTED, textAlign: "center", flex: "none" }}>{i + 1}</span> : null}
              <span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#0B3D27", background: "var(--nv-ok-soft, #EAF4EE)", border: "1px solid var(--nv-ok-line, #BFE6D2)" }}>{initials(link.name)}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{link.name}</span>
                <span dir="ltr" title={link.url} style={{ ...mono, fontSize: 10.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: ar ? "right" : "left" }}>{link.email && link.email.includes("@") ? link.email : link.url}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--nv-warn-ink)", fontWeight: 600, flex: "none" }}>{ar ? "بانتظار" : "Pending"}</span>
              <button type="button" data-copy-link={link.email} onClick={() => copy(link.url)} style={{ ...ghostBtn, height: 30, padding: "0 10px", fontSize: 11.5, flex: "none" }}>
                {copied === link.url ? (ar ? "نُسخ" : "Copied") : (ar ? "انسخ الرابط" : "Copy link")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.7, display: "flex", gap: 6, alignItems: "baseline" }}>
        <NvIcon name="lock" size={12} />
        <span>{ar ? "توقيع إلكتروني موثّق بسجل المنشأة، وليس شهادة حكومية مؤهلة. يُتحقق منه بمطابقة الملف مع سجل الشركة بعد اكتمال التوقيع." : "An electronic signature evidenced by the company registry, not a qualified government certificate. Verified by matching the file to the registry once signing completes."}</span>
      </p>
    </div>
  );
}

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
  orderMode = "parallel",
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
                ? (orderMode === "sequential"
                  ? (ar
                    ? "يُرسَل رابط خاص لكل موقّع. الترتيب محفوظ على المظروف ويظهر لكل طرف، والتذكير يذهب لصاحب الدور؛ ويبقى لأي طرف معلّق أن يوقّع من رابطه. البصمة تُثبَّت في سجل الشركة بعد إغلاق مهلة التراجع — ليست شهادة حكومية مؤهلة."
                    : "Each signer gets a private link. The order is stored and shown, and reminders go to whoever's turn it is; any pending party can still sign from their link. The fingerprint registers after retract windows close — not a qualified government certificate.")
                  : (ar
                    ? "يُرسَل رابط خاص لكل موقّع. بالتوازي: أي طرف يوقّع أولًا أو ثانيًا أو ثالثًا. البصمة تُثبَّت في سجل الشركة بعد إغلاق مهلة التراجع — ليست شهادة حكومية مؤهلة."
                    : "Each signer gets a private link. In parallel: any party may sign first, second, or third. The fingerprint registers after retract windows close — not a qualified government certificate."))
                : (ar
                  ? "يُدمج الختم في PDF، تُحسب بصمة SHA-256، ويُسجَّل رقم التحقق في سجل الشركة. ليست شهادة حكومية مؤهلة؛ التحقق بمطابقة الملف مع السجل."
                  : "The seal is merged into the PDF, a SHA-256 fingerprint is computed, and the verification id is written to the company registry. Not a qualified government certificate — verification matches the file to the registry.")}
            </p>

            {error ? <p style={{ margin: 0, fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.6 }}>{error}</p> : null}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                data-finish-confirm="1"
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
            <div style={{ display: receipt.kind === "group" ? "none" : "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: receipt.kind === "group" ? INK : (receipt.registry === "none" ? "var(--nv-warn-ink)" : BRAND) }}>
                {receipt.kind === "group"
                  ? (ar ? "أُرسل الملف — الطلب في الحالة" : "File sent — request is on Status")
                  : receipt.registry === "company"
                    ? <><NvIcon name="check" size={15} strokeWidth={2} /> {ar ? "مسجّل في سجل الشركة" : "Registered in the company registry"}</>
                    : receipt.registry === "local"
                      ? <><NvIcon name="check" size={15} strokeWidth={2} /> {ar ? "مختوم · مسجّل على هذا الجهاز" : "Sealed · registered on this device"}</>
                      : (ar ? "مختوم · غير مسجّل" : "Sealed · not registered")}
              </span>
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                {receipt.kind === "group"
                  ? (ar
                    ? (orderMode === "sequential" ? "الترتيب محفوظ ويُذكَّر صاحب الدور. يبقى" : "التوقيع بالتوازي. يبقى")+" الطلب في الحالة حتى يجيب الأطراف ويمرّر المنشئ التوقيع، ثم يُتاح التنزيل ويصل إشعار الاكتمال."
                    : (orderMode === "sequential" ? "The order is stored; reminders go to whoever's turn it is. " : "Signing is parallel. ") + "The request stays on Status until retract windows close, then the fingerprint registers.")
                  : receipt.registryNote
                    || (ar ? "تم دمج الختم وحساب البصمة." : "The seal was merged and the fingerprint computed.")}
              </span>
            </div>

            {receipt.kind === "group" ? (
              <GroupReceipt ar={ar} receipt={receipt} orderMode={orderMode} />
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
