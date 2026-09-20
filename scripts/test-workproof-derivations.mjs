import assert from "node:assert/strict";
import {
  sealIdFor,
  deriveProofStage,
  deriveProofCounts,
  isWorkProofArchived,
  applyWorkProofArchive,
  workProofArchiveDate,
  checkApproveWorkProofGate,
  checkEndWorkProofGate,
  checkEditWorkProofGate,
  shouldSealOnEnd,
  checkAcceptGate,
  isProofCrewMember,
  appendWorkProofAudit,
  buildWorkProofAuditTimeline,
  normalizeProofPlace,
  proofPlaceLabel,
  checkProofPlaceGate,
  isOutdoorProof,
  checkProofHeatBanGate,
  proofHeatBanMinutes,
  deriveProofHeatBanFlag,
  deriveProofHeatBanNotice,
} from "../src/lib/workProofDerivations.js";
import {
  HEAT_BAN_STATE_LEVEL,
  heatBanClockState,
  heatBanWindow,
  isHeatBanDate,
} from "../src/lib/contractLawDerivations.js";
import { HEAT_BAN_DECISION, heatBanDecisionLabel } from "../src/lib/heatBanDecision.js";
import { citeRule } from "../src/lib/laborRules.js";
import { TASK_MODES, taskModeLabel } from "../src/lib/opsDerivations.js";
import { workProofCrewFields } from "../src/lib/workProofCrew.js";
import { archiveDayKey, archiveMonthKey, formatDayMonthYear, formatMonthYear, groupArchiveByYearDay, groupArchiveByYearMonth, AR_GREGORIAN_MONTHS } from "../src/lib/dateFormat.js";

const base = {
  ref: "WP-4821",
  beforeStamp: "06:18",
  afterStamp: "09:42",
  geoVerdict: "in",
  raiserId: "tech1",
  status: "ready",
};

assert.equal(sealIdFor(base), sealIdFor({ ...base }));
assert.notEqual(sealIdFor(base), sealIdFor({ ...base, afterStamp: "10:00" }));
assert.notEqual(sealIdFor(base), sealIdFor({ ...base, geoVerdict: "out" }));

assert.equal(deriveProofStage({ ...base, afterStamp: null }), "await");
assert.equal(deriveProofStage(base), "ready");
assert.equal(deriveProofStage({ ...base, sealId: sealIdFor(base), status: "sealed" }), "sealed");

const self = checkApproveWorkProofGate({ proof: base, actorUserId: "tech1" });
assert.equal(self.ok, false);
assert.equal(self.error, "SELF_APPROVE_FORBIDDEN");

const ok = checkApproveWorkProofGate({ proof: base, actorUserId: "mgr1" });
assert.equal(ok.ok, true);

const geo = checkApproveWorkProofGate({
  proof: { ...base, geoVerdict: "out", geoCleared: false },
  actorUserId: "mgr1",
});
assert.equal(geo.error, "GEO_CLEARANCE_REQUIRED");

const geoOk = checkApproveWorkProofGate({
  proof: { ...base, geoVerdict: "out", geoCleared: false },
  actorUserId: "mgr1",
  geoClearReason: "accepted with escort",
});
assert.equal(geoOk.ok, true);

const sealed = { ...base, status: "sealed", sealId: sealIdFor(base) };
assert.equal(checkAcceptGate(sealed).ok, true);
assert.equal(checkAcceptGate({ ...sealed, afterStamp: "changed" }).error, "SEAL_INVALID");

const inProgress = { ...base, afterStamp: null, status: "await" };
const endOk = checkEndWorkProofGate({ proof: inProgress, actorUserId: "tech2", sameBranch: true });
assert.equal(endOk.ok, true);
const endBlock = checkEndWorkProofGate({ proof: inProgress, actorUserId: "tech2", sameBranch: false, isManager: false });
assert.equal(endBlock.error, "CREW_OR_BRANCH_REQUIRED");
const endRaiser = checkEndWorkProofGate({ proof: inProgress, actorUserId: "tech1" });
assert.equal(endRaiser.ok, true);
const endVisitor = checkEndWorkProofGate({
  proof: { ...inProgress, stationId: "dammam", people: [{ name: "زائر أبها", employeeId: "abha1", homeStationId: "abha", visitor: true }] },
  actorUserId: "abha1",
  sameBranch: false,
  isManager: false,
});
assert.equal(endVisitor.ok, true);
const endStranger = checkEndWorkProofGate({
  proof: { ...inProgress, people: [{ name: "زائر أبها", employeeId: "abha1", homeStationId: "abha", visitor: true }] },
  actorUserId: "other",
  sameBranch: false,
  isManager: false,
});
assert.equal(endStranger.error, "CREW_OR_BRANCH_REQUIRED");
assert.equal(endRaiser.ok, true);
assert.equal(endRaiser.autoApprove, true);
assert.equal(shouldSealOnEnd(), true);
const endedByRaiser = { ...base, endedAt: new Date().toISOString(), endedById: "tech1" };
assert.equal(checkApproveWorkProofGate({ proof: endedByRaiser, actorUserId: "tech1" }).ok, true);

