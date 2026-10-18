import React, { useMemo } from "react";
import { SectionHead, slab, mono } from "@/components/schedules/scheduleChrome";
import RightHint from "@/components/shared/RightHint";
import { plannedOtWeeks } from "@/lib/otDecisionPlan";
import { citeRule } from "@/lib/laborRules";
import { weekKeyFromDate } from "@/lib/shiftWeek";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { attRightHint } from "@/lib/rightHints.att.js";

const WD_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hoursText(minutes, ar) {
  const h = Math.round((Number(minutes) || 0) / 30) / 2;
  if (!ar) return `${h} h`;
  if (h === 1) return "ساعة";
  if (h === 2) return "ساعتان";
  return `${h} ساعات`;
}

/**
 * جدولي — overtime the published roster plans for me this week (Art. 107). Information, not a request:
 * it is counted only once worked and punched, then recorded on its own and decided in طلباتي.
 */
export default function MyPlannedOvertime({ data, me, weekStart, ar = true }) {
  const today = toRiyadhDateKey();
  const weekKey = weekKeyFromDate(weekStart);
  const rows = useMemo(() => {
    if (!me?.id) return [];
    return plannedOtWeeks(data, [me], { today })
      .filter((group) => group.weekKey === weekKey)
      .flatMap((group) => group.rows)
      .sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
  }, [data, me, today, weekKey]);
  if (!rows.length) return null;
  const art = citeRule("hours.ot.premium", today)?.article || "107";
  const total = rows.reduce((sum, row) => sum + (Number(row.overtimeMinutes) || 0), 0);
  return (
    <section data-my-planned-ot="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={ar ? "إضافي مخطط في جدولك" : "Overtime planned in your roster"}
        note={ar
          ? `هذا الأسبوع ${hoursText(total, true)} — يُحتسب بعد أن تعمله وتثبته البصمة، ثم يُسجَّل تلقائياً وتختار أجر الساعة + 50% أو إجازة تعويضية في طلباتي (المادة ${art}).`
          : `This week ${hoursText(total, false)} — counted once worked and punched, then recorded on its own; you choose hour + 50% or compensatory leave in My Requests (Art. ${art}).`}
        trailing={<RightHint ar={ar} hint={attRightHint("overtime", {}, { view: "employee", ar })} />}
      />
      {rows.map((row) => {
        const d = new Date(`${row.dateKey}T12:00:00`);
        return (
          <div key={row.dateKey} style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", padding: "10px 18px", borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
            <strong style={{ fontSize: 12.5, color: "var(--nv-ink)", minWidth: 64 }}>{(ar ? WD_AR : WD_EN)[d.getDay()]}</strong>
            <span dir="ltr" style={{ ...mono, color: "var(--nv-ink2)", fontSize: 12 }}>{row.dateKey.slice(8, 10)}/{row.dateKey.slice(5, 7)}</span>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>
              <span dir="ltr" style={{ ...mono, fontWeight: 700 }}>{Math.round((Number(row.overtimeMinutes) || 0) / 30) / 2}</span>
              {ar ? " س إضافي" : " h overtime"}
            </span>
            {row.label ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", flex: "1 1 220px" }}>{row.label}</span> : null}
          </div>
        );
      })}
    </section>
  );
}
