// deno-lint-ignore-file no-explicit-any
// Backend copy of src/lib/rightsRequests.js — keep the two in step (scripts/test-cloud-parity.mjs).
/**
 * Worker requests the Labour Law provides for that had no tile:
 *
 *   المادة 51 — عقد العمل من نسختين يحتفظ كل طرف بنسخة، ولكل طرف أن يطلب كتابته في أي وقت.
 *   المادة 78 — إن كان الإشعار من صاحب العمل فللعامل أن يتغيب خلال مهلته يوماً كاملاً في الأسبوع بأجره
 *               للبحث عن عمل، ويحدده العامل بشرط إشعار صاحب العمل في اليوم السابق على الأقل.
 *   المادة 91 — للعامل أن يتظلم من اقتطاع التلف أو من تقديره أمام المحكمة العمالية خلال خمسة عشر يوم عمل
 *               من تاريخ إبلاغه، وإلا سقط حقه.
 *   المادة 110(1) — للعامل بموافقة صاحب العمل أن يؤجل إجازته السنوية أو أياماً منها إلى السنة التالية.
 *   المادة 81 — للعامل أن يترك العمل دون إشعار مع احتفاظه بحقوقه كلها في ست حالات.
 *
 * Pure: no store; safe in node tests.
 */

export const DAMAGE_OBJECTION_TYPE = "damage_objection";
export const LEAVE_CARRY_TYPE = "leave_carry";
export const ART81_EXIT_TYPE = "art81_exit";
export const JOB_SEARCH_LEAVE = "job_search";
export const DOCUMENTS_RETURN_TYPE = "documents_return";
export const NIGHT_AVOID_TYPE = "night_avoid";

/** Decision 18632 (ثالثاً ج): who may ask to be moved off night work on a medical certificate. */
export const NIGHT_AVOID_KINDS = [
  { key: "health", ar: "شهادة طبية تبيّن أنني بحاجة لتجنب العمل الليلي للمحافظة على صحتي", en: "A medical certificate shows I need to avoid night work for my health", ref: "ج-1" },
  { key: "mother", ar: "حامل أو أم — شهادة طبية تبيّن حاجتي لفترات إضافية لتجنب العمل الليلي للمحافظة على صحتي أو صحة الطفل", en: "Pregnant or a mother — a certificate shows I need extra periods off night work for my or the child's health", ref: "ج-3", gender: "female" },
];

export const ART81_CASES = [
  { key: "obligations", ar: "لم يفِ صاحب العمل بالتزاماته العقدية أو النظامية الجوهرية تجاهي", en: "The employer did not meet his essential contractual or legal obligations to me" },
  { key: "fraud", ar: "أدخل عليّ صاحب العمل أو من يمثله الغش وقت التعاقد في شروط العمل وظروفه", en: "The employer or his representative deceived me about the work terms when contracting" },
  { key: "different_work", ar: "كُلّفت دون رضاي بعمل يختلف جوهرياً عن المتفق عليه، خلافاً للمادة 60", en: "I was assigned, without my consent, substantially different work, against Article 60" },
  { key: "violence", ar: "وقع عليّ أو على أحد أفراد أسرتي اعتداء بالعنف أو سلوك مخل بالآداب من صاحب العمل أو أسرته أو المدير المسؤول", en: "Violence or indecent conduct toward me or my family by the employer, his family or the responsible manager" },
  { key: "cruelty", ar: "اتسمت معاملة صاحب العمل أو المدير المسؤول بالقسوة أو الجور أو الإهانة", en: "The employer's or manager's treatment was cruel, unjust or insulting" },
  { key: "danger", ar: "في مقر العمل خطر جسيم على سلامتي أو صحتي علم به صاحب العمل ولم يتخذ ما يزيله", en: "A grave danger to my safety or health at the workplace that the employer knew of and did not remove" },
];

export const RIGHTS_REQUESTS = [
  { key: "contract_copy", article: "51", ar: "نسخة من عقد العمل", en: "A copy of my contract", hintAr: "م 51 · نسخة لكل طرف — لا تُرفض", hintEn: "Art. 51 · each party keeps a copy" },
  { key: LEAVE_CARRY_TYPE, article: "110", ar: "تأجيل إجازة سنوية للسنة التالية", en: "Carry annual leave to next year", hintAr: "م 110 · بموافقة صاحب العمل", hintEn: "Art. 110 · with the employer's agreement" },
  { key: DAMAGE_OBJECTION_TYPE, article: "91", ar: "اعتراض على خصم إتلاف", en: "Object to a damage deduction", hintAr: "م 91 · خلال 15 يوم عمل من إبلاغك", hintEn: "Art. 91 · within 15 working days" },
  { key: NIGHT_AVOID_TYPE, article: "18632", ar: "تجنب العمل الليلي لسبب صحي", en: "Avoid night work for health", hintAr: "قرار 18632 · ثالثاً ج — نقل لعمل نهاري أو 6 ساعات", hintEn: "Decision 18632 · move to day work or 6 hours" },
  { key: DOCUMENTS_RETURN_TYPE, article: "64", ar: "استرداد وثائقي المودعة", en: "Return my deposited documents", hintAr: "م 64 · تُعاد عند انتهاء العقد — لا تُرفض", hintEn: "Art. 64 · returned at contract end" },
  { key: ART81_EXIT_TYPE, article: "81", ar: "ترك العمل دون إشعار", en: "Leave work without notice", hintAr: "م 81 · ست حالات مع حفظ حقوقك", hintEn: "Art. 81 · six cases, rights kept" },
];

