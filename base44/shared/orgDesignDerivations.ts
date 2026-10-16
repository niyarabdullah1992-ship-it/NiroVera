/**
 * Organisation design — server twin of src/lib/orgDesign.js (the parts the server enforces).
 *
 *   - who may see what: orgViewScope / checkOrgViewGate (edit · subtree · self), named refusals;
 *   - delegation of authority: resolveDoa (same algorithm as the client), so an approval the
 *     matrix routes to a seat is accepted from that seat's occupant;
 *   - my place: the read-only "where am I" for an employee who cannot read orgSeats;
 *   - mergeOrgDesignWrite: the orgDesign blob is replaced only through this merge —
 *     published decisions are immutable, the author never approves his own change (owner excepted),
 *     an approval is stamped with the caller, and voice/complaints never enter the matrix.
 *
 * The reporting line is the workplace chain: a person reports to the manager of their unit (or the
 * nearest ancestor with a manager); a unit manager to the manager above their top unit.
 * Pure — no imports. Keep in step with src/lib/orgDesign.js (scripts/test-org-design-server.mjs).
 */

type Row = Record<string, any>;
export type OrgData = {
  ownerId?: string;
  employees?: Row[];
  stations?: Row[];
  orgSeats?: Row[];
  hrLevels?: Row[];
  orgDesign?: Row;
};

const str = (v: unknown) => String(v ?? "").trim();
const dayOf = (v: unknown) => {
  const s = str(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const DOA_KINDS = ["leave", "overtime", "sanction", "payroll", "task_approval", "offboarding"];
export const DOA_FORBIDDEN_KINDS = ["complaint", "complaints", "voice", "anonymous", "abuse", "grievance"];
const DOA_VOICE_REASON = {
  error: "DOA_VOICE_NEVER_MANAGER",
  reason: "صوت الموظف والشكاوى لا تمر بمصفوفة الصلاحيات ولا تُوجَّه للمدير — لها سلسلة معالجتها الخاصة.",
  reasonEn: "Employee voice and complaints never route through the authority matrix or to a manager — they keep their own handling chain.",
};

/** Normalise entity rows (Employee.employeeId / Station.stationId) to the client's ids. */
export function toOrgData(input: { employees?: Row[]; stations?: Row[]; orgSeats?: Row[]; hrLevels?: Row[]; orgDesign?: Row; ownerId?: string }): OrgData {
  return {
    ownerId: str(input.ownerId),
    employees: (input.employees || []).map((e) => ({ ...e, id: str(e.employeeId || e.id) })),
    stations: (input.stations || []).map((s) => ({ ...s, id: str(s.stationId || s.id) })),
    orgSeats: Array.isArray(input.orgSeats) ? input.orgSeats : [],
    hrLevels: Array.isArray(input.hrLevels) ? input.hrLevels : [],
    orgDesign: input.orgDesign && typeof input.orgDesign === "object" && !Array.isArray(input.orgDesign) ? input.orgDesign : {},
  };
}

export function activePeople(data: OrgData) {
  return (data.employees || []).filter((e) => e?.id && e.role !== "system" && e.active !== false && e.profile?.employmentStatus !== "terminated");
}

const seatsOf = (data: OrgData) => (Array.isArray(data.orgSeats) ? data.orgSeats : []);
const parentOf = (s: Row | undefined) => str(s?.parentStationId ?? s?.parentBranchId) || "";

function homeStationId(employee: Row, data: OrgData) {
  const seat = seatsOf(data).find((s) => str(s.employeeId) === str(employee?.id));
  return str(employee?.stationId || employee?.profile?.stationId || seat?.stationId);
}

export function unitPath(data: OrgData, stationId: string) {
  const byId = new Map((data.stations || []).map((s) => [str(s.id), s]));
  const out: Row[] = [];
  const seen = new Set<string>();
  let cursor = byId.get(str(stationId));
  while (cursor && !seen.has(str(cursor.id))) {
    seen.add(str(cursor.id));
    out.unshift(cursor);
    const p = parentOf(cursor);
    cursor = p ? byId.get(p) : undefined;
  }
  return out;
}

/** Workplace chain: the first manager above this person who is not themself. */
export function managerOf(data: OrgData, employeeId: string): string {
  const id = str(employeeId);
  const person = activePeople(data).find((e) => str(e.id) === id);
  if (!person) return "";
  const alive = new Set(activePeople(data).map((e) => str(e.id)));
  const stations = data.stations || [];
  const managed = stations.filter((s) => str(s.managerId) === id);
  const managedIds = new Set(managed.map((s) => str(s.id)));
  const start = managed.find((s) => !parentOf(s) || !managedIds.has(parentOf(s))) || managed[0];
  const path = start ? unitPath(data, parentOf(start)) : unitPath(data, homeStationId(person, data));
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const m = str(path[i].managerId);
    if (m && m !== id && alive.has(m)) return m;
  }
  const owner = str(data.ownerId);
  return owner && owner !== id && alive.has(owner) ? owner : "";
}

export function directReports(data: OrgData, employeeId: string) {
  const id = str(employeeId);
  return activePeople(data).filter((e) => str(e.id) !== id && managerOf(data, e.id) === id).map((e) => str(e.id));
}

export function descendants(data: OrgData, employeeId: string) {
  const out: string[] = [];
  const stack = directReports(data, employeeId);
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    directReports(data, cur).forEach((c) => stack.push(c));
  }
  return out;
}

