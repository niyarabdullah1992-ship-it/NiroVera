import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  designSystemCatalog,
  docFrame,
  dsDegree,
  DS_ARABIC_FLOOR,
  DS_BEHAVE_RULES,
  DS_FORM_RULES,
  DS_RADIUS,
  DS_STATE_IDS,
  DS_SURFACES,
  stateChip,
} from "../src/lib/designSystem.js";
import { BAD, OK, RADIUS, WARN } from "../src/lib/platformStyles.js";

assert.equal(DS_RADIUS, 14);
assert.equal(RADIUS, 14);
assert.equal(DS_FORM_RULES.length, 6);
assert.equal(DS_BEHAVE_RULES.length, 2);
assert.equal(DS_STATE_IDS.join(","), "settled,waiting,blocked,void");
assert.equal(DS_ARABIC_FLOOR, 10);
assert.ok(DS_SURFACES.some((row) => row.href === "/app/shifts"));
assert.ok(DS_SURFACES.some((row) => row.href === "/app/requests"));
assert.ok(DS_SURFACES.some((row) => row.href === "/app/tasks"));

const catalog = designSystemCatalog({ ar: true });
assert.equal(catalog.title, "نظام التصميم");
assert.match(catalog.lede, /ما ليس هنا لا يُستحدث/);
assert.equal(catalog.form[0].ar, "الوثيقة لا اللوحة");
assert.equal(catalog.behave[0].id, "derived");
assert.equal(catalog.behave[1].id, "named");

const frame = docFrame("blocked");
assert.equal(frame.borderRadius, 14);
assert.match(String(frame.boxShadow), /nv-shadow/);
assert.match(frame.borderTop, /3px/);
assert.match(frame.borderTop, /nv-bad-fill/);

const chip = stateChip("settled");
assert.equal(chip.borderRadius, 999);
assert.equal(chip.color, "var(--nv-ok-ink)");
assert.equal(dsDegree("waiting", "soft"), "var(--nv-warn-soft)");

assert.equal(OK.background, "var(--nv-ok-soft)");
assert.equal(WARN.color, "var(--nv-warn-ink)");
assert.equal(BAD.border, "1px solid var(--nv-bad-line)");

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
assert.match(css, /\.nv-duty-circular \{\s*letter-spacing: 0;/);
assert.doesNotMatch(css, /\.nv-duty-circular\[data-glow="due"\]::before/);
assert.match(css, /--font-heading: 'Readex Pro'/);
assert.match(css, /--nv-ok-ink:/);
assert.match(css, /--nv-ink2:/);
assert.match(css, /\.nv-h/);

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /Readex\+Pro/);

const settings = readFileSync(new URL("../src/pages/CompanySettings.jsx", import.meta.url), "utf8");
assert.match(settings, /DesignSystemBoard/);

const card = readFileSync(new URL("../src/components/employees/DutyStripAlertCard.jsx", import.meta.url), "utf8");
const rail = readFileSync(new URL("../src/components/employees/ManagerDutyAlertsRail.jsx", import.meta.url), "utf8");
assert.doesNotMatch(card, /docFrame/, "person register is not a second stamped document");
assert.match(rail, /docFrame\(due \? "blocked" : "settled"\)/, "حكم المنصة is the one 14px document");
assert.match(card, /letterSpacing: 0/, "Arabic duty copy keeps letter-spacing 0 so letters join");
assert.doesNotMatch(card, /letterSpacing: ["']0\.\d+em["']/, "duty card does not track Arabic body");
assert.doesNotMatch(card, /card\.classification/, "duty register does not reprint تنبيه إداري as a stamp header");
assert.doesNotMatch(rail, /letterSpacing: ["']0\.\d+em["']/, "حكم المنصة title and lede stay at letter-spacing 0");
assert.match(css, /--nv-shadow:/);
assert.match(css, /--nv-radius: 14px/);
assert.match(css, /--nv-radius-control: 10px/);
assert.match(css, /\.nv-bg/);
assert.match(css, /\.nv-doc/);
assert.match(css, /--nv-page: #EEF1F5/);
assert.match(css, /--nv-ink: #14213D|--nv-ink: var\(--nv-navy\)/);
assert.match(css, /\.powercare-shell main\.nv-bg[\s\S]{0,280}radial-gradient/);
assert.doesNotMatch(css, /\.powercare-shell \.platform-main-scroll \{ background: transparent; \}/);
assert.match(css, /\.nv-att-card[\s\S]{0,180}var\(--nv-radius\)/);
assert.match(css, /\.nv-att-card button[\s\S]{0,80}var\(--nv-radius-control\)/);
assert.doesNotMatch(css, /\.nv-att-card,\s*\n\.nv-att-frame,\s*\n\.nv-att-tabs,\s*\n\.nv-att-kpi \{\s*\n  border-radius: 0 !important;/);

console.log("design-system: PASS");
