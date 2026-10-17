/**
 * «الموارد البشرية» — one section for what were «الهيكل والفروع» (/app/hr) and «المحطات التي أديرها»
 * (/app/org admin): panes per gate, old /app/org links → the matching pane, one ministry panel,
 * the search, «الفروع والمحطات» grouping, and the «نظرة عامة» rows derived from the existing libs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hrBranchMatches,
  hrBranchRows,
  hrMinistrySection,
  hrSectionAccess,
  hrSectionSearch,
  orgRedirectTarget,
  resolveHrPane,
} from "../src/lib/hrSection.js";
import { deriveHrOverview, dueWord, hrEmployeeFlags } from "../src/lib/hrOverview.js";
import { buildMinistrySection } from "../src/lib/ministrySections.js";

const TODAY = "2026-10-17";
const data = {
  ownerId: "o1",
  stations: [
    { id: "root", name: "المقر", isCompanyRoot: true },
    { id: "b1", name: "فرع جدة", parentId: "root", managerId: "m1" },
    { id: "b2", name: "فرع الرس", parentId: "root", city: "الرس", countryCode: "SA" },
    { id: "b3", name: "مستودع", parentId: "root" },
  ],
  employees: [
    { id: "o1", name: "المالك", role: "owner" },
    { id: "m1", name: "مدير جدة", role: "station_manager", stationId: "b1" },
    {
      id: "e1",
      name: "عامل وافد",
      role: "employee",
      stationId: "b1",
      profile: { nationality: "هندي", idType: "iqama", idExpiry: "2026-10-30", hireDate: "2026-08-01", probation: true, probationDays: 90, contract: { type: "fixed", endDate: "2026-11-01" } },
    },
    { id: "e2", name: "عامل الرس", role: "employee", stationId: "b2", profile: { gosiNumber: "123" } },
  ],
  orgSeats: [{ id: "s1", title: "فني صيانة", stationId: "b2" }],
  orgDesign: { changes: [{ id: "c1", status: "pending", title: "نقل منصب", effectiveDate: "2026-10-20" }] },
};
const owner = data.employees[0];
const lead = data.employees[1];
const worker = data.employees[2];

/* panes per gate */
const full = hrSectionAccess(owner, data, { routeAllowed: true });
assert.deepEqual(full.panes, ["overview", "people", "org", "branches", "compliance"], "owner / HR see every pane");
assert.equal(full.orgWrite, true);
assert.equal(full.scopeIds, null);
assert.equal(resolveHrPane("", full), "overview");
assert.equal(resolveHrPane("compliance", full), "compliance");
const station = hrSectionAccess(lead, data, { routeAllowed: false });
assert.deepEqual(station.panes, ["org", "branches"], "a station lead: their stations and a read-only structure");
assert.equal(station.orgWrite, false);
assert.deepEqual(station.scopeIds, ["b1"]);
assert.equal(resolveHrPane("", station), "branches", "a station lead opens on their stations");
assert.equal(resolveHrPane("people", station), "branches", "no HR pane for a station lead");
assert.deepEqual(hrSectionAccess(worker, data, {}).panes, [], "an employee gets no HR pane");
assert.deepEqual(hrSectionAccess(owner, data, { routeAllowed: true, planAllowed: false }).panes, [], "the plan gate closes the section");
const hidden = { ...data, smartPositions: [{ employeeId: "m1", permissions: { attendance: "manage", hr: "hidden" } }] };
assert.deepEqual(hrSectionAccess(lead, hidden, {}).panes, [], "a smart position hiding HR closes it for a lead too");
const reader = hrSectionAccess({ id: "r1", role: "employee", hrLevelId: "lv" }, data, { routeAllowed: true });
assert.equal(reader.orgWrite, false, "an HR reader sees the structure read-only");

/* old /app/org links → the matching pane, parameters kept */
assert.equal(orgRedirectTarget(""), "/app/hr?tab=org");
assert.equal(orgRedirectTarget("?view=admin"), "/app/hr?tab=org");
assert.equal(orgRedirectTarget("?view=admin&pane=seats&seat=s1"), "/app/hr?tab=org&pane=seats&seat=s1");
assert.equal(orgRedirectTarget("?view=admin&hire=1&station=b1&seat=s1"), "/app/hr?tab=org&hire=1&station=b1&seat=s1");
assert.equal(orgRedirectTarget("?view=admin&pane=changes&op=moveSeat&seat=s1&to=b2"), "/app/hr?tab=org&pane=changes&seat=s1&op=moveSeat&to=b2");
assert.equal(orgRedirectTarget("?view=admin&chart=full&branch=b1"), "/app/hr?tab=branches&branch=b1");
assert.equal(orgRedirectTarget("?tab=escalation"), "/app/hr?tab=org&pane=authority&open=esc");
assert.equal(orgRedirectTarget("?tab=lists"), "/app/hr?tab=org&pane=authority&open=perm");
assert.equal(orgRedirectTarget("?view=admin&tab=health"), "/app/hr?tab=org&pane=health");
assert.equal(orgRedirectTarget("?focus=s1"), "/app/org/chart?focus=s1", "an old focus link opens the full chart on that card");
assert.equal(orgRedirectTarget("?view=employee"), "", "the employee's own place stays on /app/org");
assert.equal(orgRedirectTarget("?tab=people"), "");
assert.equal(orgRedirectTarget("?view=admin", "#nv-ministry-org"), "/app/hr?tab=compliance#nv-ministry-compliance");

