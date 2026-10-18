import React, { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { chipButton, mono } from "@/components/schedules/scheduleChrome";
import DateJumpPopover from "@/components/schedules/DateJumpPopover";

/**
 * DateNav — the one date control of «الحضور والدوام».
 *
 * [ › السابق ] [ label → month/year jump popover ] [ التالي ‹ ] [ اليوم / الأسبوع الجاري / الشهر الجاري ]
 *
 * RTL: previous sits on the start (right) side and points right; next sits on the end (left) and
 * points left. Digits live in inline dir="ltr" spans only. The «current» button is muted and
 * disabled when the period on screen is already the current one.
 *
 * The component holds no date state — callers keep their own cursor and handlers.
 *   mode       "day" | "week" | "month" — drives the label, the picker and the current-button word.
 *   value      Date inside the shown period (week: any day of the week; month: any day of the month).
 *   onPrev / onNext / onToday   step handlers (owned by the caller).
 *   onPick(date)  picker result as a local Date (month → 1st of the month; week → the picked day).
 *   isCurrent  true when the shown period is the current one (disables the current button).
 *   step       unit the arrows move by when it differs from `mode` (e.g. a month grid with a day label).
 *   min / max  optional bounds (YYYY-MM-DD / YYYY-MM / Date) for the jump popover — cells outside are
 *              disabled. Default: no limit (the roster may look ahead; personal records stop at today).
 *   anchor     optional contract-year anchor (day key) — adds «بداية السنة العقدية» to the quick chips.
 */

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WD_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DATE_NAV_HEIGHT = 36;

const UNIT = {
  day: { ar: "اليوم", en: "day", prevAr: "اليوم السابق", nextAr: "اليوم التالي", currentAr: "اليوم", currentEn: "Today" },
  week: { ar: "الأسبوع", en: "week", prevAr: "الأسبوع السابق", nextAr: "الأسبوع التالي", currentAr: "الأسبوع الجاري", currentEn: "This week" },
  month: { ar: "الشهر", en: "month", prevAr: "الشهر السابق", nextAr: "الشهر التالي", currentAr: "الشهر الجاري", currentEn: "This month" },
};

const pad = (n) => String(n).padStart(2, "0");
const sundayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());

const Num = ({ children }) => <span dir="ltr" style={{ ...mono, unicodeBidi: "isolate" }}>{children}</span>;

/** Label parts in logical order — the RTL flex row places the first part on the right. */
export function dateNavLabel(mode, value, ar = true) {
  const d = value instanceof Date ? value : new Date(value);
  const months = ar ? MONTHS_AR : MONTHS_EN;
  if (mode === "month") {
    return { text: `${months[d.getMonth()]} ${d.getFullYear()}`, parts: [months[d.getMonth()], <Num key="y">{d.getFullYear()}</Num>] };
  }
  if (mode === "week") {
    const a = sundayOf(d);
    const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6);
    const sameMonth = a.getMonth() === b.getMonth();
    const sameYear = a.getFullYear() === b.getFullYear();
    const parts = [<Num key="a">{a.getDate()}</Num>];
    if (!sameMonth) parts.push(months[a.getMonth()]);
    if (!sameYear) parts.push(<Num key="ay">{a.getFullYear()}</Num>);
    parts.push(<span key="dash" aria-hidden style={{ color: "var(--nv-muted)" }}>–</span>);
    parts.push(<Num key="b">{b.getDate()}</Num>, months[b.getMonth()], <Num key="by">{b.getFullYear()}</Num>);
    const text = `${a.getDate()}${sameMonth ? "" : ` ${months[a.getMonth()]}`}${sameYear ? "" : ` ${a.getFullYear()}`} – ${b.getDate()} ${months[b.getMonth()]} ${b.getFullYear()}`;
    return { text, parts };
  }
  const wd = (ar ? WD_AR : WD_EN)[d.getDay()];
  return {
    text: `${wd}${ar ? "،" : ","} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`,
    parts: [`${wd}${ar ? "،" : ","}`, <Num key="d">{d.getDate()}</Num>, months[d.getMonth()], <Num key="y">{d.getFullYear()}</Num>],
  };
}

