import { addNotification, getCompanyData, logAudit, updateCompany } from "@/lib/store";
import { checkSafetyDecisionGate, safetyReporterNotice } from "@/lib/safetyBranchVisibility";
import { checkHazardCloseGate } from "@/lib/hseDerivations";
import { buildSafetyReportCard } from "@/lib/safetyReportCard";
import { readSafety } from "@/lib/facts";
import {
  checkInspectionGate,
  checkInvestigationGate,
  checkPermitActionGate,
  checkPermitIssueGate,
  inspectionFindings,
  inspectionItems,
  inspectionScore,
  permitCode,
  riyadhLocalMs,
} from "@/lib/safetyOps";

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
const stationExists = (data, stationId) => (data?.stations || []).some((station) => station.id === stationId);
const dayKey = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const normalize = (value) => String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function updateSafetyRecord(companyId, stationId, updates, actorName = "") {
  updateCompany(companyId, (data) => {
    if (!stationExists(data, stationId)) return;
    data.safety = readSafety(data);
    let rec = data.safety.find((item) => item.stationId === stationId);
    if (!rec) {
      rec = { id: uid("safe"), stationId, hazards: [], level: null, riskItems: [], dailyHours: [], ltiEntries: [], checklistResults: {}, permits: [], disabledTabs: [], createdAt: new Date().toISOString() };
      data.safety.push(rec);
    }
    const next = { ...updates };
    if (next.riskItems && !Array.isArray(next.riskItems)) delete next.riskItems;
    if (next.dailyHours) next.dailyHours = Array.isArray(next.dailyHours) ? next.dailyHours.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item?.date)).map((item) => ({ date: item.date, hours: Math.max(0, Number(item.hours) || 0) })) : [];
    if (next.ltiEntries) next.ltiEntries = Array.isArray(next.ltiEntries) ? next.ltiEntries.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item?.date)).map((item) => ({ date: item.date, ...(String(item.description || "").trim() ? { description: String(item.description).trim() } : {}) })) : [];
    if (next.permits && !Array.isArray(next.permits)) delete next.permits;
    if (next.disabledTabs) next.disabledTabs = Array.isArray(next.disabledTabs) ? [...new Set(next.disabledTabs.filter((key) => ["risks", "kpis", "checklist", "permits"].includes(key)))] : [];
    if (next.checklistResults && typeof next.checklistResults !== "object") delete next.checklistResults;
    if ("workHoursMonthly" in next) next.workHoursMonthly = Math.max(0, Number(next.workHoursMonthly) || 0);
    if ("ltiCount" in next) next.ltiCount = Math.max(0, Math.floor(Number(next.ltiCount) || 0));
    if (next.lastInspection && new Date(next.lastInspection) > new Date()) delete next.lastInspection;
    if (next.level && !["green", "amber", "red"].includes(next.level)) delete next.level;
    Object.assign(rec, next);
    if (actorName) {
      rec.lastActionBy = actorName;
      rec.lastActionAt = new Date().toISOString();
    }
    if ("dailyHours" in next) delete rec.workHoursMonthly;
    if ("ltiEntries" in next) delete rec.ltiCount;
    if ("level" in next || "lastInspection" in next || "hazards" in next) {
      rec.approvedBy = null;
      rec.approvedAt = null;
    }
    const inspectionEnd = rec.lastInspection ? new Date(rec.lastInspection).setHours(23, 59, 59, 999) : 0;
    const incidentUnreviewed = rec.lastIncidentAt && inspectionEnd < new Date(rec.lastIncidentAt).getTime();
    if (rec.level === "green" && ((rec.hazards || []).length || incidentUnreviewed)) rec.level = "amber";
  });
}