/* one ministry panel: records + org rows, nothing invented */
const ministry = hrMinistrySection(data, { ar: true, today: TODAY });
assert.equal(ministry.title, "أنظمة الوزارة — ما يخص الموارد البشرية");
const parts = ["records", "org"].map((key) => buildMinistrySection(key, { lane: "manage", ar: true, today: TODAY, data }));
assert.equal(ministry.rows.length, parts[0].rows.length + parts[1].rows.length);
assert.equal(ministry.totals.alert, parts[0].totals.alert + parts[1].totals.alert);
assert.equal(new Set(ministry.cards.map((c) => c.key)).size, ministry.cards.length, "one card per source");

/* search: people, seats, branches — scoped for a lead */
const hits = hrSectionSearch(data, "جده", { access: full });
assert.ok(hits.some((h) => h.kind === "branch" && h.to === "/app/hr?tab=branches&branch=b1"), "a branch hit opens «الفروع والمحطات»");
assert.ok(hits.some((h) => h.kind === "person" && h.to === "/app/employees/e1"), "HR opens the person's file");
assert.equal(hrSectionSearch(data, "فني", { access: full })[0].to, "/app/hr?tab=org&pane=seats&seat=s1", "a seat opens «المناصب»");
assert.deepEqual(hrSectionSearch(data, "فني", { access: station }), [], "a lead never searches outside their stations");
assert.ok(hrSectionSearch(data, "عامل", { access: station }).every((h) => h.to.startsWith("/app/org/chart")), "a lead's person hit opens the chart");
assert.deepEqual(hrSectionSearch(data, "ع", { access: full }), [], "one letter is not a search");
const crowd = { ...data, employees: [...data.employees, ...Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, name: `موظف ${i}`, role: "employee", stationId: "b1" }))] };
const mixed = hrSectionSearch(crowd, "جده", { access: full });
assert.ok(mixed.length <= 8 && mixed.some((h) => h.kind === "branch"), "many people in a branch never hide the branch itself");

/* «الفروع والمحطات»: grouped by city, «بلا مدينة» last, scoped for a lead */
const branches = hrBranchRows(data, { ar: true });
assert.deepEqual(branches.groups.map((g) => g.city), ["الرس", "جدة", "بلا مدينة محددة"]);
assert.equal(branches.rows.find((r) => r.id === "b1").managerName, "مدير جدة");
assert.equal(branches.rows.find((r) => r.id === "b2").noManager, true);
assert.ok(hrBranchMatches(branches.rows.find((r) => r.id === "b3"), "no_city"));
assert.deepEqual(hrBranchRows(data, { scopeIds: ["b1"] }).rows.map((r) => r.id), ["b1"]);
assert.equal(branches.rows.some((r) => r.id === "root"), false, "HQ is not a branch row");

/* «نظرة عامة»: rows derived from the existing libs, decisions by deadline */
const overview = deriveHrOverview(data, { today: TODAY, ar: true });
const row = (id) => overview.rows.find((r) => r.id === id);
assert.equal(row("docs").count, 1);
assert.equal(row("docs").to, "/app/hr?tab=people&filter=expiring");
assert.equal(row("contracts").count, 1);
assert.equal(row("probation").count, 1);
assert.equal(row("changes").count, 1);
assert.equal(row("changes").to, "/app/hr?tab=org&pane=changes");
assert.equal(row("gosi").count, 2, "the same GOSI rule as «أنظمة الوزارة — السجلات»");
assert.ok(row("nitaqat"), "the Saudization note is there when files exist");
assert.ok(overview.clear.some((r) => r.id === "acting"), "clean checks are listed, not hidden");
assert.deepEqual(overview.decisions.map((d) => d.kind), ["change", "doc", "probation", "contract"], "nearest deadline first");
assert.ok(overview.decisions.every((d, i, a) => i === 0 || a[i - 1].days <= d.days));
assert.equal(overview.decisions.find((d) => d.kind === "contract").to, "/app/employees/e1?tab=contract");
const scoped = deriveHrOverview(data, { today: TODAY, scopeIds: ["b2"] });
assert.equal(scoped.staff, 1);
assert.equal(scoped.rows.some((r) => r.id === "docs"), false);
const readOnly = deriveHrOverview(data, { today: TODAY, orgWrite: false });
assert.equal(readOnly.rows.find((r) => r.id === "changes").to, "/app/hr?tab=org", "a reader opens the structure, not an editor pane");
assert.equal(dueWord(-3), "متأخر 3 يوماً");
assert.equal(dueWord(0), "اليوم");

/* the directory pills read the same rules */
const flags = hrEmployeeFlags(worker, { today: TODAY });
assert.equal(flags.expiring && flags.contract && flags.probation && flags.gosi, true);
assert.equal(hrEmployeeFlags(data.employees[3], { today: TODAY }).gosi, false);

/* the page wiring: one hero, one switch, no figures on the hero */
const page = readFileSync(new URL("../src/pages/HRStructureManagement.jsx", import.meta.url), "utf8");
assert.match(page, /title=\{ar \? "الموارد البشرية"/);
assert.match(page, /HeroSwitch options=\{options\}/);
assert.equal(/count:/.test(page), false, "no figures on the hero switch");
assert.equal((page.match(/MinistrySectionPanel/g) || []).length, 0, "the one ministry panel lives in «الامتثال»");
const org = readFileSync(new URL("../src/pages/OrgStructure.jsx", import.meta.url), "utf8");
assert.match(org, /orgRedirectTarget/);
assert.equal(/MinistrySectionPanel|OrgSeatRegister|OrgDoaBoard/.test(org), false, "/app/org keeps only the employee's own place");

console.log("PASS test-hr-section");
