/** «أنظمة الوزارة — ما يخص <القسم>»: one builder (lib/ministrySections) for every section's panel.
 *  Cards add up to their rows, three statuses only, the employee lane never carries a management-only
 *  row, the owner's excluded items never appear, and every article cited exists in the catalogs. */
import assert from "node:assert/strict";
import {
  buildMinistrySection,
  citeExcluded,
  citeKnown,
  DISCIPLINE_RIGHTS,
  MINISTRY_EMPLOYEE_SECTIONS,
  MINISTRY_LEVELS,
  MINISTRY_SECTION_KEYS,
  MINISTRY_SOURCE_ORDER,
  ministryLevel,
  parseCites,
} from "../src/lib/ministrySections.js";
import { citeRule, ruleAt } from "../src/lib/laborRules.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const D = "2026-07-20"; // in the 3337 season, so the sun-ban rows carry a live status

const omar = {
  id: "e1", name: "عمر", stationId: "s1", hireDate: "2026-05-01",
  profile: { nationality: "مصري", nationalId: "2123", workPattern: "temporary", contractType: "indefinite", baseSalary: 6000, contractExit: { reason: "closure", party: "employer", effectiveDate: "2026-07-05" } },
  leaveRequests: [{ id: "l1", type: "annual", status: "pending" }], otherRequests: [{ id: "o1", type: "mission", status: "approved" }],
};
const sara = { id: "e2", name: "سارة", stationId: "s1", hireDate: "2020-01-01", gosiNumber: "77", profile: { nationality: "سعودي", nationalId: "1123", contractType: "indefinite", baseSalary: 9000, gender: "female" }, leaveRequests: [{ id: "l2", type: "sick", status: "approved" }], otherRequests: [] };
const stations = [{ id: "s1", name: "الرس" }];
const data = {
  employees: Array.from({ length: 52 }, (_, i) => ({ id: `x${i}`, name: `x${i}` })).concat([omar, sara]),
  stations,
  safety: [{ stationId: "s1", hazards: [{ id: "h1" }], incidentLog: [{ id: "i1", status: "open", card: { injured: true, kind: 3 } }] }],
  disciplinaryCases: [],
  settings: {},
};
const facts = { stationCount: 1, injuryOpen: true, criticalOpen: true, siteUnknown: 1, remoteCount: 0, control: "gap", firstAid: { short: 1 } };
const items = [{ employeeId: "e1", base: 6000, overtimeHours: 4 }, { employeeId: "e2", base: 9000, gosiNumber: "77" }];

/** Inputs for every section, both lanes. */
const inputsOf = (key, lane) => ({
  requests: lane === "manage" ? { people: [omar, sara] } : { subject: omar },
  payroll: { data, month: "2026-07", items: lane === "manage" ? items : [items[0]] },
  contract: { employee: omar },
  offboarding: { employee: omar },
  discipline: { cases: [], employees: data.employees },
  voice: lane === "manage" ? { breached: 2, abuseCases: [] } : { breached: 0, abuseCases: [] },
  performance: lane === "manage" ? { people: [omar, sara], perf: {} } : { employee: omar, reports: [] },
  safety: { facts: lane === "manage" ? facts : {} },
  records: { data },
  org: { data },
  tasks: {},
}[key]);

const all = [];
for (const key of MINISTRY_SECTION_KEYS) {
  for (const lane of ["employee", "manage"]) {
    if (lane === "employee" && !MINISTRY_EMPLOYEE_SECTIONS.includes(key)) continue;
    all.push(buildMinistrySection(key, { lane, today: D, ar: true, ...inputsOf(key, lane) }));
  }
}
const by = (key, lane) => all.find((s) => s.key === key && s.lane === lane);

ok("every governed section builds both lanes (records and org are management only)", () => {
  assert.ok(MINISTRY_SECTION_KEYS.length >= 11);
  MINISTRY_SECTION_KEYS.forEach((key) => assert.ok(by(key, "manage")?.rows.length, `${key} manage has rows`));
  MINISTRY_EMPLOYEE_SECTIONS.forEach((key) => assert.ok(by(key, "employee")?.rows.length, `${key} employee has rows`));
  assert.ok(!MINISTRY_EMPLOYEE_SECTIONS.includes("records") && !MINISTRY_EMPLOYEE_SECTIONS.includes("org"));
});

