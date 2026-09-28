import React from "react";
import VerifyDocumentCard from "@/components/files/VerifyDocumentCard";
import VerifyGuide from "@/components/files/VerifyGuide";
import { BORDER, CARD, INK, MUTED } from "@/lib/platformStyles";

const LINE = "var(--nv-line)";

/**
 * Shared verify board — public /verify and the signing-home Verify tab.
 * Layout follows the design file; fields stay on the platform scale.
 */
export default function VerifyWorkspace({ ar, companyId, initialId = "" }) {
  return (
    <div className="nv-verify-grid" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}>
      <style>{`
        .nv-verify-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,330px);gap:16px;align-items:start;width:100%}
        @media (max-width:860px){.nv-verify-grid{grid-template-columns:1fr}}
        input.nv-verify-field:focus,
        input.nv-verify-field:focus-visible{
          outline:none!important;
          border:1px solid var(--nv-navy,#14284B)!important;
          box-shadow:none!important;
        }
      `}</style>
      <section style={{ background: CARD, border: "none", borderInlineEnd: `1px solid ${BORDER}`, borderRadius: 0, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 5, textAlign: "start" }}>
          <span dir="ltr" style={{ fontSize: 11, letterSpacing: "0.2em", color: MUTED, unicodeBidi: "isolate", textAlign: ar ? "right" : "left" }}>DOCUMENT VERIFICATION</span>
          <span style={{ fontSize: 23, fontWeight: 600, color: INK }}>{ar ? "تحقق من مستند موقّع" : "Verify a signed document"}</span>
          <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
            {ar
              ? "تُحسب بصمة الملف على جهازك وتُطابق مع سجل الشركة. الملف لا يُرفع إلى الخادم."
              : "The file fingerprint is computed on your device and matched to the company registry. The file is never uploaded."}
          </span>
        </div>
        <VerifyDocumentCard ar={ar} companyId={companyId} initialId={initialId} />
        <div style={{ borderTop: `1px solid ${LINE}`, padding: "14px 24px", fontSize: 12, color: MUTED, lineHeight: 1.8, textAlign: "start" }}>
          {ar
            ? "ارفع أي نسخة مختومة: تُحسب بصمتها هنا على جهازك وتُطابق مع سجل الشركة — لا يُرفع الملف."
            : "Use any sealed copy: its fingerprint is computed here on your device and matched to the company registry — the file is never uploaded."}
        </div>
      </section>
      <VerifyGuide ar={ar} />
    </div>
  );
}
