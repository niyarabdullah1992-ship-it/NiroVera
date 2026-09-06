import assert from "node:assert/strict";
import {
  LABOR_RULES,
  HRSD_IMPLEMENTING_REGS_URL,
  citeLeaveType,
  citeRule,
  explainLeaveType,
  explainRule,
  isRamadanDay,
  ruleValue,
} from "../src/lib/laborRules.js";
import { articleOfficialText, BOE_LABOUR_LAW_URL, normalizeArticleKey } from "../src/lib/laborArticleTexts.js";
import { LEAVE_THRESHOLD_DAYS, LEAVE_TYPES } from "../src/lib/leaveDerivations.js";
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
import { checkApproveLeaveGate, deriveSickPayBand } from "../src/lib/leaveDerivations.js";
import { statutoryLeaveFloor, leaveCiteRuleId, usedLeaveDays } from "../src/lib/leaveTypes.js";
import { deriveInspectionPack } from "../src/lib/inspectionPackDerivations.js";

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
assert.equal(citeRule("contract.indefinite.cite")?.article, "75");
assert.equal(citeRule("contract.fixed.cite")?.article, "55");
assert.equal(citeRule("contract.written.cite")?.article, "51");
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
assert.equal(citeRule("contract.notice.jobSearchDaysPerWeek")?.article, "78");
assert.equal(ruleValue("contract.notice.jobSearchHoursPerWeek"), 8);
assert.equal(citeRule("hours.ot.exceptionDayHours")?.article, "106");
assert.equal(ruleValue("hours.ot.exceptionWeekHours"), 60);
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
const rest = gates.checks.find((c) => c.id === "rest_11h");
const rest5 = gates.checks.find((c) => c.id === "rest_5h");
const weekly = gates.checks.find((c) => c.id === "weekly_rest");
assert.equal(hours.article, "98");
assert.ok(!rest.article);
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
assert.equal(ruleValue("contract.resignation.autoAcceptDays"), 30);
assert.equal(citeRule("hours.night.startHour"), null);
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
assert.equal(citeRule("leave.annual.days")?.sourceUrl, BOE_LABOUR_LAW_URL);
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

const overBalance = checkApproveLeaveGate(
  { type: "annual", startDate: "2026-08-01", endDate: "2026-08-25", days: 25, files: [{ name: "a.pdf" }], status: "pending" },
  false,
  { profile: { hireDate: "2024-01-01", leaveTotals: {} }, requests: [] },
);
assert.equal(overBalance.ok, false);
assert.equal(overBalance.error, "LEAVE_BALANCE_EXCEEDED");

const overBalanceNoFile = checkApproveLeaveGate(
  { type: "annual", startDate: "2026-08-01", endDate: "2026-08-25", days: 25, files: [], status: "pending" },
  false,
  { profile: { hireDate: "2024-01-01", leaveTotals: {} }, requests: [] },
);
assert.equal(overBalanceNoFile.error, "LEAVE_BALANCE_EXCEEDED");

assert.equal(citeRule("hours.rest.betweenShiftsHours"), null);
assert.equal(citeRule("hours.workplace.maxHours", "2014-01-01")?.value, 11);
assert.equal(ruleValue("hours.workplace.maxHours", "2026-09-06"), 12);
assert.equal(citeRule("leave.unpaid.suspendAfterDays")?.article, "116");
assert.equal(citeRule("contract.resignation.autoAcceptDays")?.article, "79 مكرر");
assert.equal(citeLeaveType("unpaid")?.article, "116");
assert.equal(ruleValue("leave.bereavement_sibling.days", "2026-09-06"), 3);
assert.equal(ruleValue("leave.hajj.maxDays"), 15);
assert.equal(ruleValue("hours.ramadan.ordinaryHours"), 6);
assert.equal(isRamadanDay("2026-03-01"), true);
assert.equal(isRamadanDay("2026-09-06"), false);

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

const hajjYoung = checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "a.pdf" }], status: "pending" },
  false,
  { profile: { hireDate: "2025-06-01" }, requests: [] },
);
assert.equal(hajjYoung.error, "HAJJ_SERVICE");

const hajjOk = checkApproveLeaveGate(
  { type: "hajj", startDate: "2026-06-01", endDate: "2026-06-10", days: 10, files: [{ name: "a.pdf" }], status: "pending" },
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

const paternityLate = checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-15", endDate: "2026-09-17", days: 3, files: [], status: "pending", eventDate: "2026-09-01" },
  false,
  { profile: { gender: "male" }, requests: [] },
);
assert.equal(paternityLate.error, "PATERNITY_WINDOW");

const paternityOk = checkApproveLeaveGate(
  { type: "paternity", startDate: "2026-09-03", endDate: "2026-09-05", days: 3, files: [], status: "pending", eventDate: "2026-09-01" },
  false,
  { profile: { gender: "male" }, requests: [] },
);
assert.equal(paternityOk.ok, true);

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
  { type: "marriage", startDate: "2026-09-01", endDate: "2026-09-05", days: 5, files: [], status: "pending", eventDate: "2026-09-01" },
  false,
  { profile: {}, requests: [] },
);
assert.equal(marriageOk.ok, true);

const sickYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2026-09-01", endDate: "2026-10-10", days: 40, files: [{ name: "med.pdf" }], status: "pending" },
  true,
  { profile: {}, requests: [] },
);
assert.equal(sickYear.ok, true);

const sickOverYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2026-09-01", endDate: "2026-12-30", days: 121, files: [{ name: "med.pdf" }], status: "pending" },
  true,
  { profile: {}, requests: [] },
);
assert.equal(sickOverYear.ok, false);
assert.equal(sickOverYear.error, "LEAVE_BALANCE_EXCEEDED");

const priorSick = [{ type: "sick", status: "approved", startDate: "2025-01-01", endDate: "2025-04-10", days: 100 }];
assert.equal(usedLeaveDays(priorSick, "sick", "2025-03-01"), 100);
assert.equal(usedLeaveDays(priorSick, "sick", "2026-09-01"), 0);
const sickPriorYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2026-09-01", endDate: "2026-10-10", days: 40, files: [{ name: "med.pdf" }], status: "pending" },
  true,
  { profile: {}, requests: priorSick },
);
assert.equal(sickPriorYear.ok, true);
const sickSameYear = checkApproveLeaveGate(
  { type: "sick", startDate: "2025-06-01", endDate: "2025-07-10", days: 40, files: [{ name: "med.pdf" }], status: "pending" },
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

const examOk = checkApproveLeaveGate(
  { type: "exam", startDate: "2026-09-20", endDate: "2026-09-21", days: 2, files: [{ name: "exam.pdf" }], status: "pending", createdAt: "2026-09-01" },
  true,
);
assert.equal(examOk.ok, true);

const unpaidWarn = checkApproveLeaveGate(
  { type: "unpaid", startDate: "2026-09-01", endDate: "2026-09-30", days: 30, files: [{ name: "note.pdf" }], status: "pending" },
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

console.log("labor-rules: ok");
