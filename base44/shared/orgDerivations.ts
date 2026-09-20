/** Org structure — permissions & escalation derive from the tree.
 *  Design: NiroVera Platform.dc.html (org / PERMS / SCOPES / CYCLE / delegations).
 */

/** 0 none · 1 company · 2 own · 3 delegated (derived) · 4 station · 5 region */
export const SCOPE = {
  NONE: 0,
  COMPANY: 1,
  OWN: 2,
  DELEGATED: 3,
  STATION: 4,
  REGION: 5,
} as const;

export type ScopeCode = (typeof SCOPE)[keyof typeof SCOPE];

/** Click cycle for manual exceptions — never includes DELEGATED. */
export const SCOPE_CYCLE: ScopeCode[] = [
  SCOPE.NONE,
  SCOPE.OWN,
  SCOPE.STATION,
  SCOPE.REGION,
  SCOPE.COMPANY,
];

export const ORG_ROLES = [
  "ops_director",
  "station_manager",
  "supervisor",
  "safety",
  "employee",
] as const;

export type OrgRoleId = (typeof ORG_ROLES)[number];

export const ORG_SECTIONS = [
  "command",
  "operations",
  "attendance",
  "daily",
  "hse",
  "complaints",
  "leave",
  "hr",
  "payroll",
  "settings",
] as const;

export type OrgSectionId = (typeof ORG_SECTIONS)[number];

/**
 * Baseline matrix [section][role] — mirrors design PERMS.
 * Values: company / station / own / none / delegated placeholders.
 */
export const BASELINE_MATRIX: ScopeCode[][] = [
  // command
  [SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.OWN],
  // operations
  [SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.OWN],
  // attendance
  [SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.OWN],
  // daily
  [SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.OWN],
  // hse
  [SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY],
  // complaints
  [SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.OWN],
  // leave
  [SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.COMPANY, SCOPE.NONE, SCOPE.OWN],
  // hr
  [SCOPE.COMPANY, SCOPE.DELEGATED, SCOPE.DELEGATED, SCOPE.DELEGATED, SCOPE.DELEGATED],
  // payroll
  [SCOPE.COMPANY, SCOPE.DELEGATED, SCOPE.COMPANY, SCOPE.DELEGATED, SCOPE.DELEGATED],
  // settings
  [SCOPE.COMPANY, SCOPE.NONE, SCOPE.NONE, SCOPE.NONE, SCOPE.NONE],
];

export type PermOverride = {
  key: string; // `${sectionIdx}:${roleIdx}`
  scope: ScopeCode;
  by?: string | null;
  at?: string | null;
};

export type DelegationLike = {
  id: string;
  fromId: string;
  toId: string;
  perm: string;
  reason?: string | null;
  start?: string | null; // YYYY-MM-DD — empty means already started
  end: string; // YYYY-MM-DD
  stationId?: string | null;
  listId?: string | null;
  revoked?: boolean;
};

export type BranchLike = {
  id: string;
  name: string;
  /** Optional free-text org group (SAP-style). Not a forced East/West enum. */
  group?: string | null;
  /** @deprecated use group — kept for older payloads */
  region?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  crew?: number;
  seeded?: boolean;
};

export type OrgNodeLike = {
  id: string;
  parentId?: string | null;
  type?: string;
  refId?: string;
  title?: string;
};

export type BranchEscalationStep = {
  employeeId: string;
  name: string;
  title: string;
  role: string;
};

export const EMPLOYEE_ROLE_IDX = ORG_ROLES.indexOf("employee");

const BUILTIN_TITLE_ALIASES = new Set([
  "ops_director", "station_manager", "supervisor", "safety", "employee",
  "مدير عمليات", "مدير فرع", "مشرف", "سلامة", "موظف",
  "ops director", "station mgr", "branch manager",
].map((s) => s.toLocaleLowerCase("ar")));

export type JobTitleCol = { id: string; label: string; count?: number };

export function normalizeJobTitle(title: unknown) {
  return String(title || "").trim().replace(/\s+/g, " ");
}

export function titleSlug(title: unknown) {
  return normalizeJobTitle(title).toLocaleLowerCase("ar");
}

export function titlePermKey(sectionIdx: number, titleId: unknown) {
  return `${sectionIdx}:title:${titleSlug(titleId)}`;
}

