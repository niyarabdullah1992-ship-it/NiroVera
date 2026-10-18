import { ruleValue } from "@/lib/laborRules";
import React, { forwardRef, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sectionRouteFor } from "@/lib/sectionRoutes";
import { NIGHT_FACILITY_FLAGS } from "@/lib/decision18632";

const NIGHT_SITE_KEYS = new Set(NIGHT_FACILITY_FLAGS.map((flag) => flag.key));
import { useAuth } from "@/lib/PowerCareAuth";
import {
  attachNightDueStripCards,
  groupDutyStripByPerson,
  weekDutyStripAlerts,
  weekStationDutyNotes,
} from "@/lib/shiftWeek";
import { managerDutyAlertGroups } from "@/lib/suiteBadges";
import { buildLawGatesBoard } from "@/lib/lawGatesBoard";
import { lawGatePillLabel } from "@/lib/lawGateStatus";
import DutyStripAlertCard, { dutyAlertActionStyle } from "@/components/employees/DutyStripAlertCard";
import { CalendarDays } from "lucide-react";
import { NightWorkDefinition } from "@/components/shared/NightWorkRightsTable";
import NightObligationProof from "@/components/schedules/NightObligationProof";
import {
  chip,
  chipButton,
  mono,
  quietAction,
  SectionHead,
  slab,
  sourceBadge,
} from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, {
  Counter,
  MinistryRow,
  MinistrySourceTabs,
  ministrySourceLabel,
  RegsSourceLine,
} from "@/components/schedules/MinistrySourceCards";

const OPEN_STATUS = new Set(["blocked", "violation", "waiting", "alert", "coming"]);

function checkTitle(gates, id) {
  if (!id) return "";
  const hit = (gates?.checks || []).find((row) => row?.id === id);
  return String(hit?.title || "").trim();
}

const NIGHT_ROW_TITLE_AR = {
  night_definition: "تعريف الليل على هذا الأسبوع",
  night_facilities: "التزامات المنشأة لليل",
  night_pay_equality: "لا تمييز في الأجر بسبب الليل",
  night_employer_duties: "تكافؤ التدريب ودليل إجراءات الليل",
  night_consideration: "يراعى كبار السن والمسؤوليات العائلية",
};
const NIGHT_ROW_TITLE_EN = {
  night_definition: "Night definition on this week",
  night_facilities: "Night workplace duties",
  night_pay_equality: "No pay discrimination because of night work",
  night_employer_duties: "Training parity and a night procedures guide",
  night_consideration: "Consider older workers and family duties",
};

/** Flatten the three law panels into one list of check rows. Presentation only — statuses come from the board. */
export function flattenBoard(board, gates, ar) {
  const items = [];
  for (const row of board.heat?.rows || []) {
    items.push({
      key: `3337:${row.id}`,
      source: "3337",
      article: "3337",
      status: row.status,
      pillLabel: row.pillLabel,
      title: row.title,
      summary: row.summary,
      who: row.who || "",
      checkId: row.id === "exposed" ? "heat_ban" : row.id === "unmarked" ? "heat_place" : "",
    });
  }
  for (const row of board.night?.rows || []) {
    /* The five employer obligations carry their own title — never the shared gate title. */
    const title = (row.obligationKey && row.title) || checkTitle(gates, row.checkId || row.id)
      || row.title
      || (ar ? NIGHT_ROW_TITLE_AR[row.id] : NIGHT_ROW_TITLE_EN[row.id])
      || row.summary;
    items.push({
      key: `18632:${row.id}`,
      source: "18632",
      article: "18632",
      status: row.status,
      pillLabel: row.pillLabel,
      title,
      summary: row.summary === title ? "" : row.summary,
      who: row.who || "",
      detail: row.detail || "",
      checkId: row.checkId || "",
      ...(row.obligationKey ? { obligationKey: row.obligationKey, clause: row.clause || "", sub: row.sub || "", reason: row.reason || "" } : {}),
    });
  }
  for (const row of board.labour?.rows || []) {
    const title = checkTitle(gates, row.checkId) || row.summary;
    items.push({
      key: `labour:${row.article}`,
      source: "labour",
      article: row.article,
      status: row.status,
      pillLabel: row.pillLabel,
      title,
      // Implementing Regulations that rest on this article (e.g. Regs 22/22 bis on 107) read under it.
      summary: [row.summary === title ? "" : row.summary, row.regs || ""].filter(Boolean).join(" · "),
      who: row.who || "",
      detail: row.detail || "",
      checkId: row.checkId || "",
    });
  }
  return items;
}

