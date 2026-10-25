/**
 * «أنظمة الوزارة — نهاية الخدمة» — rows for the end-of-service case (manager / HR) and, read only,
 * for the leaving worker. Every status is read from the derivations the exit already runs:
 *   notice (Arts. 75–77)          deriveNotice · checkContractTermGate · deriveArt77Compensation
 *   job-search day (Art. 78)      employerNoticeOf
 *   leaving under Art. 81         the recorded exit reason
 *   the award (Arts. 84–85)       deriveEos (fraction on resignation, Art. 80 / 81 / 87)
 *   certificate + documents (64)  checkExitCloseoutGate — the close-out gate
 *   settlement (Art. 88)          deriveSettlementDeadline — one week / two weeks
 *   unused annual leave (111)     deriveEos.unusedAnnualDays / leaveCash
 *   comp-leave cash-out (Regs 22 bis) compPayout
 *   return ticket (model 11)      deriveReturnTicket — the close-out gate names it
 *   when the contract ends (model 57) for reference
 * Status: blocked = stops the file closing · violation = a deadline passed · waiting / alert = open,
 * inside its window or short · settled = met · void = for reference / not applicable.
 * Pure (node-testable); the panel only lays the rows out.
 */
import { formatDate } from "./dateFormat.js";
import { deriveEos, deriveSettlementDeadline, eosEndMs } from "./offboardingDerivations.js";
import { deriveNotice, TERMINATION_REASONS } from "./contractLawDerivations.js";
import { checkContractTermGate } from "./complianceDerivations.js";
import { checkExitCloseoutGate, payCycleOf } from "./laborProtectionGates.js";
import { deriveReturnTicket } from "./returnTicket.js";
import { compPayout } from "./compLeave.js";
import { employerNoticeOf } from "./rightsRequests.js";
import { ruleValue } from "./laborRules.js";
import { contractEndModelNote, repatriationModelNote } from "./implementingRegsNotes.js";

const info = (ar) => (ar ? "للعلم" : "For reference");
const money = (n, ar) => `${Math.round(Number(n) || 0).toLocaleString("en-US")} ${ar ? "ر.س" : "SAR"}`;
const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/** Exits with no notice period: Art. 80 / 81, death, the worker's force majeure, written agreement. */
const NO_NOTICE = new Set(["article_80", "article_81", "death", "worker_force_majeure", "mutual"]);

export const OFFBOARDING_MINISTRY_CARDS = (ar = true) => [
  {
    key: "labour",
    title: ar ? "نظام العمل — نهاية الخدمة" : "Labour Law — the end of service",
    scope: ar
      ? "الإشعار (75–77)، يوم البحث عن عمل (78)، الترك دون إشعار (81)، المكافأة (84–85)، الشهادة والوثائق (64)، التصفية (88)، أجر الإجازة (111)."
      : "Notice (75–77), the job-search day (78), leaving without notice (81), the award (84–85), certificate and documents (64), settlement (88), leave pay (111).",
  },
  {
    key: "regs",
    badge: ar ? "اللائحة" : "Regs",
    title: ar ? "اللائحة التنفيذية — الإجازة التعويضية" : "Implementing Regulations — compensatory leave",
    scope: ar ? "صرف أجر ما بقي من الإجازة التعويضية عند ترك العمل (م22 مكرر)." : "Paying out unused compensatory leave on leaving (Art. 22 bis).",
  },
  {
    key: "model",
    badge: ar ? "النموذج الموحد" : "Model reg.",
    title: ar ? "النموذج الموحد — انتهاء العقد والعودة" : "Model regulation — the end and the return",
    scope: ar ? "حالات انتهاء العقد (م57)، تذكرة العودة عند انتهاء الخدمة (م11)." : "The cases that end the contract (Art. 57), the return ticket (Art. 11).",
  },
];

/** The exit on file — the profile first (where ContractExitCard writes it), else the case. */
export function exitOnFile(employee = {}, caseRow = null) {
  return employee?.profile?.contractExit || caseRow?.contractExit || {};
}