export function closeSafetyHazard(companyId, stationId, hazardIndex, closedBy, opts = {}) {
  const data = getCompanyData(companyId);
  const recPeek = (data?.safety || []).find((item) => item.stationId === stationId);
  const rawPeek = recPeek?.hazards?.[hazardIndex];
  const existingBefore = typeof rawPeek === "object" && rawPeek ? rawPeek.beforePhoto : null;
  const beforePhoto = opts.beforePhoto || existingBefore || null;
  const afterPhoto = opts.afterPhoto || null;

  const gate = checkHazardCloseGate({
    controlId: opts.controlId,
    likelihood: opts.likelihood ?? 3,
    severity: opts.severity ?? 3,
    inherent: opts.inherent,
    beforePhoto,
    afterPhoto,
  });
  if (!gate.ok) return { ok: false, ...gate };

  let closed = null;
  updateCompany(companyId, (current) => {
    const rec = (current.safety || []).find((item) => item.stationId === stationId);
    if (!rec || hazardIndex < 0 || hazardIndex >= (rec.hazards || []).length) return;
    const [raw] = rec.hazards.splice(hazardIndex, 1);
    const description = typeof raw === "string" ? raw : raw?.description || raw?.title || String(raw);
    const openedAt = typeof raw === "object" ? raw.openedAt || null : null;
    const closedAt = new Date().toISOString();
    const openMs = openedAt ? Math.max(0, new Date(closedAt).getTime() - new Date(openedAt).getTime()) : null;
    closed = {
      id: typeof raw === "object" && raw?.id ? raw.id : uid("haz"),
      description,
      controlId: gate.controlId,
      inherent: gate.inherent,
      residual: gate.residual,
      beforePhoto,
      afterPhoto,
      openedAt,
      openedBy: typeof raw === "object" ? raw.openedBy || "" : "",
      openDurationMs: openMs,
      closedBy,
      closedAt,
      sealId: `NV-HSE-${uid("seal").slice(-6).toUpperCase()}`,
    };
    rec.hazardLog = rec.hazardLog || [];
    rec.hazardLog.unshift(closed);
    rec.lastActionBy = closedBy;
    rec.lastActionAt = new Date().toISOString();
    rec.approvedBy = null;
    rec.approvedAt = null;
  });
  if (!closed) return { ok: false, error: "HAZARD_NOT_FOUND" };
  return { ok: true, closed, gate };
}

export function approveSafetyRecord(companyId, stationId, approvedBy) {
  let approved = false;
  let blocked = null;
  updateCompany(companyId, (data) => {
    if (!stationExists(data, stationId)) return;
    data.safety = readSafety(data);
    let rec = data.safety.find((item) => item.stationId === stationId);
    if (!rec) {
      rec = { id: uid("safe"), stationId, hazards: [], level: null, riskItems: [], dailyHours: [], ltiEntries: [], checklistResults: {}, permits: [], disabledTabs: [], createdAt: new Date().toISOString() };
      data.safety.push(rec);
    }
    if ((rec.hazards || []).length) {
      blocked = {
        error: "OPEN_HAZARDS",
        reason: `لا يمكن الاعتماد — ${rec.hazards.length} مخاطر مفتوحة.`,
        reasonEn: `Cannot approve — ${rec.hazards.length} open hazards.`,
      };
      return;
    }
    const at = new Date().toISOString();
    rec.approvedBy = approvedBy;
    rec.approvedAt = at;
    rec.lastActionBy = approvedBy;
    rec.lastActionAt = at;
    rec.incidentClearedAt = at;
    rec.approvalLog = [{ by: approvedBy, at }, ...(rec.approvalLog || [])];
    rec.incidentLog = (rec.incidentLog || []).map((incident) => incident.status === "closed" ? incident : { ...incident, status: "closed", reviewedBy: approvedBy, reviewedAt: at });
    rec.approvalSnapshot = {
      level: rec.level,
      lastInspection: rec.lastInspection,
      hazards: [...(rec.hazards || [])],
      incidentCount: (rec.incidentLog || []).length,
      checklistResults: JSON.parse(JSON.stringify(rec.checklistResults || {})),
      approvedAt: at,
    };
    approved = true;
  });
  if (blocked) return { ok: false, ...blocked };
  return { ok: approved };
}

