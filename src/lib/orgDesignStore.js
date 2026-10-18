/**
 * Org design writes — every mutator runs its named gate first, then writes the existing bags
 * (orgSeats / stations / orgDesign) through updateCompany. The server re-checks orgDesign writes
 * in companyDirectory.syncBlob → mergeOrgDesignWrite.
 *
 * A published change is a signed org decision: sealed (content hash + NV-ORG seal), logged in the
 * structure history and the audit trail, and kept with its inverse so the chart can be read as of
 * any date. A filled seat that moves branch goes through the existing employee transfer (Art. 58
 * consent / necessity, station history, notices) — never a silent station rewrite.
 */
import { addNotification, getCompanyData, logAudit, updateCompany } from "@/lib/store";
import { appendOrgStructureEvent } from "@/lib/orgStructureLog";
import { applyWorkplaceManagerRule } from "@/lib/peopleTreeGraph";
import { transferEmployeeBetweenStations } from "@/lib/employeeStationTransfer";
import {
  actingReminders,
  activePeople,
  applyOrgChange,
  canEditOrgDesign,
  checkChangeTransitionGate,
  checkDoaRowGate,
  checkOrgChangeGate,
  checkOrgSettingsGate,
  dueChanges,
  orgDesignOf,
  sealOrgDecision,
  seatHolder,
  todayKey,
} from "@/lib/orgDesign";

const str = (v) => String(v ?? "").trim();

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const HR_ONLY = {
  ok: false,
  error: "ORG_EDIT_HR_ONLY",
  reason: "تصميم الهيكل للمالك والموارد البشرية.",
  reasonEn: "Structure design is for the owner and HR.",
};

function ensureDesign(data) {
  const current = data.orgDesign && typeof data.orgDesign === "object" && !Array.isArray(data.orgDesign) ? data.orgDesign : {};
  data.orgDesign = {
    ...current,
    settings: { ...(current.settings || {}) },
    doa: Array.isArray(current.doa) ? current.doa : [],
    changes: Array.isArray(current.changes) ? current.changes : [],
  };
  return data.orgDesign;
}

function guard(companyId, actor) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: false, error: "MISSING", reason: "الشركة غير محمّلة.", reasonEn: "Company not loaded." };
  if (!canEditOrgDesign(actor, data)) return HR_ONLY;
  return { ok: true, data };
}

/* ── thresholds ── */

export function saveOrgDesignSettings(companyId, actor, input) {
  const g = guard(companyId, actor);
  if (!g.ok) return g;
  const gate = checkOrgSettingsGate(input);
  if (!gate.ok) return gate;
  updateCompany(companyId, (d) => {
    ensureDesign(d).settings = gate.settings;
  });
  logAudit(companyId, "org.settings", `Org thresholds → ${JSON.stringify(gate.settings)}`);
  return { ok: true };
}

/* ── seat attributes (not structural) ── */

const SEAT_FIELDS = ["code", "qiwaTitle", "saudiOnly", "deputySeatId", "dottedToSeatId", "state", "plannedFrom"];