const dateOnly = (v: any): string => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/** Working days after `from` up to and including `to` — Friday and Saturday are the weekly rest. */
export function workingDaysBetween(from: any, to: any) {
  const a = dateOnly(from);
  const b = dateOnly(to);
  if (!a || !b || b <= a) return 0;
  let n = 0;
  const d = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 5 && wd !== 6) n += 1;
  }
  return n;
}

/** The last day to object: 15 working days after being told. */
export function damageObjectionDeadline(notifiedOn: any) {
  const a = dateOnly(notifiedOn);
  if (!a) return "";
  const d = new Date(`${a}T00:00:00Z`);
  let n = 0;
  while (n < 15) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 5 && wd !== 6) n += 1;
  }
  return d.toISOString().slice(0, 10);
}

export function checkDamageObjectionGate({ notifiedOn, amount, reason, today }: any = {}) {
  const told = dateOnly(notifiedOn);
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  if (!told) return { ok: false, error: "NOTIFIED_REQUIRED", reason: "حدد تاريخ إبلاغك بالخصم — منه تبدأ مهلة الخمسة عشر يوم عمل (المادة 91).", reasonEn: "Set the date you were told of the deduction (Art. 91)." };
  if (told > day) return { ok: false, error: "NOTIFIED_FUTURE", reason: "تاريخ الإبلاغ في المستقبل.", reasonEn: "The notice date is in the future." };
  const last = damageObjectionDeadline(told);
  if (day > last) {
    return { ok: false, error: "OBJECTION_LATE", reason: `مضت خمسة عشر يوم عمل على إبلاغك (آخر يوم ${last}) — سقط حق التظلم (المادة 91).`, reasonEn: `Fifteen working days have passed (last day ${last}) — the right to object lapsed (Art. 91).`, last };
  }
  if (!(Number(amount) > 0)) return { ok: false, error: "AMOUNT_REQUIRED", reason: "اكتب مبلغ الخصم الذي تعترض عليه.", reasonEn: "Write the deducted amount." };
  if (String(reason || "").trim().length < 15) return { ok: false, error: "REASON_REQUIRED", reason: "اشرح سبب اعتراضك: خطأ الغير، أو قوة قاهرة، أو أن التقدير مبالغ فيه.", reasonEn: "Explain why you object." };
  return { ok: true, last, left: workingDaysBetween(day, last) };
}

export function checkLeaveCarryGate({ days, remaining, reason }: any = {}) {
  const n = Math.floor(Number(days));
  if (!(n >= 1)) return { ok: false, error: "DAYS_REQUIRED", reason: "حدد عدد الأيام التي تؤجلها.", reasonEn: "Set how many days to carry." };
  if (remaining != null && remaining !== "" && Number.isFinite(Number(remaining)) && n > Number(remaining)) {
    return { ok: false, error: "DAYS_OVER", reason: `المتبقي من إجازتك السنوية ${remaining} يوماً — لا تؤجل أكثر منه.`, reasonEn: `You have ${remaining} annual days left.` };
  }
  if (String(reason || "").trim().length < 3) return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب التأجيل.", reasonEn: "Write why." };
  return { ok: true, days: n };
}

export function checkArt81Gate({ caseKey, reason, ack }: any = {}) {
  if (!ART81_CASES.some((c) => c.key === caseKey)) return { ok: false, error: "CASE_REQUIRED", reason: "اختر الحالة من حالات المادة 81.", reasonEn: "Pick the Article 81 case." };
  if (String(reason || "").trim().length < 20) return { ok: false, error: "REASON_REQUIRED", reason: "صف ما حدث بالتواريخ — هذا سندك إن نُظر الأمر أمام المحكمة العمالية.", reasonEn: "Describe what happened, with dates." };
  if (ack !== true) return { ok: false, error: "ACK_REQUIRED", reason: "أقرّ بأن تركك العمل ينهي عقدك من اليوم، وأن الخلاف إن وقع يُنظر أمام المحكمة العمالية.", reasonEn: "Acknowledge that leaving ends your contract today and any dispute goes to the labour court." };
  return { ok: true };
}

