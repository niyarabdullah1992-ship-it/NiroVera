/**
 * Night-work notices and remedies (QA fixes):
 *  - a refusal / rotation never rewrites a day that has begun (notBefore);
 *  - a reopened request is announced again (the key carries the request id);
 *  - manager notices open where the decision is taken.
 */
import assert from "node:assert/strict";
const W = await import("../src/lib/shiftWeek.js");
const { nightDueNotifyKey, nightDueAdminNotifyKey } = await import("../src/lib/nightDueNotify.js");
const { routeForNotification } = await import("../src/lib/notificationRoute.js");

const night = { id: "night", label: "ليلي", start: "23:00", end: "07:00" };
const morning = { id: "morning", label: "صباحي", start: "07:00", end: "15:00" };
const weekStart = new Date(2026, 9, 18);
const fresh = () => ({ stationId: "s", shiftTypes: [night, morning], assignments: Object.fromEntries(["2026-10-18", "2026-10-19", "2026-10-20"].map((k) => [k, { night: ["w"] }])) });

// Decided on Monday 19 Oct at 14:00: Sunday is past, Monday's night stays (the morning already began), Tuesday moves.
const s1 = fresh();
const moved = W.remapEmployeeNightWorkerDays(s1, "w", weekStart, "rotate", { notBefore: new Date(2026, 9, 19, 14, 0) });
assert.equal(moved.moved, 1);
assert.equal(W.employeeShiftOnDay(s1, "w", "2026-10-18").id, "night");
assert.equal(W.employeeShiftOnDay(s1, "w", "2026-10-19").id, "night");
assert.equal(W.employeeShiftOnDay(s1, "w", "2026-10-20").id, "morning");
// A cut keeps the night's start, so today still takes it.
const s2 = fresh();
assert.equal(W.remapEmployeeNightWorkerDays(s2, "w", weekStart, "reduce", { cutHours: 1, notBefore: new Date(2026, 9, 19, 14, 0) }).moved, 2);
// Without notBefore the whole week (old callers, tests on past fixtures).
assert.equal(W.remapEmployeeNightWorkerDays(fresh(), "w", weekStart, "rotate").moved, 3);

assert.notEqual(nightDueNotifyKey("w", "2026-10", "oreq_a"), nightDueNotifyKey("w", "2026-10", "oreq_b"), "a reopened request gets its own notice");
assert.equal(nightDueNotifyKey("w", "2026-10"), "18632-due:w:2026-10");
assert.notEqual(nightDueAdminNotifyKey("m", "w", "2026-10", "a"), nightDueAdminNotifyKey("m", "w", "2026-10", "b"));

assert.equal(routeForNotification("طلب تسجيل حضور يدوي من عمر ناصر بانتظار مراجعتك"), "/app/attendance?lane=manage&tab=team");
assert.equal(routeForNotification("عمر ناصر مستحق موافقة خطية ليلية (القرار 18632) بعد 3.5 أشهر."), "/app/shifts?lane=manage");

console.log("night notice fixes: ok");
