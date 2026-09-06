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

export function usedLeaveDays(requests: LeaveRequestLike[] | undefined, key: string, onDate?: string, hireDate?: string): number;
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

export function isOnApprovedLeave(
  employee: EmployeeLeaveProfile | null | undefined,
  date?: Date | string,
): boolean;

export function isOnLeaveToday(employee: EmployeeLeaveProfile | null | undefined): boolean;

export function leaveTypeLabel(type: string | undefined, ar?: boolean): string;
