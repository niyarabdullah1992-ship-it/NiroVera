/** Unified statutory chip labels and tones — Labour Law articles and ministerial decisions. */

import {
  nightMedicalDutyState,
  checkNightPregnancyBan,
  hasWrittenNightConsent,
  isNightWorker,
  performsNightWork,
  pregnancyNightBan,
} from "./decision18632.js";
import { nightRotateDue, nightRotateWeeks, pendingNightRotate } from "./nightRotateCycle.js";
import {
  checkNightCompensateOrReduceGate,
  employeeDutyShiftOnDay,
  isRosterLeaveDay,
  LEAVE_CITE_STYLE,
  nightRestPairHits,
  nightStreakWeeks,
  weekDays,
  weekStartDate,
} from "./shiftWeek.js";
import { isRamadanHoursSubject } from "./laborRules.js";

export const STATUTORY_TONES = ["cite", "entitlement", "warn", "block"];
export const STATUTORY_GLOWS = ["off", "in_scope", "due"];

const ENTITLEMENT_RULE_IDS = new Set([
  "leave.annual.days",
  "leave.annual.afterFiveYearsDays",
  "leave.annual.carry.cite",
  "leave.annual.deferMaxDays",
  "leave.annual.noticeDays",
  "leave.sick.days",
  "leave.sick.fullPayDays",
  "leave.sick.halfPayDays",
  "leave.sick.unpaidDays",
  "leave.maternity.days",
  "leave.iddah.days",
  "leave.iddah.nonMuslimDays",
  "leave.iddah.cite",
  "leave.maternity.mandatoryPostDays",
  "leave.maternity.preDaysMax",
  "leave.maternity.unpaidExtendDays",
  "leave.maternity.disabledChildDays",
  "leave.paternity.days",
  "leave.marriage.days",
  "leave.bereavement.days",
  "leave.bereavement_sibling.days",
  "leave.hajj.days",
  "leave.exam.cite",
  "leave.unpaid.cite",
  "leave.eid.cite",
  "leave.eid.fitrDays",
  "leave.eid.adhaDays",
  "leave.nationalDay.days",
  "leave.foundingDay.days",
  "leave.eid.overlap.cite",
  "leave.nursing.dailyMinutes",
  "hours.rest.weeklyHours",
  "hours.night.restHours",
  "hours.night.compensateOrReduce",
  "hours.night.rotateWeeks",
  "hours.night.pregnancyBanWeeks",
  "hours.night.medicalYearMonths",
  "eos.unusedLeave.cite",
  "hours.ot.premium",
  "hours.ot.compLeave.cite",
]);

const DUTY_RULE_IDS = new Set([
  "leave.noOtherEmployer.cite",
]);

/** Quiet article cites stay green (غير مستحق) unless glow is due. */
const WORKER_RIGHT_ARTICLES = new Set([
  "98", "101", "102", "104", "107", "109", "110", "111", "112", "113", "114", "115", "116", "117",
  "118", "151", "154", "160",
]);

export function statutoryArticleLabel(article, ar = true) {
  const n = String(article || "").trim();
  if (!n) return "";
  if (n === "18632") return statutoryDecisionLabel("18632", ar);
  return ar ? `المادة ${n}` : `Art. ${n}`;
}

export function statutoryDecisionLabel(id = "18632", ar = true) {
  const n = String(id || "18632").trim() || "18632";
  return ar ? `قرار ${n}` : `Decision ${n}`;
}

export function statutoryLabel({
  article,
  source,
  citeKind,
  decisionId,
  ruleId,
  ar = true,
} = {}) {
  const night = String(ruleId || "").startsWith("hours.night.")
    || String(decisionId || article || "") === "18632"
    || citeKind === "decision";
  if (night) return statutoryDecisionLabel(decisionId || (String(article) === "18632" ? article : "18632"), ar);
  if (article) return statutoryArticleLabel(article, ar);
  if (source === "ministerial") return ar ? "قرار وزاري" : "Ministerial decision";
  return "";
}

export function isEntitlementRule(ruleId) {
  const id = String(ruleId || "");
  if (!id || DUTY_RULE_IDS.has(id)) return false;
  if (ENTITLEMENT_RULE_IDS.has(id)) return true;
  return id.startsWith("leave.") && !id.includes("noOtherEmployer");
}

export function isWorkerRightCite({
  article,
  decisionId,
  citeKind,
  ruleId,
} = {}) {
  if (isEntitlementRule(ruleId)) return true;
  if (citeKind === "decision" || String(decisionId || "") === "18632") return true;
  const n = String(article || "").trim();
  if (n === "18632") return true;
  if (WORKER_RIGHT_ARTICLES.has(n)) return true;
  return Boolean(n);
}

export function inferStatutoryTone({
  ruleId,
  leaveType,
  article,
  decisionId,
  citeKind,
  tone,
  block,
  warn,
  entitlement,
} = {}) {
  if (tone && STATUTORY_TONES.includes(tone) && tone !== "cite") return tone;
  if (block) return "block";
  if (warn) return "warn";
  if (entitlement || leaveType || isWorkerRightCite({ article, decisionId, citeKind, ruleId })) {
    return "entitlement";
  }
  return "entitlement";
}

