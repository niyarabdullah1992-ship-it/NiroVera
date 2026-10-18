import React from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import NotificationPrefsCard from "@/components/hr/NotificationPrefsCard";
import PlatformColorThemeCard from "@/components/hr/PlatformColorThemeCard";
import PlatformLoginMailCard from "@/components/hr/PlatformLoginMailCard";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";
import PlatformIconsCard from "@/components/hr/PlatformIconsCard";

/** Settings keeps personal notice kinds, the platform colors and its icon family. */
export default function CompanySettings() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser } = useAuth();
  if (!data || !currentUser) return null;

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/settings", lang)}
      title={ar ? "الإعدادات" : "Settings"}
      hint={ar ? "ما يصل إلى جرسك، وألوان المنصة ورموزها." : "What reaches your bell, and the platform colors and icons."}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <NotificationPrefsCard lang={lang} />
        <PlatformColorThemeCard lang={lang} />
        <PlatformIconsCard lang={lang} />
        <PlatformLoginMailCard lang={lang} />
      </div>
    </PlatformStampShell>
  );
}
