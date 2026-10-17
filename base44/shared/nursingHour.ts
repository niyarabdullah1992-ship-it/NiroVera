/**
 * Server twin of the nursing-hour reading in src/lib/dutyRequests.js (Art. 154, Regs Art. 31):
 * the hour on file that day, the minutes excused at the start (not lateness) and at the end (not an
 * early checkout), and the minutes credited as actual work. Same catalog row
 * (leave.nursing.dailyMinutes) — never a typed figure.
 */
import { ruleValue } from "./laborRules.ts";

const NURSING_HOUR_MAX_MINUTES = 60;

function approved(row: any) {
  return (row?.status || "pending") === "approved";
}

export function nursingSplitOf(row: any = {}) {
  const n = (v: any) => Math.max(0, Math.min(60, Math.round(Number(v) || 0)));
  const raw = row?.nursingSplit;
  if (raw && typeof raw === "object") return { start: n(raw.start), mid: n(raw.mid), end: n(raw.end) };
  if (row?.placement === "end") return { start: 0, mid: 0, end: 60 };
  if (row?.placement === "start") return { start: 60, mid: 0, end: 0 };
  return { start: 0, mid: 0, end: 0 };
}

/** Regs Art. 31(1): 24 months from the date of birth — the last day it covers. */
export function nursingRightUntil(birthDate: any): string {
  const b = String(birthDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) return "";
  const d = new Date(`${b}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 24);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type NursingDay = {
  placement: "start" | "end" | "mid";
  minutes: number;
  startMinutes: number;
  midMinutes: number;
  endMinutes: number;
  split: { start: number; mid: number; end: number };
  from: string;
  until: string;
};

/** Twin of dutyRequests.nursingHourOn. */
export function nursingHourOn(employee: any, dateKey: string): NursingDay | null {
  const fromFile = employee?.profile?.nursingHour;
  const rows = [
    ...(fromFile ? [fromFile] : []),
    ...((employee?.otherRequests || []) as any[])
      .filter((row) => row?.type === "nursing_hour" && approved(row))
      .map((row) => ({ placement: row.placement, nursingSplit: row.nursingSplit, childBirthDate: row.childBirthDate, from: row.date, until: row.until })),
  ];
  const day = String(dateKey || "").slice(0, 10);
  const untilOf = (row: any) => String(row?.until || "").slice(0, 10) || nursingRightUntil(row?.childBirthDate);
  const hit = rows.find((row: any) => {
    const from = String(row?.from || "").slice(0, 10);
    const until = untilOf(row);
    return (!from || day >= from) && (!until || day <= until);
  });
  if (!hit) return null;
  const split = nursingSplitOf(hit);
  const cap = Number(ruleValue("leave.nursing.dailyMinutes", day)) || NURSING_HOUR_MAX_MINUTES;
  const startMinutes = Math.min(cap, split.start);
  const endMinutes = Math.min(cap - startMinutes, split.end);
  const midMinutes = Math.min(cap - startMinutes - endMinutes, split.mid);
  const minutes = startMinutes + endMinutes + midMinutes;
  if (!minutes) return null;
  return {
    placement: split.start ? "start" : split.end ? "end" : "mid",
    minutes,
    startMinutes,
    midMinutes,
    endMinutes,
    split,
    from: String((hit as any).from || "").slice(0, 10),
    until: untilOf(hit),
  };
}

/** Twin of dutyRequests.nursingCreditOf. */
export function nursingCreditOf(
  nursing: NursingDay | null,
  i: { inMinutes?: number | null; outMinutes?: number | null; shiftStart?: number | null; shiftEnd?: number | null; workedMinutes?: number; rosteredMinutes?: number } = {},
) {
  const none = { minutes: 0, start: 0, mid: 0, end: 0 };
  if (!nursing || i.inMinutes == null || i.outMinutes == null || i.shiftStart == null || i.shiftEnd == null) return none;
  const start = Math.min(nursing.startMinutes || 0, Math.max(0, i.inMinutes - i.shiftStart));
  const end = Math.min(nursing.endMinutes || 0, Math.max(0, i.shiftEnd - i.outMinutes));
  const mid = Math.min(nursing.midMinutes || 0, Math.max(0, (i.rosteredMinutes || 0) - (i.workedMinutes || 0) - start - end));
  const minutes = Math.min(nursing.minutes || 0, start + mid + end);
  return { minutes, start, mid, end };
}

/** Minutes after the shift start that are not lateness (the start part of her nursing hour). */
export function nursingStartExcuse(employee: any, dateKey: string): number {
  return nursingHourOn(employee, dateKey)?.startMinutes || 0;
}

/** Minutes before the shift end that are not an early checkout (the end part). */
export function nursingEndExcuse(employee: any, dateKey: string): number {
  return nursingHourOn(employee, dateKey)?.endMinutes || 0;
}