export function revokeSafetyApproval(companyId, stationId, revokedBy) {
  let revoked = false;
  updateCompany(companyId, (data) => {
    const rec = readSafety(data).find((item) => item.stationId === stationId);
    const approvedAt = new Date(rec?.approvedAt).getTime();
    const elapsed = Date.now() - approvedAt;
    if (!rec?.approvedBy || !Number.isFinite(approvedAt) || elapsed < 0 || elapsed > 24 * 60 * 60 * 1000) return;
    rec.approvalRevocationLog = [{ by: revokedBy, at: new Date().toISOString(), approvalAt: rec.approvedAt }, ...(rec.approvalRevocationLog || [])];
    rec.lastActionBy = revokedBy;
    rec.lastActionAt = new Date().toISOString();
    rec.approvedBy = null;
    rec.approvedAt = null;
    rec.approvalSnapshot = null;
    revoked = true;
  });
  return revoked;
}

export function patchSafetyIncident(companyId, stationId, incidentId, patch, actorName = "") {
  if (!incidentId || !patch || typeof patch !== "object") return false;
  let saved = false;
  updateCompany(companyId, (data) => {
    const rec = readSafety(data).find((item) => item.stationId === stationId);
    const index = (rec?.incidentLog || []).findIndex((item) => item.id === incidentId);
    if (!rec || index < 0) return;
    const current = rec.incidentLog[index];
    const next = { ...current, card: current.card ? { ...current.card } : current.card };
    const now = new Date().toISOString();
    if (patch.escalate) {
      next.escalated = true;
      next.escalatedAt = now;
      next.escalatedBy = actorName;
      next.step = Math.max(Number(next.step) || 0, 1);
    }
    if (patch.approveAction) {
      next.actionApprovedBy = actorName;
      next.actionApprovedAt = now;
      next.step = Math.max(Number(next.step) || 0, 2);
    }
    if (patch.afterPhotoName) {
      const name = String(patch.afterPhotoName || "").trim().slice(0, 180);
      if (!name) return;
      next.afterPhoto = { name, at: now };
      next.status = "closed";
      next.step = 3;
      next.reviewedBy = actorName;
      next.reviewedAt = now;
    }
    rec.incidentLog[index] = next;
    if (next.card) next.card.step = next.step;
    rec.lastActionBy = actorName;
    rec.lastActionAt = now;
    saved = true;
  });
  return saved;
}

/**
 * One manager decision on a safety card (the طلباتي الإدارة composer): assign · action · close · escalate.
 * The gate names its refusal; each decision is written on the card's audit trail and the reporter is told
 * by the card's number (an anonymous reporter too, by his stored id — his name is never shown).
 * decision: { action, note, assignee: { id, name }, afterPhotoName, controlId }; actor: { id, name }.
 */
