import assert from "node:assert/strict";
import { pointsWord, taskRhythm, taskLastSevenDays, taskLastEntry, taskContributions, taskPointsLine, taskDueChip, taskDayLog } from "../src/lib/opsCardFacts.js";

const today = new Date("2026-10-14T12:00:00");
// 10 days, 50 units: by day 5 (Oct 14) we should be at 25
const task = { targetCount: 50, completedCount: 21, startAt: "2026-10-10", dueAt: "2026-10-19", status: "active", priority: "high", effortWeight: 4,
  paceDayLog: { "2026-10-10": 5, "2026-10-11": 5, "2026-10-12": 2, "2026-10-14": 9 },
  comments: [
    { kind: "log", amount: 5, authorName: "سالم", at: "2026-10-10T09:00:00" },
    { kind: "chat", text: "hi" },
    { kind: "log", amount: 9, authorName: "راجو", at: "2026-10-14T10:20:00", text: "إنجاز ×9", files: [{ url: "data:image/png;base64,AA" }] },
    { kind: "log", amount: 7, authorName: "سالم", at: "2026-10-13T10:20:00" },
  ] };
const r = taskRhythm(task, today);
assert.equal(r.active, true);
assert.equal(r.expected, 25);
assert.equal(r.gap, -4);
assert.equal(r.markPct, 50);

const seven = taskLastSevenDays(task, today);
assert.equal(seven.length, 7);
assert.equal(seven[0].day, "2026-10-08");
assert.equal(seven[0].state, "off", "before the order started");
assert.equal(seven[2].state, "done"); // Oct 10: 5 of 5
assert.equal(seven[4].state, "partial"); // Oct 12: 2 of 5
assert.equal(seven[5].state, "missed"); // Oct 13: nothing in the day log
assert.equal(seven[6].state, "done"); // today 9

assert.equal(taskRhythm({ ...task, status: "awaiting_approval" }, today).active, false);
assert.equal(taskRhythm({ ...task, dueAt: "" }, today).active, false);
const fresh = taskLastSevenDays({ ...task, paceDayLog: {} , comments: [] }, today);
assert.equal(fresh[6].state, "today");

const last = taskLastEntry(task);
assert.equal(last.by, "سالم");
assert.equal(last.amount, 7);
assert.equal(taskLastEntry({ comments: [{ kind: "chat" }] }), null);

const shares = taskContributions(task);
assert.deepEqual(shares.map((x) => [x.name, x.amount]), [["سالم", 12], ["راجو", 9]]);

assert.deepEqual(taskPointsLine(task), { points: 12, granted: false });
assert.deepEqual(taskPointsLine({ status: "completed", pointsAwarded: 6 }), { points: 6, granted: true });

assert.equal(taskDueChip({ dueAt: "2026-10-14" }, true, today).text, "تُستحق اليوم");
assert.equal(taskDueChip({ dueAt: "2026-10-15" }, true, today).text, "تُستحق غداً");
assert.equal(taskDueChip({ dueAt: "2026-10-20" }, true, today).text, "بعد 6 أيام");
assert.equal(taskDueChip({ dueAt: "2026-10-12" }, true, today).text, "متأخرة يومين");
assert.equal(taskDueChip({ dueAt: "2026-10-12" }, true, today).tone, "bad");
assert.equal(taskDueChip({ dueAt: "2026-10-12", status: "completed" }, true, today), null);

assert.equal(pointsWord(4), "4 نقاط");
assert.equal(pointsWord(12), "12 نقطة");
assert.equal(pointsWord(2), "نقطتان");
// day log falls back to the thread when there is no paceDayLog
assert.equal(taskDayLog({ comments: task.comments })["2026-10-13"], 7);
assert.equal(taskRhythm({ ...task, targetCount: 1, completedCount: 0 }, today).active, false, "single-unit orders carry no rhythm");
assert.deepEqual(taskLastSevenDays({ ...task, targetCount: 1 }, today), []);
console.log("ops card facts ok");
