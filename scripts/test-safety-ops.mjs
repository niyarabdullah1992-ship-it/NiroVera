import assert from "node:assert/strict";
// Safety operations: permits to work, inspection rounds, investigations, HSE rates — named gates, derived figures.
import * as ops from "../src/lib/safetyOps.js";

const NOW = Date.parse("2026-07-20T05:00:00Z"); // 08:00 Riyadh, in the 3337 season
const base = { type: "hot", stationId: "st_n", description: "لحام أنبوب في غرفة المضخات", holderId: "e1", startAt: "2026-07-20T08:00", endAt: "2026-07-20T11:30", controls: ["ppe", "firewatch", "gas", "barricade"] };

assert.equal(ops.checkPermitIssueGate(base, { now: NOW }).ok, true);
assert.match(ops.checkPermitIssueGate({ ...base, type: "" }, { now: NOW }).reason, /نوع التصريح/);
assert.match(ops.checkPermitIssueGate({ ...base, controls: ["ppe"] }, { now: NOW }).reason, /مراقب حريق/);
assert.match(ops.checkPermitIssueGate({ ...base, endAt: "2026-07-20T21:00" }, { now: NOW }).reason, /12 ساعة/);
assert.match(ops.checkPermitIssueGate({ ...base, endAt: "2026-07-20T07:00" }, { now: NOW }).reason, /بعد بدايته/);
// Outdoor across 12:00–15:00 in season → decision 3337 names the day.
const sun = ops.checkPermitIssueGate({ ...base, outdoor: true, endAt: "2026-07-20T13:00" }, { now: NOW });
assert.equal(sun.ok, false);
assert.match(sun.reason, /3337/);
assert.match(sun.reason, /2026-07-20/);
// Same window indoors is fine; outdoors out of season is fine.
assert.equal(ops.checkPermitIssueGate({ ...base, endAt: "2026-07-20T13:00" }, { now: NOW }).ok, true);
assert.equal(ops.checkPermitIssueGate({ ...base, outdoor: true, startAt: "2026-10-20T08:00", endAt: "2026-10-20T14:00" }, { now: NOW }).ok, true);
assert.equal(ops.permitHeatBanDay(ops.riyadhLocalMs("2026-07-20T15:00"), ops.riyadhLocalMs("2026-07-20T18:00")), "");

// States and actions.
const permit = { ...base, id: "PTW-2607-AAAA", status: "open" };
assert.equal(ops.permitStatus(permit, NOW), "open");
assert.equal(ops.permitStatus(permit, Date.parse("2026-07-20T09:00:00Z")), "expired");
assert.equal(ops.permitStatus({ ...permit, status: "suspended" }, NOW), "suspended");
assert.equal(ops.checkPermitActionGate(permit, "suspend", { note: "", now: NOW }).ok, false);
assert.equal(ops.checkPermitActionGate(permit, "suspend", { note: "رياح قوية", now: NOW }).ok, true);
assert.match(ops.checkPermitActionGate(permit, "close", { now: NOW }).reason, /آمناً/);
assert.equal(ops.checkPermitActionGate(permit, "close", { areaSafe: true, now: NOW }).ok, true);
assert.equal(ops.checkPermitActionGate({ ...permit, status: "closed" }, "close", { areaSafe: true, now: NOW }).ok, false);
const board = ops.permitBoard([permit, { ...permit, id: "b", status: "closed", closedAt: "2026-07-19T10:00:00Z" }, { ...permit, id: "c", endAt: "2026-07-19T10:00" }], NOW);
assert.equal(board.live, 1);
assert.equal(board.unclosed, 1);
assert.equal(board.closedMonth, 1);
assert.match(ops.permitCode(new Date(NOW), 0.5), /^PTW-2607-[0-9A-Z]{4}$/);