/** An exit is under way once its statutory reason is recorded. */
export function hasRecordedExit(employee = {}, caseRow = null) {
  return Boolean(String(exitOnFile(employee, caseRow).reason || "").trim());
}

/** The award, leave and wage measured to the exit day — what the custody board computes, without Art. 96 averaging. */
export function offboardingEos(employee = {}, caseRow = null, today) {
  const profile = employee?.profile || {};
  const exit = exitOnFile(employee, caseRow);
  const nowMs = dateOnly(today) ? new Date(`${dateOnly(today)}T12:00:00`).getTime() : Date.now();
  return deriveEos({
    ...(caseRow || {}),
    hireDate: caseRow?.hireDate || profile.hireDate || employee?.hireDate || null,
    contractExit: exit,
    gender: profile.gender,
    profile,
    leaveRequests: employee?.leaveRequests || [],
  }, eosEndMs({ contractExit: exit }, nowMs));
}

function fractionLabel(eos, ar) {
  if (eos.art80) return ar ? "لا مكافأة — المادة 80" : "No award — Art. 80";
  if (eos.art81) return ar ? "كاملة — المادة 81" : "Full — Art. 81";
  if (eos.art87) return ar ? "كاملة — المادة 87" : "Full — Art. 87";
  if (eos.fraction === 0) return ar ? "لا مكافأة قبل سنتين (85)" : "None before two years (85)";
  if (eos.fraction === 1 / 3) return ar ? "ثلث المكافأة (85)" : "One-third (85)";
  if (eos.fraction === 2 / 3) return ar ? "ثلثا المكافأة (85)" : "Two-thirds (85)";
  return ar ? "كاملة" : "Full";
}

/**
 * employee — the file (profile.contractExit is the exit) · caseRow — the offboarding case when the
 * caller has it (status, custody) · eos / comp — pass the board's own figures to reuse them.
 */
