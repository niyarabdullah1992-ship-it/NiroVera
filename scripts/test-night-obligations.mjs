/**
 * test-night-obligations.mjs — Decision 18632 employer obligations as rule rows in «أنظمة الوزارة».
 * Status derivation (no night work / missing / provided / expired certificate / yearly renewal)
 * and the publish gate that still blocks on the first three.
 * Run: node scripts/test-night-obligations.mjs
 */
import { checkWeekPublishGates, weekPublishSubmitBlock } from "../src/lib/shiftWeek.js";
import { buildLawGatesBoard } from "../src/lib/lawGatesBoard.js";
import { nightObligationRows, nightObligationMet, NIGHT_OBLIGATIONS } from "../src/lib/nightObligations.js";

let fails = 0;
let passes = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes += 1; else fails += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
}

const MORN = { id: "morn", start: "07:00", end: "15:00", restMinutes: 60, name: "صباحي" };
const NGT = { id: "ngt", start: "23:00", end: "07:00", restMinutes: 60, name: "ليلي" };
const AIDER = { id: "e2", name: "سالم المسعف", stationId: "st1", profile: { gender: "male", birthDate: "1990-01-01" }, certificates: [{ id: "c1", name: "شهادة إسعافات أولية", expiryDate: "2027-03-01" }] };
const EXPIRED = { ...AIDER, id: "e3", name: "فهد", certificates: [{ id: "c9", name: "First Aid", expiryDate: "2026-08-01" }] };
const EMP = { id: "e1", name: "أحمد", stationId: "st1", profile: { gender: "male", birthDate: "1990-01-01" } };
const WEEK = "2026-09-13";
const TODAY = "2026-09-13";
const night = (extra = {}) => ({ stationId: "st1", nightCompensation: true, shiftTypes: [MORN, NGT], assignments: { "2026-09-14": { ngt: ["e1"] } }, ...extra });
const day = (extra = {}) => ({ stationId: "st1", shiftTypes: [MORN, NGT], assignments: { "2026-09-14": { morn: ["e1"] } }, ...extra });
const run = (schedule, employees = [EMP, AIDER, EXPIRED]) => checkWeekPublishGates({ schedule, employees, weekStart: WEEK, stationId: "st1", today: TODAY });
const rowOf = (gates, key) => (gates.nightObligations || []).find((row) => row.key === key);
const boardRow = (gates, key) => buildLawGatesBoard({ gates, onDate: "2026-09-14", ar: true }).night.rows.find((row) => row.obligationKey === key);
const proof = (key, fields, at = "2026-09-10T08:00:00Z") => ({ [key]: true, nightDutyProof: { [key]: { ...fields, by: "hr1", byName: "نورة الموارد", at } } });

// 1 — five rows, each its own clause.
check("five obligation rows in the 18632 group", NIGHT_OBLIGATIONS.map((o) => o.key), ["nightFirstAidReady", "nightEmergencyTransferReady", "nightFoodAccessReady", "nightTrainingParity", "nightGuidePublished"]);
check("clauses: ثالثاً ×3 · متطلبات أ · متطلبات و", NIGHT_OBLIGATIONS.map((o) => o.clause), ["ثالثاً", "ثالثاً", "ثالثاً", "متطلبات أ", "متطلبات و"]);

// 2 — no night work → mute «لا عمل ليلي هذا الأسبوع», no gate.
{
  const g = run(day());
  check("no night work: every row void", g.nightObligations.map((r) => r.status), ["void", "void", "void", "void", "void"]);
  check("no night work: pill reads «لا عمل ليلي هذا الأسبوع»", rowOf(g, "nightFirstAidReady").pillLabel, "لا عمل ليلي هذا الأسبوع");
  check("no night work: night_facilities not a blocker", g.blockers.some((b) => b.id === "night_facilities"), false);
  check("board: the old grouped night_facilities row is gone", buildLawGatesBoard({ gates: g, onDate: "2026-09-14", ar: true }).night.rows.some((r) => r.id === "night_facilities" || r.id === "night_employer_duties"), false);
}

// 3 — night work, nothing on file → first three block, last two alert; gate names the missing items.
{
  const g = run(night());
  check("missing with night work: statuses", g.nightObligations.map((r) => r.status), ["blocked", "blocked", "blocked", "alert", "alert"]);
  check("missing: pills «يمنع النشر» / «تنبيه»", g.nightObligations.map((r) => r.pillLabel), ["يمنع النشر", "يمنع النشر", "يمنع النشر", "تنبيه", "تنبيه"]);
  check("publish gate still blocks on night_facilities", g.blockers.some((b) => b.id === "night_facilities"), true);
  const title = g.blockers.find((b) => b.id === "night_facilities")?.title || "";
  check("blocker title names the missing obligations", /إسعافات أولية ليلية/.test(title) && /وصول لطعام/.test(title), true);
  check("publish control reason carries the named gap", /إسعافات أولية ليلية/.test(weekPublishSubmitBlock(g, { ar: true })), true);
  check("parity/guide never block", g.blockers.some((b) => b.id === "night_employer_duties"), false);
  check("board row keeps its own title", boardRow(g, "nightFoodAccessReady")?.title, "وصول لطعام في الليل");
}

