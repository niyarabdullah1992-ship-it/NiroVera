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

/** Page switch in the white strip under the band (the «طلباتي» identity). An option may carry a `count` (mono); wraps on a phone. */
export function HeroSwitch({ options = [], value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} data-hero-switch="1" style={{ display: "inline-flex", flexWrap: "wrap", maxWidth: "100%", boxSizing: "border-box", gap: 4, padding: 3, borderRadius: 9, background: "var(--nv-soft, #F5F7F6)", border: "1px solid var(--nv-line, #E4E9E6)" }}>
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
              background: on ? "var(--nv-navy, #0B3D27)" : "transparent",
              color: on ? "#fff" : "var(--nv-ink, #111418)",
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
