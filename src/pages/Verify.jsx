import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import VerifyWorkspace from "@/components/files/VerifyWorkspace";
import { signGhostBtn } from "@/components/files/signingUi";
import { useI18n } from "@/lib/i18n";
import { INK, NAVY_FILL, usePublicPlatformTheme } from "@/lib/publicChrome";

export default function Verify() {
  const { lang, setLang } = useI18n();
  const ar = lang === "ar";
  const id = new URLSearchParams(window.location.search).get("id") || "";
  usePublicPlatformTheme();

  return (
    <div className="powercare-public" lang={ar ? "ar" : "en"} dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#eceef2", color: INK, fontSize: 13, display: "flex", flexDirection: "column" }}>
      <header style={{ background: NAVY_FILL, color: "#fff", display: "flex", alignItems: "center", gap: 18, padding: "0 24px", height: 56, flexShrink: 0 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <Logo size={26} onDark />
        </Link>
        <nav style={{ display: "flex", gap: 2, height: 56 }}>
          <Link to="/" style={{ textDecoration: "none", padding: "0 14px", display: "flex", alignItems: "center", color: "rgba(255,255,255,.7)", borderBottom: "3px solid transparent" }}>
            {ar ? "الرئيسية" : "Home"}
          </Link>
          <Link to="/verify" style={{ textDecoration: "none", padding: "0 14px", display: "flex", alignItems: "center", color: "#fff", fontWeight: 600, borderBottom: "3px solid #1E9E63" }}>
            {ar ? "تحقق" : "Verify"}
          </Link>
        </nav>
        <span style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>
            {ar ? "صفحة عامة — لا تحتاج تسجيل دخول" : "Public page — no sign-in required"}
          </span>
          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{ ...signGhostBtn, padding: "6px 10px", fontSize: 12, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}
          >
            {ar ? "EN" : "ع"}
          </button>
        </span>
      </header>

      <main style={{ flex: 1, padding: "28px 24px 64px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "min(1080px, 100%)" }}>
          <VerifyWorkspace ar={ar} initialId={id} />
        </div>
      </main>
    </div>
  );
}
