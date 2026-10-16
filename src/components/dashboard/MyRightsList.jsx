import React from "react";
import { buildMyRights } from "@/lib/myRights";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { isWeeklyRestDay } from "@/lib/laborHoursPolicy";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { HintAction, ScaleGlyph, StatuteLink } from "@/components/shared/RightHint";

/** A rights-line action becomes a route into طلباتي with the right flow preselected. */
function routeOf(action) {
  if (!action) return null;
  if (action.href) return action;
  if (action.kind === "rights") return { ...action, to: `/app/requests?kind=rights&right=${encodeURIComponent(action.rightsKind || "")}` };
  if (action.kind === "raise") return { ...action, to: "/app/requests" };
  return action.to ? action : null;
}

/**
 * «حقوقي» — the worker's rights in plain lines, one per right, computed from his file
 * (src/lib/myRights.js). A list with thin rules, not cards.
 */
/** Salary rights (payday Art. 90, deduction cap Art. 93) are read in قسيمتي, not repeated elsewhere. */
export const PAY_RIGHT_IDS = ["payday", "deduction-cap"];

export default function MyRightsList({ employee, data, ar = true, title, lede, only = null, exclude = null }) {
  const today = todayRiyadh();
  const calendar = laborCalendarOf(data);
  const lines = buildMyRights({
    employee,
    data,
    today,
    ar,
    isHoliday: (iso) => isOfficialHoliday(iso, calendar),
    isOff: (iso) => isWeeklyRestDay(iso, data) || isOfficialHoliday(iso, calendar),
  });
  const shown = lines.filter((line) => (!only || only.includes(line.id)) && !(exclude && exclude.includes(line.id)));
  if (!employee || !shown.length) return null;
  return (
    <section className="nv-rights" dir={ar ? "rtl" : "ltr"} data-my-rights="1">
      <header className="nv-rights-head">
        <span className="nv-rights-title"><ScaleGlyph size={14} />{title || (ar ? "حقوقي" : "My rights")}</span>
        <span className="nv-rights-lede">{lede || (ar ? "من ملفك — كل سطر برقمه ومادته." : "From your file — each line with its figure and article.")}</span>
      </header>
      <ul className="nv-rights-list">
        {shown.map((line) => (
          <li key={line.id} data-right={line.id}>
            <span className="nv-rights-text">
              <span>{line.text}</span>
              {line.note ? <small>{line.note}</small> : null}
              <span className="nv-rights-meta">
                <StatuteLink law={line.law} ar={ar} onDate={today} />
                {line.action ? <HintAction action={routeOf(line.action)} ar={ar} /> : null}
              </span>
            </span>
            {line.figure ? (
              <span className="nv-rights-fig">
                <b>{line.figure}</b>
                {line.unit ? <small>{line.unit}</small> : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
