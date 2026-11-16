/** Single source (client + server). Client re-exports via src/lib/hiringDerivations.js */

export const RQ_STAGES = [
  { id: "req", sla: 3 },
  { id: "post", sla: 5 },
  { id: "screen", sla: 7 },
  { id: "intv", sla: 7 },
  { id: "offer", sla: 5 },
];

export const HIRE_STEPS = [
  { id: "offer", must: true, saudiOnlySkip: false },
  { id: "qiwa", must: true, saudiOnlySkip: false },
  { id: "gosi", must: true, saudiOnlySkip: false },
  { id: "med", must: true, saudiOnlySkip: false },
  { id: "iqama", must: true, saudiOnlySkip: true },
  { id: "hse", must: true, saudiOnlySkip: false },
  { id: "assets", must: false, saudiOnlySkip: false },
];

function parseDay(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function cumulativeSlaDays(at) {
  const idx = Math.max(0, Math.min(at, RQ_STAGES.length - 1));
  let acc = 0;
  for (let i = 0; i <= idx; i++) acc += RQ_STAGES[i].sla;
  return acc;
}

export function stageDueDate(opened, at) {
  const start = parseDay(opened);
  if (!start) return null;
  return isoLocal(new Date(start.getTime() + cumulativeSlaDays(at) * 86400000));
}

export function daysUntil(dueIso, now = new Date()) {
  const due = parseDay(dueIso);
  if (!due) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function daysOpen(opened, now = new Date()) {
  const start = parseDay(opened);
  if (!start) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
}

export function deriveVacancyBoard(vacancy, now = new Date()) {
  const at = Math.max(0, Number(vacancy.at) || 0);
  const done = at >= RQ_STAGES.length;
  const stageIdx = done ? RQ_STAGES.length - 1 : Math.min(at, RQ_STAGES.length - 1);
  const stage = RQ_STAGES[stageIdx];
  const due = done ? null : stageDueDate(vacancy.opened, at);
  const left = due ? daysUntil(due, now) : null;
  const late = !done && left != null && left < 0;
  const pickName = vacancy.chosen?.name || vacancy.chosen?.nameEn || "";
  return {
    key: vacancy.key,
    at,
    done,
    stageId: stage.id,
    stageSla: stage.sla,
    due,
    daysLeft: left,
    late,
    ageDays: daysOpen(vacancy.opened, now),
    pickName: pickName || null,
    canAdvance: !done && !(at === RQ_STAGES.length - 1 && !pickName),
    nitaqatEffectStated: !!vacancy.nitaqatEffectStated,
    withdrawn: !!vacancy.withdrawn,
  };
}

export function checkAdvanceGate(vacancy) {
  if (!vacancy) return { ok: false, error: "VACANCY_NOT_FOUND", reason: "الشاغر غير موجود.", reasonEn: "Vacancy not found." };
  const at = Math.max(0, Number(vacancy.at) || 0);
  if (at >= RQ_STAGES.length) {
    return { ok: false, error: "ALREADY_DONE", reason: "الشاغر مكتمل وانتقل للتعيين.", reasonEn: "Vacancy already complete — moved to onboarding." };
  }
  if (at === 0 && !vacancy.nitaqatEffectStated) {
    return {
      ok: false,
      error: "NITAQAT_EFFECT_REQUIRED",
      reason: "لا إعلان قبل بيان أثر الشاغر على نطاقات.",
      reasonEn: "Cannot post before the Nitaqat effect of this vacancy is stated.",
    };
  }
  if (at === RQ_STAGES.length - 1) {
    const pick = vacancy.chosen?.name || vacancy.chosen?.nameEn;
    if (!pick) {
      return {
        ok: false,
        error: "OFFER_PICK_REQUIRED",
        reason: "لا يمكن إصدار العرض — لم يُختر مرشح من القائمة القصيرة.",
        reasonEn: "Offer blocked — no candidate has been selected from the shortlist.",
      };
    }
  }
  return { ok: true, nextAt: at + 1 };
}

export function checkRejectGate(reason) {
  const r = String(reason || "").trim();
  if (!r) {
    return {
      ok: false,
      error: "REJECT_REASON_REQUIRED",
      reason: "كل استبعاد يحتاج سببًا مقيَّدًا.",
      reasonEn: "Every rejection requires a recorded reason.",
    };
  }
  return { ok: true, reason: r };
}

export function applicableHireSteps(saudi) {
  return HIRE_STEPS.filter((s) => !(s.saudiOnlySkip && saudi));
}

export function deriveOnboardingStatus(hire) {
  const steps = applicableHireSteps(!!hire.saudi);
  const doneMap = hire.stepsDone || {};
  const doneN = steps.filter((s) => !!doneMap[s.id]).length;
  const blocking = steps.filter((s) => s.must && !doneMap[s.id]);
  return {
    key: hire.key,
    doneN,
    total: steps.length,
    blockingIds: blocking.map((s) => s.id),
    ready: blocking.length === 0,
    confirmed: !!hire.confirmed,
  };
}

export function checkConfirmStartGate(hire) {
  if (!hire) return { ok: false, error: "HIRE_NOT_FOUND", reason: "ملف التعيين غير موجود.", reasonEn: "Onboarding record not found." };
  if (hire.confirmed) return { ok: false, error: "ALREADY_CONFIRMED", reason: "المباشرة معتمدة مسبقًا.", reasonEn: "Start already confirmed." };
  const status = deriveOnboardingStatus(hire);
  if (!status.ready) {
    return {
      ok: false,
      error: "MANDATORY_STEPS_OPEN",
      reason: `لا يجوز تحديد المباشرة — ينقص ${status.blockingIds.length} إجراء نظامي.`,
      reasonEn: `Start date blocked — ${status.blockingIds.length} mandatory step(s) outstanding.`,
      blockingIds: status.blockingIds,
    };
  }
  return { ok: true };
}

export function deriveHiringStats(vacancies = [], applicants = [], now = new Date()) {
  const open = vacancies.filter((v) => (Number(v.at) || 0) < RQ_STAGES.length && !v.withdrawn);
  const vacN = open.reduce((n, v) => n + Math.max(1, Number(v.count) || 1), 0);
  const appN = applicants.filter((a) => open.some((v) => v.key === a.vacancyKey)).length;
  const ages = open.map((v) => daysOpen(v.opened, now));
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  const late = open.filter((v) => deriveVacancyBoard(v, now).late).length;
  return { vacanciesOpen: vacN, applications: appN, avgDaysOpen: avgAge, stagesLate: late };
}

export function isVacancyPubliclyListed(vacancy) {
  if (!vacancy || vacancy.withdrawn) return false;
  return (Number(vacancy.at) || 0) < RQ_STAGES.length;
}

export function buildApplicationRef(vacancyKey, seed) {
  const code = String(vacancyKey || "GEN").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "GEN";
  let h = 2166136261;
  const raw = `${vacancyKey}|${seed}|${Date.now()}`;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hash = (Math.abs(h) % 1679616).toString(36).toUpperCase().padStart(4, "0");
  return `NV-APP-${code}-${hash}`;
}

export function checkPublicApplyGate(input = {}) {
  const name = String(input.name || "").trim();
  const phone = String(input.phone || "").replace(/\s+/g, "");
  const vacancyKey = String(input.vacancyKey || "").trim();
  if (!vacancyKey) {
    return {
      ok: false,
      error: "VACANCY_REQUIRED",
      reason: "اختر الشاغر قبل الإرسال.",
      reasonEn: "Choose a vacancy before submitting.",
    };
  }
  if (!name) {
    return {
      ok: false,
      error: "NAME_REQUIRED",
      reason: "الاسم مطلوب.",
      reasonEn: "Name is required.",
    };
  }
  if (phone.length < 8) {
    return {
      ok: false,
      error: "PHONE_REQUIRED",
      reason: "رقم الجوال مطلوب للمتابعة بالرقم المرجعي.",
      reasonEn: "A phone number is required so we can reach you with your reference.",
    };
  }
  return { ok: true, name, phone, vacancyKey };
}
