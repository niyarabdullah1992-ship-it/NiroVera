import React from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";

/** Same platform calendar as every other date field — kept as an alias for request forms. */
export default function RequestDateField({
  ar,
  value,
  onChange,
  style,
  min,
  max,
  disabled,
}) {
  return (
    <PlatformDateField
      ar={ar}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      disabled={disabled}
      style={style}
    />
  );
}
