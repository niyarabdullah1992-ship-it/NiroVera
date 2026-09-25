/** Shift / rota derivation — pre-publication statutory checks (Labour Law arts. 98, 101, 104).
 *  Design ref: NiroVera Platform.dc.html class Component (shifts / publishRota).
 *  Caps and articles come from laborRules for the first day of the roster month.
 */

import { citeRule, isRamadanDay, isRamadanHoursSubject, ruleValue } from "./laborRules.ts";
import { checkHeatBanGate, heatBanWindow, isHeatBanDate, monthHasHeatBanDay, shiftOverlapsNight } from "./contractLawDerivations.ts";

export type ShiftType = { id: string; label?: string; start: string; end: string; restMinutes?: number | null; outdoor?: boolean };

/** dateKey (YYYY-MM-DD) → shiftTypeId → employee ids */
export type DayAssignments = Record<string, Record<string, string[]>>;

export type RotaCheck = {
  id: string;
  ok: boolean;
  block?: boolean;
  labelAr: string;
  labelEn: string;
  noteAr: string;
  noteEn: string;
  article?: string;
};

export type PublishGateResult = {
  checks: RotaCheck[];
  blocked: boolean;
  failed: RotaCheck | null;
  openCells: number;
  weeklyMaxHours: number;
  coveragePct: number;
};

export function minutesBetween(start: string, end: string) {
  const [sh, sm] = String(start || "0:0").split(":").map(Number);
  const [eh, em] = String(end || "0:0").split(":").map(Number);
  let m = (eh * 60 + em) - (sh * 60 + sm);
  if (m < 0) m += 1440;
  return m;
}

/**
 * Art. 101 — no more than five consecutive hours without a rest of ≥ 30 minutes.
 * A missing restMinutes uses the statutory 30 so existing 8 h windows still publish.
 * restMinutes: 0 is an explicit "no break" and fails when the span exceeds five hours.
 */
export function checkConsecutiveWorkGate(input: {
  start?: string | null;
  end?: string | null;
  restMinutes?: number | null;
  onDate?: string | Date | null;
}) {
  const onDate = input.onDate;
  const maxHours = ruleValue("hours.rest.maxConsecutiveHours", onDate);
  const minRest = ruleValue("hours.rest.duringShiftMinutes", onDate);
  const cite = citeRule("hours.rest.maxConsecutiveHours", onDate);
  const span = minutesBetween(input.start || "00:00", input.end || "00:00");
  const maxMin = maxHours * 60;
  if (span <= 0 || span <= maxMin) {
    return {
      ok: true as const,
      cite,
      span,
      maxHours,
      minRest,
      restMinutes: 0,
      maxBlock: Math.max(0, span),
    };
  }
  const rest = input.restMinutes == null ? minRest : Math.max(0, Number(input.restMinutes) || 0);
  if (rest < minRest) {
    return {
      ok: false as const,
      error: "REST_5H_REQUIRED" as const,
      reason: `لا يجوز تشغيل العامل أكثر من ${maxHours} ساعات متواصلة دون راحة لا تقل عن ${minRest} دقيقة — ${cite?.labelAr || "المادة 101"}.`,
      reasonEn: `A worker may not work more than ${maxHours} consecutive hours without a rest of at least ${minRest} minutes — Labour Law ${cite?.labelEn || "Art. 101"}.`,
      cite,
      span,
      maxHours,
      minRest,
      restMinutes: rest,
      maxBlock: span,
    };
  }
  const work = Math.max(0, span - rest);
  const maxBlock = Math.ceil(work / 2);
  if (maxBlock > maxMin) {
    return {
      ok: false as const,
      error: "REST_5H_BLOCK_TOO_LONG" as const,
      reason: `حتى مع راحة ${rest} دقيقة يبقى أطول مقطع ${Math.round(maxBlock / 60 * 10) / 10} ساعة فوق حد ${maxHours} ساعات — ${cite?.labelAr || "المادة 101"}.`,
      reasonEn: `Even with a ${rest}-minute rest the longest block is ${Math.round(maxBlock / 60 * 10) / 10} h above the ${maxHours} h cap — Labour Law ${cite?.labelEn || "Art. 101"}.`,
      cite,
      span,
      maxHours,
      minRest,
      restMinutes: rest,
      maxBlock,
    };
  }
  return {
    ok: true as const,
    cite,
    span,
    maxHours,
    minRest,
    restMinutes: rest,
    maxBlock,
  };
}

