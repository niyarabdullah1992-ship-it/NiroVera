import assert from "node:assert/strict";
import {
  DEFAULT_RATE_LIMITS,
  RESPONSE_HOURS_BY_PRIORITY,
  defaultEscalationChain,
  deriveEscalationChain,
  stageCount,
  responseHoursFor,
  slaHoursLeft,
  isSlaBreached,
  enrichComplaint,
  deriveComplaintStats,
  checkRateLimitGate,
  checkFileAnonymousGate,
  checkEscalateGate,
  checkCloseGate,
  checkSubmitVoiceGate,
  checkWorkerAppealGate,
  checkReturnNoteGate,
  isAnonymousReport,
  applySlaAutoEscalate,
  appendVoiceAudit,
  ensureVoiceAuditTrail,
  buildVoiceAuditTimeline,
  countFilingsInWindow,
  RATE_WINDOW_MS,
} from "../src/lib/complaintDerivations.js";

assert.equal(DEFAULT_RATE_LIMITS.day, 3);
assert.equal(DEFAULT_RATE_LIMITS.week, 10);
assert.equal(DEFAULT_RATE_LIMITS.month, 30);
assert.equal(RESPONSE_HOURS_BY_PRIORITY.high, 24);
assert.equal(RESPONSE_HOURS_BY_PRIORITY.medium, 48);

const chain = defaultEscalationChain("تركي");
assert.equal(stageCount(chain), 4);
assert.ok(chain[0].labelAr.includes("تركي"));

const manual = deriveEscalationChain(["e1", "e2"], [{ id: "e1", name: "A" }, { id: "e2", name: "B" }]);
assert.equal(manual.length, 2);
assert.deepEqual(manual[0].handlerIds, ["e1"]);

const NOW = new Date(2026, 7, 11, 12, 0, 0).getTime();

const openHigh = {
  id: "r1",
  title: "PPE",
  priority: "high",
  status: "open",
  escalationLevel: 0,
  createdAt: new Date(NOW - 30 * 3600_000).toISOString(), // 30h ago > 24h SLA
  levelSinceAt: new Date(NOW - 30 * 3600_000).toISOString(),
};
assert.equal(responseHoursFor(openHigh), 24);
assert.ok(slaHoursLeft(openHigh, NOW) < 0);
assert.equal(isSlaBreached(openHigh, NOW), true);

const fresh = {
  ...openHigh,
  levelSinceAt: new Date(NOW - 2 * 3600_000).toISOString(),
};
assert.equal(isSlaBreached(fresh, NOW), false);

assert.equal(checkRateLimitGate({ day: 3, week: 0, month: 0 }).error, "RATE_LIMIT_DAY");
assert.equal(checkRateLimitGate({ day: 0, week: 10, month: 0 }).error, "RATE_LIMIT_WEEK");
assert.equal(checkRateLimitGate({ day: 0, week: 0, month: 30 }).error, "RATE_LIMIT_MONTH");
assert.equal(checkRateLimitGate({ day: 2, week: 9, month: 29 }).ok, true);

assert.equal(checkFileAnonymousGate({ message: "", usage: { day: 0, week: 0, month: 0 } }).error, "STATION_REQUIRED");
assert.equal(checkFileAnonymousGate({ message: "", usage: { day: 0, week: 0, month: 0 }, stationId: "st" }).error, "MESSAGE_REQUIRED");
assert.equal(
  checkFileAnonymousGate({ message: "x", usage: { day: 3, week: 0, month: 0 }, stationId: "st" }).error,
  "RATE_LIMIT_DAY",
);
assert.equal(
  checkFileAnonymousGate({ message: "hello", usage: { day: 0, week: 0, month: 0 }, stationId: "st" }).ok,
  true,
);

assert.equal(checkEscalateGate(null, chain).error, "REPORT_NOT_FOUND");
assert.equal(checkEscalateGate({ ...openHigh, status: "closed" }, chain).error, "ALREADY_CLOSED");
assert.equal(
  checkEscalateGate({ ...openHigh, escalationLevel: 3 }, chain).error,
  "AT_TOP_OF_CHAIN",
);
assert.equal(
  checkEscalateGate(openHigh, chain, { isHandler: false }).error,
  "NOT_HANDLER",
);
assert.equal(checkEscalateGate(openHigh, chain, { isHandler: true }).ok, true);
assert.equal(checkEscalateGate(openHigh, chain, { forceSla: true }).reason, "SLA_BREACH");

