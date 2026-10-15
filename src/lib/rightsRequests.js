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
export const GRIEVANCE_TYPE = "grievance";

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
  { key: GRIEVANCE_TYPE, article: "regs71", ar: "تظلم من قرار أو إجراء أو جزاء", en: "Grieve a decision, action or penalty", hintAr: "اللائحة م71 · خلال 30 يوماً — والرد خلال 15", hintEn: "Regs Art. 71 · within 30 days; answer in 15" },
  { key: ART81_EXIT_TYPE, article: "81", ar: "ترك العمل دون إشعار", en: "Leave work without notice", hintAr: "م 81 · ست حالات مع حفظ حقوقك", hintEn: "Art. 81 · six cases, rights kept" },
];

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/** Working days after `from` up to and including `to` — Friday and Saturday are the weekly rest. */
export function workingDaysBetween(from, to) {
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
export function damageObjectionDeadline(notifiedOn) {
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

export function checkDamageObjectionGate({ notifiedOn, amount, reason, today } = {}) {
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

export function checkLeaveCarryGate({ days, remaining, reason } = {}) {
  const n = Math.floor(Number(days));
  if (!(n >= 1)) return { ok: false, error: "DAYS_REQUIRED", reason: "حدد عدد الأيام التي تؤجلها.", reasonEn: "Set how many days to carry." };
  if (remaining != null && remaining !== "" && Number.isFinite(Number(remaining)) && n > Number(remaining)) {
    return { ok: false, error: "DAYS_OVER", reason: `المتبقي من إجازتك السنوية ${remaining} يوماً — لا تؤجل أكثر منه.`, reasonEn: `You have ${remaining} annual days left.` };
  }
  if (String(reason || "").trim().length < 3) return { ok: false, error: "REASON_REQUIRED", reason: "اكتب سبب التأجيل.", reasonEn: "Write why." };
  return { ok: true, days: n };
}

export function checkArt81Gate({ caseKey, reason, ack } = {}) {
  if (!ART81_CASES.some((c) => c.key === caseKey)) return { ok: false, error: "CASE_REQUIRED", reason: "اختر الحالة من حالات المادة 81.", reasonEn: "Pick the Article 81 case." };
  if (String(reason || "").trim().length < 20) return { ok: false, error: "REASON_REQUIRED", reason: "صف ما حدث بالتواريخ — هذا سندك إن نُظر الأمر أمام المحكمة العمالية.", reasonEn: "Describe what happened, with dates." };
  if (ack !== true) return { ok: false, error: "ACK_REQUIRED", reason: "أقرّ بأن تركك العمل ينهي عقدك من اليوم، وأن الخلاف إن وقع يُنظر أمام المحكمة العمالية.", reasonEn: "Acknowledge that leaving ends your contract today and any dispute goes to the labour court." };
  return { ok: true };
}

/**
 * Art. 78 — a paid day a week to look for work, while the EMPLOYER's notice runs; the worker picks the
 * day and tells the employer at least the day before. It is not asked for approval.
 */
export function employerNoticeOf(employee, today) {
  const exit = employee?.profile?.contractExit || {};
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const until = dateOnly(exit.effectiveDate);
  if (exit.party !== "employer" || !until || until < day) return null;
  return { until, since: dateOnly(exit.noticeGivenAt || exit.decidedAt || "") };
}

const weekKey = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};

export function checkJobSearchDayGate({ employee, startDate, endDate, today, exceptId } = {}) {
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
  if (jobSearchHoursInWeek(employee, start, exceptId) > 0) {
    return { ok: false, error: "WEEK_HOURS_USED", reason: "اخترت ساعات البحث عن عمل لهذا الأسبوع — إما يوم كامل أو ثماني ساعات في الأسبوع (المادة 78).", reasonEn: "This week already uses job-search hours — a full day or eight hours a week (Art. 78)." };
  }
  return { ok: true, until: notice.until };
}

const clock = (v) => {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Job-search hours already taken (approved or pending) in the week of `day`. */
export function jobSearchHoursInWeek(employee, day, exceptId) {
  const wk = weekKey(day);
  return (employee?.otherRequests || [])
    .filter((r) => r?.id !== exceptId && r?.type === "permission" && r.jobSearch === true && ["approved", "pending"].includes(r.status) && weekKey(r.date) === wk)
    .reduce((sum, r) => {
      const a = clock(r.time);
      const b = clock(r.timeTo);
      return sum + (a != null && b != null && b > a ? (b - a) / 60 : 0);
    }, 0);
}

/**
 * Art. 78 — "ثماني ساعات أثناء الأسبوع": instead of the full day, up to eight hours in the week, split as
 * the worker wishes, during the employer's notice, told at least the day before. Not asked for approval.
 */
export function checkJobSearchHoursGate({ employee, date, time, timeTo, today, exceptId } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const notice = employerNoticeOf(employee, day);
  if (!notice) {
    return { ok: false, error: "NO_EMPLOYER_NOTICE", reason: "ساعات البحث عن عمل للعامل خلال مهلة إشعار صادرة من صاحب العمل فقط (المادة 78).", reasonEn: "Job-search hours apply only during a notice given by the employer (Art. 78)." };
  }
  const on = dateOnly(date);
  if (!on || on <= day) return { ok: false, error: "NOTICE_DAY_BEFORE", reason: "أشعر صاحب العمل في اليوم السابق على الأقل — اختر يوماً بعد اليوم (المادة 78).", reasonEn: "Tell the employer at least the day before (Art. 78)." };
  if (on > notice.until) return { ok: false, error: "AFTER_NOTICE", reason: `مهلة الإشعار تنتهي ${notice.until}.`, reasonEn: `The notice ends ${notice.until}.` };
  const a = clock(time);
  const b = clock(timeTo);
  if (a == null || b == null || b <= a) return { ok: false, error: "TIME_REQUIRED", reason: "حدد من الساعة وإلى الساعة.", reasonEn: "Set the hours." };
  const hours = (b - a) / 60;
  const fullDay = (employee?.leaveRequests || []).some((r) => r.id !== exceptId && String(r.type) === JOB_SEARCH_LEAVE && ["approved", "pending"].includes(r.status) && weekKey(r.startDate) === weekKey(on));
  if (fullDay) return { ok: false, error: "WEEK_USED", reason: "أخذت يوم البحث عن عمل كاملاً لهذا الأسبوع — إما اليوم أو الساعات (المادة 78).", reasonEn: "This week's full job-search day is taken (Art. 78)." };
  const used = jobSearchHoursInWeek(employee, on, exceptId);
  if (used + hours > 8 + 0.001) {
    return { ok: false, error: "WEEK_HOURS_OVER", reason: `ساعات البحث عن عمل لا تزيد على ثماني ساعات في الأسبوع — استخدمت ${used} والمطلوب ${hours} (المادة 78).`, reasonEn: `At most eight job-search hours a week — used ${used}, asking ${hours} (Art. 78).` };
  }
  return { ok: true, hours, left: 8 - used - hours, until: notice.until };
}

export function checkNightAvoidGate({ kind, from, until, file, gender } = {}) {
  const meta = NIGHT_AVOID_KINDS.find((k) => k.key === kind);
  if (!meta) return { ok: false, error: "KIND_REQUIRED", reason: "اختر سبب الطلب.", reasonEn: "Pick the reason." };
  if (meta.gender && gender && gender !== meta.gender) return { ok: false, error: "KIND_GENDER", reason: "هذه الحالة للحامل أو الأم.", reasonEn: "This case is for a pregnant worker or a mother." };
  if (!dateOnly(from)) return { ok: false, error: "FROM_REQUIRED", reason: "حدد تاريخ بدء الحاجة كما في الشهادة.", reasonEn: "Set the start date from the certificate." };
  if (dateOnly(until) && dateOnly(until) < dateOnly(from)) return { ok: false, error: "UNTIL_ORDER", reason: "تاريخ الانتهاء قبل البداية.", reasonEn: "The end is before the start." };
  if (!file) return { ok: false, error: "FILE_REQUIRED", reason: "أرفق الشهادة الطبية — من مركز صحي حكومي أو خاص معتمد في قائمة التأمين الطبي للمنشأة (دليل القرار 18632).", reasonEn: "Attach the medical certificate (decision 18632)." };
  return { ok: true, meta };
}

/** Active night-avoidance on `day` (approved request stamped on the profile). */
export function nightAvoidOn(profile, day) {
  const row = profile?.nightAvoid;
  const d = dateOnly(day);
  if (!row || !d) return null;
  if (dateOnly(row.from) && d < dateOnly(row.from)) return null;
  if (dateOnly(row.until) && d > dateOnly(row.until)) return null;
  return row;
}

export function checkDocumentsReturnGate({ reason } = {}) {
  if (String(reason || "").trim().length < 5) return { ok: false, error: "LIST_REQUIRED", reason: "اذكر الوثائق التي أودعتها (شهادات، جواز، رخصة…).", reasonEn: "List the documents you deposited." };
  return { ok: true };
}

/**
 * Implementing Regulations Art. 71 — grievance. The worker may grieve any decision, action or penalty
 * taken against him, in writing, within 30 days (official holidays not counted) of being told; he is
 * not harmed for it; he is told the result within 15 days (holidays not counted). If refused or not
 * decided in writing within 15 days, he may go to the labour court within 30 days (holidays not
 * counted) of the refusal or the end of the 15 days, whichever is sooner.
 */
export const GRIEVANCE_KINDS = [
  { key: "decision", ar: "قرار", en: "A decision" },
  { key: "action", ar: "إجراء", en: "An action" },
  { key: "penalty", ar: "جزاء", en: "A penalty" },
];

/** The day `n` days after `from`, skipping days `isHoliday(iso)` marks as official holidays. */
export function daysAfterExcludingHolidays(from, n, isHoliday) {
  const a = dateOnly(from);
  if (!a) return "";
  const d = new Date(`${a}T00:00:00Z`);
  let k = 0;
  let guard = 0;
  while (k < n && guard < 400) {
    guard += 1;
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    if (!(typeof isHoliday === "function" && isHoliday(iso))) k += 1;
  }
  return d.toISOString().slice(0, 10);
}

export function grievanceFileDeadline(notifiedOn, isHoliday) {
  return daysAfterExcludingHolidays(notifiedOn, 30, isHoliday);
}

export function grievanceReplyBy(filedOn, isHoliday) {
  return daysAfterExcludingHolidays(filedOn, 15, isHoliday);
}

export function checkGrievanceGate({ notifiedOn, grievanceKind, reason, today, isHoliday } = {}) {
  const told = dateOnly(notifiedOn);
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  if (!GRIEVANCE_KINDS.some((k) => k.key === grievanceKind)) {
    return { ok: false, error: "GRIEVANCE_KIND_REQUIRED", reason: "اختر ما تتظلم منه: قرار، أو إجراء، أو جزاء.", reasonEn: "Pick what you grieve: a decision, an action or a penalty." };
  }
  if (!told) return { ok: false, error: "NOTIFIED_REQUIRED", reason: "حدد تاريخ إبلاغك بما تتظلم منه — منه تبدأ مهلة الثلاثين يوماً (اللائحة م71).", reasonEn: "Set the date you were told — the 30-day window starts there (Regs Art. 71)." };
  if (told > day) return { ok: false, error: "NOTIFIED_FUTURE", reason: "تاريخ الإبلاغ في المستقبل.", reasonEn: "The notice date is in the future." };
  const last = grievanceFileDeadline(told, isHoliday);
  if (day > last) {
    return { ok: false, error: "GRIEVANCE_LATE", reason: `مضت ثلاثون يوماً — عدا العطل الرسمية — على إبلاغك (آخر يوم ${last}) — فات ميعاد التظلم لدى المنشأة (اللائحة م71).`, reasonEn: `Thirty days, official holidays aside, have passed (last day ${last}) — the window to grieve to the company has closed (Regs Art. 71).`, last };
  }
  if (String(reason || "").trim().length < 15) {
    return { ok: false, error: "REASON_REQUIRED", reason: "اكتب تظلمك: ما الذي اتُّخذ في حقك، ولماذا تراه غير صحيح.", reasonEn: "Write your grievance: what was taken against you and why you think it is wrong." };
  }
  return { ok: true, last, replyBy: grievanceReplyBy(day, isHoliday) };
}

/** Where a grievance stands: pending, overdue (no written decision in 15 days), accepted or refused — and the court window. */
export function grievanceState(row, today, isHoliday) {
  if (!row || row.type !== GRIEVANCE_TYPE) return null;
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const filed = dateOnly(row.date) || dateOnly(row.createdAt);
  const replyBy = dateOnly(row.grievanceReplyBy) || (filed ? grievanceReplyBy(filed, isHoliday) : "");
  const status = row.status || "pending";
  if (status === "approved") return { stage: "accepted", replyBy };
  const refusedOn = status === "rejected" ? dateOnly(row.reviewedAt) : "";
  const from = refusedOn && (!replyBy || refusedOn < replyBy) ? refusedOn : (status === "rejected" || (replyBy && day > replyBy) ? replyBy : "");
  if (!from) return { stage: "pending", replyBy };
  return { stage: status === "rejected" ? "refused" : "overdue", replyBy, courtBy: daysAfterExcludingHolidays(from, 30, isHoliday) };
}
