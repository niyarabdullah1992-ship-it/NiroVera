import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import LegalCertificatesStrip from "@/components/landing/LegalCertificatesStrip";
import {
  BORDER,
  MUTED,
  NAVY_FILL,
  ON_NAVY,
  ON_NAVY_MUTED,
  SURFACE,
  publicBtnGhost,
  publicBtnPrimary,
  usePublicPlatformTheme,
} from "@/lib/publicChrome";

const PAD = { paddingLeft: 48, paddingRight: 48 };

const NAV = [
  { href: "/#proof-cycle", ar: "سلسلة الإثبات", en: "Proof cycle" },
  { href: "/#apps", ar: "التطبيقات", en: "Apps" },
  { href: "/#enterprise-pilot", ar: "للمؤسسات", en: "Enterprise" },
  { href: "/#mhrsd", ar: "الامتثال", en: "Compliance" },
  { href: "/#pricing", ar: "الأسعار", en: "Pricing" },
  { to: "/mobile", ar: "تطبيق الميدان", en: "Field app" },
];

const FOOT_PLATFORM = [
  { href: "/#proof-cycle", ar: "سلسلة الإثبات", en: "Proof cycle" },
  { href: "/#apps", ar: "التطبيقات", en: "Apps" },
  { href: "/#mhrsd", ar: "الامتثال", en: "Compliance" },
  { href: "/#pricing", ar: "الأسعار", en: "Pricing" },
  { to: "/mobile", ar: "تطبيق الميدان", en: "Field app" },
];

const FOOT_COMPANY = [
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

export function MarketingHeader({ ar, loggedIn, onToggleLang, ctaHref = "/#pricing", ctaLabel }) {
  const T = (a, e) => (ar ? a : e);
  return (
    <header
      data-nv="pad"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "color-mix(in oklab, var(--nv-soft, #F7F8FA) 92%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${BORDER}`,
        ...PAD,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", height: 68, display: "flex", alignItems: "center", gap: 20 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", color: "inherit", textDecoration: "none", flexShrink: 0, gap: 10 }}>
          <Logo size={28} />
          <span className="hidden lg:inline" style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: "0.08em" }}>
            ERP
          </span>
        </Link>
        <nav data-nv="navlinks" style={{ flex: 1, display: "flex", alignItems: "center", gap: 22, minWidth: 0 }}>
          {NAV.map((l) =>
            l.to ? (
              <Link key={l.to} to={l.to} style={{ fontSize: 13, color: MUTED, textDecoration: "none", whiteSpace: "nowrap" }}>{T(l.ar, l.en)}</Link>
            ) : (
              <a key={l.href} href={l.href} style={{ fontSize: 13, color: MUTED, textDecoration: "none", whiteSpace: "nowrap" }}>{T(l.ar, l.en)}</a>
            )
          )}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {onToggleLang ? (
            <button type="button" onClick={onToggleLang} style={{ ...publicBtnGhost, fontWeight: 600, color: MUTED, fontSize: 12 }}>
              {ar ? "EN" : "ع"}
            </button>
          ) : null}
          <Link to={loggedIn ? "/app" : "/login"} style={publicBtnGhost}>
            {loggedIn ? T("المنصة", "Platform") : T("دخول", "Sign in")}
          </Link>
          <a href={ctaHref} style={publicBtnPrimary}>
            {ctaLabel || T("أنشئ مساحة شركتك", "Create your company space")}
          </a>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ ar, lang }) {
  const T = (a, e) => (ar ? a : e);
  return (
    <footer data-nv="pad" style={{ padding: "48px 48px 36px", background: NAVY_FILL, color: ON_NAVY }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        <div data-nv="foot-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 36, alignItems: "start" }}>
          <div>
            <Logo size={24} onDark />
            <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.7, color: ON_NAVY_MUTED, maxWidth: 320 }}>
              {T("منصة تشغيل مؤسسية تثبت العمل قبل الحكم — تطبيقات مترابطة في مساحة شركة واحدة.", "An institutional ops suite that proves work before judgment — connected apps in one company space.")}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 600, color: ON_NAVY, marginBottom: 4 }}>
              {T("المنصة", "Platform")}
            </div>
            {FOOT_PLATFORM.map((item) => (
              <FootLink key={item.ar} item={item} ar={ar} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 600, color: ON_NAVY, marginBottom: 4 }}>
              {T("الشركة", "Company")}
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

export default function MarketingChrome({ ar, lang, loggedIn, onToggleLang, children, ctaHref, ctaLabel }) {
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
      <MarketingHeader ar={ar} loggedIn={loggedIn} onToggleLang={onToggleLang} ctaHref={ctaHref} ctaLabel={ctaLabel} />
      {children}
      <MarketingFooter ar={ar} lang={lang} />
    </div>
  );
}
