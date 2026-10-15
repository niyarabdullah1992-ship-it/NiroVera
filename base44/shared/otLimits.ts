// deno-lint-ignore-file no-explicit-any
/**
 * Backend copy of the overtime-assignment limits in src/lib/overtimeAssignment.js (checkOtDayWeekGate):
 *  - Art. 164: a juvenile (15–17) gets no overtime and no Art. 106 exception.
 *  - Art. 106 (last paragraph): even in its cases, actual work ≤ 10 h a day and ≤ 60 h a week.
 * Kept equal by scripts/test-cloud-parity.mjs.
 */
import { ruleValue } from "./laborRules.ts";

const dayOnly = (v: any) => String(v || "").slice(0, 10);
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const weekStart = (iso: string) => {
  const d = new Date(`${dayOnly(iso)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};
const assignmentDays = (row: any) => {
  const from = dayOnly(row?.date || row?.dateFrom);
  const to = dayOnly(row?.dateTo || row?.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return 1;
  return Math.max(1, days(from, to) + 1);
};
const LIVE = new Set(["pending_employee", "pending_manager", "approved", "pending"]);

export function isJuvenileOn(employee: any, onDate: string) {
  const birth = dayOnly(employee?.profile?.birthDate || employee?.birthDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return false;
  const years = days(birth, dayOnly(onDate)) / 365.25;
  const min = Number(ruleValue("hours.juvenile.minAgeYears", onDate)) || 15;
  const max = Number(ruleValue("hours.juvenile.maxAgeYears", onDate)) || 18;
  return years >= min && years < max;
}

export function checkOtDayWeekGate(input: any = {}) {
  const date = dayOnly(input.date);
  const hours = Number(input.hours) > 0 ? Number(input.hours) : 0;
  const n = assignmentDays(input);
  const perDay = Math.round((hours / n) * 100) / 100;
  if (input.employee && isJuvenileOn(input.employee, date)) {
    return { ok: false, error: "JUVENILE_NO_OT", reason: "موقوف — المادة 164: الحدث لا يُشغَّل فعلياً أكثر من 6 ساعات في اليوم (4 في رمضان)، ولا تسري عليه استثناءات المادة 106 — فلا تكليف إضافي له.", reasonEn: "Blocked — Article 164: no overtime for a juvenile." };
  }
  if (!input.article106) return { ok: true, perDay };
  const ordinary = Number(input.ordinaryHours) || Number(ruleValue("hours.shift.ordinaryHours", date)) || 8;
  const dayCap = Number(ruleValue("hours.ot.exceptionDayHours", date)) || 10;
  const weekCap = Number(ruleValue("hours.ot.exceptionWeekHours", date)) || 60;
  if (ordinary + perDay > dayCap + 0.001) {
    return { ok: false, error: "ART106_DAY_CAP", reason: `موقوف — المادة 106: لا يزيد العمل الفعلي على ${dayCap} ساعات في اليوم. الدوام ${ordinary} والتكليف ${perDay} في اليوم.`, reasonEn: "Blocked — Article 106 day cap.", perDay };
  }
  const week = weekStart(date);
  const others = (input.otherRequests || [])
    .filter((row: any) => row?.type === "overtime" && (row.assignment === true || row.source === "assignment") && row.article106 === true && row.id !== input.exceptId && LIVE.has(String(row.status || "")))
    .filter((row: any) => weekStart(row.date) === week)
    .reduce((sum: number, row: any) => sum + ((Number(row.hours) || 0) / assignmentDays(row)) * Math.min(assignmentDays(row), 7), 0);
  const total = Math.round((ordinary * 6 + others + perDay * Math.min(n, 7)) * 100) / 100;
  if (total > weekCap + 0.001) {
    return { ok: false, error: "ART106_WEEK_CAP", reason: `موقوف — المادة 106: لا يزيد العمل الفعلي على ${weekCap} ساعة في الأسبوع — المجموع ${total}.`, reasonEn: "Blocked — Article 106 week cap.", total };
  }
  return { ok: true, perDay };
}
