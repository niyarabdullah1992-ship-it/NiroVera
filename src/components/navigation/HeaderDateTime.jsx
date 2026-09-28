import React, { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import TimeFormatToggle from "@/components/attendance/TimeFormatToggle";

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
    month: "long",
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
      className="nv-clock-pill"
      title={dateLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 32,
        borderRadius: 9,
        padding: "0 3px 0 12px",
        gap: 10,
        flexShrink: 0,
        maxWidth: "100%",
      }}
    >
      <CalendarDays style={{ width: 16, height: 16, color: "#3C7D50", flexShrink: 0 }} strokeWidth={1.75} />
      <span
        className="hidden lg:inline"
        style={{
          fontSize: 12.5,
          color: "var(--nv-ink, #111418)",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {dateLabel}
      </span>
      <span className="hidden lg:block" aria-hidden style={{ width: 1, height: 18, background: "var(--nv-line, #D5DCD8)", flexShrink: 0 }} />
      <time
        dateTime={now.toISOString()}
        dir="ltr"
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--nv-ink, #111418)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          lineHeight: 1,
          unicodeBidi: "isolate",
        }}
      >
        {timeLabel}
      </time>
      <span className="nv-clock-track" style={{ display: "flex", gap: 2, borderRadius: 7, padding: 2 }}>
        <TimeFormatToggle lang={lang} compact />
      </span>
    </div>
  );
}
