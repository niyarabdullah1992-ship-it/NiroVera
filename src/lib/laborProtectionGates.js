/** Named gates for Arts. 59, 60, 64, 82, 86, 91, 153, 159, 163–164. */

import { citeRule, laborDayKey, ruleValue } from "./laborRules.js";
import { isOfficialHoliday } from "./ummAlQuraCalendar.js";
import { isOnApprovedLeave } from "./leaveTypes.js";
import { profileGender } from "./employeeProfileFields.js";
import {
  PAY_CYCLES,
  hoursPolicyOf,
  isJuvenile,
  ordinaryDayCap,
  remainingAnnualDays,
  remainingSickDays,
  weeklyRestDow,
} from "./laborHoursPolicy.js";

function isTruthy(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return value === true || s === "1" || s === "true" || s === "yes" || s === "نعم";
}

export function checkIllnessTerminationGate(input = {}) {
  const reason = String(input.reason || "").trim();
  const illness = reason === "illness" || input.illnessRelated === true;
  if (!illness) return { ok: true };
  const onDate = input.today || laborDayKey();
  const cite = citeRule("contract.illness.noDismiss.cite", onDate);
  const sick = remainingSickDays(input.employee || input, onDate);
  let left = sick.left;
  if (isTruthy(input.joinAnnualToSick ?? input.employee?.profile?.joinAnnualToSick)) {
    left += remainingAnnualDays(input.employee || input, onDate);
  }
  if (left > 0) {
    return {
      ok: false,
      error: "ILLNESS_SICK_LEAVE_OPEN",
      reason: `موقوف — المادة 82: لا إنهاء بسبب المرض قبل استنفاذ الإجازة المرضية (المادة 117). المتبقي ${left} يوماً. للعامل وصل السنوية بالمرضية.`,
      reasonEn: `Blocked — Article 82: service may not end for illness before sick leave (Article 117) is exhausted. ${left} day(s) remain. The worker may join annual leave to sick leave.`,
      left,
      sick,
      cite,
    };
  }
  return { ok: true, cite, sick };
}

export function checkWageTypeChangeGate({ from, to, writtenConsent } = {}) {
  const prev = String(from || "monthly").trim().toLowerCase() || "monthly";
  const next = String(to || "").trim().toLowerCase();
  if (!next || prev === next) return { ok: true };
  const cite = citeRule("contract.wageType.consent.cite");
  const leavingMonthly = prev === "monthly" && ["daily", "weekly", "piece", "hourly"].includes(next);
  if (leavingMonthly && writtenConsent !== true) {
    return {
      ok: false,
      error: "WAGE_TYPE_CONSENT",
      reason: "موقوف — المادة 59: لا نقل من الأجر الشهري إلى يومي أو أسبوعي أو قطعة أو ساعة بغير موافقة كتابية.",
      reasonEn: "Blocked — Article 59: a monthly wage may not switch to daily, weekly, piece or hourly pay without written consent.",
      cite,
    };
  }
  return { ok: true, cite };
}

export function checkEssentialJobChangeGate({
  essential,
  writtenConsent,
  necessity,
  necessityDaysUsed = 0,
  addDays = 0,
  onDate,
} = {}) {
  if (!essential) return { ok: true };
  const cite = citeRule("contract.essentialChange.cite", onDate);
  const cap = ruleValue("contract.essentialChange.maxDays", onDate);
  if (necessity === true) {
    const next = Number(necessityDaysUsed) + Number(addDays || 0);
    if (next > cap) {
      return {
        ok: false,
        error: "ESSENTIAL_NECESSITY_CAP",
        reason: `موقوف — المادة 60: الضرورة العارضة لا تتجاوز ${cap} يوماً في السنة.`,
        reasonEn: `Blocked — Article 60: incidental necessity may not exceed ${cap} days in the year.`,
        cap,
        next,
        cite,
      };
    }
    return { ok: true, necessity: true, cap, cite };
  }
  if (writtenConsent !== true) {
    return {
      ok: false,
      error: "ESSENTIAL_CONSENT",
      reason: "موقوف — المادة 60: لا تكليف بعمل يختلف جوهرياً بغير موافقة كتابية، إلا لضرورة عارضة.",
      reasonEn: "Blocked — Article 60: substantially different work needs written consent, except incidental necessity.",
      cite,
    };
  }
  return { ok: true, cite };
}

