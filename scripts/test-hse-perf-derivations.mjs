import assert from "node:assert/strict";
import { deriveHseRates, checkHazardCloseGate, exposureHours, reportingPointsFor } from "../src/lib/hseDerivations.js";
import { deriveOpenRiskMap } from "../src/lib/safetyReportCard.js";
import { scoreEmployee, scoreBoard, PERF_WEIGHTS, blendHseTerm, deriveFairHseRates } from "../src/lib/perfDerivations.js";

assert.equal(exposureHours(10), 20800);
const rates = deriveHseRates(50, { lti: 1, restrict: 1, medical: 0, nearMiss: 20 });
assert.equal(rates.exposureHours, 104000);
assert.ok(rates.trir > 0);
assert.ok(rates.dartRate > 0);
assert.ok(rates.ltifr > 0);

assert.equal(checkHazardCloseGate({ controlId: null, beforePhoto: 1, afterPhoto: 1 }).error, "CONTROL_REQUIRED");
assert.equal(checkHazardCloseGate({ controlId: "ppe", inherent: 16, beforePhoto: 1, afterPhoto: 1 }).error, "WEAK_CONTROL");
assert.equal(checkHazardCloseGate({ controlId: "eng", inherent: 9, beforePhoto: null, afterPhoto: 1 }).error, "BEFORE_PHOTO_REQUIRED");
assert.equal(checkHazardCloseGate({ controlId: "eng", inherent: 9, beforePhoto: "before", afterPhoto: "after" }).ok, true);

assert.equal(reportingPointsFor("hazard", 12), 4);
assert.equal(reportingPointsFor("lti", 12), 0);

assert.equal(blendHseTerm(100, 0), 70);

const clean = deriveFairHseRates({});
assert.equal(clean.closurePct, 100);
assert.equal(clean.reportPct, 100);
assert.equal(clean.hsePct, 100);

const openDuty = deriveFairHseRates({ assignedOpen: 1, hazardTotal: 1, hazardClosed: 0 });
assert.equal(openDuty.closurePct, 0);
assert.equal(openDuty.reportPct, 0);
assert.equal(openDuty.hsePct, 0);
assert.equal(PERF_WEIGHTS.att, 0);

const s = scoreEmployee({ pts: 50, maxPts: 100, ontimePct: 80, closurePct: 100, reportPct: 50, coverPct: 40 });
assert.equal(s.ptsPct, 50);
assert.equal(s.hse, 85);
assert.ok(s.score >= s.newScore);
assert.ok(s.score >= s.oldScore);

const board = scoreBoard([
  { employeeId: "a", name: "A", pts: 20, ontimePct: 90, closure: 5, reportPts: 2, coverPts: 1 },
  { employeeId: "b", name: "B", pts: 10, ontimePct: 70, closure: 2, reportPts: 8, coverPts: 4 },
]);
assert.equal(board[0].rank, 1);
assert.ok(board[0].score >= board[1].score);

const bare = deriveOpenRiskMap([
  { status: "open", description: "شبه حادثة — سقوط أداة من السقالة" },
]);
assert.equal(bare.openCount, 1);
assert.equal(bare.buckets.find((band) => band.key === "critical").n, 0);
assert.equal(bare.buckets.find((band) => band.key === "high").n, 0);
assert.equal(bare.buckets.find((band) => band.key === "medium").n, 0);
assert.equal(bare.buckets.find((band) => band.key === "low").n, 0);
assert.equal(bare.buckets.find((band) => band.key === "ungraded").n, 1);
assert.equal(bare.buckets.find((band) => band.key === "ungraded").ar, "بلا درجة");
assert.equal(bare.buckets.reduce((sum, band) => sum + band.n, 0), bare.openCount);

const mixed = deriveOpenRiskMap([
  { status: "open", card: { score: 15 } },
  { status: "open", card: { score: 10 } },
  { status: "open", card: { score: 5 } },
  { status: "open", card: { score: 4 } },
  { status: "open", card: { score: "—" } },
  { status: "open", card: { levelKey: "critical" } },
  { status: "closed", card: { score: 20 } },
]);
assert.equal(mixed.openCount, 6);
assert.equal(mixed.buckets.find((band) => band.key === "critical").n, 1);
assert.equal(mixed.buckets.find((band) => band.key === "high").n, 1);
assert.equal(mixed.buckets.find((band) => band.key === "medium").n, 1);
assert.equal(mixed.buckets.find((band) => band.key === "low").n, 1);
assert.equal(mixed.buckets.find((band) => band.key === "ungraded").n, 2);
assert.equal(mixed.buckets.reduce((sum, band) => sum + band.n, 0), mixed.openCount);

console.log("hse + perf derivations: PASS");