// 4 — provided with proof → «مستوفى» with who/when; gate opens when the first three are proven.
{
  const sched = night({
    nightFirstAidReady: true,
    nightEmergencyTransferReady: true,
    nightFoodAccessReady: true,
    nightDutyProof: {
      nightFirstAidReady: { aiders: [{ employeeId: "e2", name: "سالم المسعف", certId: "c1" }], by: "hr1", byName: "نورة الموارد", at: "2026-09-10T08:00:00Z" },
      nightEmergencyTransferReady: { method: "إسعاف الهلال الأحمر", contact: "997", by: "hr1", byName: "نورة الموارد", at: "2026-09-10T08:00:00Z" },
      nightFoodAccessReady: { method: "allowance", by: "hr1", byName: "نورة الموارد", at: "2026-09-10T08:00:00Z" },
    },
  });
  const g = run(sched);
  check("provided: first three settled", g.nightObligations.slice(0, 3).map((r) => r.status), ["settled", "settled", "settled"]);
  check("provided: pill «مستوفى»", rowOf(g, "nightFirstAidReady").pillLabel, "مستوفى");
  check("provided: sub line names who", /نورة الموارد/.test(rowOf(g, "nightFirstAidReady").sub), true);
  check("provided: sub line names the first-aider", /سالم المسعف/.test(rowOf(g, "nightFirstAidReady").sub), true);
  check("provided: publish gate opens", g.blockers.some((b) => b.id === "night_facilities"), false);
  check("provided: board carries the sub line", /نورة الموارد/.test(boardRow(g, "nightEmergencyTransferReady")?.sub || ""), true);
  check("legacy flag without proof still counts (gate unchanged)", run(night({ nightFirstAidReady: true, nightEmergencyTransferReady: true, nightFoodAccessReady: true })).blockers.some((b) => b.id === "night_facilities"), false);
}

// 5 — expired first-aid certificate → row returns to missing and the gate blocks again.
{
  const sched = night({
    nightEmergencyTransferReady: true,
    nightFoodAccessReady: true,
    ...proof("nightFirstAidReady", { aiders: [{ employeeId: "e3", name: "فهد", certId: "c9" }] }),
  });
  const g = run(sched);
  check("expired certificate: row blocked", rowOf(g, "nightFirstAidReady").status, "blocked");
  check("expired certificate: reason", rowOf(g, "nightFirstAidReady").reason, "cert_expired");
  check("expired certificate: gate blocks again", g.blockers.some((b) => b.id === "night_facilities"), true);
  check("expired certificate: gate names the reason", /انتهت شهادة المسعف/.test(g.blockers.find((b) => b.id === "night_facilities")?.note || ""), true);
  const mixed = nightObligationMet("nightFirstAidReady", {
    bags: [proof("nightFirstAidReady", { aiders: [{ employeeId: "e3", certId: "c9" }, { employeeId: "e2", certId: "c1" }] })],
    employees: [AIDER, EXPIRED],
    today: TODAY,
  });
  check("one current first-aider is enough", mixed.met, true);
}

// 6 — parity (a) renewed yearly; guide (f) provided.
{
  const fresh = run(night({ ...proof("nightTrainingParity", { acknowledged: true }, "2026-01-05T08:00:00Z") }));
  check("parity acknowledged this year: settled", rowOf(fresh, "nightTrainingParity").status, "settled");
  const stale = run(night({ ...proof("nightTrainingParity", { acknowledged: true }, "2025-08-01T08:00:00Z") }));
  check("parity older than a year: alert", rowOf(stale, "nightTrainingParity").status, "alert");
  check("parity stale: night_employer_duties warns, no block", `${stale.checks.find((c) => c.id === "night_employer_duties")?.ok}/${stale.blockers.some((b) => b.id === "night_employer_duties")}`, "false/false");
  const guide = run(night({ ...proof("nightGuidePublished", { file: { url: "data:x", name: "دليل الليل.pdf" } }) }));
  check("guide published: settled", rowOf(guide, "nightGuidePublished").status, "settled");
  check("guide sub names the file", /دليل الليل\.pdf/.test(rowOf(guide, "nightGuidePublished").sub), true);
}

// 7 — rows read the company bag too (company.nightFacilities).
{
  const rows = nightObligationRows({ bags: [{ nightFacilities: true }, { nightFoodAccessReady: true }], nightWork: true, today: TODAY });
  check("company bag flag reads as met", rows.find((r) => r.key === "nightFoodAccessReady").status, "settled");
}

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