const DATE_NAV_CSS = `
.nv-date-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; max-width: 100%; }
.nv-date-nav__box { display: inline-flex; align-items: stretch; height: ${DATE_NAV_HEIGHT}px; box-sizing: border-box; border: 1px solid var(--nv-line, #E2E8F0); border-radius: ${DS_CONTROL_RADIUS}px; background: var(--nv-card, #fff); overflow: hidden; min-width: 0; max-width: 100%; flex: 0 1 auto; }
.nv-date-nav__step, .nv-date-nav__label, .nv-date-nav__now { font-family: inherit; font-size: 13px; line-height: 1; letter-spacing: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.nv-date-nav__step { border: none; background: transparent; color: var(--nv-ink2, #334155); padding: 0 10px; font-weight: 500; flex: 0 0 auto; }
.nv-date-nav__slot { position: relative; display: flex; min-width: 0; flex: 1 1 auto; }
.nv-date-nav__label { border: none; border-inline: 1px solid var(--nv-line, #E2E8F0); background: transparent; color: var(--nv-ink, #0F172A); font-weight: 700; padding: 0 14px; min-width: 0; flex: 1 1 auto; justify-content: center; height: 100%; }
.nv-date-nav__label > .nv-date-nav__text { display: inline-flex; align-items: baseline; gap: 5px; overflow: hidden; text-overflow: ellipsis; }
.nv-date-nav__now { height: ${DATE_NAV_HEIGHT}px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--nv-line, #E2E8F0); border-radius: ${DS_CONTROL_RADIUS}px; background: var(--nv-card, #fff); color: var(--nv-ink, #0F172A); font-weight: 600; flex: 0 0 auto; }
.nv-date-nav__now:disabled { cursor: default; color: var(--nv-ink3, var(--nv-muted, #94A3B8)); background: var(--nv-soft, #F7F8FA); }
.nv-date-nav__step:hover, .nv-date-nav__label:hover, .nv-date-nav__label[aria-expanded="true"], .nv-date-nav__now:not(:disabled):hover { background: var(--nv-hover, #F2F5F3); }
.nv-date-nav button:focus-visible { outline: 2px solid var(--nv-navy, #14284B); outline-offset: -2px; }
.nv-date-nav__note { font-size: 12px; color: var(--nv-muted); white-space: nowrap; }
.nv-date-nav__chips { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
@media (max-width: 640px) {
  .nv-date-nav__word { display: none; }
  .nv-date-nav__step { padding: 0 9px; }
  .nv-date-nav__label { padding: 0 10px; font-size: 12.5px; }
  .nv-date-nav__box { flex: 1 1 auto; }
}
`;

