import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  LABOR_RULES,
  HRSD_IMPLEMENTING_REGS_URL,
  citeLeaveType,
  citeRule,
  explainLeaveType,
  explainRule,
  announcedRamadanLength,
  isRamadanDay,
  isRamadanHoursSubject,
  lastRamadanDay,
  ramadanWindowOn,
  ruleAt,
  ruleValue,
  formatRuleFigure,
  addLaborDays,
  laborDayKey,
} from "../src/lib/laborRules.js";
import { officialHolidayOn } from "../src/lib/ummAlQuraCalendar.js";
import { deriveEidOverlap, mergeHolidayHit, weeklyRestDaysInsideEid } from "../src/lib/leaveEidOverlap.js";
import { annualBalanceSplit, chargeableAnnualDays, iddahPaidDays, iddahSpanFromEvent, isNursingSubject, remainingLeaveDays, statutoryLeaveFloor, leaveCiteRuleId, usedLeaveDays } from "../src/lib/leaveTypes.js";
import { articleOfficialText, BOE_LABOUR_LAW_URL, HRSD_LABOUR_LAW_EDITION, HRSD_LABOUR_LAW_PDF, normalizeArticleKey } from "../src/lib/laborArticleTexts.js";
import {
  actualShiftHours,
  addDays,
  checkNightCompensateOrReduceGate,
  checkWeekPublishGates,
  classifyNightAssignment,
  isNightShift,
  performsNightWork,
  weekDateKeys,
  weekStartDate,
} from "../src/lib/shiftWeek.js";
import {
  checkNightPregnancyBan,
  decision18632Gist,
  decision18632RightsNote,
  isNightWorker,
  nightMedicalYearSpanDays,
} from "../src/lib/decision18632.js";
import {
  inferStatutoryTone,
  statutoryArticleLabel,
  statutoryDecisionLabel,
  headerStatutoryGlow,
  quietNightHeaderCite,
  rosterNightRowMark,
  showStatutoryHeaderCite,
  statutoryChipStyle,
  statutoryGlowState,
  statutoryLabel,
} from "../src/lib/statutoryItem.js";
import { planNightDueNotifications } from "../src/lib/nightDueNotify.js";
import {
  LEAVE_ROSTER_BLOB,
  LEAVE_THRESHOLD_DAYS,
  LEAVE_TYPES,
  checkAnnualDeferGate,
  checkAnnualNoticeGate,
  checkCheckInLeaveGate,
  checkNoOtherEmployerGate,
  leaveNeedsArticle118Ack,
  leaveRequestsForEmployeeId,
  leaveRosterFromEmployees,
  mergeLeaveRequestLists,
} from "../src/lib/leaveDerivations.js";
import { ARTICLE_90_CAP, OT_RATE, overtimePay } from "../src/lib/payrollDerivations.js";
import { checkPublishGates, checkConsecutiveWorkGate } from "../src/lib/shiftDerivations.js";
import {
  checkHeatBanGate,
  checkProbationGate,
  checkResignationGate,
  checkTerminationGate,
  deriveArt55Conversion,
  deriveNotice,
  art55FilePatch,
  laborFilePatch,
  isHeatBanDate,
} from "../src/lib/contractLawDerivations.js";
import { checkAlterApprovedLeaveGate, checkApproveLeaveGate, checkAttachExamSatGate, checkExamSittingSettleGate, checkLeaveGenderGate, checkRejectLeaveGate, checkSeeLeaveDecisionGate, checkSubmitLeaveGate, deriveSickPayBand, examSatState, examStatuteOf, hasLeaveAttachment } from "../src/lib/leaveDerivations.js";
import { deriveInspectionPack } from "../src/lib/inspectionPackDerivations.js";

assert.equal(formatRuleFigure(1, "days", true), "1 يوم");
assert.equal(formatRuleFigure(5, "days", true), "5 أيام");
assert.equal(formatRuleFigure(1, "days", false), "1 day");
assert.equal(formatRuleFigure(1.5, "ratio", true), "1.5×");
assert.equal(formatRuleFigure(1, "hours", true), "1 ساعة");
assert.equal(formatRuleFigure(2, "hours", true), "ساعتان");
assert.equal(formatRuleFigure(5, "hours", true), "5 ساعات");
assert.equal(formatRuleFigure(12, "hours", true), "12 ساعة", "Art 101 in-force figure is 12 ساعة not 12 ساعات");
assert.equal(formatRuleFigure(12, "hours", false), "12 hours");
assert.equal(ruleValue("leave.annual.days"), 21);
assert.equal(ruleValue("leave.sick.days"), 120);
assert.equal(ruleValue("leave.attachment.thresholdDays"), 5);
assert.equal(ruleValue("hours.shift.ordinaryHours"), 8);
assert.equal(ruleValue("hours.week.ordinaryMaxHours"), 48);
assert.equal(ruleValue("hours.ot.premium"), 1.5);
assert.equal(ruleValue("payroll.deduction.capRatio"), 0.5);
assert.equal(LEAVE_THRESHOLD_DAYS, 5);
assert.equal(ARTICLE_90_CAP, 0.5);
assert.equal(OT_RATE, 1.5);
assert.equal(ruleValue("hours.grace.minutes"), 10);
assert.equal(ruleValue("hours.shift.ordinaryHours"), 8);
assert.equal(overtimePay(2400, 10), 150);

assert.equal(citeRule("payroll.deduction.capRatio")?.article, "93");
assert.equal(citeRule("hours.ot.premium")?.article, "107");
assert.equal(citeLeaveType("annual")?.article, "109");
assert.equal(citeLeaveType("sick")?.article, "117");
assert.equal(citeLeaveType("hajj")?.article, "114");
assert.equal(citeRule("hours.grace.minutes"), null);
assert.equal(citeRule("leave.attachment.thresholdDays"), null);
assert.equal(citeRule("payroll.wps.deadlineDayOfMonth"), null);
assert.equal(citeLeaveType("emergency"), null);
assert.equal(citeLeaveType("grant"), null);
assert.equal(citeRule("contract.indefinite.cite")?.article, "75");
assert.equal(citeRule("contract.fixed.cite")?.article, "55");
assert.equal(citeRule("contract.written.cite")?.article, "51");
assert.equal(citeRule("contract.workplace.transfer.cite")?.article, "58");
assert.equal(citeRule("contract.model.cite")?.article, "52");
assert.equal(citeRule("hours.rest.notWorkingHours.cite")?.article, "102");
assert.equal(citeRule("safety.hygiene.cite")?.article, "121");
assert.equal(citeRule("safety.precautions.cite")?.article, "122");
assert.equal(citeRule("safety.inform.cite")?.article, "123");
assert.equal(citeRule("payroll.wage.payment.cite")?.article, "90");
assert.equal(citeRule("payroll.loan.capRatio")?.article, "92");
assert.equal(ruleValue("payroll.loan.capRatio"), 0.1);
assert.equal(citeRule("eos.unusedLeave.cite")?.article, "111");
assert.equal(citeRule("eos.unlawful.cite")?.article, "77");
assert.equal(ruleValue("eos.unlawful.perYearDays"), 15);
assert.equal(ruleValue("eos.unlawful.minMonths"), 2);
assert.equal(citeRule("discipline.fines.register.cite")?.article, "73");
assert.equal(citeRule("discipline.record.eraseDays"), null);
assert.equal(ruleValue("discipline.record.eraseDays"), 365);
assert.equal(citeRule("contract.notice.jobSearchDaysPerWeek")?.article, "78");
assert.equal(ruleValue("contract.notice.jobSearchHoursPerWeek"), 8);
assert.equal(citeRule("hours.ot.exceptionDayHours")?.article, "106");
assert.equal(ruleValue("hours.ot.exceptionWeekHours"), 60);
assert.equal(ruleValue("hours.ot.art106.inventoryMaxDays"), 30);
assert.equal(citeRule("hours.ot.art106.inventoryMaxDays")?.article, "106");
assert.equal(citeRule("hours.ot.compLeave.cite", "2025-02-18"), null);
assert.equal(citeRule("hours.ot.compLeave.cite", "2025-02-19")?.article, "107");
assert.equal(citeRule("leave.annual.carry.cite")?.article, "110");
assert.equal(ruleValue("leave.annual.deferMaxDays"), 90);
assert.equal(citeRule("leave.eid.cite")?.article, "112");
assert.equal(citeRule("leave.noOtherEmployer.cite")?.article, "118");
assert.equal(ruleValue("leave.nursing.dailyMinutes"), 60);
assert.equal(citeRule("leave.nursing.dailyMinutes")?.article, "154");
assert.equal(citeRule("eos.art80.cite")?.article, "80");
assert.equal(citeRule("eos.art81.cite")?.article, "81");
assert.equal(citeRule("discipline.penalties.cite")?.article, "66");
assert.equal(citeRule("discipline.increment.maxMonths")?.article, "66");
assert.equal(ruleValue("discipline.increment.maxMonths"), 12);
assert.equal(citeRule("discipline.fine.maxDays")?.article, "70");
assert.equal(ruleValue("discipline.fine.maxDays"), 5);
assert.equal(citeRule("contract.probation.once.cite")?.article, "54");
assert.equal(citeRule("contract.notice.compensation.cite")?.article, "76");
assert.equal(citeRule("contract.maternity.noDismissal.cite")?.article, "155");
assert.equal(ruleValue("leave.exam.noticeDays"), 15);
assert.equal(ruleValue("eos.settlement.employerDays"), 7);
assert.equal(ruleValue("eos.settlement.workerDays"), 14);
assert.equal(ruleValue("payroll.wps.fileWindowDays"), 30);
assert.equal(citeRule("eos.gratuity.cite")?.article, "84");
assert.equal(explainRule("payroll.wps.deadlineDayOfMonth")?.article, null);
assert.ok(explainRule("payroll.wps.deadlineDayOfMonth")?.hintAr);
assert.equal(explainLeaveType("emergency")?.article, null);
assert.ok(explainLeaveType("annual")?.hintAr);

const annual = LEAVE_TYPES.find((t) => t.key === "annual");
assert.equal(annual.total, 21);
assert.equal(annual.article, "109");

const catalog = [
  ...LABOR_RULES.filter((r) => r.id !== "leave.annual.days"),
  { id: "leave.annual.days", value: 15, unit: "days", article: "109", source: "labour", effectiveFrom: "2005-01-01", effectiveTo: "2024-12-31", hintAr: "", hintEn: "" },
  { id: "leave.annual.days", value: 21, unit: "days", article: "109", source: "labour", effectiveFrom: "2025-01-01", hintAr: "", hintEn: "" },
];
assert.equal(ruleValue("leave.annual.days", "2024-06-01", catalog), 15);
assert.equal(ruleValue("leave.annual.days", "2026-09-06", catalog), 21);
assert.equal(citeRule("leave.annual.days", "2024-06-01", catalog)?.article, "109");

assert.equal(citeRule("hours.rest.maxConsecutiveHours")?.article, "101");
assert.equal(citeRule("hours.rest.duringShiftMinutes")?.article, "101");
assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "12:00" }).ok, true);
assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "15:00" }).ok, true);
assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "15:00", restMinutes: 0 }).ok, false);
assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "15:00", restMinutes: 0 }).error, "REST_5H_REQUIRED");
assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "19:00" }).ok, false);

const gates = checkPublishGates({
  year: 2026,
  monthIndex: 8,
  shiftTypes: [{ id: "a", start: "07:00", end: "15:00" }],
  assignments: {},
});
const hours = gates.checks.find((c) => c.id === "hours_48");
const doubleShift = gates.checks.find((c) => c.id === "double_shift");
const rest5 = gates.checks.find((c) => c.id === "rest_5h");
const weekly = gates.checks.find((c) => c.id === "weekly_rest");
assert.equal(hours.article, "98");
assert.ok(!doubleShift.article);
assert.equal(gates.checks.find((c) => c.id === "rest_11h"), undefined, "11h operational gap check is removed");
assert.equal(gates.checks.find((c) => c.id === "workplace_hours")?.article, "101");
assert.equal(rest5.article, "101");
assert.equal(rest5.ok, true);
assert.equal(weekly.article, "104");
assert.equal(gates.checks.find((c) => c.id === "coverage")?.article, undefined);
assert.equal(gates.checks.find((c) => c.id === "hours_106")?.article, "106");
assert.equal(gates.checks.find((c) => c.id === "hours_106")?.ok, true);