const fresh = { ...inProgress, createdAt: new Date().toISOString() };
assert.equal(checkEditWorkProofGate({ proof: fresh, actorUserId: "tech1" }).ok, true);
const stale = { ...inProgress, createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() };
assert.equal(checkEditWorkProofGate({ proof: stale, actorUserId: "tech1" }).error, "EDIT_WINDOW_CLOSED");
assert.equal(checkEditWorkProofGate({ proof: { ...fresh, status: "sealed", sealId: sealIdFor(base) }, actorUserId: "tech1" }).error, "LOCKED_AFTER_SEAL");
assert.equal(isProofCrewMember({ people: [{ employeeId: "abha1" }] }, "abha1"), true);
assert.equal(isProofCrewMember({ people: [{ id: "1020304050" }] }, "1020304050"), false);

const missingWorker = workProofCrewFields({ people: [{ name: "" }] });
assert.equal(missingWorker.ok, false);

const missingId = workProofCrewFields({ people: [{ name: "سالم" }] });
assert.equal(missingId.ok, false);
assert.match(missingId.errorAr, /هوية/);

const crewOk = workProofCrewFields({ people: [{ name: "سالم", id: "1xxxxxxxx", nationality: "سعودي" }] });
assert.equal(crewOk.ok, true);
assert.equal(crewOk.fields.personId, "1xxxxxxxx");

const counts = deriveProofCounts([base, { ...base, ref: "WP-2", afterStamp: null }, sealed]);
assert.equal(counts.ready, 1);
assert.equal(counts.await, 1);
assert.equal(counts.sealed, 1);
assert.equal(counts.live, 2);
assert.equal(counts.archived, 1);
assert.equal(isWorkProofArchived({ ...base, afterStamp: null, status: "await" }), false);
assert.equal(isWorkProofArchived(base), false);
assert.equal(isWorkProofArchived(sealed), true);
assert.equal(isWorkProofArchived({ ...sealed, status: "accepted", acceptedAt: "2026-09-09T02:00:00.000Z" }), true);
assert.equal(isWorkProofArchived({ ...base, status: "rejected" }), true);
const stamped = { ...sealed, ...applyWorkProofArchive(sealed, "2026-09-09T02:00:00.000Z") };
assert.equal(stamped.archived, true);
assert.equal(stamped.archivedAt, "2026-09-09T02:00:00.000Z");
assert.equal(workProofArchiveDate(stamped), "2026-09-09T02:00:00.000Z");
assert.equal(workProofArchiveDate({ ...sealed, endedAt: "2026-09-09T01:00:00.000Z" }), "2026-09-09T01:00:00.000Z");
assert.deepEqual(AR_GREGORIAN_MONTHS, [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]);
assert.equal(formatMonthYear(new Date(2026, 8, 9), "ar"), "سبتمبر 2026");
assert.equal(formatMonthYear(new Date(2026, 0, 1), "ar"), "يناير 2026");
assert.equal(formatMonthYear(new Date(2026, 8, 9), "en"), "September 2026");
assert.equal(formatDayMonthYear(new Date(2026, 8, 9), "ar"), "9 سبتمبر 2026");
assert.equal(formatDayMonthYear(new Date(2026, 0, 1), "ar"), "1 يناير 2026");
// en-GB by design (uiDateLocale), so English mirrors the Arabic day-first order.
assert.equal(formatDayMonthYear(new Date(2026, 8, 9), "en"), "9 September 2026");
assert.equal(archiveMonthKey(workProofArchiveDate(stamped)), "2026-09");
assert.equal(archiveDayKey(new Date(2026, 8, 9)), "2026-09-09");
assert.equal(archiveDayKey(workProofArchiveDate(stamped)), archiveDayKey(new Date(stamped.archivedAt)));
const archiveGroups = groupArchiveByYearMonth([
  { id: "WP-263805", date: workProofArchiveDate(stamped) },
  { id: "WP-aug", date: "2026-08-12T12:00:00.000Z" },
  { id: "WP-sep-2", date: "2026-09-15T12:00:00.000Z" },
  { id: "skip", date: "" },
]);
assert.deepEqual(archiveGroups.yearList, [2026]);
assert.deepEqual(Array.from(archiveGroups.years.get(2026).keys()).sort().reverse(), ["2026-09", "2026-08"]);
assert.equal(archiveGroups.years.get(2026).get("2026-09").some((it) => it.id === "WP-263805"), true);
assert.equal(archiveGroups.years.get(2026).has("2026-07"), false);
assert.equal(formatMonthYear(new Date(2026, Number(archiveGroups.newestMk.slice(5)) - 1, 1), "ar"), "سبتمبر 2026");
const dayGroups = groupArchiveByYearDay([
  { id: "WP-263805", date: workProofArchiveDate(stamped) },
  { id: "WP-aug", date: new Date(2026, 7, 12) },
  { id: "WP-sep-2", date: new Date(2026, 8, 15) },
  { id: "WP-same-day", date: new Date(2026, 8, 9, 18, 0) },
  { id: "skip", date: "" },
]);
assert.deepEqual(dayGroups.yearList, [2026]);
assert.deepEqual(Array.from(dayGroups.years.get(2026).keys()).sort().reverse(), ["2026-09-15", "2026-09-09", "2026-08-12"]);
const stampedDay = archiveDayKey(workProofArchiveDate(stamped));
assert.equal(dayGroups.years.get(2026).get(stampedDay).some((it) => it.id === "WP-263805"), true);
assert.equal(dayGroups.years.get(2026).get("2026-09-09").some((it) => it.id === "WP-same-day"), true);
assert.equal(dayGroups.years.get(2026).has("2026-09-10"), false);
assert.equal(dayGroups.newestDk, "2026-09-15");
assert.equal(formatDayMonthYear(new Date(2026, 8, 9), "ar"), "9 سبتمبر 2026");