export function checkSeatDesignGate(data, seatId, patch = {}) {
  const seats = Array.isArray(data?.orgSeats) ? data.orgSeats : [];
  const seat = seats.find((s) => str(s.id) === str(seatId));
  if (!seat) return { ok: false, error: "ORG_SEAT_NOT_FOUND", reason: "المنصب غير موجود.", reasonEn: "Seat not found." };
  if (patch.code !== undefined && str(patch.code)) {
    const taken = seats.some((s) => str(s.id) !== str(seat.id) && str(s.code).toUpperCase() === str(patch.code).toUpperCase());
    if (taken) return { ok: false, error: "ORG_SEAT_CODE_TAKEN", reason: "رمز المنصب مستخدم لمنصب آخر.", reasonEn: "That seat code is used by another seat." };
  }
  if (patch.deputySeatId !== undefined && str(patch.deputySeatId)) {
    if (str(patch.deputySeatId) === str(seat.id)) return { ok: false, error: "ORG_DEPUTY_SELF", reason: "لا يكون المنصب نائب نفسه.", reasonEn: "A seat cannot deputise for itself." };
    if (!seats.some((s) => str(s.id) === str(patch.deputySeatId))) return { ok: false, error: "ORG_SEAT_NOT_FOUND", reason: "منصب النائب غير موجود.", reasonEn: "Deputy seat not found." };
  }
  if (patch.dottedToSeatId !== undefined && str(patch.dottedToSeatId)) {
    const to = str(patch.dottedToSeatId);
    if (to === str(seat.id)) return { ok: false, error: "ORG_DOTTED_SELF", reason: "لا يتبع المنصب نفسه.", reasonEn: "A seat cannot dot-line to itself." };
    const seen = new Set([str(seat.id)]);
    let cursor = seats.find((s) => str(s.id) === to);
    if (!cursor) return { ok: false, error: "ORG_SEAT_NOT_FOUND", reason: "المنصب المرجع غير موجود.", reasonEn: "Reference seat not found." };
    while (cursor) {
      if (seen.has(str(cursor.id))) return { ok: false, error: "ORG_CYCLE", reason: "الخط المنقّط يصنع حلقة تبعية.", reasonEn: "The dotted line makes a loop." };
      seen.add(str(cursor.id));
      const next = str(cursor.dottedToSeatId);
      cursor = next ? seats.find((s) => str(s.id) === next) : null;
    }
  }
  if (patch.state !== undefined) {
    const state = str(patch.state);
    if (state && !["frozen", "planned"].includes(state)) return { ok: false, error: "ORG_SEAT_STATE", reason: "حالة المنصب غير معروفة.", reasonEn: "Unknown seat state." };
    if (state && seatHolder(data, seat)) return { ok: false, error: "ORG_SEAT_FILLED", reason: "المنصب مشغول — حالته «مشغول» مشتقة من شاغله.", reasonEn: "The seat is filled — its state follows the holder." };
    if (state === "planned" && patch.plannedFrom && !/^\d{4}-\d{2}-\d{2}$/.test(str(patch.plannedFrom))) {
      return { ok: false, error: "ORG_PLANNED_DATE", reason: "تاريخ بدء المنصب المخطط غير صالح.", reasonEn: "Invalid planned start date." };
    }
  }
  return { ok: true, seat };
}

export function patchSeatDesign(companyId, actor, seatId, patch = {}) {
  const g = guard(companyId, actor);
  if (!g.ok) return g;
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => SEAT_FIELDS.includes(k)));
  const gate = checkSeatDesignGate(g.data, seatId, clean);
  if (!gate.ok) return gate;
  updateCompany(companyId, (d) => {
    const seat = (d.orgSeats || []).find((s) => str(s.id) === str(seatId));
    if (!seat) return;
    Object.entries(clean).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined || value === false) delete seat[key];
      else seat[key] = typeof value === "string" ? value.trim() : value;
    });
  });
  logAudit(companyId, "org.seat", `Seat ${seatId} → ${JSON.stringify(clean)}`);
  return { ok: true };
}

export function setUnitBudget(companyId, actor, stationId, budget) {
  const g = guard(companyId, actor);
  if (!g.ok) return g;
  const raw = str(budget);
  const n = Number(raw);
  if (raw && (!Number.isInteger(n) || n < 0 || n > 100000)) {
    return { ok: false, error: "ORG_BUDGET", reason: "الميزانية عدد صحيح موجب.", reasonEn: "The budget must be a whole positive number." };
  }
  updateCompany(companyId, (d) => {
    const station = (d.stations || []).find((s) => str(s.id) === str(stationId));
    if (!station) return;
    if (!raw) delete station.headcountBudget;
    else station.headcountBudget = n;
  });
  logAudit(companyId, "org.budget", `Unit ${stationId} headcount budget → ${raw || "none"}`);
  return { ok: true };
}

/* ── delegation of authority ── */