const noBreak = checkPublishGates({
  year: 2026,
  monthIndex: 8,
  shiftTypes: [{ id: "a", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 0 }],
  assignments: {},
});
assert.equal(noBreak.checks.find((c) => c.id === "rest_5h")?.ok, false);
assert.equal(noBreak.failed?.id, "rest_5h");

assert.equal(citeRule("contract.nonSaudi.fixed.cite")?.article, "37");
assert.equal(ruleValue("contract.nonSaudi.deemedTermDays"), 365);
assert.equal(ruleValue("contract.probation.maxDays"), 180);
assert.equal(citeRule("contract.probation.warnDays"), null);
assert.equal(ruleValue("contract.notice.employerMonthlyDays", "2024-06-01"), 60);
assert.equal(ruleValue("contract.notice.workerMonthlyDays", "2024-06-01"), 60);
assert.equal(ruleValue("contract.notice.workerMonthlyDays", "2025-02-18"), 60);
assert.equal(ruleValue("contract.notice.workerMonthlyDays", "2025-02-19"), 30);
assert.equal(ruleValue("contract.notice.workerMonthlyDays", "2026-09-06"), 30);
assert.equal(citeRule("leave.bereavement_sibling.days", "2024-06-01"), null);
assert.equal(citeRule("leave.bereavement_sibling.days", "2026-09-06")?.article, "113");
assert.equal(citeRule("contract.resignation.autoAcceptDays", "2024-06-01"), null);
assert.equal(citeRule("contract.resignation.autoAcceptDays", "2026-09-06")?.article, "79 مكرر");
assert.equal(citeRule("leave.maternity.mandatoryPostDays", "2024-06-01"), null);
assert.equal(ruleValue("leave.maternity.days", "2024-06-01"), 70);
assert.equal(ruleValue("leave.maternity.days", "2026-09-06"), 84);

const noticeWorker = deriveNotice({ term: "indefinite", payCycle: "monthly", party: "worker", onDate: "2026-09-06" });
assert.equal(noticeWorker.required, 30);
assert.equal(noticeWorker.cite?.article, "75");
assert.equal(noticeWorker.cite?.value, 30);
assert.match(noticeWorker.cite?.hintAr || "", /العامل/);
const noticeEmployer = deriveNotice({ term: "indefinite", payCycle: "monthly", party: "employer", onDate: "2026-09-06" });
assert.equal(noticeEmployer.required, 60);
assert.equal(noticeEmployer.cite?.value, 60);

const resignOldLaw = checkResignationGate({ submittedAt: "2024-06-01", today: "2024-07-15" });
assert.equal(resignOldLaw.ok, true);
assert.equal(resignOldLaw.deemedAccepted, false);
assert.equal(resignOldLaw.cite, null);
assert.equal(citeRule("discipline.listedOnly.cite")?.article, "67");
assert.equal(citeRule("discipline.repeat.cooloffDays")?.article, "68");
assert.equal(ruleValue("discipline.repeat.cooloffDays"), 180);
assert.equal(citeRule("discipline.charge.maxDays")?.article, "69");
assert.equal(ruleValue("discipline.charge.maxDays"), 30);
assert.equal(citeRule("discipline.hearing.cite")?.article, "71");
assert.equal(citeRule("discipline.workplace.cite")?.article, "70");
assert.match(citeRule("discipline.appeal.internalDays")?.textAr || "", /العطل الرسمية/);
assert.equal(ruleValue("contract.resignation.autoAcceptDays"), 30);
assert.equal(citeRule("hours.night.startHour"), null);
assert.equal(ruleValue("hours.night.rotateWeeks"), 13);
assert.equal(ruleValue("hours.night.rotateOrdinaryWeeks"), 4);
assert.equal(ruleValue("hours.night.pregnancyBanWeeks"), 24);
assert.equal(ruleAt("hours.night.workerHours")?.effectiveFrom, "2020-01-01");
assert.match(explainRule("hours.night.rotateWeeks")?.hintAr || "", /ثلاثة أشهر|شهر عادي|موافقة خطية|حق التراجع/);
assert.match(explainRule("hours.night.rotateWeeks")?.hintAr || "", /حق التراجع/);
assert.doesNotMatch(explainRule("hours.night.rotateWeeks")?.hintAr || "", /جدّد كل شهر|إعادة شهرية واجبة/);
assert.match(explainRule("hours.night.rotateWeeks")?.labelAr || "", /قرار 18632/);
assert.equal(statutoryArticleLabel("66", true), "المادة 66");
assert.equal(statutoryArticleLabel("66", false), "Art. 66");
assert.equal(statutoryDecisionLabel("18632", true), "قرار 18632");
assert.equal(statutoryLabel({ article: "109", ar: true }), "المادة 109");
assert.equal(statutoryLabel({ decisionId: "18632", ar: true }), "قرار 18632");
assert.equal(inferStatutoryTone({ leaveType: "annual" }), "entitlement");
assert.equal(inferStatutoryTone({ ruleId: "hours.rest.weeklyHours" }), "entitlement");
assert.equal(inferStatutoryTone({ ruleId: "hours.night.rotateWeeks", block: true }), "block");
assert.equal(inferStatutoryTone({ ruleId: "hours.week.ordinaryMaxHours" }), "entitlement");
assert.equal(inferStatutoryTone({ article: "109" }), "entitlement", "leave article stays a worker-right chip");
assert.equal(inferStatutoryTone({ decisionId: "18632" }), "entitlement", "قرار 18632 is a worker-right chip");
assert.equal(inferStatutoryTone({ article: "98" }), "entitlement", "Art. 98 cap is quiet cite when not due");
assert.equal(inferStatutoryTone({ article: "101" }), "entitlement", "Art. 101 cap is quiet cite when not due");
assert.equal(inferStatutoryTone({ article: "118" }), "entitlement", "Art. 118 duty is quiet cite when not due");
assert.match(decision18632RightsNote(true), /حق التراجع/);
assert.doesNotMatch(decision18632RightsNote(true), /جدّد كل شهر|إعادة شهرية واجبة/);
assert.doesNotMatch(decision18632RightsNote(false), /must renew monthly|monthly re-consent required|renew each month/i);
assert.equal(ruleAt("hours.night.afterMidnightHour"), null);
assert.match(explainRule("hours.night.workerHours")?.hintAr || "", /ثلاث ساعات/);
assert.doesNotMatch(explainRule("hours.night.workerHours")?.hintAr || "", /منتصف الليل/);
assert.equal(ruleValue("hours.night.compensateOrReduce"), 1);
assert.match(explainRule("hours.night.compensateOrReduce")?.hintAr || "", /تعويض|بدل|تخفيض/);
assert.match(explainRule("hours.night.compensateOrReduce")?.hintAr || "", /سحب|البدء من جديد|حرية/);
assert.equal(citeRule("hours.night.compensateOrReduce"), null);
assert.match(decision18632Gist(true), /23:00–06:00|23:00-06:00|23:00/);
assert.equal(isNightShift({ start: "15:00", end: "23:00" }), false, "evening ending 23:00 stays evening");
assert.equal(performsNightWork({ start: "15:00", end: "23:00" }), false, "ordinary hours end at 23:00 — no night minute");
assert.equal(performsNightWork({ start: "23:00", end: "01:30" }), true, "guide 1: 2.5h performs night work");
assert.equal(isNightWorker({ start: "23:00", end: "01:30" }), false, "guide 1: 2.5h is not a night worker");
assert.equal(classifyNightAssignment({ start: "17:00", end: "01:30" }).hours, 2.5, "guide 1 full shift: 17:00–01:30 is 2.5h in 23:00–06:00");
assert.equal(classifyNightAssignment({ start: "17:00", end: "01:30" }).worker, false);
assert.equal(classifyNightAssignment({ start: "23:00", end: "02:00" }).worker, true, "guide 2: through 02:00 is a night worker");
assert.equal(classifyNightAssignment({ start: "17:30", end: "02:00" }).hours, 3, "guide 2 full shift: 17:30–02:00 is 3h night");
assert.equal(classifyNightAssignment({ start: "17:30", end: "02:00" }).worker, true);
assert.equal(classifyNightAssignment({ start: "23:00", end: "07:30" }).hours, 7, "guide 3: 23:00–06:00 is 7h night, 06:00–07:30 ordinary");
assert.equal(classifyNightAssignment({ start: "23:00", end: "07:30" }).worker, true, "guide 3 is a night worker");
assert.equal(isNightWorker({ start: "04:00", end: "06:00" }), false, "guide 4: 04:00–06:00 is not a night worker");
assert.equal(performsNightWork({ start: "04:00", end: "06:00" }), true, "guide 4: still performs night work");
assert.equal(classifyNightAssignment({ start: "04:00", end: "12:30" }).hours, 2, "guide 4 full shift: 04:00–06:00 is 2h night");
assert.equal(classifyNightAssignment({ start: "04:00", end: "12:30" }).worker, false);
assert.equal(isNightWorker({ start: "04:00", end: "14:00" }), false, "guide 4 then morning is not a night worker");
assert.equal(isNightShift({ start: "18:00", end: "01:00" }), false, "evening crossing midnight is not a night worker");
assert.equal(performsNightWork({ start: "18:00", end: "01:00" }), true, "18:00–01:00 performs night work for minutes in 23:00–01:00");
assert.equal(isNightShift({ start: "00:15", end: "02:00" }), false, "short post-midnight punch is not a night worker");
assert.equal(performsNightWork({ start: "00:15", end: "02:00" }), true);
assert.equal(isNightShift({ start: "07:00", end: "15:00" }), false, "morning 07–15 is not night");
assert.equal(isNightShift({ start: "12:00", end: "20:00" }), false, "noon is not midnight");
assert.equal(checkNightPregnancyBan({
  employee: { profile: { expectedBirthDate: "2026-10-01" } },
  shift: { start: "23:00", end: "07:00" },
  onDate: "2026-09-06",
}).error, "NIGHT_PREGNANCY_BAN");
assert.equal(checkNightPregnancyBan({
  employee: { profile: { expectedBirthDate: "2027-02-01" } },
  shift: { start: "23:00", end: "07:00" },
  onDate: "2026-09-06",
}).error, "NIGHT_PREGNANCY_BAN", "21 weeks before birth is inside the 24-week ban");
assert.equal(checkNightPregnancyBan({
  employee: { profile: { expectedBirthDate: "2027-06-01" } },
  shift: { start: "23:00", end: "07:00" },
  onDate: "2026-09-06",
}).ok, true, "more than 24 weeks before birth is outside the ban");
assert.equal(checkNightPregnancyBan({
  employee: {
    profile: {
      expectedBirthDate: "2026-10-01",
      nightTransferImpossible: "yes",
      nightPayPreserved: "yes",
    },
  },
  shift: { start: "23:00", end: "00:00" },
  onDate: "2026-09-06",
}).error, "NIGHT_PREGNANCY_BAN", "automatic pregnancy ban has no reduced-hours exception");
assert.equal(checkNightPregnancyBan({
  employee: {
    profile: {
      nightPregnancyBanUntil: "2026-12-01",
      nightTransferImpossible: "yes",
      nightPayPreserved: "yes",
    },
  },
  shift: { start: "23:00", end: "00:00" },
  onDate: "2026-09-06",
}).via, "reduce_below_threshold", "extra medical certificate may reduce hours if transfer is impossible");
assert.equal(checkNightCompensateOrReduceGate({ shift: { start: "23:00", end: "07:00" } }).error, "NIGHT_COMPENSATE_OR_REDUCE");
assert.equal(checkNightCompensateOrReduceGate({ shift: { start: "23:00", end: "06:00" } }).via, "reduce");
assert.equal(checkNightCompensateOrReduceGate({
  shift: { start: "23:00", end: "07:00" },
  schedule: { nightCompensation: true },
}).via, "compensate");
assert.equal(checkNightCompensateOrReduceGate({ shift: { start: "15:00", end: "23:00" } }).ok, true);
assert.equal(citeRule("hours.heat.startHour"), null);