/* ── permissions ── */

export function isOrgOwner(user: Row | null, data: OrgData) {
  if (!user) return false;
  return Boolean(user.role === "owner" || user.isOwner || user.owner || (str(data.ownerId) && str(user.id) === str(data.ownerId)));
}

export function canEditOrgDesign(user: Row | null, data: OrgData) {
  if (!user) return false;
  if (isOrgOwner(user, data)) return true;
  if (["director", "admin", "hr_manager"].includes(str(user.role))) return true;
  const level = (data.hrLevels || []).find((l) => l.id === user.hrLevelId && l.active !== false);
  return Boolean(level && (level.permissions || []).includes("manage_employees"));
}

export function orgViewScope(user: Row | null, data: OrgData): "edit" | "subtree" | "self" {
  if (!user) return "self";
  if (canEditOrgDesign(user, data)) return "edit";
  if (directReports(data, user.id).length) return "subtree";
  if ((data.stations || []).some((s) => str(s.managerId) === str(user.id))) return "subtree";
  return "self";
}

export function checkOrgViewGate(user: Row | null, data: OrgData, targetEmployeeId: string) {
  if (!user) return { ok: false, error: "ORG_VIEW_SIGNED_OUT", reason: "سجّل الدخول.", reasonEn: "Sign in." };
  const target = str(targetEmployeeId);
  const scope = orgViewScope(user, data);
  if (!target || target === str(user.id) || scope === "edit") return { ok: true, scope };
  if (scope === "subtree") {
    if (descendants(data, user.id).includes(target)) return { ok: true, scope };
    return {
      ok: false,
      error: "ORG_VIEW_OUTSIDE_SUBTREE",
      reason: "هذا الموظف خارج فريقك — يرى المدير فرعه من الهيكل فقط.",
      reasonEn: "This person is outside your team — a manager sees only their own subtree.",
    };
  }
  return { ok: false, error: "ORG_VIEW_SELF_ONLY", reason: "يرى الموظف مكانه في الهيكل فقط.", reasonEn: "An employee sees only their own place in the structure." };
}

/* ── delegation of authority ── */

function seatHolder(data: OrgData, seat: Row | undefined) {
  const id = str(seat?.employeeId);
  if (!id) return null;
  return activePeople(data).find((e) => str(e.id) === id) || null;
}

