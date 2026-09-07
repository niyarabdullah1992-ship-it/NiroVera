import React from "react";
import { FileCheck2, Stamp, ShieldCheck } from "lucide-react";
import { BRAND, CARD, MUTED, NAVY } from "@/lib/platformStyles";

export default function SigningProofBand({ ar }) {
  const beats = [
    {
      icon: Stamp,
      title: ar ? "ختمك" : "Your seal",
      text: ar ? "يُحفظ مرة بهويتك، ثم يُعاد على كل مستند." : "Saved once to your identity, then reused on every document.",
    },
    {
      icon: FileCheck2,
      title: ar ? "الصفحة" : "The page",
      text: ar ? "تسحب الختم، تقرّ بالإرادة، وتوقّع باسمك وبصفتك." : "Place the seal, confirm intent, and sign in your name.",
    },
    {
      icon: ShieldCheck,
      title: ar ? "التحقق" : "Verify",
      text: ar ? "QR ورقم PWC لأي جهة — بلا دخول إلى المنصة." : "QR and a PWC id for anyone — no platform login.",
    },
  ];

  return (
    <div className="nv-signing-proof" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
      {beats.map((beat, index) => {
        const Icon = beat.icon;
        return (
          <div
            key={beat.title}
            className="nv-signing-proof-beat"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: "14px 16px",
              borderRadius: 16,
              background: CARD,
              border: "1px solid var(--nv-line, #E2E8F0)",
              boxShadow: "0 8px 22px rgba(20,40,75,.05)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                background: "color-mix(in oklab, var(--nv-accent, #1E9E63) 12%, #fff)",
                color: BRAND,
              }}
            >
              <Icon size={16} strokeWidth={1.9} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: MUTED }}>{String(index + 1).padStart(2, "0")}</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 650, color: NAVY }}>{beat.title}</p>
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.6, color: MUTED }}>{beat.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
