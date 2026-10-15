import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { mono } from "@/components/schedules/scheduleChrome";

/**
 * DateJumpPopover — the fast month / year jump under DateNav's label.
 *
 *   months view   year header (‹ previous on the right in RTL ›) + «السنوات» + a 3×4 month grid
 *   years view    12 years per page, newest first
 *   days view     week/day modes only: Sunday-start day grid (week mode lights the whole row)
 *   chips         هذا الشهر · الشهر الماضي · قبل 3 أشهر · بداية السنة · (anchor) بداية السنة العقدية
 *
 * `min` / `max` are optional day keys (YYYY-MM-DD, YYYY-MM or Date): out-of-range cells are disabled.
 * `onPick(date)` receives a local Date — month mode → the 1st of the month; week mode → the week's
 * Sunday; day mode → the day.
 */

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD_AR = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const YEARS_PER_PAGE = 12;
const SHEET_MAX = 640;

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthEndDay = (y, m) => new Date(y, m + 1, 0).getDate();
const firstKey = (y, m) => `${y}-${pad(m + 1)}-01`;
const lastKey = (y, m) => `${y}-${pad(m + 1)}-${pad(monthEndDay(y, m))}`;
const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const sundayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());

/** Normalise a bound to a day key; a month-only upper bound means its last day. */
export function jumpBoundKey(value, upper = false) {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : keyOf(value);
  const m = String(value).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return "";
  if (m[3]) return `${m[1]}-${m[2]}-${m[3]}`;
  return upper ? lastKey(Number(m[1]), Number(m[2]) - 1) : `${m[1]}-${m[2]}-01`;
}

/** Latest anniversary of `anchorKey` on or before `today` — the start of the running contract year. */
export function contractYearStart(anchorKey, today = new Date()) {
  const a = jumpBoundKey(anchorKey);
  if (!a) return null;
  const [ay, am, ad] = a.split("-").map(Number);
  const at = (y) => new Date(y, am - 1, Math.min(ad, monthEndDay(y, am - 1)));
  let y = today.getFullYear();
  if (at(y) > today) y -= 1;
  return y < ay ? fromKey(a) : at(y);
}

const Num = ({ children }) => <span dir="ltr" style={{ ...mono, unicodeBidi: "isolate" }}>{children}</span>;