export default function DateNav({
  mode = "day",
  value,
  onPrev,
  onNext,
  onToday,
  onPick,
  isCurrent = false,
  step,
  ar = true,
  currentLabel,
  note,
  min,
  max,
  anchor,
  className = "",
  style,
  ...rest
}) {
  const labelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const unit = UNIT[step || mode] || UNIT.day;
  const label = dateNavLabel(mode, date, ar);
  const prevAria = ar ? unit.prevAr : `Previous ${unit.en}`;
  const nextAria = ar ? unit.nextAr : `Next ${unit.en}`;
  const nowWord = currentLabel || (ar ? UNIT[mode].currentAr : UNIT[mode].currentEn);
  const pickAria = ar ? `اختر ${UNIT[mode].ar} — ${label.text}` : `Pick a ${UNIT[mode].en} — ${label.text}`;

  const openPicker = () => {
    if (!onPick) return;
    setOpen((was) => !was);
  };
  const closePicker = useCallback((restoreFocus) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame?.(() => labelRef.current?.focus({ preventScroll: true }));
  }, []);
  const handlePick = useCallback((picked) => {
    if (!(picked instanceof Date) || Number.isNaN(picked.getTime())) return;
    onPick?.(mode === "month" ? new Date(picked.getFullYear(), picked.getMonth(), 1) : picked);
  }, [mode, onPick]);

  // RTL: the right-pointing chevron is «previous»; LTR mirrors it.
  const PrevIcon = ar ? ChevronRight : ChevronLeft;
  const NextIcon = ar ? ChevronLeft : ChevronRight;

  return (
    <div
      role="group"
      aria-label={ar ? `التنقّل بين ${UNIT[mode].ar === "اليوم" ? "الأيام" : UNIT[mode].ar === "الأسبوع" ? "الأسابيع" : "الأشهر"}` : `${UNIT[mode].en} navigation`}
      className={`nv-date-nav ${className}`.trim()}
      data-date-nav={mode}
      style={style}
      {...rest}
    >
      <style>{DATE_NAV_CSS}</style>
      <div className="nv-date-nav__box">
        <button type="button" className="nv-date-nav__step" data-date-nav-prev="1" onClick={onPrev} aria-label={prevAria} title={prevAria}>
          <PrevIcon size={16} aria-hidden />
          <span className="nv-date-nav__word">{ar ? "السابق" : "Prev"}</span>
        </button>
        <span className="nv-date-nav__slot">
          <button
            ref={labelRef}
            type="button"
            className="nv-date-nav__label"
            data-date-nav-label="1"
            onClick={openPicker}
            aria-label={onPick ? pickAria : label.text}
            title={onPick ? pickAria : undefined}
            aria-haspopup={onPick ? "dialog" : undefined}
            aria-expanded={onPick ? open : undefined}
            style={onPick ? undefined : { cursor: "default" }}
          >
            <span className="nv-date-nav__text" aria-hidden>{label.parts.map((part, i) => (typeof part === "string" ? <span key={i}>{part}</span> : part))}</span>
          </button>
          {onPick && open ? (
            <DateJumpPopover
              mode={mode}
              value={date}
              min={min}
              max={max}
              anchor={anchor}
              ar={ar}
              anchorEl={labelRef.current}
              onPick={handlePick}
              onClose={closePicker}
            />
          ) : null}
        </span>
        <button type="button" className="nv-date-nav__step" data-date-nav-next="1" onClick={onNext} aria-label={nextAria} title={nextAria}>
          <span className="nv-date-nav__word">{ar ? "التالي" : "Next"}</span>
          <NextIcon size={16} aria-hidden />
        </button>
      </div>
      {onToday ? (
        <button
          type="button"
          className="nv-date-nav__now"
          data-date-nav-now="1"
          onClick={onToday}
          disabled={isCurrent}
          aria-current={isCurrent ? "date" : undefined}
        >
          {nowWord}
        </button>
      ) : null}
      {note ? <span className="nv-date-nav__note">{note}</span> : null}
    </div>
  );
}

/** Quick-pick chip row under/next to a DateNav — same chip skin, RTL range «11 – 17». */
export function DateNavChips({ items, ar = true }) {
  return (
    <div className="nv-date-nav__chips" role="group" aria-label={ar ? "اختيار سريع" : "Quick pick"}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          aria-pressed={!!item.on}
          title={item.title}
          style={chipButton(!!item.on, { height: 28, padding: "0 10px", fontSize: 12 })}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** «11 – 17» / «27 سبتمبر – 3 أكتوبر» — chip text for a Sunday-start week. */
export function WeekRangeText({ weekStart, ar = true, withMonth = false }) {
  const a = sundayOf(weekStart instanceof Date ? weekStart : new Date(weekStart));
  const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6);
  const months = ar ? MONTHS_AR : MONTHS_EN;
  const same = a.getMonth() === b.getMonth();
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <Num>{a.getDate()}</Num>
      {same && !withMonth ? null : <span>{months[a.getMonth()]}</span>}
      <span aria-hidden>–</span>
      <Num>{b.getDate()}</Num>
      {same && !withMonth ? null : <span>{months[b.getMonth()]}</span>}
    </span>
  );
}