export function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function weekIndex(year: number, monthIndex: number, day: number) {
  return Math.floor((day - 1 + new Date(year, monthIndex, 1).getDay()) / 7);
}

function weekLength(year: number, monthIndex: number, w: number) {
  const days = daysInMonth(year, monthIndex);
  let n = 0;
  for (let d = 1; d <= days; d++) if (weekIndex(year, monthIndex, d) === w) n++;
  return n;
}

function cellOf(assignments: DayAssignments, year: number, monthIndex: number, day: number, shiftId: string) {
  const key = dateKey(year, monthIndex, day);
  return Array.isArray(assignments?.[key]?.[shiftId]) ? assignments[key][shiftId] : [];
}

function spansOf(
  employeeId: string,
  shiftTypes: ShiftType[],
  assignments: DayAssignments,
  year: number,
  monthIndex: number,
) {
  const out: { d: number; label: string; start: number; end: number }[] = [];
  const days = daysInMonth(year, monthIndex);
  for (let d = 1; d <= days; d++) {
    for (const st of shiftTypes) {
      if (!cellOf(assignments, year, monthIndex, d, st.id).includes(employeeId)) continue;
      const a = String(st.start).split(":").map(Number);
      const b = String(st.end).split(":").map(Number);
      const start = (d - 1) * 1440 + a[0] * 60 + a[1];
      let end = (d - 1) * 1440 + b[0] * 60 + b[1];
      if (end <= start) end += 1440;
      out.push({ d, label: st.label || st.id, start, end });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

function workplaceMinutesOnDay(spans: { start: number; end: number }[], day: number) {
  const dayStart = (day - 1) * 1440;
  const dayEnd = dayStart + 1440;
  let first: number | null = null;
  let last: number | null = null;
  for (const sp of spans) {
    const a = Math.max(sp.start, dayStart);
    const b = Math.min(sp.end, dayEnd);
    if (b <= a) continue;
    if (first == null || a < first) first = a;
    if (last == null || b > last) last = b;
  }
  if (first == null) return 0;
  return last - first;
}

function shiftAssignedOnHeatBanDay(
  assignments: DayAssignments,
  year: number,
  monthIndex: number,
  days: number,
  shiftId: string,
) {
  let anyAssigned = false;
  for (let d = 1; d <= days; d++) {
    const ids = cellOf(assignments, year, monthIndex, d, shiftId);
    if (!ids.length) continue;
    anyAssigned = true;
    if (isHeatBanDate(dateKey(year, monthIndex, d))) return { anyAssigned: true, onHeatDay: true };
  }
  return { anyAssigned, onHeatDay: false };
}

function shiftHeatSeasonApplies(
  assignments: DayAssignments,
  year: number,
  monthIndex: number,
  days: number,
  shiftId: string,
) {
  const { anyAssigned, onHeatDay } = shiftAssignedOnHeatBanDay(assignments, year, monthIndex, days, shiftId);
  if (anyAssigned) return onHeatDay;
  return monthHasHeatBanDay(year, monthIndex);
}

/**
 * Four hard gates before publish + leave exclusion note.
 * Rest day default: Friday (JS getDay() === 5), matching the design matrix.
 */
function employeeForGate(id: string, employees: Array<{ id?: string; employeeId?: string; religion?: string; profile?: { religion?: string } }> = []) {
  return employees.find((row) => String(row?.id) === String(id) || String(row?.employeeId) === String(id)) || { id };
}

export function checkPublishGates(input: {
  year: number;
  monthIndex: number;
  shiftTypes: ShiftType[];
  assignments: DayAssignments;
  onLeaveIds?: Iterable<string>;
  restDow?: number;
  namesById?: Record<string, string>;
  employees?: Array<{ id?: string; employeeId?: string; religion?: string; profile?: { religion?: string } }>;
}): PublishGateResult {
  const year = Number(input.year);
  const monthIndex = Number(input.monthIndex);
  const shiftTypes = Array.isArray(input.shiftTypes) ? input.shiftTypes : [];
  const assignments = input.assignments || {};
  const restDow = input.restDow == null ? 5 : Number(input.restDow);
  const onLeave = new Set(Array.from(input.onLeaveIds || []).map(String));
  const names = input.namesById || {};
  const employees = input.employees || [];
  const days = daysInMonth(year, monthIndex);

  let filled = 0;
  let staffable = 0;
  for (let d = 1; d <= days; d++) {
    const restDay = new Date(year, monthIndex, d).getDay() === restDow;
    for (const st of shiftTypes) {
      const ids = cellOf(assignments, year, monthIndex, d, st.id).filter((id) => !onLeave.has(id));
      if (restDay) continue;
      staffable++;
      if (ids.length) filled++;
    }
  }
  const openCells = Math.max(0, staffable - filled);
  const coveragePct = staffable ? Math.round((filled / staffable) * 100) : 0;

  const wMin: Record<string, Record<number, number>> = {};
  const wRamadanMin: Record<string, Record<number, number>> = {};
  const wDays: Record<string, Record<number, Set<number>>> = {};
  const assignedIds = new Set<string>();

  for (let d = 1; d <= days; d++) {
    const w = weekIndex(year, monthIndex, d);
    const ramadanDay = isRamadanDay(dateKey(year, monthIndex, d));
    for (const st of shiftTypes) {
      for (const id of cellOf(assignments, year, monthIndex, d, st.id)) {
        if (onLeave.has(id)) continue;
        assignedIds.add(id);
        const mins = minutesBetween(st.start, st.end);
        wMin[id] = wMin[id] || {};
        wDays[id] = wDays[id] || {};
        wMin[id][w] = (wMin[id][w] || 0) + mins;
        (wDays[id][w] = wDays[id][w] || new Set()).add(d);
        if (ramadanDay) {
          wRamadanMin[id] = wRamadanMin[id] || {};
          wRamadanMin[id][w] = (wRamadanMin[id][w] || 0) + mins;
        }
      }
    }
  }

  const onDate = dateKey(year, monthIndex, 1);
  const weeklyCap = ruleValue("hours.week.ordinaryMaxHours", onDate);
  const workplaceMax = ruleValue("hours.workplace.maxHours", onDate);
  const ramadanDayCap = ruleValue("hours.ramadan.ordinaryHours", onDate);
  const ramadanWeekCap = ruleValue("hours.ramadan.weekMaxHours", onDate);
  const exceptionDayCap = ruleValue("hours.ot.exceptionDayHours", onDate);
  const exceptionWeekCap = ruleValue("hours.ot.exceptionWeekHours", onDate);
  // Art 98: empty religion is Muslim/protected; recorded non-Muslim is exempt.
  const weekArticle = citeRule("hours.week.ordinaryMaxHours", onDate)?.article;
  const workplaceArticle = citeRule("hours.workplace.maxHours", onDate)?.article;
  const ramadanArticle = citeRule("hours.ramadan.weekMaxHours", onDate)?.article;
  const weeklyRestArticle = citeRule("hours.rest.weeklyHours", onDate)?.article;
  const exceptionArticle = citeRule("hours.ot.exceptionDayHours", onDate)?.article;

  const weeklyMaxHours = Math.round(
    Math.max(0, ...Object.values(wMin).flatMap((o) => Object.values(o)), 0) / 60,
  );

  let workplaceBreach: { name: string; hours: number; d: number } | null = null;
  for (const id of assignedIds) {
    const sp = spansOf(id, shiftTypes, assignments, year, monthIndex);
    for (let d = 1; d <= days; d++) {
      const stay = workplaceMinutesOnDay(sp, d);
      if (stay > workplaceMax * 60) {
        workplaceBreach = { name: names[id] || id, hours: Math.round((stay / 60) * 10) / 10, d };
        break;
      }
    }
    if (workplaceBreach) break;
  }

  let ramadanDayBreach: { name: string; hours: number; d: number } | null = null;
  let ramadanWeekBreach: { name: string; hours: number } | null = null;
  let ramadanDaysInMonth = 0;
  for (let d = 1; d <= days; d++) {
    if (isRamadanDay(dateKey(year, monthIndex, d))) ramadanDaysInMonth++;
  }
  for (const id of assignedIds) {
    if (!isRamadanHoursSubject(employeeForGate(id, employees))) continue;
    for (let d = 1; d <= days; d++) {
      const key = dateKey(year, monthIndex, d);
      if (!isRamadanDay(key)) continue;
      for (const st of shiftTypes) {
        if (!cellOf(assignments, year, monthIndex, d, st.id).includes(id)) continue;
        const mins = minutesBetween(st.start, st.end);
        if (mins > ramadanDayCap * 60) {
          ramadanDayBreach = { name: names[id] || id, hours: Math.round((mins / 60) * 10) / 10, d };
          break;
        }
      }
      if (ramadanDayBreach) break;
    }
    const ramadanWeeks = wRamadanMin[id] || {};
    for (const mins of Object.values(ramadanWeeks)) {
      if (mins / 60 > ramadanWeekCap) {
        ramadanWeekBreach = { name: names[id] || id, hours: Math.round(mins / 60) };
        break;
      }
    }
    if (ramadanDayBreach && ramadanWeekBreach) break;
  }

  let exceptionDayBreach: { name: string; hours: number; d: number } | null = null;
  let exceptionWeekBreach: { name: string; hours: number } | null = null;
  for (const id of assignedIds) {
    for (let d = 1; d <= days; d++) {
      let mins = 0;
      for (const st of shiftTypes) {
        if (!cellOf(assignments, year, monthIndex, d, st.id).includes(id)) continue;
        mins += minutesBetween(st.start, st.end);
      }
      if (mins > exceptionDayCap * 60) {
        exceptionDayBreach = { name: names[id] || id, hours: Math.round((mins / 60) * 10) / 10, d };
        break;
      }
    }
    for (const mins of Object.values(wMin[id] || {})) {
      if (mins / 60 > exceptionWeekCap) {
        exceptionWeekBreach = { name: names[id] || id, hours: Math.round(mins / 60) };
        break;
      }
    }
    if (exceptionDayBreach && exceptionWeekBreach) break;
  }

  let doubleOk = true;
  for (let i = 0; i < shiftTypes.length; i++) {
    for (let j = i + 1; j < shiftTypes.length; j++) {
      for (let d = 1; d <= days; d++) {
        const A = cellOf(assignments, year, monthIndex, d, shiftTypes[i].id);
        const B = cellOf(assignments, year, monthIndex, d, shiftTypes[j].id);
        if (A.some((x) => B.includes(x) && !onLeave.has(x))) {
          doubleOk = false;
          break;
        }
      }
      if (!doubleOk) break;
    }
    if (!doubleOk) break;
  }

  const noRest = Object.entries(wDays).filter(([, o]) =>
    Object.entries(o).some(([w, set]) => weekLength(year, monthIndex, Number(w)) === 7 && set.size >= 7),
  );
  const restBreachName = noRest.length ? names[noRest[0][0]] || noRest[0][0] : "";
  const restOk = !restBreachName;

  // Re-scan raw matrix for anyone on approved leave who is still assigned.
  const leaveOnMatrix: string[] = [];
  for (let d = 1; d <= days; d++) {
    for (const st of shiftTypes) {
      for (const id of cellOf(assignments, year, monthIndex, d, st.id)) {
        if (onLeave.has(id) && !leaveOnMatrix.includes(id)) leaveOnMatrix.push(id);
      }
    }
  }

  const consecArticle = citeRule("hours.rest.maxConsecutiveHours", onDate)?.article;
  const consecFails = shiftTypes
    .map((st) => ({ st, gate: checkConsecutiveWorkGate({ start: st.start, end: st.end, restMinutes: st.restMinutes, onDate }) }))
    .filter((row) => !row.gate.ok);
  const consecFail = consecFails[0] || null;
  const heatFails = shiftTypes
    .map((st) => ({
      st,
      gate: checkHeatBanGate({
        start: st.start,
        end: st.end,
        outdoor: st.outdoor,
        summer: shiftHeatSeasonApplies(assignments, year, monthIndex, days, st.id),
      }),
    }))
    .filter((row) => !row.gate.ok);
  const heatFail = heatFails[0] || null;
  // The hours and the season are the rule rows', so the roster check cannot outlive them.
  const heatWin = heatBanWindow(onDate);
  const nightCount = shiftTypes.filter((st) => shiftOverlapsNight(st.start, st.end)).length;
  const nightWin = `${String(ruleValue("hours.night.startHour", onDate)).padStart(2, "0")}:00–${String(ruleValue("hours.night.endHour", onDate)).padStart(2, "0")}:00`;
  const nightWorkerHours = ruleValue("hours.night.workerHours", onDate);
  const weeklyRestHours = ruleValue("hours.rest.weeklyHours", onDate);

  const checks: RotaCheck[] = [
    {
      id: "hours_48",
      ok: weeklyMaxHours <= weeklyCap,
      article: weekArticle,
      labelAr: `أعلى حمل أسبوعي ${weeklyMaxHours} ساعة من حد ${weeklyCap}`,
      labelEn: `Heaviest weekly load ${weeklyMaxHours} h against the ${weeklyCap} h cap`,
      noteAr: "محسوب لكل أسبوع تقويمي على حدة من المصفوفة نفسها — أثقل أسبوع لأثقل موظف، لا متوسط الشهر.",
      noteEn: "Computed per calendar week from the matrix itself — the heaviest week for the heaviest employee, never a monthly average.",
    },
    {
      id: "hours_106",
      ok: !exceptionDayBreach && !exceptionWeekBreach,
      article: exceptionArticle,
      labelAr: exceptionDayBreach
        ? `${exceptionDayBreach.name}: ${exceptionDayBreach.hours} ساعة فعلية في اليوم ${exceptionDayBreach.d} فوق حد ${exceptionDayCap}`
        : exceptionWeekBreach
          ? `${exceptionWeekBreach.name}: ${exceptionWeekBreach.hours} ساعة في الأسبوع فوق حد ${exceptionWeekCap}`
          : `حتى في الاستثناء: لا أكثر من ${exceptionDayCap} ساعات في اليوم أو ${exceptionWeekCap} في الأسبوع`,
      labelEn: exceptionDayBreach
        ? `${exceptionDayBreach.name}: ${exceptionDayBreach.hours} actual hours on day ${exceptionDayBreach.d} above the ${exceptionDayCap} h cap`
        : exceptionWeekBreach
          ? `${exceptionWeekBreach.name}: ${exceptionWeekBreach.hours} h in a week above the ${exceptionWeekCap} h cap`
          : `Even in exception cases: no more than ${exceptionDayCap} h a day or ${exceptionWeekCap} h a week`,
      noteAr: "المادة 106 سقف فعلي 10/60 حتى عند عدم التقيد بالمواد 98 و101 و104(1). الحد السنوي للإضافي قرار وزاري بلا شارة مادة.",
      noteEn: "Article 106 is a 10/60 actual-hours ceiling even when Articles 98, 101 and 104(1) are waived. The annual overtime cap is ministerial — no Labour Law chip.",
    },
    {
      id: "hours_ramadan",
      ok: !ramadanDayBreach && !ramadanWeekBreach,
      article: ramadanDaysInMonth ? ramadanArticle : undefined,
      labelAr: !ramadanDaysInMonth
        ? "لا أيام رمضان في هذا الشهر"
        : ramadanDayBreach
          ? `${ramadanDayBreach.name}: ${ramadanDayBreach.hours} ساعة في يوم رمضاني فوق حد ${ramadanDayCap}`
          : ramadanWeekBreach
            ? `${ramadanWeekBreach.name}: ${ramadanWeekBreach.hours} ساعة في أسبوع رمضاني فوق حد ${ramadanWeekCap}`
            : `رمضان: حد ${ramadanDayCap} ساعات يومياً أو ${ramadanWeekCap} أسبوعياً للمسلمين — غير المسلم المسجّل على الملف مستثنى`,
      labelEn: !ramadanDaysInMonth
        ? "No Ramadan days this month"
        : ramadanDayBreach
          ? `${ramadanDayBreach.name}: ${ramadanDayBreach.hours} h on a Ramadan day above the ${ramadanDayCap} h cap`
          : ramadanWeekBreach
            ? `${ramadanWeekBreach.name}: ${ramadanWeekBreach.hours} h in a Ramadan week above the ${ramadanWeekCap} h cap`
            : `Ramadan: ${ramadanDayCap} h a day or ${ramadanWeekCap} h a week for Muslims — a file marked non-Muslim is exempt`,
      noteAr: "المادة 98 تخفّض ساعات المسلمين في رمضان إلى 6/36. بلا حقل ديانة يُطبَّق الحد على كل المعيَّنين حتى لا يُنقص حق المسلم.",
      noteEn: "Article 98 reduces Muslim hours in Ramadan to 6/36. With no religion field the cap applies to every assignee so Muslims are never under-protected.",
    },
    {
      id: "workplace_hours",
      ok: !workplaceBreach,
      article: workplaceArticle,
      labelAr: workplaceBreach
        ? `${workplaceBreach.name}: بقاء ${workplaceBreach.hours} ساعة في موقع العمل يوم ${workplaceBreach.d} فوق حد ${workplaceMax}`
        : `لا بقاء في موقع العمل أكثر من ${workplaceMax} ساعة في اليوم`,
      labelEn: workplaceBreach
        ? `${workplaceBreach.name}: ${workplaceBreach.hours} h at the workplace on day ${workplaceBreach.d} above the ${workplaceMax} h cap`
        : `No more than ${workplaceMax} h remaining at the workplace in a day`,
      noteAr: "المادة 101: لا يبقى العامل في مكان العمل أكثر من الحد الساري في اليوم (12 ساعة بعد تعديل 1436).",
      noteEn: "Article 101: a worker may not remain at the workplace more than the in-force daily cap (12 hours after the 1436 amendment).",
    },
    {
      id: "double_shift",
      ok: doubleOk,
      labelAr: doubleOk ? "لا إسناد لورديتين في يوم واحد" : "موظف مسند إلى ورديتين في يوم واحد",
      labelEn: doubleOk ? "Nobody is assigned two shifts in one day" : "Someone is assigned two shifts in one day",
      noteAr: "إسناد تشغيلي — ليست المادة 101.",
      noteEn: "An operational assignment check — not Article 101.",
    },
    {
      id: "rest_5h",
      ok: !consecFail,
      article: consecArticle,
      labelAr: consecFail
        ? `${consecFail.st.label || consecFail.st.id}: ${consecFail.gate.reason}`
        : `لا عمل أكثر من ${ruleValue("hours.rest.maxConsecutiveHours", onDate)} ساعات متواصلة دون راحة ${ruleValue("hours.rest.duringShiftMinutes", onDate)} دقيقة`,
      labelEn: consecFail
        ? `${consecFail.st.label || consecFail.st.id}: ${consecFail.gate.reasonEn}`
        : `No more than ${ruleValue("hours.rest.maxConsecutiveHours", onDate)} consecutive hours without a ${ruleValue("hours.rest.duringShiftMinutes", onDate)}-minute rest`,
      noteAr: "الراحة والصلاة والطعام لا تُحسب من ساعات العمل. إن زادت النافذة عن خمس ساعات تُفترض راحة نظامية 30 دقيقة ما لم تُضبط صفراً.",
      noteEn: "Rest, prayer and meals are not working hours. Windows longer than five hours assume the statutory 30-minute rest unless rest is set to zero.",
    },
    {
      id: "weekly_rest",
      ok: restOk,
      article: weeklyRestArticle,
      labelAr: restOk
        ? `راحة أسبوعية ${weeklyRestHours} ساعة متصلة`
        : `${restBreachName} مجدول أسبوعًا كاملًا بلا يوم راحة`,
      labelEn: restOk
        ? `${weeklyRestHours} h continuous weekly rest`
        : `${restBreachName} is scheduled a full week with no rest day`,
      noteAr: "يوم راحة كامل لكل موظف في كل أسبوع، ولا يُستبدل بأجر.",
      noteEn: "A full rest day every week for every employee, never substituted with pay.",
    },
    {
      id: "coverage",
      ok: openCells === 0,
      labelAr: openCells === 0
        ? "كل ورديات الشهر مُسندة"
        : `${openCells} خلية في الشهر بلا إسناد`,
      labelEn: openCells === 0
        ? "Every shift this month is assigned"
        : `${openCells} cell${openCells === 1 ? "" : "s"} unassigned this month`,
      noteAr: "اضغط + في أي خلية فارغة لإسناد موظف — النقص يُسدّ بالإسناد لا بتمديد وردية قائمة.",
      noteEn: "Press + in any empty cell to assign someone — a gap is closed by assignment, never by extending an existing shift.",
    },
    {
      id: "leave_excluded",
      ok: true,
      block: false,
      labelAr: leaveOnMatrix.length
        ? `${leaveOnMatrix.map((id) => names[id] || id).join("، ")} على إجازة معتمدة — الإجازة تبقى إجازة، والنشر جائز`
        : onLeave.size
          ? `${onLeave.size} على إجازة معتمدة — مستبعدون من الإسناد`
          : "لا إجازات معتمدة في هذا الشهر",
      labelEn: leaveOnMatrix.length
        ? `${leaveOnMatrix.map((id) => names[id] || id).join(", ")} on approved leave — leave stays leave, and publish is allowed`
        : onLeave.size
          ? `${onLeave.size} on approved leave — excluded from assignment`
          : "No approved leave this month",
      noteAr: leaveOnMatrix.length
        ? "تعيين متبقٍ على يوم إجازة يُذكر ولا يمنع النشر. الإجازة تبقى إجازة ولا تُحسب ساعات."
        : "من له إجازة معتمدة لا يُحسب في ساعات الإسناد، والنشر جائز.",
      noteEn: leaveOnMatrix.length
        ? "A leftover assignment on a leave day is noted and does not block publish. Leave stays leave and is not counted as hours."
        : "Anyone on approved leave is excluded from duty hours, and publish is allowed.",
    },
    {
      id: "heat_ban",
      ok: !heatFail,
      labelAr: heatFail
        ? `${heatFail.st.label || heatFail.st.id}: حظر ${heatWin.startLabel}–${heatWin.endLabel} للميدان المكشوف ${heatWin.seasonAr}`
        : "لا تداخل مع حظر الشمس للميدان المكشوف",
      labelEn: heatFail
        ? `${heatFail.st.label || heatFail.st.id}: ${heatWin.startLabel}–${heatWin.endLabel} outdoor ban ${heatWin.seasonEn}`
        : "No overlap with the outdoor heat ban",
      noteAr: `حظر وزاري للميدان المكشوف ${heatWin.seasonAr}، من ${heatWin.startLabel} إلى ${heatWin.endLabel} — بلا شارة مادة من نظام العمل.`,
      noteEn: `Ministerial outdoor ban ${heatWin.seasonEn}, ${heatWin.startLabel} to ${heatWin.endLabel} — no Labour Law chip.`,
    },
    {
      id: "night_class",
      ok: true,
      labelAr: nightCount ? `${nightCount} وردية تدخل ${nightWin} (يؤدي عملاً ليلياً — عامل ليلي إن بلغت ${nightWorkerHours} ساعات)` : "لا وردية تدخل نافذة الليل في هذا الشهر",
      labelEn: nightCount ? `${nightCount} shifts enter ${nightWin} (night work — night worker if ${nightWorkerHours} hours or more)` : "No shift enters the night window this month",
      noteAr: `التصنيف وفق القرار 18632: أي عمل داخل ${nightWin} يؤدي عملاً ليلياً. عامل ليلي من يعمل ${nightWorkerHours} ساعات فأكثر في النافذة. بلا شارة مادة.`,
      noteEn: `Classification under decision 18632: any work inside ${nightWin} performs night work. A night worker works ${nightWorkerHours} hours or more in the window. No Labour Law chip.`,
    },
  ];

  const failed = checks.find((c) => !c.ok && c.block !== false) || null;
  return {
    checks,
    blocked: !!failed,
    failed,
    openCells,
    weeklyMaxHours,
    coveragePct,
  };
}
