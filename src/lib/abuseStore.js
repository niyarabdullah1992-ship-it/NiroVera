/**
 * Writes for workplace-abuse cases (model regulation Arts. 54–56). Every write passes the pure gate in
 * abuseComplaint.js first and returns { ok, error, reason, reasonEn } — a refusal names its article.
 */
import { addNotification, getCompanyData, logAudit, updateCompany } from "@/lib/store";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import {
  checkAbuseCommitteeGate,
  checkAbuseHearingGate,
  checkAbuseOutcomeGate,
  checkFileAbuseGate,
  planAbuseCase,
} from "@/lib/abuseComplaint";

const now = () => new Date().toISOString();
const restOf = (data) => (Array.isArray(data?.settings?.weeklyRestDays) ? data.settings.weeklyRestDays : undefined);

function patchCase(companyId, id, fn) {
  let hit = false;
  updateCompany(companyId, (d) => {
    d.abuseCases = Array.isArray(d.abuseCases) ? d.abuseCases : [];
    const row = d.abuseCases.find((r) => r.id === id);
    if (!row) return;
    fn(row, d);
    row.updatedAt = now();
    hit = true;
  });
  return hit ? { ok: true } : { ok: false, error: "NOT_FOUND", reason: "الملف غير موجود.", reasonEn: "Case not found." };
}

export function fileAbuseCase(companyId, input = {}) {
  const data = getCompanyData(companyId);
  const gate = checkFileAbuseGate({ ...input, reporterId: input.reporter?.id, accusedId: input.accused?.id, accusedName: input.accused?.name, filedAt: now(), calendar: laborCalendarOf(data), restWeekdays: restOf(data) });
  if (!gate.ok) return gate;
  const row = planAbuseCase({ ...input, filedAt: now() });
  updateCompany(companyId, (d) => {
    d.abuseCases = [row, ...(Array.isArray(d.abuseCases) ? d.abuseCases : [])];
  });
  logAudit(companyId, "abuse_case_filed", `Workplace-abuse ${row.reporterRole === "witness" ? "report" : "complaint"} filed (${row.id}).`);
  // Only HR seniors hear of it — never the accused (confidentiality, model Art. 56(1)).
  for (const e of data?.employees || []) {
    if (String(e.id) === String(row.accusedId) || String(e.id) === String(row.reporterId)) continue;
    if (!["owner", "director", "hr", "admin"].includes(e.role) && String(e.id) !== String(data?.ownerId)) continue;
    addNotification(companyId, e.id, "وصلت شكوى إيذاء سرية — شكّل لجنة التحقيق خلال خمسة أيام عمل (النموذج م55/2).", { key: `abuse:${row.id}:filed` });
  }
  return { ok: true, id: row.id, lastDay: gate.lastDay };
}

export function formAbuseCommittee(companyId, id, { members = [], decisionRef = "", by = "" } = {}) {
  const row = (getCompanyData(companyId)?.abuseCases || []).find((r) => r.id === id);
  const gate = checkAbuseCommitteeGate(row, { members, decisionRef });
  if (!gate.ok) return gate;
  return patchCase(companyId, id, (r) => {
    r.committee = { members: members.map((m) => ({ id: m.id || m, name: m.name || "" })), decisionRef: String(decisionRef).trim(), at: now(), by };
    r.status = "committee";
    r.log = [...(r.log || []), { at: now(), text: `شُكّلت لجنة التحقيق بالقرار ${String(decisionRef).trim()} (م55/2).`, by }];
  });
}

export function recordAbuseHearing(companyId, id, hearing = {}, by = "") {
  const gate = checkAbuseHearingGate(hearing);
  if (!gate.ok) return gate;
  return patchCase(companyId, id, (r) => {
    r.hearings = [...(r.hearings || []), { ...hearing, at: now(), by }];
    r.status = "investigating";
    r.log = [...(r.log || []), { at: now(), text: `سُمعت أقوال ${hearing.who} في محضر موقّع (م56/1).`, by }];
  });
}

export function recordAbuseSeparation(companyId, id, { measure = "", by = "" } = {}) {
  if (String(measure).trim().length < 5) return { ok: false, error: "ABUSE_SEPARATION_TEXT", reason: "اكتب إجراء التفريق بين الطرفين (نقل مؤقت، تغيير وردية…) — النموذج م56/3.", reasonEn: "Describe how the parties are separated (model Art. 56(3))." };
  return patchCase(companyId, id, (r) => {
    r.separation = { measure: String(measure).trim(), at: now(), by };
    r.log = [...(r.log || []), { at: now(), text: `فُرّق بين الطرفين أثناء التحقيق: ${String(measure).trim()} (م56/3).`, by }];
  });
}

export function decideAbuseCase(companyId, id, { outcome, recommendation = "", criminal = false, referredAt = "", by = "" } = {}) {
  const row = (getCompanyData(companyId)?.abuseCases || []).find((r) => r.id === id);
  const gate = checkAbuseOutcomeGate(row, { outcome, recommendation, criminal, referredAt });
  if (!gate.ok) return gate;
  return patchCase(companyId, id, (r) => {
    r.outcome = { id: outcome, recommendation: String(recommendation).trim(), at: now(), by };
    if (criminal) r.referral = { at: String(referredAt).slice(0, 10), by };
    r.status = "decided";
    r.log = [...(r.log || []), { at: now(), text: "رفعت اللجنة توصيتها (م56/4–6).", by }];
  });
}

export function closeAbuseCase(companyId, id, by = "") {
  return patchCase(companyId, id, (r) => {
    r.status = "closed";
    r.closedAt = now();
    r.log = [...(r.log || []), { at: now(), text: "أُغلق الملف. لا يمنع الجزاء التأديبي لجوء المعتدى عليه للجهات الحكومية (م56/7).", by }];
  });
}