function cardSource(card) {
  const ids = [card?.gateId, ...(card?.items || []).map((row) => row.gateId)].filter(Boolean);
  const decisions = [card?.decisionId, ...(card?.items || []).map((row) => row.decisionId)].filter(Boolean).map(String);
  if (decisions.includes("18632") || ids.some((id) => String(id).startsWith("night_"))) return "18632";
  if (decisions.includes("3337") || ids.some((id) => String(id).startsWith("heat_"))) return "3337";
  return "labour";
}

const sourceLabel = ministrySourceLabel;

function CheckRow({ item, ar, compact = false, prove }) {
  const [open, setOpen] = useState(false);
  const pill = item.pillLabel || lawGatePillLabel(item.status, { ar });
  const whoLine = item.obligationKey
    ? item.sub || ""
    : !compact && (item.who || item.detail)
      ? [item.who, item.detail].filter(Boolean).join(" · ")
      : "";
  /* «أثبت» — managers / HR only, on an obligation that is not met (void rows stay for reference);
     a flag ticked before proofs existed can take its details. */
  const legacyFlag = item.reason === "flag" && item.status === "settled";
  // The fixed rule: night first aid · transfer · food belong to السلامة — the roster links there, it does not prove them.
  const section = item.obligationKey ? sectionRouteFor(NIGHT_SITE_KEYS.has(item.obligationKey) ? "night_facilities" : "", { audience: "manager" }) : sectionRouteFor(item.checkId, { audience: "manager" });
  const sectionOpen = section && item.status !== "settled" && item.status !== "void";
  const canProve = !section && !!(item.obligationKey && prove?.canProve && (item.status === "blocked" || item.status === "alert" || legacyFlag));
  return (
    <>
      <MinistryRow
        rowKey={item.key}
        source={item.source}
        badge={item.article}
        clause={item.clause}
        status={item.status}
        pill={pill}
        title={item.title}
        note={item.summary}
        sub={whoLine}
        compact={compact}
        ar={ar}
        action={sectionOpen ? (
          <Link to={section.href} data-section-link={section.section} style={quietAction()}>
            {ar ? section.ar : section.en}
          </Link>
        ) : canProve && !open ? (
          <button type="button" data-night-prove={item.obligationKey} onClick={() => setOpen(true)} style={quietAction()}>
            {legacyFlag ? (ar ? "أضف الإثبات" : "Add proof") : (ar ? "أثبت" : "Prove")}
          </button>
        ) : null}
      />
      {canProve && open ? (
        <div style={{ padding: "0 18px 12px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", minWidth: 0 }}>
          <NightObligationProof
            obligationKey={item.obligationKey}
            ar={ar}
            companyId={prove.companyId}
            stationId={prove.stationId}
            employees={prove.employees}
            actor={prove.actor}
            onCancel={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              prove.onSaved?.();
            }}
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * The compliance numbers for one week — shared by the panel itself and by the management side column
 * («أنظمة الوزارة — ملخّص»), so the counters on every management page are the very items the panel lists.
 * Rule logic stays in shiftWeek / lawGatesBoard; this only buckets it.
 */
export function useComplianceSummary({ gates, company, onDate, weekStart, employees = [], ar = true }) {
  const { currentUser, data } = useAuth();
  const board = useMemo(() => buildLawGatesBoard({ gates, company, onDate, ar }), [gates, company, onDate, ar]);
  const rows = useMemo(() => flattenBoard(board, gates, ar), [board, gates, ar]);

  const groups = useMemo(
    () => managerDutyAlertGroups(currentUser, data, weekStart, ar),
    [currentUser, data, weekStart, ar],
  );
  const grouped = useMemo(() => {
    const pack = attachNightDueStripCards(
      weekDutyStripAlerts(gates, { employees, ar, audience: "manager" }),
      groups,
      { ar, audience: "manager" },
    );
    return groupDutyStripByPerson(pack, { ar, audience: "manager" });
  }, [gates, employees, groups, ar]);
  const stationNotes = useMemo(() => weekStationDutyNotes(gates), [gates]);

  const covered = useMemo(() => {
    const set = new Set();
    for (const person of grouped.people || []) {
      [person.gateId, ...(person.items || []).map((row) => row.gateId)].filter(Boolean).forEach((gid) => set.add(String(gid)));
    }
    return set;
  }, [grouped]);

  const openRows = rows.filter((item) => OPEN_STATUS.has(item.status) && !(item.checkId && covered.has(String(item.checkId))));
  const settledRows = rows.filter((item) => !OPEN_STATUS.has(item.status));
  const people = (grouped.people || []).map((person) => ({ person, source: cardSource(person) }));

  /* The night-facilities gate is one blocker, listed as one row per missing obligation — count the rows. */
  const obligationBlocks = openRows.filter((item) => item.obligationKey && item.status === "blocked").length;
  const blockCount = (gates?.blockers || []).filter((row) => row?.id !== "night_facilities" || !obligationBlocks).length
    + (obligationBlocks ? obligationBlocks - 1 : 0);
  const warnCount = people.filter((row) => row.person.level !== "block").length
    + openRows.filter((item) => item.status !== "blocked" && item.status !== "violation").length
    + stationNotes.filter((note) => note.level !== "block").length;
  const settledCount = settledRows.length;
  const violationCount = openRows.filter((item) => item.status === "violation").length;
  const season = board.heat?.season || {};

  /** Per-source counters — the same items the list shows, bucketed by instrument. */
  const countsFor = (src) => {
    const peopleOf = people.filter((row) => row.source === src);
    const rowsOf = openRows.filter((item) => item.source === src);
    const notesOf = src === "labour" ? stationNotes : [];
    const block = peopleOf.filter((row) => row.person.level === "block").length
      + rowsOf.filter((item) => item.status === "blocked").length
      + notesOf.filter((note) => note.level === "block").length;
    const violation = rowsOf.filter((item) => item.status === "violation").length;
    const warn = Math.max(0, peopleOf.length + rowsOf.length + notesOf.length - block - violation);
    const settled = settledRows.filter((item) => item.source === src).length;
    return { block, warn, settled, violation, tone: block || violation ? "bad" : warn ? "warn" : "ok" };
  };
  const sourceCards = [
    {
      key: "18632",
      title: ar ? "القرار 18632 — العمل الليلي" : "Decision 18632 — night work",
      short: ar ? "العمل الليلي" : "Night work",
      scope: ar
        ? "راحة 12 ساعة بعد الليل · تدوير بعد 3 أشهر أو موافقة · تعويض الليل · الحامل · اللياقة الطبية · التزامات المنشأة"
        : "12h rest after night · rotate after 3 months or consent · night compensation · pregnancy · medical fitness · workplace duties",
    },
    {
      key: "3337",
      title: ar ? "القرار 3337 — حظر العمل المكشوف" : "Decision 3337 — open-sun ban",
      short: ar ? "حظر العمل المكشوف" : "Open-sun ban",
      scope: ar
        ? <>العمل المكشوف تحت الشمس <span dir="ltr" style={{ ...mono, whiteSpace: "nowrap" }}>{season.window}</span> في الموسم · مكشوف/مظلّل لكل موظف في كل يوم</>
        : <>Open-air work <span dir="ltr" style={mono}>{season.window}</span> in season · exposed / shaded per person per day</>,
    },
    {
      key: "labour",
      title: ar
        ? "نظام العمل — الساعات والراحة"
        : "Labour Law — hours and rest",
      short: ar ? "الساعات والراحة والعطل" : "Hours, rest and holidays",
      scope: ar
        ? `${ruleValue("hours.week.ordinaryMaxHours")} ساعة أسبوعياً · راحة ${ruleValue("hours.rest.duringShiftMinutes")} دقيقة كل ${ruleValue("hours.rest.maxConsecutiveHours")} ساعات · الراحة الأسبوعية · العطل الرسمية · رمضان · الأحداث`
        : `${ruleValue("hours.week.ordinaryMaxHours")}h a week · ${ruleValue("hours.rest.duringShiftMinutes")}-min rest every ${ruleValue("hours.rest.maxConsecutiveHours")}h · weekly rest · official holidays · Ramadan · juveniles`,
    },
  ].map((card) => ({ ...card, ...countsFor(card.key) }));

  return { board, rows, grouped, stationNotes, openRows, settledRows, people, blockCount, warnCount, settledCount, violationCount, season, sourceCards };
}

/**
 * «أنظمة الوزارة والتنبيهات» — one compliance surface for the management lane.
 * Replaces the alerts rail, the three law panels and the publish gate strip.
 * `source` / `onSource` let the page (tiles, side column, ?src=) drive the filter.
 * Each person row ends with «في الجدول ›» (that row on the grid) and, when the alert belongs to another
 * section, that section's link (طلباتي · السلامة) — never the employee file (lib/sectionRoutes).
 */
const ScheduleCompliancePanel = forwardRef(function ScheduleCompliancePanel({
  gates,
  company,
  onDate,
  weekStart,
  employees = [],
  ar = true,
  canApplyOrdinary = false,
  onApplyOrdinary,
  onNightRemedy,
  highlighted = false,
  id = "nv-compliance-panel",
  source: sourceProp,
  onSource,
  onFocusPerson,
  summary: summaryProp,
  /** The page side column already shows the three source counters — keep only the filter chips here. */
  hideSourceCards = false,
  /** 18632 obligation proofs — { canProve, companyId, stationId, employees, actor, onSaved }; managers / HR only. */
  prove = null,
}, ref) {
  const [sourceLocal, setSourceLocal] = useState("all");
  const source = sourceProp || sourceLocal;
  const setSource = (next) => {
    setSourceLocal(next);
    onSource?.(next);
  };
  const [showSettled, setShowSettled] = useState(false);

  const own = useComplianceSummary({ gates, company, onDate, weekStart, employees, ar });
  const { board, grouped, stationNotes, openRows, settledRows, people, blockCount, warnCount, settledCount, violationCount = 0, season, sourceCards } = summaryProp || own;

  const matches = (src) => source === "all" || src === source;
  const visiblePeople = people.filter((row) => matches(row.source));
  // The five 18632 employer obligations stay in view as one band — met or not — so management always
  // sees what the branch has proven; they are not folded under «عرض المستوفى».
  const obligationRows = matches("18632") ? [...openRows, ...settledRows].filter((item) => item.obligationKey) : [];
  const visibleRows = openRows.filter((item) => matches(item.source) && !item.obligationKey);
  const visibleSettled = settledRows.filter((item) => matches(item.source) && !item.obligationKey);
  const visibleNotes = source === "all" || source === "labour" ? stationNotes : [];
  const nothingOpen = !visiblePeople.length && !visibleRows.length && !visibleNotes.length;
  const obligationsOpen = obligationRows.filter((item) => item.status === "blocked" || item.status === "alert").length;
  const hasNightConsent = (grouped.cards || []).some((row) => row.gateId === "night_rotate");

  const checks = blockCount + violationCount + warnCount + settledCount;
  const lede = ar
    ? <><span dir="ltr" style={mono}>{checks}</span> فحصاً على أسبوع هذا الفرع، وكل سطر يقول هل يستوفيه الجدول الآن.</>
    : <><span dir="ltr" style={mono}>{checks}</span> checks on this branch's week; each row says whether the roster meets it now.</>;

  return (
    <section
      ref={ref}
      id={id}
      data-compliance-panel="1"
      data-highlight={highlighted ? "1" : undefined}
      className="nv-sched-compliance"
      style={{ ...slab, display: "flex", flexDirection: "column", scrollMarginTop: 88 }}
    >
      <SectionHead
        title={ar ? "أنظمة الوزارة — ما يخص الدوام" : "Ministry rules — duty"}
        note={lede}
        trailing={(
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Counter value={blockCount + violationCount + warnCount} label={ar ? "تنبيه" : "alert"} tone="warn" />
            <Counter value={settledCount} label={ar ? "مستوفٍ" : "met"} tone="ok" />
            <Counter value={0} label={ar ? "للعلم" : "reference"} tone="mute" />
          </div>
        )}
      />

      <div style={{ padding: "14px 18px 12px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        {hideSourceCards ? null : <MinistrySourceCards cards={sourceCards} active={source} onPick={setSource} ar={ar} />}
        <MinistrySourceTabs active={source} onPick={setSource} ar={ar} chipButton={chipButton} />
      </div>

      {nothingOpen && !obligationsOpen ? (
        <div style={{ padding: "16px 18px", fontSize: 12.5, color: "var(--nv-muted)", lineHeight: 1.75 }}>
          {source === "all"
            ? (ar ? "لا مانع ولا تنبيه على هذا الأسبوع. الفحوص المستوفاة في الأسفل." : "No block and no alert on this week. Satisfied checks sit below.")
            : (ar ? `لا مانع ولا تنبيه من ${sourceLabel(source, ar)} على هذا الأسبوع.` : `No block or alert from ${sourceLabel(source, ar)} on this week.`)}
        </div>
      ) : (
        <div data-compliance-open="1" style={{ display: "flex", flexDirection: "column" }}>
          {visibleNotes.map((note) => (
            <div key={note.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "start", padding: "10px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
              <span style={sourceBadge()}>{ar ? "منصة" : "Platform"}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.5 }}>{note.title}</span>
                <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.65 }}>
                  {note.note || (ar ? "يبقى على زر النشر — ليس واجباً على شخص." : "Stays on the publish control — not a duty on a person.")}
                </span>
              </span>
              <span style={chip(note.level === "block" ? "bad" : "warn")}>{note.level === "block" ? (ar ? "مُنع" : "Blocked") : (ar ? "ينتظر" : "Waiting")}</span>
            </div>
          ))}
          {visiblePeople.map(({ person }) => (
            <DutyStripAlertCard
              key={person.id}
              card={person}
              ar={ar}
              hideJudgment
              row
              onApplyOrdinary={canApplyOrdinary && onApplyOrdinary
                ? (kind) => {
                  const emp = employees.find((item) => String(item.id) === String(person.employeeId));
                  const rotate = [person.gateId, ...(person.items || []).map((item) => item.gateId)]
                    .some((gid) => gid === "night_rotate");
                  return onApplyOrdinary(emp, kind, rotate ? undefined : person.onDate);
                }
                : undefined}
              onNightRemedy={canApplyOrdinary && onNightRemedy
                ? (kind, extra) => {
                  const emp = employees.find((item) => String(item.id) === String(person.employeeId));
                  return onNightRemedy(emp, kind, extra);
                }
                : undefined}
            >
              {person.employeeId && onFocusPerson ? (
                <span data-person-links="1" style={{ display: "contents" }}>
                  <button type="button" onClick={() => onFocusPerson(person.employeeId, person.onDate)} style={dutyAlertActionStyle()}>
                    <CalendarDays size={14} aria-hidden />
                    {ar ? "افتح في الجدول" : "Open on the roster"}
                  </button>
                </span>
              ) : null}
            </DutyStripAlertCard>
          ))}
          {visibleRows.map((item) => <CheckRow key={item.key} item={item} ar={ar} prove={prove} />)}
          {hasNightConsent && (source === "all" || source === "18632") ? (
            <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
              <Link to="/app/requests/manage" style={quietAction({ color: "var(--nv-muted)" })}>
                {ar ? "افتح القرار في إدارة طلباتي" : "Open the decision in Requests"}
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {obligationRows.length ? (
        <div data-night-obligations="1" style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--nv-line2, #EEF2F7)" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={sourceBadge()}>18632</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", flex: "1 1 180px", minWidth: 0 }}>
              {ar ? "التزامات المنشأة للعمل الليلي" : "Employer duties for night work"}
            </span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
              {obligationRows.every((item) => item.status === "void")
                ? (ar ? "لا عمل ليلي هذا الأسبوع — لا تسري" : "No night work this week — not in force")
                : ar
                  ? (obligationsOpen ? <><span dir="ltr" style={mono}>{obligationsOpen}</span> ناقص من <span dir="ltr" style={mono}>{obligationRows.length}</span></> : <><span dir="ltr" style={mono}>{obligationRows.length}</span> من <span dir="ltr" style={mono}>{obligationRows.length}</span> بلا نقص</>)
                  : (obligationsOpen ? `${obligationsOpen} missing of ${obligationRows.length}` : `${obligationRows.length} of ${obligationRows.length} with no gap`)}
            </span>
          </div>
          {obligationRows.map((item) => <CheckRow key={item.key} item={item} ar={ar} prove={prove} />)}
        </div>
      ) : null}

      <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setShowSettled((value) => !value)}
          aria-expanded={showSettled}
          style={quietAction()}
        >
          {showSettled
            ? (ar ? "إخفاء المستوفى" : "Hide satisfied")
            : (ar ? `عرض المستوفى (${visibleSettled.length})` : `Show satisfied (${visibleSettled.length})`)}
        </button>
        <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
          {ar ? "كل صف يُفحص على الأسبوع المعروض ويكتب أثره في سجل الموظف." : "Each row is checked on the week shown and recorded on the employee file."}
        </span>
      </div>

      {showSettled ? (
        <div data-compliance-settled="1" style={{ borderTop: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", flexDirection: "column" }}>
          {visibleSettled.map((item) => <CheckRow key={item.key} item={item} ar={ar} compact prove={prove} />)}
          {source === "all" || source === "18632" ? (
            <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink2)" }}>{board.night?.title}</span>
              <NightWorkDefinition
                ar={ar}
                windowText={ar ? board.night?.windowAr : board.night?.windowEn}
                performerText={ar ? board.night?.performerAr : board.night?.performerEn}
                workerText={ar ? board.night?.workerAr : board.night?.workerEn}
              />
            </div>
          ) : null}
          {source === "all" || source === "3337" ? (
            <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid var(--nv-line2, #EEF2F7)", fontSize: 11.5, lineHeight: 1.75, color: "var(--nv-ink2)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink2)" }}>{board.heat?.title}</span>
              <span>
                <span style={{ color: "var(--nv-muted)" }}>{ar ? "تعريف الموسم: " : "Season: "}</span>
                {ar ? season.rangeAr : season.rangeEn}
                {" · "}
                <span style={{ color: "var(--nv-muted)" }}>{ar ? "النافذة اليومية: " : "Daily window: "}</span>
                <span dir="ltr" style={mono}>{season.window}</span>
              </span>
              <span style={{ color: "var(--nv-muted)" }}>{ar ? season.noteAr : season.noteEn}</span>
              <span style={{ textAlign: "start", unicodeBidi: "plaintext", display: "block" }}>
                <strong style={{ color: "var(--nv-ink)" }}>{board.heat?.quoteTitle}</strong>
                {" — "}
                {ar ? board.heat?.quoteNoteAr : board.heat?.quoteNoteEn}
              </span>
              <blockquote dir={ar ? "rtl" : "ltr"} style={{ margin: 0, paddingInlineStart: 10, borderInlineStart: "2px solid var(--nv-line)", textAlign: "start", unicodeBidi: "plaintext" }}>
                «{ar ? board.heat?.quoteAr : board.heat?.quoteEn}»
              </blockquote>
            </div>
          ) : null}
          {source === "all" || source === "labour" ? (
            <p style={{ margin: 0, padding: "10px 18px", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>{board.labour?.footer}</p>
          ) : null}
        </div>
      ) : null}
      <RegsSourceLine ar={ar} />
    </section>
  );
});

export default ScheduleCompliancePanel;
