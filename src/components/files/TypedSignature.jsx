import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { makeSignatureStamp } from "@/lib/multiSignStamp";
import { createTypedSignatureImage, signatureScriptFont } from "@/lib/typedSignatureImage";
import { generateVerificationId } from "@/lib/verificationBadge";
import { MUTED, field, ui, SURFACE } from "@/lib/platformStyles";
import StampPreview from "./StampPreview";

export default function TypedSignature({ ar, defaultName = "", verificationId, stampTheme = "heritage", stampConfig, onNameChange, onPreview, onSave, onMark, markOnly = false, saving }) {
  const [name, setName] = useState(defaultName);
  const [datedSignature, setDatedSignature] = useState("");
  const [stamp, setStamp] = useState("");
  const [sealId] = useState(() => verificationId || generateVerificationId());
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const onMarkRef = useRef(onMark);
  onMarkRef.current = onMark;

  useEffect(() => {
    let active = true;
    if (!name.trim()) {
      setDatedSignature("");
      setStamp("");
      onMarkRef.current?.("");
      onPreviewRef.current?.("");
      return () => { active = false; };
    }
    createTypedSignatureImage(name.trim(), signatureScriptFont(name))
      .then((rawSignature) => {
        if (!active) return null;
        setDatedSignature(rawSignature);
        onMarkRef.current?.(rawSignature);
        if (markOnly) return null;
        return makeSignatureStamp(rawSignature, name.trim(), sealId, "typed", stampConfig || stampTheme);
      })
      .then((composed) => {
        if (active && composed) {
          setStamp(composed);
          onPreviewRef.current?.(composed);
        }
      })
      .catch(() => {
        if (active) {
          setStamp("");
          onPreviewRef.current?.("");
        }
      });
    return () => { active = false; };
  }, [name, ar, sealId, stampTheme, stampConfig, markOnly]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "اسم التوقيع" : "Signature name"}</span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            onNameChange?.(event.target.value);
          }}
          dir="auto"
          placeholder={ar ? "اكتب اسمك…" : "Type your name…"}
          style={{ ...field, height: 38, background: SURFACE }}
        />
      </label>
      {markOnly ? (
        datedSignature ? (
          <img src={datedSignature} alt="" style={{ maxHeight: 56, width: "100%", objectFit: "contain" }} />
        ) : null
      ) : (
        <StampPreview src={stamp} sealId={sealId} ar={ar} />
      )}
      {markOnly || !onSave ? null : (
        <button
          type="button"
          disabled={!stamp || saving}
          onClick={() => onSave(datedSignature, name.trim(), "typed")}
          style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 40, opacity: !stamp || saving ? 0.45 : 1 }}
        >
          <Check style={{ width: 14, height: 14 }} />
          {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التوقيع" : "Save signature")}
        </button>
      )}
    </div>
  );
}
