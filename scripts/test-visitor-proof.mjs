import assert from "node:assert/strict";
import {
  checkCloseVisitorProofGate,
  deriveVisitorProofCounts,
  deriveVisitorProofStage,
  groupVisitorProofsByStation,
  isVisitorProofRecord,
  visitorProofClockSource,
  visitorProofFields,
  visitorProofRowText,
  visitorProofScopeLabel,
  visitorProofsForStations,
  visitorProofsOnly,
  visitDurationDays,
  visitDurationLabel,
  visitPeriodLabel,
  visitRangeLabel,
  visitStationIds,
} from "../src/lib/visitorProof.js";

const missingStation = visitorProofFields({
  visitReason: "صيانة",
  people: [{ name: "أحمد", nationality: "سعودي" }],
});
assert.equal(missingStation.error, "STATION_REQUIRED");

const missingReason = visitorProofFields({
  stationId: "dammam",
  people: [{ name: "أحمد", nationality: "سعودي" }],
});
assert.equal(missingReason.error, "REASON_REQUIRED");

const missingVisitor = visitorProofFields({
  stationId: "dammam",
  visitReason: "صيانة",
  people: [{ name: "", nationality: "سعودي" }],
});
assert.equal(missingVisitor.error, "VISITOR_REQUIRED");

const missingNationality = visitorProofFields({
  stationId: "dammam",
  visitReason: "صيانة",
  people: [{ name: "أحمد" }],
});
assert.equal(missingNationality.error, "NATIONALITY_REQUIRED");

const missingTo = visitorProofFields({
  stationId: "dammam",
  visitReason: "زيارة موقع",
  visitFrom: "2026-09-08",
  people: [{ name: "أحمد", nationality: "سعودي" }],
});
assert.equal(missingTo.error, "VISIT_TO_REQUIRED");

const inverted = visitorProofFields({
  stationId: "dammam",
  visitReason: "زيارة موقع",
  visitFrom: "2026-09-10",
  visitTo: "2026-09-08",
  people: [{ name: "أحمد", nationality: "سعودي" }],
});
assert.equal(inverted.error, "DATE_RANGE_INVALID");

const ok = visitorProofFields({
  stationId: "dammam",
  visitReason: "زيارة موقع",
  visitFrom: "2026-09-08",
  visitTo: "2026-09-12",
  people: [
    { name: "أحمد", nationality: "سعودي", idType: "national_id", id: "1xxxxxxxx", phone: "0500000001" },
    { name: "سام", nationality: "هندي", idType: "iqama", id: "2xxxxxxxx" },
  ],
  vehicles: [
    { maker: "تويوتا", model: "هايلكس", type: "بيك أب", year: "2022", plateLetters: "أ ب ج", plateNumbers: "1234" },
    { maker: "نيسان", model: "باترول", plateLetters: "د هـ و", plateNumbers: "5678" },
  ],
});
assert.equal(ok.ok, true);
assert.equal(ok.fields.people.length, 2);
assert.equal(ok.fields.vehicles.length, 2);
assert.equal(ok.fields.people[0].nationality, "سعودي");
assert.equal(ok.fields.people[1].idType, "iqama");
assert.equal(ok.fields.visitFrom, "2026-09-08");
assert.equal(ok.fields.visitTo, "2026-09-12");

const sameDay = visitorProofFields({
  stationId: "dammam",
  visitReason: "يوم واحد",
  visitFrom: "2026-09-08",
  visitTo: "2026-09-08",
  people: [{ name: "أحمد", nationality: "سعودي" }],
});
assert.equal(sameDay.ok, true);
assert.equal(sameDay.fields.visitFrom, sameDay.fields.visitTo);
assert.equal(visitDurationDays(sameDay.fields), 1);
assert.equal(visitDurationLabel(sameDay.fields, true), "يوم واحد");
assert.match(visitRangeLabel(sameDay.fields, true), /^08\/09\/2026 → 08\/09\/2026$/);
assert.equal(visitPeriodLabel(sameDay.fields, true), "08/09/2026 → 08/09/2026 · يوم واحد");

assert.equal(visitDurationDays(ok.fields), 5);
assert.equal(visitDurationLabel(ok.fields, true), "5 أيام");
assert.equal(visitDurationDays({ visitFrom: "2026-09-08" }), 1);
assert.equal(visitDurationDays({ visitFrom: "2026-09-08", visitTo: "2026-09-09" }), 2);
assert.equal(visitDurationLabel({ visitFrom: "2026-09-08", visitTo: "2026-09-09" }, true), "يومان");

const noStations = visitorProofFields({
  visitReason: "جولة",
  visitFrom: "2026-09-08",
  visitTo: "2026-09-08",
  people: [{ name: "أحمد", nationality: "سعودي" }],
  stationIds: [],
});
assert.equal(noStations.error, "STATION_REQUIRED");

