import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { useRailSide, useSetRailSide } from "@/lib/railSide";
import { managedDutyEmployees } from "@/lib/dutyScope";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { performsNightWork } from "@/lib/decision18632";
import { SUN_FIELD, sunExposureCellState } from "@/lib/shiftWeek";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { listLocalRangeAttendance, mergeAttendanceRangeRows } from "@/lib/localAttendanceFallback";
import { contractYearAnchor, dutyRecordStart, eachDayKey, tallyDutyDays } from "@/lib/dutyYears";
import { DUTY_SEARCH_PAGES, DUTY_SEARCH_STATUSES, dutyDayMatches, normalizeDutyText, parseDutyQuery, resolveDutyPeriod } from "@/lib/dutySearch";
import { myDutyDay } from "@/components/attendance/myDutyDays";
import { fmtDayKey } from "@/components/attendance/DutyCareer";
import { DS_CONTROL_RADIUS, DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";
import { mono } from "@/components/schedules/scheduleChrome";
import { dutyChip, dutyLabel } from "@/components/schedules/dutyStatus";
import { fileDutyHref, myRecordHref } from "@/components/schedules/dutyLinks";

const SEARCH_CSS = `
.nv-duty-search { position: relative; flex: 0 1 380px; min-width: 240px; }
.nv-duty-search-pop { position: absolute; inset-inline: 0; top: calc(100% + 6px); z-index: 60; max-height: min(70vh, 520px); overflow-y: auto; }
.powercare-shell main .nv-duty-search input.nv-search-field.nv-duty-search-input, .nv-duty-search input.nv-duty-search-input { height: 34px !important; min-height: 34px !important; padding-inline-start: 34px !important; padding-inline-end: 32px !important; font-size: 12.5px !important; width: 100%; -webkit-appearance: none; appearance: none; }
.powercare-shell main .nv-duty-search input.nv-search-field.nv-duty-search-input:focus { border-color: var(--nv-navy) !important; outline: none; }
.nv-duty-search input.nv-duty-search-input::-webkit-search-cancel-button { display: none; }
.nv-duty-search-opt[aria-selected="true"] { background: var(--nv-hover, #F2F5F3); outline: 2px solid var(--nv-navy); outline-offset: -2px; }
@media (max-width: 640px) {
  .nv-duty-search { flex: 1 1 100%; min-width: 0; }
  .nv-duty-search-pop { position: fixed; inset-inline: 12px; top: auto; margin-top: 6px; max-height: 56vh; }
}
`;

const EXAMPLES_MANAGE = ["غياب أحمد سبتمبر", "تأخير من 1 إلى 15 سبتمبر", "غياب رمضان 1447", "تأخير هذا الأسبوع", "جدول الدوام"];
const EXAMPLES_MINE = ["غيابي السنة العقدية", "تأخير بين 1/9 و 20/9", "رمضان 1447", "مسيرتي", "جدولي"];
const MAX_DAYS = 40;
const SCAN_DAY_CAP = 3660;

function employeeIdOf(row) {
  const id = row?.employee_id ?? row?.employeeId;
  return id == null ? "" : String(id);
}

/**
 * Cloud rows for the people and range the search reads — the same listRange call سجلي uses, per
 * person; local preview reads the local register only.
 */
function useSearchRows({ company, data, people, from, to, enabled }) {
  const [cloud, setCloud] = useState({ key: "", rows: [] });
  const ids = people.map((person) => String(person.id)).join(",");
  const key = enabled && from && to ? `${ids}|${from}|${to}` : "";
  useEffect(() => {
    if (!key || isLocalPreviewActive() || !company?.id) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all(ids.split(",").filter(Boolean).slice(0, 40).map((employeeId) => base44.functions
        .invoke("supabaseAttendance", { action: "listRange", employeeId, startDate: from, endDate: to })
        .then((res) => (res?.data?.rows || []).map((row) => ({ ...row, employee_id: row.employee_id ?? employeeId })))
        .catch(() => [])))
        .then((chunks) => { if (active) setCloud({ key, rows: chunks.flat() }); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, ids, from, to, company?.id]);
  return useMemo(() => {
    if (!key) return [];
    const local = listLocalRangeAttendance(company?.id, from, to, data);
    return cloud.key === key ? mergeAttendanceRangeRows(cloud.rows, local) : local;
  }, [key, cloud, company?.id, from, to, data]);
}

function statusWord(id, ar) {
  const hit = DUTY_SEARCH_STATUSES.find((row) => row.id === id);
  return hit ? (ar ? hit.ar : hit.en) : id;
}

/**
 * «ابحث في الحضور والدوام» — one box in the lane strip of both lanes. Free text: names (the
 * people in scope on الإدارة; only oneself on الموظف), statuses, dates / periods and page names.
 * Results open the right place: سجلي on the day, the person's duty file, the page.
 */
export default function DutySmartSearch({ ar = true, side = "employee", pages = [] }) {
  const { data, currentUser, company } = useAuth() || {};
  const railSide = useRailSide();
  const setRailSide = useSetRailSide();
  const navigate = useNavigate();
  const scope = useStationScope();
  const listId = useId();
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const manage = side === "manage";
  const todayKey = toRiyadhDateKey();

  const self = useMemo(() => {
    const row = (data?.employees || []).find((item) => String(item.id) === String(currentUser?.id)) || currentUser;
    return row ? hydrateEmployeesLeave([row], data)[0] || row : null;
  }, [data, currentUser]);
  const people = useMemo(() => {
    if (!manage) return self ? [self] : [];
    const list = currentUser && data ? managedDutyEmployees(currentUser, data) : [];
    const fallback = data?.stations?.[0]?.id || null;
    return hydrateEmployeesLeave(list.filter((row) => matchesStationScope(row.stationId || fallback, scope)), data);
  }, [manage, self, currentUser, data, scope]);

  const parsed = useMemo(() => parseDutyQuery(query, { people }), [query, people]);
  const calendar = useMemo(() => laborCalendarOf(data), [data]);
  const localAll = useMemo(() => listLocalRangeAttendance(company?.id, "1900-01-01", todayKey, data), [data, company?.id, todayKey]);
  // Each person's record starts on his own first roster day / published week / punch.
  const coverageOf = (person) => dutyRecordStart({ schedules: data?.schedules || [], rows: localAll, employee: person });

  const wantsDays = !!(parsed.statuses.length || parsed.period);
  const named = parsed.people;
  // A word that is not a status, a period, a page or a name in scope narrows to nobody — never to everybody.
  const stray = parsed.words.length > 0 && !named.length;
  const subjects = useMemo(() => {
    if (stray) return [];
    if (manage) return named.length ? named : (wantsDays ? people : []);
    // الموظف: only oneself — his name or any status / period means his own record.
    return self && (named.length || wantsDays) ? [self] : [];
  }, [stray, manage, named, wantsDays, people, self]);
  const anchorOf = (person) => contractYearAnchor(person, coverageOf(person));
  const periodOf = (person) => resolveDutyPeriod(parsed.period || { kind: "contract" }, { todayKey, anchorKey: anchorOf(person).key, ar });

  let span = null;
  for (const person of subjects) {
    const period = periodOf(person);
    if (!period?.from) continue;
    const to = period.to > todayKey && !parsed.period ? todayKey : period.to;
    span = { from: !span || period.from < span.from ? period.from : span.from, to: !span || to > span.to ? to : span.to };
  }
  const rows = useSearchRows({ company, data, people: subjects, from: span?.from, to: span?.to, enabled: open && !!span && query.trim().length > 0 });

  const results = useMemo(() => {
    const out = [];
    if (!query.trim()) {
      for (const page of pages) out.push({ kind: "page", id: `p:${page.key}:${page.side}`, page });
      return { items: out, understood: [] };
    }
    const understood = [];
    for (const person of named) understood.push({ tone: "rest", text: person.name });
    for (const id of parsed.statuses) understood.push({ tone: id === "absent" || id === "exposed" ? "bad" : id === "late" ? "warn" : id === "leave" || id === "holiday" ? "leave" : id === "attended" ? "ok" : "rest", text: statusWord(id, ar) });
    const firstPeriod = subjects[0] ? periodOf(subjects[0]) : resolveDutyPeriod(parsed.period, { todayKey, anchorKey: anchorOf(self).key, ar });
    if (firstPeriod && (parsed.period || subjects.length)) understood.push({ tone: "rest", text: firstPeriod.label });
    for (const word of parsed.words) understood.push({ tone: "rest", text: ar ? `«${word}» ليس في نطاقك` : `“${word}” is not in your scope` });

    // pages: named ones first, then any page whose label starts with what was typed
    const typed = normalizeDutyText(query);
    const pageHits = pages.filter((page) => parsed.pages.includes(page.searchKey)
      || (!wantsDays && !named.length && typed.length >= 2 && normalizeDutyText(page.label).includes(typed)));
    for (const page of pageHits) out.push({ kind: "page", id: `p:${page.key}:${page.side}`, page });

    const rowsBy = new Map();
    for (const row of rows) rowsBy.set(`${employeeIdOf(row)}:${String(row.date || row.dateKey || "").slice(0, 10)}`, row);
    const dayHits = [];
    const personHits = [];
    for (const person of subjects) {
      const period = periodOf(person);
      if (!period?.from) continue;
      const anchor = anchorOf(person);
      const start = [period.from, coverageOf(person), anchor.source === "contract" || anchor.source === "hire" ? anchor.key : ""].filter(Boolean).sort().pop();
      const keys = eachDayKey(start, !parsed.period && period.to > todayKey ? todayKey : period.to, SCAN_DAY_CAP);
      const schedule = (data?.schedules || []).find((item) => String(item.stationId) === String(person.stationId || data?.stations?.[0]?.id)) || null;
      const days = keys.map((key) => {
        const day = myDutyDay({ employee: person, data, row: rowsBy.get(`${person.id}:${key}`), key, todayKey, calendar, ar });
        if (day.shift && (parsed.statuses.includes("night") || parsed.statuses.includes("exposed"))) {
          day.night = performsNightWork(day.shift, key);
          day.exposed = sunExposureCellState(schedule, person.id, key, { shift: day.shift }).mark === SUN_FIELD;
        }
        return day;
      });
      const tally = tallyDutyDays(days.filter((day) => day.key <= todayKey));
      const own = String(person.id) === String(currentUser?.id);
      const personHref = own ? myRecordHref({ focus: "career" }) : fileDutyHref(person.id, { focus: "career" });
      const longSpan = keys.length > 31;
      const statuses = parsed.statuses.length ? parsed.statuses : (longSpan || !parsed.period ? ["absent", "late", "leave"] : []);
      if (!parsed.statuses.length && (!parsed.period || longSpan || (manage && !named.length))) {
        personHits.push({ kind: "person", id: `e:${person.id}`, person, tally, period, href: personHref });
      }
      if (manage && !named.length && !parsed.statuses.length) continue;
      for (const day of days.slice().reverse()) {
        if (!dutyDayMatches(day, statuses)) continue;
        if (!parsed.statuses.length && !parsed.period && day.key > todayKey) continue;
        dayHits.push({
          kind: "day",
          id: `d:${person.id}:${day.key}`,
          person,
          day,
          href: own ? myRecordHref({ day: day.key }) : fileDutyHref(person.id, { day: day.key }),
        });
      }
    }
    dayHits.sort((a, b) => (a.day.key < b.day.key ? 1 : a.day.key > b.day.key ? -1 : 0));
    for (const hit of personHits) out.push(hit);
    const more = Math.max(0, dayHits.length - MAX_DAYS);
    for (const hit of dayHits.slice(0, MAX_DAYS)) out.push(hit);
    return { items: out, understood, dayCount: dayHits.length, more, period: firstPeriod };
  }, [query, parsed, pages, rows, subjects, localAll, calendar, todayKey, ar, data, currentUser?.id, manage, self]);

  const items = results.items;
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const go = (item) => {
    if (!item) return;
    const href = item.kind === "page" ? item.page.to : item.href;
    const targetSide = item.kind === "page" ? item.page.side : (item.href.startsWith("/app/attendance?tab=record") ? "employee" : "");
    if (targetSide && targetSide !== railSide && (targetSide === "employee" || targetSide === "manage")) setRailSide?.(targetSide);
    setOpen(false);
    inputRef.current?.blur();
    navigate(href);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (items.length ? (index + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
    } else if (event.key === "Enter") {
      if (open && items[active]) {
        event.preventDefault();
        go(items[active]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      } else if (query) {
        setQuery("");
      }
    }
  };

  const optionId = (index) => `${listId}-opt-${index}`;
  const examples = manage ? EXAMPLES_MANAGE : EXAMPLES_MINE;
  const placeholder = manage
    ? (ar ? "ابحث: اسم، غياب، تأخير، من 1 إلى 15 سبتمبر، رمضان 1447…" : "Search: name, absent, late, September, 10/9, roster…")
    : (ar ? "ابحث في دوامي: غياب، تأخير، بين 1/9 و 20/9، رمضان، جدولي…" : "Search my duty: absent, late, September, contract year…");

  return (
    <div className="nv-duty-search" ref={boxRef} data-duty-search={manage ? "manage" : "employee"}>
      <style>{SEARCH_CSS}</style>
      <div style={{ position: "relative" }}>
        <Search aria-hidden style={{ position: "absolute", top: "50%", insetInlineStart: 11, transform: "translateY(-50%)", width: 15, height: 15, color: "var(--nv-muted)", pointerEvents: "none" }} strokeWidth={1.75} />
        <input
          ref={inputRef}
          type="search"
          className="nv-search-field nv-duty-search-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? optionId(active) : undefined}
          aria-label={ar ? "بحث ذكي في الحضور والدوام" : "Smart search in time and attendance"}
          value={query}
          placeholder={placeholder}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={{ display: "block", boxSizing: "border-box", fontFamily: "inherit", color: "var(--nv-ink)", textAlign: "start" }}
        />
        {query ? (
          <button type="button" aria-label={ar ? "مسح البحث" : "Clear search"} onClick={() => { setQuery(""); inputRef.current?.focus(); }} style={{ position: "absolute", top: "50%", insetInlineEnd: 8, transform: "translateY(-50%)", border: "none", background: "transparent", padding: 2, cursor: "pointer", color: "var(--nv-muted)", display: "inline-flex" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className="nv-duty-search-pop"
          style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: DS_RADIUS, boxShadow: DS_SHADOW, padding: 6, textAlign: "start" }}
        >
          {results.understood?.length ? (
            <div data-search-understood="1" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 8px 8px", borderBottom: "1px solid var(--nv-line2)" }}>
              <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "فهمت:" : "Read as:"}</span>
              {results.understood.map((item, index) => (
                <span key={`${item.text}${index}`} style={dutyChip(item.tone, { height: 22, fontSize: 10.5 })}>{item.text}</span>
              ))}
              {results.dayCount ? (
                <span style={{ fontSize: 11, color: "var(--nv-ink2)", marginInlineStart: "auto" }}>
                  <span dir="ltr" style={mono}>{results.dayCount}</span> {ar ? "يوم" : "days"}
                </span>
              ) : null}
            </div>
          ) : null}
          {!query.trim() ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 8px 8px", borderBottom: "1px solid var(--nv-line2)" }}>
              <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "جرّب:" : "Try:"}</span>
              {examples.map((text) => (
                <button key={text} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(text); setOpen(true); inputRef.current?.focus(); }} style={dutyChip("rest", { height: 22, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" })}>
                  {text}
                </button>
              ))}
            </div>
          ) : null}
          <ul id={listId} role="listbox" aria-label={ar ? "نتائج البحث" : "Search results"} style={{ listStyle: "none", margin: 0, padding: "4px 0 0" }}>
            {items.map((item, index) => (
              <li
                key={item.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className="nv-duty-search-opt"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(item)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", borderRadius: DS_CONTROL_RADIUS, cursor: "pointer", minWidth: 0 }}
              >
                <ResultBody item={item} ar={ar} manage={manage} />
              </li>
            ))}
          </ul>
          {query.trim() && !items.length ? (
            <div style={{ padding: "10px 8px", fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7 }}>
              {wantsDays && subjects.length
                ? (ar ? `لا ${parsed.statuses.length ? parsed.statuses.map((id) => statusWord(id, ar)).join(" ولا ") : "يوم"} مسجّل${results.period?.label ? ` في ${results.period.label}` : ""}.` : "Nothing on record for that.")
                : (ar ? `لا نتيجة — جرّب: ${examples.slice(0, 3).join(" · ")}` : `No match — try: ${examples.slice(0, 3).join(" · ")}`)}
            </div>
          ) : null}
          {results.more ? (
            <div style={{ padding: "6px 8px 4px", fontSize: 11.5, color: "var(--nv-muted)" }}>
              {ar ? <>و<span dir="ltr" style={mono}>{results.more}</span> يوماً آخر — ضيّق الفترة أو افتح الملف.</> : <>and {results.more} more days — narrow the period or open the file.</>}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultBody({ item, ar, manage }) {
  if (item.kind === "page") {
    const Icon = item.page.icon;
    return (
      <>
        {Icon ? <Icon aria-hidden style={{ width: 15, height: 15, color: "var(--nv-muted)", flex: "none" }} strokeWidth={1.7} /> : null}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", flex: "1 1 auto", minWidth: 0 }}>{item.page.label}</span>
        <span style={dutyChip("rest", { height: 20, fontSize: 10 })}>{item.page.side === "manage" ? (ar ? "الإدارة" : "Manage") : (ar ? "الموظف" : "Employee")}</span>
      </>
    );
  }
  if (item.kind === "person") {
    const t = item.tally;
    return (
      <>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 auto", minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.person.name}</span>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{item.period?.label || ""}</span>
        </span>
        <span style={dutyChip(t.absent ? "absent" : "rest", { height: 22, fontSize: 10.5 })}>
          {ar ? "غياب " : "Absent "}<span dir="ltr" style={mono}>{t.absent}</span>
        </span>
        <span style={dutyChip(t.lateDays ? "late" : "rest", { height: 22, fontSize: 10.5 })}>
          {ar ? "تأخير " : "Late "}<span dir="ltr" style={mono}>{t.lateDays}</span>
        </span>
      </>
    );
  }
  const { day, person } = item;
  const late = day.lateMinutes > 0 && day.inAt;
  return (
    <>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 auto", minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fmtDayKey(day.key, ar, { weekday: true })}
        </span>
        {manage ? <span style={{ fontSize: 11, color: "var(--nv-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}{day.shift?.label ? ` · ${day.shift.label}` : ""}</span>
          : day.shift?.label ? <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{day.shift.label}</span> : null}
      </span>
      {late ? <span style={{ fontSize: 11, color: "var(--nv-warn-ink)", whiteSpace: "nowrap" }}><span dir="ltr" style={mono}>+{day.lateMinutes}</span> {ar ? "د" : "min"}</span> : null}
      {day.night ? <span style={dutyChip("rest", { height: 22, fontSize: 10.5 })}>{ar ? "ليلي" : "Night"}</span> : null}
      {day.exposed ? <span style={dutyChip("exposed", { height: 22, fontSize: 10.5 })}>{dutyLabel("exposed", ar)}</span> : null}
      <span style={dutyChip(day.status, { height: 22, fontSize: 10.5 })}>{day.status === "holiday" && day.off ? (ar ? day.off.labelAr : day.off.labelEn) || dutyLabel("holiday", ar) : dutyLabel(day.status, ar)}</span>
    </>
  );
}

/** Page list for the search: both lanes' pages this person may open, with the vocabulary key. */
export function dutySearchPages(employeePages = [], managePages = []) {
  const keyOf = (page, side) => (side === "manage" && page.key === "shifts" ? "shifts-manage" : page.key);
  const known = new Set(DUTY_SEARCH_PAGES.map((row) => row.key));
  return [
    ...employeePages.map((page) => ({ ...page, side: "employee", searchKey: keyOf(page, "employee") })),
    ...managePages.map((page) => ({ ...page, side: "manage", searchKey: keyOf(page, "manage") })),
  ].filter((page) => known.has(page.searchKey));
}