export function normalizeStatutoryGlow(glow) {
  const value = String(glow || "off");
  return STATUTORY_GLOWS.includes(value) ? value : "off";
}

export function maxStatutoryGlow(...states) {
  const rank = { off: 0, in_scope: 1, due: 2 };
  let best = "off";
  for (const state of states) {
    const next = normalizeStatutoryGlow(state);
    if (rank[next] > rank[best]) best = next;
  }
  return best;
}

function glowKind(kind) {
  const raw = String(kind || "").trim();
  if (!raw) return "";
  if (raw === "18632" || raw === "night" || raw === "decision" || raw === "decision.18632") return "hours.night";
  if (raw === "104") return "hours.rest.weeklyHours";
  return raw;
}

function isUnfitNightMedical(employee) {
  const profile = employee?.profile || {};
  const status = String(profile.nightFitnessStatus || profile.nightMedicalStatus || "").toLowerCase();
  return status === "unfit" || status === "failed" || profile.nightMedicalUnfit === true;
}

function weekStatutoryFacts({ employee, schedule, weekStart, laborCalendar } = {}) {
  const start = weekStartDate(weekStart || new Date());
  const days = weekDays(start);
  let performs = false;
  let worker = false;
  let assigned = 0;
  let restDays = 0;
  let compensateFail = false;
  let pregnancyAssigned = false;
  let medicalAssigned = false;
  if (!employee?.id || !schedule) {
    return {
      start,
      performs,
      worker,
      assigned,
      restDays,
      missingWeeklyRest: false,
      nightRestFail: false,
      compensateFail,
      pregnancyAssigned,
      medicalAssigned,
    };
  }
  for (const day of days) {
    // Art. 112 official holiday + approved leave are not duty endpoints (same as publish gates).
    if (isRosterLeaveDay(employee, day.key, laborCalendar)) {
      restDays += 1;
      continue;
    }
    const shift = employeeDutyShiftOnDay(schedule, employee, day.key, laborCalendar);
    if (!shift) {
      restDays += 1;
      continue;
    }
    assigned += 1;
    const nightWork = performsNightWork(shift, day.key);
    const nightWorker = isNightWorker(shift, day.key);
    if (nightWork) performs = true;
    if (nightWorker) worker = true;
    if (nightWork && !checkNightPregnancyBan({ employee, shift, onDate: day.key }).ok) pregnancyAssigned = true;
    if (nightWorker && !nightMedicalDutyState({ employee, shift, onDate: day.key }).ok) medicalAssigned = true;
    if (nightWorker && !checkNightCompensateOrReduceGate({
      shift,
      onDate: day.key,
      employee,
      schedule,
      laborCalendar,
    }).ok) compensateFail = true;
  }
  // Decision 18632 pairwise rest — shared with publish; never pairs through leave/rest ghosts.
  const nightRestFail = nightRestPairHits(schedule, employee, start, laborCalendar).length > 0;
  return {
    start,
    performs,
    worker,
    assigned,
    restDays,
    missingWeeklyRest: assigned > 0 && restDays === 0,
    nightRestFail,
    compensateFail,
    pregnancyAssigned,
    medicalAssigned,
  };
}

function nightConsentWaiting(employee) {
  return !!pendingNightRotate(employee);
}

function nightRotateOver({ employee, schedule, weekStart, worker } = {}) {
  if (!employee?.id) return false;
  const start = weekStartDate(weekStart || new Date());
  const weeks = nightStreakWeeks(schedule, employee.id, start) + (worker ? 1 : 0);
  return weeks > nightRotateWeeks(start) && !hasWrittenNightConsent(employee);
}

/**
 * Quiet unless this rule is in roster scope or an entitlement is due.
 * @returns {"off"|"in_scope"|"due"}
 */