export function decideSafetyCard(companyId, stationId, incidentId, decision = {}, actor = {}, lang = "ar") {
  const data = getCompanyData(companyId);
  const rec = readSafety(data).find((item) => item.stationId === stationId);
  const current = (rec?.incidentLog || []).find((item) => item.id === incidentId);
  const action = decision.action;
  const gate = checkSafetyDecisionGate({ item: current, action, actor, note: decision.note, assignee: decision.assignee, afterPhotoName: decision.afterPhotoName });
  if (!gate.ok) return gate;
  const now = new Date().toISOString();
  const by = String(actor.name || "");
  const note = String(decision.note || "").trim().slice(0, 600);
  let saved = null;
  updateCompany(companyId, (draft) => {
    const record = readSafety(draft).find((item) => item.stationId === stationId);
    const index = (record?.incidentLog || []).findIndex((item) => item.id === incidentId);
    if (!record || index < 0) return;
    const next = { ...record.incidentLog[index], card: record.incidentLog[index].card ? { ...record.incidentLog[index].card } : record.incidentLog[index].card };
    const audit = Array.isArray(next.audit) ? [...next.audit] : [];
    if (action === "assign") {
      next.assignedTo = { id: String(decision.assignee.id), name: String(decision.assignee.name || ""), at: now, by };
      next.step = Math.max(Number(next.step) || 0, 1);
      audit.push({ type: "assign", at: now, by, note: next.assignedTo.name });
    }
    if (action === "action") {
      next.correctiveAction = { text: note, controlId: String(decision.controlId || ""), at: now, by };
      next.actionApprovedBy = by;
      next.actionApprovedAt = now;
      next.step = Math.max(Number(next.step) || 0, 2);
      audit.push({ type: "action", at: now, by, note });
    }
    if (action === "escalate") {
      next.escalated = true;
      next.escalationLevel = gate.nextLevel;
      next.escalatedAt = now;
      next.escalatedBy = by;
      next.step = Math.max(Number(next.step) || 0, 1);
      audit.push({ type: "escalate", at: now, by, note: note || String(gate.nextLevel) });
    }
    if (action === "close") {
      const photo = String(decision.afterPhotoName || "").trim().slice(0, 180);
      if (photo) next.afterPhoto = { name: photo, at: now };
      next.status = "closed";
      next.closeReason = note;
      next.closedAt = now;
      next.step = 3;
      next.reviewedBy = by;
      next.reviewedAt = now;
      audit.push({ type: "close", at: now, by, note });
    }
    next.audit = audit;
    if (next.card) next.card.step = next.step;
    record.incidentLog[index] = next;
    record.lastActionBy = by;
    record.lastActionAt = now;
    saved = next;
  });
  if (!saved) return { ok: false, error: "NOT_SAVED", reason: "تعذّر حفظ القرار.", reasonEn: "The decision was not saved." };
  const stationName = (data?.stations || []).find((station) => station.id === stationId)?.name || stationId;
  logAudit(companyId, `safety_card_${action}`, `Safety card ${saved.card?.code || saved.id} at "${stationName}" — ${action}${note ? `: ${note}` : ""}.`);
  const reporterId = String(current.reporterId || current.card?.reporterId || "");
  if (reporterId && reporterId !== String(actor.id || "")) {
    const text = safetyReporterNotice(action, saved, { lang, assigneeName: saved.assignedTo?.name || "", level: saved.escalationLevel || 0 });
    if (text) addNotification(companyId, reporterId, text, { to: "/app/safety", key: `safety-${saved.id}-${action}-${now}` });
  }
  return { ok: true, item: saved };
}

export function recordSafetyIncident(companyId, stationId, description, actorName = "", detail = null) {
  const card = buildSafetyReportCard(detail);
  const text = String((card?.what || description) || "").trim();
  const data = getCompanyData(companyId);
  if (!text || !stationExists(data, stationId)) return false;
  const existing = readSafety(data).find((item) => item.stationId === stationId);
  if ((existing?.incidentLog || []).some((item) => dayKey(item.at) === dayKey(new Date()) && normalize(item.description) === normalize(text))) return false;
  const stationName = data.stations.find((station) => station.id === stationId)?.name || stationId;
  const anonymous = Boolean(card?.anonymous);
  logAudit(companyId, "safety_incident_logged", `Safety incident logged at station "${stationName}" — ${text}.`);
  let saved = false;
  updateCompany(companyId, (current) => {
    current.safety = current.safety || [];
    let rec = current.safety.find((item) => item.stationId === stationId);
    if (!rec) {
      rec = { id: uid("safe"), stationId, hazards: [], level: null, riskItems: [], dailyHours: [], ltiEntries: [], checklistResults: {}, permits: [], disabledTabs: [], createdAt: new Date().toISOString() };
      current.safety.push(rec);
    }
    rec.lastIncidentAt = new Date().toISOString();
    rec.incidentLog = rec.incidentLog || [];
    rec.incidentLog.unshift({
      id: uid("inc"),
      description: text,
      at: rec.lastIncidentAt,
      by: anonymous ? "" : actorName,
      reporterId: card?.reporterId || "",
      anonymous,
      status: "open",
      step: 0,
      ...(card ? { card } : {}),
    });
    rec.lastActionBy = anonymous ? "" : actorName;
    rec.lastActionAt = rec.lastIncidentAt;
    rec.incidents = rec.incidentLog.length;
    if (!card?.positive) {
      if ((card?.score || 0) >= 15) rec.level = "red";
      else if (rec.level !== "red") rec.level = "amber";
      rec.approvedBy = null;
      rec.approvedAt = null;
    }
    saved = true;
  });
  return saved;
}
/* ───────────── Safety operations (management lane): permits · inspection rounds · investigations ───────────── */

