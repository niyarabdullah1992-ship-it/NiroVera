// deno-lint-ignore-file no-explicit-any
// Backend copy of src/lib/uniformPolicy.js — keep the two in step (scripts/test-discipline-model.mjs).
/**
 * Staff uniform rules — unified model regulation Art. 53(1) (Annex 1, decision 115921):
 *   the establishment sets the uniform requirements for its staff, women and men:
 *   أ. not contrary to Sharia; ب. a decent professional look fit for the worker's tasks;
 *   ج. modest and not transparent; د. the penalties for breaching them;
 *   هـ. announced separately in a visible place, or by any means that ensures those bound know
 *       them, and their acknowledgement that they know them.
 *
 * The rules live beside the work regulation (workRegulation.uniform) and reuse its announcement and
 * acknowledgement mechanism: a saved version is announced, each worker acknowledges that version, and
 * a new version needs fresh acknowledgements. A uniform breach is sanctionable only for a worker who
 * acknowledged the announced rules. Pure; the client copy is src/lib/uniformPolicy.js.
 */

export const UNIFORM_CRITERIA = [
  { key: "sharia", para: "أ", ar: "لا تتعارض مع الأحكام الشرعية", en: "Not contrary to Sharia" },
  { key: "professional", para: "ب", ar: "مظهر مهني لائق يتناسب مع مهام العامل", en: "A decent professional look fit for the tasks" },
  { key: "modest", para: "ج", ar: "محتشم وغير شفاف", en: "Modest and not transparent" },
];

/** The model regulation's uniform clause (conduct 16) — or an own clause that names the uniform. */
export const UNIFORM_CLAUSE_ID = "conduct_16";
const UNIFORM_RE = /الزي|زي رسمي|uniform/i;

const dateOnly = (v: unknown): string => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};
const versionOf = (uniform: any): string => String(uniform?.version || uniform?.savedAt || "").slice(0, 19);

export function uniformOf(data: any) {
  const u = data?.workRegulation?.uniform;
  return u && typeof u === "object" ? u : null;
}

/** Before saving a version: the rules written, the three criteria confirmed, the penalties stated. */
export function checkSaveUniformGate(draft: any = {}): any {
  if (String(draft.rules || "").trim().length < 20) {
    return { ok: false, error: "UNIFORM_RULES_REQUIRED", reason: "اكتب اشتراطات الزي للعاملين نساءً ورجالاً (النموذج الموحد م53/1).", reasonEn: "Write the uniform rules for women and men (model Art. 53(1))." };
  }
  const missing = UNIFORM_CRITERIA.filter((row: any) => draft.criteria?.[row.key] !== true);
  if (missing.length) {
    return { ok: false, error: "UNIFORM_CRITERIA", reason: `أكّد أن الاشتراطات تستوفي: ${missing.map((row: any) => `(${row.para}) ${row.ar}`).join("، ")} (م53/1).`, reasonEn: "Confirm the rules meet each Art. 53(1) criterion." };
  }
  if (String(draft.sanctions || "").trim().length < 10) {
    return { ok: false, error: "UNIFORM_SANCTIONS_REQUIRED", reason: "اذكر العقوبات المترتبة على مخالفة الاشتراطات (م53/1/د) — من بنود لائحة تنظيم العمل.", reasonEn: "State the penalties for breaching the rules (Art. 53(1)(d))." };
  }
  return { ok: true };
}

/** none — no rules saved · draft — saved, not announced · announced — published to the workers. */
export function uniformStanding(uniform: any): any {
  if (!uniform || !String(uniform.rules || "").trim()) return { id: "none" };
  if (!dateOnly(uniform.announcedAt)) return { id: "draft", version: versionOf(uniform) };
  return { id: "announced", version: versionOf(uniform), announcedAt: dateOnly(uniform.announcedAt) };
}

export function uniformAckOf(uniform: any, employeeId: unknown) {
  const row = uniform?.acks?.[String(employeeId || "")];
  if (!row) return null;
  const version = versionOf(uniform);
  return !version || String(row.version || "").slice(0, 19) === version ? row : null;
}

/** Who acknowledged the announced version, who has not (active staff). */
export function uniformAckStatus(uniform: any, employees: any[] = []) {
  const active = (employees || []).filter((e: any) => e && e.id && !e.archived && !e.terminatedAt && e.status !== "terminated");
  const acked = active.filter((e: any) => uniformAckOf(uniform, e.id));
  return { version: versionOf(uniform), acked, pending: active.filter((e: any) => !uniformAckOf(uniform, e.id)), total: active.length };
}

