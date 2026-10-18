import assert from "node:assert/strict";
import { firstReviewLevel, checkSelfReviewGate, checkAdoptNoteGate, defaultEscalationChain, deriveEscalationChain } from "../src/lib/complaintDerivations.js";

const chain = defaultEscalationChain("نيار");
assert.equal(firstReviewLevel(chain, "u1", "u1"), 1, "station manager's own voice starts at HR");
assert.equal(firstReviewLevel(chain, "u2", "u1"), 0, "a worker's voice starts with the station manager");
assert.equal(firstReviewLevel(chain, "", "u1"), 0);
const custom = deriveEscalationChain(["a", "b", "c"], [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }]);
assert.equal(firstReviewLevel(custom, "a"), 1);
assert.equal(firstReviewLevel(custom, "b"), 0);
assert.equal(checkSelfReviewGate({ authorId: "u1" }, "u1").ok, false);
assert.equal(checkSelfReviewGate({ rateActorId: "u1" }, "u1").ok, false, "anonymous author cannot rule on it either");
assert.equal(checkSelfReviewGate({ authorId: "u2" }, "u1").ok, true);
assert.equal(checkAdoptNoteGate("").ok, false);
assert.equal(checkAdoptNoteGate("اعتُمد الصرف").ok, true);
console.log("voice self-review OK");

const { deriveVoiceBoard, collectVoiceItems } = await import("../src/lib/voiceBoard.js");
const items = collectVoiceItems({ publicReports: [
  { id: "p1", authorId: "w1", type: "complaint", kind: "public", title: "بدل", message: "x".repeat(20), status: "closed", resolution: "approved", escalationLevel: 0, replies: [{ text: "يُصرف", createdAt: "2026-10-14T10:00:00Z" }], createdAt: "2026-10-13T10:00:00Z" },
  { id: "p2", authorId: "m1", type: "complaint", kind: "public", title: "ذاتي", message: "x".repeat(20), status: "open", escalationLevel: 1, reviewStartLevel: 1, replies: [], createdAt: "2026-10-14T10:00:00Z" },
] });
const board = deriveVoiceBoard({ items, queueItems: items, employees: [], stations: [], ar: true, canManage: true, userId: "w1", chain });
const ruled = board.cards.find((c) => c.item.id === "p1");
assert.equal(ruled.steps[0].when, "قرّر", "the decider reads «قرّر», not «عنده الآن»");
const own = board.cards.find((c) => c.item.id === "p2");
assert.equal(own.steps[0].when, "تخطّاه — صاحب الصوت");
assert.ok(!own.tier.includes("رُفع"), "a skipped first level is not an escalation");
console.log("voice board states OK");