const legacy = {
  ref: "WP-9",
  createdAt: "2026-09-09T00:00:00.000Z",
  raiserName: "علي",
  editedAt: "2026-09-09T01:00:00.000Z",
  editedBy: "سارة",
  endedAt: "2026-09-09T02:00:00.000Z",
  endedBy: "فهد",
  status: "sealed",
};
const legacyRows = buildWorkProofAuditTimeline(legacy, "ar");
assert.equal(legacyRows[0].type, "raise");
assert.match(legacyRows[0].text, /علي/);
assert.equal(legacyRows[1].type, "edit");
assert.match(legacyRows[1].text, /سارة/);
assert.equal(legacyRows[2].type, "end");
assert.match(legacyRows[2].text, /فهد/);

let trail = appendWorkProofAudit(null, "raise", { id: "a", name: "علي" }, { at: "2026-09-09T00:00:00.000Z" });
trail = appendWorkProofAudit({ auditTrail: trail }, "edit", { id: "b", name: "سارة" }, { at: "2026-09-09T01:00:00.000Z" });
trail = appendWorkProofAudit({ auditTrail: trail }, "edit", { id: "c", name: "فهد" }, { at: "2026-09-09T01:30:00.000Z" });
trail = appendWorkProofAudit({ auditTrail: trail }, "end", { id: "c", name: "فهد" }, { at: "2026-09-09T02:00:00.000Z" });
const liveRows = buildWorkProofAuditTimeline({ auditTrail: trail }, "ar");
assert.equal(liveRows.filter((row) => row.type === "edit").length, 2);
assert.equal(liveRows[3].type, "end");
assert.match(liveRows[3].text, /أُغلق الإثبات بواسطة فهد/);

// Place and the ministerial sun ban. Every figure comes from the hours.heat.* rule
// rows through heatBanWindow — a literal 12:00 or 15 June here would outlive the rule.
const win = heatBanWindow();
const pad2 = (n) => String(n).padStart(2, "0");
const heatCite = citeRule("hours.heat.cite");
assert.equal(heatCite?.article, "122");
assert.equal(HEAT_BAN_DECISION.id, "3337");

