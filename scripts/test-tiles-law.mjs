// Calm cards — no coloured top/side edge strip on cards, tiles, panels; status is a text chip (warn/bad only).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FLAG_DEFAULT_TEXT, KPI_ACTION_FILL, KPI_ACTION_INK, KPI_INK, READINESS_FLOOR, chipRepeatsLabel, flagKind, flagStyle, flagText, kpiActionStyle, kpiActionText, kpiFlagText, meterStyles, scoreFlag } from "../src/lib/statusFlag.js";
import { docFrame } from "../src/lib/designSystem.js";
import { statusBanner } from "../src/lib/platformStyles.js";

// 1. Tone → chip kind: only warn/bad families colour; ok/neutral/mute stay colourless.
for (const t of ["warn", "watch", "waiting", "late", "alert", "pending"]) assert.equal(flagKind(t), "warn", t);
for (const t of ["bad", "urgent", "blocked", "danger", "absent", "exposed", "overdue"]) assert.equal(flagKind(t), "bad", t);
for (const t of ["ok", "mute", "neutral", "rest", "leave", "", null, undefined]) assert.equal(flagKind(t), null, String(t));

// 2. Text: caller's specific flag wins; else the defaults.
assert.equal(flagText("warn", true), "يحتاج متابعة");
assert.equal(flagText("bad", true), "يحتاج إجراء");
assert.equal(flagText("warn", false), "Needs attention");
assert.equal(flagText("bad", false), "Action needed");
assert.equal(flagText("warn", true, "تأخير مسجّل"), "تأخير مسجّل");
assert.equal(flagText("ok", true, "anything"), "");
assert.equal(FLAG_DEFAULT_TEXT.bad.en, "Action needed");

// 3. Style: small pill on existing tokens (dark mode flips them); none for ok.
const warnStyle = flagStyle("warn");
assert.equal(warnStyle.background, "var(--nv-warn-soft)");
assert.equal(warnStyle.color, "var(--nv-warn-ink)");
assert.equal(warnStyle.padding, "2px 8px");
assert.ok(warnStyle.fontSize >= 10.5 && warnStyle.fontSize <= 11);
assert.equal(warnStyle.borderRadius, 999);
assert.equal(flagStyle("bad").color, "var(--nv-bad-ink)");
assert.equal(flagStyle("ok"), null);

// 4. Shared chrome carries no coloured top edge.
assert.equal(docFrame("blocked").borderTop, undefined);
for (const k of ["ok", "warn", "bad"]) assert.equal(statusBanner[k].borderTop, undefined, k);

