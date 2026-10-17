import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NvIcon from "@/components/shared/NvIcon";
import { countdownLabel } from "@/lib/dutyTicker";

/**
 * «راحتك · باقٍ 12:34» — one segment in the header utility group while a break runs, on any page.
 * The clock comes from the app-level ticker (breakClockOf); the seconds tick here only while shown.
 * Past its minutes (a punched break still open): «انتهت راحتك» in the warning ink — one line, no chip.
 */
export default function DutyBreakPill({ clock, ar = true }) {
  const [now, setNow] = useState(() => Date.now());
  const active = !!clock;
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, clock?.endAt]);
  if (!clock) return null;
  const left = clock.endAt - now;
  const over = left <= 0;
  const label = over
    ? (ar ? "انتهت راحتك" : "Break over")
    : (ar ? "راحتك" : "Break");
  const title = over
    ? (ar ? `انتهت راحتك عند ${clock.end} — عُد للعمل` : `Your break ended at ${clock.end} — back to work`)
    : (ar ? `راحتك ${clock.start}–${clock.end} · باقٍ ${countdownLabel(left)}` : `Break ${clock.start}–${clock.end} · ${countdownLabel(left)} left`);
  return (
    <Link
      to={clock.kind === "flex" ? "/app/attendance?focus=break" : "/app/attendance"}
      className="nv-hdr-seg nv-hdr-break"
      data-duty-break={clock.kind}
      data-over={over ? "1" : "0"}
      role="status"
      aria-live="off"
      aria-label={title}
      title={title}
      style={{ textDecoration: "none", color: over ? "var(--nv-warn-ink)" : "var(--nv-ink)" }}
    >
      <NvIcon name="clock" size={14} inline={false} />
      <span>{label}</span>
      {!over ? (
        <>
          <span aria-hidden className="nv-hdr-break-sep" style={{ color: "var(--nv-muted)" }}>· {ar ? "باقٍ" : "left"}</span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--nv-ink)" }}>{countdownLabel(left)}</span>
        </>
      ) : null}
    </Link>
  );
}
