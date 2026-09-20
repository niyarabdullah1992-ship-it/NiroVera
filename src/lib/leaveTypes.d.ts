export type LeaveRequestLike = {
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  activeStartDate?: string;
  activeEndDate?: string;
  days?: number;
};

export type EmployeeLeaveProfile = {
  leaveRequests?: LeaveRequestLike[];
};

export function chargeableAnnualDays(startDate?: string, endDate?: string, calendar?: unknown): number;
export function chargeableSickDays(startDate?: string, endDate?: string, calendar?: unknown): number;
export function usedLeaveDays(requests: LeaveRequestLike[] | undefined, key: string, onDate?: string, hireDate?: string, calendar?: unknown): number;
export function remainingLeaveDays(
  profile: { hireDate?: string; leaveTotals?: Record<string, number> } | null | undefined,
  requests: LeaveRequestLike[] | undefined,
  key?: string,
  onDate?: string,
): number | null;
export function sickStatutoryYearWindow(
  requests: LeaveRequestLike[] | undefined,
  onDate?: string,
): { start: string; end: string };
export function anniversaryYearWindow(
  hireDate?: string,
  onDate?: string,
): { start: string; end: string } | null;
export function accruedAnnualDaysAtExit(hireDate: string | undefined, entitlement: number, exitDate?: string): number;

export function leaveCoverRange(request: LeaveRequestLike | null | undefined): { start: string; end: string };

export function isOnApprovedLeave(
  employee: EmployeeLeaveProfile | null | undefined,
  date?: Date | string,
): boolean;

export function isOnLeaveToday(employee: EmployeeLeaveProfile | null | undefined): boolean;

export function leaveTypeLabel(type: string | undefined, ar?: boolean): string;
export function isSaudiWeekend(date?: Date | string | null): boolean;
export function approvedLeaveOnDay(
  employee: EmployeeLeaveProfile | null | undefined,
  date?: Date | string,
): LeaveRequestLike | null;
export function approvedLeavePeopleOnDay(
  employees: Array<{ id?: string; name?: string; leaveRequests?: LeaveRequestLike[] }> | null | undefined,
  date?: Date | string,
): Array<{ id?: string; name?: string; request: LeaveRequestLike }>;
export function weekendLeavePeople(
  employees: Array<{ id?: string; name?: string; leaveRequests?: LeaveRequestLike[] }> | null | undefined,
  date?: Date | string | null,
): Array<{ id?: string; name?: string; request: LeaveRequestLike }> | null;
