/**
 * Nested طلباتي bags on Employee — leaveRequests + otherRequests.
 * Cloud hydrate must project both; a redacted pull must not wipe a local pending row.
 */

export function mergeRequestLists(...lists) {
  const byKey = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const id = String(row.id || "").trim();
      const key = id || `${String(row.type || "")}:${String(row.createdAt || "")}:${String(row.status || "")}`;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, row);
        continue;
      }
      const prevAt = Date.parse(prev.reviewedAt || prev.updatedAt || prev.createdAt || 0) || 0;
      const nextAt = Date.parse(row.reviewedAt || row.updatedAt || row.createdAt || 0) || 0;
      byKey.set(key, nextAt >= prevAt ? row : prev);
    }
  }
  return [...byKey.values()];
}

/** Incoming undefined = redacted / omitted — keep the local bag. */
export function mergeRequestBag(incoming, local) {
  if (!Array.isArray(incoming)) return Array.isArray(local) ? local : incoming;
  return mergeRequestLists(local, incoming);
}

export function projectDirectoryEmployee(record) {
  if (!record || typeof record !== "object") return null;
  return {
    id: record.employeeId || record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    stationId: record.stationId,
    phone: record.phone,
    position: record.position,
    anonymousId: record.anonymousId,
    points: record.points,
    hrLevelId: record.hrLevelId,
    hrStationId: record.hrStationId,
    hrClusterId: record.hrClusterId,
    canManageTeam: record.canManageTeam,
    managedStations: record.managedStations,
    profile: record.profile,
    certificates: record.certificates,
    leaveRequests: record.leaveRequests,
    otherRequests: record.otherRequests,
    hrMessages: record.hrMessages,
    createdAt: record.created_date || record.createdAt,
  };
}

export function rosterEmployeeById(employees, employeeId) {
  const want = String(employeeId || "").trim();
  if (!want) return null;
  return (employees || []).find((row) => (
    String(row?.id || "").trim() === want || String(row?.employeeId || "").trim() === want
  )) || null;
}

function indexEmployeesById(employees = []) {
  const byId = new Map();
  for (const row of employees || []) {
    const id = String(row?.id || "").trim();
    if (id) byId.set(id, row);
  }
  for (const row of employees || []) {
    const alt = String(row?.employeeId || "").trim();
    if (alt && !byId.has(alt)) byId.set(alt, row);
  }
  return byId;
}

function sameBagPerson(local, employee) {
  const id = String(employee?.id || "").trim();
  const alt = String(employee?.employeeId || "").trim();
  const localId = String(local?.id || "").trim();
  const localAlt = String(local?.employeeId || "").trim();
  if (id && localId && id === localId) return true;
  if (alt && localAlt && alt === localAlt && (!id || !localId || id === localId)) return true;
  if (id && localAlt && id === localAlt && (!alt || alt === localId)) return true;
  if (alt && localId && alt === localId && (!id || id === localAlt)) return true;
  return false;
}

function localBagForIncoming(localById, employee) {
  const id = String(employee?.id || "").trim();
  const alt = String(employee?.employeeId || "").trim();
  if (id && localById.has(id)) {
    const local = localById.get(id);
    return sameBagPerson(local, employee) ? local : null;
  }
  if (!alt || !localById.has(alt)) return null;
  const local = localById.get(alt);
  return sameBagPerson(local, employee) ? local : null;
}

export function mergeEmployeeRequestBags(localEmployees = [], incomingEmployees = []) {
  if (!Array.isArray(incomingEmployees)) return incomingEmployees;
  const localById = indexEmployeesById(localEmployees);
  return incomingEmployees.map((employee) => {
    const local = localBagForIncoming(localById, employee);
    if (!local) return employee;
    const leaveRequests = mergeRequestBag(employee.leaveRequests, local.leaveRequests);
    const otherRequests = mergeRequestBag(employee.otherRequests, local.otherRequests);
    if (leaveRequests === employee.leaveRequests && otherRequests === employee.otherRequests) return employee;
    return { ...employee, leaveRequests, otherRequests };
  });
}

export function otherRequestsForEmployeeId(employeeId, sources = {}) {
  const id = String(employeeId || "");
  const blobEmp = (sources.roster || []).find((row) => String(row?.id || row?.employeeId || "") === id) || null;
  return mergeRequestBag(sources.entity?.otherRequests, blobEmp?.otherRequests) || [];
}