export function upsertDoaRow(companyId, actor, row = {}) {
  const g = guard(companyId, actor);
  if (!g.ok) return g;
  const next = {
    id: str(row.id) || uid("doa"),
    kind: str(row.kind),
    unitId: str(row.unitId) || null,
    approverSeatId: str(row.approverSeatId),
    limit: str(row.limit) === "" || row.limit == null ? null : Number(row.limit),
    escalateToSeatId: str(row.escalateToSeatId) || null,
    note: str(row.note).slice(0, 200) || null,
  };
  const gate = checkDoaRowGate(next, g.data);
  if (!gate.ok) return gate;
  updateCompany(companyId, (d) => {
    const design = ensureDesign(d);
    const at = design.doa.findIndex((r) => str(r.id) === next.id);
    const stamped = { ...next, updatedAt: new Date().toISOString(), updatedBy: actor?.name || "" };
    if (at >= 0) design.doa[at] = { ...design.doa[at], ...stamped };
    else design.doa.push(stamped);
  });
  logAudit(companyId, "org.doa", `DoA ${next.kind} → seat ${next.approverSeatId}${next.limit != null ? ` ≤ ${next.limit}` : ""}`);
  return { ok: true, id: next.id };
}

export function removeDoaRow(companyId, actor, id) {
  const g = guard(companyId, actor);
  if (!g.ok) return g;
  updateCompany(companyId, (d) => {
    const design = ensureDesign(d);
    design.doa = design.doa.filter((r) => str(r.id) !== str(id));
  });
  logAudit(companyId, "org.doa.remove", `DoA row ${id} removed`);
  return { ok: true };
}

/* ── org change requests ── */