const probationOver = checkProbationGate({ probation: true, probationDays: 181 });
assert.equal(probationOver.ok, false);
assert.equal(probationOver.error, "PROBATION_OVER_MAX");

const probationRepeat = checkProbationGate({
  probation: true,
  probationDays: 90,
  probationPriorAtEmployer: true,
});
assert.equal(probationRepeat.ok, false);
assert.equal(probationRepeat.error, "PROBATION_REPEAT");

const probationRepeatOk = checkProbationGate({
  probation: true,
  probationDays: 90,
  probationPriorAtEmployer: true,
  probationRehireGapMonths: 6,
});
assert.equal(probationRepeatOk.ok, true);

const resignNone = checkResignationGate({});
assert.equal(resignNone.ok, false);
assert.equal(resignNone.error, "RESIGNATION_WRITTEN_REQUIRED");

const resignFuture = checkResignationGate({ submittedAt: "2026-08-01", deferredDate: "2026-10-01" });
assert.equal(resignFuture.ok, false);
assert.equal(resignFuture.error, "RESIGNATION_FUTURE_DATE");

const resignDeemed = checkResignationGate({ submittedAt: "2026-07-01", today: "2026-08-01" });
assert.equal(resignDeemed.ok, true);
assert.equal(resignDeemed.deemedAccepted, true);

const art80 = checkTerminationGate({ reason: "article_80" });
assert.equal(art80.ok, false);
assert.equal(art80.error, "ARTICLE_80_EVIDENCE_REQUIRED");

const art80ok = checkTerminationGate({ reason: "article_80", evidenceFiles: ["minutes.pdf"] });
assert.equal(art80ok.ok, true);

const art155 = checkTerminationGate({
  reason: "article_80",
  evidenceFiles: ["minutes.pdf"],
  employee: { profile: { gender: "female", pregnant: true } },
});
assert.equal(art155.ok, false);
assert.equal(art155.error, "MATERNITY_DISMISSAL_FORBIDDEN");

const art155ok = checkTerminationGate({
  reason: "resignation",
  employee: { profile: { gender: "female", pregnant: true } },
});
assert.equal(art155ok.ok, true);

const heat = checkHeatBanGate({ start: "13:00", end: "16:00", outdoor: true, summer: true });
assert.equal(heat.ok, false);
assert.equal(heat.error, "HEAT_BAN");

const heatIndoor = checkHeatBanGate({ start: "13:00", end: "16:00", outdoor: false, summer: true });
assert.equal(heatIndoor.ok, true);

const heatRota = checkPublishGates({
  year: 2026,
  monthIndex: 6,
  shiftTypes: [{ id: "out", start: "12:00", end: "16:00", outdoor: true }],
  assignments: {},
});
assert.equal(heatRota.checks.find((c) => c.id === "heat_ban")?.ok, false);

assert.equal(ruleValue("hours.ot.annualMaxHours"), 720);
assert.equal(citeRule("hours.ot.annualMaxHours"), null);
assert.equal(explainRule("hours.ot.annualMaxHours")?.source, "ministerial");
assert.equal(ruleValue("hours.ot.compLeave.minHoursPerOtHour"), 1.5);
assert.equal(ruleValue("hours.ot.compLeave.windowDays"), 60);
assert.equal(ruleValue("hours.ot.compLeave.maxDaysPerYear"), 30);
assert.equal(citeRule("hours.ot.compLeave.maxDaysPerYear"), null);
assert.equal(explainRule("hours.ot.compLeave.maxDaysPerYear")?.source, "ministerial");
assert.equal(ruleValue("leave.eid.fitrDays"), 4);
assert.equal(ruleValue("leave.eid.adhaDays"), 4);
assert.equal(ruleValue("leave.nationalDay.days"), 1);
assert.equal(ruleValue("leave.foundingDay.days"), 1);
assert.equal(citeRule("leave.eid.fitrDays"), null);
assert.equal(explainRule("leave.eid.fitrDays")?.source, "ministerial");
assert.equal(ruleValue("hours.heat.fromMonth"), 6);
assert.equal(ruleValue("hours.heat.fromDay"), 15);
assert.equal(ruleValue("hours.heat.toMonth"), 9);
assert.equal(ruleValue("hours.heat.toDay"), 15);
assert.equal(ruleValue("contract.casual.maxDays"), 90);
assert.equal(citeRule("contract.casual.maxDays"), null);
assert.equal(ruleValue("contract.pattern.flexible.nitaqatHours"), 160);
assert.equal(ruleValue("compliance.establishment.dataUpdateDays"), 10);
assert.ok(String(HRSD_IMPLEMENTING_REGS_URL).includes("2025-04"));

assert.equal(isHeatBanDate("2026-06-14"), false);
assert.equal(isHeatBanDate("2026-06-15"), true);
assert.equal(isHeatBanDate("2026-09-15"), true);
assert.equal(isHeatBanDate("2026-09-16"), false);

const heatSep10 = checkPublishGates({
  year: 2026,
  monthIndex: 8,
  shiftTypes: [{ id: "out", start: "12:00", end: "16:00", outdoor: true }],
  assignments: { "2026-09-10": { out: ["e1"] } },
});
assert.equal(heatSep10.checks.find((c) => c.id === "heat_ban")?.ok, false);

const heatSep20 = checkPublishGates({
  year: 2026,
  monthIndex: 8,
  shiftTypes: [{ id: "out", start: "12:00", end: "16:00", outdoor: true }],
  assignments: { "2026-09-20": { out: ["e1"] } },
});
assert.equal(heatSep20.checks.find((c) => c.id === "heat_ban")?.ok, true);

const heatJuneEarly = checkPublishGates({
  year: 2026,
  monthIndex: 5,
  shiftTypes: [{ id: "out", start: "12:00", end: "16:00", outdoor: true }],
  assignments: { "2026-06-10": { out: ["e1"] } },
});
assert.equal(heatJuneEarly.checks.find((c) => c.id === "heat_ban")?.ok, true);

assert.equal(deriveSickPayBand(10).band, "full");
assert.equal(deriveSickPayBand(40).band, "three_quarter");
assert.equal(deriveSickPayBand(100).band, "unpaid");
assert.equal(deriveSickPayBand(130).band, "exhausted");
assert.equal(statutoryLeaveFloor("sick", {}), 120);
assert.equal(ruleValue("leave.marriage.days"), 5);
assert.equal(ruleValue("leave.annual.afterFiveYearsDays"), 30);
assert.equal(ruleValue("leave.annual.noticeDays"), 30);
assert.equal(citeRule("leave.annual.noticeDays")?.article, "109");
assert.equal(citeRule("leave.annual.days")?.sourceUrl, BOE_LABOUR_LAW_URL);
assert.equal(citeRule("leave.annual.days")?.localPdf, HRSD_LABOUR_LAW_PDF);
assert.equal(articleOfficialText("109")?.localPdf, HRSD_LABOUR_LAW_PDF);
assert.equal(HRSD_LABOUR_LAW_EDITION.lastAmend, "M/44");
assert.equal(HRSD_LABOUR_LAW_EDITION.lastAmendGregorian, "2025-02-19");
assert.equal(
  existsSync(fileURLToPath(new URL("../public/labor-law.pdf", import.meta.url))),
  true,
);
assert.equal(ruleValue("leave.maternity.days", "2024-06-01"), 70);
assert.equal(ruleValue("leave.maternity.days", "2026-09-06"), 84);
assert.equal(citeLeaveType("maternity", "2026-09-06")?.article, "151");
assert.equal(citeRule("leave.maternity.disabledChildDays", "2026-09-06")?.article, "151");
assert.equal(citeRule("contract.fixed.continuation.cite")?.article, "55");
assert.equal(ruleValue("contract.fixed.maxConsecutiveRenewals"), 3);
assert.equal(ruleValue("contract.fixed.maxYearsBeforeIndefinite"), 4);
assert.equal(citeRule("safety.hygiene.cite")?.article, "121");
assert.equal(citeRule("safety.precautions.cite")?.article, "122");
assert.equal(citeRule("safety.inform.cite")?.article, "123");
assert.equal(citeRule("safety.ppe.cite")?.article, "123");
assert.equal(citeRule("hours.heat.startHour"), null);
assert.equal(explainRule("hours.heat.startHour")?.source, "ministerial");
assert.equal(citeRule("contract.pattern.flexible.cite"), null);
assert.equal(explainRule("contract.pattern.flexible.cite")?.source, "ministerial");
assert.equal(explainRule("compliance.ajeer.cite")?.source, "programme");
assert.equal(statutoryLeaveFloor("annual", { hireDate: "2026-01-01" }, "2026-08-01"), 21);
assert.equal(statutoryLeaveFloor("annual", { hireDate: "2018-01-01" }, "2026-08-01"), 30);
assert.equal(statutoryLeaveFloor("maternity", {}, "2024-06-01"), 70);
assert.equal(statutoryLeaveFloor("maternity", {}, "2026-09-06"), 84);
assert.equal(statutoryLeaveFloor("maternity", { maternityDisabledChild: true }, "2026-09-06"), 114);
assert.equal(leaveCiteRuleId("eid", {}, "2026-09-06"), "leave.eid.cite");
assert.equal(leaveCiteRuleId("eid", {}, "2026-09-23"), "leave.nationalDay.days");
assert.equal(leaveCiteRuleId("eid", {}, "2026-02-22"), "leave.foundingDay.days");
assert.match(explainRule("leave.nationalDay.days")?.hintAr || "", /إجازة اليوم الوطني/);
assert.match(explainRule("leave.foundingDay.days")?.hintAr || "", /إجازة يوم التأسيس/);
assert.equal(leaveCiteRuleId("iddah", { gender: "female" }, "2026-09-06"), "leave.iddah.days");
assert.equal(leaveCiteRuleId("iddah", { gender: "female", religion: "non_muslim" }, "2026-09-06"), "leave.iddah.nonMuslimDays");
assert.equal(statutoryLeaveFloor("iddah", { gender: "female" }, "2026-09-06"), 130);
assert.equal(statutoryLeaveFloor("iddah", { gender: "female", religion: "non_muslim" }, "2026-09-06"), 15);
assert.equal(iddahPaidDays({ gender: "female" }, "2026-01-01"), 130);
assert.equal(iddahSpanFromEvent("2026-01-01", { gender: "female" }).end, "2026-05-10");
assert.equal(iddahSpanFromEvent("2026-01-01", { gender: "female", religion: "non_muslim" }).end, "2026-01-15");
assert.equal(leaveCiteRuleId("annual", { hireDate: "2026-01-01" }, "2026-09-06"), "leave.annual.days");
assert.equal(leaveCiteRuleId("annual", { hireDate: "2018-01-01" }, "2026-09-06"), "leave.annual.afterFiveYearsDays");
assert.match(citeRule(leaveCiteRuleId("annual", { hireDate: "2018-01-01" }, "2026-09-06"), "2026-09-06")?.hintAr || "", /30/);
assert.match(citeRule("leave.maternity.days", "2026-09-06")?.hintAr || "", /اثنا عشر أسبوعاً/);
assert.equal(citeRule("contract.fixed.continuation.cite")?.article, "55");

const art55open = deriveArt55Conversion({
  contractType: "fixed",
  nationality: "سعودي",
  hireDate: "2020-01-01",
  contractEndDate: "2027-01-01",
  contractRenewalCount: 1,
  today: "2026-09-06",
  profile: { contractType: "fixed", hireDate: "2020-01-01", contractEndDate: "2027-01-01", contractRenewalCount: 1, nationality: "سعودي" },
});
assert.equal(art55open.converts, false);

