/**
 * Attendance / overtime hours feeding payroll.
 * Proof Cycle step 1. Canonical: personalAttendance. Legacy: attendanceLedger.
 */

export const ATTENDANCE_FACTS = Object.freeze([
  {
    id: "attendance.punch",
    domain: "attendance",
    scope: "attendanceRow",
    home: "personalAttendance",
    path: "personalAttendance",
    blobCategory: "personalAttendance",
    writer: "attendance-punch",
    stored: true,
    isolation: "companyId",
    proofCycle: 1,
    legacyKeys: ["attendanceLedger"],
    surfaceAr: "الحضور",
    noteAr: "شخص + مكان + وقت. الساعات والأجر الإضافي مشتقّان.",
  },
  {
    id: "attendance.schedule",
    domain: "attendance",
    scope: "schedule",
    home: "schedules",
    path: "schedules",
    blobCategory: "schedules",
    writer: "attendance-policy",
    stored: true,
    isolation: "companyId",
    surfaceAr: "الورديات",
  },
  {
    id: "attendance.places",
    domain: "attendance",
    scope: "place",
    home: "personalPlaces",
    path: "personalPlaces",
    blobCategory: "personalPlaces",
    writer: "attendance-punch",
    stored: true,
    isolation: "companyId",
    surfaceAr: "أماكن الحضور",
  },
  {
    id: "attendance.overtimeHours",
    domain: "attendance",
    scope: "derived",
    home: "derived:approved-overtime → payroll.overtimeHours",
    path: "overtimeHours",
    writer: "payroll-derivation",
    stored: false,
    isolation: "companyId",
    surfaceAr: "العمل الإضافي",
    noteAr: "يُشتق من قرارات OT المعتمدة والحضور — لا يُحرَّر على الشاشة كمصدر.",
    feeds: "payroll.overtime",
  },
]);

export function readPersonalAttendance(company) {
  return Array.isArray(company?.personalAttendance) ? company.personalAttendance : [];
}

export function readSchedules(company) {
  return Array.isArray(company?.schedules) ? company.schedules : [];
}

/** Company-scoped punches only. */
export function attendanceForCompany(rows, companyId) {
  const list = Array.isArray(rows) ? rows : [];
  const cid = String(companyId || "").trim();
  if (!cid) return list;
  return list.filter((row) => !row?.companyId || String(row.companyId) === cid);
}