export function checkRemoveTitleGate(titleKey: unknown) {
  const id = titleSlug(titleKey);
  if (!id) {
    return { ok: false as const, error: "TITLE_REQUIRED", reason: "المسمى مطلوب.", reasonEn: "A job title is required." };
  }
  if (BUILTIN_TITLE_ALIASES.has(id) || (ORG_ROLES as readonly string[]).includes(id)) {
    return {
      ok: false as const,
      error: "SYSTEM_TITLE",
      reason: "لا يُحذف المسمى النظامي من المصفوفة.",
      reasonEn: "A system role cannot be removed from the matrix.",
    };
  }
  return { ok: true as const, id };
}

export function collectJobTitles(data: {
  employees?: Array<{ profile?: { position?: string }; position?: string; jobTitle?: string; title?: string }>;
  orgTree?: Array<{ type?: string; title?: string }>;
  smartPositions?: Array<{ title?: string }>;
  hcmFoundation?: { jobs?: Array<{ title?: string }> };
} = {}, removed: unknown[] = []): JobTitleCol[] {
  const blocked = new Set((removed || []).map((item) => titleSlug(item)).filter(Boolean));
  const seen = new Map<string, JobTitleCol>();
  const add = (raw: unknown) => {
    const label = normalizeJobTitle(raw);
    if (!label) return;
    const id = titleSlug(label);
    if (!id || BUILTIN_TITLE_ALIASES.has(id) || blocked.has(id)) return;
    const prev = seen.get(id);
    if (prev) prev.count = (prev.count || 0) + 1;
    else seen.set(id, { id, label, count: 1 });
  };
  for (const employee of data.employees || []) {
    add(employee.profile?.position || employee.position || employee.jobTitle || employee.title);
  }
  for (const node of data.orgTree || []) {
    if (node.type === "employee") add(node.title);
  }
  for (const position of data.smartPositions || []) add(position.title);
  for (const job of data.hcmFoundation?.jobs || []) add(job.title);
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "ar"));
}

export function permKey(sectionIdx: number, roleIdx: number) {
  return `${sectionIdx}:${roleIdx}`;
}

export function parseDay(iso: string) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function baselineScope(sectionIdx: number, roleIdx: number): ScopeCode {
  const row = BASELINE_MATRIX[sectionIdx];
  if (!row || roleIdx < 0 || roleIdx >= row.length) return SCOPE.NONE;
  return row[roleIdx];
}

/** Effective cell: override wins unless baseline is DELEGATED and no override. */
export function effectiveScope(
  sectionIdx: number,
  roleIdx: number,
  overrides: Record<string, ScopeCode | PermOverride> = {},
): { scope: ScopeCode; derived: boolean; overridden: boolean; baseline: ScopeCode } {
  const baseline = baselineScope(sectionIdx, roleIdx);
  const key = permKey(sectionIdx, roleIdx);
  const raw = overrides[key];
  const overrideScope = raw == null
    ? null
    : typeof raw === "number"
      ? raw
      : (raw as PermOverride).scope;
  if (overrideScope != null && overrideScope !== SCOPE.DELEGATED) {
    return { scope: overrideScope as ScopeCode, derived: false, overridden: true, baseline };
  }
  return {
    scope: baseline,
    derived: baseline === SCOPE.DELEGATED,
    overridden: false,
    baseline,
  };
}

export function nextScopeInCycle(current: ScopeCode): ScopeCode {
  if (current === SCOPE.DELEGATED) return SCOPE.DELEGATED;
  const at = SCOPE_CYCLE.indexOf(current);
  if (at < 0) return SCOPE_CYCLE[0];
  return SCOPE_CYCLE[(at + 1) % SCOPE_CYCLE.length];
}

export function checkSetPermGate(nextScope: ScopeCode | number) {
  if (Number(nextScope) === SCOPE.DELEGATED) {
    return {
      ok: false as const,
      error: "DELEGATED_IS_DERIVED",
      reason: "«بتفويض» حالة مشتقة من سجل التفويض — لا تُضبط من المصفوفة.",
      reasonEn: "\"Delegated\" is derived from the delegation register — not set from the matrix.",
    };
  }
  if (![SCOPE.NONE, SCOPE.OWN, SCOPE.STATION, SCOPE.REGION, SCOPE.COMPANY].includes(Number(nextScope) as ScopeCode)) {
    return {
      ok: false as const,
      error: "INVALID_SCOPE",
      reason: "نطاق صلاحية غير معروف.",
      reasonEn: "Unknown permission scope.",
    };
  }
  return { ok: true as const, scope: Number(nextScope) as ScopeCode };
}