function dayAfter(dayKey, step = 1) {
  const d = new Date(`${dayKey}T00:00:00`);
  d.setDate(d.getDate() + step);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** Riyadh wall clock, spelled with the offset so the machine's own zone cannot skew it. */
function riyadhAt(dayKey, hour, minute = 0) {
  return `${dayKey}T${pad2(hour)}:${pad2(minute)}:00+03:00`;
}

const seasonYear = new Date().getFullYear();
const seasonDay = dayAfter(`${seasonYear}-${pad2(win.fromMonth)}-${pad2(win.fromDay)}`, 15);
const seasonNextDay = dayAfter(seasonDay);
const decemberDay = `${seasonYear}-12-15`;
assert.equal(isHeatBanDate(seasonDay), true);
assert.equal(isHeatBanDate(seasonNextDay), true);
assert.equal(isHeatBanDate(decemberDay), false);

// The place is the tasks vocabulary, not a second one.
assert.deepEqual(TASK_MODES.map((m) => m.id), ["onsite", "field", "remote"]);
assert.equal(normalizeProofPlace("FIELD"), "field");
assert.equal(normalizeProofPlace("outdoor"), "");
assert.equal(proofPlaceLabel("field", "ar"), taskModeLabel("field", "ar"));
assert.equal(proofPlaceLabel("onsite", "en"), taskModeLabel("onsite", "en"));

// Raise without a place is refused — a silent default would decide the ban for the crew.
const noPlace = checkProofPlaceGate("");
assert.equal(noPlace.ok, false);
assert.equal(noPlace.error, "PROOF_PLACE_REQUIRED");
assert.match(noPlace.reason, /مكان التنفيذ/);
assert.match(noPlace.reason, /حظر العمل تحت أشعة الشمس/);
assert.equal(checkProofPlaceGate("field").ok, true);
assert.equal(checkProofPlaceGate("field").place, "field");
assert.equal(checkProofPlaceGate(undefined).ok, false);
assert.equal(isOutdoorProof({ place: "field" }), true);
assert.equal(isOutdoorProof({ place: "onsite" }), false);
assert.equal(isOutdoorProof({}), false);

// Before the fact: opening an open-air proof inside the window is refused, by name.
const banned = checkProofHeatBanGate({ place: "field", now: riyadhAt(seasonDay, win.startHour + 1) });
assert.equal(banned.ok, false);
assert.equal(banned.error, "HEAT_BAN");
assert.equal(banned.ruleId, "hours.heat.startHour");
assert.equal(banned.dayKey, seasonDay);
assert.equal(banned.at, `${pad2(win.startHour + 1)}:00`);
assert.ok(banned.reason.includes(heatBanDecisionLabel(true)));
assert.match(banned.reason, new RegExp(HEAT_BAN_DECISION.id));
assert.ok(banned.reason.includes(win.startLabel));
assert.ok(banned.reason.includes(win.endLabel));
assert.ok(banned.reason.includes(win.seasonAr));
assert.ok(banned.reasonEn.includes(heatBanDecisionLabel(false)));
assert.equal(banned.cite?.article, heatCite.article);

// Lawful open air: before the window in season, inside the window off season, indoors always.
const beforeWindow = checkProofHeatBanGate({ place: "field", now: riyadhAt(seasonDay, Math.max(0, win.startHour - 3)) });
assert.equal(beforeWindow.ok, true);
assert.equal(beforeWindow.skipped, "off_window");
const offSeason = checkProofHeatBanGate({ place: "field", now: riyadhAt(decemberDay, win.startHour + 1) });
assert.equal(offSeason.ok, true);
assert.equal(offSeason.skipped, "off_season");
const indoors = checkProofHeatBanGate({ place: "onsite", now: riyadhAt(seasonDay, win.startHour + 1) });
assert.equal(indoors.ok, true);
assert.equal(indoors.skipped, "not_outdoor");
assert.equal(checkProofHeatBanGate({ place: "remote", now: riyadhAt(seasonDay, win.startHour + 1) }).ok, true);
assert.equal(checkProofHeatBanGate().ok, true);

// After the fact: the record stands and the breach is counted in minutes.
const windowMinutes = (win.endHour - win.startHour) * 60;
const coveredDay = {
  place: "field",
  startedAt: riyadhAt(seasonDay, Math.max(0, win.startHour - 2)),
  endedAt: riyadhAt(seasonDay, win.endHour + 1),
};
assert.equal(proofHeatBanMinutes(coveredDay), windowMinutes);
const partialDay = {
  place: "field",
  startedAt: riyadhAt(seasonDay, win.startHour + 1),
  endedAt: riyadhAt(seasonDay, win.endHour + 1),
};
assert.equal(proofHeatBanMinutes(partialDay), windowMinutes - 60);
// Wholly inside the window: only the worked part of it counts, not the whole window.
const insideWindow = {
  place: "field",
  startedAt: riyadhAt(seasonDay, win.startHour, 30),
  endedAt: riyadhAt(seasonDay, win.endHour - 1, 30),
};
assert.equal(proofHeatBanMinutes(insideWindow), windowMinutes - 60);
// Overnight: the span is counted per calendar day, so each day's window is its own.
const overnightOneHour = {
  place: "field",
  startedAt: riyadhAt(seasonDay, win.endHour + 1),
  endedAt: riyadhAt(seasonNextDay, win.startHour + 1),
};
assert.equal(proofHeatBanMinutes(overnightOneHour), 60);
const overnightBothWindows = {
  place: "field",
  startedAt: riyadhAt(seasonDay, Math.max(0, win.startHour - 1)),
  endedAt: riyadhAt(seasonNextDay, win.endHour + 1),
};
assert.equal(proofHeatBanMinutes(overnightBothWindows), windowMinutes * 2);
// A span of several days steps day by day, so every in-season day it covered is counted.
const fourDaySpan = {
  place: "field",
  startedAt: riyadhAt(seasonDay, 0),
  endedAt: riyadhAt(dayAfter(seasonDay, 3), 23),
};
assert.equal(proofHeatBanMinutes(fourDaySpan), windowMinutes * 4);
// Wholly outside the window, indoors, or still open — nothing to count.
const clearOfWindow = {
  place: "field",
  startedAt: riyadhAt(seasonDay, Math.max(0, win.startHour - 3)),
  endedAt: riyadhAt(seasonDay, Math.max(1, win.startHour - 1)),
};
assert.equal(proofHeatBanMinutes(clearOfWindow), 0);
assert.equal(proofHeatBanMinutes({ ...coveredDay, place: "onsite" }), 0);
assert.equal(proofHeatBanMinutes({ ...coveredDay, endedAt: null }), 0);
assert.equal(proofHeatBanMinutes({ ...coveredDay, startedAt: coveredDay.endedAt, endedAt: coveredDay.startedAt }), 0);
assert.equal(proofHeatBanMinutes({ place: "field", startedAt: riyadhAt(decemberDay, 0), endedAt: riyadhAt(decemberDay, 23) }), 0);

const flag = deriveProofHeatBanFlag(coveredDay);
assert.equal(flag.id, "heat_ban");
assert.equal(flag.level, "block");
assert.equal(flag.minutes, windowMinutes);
assert.equal(flag.cite?.article, heatCite.article);
assert.ok(flag.textAr.includes(String(windowMinutes)));
assert.ok(flag.textAr.includes(win.startLabel));
assert.ok(flag.textAr.includes(win.endLabel));
assert.ok(flag.textAr.includes(heatBanDecisionLabel(true)));
assert.equal(deriveProofHeatBanFlag(clearOfWindow), null);
assert.equal(deriveProofHeatBanFlag({ ...coveredDay, place: "onsite" }), null);

// The severity ladder: red is meaning, not decoration. Inside the ban season the
// open-air place is a red alert whatever the hour, and the banned hours themselves
// are the heavier red; off season the same decision is reference and nothing alarms.
assert.deepEqual(HEAT_BAN_STATE_LEVEL, {
  off_season: "cite",
  before_window: "alert",
  in_window: "block",
  after_window: "alert",
});
// The ladder itself, stated as a relation so a future rename cannot quietly drop a
// state out of the red: off season is alone in its level, the two lawful in-season
// hours share one, and the refused hour is a level of its own above them.
const IN_SEASON_STATES = ["before_window", "in_window", "after_window"];
const inSeasonLevels = IN_SEASON_STATES.map((s) => HEAT_BAN_STATE_LEVEL[s]);
assert.equal(inSeasonLevels.includes(HEAT_BAN_STATE_LEVEL.off_season), false);
assert.equal(HEAT_BAN_STATE_LEVEL.before_window, HEAT_BAN_STATE_LEVEL.after_window);
assert.notEqual(HEAT_BAN_STATE_LEVEL.in_window, HEAT_BAN_STATE_LEVEL.before_window);
assert.equal(new Set(inSeasonLevels).size, 2);
assert.equal(heatBanClockState({ dayKey: decemberDay, minutes: win.startHour * 60 }), "off_season");
assert.equal(heatBanClockState({ dayKey: seasonDay, minutes: win.startHour * 60 - 1 }), "before_window");
assert.equal(heatBanClockState({ dayKey: seasonDay, minutes: win.startHour * 60 }), "in_window");
assert.equal(heatBanClockState({ dayKey: seasonDay, minutes: win.endHour * 60 - 1 }), "in_window");
assert.equal(heatBanClockState({ dayKey: seasonDay, minutes: win.endHour * 60 }), "after_window");

// State 1 — outside the season the same figures are reference, so the level is a cite.
const offSeasonNotice = deriveProofHeatBanNotice({ place: "field", now: riyadhAt(decemberDay, win.startHour + 1) });
assert.equal(offSeasonNotice.state, "off_season");
assert.equal(offSeasonNotice.level, HEAT_BAN_STATE_LEVEL.off_season);
assert.equal(offSeasonNotice.cite?.article, heatCite.article);
assert.ok(offSeasonNotice.textAr.includes(win.seasonAr));
assert.ok(offSeasonNotice.textAr.includes(win.startLabel));
assert.ok(offSeasonNotice.textAr.includes(win.endLabel));
assert.ok(offSeasonNotice.textAr.includes(heatBanDecisionLabel(true)));

// State 2 — before noon in season the ban already bites today, so the proof is told
// in red when the hands must stop, without borrowing the refusal's heavier level.
const notice = deriveProofHeatBanNotice({ place: "field", now: riyadhAt(seasonDay, Math.max(0, win.startHour - 3)) });
assert.equal(notice.state, "before_window");
assert.equal(notice.level, HEAT_BAN_STATE_LEVEL.before_window);
assert.equal(notice.id, "heat_ban_ahead");
assert.equal(notice.cite?.article, heatCite.article);
assert.ok(notice.textAr.includes(win.startLabel));
assert.ok(notice.textAr.includes(win.endLabel));
assert.ok(notice.textAr.includes(win.seasonAr));
assert.notEqual(notice.level, HEAT_BAN_STATE_LEVEL.off_season);
// After the window closes the day is still in season — the window opens again
// tomorrow — so the alert holds at the same level it had this morning.
const passedNotice = deriveProofHeatBanNotice({ place: "field", now: riyadhAt(seasonDay, win.endHour + 1) });
assert.equal(passedNotice.state, "after_window");
assert.equal(passedNotice.level, HEAT_BAN_STATE_LEVEL.after_window);
assert.equal(passedNotice.level, notice.level);
assert.notEqual(passedNotice.level, HEAT_BAN_STATE_LEVEL.off_season);

// State 3 — the heaviest level, and it agrees with the gate that refuses the raise.
const liveNotice = deriveProofHeatBanNotice({ place: "field", now: riyadhAt(seasonDay, win.startHour + 1) });
assert.equal(liveNotice.state, "in_window");
assert.equal(liveNotice.level, HEAT_BAN_STATE_LEVEL.in_window);
assert.equal(liveNotice.at, `${pad2(win.startHour + 1)}:00`);
assert.equal(
  liveNotice.level,
  banned.ok === false ? HEAT_BAN_STATE_LEVEL.in_window : HEAT_BAN_STATE_LEVEL.before_window,
);
assert.ok(liveNotice.textAr.includes(win.startLabel));
assert.ok(liveNotice.textAr.includes(win.endLabel));

// State 4 — a recorded breach keeps the alarm whatever the clock now says.
assert.equal(flag.level, HEAT_BAN_STATE_LEVEL.in_window);

// Indoors and remote never reach the ladder at all.
assert.equal(deriveProofHeatBanNotice({ place: "onsite", now: riyadhAt(seasonDay, Math.max(0, win.startHour - 3)) }), null);
assert.equal(deriveProofHeatBanNotice({ place: "remote", now: riyadhAt(seasonDay, win.startHour + 1) }), null);
assert.equal(deriveProofHeatBanNotice(), null);

// The breach is carried on the audit trail, so closing cannot drop it.
const breachTrail = appendWorkProofAudit({ auditTrail: [] }, "heat_ban", { id: "mgr1", name: "فهد" }, { detail: flag.textAr });
const breachRows = buildWorkProofAuditTimeline({ ...coveredDay, ref: "WP-1", auditTrail: breachTrail }, "ar");
assert.equal(breachRows[0].type, "heat_ban");
assert.match(breachRows[0].text, /مخالفة حظر العمل تحت أشعة الشمس/);
assert.equal(breachRows[0].detail, flag.textAr);

console.log("workProof derivations: PASS");
