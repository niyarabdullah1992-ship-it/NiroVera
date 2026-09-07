import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Send, Undo2, Upload, Users } from "lucide-react";
import MultiSignPlacementModal from "@/components/files/MultiSignPlacementModal";
import GroupSignUploadZone from "@/components/files/GroupSignUploadZone";
import GroupSignerList from "@/components/files/GroupSignerList";
import GroupSignSuccess from "@/components/files/GroupSignSuccess";
import { base44 } from "@/api/base44Client";
import { generateVerificationId } from "@/lib/verificationBadge";
import { makeSignatureStamp } from "@/lib/multiSignStamp";
import { appParams } from "@/lib/app-params";
import { getCompanyToken } from "@/lib/store";
import { OFFICIAL_STAMP_THEME } from "@/lib/signatureStampThemes";
import SigningStepStrip from "./SigningStepStrip";
import IdentityCard from "@/components/shared/IdentityCard";
import { MUTED, NAVY, ui, SURFACE } from "@/lib/platformStyles";

const EMPTY_SIGNER = { name: "", email: "", employeeId: null, role: "", stationId: null, signatureUrl: "", external: false };
const defaultSignatureField = (index) => ({
  id: `sig-${index}`,
  type: "signature",
  label: "",
  page: 1,
  x: 72,
  y: Math.min(88, 78 + index * 8),
  scale: 100,
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function uploadWithRetry(file) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try { return await base44.integrations.Core.UploadFile({ file }); } catch (error) {
      const limited = error?.response?.status === 429 || error?.status === 429 || String(error?.message || "").includes("429");
      if (!limited || attempt === 5) throw error;
      await wait(Math.min(30000, 1000 * (2 ** attempt)));
    }
  }
}
function signingBaseUrl() {
  try { if (appParams.appBaseUrl) return String(appParams.appBaseUrl).replace(/\/+$/, ""); } catch {}
  return window.location.origin;
}

