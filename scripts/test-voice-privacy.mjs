/**
 * «صوت الموظف» routing and privacy:
 *   1. الشكوى الجهرية climbs the branch ladder (direct manager → branch manager → HR), level by level,
 *      on each missed window, with its deadline.
 *   2. الشكوى السرية + الاقتراح sit with HR only — no ladder.
 *   3. شكوى التحرش/الإيذاء — HR / administration only, never the accused.
 * A manager (direct or branch) sees none of the HR-only voices: lists, counts, badges, chips,
 * notifications, the employee file, or the server blob.
 */
import assert from "node:assert/strict";
import {
  canHandleHrVoice,
  canSeeAbuseCase,
  canSeeVoiceItem,
  filterAbuseCasesForViewer,
  filterVoiceForViewer,
  hrVoiceChain,
  isHrOnlyVoice,
  isVoiceHrReceiver,
  mayNotifyAboutVoice,
  namedComplaintChain,
  viewerVoiceSlice,
  voiceChainFor,
  voiceHrReceivers,
  HR_ONLY_LINE_AR,
} from "../src/lib/voicePrivacy.js";
import {
  collectVoiceItems,
  deriveVoiceBoard,
  employeeVoiceArchiveCards,
  viewerOpenAbuseCount,
  viewerVoiceQueueItems,
  voiceRouteLine,
} from "../src/lib/voiceBoard.js";
import { pendingVoiceBadgeCount } from "../src/lib/suiteBadges.js";
import { applySlaAutoEscalate, enrichComplaint, slaHoursLeft } from "../src/lib/complaintDerivations.js";
import { rightsRouteFor, GRIEVANCE_ROUTE, ABUSE_ROUTE } from "../src/lib/rightsRequests.js";
import * as srv from "../base44/shared/voicePrivacy.ts";
import { readFileSync } from "node:fs";

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log(`ok ${n} — ${name}`); };

const data = {
  ownerId: "owner",
  stations: [{ id: "st", name: "الخفجي", managerId: "mgr" }, { id: "st2", name: "رابغ" }],
  hrLevels: [
    { id: "lvl_hr", order: 3, role: "manager", scope: "company", permissions: ["view_employees", "view_anonymous_reports", "manage_anonymous_reports"] },
    { id: "lvl_pay", order: 2, role: "assistant", scope: "company", permissions: ["view_employees", "manage_payroll"] },
  ],
  employees: [
    { id: "owner", name: "المالك", role: "director", stationId: "st" },
    { id: "emp", name: "عمر", role: "employee", stationId: "st" },
    { id: "mgr", name: "أحمد", role: "station_manager", stationId: "st", managedStations: ["st"] },
    { id: "branch", name: "سالم", role: "pgm", stationId: "st", managedStations: ["st", "st2"] },
    { id: "ops", name: "فهد", role: "ops_manager", stationId: "st" },
    { id: "hr", name: "نورة", role: "employee", stationId: "st2", hrLevelId: "lvl_hr" },
    { id: "pay", name: "ريم", role: "employee", stationId: "st", hrLevelId: "lvl_pay" },
  ],
  publicReports: [
    { id: "sug", authorId: "emp", stationId: "st", type: "suggestion", kind: "suggestion", title: "اقتراح وردية", message: "تفصيل الاقتراح هنا", priority: "low", status: "open", createdAt: "2026-10-10T08:00:00Z" },
    { id: "named", authorId: "emp", stationId: "st", type: "complaint", kind: "public", title: "شكوى جهرية", message: "تفصيل الشكوى هنا", priority: "medium", status: "open", escalationLevel: 0, createdAt: "2026-10-10T08:00:00Z", levelSinceAt: "2026-10-10T08:00:00Z" },
  ],
  anonymousReports: [
    { id: "an1", kind: "anonymous", anonymous: true, anonymousId: "AN-0101", rateActorId: "emp", stationId: "st", title: "شكوى سرية", message: "عن المدير", priority: "high", status: "open", createdAt: "2026-10-10T08:00:00Z" },
    { id: "an2", kind: "anonymous", anonymous: true, anonymousId: "AN-0102", rateActorId: "hassan", stationId: "st", title: "سرية مغلقة", message: "مغلقة", priority: "high", status: "closed", createdAt: "2026-10-01T08:00:00Z" },
  ],
  abuseCases: [
    { id: "ab1", reporterId: "emp", userId: "emp", reporterName: "عمر", reporterRole: "victim", accusedId: "mgr", accusedName: "أحمد", kind: "verbal", status: "filed", filedAt: "2026-10-12T08:00:00Z" },
  ],
};
const who = (id) => data.employees.find((e) => e.id === id);
const items = collectVoiceItems({ publicReports: data.publicReports, anonymousReports: data.anonymousReports });
const byId = (id) => items.find((i) => i.id === id);

