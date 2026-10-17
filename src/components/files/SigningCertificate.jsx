import React, { useEffect, useState } from "react";
import { certificateFacts } from "@/lib/signingEnvelopes";
import { verificationUrlFor } from "@/lib/verificationBadge";
import { mono } from "@/components/schedules/scheduleChrome";

/**
 * «شهادة الإكمال» — what the company registry can prove about a closed envelope: the SHA-256
 * fingerprint, the verification id, when it was sent and closed, who signed and when, the
 * location when the signer's device shared one, and the public verify link with its QR.
 * Nothing here is computed on screen; every line is read from the stored request.
 */
function stampOf(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // Mono Latin digits in Riyadh time, 24h — no ص/م marks to break the direction.
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(",", "");
}

function useQr(text) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    if (!text) { setSrc(""); return undefined; }
    import("qrcode")
      .then((mod) => (mod.toDataURL || mod.default?.toDataURL)(text, { width: 168, margin: 1, errorCorrectionLevel: "M", color: { dark: "#14284B", light: "#FFFFFF" } }))
      .then((url) => { if (live) setSrc(url || ""); })
      .catch(() => { if (live) setSrc(""); });
    return () => { live = false; };
  }, [text]);
  return src;
}

const label = { fontSize: 11.5, color: "var(--nv-muted)", whiteSpace: "nowrap" };
const cell = { fontSize: 12, color: "var(--nv-ink)", minWidth: 0, overflowWrap: "anywhere" };

export default function SigningCertificate({ request, ar = true, onCopy, copied = false }) {
  const facts = certificateFacts(request);
  const verifyUrl = facts.ready && facts.verificationId ? verificationUrlFor(facts.verificationId) : "";
  const qr = useQr(verifyUrl);
  return (
    <section data-signing-certificate={facts.ready ? "ready" : "pending"} style={{ border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-card)", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--nv-line2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13 }}>{ar ? "شهادة الإكمال" : "Certificate of completion"}</strong>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "توقيع آمن · بصمة التراث" : "Secure Sign · heritage fingerprint"}</span>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <dl style={{ margin: 0, flex: "1 1 240px", minWidth: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "6px 12px" }}>
          <dt style={label}>{ar ? "البصمة SHA-256" : "SHA-256"}</dt>
          <dd dir="ltr" style={{ ...cell, ...mono, margin: 0, fontSize: 11, textAlign: ar ? "right" : "left" }}>
            {facts.hash || (ar ? "تُثبَّت عند الإكمال" : "Registers on completion")}
          </dd>
          <dt style={label}>{ar ? "رقم التحقق" : "Verification id"}</dt>
          <dd dir="ltr" style={{ ...cell, ...mono, margin: 0, textAlign: ar ? "right" : "left" }}>{facts.verificationId || "—"}</dd>
          <dt style={label}>{ar ? "أُرسل" : "Sent"}</dt>
          <dd dir="ltr" style={{ ...cell, ...mono, margin: 0, textAlign: ar ? "right" : "left" }}>{stampOf(facts.createdAt, ar)}</dd>
          <dt style={label}>{ar ? "أُغلق" : "Closed"}</dt>
          <dd dir="ltr" style={{ ...cell, ...mono, margin: 0, textAlign: ar ? "right" : "left" }}>{stampOf(facts.completedAt, ar)}</dd>
        </dl>
        {qr ? (
          <a href={verifyUrl} target="_blank" rel="noreferrer" aria-label={ar ? "رابط التحقق العام" : "Public verify link"} style={{ flex: "none", lineHeight: 0, border: "1px solid var(--nv-line)", borderRadius: 8, padding: 4, background: "#fff" }}>
            <img src={qr} alt="" width={84} height={84} />
          </a>
        ) : null}
      </div>
      <div style={{ borderTop: "1px solid var(--nv-line2)" }}>
        {facts.signers.map((row) => (
          <div key={`${row.email}-${row.name}`} style={{ padding: "7px 12px", borderBottom: "1px solid var(--nv-line2)", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)" }}>{row.name}</span>
            <span dir="ltr" style={{ ...mono, fontSize: 11, color: "var(--nv-muted)", unicodeBidi: "isolate" }}>{row.email}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: row.status === "signed" ? "var(--nv-ink2)" : "var(--nv-muted)" }}>
              {row.status === "signed" ? (ar ? "وقّع" : "Signed") : row.status === "rejected" ? (ar ? "رفض" : "Refused") : row.status === "skipped" ? (ar ? "دون توقيع" : "Unsigned") : (ar ? "لم يُجب" : "No answer")}
            </span>
            <span dir="ltr" style={{ ...mono, fontSize: 11, color: "var(--nv-ink)" }}>{stampOf(row.at, ar)}</span>
            {row.location ? (
              <span dir="ltr" style={{ ...mono, fontSize: 10.5, color: "var(--nv-muted)", flexBasis: "100%", textAlign: ar ? "right" : "left" }}>
                {`${Number(row.location.lat).toFixed(3)}, ${Number(row.location.lng).toFixed(3)}`}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--nv-muted)", flexBasis: "100%" }}>{ar ? "لا موقع مسجّل" : "No location recorded"}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {verifyUrl ? (
          <>
            <a href={verifyUrl} target="_blank" rel="noreferrer" dir="ltr" style={{ ...mono, fontSize: 11, color: "var(--nv-ok-ink)", overflowWrap: "anywhere" }}>{verifyUrl.replace(/^https?:\/\//, "")}</a>
            {onCopy ? (
              <button type="button" onClick={() => onCopy("verify", verifyUrl)} style={{ fontFamily: "inherit", height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 11.5, cursor: "pointer" }}>
                {copied ? (ar ? "نُسخ" : "Copied") : (ar ? "انسخ الرابط" : "Copy link")}
              </button>
            ) : null}
          </>
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "رابط التحقق العام يظهر بعد تثبيت البصمة." : "The public verify link appears once the fingerprint registers."}</span>
        )}
      </div>
    </section>
  );
}