const JUMP_CSS = `
.nv-jump { position: fixed; z-index: 220; box-sizing: border-box; width: 312px; max-width: calc(100vw - 16px); background: var(--nv-card, #fff); color: var(--nv-ink, #0F172A); border: 1px solid var(--nv-line, #E2E8F0); border-radius: ${DS_CONTROL_RADIUS}px; padding: 10px; font-family: inherit; font-size: 13px; letter-spacing: 0; text-align: start; display: flex; flex-direction: column; gap: 8px; }
.nv-jump--sheet { inset-inline: 0; bottom: 0; top: auto !important; left: 0 !important; width: 100%; max-width: 100%; max-height: 86vh; overflow-y: auto; border-radius: 12px 12px 0 0; border-bottom: none; padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px)); }
.nv-jump__scrim { position: fixed; inset: 0; z-index: 219; background: rgba(15, 23, 42, 0.32); }
.nv-jump button { font-family: inherit; letter-spacing: 0; }
.nv-jump__head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.nv-jump__step { width: 36px; height: 36px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--nv-line, #E2E8F0); border-radius: ${DS_CONTROL_RADIUS}px; background: var(--nv-card, #fff); color: var(--nv-ink2, #334155); cursor: pointer; padding: 0; }
.nv-jump__title { flex: 1 1 auto; min-width: 0; height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-weight: 700; font-size: 14px; color: var(--nv-ink, #0F172A); border: none; background: transparent; border-radius: ${DS_CONTROL_RADIUS}px; cursor: pointer; padding: 0 6px; white-space: nowrap; }
.nv-jump__switch { height: 36px; flex: 0 0 auto; padding: 0 12px; border: 1px solid var(--nv-line, #E2E8F0); border-radius: ${DS_CONTROL_RADIUS}px; background: var(--nv-soft, #F7F8FA); color: var(--nv-ink, #0F172A); font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.nv-jump__close { display: none; }
.nv-jump--sheet .nv-jump__close { display: inline-flex; }
.nv-jump__grid { display: grid; gap: 6px; }
.nv-jump__grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.nv-jump__cell { height: 36px; min-width: 0; border: 1px solid transparent; border-radius: ${DS_CONTROL_RADIUS}px; background: var(--nv-soft, #F7F8FA); color: var(--nv-ink, #0F172A); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; white-space: nowrap; overflow: hidden; }
.nv-jump__cell[data-current="1"] { border-color: var(--nv-navy, #14284B); }
.nv-jump__cell[aria-pressed="true"], .nv-jump__cell[aria-selected="true"] { background: var(--nv-navy, #14284B); border-color: var(--nv-navy, #14284B); color: var(--nv-btn-ink, #fff); }
.nv-jump__cell:disabled { cursor: default; background: transparent; color: var(--nv-ink3, #94A3B8); opacity: 0.55; }
.nv-jump__step:disabled { cursor: default; opacity: 0.4; }
.nv-jump__step:not(:disabled):hover, .nv-jump__title:hover, .nv-jump__switch:hover, .nv-jump__cell:not(:disabled):not([aria-pressed="true"]):not([aria-selected="true"]):hover, .nv-jump__chip:not(:disabled):hover { background: var(--nv-hover, #F2F5F3); }
.nv-jump button:focus-visible { outline: 2px solid var(--nv-navy, #14284B); outline-offset: 1px; }
.nv-jump__days { display: flex; flex-direction: column; gap: 3px; }
.nv-jump__row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; border-radius: ${DS_CONTROL_RADIUS}px; }
.nv-jump__wd { font-size: 10.5px; color: var(--nv-muted, #64748B); text-align: center; font-weight: 600; padding: 2px 0; white-space: nowrap; overflow: hidden; }
.nv-jump__day { height: 34px; font-size: 12.5px; background: transparent; }
.nv-jump__day[data-out="1"] { color: var(--nv-ink3, #94A3B8); }
.nv-jump__day[data-today="1"] { border-color: var(--nv-navy, #14284B); }
.nv-jump__row--week[data-on="1"] { background: var(--nv-navy, #14284B); }
.nv-jump__row--week[data-on="1"] .nv-jump__day { color: var(--nv-btn-ink, #fff); }
.nv-jump__row--week[data-on="1"] .nv-jump__day[data-today="1"] { border-color: var(--nv-btn-ink, #fff); }
.nv-jump__row--week:not([data-on="1"]):hover { background: var(--nv-hover, #F2F5F3); }
.nv-jump__row--week .nv-jump__day:not(:disabled):hover { background: transparent; }
.nv-jump__chips { display: flex; flex-wrap: wrap; gap: 5px; padding-top: 8px; border-top: 1px solid var(--nv-line2, var(--nv-line, #E2E8F0)); }
.nv-jump__chip { height: 28px; padding: 0 10px; border: 1px solid var(--nv-line, #E2E8F0); border-radius: ${DS_CONTROL_RADIUS}px; background: var(--nv-card, #fff); color: var(--nv-ink, #0F172A); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.nv-jump__chip[aria-pressed="true"] { background: var(--nv-navy, #14284B); border-color: var(--nv-navy, #14284B); color: var(--nv-btn-ink, #fff); }
.nv-jump__chip:disabled { cursor: default; opacity: 0.45; }
.nv-jump__hint { font-size: 11px; color: var(--nv-muted, #64748B); line-height: 1.6; }
`;

