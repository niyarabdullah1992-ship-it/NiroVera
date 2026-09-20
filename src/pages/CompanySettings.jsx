import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import OrgTypeSettings from "@/components/hr/OrgTypeSettings";
import CompanySettingsBoard from "@/components/hr/CompanySettingsBoard";
import DesignSystemBoard from "@/components/hr/DesignSystemBoard";
import PlatformColorThemeCard from "@/components/hr/PlatformColorThemeCard";
import BrandingSettingsCard from "@/components/reports/BrandingSettingsCard";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";
import { ChromeBox } from "@/components/shared/IdentityCard";
import { ACCENT, BORDER, INK, MUTED, SURFACE } from "@/lib/platformStyles";

/** Platform `settings` — company, geofence, permissions, delegation. */
export default function CompanySettings() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser } = useAuth();
  if (!data || !currentUser) return null;

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/settings", lang)}
      title={ar ? "إعدادات الشركة" : "Company settings"}
      hint={ar ? "الشركة، الموقع الجغرافي، الصلاحيات، والتفويض." : "Company, geofence, permissions, and delegation."}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <DesignSystemBoard ar={ar} />
        <OrgTypeSettings lang={lang} />
        <PlatformColorThemeCard lang={lang} />
        <BrandingSettingsCard lang={lang} />
        <CompanySettingsBoard lang={lang} />
        {/* The compliance centre has one home under HR — this is the pointer to it. */}
        <ChromeBox>
          <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: ACCENT, fontWeight: 600 }}>
            {ar ? "وزارة الموارد البشرية والتنمية الاجتماعية" : "MHRSD"}
          </div>
          <div style={{ marginTop: "6px", fontSize: "13px", fontWeight: 600, color: INK }}>
            {ar ? "مركز امتثال الموارد البشرية" : "HR compliance centre"}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: MUTED, lineHeight: 1.7, maxWidth: "660px" }}>
            {ar
              ? "نطاقات ورقم منشأة التأمينات وتنبيهات الوثائق تعيش في مكان واحد داخل الموارد البشرية — لا نسخة ثانية هنا حتى لا يختلف رقمان على شاشتين."
              : "Nitaqat, the GOSI establishment number and document alerts live in one place under Human Resources — no second copy here, so two screens can never disagree."}
          </p>
          <Link
            to="/app/hr?tab=compliance"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "34px",
              marginTop: "14px",
              padding: "0 14px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: SURFACE,
              color: INK,
              fontSize: "12px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            {ar ? "افتح مركز الامتثال" : "Open the compliance centre"}
          </Link>
        </ChromeBox>
      </div>
    </PlatformStampShell>
  );
}
