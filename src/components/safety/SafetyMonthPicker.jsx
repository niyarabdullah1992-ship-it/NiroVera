import React from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";

export default function SafetyMonthPicker({ value, lang, onChange }) {
  const ar = lang === "ar";
  return (
    <PlatformDateField
      compact
      granularity="month"
      ar={ar}
      value={value}
      allowClear={false}
      onChange={(next) => next && onChange(next)}
    />
  );
}