/**
 * Art. 78 — a paid day a week to look for work, while the EMPLOYER's notice runs; the worker picks the
 * day and tells the employer at least the day before. It is not asked for approval.
 */
export function employerNoticeOf(employee: any, today: any) {
  const exit = employee?.profile?.contractExit || {};
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const until = dateOnly(exit.effectiveDate);
  if (exit.party !== "employer" || !until || until < day) return null;
  return { until, since: dateOnly(exit.noticeGivenAt || exit.decidedAt || "") };
}

const weekKey = (iso: any) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};

export function checkJobSearchDayGate({ employee, startDate, endDate, today, exceptId }: any = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const notice = employerNoticeOf(employee, day);
  if (!notice) {
    return { ok: false, error: "NO_EMPLOYER_NOTICE", reason: "يوم البحث عن عمل للعامل خلال مهلة إشعار صادرة من صاحب العمل فقط (المادة 78).", reasonEn: "The job-search day applies only during a notice given by the employer (Art. 78)." };
  }
  const start = dateOnly(startDate);
  const end = dateOnly(endDate) || start;
  if (!start || end !== start) return { ok: false, error: "ONE_DAY", reason: "يوم واحد في الأسبوع — اختر يوماً واحداً (المادة 78).", reasonEn: "One day a week — pick a single day (Art. 78)." };
  if (start <= day) return { ok: false, error: "NOTICE_DAY_BEFORE", reason: "أشعر صاحب العمل في اليوم السابق على الأقل — اختر يوماً بعد اليوم (المادة 78).", reasonEn: "Tell the employer at least the day before — pick a later day (Art. 78)." };
  if (start > notice.until) return { ok: false, error: "AFTER_NOTICE", reason: `مهلة الإشعار تنتهي ${notice.until}.`, reasonEn: `The notice ends ${notice.until}.` };
  const sameWeek = (employee?.leaveRequests || []).some((r) => r.id !== exceptId && String(r.type) === JOB_SEARCH_LEAVE && ["approved", "pending"].includes(r.status) && weekKey(r.startDate) === weekKey(start));
  if (sameWeek) return { ok: false, error: "WEEK_USED", reason: "أخذت يوم البحث عن عمل لهذا الأسبوع — يوم واحد في الأسبوع (المادة 78).", reasonEn: "You already have this week's job-search day (Art. 78)." };
  return { ok: true, until: notice.until };
}

export function checkNightAvoidGate({ kind, from, until, file, gender }: any = {}) {
  const meta = NIGHT_AVOID_KINDS.find((k) => k.key === kind);
  if (!meta) return { ok: false, error: "KIND_REQUIRED", reason: "اختر سبب الطلب.", reasonEn: "Pick the reason." };
  if (meta.gender && gender && gender !== meta.gender) return { ok: false, error: "KIND_GENDER", reason: "هذه الحالة للحامل أو الأم.", reasonEn: "This case is for a pregnant worker or a mother." };
  if (!dateOnly(from)) return { ok: false, error: "FROM_REQUIRED", reason: "حدد تاريخ بدء الحاجة كما في الشهادة.", reasonEn: "Set the start date from the certificate." };
  if (dateOnly(until) && dateOnly(until) < dateOnly(from)) return { ok: false, error: "UNTIL_ORDER", reason: "تاريخ الانتهاء قبل البداية.", reasonEn: "The end is before the start." };
  if (!file) return { ok: false, error: "FILE_REQUIRED", reason: "أرفق الشهادة الطبية — من مركز صحي حكومي أو خاص معتمد في قائمة التأمين الطبي للمنشأة (دليل القرار 18632).", reasonEn: "Attach the medical certificate (decision 18632)." };
  return { ok: true, meta };
}

/** Active night-avoidance on `day` (approved request stamped on the profile). */
export function nightAvoidOn(profile: any, day: any) {
  const row = profile?.nightAvoid;
  const d = dateOnly(day);
  if (!row || !d) return null;
  if (dateOnly(row.from) && d < dateOnly(row.from)) return null;
  if (dateOnly(row.until) && d > dateOnly(row.until)) return null;
  return row;
}

export function checkDocumentsReturnGate({ reason }: any = {}) {
  if (String(reason || "").trim().length < 5) return { ok: false, error: "LIST_REQUIRED", reason: "اذكر الوثائق التي أودعتها (شهادات، جواز، رخصة…).", reasonEn: "List the documents you deposited." };
  return { ok: true };
}
