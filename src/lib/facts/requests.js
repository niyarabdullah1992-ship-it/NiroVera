/**
 * Leave and other requests — nested on employees[], not first-class tables.
 * Signing tokens for consent live here or on SignatureRequest — never on WorkProof.
 */

export const REQUEST_FACTS = Object.freeze([
  {
    id: "request.leave",
    domain: "requests",
    scope: "leaveRequest",
    home: "employees[].leaveRequests",
    path: "leaveRequests",
    nestedOn: "employees",
    writer: "request-raise",
    stored: true,
    isolation: "companyId",
    surfaceAr: "طلباتي",
    noteAr: "العزل عبر Employee.companyId. leaveRoster لقطة مشتقّة — لا تُحرَّر كأيام مصدر.",
  },
  {
    id: "request.other",
    domain: "requests",
    scope: "otherRequest",
    home: "employees[].otherRequests",
    path: "otherRequests",
    nestedOn: "employees",
    writer: "request-raise",
    stored: true,
    isolation: "companyId",
    surfaceAr: "طلباتي",
    noteAr: "study_consent، تعويض إجازة، عمل إضافي، موافقة مكتوبة.",
  },
  {
    id: "request.leaveRoster",
    domain: "requests",
    scope: "snapshot",
    home: "leaveRoster",
    path: "leaveRoster",
    blobCategory: "leaveRoster",
    writer: "derived-only",
    stored: true,
    isolation: "companyId",
    surfaceAr: "إدارة الإجازات",
    noteAr: "لقطة من leaveRequests — ليست المصدر.",
  },
  {
    id: "request.decision",
    domain: "requests",
    scope: "decision",
    home: "leaveRequests[].status | otherRequests[].status",
    path: "status",
    writer: "request-decide",
    stored: true,
    isolation: "companyId",
    surfaceAr: "صندوق الطلبات",
  },
]);

export function readLeaveRequests(employee) {
  return Array.isArray(employee?.leaveRequests) ? employee.leaveRequests : [];
}

export function readOtherRequests(employee) {
  return Array.isArray(employee?.otherRequests) ? employee.otherRequests : [];
}

export function allLeaveRequests(company) {
  const out = [];
  for (const employee of company?.employees || []) {
    for (const row of readLeaveRequests(employee)) {
      out.push({ ...row, employeeId: row.employeeId || employee.id });
    }
  }
  return out;
}

export function allOtherRequests(company) {
  const out = [];
  for (const employee of company?.employees || []) {
    for (const row of readOtherRequests(employee)) {
      out.push({ ...row, employeeId: row.employeeId || employee.id });
    }
  }
  return out;
}