// Inspection round.
const items = ops.inspectionItems();
assert.ok(items.length >= 20);
assert.ok(items.some((row) => row.id === "law_125_fire" && row.ruleId === "safety.fire.cite"));
const all = Object.fromEntries(items.map((row) => [row.id, { status: "yes" }]));
assert.equal(ops.checkInspectionGate({ stationId: "st_n", results: all }).ok, true);
assert.match(ops.checkInspectionGate({ stationId: "st_n", results: {} }).reason, /بلا حكم/);
const withNo = { ...all, nfpa_ext: { status: "no", comment: "" }, iso_policy: { status: "na" } };
assert.match(ops.checkInspectionGate({ stationId: "st_n", results: withNo }).reason, /غير مطابق/);
withNo.nfpa_ext.comment = "طفايتان منتهيتان";
assert.equal(ops.checkInspectionGate({ stationId: "st_n", results: withNo }).ok, true);
const score = ops.inspectionScore(withNo);
assert.equal(score.no, 1);
assert.equal(score.na, 1);
assert.equal(score.pct, Math.round(((items.length - 2) / (items.length - 1)) * 100));
assert.equal(ops.inspectionFindings(withNo)[0].id, "nfpa_ext");
const state = ops.branchInspectionState({ inspections: [{ at: "2026-06-01T08:00:00Z", score: 70 }, { at: "2026-07-10T08:00:00Z", score: 90 }] }, NOW);
assert.equal(state.pct, 90);
assert.equal(state.due, false);
assert.equal(ops.branchInspectionState({}, NOW).due, true);

// Incidents, GOSI deadline, investigation.
const injury = { id: "i1", at: "2026-07-15T08:00:00Z", card: { injured: true, severity: 3, kind: 3 } };
assert.equal(ops.incidentClass(injury), "medical");
assert.equal(ops.incidentClass({ ...injury, investigation: { lostDays: 4 } }), "lti");
assert.equal(ops.incidentClass({ card: { kind: 2 } }), "nearMiss");
assert.equal(ops.isTrackedIncident({ card: { kind: 0 } }), false);
const due = ops.injuryReportState(injury, NOW);
assert.equal(due.state, "due");
assert.equal(due.days, 10);
assert.equal(ops.injuryReportState(injury, Date.parse("2026-07-30T08:00:00Z")).state, "overdue");
assert.equal(ops.injuryReportState({ ...injury, investigation: { gosiReportedAt: "2026-07-17" } }, NOW).state, "onTime");
assert.equal(ops.injuryReportState({ ...injury, investigation: { gosiReportedAt: "2026-07-28" } }, NOW).state, "late");
const inv = { rootCause: "condition", capa: "تركيب حاجز على حافة الرصيف", capaOwner: "أحمد", capaDue: "2026-07-30", lostDays: 2, gosiReportedAt: "2026-07-16" };
assert.equal(ops.checkInvestigationGate(injury, inv, { now: NOW }).ok, true);
assert.match(ops.checkInvestigationGate(injury, { ...inv, rootCause: "" }, { now: NOW }).reason, /السبب الجذري/);
assert.match(ops.checkInvestigationGate(injury, { ...inv, gosiReportedAt: "2026-07-10" }, { now: NOW }).reason, /يسبق/);
assert.match(ops.checkInvestigationGate(injury, { ...inv, lostDays: -1 }, { now: NOW }).reason, /صحيح/);

// Rates: 10 people × 48 × 52 = 24,960 h.
const rates = ops.hseRates({ incidents: [{ ...injury, investigation: { lostDays: 4 } }, { at: "2026-07-01T08:00:00Z", card: { kind: 2 } }], headcount: 10, now: NOW });
assert.equal(rates.hours, 24960);
assert.equal(rates.counts.lti, 1);
assert.equal(rates.recordables, 1);
assert.equal(rates.trir, Math.round((200000 / 24960) * 100) / 100);
assert.equal(rates.ltifr, Math.round((1000000 / 24960) * 100) / 100);
assert.equal(rates.lostDays, 4);
assert.equal(ops.hseRates({ incidents: [], headcount: 0 }).trir, null);
assert.equal(ops.daysSinceLastLti([{ ...injury, investigation: { lostDays: 1 } }], [], NOW), 4);
assert.equal(ops.daysSinceLastLti([], [], NOW), null);
assert.equal(ops.openCapas([{ ...injury, investigation: inv }], Date.parse("2026-08-02T08:00:00Z"))[0].overdue, true);
console.log("safety ops ok");