ok("titles read «أنظمة الوزارة — ما يخص …»", () => {
  all.forEach((s) => assert.match(s.title, /^أنظمة الوزارة — ما يخص /, `${s.key}/${s.lane}`));
});

ok("each card's counters equal its rows, and the cards add up to the section", () => {
  for (const s of all) {
    let sum = 0;
    for (const card of s.cards) {
      const own = s.rows.filter((r) => r.source === card.key);
      assert.ok(own.length, `${s.key}: card ${card.key} has rows`);
      assert.equal(card.counts.alert, own.filter((r) => r.level === "alert").length, `${s.key}/${card.key} alert`);
      assert.equal(card.counts.met, own.filter((r) => r.level === "met").length, `${s.key}/${card.key} met`);
      assert.equal(card.counts.info, own.filter((r) => r.level === "info").length, `${s.key}/${card.key} info`);
      sum += card.counts.alert + card.counts.met + card.counts.info;
    }
    assert.equal(sum, s.rows.length, `${s.key}/${s.lane}: every row sits under a card`);
    assert.equal(s.totals.alert + s.totals.met + s.totals.info, s.rows.length);
    assert.deepEqual(s.cards.map((c) => c.key), MINISTRY_SOURCE_ORDER.filter((k) => s.cards.some((c) => c.key === k)), "cards in source order");
  }
});

ok("three statuses only — تنبيه · مستوفٍ · للعلم", () => {
  assert.deepEqual(MINISTRY_LEVELS, ["alert", "met", "info"]);
  for (const s of all) s.rows.forEach((r) => assert.ok(MINISTRY_LEVELS.includes(r.level), `${s.key}/${r.key}: ${r.level}`));
  assert.equal(ministryLevel("blocked"), "alert");
  assert.equal(ministryLevel("violation"), "alert");
  assert.equal(ministryLevel("waiting"), "alert");
  assert.equal(ministryLevel("settled"), "met");
  assert.equal(ministryLevel("void"), "info");
});

ok("statuses are derived from the data, not fixed", () => {
  // management sees the open injury, the unknown site distance and the pending leave; the worker does not
  assert.ok(by("safety", "manage").totals.alert >= 3);
  assert.equal(by("safety", "employee").totals.alert, 0);
  assert.equal(by("requests", "manage").rows.find((r) => r.key === "labour-109").level, "alert");
  assert.equal(by("requests", "employee").rows.find((r) => r.key === "labour-109").level, "met");
  assert.equal(by("voice", "manage").rows.find((r) => r.key === "regs-window").level, "alert");
  assert.equal(by("voice", "employee").rows.find((r) => r.key === "regs-window").level, "met");
  // fifty workers or more on the model regulation: an own certified one is due (Regs Art. 4)
  assert.equal(by("org", "manage").rows.find((r) => r.key === "regs-4").level, "alert");
  const small = buildMinistrySection("org", { lane: "manage", today: D, data: { employees: [omar] } });
  assert.equal(small.rows.find((r) => r.key === "regs-4").level, "met");
  // GOSI registration: the month of joining has passed with no number on the file
  assert.equal(by("contract", "employee").rows.find((r) => r.key === "gosi-register").level, "alert");
  const registered = buildMinistrySection("contract", { lane: "employee", today: D, employee: sara });
  assert.equal(registered.rows.find((r) => r.key === "gosi-register").level, "met");
  // in season the sun-ban gate is enforced; off season it is for reference
  assert.equal(by("tasks", "manage").rows[0].level, "met");
  assert.equal(buildMinistrySection("tasks", { lane: "manage", today: "2026-11-01" }).rows[0].level, "info");
});