function ensureRec(data, stationId) {
  data.safety = readSafety(data);
  let rec = data.safety.find((item) => item.stationId === stationId);
  if (!rec) {
    rec = { id: uid("safe"), stationId, hazards: [], level: null, riskItems: [], dailyHours: [], ltiEntries: [], checklistResults: {}, permits: [], disabledTabs: [], createdAt: new Date().toISOString() };
    data.safety.push(rec);
  }
  return rec;
}

/** Issue a permit to work after its named gate; the holder is told. */
export function issueSafetyPermit(companyId, draft = {}, actor = {}, lang = "ar") {
  const ar = lang === "ar";
  const gate = checkPermitIssueGate(draft);
  if (!gate.ok) return gate;
  const data = getCompanyData(companyId);
  if (!stationExists(data, draft.stationId)) return { ok: false, reason: "الفرع غير موجود.", reasonEn: "Branch not found." };
  const holder = (data.employees || []).find((row) => String(row.id) === String(draft.holderId));
  const now = new Date().toISOString();
  const permit = {
    id: permitCode(new Date()),
    type: draft.type,
    description: String(draft.description).trim().slice(0, 400),
    stationId: draft.stationId,
    holderId: String(draft.holderId),
    holderName: holder?.name || "",
    team: String(draft.team || "").trim().slice(0, 160),
    startAt: draft.startAt,
    endAt: draft.endAt,
    validUntil: new Date(riyadhLocalMs(draft.endAt)).toISOString(),
    outdoor: Boolean(draft.outdoor),
    controls: [...new Set(draft.controls || [])],
    requirements: [...new Set(draft.controls || [])],
    status: "open",
    issuedBy: String(actor.name || ""),
    issuedById: String(actor.id || ""),
    issuedAt: now,
    trail: [{ type: "issue", at: now, by: String(actor.name || "") }],
  };
  updateCompany(companyId, (current) => {
    const rec = ensureRec(current, draft.stationId);
    rec.permits = [permit, ...(Array.isArray(rec.permits) ? rec.permits : [])];
    rec.lastActionBy = permit.issuedBy;
    rec.lastActionAt = now;
  });
  const stationName = (data.stations || []).find((row) => row.id === draft.stationId)?.name || draft.stationId;
  logAudit(companyId, "safety_permit_issued", `Permit ${permit.id} (${permit.type}) issued at "${stationName}" to ${permit.holderName || permit.holderId}.`);
  if (holder?.id && String(holder.id) !== String(actor.id || "")) {
    const text = ar
      ? `صدر لك تصريح عمل ${permit.id} في ${stationName} من ${draft.startAt.replace("T", " ")} إلى ${draft.endAt.replace("T", " ")}. لا يبدأ العمل خارج وقته، ويُغلق بتوقيع.`
      : `Permit ${permit.id} was issued to you at ${stationName}, ${draft.startAt.replace("T", " ")} to ${draft.endAt.replace("T", " ")}. No work outside its time; it closes with a signature.`;
    addNotification(companyId, holder.id, text, { to: "/app/safety", key: `permit-${permit.id}` });
  }
  return { ok: true, permit };
}

