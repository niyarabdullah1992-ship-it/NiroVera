import React from "react";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { MUTED, NAVY } from "@/lib/platformStyles";
import { statutoryGlowState } from "@/lib/statutoryItem";

/** Employee-facing list of rules that are actually encoded — Labour Law chips, ministerial tags, no invented المادة. */
export default function AppliedLawList({
  title,
  note,
  ruleIds = [],
  leaveTypes = [],
  profile,
  ar = true,
  onDate,
  employee,
  employees,
  schedule,
  weekStart,
  laborCalendar,
}) {
  const ids = (ruleIds || []).filter(Boolean);
  const types = (leaveTypes || []).filter(Boolean);
  if (!ids.length && !types.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {title ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: NAVY }}>{title}</p>
          {note ? <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{note}</p> : null}
        </div>
      ) : null}
      {ids.map((id) => (
        <LaborArticleCite
          key={id}
          ruleId={id}
          profile={profile}
          onDate={onDate}
          ar={ar}
          showText
          glow={statutoryGlowState({
            kind: id,
            employee,
            employees,
            schedule,
            weekStart: weekStart || onDate,
            laborCalendar,
          })}
        />
      ))}
      {types.map((type) => (
        <LaborArticleCite key={type} leaveType={type} profile={profile} onDate={onDate} ar={ar} showText />
      ))}
    </div>
  );
}
