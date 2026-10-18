import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import LegalCertificatesStrip from "@/components/landing/LegalCertificatesStrip";
import {
  ON_NAVY,
  ON_NAVY_MUTED,
  SURFACE,
  usePublicPlatformTheme,
} from "@/lib/publicChrome";

const PAD = { paddingLeft: 48, paddingRight: 48 };

const NAV = [
  { href: "/#how", ar: "سلسلة الإثبات", en: "Proof chain" },
  { href: "/#sections", ar: "الأقسام", en: "Sections" },
  { href: "/#mhrsd", ar: "الامتثال الوزاري", en: "Ministry compliance" },
  { href: "/#release", ar: "الجديد", en: "What's new" },
  { href: "/#pricing", ar: "الاشتراك", en: "Subscription" },
];

const FOOT_COMPANY = [
  { to: "/mobile", ar: "تطبيق الميدان", en: "Field app" },
  { to: "/careers", ar: "الوظائف", en: "Careers" },
  { to: "/security", ar: "الأمان", en: "Security" },
  { to: "/deck", ar: "عرض المبيعات", en: "Sales deck" },
  { to: "/workspace", ar: "مساحة الشركة", en: "Company workspace" },
  { to: "/proof", ar: "التحقق العام", en: "Public verify" },
  { href: "mailto:niyar@powercares.pro", ar: "الدعم", en: "Support" },
];

function FootLink({ item, ar }) {
  const label = ar ? item.ar : item.en;
  const style = { fontSize: 13, color: ON_NAVY_MUTED, textDecoration: "none", lineHeight: 1.7 };
  if (item.to) return <Link to={item.to} style={style}>{label}</Link>;
  return <a href={item.href} style={style}>{label}</a>;
}

export function MarketingHeader({ ar, loggedIn, onToggleLang }) {
  const T = (a, e) => (ar ? a : e);
  return (
    <header
      data-nv="pad"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#0B3D27",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        ...PAD,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", height: 68, display: "flex", alignItems: "center", gap: 20 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", color: "inherit", textDecoration: "none", flexShrink: 0 }}>
          <Logo size={28} onDark />
        </Link>
        <nav data-nv="navlinks" style={{ flex: 1, display: "flex", alignItems: "center", gap: 22, minWidth: 0 }}>
          {NAV.map((l) =>
            l.to ? (
              <Link key={l.to} to={l.to} style={{ fontSize: 13, color: "#D6E6DC", textDecoration: "none", whiteSpace: "nowrap" }}>{T(l.ar, l.en)}</Link>
            ) : (
              <a key={l.href} href={l.href} style={{ fontSize: 13, color: "#D6E6DC", textDecoration: "none", whiteSpace: "nowrap" }}>{T(l.ar, l.en)}</a>
            )
          )}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {onToggleLang ? (
            <button type="button" onClick={onToggleLang} style={{ height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.28)", background: "transparent", color: "#E7F0EA", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {ar ? "EN" : "ع"}
            </button>
          ) : null}
          {/* No trial or «enter» buttons (owner's rule) — one quiet link to the account. */}
          <Link to={loggedIn ? "/app" : "/login"} style={{ fontSize: 13, color: "#E7F0EA", fontWeight: 600, textDecoration: "none", padding: "0 4px" }}>
            {loggedIn ? T("حسابي", "My account") : T("تسجيل الدخول", "Sign in")}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ ar, lang }) {
  const T = (a, e) => (ar ? a : e);
  return (
    <footer data-nv="pad" style={{ padding: "36px 48px 28px", background: "#0A2E1E", color: "#A9CDB8" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        <div data-nv="foot-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36, alignItems: "start" }}>
          <div>
            <Logo size={24} onDark />
            <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.7, color: ON_NAVY_MUTED, maxWidth: 320 }}>
              {T("منصة تشغيل مؤسسية تثبت العمل قبل الحكم — تطبيقات مترابطة في مساحة شركة واحدة.", "An institutional ops suite that proves work before judgment — connected apps in one company space.")}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 600, color: ON_NAVY, marginBottom: 4 }}>
              {T("روابط", "Links")}
            </div>
            {FOOT_COMPANY.map((item) => (
              <FootLink key={item.ar} item={item} ar={ar} />
            ))}
          </div>
        </div>

        {lang ? <LegalCertificatesStrip lang={lang} /> : null}

        <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 18, fontSize: 12, color: ON_NAVY_MUTED }}>
          {T("© 2026 NiroVera — نيار عبدالله سويلم الرنياوي · جميع الحقوق محفوظة", "© 2026 NiroVera — Niyar Abdullah Sweilem Al-Raniawi · All rights reserved")}
        </div>
      </div>
    </footer>
  );
}

export default function MarketingChrome({ ar, lang, loggedIn, onToggleLang, children }) {
  usePublicPlatformTheme();
  return (
    <div
      className="powercare-public"
      dir={ar ? "rtl" : "ltr"}
      style={{
        background: SURFACE,
        fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif",
        color: "var(--nv-ink)",
        minHeight: "100vh",
      }}
    >
      <style>{`
        @media (max-width: 900px) {
          [data-nv="navlinks"] { display: none !important; }
          [data-nv="pad"] { padding-left: 22px !important; padding-right: 22px !important; }
          [data-nv="foot-grid"] { grid-template-columns: 1fr !important; gap: 28px !important; }
          [data-nv="cert-grid"] { grid-template-columns: 1fr !important; }
          [data-nv="cert-grid"] > div { border-inline-end: none !important; border-bottom: 1px solid rgba(255,255,255,.1); }
        }
      `}</style>
      <MarketingHeader ar={ar} loggedIn={loggedIn} onToggleLang={onToggleLang} />
      {children}
      <MarketingFooter ar={ar} lang={lang} />
    </div>
  );
}