export function checkExitCloseoutGate({ serviceCertificateIssued, documentsReturned } = {}) {
  const cite = citeRule("contract.serviceCertificate.cite");
  if (!isTruthy(serviceCertificateIssued)) {
    return {
      ok: false,
      error: "SERVICE_CERTIFICATE_REQUIRED",
      reason: "موقوف — المادة 64: شهادة الخدمة (بلا تقييم) واجبة عند إغلاق الملف، وليست نوع خطاب اختياري.",
      reasonEn: "Blocked — Article 64: a service certificate (no appraisal) is a required close-out, not an optional letter type.",
      cite,
    };
  }
  if (!isTruthy(documentsReturned)) {
    return {
      ok: false,
      error: "DOCUMENTS_RETURN_REQUIRED",
      reason: "موقوف — المادة 64: إعادة الشهادات والوثائق المودعة واجبة عند الإغلاق.",
      reasonEn: "Blocked — Article 64: returning deposited certificates and documents is required at close-out.",
      cite: citeRule("contract.returnDocuments.cite") || cite,
    };
  }
  return { ok: true, cite };
}

export function eosWageBase(caseRow = {}) {
  const profile = caseRow.profile || {};
  const agreed = isTruthy(profile.eosAllWageElements || caseRow.eosAllWageElements);
  const base = Math.max(0, Number(caseRow.base ?? profile.base) || 0);
  const allowances = Math.max(0, Number(caseRow.allowances ?? profile.allowances) || 0);
  const bonus = Math.max(0, Number(caseRow.bonus ?? profile.bonus) || 0);
  const last = base + allowances;
  const all = last + bonus;
  const cite = citeRule(agreed ? "eos.allElements.cite" : "eos.gratuity.cite");
  return {
    agreed,
    wage: agreed ? all : last,
    last,
    all,
    cite,
    citeRuleId: agreed ? "eos.allElements.cite" : "eos.gratuity.cite",
  };
}

export function checkDamageDeductionGate({ amount, monthlyWage, monthUsed = 0 } = {}) {
  const capDays = ruleValue("payroll.damage.capDays");
  const wage = Math.max(0, Number(monthlyWage) || 0);
  const day = wage / 30;
  const cap = day * capDays;
  const cite = citeRule("payroll.damage.capDays");
  const next = Number(monthUsed) + Number(amount);
  if (wage > 0 && next > cap + 0.005) {
    return {
      ok: false,
      error: "ARTICLE_91_DAMAGE_CAP",
      reason: `موقوف — المادة 91: حسم التلف لا يزيد على أجر ${capDays} أيام في الشهر (حد ${Math.round(cap)} ر.س). مستقل عن غرامات المادة 70.`,
      reasonEn: `Blocked — Article 91: a damage deduction may not exceed ${capDays} days' wage in a month (cap ${Math.round(cap)} SAR). Distinct from Article 70 fines.`,
      cap,
      capDays,
      cite,
    };
  }
  return { ok: true, cap, capDays, cite };
}

export function maternityMedicalCareDuty(ar = true) {
  const cite = citeRule("leave.maternity.medicalCare.cite");
  return {
    ruleId: "leave.maternity.medicalCare.cite",
    cite,
    title: ar ? "واجب الرعاية الطبية أثناء الحمل والولادة" : "Medical-care duty during pregnancy and birth",
    note: ar
      ? "المادة 153: على صاحب العمل توفير الرعاية الطبية للمرأة العاملة أثناء الحمل والولادة. واجب مسمّى على الملف — ليست عيادة داخل المنصة."
      : "Article 153: the employer shall provide medical care during pregnancy and childbirth. A named duty on the file — not an in-app clinic.",
  };
}

export function checkNurseryThreshold({ employees = [], childrenCount, ar = true } = {}) {
  const womenMin = ruleValue("facility.nursery.womenMin");
  const childrenMin = ruleValue("facility.nursery.childrenMin");
  const women = (employees || []).filter((row) => profileGender(row?.profile || row) === "female").length;
  const kids = Number(childrenCount);
  const knownKids = Number.isFinite(kids) && kids >= 0;
  const cite = citeRule("facility.nursery.womenMin");
  if (women < womenMin) {
    return { ok: true, due: false, women, children: knownKids ? kids : null, cite };
  }
  if (!knownKids) {
    return {
      ok: false,
      due: true,
      error: "NURSERY_CHILDREN_UNKNOWN",
      reason: `تنبيه — المادة 159: العاملات ${women} (العتبة ${womenMin}). سجّل عدد الأطفال دون ست سنوات — إن بلغوا ${childrenMin} يلزم تهيئة مكان رعاية. ليست وحدة حضانة.`,
      reasonEn: `Notice — Article 159: ${women} female workers (threshold ${womenMin}). Record children under six — if they reach ${childrenMin}, a care place is required. Not a nursery module.`,
      women,
      cite,
    };
  }
  if (kids >= childrenMin) {
    return {
      ok: false,
      due: true,
      error: "NURSERY_THRESHOLD",
      reason: `تنبيه — المادة 159: ${women} عاملة و${kids} أطفال — يلزم تهيئة مكان مناسب بعدد كافٍ من المربيات. ليست وحدة حضانة.`,
      reasonEn: `Notice — Article 159: ${women} female workers and ${kids} children — a suitable place with enough attendants is required. Not a nursery module.`,
      women,
      children: kids,
      cite,
    };
  }
  return { ok: true, due: false, women, children: kids, cite };
}

