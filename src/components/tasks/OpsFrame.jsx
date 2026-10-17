import React from "react";
import SectionShell from "@/components/shared/SectionShell";
import AttendanceSectionFrame from "@/components/attendance/AttendanceSectionFrame";
import { DutyBoard, DutyTiles } from "@/components/schedules/DutyTiles";
import { DutyHowTo } from "@/components/schedules/ManageDutySide";

/**
 * المهام والعمليات — the same chrome as الحضور والدوام: one green head naming the lane and the page,
 * then the day's figures as tiles, then the work. The three pages (المهام · إثبات العمل · إثبات زائر)
 * are switched from the top strip, so nothing here repeats them.
 */
export default function OpsFrame({ ar = true, lane = "mine", section = null, title, hint, meta = null, tiles = null, howTo = null, side = null, after = null, children }) {
  return (
    <SectionShell bare ar={ar} maxWidth={1320}>
      <AttendanceSectionFrame
        ar={ar}
        lane={lane}
        section={section || (ar ? "المهام والعمليات" : "Tasks & operations")}
        title={title}
        hint={hint}
        meta={meta}
      >
        {tiles ? <DutyTiles>{tiles}</DutyTiles> : null}
        {side ? (
          <div className="nv-ops-board"><DutyBoard main={<>{children}</>} side={side} /></div>
        ) : children}
        {after}
        {howTo && howTo.length ? <DutyHowTo ar={ar} lines={howTo} /> : null}
      </AttendanceSectionFrame>
    </SectionShell>
  );
}

/** Page switch on the green head (light on dark). An option may carry a `count` (mono, ink-on-white when on); wraps on a phone. */
export function HeroSwitch({ options = [], value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} data-hero-switch="1" style={{ display: "inline-flex", flexWrap: "wrap", maxWidth: "100%", boxSizing: "border-box", gap: 4, padding: 3, borderRadius: 9, background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.22)" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(o.value)}
            style={{
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 30,
              minWidth: 72,
              padding: "0 12px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: on ? 700 : 500,
              background: on ? "#fff" : "transparent",
              color: on ? "#0B3D27" : "#fff",
            }}
          >
            {o.label}
            {o.count ? (
              <span dir="ltr" style={{ fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontSize: 10.5, fontWeight: 600, opacity: on ? 0.75 : 0.85 }}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
