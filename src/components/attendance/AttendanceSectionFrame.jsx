import React from "react";
import { useLocation } from "react-router-dom";
import { Nv7Band, Nv7Strip } from "@/components/shared/Nv7SectionHead";
import { pageKicker } from "@/lib/moduleMeta";

/** Group number for this route («01»…), the same index the «طلباتي» band carries. */
function sectionNumber(pathname, ar) {
  const kicker = pageKicker(String(pathname || "").split("?")[0], ar ? "ar" : "en");
  const head = String(kicker || "").split("·")[0].trim();
  return /^[0-9\u0660-\u0669]+$/.test(head) ? head : "";
}

/**
 * Attendance chrome — the «طلباتي» identity: one green band (number · section, title, one hint),
 * then a white strip for any switch or figures, then the day's work. Lane pages live in the top strip.
 */
export default function AttendanceSectionFrame({
  ar,
  lane = "mine",
  title,
  hint,
  meta = null,
  laneBar = null,
  section = null,
  maxWidth = 1320,
  children,
}) {
  const manage = lane === "manage";
  const { pathname } = useLocation();
  return (
    <div className="nv-att-frame" data-att-lane={manage ? "manage" : "mine"} style={{ width: `min(${maxWidth}px, 100%)`, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="nv-att-hero" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <Nv7Band
          num={sectionNumber(pathname, ar)}
          kicker={section || (ar ? "الحضور والدوام" : "Time & attendance")}
          title={title}
          hint={hint}
        />
        <Nv7Strip meta={meta} />
      </div>

      {laneBar}

      {children}
    </div>
  );
}