export function statutoryGlowState({
  kind,
  employee,
  employees,
  schedule,
  weekStart,
  laborCalendar,
  failing = false,
} = {}) {
  if (Array.isArray(employees) && employees.length && !employee) {
    return maxStatutoryGlow(...employees.map((row) => statutoryGlowState({
      kind,
      employee: row,
      schedule,
      weekStart,
      laborCalendar,
      failing,
    })));
  }
  const id = glowKind(kind);
  if (!id) return "off";
  const facts = weekStatutoryFacts({ employee, schedule, weekStart, laborCalendar });
  const pending = nightConsentWaiting(employee);
  const rotate = employee
    ? nightRotateDue({ employee, schedule, weekStart: facts.start })
    : { due: false };
  const rotateDue = pending || rotate.due || nightRotateOver({
    employee,
    schedule,
    weekStart: facts.start,
    worker: facts.worker,
  });
  const pregnant = pregnancyNightBan(employee, facts.start);
  const unfit = isUnfitNightMedical(employee);

  let glow = "off";
  if (id === "hours.rest.weeklyHours") {
    if (facts.missingWeeklyRest) glow = "due";
    else if (facts.assigned > 0) glow = "in_scope";
  } else if (id === "hours.ramadan.ordinaryHours" || id === "hours.ramadan.weekMaxHours") {
    if (!isRamadanHoursSubject(employee)) glow = "off";
    else if (facts.assigned > 0) glow = "in_scope";
  } else if (id === "hours.night.pregnancyBanWeeks") {
    if (facts.pregnancyAssigned) glow = "due";
    else if (pregnant.ban) glow = "in_scope";
  } else if (id === "hours.night.medicalYearMonths") {
    if (facts.medicalAssigned) glow = "due";
    else if (unfit || facts.worker) glow = "in_scope";
  } else if (id === "hours.night.restHours") {
    if (facts.nightRestFail) glow = "due";
    else if (facts.performs) glow = "in_scope";
  } else if (id === "hours.night.compensateOrReduce") {
    if (facts.compensateFail) glow = "due";
    else if (facts.worker) glow = "in_scope";
  } else if (id === "hours.night.rotateWeeks") {
    if (rotateDue && (facts.worker || pending)) glow = "due";
    else if (facts.worker) glow = "in_scope";
  } else if (id === "hours.night" || id.startsWith("hours.night.")) {
    if (rotateDue && (facts.worker || facts.performs || pending)) glow = "due";
    else if (facts.worker || facts.performs) glow = "in_scope";
  }

  if (failing && glow === "in_scope") return "due";
  return glow;
}

/**
 * Roster rows stay shifts / rest / leave. Never return 18632 essay copy.
 * A name glow is allowed only when that employee is due.
 */
export function rosterNightRowMark({ employee, schedule, weekStart, laborCalendar } = {}) {
  const glow = statutoryGlowState({
    kind: "18632",
    employee,
    schedule,
    weekStart,
    laborCalendar,
  });
  return {
    glow,
    nameGlow: glow === "due",
    copy: null,
  };
}

/** Publish-check / roster header: essay text only when failing or due. Never use this to hide the article number. */
export function showStatutoryHeaderCite(glow, { ok = true, failing = false } = {}) {
  if (failing || !ok) return true;
  return normalizeStatutoryGlow(glow) === "due";
}

export function headerStatutoryGlow(glow, { ok = true, failing = false } = {}) {
  if (!showStatutoryHeaderCite(glow, { ok, failing })) return "off";
  const state = normalizeStatutoryGlow(glow);
  if ((failing || !ok) && state !== "due") return state === "off" ? "due" : state;
  return state;
}

/** One quiet 18632 cite on an in-scope night week — no glow, no essay. */
export function quietNightHeaderCite(glow) {
  return normalizeStatutoryGlow(glow) === "in_scope";
}

/** Match LawGateArticleBadge — soft navy cite, not green/pink glow. */
const CITE_SOFT = "var(--nv-soft, #F7F8FA)";
const CITE_INK = "var(--nv-ink2, #334155)";
const CITE_LINE = "var(--nv-line, #E2E8F0)";
const WARN_SOFT = "var(--nv-warn-soft, #FDF6E8)";
const WARN_INK = "var(--nv-warn-ink, #8A6516)";
const WARN_LINE = "var(--nv-warn-line, #ECD9A8)";
const BAD_SOFT = "var(--nv-bad-soft, #FBF1F2)";
const BAD_INK = "var(--nv-bad-ink, #8A1C2B)";
const BAD_LINE = "var(--nv-bad-line, #E9C4C9)";

/**
 * DS v2 cite chip: soft fill `--nv-*`, 1px line, radius 999, no outer glow.
 * Quiet cite / entitlement / in_scope → soft navy (article badge).
 * Due attention → warn soft (تنبيه) — never pink pulse.
 * Red (bad) only for true block / منع.
 */
export function statutoryChipStyle(tone = "entitlement", { compact, glow, surface } = {}) {
  const warn = tone === "warn";
  const block = tone === "block";
  const glowState = normalizeStatutoryGlow(glow);
  const due = glowState === "due";
  const quietOk = !due && !warn && !block;
  const onLeave = surface === "leave" && quietOk;
  let background = CITE_SOFT;
  let color = CITE_INK;
  let border = `1px solid ${CITE_LINE}`;
  if (block) {
    background = BAD_SOFT;
    color = BAD_INK;
    border = `1px solid ${BAD_LINE}`;
  } else if (due || warn) {
    background = WARN_SOFT;
    color = WARN_INK;
    border = `1px solid ${WARN_LINE}`;
  } else if (onLeave) {
    background = LEAVE_CITE_STYLE.bg;
    color = LEAVE_CITE_STYLE.fg;
    border = `1px solid ${LEAVE_CITE_STYLE.color}`;
  }
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: "fit-content",
    maxWidth: "max-content",
    flex: "0 0 auto",
    alignSelf: "flex-start",
    boxSizing: "border-box",
    padding: compact ? "0 5px" : "2px 7px",
    borderRadius: 999,
    fontSize: compact ? 9 : 10,
    fontWeight: 600,
    lineHeight: compact ? 1.55 : 1.6,
    whiteSpace: "nowrap",
    fontFamily: "inherit",
    background,
    color,
    border,
    boxShadow: "none",
    "--nv-stat-glow": "transparent",
  };
}
