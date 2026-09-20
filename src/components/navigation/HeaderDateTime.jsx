import React, { useEffect, useState } from "react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import TimeFormatToggle from "@/components/attendance/TimeFormatToggle";
import { BORDER, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

function clockLocale(lang) {
  return lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

export default function HeaderDateTime({ lang }) {
  const ar = lang === "ar";
  const { format } = useTimeFormat();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const locale = clockLocale(lang);
  const dateLabel = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
    calendar: "gregory",
  });
  const timeLabel = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: format === "12" ? "h12" : "h23",
  });

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      title={dateLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 34,
        paddingInlineStart: 10,
        paddingInlineEnd: 6,
        borderRadius: 10,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        flexShrink: 0,
        maxWidth: "100%",
      }}
    >
      <span
        className="hidden lg:inline"
        style={{
          fontSize: 11,
          color: MUTED,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {dateLabel}
      </span>
      <span className="hidden lg:block" style={{ width: 1, height: 14, background: BORDER, flexShrink: 0 }} />
      <time
        dateTime={now.toISOString()}
        dir="ltr"
        style={{
          fontFamily: "'IBM Plex Sans',sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: NAVY,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {timeLabel}
      </time>
      <span className="hidden md:block" style={{ width: 1, height: 14, background: BORDER, flexShrink: 0 }} />
      <TimeFormatToggle lang={lang} compact />
    </div>
  );
}
