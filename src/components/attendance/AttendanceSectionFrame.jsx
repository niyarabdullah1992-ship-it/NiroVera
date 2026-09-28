import React from "react";
import { Link } from "react-router-dom";
import Nv7SectionHead, { nv7Tab } from "@/components/shared/Nv7SectionHead";

/** HTML-faithful attendance chrome — two sharp slabs, then the day's work. */
export default function AttendanceSectionFrame({
  ar,
  kicker,
  tabs = [],
  tool,
  onTool,
  laneBar = null,
  lane = "mine",
  children,
}) {
  return (
    <div className="nv-att-frame" style={{ width: "min(1320px, 100%)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <Nv7SectionHead
        kicker={kicker}
        title={ar ? "الحضور" : "Attendance"}
        hint={ar ? (
          <>
            سؤالان: مَن يسجّل، وأين هو. البصمة من الجدول فقط.{" "}
            <Link to={lane === "manage" ? "/app/shifts?lane=manage" : "/app/shifts"} style={{ color: "#C5DBCD", fontWeight: 700, textDecoration: "underline" }}>جدول الدوام</Link>
            {" "}و{" "}
            <Link to={lane === "manage" ? "/app/calendar?lane=manage" : "/app/calendar"} style={{ color: "#C5DBCD", fontWeight: 700, textDecoration: "underline" }}>التقويم التشغيلي</Link>
            {" "}سطحان في المجموعة نفسها.
          </>
        ) : (
          <>
            Two questions: who punches, and where. The punch follows the roster only.{" "}
            <Link to={lane === "manage" ? "/app/shifts?lane=manage" : "/app/shifts"} style={{ color: "#C5DBCD", fontWeight: 700, textDecoration: "underline" }}>The duty roster</Link>
            {" and "}
            <Link to={lane === "manage" ? "/app/calendar?lane=manage" : "/app/calendar"} style={{ color: "#C5DBCD", fontWeight: 700, textDecoration: "underline" }}>the operational calendar</Link>
            {" are surfaces in the same group."}
          </>
        )}
        tabs={tabs.length > 1 ? (
          <div className="nv-att-tabs" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tabs.map((item) => {
              const on = tool === item.key;
              return (
                <button key={item.key} type="button" onClick={() => onTool?.(item.key)} style={nv7Tab(on)}>
                  {item.label}
                  {item.count > 0 ? (
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, background: on ? "#0B3D27" : "rgba(255,255,255,.24)", color: "#fff", padding: "1px 6px", borderRadius: 3 }}>
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      />

      {laneBar}

      {children}
    </div>
  );
}