export default function DateJumpPopover({ mode = "month", value, min, max, anchor, ar = true, onPick, onClose, anchorEl }) {
  const popRef = useRef(null);
  const wantFocus = useRef(true);
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);
  const todayKey = keyOf(today);
  const base = value instanceof Date && !Number.isNaN(value.getTime()) ? value : today;
  const valueKey = keyOf(base);
  const minK = jumpBoundKey(min);
  const maxK = jumpBoundKey(max, true);
  const months = ar ? MONTHS_AR : MONTHS_EN;

  const [view, setView] = useState("months");
  const [year, setYear] = useState(base.getFullYear());
  const [month, setMonth] = useState(base.getMonth());
  const [focusMonth, setFocusMonth] = useState(base.getMonth());
  const [focusYear, setFocusYear] = useState(base.getFullYear());
  const [focusDay, setFocusDay] = useState(valueKey);
  const [pageEnd, setPageEnd] = useState(base.getFullYear());
  const [sheet, setSheet] = useState(() => typeof window !== "undefined" && window.innerWidth <= SHEET_MAX);
  const [coords, setCoords] = useState(null);

  const minYear = minK ? Number(minK.slice(0, 4)) : -Infinity;
  const maxYear = maxK ? Number(maxK.slice(0, 4)) : Infinity;
  const dayOpen = useCallback((key) => (!minK || key >= minK) && (!maxK || key <= maxK), [minK, maxK]);
  const monthOpen = useCallback((y, m) => (!minK || lastKey(y, m) >= minK) && (!maxK || firstKey(y, m) <= maxK), [minK, maxK]);
  const yearOpen = useCallback((y) => y >= minYear && y <= maxYear, [minYear, maxYear]);

  // Years page: newest first; the top end is the max year (or two years ahead of today when open-ended).
  const pageTop = Number.isFinite(maxYear) ? maxYear : Math.max(today.getFullYear() + 2, base.getFullYear());
  const pageFor = useCallback((y) => pageTop - Math.max(0, Math.floor((pageTop - y) / YEARS_PER_PAGE)) * YEARS_PER_PAGE, [pageTop]);

  /* ----------------------------------------- placement ----------------------------------------- */
  useLayoutEffect(() => {
    const place = () => {
      const narrow = window.innerWidth <= SHEET_MAX;
      setSheet(narrow);
      if (narrow || !anchorEl) {
        setCoords({ top: 0, left: 0 });
        return;
      }
      const r = anchorEl.getBoundingClientRect();
      const pop = popRef.current;
      const w = pop ? pop.offsetWidth : 312;
      const h = pop ? pop.offsetHeight : 360;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      // RTL: the popover's right edge meets the label's right edge; LTR mirrors.
      let left = ar ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      let top = r.bottom + 6;
      if (top + h > vh - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
      setCoords({ top: Math.round(top), left: Math.round(left) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorEl, ar, view, year, month, pageEnd]);

  /* ---------------------------------- outside click / focus ---------------------------------- */
  useEffect(() => {
    const onDown = (event) => {
      const node = popRef.current;
      if (!node || node.contains(event.target)) return;
      if (anchorEl && anchorEl.contains(event.target)) return;
      onClose?.(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [anchorEl, onClose]);

  useEffect(() => {
    if (!wantFocus.current || !coords) return;
    wantFocus.current = false;
    const node = popRef.current;
    const target = node?.querySelector('[data-jump-focus="1"]:not(:disabled)')
      || node?.querySelector(".nv-jump__cell:not(:disabled)")
      || node?.querySelector("button:not(:disabled)");
    target?.focus({ preventScroll: true });
  }, [coords, view, focusMonth, focusYear, focusDay, year, month, pageEnd]);

  const finish = (date) => {
    onPick?.(date);
    onClose?.(true);
  };

  /* ------------------------------------------ actions ------------------------------------------ */
  const goYear = (y, kbd = false) => {
    if (!yearOpen(y)) return;
    if (kbd) wantFocus.current = true;
    setYear(y);
  };
  const openYears = () => {
    wantFocus.current = true;
    setFocusYear(year);
    setPageEnd(pageFor(year));
    setView("years");
  };
  const pickYear = (y) => {
    wantFocus.current = true;
    setYear(y);
    let m = focusMonth;
    if (!monthOpen(y, m)) {
      const open = Array.from({ length: 12 }, (_, i) => i).filter((i) => monthOpen(y, i));
      m = open.length ? (y === maxYear ? open[open.length - 1] : open[0]) : m;
    }
    setFocusMonth(m);
    setView("months");
  };
  const pickMonth = (m) => {
    if (mode === "month") {
      finish(new Date(year, m, 1));
      return;
    }
    wantFocus.current = true;
    setMonth(m);
    const sameMonth = base.getFullYear() === year && base.getMonth() === m;
    const todayMonth = today.getFullYear() === year && today.getMonth() === m;
    let key = sameMonth ? valueKey : todayMonth ? todayKey : firstKey(year, m);
    if (!dayOpen(key)) key = minK && key < minK ? minK : maxK && key > maxK ? maxK : key;
    setFocusDay(key);
    setView("days");
  };
  const pickDay = (key) => {
    const d = fromKey(key);
    finish(mode === "week" ? sundayOf(d) : d);
  };
  const shiftMonth = (delta) => {
    const d = new Date(year, month + delta, 1);
    if (!monthOpen(d.getFullYear(), d.getMonth())) return;
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  /* ------------------------------------------ keyboard ----------------------------------------- */
  const onKeyDown = (event) => {
    // The portal still bubbles through the React tree — keep host shortcuts out of it.
    event.stopPropagation();
    const node = popRef.current;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.(true);
      return;
    }
    if (event.key === "Tab" && node) {
      const items = [...node.querySelectorAll("button:not(:disabled)")].filter((el) => el.tabIndex !== -1);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const dir = event.key === "PageUp" ? -1 : 1;
      wantFocus.current = true;
      if (view === "years") {
        const next = pageEnd + dir * YEARS_PER_PAGE;
        if (next - YEARS_PER_PAGE + 1 > maxYear || next < minYear) return;
        setPageEnd(next);
        setFocusYear((y) => Math.max(minYear, Math.min(maxYear, y + dir * YEARS_PER_PAGE)));
      } else if (view === "months") {
        goYear(year + dir, true);
      } else {
        const d = fromKey(focusDay);
        const target = new Date(d.getFullYear() + dir, d.getMonth(), Math.min(d.getDate(), monthEndDay(d.getFullYear() + dir, d.getMonth())));
        if (!monthOpen(target.getFullYear(), target.getMonth())) return;
        setYear(target.getFullYear());
        setMonth(target.getMonth());
        setFocusDay(keyOf(target));
      }
      return;
    }
    const arrows = { ArrowLeft: ar ? 1 : -1, ArrowRight: ar ? -1 : 1, ArrowUp: "up", ArrowDown: "down" };
    if (!(event.key in arrows) || !event.target?.closest?.("[data-jump-grid]")) return;
    event.preventDefault();
    wantFocus.current = true;
    const raw = arrows[event.key];
    if (view === "months") {
      const step = raw === "up" ? -3 : raw === "down" ? 3 : raw;
      let m = focusMonth + step;
      let y = year;
      if (m < 0) { m += 12; y -= 1; }
      if (m > 11) { m -= 12; y += 1; }
      if (!monthOpen(y, m)) return;
      setYear(y);
      setFocusMonth(m);
    } else if (view === "years") {
      const step = raw === "up" ? -3 : raw === "down" ? 3 : raw;
      const y = focusYear - step; // index grows toward older years
      if (!yearOpen(y)) return;
      setFocusYear(y);
      if (y > pageEnd || y <= pageEnd - YEARS_PER_PAGE) setPageEnd(pageFor(y));
    } else {
      const step = raw === "up" ? -7 : raw === "down" ? 7 : raw;
      const d = fromKey(focusDay);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + step);
      const key = keyOf(next);
      if (!dayOpen(key)) return;
      setFocusDay(key);
      if (next.getMonth() !== month || next.getFullYear() !== year) {
        setYear(next.getFullYear());
        setMonth(next.getMonth());
      }
    }
  };

  /* ------------------------------------------- chips ------------------------------------------- */
  const chipTarget = (d) => (mode === "month" ? new Date(d.getFullYear(), d.getMonth(), 1) : mode === "week" ? sundayOf(d) : d);
  const chipOpen = (d) => (mode === "month" ? monthOpen(d.getFullYear(), d.getMonth()) : dayOpen(keyOf(d)) || (mode === "week" && [0, 1, 2, 3, 4, 5, 6].some((i) => dayOpen(keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i))))));
  const monthsBack = (n) => new Date(today.getFullYear(), today.getMonth() - n, 1);
  const contractStart = anchor ? contractYearStart(anchor, today) : null;
  const chips = [
    { key: "this", ar: "هذا الشهر", en: "This month", date: mode === "month" ? monthsBack(0) : today },
    { key: "last", ar: "الشهر الماضي", en: "Last month", date: monthsBack(1) },
    { key: "back3", ar: "قبل 3 أشهر", en: "3 months ago", date: monthsBack(3) },
    { key: "year", ar: "بداية السنة", en: "Start of year", date: new Date(today.getFullYear(), 0, 1) },
    contractStart ? { key: "contract", ar: "بداية السنة العقدية", en: "Start of contract year", date: contractStart } : null,
  ].filter(Boolean).map((chip) => {
    const target = chipTarget(chip.date);
    const on = mode === "month"
      ? base.getFullYear() === target.getFullYear() && base.getMonth() === target.getMonth()
      : mode === "week" ? keyOf(sundayOf(base)) === keyOf(target) : valueKey === keyOf(target);
    return { ...chip, target, on, open: chipOpen(chip.date) };
  });

  /* ------------------------------------------ render ------------------------------------------- */
  const PrevIcon = ar ? ChevronRight : ChevronLeft;
  const NextIcon = ar ? ChevronLeft : ChevronRight;
  const t = (a, e) => (ar ? a : e);

  let head;
  let body;
  if (view === "years") {
    const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageEnd - i);
    const oldest = years[years.length - 1];
    head = (
      <div className="nv-jump__head">
        <button type="button" className="nv-jump__step" data-jump-prev="1" aria-label={t("السنوات الأقدم", "Older years")} title={t("السنوات الأقدم", "Older years")} disabled={oldest - 1 < minYear} onClick={() => setPageEnd(pageEnd - YEARS_PER_PAGE)}>
          <PrevIcon size={16} aria-hidden />
        </button>
        <span className="nv-jump__title" aria-live="polite"><Num>{oldest}</Num><span aria-hidden>–</span><Num>{pageEnd}</Num></span>
        <button type="button" className="nv-jump__step" data-jump-next="1" aria-label={t("السنوات الأحدث", "Newer years")} title={t("السنوات الأحدث", "Newer years")} disabled={pageEnd + 1 > maxYear} onClick={() => setPageEnd(pageEnd + YEARS_PER_PAGE)}>
          <NextIcon size={16} aria-hidden />
        </button>
        <button type="button" className="nv-jump__switch" data-jump-switch="months" onClick={() => { wantFocus.current = true; setView("months"); }}>{t("الأشهر", "Months")}</button>
      </div>
    );
    body = (
      <div className="nv-jump__grid nv-jump__grid--3" role="grid" data-jump-grid="years" aria-label={t("السنوات", "Years")}>
        {years.map((y) => {
          const open = yearOpen(y);
          const focus = y === focusYear;
          return (
            <button
              key={y}
              type="button"
              className="nv-jump__cell"
              data-jump-year={y}
              data-current={y === today.getFullYear() ? "1" : undefined}
              aria-pressed={y === year}
              aria-label={String(y)}
              disabled={!open}
              tabIndex={focus ? 0 : -1}
              data-jump-focus={focus ? "1" : undefined}
              onClick={() => pickYear(y)}
            >
              <Num>{y}</Num>
            </button>
          );
        })}
      </div>
    );
  } else if (view === "months") {
    head = (
      <div className="nv-jump__head">
        <button type="button" className="nv-jump__step" data-jump-prev="1" aria-label={t("السنة السابقة", "Previous year")} title={t("السنة السابقة", "Previous year")} disabled={!yearOpen(year - 1)} onClick={() => goYear(year - 1)}>
          <PrevIcon size={16} aria-hidden />
        </button>
        <button type="button" className="nv-jump__title" data-jump-title="1" onClick={openYears} aria-label={t(`السنة ${year} — اختر سنة`, `${year} — pick a year`)}>
          <Num>{year}</Num>
        </button>
        <button type="button" className="nv-jump__step" data-jump-next="1" aria-label={t("السنة التالية", "Next year")} title={t("السنة التالية", "Next year")} disabled={!yearOpen(year + 1)} onClick={() => goYear(year + 1)}>
          <NextIcon size={16} aria-hidden />
        </button>
        <button type="button" className="nv-jump__switch" data-jump-switch="years" onClick={openYears}>{t("السنوات", "Years")}</button>
      </div>
    );
    body = (
      <div className="nv-jump__grid nv-jump__grid--3" role="grid" data-jump-grid="months" aria-label={t(`أشهر ${year}`, `Months of ${year}`)}>
        {months.map((name, m) => {
          const open = monthOpen(year, m);
          const focus = m === focusMonth;
          return (
            <button
              key={name}
              type="button"
              className="nv-jump__cell"
              data-jump-month={m}
              data-current={year === today.getFullYear() && m === today.getMonth() ? "1" : undefined}
              aria-pressed={year === base.getFullYear() && m === base.getMonth()}
              aria-label={`${name} ${year}`}
              disabled={!open}
              tabIndex={focus ? 0 : -1}
              data-jump-focus={focus ? "1" : undefined}
              onClick={() => pickMonth(m)}
            >
              {name}
            </button>
          );
        })}
      </div>
    );
  } else {
    const first = new Date(year, month, 1);
    const start = sundayOf(first);
    const last = new Date(year, month, monthEndDay(year, month));
    const rows = [];
    for (let cursor = start; cursor <= last; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)) {
      rows.push(Array.from({ length: 7 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i)));
    }
    const prevMonth = new Date(year, month - 1, 1);
    const nextMonth = new Date(year, month + 1, 1);
    const selectedWeek = keyOf(sundayOf(base));
    head = (
      <div className="nv-jump__head">
        <button type="button" className="nv-jump__step" data-jump-prev="1" aria-label={t("الشهر السابق", "Previous month")} title={t("الشهر السابق", "Previous month")} disabled={!monthOpen(prevMonth.getFullYear(), prevMonth.getMonth())} onClick={() => shiftMonth(-1)}>
          <PrevIcon size={16} aria-hidden />
        </button>
        <button type="button" className="nv-jump__title" data-jump-title="1" onClick={() => { wantFocus.current = true; setFocusMonth(month); setView("months"); }} aria-label={t(`${months[month]} ${year} — اختر شهراً`, `${months[month]} ${year} — pick a month`)}>
          <span>{months[month]}</span><Num>{year}</Num>
        </button>
        <button type="button" className="nv-jump__step" data-jump-next="1" aria-label={t("الشهر التالي", "Next month")} title={t("الشهر التالي", "Next month")} disabled={!monthOpen(nextMonth.getFullYear(), nextMonth.getMonth())} onClick={() => shiftMonth(1)}>
          <NextIcon size={16} aria-hidden />
        </button>
        <button type="button" className="nv-jump__switch" data-jump-switch="years" onClick={openYears}>{t("السنوات", "Years")}</button>
      </div>
    );
    body = (
      <div className="nv-jump__days" role="grid" data-jump-grid="days" aria-label={`${months[month]} ${year}`}>
        <div className="nv-jump__row" role="row">
          {(ar ? WD_AR : WD_EN).map((wd) => <span key={wd} className="nv-jump__wd" role="columnheader">{wd}</span>)}
        </div>
        {rows.map((week) => {
          const weekKey = keyOf(week[0]);
          const on = mode === "week" && weekKey === selectedWeek;
          return (
            <div key={weekKey} role="row" className={`nv-jump__row${mode === "week" ? " nv-jump__row--week" : ""}`} data-on={on ? "1" : undefined} data-jump-week={mode === "week" ? weekKey : undefined}>
              {week.map((d) => {
                const key = keyOf(d);
                const open = mode === "week" ? week.some((w) => dayOpen(keyOf(w))) : dayOpen(key);
                const focus = key === focusDay;
                const selected = mode === "day" && key === valueKey;
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    className="nv-jump__cell nv-jump__day"
                    data-jump-day={key}
                    data-out={d.getMonth() !== month ? "1" : undefined}
                    data-today={key === todayKey ? "1" : undefined}
                    aria-selected={mode === "week" ? on : selected}
                    aria-current={key === todayKey ? "date" : undefined}
                    aria-label={`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}${key === todayKey ? t(" — اليوم", " — today") : ""}`}
                    disabled={!open}
                    tabIndex={focus ? 0 : -1}
                    data-jump-focus={focus ? "1" : undefined}
                    onClick={() => pickDay(key)}
                  >
                    <Num>{d.getDate()}</Num>
                  </button>
                );
              })}
            </div>
          );
        })}
        <span className="nv-jump__hint">{mode === "week" ? t("اضغط أيّ يوم لفتح أسبوعه.", "Tap any day to open its week.") : t("اضغط يوماً لفتحه.", "Tap a day to open it.")}</span>
      </div>
    );
  }

  const dialogLabel = mode === "month" ? t("اختر شهراً", "Pick a month") : mode === "week" ? t("اختر أسبوعاً", "Pick a week") : t("اختر يوماً", "Pick a day");
  const node = (
    <>
      <style>{JUMP_CSS}</style>
      {sheet ? <div className="nv-jump__scrim" aria-hidden onMouseDown={() => onClose?.(true)} /> : null}
      <div
        ref={popRef}
        className={`nv-v7-portal nv-jump${sheet ? " nv-jump--sheet" : ""}`}
        dir={ar ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        data-date-jump={mode}
        data-jump-view={view}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        style={sheet ? undefined : { top: coords?.top ?? -9999, left: coords?.left ?? 0, visibility: coords ? "visible" : "hidden" }}
      >
        {sheet ? (
          <div className="nv-jump__head" style={{ justifyContent: "space-between" }}>
            <strong style={{ fontSize: 14 }}>{dialogLabel}</strong>
            <button type="button" className="nv-jump__step nv-jump__close" aria-label={t("إغلاق", "Close")} onClick={() => onClose?.(true)}>
              <X size={16} aria-hidden />
            </button>
          </div>
        ) : null}
        {head}
        {body}
        <div className="nv-jump__chips" role="group" aria-label={t("انتقال سريع", "Quick jump")}>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="nv-jump__chip"
              data-jump-chip={chip.key}
              aria-pressed={chip.on}
              disabled={!chip.open}
              onClick={() => finish(chip.target)}
            >
              {chip.key === "back3" && ar ? <>قبل <Num>3</Num> أشهر</> : t(chip.ar, chip.en)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : null;
}
