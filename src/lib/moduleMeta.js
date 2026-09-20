/**
 * Section kickers for PlatformStampShell — group index + Arabic/English group name.
 */
import { SUITE_APPS, SUITE_GROUPS } from "@/lib/suiteApps";
import { formatUiNumber } from "@/lib/dateFormat";

/** @param {string} path e.g. /app/hr */
export function metaForPath(path) {
  const app = SUITE_APPS.find((row) => row.path === path);
  if (!app) return null;

  const group = SUITE_GROUPS.find((g) => g.id === app.group);
  const groupIndex = SUITE_GROUPS.findIndex((g) => g.id === app.group) + 1;

  return {
    appId: app.id,
    path: app.path,
    group: app.group,
    kickerAr: `${formatUiNumber(String(groupIndex).padStart(2, "0"), true)} · ${group?.ar || ""}`,
    kickerEn: `${String(groupIndex).padStart(2, "0")} · ${group?.en || ""}`,
  };
}

export function pageKicker(path, lang = "ar") {
  const meta = metaForPath(path);
  if (!meta) return "NiroVera";
  return lang === "en" ? meta.kickerEn : meta.kickerAr;
}
