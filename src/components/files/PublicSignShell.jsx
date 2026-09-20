import React from "react";
import { HelpCircle, ShieldCheck } from "lucide-react";
import SectionBackLink from "@/components/shared/SectionBackLink";
import { BORDER, CARD, MUTED, NAVY, SURFACE, usePublicPlatformTheme } from "@/lib/publicChrome";
import { STAGE } from "@/lib/platformStyles";

function docTitle(fileName = "") {
  return String(fileName).replace(/\.pdf$/i, "") || fileName;
}

export default function PublicSignShell({ ar, onBack, info, remaining, action, children }) {
  usePublicPlatformTheme();
  const meta = info
    ? [info.fileName, info.creatorName ? (ar ? `طلب من ${info.creatorName}` : `from ${info.creatorName}`) : "", ar ? "توقيع متوازٍ" : "parallel signing"].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="powercare-public" lang={ar ? "ar" : "en"} dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: SURFACE, color: NAVY }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", minHeight: "100vh", padding: "16px 20px 24px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <section
          data-nv="stamp"
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            overflow: "hidden",
            background: STAGE,
          }}
        >
          <header
            className="nv-stamp-head"
            style={{
              background: CARD,
              borderBottom: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              padding: "16px 18px",
              flexWrap: "wrap",
              flexShrink: 0,
              textAlign: "start",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
              <SectionBackLink ar={ar} label={ar ? "التوقيع الرقمي" : "Digital signing"} onClick={onBack} />
              <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em", color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {info ? docTitle(info.fileName) : (ar ? "طلب توقيع إلكتروني" : "Electronic signature request")}
                </h1>
                {meta ? (
                  <span style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</span>
                ) : null}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingTop: 2 }}>
              {remaining ? <span style={{ fontSize: 13, color: MUTED }}>{remaining}</span> : null}
              {action}
              {!action && !onBack ? (
                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
                  <HelpCircle style={{ width: 14, height: 14 }} />
                  {ar ? "هل تحتاج مساعدة؟" : "Need signing help?"}
                </p>
              ) : null}
            </div>
          </header>
          <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</main>
        </section>
        <footer style={{ padding: "14px 4px 0", flexShrink: 0 }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 11, color: MUTED, lineHeight: 1.6, textAlign: "center" }}>
            <ShieldCheck style={{ width: 14, height: 14, flexShrink: 0 }} />
            {ar
              ? "بصمة داخل سجل المنشأة — يمكن التحقق منها. هذا ليس شهادة حكومية مؤهلة."
              : "Fingerprint in the company registry — verifiable. This is not a qualified government certificate."}
          </p>
        </footer>
      </div>
    </div>
  );
}