export function effectiveTitleScope(
  sectionIdx: number,
  titleId: string,
  overrides: Record<string, ScopeCode | PermOverride> = {},
): { scope: ScopeCode; derived: boolean; overridden: boolean; baseline: ScopeCode } {
  const baseline = baselineScope(sectionIdx, EMPLOYEE_ROLE_IDX);
  const key = titlePermKey(sectionIdx, titleId);
  const raw = overrides[key];
  const overrideScope = raw == null
    ? null
    : typeof raw === "number"
      ? raw
      : (raw as PermOverride).scope;
  if (overrideScope != null && overrideScope !== SCOPE.DELEGATED) {
    return { scope: overrideScope as ScopeCode, derived: false, overridden: true, baseline };
  }
  return {
    scope: baseline,
    derived: baseline === SCOPE.DELEGATED,
    overridden: false,
    baseline,
  };
}

function normalizedTitles(titles: Array<string | JobTitleCol> = []): JobTitleCol[] {
  const seen = new Set<string>();
  const out: JobTitleCol[] = [];
  for (const item of titles) {
    const label = normalizeJobTitle(typeof item === "string" ? item : item?.label || item?.id);
    const id = titleSlug(typeof item === "string" ? item : item?.id || label);
    if (!id || seen.has(id) || BUILTIN_TITLE_ALIASES.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: label || id,
      count: typeof item === "object" ? Number(item?.count) || 0 : 0,
    });
  }
  return out;
}

export function derivePermissionMatrix(
  overrides: Record<string, ScopeCode | PermOverride> = {},
  titles: Array<string | JobTitleCol> = [],
) {
  const extra = normalizedTitles(titles);
  return ORG_SECTIONS.map((sectionId, si) => ({
    sectionId,
    cells: [
      ...ORG_ROLES.map((roleId, ri) => {
        const cell = effectiveScope(si, ri, overrides);
        return { roleId, ...cell };
      }),
      ...extra.map((title) => ({
        roleId: `title:${title.id}`,
        titleKey: title.label,
        ...effectiveTitleScope(si, title.id, overrides),
      })),
    ],
  }));
}

export function checkCreateBranchGate(input: { name?: string | null; managerId?: string | null; managerName?: string | null }) {
  const name = String(input.name || "").trim();
  const manager = String(input.managerId || input.managerName || "").trim();
  if (!name) {
    return { ok: false as const, error: "BRANCH_NAME_REQUIRED", reason: "اسم الفرع مطلوب.", reasonEn: "Branch name is required." };
  }
  if (!manager) {
    return { ok: false as const, error: "BRANCH_MANAGER_REQUIRED", reason: "مسؤول الفرع مطلوب.", reasonEn: "Branch manager is required." };
  }
  return { ok: true as const, name, manager };
}