const art55continued = deriveArt55Conversion({
  today: "2026-09-06",
  nationality: "سعودي",
  profile: { contractType: "fixed", hireDate: "2025-01-01", contractEndDate: "2026-01-01", contractRenewalCount: 0, nationality: "سعودي", contract: { type: "fixed", startDate: "2025-01-01", endDate: "2026-01-01" } },
});
assert.equal(art55continued.converts, true);
assert.equal(art55continued.trigger, "continued");

const art55nonSaudi = deriveArt55Conversion({
  today: "2026-09-06",
  profile: { contractType: "fixed", hireDate: "2020-01-01", contractEndDate: "2026-01-01", nationality: "مصري", contract: { type: "fixed", endDate: "2026-01-01" } },
});
assert.equal(art55nonSaudi.converts, false);
assert.equal(art55nonSaudi.nonSaudi, true);

const art55renew = deriveArt55Conversion({
  today: "2026-09-06",
  profile: { contractType: "fixed", hireDate: "2020-01-01", nationality: "سعودي", contractRenewalCount: 3, contract: { type: "fixed", startDate: "2020-01-01", endDate: "2026-01-01" } },
});
assert.equal(art55renew.converts, true);

const art55patch = art55FilePatch({
  nationality: "سعودي",
  profile: {
    contractType: "fixed",
    hireDate: "2025-01-01",
    contractEndDate: "2026-01-01",
    nationality: "سعودي",
    contract: { type: "fixed", startDate: "2025-01-01", endDate: "2026-01-01" },
  },
}, "2026-09-06");
assert.equal(art55patch.patch.contractType, "indefinite");
assert.equal(art55patch.patch.contract.endDate, "");
assert.equal(art55patch.patch.art55AppliedTrigger, "continued");

const art55future = art55FilePatch({
  nationality: "سعودي",
  profile: {
    contractType: "fixed",
    hireDate: "2025-01-01",
    nationality: "سعودي",
    contract: { type: "fixed", startDate: "2025-01-01", endDate: "2027-01-01" },
  },
}, "2026-09-06");
assert.equal(Object.keys(art55future.patch).length, 0);

const leaveFloors = laborFilePatch({
  profile: { gender: "female", hireDate: "2024-01-01", leaveTotals: { maternity: 70, annual: 10 } },
}, "2026-09-06");
assert.equal(leaveFloors.patch.leaveTotals.maternity, 84);
assert.equal(leaveFloors.patch.leaveTotals.annual, 21);

const pack = deriveInspectionPack({ employees: [{ id: 1 }], disciplinaryCases: [], safety: [{}], payrollRuns: [] });
assert.equal(pack.registers.find((r) => r.id === "safety")?.article, "122");
assert.equal(pack.registers.find((r) => r.id === "leave")?.article, "109");
assert.equal(pack.registers.find((r) => r.id === "discipline")?.article, "73");

assert.equal(LEAVE_TYPES.find((t) => t.key === "maternity")?.requiresFile, true);

assert.equal(
  checkApproveLeaveGate({ type: "annual", status: "pending", days: 0 }, false, { profile: { hireDate: "2024-01-15" }, requests: [] }).error,
  "LEAVE_DATES_REQUIRED",
);
assert.equal(
  checkApproveLeaveGate({ type: "annual", status: "pending", startDate: "2026-09-20", endDate: "2026-09-10" }, false, { profile: { hireDate: "2024-01-15" }, requests: [] }).error,
  "LEAVE_DATES_ORDER",
);

const overBalance = checkApproveLeaveGate(
  { type: "annual", startDate: "2026-08-01", endDate: "2026-08-25", days: 25, files: [{ name: "a.pdf" }], status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2026-01-01", leaveTotals: {} }, requests: [] },
);
assert.equal(overBalance.ok, false);
assert.equal(overBalance.error, "LEAVE_BALANCE_EXCEEDED");

const overBalanceNoFile = checkApproveLeaveGate(
  { type: "annual", startDate: "2026-08-01", endDate: "2026-08-25", days: 25, files: [], status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2026-01-01", leaveTotals: {} }, requests: [] },
);
assert.equal(overBalanceNoFile.error, "LEAVE_BALANCE_EXCEEDED");

assert.equal(citeRule("hours.rest.betweenShiftsHours"), null);
assert.ok(!LABOR_RULES.some((row) => row.id === "hours.rest.betweenShiftsHours"), "no product 11h inter-shift gap rule");
assert.equal(citeRule("hours.workplace.maxHours", "2014-01-01")?.value, 11);
assert.equal(ruleValue("hours.workplace.maxHours", "2026-09-06"), 12);
assert.equal(citeRule("leave.unpaid.suspendAfterDays")?.article, "116");
assert.equal(citeRule("contract.resignation.autoAcceptDays")?.article, "79 مكرر");
assert.equal(citeLeaveType("unpaid")?.article, "116");
assert.equal(ruleValue("leave.bereavement_sibling.days", "2026-09-06"), 3);
assert.equal(ruleValue("leave.hajj.maxDays"), 15);
assert.equal(ruleValue("hours.ramadan.ordinaryHours"), 6);
assert.equal(explainRule("hours.ramadan.compressedTwelveStay.cite")?.article, "98");
assert.equal(isRamadanDay("2026-03-01"), true);
assert.equal(isRamadanDay("2026-09-06"), false);
assert.equal(isRamadanDay("2026-03-19"), true);
assert.equal(isRamadanDay("2026-02-17"), false, "without a company calendar the day before Umm al-Qura is not guessed");
assert.equal(isRamadanDay("2026-02-17", {}), true, "until start is announced, the day before Umm al-Qura is Ramadan on the company calendar");
assert.equal(isRamadanDay("2026-02-17", { 2026: { ramadanStartShift: 0 } }), false, "announcing as predicted drops the extra early day");
assert.equal(isRamadanDay("2026-02-17", { 2026: { ramadanStartShift: -1 } }), true, "sighting one day early");
assert.equal(isRamadanDay("2026-02-18", { 2026: { ramadanStartShift: 1 } }), false, "sighting one day late drops the Umm al-Qura start");
assert.equal(isRamadanDay("2026-02-19", { 2026: { ramadanStartShift: 1 } }), true);
assert.equal(isRamadanDay("2026-03-19", { 2026: { ramadanLength: 29 } }), false);
assert.equal(isRamadanDay("2026-03-18", { 2026: { ramadanLength: 29 } }), true);
const late29 = { 2026: { ramadanStartShift: 1, ramadanLength: 29 } };
assert.equal(lastRamadanDay(ramadanWindowOn("2026-02-19", late29), late29), "2026-03-19");
assert.equal(officialHolidayOn("2026-03-20", late29)?.id, "fitr");
assert.equal(isRamadanDay("2025-03-30"), false);
assert.equal(lastRamadanDay(ramadanWindowOn("2025-03-10")), "2025-03-29");
assert.equal(officialHolidayOn("2026-09-23")?.id, "national");
assert.equal(officialHolidayOn("2026-03-20", { 2026: { ramadanLength: 29 } })?.id, "fitr");
assert.equal(officialHolidayOn("2025-06-05")?.id, "adha");
assert.equal(announcedRamadanLength(ramadanWindowOn("2025-03-10")), 29);
assert.match(
  readFileSync(new URL("../src/components/hr/LaborCalendarCard.jsx", import.meta.url), "utf8"),
  /بدأ يوماً قبل|announceRamadanStart/,
);

const workplaceGate = checkPublishGates({
  year: 2026,
  monthIndex: 7,
  shiftTypes: [
    { id: "am", label: "صباحي", start: "07:00", end: "15:00" },
    { id: "pm", label: "مسائي", start: "16:00", end: "20:00" },
  ],
  assignments: { "2026-08-02": { am: ["e1"], pm: ["e1"] } },
  namesById: { e1: "Emp" },
});
assert.equal(workplaceGate.checks.find((c) => c.id === "workplace_hours")?.ok, false);

const ramadanGate = checkPublishGates({
  year: 2026,
  monthIndex: 1,
  shiftTypes: [{ id: "am", label: "صباحي", start: "07:00", end: "15:00" }],
  assignments: { "2026-02-20": { am: ["e1"] } },
  namesById: { e1: "Emp" },
});
assert.equal(ramadanGate.checks.find((c) => c.id === "hours_ramadan")?.ok, false);
assert.equal(ramadanGate.checks.find((c) => c.id === "hours_ramadan")?.article, "98");
assert.equal(isRamadanHoursSubject({}), true, "empty religion stays under Art. 98");
assert.equal(isRamadanHoursSubject({ profile: { religion: "muslim" } }), true);
assert.equal(isRamadanHoursSubject({ profile: { religion: "non_muslim" } }), false);
assert.equal(isRamadanHoursSubject({ profile: { religion: "غير مسلم" } }), false);
assert.equal(checkPublishGates({
  year: 2026,
  monthIndex: 1,
  shiftTypes: [{ id: "am", label: "صباحي", start: "07:00", end: "15:00" }],
  assignments: { "2026-02-20": { am: ["e1"] } },
  namesById: { e1: "Emp" },
  employees: [{ id: "e1", profile: { religion: "non_muslim" } }],
}).checks.find((c) => c.id === "hours_ramadan")?.ok, true, "recorded non-Muslim is exempt from the Ramadan cap");

assert.equal(checkPublishGates({
  year: 2026,
  monthIndex: 1,
  shiftTypes: [
    { id: "ord", label: "عادي", start: "07:00", end: "15:00" },
    { id: "ram", label: "رمضان", start: "08:00", end: "14:00" },
  ],
  assignments: {
    "2026-02-16": { ord: ["e1"] },
    "2026-02-17": { ord: ["e1"] },
    "2026-02-18": { ram: ["e1"] },
    "2026-02-19": { ram: ["e1"] },
    "2026-02-20": { ram: ["e1"] },
    "2026-02-21": { ram: ["e1"] },
  },
  namesById: { e1: "Emp" },
}).checks.find((c) => c.id === "hours_ramadan")?.ok, true, "Art. 98 week cap counts Ramadan-day hours only, not mixed-week ordinary hours");

const hajjYoung = checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "a.pdf" }], status: "pending" },
  false,
  { profile: { hireDate: "2025-06-01" }, requests: [] },
);
assert.equal(hajjYoung.error, "HAJJ_SERVICE");

const hajjOk = checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "a.pdf" }], status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2023-01-01" }, requests: [] },
);
assert.equal(hajjOk.ok, true);

const hajjLong = checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-20", days: 20, files: [{ name: "a.pdf" }], status: "pending" },
  false,
  { profile: { hireDate: "2020-01-01" }, requests: [] },
);
assert.equal(hajjLong.error, "HAJJ_OVER_MAX");

const hajjShort = checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-08", days: 8, files: [{ name: "a.pdf" }], status: "pending" },
  false,
  { profile: { hireDate: "2020-01-01" }, requests: [] },
);
assert.equal(hajjShort.ok, false);
assert.equal(hajjShort.error, "HAJJ_UNDER_MIN");
assert.equal(checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "a.pdf" }], status: "pending", noOtherEmployerAck: true },
  { profile: { hireDate: "2020-01-01", religion: "non_muslim" }, requests: [] },
).error, "LEAVE_RELIGION");

const paternityLate = checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-15", endDate: "2026-09-17", days: 3, files: [], status: "pending", eventDate: "2026-09-01" },
  false,
  { profile: { gender: "male" }, requests: [] },
);
assert.equal(paternityLate.error, "PATERNITY_WINDOW");

const paternityLong = checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-01", endDate: "2026-09-08", days: 8, files: [], status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  false,
  { profile: { gender: "male" }, requests: [] },
);
assert.equal(paternityLong.error, "PATERNITY_DAYS");

