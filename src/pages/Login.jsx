import React from "react";
import { Link } from "react-router-dom";
import { Building2, Users, LogIn } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useI18n } from "@/lib/i18n";
import { BORDER, CARD, INK, MUTED, NAVY_FILL, SURFACE } from "@/lib/publicChrome";

const PORTALS = [
  {
    to: "/login/company",
    Icon: Building2,
    arTitle: "شركة / مؤسسة",
    enTitle: "Company",
    arText: "دخول مخصص للشركات والمؤسسات — فروع وفرق ميدانية ومسير.",
    enText: "Dedicated access for companies — stations, field teams and payroll.",
    tone: "company",
  },
  {
    to: "/login/individual",
    Icon: Users,
    arTitle: "أفراد",
    enTitle: "Individual",
    arText: "مساحة شخصية مستقلة عن حساب الشركة.",
    enText: "A personal workspace separate from a company account.",
    tone: "individual",
  },
];

export default function Login() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <AuthLayout
      icon={LogIn}
      title={ar ? "اختر بوابة الدخول" : "Choose your portal"}
      subtitle={ar ? "حساب الشركة وحساب الأفراد منفصلان — لكل حساب دخول مخصص" : "Company and individual accounts are separate — each has its own login"}
      footer={
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <Link to="/workspace" style={{ fontWeight: 500, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
            {ar ? "ابحث عن مساحة شركتك" : "Find your company workspace"}
          </Link>
          <Link to="/pricing?org=company" style={{ fontWeight: 500, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
            {ar ? "إنشاء حساب شركة" : "Create company account"}
          </Link>
          <Link to="/" style={{ fontWeight: 500, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
            {ar ? "الرئيسية" : "Home"}
          </Link>
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PORTALS.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              borderRadius: 12,
              border: `1px solid ${p.tone === "company" ? "color-mix(in oklab, var(--nv-navy) 25%, var(--nv-line))" : BORDER}`,
              background: p.tone === "company" ? SURFACE : CARD,
              padding: "16px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                display: "flex",
                height: 40,
                width: 40,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 9,
                background: NAVY_FILL,
                color: "#fff",
              }}
            >
              <p.Icon style={{ width: 20, height: 20 }} strokeWidth={1.6} />
            </span>
            <span style={{ minWidth: 0, textAlign: "start" }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: INK }}>{ar ? p.arTitle : p.enTitle}</span>
              <span style={{ display: "block", marginTop: 4, fontSize: 12.5, lineHeight: 1.6, color: MUTED }}>{ar ? p.arText : p.enText}</span>
            </span>
          </Link>
        ))}
      </div>
    </AuthLayout>
  );
}
