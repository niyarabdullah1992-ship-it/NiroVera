import React, { useEffect, useState } from "react";
import { Check, Keyboard, PenLine, Stamp, Trash2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { updateEmployeeProfile } from "@/lib/store";
import { makeSignatureStamp } from "@/lib/multiSignStamp";
import SignaturePad from "./SignaturePad";
import TypedSignature from "./TypedSignature";
import UploadedSignature from "./UploadedSignature";
import SelfSignDocumentCard from "./SelfSignDocumentCard";
import SignatureSecurityBar from "./SignatureSecurityBar";
import SigningPanel from "./SigningPanel";
import { OFFICIAL_STAMP_THEME } from "@/lib/signatureStampThemes";
import { generateVerificationId } from "@/lib/verificationBadge";
import { CARD, MUTED, ui, BRAND, BRAND_SOFT, BRAND_DEEP } from "@/lib/platformStyles";
import StampPreview from "./StampPreview";
import SigningStepStrip from "./SigningStepStrip";
import HowSigningWorks from "./HowSigningWorks";

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function MySignatureCard({ companyId, companyName, currentUser, ar, onSaved }) {
  const [localSignature, setLocalSignature] = useState(null);
  const signatureUrl = localSignature?.signatureUrl ?? currentUser?.profile?.signatureUrl ?? "";
  const signatureRawUrl = localSignature?.signatureRawUrl ?? currentUser?.profile?.signatureRawUrl ?? "";
  const signatureVariant = localSignature?.signatureVariant ?? currentUser?.profile?.signatureVariant ?? "unique";
  const signatureTheme = OFFICIAL_STAMP_THEME;
  const signatureId = localSignature?.signatureId ?? currentUser?.profile?.signatureId ?? "";
  const [editing, setEditing] = useState(!signatureUrl);
  const [mode, setMode] = useState("type");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshedPreview, setRefreshedPreview] = useState("");
  const [docProgress, setDocProgress] = useState({ hasFile: false, hasStamp: false, signed: false });
  const [security, setSecurity] = useState({
    signatureId,
    timestamp: currentUser?.profile?.signatureUpdatedAt || "",
    verified: false,
  });

  useEffect(() => {
    let active = true;
    if (!signatureRawUrl || !signatureId || signatureVariant === "composed") return () => { active = false; };
    const signerName = currentUser?.profile?.signatureName || currentUser?.name || "";
    makeSignatureStamp(signatureRawUrl, signerName, signatureId, signatureVariant, signatureTheme)
      .then((preview) => { if (active) setRefreshedPreview(preview); })
      .catch(() => { if (active) setRefreshedPreview(""); });
    return () => { active = false; };
  }, [signatureRawUrl, signatureId, signatureVariant, signatureTheme, currentUser?.profile?.signatureName, currentUser?.name]);

  const saveSignature = async (dataUrl, typedName, signatureStyle = "composed", sealId) => {
    setSaving(true);
    setError("");
    try {
      const sigId = String(sealId || "").trim() || generateVerificationId();
      const signerName = typeof typedName === "string" ? typedName : currentUser.name;
      const finalDataUrl = signatureStyle !== "composed"
        ? await makeSignatureStamp(dataUrl, signerName, sigId, signatureStyle, OFFICIAL_STAMP_THEME)
        : dataUrl;
      const finalFile = new File([dataUrlToBlob(finalDataUrl)], "signature.png", { type: "image/png" });
      const rawFile = signatureStyle !== "composed"
        ? new File([dataUrlToBlob(dataUrl)], "signature-original.png", { type: "image/png" })
        : null;
      const [finalUpload, rawUpload] = await Promise.all([
        base44.integrations.Core.UploadFile({ file: finalFile }),
        rawFile ? base44.integrations.Core.UploadFile({ file: rawFile }) : Promise.resolve(null),
      ]);
      const timestamp = new Date().toISOString();
      const savedProfile = {
        signatureUrl: finalUpload.file_url,
        signatureRawUrl: rawUpload?.file_url || "",
        signatureVariant: signatureStyle,
        signatureTheme: OFFICIAL_STAMP_THEME,
        signatureId: sigId,
        signatureName: signerName,
        signatureUpdatedAt: timestamp,
      };
      updateEmployeeProfile(companyId, currentUser.id, savedProfile);
      setLocalSignature(savedProfile);
      setSecurity({ signatureId: sigId, timestamp, verified: false });
      onSaved?.(savedProfile);
      setEditing(false);
    } catch {
      setError(ar ? "تعذّر حفظ التوقيع؛ حاول مرة أخرى." : "Couldn't save the signature; try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    const cleared = { signatureUrl: "", signatureRawUrl: "", signatureVariant: "", signatureTheme: "", signatureId: "" };
    updateEmployeeProfile(companyId, currentUser.id, cleared);
    setLocalSignature(cleared);
    setSecurity({ signatureId: "", timestamp: "", verified: false });
    onSaved?.(cleared);
    setEditing(true);
  };

  const tabs = [
    { id: "type", icon: Keyboard, label: ar ? "كتابة" : "Type" },
    { id: "draw", icon: PenLine, label: ar ? "رسم" : "Draw" },
    { id: "upload", icon: Upload, label: ar ? "رفع" : "Upload" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} dir={ar ? "rtl" : "ltr"}>
      <SigningStepStrip
        ar={ar}
        steps={[
          { ok: Boolean(signatureUrl) && !editing, label: ar ? "ختمك" : "Seal" },
          { ok: docProgress.hasFile, label: ar ? "المستند" : "Document" },
          { ok: docProgress.hasStamp, label: ar ? "الوضع" : "Place" },
          { ok: docProgress.signed, label: ar ? "التوقيع" : "Sign" },
        ]}
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
        gap: 12,
        alignItems: "start",
      }}
      className="nv-signing-grid"
      >
        <SelfSignDocumentCard
          signatureUrl={signatureUrl}
          signatureRawUrl={signatureRawUrl}
          signatureVariant={signatureVariant}
          signatureTheme={signatureTheme}
          currentUser={currentUser}
          companyId={companyId}
          ar={ar}
          onVerified={setSecurity}
          onProgress={setDocProgress}
        />

        <SigningPanel
          sticky
          icon={Stamp}
          title={ar ? "ختمك" : "Your seal"}
          hint={ar
            ? `${currentUser?.name || ""}${companyName ? ` · ${companyName}` : ""} — يُحفظ مرة ويُستخدم على المستند.`
            : `${currentUser?.name || ""}${companyName ? ` · ${companyName}` : ""} — saved once and used on the document.`}
        >
            {!editing && signatureUrl ? (
              <div style={{ display: "grid", gap: 10 }}>
                <StampPreview src={refreshedPreview || signatureUrl} sealId={signatureId} ar={ar} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setEditing(true)} style={{ ...ui.btnPrimary, flex: 1, height: 44, borderRadius: 12, fontWeight: 650, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <PenLine style={{ width: 14, height: 14 }} />
                    {ar ? "توقيع جديد" : "New signature"}
                  </button>
                  <button type="button" onClick={remove} style={{ ...ui.btnDanger, display: "inline-flex", alignItems: "center" }} aria-label={ar ? "حذف التوقيع" : "Remove signature"}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#15803D" }}>
                  <Check style={{ width: 14, height: 14 }} />
                  {ar ? "محفوظ وجاهز للاستخدام على المستند" : "Saved and ready to use on the document"}
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {tabs.map(({ id, icon: Icon, label }) => {
                    const active = mode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setMode(id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          height: 40,
                          borderRadius: 11,
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          ...(active
                            ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP, fontWeight: 600 }
                            : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED, fontWeight: 500 }),
                        }}
                      >
                        <Icon style={{ width: 13, height: 13 }} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                {mode === "draw" && <SignaturePad ar={ar} signerName={currentUser?.name || ""} stampTheme={OFFICIAL_STAMP_THEME} onSave={saveSignature} saving={saving} />}
                {mode === "type" && <TypedSignature ar={ar} defaultName={currentUser?.name || ""} stampTheme={OFFICIAL_STAMP_THEME} onSave={saveSignature} saving={saving} />}
                {mode === "upload" && <UploadedSignature ar={ar} signerName={currentUser?.name || ""} stampTheme={OFFICIAL_STAMP_THEME} onSave={saveSignature} saving={saving} />}
                {error && <p style={{ margin: 0, fontSize: 11, color: "#DC2626" }}>{error}</p>}
              </div>
            )}
        </SigningPanel>
      </div>
      <SignatureSecurityBar
        signatureId={security.signatureId || signatureId}
        timestamp={security.timestamp || currentUser?.profile?.signatureUpdatedAt}
        verified={security.verified}
        ar={ar}
      />
      <HowSigningWorks ar={ar} />
    </div>
  );
}
