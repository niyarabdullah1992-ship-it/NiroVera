// deno-lint-ignore-file no-explicit-any
/**
 * Server twin of the roster blocks in src/lib/shiftWeek.js checkWeekPublishGates that the month publish
 * gate (checkPublishGates) did not run: Decision 18632 (12h rest between night/day, 3-month rotation,
 * compensation, pregnancy 24 weeks, medical unfit / nightAvoid, night facilities), the juvenile blocks
 * (Arts 161–166) and Decision 3337 per-person exposed / shaded marks. Same rule rows, same ids.
 * Parity with the client is asserted by scripts/test-roster-law.mjs.
 */
import { isRamadanDay, isRamadanHoursSubject, ruleValue } from "./laborRules.ts";
import { isOfficialHolidayDay, isOnApprovedLeave } from "./leaveDerivations.ts";
import { nightAvoidOn } from "./rightsRequests.ts";
import { heatBanWindow, isHeatBanDate, shiftOverlapsHeatBan } from "./contractLawDerivations.ts";

export type RosterLawCheck = {
  id: string;
  ok: boolean;
  block?: boolean;
  labelAr: string;
  labelEn: string;
  noteAr: string;
  noteEn: string;
  article?: string;
  names?: string[];
};

/* ---------------- calendar helpers (local civil days, Sunday weeks — same as the client) ---------------- */
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (key: string) => {
  const [y, m, d] = String(key || "").slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDaysKey = (key: string, n: number) => {
  const d = parse(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
export const weekStartKey = (key: string) => {
  const d = parse(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
};
const weekKeys = (start: string) => Array.from({ length: 7 }, (_, i) => addDaysKey(weekStartKey(start), i));
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

function clockMinutes(hhmm: any) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return ((((Number.isFinite(h) ? h : 0) % 24) + 24) % 24) * 60 + (Number.isFinite(m) ? m : 0);
}
function spanMinutes(start: any, end: any) {
  let m = clockMinutes(end) - clockMinutes(start);
  if (m < 0) m += 1440;
  return m;
}
function yes(v: any) {
  if (v === true || v === 1 || v === "1") return true;
  return /^(yes|true|نعم)$/i.test(String(v || "").trim());
}

/* ---------------- roster reading ---------------- */
function dayMap(assignments: any, key: string, datedOnly = false) {
  if (!assignments || !key) return null;
  const dated = assignments[key];
  if (dated && typeof dated === "object" && !Array.isArray(dated)) return dated;
  if (datedOnly || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const weekly = assignments[parse(key).getDay()] || assignments[String(parse(key).getDay())];
  return weekly && typeof weekly === "object" && !Array.isArray(weekly) ? weekly : null;
}
export function shiftOnDay(schedule: any, employeeId: any, key: string, datedOnly = false) {
  const day = dayMap(schedule?.assignments, key, datedOnly);
  if (!day) return null;
  return (schedule?.shiftTypes || []).find((s: any) => (day[s.id] || []).map(String).includes(String(employeeId))) || null;
}
export function holidayWorkOn(employee: any, key: string) {
  const row = employee?.holidayWork?.[String(key).slice(0, 10)];
  return row && !row.withdrawnAt ? row : null;
}
function rosterLeave(employee: any, key: string, calendar: any) {
  if (isOnApprovedLeave(employee?.leaveRequests || [], key)) return true;
  if (!isOfficialHolidayDay(key, calendar)) return false;
  return !holidayWorkOn(employee, key);
}
function dutyShift(schedule: any, employee: any, key: string, calendar: any) {
  if (rosterLeave(employee, key, calendar)) return null;
  return shiftOnDay(schedule, employeeIdOf(employee), key);
}
const employeeIdOf = (e: any) => String(e?.id ?? e?.employeeId ?? "");
const nameOf = (e: any) => String(e?.name || employeeIdOf(e));

function restMinutesOf(shift: any) {
  if (shift?.breakMode === "flex" && Number(shift?.flexBreak?.minutes) > 0) return Math.round(Number(shift.flexBreak.minutes));
  if (Array.isArray(shift?.breaks) && shift.breaks.length) {
    return shift.breaks.reduce((sum: number, b: any) => sum + (b?.start && b?.end ? spanMinutes(b.start, b.end) : Math.max(0, Number(b?.minutes) || 0)), 0);
  }
  return shift?.restMinutes == null ? null : Math.max(0, Number(shift.restMinutes) || 0);
}
function presenceHours(shift: any) {
  return Math.round((spanMinutes(shift.start, shift.end) / 60) * 10) / 10;
}
function actualHours(shift: any, onDate: string) {
  const span = presenceHours(shift);
  const recorded = restMinutesOf(shift);
  const rest = recorded == null ? (span > ruleValue("hours.rest.maxConsecutiveHours", onDate) ? ruleValue("hours.rest.duringShiftMinutes", onDate) : 0) : recorded;
  return Math.max(0, Math.round((span - rest / 60) * 10) / 10);
}
function restGapHours(from: any, to: any) {
  if (!from?.end || !to?.start) return 24;
  let end = clockMinutes(from.end);
  if (end <= clockMinutes(from.start)) end += 1440;
  return Math.round((((clockMinutes(to.start) + 1440) - end) / 60) * 10) / 10;
}

/* ---------------- Decision 18632 ---------------- */
export function nightMinutes(start: any, end: any, onDate: string) {
  const nightStart = ruleValue("hours.night.startHour", onDate) * 60;
  const morningEnd = ruleValue("hours.night.endHour", onDate) * 60;
  const a = clockMinutes(start);
  let b = clockMinutes(end);
  if (b <= a) b += 1440;
  let minutes = 0;
  for (let wrap = 0; wrap < 2; wrap += 1) {
    const day = wrap * 1440;
    minutes += Math.max(0, Math.min(b, day + morningEnd) - Math.max(a, day));
    minutes += Math.max(0, Math.min(b, day + 1440) - Math.max(a, day + nightStart));
  }
  return minutes;
}
const performsNight = (shift: any, key: string) => !!(shift?.start && shift?.end) && nightMinutes(shift.start, shift.end, key) > 0;
const nightWorker = (shift: any, key: string) => !!(shift?.start && shift?.end) && nightMinutes(shift.start, shift.end, key) >= (ruleValue("hours.night.workerHours", key) || 3) * 60;

function hasWrittenNightConsent(employee: any) {
  const withdrawn = employee?.profile?.nightConsentWithdrawnAt;
  const given = employee?.profile?.nightConsentAt;
  if (given && (!withdrawn || String(withdrawn) < String(given))) return true;
  return (employee?.otherRequests || []).some((r: any) => r?.type === "night_consent" && r.status === "approved" && r.decision === "agree" && !r.withdrawnAt);
}
function activeNightRemedy(employee: any) {
  const row = employee?.profile?.nightRemedy;
  if (!row || row.withdrawnAt) return null;
  return ["allowance", "reduce", "rotate"].includes(row.kind) ? row : null;
}
function hasNightHoursReduction(employee: any, onDate: string) {
  if (activeNightRemedy(employee)?.kind === "reduce") return true;
  const at = String(employee?.profile?.nightHoursReducedAt || "");
  return !!at && at.slice(0, 7) === weekStartKey(onDate).slice(0, 7);
}
const COMP_KEYS = ["nightCompensation", "nightAllowance", "nightCompensated", "nightOtTreatment", "nightPremium", "nightTransport", "nightTransportAllowance", "nightBenefit"];
function compFlag(v: any) {
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "number" && v > 0) return true;
  return /^(true|yes|ok|allowance|ot|compensat)/i.test(String(v || "").trim());
}
function hasRecordedNightCompensation(bags: any[], employee: any, shift: any) {
  if (activeNightRemedy(employee)?.kind === "allowance") return true;
  return [...bags, employee?.profile, shift].some((bag) => bag && COMP_KEYS.some((k) => compFlag(bag[k])));
}
function nightStreakWeeks(schedule: any, id: string, start: string, lookback = 40) {
  let weeks = 0;
  let ordinaryRun = 0;
  const need = ruleValue("hours.night.rotateOrdinaryWeeks", start) || 4;
  for (let back = 1; back <= lookback; back += 1) {
    const prev = addDaysKey(weekStartKey(start), -7 * back);
    const any = weekKeys(prev).some((k) => nightWorker(shiftOnDay(schedule, id, k, true), k));
    if (any) {
      weeks += 1;
      ordinaryRun = 0;
    } else {
      ordinaryRun += 1;
      if (ordinaryRun >= need) break;
    }
  }
  return weeks;
}
function compensationExempt(schedule: any, id: string, onDate: string, calendar: any, test: (s: any, k: string) => boolean) {
  if (isRamadanDay(onDate, calendar)) return true;
  const year = onDate.slice(0, 4);
  const dated = Object.keys(schedule?.assignments || {}).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k.startsWith(year));
  if (dated.length < 28) return false;
  const yearDays = dated.filter((k) => test(shiftOnDay(schedule, id, k, true), k)).length;
  if (yearDays > (ruleValue("hours.night.incidentalYearDays", onDate) || 45)) return false;
  const d = parse(onDate);
  let consecutive = 0;
  for (let back = 0; back < 18; back += 1) {
    const c = new Date(d.getFullYear(), d.getMonth() - back, 1);
    const prefix = `${c.getFullYear()}-${pad(c.getMonth() + 1)}-`;
    const hit = Object.keys(schedule?.assignments || {}).some((k) => k.startsWith(prefix) && test(shiftOnDay(schedule, id, k, true), k));
    if (!hit) break;
    consecutive += 1;
  }
  if (consecutive >= 2) return false;
  let share = 0;
  for (let back = 0; back < 12; back += 1) {
    const c = new Date(d.getFullYear(), d.getMonth() - back, 1);
    const prefix = `${c.getFullYear()}-${pad(c.getMonth() + 1)}-`;
    let night = 0;
    let total = 0;
    for (const k of Object.keys(schedule?.assignments || {})) {
      if (!k.startsWith(prefix)) continue;
      const s = shiftOnDay(schedule, id, k, true);
      if (!s) continue;
      total += spanMinutes(s.start, s.end);
      night += nightMinutes(s.start, s.end, k);
    }
    if (total > 0 && night / total >= 0.25) share += 1;
    else if (back > 0) break;
  }
  return share < 2;
}
function pregnancyBan(employee: any, onDate: string) {
  const p = employee?.profile || {};
  const due = String(p.expectedBirthDate || p.dueDate || "").slice(0, 10);
  const extra = String(p.nightPregnancyBanUntil || p.nursingNightBanUntil || "").slice(0, 10);
  const weeks = ruleValue("hours.night.pregnancyBanWeeks", onDate) || 24;
  if (/^\d{4}-\d{2}-\d{2}$/.test(extra) && onDate <= extra) return { ban: true, extra: true };
  if (!(yes(p.pregnant) || due)) return { ban: false };
  if (!due) return { ban: true };
  const toDue = daysBetween(onDate, due);
  return { ban: toDue <= weeks * 7 && toDue >= -14, extra: false };
}
function pregnancyBlocks(employee: any, shift: any, onDate: string) {
  if (!performsNight(shift, onDate)) return false;
  const ban = pregnancyBan(employee, onDate);
  if (!ban.ban) return false;
  const p = employee?.profile || {};
  if (ban.extra && yes(p.nightTransferImpossible) && !nightWorker(shift, onDate) && yes(p.nightPayPreserved)) return false;
  return true;
}
function medicalState(employee: any, shift: any, onDate: string) {
  if (!nightWorker(shift, onDate)) return { block: false, unmet: false };
  const p = employee?.profile || {};
  const status = String(p.nightFitnessStatus || p.nightMedicalStatus || "").toLowerCase();
  if (nightAvoidOn(p, onDate) || status === "unfit" || status === "failed" || yes(p.nightMedicalUnfit)) return { block: true, unmet: true };
  const files = Array.isArray(p.nightMedicalFiles) ? p.nightMedicalFiles : [];
  const file = (p.nightMedicalReport && (p.nightMedicalReport.url || p.nightMedicalReport.name)) ? p.nightMedicalReport : files.find((f: any) => f && (f.url || f.name));
  if (!file) return { block: false, unmet: true };
  if (file.permanent === true || p.nightMedicalPermanent === true) return { block: false, unmet: false };
  const day = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "").slice(0, 10)) ? String(v).slice(0, 10) : "");
  const from = day(file.from) || day(file.issuedAt) || day(file.issued) || day(file.date) || day(p.nightMedicalIssuedAt);
  const to = day(file.to) || day(file.until) || day(file.expiresAt) || day(p.nightMedicalUntil)
    || (from && !file.from && !file.to ? addDaysKey(from, Math.round(((Number(ruleValue("hours.night.medicalYearMonths", onDate)) || 12) * 365.25) / 12)) : "");
  return { block: false, unmet: !(from && to && from <= onDate && onDate <= to) };
}

