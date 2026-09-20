/**
 * Mirrors src/lib/companyBootstrap.js — every new tenant writes the creator as ownerId.
 */

export type CreatorSeed = {
  ownerId?: string;
  name?: string;
  email?: string;
  companyId?: string;
  createdAt?: string;
  anonymousId?: string;
};

export type CreatedCompanyMeta = {
  id?: string;
  name?: string;
  plan?: string;
  ownerEmail?: string;
  createdAt?: string;
  settings?: Record<string, unknown>;
};

export function creatorEmployeeRecord(input: CreatorSeed = {}) {
  const id = String(input.ownerId || "").trim();
  const mail = String(input.email || "").trim().toLowerCase();
  return {
    id,
    employeeId: id,
    companyId: String(input.companyId || "").trim(),
    name: String(input.name || "").trim() || (mail.split("@")[0] || "Owner"),
    email: mail,
    role: "director",
    stationId: null as string | null,
    phone: "",
    anonymousId: input.anonymousId || "",
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function companyMetaCreatePayload(data: {
  name?: string;
  plan?: string;
  directorId?: string | null;
  ownerId?: string | null;
  settings?: Record<string, unknown>;
}) {
  return {
    id: "meta",
    name: data?.name || "",
    plan: data?.plan || "",
    directorId: data?.directorId || data?.ownerId || null,
    ownerId: data?.ownerId || null,
    settings: data?.settings || {},
  };
}

export function seedCreatedCompanyWorkspace<T extends {
  id?: string;
  companyId?: string;
  ownerId?: string | null;
  directorId?: string | null;
  employees?: Array<{ id?: string; companyId?: string; role?: string }>;
}>(data: T, owner: CreatorSeed = {}) {
  if (!data) return data;
  const ownerId = String(owner.ownerId || data.ownerId || "").trim();
  if (!ownerId) return data;
  const companyId = String(data.id || data.companyId || owner.companyId || "").trim();
  data.ownerId = ownerId;
  if (!data.directorId) data.directorId = ownerId;
  data.employees = Array.isArray(data.employees) ? data.employees : [];
  let row = data.employees.find((item) => String(item.id) === ownerId);
  if (!row) {
    data.employees.push(creatorEmployeeRecord({
      ownerId,
      name: owner.name,
      email: owner.email,
      companyId,
      createdAt: owner.createdAt,
      anonymousId: owner.anonymousId,
    }));
  } else if (!row.companyId) {
    row.companyId = companyId;
    if (!row.role) row.role = "director";
  }
  return data;
}

export function buildCreatedCompanyWorkspace(meta: CreatedCompanyMeta = {}, owner: CreatorSeed = {}) {
  const id = String(meta.id || owner.companyId || "").trim();
  const data = {
    id,
    companyId: id,
    name: String(meta.name || "").trim(),
    plan: meta.plan || "Starter",
    directorId: null as string | null,
    ownerId: null as string | null,
    settings: { ...(meta.settings || {}), orgType: "company" },
    employees: [] as ReturnType<typeof creatorEmployeeRecord>[],
    stations: [] as unknown[],
    orgSeats: [] as unknown[],
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
