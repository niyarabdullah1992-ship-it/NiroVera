import assert from "node:assert/strict";
import {
  collectVoiceItems,
  decorateVoiceItem,
  deriveVoiceBoard,
  hoursAr,
  voiceRelatedLinks,
} from "../src/lib/voiceBoard.js";
import { defaultEscalationChain } from "../src/lib/complaintDerivations.js";

assert.equal(hoursAr(1), "ساعة واحدة");
assert.equal(hoursAr(2), "ساعتان");
assert.match(hoursAr(5), /ساعات/);

const employees = [{ id: "e1", name: "نيار", stationId: "st" }];
const stations = [{ id: "st", name: "ميناء الدمام" }];
const now = Date.parse("2026-09-12T09:40:00");
const items = collectVoiceItems({
  publicReports: [
    {
      id: "p1",
      authorId: "e1",
      stationId: "st",
      type: "suggestion",
      kind: "suggestion",
      title: "توحيد نموذج تسليم الوردية",
      message: "كل مشرف يكتب تسليم الوردية بصيغته.",
      priority: "low",
      status: "open",
      createdAt: "2026-09-08T08:00:00",
    },
    {
      id: "p2",
      authorId: "e1",
      stationId: "st",
      type: "complaint",
      title: "تأخير صرف بدل الوردية المسائية",
      message: "بدل الوردية المسائية لشهرين لم يُصرف مع الراتب.",
      priority: "medium",
      status: "open",
      createdAt: "2026-09-11T14:00:00",
    },
  ],
  anonymousReports: [
    {
      id: "a1",
      kind: "anonymous",
      anonymous: true,
      anonymousId: "AN-1842",
      title: "ورديات متتالية دون راحة أسبوعية",
      message: "ثلاثة عاملين بلا يوم راحة.",
      priority: "high",
      status: "open",
      stationId: "st",
      createdAt: "2026-09-11T21:10:00",
    },
  ],
});
assert.equal(items.length, 3);
assert.equal(items[0].channel, "suggestion");
assert.equal(items[1].channel, "complaint");
assert.equal(items[2].channel, "anonymous");

const board = deriveVoiceBoard({
  items,
  employees,
  stations,
  ar: true,
  nowMs: now,
  canManage: true,
  userId: "e1",
  chain: defaultEscalationChain("أحمد"),
});
assert.equal(board.openCount, 3);
assert.ok(board.mine.length >= 2);
assert.ok(board.stats.length === 4);
assert.match(board.pulse, /بانتظار|تجاوز/);

const workerBoard = deriveVoiceBoard({
  items,
  employees,
  stations,
  ar: true,
  nowMs: now,
  canManage: false,
  userId: "e1",
  chain: defaultEscalationChain("أحمد"),
});
assert.equal(workerBoard.openCount, 2, "worker pulse excludes others' open anonymous");
assert.ok(!workerBoard.open.some((card) => card.item.channel === "anonymous"));
assert.equal(isAnonymousOpenHidden(workerBoard), true);

function isAnonymousOpenHidden(next) {
  return next.cards.every((card) => card.item.channel !== "anonymous" || card.settled);
}

const pay = decorateVoiceItem(items[1], { employees, stations, ar: true, nowMs: now, currentUser: { id: "e1" } });
assert.ok(pay.related.some((row) => row.to === "/app/payroll"));
assert.ok(voiceRelatedLinks(items[2], { ar: true }).some((row) => row.to === "/app/discipline"));
assert.ok(pay.audit.some((row) => row.type === "raise"));
assert.match(pay.audit[0].actor, /نيار|صاحب/);

const workerAnonCard = decorateVoiceItem(items[2], {
  employees,
  stations,
  ar: true,
  nowMs: now,
  canManage: false,
  chain: defaultEscalationChain("أحمد"),
});
assert.equal(workerAnonCard.audit[0].actor, "بلا هويّة");

const hqNamed = collectVoiceItems({
  publicReports: [{
    id: "hq1",
    authorId: "owner",
    stationId: "hq",
    type: "suggestion",
    title: "ترتيب مكتب الإدارة",
    message: "مكتب الإدارة يحتاج مساراً أوضح للزوار.",
    status: "open",
    createdAt: "2026-09-10T08:00:00",
  }],
  anonymousReports: [{
    id: "rabigh-anon",
    kind: "anonymous",
    anonymous: true,
    anonymousId: "AN-9999",
    stationId: "rabigh",
    title: "تجاوز في رابغ",
    message: "واقعة في رابغ بلا اسم.",
    status: "closed",
    createdAt: "2026-09-10T08:00:00",
  }],
});
const khafjiOnly = items.filter((row) => row.stationId === "st");
const ownerBoard = deriveVoiceBoard({
  items: [...hqNamed, ...items],
  queueItems: khafjiOnly,
  viewerStationId: "hq",
  employees: [...employees, { id: "owner", name: "نيار", stationId: "hq" }],
  stations: [...stations, { id: "hq", name: "المكتب الرئيسي" }],
  ar: true,
  nowMs: now,
  canManage: true,
  userId: "owner",
  chain: defaultEscalationChain("أحمد"),
});
assert.ok(ownerBoard.mine.some((card) => card.item.stationId === "hq"));
assert.ok(!ownerBoard.open.some((card) => card.item.stationId === "hq"));
assert.ok(ownerBoard.open.some((card) => card.item.authorId === "e1"));

const workerStationBoard = deriveVoiceBoard({
  items: [...items, ...hqNamed],
  viewerStationId: "st",
  employees,
  stations,
  ar: true,
  nowMs: now,
  canManage: false,
  userId: "e1",
  chain: defaultEscalationChain("أحمد"),
});
assert.ok(!workerStationBoard.cards.some((card) => card.item.anonymousId === "AN-9999"));
assert.ok(!workerStationBoard.mine.some((card) => card.item.stationId === "hq"));

console.log("voice board ok");
