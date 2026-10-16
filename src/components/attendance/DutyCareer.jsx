import React, { useState } from "react";
import { Link } from "react-router-dom";
import { weekdayLabel } from "@/lib/shiftWeek";
import { ART80, CAREER_VISIBLE_YEARS, careerVisibleYears, parseDayKey } from "@/lib/dutyYears";
import { MONTH_NAMES_AR, MONTH_NAMES_EN } from "@/lib/dutySearch";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { chipButton, mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { dutyChip, dutyLabel, dutyTone } from "@/components/schedules/dutyStatus";
import { openLinkStyle } from "@/components/schedules/dutyLinks";

const CAREER_CSS = `
.nv-career-grid { display: grid; grid-template-columns: minmax(0, 2.3fr) repeat(5, minmax(0, 1fr)); gap: 8px; align-items: center; }
.nv-career-lbl { display: none; }
.nv-art80-rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 18px; }
@media (max-width: 640px) {
  .nv-career-head { display: none !important; }
  .nv-career-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px; }
  .nv-career-grid > .nv-career-year { grid-column: 1 / -1; }
  .nv-career-lbl { display: block; font-size: 10.5px; color: var(--nv-muted); font-weight: 500; }
  .nv-art80-rows { grid-template-columns: minmax(0, 1fr); }
}
`;

export function fmtDayKey(key, ar = true, { weekday = false } = {}) {
  const date = parseDayKey(key);
  if (!date) return "";
  const months = ar ? MONTH_NAMES_AR : MONTH_NAMES_EN;
  const base = ar ? `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}` : `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  return weekday ? `${weekdayLabel(date.getDay(), ar)} ${base}` : base;
}

/** «السنة العقدية الحالية» / «السابقة» / «2024–2025» — or «2026» in calendar mode. */
export function yearChipLabel(year, years = [], ar = true) {
  if (!year) return "";
  if (year.mode === "calendar") return String(year.year);
  const current = years.find((row) => row.current);
  if (year.current) return ar ? "الحالية" : "Current";
  if (current && year.index === current.index - 1) return ar ? "السابقة" : "Previous";
  return `${year.start.slice(0, 4)}–${year.end.slice(0, 4)}`;
}

export function yearTitle(year, ar = true) {
  if (!year) return "";
  if (year.mode === "calendar") return ar ? `سنة ${year.year}` : `Year ${year.year}`;
  return ar ? `${fmtDayKey(year.start, ar)} – ${fmtDayKey(year.end, ar)}` : `${fmtDayKey(year.start, ar)} – ${fmtDayKey(year.end, ar)}`;
}

function anchorNote(anchor, ar) {
  const when = fmtDayKey(anchor?.key, ar);
  if (!when) return ar ? "لا تاريخ عقد أو مباشرة في الملف ولا سجل دوام بعد." : "No contract or hire date on file and no duty record yet.";
  if (anchor.source === "contract") return ar ? `السنة العقدية تبدأ من تاريخ بداية العقد في الملف: ${when}.` : `The contract year starts from the contract start on file: ${when}.`;
  if (anchor.source === "hire") return ar ? `السنة العقدية تبدأ من تاريخ المباشرة في الملف: ${when}.` : `The contract year starts from the hire date on file: ${when}.`;
  return ar
    ? `لا تاريخ عقد أو مباشرة في الملف — تبدأ السنة من أول سجل دوام على المنصة: ${when}.`
    : `No contract or hire date on file — the year starts from the first duty record on the platform: ${when}.`;
}

/** عقدية / ميلادية — the same toggle on the year bar and on the career list. */
export function YearModeToggle({ ar, mode, onMode }) {
  return (
    <span role="group" aria-label={ar ? "طريقة حساب السنة" : "Year basis"} style={{ display: "inline-flex", gap: 4 }}>
      <button type="button" aria-pressed={mode === "contract"} onClick={() => onMode?.("contract")} style={chipButton(mode === "contract")}>
        {ar ? "عقدية" : "Contract"}
      </button>
      <button type="button" aria-pressed={mode === "calendar"} onClick={() => onMode?.("calendar")} style={chipButton(mode === "calendar")}>
        {ar ? "ميلادية" : "Calendar"}
      </button>
    </span>
  );
}

const LEVEL_TONE = { none: "ok", some: "rest", notice: "warn", over: "bad" };

function MeterRow({ ar, label, value, limit, notice, level, foot }) {
  const tone = dutyTone(LEVEL_TONE[level] || "rest");
  const pct = Math.min(100, Math.round((value / limit) * 100));
  const tick = Math.round((notice / limit) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, color: "var(--nv-ink)", fontWeight: 600, lineHeight: 1.5 }}>
        {label}: <strong dir="ltr" style={{ ...mono, color: level === "over" || level === "notice" ? tone.ink : "var(--nv-ink)" }}>{value}</strong>
        {ar ? " من " : " of "}
        <span dir="ltr" style={mono}>{limit}</span>
      </span>
      <span
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(value, limit)}
        aria-label={label}
        style={{ position: "relative", height: 8, borderRadius: 999, background: "var(--nv-soft, #F2F4F3)", border: "1px solid var(--nv-line2, #EEF2F7)", overflow: "hidden" }}
      >
        <span style={{ position: "absolute", insetBlock: 0, insetInlineStart: 0, width: `${pct}%`, background: level === "none" ? "transparent" : tone.fill, borderRadius: 999 }} />
        <span aria-hidden title={ar ? `حدّ الإنذار الكتابي: ${notice}` : `Written-warning mark: ${notice}`} style={{ position: "absolute", insetBlock: -1, insetInlineStart: `${tick}%`, width: 2, background: "var(--nv-warn-fill)" }} />
      </span>
      {foot ? <span style={{ fontSize: 11.5, color: level === "notice" || level === "over" ? tone.ink : "var(--nv-muted)", lineHeight: 1.65 }}>{foot}</span> : null}
    </div>
  );
}

/**
 * Article 80(7) as information on one contract year: intermittent days against 30 (warning mark 20)
 * and the longest consecutive run against 15 (warning mark 10). Never a decision.
 */
export function Art80Meter({ ar, reading, compact = false }) {
  if (!reading) return null;
  const { intermittent, consecutive } = reading;
  const interFoot = intermittent.level === "over"
    ? (ar ? "تجاوز ثلاثين يوماً في السنة العقدية — الحالة الواردة في المادة 80 (7)، ويسبق الفصل فيها إنذار كتابي بعد عشرين يوماً، مع إتاحة الفرصة للعامل لبيان أسباب معارضته." : "Over thirty days in the contract year — the Article 80(7) case; a written warning after twenty days precedes dismissal, and the worker is given a chance to state his objection.")
    : intermittent.level === "notice"
      ? (ar ? "بلغ عشرين يوماً — المادة 80 (7) تشترط إنذاراً كتابياً بعد غياب عشرين يوماً قبل أي فصل في هذه الحالة." : "Twenty days reached — Article 80(7) requires a written warning after twenty days of absence before any dismissal in this case.")
      : (ar ? "الحدّ في المادة 80 (7): أكثر من ثلاثين يوماً خلال السنة العقدية الواحدة." : "The Article 80(7) line: more than thirty days within one contract year.");
  const streakRange = consecutive.value > 0 && consecutive.from
    ? (ar ? ` (${fmtDayKey(consecutive.from, ar)} – ${fmtDayKey(consecutive.to, ar)})` : ` (${fmtDayKey(consecutive.from, ar)} – ${fmtDayKey(consecutive.to, ar)})`)
    : "";
  const consFoot = consecutive.level === "over"
    ? (ar ? `أكثر من خمسة عشر يوماً متتالية${streakRange} — الحالة الثانية في المادة 80 (7)، ويسبقها إنذار كتابي بعد انقطاع عشرة أيام.` : `More than fifteen consecutive days${streakRange} — the second Article 80(7) case, preceded by a written warning after ten days.`)
    : consecutive.level === "notice"
      ? (ar ? `انقطاع عشرة أيام فأكثر${streakRange} — المادة 80 (7) تشترط إنذاراً كتابياً في هذه الحالة.` : `Ten or more days of interruption${streakRange} — Article 80(7) requires a written warning in this case.`)
      : (ar ? `الحدّ: أكثر من خمسة عشر يوماً متتالية${streakRange}.` : `The line: more than fifteen consecutive days${streakRange}.`);
  return (
    <div data-art80="1" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="nv-art80-rows">
        <MeterRow
          ar={ar}
          label={ar ? "غياب متقطع في السنة العقدية" : "Intermittent absence this contract year"}
          value={intermittent.value}
          limit={intermittent.limit}
          notice={intermittent.notice}
          level={intermittent.level}
          foot={interFoot}
        />
        <MeterRow
          ar={ar}
          label={ar ? "أطول غياب متتالٍ" : "Longest consecutive absence"}
          value={consecutive.value}
          limit={consecutive.limit}
          notice={consecutive.notice}
          level={consecutive.level}
          foot={consFoot}
        />
      </div>
      {compact ? null : (
        <details style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
          <summary style={{ cursor: "pointer", color: "var(--nv-ink2)", fontWeight: 600 }}>
            {ar ? "قراءة للأيام المسجّلة غياباً — لا قرار. نص المادة 80 (7)" : "A reading of recorded absent days — not a decision. Article 80(7) text"}
          </summary>
          <p style={{ margin: "6px 0 0" }}>{ar ? ART80.textAr : ART80.textEn}</p>
          <p style={{ margin: "4px 0 0" }}>
            {ar
              ? "يُعدّ هنا كل يوم مجدول بلا بصمة ولا إجازة معتمدة. الغياب بسبب مشروع لا يدخل في حكم المادة، والإجازة المعتمدة خارج الحساب. أيام الراحة والإجازات الرسمية بين يومي غياب لا تُعدّ ولا تقطع التتابع."
              : "Every scheduled day with no punch and no approved leave is counted here. Absence for a legitimate reason is outside the article; approved leave is outside the count. Rest days and official holidays between two absent days neither count nor break the run."}
          </p>
        </details>
      )}
    </div>
  );
}

/**
 * Year switcher for سجلي / the file: the covered years as chips, عقدية / ميلادية, the anchor note,
 * «تُحسب من جديد كل سنة», and the Article 80 meter on a contract year.
 */
function YearPicker({ ar, years = [], value = "", onPick, label }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--nv-muted)" }}>
      <span>{label || (ar ? "اذهب إلى سنة" : "Go to year")}</span>
      <select
        data-year-picker="1"
        value={value}
        onChange={(event) => onPick?.(event.target.value)}
        style={{ fontFamily: "inherit", fontSize: 12.5, height: 32, padding: "0 8px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-card)", color: "var(--nv-ink)" }}
      >
        <option value="">—</option>
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.mode === "calendar" ? yearTitle(year, ar) : `${ar ? `السنة العقدية ${year.index + 1}` : `Contract year ${year.index + 1}`} · ${yearTitle(year, ar)}`}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DutyYearBar({ ar, title, years = [], selected, onSelect, mode, onMode, anchor }) {
  const covered = years.filter((year) => year.covered);
  const resetNote = mode === "calendar"
    ? (ar ? "تُحسب من جديد كل سنة ميلادية — من 1 يناير إلى 31 ديسمبر." : "Counts restart every calendar year — 1 January to 31 December.")
    : (ar ? "تُحسب من جديد كل سنة عقدية." : "Counts restart every contract year.");
  return (
    <section data-year-bar="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <style>{CAREER_CSS}</style>
      <SectionHead
        title={title}
        note={`${resetNote} ${anchorNote(anchor, ar)}`}
        trailing={<YearModeToggle ar={ar} mode={mode} onMode={onMode} />}
      />
      <div style={{ padding: "12px 18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div role="group" aria-label={ar ? "السنة" : "Year"} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {covered.length ? careerVisibleYears(covered, { openId: selected?.id }).shown.map((year) => (
            <button
              key={year.id}
              type="button"
              data-year={year.id}
              aria-pressed={selected?.id === year.id}
              onClick={() => onSelect?.(year.id)}
              title={yearTitle(year, ar)}
              style={chipButton(selected?.id === year.id)}
            >
              {mode === "contract" && year.current ? (ar ? "السنة العقدية الحالية" : "Current contract year") : yearChipLabel(year, years, ar)}
            </button>
          )) : <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "لا سنة مسجّلة بعد." : "No recorded year yet."}</span>}
          {covered.length > CAREER_VISIBLE_YEARS ? (
            <YearPicker ar={ar} years={covered} value={selected?.id || ""} onPick={(id) => id && onSelect?.(id)} label={ar ? "سنة أخرى" : "Another year"} />
          ) : null}
          {selected ? (
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", marginInlineStart: 4 }}>
              {yearTitle(selected, ar)}
              {selected.partial ? (ar ? ` · السجل من ${fmtDayKey(selected.from, ar)}` : ` · recorded from ${fmtDayKey(selected.from, ar)}`) : ""}
            </span>
          ) : null}
        </div>
        {selected && mode === "contract" ? <Art80Meter ar={ar} reading={selected.art80} /> : null}
        {selected && mode === "calendar" ? (
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
            {ar ? "المادة 80 (7) تقرأ الغياب على السنة العقدية — بدّل إلى «عقدية» لقراءة حدودها." : "Article 80(7) reads absence on the contract year — switch to “Contract” to read its lines."}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, children }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span className="nv-career-lbl">{label}</span>
      <span style={{ fontSize: 13, color: "var(--nv-ink)", fontWeight: 600 }}>{children}</span>
    </span>
  );
}

// KPI law: counts stay ink; the tone argument is kept for callers but no longer colours the figure.
function num(value, _tone) {
  return <strong dir="ltr" style={{ ...mono, fontSize: 14, color: "var(--nv-ink)" }}>{value}</strong>;
}

/**
 * «مسيرتي — الغياب والتأخير عبر السنوات»: one row per year since the contract start, newest first,
 * every count restarting with the year. A row opens its days. Read-only.
 */
export function DutyCareerSection({ ar, title, note, years = [], mode, onMode, dayHref, onDay, openId: openProp = "", focusDay = "" }) {
  const [openId, setOpenId] = useState(openProp);
  const [all, setAll] = useState({});
  const [seenProp, setSeenProp] = useState(openProp);
  if (openProp !== seenProp) {
    setSeenProp(openProp);
    if (openProp) setOpenId(openProp);
  }
  const [showAll, setShowAll] = useState(false);
  const covered = years.filter((year) => year.covered);
  const before = years.filter((year) => !year.covered);
  const { shown: visibleYears, hidden: hiddenYears } = careerVisibleYears(covered, { openId, showAll });
  const pickYear = (id) => {
    if (!id) return;
    setOpenId(id);
    window.requestAnimationFrame?.(() => document.querySelector(`[data-career-year="${id}"]`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }));
  };
  const labels = ar
    ? ["السنة", "الغياب", "أطول تتابع", "مرات التأخير", "دقائق التأخير", "الإجازة"]
    : ["Year", "Absent", "Longest run", "Late", "Late minutes", "Leave"];
  return (
    <section id="duty-career" data-duty-career="1" style={{ ...slab, overflow: "hidden" }}>
      <style>{CAREER_CSS}</style>
      <SectionHead
        title={title}
        note={note || (ar ? "صف لكل سنة منذ المباشرة، الأحدث أولاً — كل سنة تبدأ العدّ من الصفر. اضغط سنة لترى أيامها." : "One row per year since hire, newest first — every year starts from zero. Open a year for its days.")}
        trailing={(
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {covered.length > CAREER_VISIBLE_YEARS ? <YearPicker ar={ar} years={covered} value={openId} onPick={pickYear} /> : null}
            <YearModeToggle ar={ar} mode={mode} onMode={onMode} />
          </span>
        )}
      />
      {covered.length ? (
        <div className="nv-career-grid nv-career-head" style={{ padding: "8px 18px", fontSize: 11, color: "var(--nv-muted)", background: "var(--nv-soft, #F7F8FA)", borderBottom: "1px solid var(--nv-line2)" }}>
          {labels.map((label) => <span key={label}>{label}</span>)}
        </div>
      ) : null}
      {visibleYears.map((year) => {
        const open = openId === year.id;
        const t = year.tally;
        const list = t.notable.slice().reverse();
        const shown = all[year.id] ? list : list.slice(0, 40);
        return (
          <div key={year.id} data-career-year={year.id} style={{ borderBottom: "1px solid var(--nv-line2)" }}>
            <button
              type="button"
              className="nv-career-grid"
              aria-expanded={open}
              onClick={() => setOpenId(open ? "" : year.id)}
              style={{ fontFamily: "inherit", textAlign: "start", width: "100%", border: "none", background: open ? "var(--nv-hover, #F2F5F3)" : "transparent", cursor: "pointer", padding: "11px 18px" }}
            >
              <span className="nv-career-year" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span aria-hidden style={{ fontSize: 10, color: "var(--nv-muted)" }}>{open ? "▾" : "▸"}</span>
                  <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>
                    {year.mode === "calendar" ? yearTitle(year, ar) : (ar ? `السنة العقدية ${year.index + 1}` : `Contract year ${year.index + 1}`)}
                  </strong>
                  {year.current ? <span style={dutyChip("ok", { height: 20, fontSize: 10 })}>{ar ? "الحالية" : "Current"}</span> : null}
                  {year.art80 && (year.art80.intermittent.level === "over" || year.art80.consecutive.level === "over") ? (
                    <span style={dutyChip("bad", { height: 20, fontSize: 10 })}>{ar ? "تجاوز حدّ المادة 80" : "Over Art. 80 line"}</span>
                  ) : year.art80 && (year.art80.intermittent.level === "notice" || year.art80.consecutive.level === "notice") ? (
                    <span style={dutyChip("warn", { height: 20, fontSize: 10 })}>{ar ? "بلغ حدّ الإنذار" : "Warning mark"}</span>
                  ) : null}
                </span>
                <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
                  {year.mode === "calendar" ? (year.partial || year.from > year.start ? (ar ? `من ${fmtDayKey(year.from, ar)}` : `from ${fmtDayKey(year.from, ar)}`) : (ar ? "1 يناير – 31 ديسمبر" : "1 Jan – 31 Dec")) : yearTitle(year, ar)}
                  {year.partial && year.mode === "contract" ? (ar ? ` · السجل من ${fmtDayKey(year.from, ar)}` : ` · recorded from ${fmtDayKey(year.from, ar)}`) : ""}
                </span>
              </span>
              <Stat label={labels[1]}>{num(t.absent, "bad")} <span style={{ fontSize: 11, color: "var(--nv-muted)", fontWeight: 500 }}>{ar ? "يوم" : "d"}</span></Stat>
              <Stat label={labels[2]}>{num(t.maxStreak, t.maxStreak >= ART80.consecutiveNotice ? "warn" : null)}</Stat>
              <Stat label={labels[3]}>{num(t.lateDays, "warn")}</Stat>
              <Stat label={labels[4]}>{num(t.lateMinutes, "warn")} <span style={{ fontSize: 11, color: "var(--nv-muted)", fontWeight: 500 }}>{ar ? "د" : "min"}</span></Stat>
              <Stat label={labels[5]}>{num(t.leave)}{t.holiday ? <span style={{ fontSize: 11, color: "var(--nv-muted)", fontWeight: 500 }}>{ar ? " · رسمية " : " · official "}<span dir="ltr" style={mono}>{t.holiday}</span></span> : null}</Stat>
            </button>
            {open ? (
              <div data-career-days={year.id} style={{ padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {year.art80 ? <div style={{ padding: "8px 0 4px" }}><Art80Meter ar={ar} reading={year.art80} compact /></div> : null}
                {!list.length ? (
                  <span style={{ fontSize: 12.5, color: "var(--nv-muted)", padding: "6px 0" }}>
                    {ar ? "لا غياب ولا تأخير مسجّل في هذه السنة." : "No absence or lateness on record this year."}
                  </span>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                    {shown.map((day) => {
                      const late = day.status === "late" || (day.lateMinutes > 0 && day.inAt);
                      const href = dayHref ? dayHref(day) : "";
                      const body = (
                        <>
                          <span style={{ fontSize: 12.5, color: "var(--nv-ink)", fontWeight: 600, minWidth: 0, flex: "1 1 auto" }}>{fmtDayKey(day.key, ar, { weekday: true })}</span>
                          {late && day.lateMinutes > 0 && day.inAt ? (
                            <span style={{ fontSize: 11.5, color: "var(--nv-warn-ink)", whiteSpace: "nowrap" }}>
                              <span dir="ltr" style={mono}>+{day.lateMinutes}</span> {ar ? "د" : "min"}
                            </span>
                          ) : null}
                          <span style={dutyChip(day.status, { height: 22, fontSize: 10.5 })}>{day.status === "holiday" && day.off ? (ar ? day.off.labelAr || dutyLabel("holiday", ar) : day.off.labelEn || dutyLabel("holiday", ar)) : dutyLabel(day.status, ar)}</span>
                        </>
                      );
                      const rowStyle = {
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 8px",
                        borderRadius: DS_CONTROL_RADIUS,
                        borderBottom: "1px solid var(--nv-line2)",
                        textDecoration: "none",
                        color: "inherit",
                        background: focusDay === day.key ? "var(--nv-hover, #F2F5F3)" : "transparent",
                        outline: focusDay === day.key ? "2px solid var(--nv-navy)" : "none",
                        outlineOffset: -2,
                      };
                      return (
                        <li key={day.key} data-career-day={day.key}>
                          {href ? (
                            <Link to={href} style={rowStyle}>{body}</Link>
                          ) : onDay ? (
                            <button type="button" onClick={() => onDay(day)} style={{ ...rowStyle, width: "100%", border: "none", borderBottom: rowStyle.borderBottom, fontFamily: "inherit", cursor: "pointer", textAlign: "start" }}>{body}</button>
                          ) : (
                            <span style={rowStyle}>{body}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {list.length > shown.length ? (
                  <button type="button" onClick={() => setAll((prev) => ({ ...prev, [year.id]: true }))} style={openLinkStyle({ alignSelf: "flex-start" })}>
                    {ar ? `عرض كل الأيام (${list.length}) ›` : `Show all days (${list.length}) ›`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {hiddenYears > 0 || (showAll && covered.length > CAREER_VISIBLE_YEARS) ? (
        <button
          type="button"
          data-career-more="1"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
          style={{ fontFamily: "inherit", width: "100%", textAlign: "start", border: "none", borderBottom: "1px solid var(--nv-line2)", background: "var(--nv-soft, #F7F8FA)", padding: "10px 18px", fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", cursor: "pointer" }}
        >
          {showAll
            ? (ar ? "إخفاء السنوات الأقدم ▴" : "Hide older years ▴")
            : (ar ? `السنوات الأقدم (${hiddenYears}) ▾` : `Older years (${hiddenYears}) ▾`)}
        </button>
      ) : null}
      {before.length ? (
        <div data-career-before="1" style={{ padding: "11px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--nv-muted)" }}>
          <span style={dutyChip("rest", { height: 22, fontSize: 10.5 })}>{ar ? "لا سجل" : "No record"}</span>
          <span style={{ lineHeight: 1.7 }}>
            {ar
              ? `${before.length === 1 ? "سنة واحدة" : before.length === 2 ? "سنتان" : `${before.length} سنوات`} قبل بدء السجل على المنصة (${fmtDayKey(before[before.length - 1].start, ar)} – ${fmtDayKey(before[0].end, ar)}) — لا يُعدّ فيها غياب ولا تأخير.`
              : `${before.length} year(s) before the platform record began — nothing is counted for them.`}
          </span>
        </div>
      ) : null}
      {!years.length ? (
        <div style={{ padding: "14px 18px", fontSize: 12.5, color: "var(--nv-muted)" }}>
          {ar ? "لا سجل دوام بعد — تبدأ المسيرة من أول يوم مسجّل." : "No duty record yet — the career starts on the first recorded day."}
        </div>
      ) : null}
    </section>
  );
}
