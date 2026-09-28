import { getCompanyData, logAudit, updateCompany } from "@/lib/store";
import { checkHazardCloseGate } from "@/lib/hseDerivations";
import { buildSafetyReportCard } from "@/lib/safetyReportCard";
import { readSafety } from "@/lib/facts";

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