/** True if placing nodeId under newParentId would create a cycle. */
export function wouldCreateCycle(nodes: OrgNodeLike[], nodeId: string, newParentId: string | null | undefined) {
  if (!newParentId) return false;
  if (newParentId === nodeId) return true;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cursor: OrgNodeLike | undefined = byId.get(newParentId);
  const seen = new Set<string>();
  while (cursor) {
    if (cursor.id === nodeId) return true;
    if (seen.has(cursor.id)) return true;
    seen.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return false;
}

export function checkReparentGate(nodes: OrgNodeLike[], nodeId: string, newParentId: string | null | undefined) {
  if (!nodeId) {
    return { ok: false as const, error: "NODE_REQUIRED", reason: "العقدة مطلوبة.", reasonEn: "Node is required." };
  }
  if (!nodes.some((n) => n.id === nodeId)) {
    return { ok: false as const, error: "NODE_NOT_FOUND", reason: "العقدة غير موجودة.", reasonEn: "Node not found." };
  }
  if (newParentId && !nodes.some((n) => n.id === newParentId)) {
    return { ok: false as const, error: "PARENT_NOT_FOUND", reason: "الأب غير موجود.", reasonEn: "Parent not found." };
  }
  if (wouldCreateCycle(nodes, nodeId, newParentId)) {
    return {
      ok: false as const,
      error: "CYCLE_FORBIDDEN",
      reason: "لا يمكن جعل عقدة أبًا لنفسها أو لسلفها — الدورة ممنوعة.",
      reasonEn: "A node cannot be placed under itself or its descendant — cycles are forbidden.",
    };
  }
  return { ok: true as const };
}

export function isDelegationExpired(end: string, now: Date = new Date()) {
  const due = parseDay(end);
  if (!due) return true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < today.getTime();
}

export function isDelegationStarted(start: string | null | undefined, now: Date = new Date()) {
  if (!start) return true;
  const due = parseDay(start);
  if (!due) return true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() <= today.getTime();
}

export function isDelegationActive(d: DelegationLike, now: Date = new Date()) {
  return !d.revoked && isDelegationStarted(d.start, now) && !isDelegationExpired(d.end, now);
}

export function deriveDelegationStatus(d: DelegationLike, now: Date = new Date()) {
  if (d.revoked) return { active: false, expired: false, status: "revoked" as const };
  if (isDelegationExpired(d.end, now)) return { active: false, expired: true, status: "expired" as const };
  if (!isDelegationStarted(d.start, now)) return { active: false, expired: false, status: "scheduled" as const };
  const due = parseDay(d.end)!;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
  return { active: true, expired: false, status: "active" as const, daysLeft };
}

export function checkCreateDelegationGate(input: {
  fromId?: string | null;
  toId?: string | null;
  end?: string | null;
  perm?: string | null;
}) {
  if (!String(input.fromId || "").trim() || !String(input.toId || "").trim()) {
    return {
      ok: false as const,
      error: "DELEGATION_PARTIES_REQUIRED",
      reason: "المفوِّض والمفوَّض إليه مطلوبان.",
      reasonEn: "Delegator and delegate are required.",
    };
  }
  if (String(input.fromId) === String(input.toId)) {
    return {
      ok: false as const,
      error: "SELF_DELEGATION_FORBIDDEN",
      reason: "لا تفويض إلى النفس.",
      reasonEn: "Cannot delegate to yourself.",
    };
  }
  if (!String(input.perm || "").trim()) {
    return {
      ok: false as const,
      error: "DELEGATION_PERM_REQUIRED",
      reason: "الصلاحية المفوَّضة مطلوبة.",
      reasonEn: "Delegated permission is required.",
    };
  }
  if (!parseDay(String(input.end || ""))) {
    return {
      ok: false as const,
      error: "DELEGATION_END_REQUIRED",
      reason: "تاريخ انتهاء التفويض مطلوب.",
      reasonEn: "Delegation end date is required.",
    };
  }
  return { ok: true as const };
}

/**
 * Escalation hops derived from branch managers — changing a manager moves
 * the chain immediately (no second place to update).
 */
export function deriveEscalationFromBranches(branches: BranchLike[]) {
  return branches
    .filter((b) => b.managerId || b.managerName)
    .map((b) => {
      const group = String(b.group || (b.region !== "west" && b.region !== "east" ? b.region : "") || "").trim() || null;
      return {
        branchId: b.id,
        branchName: b.name,
        managerId: b.managerId || null,
        managerName: b.managerName || null,
        group,
        region: group, // legacy alias
      };
    });
}

type EscalationData = {
  employees?: Array<{
    id?: string;
    employeeId?: string;
    name?: string;
    role?: string;
    stationId?: string | null;
    managedStations?: string[];
    isOwner?: boolean;
    position?: string;
    profile?: { position?: string };
    actingAssignments?: Array<{ stationId?: string; until?: string; endedAt?: string; title?: string }>;
  }>;
  orgTree?: OrgNodeLike[];
  stations?: Array<{
    id?: string;
    stationId?: string;
    managerId?: string | null;
    parentStationId?: string | null;
    parentBranchId?: string | null;
  }>;
  ownerId?: string;
  directorId?: string;
  branchEscalationChains?: Record<string, string[]>;
};

function employeeIndex(employees: EscalationData["employees"] = []) {
  const empById = new Map<string, NonNullable<EscalationData["employees"]>[number]>();
  for (const e of employees) {
    const id = e.id || e.employeeId;
    if (id) empById.set(String(id), e);
  }
  return empById;
}

function stepFromEmp(emp: NonNullable<EscalationData["employees"]>[number], title?: string): BranchEscalationStep {
  return {
    employeeId: String(emp.id || emp.employeeId || ""),
    name: emp.name || "",
    title: title || emp.profile?.position || emp.position || "",
    role: emp.role || "",
  };
}

function actingAtStation(data: EscalationData | null | undefined, stationId: string) {
  const sid = String(stationId || "");
  if (!sid) return null;
  const today = new Date().toISOString().slice(0, 10);
  for (const employee of data?.employees || []) {
    const assignment = (employee.actingAssignments || []).find((item) => {
      if (item?.endedAt) return false;
      if (String(item.stationId) !== sid) return false;
      const until = String(item.until || "").slice(0, 10);
      return !until || until >= today;
    });
    if (assignment) return { employee, assignment };
  }
  return null;
}

function workplaceEscalationManagers(data: EscalationData | null | undefined, stationId: string) {
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const byId = new Map(stations.map((station) => [String(station.id || station.stationId || ""), station]));
  const out: Array<{ employeeId: string; title: string }> = [];
  const seenStations = new Set<string>();
  const seenPeople = new Set<string>();
  let cursor = byId.get(String(stationId || ""));
  while (cursor) {
    const sid = String(cursor.id || cursor.stationId || "");
    if (!sid || seenStations.has(sid)) break;
    seenStations.add(sid);
    const acting = actingAtStation(data, sid);
    const aid = acting?.employee ? String(acting.employee.id || acting.employee.employeeId || "") : "";
    if (aid && !seenPeople.has(aid)) {
      seenPeople.add(aid);
      out.push({ employeeId: aid, title: "مدير بالوكالة" });
    } else {
      const managerId = String(cursor.managerId || "").trim();
      if (managerId && !seenPeople.has(managerId)) {
        seenPeople.add(managerId);
        out.push({ employeeId: managerId, title: "مدير الفرع" });
      }
    }
    const parent = String(cursor.parentStationId || cursor.parentBranchId || "").trim();
    cursor = parent ? byId.get(parent) : undefined;
  }
  return out;
}

export function deriveAutoBranchEscalationChain(
  stationId: string | null | undefined,
  data?: EscalationData | null,
): BranchEscalationStep[] {
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const empById = new Map<string, (typeof employees)[number]>();
  for (const e of employees) {
    const id = e.id || e.employeeId;
    if (id) empById.set(String(id), e);
  }
  const chain: BranchEscalationStep[] = [];
  const seen = new Set<string>();

  const pushEmp = (emp: (typeof employees)[number] | undefined, title?: string) => {
    if (!emp) return;
    const id = String(emp.id || emp.employeeId || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    chain.push({
      employeeId: id,
      name: emp.name || "",
      title: title || emp.profile?.position || emp.position || "",
      role: emp.role || "",
    });
  };

  const sid = stationId ? String(stationId) : "";
  if (!sid) return chain;

  for (const step of workplaceEscalationManagers(data, sid)) {
    pushEmp(empById.get(String(step.employeeId)), step.title);
  }

  const owner = employees.find((e) => e.isOwner || e.role === "owner" || String(e.id) === String(data?.ownerId));
  if (owner) pushEmp(owner, "المالك");

  return chain;
}

/** Per-branch escalation: custom order if edited, otherwise the tree path. */
export function deriveBranchEscalationChain(
  stationId: string | null | undefined,
  data?: EscalationData | null,
): BranchEscalationStep[] {
  const sid = stationId ? String(stationId) : "";
  const manual = data?.branchEscalationChains?.[sid];
  if (!Array.isArray(manual)) return deriveAutoBranchEscalationChain(sid, data);
  const empById = employeeIndex(data?.employees);
  const chain: BranchEscalationStep[] = [];
  const seen = new Set<string>();
  for (const raw of manual) {
    const id = String(raw);
    const emp = empById.get(id);
    if (!emp || seen.has(id)) continue;
    seen.add(id);
    chain.push(stepFromEmp(emp));
  }
  return chain;
}

export function deriveOrgStats(branches: BranchLike[], delegations: DelegationLike[], now: Date = new Date()) {
  const activeDg = delegations.filter((d) => isDelegationActive(d, now)).length;
  const unassigned = branches.filter((b) => !(b.managerId || b.managerName)).length;
  return {
    branches: branches.length,
    unassignedManagers: unassigned,
    activeDelegations: activeDg,
  };
}

type ApexPerson = {
  id?: string;
  employeeId?: string;
  companyId?: string;
  role?: string;
  isOwner?: boolean;
  stationId?: string;
  profile?: { directManagerId?: string | null; stationId?: string };
};

type ApexSeat = { employeeId?: string; reportsToEmployeeId?: string | null; stationId?: string };
type ApexStation = {
  id?: string;
  stationId?: string;
  managerId?: string | null;
  parentStationId?: string | null;
  parentBranchId?: string | null;
  isCompanyRoot?: boolean;
};

export type ApexOrgData = {
  id?: string;
  companyId?: string;
  ownerId?: string;
  employees?: ApexPerson[];
  orgSeats?: ApexSeat[];
  stations?: ApexStation[];
};

function apexPersonId(person: ApexPerson | null | undefined) {
  return String(person?.id || person?.employeeId || "").trim();
}

function apexWorkspaceCompanyId(data?: ApexOrgData | null) {
  return String(data?.companyId || data?.id || "").trim();
}

export function sameCompanyScope(person: ApexPerson | null | undefined, data?: ApexOrgData | null) {
  const companyId = apexWorkspaceCompanyId(data);
  const personCompany = String((person as { companyId?: string } | null)?.companyId || "").trim();
  if (companyId && personCompany && companyId !== personCompany) return false;
  return true;
}

export function isTopAuthority(employee: ApexPerson | null | undefined, data?: ApexOrgData | null) {
  const id = apexPersonId(employee);
  if (!id) return false;
  if (!sameCompanyScope(employee, data)) return false;
  if (data?.ownerId) return String(data.ownerId) === id;
  if (employee?.role === "owner" || employee?.isOwner === true) return true;
  if (employee?.role !== "director") return false;
  const seat = (data?.orgSeats || []).find((row) => String(row.employeeId) === id);
  const reported = String(seat?.reportsToEmployeeId || employee?.profile?.directManagerId || "").trim();
  if (reported && reported !== id && apexPersonExists(data, reported)) return false;
  return !hasWorkplaceSuperior(employee, data, id);
}

export function isCompanyOwner(employee: ApexPerson | null | undefined, data?: ApexOrgData | null) {
  const id = apexPersonId(employee);
  if (!id) return false;
  if (!sameCompanyScope(employee, data)) return false;
  if (data?.ownerId) return String(data.ownerId) === id;
  return employee?.role === "owner" || employee?.isOwner === true;
}

function apexPersonExists(data: ApexOrgData | null | undefined, personId: string) {
  const want = String(personId || "").trim();
  if (!want) return false;
  return (data?.employees || []).some((item) => apexPersonId(item) === want);
}

function hasWorkplaceSuperior(employee: ApexPerson | null | undefined, data: ApexOrgData | null | undefined, id: string) {
  const stations = data?.stations || [];
  const seat = (data?.orgSeats || []).find((row) => String(row.employeeId) === id);
  const homeId = String(employee?.stationId || employee?.profile?.stationId || seat?.stationId || "").trim();
  const managed = stations.filter((station) => String(station.managerId || "") === id);
  const home = stations.find((station) => String(station.id || station.stationId) === homeId);
  const start = managed.find((station) => {
    const parent = String(station.parentStationId || station.parentBranchId || "");
    return !parent || !managed.some((row) => String(row.id || row.stationId) === parent);
  }) || managed[0] || home;
  if (!start) return false;
  const homeManager = String(start.managerId || "").trim();
  if (!managed.length && homeManager && homeManager !== id && apexPersonExists(data, homeManager)) return true;
  const byId = new Map(stations.map((station) => [String(station.id || station.stationId), station]));
  let cursor = start;
  const seen = new Set<string>();
  while (cursor) {
    const parentId = String(cursor.parentStationId || cursor.parentBranchId || "").trim();
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    cursor = byId.get(parentId);
    if (!cursor) break;
    const mid = String(cursor.managerId || "").trim();
    if (mid && mid !== id && apexPersonExists(data, mid)) return true;
  }
  return false;
}

export function checkTransferCompanyOwnershipGate(data: ApexOrgData | null | undefined, nextOwnerId?: string | null) {
  const next = String(nextOwnerId || "").trim();
  if (!next) {
    return {
      ok: false as const,
      error: "NEXT_OWNER",
      reason: "اختر الموظف الذي تنتقل إليه أعلى سلطة في المنشأة.",
      reasonEn: "Choose the employee who becomes the highest authority.",
    };
  }
  const nextEmp = (data?.employees || []).find((item) => apexPersonId(item) === next);
  if (!nextEmp) {
    return { ok: false as const, error: "MISSING", reason: "الموظف غير موجود.", reasonEn: "Employee not found." };
  }
  if (!sameCompanyScope(nextEmp, data)) {
    return {
      ok: false as const,
      error: "COMPANY_MISMATCH",
      reason: "لا تُنقل أعلى سلطة إلى شركة أخرى.",
      reasonEn: "Ownership cannot move to another company.",
    };
  }
  if (data?.ownerId && String(data.ownerId) === next) {
    return {
      ok: false as const,
      error: "ALREADY_OWNER",
      reason: "هذا الموظف هو أعلى سلطة في المنشأة.",
      reasonEn: "This employee is already the highest authority.",
    };
  }
  return { ok: true as const, ownerId: next };
}

export function applyCompanyOwnershipTransfer(data: ApexOrgData, nextOwnerId?: string | null) {
  const gate = checkTransferCompanyOwnershipGate(data, nextOwnerId);
  if (!gate.ok) return gate;
  const next = String(nextOwnerId);
  const previousOwner = String(data.ownerId || "");
  (data.employees || []).forEach((item) => {
    if (apexPersonId(item) === next) item.isOwner = true;
    else if (item.isOwner) item.isOwner = false;
  });
  data.ownerId = next;
  return { ok: true as const, ownerId: next, previousOwner };
}

/** Mirrors src/lib/peopleTreeGraph.js — owner is apex; never invent a manager above them. */
export function hasOrgSuperior(employee: ApexPerson | null | undefined, data?: ApexOrgData | null) {
  if (!employee) return false;
  if (isTopAuthority(employee, data)) return false;
  const id = apexPersonId(employee);
  if (!id) return false;
  const seat = (data?.orgSeats || []).find((row) => String(row.employeeId) === id);
  const reported = String(seat?.reportsToEmployeeId || employee.profile?.directManagerId || "").trim();
  if (reported && reported !== id && apexPersonExists(data, reported)) return true;

  const stations = data?.stations || [];
  const homeId = String(employee.stationId || employee.profile?.stationId || seat?.stationId || "").trim();
  const managed = stations.filter((station) => String(station.managerId || "") === id);
  const home = stations.find((station) => String(station.id || station.stationId) === homeId);
  const start = managed.find((station) => {
    const parent = String(station.parentStationId || station.parentBranchId || "");
    return !parent || !managed.some((row) => String(row.id || row.stationId) === parent);
  }) || managed[0] || home;
  if (start) {
    const homeManager = String(start.managerId || "").trim();
    if (!managed.length && homeManager && homeManager !== id && apexPersonExists(data, homeManager)) return true;
    const byId = new Map(stations.map((station) => [String(station.id || station.stationId), station]));
    let cursor = start;
    const seen = new Set<string>();
    while (cursor) {
      const parentId = String(cursor.parentStationId || cursor.parentBranchId || "").trim();
      if (!parentId || seen.has(parentId)) break;
      seen.add(parentId);
      cursor = byId.get(parentId);
      if (!cursor) break;
      const mid = String(cursor.managerId || "").trim();
      if (mid && mid !== id && apexPersonExists(data, mid)) return true;
    }
  }

  const owner = (data?.employees || []).find((item) => isCompanyOwner(item, data));
  return !!(owner && apexPersonId(owner) !== id);
}