t("channels: suggestion + confidential + abuse are HR-only, the open complaint is not", () => {
  assert.equal(isHrOnlyVoice(byId("sug")), true);
  assert.equal(isHrOnlyVoice(byId("an1")), true);
  assert.equal(isHrOnlyVoice(byId("named")), false);
  assert.equal(isHrOnlyVoice({ channel: "abuse" }), true);
  assert.equal(voiceRouteLine("anonymous"), HR_ONLY_LINE_AR);
  assert.equal(voiceRouteLine("abuse"), "تصل إلى الموارد البشرية فقط — لا يراها مديرك");
  assert.equal(voiceRouteLine("complaint"), "تبدأ عند مديرك وتتصعّد إن لم تُحل");
});

t("receivers: owner, director and an HR level with a voice permission — never a line manager", () => {
  assert.equal(isVoiceHrReceiver(who("owner"), data), true);
  assert.equal(isVoiceHrReceiver(who("hr"), data), true);
  for (const id of ["emp", "mgr", "branch", "ops", "pay"]) assert.equal(isVoiceHrReceiver(who(id), data), false, id);
  assert.deepEqual(voiceHrReceivers(data).map((e) => e.id).sort(), ["hr", "owner"]);
  assert.deepEqual(hrVoiceChain(data)[0].handlerIds.sort(), ["hr", "owner"]);
});

t("lists: the manager and the branch manager see no HR-only voice; HR and owner see them", () => {
  const ids = (id) => filterVoiceForViewer(items, who(id), data).map((i) => i.id).sort();
  assert.deepEqual(ids("mgr"), ["named"]);
  assert.deepEqual(ids("branch"), ["named"]);
  assert.deepEqual(ids("ops"), ["named"]);
  assert.deepEqual(ids("hr"), ["an1", "an2", "named", "sug"]);
  assert.deepEqual(ids("owner"), ["an1", "an2", "named", "sug"]);
  // The employee: his own three (the confidential one by its rate actor), nobody else's.
  assert.deepEqual(ids("emp"), ["an1", "named", "sug"]);
});

t("counts and badges: nothing HR-only bumps a manager's number", () => {
  const q = (id) => viewerVoiceQueueItems(data, who(id)).map((i) => i.id).sort();
  assert.deepEqual(q("mgr"), ["named"]);
  assert.deepEqual(q("branch"), ["named"]);
  assert.deepEqual(q("hr"), ["an1", "an2", "named", "sug"]);
  assert.deepEqual(q("emp"), []);
  assert.equal(pendingVoiceBadgeCount(data, who("mgr")), 1, "only the open named complaint");
  assert.equal(pendingVoiceBadgeCount(data, who("branch")), 1);
  assert.equal(pendingVoiceBadgeCount(data, who("hr")), 4, "named + suggestion + confidential + the abuse file");
  assert.equal(viewerOpenAbuseCount(data, who("mgr")), 0);
  assert.equal(viewerOpenAbuseCount(data, who("hr")), 1);
  const board = deriveVoiceBoard({ items: viewerVoiceQueueItems(data, who("mgr")), canManage: true, userId: "mgr", employees: data.employees, stations: data.stations });
  assert.equal(board.stats.find((s) => s.id === "anon").val, "0");
});

t("handling: only HR rules on an HR-only voice, never its author", () => {
  assert.equal(canHandleHrVoice(byId("an1"), who("hr"), data), true);
  assert.equal(canHandleHrVoice(byId("an1"), who("mgr"), data), false);
  assert.equal(canHandleHrVoice(byId("sug"), who("emp"), data), false);
});

t("notifications: an HR-only voice may only notify HR (or its author)", () => {
  assert.equal(mayNotifyAboutVoice(byId("an1"), who("mgr"), data), false);
  assert.equal(mayNotifyAboutVoice(byId("sug"), who("branch"), data), false);
  assert.equal(mayNotifyAboutVoice(byId("sug"), who("hr"), data), true);
  assert.equal(mayNotifyAboutVoice(byId("named"), who("mgr"), data), true);
});

t("employee file: the manager does not see the employee's suggestion; HR does", () => {
  const cards = (viewer) => employeeVoiceArchiveCards({
    publicReports: data.publicReports.map((r) => ({ ...r, status: "closed", resolution: "approved", closedAt: "2026-10-11T08:00:00Z" })),
    employeeId: "emp", employees: data.employees, stations: data.stations, viewer: who(viewer), data,
  }).map((c) => c.item.id).sort();
  assert.deepEqual(cards("mgr"), ["named"]);
  assert.deepEqual(cards("hr"), ["named", "sug"]);
  assert.deepEqual(cards("emp"), ["named", "sug"]);
});