export function saveOrgChangeDraft(companyId, actor, draft = {}) {
  const g = guard(companyId, actor);
  if (!g.ok) return g;
  const existing = orgDesignOf(g.data).changes.find((c) => str(c.id) === str(draft.id));
  if (existing && !["draft", "rejected"].includes(str(existing.status))) {
    return { ok: false, error: "ORG_CHANGE_LOCKED", reason: "التغيير بعد الإرسال لا يُعدَّل — أعده إلى مسودة أولاً.", reasonEn: "A submitted change is locked — return it to draft first." };
  }
  const id = existing?.id || uid("orgchg");
  const row = {
    ...(existing || {}),
    id,
    title: str(draft.title).slice(0, 120),
    reason: str(draft.reason).slice(0, 600),
    effectiveDate: str(draft.effectiveDate).slice(0, 10),
    ops: Array.isArray(draft.ops) ? draft.ops.map((op) => ({ ...op })) : [],
    status: "draft",
    createdById: existing?.createdById || str(actor?.id),
    createdBy: existing?.createdBy || actor?.name || "",
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  updateCompany(companyId, (d) => {
    const design = ensureDesign(d);
    const at = design.changes.findIndex((c) => str(c.id) === id);
    if (at >= 0) design.changes[at] = row;
    else design.changes.unshift(row);
  });
  return { ok: true, id };
}

function publishInto(companyId, actor, change, today) {
  const data = getCompanyData(companyId);
  const gate = checkOrgChangeGate(data, change, { today });
  if (!gate.ok) return gate;
  // the inverse is taken against the structure as it stands before publication
  const before = JSON.parse(JSON.stringify(data));
  const inverse = applyOrgChange(before, change);
  const transferOps = [];
  const directOps = [];
  (change.ops || []).forEach((op) => {
    const seat = op.type === "moveSeat" ? (data.orgSeats || []).find((s) => str(s.id) === str(op.seatId)) : null;
    const holder = seat ? seatHolder(data, seat) : null;
    if (holder) transferOps.push({ op, holder });
    else directOps.push(op);
  });
  // Segregation of duties (transfer gate): nobody publishes the move of their own seat.
  const own = transferOps.find(({ holder }) => str(holder.id) === str(actor?.id));
  if (own) {
    return {
      ok: false,
      error: "SELF_TRANSFER_FORBIDDEN",
      reason: "فصل المهام: التغيير ينقل منصبك أنت — ينشره مسؤول آخر.",
      reasonEn: "Segregation of duties: this change moves your own seat — another HR member publishes it.",
    };
  }
  for (const { op, holder } of transferOps) {
    const res = transferEmployeeBetweenStations(companyId, {
      employeeId: holder.id,
      toStationId: op.toStationId,
      reasonCode: "restructure",
      effectiveDate: change.effectiveDate,
      note: change.title,
      actor,
      residence: op.residence,
      necessityUntil: op.necessityUntil,
    });
    if (!res.ok) return res;
  }
  const at = new Date().toISOString();
  const decision = sealOrgDecision(change, { companyId, by: actor?.name || "", byId: str(actor?.id), at });
  updateCompany(companyId, (d) => {
    if (directOps.length) applyOrgChange(d, { ...change, ops: directOps });
    applyWorkplaceManagerRule(d);
    const design = ensureDesign(d);
    const row = design.changes.find((c) => str(c.id) === str(change.id));
    if (row) {
      row.status = "published";
      row.publishedAt = at;
      row.publishedBy = actor?.name || "";
      row.publishedById = str(actor?.id);
      row.inverse = inverse;
      row.decision = decision;
      delete row.publishBlocked;
    }
    appendOrgStructureEvent(d, {
      type: "decision",
      to: decision.seal,
      toName: change.title,
      until: change.effectiveDate,
    });
  });
  logAudit(companyId, "org.decision", `Org decision ${decision.seal} — ${change.title} (effective ${change.effectiveDate}) hash ${decision.hash}`, {
    reason: change.reason,
    newValue: decision.seal,
  });
  return { ok: true, decision };
}

export function transitionOrgChange(companyId, actor, changeId, next, { note = "", today = todayKey() } = {}) {
  const data = getCompanyData(companyId);
  const change = orgDesignOf(data).changes.find((c) => str(c.id) === str(changeId));
  if (!change) return { ok: false, error: "ORG_CHANGE_NOT_FOUND", reason: "التغيير غير موجود.", reasonEn: "Change not found." };
  const gate = checkChangeTransitionGate(change, next, { actor, data, today, note });
  if (!gate.ok) return gate;
  if (next === "published") return publishInto(companyId, actor, change, today);
  const at = new Date().toISOString();
  updateCompany(companyId, (d) => {
    const row = ensureDesign(d).changes.find((c) => str(c.id) === str(changeId));
    if (!row) return;
    row.status = next;
    if (next === "pending") {
      row.submittedAt = at;
      row.submittedBy = actor?.name || "";
    }
    if (next === "approved") {
      row.approvedAt = at;
      row.approvedBy = actor?.name || "";
      row.approvedById = str(actor?.id);
    }
    if (next === "rejected") {
      row.rejectedAt = at;
      row.rejectedBy = actor?.name || "";
      row.rejectReason = str(note).slice(0, 400);
    }
    if (next === "cancelled") row.cancelledAt = at;
  });
  logAudit(companyId, `org.change.${next}`, `Org change ${change.title} → ${next}`, { reason: note || null });
  if (next === "approved" && str(change.effectiveDate).slice(0, 10) <= today) {
    const fresh = orgDesignOf(getCompanyData(companyId)).changes.find((c) => str(c.id) === str(changeId));
    return publishInto(companyId, actor, fresh, today);
  }
  return { ok: true };
}

/** Approved changes whose effective date has come are published by the first editor session. */
export function publishDueOrgChanges(companyId, actor, today = todayKey()) {
  const data = getCompanyData(companyId);
  if (!data || !canEditOrgDesign(actor, data)) return [];
  const results = [];
  for (const change of dueChanges(data, today)) {
    const res = publishInto(companyId, actor, change, today);
    if (!res.ok) {
      updateCompany(companyId, (d) => {
        const row = ensureDesign(d).changes.find((c) => str(c.id) === str(change.id));
        if (row) row.publishBlocked = { error: res.error, reason: res.reason, reasonEn: res.reasonEn, at: today };
      });
    }
    results.push({ id: change.id, ...res });
  }
  return results;
}

/** Monthly-deduplicated notices for acting roles that end soon or ran over the limit. */
export function notifyActingReminders(companyId, actor, today = todayKey()) {
  const data = getCompanyData(companyId);
  if (!data || !canEditOrgDesign(actor, data)) return 0;
  const editors = activePeople(data).filter((e) => canEditOrgDesign(e, data));
  let sent = 0;
  for (const row of actingReminders(data, today)) {
    const targets = new Set(editors.map((e) => str(e.id)));
    if (row.kind === "ACTING_ENDING" && row.employeeId) targets.add(row.employeeId);
    for (const id of targets) {
      addNotification(companyId, id, row.ar, { key: row.key, to: "/app/hr?tab=org&pane=health" });
      sent += 1;
    }
  }
  return sent;
}
