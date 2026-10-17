import React, { useEffect, useState } from "react";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import TimeFormatToggle from "@/components/attendance/TimeFormatToggle";

function clockLocale(lang) {
  return lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

export default function HeaderDateTime({ lang, className = "" }) {
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
      className={`nv-hdr-seg nv-clock-pill${className ? ` ${className}` : ""}`}
      title={`${dateLabel} · ${timeLabel}`}
    >
      <span className="nv-hdr-date">{dateLabel}</span>
      <time dateTime={now.toISOString()} dir="ltr" className="nv-hdr-time">
        {timeLabel}
      </time>
      <span className="nv-clock-track">
        <TimeFormatToggle lang={lang} compact />
      </span>
    </div>
  );
}
