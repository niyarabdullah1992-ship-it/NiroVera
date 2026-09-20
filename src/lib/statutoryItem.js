/** Unified statutory chip labels and tones — Labour Law articles and ministerial decisions. */

import {
  nightMedicalDutyState,
  checkNightPregnancyBan,
  hasWrittenNightConsent,
  isNightWorker,
  performsNightWork,
  pregnancyNightBan,
} from "./decision18632.js";
import { isOnApprovedLeave } from "./leaveTypes.js";
import { nightRotateDue, nightRotateWeeks, pendingNightRotate } from "./nightRotateCycle.js";
import {
  checkNightCompensateOrReduceGate,
  employeeShiftOnDay,
  LEAVE_CITE_STYLE,
  nightStreakWeeks,
  restGapHours,
  weekDays,
  weekStartDate,
} from "./shiftWeek.js";
import { isRamadanHoursSubject, ruleValue } from "./laborRules.js";

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

function weekStatutoryFacts({ employee, schedule, weekStart } = {}) {
  const start = weekStartDate(weekStart || new Date());
  const days = weekDays(start);
  let performs = false;
  let worker = false;
  let assigned = 0;
  let restDays = 0;
  let nightRestFail = false;
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
      nightRestFail,
      compensateFail,
      pregnancyAssigned,
      medicalAssigned,
    };
  }
  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    const onLeave = isOnApprovedLeave(employee, day.key);
    const shift = employeeShiftOnDay(schedule, employee.id, day.key);
    if (onLeave || !shift) {
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
    }).ok) compensateFail = true;
    if (index < 6) {
      const next = employeeShiftOnDay(schedule, employee.id, days[index + 1].key);
      if (next && (nightWork || performsNightWork(next, days[index + 1].key))) {
        const need = ruleValue("hours.night.restHours", day.key) || 12;
        if (restGapHours(shift, next) < need) nightRestFail = true;
      }
    }
  }
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
  void laborCalendar;
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
  const facts = weekStatutoryFacts({ employee, schedule, weekStart });
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

const ACCENT = "var(--nv-accent, #1E9E63)";
const ACCENT_SOFT = "var(--nv-accent-soft, color-mix(in oklab, #1E9E63 16%, #fff))";
const ACCENT_DEEP = "var(--nv-accent-deep, #14683F)";
const ACCENT_BORDER = "var(--nv-accent-border, color-mix(in oklab, #1E9E63 38%, #fff))";
const DANGER = "var(--nv-danger, #DC2626)";
const DANGER_SOFT = "var(--nv-danger-soft, color-mix(in oklab, #DC2626 10%, #fff))";
const DANGER_DEEP = "var(--nv-danger-deep, color-mix(in oklab, #DC2626 84%, #000))";
const DANGER_BORDER = "var(--nv-danger-border, color-mix(in oklab, #DC2626 28%, #fff))";
/**
 * Glow paint: due = red (owed). Quiet cite / entitlement = green (غير مستحق).
 * `cite` is an alias of entitlement — never a slate or colorless chip.
 */
export function statutoryChipStyle(tone = "entitlement", { compact, glow, surface } = {}) {
  const warn = tone === "warn";
  const block = tone === "block";
  const glowState = normalizeStatutoryGlow(glow);
  const due = glowState === "due";
  const quietOk = !due && !warn && !block;
  const onLeave = surface === "leave" && quietOk;
  const glowColor = due
    ? DANGER
    : block
      ? "#D97706"
      : warn
        ? "#B45309"
        : onLeave
          ? LEAVE_CITE_STYLE.fg
          : ACCENT;
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
    background: due
      ? DANGER_SOFT
      : onLeave
        ? LEAVE_CITE_STYLE.bg
        : quietOk
          ? ACCENT_SOFT
          : warn
            ? "#FFFBEB"
            : "#FEF2F2",
    color: due
      ? DANGER_DEEP
      : onLeave
        ? LEAVE_CITE_STYLE.fg
        : quietOk
          ? ACCENT_DEEP
          : warn
            ? "#B45309"
            : DANGER,
    border: due
      ? `1px solid ${DANGER_BORDER}`
      : onLeave
        ? `1px solid ${LEAVE_CITE_STYLE.color}`
        : quietOk
          ? `1px solid ${ACCENT_BORDER}`
          : warn
            ? "1px solid #FDE68A"
            : "1px solid #FECACA",
    "--nv-stat-glow": glowState === "off" ? "transparent" : glowColor,
  };
}
