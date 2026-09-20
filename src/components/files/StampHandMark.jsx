import React, { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { signGhostBtn } from "@/components/files/signingUi";
import SignaturePad from "@/components/files/SignaturePad";

function chip(active) {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "8px 6px",
    borderRadius: 8,
    border: `1px solid ${active ? NAVY : BORDER}`,
    background: active ? SURFACE : CARD,
    color: NAVY,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
  };
}

export default function StampHandMark({ ar, name = "", markUrl = "", onMark }) {
  const [hand, setHand] = useState("");
  const fileRef = useRef(null);
  const trimmed = String(name || "").trim();

  const pickFile = (event) => {
    const file = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (!url) return;
      setHand("upload");
      onMark(url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.65, color: MUTED }}>
        {ar
          ? "ارسم أو ارفع خط اليد، ثم اسحبه على المعاينة إلى أي موضع داخل الختم."
          : "Draw or upload the handwriting, then drag it anywhere on the seal preview."}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button type="button" onClick={() => setHand((current) => (current === "draw" ? "" : "draw"))} style={chip(hand === "draw")}>
          {ar ? "رسم التوقيع" : "Draw signature"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} style={chip(hand === "upload" && Boolean(markUrl))}>
          {ar ? "رفع شارة" : "Upload mark"}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        onChange={pickFile}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
      {markUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, background: SURFACE, padding: 8, display: "flex", justifyContent: "center" }}>
            <img src={markUrl} alt={ar ? "شارة التوقيع على الختم" : "Signature mark on the seal"} style={{ maxHeight: 52, maxWidth: "100%", objectFit: "contain" }} />
          </span>
          <button
            type="button"
            onClick={() => { onMark(""); setHand(""); }}
            style={{ ...signGhostBtn, color: "#DC2626" }}
            title={ar ? "إزالة الشارة" : "Remove mark"}
          >
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      ) : null}
      {hand === "draw" ? (
        <SignaturePad ar={ar} signerName={trimmed} markOnly onMark={onMark} />
      ) : null}
    </div>
  );
}