export default function MultiSignCard({ currentUser, companyId, employees, ar, onCreated }) {
  const [doc, setDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [signers, setSigners] = useState(() => [{
    ...EMPTY_SIGNER,
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    employeeId: currentUser?.id || null,
    role: currentUser?.role || "",
    stationId: currentUser?.stationId || null,
    signatureUrl: currentUser?.profile?.signatureUrl || "",
  }]);
  const [activeSigner, setActiveSigner] = useState(0);
  const [spots, setSpots] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [stampPreviews, setStampPreviews] = useState([]);
  const fileRef = useRef(null);
  const validSigners = useMemo(() => signers.filter((signer) => signer.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signer.email.trim())), [signers]);
  const unique = validSigners.length === signers.length && new Set(signers.map((signer) => signer.email.trim().toLowerCase())).size === signers.length;
  const allPlaced = unique && signers.every((_, index) => (spots[index] || []).some((field) => field.type === "signature"));
  const previewKey = signers.map((signer) => `${signer.email}|${signer.name}|${signer.signatureUrl || ""}`).join(";");

  useEffect(() => {
    let alive = true;
    Promise.all(signers.map((signer) => (
      signer.name.trim()
        ? makeSignatureStamp(signer.signatureUrl || "", signer.name).catch(() => signer.signatureUrl || "")
        : Promise.resolve("")
    ))).then((urls) => { if (alive) setStampPreviews(urls); });
    return () => { alive = false; };
  }, [previewKey]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || uploading) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError(ar ? "اختر ملف PDF صالحًا." : "Choose a valid PDF file.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const { file_url } = await uploadWithRetry(file);
      setDoc({ name: file.name, url: file_url });
      setSpots(Object.fromEntries(signers.map((_, index) => [index, [defaultSignatureField(index)]])));
    } catch {
      setError(ar ? "تعذّر رفع المستند. حاول مرة أخرى." : "The document couldn't be uploaded. Please try again.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const send = async () => {
    if (!doc) {
      setError(ar ? "ارفع ملف PDF أولًا." : "Upload a PDF first.");
      return;
    }
    if (!unique) {
      setError(ar ? "أدخل اسمًا وبريدًا صالحًا وفريدًا لكل موقّع." : "Enter a valid, unique name and email for every signer.");
      return;
    }
    if (!allPlaced) {
      setError(ar ? "ضع حقل توقيع واحدًا على الأقل لكل موقّع." : "Place at least one signature field for every signer.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const verificationId = generateVerificationId();
      const response = await base44.functions.invoke("multiSign", {
        action: "create",
        companyId,
        sessionToken: getCompanyToken(companyId),
        creatorId: currentUser.id,
        creatorName: currentUser.name,
        creatorEmail: currentUser.email || "",
        fileName: doc.name,
        docUrl: doc.url,
        verificationId,
        signatureTheme: OFFICIAL_STAMP_THEME,
        signers: validSigners.map((signer, index) => ({ ...signer, spots: spots[index] })),
        appUrl: signingBaseUrl(),
        lang: ar ? "ar" : "en",
      });
      setResult({ ...response.data, verificationId });
      onCreated?.();
    } catch (err) {
      setError((ar ? "تعذّر إنشاء الطلب — " : "Couldn't create the request — ") + (err?.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  const cancelDocument = () => {
    setDoc(null);
    setActiveSigner(0);
    setSpots({});
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const reset = () => {
    setDoc(null);
    setSigners([{
      ...EMPTY_SIGNER,
      name: currentUser?.name || "",
      email: currentUser?.email || "",
      employeeId: currentUser?.id || null,
      role: currentUser?.role || "",
      stationId: currentUser?.stationId || null,
      signatureUrl: currentUser?.profile?.signatureUrl || "",
    }]);
    setActiveSigner(0);
    setSpots({});
    setResult(null);
    setError("");
  };

  const sendBlock = !doc
    ? (ar ? "ارفع ملف PDF من بطاقة المستند أولًا." : "Upload a PDF in the document card first.")
    : !unique
      ? (ar ? "أدخل اسمًا وبريدًا صالحًا وفريدًا لكل موقّع." : "Enter a valid, unique name and email for every signer.")
      : !allPlaced
        ? (ar ? "ضع حقل توقيع لكل موقّع على المستند." : "Place a signature field for every signer on the document.")
        : "";

  if (result) return <GroupSignSuccess ar={ar} result={result} onReset={reset} />;

  const steps = [
    { ok: Boolean(doc), label: ar ? "المستند" : "Document" },
    { ok: unique, label: ar ? "الموقّعون" : "Signers" },
    { ok: allPlaced, label: ar ? "الحقول" : "Fields" },
    { ok: Boolean(doc) && unique && allPlaced, label: ar ? "الإرسال" : "Send" },
  ];

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={upload}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
      />
      <SigningStepStrip ar={ar} steps={steps} />
      <div
        className="nv-signing-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 300px)",
          gap: 12,
          alignItems: "start",
        }}
        dir={ar ? "rtl" : "ltr"}
      >
        <IdentityCard
          className="nv-signing-card"
          icon={FileText}
          title={ar ? "المستند" : "Document"}
          subtitle={doc?.name || (ar ? "ارفع PDF ثم حرّك ختم كل موقّع" : "Upload a PDF, then place each signer’s seal")}
          meta={doc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Upload style={{ width: 13, height: 13 }} />
                {ar ? "استبدال" : "Replace"}
              </button>
              <button type="button" onClick={cancelDocument} style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Undo2 style={{ width: 13, height: 13 }} />
                {ar ? "تراجع" : "Cancel"}
              </button>
            </div>
          ) : null}
          bodyStyle={{ padding: 0 }}
        >
          <div style={{ minHeight: 320, background: SURFACE }}>
            {!doc ? (
              <div style={{ padding: 16 }}>
                <GroupSignUploadZone ar={ar} uploading={uploading} onPick={() => fileRef.current?.click()} />
              </div>
            ) : validSigners.length ? (
              <MultiSignPlacementModal embedded docUrl={doc.url} signers={validSigners} signaturePreviews={validSigners.map((signer) => stampPreviews[signers.indexOf(signer)] || "")} initialSpots={spots} activeSigner={activeSigner} onActiveSignerChange={setActiveSigner} ar={ar} onChange={setSpots} />
            ) : (
              <div style={{ minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
                <FileText style={{ width: 28, height: 28, color: NAVY, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, color: NAVY }}>{ar ? "أضف بيانات أول موقّع لعرض المستند" : "Add the first signer to open the document"}</p>
              </div>
            )}
          </div>
        </IdentityCard>

        <IdentityCard
          className="nv-signing-card"
          icon={Users}
          title={ar ? "الموقّعون" : "Signers"}
          subtitle={ar ? "الهوية ثم البريد ثم موضع الختم." : "Identity, then email, then seal placement."}
          bodyStyle={{ padding: 0 }}
        >
          <div style={{ padding: 12 }}>
            <GroupSignerList ar={ar} currentUser={currentUser} employees={employees} signers={signers} setSigners={setSigners} activeSigner={activeSigner} setActiveSigner={setActiveSigner} stampPreviews={stampPreviews} spots={spots} />
          </div>
          <div style={{ padding: 12, borderTop: "1px solid #E2E8F0" }}>
            <button
              type="button"
              onClick={send}
              disabled={sending}
              style={{ ...ui.btnPrimary, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: 12, fontSize: 14, fontWeight: 650, opacity: sending ? 0.45 : 1 }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
              {sending ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال طلبات التوقيع" : "Send signature requests")}
            </button>
            {(error || sendBlock) && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: error ? "#DC2626" : MUTED, lineHeight: 1.55 }}>
                {error || sendBlock}
              </p>
            )}
          </div>
        </IdentityCard>
      </div>
    </div>
  );
}