function actingOnSeat(data: OrgData, seatId: string, day: string) {
  for (const e of activePeople(data)) {
    const hit = (e.actingAssignments || []).find((a: Row) => {
      if (!a || a.endedAt || str(a.seatId) !== str(seatId)) return false;
      const from = dayOf(a.from || a.createdAt);
      const until = dayOf(a.until);
      if (from && from > day) return false;
      return !until || until >= day;
    });
    if (hit) return e;
  }
  return null;
}

export function seatOccupant(data: OrgData, seatId: string, day = todayKey()) {
  const seat = seatsOf(data).find((s) => str(s.id) === str(seatId));
  if (!seat) return null;
  const holder = seatHolder(data, seat);
  if (holder) return { employeeId: str(holder.id), via: "holder" };
  const acting = actingOnSeat(data, seat.id, day);
  if (acting) return { employeeId: str(acting.id), via: "acting" };
  const deputy = seat.deputySeatId ? seatsOf(data).find((s) => str(s.id) === str(seat.deputySeatId)) : undefined;
  const dh = deputy ? seatHolder(data, deputy) : null;
  return dh ? { employeeId: str(dh.id), via: "deputy" } : null;
}

export function resolveDoa(data: OrgData, { kind, employeeId, amount = null, day = todayKey() }: { kind: string; employeeId: string; amount?: number | null; day?: string }) {
  const k = str(kind);
  if (DOA_FORBIDDEN_KINDS.includes(k)) return { source: "refused", approvers: [] as string[], ...DOA_VOICE_REASON };
  const rows = (Array.isArray(data.orgDesign?.doa) ? data.orgDesign!.doa : []).filter((r: Row) => str(r.kind) === k && !r.disabled);
  const person = activePeople(data).find((e) => str(e.id) === str(employeeId));
  if (!rows.length || !person) return { source: "default", approvers: [] as string[] };
  const ancestry = unitPath(data, homeStationId(person, data)).map((s) => str(s.id)).reverse();
  const rank = (row: Row) => (str(row.unitId) ? ancestry.indexOf(str(row.unitId)) : ancestry.length);
  const candidates = rows
    .map((row: Row) => ({ row, rank: rank(row) }))
    .filter((c: { rank: number }) => c.rank >= 0)
    .sort((a: { row: Row; rank: number }, b: { row: Row; rank: number }) => a.rank - b.rank || (Number(a.row.limit ?? Infinity) - Number(b.row.limit ?? Infinity)));
  const amt = amount == null || str(amount) === "" ? null : Number(amount);
  const covers = (row: Row) => row.limit == null || str(row.limit) === "" || amt == null || amt <= Number(row.limit);
  const tried = new Set<string>();
  const subject = str(person.id);
  const trySeat = (seatId: unknown) => {
    const sid = str(seatId);
    if (!sid || tried.has(sid)) return null;
    tried.add(sid);
    const occ = seatOccupant(data, sid, day);
    if (!occ || occ.employeeId === subject) return null;
    return occ;
  };
  for (const { row } of candidates) {
    let hit = covers(row) ? trySeat(row.approverSeatId) : null;
    if (!hit && row.escalateToSeatId) hit = trySeat(row.escalateToSeatId);
    if (hit) return { source: "doa", rowId: str(row.id), approvers: [hit.employeeId] };
  }
  return { source: "default", approvers: [] as string[] };
}

/** A decision the matrix routes to this caller is accepted from them. */
export function isDoaApprover(data: OrgData, callerId: string, kind: string, subjectId: string, amount: number | null = null, day = todayKey()) {
  const res = resolveDoa(data, { kind, employeeId: subjectId, amount, day });
  return res.source === "doa" && res.approvers.includes(str(callerId));
}

/* ── my place ── */