const MANAGE_ONLY = { payroll: ["labour-90", "labour-92", "gosi-wage-change"], offboarding: ["gosi-exclude"] };
ok("the employee lane never carries a management-only row", () => {
  for (const s of all.filter((x) => x.lane === "employee")) {
    s.rows.forEach((r) => {
      assert.equal(r.manageOnly, false, `${s.key}/${r.key} is management-only`);
      assert.ok(!(MANAGE_ONLY[s.key] || []).includes(r.key), `${s.key}/${r.key}`);
      if (r.hint) assert.equal(r.hint.view, "employee", `${s.key}/${r.key}: «حقك», not «التزامك»`);
    });
  }
  ["labour-90", "labour-92", "gosi-wage-change"].forEach((key) => assert.ok(by("payroll", "manage").rows.some((r) => r.key === key), key));
  assert.ok(by("offboarding", "manage").rows.some((r) => r.key === "gosi-exclude"));
  assert.ok(!by("offboarding", "employee").rows.some((r) => r.key === "gosi-exclude"));
  // even when asked for the employee lane, the establishment sections return nothing of management's
  assert.equal(buildMinistrySection("records", { lane: "employee", today: D, data }).rows.length, 0);
});

ok("the owner's excluded items are absent: Regs 9, 11, 16 bis · Model 7, 13", () => {
  assert.ok(citeExcluded({ source: "regs", article: "9" }));
  assert.ok(citeExcluded({ source: "regs", article: "16 مكرر" }));
  assert.ok(citeExcluded({ source: "model", article: "13" }));
  assert.deepEqual(parseCites("اللائحة م16 مكرر"), [{ source: "regs", article: "16 مكرر" }]);
  for (const s of all) {
    s.rows.forEach((r) => (r.cites || []).forEach((c) => assert.ok(!citeExcluded(c), `${s.key}/${r.key} cites ${c.source}:${c.article}`)));
  }
});

ok("every article cited exists in its catalog (Labour Law text · Regs 1–40 bar the repealed · Model 1–72)", () => {
  for (const s of all) s.rows.forEach((r) => (r.cites || []).forEach((c) => assert.ok(citeKnown(c), `${s.key}/${r.key}: ${c.source} ${c.article}`)));
  assert.equal(citeKnown({ source: "regs", article: "36" }), false, "repealed");
  assert.equal(citeKnown({ source: "model", article: "73" }), false);
  assert.deepEqual(parseCites("م 142 · اللائحة م29"), [{ source: "labour", article: "142" }, { source: "regs", article: "29" }]);
  assert.deepEqual(parseCites("النموذج الموحد م9·12·24", "model").map((c) => c.article), ["9", "12", "24"]);
  assert.deepEqual(parseCites("م 92–93").map((c) => c.article), ["92", "93"]);
});

ok("card article lists are read from the rows, never typed", () => {
  for (const s of all) {
    for (const card of s.cards) {
      const tail = card.scope.split(" · ").pop();
      if (!/^(?:م|Art\.) /.test(tail)) continue;
      const own = new Set(s.rows.filter((r) => r.source === card.key).flatMap((r) => (r.cites || []).filter((c) => c.source === card.key).map((c) => c.article)));
      const nums = tail.replace(/^(?:م|Art\.) /, "").split(/[،,–]\s*/).map((x) => x.trim());
      nums.forEach((num) => assert.ok(own.has(num), `${s.key}/${card.key}: ${num} not in its rows`));
    }
  }
});

ok("new GOSI rows and the discipline rights cite the rule catalog", () => {
  ["gosi.register.cite", "gosi.exclude.cite", "gosi.injury.reportDays", "gosi.wageChange.cite"].forEach((id) => {
    const row = ruleAt(id, D);
    assert.equal(row?.source, "gosi", id);
    assert.match(row.hintAr, /دليل أصحاب الأعمال/);
  });
  assert.equal(ruleAt("gosi.injury.reportDays", D).value, 10);
  DISCIPLINE_RIGHTS.forEach((r) => assert.ok(citeRule(r.ruleId, D)?.article, r.ruleId));
  const disc = by("discipline", "employee");
  assert.ok(disc.rows.some((r) => r.key === "payroll.damage.objectionWorkingDays"), "Art. 91 objection lives in الجزاءات");
  assert.ok(disc.rows.every((r) => r.source !== "labour" || r.hint), "every Labour Law right carries its ⚖ hint");
});

ok("ISO 45001 is not listed as a ministry rule", () => {
  assert.ok(!by("safety", "manage").rows.some((r) => r.key.startsWith("iso-")));
});

console.log(`ministry sections: ${n} checks passed`);