// 5. Source sweep: no 3px top strip on any card under src (calendar/print/landing rules are not cards).
const root = new URL("../src/", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(name)) files.push(full);
  }
})(root);
const ALLOW = [/printReport\.js$/, /printDocument\.js$/];
const BAR = /borderTop: ?[`"']3px|border-top: ?[2-6]px solid|insetInline: 0, top: 0, height: 3|top: 0, insetInline: 0, height: 3|aria-hidden style=\{\{ ?height: 3, background|borderTop: `\$\{DS_EDGE_PX\}px/;
const hits = [];
for (const file of files) {
  if (ALLOW.some((re) => re.test(file))) continue;
  readFileSync(file, "utf8").split("\n").forEach((line, i) => { if (BAR.test(line)) hits.push(`${file.slice(root.length)}:${i + 1}`); });
}
assert.deepEqual(hits, [], `coloured top strips left: ${hits.join(", ")}`);

// 6. DutyTile: no top span; flag chip by tone; MyRecordPage passes the specific flags.
const tile = readFileSync(join(root, "components/schedules/DutyTiles.jsx"), "utf8");
assert.doesNotMatch(tile, /height: 3/);
assert.match(tile, /<StatusFlag tone=\{tone\} flag=\{flag\} ar=\{ar\} label=/);
const rec = readFileSync(join(root, "components/attendance/MyRecordPage.jsx"), "utf8");
assert.match(rec, /أقل من المجدول/);
assert.match(rec, /Below schedule/);
assert.match(rec, /تأخير مسجّل/);
assert.match(rec, /Lateness on file/);

// 7. Public verify result keeps its meaning visible without a bar.
const verify = readFileSync(join(root, "components/files/VerifyDocumentCard.jsx"), "utf8");
assert.match(verify, /data-verify-state=\{kind\}/);
assert.doesNotMatch(verify, /borderTop: `3px/);

// 8. KPI law — the chip never repeats its label.
assert.equal(chipRepeatsLabel("بانتظار قرارك", "بانتظار قرارك"), true);
assert.equal(chipRepeatsLabel("Awaiting you", "Awaiting your decision"), true);
assert.equal(chipRepeatsLabel("حسم نافذ", "إجمالي الحسم النافذ"), true);
assert.equal(chipRepeatsLabel("حضور منخفض", "نسبة الحضور"), false);
assert.equal(chipRepeatsLabel("", "نسبة الحضور"), false);
assert.equal(kpiFlagText({ tone: "bad", flag: "بانتظار قرارك", label: "بانتظار قرارك" }), "");
assert.equal(kpiFlagText({ tone: "bad", flag: "حضور منخفض", label: "نسبة الحضور" }), "حضور منخفض");
assert.equal(kpiFlagText({ tone: "ok", flag: "x", label: "y" }), "");
assert.equal(kpiFlagText({ tone: "warn", label: "يحتاج متابعة" }), "", "default text equal to the label is dropped too");

// 9. Score tiles: chip only below the floor, with specific words; meter 4px, hairline track, platform-green fill.
assert.equal(READINESS_FLOOR, 60);
assert.deepEqual(scoreFlag(43), { tone: "warn", flag: "أقل من 60" });
assert.deepEqual(scoreFlag(43, { ar: false }), { tone: "warn", flag: "Below 60" });
assert.deepEqual(scoreFlag(60), { tone: null, flag: "" });
assert.deepEqual(scoreFlag(88), { tone: null, flag: "" });
const meter = meterStyles(43, 100);
assert.equal(meter.pct, 43);
assert.equal(meter.track.height, 4);
assert.equal(meter.track.borderRadius, 999);
assert.equal(meter.track.background, "var(--nv-line2)");
assert.equal(meter.fill.background, KPI_ACTION_FILL);
assert.equal(meter.fill.width, "43%");
assert.equal(meterStyles(140).pct, 100);
assert.equal(meterStyles(-5).pct, 0);

// 10. Queues are actions: a small green line, platform green, never a chip.
assert.equal(KPI_INK, "var(--nv-ink)");
assert.equal(KPI_ACTION_INK, "var(--nv-ok-ink)");
assert.equal(KPI_ACTION_FILL, "var(--nv-btn-fill)");
assert.equal(kpiActionText(true), "افتح القرار ›");
assert.equal(kpiActionText(false), "Open the decision ›");
assert.equal(kpiActionText(true, "افتح المهام"), "افتح المهام ›");
assert.equal(kpiActionStyle.color, KPI_ACTION_INK);
const handoff = readFileSync(join(root, "components/dashboard/HandoffCommandBoard.jsx"), "utf8");
assert.doesNotMatch(handoff, /KPI_FLAG|kpiAccent/);
assert.match(handoff, /<KpiAction to=\{kpi\.to\} asText/);
assert.match(handoff, /<KpiMeter value=\{kpi\.value\}/);
assert.match(handoff, /scoreFlag\(score, \{ floor: READINESS_FLOOR/);
assert.match(handoff, /حضور منخفض/);
assert.doesNotMatch(handoff, /flag: ar \? "بانتظار قرارك"|ar: "بانتظار قرارك"/);
const disc = readFileSync(join(root, "pages/Discipline.jsx"), "utf8");
assert.doesNotMatch(disc, /\(ar \? "بانتظار قرارك" : "Your decision"\)/);
assert.match(disc, /<KpiAction/);
const ops = readFileSync(join(root, "pages/Operations.jsx"), "utf8");
assert.doesNotMatch(ops, /flag=\{employeeFace \? \(ar \? "بانتظار الاعتماد"/);

// 11. Static sweep: no KPI tile colours its big number by tone (ink only; red/gold/green live in chips).
const TILE_FILES = [
  "components/schedules/DutyTiles.jsx",
  "components/dashboard/HandoffCommandBoard.jsx",
  "components/dashboard/EmployeeDashboard.jsx",
  "components/dashboard/OperationsModuleGrid.jsx",
  "components/hr/OrgWorkforceHero.jsx",
  "components/hr/orgUi.jsx",
  "components/hr/ComplianceMhrsdBoard.jsx",
  "components/hr/ArbitrationEngineBoard.jsx",
  "components/payroll/PayrollSlipBoard.jsx",
  "components/payroll/PayrollWpsBoard.jsx",
  "components/shared/KpiStrip.jsx",
  "components/owner/ownerUi.jsx",
  "components/owner/SubscriptionRevenueSummary.jsx",
  "components/performance/PerfScoreBoard.jsx",
  "components/complaints/ComplaintQueueBoard.jsx",
  "components/requests/OtherRequestsBoard.jsx",
  "components/schedules/ScheduleStatsBar.jsx",
  "components/safety/SafetyKpiTab.jsx",
  "components/files/SigningHome.jsx",
  "components/attendance/DutyCareer.jsx",
  "pages/Complaints.jsx",
];
// A big figure (fontSize ≥ 16, mono/tabular/num) whose colour is a tone, an accent, a ternary or a status token.
const BIG = /fontSize: ?"?(1[6-9]|[2-9]\d)\b/;
const FIG = /mono|Mono|MONO|tabular|num\(|FIGURE/;
const TONE_COLOR = /color: ?(?:[\w.]+ \?|[\w]+\.(?:accent|color|tone|ink)\b|tone\b|ink\b|BAD\b|WARN\b|OK\b|ACCENT\b|DANGER\b|"var\(--nv-(?:bad|warn|ok|gold)-|"#(?:B45309|DC2626|2F6B43|F3E3BC))|num\((?!INK\)|"var\(--nv-ink\)"\))[^)]/;
const toned = [];
for (const rel of TILE_FILES) {
  const lines = readFileSync(join(root, rel), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (BIG.test(line) && FIG.test(line) && TONE_COLOR.test(line)) toned.push(`${rel}:${i + 1}`);
  });
}
assert.deepEqual(toned, [], `tone-coloured KPI numbers left: ${toned.join(", ")}`);

console.log("tiles-law: ok");