export function deriveMyPlace(data: OrgData, employeeId: string) {
  const id = str(employeeId);
  const people = activePeople(data);
  const me = people.find((e) => str(e.id) === id);
  if (!me) return null;
  const titleOf = (p: Row | undefined) => {
    const s = seatsOf(data).find((row) => str(row.employeeId) === str(p?.id));
    return str(s?.title || p?.profile?.position || p?.jobTitle || p?.position);
  };
  const face = (p: Row | undefined) => (p ? { employeeId: str(p.id), name: str(p.name), title: titleOf(p) } : null);
  const mid = managerOf(data, id);
  const manager = people.find((e) => str(e.id) === mid);
  const peers = mid ? directReports(data, mid).filter((p) => p !== id).map((p) => face(people.find((e) => str(e.id) === p))).filter(Boolean) : [];
  const team = directReports(data, id).map((p) => face(people.find((e) => str(e.id) === p))).filter(Boolean);
  const path = unitPath(data, homeStationId(me, data)).map((s) => ({ stationId: str(s.id), name: str(s.name) }));
  return { me: face(me), manager: face(manager), path, peers, team };
}

/* ── write merge ── */

type MergeCtx = { userId: string; owner: boolean; canEdit: boolean };

/**
 * The orgDesign blob is replaced only through this merge. Rows the caller may not change keep
 * their stored version; each refusal is named.
 */
export function mergeOrgDesignWrite(prior: Row, incoming: Row, ctx: MergeCtx) {
  const refused: { id: string; error: string }[] = [];
  const before = prior && typeof prior === "object" && !Array.isArray(prior) ? prior : {};
  const next = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {};
  if (!ctx.canEdit) return { payload: before, refused: [{ id: "*", error: "ORG_EDIT_HR_ONLY" }] };
  const priorChanges: Row[] = Array.isArray(before.changes) ? before.changes : [];
  const priorById = new Map(priorChanges.map((c) => [str(c.id), c]));
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const change of Array.isArray(next.changes) ? next.changes : []) {
    const id = str(change?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const old = priorById.get(id);
    if (old && str(old.status) === "published") {
      out.push(old);
      if (JSON.stringify(old) !== JSON.stringify(change)) refused.push({ id, error: "ORG_DECISION_IMMUTABLE" });
      continue;
    }
    const status = str(change.status);
    const decided = status === "approved" || status === "rejected" || status === "published";
    const newlyDecided = decided && (!old || !["approved", "rejected", "published"].includes(str(old.status)));
    if (newlyDecided && (status === "approved" || status === "rejected")) {
      if (str(change.createdById) === str(ctx.userId) && !ctx.owner) {
        if (old) out.push(old);
        refused.push({ id, error: "ORG_CHANGE_SELF_APPROVE" });
        continue;
      }
      if (str(change.approvedById) !== str(ctx.userId)) {
        out.push({ ...change, approvedById: str(ctx.userId) });
        continue;
      }
    }
    if (status === "published" && (!old || str(old.status) !== "approved")) {
      // approved and published in one sync: the approval must be the caller's and not the author's
      const approver = str(change.approvedById);
      const valid = approver === str(ctx.userId) && (approver !== str(change.createdById) || ctx.owner);
      if (!valid) {
        if (old) out.push(old);
        refused.push({ id, error: "ORG_PUBLISH_NEEDS_APPROVAL" });
        continue;
      }
    }
    out.push(change);
  }
  // a published decision is never deleted
  for (const old of priorChanges) {
    if (!seen.has(str(old.id)) && str(old.status) === "published") {
      out.push(old);
      refused.push({ id: str(old.id), error: "ORG_DECISION_IMMUTABLE" });
    }
  }
  const doa = (Array.isArray(next.doa) ? next.doa : []).filter((row: Row) => {
    if (DOA_FORBIDDEN_KINDS.includes(str(row?.kind)) || !DOA_KINDS.includes(str(row?.kind))) {
      refused.push({ id: str(row?.id), error: DOA_FORBIDDEN_KINDS.includes(str(row?.kind)) ? "DOA_VOICE_NEVER_MANAGER" : "DOA_KIND" });
      return false;
    }
    return true;
  });
  const settings = next.settings && typeof next.settings === "object" ? next.settings : (before.settings || {});
  return { payload: { ...before, ...next, settings, doa, changes: out }, refused };
}
