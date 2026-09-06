import React, { useState, useRef } from "react";
import { ShieldCheck, ShieldX, ShieldQuestion } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PowerCareUploadZone from "@/components/files/PowerCareUploadZone";
import SigningPanel from "@/components/files/SigningPanel";
import { sha256HexOfFile } from "@/lib/fileHash";
import { field, SURFACE } from "@/lib/platformStyles";

export default function VerifyDocumentCard({ ar, initialId = "" }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [verId, setVerId] = useState(initialId);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChecking(true);
    setResult(null);
    try {
      const fileHash = await sha256HexOfFile(file);
      const res = await base44.functions.invoke("signedDocs", {
        action: "verify",
        fileHash,
        verificationId: verId.trim() || null,
      });
      setResult({ ...res.data, fileName: file.name });
    } catch {
      setResult({ status: "error" });
    } finally {
      setChecking(false);
      e.target.value = "";
    }
  };

  return (
    <SigningPanel
      icon={ShieldCheck}
      title={ar ? "مطابقة البصمة" : "Match the fingerprint"}
      hint={ar
        ? "ارفع الملف الموقّع أو أدخل رقم التحقق. أي تعديل بعد التوقيع يُكشف."
        : "Upload the signed file or enter the verification id. Any change after signing is detected."}
    >
      <input
        value={verId}
        onChange={(e) => setVerId(e.target.value)}
        dir="ltr"
        placeholder={ar ? "PWC-XXXX-XXXX-XXXX (اختياري)" : "PWC-XXXX-XXXX-XXXX (optional)"}
        style={{ ...field, background: SURFACE, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}
      />
      <div style={{ marginTop: 10 }}>
        <PowerCareUploadZone
          inputRef={fileRef}
          accept="application/pdf,.pdf"
          onFileChange={handleFile}
          loading={checking}
          compact
          title={checking ? (ar ? "جارٍ الفحص…" : "Checking…") : (ar ? "رفع الملف للتحقق" : "Upload file to verify")}
          description={ar ? "PDF موقّع لمطابقة البصمة الرقمية." : "Signed PDF to match the digital fingerprint."}
          formats="PDF"
        />
      </div>

      {result?.status === "valid" && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #BBF7D0", background: "#ECFDF3" }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#15803D" }}>
            <ShieldCheck style={{ width: 16, height: 16 }} /> {ar ? "الملف سليم ومطابق للسجل" : "Valid — document matches the registry"}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#15803D" }}>{ar ? "الموقّع" : "Signer"}: {result.signerName || "—"}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#15803D" }} dir="ltr">{ar ? "رقم التحقق" : "Verification ID"}: {result.verificationId}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#15803D" }}>
            {ar ? "تاريخ التوقيع" : "Signed at"}: {result.signedAt ? new Date(result.signedAt).toLocaleString(ar ? "ar-SA" : "en-GB", { timeZone: "Asia/Riyadh" }) : "—"}
          </p>
        </div>
      )}
      {result?.status === "tampered" && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #FECACA", background: "#FEF2F2" }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#DC2626" }}>
            <ShieldX style={{ width: 16, height: 16 }} /> {ar ? "الملف معدّل أو الختم منقول" : "Tampered — file was modified"}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#991B1B", lineHeight: 1.6 }}>
            {ar
              ? "رقم التحقق موجود في السجل لكنه لا يطابق هذا الملف — الشارة منقولة من ملف آخر أو الملف عُدّل بعد التوقيع."
              : "The verification id exists in the registry but does not match this file — the badge was copied or the file was changed after signing."}
          </p>
        </div>
      )}
      {result?.status === "unknown" && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #FDE68A", background: "#FFFBEB" }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#B45309" }}>
            <ShieldQuestion style={{ width: 16, height: 16 }} /> {ar ? "غير مسجّل — لم يُوقَّع عبر المنصة أو عُدّل بعد التوقيع" : "Not registered — not signed on the platform, or modified after signing"}
          </p>
        </div>
      )}
      {result?.status === "error" && (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#DC2626" }}>{ar ? "تعذّر التحقق — حاول مجددًا." : "Verification failed — try again."}</p>
      )}
    </SigningPanel>
  );
}