const multi = visitorProofFields({
  stationIds: ["dammam", "jeddah", "dammam"],
  visitReason: "جولة",
  visitFrom: "2026-09-08",
  visitTo: "2026-09-08",
  people: [{ name: "أحمد", nationality: "سعودي" }],
});
assert.equal(multi.ok, true);
assert.deepEqual(multi.fields.stationIds, ["dammam", "jeddah"]);
assert.equal(multi.fields.stationId, "dammam");
assert.equal(visitorProofsForStations(multi.fields).length, 2);
assert.equal(visitorProofsForStations(multi.fields)[1].stationId, "jeddah");
assert.deepEqual(visitStationIds({ stationId: "hq" }), ["hq"]);

const grouped = groupVisitorProofsByStation(
  [
    { id: "1", stationId: "jeddah", title: "سام" },
    { id: "2", stationId: "dammam", title: "أحمد" },
    { id: "3", stationId: "dammam", title: "نورة" },
  ],
  [
    { id: "dammam", name: "فرع الدمام" },
    { id: "jeddah", name: "فرع جدة" },
  ],
  true,
);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].name, "فرع الدمام");
assert.equal(grouped[0].items.length, 2);
assert.equal(grouped[1].name, "فرع جدة");
assert.equal(grouped[1].items.length, 1);

const open = { id: "vp1", raiserId: "emp1", status: "on_site" };
assert.equal(deriveVisitorProofStage(open), "on_site");
assert.equal(deriveVisitorProofStage({ ...open, leftAt: new Date().toISOString() }), "left");
assert.equal(checkCloseVisitorProofGate({ proof: open, actorUserId: "emp1" }).ok, true);
assert.equal(checkCloseVisitorProofGate({ proof: open, actorUserId: "other" }).error, "BRANCH_OR_MANAGER_REQUIRED");
assert.equal(checkCloseVisitorProofGate({ proof: open, actorUserId: "other", sameBranch: true }).ok, true);
assert.equal(checkCloseVisitorProofGate({ proof: { ...open, status: "left" }, actorUserId: "emp1" }).error, "ALREADY_LEFT");

const counts = deriveVisitorProofCounts([open, { ...open, id: "vp2", status: "left", leftAt: "2026-09-08" }]);
assert.equal(counts.all, 2);
assert.equal(counts.on_site, 1);
assert.equal(counts.left, 1);

const withDocs = visitorProofFields({
  stationId: "dammam",
  visitReason: "صيانة",
  visitFrom: "2026-09-08",
  visitTo: "2026-09-08",
  people: [{ name: "أحمد", nationality: "سعودي" }],
  attachments: [{ url: "data:text/plain,ok", name: "id.pdf", type: "application/pdf" }],
});
assert.equal(withDocs.ok, true);
assert.equal(withDocs.fields.attachments[0].name, "id.pdf");

assert.equal(visitorProofScopeLabel(true), "كل الزوار");
assert.equal(visitorProofScopeLabel(false), "All visitors");
assert.equal(/موظف/.test(visitorProofScopeLabel(true)), false);
assert.equal(/staff|employee/i.test(visitorProofScopeLabel(false)), false);

assert.equal(isVisitorProofRecord({ kind: "visitor", title: "مهندس تفتيش" }), true);
assert.equal(isVisitorProofRecord({ kind: "work", title: "جهة خارجية" }), false);
assert.equal(isVisitorProofRecord({ name: "عمر", state: "on" }), false);
assert.equal(visitorProofsOnly([
  { kind: "visitor", personName: "خالد المرشد", title: "مهندس تفتيش" },
  { kind: "work", title: "إثبات عمل" },
  { name: "سارة", state: "on" },
]).length, 1);

assert.equal(
  visitorProofRowText({ title: "مهندس تفتيش", people: [{ name: "خالد المرشد" }], personName: "خالد المرشد" }, true),
  "خالد المرشد",
);
assert.equal(
  visitorProofRowText({ title: "مهندس تفتيش", people: [{ name: "خالد المرشد" }, { name: "رافق علي" }] }, true),
  "خالد المرشد و1 زوار",
);
assert.equal(visitorProofClockSource({ visitFrom: "2026-09-15", arrivedAt: "2026-09-15T09:00:00" }), "2026-09-15T09:00:00");
assert.equal(visitorProofClockSource({ visitFrom: "2026-09-15" }), "");

const mixed = [
  {
    kind: "visitor",
    title: "مهندس تفتيش",
    personName: "خالد المرشد",
    people: [{ name: "خالد المرشد" }],
    arrivedAt: "2026-09-15T09:00:00",
  },
  { kind: "work", title: "إثبات عمل" },
  { name: "عمر ناصر", state: "on" },
];
const visits = visitorProofsOnly(mixed);
assert.equal(visits.length, 1);
assert.equal(visitorProofScopeLabel(true), "كل الزوار");
assert.equal(visitorProofRowText(visits[0], true), "خالد المرشد");
assert.equal(visits.some((item) => item.name === "عمر ناصر"), false);

console.log("visitor-proof ok");
