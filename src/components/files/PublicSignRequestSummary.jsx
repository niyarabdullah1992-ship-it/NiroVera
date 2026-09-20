import React from "react";
import PublicSignParties from "@/components/files/PublicSignParties";
import SigningAuditTrail from "@/components/files/SigningAuditTrail";
import { signKicker, signPrimaryBtn, signProofGrid } from "@/components/files/signingUi";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { isMarkField } from "@/lib/signPdf";

function fieldLabel(field, ar) {
  if (isMarkField(field)) return ar ? "خانة صح / خطأ" : "Tick or cross";
  if (field.type === "text") return field.label || (ar ? "حقل نص" : "Text field");
  return ar ? "التوقيع" : "Signature";
}

export default function PublicSignRequestSummary({ ar, info, onContinue, onFocusPage }) {
  const expiry = info.expiresAt
    ? new Date(info.expiresAt).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const fields = info.signer?.spots || (info.signer?.spot ? [info.signer.spot] : []);
  const rows = [
    [ar ? "المرسل" : "From", info.creatorName],
    [ar ? "صلاحية الرابط" : "Link valid until", expiry],
    [ar ? "المرجع" : "Reference", info.verificationId || "—"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={signKicker}>{ar ? "الطلب" : "Request"}</span>
        <span style={{ fontSize: 15, fontWeight: 650, color: NAVY }}>{ar ? "راجع ثم وقّع" : "Review, then sign"}</span>
        <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.7, color: MUTED }}>
          {ar
            ? "التوقيع متوازٍ — لا تنتظر طرفاً آخر. حالتك وحالة الباقين ظاهرة هنا."
            : "Signing is parallel — you do not wait for another party. Your status and theirs are listed here."}
        </p>
      </div>

      <div style={{ ...signProofGrid, margin: 16, borderRadius: 12 }}>
        {rows.map(([key, value]) => (
          <React.Fragment key={key}>
            <span style={{ color: MUTED }}>{key}</span>
            <span style={{ color: NAVY, fontWeight: 500, overflowWrap: "anywhere" }}>{value || "—"}</span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <PublicSignParties ar={ar} info={info} />
        {info.auditTrail?.length ? <SigningAuditTrail events={info.auditTrail} ar={ar} open /> : null}
      </div>

      {fields.length ? (
        <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ ...signKicker, padding: "0 8px" }}>{ar ? "حقولك" : "Your fields"}</span>
          {fields.map((field, index) => (
            <button
              key={field.id || index}
              type="button"
              onClick={() => onFocusPage?.(field.page || 1)}
              style={{
                fontFamily: "inherit",
                textAlign: "start",
                padding: "9px 11px",
                borderRadius: 9,
                border: "1px solid transparent",
                background: "transparent",
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: "20px minmax(0, 1fr) auto",
                gap: 10,
                alignItems: "center",
                color: NAVY,
              }}
            >
              <span style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${BORDER}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>{index + 1}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13 }}>{fieldLabel(field, ar)}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "حدّده المرسل" : "Placed by sender"}</span>
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED }}>{ar ? `ص ${field.page || 1}` : `p${field.page || 1}`}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: "auto", padding: 16, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, padding: 10, borderRadius: 12, background: SURFACE, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
          {ar
            ? "رفضك الصريح لا يوقف الباقين. البصمة تُحفظ في سجل الشركة — ليست شهادة حكومية."
            : "An explicit refusal does not stop the others. The fingerprint stays in the company registry — not a government certificate."}
        </p>
        {onContinue ? (
        <button type="button" onClick={onContinue} style={{ ...signPrimaryBtn, width: "100%" }}>
          {ar ? "متابعة للتوقيع" : "Continue to sign"}
        </button>
        ) : null}
      </div>
    </div>
  );
}
