import React from "react";
import VerifyDocumentCard from "@/components/files/VerifyDocumentCard";
import VerifyGuide from "@/components/files/VerifyGuide";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";

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
      <section data-verify-main="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <SectionHead
          title={ar ? "تحقق من مستند موقّع" : "Verify a signed document"}
          note={ar ? "تُحسب بصمة الملف على جهازك وتُطابق سجل الشركة — الملف لا يُرفع." : "The fingerprint is computed on your device and matched to the company registry — the file is never uploaded."}
        />
        <VerifyDocumentCard ar={ar} companyId={companyId} initialId={initialId} />
      </section>
      <VerifyGuide ar={ar} />
    </div>
  );
}