const paternityOk = checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-03", endDate: "2026-09-05", days: 3, files: [], status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  false,
  { profile: { gender: "male" }, requests: [] },
);
assert.equal(paternityOk.ok, true);
assert.equal(checkLeaveGenderGate({ type: "paternity" }, { profile: { gender: "male" } }).ok, true);
assert.equal(checkLeaveGenderGate({ type: "paternity" }, { profile: { gender: "female" } }).error, "LEAVE_GENDER");
assert.equal(checkLeaveGenderGate({ type: "maternity" }, { profile: { gender: "male" } }).error, "LEAVE_GENDER");
assert.equal(checkLeaveGenderGate({ type: "maternity" }, { profile: {} }).error, "LEAVE_GENDER_REQUIRED");
assert.equal(checkApproveLeaveGate(
  { type: "maternity", startDate: "2026-08-20", endDate: "2026-11-11", days: 84, files: [{ name: "med.pdf" }], status: "pending", eventDate: "2026-09-01" },
  true,
  { profile: { gender: "male" }, requests: [] },
).error, "LEAVE_GENDER");
assert.equal(checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-03", endDate: "2026-09-05", days: 3, files: [], status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  false,
  { profile: { gender: "female" }, requests: [] },
).error, "LEAVE_GENDER");
assert.equal(checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 6, files: [{ name: "a.pdf" }], status: "pending" },
  false,
  { profile: { hireDate: "2020-01-01" }, requests: [] },
).ok, true, "Hajj min/max uses the calendar span including Eid, not holiday-stripped days");
assert.equal(checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-08", days: 10, files: [{ name: "a.pdf" }], status: "pending" },
  false,
  { profile: { hireDate: "2020-01-01" }, requests: [] },
).error, "HAJJ_UNDER_MIN");

const marriageMissing = checkApproveLeaveGate(
  { type: "marriage", startDate: "2026-09-01", endDate: "2026-09-05", days: 5, files: [], status: "pending" },
  false,
  { profile: {}, requests: [] },
);
assert.equal(marriageMissing.ok, false);
assert.equal(marriageMissing.error, "EVENT_DATE_REQUIRED");

const marriageLate = checkApproveLeaveGate(
  { type: "marriage", startDate: "2026-09-03", endDate: "2026-09-07", days: 5, files: [], status: "pending", eventDate: "2026-09-01" },
  false,
  { profile: {}, requests: [] },
);
assert.equal(marriageLate.ok, false);
assert.equal(marriageLate.error, "EVENT_LEAVE_WINDOW");

const marriageOk = checkApproveLeaveGate(
  { type: "marriage", startDate: "2026-09-01", endDate: "2026-09-05", days: 5, files: [], status: "pending", eventDate: "2026-09-01", noOtherEmployerAck: true },
  false,
  { profile: {}, requests: [] },
);
assert.equal(marriageOk.ok, true);

const sickYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2026-09-01", endDate: "2026-10-10", days: 40, files: [{ name: "med.pdf" }], status: "pending", noOtherEmployerAck: true },
  true,
  { profile: {}, requests: [] },
);
assert.equal(sickYear.ok, true);

const sickOverYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2026-09-01", endDate: "2026-12-31", days: 122, files: [{ name: "med.pdf" }], status: "pending", noOtherEmployerAck: true },
  true,
  { profile: {}, requests: [] },
);
assert.equal(sickOverYear.ok, false);
assert.equal(sickOverYear.error, "LEAVE_BALANCE_EXCEEDED");

const priorSick = [{ type: "sick", status: "approved", startDate: "2025-01-01", endDate: "2025-04-10", days: 100 }];
assert.equal(usedLeaveDays(priorSick, "sick", "2025-03-01"), 95);
assert.equal(usedLeaveDays(priorSick, "sick", "2026-09-01"), 0);

assert.equal(officialHolidayOn("2026-05-26")?.id, "adha");
assert.equal(chargeableAnnualDays("2026-05-24", "2026-06-02"), 6);
assert.equal(chargeableAnnualDays("2026-09-21", "2026-09-25"), 4);
const eidInsideAnnual = [{ type: "annual", status: "approved", startDate: "2026-05-24", endDate: "2026-06-02", days: 10 }];
assert.equal(usedLeaveDays(eidInsideAnnual, "annual", "2026-09-16", "2026-01-01"), 6);
assert.equal(remainingLeaveDays({ hireDate: "2026-01-01" }, eidInsideAnnual, "annual", "2026-09-16"), 15);
const nationalInsideAnnual = [{ type: "annual", status: "approved", startDate: "2026-09-21", endDate: "2026-09-25", days: 5 }];
assert.equal(usedLeaveDays(nationalInsideAnnual, "annual", "2026-09-25", "2026-01-01"), 4);
const sickOverEid = [{ type: "sick", status: "approved", startDate: "2026-05-24", endDate: "2026-06-02", days: 10 }];
assert.equal(usedLeaveDays(sickOverEid, "sick", "2026-06-02"), 6);
assert.deepEqual(weeklyRestDaysInsideEid("2026-05-26", "2026-05-29"), ["2026-05-29"]);
const annualOverlap = deriveEidOverlap({ start: "2026-05-24", end: "2026-06-02", type: "annual" });
assert.equal(annualOverlap.extendAnnualDays, 4);
assert.equal(annualOverlap.compensateRestDays, 1);
assert.equal(annualOverlap.chargeable, 6);
assert.equal(mergeHolidayHit({ id: "fitr", from: "2026-03-20" }, { id: "national", from: "2026-03-20" }).absorbedCivic, "national");
assert.equal(mergeHolidayHit({ id: "fitr", from: "2026-03-20" }, { id: "national", from: "2026-03-20" }).id, "fitr");
const eidRequestOk = checkApproveLeaveGate(
  { type: "eid", startDate: "2026-05-26", endDate: "2026-05-29", days: 4, status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2026-01-01" }, requests: [] },
);
assert.equal(eidRequestOk.ok, true);
const eidNotHoliday = checkApproveLeaveGate(
  { type: "eid", startDate: "2026-09-11", endDate: "2026-09-12", days: 2, status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2026-01-01" }, requests: [] },
);
assert.equal(eidNotHoliday.error, "OFFICIAL_HOLIDAY_DATES");
const eidMix = checkApproveLeaveGate(
  { type: "eid", startDate: "2026-09-23", endDate: "2026-09-24", days: 2, status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2026-01-01" }, requests: [] },
);
assert.equal(eidMix.error, "OFFICIAL_HOLIDAY_DATES");
const eidOverAnnual = checkApproveLeaveGate(
  { type: "eid", startDate: "2026-05-26", endDate: "2026-05-29", days: 4, status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2026-01-01" }, requests: eidInsideAnnual },
);
assert.equal(eidOverAnnual.error, "LEAVE_OVERLAP");
const annualOverEid = checkApproveLeaveGate(
  { type: "annual", startDate: "2026-05-24", endDate: "2026-06-02", days: 10, status: "pending", noOtherEmployerAck: true },
  false,
  { profile: { hireDate: "2026-01-01" }, requests: [{ type: "eid", status: "approved", startDate: "2026-05-26", endDate: "2026-05-29", days: 4 }] },
);
assert.equal(annualOverEid.error, "LEAVE_OVERLAP");

const iddahFile = [{ name: "death.pdf", url: "/death.pdf" }];
const iddahMuslim = { gender: "female" };
assert.equal(checkLeaveGenderGate({ type: "iddah" }, { profile: { gender: "male" } }).error, "LEAVE_GENDER");
assert.equal(checkLeaveGenderGate({ type: "iddah" }, { profile: {} }).error, "LEAVE_GENDER_REQUIRED");
assert.equal(checkLeaveGenderGate({ type: "iddah" }, { profile: iddahMuslim }).ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, files: iddahFile, status: "pending", noOtherEmployerAck: true },
  { profile: iddahMuslim, requests: [] },
).error, "EVENT_DATE_REQUIRED");
assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-02", endDate: "2026-05-11", days: 130, files: iddahFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: iddahMuslim, requests: [] },
).error, "EVENT_LEAVE_WINDOW");
assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-04-01", days: 91, files: iddahFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: iddahMuslim, requests: [] },
).error, "IDDAH_UNDER_MIN");
assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-06-01", days: 152, files: iddahFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: iddahMuslim, requests: [] },
).error, "IDDAH_OVER_PAID");
const iddahPregnant = checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-06-01", days: 152, files: iddahFile, status: "pending", eventDate: "2026-01-01", iddahPregnant: true, noOtherEmployerAck: true },
  { profile: iddahMuslim, requests: [] },
);
assert.equal(iddahPregnant.ok, true);
assert.equal(iddahPregnant.warning, "IDDAH_UNPAID_TAIL");
const iddahOk = checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, files: iddahFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: iddahMuslim, requests: [] },
);
assert.equal(iddahOk.ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-01-15", days: 15, files: iddahFile, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: { gender: "female", religion: "non_muslim" }, requests: [] },
).ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-05-10", days: 130, status: "pending", eventDate: "2026-01-01", noOtherEmployerAck: true },
  { profile: iddahMuslim, requests: [] },
).error, "ATTACHMENT_REQUIRED");
assert.equal(checkApproveLeaveGate(
  { type: "iddah", startDate: "2026-01-01", endDate: "2026-01-20", days: 20, files: iddahFile, status: "pending", eventDate: "2026-01-01", iddahPregnant: true, noOtherEmployerAck: true },
  { profile: { gender: "female", religion: "non_muslim" }, requests: [] },
).error, "IDDAH_OVER_PAID");
const sickPriorYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2026-09-01", endDate: "2026-10-10", days: 40, files: [{ name: "med.pdf" }], status: "pending", noOtherEmployerAck: true },
  true,
  { profile: {}, requests: priorSick },
);
assert.equal(sickPriorYear.ok, true);
const sickSameYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2025-06-01", endDate: "2025-07-10", days: 40, files: [{ name: "med.pdf" }], status: "pending", noOtherEmployerAck: true },
  true,
  { profile: {}, requests: priorSick },
);
assert.equal(sickSameYear.ok, false);
assert.equal(sickSameYear.error, "LEAVE_BALANCE_EXCEEDED");

const maternityMissing = checkApproveLeaveGate(
  { type: "maternity", startDate: "2026-09-01", endDate: "2026-11-23", days: 84, files: [{ name: "med.pdf" }], status: "pending" },
  true,
  { profile: { gender: "female" }, requests: [] },
);
assert.equal(maternityMissing.ok, false);
assert.equal(maternityMissing.error, "MATERNITY_EVENT_DATE_REQUIRED");

const maternityShort = checkApproveLeaveGate(
  { type: "maternity", startDate: "2026-09-01", endDate: "2026-09-20", days: 20, files: [{ name: "med.pdf" }], status: "pending", eventDate: "2026-09-01" },
  true,
  { profile: { gender: "female" }, requests: [] },
);
assert.equal(maternityShort.ok, false);
assert.equal(maternityShort.error, "MATERNITY_POST_BIRTH");

const maternityOk = checkApproveLeaveGate(
  { type: "maternity", startDate: "2026-08-20", endDate: "2026-11-11", days: 84, files: [{ name: "med.pdf" }], status: "pending", eventDate: "2026-09-01" },
  true,
  { profile: { gender: "female" }, requests: [] },
);
assert.equal(maternityOk.ok, true);

const maternityEarly = checkApproveLeaveGate(
  { type: "maternity", startDate: "2026-07-20", endDate: "2026-11-11", days: 115, files: [{ name: "med.pdf" }], status: "pending", eventDate: "2026-09-01" },
  true,
  { profile: { gender: "female" }, requests: [] },
);
assert.equal(maternityEarly.ok, false);
assert.equal(maternityEarly.error, "MATERNITY_PRE_WINDOW");

const examSoon = checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", days: 3, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-01" },
  true,
);
assert.equal(examSoon.ok, false);
assert.equal(examSoon.error, "EXAM_NOTICE");
assert.match(examSoon.reason, /15/);
assert.match(examSoon.reason, /المادة 115/);
assert.match(examSoon.reason, /يوم الورقة أو اليوم التالي/);
assert.equal(examSoon.articleText, examStatuteOf().articleText);

const examOk = checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-20", endDate: "2026-09-21", days: 2, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-01", noOtherEmployerAck: true },
  true,
);
assert.equal(examOk.ok, true);
assert.equal(examOk.via, "notice");
assert.match(explainRule("leave.exam.noticeDays")?.hintAr || "", /يوم الورقة أو اليوم التالي/);