/* ---------------- juveniles (Arts 161–166) ---------------- */
function ageYears(employee: any, onDate: string) {
  const birth = String(employee?.profile?.birthDate || employee?.birthDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  return daysBetween(birth, onDate) / 365.25;
}
function isJuvenile(employee: any, onDate: string) {
  const y = ageYears(employee, onDate);
  return y != null && y >= ruleValue("hours.juvenile.minAgeYears", onDate) && y < ruleValue("hours.juvenile.maxAgeYears", onDate);
}
function weeklyRestDow(company: any) {
  const posting = company?.hoursPolicy?.workPosting || company?.attendanceSettings?.hoursPolicy?.workPosting || {};
  const n = Number(posting.weeklyRestDow);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 5;
}
/** Art. 162–164 on one duty — the same order of errors as the client checkJuvenileRosterGate. */
export function juvenileDutyError(employee: any, shift: any, onDate: string, company: any, calendar: any) {
  const years = ageYears(employee, onDate);
  if (years != null && years < (ruleValue("hours.juvenile.minAgeYears", onDate) || 15)) return "JUVENILE_UNDER_AGE";
  if (!shift || !isJuvenile(employee, onDate)) return null;
  const restMin = shift.restMinutes == null ? (ruleValue("hours.rest.duringShiftMinutes", onDate) || 30) : Number(shift.restMinutes) || 0;
  const presence = presenceHours(shift);
  const actual = actualHours(shift, onDate);
  const consecutive = restMin >= 30 ? Math.round(((presence - restMin / 60) / 2) * 10) / 10 : presence;
  const restDay = parse(onDate).getDay() === weeklyRestDow(company);
  if (restDay || isOfficialHolidayDay(onDate, calendar) || isOnApprovedLeave(employee?.leaveRequests || [], onDate)) return "JUVENILE_REST_BAN";
  if (nightMinutes(shift.start, shift.end, onDate) > 0) return "JUVENILE_NIGHT_BAN";
  const dayCap = isRamadanDay(onDate, calendar) && isRamadanHoursSubject(employee)
    ? ruleValue("hours.juvenile.ramadanHours", onDate)
    : ruleValue("hours.juvenile.ordinaryHours", onDate);
  if (actual > dayCap) return "JUVENILE_DAY_CAP";
  if (consecutive > ruleValue("hours.juvenile.maxStretchHours", onDate)) return "JUVENILE_STRETCH";
  if (presence > ruleValue("hours.juvenile.maxPresenceHours", onDate)) return "JUVENILE_PRESENCE";
  return null;
}
const JUVENILE_DOC_KEYS = ["juvenileIdDoc", "juvenileFitnessCert", "juvenileGuardianConsent"];
function juvenileDocGaps(employee: any) {
  const p = employee?.profile || {};
  const gaps = JUVENILE_DOC_KEYS.filter((k) => p[k] !== true);
  if (!String(p.juvenileOfficeNotifiedAt || "").trim()) gaps.push("juvenileOfficeNotifiedAt");
  if (String(p.guardianFullName || "").trim().split(/\s+/).filter(Boolean).length < 2) gaps.push("guardianFullName");
  if (!String(p.juvenileResidence || p.residence || p.address || "").trim()) gaps.push("juvenileResidence");
  return gaps;
}

/* ---------------- Decision 3337 — per-person exposed / shaded ---------------- */
function sunMark(schedule: any, employeeId: string, key: string, shift: any) {
  const norm = (v: any) => (v === "field" || v === "office" ? v : null);
  const day = schedule?.sunExposure?.[key];
  if (day && Object.prototype.hasOwnProperty.call(day, employeeId)) return norm(day[employeeId]);
  const fallback = norm(schedule?.sunExposureDefault?.[employeeId]);
  if (fallback) return fallback;
  if (shift?.outdoor === true) return "field";
  if (shift?.outdoor === false) return "office";
  return null;
}

/* ---------------- the month read ---------------- */
export function rosterLawChecks(input: {
  year: number;
  monthIndex: number;
  schedule: any;
  employees?: any[];
  station?: any;
  settings?: any;
  company?: any;
  laborCalendar?: any;
  today?: string;
}): RosterLawCheck[] {
  const schedule = input.schedule || {};
  const employees = input.employees || [];
  const calendar = input.laborCalendar || null;
  const company = input.company || null;
  const today = String(input.today || keyOf(new Date())).slice(0, 10);
  const days = new Date(input.year, input.monthIndex + 1, 0).getDate();
  const keys = Array.from({ length: days }, (_, i) => `${input.year}-${pad(input.monthIndex + 1)}-${pad(i + 1)}`);
  const onDate = keys[0];
  const bags = [schedule, input.station, input.station?.settings, input.settings, input.settings?.attendance, company, company?.attendanceSettings, company?.nightFacilities].filter(Boolean);

  const assignedIds = new Set<string>();
  for (const k of keys) {
    const day = dayMap(schedule.assignments, k);
    if (!day) continue;
    for (const ids of Object.values(day)) for (const id of (Array.isArray(ids) ? ids : [])) assignedIds.add(String(id));
  }
  const roster = [...assignedIds].map((id) => employees.find((e) => employeeIdOf(e) === id || String(e?.employeeId) === id) || { id, name: id });

  const hit: Record<string, string[]> = {};
  const add = (id: string, e: any) => {
    hit[id] = hit[id] || [];
    if (!hit[id].includes(nameOf(e))) hit[id].push(nameOf(e));
  };
  let performers = 0;
  let nightWorkers = 0;
  let juveniles = 0;
  const rotateWeeks = ruleValue("hours.night.rotateWeeks", onDate) || 13;
  const nightRest = ruleValue("hours.night.restHours", onDate) || 12;
  const juvenileNightNeed = ruleValue("hours.juvenile.nightBanHours", onDate) || 12;

  for (const e of roster) {
    const id = employeeIdOf(e);
    let performerHere = false;
    let workerHere = false;
    let juvenileHere = false;
    const rotateChecked = new Set<string>();
    // 12h rest between consecutive duty days if either enters the night window (from the day before the month).
    for (let i = -1; i < keys.length; i += 1) {
      const a = i < 0 ? addDaysKey(keys[0], -1) : keys[i];
      const b = addDaysKey(a, 1);
      if (b > keys[keys.length - 1] && i === keys.length - 1) {
        // the next month's first day only if it is dated on the roster
        if (!dayMap(schedule.assignments, b, true)) continue;
      }
      const from = dutyShift(schedule, e, a, calendar);
      const to = dutyShift(schedule, e, b, calendar);
      if (!from || !to) continue;
      if ((performsNight(from, a) || performsNight(to, b)) && restGapHours(from, to) < nightRest) add("night_rest", e);
    }
    for (const k of keys) {
      const shift = dutyShift(schedule, e, k, calendar);
      if (!shift) continue;
      const performs = performsNight(shift, k);
      const worker = nightWorker(shift, k);
      if (performs) {
        performerHere = true;
        if (pregnancyBlocks(e, shift, k)) add("night_pregnancy", e);
        if (!compensationExempt(schedule, id, k, calendar, performsNight)
          && !hasRecordedNightCompensation(bags, e, shift) && !hasNightHoursReduction(e, k)) add("night_performer_comp", e);
      }
      if (worker) {
        workerHere = true;
        const med = medicalState(e, shift, k);
        if (med.block) add("night_medical", e);
        else if (med.unmet) add("night_medical_file", e);
        const reduced = presenceHours(shift) + 1e-9 < (ruleValue("hours.shift.ordinaryHours", k) || 8);
        if (!compensationExempt(schedule, id, k, calendar, nightWorker)
          && !(reduced || hasNightHoursReduction(e, k)) && !hasRecordedNightCompensation(bags, e, shift)) add("night_compensate", e);
        const ws = weekStartKey(k);
        if (!rotateChecked.has(ws)) {
          rotateChecked.add(ws);
          if (nightStreakWeeks(schedule, id, ws) + 1 > rotateWeeks && !hasWrittenNightConsent(e)) add("night_rotate", e);
        }
      }
      const juvenileError = juvenileDutyError(e, shift, k, company, calendar);
      if (juvenileError === "JUVENILE_UNDER_AGE") add("juvenile_age", e);
      else if (juvenileError === "JUVENILE_NIGHT_BAN") add("juvenile_night", e);
      else if (juvenileError) add("juvenile_hours", e);
      if (isJuvenile(e, k)) juvenileHere = true;
      // 3337 — live days only (today forward), cells touching the midday window in season.
      if (isHeatBanDate(k) && k >= today && shiftOverlapsHeatBan(shift.start, shift.end, { outdoor: true, summer: true } as any)) {
        const mark = sunMark(schedule, id, k, shift);
        if (mark === "field") add("heat_ban", e);
        else if (mark == null) add("heat_place", e);
      }
    }
    if (juvenileHere) {
      juveniles += 1;
      if (juvenileDocGaps(e).length) add("juvenile_docs", e);
      // Art. 163: twelve consecutive hours off between two duties.
      for (let i = 0; i + 1 < keys.length; i += 1) {
        const a = dutyShift(schedule, e, keys[i], calendar);
        const b = dutyShift(schedule, e, keys[i + 1], calendar);
        if (a && b && restGapHours(a, b) < juvenileNightNeed) {
          add("juvenile_night_gap", e);
          break;
        }
      }
    }
    if (performerHere) performers += 1;
    if (workerHere) nightWorkers += 1;
  }
  const facilityGaps = performers
    ? ["nightFirstAidReady", "nightEmergencyTransferReady", "nightFoodAccessReady"].filter((k) => !bags.some((b) => b && b[k] === true))
    : [];

  const win = heatBanWindow(onDate);
  const list = (id: string) => (hit[id] || []).join("، ");
  const listEn = (id: string) => (hit[id] || []).join(", ");
  const mk = (id: string, block: boolean, article: string | undefined, okAr: string, okEn: string, badAr: string, badEn: string, ok?: boolean): RosterLawCheck => {
    const pass = ok ?? !(hit[id] || []).length;
    return {
      id,
      ok: pass,
      block,
      article,
      names: hit[id] || [],
      labelAr: pass ? okAr : `${list(id)} — ${badAr}`,
      labelEn: pass ? okEn : `${listEn(id)} — ${badEn}`,
      noteAr: badAr,
      noteEn: badEn,
    };
  };
  return [
    mk("night_rest", true, undefined, `راحة ${nightRest} ساعة بين كل يومي دوام إذا دخل أحدهما الليل`, `${nightRest}h rest between duty days when either enters night`, `فاصل أقل من ${nightRest} ساعة بين يومي دوام دخل أحدهما الليل (القرار 18632).`, `Under ${nightRest}h between duty days, one entering night (decision 18632).`),
    mk("night_rotate", true, undefined, "لا عامل ليلي تجاوز ثلاثة أشهر دون موافقة خطية", "No night worker past three months without written consent", "تجاوز ثلاثة أشهر كعامل ليلي دون موافقة خطية — يُدوَّر لساعات عادية (القرار 18632).", "Past three months as a night worker without written consent — rotate to ordinary hours (decision 18632)."),
    mk("night_compensate", true, undefined, "كل عامل ليلي له بدل أو تخفيض ساعات", "Every night worker has an allowance or reduced hours", "عامل ليلي بلا بدل مسجّل أو تخفيض ساعات (القرار 18632).", "A night worker with no recorded allowance or reduced hours (decision 18632)."),
    mk("night_performer_comp", true, undefined, "كل من يدخل نافذة الليل له تعويض مسجّل", "Everyone entering the night window has recorded compensation", "عمل داخل نافذة الليل بلا تعويض مسجّل (القرار 18632).", "Work inside the night window without recorded compensation (decision 18632)."),
    mk("night_pregnancy", true, undefined, "لا إسناد ليلي لحامل داخل حظر الأسابيع الأربعة والعشرين", "No night duty for a pregnant worker inside the 24-week ban", "إسناد ليلي داخل حظر الحمل — 24 أسبوعاً قبل الوضع (القرار 18632).", "Night duty inside the pregnancy ban — 24 weeks before birth (decision 18632)."),
    mk("night_medical", true, undefined, "لا عامل ليلي بتقرير غير لائق أو شهادة تجنب", "No night worker with an unfit report or an avoid certificate", "تقرير غير لائق أو شهادة تجنب العمل الليلي — لا يُسند ليلاً (القرار 18632).", "An unfit report or an avoid-night certificate — not rostered at night (decision 18632)."),
    mk("night_medical_file", false, undefined, "تقارير اللياقة الليلية محفوظة", "Night-fitness reports on file", "لا تقرير لياقة ليلية ساري في الملف (القرار 18632).", "No current night-fitness report on file (decision 18632)."),
    mk("night_facilities", true, undefined, "إسعاف ونقل طارئ وطعام ليلي مسجّلة", "Night first aid, emergency transfer and food recorded", `ناقص: ${facilityGaps.join("، ")} (القرار 18632).`, `Missing: ${facilityGaps.join(", ")} (decision 18632).`, facilityGaps.length === 0),
    mk("juvenile_age", true, "162", "لا تعيين دون سن التشغيل", "No under-age assignment", "دون الخامسة عشرة — لا تشغيل (المادة 162).", "Under fifteen — no employment (Art. 162)."),
    mk("juvenile_night", true, "163", "لا إسناد ليلي لحدث", "No juvenile night duty", "إسناد داخل فترة ليل محظورة على الحدث (المادة 163).", "Duty inside a night period banned for juveniles (Art. 163)."),
    mk("juvenile_hours", true, "164", "ساعات الأحداث ضمن المادة 164", "Juvenile hours within Art. 164", "فوق 6 ساعات (4 في رمضان) أو 4 متصلة أو 7 بقاء، أو في راحة/عيد/إجازة سنوية (المادة 164).", "Over 6h (4 in Ramadan), 4 consecutive or 7h presence, or on rest/Eid/annual leave (Art. 164)."),
    mk("juvenile_night_gap", false, "163", "ليل الحدث 12 ساعة متتالية", "A juvenile's night is 12 consecutive hours", `الفاصل بين ورديتين أقل من ${juvenileNightNeed} ساعة (المادة 163).`, `Gap between duties under ${juvenileNightNeed}h (Art. 163).`),
    mk("juvenile_docs", false, "165", "وثائق الأحداث وسجلهم مكتملة", "Juvenile documents and register complete", "وثائق الحدث أو سجل الأحداث ناقص: الهوية، اللياقة، موافقة ولي الأمر، اسمه الكامل، الإقامة، إبلاغ المكتب (المادتان 165 و166).", "Juvenile documents or register incomplete: ID, fitness, guardian consent and full name, residence, office notice (Arts. 165–166)."),
    mk("heat_ban", true, undefined, "لا عامل مكشوف في ساعات حظر الشمس", "No exposed worker in the sun-ban hours", `مكشوف للشمس ${win.startLabel}–${win.endLabel} ${win.seasonAr} — لا يُنشر (القرار 3337).`, `Exposed ${win.startLabel}–${win.endLabel} ${win.seasonEn} — not published (Decision 3337).`),
    mk("heat_place", true, undefined, "كل خلية في نافذة الحظر محدَّدة مكشوف/مظلّل", "Every cell in the ban window is marked exposed/shaded", "يحتاج تحديد مكشوف/مظلّل قبل النشر (القرار 3337).", "Needs an exposed / shaded mark before publish (Decision 3337)."),
  ].map((check) => ({ ...check, applicable: check.id.startsWith("juvenile") ? juveniles > 0 || check.id === "juvenile_age" : check.id.startsWith("night") ? performers > 0 || nightWorkers > 0 : true } as any));
}