/** suspend · resume · close · cancel — each on the permit's trail. */
export function actOnSafetyPermit(companyId, stationId, permitId, action, { note = "", areaSafe = false } = {}, actor = {}) {
  const data = getCompanyData(companyId);
  const rec = readSafety(data).find((item) => item.stationId === stationId);
  const current = (rec?.permits || []).find((row) => row.id === permitId);
  const gate = checkPermitActionGate(current, action, { note, areaSafe });
  if (!gate.ok) return gate;
  const now = new Date().toISOString();
  const by = String(actor.name || "");
  let saved = null;
  updateCompany(companyId, (draft) => {
    const record = readSafety(draft).find((item) => item.stationId === stationId);
    const index = (record?.permits || []).findIndex((row) => row.id === permitId);
    if (!record || index < 0) return;
    const next = { ...record.permits[index], trail: [...(record.permits[index].trail || [])] };
    const text = String(note || "").trim().slice(0, 400);
    if (action === "suspend") { next.status = "suspended"; next.suspendedAt = now; next.suspendReason = text; }
    if (action === "resume") { next.status = "open"; next.resumedAt = now; }
    if (action === "close") { next.status = "closed"; next.closedAt = now; next.closedBy = by; next.signedBy = by; next.signedAt = now; next.closeNote = text; next.areaSafe = true; }
    if (action === "cancel") { next.status = "cancelled"; next.cancelledAt = now; next.cancelReason = text; }
    next.trail.push({ type: action, at: now, by, note: text });
    record.permits[index] = next;
    record.lastActionBy = by;
    record.lastActionAt = now;
    saved = next;
  });
  if (!saved) return { ok: false, reason: "تعذّر الحفظ.", reasonEn: "Not saved." };
  logAudit(companyId, `safety_permit_${action}`, `Permit ${permitId} — ${action}${note ? `: ${note}` : ""}.`);
  return { ok: true, permit: saved };
}

const FINDING_CATEGORY = { law_125_fire: 2, law_125_notice: 2, law_63_substances: 5, law_158_seats: 7 };

/**
 * A monthly inspection round: the verdicts become the branch's checklist, the round is kept in history,
 * and every item not met is raised as a safety report (unsafe condition) that runs the ordinary decision path.
 */
