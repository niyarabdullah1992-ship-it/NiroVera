import assert from "node:assert/strict";
// Safety cards: the branch rule of المهام / إثبات العمل / إثبات الزائر, named redactions, stages, decisions.
import * as fe from "../src/lib/safetyBranchVisibility.js";
import * as be from "../base44/shared/safetyBranchVisibility.ts";

const NOW = Date.parse("2026-10-18T09:00:00Z");
const day = 24 * 3600 * 1000;
const omar = { id: "emp_omar", name: "عمر", stationId: "st_north" };
const hassan = { id: "emp_hassan", name: "حسن", stationId: "st_north" };
const noura = { id: "emp_noura", name: "نورة", stationId: "st_east" };
const owner = { id: "own", name: "نيار", stationId: "st_north" };

const named = { id: "inc_1", at: new Date(NOW - day).toISOString(), by: "عمر", reporterId: "emp_omar", status: "open", step: 0, card: { code: "HSE-2610-AAAA", reporterId: "emp_omar", score: 12, levelKey: "high" } };
const anon = { id: "inc_2", at: new Date(NOW - 2 * day).toISOString(), by: "", reporterId: "emp_omar", anonymous: true, status: "open", card: { code: "HSE-2610-BBBB", reporterId: "emp_omar", anonymous: true, score: 4 } };
const injury = { id: "inc_3", at: new Date(NOW - 3 * day).toISOString(), by: "حسن", reporterId: "emp_hassan", status: "open", card: { code: "HSE-2610-CCCC", reporterId: "emp_hassan", injured: true, injuredSelf: false, injuredName: "سالم", injuredEmployeeId: "emp_salem", score: 9 } };
const east = { id: "inc_4", at: new Date(NOW - day).toISOString(), by: "نورة", reporterId: "emp_noura", status: "open", card: { code: "HSE-2610-DDDD", reporterId: "emp_noura", score: 2 } };
const safety = [
  { stationId: "st_north", incidentLog: [named, anon, injury] },
  { stationId: "st_east", incidentLog: [east] },
];
const stations = [{ id: "st_north", name: "الخفجي" }, { id: "st_east", name: "رابغ" }];