const examLatePaper = checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", days: 3, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-06", examNoticeIssuedAt: "2026-09-06", noOtherEmployerAck: true },
  true,
);
assert.equal(examLatePaper.ok, true, "late timetable paper is accepted on the issue day");
assert.equal(examLatePaper.via, "late_notice");
assert.equal(examLatePaper.examNoticeIssuedAt, "2026-09-06");

const examLateNextDay = checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", days: 3, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-07", examNoticeIssuedAt: "2026-09-06" },
  true,
);
assert.equal(examLateNextDay.ok, true);
assert.equal(examLateNextDay.via, "late_notice");

assert.equal(checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", days: 3, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-08", examNoticeIssuedAt: "2026-09-06" },
  true,
).error, "EXAM_NOTICE_DELAY");

assert.equal(checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", days: 3, status: "pending", createdAt: "2026-09-06", examNoticeIssuedAt: "2026-09-06" },
  true,
).error, "EXAM_NOTICE_PROOF");

assert.equal(checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-20", endDate: "2026-09-21", days: 2, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-10", examNoticeIssuedAt: "2026-09-01" },
  true,
).error, "EXAM_NOTICE", "paper issued 15+ days ahead — worker notice stays");

assert.equal(checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", days: 3, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-06", examNoticeIssuedAt: "2026-09-07" },
  true,
).error, "EXAM_NOTICE_DATE");

