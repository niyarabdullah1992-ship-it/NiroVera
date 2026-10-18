import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildCompanyObligations } from "@/lib/companyObligations";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { isWeeklyRestDay } from "@/lib/laborHoursPolicy";
import { todayRiyadh } from "@/lib/requestWorkspace";
import { ScaleGlyph, StatuteLink } from "@/components/shared/RightHint";
import { StatusFlag } from "@/components/shared/StatusFlag";

const SHOW = 6;

function Line({ row, ar, today }) {
  return (
    <li data-obligation={row.kind}>
      <span className="nv-rights-text">
        <span>
          <strong>{row.what}</strong>
          {row.who ? <span className="nv-ob-who"> · {row.who}</span> : null}
        </span>
        {row.consequence ? <small>{row.consequence}</small> : null}
        <span className="nv-rights-meta">
          <StatuteLink law={row.law} ar={ar} onDate={today} />
          {row.action?.to ? <Link to={row.action.to} className="nv-ob-act">{row.action.label} <span aria-hidden>{ar ? "‹" : "›"}</span></Link> : null}
        </span>
      </span>
      <span className="nv-rights-fig">
        <small>{row.late ? (ar ? "فات" : "Past") : (ar ? "حتى" : "By")}</small>
        <b>{row.dueLabel || "—"}</b>
        {row.late ? <StatusFlag tone="bad" flag={ar ? "متأخر" : "Late"} ar={ar} /> : null}
      </span>
    </li>
  );
}

/**
 * «التزاماتي وحقوقي» on the manager dashboard — duties with legal dates across the people in scope,
 * nearest first, then the company's own time-limited rights. Max six lines with «عرض الكل».
 */
export default function CompanyObligationsList({ employees = [], data, ar = true }) {
  const [all, setAll] = useState(false);
  const today = todayRiyadh();
  const { duties, rights } = useMemo(() => {
    const calendar = laborCalendarOf(data);
    return buildCompanyObligations({
      employees,
      data,
      today,
      ar,
      calendar,
      isHoliday: (iso) => isOfficialHoliday(iso, calendar),
      isOff: (iso) => isWeeklyRestDay(iso, data) || isOfficialHoliday(iso, calendar),
    });
  }, [employees, data, today, ar]);
  const total = duties.length + rights.length;
  if (!total) return null;
  const dutyShown = all ? duties : duties.slice(0, SHOW);
  const rightShown = all ? rights : rights.slice(0, Math.max(0, SHOW - dutyShown.length));
  return (
    <section className="nv-rights" dir={ar ? "rtl" : "ltr"} data-company-obligations="1">
      <header className="nv-rights-head">
        <span className="nv-rights-title"><ScaleGlyph size={14} />{ar ? "التزاماتي وحقوقي" : "My duties and rights"}</span>
        <span className="nv-rights-lede">{ar ? "ما يلزم الشركة بتاريخه النظامي — الأقرب أولاً — ثم ما يحق لها." : "What the company owes by its legal date — nearest first — then what it may claim."}</span>
      </header>
      {dutyShown.length ? (
        <ul className="nv-rights-list">
          {dutyShown.map((row) => <Line key={row.id} row={row} ar={ar} today={today} />)}
        </ul>
      ) : null}
      {rightShown.length ? (
        <>
          <div className="nv-rights-sub">{ar ? "حقوق الشركة" : "Company rights"}</div>
          <ul className="nv-rights-list">
            {rightShown.map((row) => <Line key={row.id} row={row} ar={ar} today={today} />)}
          </ul>
        </>
      ) : null}
      {total > SHOW ? (
        <button type="button" className="nv-rights-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? (ar ? "اختصر" : "Show less") : (ar ? `عرض الكل (${total})` : `Show all (${total})`)}
        </button>
      ) : null}
    </section>
  );
}