t("worker view: own confidential complaint by number; another's settled one never shows", () => {
  const b = deriveVoiceBoard({ items, canManage: false, userId: "emp", viewerStationId: "st", employees: data.employees, stations: data.stations });
  assert.ok(b.mine.some((c) => c.item.id === "an1"));
  assert.ok(!b.cards.some((c) => c.item.id === "an2"));
  const m = deriveVoiceBoard({ items: filterVoiceForViewer(items, who("mgr"), data), canManage: false, userId: "mgr", viewerStationId: "st" });
  assert.equal(m.cards.length, 0);
});

t("harassment: HR / owner and the filer; never the accused manager or the branch manager", () => {
  const row = data.abuseCases[0];
  assert.equal(canSeeAbuseCase(row, who("mgr"), data), false, "the accused");
  assert.equal(canSeeAbuseCase(row, who("branch"), data), false);
  assert.equal(canSeeAbuseCase(row, who("ops"), data), false);
  assert.equal(canSeeAbuseCase(row, who("hr"), data), true);
  assert.equal(canSeeAbuseCase(row, who("owner"), data), true);
  assert.equal(canSeeAbuseCase(row, who("emp"), data), true);
  const sitting = { ...row, committee: { members: [{ id: "pay" }] } };
  assert.equal(canSeeAbuseCase(sitting, who("pay"), data), true, "a named committee member");
  assert.deepEqual(viewerVoiceSlice(data, who("mgr")).abuseCases, []);
  assert.equal(filterAbuseCasesForViewer(data.abuseCases, who("hr"), data).length, 1);
});

t("escalation — open complaint: direct manager → branch manager → HR, one level per missed window", () => {
  const branch = [
    { id: "mgr", labelAr: "أحمد — مدير الفرع", labelEn: "Ahmed", handlerIds: ["mgr"] },
    { id: "branch", labelAr: "سالم — مدير المنطقة", labelEn: "Salem", handlerIds: ["branch"] },
  ];
  const chain = namedComplaintChain(branch, data);
  assert.deepEqual(chain.map((x) => x.id), ["mgr", "branch", "hr_voice"], "the ladder closes at HR");
  assert.deepEqual(namedComplaintChain([...branch, { id: "x", handlerIds: ["hr"] }], data).length, 3, "HR already on top — not added twice");
  const row = data.publicReports[1];
  const start = Date.parse(row.createdAt);
  assert.equal(enrichComplaint(row, chain, start).currentTierId, "mgr");
  assert.equal(slaHoursLeft(row, start + 10 * 3600000), 38, "medium = 48h at each level");
  const one = applySlaAutoEscalate([row], chain, start + 49 * 3600000);
  assert.equal(one.escalated, 1);
  assert.equal(one.reports[0].escalationLevel, 1);
  assert.equal(one.reports[0].lastEscalationReason, "SLA_BREACH");
  assert.ok(one.reports[0].auditTrail.some((e) => e.type === "sla" && e.toLevel === 1), "logged in the audit trail");
  const two = applySlaAutoEscalate(one.reports, chain, start + 98 * 3600000);
  assert.equal(two.reports[0].escalationLevel, 2);
  assert.equal(enrichComplaint(two.reports[0], chain, start + 98 * 3600000).currentTierId, "hr_voice");
  const three = applySlaAutoEscalate(two.reports, chain, start + 200 * 3600000);
  assert.equal(three.escalated, 0, "HR is the top — it stays and is ruled on in writing");
});

t("no escalation — confidential complaint and suggestion sit at the single HR tier", () => {
  const chain = voiceChainFor(byId("an1"), [{ id: "mgr", handlerIds: ["mgr"] }], data);
  assert.deepEqual(chain.map((x) => x.id), ["hr_voice"]);
  assert.ok(!chain[0].handlerIds.includes("mgr"));
  const late = applySlaAutoEscalate([data.anonymousReports[0]], chain, Date.parse("2026-10-20T00:00:00Z"));
  assert.equal(late.escalated, 0);
  assert.equal(enrichComplaint(data.anonymousReports[0], chain).currentTierLabelAr, "الموارد البشرية");
  assert.deepEqual(voiceChainFor(byId("sug"), [{ id: "mgr", handlerIds: ["mgr"] }], data).map((x) => x.id), ["hr_voice"]);
});

