import assert from "node:assert/strict";
import { branchReviewTiers } from "../src/lib/branchChain.js";
import { canReviewOpsTask } from "../src/lib/opsDerivations.js";

const data = {
  ownerId: "own",
  employees: [
    { id: "own", name: "المالك", role: "owner" },
    { id: "m1", name: "سالم", role: "station_manager", stationId: "s1" },
    { id: "m2", name: "فهد", role: "ops_manager", stationId: "s1" },
    { id: "e1", name: "عمر", role: "employee", stationId: "s1" },
  ],
  stations: [{ id: "s1", name: "فرع أ", managerId: "m1" }],
  branchEscalationChains: { s1: ["m1", "m2"] },
};

// HR set the ladder for the branch: both sections read the same people in the same order.
const tiers = branchReviewTiers(data, "s1");
assert.deepEqual(tiers.map((t) => t.handlerIds[0]), ["m1", "m2"]);
assert.ok(tiers[0].labelAr.includes("سالم"));

// المهام: level 0 → m1 and m2 may approve; level 1 → only m2.
const task = { id: "t", stationId: "s1", status: "awaiting_approval", escalationLevel: 0 };
assert.equal(canReviewOpsTask(task, { id: "m1", role: "station_manager" }, data), true);
assert.equal(canReviewOpsTask({ ...task, escalationLevel: 1 }, { id: "m1", role: "station_manager" }, data), false);
assert.equal(canReviewOpsTask({ ...task, escalationLevel: 1 }, { id: "m2", role: "ops_manager" }, data), true);
assert.equal(canReviewOpsTask(task, { id: "e1", role: "employee" }, data), false);

// Changing the ladder changes both at once.
const swapped = { ...data, branchEscalationChains: { s1: ["m2", "m1"] } };
assert.deepEqual(branchReviewTiers(swapped, "s1").map((t) => t.handlerIds[0]), ["m2", "m1"]);
assert.equal(canReviewOpsTask({ ...task, escalationLevel: 1 }, { id: "m1", role: "station_manager" }, swapped), true);
console.log("branch chain ok");
