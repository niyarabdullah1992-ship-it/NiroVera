import React from "react";
import AttHubTabRail from "@/components/attendance/AttHubTabRail";

/**
 * Primary attendance hub chrome — tab rail only.
 * Date, live clock, and 12/24 live in the global header.
 */
export default function AttendanceExtraToolbar({
  lang,
  tabs = [],
  activeTab,
  onSelect,
}) {
  const ar = lang === "ar";
  if (!tabs.length) return null;

  return (
    <AttHubTabRail
      dir={ar ? "rtl" : "ltr"}
      tabs={tabs}
      active={activeTab}
      onChange={onSelect}
    />
  );
}
