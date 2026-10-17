/**
 * Due notices for the employer duties added on file — each key fires once:
 *   - workplace-abuse inquiry: five working days from the complaint (model regulation Art. 55(2));
 *   - periodic medical exam of an exposed worker: 30 days before and once overdue (Law Art. 143);
 *   - a training not documented within 30 days (Regs Art. 16 أولاً/4);
 *   - a non-Saudi worker's passport / iqama / insurance card held by the employer (Regs Art. 6).
 */
import { addNotification, getCompanyData } from "@/lib/store";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { planAbuseNotices } from "@/lib/abuseComplaint";
import { voiceHrReceivers } from "@/lib/voicePrivacy";
import { deriveHeldDocumentViolations, medicalExamStatus, trainingDocumentationDue } from "@/lib/employerDuties";

function hrAudience(data) {
  return (data?.employees || []).filter((e) => e?.id && (["owner", "director", "hr", "admin"].includes(e.role) || String(e.id) === String(data?.ownerId || "")));
}

export function planEmployerDutyNotices(data, today, existingKeys = []) {
  const seen = new Set(existingKeys);
  const out = [];
  const audience = hrAudience(data);
  const push = (userId, key, text, to) => {
    if (!userId || seen.has(key)) return;
    seen.add(key);
    out.push({ userId, key, text, to });
  };
  // Abuse clocks go to the HR receivers only (planAbuseNotices also skips the accused).
  for (const n of planAbuseNotices({ cases: data?.abuseCases || [], today, calendar: laborCalendarOf(data), restWeekdays: data?.settings?.weeklyRestDays, audience: voiceHrReceivers(data), existingKeys: [...seen] })) {
    push(n.userId, n.key, n.text, n.to);
  }
  for (const emp of data?.employees || []) {
    const med = medicalExamStatus(emp, today);
    if (med.required && (med.over || med.soon)) {
      const stage = med.over ? "over" : "soon";
      for (const m of audience) push(m.id, `medexam:${emp.id}:${med.due}:${stage}:${m.id}`, med.over
        ? `الفحص الطبي الدوري لـ${emp.name} متأخر منذ ${med.due} — العامل المعرض لمرض مهني يُفحص مرة كل سنة على الأقل (المادة 143).`
        : `الفحص الطبي الدوري لـ${emp.name} مستحق في ${med.due} (المادة 143).`, `/app/employees/${emp.id}`);
    }
    for (const rec of emp.trainings || []) {
      const doc = trainingDocumentationDue(rec, today);
      if (doc?.over) for (const m of audience) push(m.id, `trainingdoc:${emp.id}:${rec.id}:${m.id}`, `تدريب «${rec.course}» لـ${emp.name} لم يُوثَّق في منصة الوزارة خلال 30 يوماً (اللائحة م16/أولاً/4).`, `/app/employees/${emp.id}`);
    }
  }
  for (const v of deriveHeldDocumentViolations(data?.employees || [])) {
    for (const m of audience) push(m.id, `helddoc:${v.employeeId}:${v.kind}:${v.since}:${m.id}`, `${v.name}: ${v.reason}`, `/app/employees/${v.employeeId}`);
  }
  return out;
}

export function openDueEmployerDutyNotices(companyId, now = new Date()) {
  const data = getCompanyData(companyId);
  if (!data) return { ok: true, notified: 0 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
  const existingKeys = (data.notifications || []).map((row) => row.key).filter(Boolean);
  const plans = planEmployerDutyNotices(data, today, existingKeys);
  for (const plan of plans) addNotification(companyId, plan.userId, plan.text, { key: plan.key, to: plan.to });
  return { ok: true, notified: plans.length };
}
