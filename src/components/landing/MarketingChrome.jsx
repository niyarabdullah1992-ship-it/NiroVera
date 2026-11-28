import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import LegalCertificatesStrip from "@/components/landing/LegalCertificatesStrip";
import { SURFACE, usePublicPlatformTheme } from "@/lib/publicChrome";
import { nv7Tab } from "@/components/shared/Nv7SectionHead";
import { isBase44BackendConfigured, openApp, PREVIEW_ACCOUNTS, previewLogin } from "@/lib/localPreview";

const PAD = { paddingLeft: 48, paddingRight: 48 };

/* The public chrome wears the inside's parts: a white top card like the app's header on the paper page,
 * and a deep-green footer like the sidebar rail (gold group labels, white links). */
const RAIL_GOLD = "#E2C57E";
const RAIL_TEXT = "#D6E6DC";

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
  const style = { fontSize: 13, color: RAIL_TEXT, textDecoration: "none", lineHeight: 1.9 };
  if (item.to) return <Link to={item.to} style={style}>{label}</Link>;
  return <a href={item.href} style={style}>{label}</a>;
}

/**
 * «تسجيل الدخول» in the header. With a server it is the link to the login page. In the preview build
 * it opens a small panel right under it: the preview accounts, each a one-tap sign-in (no password,
 * no code), and the full login page below them.
 */