export function planUniformAck(uniform: any, employee: any, now = new Date().toISOString()): any {
  if (uniformStanding(uniform).id !== "announced") {
    return { ok: false, error: "UNIFORM_NOT_ANNOUNCED", reason: "لم تُعلَن اشتراطات الزي بعد.", reasonEn: "The uniform rules are not announced yet." };
  }
  if (!employee?.id) return { ok: false, error: "EMPLOYEE_REQUIRED", reason: "الإقرار مربوط بموظف.", reasonEn: "The acknowledgement is tied to an employee." };
  return { ok: true, employeeId: employee.id, ack: { at: now, version: versionOf(uniform), name: employee.name || "" } };
}

/** Is this sanction case (or the clause picked for it) a uniform breach? */
export function isUniformCase({ clauseId, clause, row }: any = {}) {
  const id = String(clauseId || row?.regulationClauseId || clause?.id || "");
  if (id === UNIFORM_CLAUSE_ID) return true;
  const text = `${clause?.ar || ""} ${clause?.en || ""} ${row?.regulationOffence || ""}`;
  return UNIFORM_RE.test(text);
}

/**
 * Model Art. 53(1)(هـ): a uniform breach is sanctioned only after the rules were announced and the
 * worker acknowledged the version in force. Not a uniform case → passes untouched.
 */
export function checkUniformSanctionGate({ uniform, employeeId, clauseId, clause, row }: any = {}) {
  if (!isUniformCase({ clauseId, clause, row })) return { ok: true, uniform: false };
  const standing = uniformStanding(uniform);
  if (standing.id !== "announced") {
    return {
      ok: false,
      error: "UNIFORM_NOT_PUBLISHED",
      reason: "موقوف — لا جزاء على مخالفة الزي قبل وضع اشتراطاته وإعلانها على حدة في مكان ظاهر (النموذج الموحد م53/1/هـ).",
      reasonEn: "Blocked — no uniform penalty before the uniform rules are set and announced separately (model Art. 53(1)(e)).",
    };
  }
  if (!uniformAckOf(uniform, employeeId)) {
    return {
      ok: false,
      error: "UNIFORM_NOT_ACKNOWLEDGED",
      reason: "موقوف — العامل لم يُقرّ بالعلم بإصدار اشتراطات الزي الساري، ولا جزاء قبل إقراره (النموذج الموحد م53/1/هـ).",
      reasonEn: "Blocked — the worker has not acknowledged the uniform rules in force; no penalty before he does (model Art. 53(1)(e)).",
    };
  }
  return { ok: true, uniform: true };
}

/**
 * Server merge of the uniform sub-record inside workRegulation: senior HR saves / announces a version;
 * anyone adds only his own acknowledgement of the announced current version; acks are never dropped.
 */
export function mergeUniformWrite(existingRaw: any, incomingRaw: any, { senior = false, actorId = "", actorName = "", now = new Date().toISOString() }: any = {}) {
  const existing = existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw) ? existingRaw : null;
  const incoming = incomingRaw && typeof incomingRaw === "object" && !Array.isArray(incomingRaw) ? incomingRaw : null;
  if (!incoming) return existing;
  let next: any = existing;
  if (senior && checkSaveUniformGate(incoming).ok) {
    const sameVersion = existing && versionOf(existing) === versionOf(incoming);
    const { acks: _a, ...body } = incoming;
    next = sameVersion
      ? { ...existing, ...body, announcedAt: existing.announcedAt || body.announcedAt || "", announcedBy: existing.announcedAt ? existing.announcedBy || "" : body.announcedBy || "", acks: existing.acks || {} }
      : { ...body, acks: {} };
  }
  const id = String(actorId || "");
  const mine = incoming.acks?.[id];
  if (next && id && mine && dateOnly(next.announcedAt) && !uniformAckOf(next, id) && String(mine.version || "").slice(0, 19) === versionOf(next)) {
    next = { ...next, acks: { ...(next.acks || {}), [id]: { at: now, version: versionOf(next), name: String(actorName || mine.name || ""), stampedBy: "server" } } };
  }
  return next;
}