const emptyNext = deriveEscalationChain(["e1", "e2"], [{ id: "e1", name: "A" }]);
// e2 has no employee — still has handlerIds [e2]
assert.equal(checkEscalateGate(openHigh, emptyNext, { isHandler: true }).ok, true);
const bareNext = [
  { id: "e1", labelAr: "A", labelEn: "A", handlerIds: ["e1"] },
  { id: "orphan", labelAr: "?", labelEn: "?", handlerIds: [] },
];
assert.equal(
  checkEscalateGate(openHigh, bareNext, { isHandler: true }).error,
  "NO_HANDLER_AT_LEVEL",
);
// SLA sweep may still climb even without named next handler on custom tiers? forceSla bypasses NO_HANDLER
assert.equal(checkEscalateGate(openHigh, bareNext, { forceSla: true }).ok, true);

assert.equal(checkCloseGate(null).error, "REPORT_NOT_FOUND");
assert.equal(checkCloseGate({ ...openHigh, status: "closed" }).error, "ALREADY_CLOSED");
assert.equal(checkCloseGate(openHigh, { isHandler: false }).error, "NOT_HANDLER");
assert.equal(checkCloseGate(openHigh, { isHandler: true }).ok, true);

const swept = applySlaAutoEscalate([openHigh, fresh], chain, NOW);
assert.equal(swept.escalated, 1);
assert.equal(swept.reports[0].escalationLevel, 1);
assert.equal(swept.reports[0].lastEscalationReason, "SLA_BREACH");
assert.equal(swept.reports[1].escalationLevel, 0);
assert.equal(swept.reports[0].auditTrail?.at(-1)?.type, "sla");
assert.equal(swept.reports[0].auditTrail?.at(-1)?.actorName, "");
assert.equal(swept.reports[0].auditTrail?.at(-1)?.actorId, null);

const enriched = enrichComplaint(openHigh, chain, NOW);
assert.equal(enriched.slaBreached, true);
assert.equal(enriched.steps[0].state, "current");
assert.equal(enriched.anonymous, true); // hosted row: no author, no reporterName
assert.equal(isAnonymousReport({ authorId: "e1", type: "complaint", title: "named" }), false);
assert.equal(isAnonymousReport({ anonymous: true, anonymousId: "AN-1", title: "hidden" }), true);
assert.equal(checkSubmitVoiceGate({ channel: "complaint", title: "تأخير بدل الوردية", message: "بدل شهرين لم يُصرف مع الراتب." }).error, "STATION_REQUIRED");
assert.equal(checkSubmitVoiceGate({ channel: "complaint", title: "أب", message: "قصير", stationId: "st" }).error, "TITLE_REQUIRED");
assert.equal(checkSubmitVoiceGate({ channel: "complaint", title: "تأخير بدل الوردية", message: "قصير", stationId: "st" }).error, "DETAIL_REQUIRED");
assert.equal(checkSubmitVoiceGate({ channel: "complaint", title: "تأخير بدل الوردية", message: "بدل شهرين لم يُصرف مع الراتب.", stationId: "st" }).ok, true);
assert.equal(checkSubmitVoiceGate({ channel: "anonymous", title: "خطر ورديات", message: "ثلاثة عمال بلا راحة أسبوعية.", usage: { day: 3, week: 0, month: 0 }, stationId: "st" }).error, "RATE_LIMIT_DAY");
assert.equal(checkReturnNoteGate("لا").error, "RETURN_NOTE_REQUIRED");
assert.equal(checkReturnNoteGate("لم تثبت الواقعة بعد المراجعة.").ok, true);
assert.equal(checkWorkerAppealGate({ ...openHigh, authorId: "e1", status: "open" }, chain, "e1").error, "NOT_RETURNED");
assert.equal(checkWorkerAppealGate({ ...openHigh, authorId: "e1", status: "rejected" }, chain, "e2").error, "NOT_AUTHOR");
assert.equal(checkWorkerAppealGate({ ...openHigh, anonymous: true, status: "rejected" }, chain, "e1").error, "ANONYMOUS_NO_APPEAL");
assert.equal(checkWorkerAppealGate({ ...openHigh, authorId: "e1", status: "rejected", anonymous: false, kind: "public" }, chain, "e1").ok, true);

const named = enrichComplaint({
  ...fresh,
  reporterName: "خالد",
  kind: "safety",
  anonymous: false,
}, chain, NOW);
assert.equal(named.anonymous, false);
assert.equal(named.kind, "safety");

