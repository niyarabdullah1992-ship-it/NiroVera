/**
 * Company-create payload — every new tenant writes the creator as ownerId.
 * Pure: no localStorage. store.createCompany and tests share this fixture.
 */

export function creatorEmployeeRecord({
  ownerId,
  name,
  email,
  companyId,
  createdAt,
  anonymousId,
} = {}) {
  const id = String(ownerId || "").trim();
  const mail = String(email || "").trim().toLowerCase();
  return {
    id,
    companyId: String(companyId || "").trim(),
    name: String(name || "").trim() || (mail.split("@")[0] || "Owner"),
    email: mail,
    role: "director",
    stationId: null,
    phone: "",
    anonymousId: anonymousId || "",
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function companyMetaCreatePayload(data) {
  return {
    id: "meta",
    name: data?.name || "",
    plan: data?.plan || "",
    directorId: data?.directorId || data?.ownerId || null,
    ownerId: data?.ownerId || null,
    settings: data?.settings || {},
  };
}

/** First employee = apex. Transfer of ownerId is the only later seat move. */
export function seedCreatedCompanyWorkspace(data, owner = {}) {
  if (!data) return data;
  const ownerId = String(owner.ownerId || data.ownerId || "").trim();
  if (!ownerId) return data;
  const companyId = String(data.id || data.companyId || owner.companyId || "").trim();
  data.ownerId = ownerId;
  if (!data.directorId) data.directorId = ownerId;
  data.employees = Array.isArray(data.employees) ? data.employees : [];
  let row = data.employees.find((item) => String(item.id) === ownerId);
  if (!row) {
    row = creatorEmployeeRecord({
      ownerId,
      name: owner.name,
      email: owner.email,
      companyId,
      createdAt: owner.createdAt,
      anonymousId: owner.anonymousId,
    });
    data.employees.push(row);
  } else {
    if (!row.companyId) row.companyId = companyId;
    if (!row.role) row.role = "director";
  }
  return data;
}

/** Mirrors the createCompany write without touching the registry. */
export function buildCreatedCompanyWorkspace(meta = {}, owner = {}) {
  const id = String(meta.id || owner.companyId || "").trim();
  const data = {
    id,
    companyId: id,
    name: String(meta.name || "").trim(),
    plan: meta.plan || "Starter",
    directorId: null,
    ownerId: null,
    settings: { ...(meta.settings || {}), orgType: "company" },
    employees: [],
    stations: [],
    orgSeats: [],
  };
  const ownerId = String(owner.ownerId || "").trim();
  if (!ownerId) return data;
  return seedCreatedCompanyWorkspace(data, {
    ownerId,
    name: owner.name,
    email: owner.email || meta.ownerEmail,
    createdAt: owner.createdAt || meta.createdAt,
    anonymousId: owner.anonymousId,
    companyId: id,
  });
}
