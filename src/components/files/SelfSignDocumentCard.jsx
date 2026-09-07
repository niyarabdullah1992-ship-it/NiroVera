import React, { useEffect, useRef, useState } from "react";
import { Download, FileCheck2, FileText, Loader2, PenLine, ScanLine, Type, Undo2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { imageBlobToPdf, signPdfFile } from "@/lib/signPdf";
import { generateVerificationId, loadBadgeQr } from "@/lib/verificationBadge";
import { sha256HexOfBuffer } from "@/lib/fileHash";
import DocumentFirstPagePreview from "@/components/files/DocumentFirstPagePreview";
import PowerCareUploadZone from "@/components/files/PowerCareUploadZone";
import { makeSignatureStamp } from "@/lib/multiSignStamp";
import SigningPanel from "./SigningPanel";
import { BORDER, BRAND, BRAND_SOFT, MUTED, NAVY, ui, CARD, SURFACE } from "@/lib/platformStyles";

const MAX_SIZE = 25 * 1024 * 1024;
const isPdfFile = (file) => file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");

const ghostBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: NAVY,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

export default function SelfSignDocumentCard({ signatureUrl, signatureRawUrl, signatureVariant, signatureTheme, currentUser, companyId, ar, onVerified, onProgress }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [signing, setSigning] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [download, setDownload] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [fields, setFields] = useState([]);
  const [textValues, setTextValues] = useState({});
  const [verificationId, setVerificationId] = useState("");
  const [stampPreview, setStampPreview] = useState("");
  const [intent, setIntent] = useState(false);

  useEffect(() => {
    let active = true;
    const signerName = currentUser?.profile?.signatureName || currentUser?.name || "";
    if (!signerName && !signatureUrl) {
      setStampPreview("");
      return () => { active = false; };
    }
    const id = verificationId || generateVerificationId();
    makeSignatureStamp(signatureRawUrl || signatureUrl || "", signerName, id)
      .then((preview) => { if (active) setStampPreview(preview); })
      .catch(() => { if (active) setStampPreview(signatureUrl || ""); });
    return () => { active = false; };
  }, [signatureUrl, signatureRawUrl, signatureVariant, verificationId, currentUser?.profile?.signatureName, currentUser?.name]);

  useEffect(() => () => { if (download?.url) URL.revokeObjectURL(download.url); }, [download?.url]);

  useEffect(() => {
    onProgress?.({
      hasFile: Boolean(file),
      hasStamp: fields.some((field) => field.type === "signature"),
      signed: Boolean(success),
    });
  }, [file, fields, success, onProgress]);

  const chooseFile = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const allowed = isPdfFile(selected) || selected.type === "image/png" || selected.name.toLowerCase().endsWith(".docx");
    if (!allowed || selected.size > MAX_SIZE) {
      setError(ar ? "اختر PDF أو DOCX أو PNG بحجم لا يتجاوز 25MB." : "Choose a PDF, DOCX, or PNG up to 25MB.");
      return;
    }
    setScanning(true);
    setError("");
    setSuccess("");
    setDownload(null);
    setFields([]);
    setTextValues({});
    setIntent(false);
    const localUrl = URL.createObjectURL(selected);
    setFile(selected);
    setFileUrl(localUrl);
    setVerificationId(generateVerificationId());
    if (selected.type === "image/png") {
      try {
        const converted = await imageBlobToPdf(selected);
        setSourceUrl(converted.url);
      } catch {
        setError(ar ? "تعذّر تجهيز صورة المستند." : "Couldn't prepare the document image.");
      }
    } else setSourceUrl(isPdfFile(selected) ? localUrl : "");
    setTimeout(() => setScanning(false), 650);
  };

  const openPlacement = (kind) => {
    if (!sourceUrl || !kind) return;
    const id = `${kind}-${Date.now()}`;
    const y = Math.min(82, 68 + fields.filter((field) => field.page === previewPage).length * 6);
    const field = kind === "signature"
      ? { id, type: "signature", page: previewPage, x: 72, y, scale: 100 }
      : { id, type: "text", label: kind === "date" ? (ar ? "التاريخ" : "Date") : (ar ? "الأحرف الأولى" : "Initials"), page: previewPage, x: 72, y, scale: 100 };
    setFields((current) => [...current, field]);
    if (kind !== "signature") {
      const name = currentUser?.profile?.signatureName || currentUser?.name || "";
      const value = kind === "date"
        ? new Date().toLocaleDateString(ar ? "ar-SA" : "en-GB")
        : name.split(/\s+/).map((part) => part[0]).join("").slice(0, 4).toUpperCase();
      setTextValues((current) => ({ ...current, [id]: value }));
    }
  };

  const cancelDocument = () => {
    if (fileUrl?.startsWith("blob:")) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl("");
    setSourceUrl("");
    setFields([]);
    setTextValues({});
    setVerificationId("");
    setSuccess("");
    setError("");
    setDownload(null);
    setScanning(false);
    setIntent(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const signAndDownload = async () => {
    if (!intent) {
      setError(ar ? "أقرّ بالاطّلاع قبل التوقيع." : "Confirm that you reviewed the document before signing.");
      return;
    }
    const signatureField = fields.find((field) => field.type === "signature");
    if (!signatureUrl) { setError(ar ? "أنشئ توقيعك أولًا." : "Create your signature first."); return; }
    if (!signatureField) { setError(ar ? "ضع التوقيع على المستند أولًا." : "Place the signature on the document first."); return; }
    setSigning(true);
    setError("");
    setSuccess("");
    const id = verificationId || generateVerificationId();
    setVerificationId(id);
    try {
      const signerName = currentUser?.profile?.signatureName || currentUser?.name || "";
      const qr = await loadBadgeQr(id);
      const { bytes } = await signPdfFile(sourceUrl, signatureRawUrl || null, signerName, id, signatureField, qr, (signatureField.scale || 100) / 100, false, fields, textValues, signatureVariant, "heritage");
      const fileHash = await sha256HexOfBuffer(bytes);
      await base44.functions.invoke("signedDocs", {
        action: "register",
        verificationId: id,
        fileHash,
        signerName,
        signerId: currentUser.id,
        companyId,
        sessionToken: getCompanyToken(companyId),
        fileName: file.name,
      });
      const outputName = `${file.name.replace(/\.(pdf|png)$/i, "")}-signed.pdf`;
      const downloadUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setDownload({ url: downloadUrl, name: outputName });
      onVerified?.({ signatureId: id, timestamp: new Date().toISOString(), verified: true });
      setSuccess(outputName);
    } catch (err) {
      setError((ar ? "تعذّر توقيع المستند — " : "Couldn't sign the document — ") + (err?.message || ""));
    } finally {
      setSigning(false);
    }
  };

  return (
    <SigningPanel
      icon={FileText}
      title={ar ? "ضع التوقيع على المستند" : "Place the signature on the document"}
      hint={ar ? "ارفع الملف ثم ضع الختم على الصفحة" : "Upload the file, then place the seal on the page"}
      extra={file ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: MUTED }}>{file.name}</span>
          <button type="button" onClick={cancelDocument} style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Undo2 style={{ width: 14, height: 14 }} />
            {ar ? "تراجع" : "Cancel"}
          </button>
        </div>
      ) : null}
      pad={!file}
    >
      {!file ? (
        <PowerCareUploadZone
          inputRef={inputRef}
          accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png"
          onFileChange={chooseFile}
          title={ar ? "ارفع المستند لبدء التوقيع" : "Upload a document to start signing"}
          description={ar ? "ارفع الملف ثم ضع التوقيع على الصفحة." : "Upload the file, then place the signature on the page."}
          formats="PDF / DOCX / PNG"
        />
      ) : (
        <>
          <div className="self-sign-document-preview" style={{ position: "relative", borderBottom: `1px solid ${BORDER}` }}>
            <DocumentFirstPagePreview
              url={fileUrl}
              file={file}
              ar={ar}
              fields={fields}
              onFieldsChange={setFields}
              textValues={textValues}
              signaturePreview={stampPreview || signatureUrl}
              onPageChange={setPreviewPage}
            />
            {scanning && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.85)" }}>
                <ScanLine style={{ width: 22, height: 22, color: NAVY, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, color: NAVY }}>{ar ? "جارٍ تجهيز المستند…" : "Preparing the document…"}</p>
              </div>
            )}
          </div>
          <div style={{ padding: "14px 16px", display: "grid", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { kind: "signature", icon: PenLine, label: ar ? "إضافة توقيع" : "Add signature" },
                { kind: "initials", icon: Type, label: ar ? "الأحرف الأولى" : "Initials" },
              ].map((item) => {
                const Icon = item.icon;
                const placed = item.kind === "signature"
                  ? fields.some((field) => field.type === "signature")
                  : fields.some((field) => field.type === "text" && field.label !== (ar ? "التاريخ" : "Date"));
                return (
                  <button
                    key={item.kind}
                    type="button"
                    disabled={!sourceUrl}
                    onClick={() => openPlacement(item.kind)}
                    style={{
                      ...ghostBtn,
                      height: 36,
                      borderRadius: 9,
                      opacity: sourceUrl ? 1 : 0.4,
                      ...(placed
                        ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND, fontWeight: 600 }
                        : {}),
                    }}
                  >
                    <Icon style={{ width: 14, height: 14 }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {!sourceUrl && (
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                {ar ? "حوّل ملف DOCX إلى PDF لإضافة الحقول والتوقيع." : "Convert the DOCX to PDF to place fields and sign."}
              </p>
            )}
            <label style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 12px",
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              fontSize: 11,
              lineHeight: 1.65,
              color: MUTED,
              cursor: "pointer",
            }}>
              <input type="checkbox" checked={intent} onChange={(e) => setIntent(e.target.checked)} style={{ marginTop: 3, accentColor: "#1E9E63" }} />
              <span>
                {ar
                  ? "أقر بأنني اطّلعت على هذا المستند وأوقّعه بإرادتي، باسمِي وبصفتي، وفق نظام التعاملات الإلكترونية."
                  : "I confirm that I reviewed this document and sign it of my own will, in my name and capacity, under the Electronic Transactions Law."}
              </span>
            </label>
            <button
              type="button"
              onClick={signAndDownload}
              disabled={signing || !sourceUrl || scanning || !intent}
              style={{
                ...ui.btnPrimary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 44,
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 650,
                opacity: signing || !sourceUrl || scanning || !intent ? 0.5 : 1,
              }}
            >
              {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 style={{ width: 16, height: 16 }} />}
              {signing ? (ar ? "جارٍ التوقيع…" : "Signing…") : (ar ? "وقّع المستند" : "Sign document")}
            </button>
            {success && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 10, border: "1px solid #BBF7D0", background: "#ECFDF3" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#15803D" }}>{ar ? `تم إنشاء ${success}` : `${success} created`}</p>
                {download && (
                  <a href={download.url} download={download.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#15803D", color: "#fff", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                    <Download style={{ width: 14, height: 14 }} />
                    {ar ? "تحميل الملف الموقّع" : "Download signed file"}
                  </a>
                )}
              </div>
            )}
            {error && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{error}</p>}
          </div>
        </>
      )}
    </SigningPanel>
  );
}