const stats = deriveComplaintStats([
  openHigh,
  fresh,
  {
    id: "c1",
    title: "closed",
    status: "closed",
    priority: "medium",
    createdAt: new Date(NOW - 20 * 3600_000).toISOString(),
    closedAt: new Date(NOW - 10 * 3600_000).toISOString(),
    satisfaction: 86,
    reporterName: "x",
  },
], chain, NOW);
assert.equal(stats.openCount, 2);
assert.ok(stats.breachedCount >= 1);
assert.equal(stats.closedThisMonth, 1);
assert.equal(stats.avgSatisfaction, 86);

const ats = [
  new Date(NOW - 1 * 3600_000).toISOString(),
  new Date(NOW - 2 * RATE_WINDOW_MS.day).toISOString(),
];
assert.equal(countFilingsInWindow(ats, RATE_WINDOW_MS.day, NOW), 1);

const hiddenRaise = appendVoiceAudit({}, "raise", { id: "e1", name: "عمر ناصر" }, {
  hideActor: true,
  at: "2026-09-12T08:00:00.000Z",
});
assert.equal(hiddenRaise[0].type, "raise");
assert.equal(hiddenRaise[0].actorId, null);
assert.equal(hiddenRaise[0].actorName, "");
assert.equal("rateActorId" in hiddenRaise[0], false);

const namedRaise = appendVoiceAudit({}, "raise", { id: "e1", name: "عمر ناصر", role: "employee" }, {
  at: "2026-09-12T08:00:00.000Z",
});
assert.equal(namedRaise[0].actorName, "عمر ناصر");
assert.equal(namedRaise[0].actorId, "e1");

const hydrated = ensureVoiceAuditTrail({
  authorId: "e1",
  reporterName: "عمر ناصر",
  createdAt: "2026-09-08T08:00:00.000Z",
  status: "rejected",
  resolution: "rejected",
  replies: [{
    authorName: "أحمد السالم",
    role: "station_manager",
    text: "لم تثبت الواقعة بعد المراجعة.",
    createdAt: "2026-09-09T10:00:00.000Z",
  }],
});
assert.equal(hydrated[0].type, "raise");
assert.equal(hydrated[1].type, "return");
assert.equal(hydrated[1].actorName, "أحمد السالم");

const anonClosed = {
  anonymous: true,
  anonymousId: "AN-1842",
  createdAt: "2026-09-08T08:00:00.000Z",
  status: "closed",
  resolution: "approved",
  auditTrail: [
    { type: "raise", at: "2026-09-08T08:00:00.000Z" },
    {
      type: "adopt",
      at: "2026-09-09T10:00:00.000Z",
      actorName: "أحمد السالم",
      actorRole: "station_manager",
      detail: "عُولِج بوقائعه.",
    },
  ],
};
const workerAnon = buildVoiceAuditTimeline(anonClosed, { ar: true, viewerIsHandler: false, chain });
assert.equal(workerAnon[0].actor, "بلا هويّة");
assert.notEqual(workerAnon[1].actor, "أحمد السالم");
assert.match(workerAnon[1].actor, /مدير|مراجع/);
assert.equal(workerAnon[1].text, "عُولِج");
const managerAnon = buildVoiceAuditTimeline(anonClosed, { ar: true, viewerIsHandler: true, chain });
assert.equal(managerAnon[1].actor, "أحمد السالم");

const namedPath = buildVoiceAuditTimeline({
  authorId: "e1",
  reporterName: "عمر ناصر",
  createdAt: "2026-09-08T08:00:00.000Z",
  auditTrail: [
    { type: "raise", at: "2026-09-08T08:00:00.000Z", actorName: "عمر ناصر" },
    { type: "return", at: "2026-09-09T10:00:00.000Z", actorName: "أحمد السالم", actorRole: "station_manager", detail: "وضّح الواقعة." },
  ],
}, { ar: true, viewerIsHandler: false, authorName: "عمر ناصر", chain });
assert.equal(namedPath[0].actor, "عمر ناصر");
assert.equal(namedPath[1].actor, "أحمد السالم");
assert.equal(namedPath[1].text, "أُعيد بملاحظة");

const enSla = buildVoiceAuditTimeline({
  authorId: "e1",
  createdAt: "2026-09-08T08:00:00.000Z",
  auditTrail: [
    { type: "raise", at: "2026-09-08T08:00:00.000Z", actorName: "Omar" },
    { type: "sla", at: "2026-09-09T10:00:00.000Z", toLevel: 1, reason: "SLA_BREACH" },
  ],
}, { ar: false, viewerIsHandler: true, chain });
assert.match(enSla[1].text, /Raised automatically/);
assert.equal(enSla[1].actor, "System");

console.log("complaint derivations ok");
