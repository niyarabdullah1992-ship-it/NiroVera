import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { makeSignatureStamp } from "@/lib/multiSignStamp";
import { createTypedSignatureImage } from "@/lib/typedSignatureImage";
import { generateVerificationId } from "@/lib/verificationBadge";
import { MUTED, field, ui, SURFACE } from "@/lib/platformStyles";
import StampPreview from "./StampPreview";

export default function TypedSignature({ ar, defaultName = "", verificationId, stampTheme = "heritage", onPreview, onSave, saving }) {
  const [name, setName] = useState(defaultName);
  const [datedSignature, setDatedSignature] = useState("");
  const [stamp, setStamp] = useState("");
  const [sealId] = useState(() => verificationId || generateVerificationId());
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  useEffect(() => {
    let active = true;
    if (!name.trim()) {
      setDatedSignature("");
      setStamp("");
      onPreviewRef.current?.("");
      return () => { active = false; };
    }
    createTypedSignatureImage(name.trim(), "Arial")
      .then((rawSignature) => {
        if (!active) return null;
        setDatedSignature(rawSignature);
        return makeSignatureStamp(rawSignature, name.trim(), sealId, "typed", stampTheme);
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
  }, [name, ar, sealId, stampTheme]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "اسم التوقيع" : "Signature name"}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          dir="auto"
          placeholder={ar ? "اكتب اسمك…" : "Type your name…"}
          style={{ ...field, height: 38, background: SURFACE }}
        />
      </label>
      <StampPreview src={stamp} sealId={sealId} ar={ar} />
      <button
        type="button"
        disabled={!stamp || saving}
        onClick={() => onSave(datedSignature, name.trim(), "typed", sealId)}
        style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 40, opacity: !stamp || saving ? 0.45 : 1 }}
      >
        <Check style={{ width: 14, height: 14 }} />
        {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التوقيع" : "Save signature")}
      </button>
    </div>
  );
}