export function checkJuvenileHoursGate({
  employee,
  onDate,
  hours = 0,
  presenceHours = 0,
  consecutiveHours = 0,
  nightHours = 0,
  restDay,
  holiday,
  onAnnualLeave,
  article106,
  company,
  laborCalendar,
} = {}) {
  if (!isJuvenile(employee, onDate)) return { ok: true, skipped: true };
  const cite164 = citeRule("hours.juvenile.ordinaryHours", onDate);
  const cite163 = citeRule("hours.juvenile.nightBanHours", onDate);
  const dayCap = ordinaryDayCap(employee, company, onDate, laborCalendar);
  const stretch = ruleValue("hours.juvenile.maxStretchHours", onDate);
  const presence = ruleValue("hours.juvenile.maxPresenceHours", onDate);
  const nightBan = ruleValue("hours.juvenile.nightBanHours", onDate);
  if (article106) {
    return {
      ok: false,
      error: "JUVENILE_NO_106",
      reason: "موقوف — المادة 164: لا تسري على الأحداث استثناءات المادة 106.",
      reasonEn: "Blocked — Article 164: Article 106 exceptions do not apply to juveniles.",
      cite: citeRule("hours.juvenile.no106.cite", onDate),
    };
  }
  if (restDay || holiday || onAnnualLeave) {
    return {
      ok: false,
      error: "JUVENILE_REST_BAN",
      reason: "موقوف — المادة 164: لا تشغيل للحدث في الراحة الأسبوعية أو الأعياد أو الإجازة السنوية.",
      reasonEn: "Blocked — Article 164: a juvenile may not work on weekly rest, Eids or annual leave.",
      cite: citeRule("hours.juvenile.no106.cite", onDate),
    };
  }
  if (Number(nightHours) > 0) {
    return {
      ok: false,
      error: "JUVENILE_NIGHT_BAN",
      reason: `موقوف — المادة 163: لا تشغيل للحدث أثناء فترة ليل تقل عن ${nightBan} ساعة متتالية.`,
      reasonEn: `Blocked — Article 163: a juvenile may not work during a night period of less than ${nightBan} consecutive hours.`,
      cite: cite163,
    };
  }
  if (Number(hours) > dayCap) {
    return {
      ok: false,
      error: "JUVENILE_DAY_CAP",
      reason: `موقوف — المادة 164: تشغيل الحدث الفعلي لا يزيد على ${dayCap} ساعات هذا اليوم.`,
      reasonEn: `Blocked — Article 164: a juvenile's actual work may not exceed ${dayCap} hours this day.`,
      cite: cite164,
    };
  }
  if (Number(consecutiveHours) > stretch) {
    return {
      ok: false,
      error: "JUVENILE_STRETCH",
      reason: `موقوف — المادة 164: لا يعمل الحدث أكثر من ${stretch} ساعات متصلة دون راحة.`,
      reasonEn: `Blocked — Article 164: a juvenile may not work more than ${stretch} consecutive hours without a rest.`,
      cite: cite164,
    };
  }
  if (Number(presenceHours) > presence) {
    return {
      ok: false,
      error: "JUVENILE_PRESENCE",
      reason: `موقوف — المادة 164: لا يبقى الحدث في مكان العمل أكثر من ${presence} ساعات.`,
      reasonEn: `Blocked — Article 164: a juvenile may not remain at the workplace more than ${presence} hours.`,
      cite: cite164,
    };
  }
  return { ok: true, cite: cite164 };
}

export function payCycleOf(employee) {
  const raw = String(employee?.profile?.payCycle || employee?.payCycle || "monthly").trim().toLowerCase();
  return PAY_CYCLES.includes(raw) ? raw : "monthly";
}

export { PAY_CYCLES, weeklyRestDow };
