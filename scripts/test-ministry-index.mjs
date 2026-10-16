/** «الامتثال الوزاري» index: each section's counts equal the counts of the rows its own panel lists
 *  (same builders, same inputs), per-person sections sum, voice / payroll stay hidden when restricted. */
import assert from "node:assert/strict";
import { ministryIndexSections, ministryIndexTotals, MINISTRY_INDEX_KEYS } from "../src/lib/ministryIndex.js";
import { ministryCounts, ministryCountsAcross, scheduleMinistryCounts } from "../src/lib/ministryCounts.js";
import { requestsMinistryRows } from "../src/lib/requestsMinistryRows.js";
import { contractMinistryRows } from "../src/lib/contractMinistryRows.js";
import { offboardingMinistryRows } from "../src/lib/offboardingMinistryRows.js";
import { safetyMinistryFacts, safetyMinistryRows } from "../src/lib/safetyMinistryRows.js";
import { voiceMinistryInputs, voiceMinistryRows } from "../src/lib/voiceMinistryRows.js";
import { disciplineLawRows } from "../src/lib/disciplineBoard.js";
import { disciplineModelRows } from "../src/lib/disciplineModelRows.js";
import { complianceMinistryRows } from "../src/lib/complianceMinistryRows.js";
import { payrollPanelRows } from "../src/lib/payrollMinistryRows.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const D = "2026-10-16";

const omar = { id: "e1", name: "عمر", stationId: "s1", hireDate: "2026-07-01", profile: { nationality: "مصري", nationalId: "2123", workPattern: "temporary", contractType: "indefinite", baseSalary: 6000, contractExit: { reason: "closure", party: "employer", effectiveDate: "2026-10-05" } }, leaveRequests: [{ id: "l1", type: "annual", status: "pending" }], otherRequests: [] };
const sara = { id: "e2", name: "سارة", stationId: "s1", hireDate: "2020-01-01", profile: { nationality: "سعودي", nationalId: "1123", contractType: "indefinite", baseSalary: 9000 }, leaveRequests: [{ id: "l2", type: "sick", status: "approved" }], otherRequests: [] };
const stations = [{ id: "s1", name: "الخفجي" }];
const data = {
  employees: [omar, sara],
  stations,
  safety: [{ stationId: "s1", hazards: [{ id: "h1" }], incidentLog: [] }],
  disciplinaryCases: [],
};
const voice = { breached: 2, abuseCases: [] };
const payroll = { month: "2026-10", lines: [], employeeForItem: null };
const schedule = scheduleMinistryCounts({ blockCount: 1, violationCount: 1, warnCount: 3, settledCount: 9 });
const sections = ministryIndexSections({ data, employees: [omar, sara], stations, schedule, scheduleStation: "الخفجي", payroll, disciplineCases: [], voice, today: D, ar: true });
const by = (key) => sections.find((row) => row.key === key);

ok("one line per section, in the agreed order", () => {
  assert.deepEqual(sections.map((row) => row.key), MINISTRY_INDEX_KEYS);
  sections.forEach((row) => assert.ok(row.href.startsWith("/app/"), row.key));
});

ok("per-person sections equal the sum of each person's panel rows", () => {
  const req = [omar, sara].map((p) => requestsMinistryRows({ subject: p, ar: true, today: D }));
  assert.deepEqual(by("requests").counts, ministryCountsAcross(req));
  assert.equal(by("requests").counts.alert, 2, "the pending annual leave sits under 109 and 110");
  assert.equal(by("requests").counts.met, 1, "the approved sick leave");
  const con = [omar, sara].map((p) => contractMinistryRows(p, { today: D }));
  assert.deepEqual(by("contract").counts, ministryCountsAcross(con));
  assert.match(by("contract").href, /employees\/e1\?tab=contract#nv-ministry-contract/);
});

ok("نهاية الخدمة counts only files with an exit and opens the flagged one", () => {
  assert.deepEqual(by("offboarding").counts, ministryCounts(offboardingMinistryRows({ employee: omar, today: D })));
  assert.ok(by("offboarding").counts.block >= 2, "certificate, ticket and the overdue Art. 88 window");
  assert.match(by("offboarding").href, /e1\?tab=contract#nv-ministry-offboarding/);
  const none = ministryIndexSections({ data, employees: [sara], stations, today: D }).find((row) => row.key === "offboarding");
  assert.equal(none.counts.block + none.counts.alert + none.counts.met, 0);
  assert.equal(none.href, "/app/hr");
});

ok("establishment sections equal their panel's counts", () => {
  assert.deepEqual(by("safety").counts, ministryCounts(safetyMinistryRows(safetyMinistryFacts({ stations, recFor: (sid) => data.safety.find((r) => r.stationId === sid), today: D }), { onDate: D })));
  assert.deepEqual(by("voice").counts, ministryCounts(voiceMinistryRows({ ...voice, today: D })));
  assert.equal(by("voice").counts.alert, 1);
  assert.deepEqual(by("discipline").counts, ministryCounts([...disciplineLawRows({ cases: [], employees: data.employees, today: D }), ...disciplineModelRows({ employees: data.employees, manage: true })]));
  assert.deepEqual(by("records").counts, ministryCounts(complianceMinistryRows(data, { today: D })));
  assert.deepEqual(by("payroll").counts, ministryCounts(payrollPanelRows({ data, month: "2026-10", items: [], today: D })));
  assert.deepEqual(by("schedule").counts, { block: 2, alert: 3, met: 9, info: 0 });
});

ok("privacy: no voice counts without an HR receiver's inputs; no payroll counts without payroll rights", () => {
  assert.equal(voiceMinistryInputs(data, { id: "m", role: "station_manager" }), null);
  assert.equal(voiceMinistryInputs(data, { id: "o", role: "ops_manager" }), null);
  assert.ok(voiceMinistryInputs(data, { id: "h", role: "hr" }));
  const manager = ministryIndexSections({ data, employees: [omar, sara], stations, today: D });
  assert.equal(manager.find((row) => row.key === "voice").counts, null);
  assert.equal(manager.find((row) => row.key === "voice").restricted, true);
  assert.equal(manager.find((row) => row.key === "payroll").counts, null);
  const total = ministryIndexTotals(manager);
  const expected = manager.filter((row) => row.counts).reduce((s, row) => s + row.counts.alert, 0);
  assert.equal(total.alert, expected);
});

ok("the panel frame and the index share one count", () => {
  const rows = [{ status: "blocked" }, { status: "violation" }, { status: "waiting" }, { status: "alert" }, { status: "settled" }, { status: "void" }];
  assert.deepEqual(ministryCounts(rows), { block: 2, alert: 2, met: 1, info: 1 });
});

console.log(`ministry index: ${n} checks passed`);