function HeaderSignIn({ ar, loggedIn }) {
  const T = (a, e) => (ar ? a : e);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const preview = !isBase44BackendConfigured();
  useEffect(() => {
    if (!open) return undefined;
    const away = (event) => { if (box.current && !box.current.contains(event.target)) setOpen(false); };
    const esc = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const linkStyle = { ...nv7Tab(true), minWidth: 0, textDecoration: "none" };
  if (loggedIn || !preview) {
    return <Link to={loggedIn ? "/app" : "/login"} style={linkStyle}>{loggedIn ? T("حسابي", "My account") : T("تسجيل الدخول", "Sign in")}</Link>;
  }
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button type="button" data-header-signin="1" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)} style={linkStyle}>
        {T("تسجيل الدخول", "Sign in")}
        <span aria-hidden style={{ fontSize: 10, opacity: 0.8, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>▾</span>
      </button>
      {open ? (
        <div role="menu" data-header-signin-panel="1" dir={ar ? "rtl" : "ltr"} style={{ position: "absolute", top: "calc(100% + 10px)", insetInlineEnd: 0, width: 300, background: "#fff", color: "#0F1A14", borderRadius: 12, boxShadow: "0 18px 44px rgba(6,30,20,.28)", border: "1px solid #E4E9E6", overflow: "hidden", zIndex: 60 }}>
          <div style={{ padding: "12px 14px 10px", background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)", color: "#fff" }}>
            <strong style={{ display: "block", fontSize: 13.5 }}>{T("ادخل المنصة", "Enter the platform")}</strong>
            <span style={{ fontSize: 11, color: "#C5DBCD" }}>{T("نسخة المعاينة — اضغط الحساب، بلا كلمة مرور ولا رمز.", "Preview build — tap an account, no password, no code.")}</span>
          </div>
          {PREVIEW_ACCOUNTS.map((acc) => (
            <button
              key={acc.id}
              type="button"
              role="menuitem"
              data-header-account={acc.id}
              onClick={() => { if (previewLogin(acc.email)) openApp("/app"); }}
              className="nv-hr-row"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", borderTop: "1px solid #EEF1EF", background: "transparent", cursor: "pointer", textAlign: "start", fontFamily: "inherit" }}
            >
              <span aria-hidden style={{ width: 30, height: 30, borderRadius: 999, background: "#E8F1EC", color: "#0B3D27", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(ar ? acc.nameAr : acc.nameEn).split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? acc.nameAr : acc.nameEn}</span>
                <span style={{ fontSize: 11, color: "#6B7570" }}>{ar ? acc.roleAr : acc.roleEn}</span>
              </span>
              <span aria-hidden style={{ fontSize: 12, fontWeight: 700, color: "#0B3D27" }}>{T("دخول ›", "Enter ›")}</span>
            </button>
          ))}
          <Link to="/login/company" onClick={() => setOpen(false)} style={{ display: "block", padding: "10px 14px", borderTop: "1px solid #EEF1EF", background: "#F6F8F7", fontSize: 12, fontWeight: 600, color: "#0B3D27", textDecoration: "none" }}>
            {T("صفحة الدخول بالبريد ›", "Sign in with email ›")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function MarketingHeader({ ar, loggedIn, onToggleLang }) {
  const T = (a, e) => (ar ? a : e);
  return (
    <header data-nv="pad" style={{ position: "sticky", top: 0, zIndex: 50, background: SURFACE, padding: "12px 24px 0" }}>
      <div
        style={{
          maxWidth: 1192,
          margin: "0 auto",
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "0 18px",
          background: "#FFFFFF",
          border: "1px solid #E4E9E6",
          borderRadius: 12,
          boxShadow: "0 1px 2px rgba(12,20,16,.06)",
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", color: "inherit", textDecoration: "none", flexShrink: 0 }}>
          <Logo size={34} />
        </Link>
        <nav data-nv="navlinks" style={{ flex: 1, display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
          {NAV.map((l) =>
            l.to ? (
              <Link key={l.to} to={l.to} style={{ fontSize: 13, color: "#3A4048", textDecoration: "none", whiteSpace: "nowrap" }}>{T(l.ar, l.en)}</Link>
            ) : (
              <a key={l.href} href={l.href} style={{ fontSize: 13, color: "#3A4048", textDecoration: "none", whiteSpace: "nowrap" }}>{T(l.ar, l.en)}</a>
            )
          )}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginInlineStart: "auto" }}>
          {onToggleLang ? (
            <button type="button" onClick={onToggleLang} style={{ height: 34, minWidth: 40, padding: "0 10px", borderRadius: 8, border: "1px solid #E4E9E6", background: "#FFFFFF", color: "#111418", fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {ar ? "EN" : "ع"}
            </button>
          ) : null}
          {/* No trial or «enter» buttons (owner's rule) — one quiet sign-in to the account. */}
          <HeaderSignIn ar={ar} loggedIn={loggedIn} />
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter({ ar, lang }) {
  const T = (a, e) => (ar ? a : e);
  return (
    <footer data-nv="pad" style={{ padding: "0 24px 18px", background: SURFACE }}>
      <div style={{ maxWidth: 1192, margin: "0 auto", background: "#0B3D27", borderRadius: 12, padding: "28px 28px 18px", color: RAIL_TEXT, display: "flex", flexDirection: "column", gap: 26 }}>
        <div data-nv="foot-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36, alignItems: "start" }}>
          <div>
            <Logo size={26} onDark />
            <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.8, color: RAIL_TEXT, maxWidth: 340 }}>
              {T("منصة تشغيل مؤسسية تثبت العمل قبل الحكم — تطبيقات مترابطة في مساحة شركة واحدة.", "An institutional ops suite that proves work before judgment — connected apps in one company space.")}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: RAIL_GOLD, marginBottom: 6 }}>
              {T("روابط", "Links")}
            </div>
            {FOOT_COMPANY.map((item) => (
              <FootLink key={item.ar} item={item} ar={ar} />
            ))}
          </div>
        </div>

        {lang ? <LegalCertificatesStrip lang={lang} /> : null}

        <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 14, fontSize: 12, color: "#A9CDB8" }}>
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
        /* The inside's structure green, whatever navy the legacy public theme put on <html>. */
        "--nv-navy": "#0B3D27",
        "--nv-accent": "#3C7D50",
        fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif",
        color: "var(--nv-ink)",
        minHeight: "100vh",
      }}
    >
      <style>{`
        @media (max-width: 900px) {
          [data-nv="navlinks"] { display: none !important; }
          [data-nv="pad"] { padding-left: 12px !important; padding-right: 12px !important; }
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
