import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Building2, Users } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import PowerCareLoginPanel from "@/components/auth/PowerCareLoginPanel";
import { useI18n } from "@/lib/i18n";
import { isBase44BackendConfigured } from "@/lib/localPreview";
import { BORDER, INK, MUTED, NAVY, SURFACE } from "@/lib/publicChrome";

const META = {
  company: {
    Icon: Building2,
    arTitle: "دخول الشركات",
    enTitle: "Company login",
    arSub: "حساب الشركة فقط.",
    enSub: "Company accounts only.",
    register: "/pricing?org=company",
    registerAr: "إنشاء حساب شركة",
    registerEn: "Create company account",
  },
  individual: {
    Icon: Users,
    arTitle: "دخول الأفراد",
    enTitle: "Individual login",
    arSub: "المساحة الشخصية فقط.",
    enSub: "Personal workspace only.",
    register: "/pricing?org=individual",
    registerAr: "إنشاء حساب فردي",
    registerEn: "Create individual account",
  },
};

export default function LoginPortal() {
  const { portal } = useParams();
  const { lang } = useI18n();
  const ar = lang === "ar";
  if (portal === "gov") return <Navigate to="/login/company" replace />;
  const kind = portal === "individual" ? "individual" : "company";
  const meta = META[kind];
  const cloudReady = isBase44BackendConfigured();
  const returnPath = `/login/${kind}`;

  return (
    <AuthLayout
      icon={meta.Icon}
      title={ar ? meta.arTitle : meta.enTitle}
      subtitle={ar ? meta.arSub : meta.enSub}
      footer={
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <Link to={meta.register} style={{ fontWeight: 500, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
            {ar ? meta.registerAr : meta.registerEn}
          </Link>
          <Link to="/login" style={{ fontWeight: 500, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
            {ar ? "تغيير بوابة الدخول" : "Change portal"}
          </Link>
          <Link to="/" style={{ fontWeight: 500, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
            {ar ? "الرئيسية" : "Home"}
          </Link>
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            borderRadius: 9,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            padding: "8px 12px",
            textAlign: "center",
            fontSize: 12,
            fontWeight: 500,
            color: NAVY,
          }}
        >
          {ar
            ? (kind === "individual" ? "بوابة أفراد" : "بوابة شركات")
            : (kind === "individual" ? "Individual portal" : "Company portal")}
        </div>
        {!cloudReady && (
          <p style={{ textAlign: "center", fontSize: 11, lineHeight: 1.6, color: MUTED }}>
            {ar
              ? "نسخة المعاينة — الدخول بلا كلمة مرور ولا رمز: اضغط الحساب، أو اكتب بريده ثم «تسجيل الدخول»."
              : "Preview build — no password and no code: tap an account, or type its email and sign in."}
          </p>
        )}
        <PowerCareLoginPanel fixedKind={kind} returnPath={returnPath} />
      </div>
    </AuthLayout>
  );
}