export function recordInspectionRound(companyId, stationId, results = {}, actor = {}) {
  const items = inspectionItems();
  const gate = checkInspectionGate({ stationId, results }, items);
  if (!gate.ok) return gate;
  const data = getCompanyData(companyId);
  if (!stationExists(data, stationId)) return { ok: false, reason: "الفرع غير موجود.", reasonEn: "Branch not found." };
  const now = new Date();
  const iso = now.toISOString();
  const by = String(actor.name || "");
  const score = inspectionScore(results, items);
  const findings = inspectionFindings(results, items);
  const clean = Object.fromEntries(items.map((item) => [item.id, {
    status: results[item.id].status,
    ...(String(results[item.id].comment || "").trim() ? { comment: String(results[item.id].comment).trim().slice(0, 300) } : {}),
  }]));
  const round = { id: uid("insp"), at: iso, by, byId: String(actor.id || ""), score: score.pct, yes: score.yes, no: score.no, na: score.na, findings: findings.map((row) => row.id), results: clean };
  updateCompany(companyId, (current) => {
    const rec = ensureRec(current, stationId);
    rec.checklistResults = { ...(rec.checklistResults || {}), ...clean };
    rec.lastInspection = iso;
    rec.inspections = [round, ...(Array.isArray(rec.inspections) ? rec.inspections : [])].slice(0, 36);
    rec.incidentLog = rec.incidentLog || [];
    findings.forEach((row, index) => {
      const fire = row.group === "nfpa" || row.id.startsWith("law_125");
      const card = buildSafetyReportCard({
        kind: 0,
        category: FINDING_CATEGORY[row.id] ?? (fire ? 2 : 7),
        likelihood: 3,
        severity: fire ? 4 : 3,
        where: `جولة تفتيش ${iso.slice(0, 10)}`,
        what: `${row.ar}: ${row.comment}`,
        reporterId: String(actor.id || ""),
      }, new Date(now.getTime() + index));
      rec.incidentLog.unshift({
        id: uid("inc"),
        description: card.what,
        at: iso,
        by,
        reporterId: String(actor.id || ""),
        anonymous: false,
        status: "open",
        step: 0,
        source: { kind: "inspection", roundId: round.id, itemId: row.id },
        card,
      });
    });
    if (findings.length) {
      rec.lastIncidentAt = iso;
      rec.incidents = rec.incidentLog.length;
      if (rec.level !== "red") rec.level = "amber";
    }
    rec.approvedBy = null;
    rec.approvedAt = null;
    rec.lastActionBy = by;
    rec.lastActionAt = iso;
  });
  const stationName = (data.stations || []).find((row) => row.id === stationId)?.name || stationId;
  logAudit(companyId, "safety_inspection_round", `Inspection round at "${stationName}" — ${score.pct ?? "—"}% · ${findings.length} findings raised.`);
  return { ok: true, round, findings: findings.length };
}

/** The investigation of a tracked incident: root cause, corrective action, lost days, GOSI report date. */
export function saveIncidentInvestigation(companyId, stationId, incidentId, draft = {}, actor = {}) {
  const data = getCompanyData(companyId);
  const rec = readSafety(data).find((item) => item.stationId === stationId);
  const current = (rec?.incidentLog || []).find((item) => item.id === incidentId);
  const gate = checkInvestigationGate(current, draft);
  if (!gate.ok) return gate;
  const now = new Date().toISOString();
  const by = String(actor.name || "");
  const lostDays = draft.lostDays === "" || draft.lostDays == null ? 0 : Number(draft.lostDays);
  let saved = null;
  updateCompany(companyId, (store) => {
    const record = readSafety(store).find((item) => item.stationId === stationId);
    const index = (record?.incidentLog || []).findIndex((item) => item.id === incidentId);
    if (!record || index < 0) return;
    const prev = record.incidentLog[index].investigation || {};
    const investigation = {
      rootCause: draft.rootCause,
      capa: String(draft.capa).trim().slice(0, 600),
      capaOwner: String(draft.capaOwner).trim().slice(0, 120),
      capaDue: draft.capaDue,
      lostDays,
      gosiReportedAt: draft.gosiReportedAt || "",
      capaDoneAt: draft.capaDone ? (prev.capaDoneAt || now) : "",
      by,
      at: now,
    };
    const next = { ...record.incidentLog[index], investigation, audit: [...(record.incidentLog[index].audit || []), { type: "investigate", at: now, by, note: investigation.capa }] };
    record.incidentLog[index] = next;
    // A lost-time injury enters the LTI register once, on the incident's day.
    const day = String(next.at || now).slice(0, 10);
    const lti = Array.isArray(record.ltiEntries) ? record.ltiEntries.filter((entry) => entry.incidentId !== incidentId) : [];
    if (lostDays > 0) lti.push({ date: day, description: next.description || next.card?.what || "", incidentId, lostDays });
    record.ltiEntries = lti;
    record.lastActionBy = by;
    record.lastActionAt = now;
    saved = next;
  });
  if (!saved) return { ok: false, reason: "تعذّر الحفظ.", reasonEn: "Not saved." };
  logAudit(companyId, "safety_investigation", `Investigation on ${saved.card?.code || incidentId}: ${saved.investigation.rootCause} · lost days ${lostDays}.`);
  return { ok: true, item: saved };
}
