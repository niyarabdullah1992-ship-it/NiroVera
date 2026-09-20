import assert from "node:assert/strict";
import { checkPublishGates, minutesBetween, checkConsecutiveWorkGate } from "../src/lib/shiftDerivations.js";
import { endDateFromLeaveDays, remainingLeaveDays } from "../src/lib/leaveTypes.js";
import { checkAdvanceDisciplineGate } from "../src/lib/disciplineDerivations.js";
import {
  checkApproveLeaveGate,
  computeLeaveDays,
  deriveLeaveStats,
  LEAVE_THRESHOLD_DAYS,
} from "../src/lib/leaveDerivations.js";

assert.equal(minutesBetween("06:00", "14:00"), 480);
assert.equal(minutesBetween("22:00", "06:00"), 480);
assert.equal(computeLeaveDays("2026-08-01", "2026-08-05"), 5);
assert.equal(computeLeaveDays("2026-08-01", "2026-08-07"), 7);

const blocked = checkApproveLeaveGate({
  status: "pending",
  startDate: "2026-08-01",
  endDate: "2026-08-10",
  days: 10,
  files: [],
});
assert.equal(blocked.ok, false);
assert.equal(blocked.error, "ATTACHMENT_REQUIRED");
assert.equal(LEAVE_THRESHOLD_DAYS, 5);

const allowed = checkApproveLeaveGate({
  status: "pending",
  startDate: "2026-08-01",
  endDate: "2026-08-10",
  days: 10,
  files: [{ name: "doc.pdf" }],
});
assert.equal(allowed.ok, true);

const shortOk = checkApproveLeaveGate({
  status: "pending",
  startDate: "2026-08-01",
  endDate: "2026-08-03",
  days: 3,
  files: [],
});
assert.equal(shortOk.ok, true);

const stats = deriveLeaveStats([
  { status: "pending", days: 10, files: [] },
  { status: "pending", days: 2, files: [] },
  { status: "approved", days: 3, files: [] },
  { status: "rejected", days: 1, files: [] },
]);
assert.equal(stats.pending, 2);
assert.equal(stats.needsDoc, 1);
assert.equal(stats.approved, 1);
assert.equal(stats.rejected, 1);

// August 2026 starts Saturday. Three 8h shifts, one person every weekday morning only → under 48h but open cells.
const shiftTypes = [
  { id: "am", label: "Morning", start: "06:00", end: "14:00" },
  { id: "pm", label: "Evening", start: "14:00", end: "22:00" },
  { id: "nt", label: "Night", start: "22:00", end: "06:00" },
];
const assignments = {};
for (let d = 1; d <= 31; d++) {
  const key = `2026-08-${String(d).padStart(2, "0")}`;
  const dow = new Date(2026, 7, d).getDay();
  if (dow === 5) continue; // Friday rest
  assignments[key] = { am: ["e1"], pm: [], nt: [] };
}
const openGate = checkPublishGates({
  year: 2026,
  monthIndex: 7,
  shiftTypes,
  assignments,
  namesById: { e1: "Emp" },
});
assert.equal(openGate.blocked, true);
assert.equal(openGate.failed?.id, "coverage");
assert.ok(openGate.openCells > 0);
assert.ok(openGate.weeklyMaxHours <= 48);
assert.equal(openGate.checks.find((c) => c.id === "rest_5h")?.ok, true);

// Double shift same day fails rest_11h / double.
const doubleAssign = {
  "2026-08-02": { am: ["e1"], pm: ["e1"], nt: [] },
};
const doubleGate = checkPublishGates({
  year: 2026,
  monthIndex: 7,
  shiftTypes,
  assignments: doubleAssign,
  namesById: { e1: "Emp" },
});
assert.equal(doubleGate.checks.find((c) => c.id === "rest_11h")?.ok, false);

assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "15:00", restMinutes: 30 }).ok, true);
assert.equal(checkConsecutiveWorkGate({ start: "07:00", end: "15:00", restMinutes: 0 }).error, "REST_5H_REQUIRED");

assert.equal(endDateFromLeaveDays("2026-09-01", 1), "2026-09-01");
assert.equal(endDateFromLeaveDays("2026-09-01", 5), "2026-09-05");
assert.equal(remainingLeaveDays({ hireDate: "2025-06-01" }, [{ type: "annual", status: "approved", days: 5 }], "annual", "2026-09-12"), 32);
assert.equal(remainingLeaveDays(
  { hireDate: "2024-01-01" },
  [{ type: "annual", status: "approved", startDate: "2024-06-01", endDate: "2024-06-10", days: 10 }],
  "annual",
  "2026-09-06",
), 42);

assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1" }, "hearing").ok, false);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1" }, "hearing").cite?.article, "71");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", messages: [{ from: "hr", files: [{ url: "x.pdf" }] }] }, "hearing").ok, true);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", messages: [{ from: "hr", files: [{ url: "x.pdf" }] }] }, "hearing").cite?.article, "71");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", messages: [{ from: "employee", text: "أتظلم" }] }, "appeal").ok, true);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", signedAt: "2026-01-01", messages: [{ from: "employee", text: "أتظلم" }] }, "appeal", { today: "2026-02-15" }).error, "DISCIPLINE_APPEAL_LATE");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", signedAt: "2026-02-01", messages: [{ from: "employee", text: "أتظلم" }] }, "appeal", { today: "2026-02-15" }).ok, true);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", createdAt: "2026-01-01" }, "notice", { today: "2026-02-15" }).ok, false);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", createdAt: "2026-01-01" }, "notice", { today: "2026-02-15" }).error, "DISCIPLINE_CHARGE_STALE");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", createdAt: "2026-01-01" }, "notice", { today: "2026-02-15" }).cite?.article, "69");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", createdAt: "2026-02-01" }, "notice", { today: "2026-02-15" }).ok, true);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", hearingEndedAt: "2026-01-01" }, "decision", { today: "2026-02-15" }).ok, false);
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1", hearingEndedAt: "2026-01-01" }, "decision", { today: "2026-02-15" }).error, "DISCIPLINE_PENALTY_STALE");
assert.equal(checkAdvanceDisciplineGate({ employeeId: "e1" }, "decision", { today: "2026-02-15" }).ok, true);

console.log("workforce derivations (shifts + leave): PASS");