export function offboardingMinistryRows({ employee = {}, caseRow = null, eos: eosIn = null, comp: compIn = null, today, ar = true } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const profile = employee?.profile || {};
  const exit = exitOnFile(employee, caseRow);
  const reason = String(exit.reason || "").trim();
  const hasExit = Boolean(reason);
  const completed = caseRow?.status === "completed" || profile.offboarding?.status === "completed";
  const reasonRow = TERMINATION_REASONS.find((row) => row.id === reason) || null;
  const eos = eosIn || offboardingEos(employee, caseRow, day);
  const endIso = eos.endDate || day;
  const settlement = deriveSettlementDeadline({
    reason,
    lastWorkDate: exit.effectiveDate || exit.lastDay,
    contractExit: exit,
    settlementPaidAt: exit.settlementPaidAt,
    today: day,
  });
  const paid = Boolean(settlement.closed);
  const rows = [];

  // Arts. 75–77 — notice on an open-ended contract; its shortfall is paid (76); Art. 77 for reference.
  const term = checkContractTermGate({ ...employee, today: day });
  const party = exit.party === "worker" ? "worker" : "employer";
  const notice = deriveNotice({
    employee,
    term: term.term,
    payCycle: payCycleOf(employee),
    party,
    noticeGivenDate: exit.noticeGivenDate || exit.noticeAt,
    lastWorkDate: exit.effectiveDate || exit.lastDay,
    onDate: day,
  });
  const art77 = eos.unlawful || {};
  rows.push({
    key: "labour-75",
    source: "labour",
    badge: ar ? "م 75–77" : "Arts. 75–77",
    title: ar
      ? "مهلة الإشعار في العقد غير المحدد المدة، ومن لم يراعها دفع أجرها للطرف الآخر"
      : "Notice on an open-ended contract; whoever skips it pays its wage to the other party",
    note: ar
      ? `الإشعار من صاحب العمل ${ruleValue("contract.notice.employerMonthlyDays", day)} يوماً ومن العامل ${ruleValue("contract.notice.workerMonthlyDays", day)} يوماً لذي الأجر الشهري (75)، والنقص يُعوَّض بأجر المدة (76).`
      : `Employer notice ${ruleValue("contract.notice.employerMonthlyDays", day)} days, worker ${ruleValue("contract.notice.workerMonthlyDays", day)} days on a monthly wage (75); a shortfall is paid at the wage (76).`,
    sub: !hasExit || !art77.applies
      ? undefined
      : art77.missing
        ? (art77.missing === "contract_type"
          ? (ar ? "تعويض المادة 77 لا يُحسب: نوع العقد غير مسجّل في الملف — أكمله." : "Art. 77 not computed: the contract type is missing — complete the file.")
          : (ar ? "تعويض المادة 77 لا يُحسب: العقد محدد المدة بلا تاريخ نهاية — أكمله." : "Art. 77 not computed: fixed term with no end date — complete the file."))
        : art77.direction === "to_employer"
          ? (ar ? `ترك العقد المحدد قبل نهايته بـ${art77.remainingDays} يوماً — لصاحب العمل أن يطالب بتعويض المادة 77 إن لم يكن للترك سبب مشروع (${money(art77.amount, ar)})، ولا يُحسم بلا حكم.` : `Fixed term left ${art77.remainingDays} days early — the employer may claim Art. 77 (${money(art77.amount, ar)}) if there was no legitimate reason; not set off without a ruling.`)
          : art77.basis === "contract"
            ? (ar ? `إن كان الإنهاء لغير سبب مشروع: التعويض المنصوص عليه في العقد ${money(art77.amount, ar)} (77) — خارج التصفية.` : `If the end had no valid reason: the contract's own compensation ${money(art77.amount, ar)} (77) — outside the settlement.`)
            : art77.term === "fixed"
              ? (ar ? `إن كان الإنهاء لغير سبب مشروع: أجر المدة الباقية (${art77.remainingDays} يوماً حتى ${formatDate(art77.contractEndDate, "ar", { day: "numeric", month: "long", year: "numeric" }) || art77.contractEndDate}) ${money(art77.amount, ar)}، وبحد أدنى أجر شهرين (77) — خارج التصفية.` : `If the end had no valid reason: wage for the ${art77.remainingDays} days left to ${art77.contractEndDate}, ${money(art77.amount, ar)}, at least two months (77) — outside the settlement.`)
              : (ar ? `إن كان الإنهاء لغير سبب مشروع: أجر 15 يوماً عن كل سنة خدمة ${money(art77.amount, ar)}، وبحد أدنى أجر شهرين (77) — خارج التصفية.` : `If the end had no valid reason: 15 days' wage per year of service, ${money(art77.amount, ar)}, at least two months (77) — outside the settlement.`),
    ...(term.term !== "indefinite"
      ? (hasExit && art77.applies && art77.term === "fixed" && art77.remainingDays > 0
        ? { status: "alert", pill: art77.direction === "to_employer"
          ? (ar ? `تُرك قبل نهاية مدته بـ${art77.remainingDays} يوماً (77)` : `Left ${art77.remainingDays} days before its term (77)`)
          : (ar ? `أُنهي قبل نهاية مدته بـ${art77.remainingDays} يوماً (77)` : `Ended ${art77.remainingDays} days before its term (77)`) }
        : { status: "void", pill: ar ? "محدد المدة — ينتهي بمدته" : "Fixed term — ends at its term" })
      : !hasExit
        ? { status: "void", pill: ar ? `${notice.required} يوماً عند الإنهاء` : `${notice.required} days at the end` }
        : NO_NOTICE.has(reason)
          ? { status: "void", pill: ar ? `لا إشعار — ${reasonRow?.ar || reason}` : `No notice — ${reasonRow?.en || reason}` }
          : notice.pending
            ? { status: "waiting", pill: ar ? "تاريخ الإشعار أو آخر يوم غير مسجّل" : "Notice date or last day not recorded" }
            : notice.shortfall > 0
              ? { status: "alert", pill: party === "worker"
                ? (ar ? `نقص ${notice.shortfall} يوماً من العامل — لصاحب العمل أجرها ${money(eos.noticePay?.amount || 0, ar)} (76)` : `${notice.shortfall} days short by the worker — the employer may claim ${money(eos.noticePay?.amount || 0, ar)} (76)`)
                : (ar ? `نقص ${notice.shortfall} يوماً — أجرها ${money(eos.noticePay?.amount || 0, ar)} في التصفية (76)` : `${notice.shortfall} days short — ${money(eos.noticePay?.amount || 0, ar)} in the settlement (76)`) }
              : { status: "settled", pill: ar ? `${notice.served} من ${notice.required} يوماً` : `${notice.served} of ${notice.required} days` }),
  });

  // Art. 78 — a paid day a week to look for work while the employer's notice runs.
  const jobSearch = employerNoticeOf(employee, day);
  rows.push({
    key: "labour-78",
    source: "labour",
    badge: ar ? "م 78" : "Art. 78",
    title: ar ? "يوم كامل بأجر في الأسبوع للبحث عن عمل، أو ثماني ساعات، خلال إشعار صاحب العمل" : "A paid day a week to look for work, or eight hours, during the employer's notice",
    note: ar ? "يختاره العامل ويُشعر به في اليوم السابق — يُطلب من «طلباتي» ولا يحتاج موافقة." : "The worker picks it and tells the employer the day before — filed in My requests, no approval needed.",
    ...(jobSearch
      ? { status: "waiting", pill: ar ? `قائم حتى ${jobSearch.until}` : `Running until ${jobSearch.until}` }
      : hasExit && party === "worker"
        ? { status: "void", pill: ar ? "لا ينطبق — الإشعار من العامل" : "N/a — the worker gave notice" }
        : hasExit && dateOnly(exit.effectiveDate) && dateOnly(exit.effectiveDate) < day
          ? { status: "void", pill: ar ? "انتهت المهلة" : "Notice over" }
          : { status: "void", pill: ar ? "عند إشعار صاحب العمل" : "On the employer's notice" }),
  });

  // Art. 81 — the worker may leave without notice and keep every right.
  rows.push({
    key: "labour-81",
    source: "labour",
    badge: ar ? "م 81" : "Art. 81",
    title: ar ? "ترك العامل العمل دون إشعار مع حفظ حقوقه كاملة في حالات المادة" : "Leaving without notice, every right kept, in the article's cases",
    note: ar ? "منها الإخلال بالعقد، والغش، والاعتداء، والخطر الجسيم — تُختار الحالة ويُكتب سندها عند التقديم." : "Breach of contract, fraud, assault, grave danger — the case and its basis are written on filing.",
    ...(reason === "article_81"
      ? { status: "settled", pill: ar ? "إنهاء وفق م81 — الحقوق محفوظة" : "Ended under Art. 81 — rights kept" }
      : { status: "void", pill: info(ar) }),
  });

  // Arts. 84–85 — the award on the last wage; resignation takes a fraction.
  rows.push({
    key: "labour-84",
    source: "labour",
    badge: ar ? "م 84–85" : "Arts. 84–85",
    title: ar ? "مكافأة نهاية الخدمة: نصف أجر شهر عن كل سنة من الخمس الأولى وأجر شهر عما بعدها" : "End-of-service award: half a month per year for five years, a month for each after",
    note: ar
      ? `عند الاستقالة: لا مكافأة لأقل من ${ruleValue("eos.resignation.oneThirdYears", day)} سنة، والثلث من ${ruleValue("eos.resignation.oneThirdYears", day)} إلى ${ruleValue("eos.resignation.twoThirdsYears", day)} سنوات، والثلثان إلى ${ruleValue("eos.resignation.fullYears", day)}، والكاملة بعدها (85). الترك وفق 81 أو لقوة قاهرة (87) يحفظها كاملة.`
      : "On resignation: none before two years, a third to five, two-thirds to ten, full after (85). Leaving under 81 or force majeure (87) keeps it whole.",
    sub: eos.preStart ? undefined : (ar ? `${Number(eos.years || 0).toFixed(1)} سنة خدمة · أجر ${money(eos.wage, ar)}` : `${Number(eos.years || 0).toFixed(1)} years · wage ${money(eos.wage, ar)}`),
    ...(eos.preStart
      ? { status: "void", pill: ar ? "لم تبدأ الخدمة" : "Not started" }
      : !hasExit
        ? { status: "void", pill: eos.article84Full > 0 ? (ar ? `تقدير اليوم ${money(eos.article84Full, ar)}` : `Today's estimate ${money(eos.article84Full, ar)}`) : info(ar) }
        : !(Number(eos.wage) > 0)
          ? { status: "waiting", pill: ar ? "الأجر غير مسجّل" : "Wage not recorded" }
          : { status: "settled", pill: `${money(eos.gratuity, ar)} · ${fractionLabel(eos, ar)}` }),
  });

  // Art. 64 — service certificate (no appraisal) and the deposited documents back: the close-out gate.
  const closeout = checkExitCloseoutGate({ serviceCertificateIssued: exit.serviceCertificateIssued, documentsReturned: exit.documentsReturned });
  rows.push({
    key: "labour-64",
    source: "labour",
    badge: ar ? "م 64" : "Art. 64",
    title: ar ? "شهادة الخدمة بلا تقييم، وإعادة ما أودعه العامل من شهادات ووثائق" : "A service certificate with no appraisal, and the deposited certificates and documents back",
    note: ar ? "شرط لإغلاق ملف إنهاء الخدمة — لا يُغلق دونهما." : "A condition for closing the exit file.",
    ...(!hasExit
      ? { status: "void", pill: ar ? "عند انتهاء الخدمة" : "At the end of service" }
      : completed || closeout.ok
        ? { status: "settled", pill: ar ? "صدرت الشهادة وأُعيدت الوثائق" : "Certificate issued, documents back" }
        : closeout.error === "SERVICE_CERTIFICATE_REQUIRED"
          ? { status: "blocked", pill: ar ? "مانع للإغلاق — الشهادة لم تُسجَّل" : "Blocks closing — no certificate" }
          : { status: "blocked", pill: ar ? "مانع للإغلاق — الوثائق لم تُعد" : "Blocks closing — documents not back" }),
  });

  // Art. 88 — settle within a week (employer ended) or two (worker ended).
  const employerDays = ruleValue("eos.settlement.employerDays", day);
  const workerDays = ruleValue("eos.settlement.workerDays", day);
  rows.push({
    key: "labour-88",
    source: "labour",
    badge: ar ? "م 88" : "Art. 88",
    title: ar
      ? `تصفية الحقوق خلال أسبوع (${employerDays} أيام) إن أنهى صاحب العمل العلاقة، وأسبوعين (${workerDays} يوماً) إن أنهاها العامل`
      : `Settle within a week (${employerDays} days) if the employer ended it, two weeks (${workerDays} days) if the worker did`,
    note: ar ? "تشمل المكافأة وأجر الإجازة والتعويضي وجزء الشهر، ويُحسم منها دين العمل بحدّه (91)." : "Award, leave pay, comp hours and the part month, less work debts within the cap (91).",
    ...(!hasExit
      ? { status: "void", pill: info(ar) }
      : settlement.pending
        ? { status: "waiting", pill: ar ? "آخر يوم غير مسجّل" : "Last day not recorded" }
        : settlement.closed
          ? (settlement.paidLate
            ? { status: "alert", pill: ar ? `صُرفت ${settlement.paidAt} — بعد المهلة ${settlement.due}` : `Paid ${settlement.paidAt} — after ${settlement.due}` }
            : { status: "settled", pill: ar ? `صُرفت ${settlement.paidAt}` : `Paid ${settlement.paidAt}` })
          : settlement.late
            ? { status: "violation", pill: ar ? `تجاوزت المهلة ${settlement.due}` : `Past the window ${settlement.due}` }
            : { status: "waiting", pill: ar ? `حتى ${settlement.due}` : `By ${settlement.due}` }),
  });

  // Art. 111 — unused annual leave, and the part year pro rata, paid on leaving.
  const unused = Number(eos.unusedAnnualDays) || 0;
  rows.push({
    key: "labour-111",
    source: "labour",
    badge: ar ? "م 111" : "Art. 111",
    title: ar ? "أجر أيام الإجازة السنوية التي لم يتمتع بها، وعن جزء السنة بنسبة ما قضاه" : "Pay for unused annual leave, and the part year pro rata",
    sub: !hasExit && !eos.preStart ? (ar ? `الرصيد اليوم ${unused} يوماً` : `Balance today ${unused} days`) : undefined,
    ...(!hasExit || eos.preStart
      ? { status: "void", pill: info(ar) }
      : unused <= 0
        ? { status: "settled", pill: ar ? "لا رصيد متبقٍ" : "No balance left" }
        : paid
          ? { status: "settled", pill: ar ? `${unused} يوماً صُرفت مع التصفية` : `${unused} days paid with the settlement` }
          : { status: "waiting", pill: ar ? `${unused} يوماً = ${money(eos.leaveCash, ar)} في التصفية` : `${unused} days = ${money(eos.leaveCash, ar)} in the settlement` }),
  });

  // Regs Art. 22 bis — compensatory leave not taken is paid when the worker leaves.
  const comp = compIn || compPayout(employee, endIso, eos.wage);
  const hours = Number(comp.hours) || 0;
  rows.push({
    key: "regs-22bis",
    source: "regs",
    badge: ar ? "اللائحة م22 مكرر" : "Regs Art. 22 bis",
    title: ar ? "أجر ما بقي من الإجازة التعويضية عن الإضافي إن ترك العمل قبل التمتع بها" : "Pay for compensatory leave not taken when the worker leaves",
    note: ar ? "بالأجر الفعلي للساعة — يدخل في التصفية النهائية." : "At the actual hourly wage — part of the final settlement.",
    sub: !hasExit && hours > 0 ? (ar ? `الرصيد اليوم ${hours} ساعة` : `Balance today ${hours} h`) : undefined,
    ...(!hasExit
      ? { status: "void", pill: info(ar) }
      : hours <= 0
        ? { status: "settled", pill: ar ? "لا رصيد تعويضي" : "No comp balance" }
        : paid
          ? { status: "settled", pill: ar ? `${hours} ساعة صُرفت مع التصفية` : `${hours} h paid with the settlement` }
          : { status: "waiting", pill: ar ? `${hours} ساعة = ${money(comp.amount, ar)} في التصفية` : `${hours} h = ${money(comp.amount, ar)} in the settlement` }),
  });

  // Model Art. 11 — the non-Saudi worker's return ticket; the close-out gate names it.
  const ticket = deriveReturnTicket(employee, exit);
  rows.push({
    key: "model-11",
    source: "model",
    badge: ar ? "النموذج الموحد م11" : "Model Art. 11",
    title: ar ? "تذكرة عودة غير السعودي عند انتهاء الخدمة على المنشأة (المادة 40/1)" : "A non-Saudi's return ticket at the end of service is on the company (Art. 40(1))",
    note: repatriationModelNote(ar),
    ...(ticket.state === "owed"
      ? { status: "blocked", pill: ar ? "مانع للإغلاق — مستحقة لم تُسجَّل" : "Blocks closing — owed, not recorded" }
      : ticket.state === "provided"
        ? { status: "settled", pill: ar ? `أُمِّنت ${ticket.ticket.providedAt}` : `Provided ${ticket.ticket.providedAt}` }
        : ticket.state === "excepted"
          ? { status: "settled", pill: ar ? "استثناء م11/4 مسجّل" : "Art. 11(4) exception" }
          : ticket.state === "na"
            ? { status: "void", pill: ar ? "لا ينطبق" : "Not applicable" }
            : ticket.state === "unknown" && hasExit
              ? { status: "waiting", pill: ar ? "الجنسية غير محسومة" : "Nationality unsettled" }
              : { status: "void", pill: ar ? "عند انتهاء الخدمة" : "At the end of service" }),
  });

  // Model Art. 57 — how a contract ends; the recorded reason reads under it.
  rows.push({
    key: "model-57",
    source: "model",
    badge: ar ? "النموذج الموحد م57" : "Model Art. 57",
    title: ar ? "حالات انتهاء عقد العمل" : "When the contract ends",
    note: contractEndModelNote(ar),
    sub: reasonRow ? (ar ? `المسجّل: ${reasonRow.ar}` : `Recorded: ${reasonRow.en}`) : undefined,
    status: "void",
    pill: info(ar),
  });

  return rows;
}
