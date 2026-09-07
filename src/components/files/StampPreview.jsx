import React from "react";
import { BORDER, MUTED, CARD } from "@/lib/platformStyles";

export default function StampPreview({ src, sealId, ar }) {
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: MUTED }}>
        {ar ? "معاينة الختم بهوية نيروفيرا" : "NiroVera seal preview"}
      </p>
      <div
        className="nv-stamp-stage"
        style={{
          padding: 14,
          borderRadius: 16,
          background:
            "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--nv-accent, #1E9E63) 8%, #fff) 0%, var(--nv-inset, #F7F8FA) 55%)",
          border: `1px solid ${BORDER}`,
        }}
      >
        {src ? (
        <img
          src={src}
          alt={ar ? "معاينة الختم الرقمي" : "Digital stamp preview"}
          style={{
            width: "100%",
            minHeight: 104,
            height: "auto",
            objectFit: "contain",
            display: "block",
            borderRadius: 12,
            border: "1px solid color-mix(in oklab, #14284B 10%, #fff)",
            background: CARD,
            boxShadow: "0 10px 24px rgba(20,40,75,.10)",
          }}
        />
        ) : (
          <div
            style={{
              minHeight: 104,
              borderRadius: 12,
              border: `1px dashed ${BORDER}`,
              background: CARD,
              display: "grid",
              placeItems: "center",
              padding: 12,
              fontSize: 12,
              color: MUTED,
              textAlign: "center",
            }}
          >
            {ar ? "جارٍ تجهيز الختم…" : "Preparing the seal…"}
          </div>
        )}
      </div>
      {sealId ? (
        <p
          dir="ltr"
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
            color: MUTED,
            textAlign: "center",
            letterSpacing: "0.06em",
            fontWeight: 600,
          }}
        >
          {sealId}
        </p>
      ) : null}
    </div>
  );
}