const examPaper = { name: "sit.pdf", url: "/sit.pdf" };
assert.equal(checkAttachExamSatGate({ type: "annual", startDate: "2026-09-10", status: "approved" }, examPaper).error, "EXAM_SAT_TYPE");
assert.equal(checkAttachExamSatGate({ type: "exam", startDate: "2026-09-25", endDate: "2026-09-26", status: "approved" }, examPaper, { onDate: "2026-09-20" }).error, "EXAM_SAT_BEFORE");
assert.equal(checkAttachExamSatGate({ type: "exam", startDate: "2026-09-10", status: "rejected" }, examPaper, { onDate: "2026-09-20" }).error, "EXAM_SAT_CLOSED");
assert.equal(checkAttachExamSatGate({ type: "exam", startDate: "2026-09-10", status: "approved" }, {}, { onDate: "2026-09-20" }).error, "EXAM_SAT_FILE");
assert.equal(checkAttachExamSatGate({ type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", status: "approved" }, examPaper, { onDate: "2026-09-10" }).ok, true);
assert.equal(examSatState({ type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", status: "approved" }, { onDate: "2026-09-13" }).due, true);
assert.equal(examSatState({ type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", status: "approved", examSatFile: examPaper }, { onDate: "2026-09-13" }).attached, true);
assert.equal(hasLeaveAttachment({ files: [{ name: "sit.pdf", url: "/sit.pdf", kind: "exam_sat" }] }), false, "sitting proof is not the timetable paper");
assert.equal(hasLeaveAttachment({ files: [{ name: "times.pdf", url: "/times.pdf", kind: "exam_notice" }] }), true);

const examRefuseOk = checkRejectLeaveGate(
  { type: "exam", startDate: "2026-09-20", endDate: "2026-09-21", days: 2, files: [{ name: "exam.pdf", url: "/exam.pdf" }], status: "pending", createdAt: "2026-09-01" },
  { nextStatus: "rejected", actor: "manager" },
);
assert.equal(examRefuseOk.error, "EXAM_EMPLOYER_REFUSE");
assert.match(examRefuseOk.reason, /صاحب العمل لا يرفض/);
assert.equal(examRefuseOk.articleText, examStatuteOf().articleText);
assert.equal(checkRejectLeaveGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", days: 3, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-01" },
  { nextStatus: "rejected", actor: "manager" },
).ok, true, "short notice does not qualify — refuse is not the 115 block");

assert.match(articleOfficialText("115")?.ar || "", /الوثائق المؤيدة لطلب الإجازة/);
assert.match(examStatuteOf().articleText, /خمسة عشر يوماً/);
assert.equal(ruleValue("leave.exam.noticeDays"), 15);
const examStaleInstitutionFlag = checkSubmitLeaveGate({
  type: "exam",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  days: 3,
  files: [{ name: "exam.pdf", url: "/exam.pdf" }],
  status: "pending",
  createdAt: "2026-09-01",
  examInstitutionRefused: true,
  noOtherEmployerAck: true,
});
assert.equal(examStaleInstitutionFlag.ok, true, "an old institution-refusal flag is not a gate");
assert.notEqual(examStaleInstitutionFlag.error, "EXAM_INSTITUTION_REFUSED");
assert.notEqual(examStaleInstitutionFlag.examPayFrom, "paid", "first-exam without study_consent is not stored as paid");
assert.ok(["annual", "unpaid"].includes(examStaleInstitutionFlag.examPayFrom || ""), "115/2 pay is annual or unpaid");
assert.equal(examStaleInstitutionFlag.examLeaveTrack, "annual_or_unpaid");
assert.equal(checkApproveLeaveGate({
  type: "exam",
  startDate: "2026-09-10",
  endDate: "2026-09-12",
  days: 3,
  files: [{ name: "exam.pdf" }],
  status: "pending",
  createdAt: "2026-09-06",
  examNoticeIssuedAt: "2026-09-06",
  examInstitutionRefused: true,
  noOtherEmployerAck: true,
}, true).via, "late_notice", "late paper+date is a notice exception; an old institution flag is ignored");
assert.equal(checkRejectLeaveGate({
  type: "exam",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  days: 3,
  files: [{ name: "exam.pdf", url: "/exam.pdf" }],
  status: "pending",
  createdAt: "2026-09-01",
  examInstitutionRefused: true,
}, { nextStatus: "rejected", actor: "manager" }).error, "EXAM_EMPLOYER_REFUSE", "a qualifying 115 file stays unrefusable even if an old institution flag is present");

const examSitOpen = checkExamSittingSettleGate(
  { type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", status: "approved" },
  { onDate: "2026-09-10" },
);
assert.equal(examSitOpen.error, "EXAM_SAT_UNSETTLED");
assert.equal(examSatState({ type: "exam", startDate: "2026-09-10", endDate: "2026-09-12", status: "approved" }, { onDate: "2026-09-10" }).settled, false);

const submitBlocked = checkSubmitLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-08", days: 8 },
  { profile: { hireDate: "2020-01-01" }, requests: [] },
);
assert.equal(submitBlocked.error, "HAJJ_UNDER_MIN");

const unpaidWarn = checkApproveLeaveGate(
  { type: "unpaid", startDate: "2026-09-01", endDate: "2026-09-30", days: 30, files: [{ name: "note.pdf" }], status: "pending", noOtherEmployerAck: true },
);
assert.equal(unpaidWarn.ok, true);
assert.equal(unpaidWarn.warning, "CONTRACT_SUSPENDED");

assert.equal(normalizeArticleKey("79مكرر"), "79 مكرر");
assert.equal(normalizeArticleKey("Art. 93"), "93");
const art93 = articleOfficialText("93");
assert.match(art93?.ar || "", /نصف أجر العامل المستحق/);
assert.doesNotMatch(art93?.ar || "", /ترميز/);
assert.match(citeRule("payroll.deduction.capRatio")?.textAr || "", /نصف أجر العامل المستحق/);
const art101 = articleOfficialText("101");
assert.match(art101?.ar || "", /خمس ساعات متتالية/);
assert.match(art101?.ar || "", /اثنتي عشرة ساعة/);
assert.match(articleOfficialText("101", "2015-03-01")?.ar || "", /إحدى عشرة ساعة/);
const art79bis = articleOfficialText("79 مكرر");
assert.match(art79bis?.ar || "", /طلب الاستقالة/);
assert.doesNotMatch(art79bis?.ar || "", /وفاة العامل/);
assert.match(articleOfficialText("79")?.ar || "", /وفاة العامل/);
assert.equal(articleOfficialText("79 مكرر", "2025-02-01"), null);
assert.match(articleOfficialText("113")?.ar || "", /الأخ أو الأخت/);
assert.match(articleOfficialText("151")?.ar || "", /اثني عشر/);
assert.match(articleOfficialText("114")?.ar || "", /عشرة أيام/);
assert.match(articleOfficialText("58")?.ar || "", /محل إقامته/);
assert.match(articleOfficialText("58")?.ar || "", /كتابة/);
assert.match(articleOfficialText("58")?.ar || "", /ثلاثين يوماً/);
assert.match(articleOfficialText("58")?.ar || "", /تكاليف انتقال/);
assert.match(articleOfficialText("51")?.ar || "", /نسختين/);
assert.match(articleOfficialText("51")?.ar || "", /توثيق/);
assert.match(articleOfficialText("54")?.ar || "", /ستة أشهر/);
assert.match(articleOfficialText("76")?.ar || "", /مهلة الإشعار/);
assert.match(articleOfficialText("88")?.ar || "", /أسبوع/);
assert.match(articleOfficialText("90")?.ar || "", /العملة الرسمية/);
assert.match(articleOfficialText("92")?.ar || "", /10%/);
assert.match(articleOfficialText("66")?.ar || "", /الإنذار/);
assert.match(articleOfficialText("67")?.ar || "", /لائحة تنظيم العمل/);
assert.match(articleOfficialText("68")?.ar || "", /مائة وثمانون/);
assert.match(articleOfficialText("69")?.ar || "", /ثلاثين يوماً/);
assert.match(articleOfficialText("70")?.ar || "", /خارج مكان العمل/);
assert.match(articleOfficialText("70")?.ar || "", /أجر خمسة أيام/);
assert.match(articleOfficialText("71")?.ar || "", /استجوابه/);
assert.doesNotMatch(explainRule("eos.art87.cite")?.hintAr || "", /81/);
assert.match(explainRule("hours.rest.notWorkingHours.cite")?.hintAr || "", /ليست ساعات عمل فعلية/);
assert.match(articleOfficialText("102")?.ar || "", /ساعات العمل الفعلية/);
assert.match(articleOfficialText("111")?.ar || "", /أيام الإجازة المستحقة/);
assert.match(articleOfficialText("155")?.ar || "", /إجازة الوضع/);
assert.match(articleOfficialText("160")?.ar || "", /أربعة أشهر/);
assert.match(articleOfficialText("160")?.ar || "", /خمسة عشر يوماً/);
assert.match(articleOfficialText("73")?.ar || "", /الغرامات/);
assert.match(articleOfficialText("77")?.ar || "", /خمسة عشر يوماً/);
assert.match(articleOfficialText("78")?.ar || "", /للبحث عن عمل/);
assert.match(articleOfficialText("106")?.ar || "", /عشر ساعات/);
assert.match(articleOfficialText("110")?.ar || "", /تسعين يوماً/);
assert.match(articleOfficialText("112")?.ar || "", /الأعياد/);
assert.match(articleOfficialText("118")?.ar || "", /صاحب عمل آخر/);
assert.match(articleOfficialText("154")?.ar || "", /إرضاع/);
assert.match(articleOfficialText("107")?.ar || "", /إجازة تعويضية/);

const art106Rota = checkPublishGates({
  year: 2026,
  monthIndex: 8,
  shiftTypes: [{ id: "long", label: "طويل", start: "07:00", end: "18:00", restMinutes: 60 }],
  assignments: { "2026-09-02": { long: ["e1"] } },
  namesById: { e1: "Emp" },
});
assert.equal(art106Rota.checks.find((c) => c.id === "hours_106")?.ok, false);
assert.equal(art106Rota.checks.find((c) => c.id === "hours_106")?.article, "106");
assert.equal(art106Rota.failed?.id, "hours_106");

assert.equal(checkNoOtherEmployerGate({ type: "annual" }).error, "NO_OTHER_EMPLOYER_ACK");
assert.equal(checkNoOtherEmployerGate({ type: "annual", noOtherEmployerAck: true }).ok, true);
assert.equal(checkNoOtherEmployerGate({ type: "maternity" }).error, "NO_OTHER_EMPLOYER_ACK");
assert.equal(checkNoOtherEmployerGate({ type: "maternity", noOtherEmployerAck: true }).ok, true);
assert.equal(checkNoOtherEmployerGate({ type: "emergency" }).error, "NO_OTHER_EMPLOYER_ACK");
assert.equal(checkNoOtherEmployerGate({ type: "grant" }).error, "NO_OTHER_EMPLOYER_ACK");
assert.equal(checkNoOtherEmployerGate({ type: "leave_topup" }).ok, true);
assert.equal(checkNoOtherEmployerGate({ type: "advance" }).ok, true);
assert.equal(checkNoOtherEmployerGate({ type: "written_consent" }).ok, true);
assert.equal(checkNoOtherEmployerGate({ type: "overtime" }).ok, true);
assert.equal(leaveNeedsArticle118Ack("overtime"), false);
assert.equal(checkSubmitLeaveGate(
  { type: "annual", startDate: "2026-08-01", endDate: "2026-08-03", days: 3, status: "pending" },
  { profile: { hireDate: "2026-01-01" }, requests: [] },
).error, "NO_OTHER_EMPLOYER_ACK");
assert.equal(checkSubmitLeaveGate(
  { type: "emergency", startDate: "2026-09-14", endDate: "2026-09-14", days: 1, status: "pending" },
  { profile: { hireDate: "2026-01-01" }, requests: [] },
).error, "NO_OTHER_EMPLOYER_ACK");
assert.equal(checkSubmitLeaveGate(
  { type: "emergency", startDate: "2026-09-14", endDate: "2026-09-14", days: 1, status: "pending", noOtherEmployerAck: true },
  { profile: { hireDate: "2026-01-01" }, requests: [] },
).ok, true);

const deferBlocked = checkAnnualDeferGate(
  { type: "annual", startDate: "2026-06-01", recordedBy: "مدير" },
  { profile: { hireDate: "2024-01-01" }, requests: [], recordedBy: true },
);
assert.equal(deferBlocked.error, "ANNUAL_DEFER_CONSENT");
const deferOk = checkAnnualDeferGate(
  { type: "annual", startDate: "2026-06-01", recordedBy: "مدير", deferConsentAt: "2026-05-01" },
  { profile: { hireDate: "2024-01-01" }, requests: [], recordedBy: true },
);
assert.equal(deferOk.ok, true);

assert.equal(checkAnnualNoticeGate(
  { type: "annual", startDate: "2026-09-25" },
  { onDate: "2026-09-15" },
).ok, true);
assert.equal(checkAnnualNoticeGate(
  { type: "annual", startDate: "2026-09-25", recordedBy: "مدير" },
  { onDate: "2026-09-15" },
).error, "ANNUAL_NOTICE_DAYS");
assert.equal(checkAnnualNoticeGate(
  { type: "annual", startDate: "2026-10-15", recordedBy: "مدير" },
  { onDate: "2026-09-15" },
).ok, true);
assert.equal(checkApproveLeaveGate(
  { type: "annual", status: "pending", startDate: "2026-09-25", endDate: "2026-09-26", days: 2, recordedBy: "مدير" },
  false,
  { profile: { hireDate: "2026-01-01" }, requests: [], onDate: "2026-09-15" },
).error, "ANNUAL_NOTICE_DAYS");
assert.equal(checkApproveLeaveGate(
  { type: "annual", status: "pending", startDate: "2026-09-25", endDate: "2026-09-26", days: 2 },
  false,
  { profile: { hireDate: "2026-01-01" }, requests: [], onDate: "2026-09-15" },
).ok, true);

const locked = {
  type: "annual",
  status: "approved",
  startDate: "2026-09-20",
  endDate: "2026-09-20",
  approvedAt: "2026-09-06T10:00:00.000Z",
};
assert.equal(checkAlterApprovedLeaveGate(locked, { nextStatus: "rejected", actor: "manager", onDate: "2026-09-14" }).error, "LEAVE_APPROVED_LOCKED");
assert.equal(checkAlterApprovedLeaveGate(locked, { nextStatus: "withdrawn", actor: "manager", onDate: "2026-09-14" }).error, "LEAVE_APPROVED_LOCKED");
assert.equal(checkAlterApprovedLeaveGate(locked, { nextStatus: "withdrawn", actor: "employee", onDate: "2026-09-14" }).error, "LEAVE_WITHDRAW_ACK");
assert.equal(checkAlterApprovedLeaveGate(locked, { nextStatus: "withdrawn", actor: "employee", employeeConsent: true, onDate: "2026-09-14" }).ok, true);
assert.equal(checkAlterApprovedLeaveGate(locked, { nextStatus: "withdrawn", actor: "employee", employeeConsent: true, onDate: "2026-09-20" }).error, "LEAVE_ALREADY_STARTED");
assert.equal(checkAlterApprovedLeaveGate(locked, { nextStatus: "approved" }).ok, true);
assert.equal(checkSeeLeaveDecisionGate({ request: locked, employeeId: "e1", actorId: "mgr" }).error, "EMPLOYEE_ONLY");
assert.equal(checkSeeLeaveDecisionGate({ request: { ...locked, status: "pending" }, employeeId: "e1", actorId: "e1" }).error, "LEAVE_NOT_APPROVED");
assert.equal(checkSeeLeaveDecisionGate({ request: locked, employeeId: "e1", actorId: "e1" }).ok, true);
assert.equal(checkSeeLeaveDecisionGate({ request: { ...locked, decisionSeenAt: "2026-09-13T13:00:00.000Z" }, employeeId: "e1", actorId: "e1" }).already, true);

const split = annualBalanceSplit({ hireDate: "2024-01-15" }, [], "2026-09-11");
assert.equal(split.carryTotal, 21);
assert.equal(split.currentLeft, 21);

const nursingEmp = {
  profile: { gender: "female" },
  leaveRequests: [{ type: "maternity", status: "approved", startDate: "2025-01-01", endDate: "2025-03-25", eventDate: "2025-01-15" }],
};
assert.equal(isNursingSubject(nursingEmp, "2026-09-01"), true);
const longRest = { start: "07:00", end: "15:00", restMinutes: 90 };
assert.equal(actualShiftHours(longRest, "2026-09-01"), 6.5);
assert.equal(actualShiftHours(longRest, "2026-09-01", nursingEmp), 7.5);

const ramadanWeek = weekStartDate("2026-02-18");
const ramadanBlocked = checkWeekPublishGates({
  schedule: {
    stationId: "st",
    shiftTypes: [{ id: "am", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 }],
    assignments: { "2026-02-18": { am: ["e1"] } },
  },
  employees: [{ id: "e1", name: "سامي", stationId: "st", profile: {}, leaveRequests: [] }],
  weekStart: ramadanWeek,
  stationId: "st",
  ar: true,
});
assert.equal(ramadanBlocked.checks.find((c) => c.id === "ramadan")?.block, true);
assert.equal(ramadanBlocked.checks.find((c) => c.id === "ramadan")?.ok, false);

const holidayBlocked = checkWeekPublishGates({
  schedule: {
    stationId: "st",
    shiftTypes: [{ id: "am", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 }],
    assignments: { "2026-09-23": { am: ["e1"] } },
  },
  employees: [{ id: "e1", name: "سامي", stationId: "st", profile: {}, leaveRequests: [] }],
  weekStart: weekStartDate("2026-09-23"),
  stationId: "st",
  ar: true,
});
// Fixed Art. 112 days paint as holiday leave — leftover duty does not block publish as «وردية في عطلة».
assert.equal(holidayBlocked.checks.find((c) => c.id === "official_holiday")?.ok, true);
assert.match(holidayBlocked.checks.find((c) => c.id === "official_holiday")?.note || "", /بقايا تعيين تحت إجازة اليوم الوطني/);
assert.doesNotMatch(holidayBlocked.checks.find((c) => c.id === "leave_excluded")?.note || "", /على إجازة معتمدة/);
assert.match(holidayBlocked.checks.find((c) => c.id === "leave_excluded")?.note || "", /بقايا تعيين تحت إجازة اليوم الوطني/);
assert.doesNotMatch(holidayBlocked.checks.find((c) => c.id === "leave_excluded")?.note || "", /من الدولة/);
assert.equal(holidayBlocked.approvedLeaveDays || 0, 0);
assert.ok((holidayBlocked.officialHolidayLeaveDays || 0) >= 1);
assert.ok((holidayBlocked.holidayLeaveNames || []).some((n) => /اليوم الوطني/.test(n)));
assert.equal(holidayBlocked.cellMarks?.["e1:2026-09-23"]?.id, undefined);

const glowEmp = { id: "omar", name: "عمر", stationId: "st", profile: {}, leaveRequests: [], otherRequests: [] };
const glowMorning = { id: "morning", label: "صباحي", start: "07:00", end: "15:00", restMinutes: 30 };
const glowNight = { id: "night", label: "ليلي", start: "23:00", end: "07:00", restMinutes: 30 };
const glowEvening = { id: "evening", label: "مسائي", start: "15:00", end: "23:00", restMinutes: 30 };
const glowWeek = weekStartDate("2026-09-06");
function datedWeekAssignments(shiftId, employeeId, fromWeek, count = 1) {
  const assignments = {};
  for (let w = 0; w < count; w += 1) {
    const start = addDays(fromWeek, -7 * w);
    for (const key of weekDateKeys(start)) {
      const wd = new Date(`${key}T00:00:00`).getDay();
      if (wd >= 0 && wd <= 4) assignments[key] = { [shiftId]: [employeeId] };
    }
  }
  return assignments;
}
const morningOnlyWeek = {
  shiftTypes: [glowMorning, glowNight, glowEvening],
  assignments: datedWeekAssignments("morning", "omar", glowWeek),
};
assert.equal(statutoryGlowState({ kind: "18632", employee: glowEmp, schedule: morningOnlyWeek, weekStart: glowWeek }), "off", "morning-only week stays quiet");
assert.equal(statutoryGlowState({ kind: "hours.night.restHours", employee: glowEmp, schedule: morningOnlyWeek, weekStart: glowWeek }), "off");
const eveningOnlyWeek = {
  shiftTypes: [glowMorning, glowNight, glowEvening],
  assignments: datedWeekAssignments("evening", "omar", glowWeek),
};
assert.equal(statutoryGlowState({ kind: "18632", employee: glowEmp, schedule: eveningOnlyWeek, weekStart: glowWeek }), "off", "evening ending 23:00 is outside the night window");
const nightInScopeWeek = {
  shiftTypes: [glowMorning, glowNight, glowEvening],
  assignments: datedWeekAssignments("night", "omar", glowWeek),
};
assert.equal(statutoryGlowState({ kind: "18632", employee: glowEmp, schedule: nightInScopeWeek, weekStart: glowWeek }), "in_scope", "23:00–07:00 week glows in scope");
assert.equal(statutoryGlowState({ kind: "hours.night.restHours", employee: glowEmp, schedule: nightInScopeWeek, weekStart: glowWeek }), "in_scope");
assert.equal(statutoryGlowState({ kind: "hours.night.compensateOrReduce", employee: glowEmp, schedule: nightInScopeWeek, weekStart: glowWeek }), "due", "night worker without recorded remedy is a failing publish block");
assert.equal(statutoryGlowState({
  kind: "hours.night.compensateOrReduce",
  employee: glowEmp,
  schedule: { ...nightInScopeWeek, nightCompensation: true },
  weekStart: glowWeek,
}), "in_scope", "night worker with recorded allowance stays in scope, not due");
const nightDueWeek = {
  shiftTypes: [glowMorning, glowNight, glowEvening],
  assignments: datedWeekAssignments("night", "omar", glowWeek, 14),
};
assert.equal(statutoryGlowState({ kind: "18632", employee: glowEmp, schedule: nightDueWeek, weekStart: glowWeek }), "due", "13 night-worker weeks without consent glow due");
assert.equal(statutoryGlowState({ kind: "hours.night.rotateWeeks", employee: glowEmp, schedule: nightDueWeek, weekStart: glowWeek }), "due");
assert.equal(statutoryGlowState({
  kind: "18632",
  employee: { ...glowEmp, otherRequests: [{ type: "night_consent", status: "pending" }] },
  schedule: nightInScopeWeek,
  weekStart: glowWeek,
}), "due", "pending طلباتي consent glows due");
assert.equal(statutoryGlowState({
  kind: "hours.night.pregnancyBanWeeks",
  employee: { ...glowEmp, profile: { expectedBirthDate: "2026-10-01" } },
  schedule: morningOnlyWeek,
  weekStart: glowWeek,
}), "in_scope", "pregnancy ban glows for that employee even on a morning week");
assert.equal(statutoryGlowState({
  kind: "hours.night.pregnancyBanWeeks",
  employee: glowEmp,
  schedule: nightInScopeWeek,
  weekStart: glowWeek,
}), "off", "pregnancy chip stays quiet for everyone else");
assert.equal(statutoryGlowState({
  kind: "hours.night.medicalYearMonths",
  employee: { ...glowEmp, profile: { nightFitnessStatus: "unfit" } },
  schedule: morningOnlyWeek,
  weekStart: glowWeek,
}), "in_scope");
assert.equal(statutoryGlowState({
  kind: "hours.night.medicalYearMonths",
  employee: glowEmp,
  schedule: nightInScopeWeek,
  weekStart: glowWeek,
}), "due", "night worker without a medical file glows due");
const glowFitnessDay = laborDayKey(glowWeek);
assert.equal(statutoryGlowState({
  kind: "hours.night.medicalYearMonths",
  employee: {
    ...glowEmp,
    profile: {
      nightMedicalReport: { url: "/preview-night-fitness.txt", name: "معاينة-تقرير-لياقة-ليلية.txt", issuedAt: glowFitnessDay },
      nightMedicalIssuedAt: glowFitnessDay,
    },
  },
  schedule: nightInScopeWeek,
  weekStart: glowWeek,
}), "in_scope", "dated medical file on the record fulfills the 18632 medical card");
const glowStaleIssued = addLaborDays(glowFitnessDay, -(nightMedicalYearSpanDays(glowFitnessDay) + 1));
assert.equal(statutoryGlowState({
  kind: "hours.night.medicalYearMonths",
  employee: {
    ...glowEmp,
    profile: {
      nightMedicalReport: { url: "/preview-night-fitness-stale.txt", name: "معاينة-تقرير-لياقة-منتهٍ.txt", issuedAt: glowStaleIssued },
      nightMedicalIssuedAt: glowStaleIssued,
    },
  },
  schedule: nightInScopeWeek,
  weekStart: glowWeek,
}), "due", "yearly review uses hours.night.medicalYearMonths — not the 3-month rotation");
assert.equal(statutoryGlowState({ kind: "hours.rest.weeklyHours", employee: glowEmp, schedule: morningOnlyWeek, weekStart: glowWeek }), "in_scope", "weekly rest glows when the week needs a rest day");
const noRestWeek = {
  shiftTypes: [glowMorning],
  assignments: Object.fromEntries(weekDateKeys(glowWeek).map((key) => [key, { morning: ["omar"] }])),
};
assert.equal(statutoryGlowState({ kind: "hours.rest.weeklyHours", employee: glowEmp, schedule: noRestWeek, weekStart: glowWeek }), "due", "missing weekly rest glows due");

const restOnlyWeek = { shiftTypes: [glowMorning, glowNight, glowEvening], assignments: {} };
const restMark = rosterNightRowMark({ employee: glowEmp, schedule: restOnlyWeek, weekStart: glowWeek });
assert.equal(restMark.glow, "off", "rest-only week stays quiet");
assert.equal(restMark.nameGlow, false);
assert.equal(restMark.copy, null, "roster rows never carry 18632 copy");
const eveningMark = rosterNightRowMark({ employee: glowEmp, schedule: eveningOnlyWeek, weekStart: glowWeek });
assert.equal(eveningMark.glow, "off", "evening 15:00 week stays quiet");
assert.equal(eveningMark.nameGlow, false);
assert.equal(eveningMark.copy, null);
const dueMark = rosterNightRowMark({ employee: glowEmp, schedule: nightDueWeek, weekStart: glowWeek });
assert.equal(dueMark.glow, "due", "13 night-worker weeks glow due on the name only");
assert.equal(dueMark.nameGlow, true);
assert.equal(dueMark.copy, null, "due row still has no legal essay");

const firstNotify = planNightDueNotifications({
  employees: [glowEmp],
  schedules: [ { stationId: "st", ...nightDueWeek } ],
  weekStart: glowWeek,
});
assert.equal(firstNotify.length, 1, "13 night-worker weeks fire one employee notice");
assert.equal(firstNotify[0].employeeId, "omar");
assert.match(firstNotify[0].key, /^18632-due:omar:/);
const secondNotify = planNightDueNotifications({
  employees: [glowEmp],
  schedules: [ { stationId: "st", ...nightDueWeek } ],
  weekStart: glowWeek,
  existingKeys: firstNotify.map((row) => row.key),
});
assert.equal(secondNotify.length, 0, "same due cycle does not notify again");
assert.equal(planNightDueNotifications({
  employees: [glowEmp],
  schedules: [ { stationId: "st", ...restOnlyWeek } ],
  weekStart: glowWeek,
}).length, 0, "rest-only week does not notify");
assert.equal(planNightDueNotifications({
  employees: [glowEmp],
  schedules: [ { stationId: "st", ...eveningOnlyWeek } ],
  weekStart: glowWeek,
}).length, 0, "evening-only week does not notify");

assert.equal(showStatutoryHeaderCite("in_scope", { ok: true }), false, "passing in-scope week hides header 18632 essay");
assert.equal(showStatutoryHeaderCite("due", { ok: true }), true);
assert.equal(showStatutoryHeaderCite("off", { ok: false }), true);
assert.equal(headerStatutoryGlow("in_scope", { ok: true }), "off");
assert.equal(headerStatutoryGlow("due", { ok: true }), "due");
assert.equal(quietNightHeaderCite("in_scope"), true);
assert.equal(quietNightHeaderCite("due"), false);
assert.equal(quietNightHeaderCite("off"), false);

const dueChip = statutoryChipStyle("entitlement", { glow: "due" });
assert.equal(dueChip["--nv-stat-glow"], "transparent", "due cite has no outer glow chrome");
assert.match(String(dueChip.color), /nv-warn|#8A6516/, "due chip text is warn — not منع red");
assert.match(String(dueChip.background), /nv-warn|#FDF6E8/, "due chip fill is warn soft");
assert.doesNotMatch(String(dueChip.background), /nv-danger|#DC2626|nv-bad/);
assert.equal(dueChip.boxShadow, "none");
assert.equal(dueChip.width, "fit-content");
assert.equal(dueChip.maxWidth, "max-content");
assert.equal(dueChip.flex, "0 0 auto");
const scopeChip = statutoryChipStyle("entitlement", { glow: "in_scope" });
assert.equal(scopeChip["--nv-stat-glow"], "transparent", "in_scope cite has no glow");
assert.match(String(scopeChip.color), /nv-ink2|#334155/, "in_scope chip is quiet navy");
assert.match(String(scopeChip.background), /nv-soft|#F7F8FA/, "in_scope chip matches article badge");
assert.doesNotMatch(String(scopeChip.background), /nv-danger|#DC2626|nv-accent|#1E9E63/);
assert.equal(scopeChip.width, "fit-content");
assert.equal(scopeChip.maxWidth, "max-content");
const offRight = statutoryChipStyle("entitlement", { glow: "off" });
assert.match(String(offRight.background), /nv-soft|#F7F8FA/, "quiet entitlement is soft navy cite");
assert.match(String(offRight.color), /nv-ink2|#334155/, "quiet entitlement text is muted ink");
assert.doesNotMatch(String(offRight.background), /transparent|nv-accent|#1E9E63/);
const offCite = statutoryChipStyle("cite", { glow: "off" });
assert.equal(offCite["--nv-stat-glow"], "transparent");
assert.match(String(offCite.background), /nv-soft|#F7F8FA/, "generic cite is soft navy");
assert.match(String(offCite.color), /nv-ink2|#334155/, "generic cite text stays muted");
assert.doesNotMatch(String(offCite.background), /nv-accent|#1E9E63|transparent/);
assert.equal(statutoryGlowState({ kind: "18632", employee: glowEmp, schedule: nightDueWeek, weekStart: glowWeek }), "due");
assert.equal(statutoryChipStyle("entitlement", {
  glow: statutoryGlowState({ kind: "18632", employee: glowEmp, schedule: nightDueWeek, weekStart: glowWeek }),
})["--nv-stat-glow"], "transparent", "13-week night fixture keeps cite without glow chrome");
const blockChip = statutoryChipStyle("block", { glow: "off" });
assert.match(String(blockChip.background), /nv-bad|#FBF1F2/, "منع uses bad soft only");
assert.match(String(blockChip.color), /nv-bad|#8A1C2B/, "منع text is bad ink");
const passingPay = checkWeekPublishGates({
  schedule: { ...nightInScopeWeek, nightCompensation: true },
  employees: [glowEmp],
  weekStart: glowWeek,
  stationId: "st",
  ar: true,
}).checks.find((row) => row.id === "night_pay_equality");
assert.equal(passingPay?.ok, true);
assert.doesNotMatch(passingPay?.note || "", /18632/, "passing header pay-equality is not a 18632 wall");

assert.equal(LEAVE_ROSTER_BLOB, "leaveRoster");
const blobOnlyApproved = [{
  id: "lv_blob",
  status: "approved",
  type: "annual",
  startDate: "2026-09-15",
  endDate: "2026-09-16",
}];
assert.equal(
  checkCheckInLeaveGate(leaveRequestsForEmployeeId("emp_1", {
    entity: { leaveRequests: [] },
    roster: leaveRosterFromEmployees([{ id: "emp_1", leaveRequests: blobOnlyApproved }]),
  }), "2026-09-15").error,
  "ON_APPROVED_LEAVE",
  "hosted punch must see طلباتي blob leave when the Employee entity is empty",
);
assert.equal(
  checkCheckInLeaveGate(leaveRequestsForEmployeeId("emp_1", {
    entity: { leaveRequests: blobOnlyApproved },
    roster: [],
  }), "2026-09-15").error,
  "ON_APPROVED_LEAVE",
  "hosted punch still sees entity-only approved leave",
);
assert.equal(
  checkCheckInLeaveGate(leaveRequestsForEmployeeId("emp_1", {
    entity: { leaveRequests: [] },
    roster: [],
  }), "2026-09-15").ok,
  true,
);
assert.equal(
  mergeLeaveRequestLists(
    [{ id: "lv_1", status: "pending", type: "annual", startDate: "2026-09-15", endDate: "2026-09-16" }],
    [{ id: "lv_1", status: "approved", type: "annual", startDate: "2026-09-15", endDate: "2026-09-16" }],
  )[0]?.status,
  "approved",
  "approved copy wins when the same leave id is in both stores",
);

assert.equal(ruleValue("hours.posting.cite"), 1);
assert.equal(citeRule("hours.posting.cite").article, "17");
assert.equal(ruleValue("hours.art99.extendedDayHours"), 9);
assert.equal(ruleValue("hours.art99.hazardousDayHours"), 7);
assert.equal(ruleValue("hours.art100.averageWeeks"), 3);
assert.equal(ruleValue("hours.art105.bankMaxWeeks"), 8);
assert.equal(ruleValue("hours.juvenile.ordinaryHours"), 6);
assert.equal(ruleValue("hours.juvenile.ramadanHours"), 4);
assert.equal(ruleValue("hours.juvenile.nightBanHours"), 12);
assert.equal(ruleValue("hours.juvenile.maxPresenceHours"), 7);
assert.equal(citeRule("contract.illness.noDismiss.cite").article, "82");
assert.equal(ruleValue("payroll.damage.capDays"), 5);
assert.equal(ruleValue("facility.nursery.womenMin"), 50);
assert.ok(articleOfficialText("163")?.ar.includes("اثنتي عشرة"));
assert.ok(articleOfficialText("164")?.ar.includes("ست ساعات"));

console.log("labor-rules: ok");