t("server twin: a manager's blob never carries an HR-only row; his snapshot cannot drop them", () => {
  const mgrCtx = { actor: { role: "station_manager" }, permissions: new Set(), senior: false, scope: ["st"], userId: "mgr" };
  const opsCtx = { actor: { role: "ops_manager" }, permissions: new Set(), senior: true, scope: null, userId: "ops" };
  const hrCtx = { actor: { role: "employee" }, permissions: new Set(["view_anonymous_reports"]), senior: false, scope: null, userId: "hr" };
  const ownerCtx = { actor: null, permissions: new Set(), senior: true, scope: null, userId: "owner" };
  const ids = (cat, rows, ctx) => srv.filterVoiceRowsForServer(cat, rows, ctx).map((r) => r.id).sort();
  assert.deepEqual(ids("anonymousReports", data.anonymousReports, mgrCtx), []);
  assert.deepEqual(ids("anonymousReports", data.anonymousReports, opsCtx), [], "senior but a line manager");
  assert.deepEqual(ids("anonymousReports", data.anonymousReports, hrCtx), ["an1", "an2"]);
  assert.deepEqual(ids("publicReports", data.publicReports, mgrCtx), ["named"]);
  assert.deepEqual(ids("publicReports", data.publicReports, ownerCtx), ["named", "sug"]);
  assert.deepEqual(ids("abuseCases", data.abuseCases, mgrCtx), []);
  assert.deepEqual(ids("abuseCases", data.abuseCases, opsCtx), []);
  assert.deepEqual(ids("abuseCases", data.abuseCases, hrCtx), ["ab1"]);
  assert.deepEqual(ids("anonymousReports", data.anonymousReports, { ...mgrCtx, userId: "emp", actor: { role: "employee" } }), ["an1"], "the author by rate actor");
  const merged = srv.mergeVoiceWriteForServer("publicReports", data.publicReports, [data.publicReports[1]], mgrCtx);
  assert.deepEqual(merged.map((r) => r.id).sort(), ["named", "sug"], "the hidden suggestion is kept as stored");
  // client and server agree on every role.
  for (const [ctx, uid] of [[mgrCtx, "mgr"], [hrCtx, "hr"], [ownerCtx, "owner"]]) {
    assert.deepEqual(ids("anonymousReports", data.anonymousReports, ctx), viewerVoiceSlice(data, who(uid)).anonymousReports.map((r) => r.id).sort(), uid);
  }
});

t("routes: grievance and damage objection → «الجزاءات», harassment → «صوت الموظف»; neither in the rights picker", () => {
  assert.equal(rightsRouteFor("grievance"), GRIEVANCE_ROUTE);
  assert.equal(GRIEVANCE_ROUTE, "/app/discipline?tab=mine&raise=grievance");
  assert.equal(rightsRouteFor("abuse_complaint"), ABUSE_ROUTE);
  assert.equal(rightsRouteFor("damage_objection"), "/app/discipline?tab=mine&raise=damage_objection", "the Art. 91 objection → «الجزاءات»");
  assert.equal(rightsRouteFor("leave_carry"), "/app/requests?kind=rights&right=leave_carry");
  const raise = readFileSync(new URL("../src/components/requests/RightsRequestRaise.jsx", import.meta.url), "utf8");
  assert.ok(!raise.includes("AbuseCaseRaise"), "the abuse form left طلباتي");
  assert.ok(raise.includes("RIGHTS_ELSEWHERE = [\"contract_copy\", NIGHT_AVOID_TYPE, GRIEVANCE_TYPE, DAMAGE_OBJECTION_TYPE]"));
  assert.ok(!raise.includes("checkDamageObjectionGate"), "the damage objection form left طلباتي");
  const voice = readFileSync(new URL("../src/pages/Complaints.jsx", import.meta.url), "utf8");
  assert.ok(voice.includes("<AbuseCaseRaise") && voice.includes("<AbuseCasesBoard"), "raised and handled in «صوت الموظف»");
  assert.ok(voice.includes("voiceHrReceivers(data, { exclude: [currentUser?.id]"), "HR-only notices go to HR receivers, not the manager");
  const disc = readFileSync(new URL("../src/pages/Discipline.jsx", import.meta.url), "utf8");
  assert.ok(disc.includes("<GrievanceRaise"), "raised in «الجزاءات»");
  assert.ok(disc.includes("<DamageObjectionRaise"), "the Art. 91 objection is raised in «الجزاءات»");
  const dmg = readFileSync(new URL("../src/components/discipline/DamageObjectionRaise.jsx", import.meta.url), "utf8");
  assert.ok(dmg.includes("checkDamageObjectionGate({ notifiedOn, amount, reason, today })") && dmg.includes("type: DAMAGE_OBJECTION_TYPE"), "same gate, same stored request");
  const req = readFileSync(new URL("../src/pages/Requests.jsx", import.meta.url), "utf8");
  assert.ok(req.includes("[GRIEVANCE_TYPE, DAMAGE_OBJECTION_TYPE, ABUSE_COMPLAINT_KIND].includes(askedRight)"), "old ?right=damage_objection links redirect");
});

console.log(`voice privacy: ${n} passed`);
