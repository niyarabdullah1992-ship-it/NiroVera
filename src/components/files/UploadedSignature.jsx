import React, { useEffect, useRef, useState } from "react";
import { Check, ImageUp, Loader2 } from "lucide-react";
import { makeSignatureStamp } from "@/lib/multiSignStamp";
import { generateVerificationId } from "@/lib/verificationBadge";
import { INK, BORDER, MUTED, ui, SURFACE } from "@/lib/platformStyles";
import StampPreview from "./StampPreview";

export default function UploadedSignature({ ar, signerName, stampTheme = "heritage", stampConfig, onSave, saving }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [stamp, setStamp] = useState("");
  const [sealId] = useState(() => generateVerificationId());

  const choose = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    let active = true;
    if (!preview) {
      setStamp("");
      return () => { active = false; };
    }
    makeSignatureStamp(preview, signerName, sealId, "uploaded", stampConfig || stampTheme)
      .then((composed) => { if (active) setStamp(composed); })
      .catch(() => { if (active) setStamp(""); });
    return () => { active = false; };
  }, [preview, signerName, sealId, stampTheme, stampConfig]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label
        style={{
          position: "relative",
          minHeight: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          border: `1px dashed ${BORDER}`,
          background: SURFACE,
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 16,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={choose}
          style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}
        />
        {preview ? (
          <img src={preview} alt={ar ? "التوقيع المرفوع" : "Uploaded signature"} style={{ maxHeight: 72, maxWidth: "100%", objectFit: "contain" }} />
        ) : (
          <>
            <ImageUp style={{ width: 22, height: 22, color: INK, marginBottom: 8 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{ar ? "ارفع صورة توقيعك" : "Upload your signature image"}</span>
            <span style={{ marginTop: 4, fontSize: 11, color: MUTED }}>PNG / JPG</span>
          </>
        )}
      </label>
      <StampPreview src={stamp} sealId={sealId} ar={ar} />
      <button
        type="button"
        disabled={!stamp || saving}
        onClick={() => onSave(preview, signerName, "uploaded", sealId)}
        style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 40, opacity: !stamp || saving ? 0.45 : 1 }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check style={{ width: 14, height: 14 }} />}
        {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التوقيع" : "Save signature")}
      </button>
    </div>
  );
}