for (const lib of [fe, be]) {
  // 1. The reporter sees his own card — an anonymous card too, by id; a name never matches an anonymous card.
  assert.equal(lib.safetyCardIsMine(anon, omar), true);
  assert.equal(lib.safetyCardIsMine({ ...anon, reporterId: "", card: { anonymous: true } }, omar), false);
  assert.equal(lib.safetyCardIsMine({ by: "عمر" }, { id: "x", name: "عمر" }), true);

  // 2. Same-branch staff see the branch's cards; 4. another branch does not, with a named reason.
  assert.equal(lib.safetyCardAccess({ item: named, stationId: "st_north", viewer: hassan }).see, true);
  const other = lib.safetyCardAccess({ item: named, stationId: "st_north", viewer: noura });
  assert.equal(other.see, false);
  assert.equal(other.reason, "OTHER_BRANCH");
  assert.ok(other.reasonAr.includes("فرع آخر"));
  // 3. A manager sees the branches in his scope.
  assert.equal(lib.safetyCardAccess({ item: named, stationId: "st_north", viewer: noura, managedStationIds: ["st_north"] }).see, true);
  assert.equal(lib.safetyCardAccess({ item: east, stationId: "st_east", viewer: owner, all: true }).managed, true);

  // Redactions: anonymous → reporter hidden from everyone but the reporter (managers too).
  const peerAnon = lib.safetyCardAccess({ item: anon, stationId: "st_north", viewer: hassan });
  assert.deepEqual(peerAnon.redactions.map((r) => r.key), ["reporter"]);
  const mgrAnon = lib.safetyCardAccess({ item: anon, stationId: "st_north", viewer: owner, all: true });
  assert.deepEqual(mgrAnon.redactions.map((r) => r.key), ["reporter"]);
  assert.deepEqual(lib.safetyCardAccess({ item: anon, stationId: "st_north", viewer: omar }).redactions, []);
  const shownAnon = lib.redactSafetyItem(anon, peerAnon.redactions);
  assert.equal(shownAnon.reporterId, "");
  assert.equal(shownAnon.card.reporterId, "");
  assert.equal(anon.reporterId, "emp_omar", "the stored row is untouched");
  // injury → the injured name is for the reporter and managers only.
  const peerInjury = lib.safetyCardAccess({ item: injury, stationId: "st_north", viewer: omar });
  assert.deepEqual(peerInjury.redactions.map((r) => r.key), ["injured"]);
  const shownInjury = lib.redactSafetyItem(injury, peerInjury.redactions);
  assert.equal(shownInjury.card.injuredName, "");
  assert.equal(shownInjury.card.injuredEmployeeId, "");
  assert.equal("injuredSelf" in shownInjury.card, false);
  assert.equal(shownInjury.card.injured, true, "the fact of an injury stays visible");
  assert.deepEqual(lib.safetyCardAccess({ item: injury, stationId: "st_north", viewer: hassan }).redactions, []);
  assert.deepEqual(lib.safetyCardAccess({ item: injury, stationId: "st_north", viewer: owner, managedStationIds: ["st_north"] }).redactions, []);

  // The list a viewer gets: hassan (north) sees the three north cards and not the east one.
  const forHassan = lib.safetyCardsVisibleTo({ safety, stations, viewer: hassan, now: NOW });
  assert.deepEqual(forHassan.map((r) => r.item.id), ["inc_1", "inc_2", "inc_3"]);
  assert.equal(forHassan.find((r) => r.item.id === "inc_2").item.reporterId, "");
  assert.equal(forHassan.find((r) => r.item.id === "inc_3").mine, true);
  const forNoura = lib.safetyCardsVisibleTo({ safety, stations, viewer: noura, now: NOW });
  assert.deepEqual(forNoura.map((r) => r.item.id), ["inc_4"]);
  const forOwner = lib.safetyCardsVisibleTo({ safety, stations, viewer: owner, managedStationIds: ["st_north", "st_east"], now: NOW });
  assert.equal(forOwner.length, 4);
  assert.equal(forOwner.find((r) => r.item.id === "inc_4").stationName, "رابغ");

  // Stages and counts: open → progress → closed → archive; the faces add up to الكل.
  assert.equal(lib.safetyCardStage(named, NOW), "open");
  assert.equal(lib.safetyCardStage({ ...named, assignedTo: { id: "x" } }, NOW), "progress");
  assert.equal(lib.safetyCardStage({ ...named, escalated: true }, NOW), "progress");
  assert.equal(lib.safetyCardStage({ ...named, status: "closed", closedAt: new Date(NOW - 2 * day).toISOString() }, NOW), "closed");
  assert.equal(lib.safetyCardStage({ ...named, status: "closed", closedAt: new Date(NOW - 31 * day).toISOString() }, NOW), "archive");
  const counts = lib.safetyCardFaceCounts([{ stage: "open" }, { stage: "progress" }, { stage: "closed" }, { stage: "archive" }, { stage: "open" }]);
  assert.deepEqual(counts, { all: 5, open: 2, progress: 1, closed: 1, archive: 1 });
  assert.equal(counts.open + counts.progress + counts.closed + counts.archive, counts.all);
  assert.equal(lib.safetyCardsOnFace([{ stage: "open" }, { stage: "closed" }], "closed").length, 1);

  // Decisions: each refusal names its reason.
  const gate = (args) => lib.checkSafetyDecisionGate({ actor: owner, ...args });
  assert.equal(gate({ item: null, action: "assign" }).error, "NOT_FOUND");
  assert.equal(gate({ item: { ...named, status: "closed" }, action: "close", note: "x".repeat(20) }).error, "ALREADY_CLOSED");
  assert.equal(gate({ item: named, action: "assign" }).error, "ASSIGNEE_REQUIRED");
  assert.equal(gate({ item: named, action: "assign", assignee: { id: "emp_hassan" } }).ok, true);
  assert.equal(gate({ item: named, action: "action", note: "قصير" }).error, "ACTION_TEXT_REQUIRED");
  assert.equal(gate({ item: named, action: "action", note: "نُظّفت الأرضية ووُضع شريط" }).ok, true);
  assert.equal(gate({ item: named, action: "close", note: "قصير" }).error, "CLOSE_REASON_REQUIRED");
  assert.equal(gate({ item: named, action: "close", note: "عولج الخطر بالكامل" }).error, "ACTION_FIRST");
  const acted = { ...named, correctiveAction: { text: "نُظّفت الأرضية" } };
  assert.equal(gate({ item: acted, action: "close", note: "عولج الخطر بالكامل" }).error, "AFTER_PHOTO_REQUIRED");
  assert.equal(gate({ item: acted, action: "close", note: "عولج الخطر بالكامل", afterPhotoName: "after.jpg" }).ok, true);
  const positive = { ...named, card: { ...named.card, positive: true } };
  assert.equal(gate({ item: positive, action: "close", note: "عُمّمت في الجولة" }).ok, true, "a positive note closes with a reason only");
  assert.equal(lib.checkSafetyDecisionGate({ item: named, action: "assign", actor: omar, assignee: { id: "x" } }).error, "OWN_REPORT");
  assert.equal(lib.checkSafetyDecisionGate({ item: named, action: "escalate", actor: omar }).ok, true, "the reporter may escalate his own card");
  assert.equal(gate({ item: named, action: "escalate" }).nextLevel, 1);
  assert.equal(gate({ item: { ...named, escalationLevel: 1, escalated: true }, action: "escalate" }).nextLevel, 2);
  assert.equal(gate({ item: { ...named, escalationLevel: 2 }, action: "escalate" }).error, "AT_TOP");
  assert.equal(gate({ item: named, action: "delete" }).error, "UNKNOWN_ACTION");

  // Trail: the raise first; an anonymous raise carries no name; rows from before the trail are read from stamps.
  const trail = lib.safetyCardAuditTrail({ ...anon, audit: [{ type: "assign", at: new Date(NOW).toISOString(), by: "نيار", note: "حسن" }] });
  assert.deepEqual(trail.map((r) => r.type), ["raised", "assign"]);
  assert.equal(trail[0].by, "");
  assert.equal(trail[1].label, "أُسند للمعالجة");
  const legacy = lib.safetyCardAuditTrail({ ...named, status: "closed", escalatedAt: new Date(NOW - day / 2).toISOString(), escalatedBy: "س", reviewedAt: new Date(NOW).toISOString(), reviewedBy: "ص" }, "en");
  assert.deepEqual(legacy.map((r) => r.type), ["raised", "escalate", "close"]);
  assert.equal(legacy[2].label, "Closed with a written reason");

  // The reporter's notice names the card's number, never the reporter.
  const notice = lib.safetyReporterNotice("close", anon);
  assert.ok(notice.includes("HSE-2610-BBBB") && !notice.includes("عمر"));
  assert.ok(lib.safetyReporterNotice("assign", named, { assigneeName: "حسن" }).includes("حسن"));
  assert.ok(lib.safetyReporterNotice("escalate", named, { level: 2 }).includes("الإدارة العليا"));
  assert.equal(lib.safetyReporterNotice("unknown", named), "");
}

// Parity: the server twin returns the same reading.
for (const viewer of [omar, hassan, noura, owner]) {
  const args = { safety, stations, viewer, managedStationIds: viewer === owner ? ["st_north", "st_east"] : [], now: NOW };
  assert.deepEqual(be.safetyCardsVisibleTo(args), fe.safetyCardsVisibleTo(args), viewer.id);
}

console.log("safety branch visibility: ok");
