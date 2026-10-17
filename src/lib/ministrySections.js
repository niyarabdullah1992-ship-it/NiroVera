/**
 * «أنظمة الوزارة — ما يخص <القسم>» — one builder for every section's panel and for the
 * «الامتثال الوزاري» index. It judges nothing itself: rows come from the section's own rows lib
 * (requestsMinistryRows, payrollPanelRows, contractMinistryRows, …) and are read into one frame:
 *
 *   cards  — one per independent instrument that governs the section (نظام العمل، اللائحة التنفيذية،
 *            النموذج الموحد، 18632، 3337، التأمينات، قوى), with a one-line scope and its counters
 *   rows   — one per rule: short title, status, the pill the rows lib derived, and the ⚖ hint
 *   totals — { alert, met, info }
 *
 * Three statuses only:
 *   alert (تنبيه) — breached or at risk now, read from data
 *   met   (مستوفٍ) — the platform enforces it, or it is satisfied for this company / person
 *   info  (للعلم) — reference only; the platform cannot enforce it
 *
 * Lanes: «employee» (ما يخص الموظف — his own rights and duties) and «manage» (the company's
 * obligations). A row marked manageOnly never reaches the employee lane. Pure (node-testable).
 */
import { citeRule, explainRule, ruleValue } from "./laborRules.js";
import { articleOfficialText } from "./laborArticleTexts.js";
import { requestsMinistryRows } from "./requestsMinistryRows.js";
import { payrollPanelRows } from "./payrollMinistryRows.js";
import { contractMinistryRows } from "./contractMinistryRows.js";
import { offboardingMinistryRows } from "./offboardingMinistryRows.js";
import { voiceMinistryRows } from "./voiceMinistryRows.js";
import { safetyMinistryRows } from "./safetyMinistryRows.js";
import { complianceMinistryRows } from "./complianceMinistryRows.js";
import { disciplineLawRows } from "./disciplineBoard.js";
import { disciplineModelRows } from "./disciplineModelRows.js";
import { perfMinistryRows, perfReportsFor } from "./perfReport.js";
import { isHeatBanDate } from "./contractLawDerivations.js";
import { regulationOf } from "./workRegulation.js";
import { disciplineRuleHint } from "./rightHints.disc.js";

/* ── statuses ─────────────────────────────────────────────────────────── */

export const MINISTRY_LEVELS = ["alert", "met", "info"];

const LEVEL_OF_STATUS = {
  blocked: "alert",
  violation: "alert",
  alert: "alert",
  waiting: "alert",
  coming: "alert",
  settled: "met",
  void: "info",
};

/** A rows-lib status → one of the three levels. */
export function ministryLevel(status) {
  return LEVEL_OF_STATUS[status] || "info";
}

/** The level as the status MinistryRow / statusTone already colour. */
export function levelStatus(level) {
  if (level === "alert") return "alert";
  if (level === "met") return "settled";
  return "void";
}

export function levelLabel(level, ar = true) {
  if (level === "alert") return ar ? "تنبيه" : "Alert";
  if (level === "met") return ar ? "مستوفٍ" : "Met";
  return ar ? "للعلم" : "For reference";
}

export function ministryTotals(rows = []) {
  const list = (rows || []).filter(Boolean);
  return {
    alert: list.filter((row) => row.level === "alert").length,
    met: list.filter((row) => row.level === "met").length,
    info: list.filter((row) => row.level === "info").length,
  };
}

export function totalsTone(t = {}) {
  if (t.alert) return "warn";
  if (t.met) return "ok";
  return "mute";
}

/* ── the instruments (identified from the owner's PDFs) ───────────────── */

/** Card order — the Law first, then what was issued on it. */
export const MINISTRY_SOURCE_ORDER = ["labour", "regs", "model", "18632", "3337", "gosi", "qiwa"];

const SOURCES = {
  labour: {
    badge: ["م/51", "M/51"],
    title: ["نظام العمل", "Labour Law"],
    instrument: ["نظام العمل — المرسوم الملكي م/51 وتاريخ 1426/8/23هـ وتعديلاته حتى م/44 وتاريخ 1446/2/8هـ", "Labour Law — Royal Decree M/51 of 1426/8/23 AH, amended through M/44 of 1446/2/8 AH"],
  },
  regs: {
    badge: ["اللائحة", "Regs"],
    title: ["اللائحة التنفيذية", "Implementing Regulations"],
    instrument: ["اللائحة التنفيذية لنظام العمل وملحقاتها — القرار الوزاري 115921 وتاريخ 1446/08/19هـ", "Implementing Regulations and annexes — Ministerial Decision 115921 of 1446/08/19 AH"],
  },
  model: {
    badge: ["النموذج الموحد", "Model reg."],
    title: ["النموذج الموحد", "Model regulation"],
    instrument: ["النموذج الموحد للائحة تنظيم العمل — الملحق 1 للقرار 115921", "Unified model work-organisation regulation — Annex 1 of Decision 115921"],
  },
  18632: {
    badge: ["18632", "18632"],
    title: ["القرار 18632", "Decision 18632"],
    instrument: ["القرار الوزاري 18632 وتاريخ 1441/01/30هـ — العمل الليلي", "Ministerial Decision 18632 of 1441/01/30 AH — night work"],
  },
  3337: {
    badge: ["3337", "3337"],
    title: ["القرار 3337", "Decision 3337"],
    instrument: ["القرار الوزاري 3337 وتاريخ 1435/07/15هـ — حظر العمل المكشوف تحت الشمس", "Ministerial Decision 3337 of 1435/07/15 AH — midday sun ban"],
  },
  gosi: {
    badge: ["التأمينات", "GOSI"],
    title: ["التأمينات الاجتماعية", "Social insurance"],
    instrument: ["دليل أصحاب الأعمال — المؤسسة العامة للتأمينات الاجتماعية 1444هـ", "Employer guide — General Organization for Social Insurance, 1444 AH"],
  },
  qiwa: {
    badge: ["قوى", "Qiwa"],
    title: ["منصة قوى", "Qiwa"],
    instrument: ["ما تنقله اللائحة التنفيذية إلى منصة قوى", "What the Implementing Regulations route to Qiwa"],
  },
};

export function ministrySource(key, ar = true) {
  const s = SOURCES[key] || SOURCES.labour;
  const i = ar ? 0 : 1;
  return { key, badge: s.badge[i], title: s.title[i], instrument: s.instrument[i] };
}

/* ── citations: read from the row badge, checked against the catalogs ─── */

/** Articles the Implementing Regulations repealed (decision 115921) — never cited. */
const REGS_REPEALED = new Set(["2", "36", "37"]);
const REGS_MAX = 40;
const MODEL_MAX = 72;

/** Cites the owner excluded from every panel. */
export const EXCLUDED_CITES = ["regs:9", "regs:11", "regs:16 مكرر", "model:7", "model:13"];

const toLatin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/**
 * «م 92–93» → labour 92, 93 · «م 142 · اللائحة م29» → labour 142 + regs 29 ·
 * «النموذج الموحد م9·12·24» → model 9, 12, 24 · «اللائحة م1/2 · 17 · 27» → regs 1, 17, 27.
 * Returns [{ source, article }] ("79 مكرر" keeps its suffix).
 */
export function parseCites(badge, fallbackSource = "labour") {
  const text = toLatin(badge);
  const out = [];
  let source = fallbackSource;
  for (const seg of text.split(/[·|]/)) {
    if (/اللائحة|Regs/.test(seg)) source = "regs";
    else if (/النموذج|Model/.test(seg)) source = "model";
    if (!["labour", "regs", "model"].includes(source)) continue;
    const range = seg.match(/(\d+)\s*[–-]\s*(\d+)/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      for (let n = a; n <= b && b - a < 12; n += 1) out.push({ source, article: String(n) });
      continue;
    }
    [...seg.matchAll(/(\d+)(?:\/\d+)?(\s*(?:مكرر|bis))?/g)].forEach((m) => out.push({ source, article: `${m[1]}${m[2] ? " مكرر" : ""}` }));
  }
  return out;
}

/** Does the catalog know this article? Labour → the official text; regs → 1–40 bar the repealed; model → 1–72. */
export function citeKnown({ source, article }) {
  const base = String(article).replace(/\s*مكرر$/, "");
  const n = Number(base);
  if (source === "labour") return Boolean(articleOfficialText(String(article)));
  if (source === "regs") return Number.isInteger(n) && n >= 1 && n <= REGS_MAX && !REGS_REPEALED.has(base);
  if (source === "model") return Number.isInteger(n) && n >= 1 && n <= MODEL_MAX;
  return true;
}

export function citeExcluded({ source, article }) {
  return EXCLUDED_CITES.includes(`${source}:${String(article)}`);
}

/** The articles a card covers, read from its rows — «61، 220». Never typed on the card. */
function articleList(rows, source) {
  const seen = [];
  rows.forEach((row) => (row.cites || []).filter((c) => c.source === source).forEach((c) => {
    if (!seen.includes(c.article)) seen.push(c.article);
  }));
  return seen.sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b));
}

/** «66، 67، 68، 72، 91» → «66–68، 72، 91» — only consecutive numbers join. */
function articleRuns(arts) {
  const runs = [];
  let start = null;
  let prev = null;
  const flush = () => { if (start != null) runs.push(start === prev ? String(start) : `${start}–${prev}`); };
  for (const a of arts) {
    const n = /^\d+$/.test(a) ? Number(a) : null;
    if (n != null && prev != null && n === prev + 1) { prev = n; continue; }
    flush();
    if (n == null) { runs.push(a); start = null; prev = null; } else { start = n; prev = n; }
  }
  flush();
  return runs;
}

/** A row built from a LABOR_RULES id — badge and article come from the catalog. */
function ruleBadge(id, ar = true, onDate) {
  const labour = citeRule(id, onDate);
  if (labour) return ar ? `م ${labour.article}` : `Art. ${labour.article}`;
  const row = explainRule(id, onDate);
  if (row?.source === "gosi") return ministrySource("gosi", ar).badge;
  return (ar ? row?.labelAr : row?.labelEn) || ministrySource("labour", ar).badge;
}

function ruleText(id, ar = true, onDate) {
  const row = explainRule(id, onDate);
  return row ? (ar ? row.hintAr : row.hintEn) : "";
}

/* ── the ⚖ hint ───────────────────────────────────────────────────────── */

function lawOf(row, ar) {
  const first = (row.cites || [])[0];
  if (row.source === "18632") return { decisionId: "18632", label: ar ? "القرار 18632" : "Decision 18632" };
  if (row.source === "3337") return { decisionId: "3337", label: ar ? "القرار 3337" : "Decision 3337" };
  if (!first) return { product: true, label: ministrySource(row.source, ar).title };
  if (first.source === "model") return { model: [first.article], label: ar ? `النموذج الموحد م${first.article}` : `Model Art. ${first.article}` };
  if (first.source === "regs") return { regs: first.article, label: ar ? `اللائحة م${first.article}` : `Regs Art. ${first.article}` };
  return { article: first.article, label: ar ? `المادة ${first.article}` : `Art. ${first.article}` };
}

/** «حقك» on the employee lane, «التزامك» on management — the rule's text behind the ⚖ mark. */
function hintOf(row, lane, ar) {
  const text = String(row.hintText || "").trim();
  if (!text) return null;
  const manager = lane === "manage";
  return {
    view: manager ? "manager" : "employee",
    word: ar ? (manager ? "التزامك" : "حقك") : (manager ? "Your duty" : "Your right"),
    right: text,
    ifNot: "",
    action: null,
    law: lawOf(row, ar),
  };
}

/* ── one row in the frame ─────────────────────────────────────────────── */

function sourceOfRow(row) {
  const key = String(row.key || "");
  if (key === "labour-gosi" || key.startsWith("gosi-")) return "gosi";
  if (key.startsWith("model-")) return "model";
  if (key.startsWith("regs-")) return row.source === "qiwa" ? "qiwa" : "regs";
  if (key === "3337" || key.startsWith("3337-")) return "3337";
  if (key.startsWith("18632-")) return "18632";
  return row.source || "labour";
}

/**
 * Normalise a rows-lib row. `level` may be forced by the section (e.g. a request rule the platform
 * runs through its form is «مستوفٍ» even before anything is filed).
 */
function frameRow(raw, { lane, ar, level, pill, hint = true, hintObj = null, manageOnly = false } = {}) {
  const source = sourceOfRow(raw);
  const lvl = level || ministryLevel(raw.status);
  const cites = ["labour", "regs", "model"].includes(source) ? parseCites(raw.badge || "", source) : [];
  const row = {
    key: String(raw.key),
    source,
    badge: raw.badge || ministrySource(source, ar).badge,
    title: raw.title,
    level: lvl,
    status: levelStatus(lvl),
    pill: pill || (raw.pill === "مستوفى" ? "مستوفٍ" : raw.pill) || levelLabel(lvl, ar),
    sub: raw.sub || undefined,
    cites,
    manageOnly: Boolean(manageOnly || raw.manageOnly),
    hintText: hint ? (raw.hintText ?? raw.note ?? "") : "",
  };
  row.hint = hintObj || hintOf(row, lane, ar);
  return row;
}

/** Sum one rule over many files: alert wins (with how many), then met, else for reference. */
function acrossPeople(rowSets, ar) {
  const order = [];
  const byKey = new Map();
  for (const rows of rowSets) {
    for (const row of rows) {
      if (!byKey.has(row.key)) { byKey.set(row.key, { row, alert: 0, met: 0 }); order.push(row.key); }
      const slot = byKey.get(row.key);
      if (row.level === "alert") slot.alert += 1;
      if (row.level === "met") slot.met += 1;
    }
  }
  return order.map((key) => {
    const { row, alert, met } = byKey.get(key);
    if (alert) return { ...row, level: "alert", status: levelStatus("alert"), pill: ar ? `${alert} ملفاً` : `${alert} file(s)`, sub: undefined };
    if (met) return { ...row, level: "met", status: levelStatus("met"), pill: levelLabel("met", ar), sub: undefined };
    return { ...row, level: "info", status: levelStatus("info"), pill: levelLabel("info", ar), sub: undefined };
  });
}

const dayOf = (today) => String(today || new Date().toISOString().slice(0, 10)).slice(0, 10);

/* ── the sections ─────────────────────────────────────────────────────── */

/** Card topic per section × source — one short line; the article list is appended from the rows. */
const T = (ar, a, e) => (ar ? a : e);

const SECTIONS = {
  requests: {
    title: (ar, lane) => (lane === "manage" ? T(ar, "أنظمة الوزارة — ما يخص الطلبات", "Ministry rules — requests") : T(ar, "أنظمة الوزارة — ما يخص طلباتي", "Ministry rules — my requests")),
    anchor: "nv-ministry-requests",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — الإجازات والعقد", "Labour Law — leave and contract"), T(ar, "الإجازات، ساعة الرضاعة، الاستقالة، تغيير شروط العقد", "Leave, the nursing hour, resignation, contract changes")],
      model: (ar) => [T(ar, "النموذج الموحد — العلاج والنقل والانتداب", "Model regulation — treatment, relocation, missions"), T(ar, "أيام العلاج ونفقات النقل والانتداب", "Treatment days, relocation and mission expenses")],
      18632: (ar) => [T(ar, "القرار 18632 — العمل الليلي", "Decision 18632 — night work"), T(ar, "الموافقة الخطية والإعفاء الطبي والحمل والمسؤوليات العائلية", "Consent, medical exemption, pregnancy, family duties")],
      3337: (ar) => [T(ar, "القرار 3337 — حظر العمل المكشوف", "Decision 3337 — sun ban"), T(ar, "بلاغ عمل مكشوف وقت الحظر", "A report of exposed work in the ban hours")],
      gosi: (ar) => [T(ar, "التأمينات — إصابة العمل", "GOSI — work injury"), T(ar, "إجازة الإصابة تُعوَّض من فرع الأخطار المهنية", "Injury leave paid by the occupational-hazards branch")],
    },
    rows({ lane, ar, today, subject, people = [], liveArticle = "", liveKind = "", lang, fileMode = false }) {
      const build = (person) => requestsMinistryRows({ subject: person, liveArticle, liveKind, lang: lang || (ar ? "ar" : "en"), ar, fileMode, today });
      // A request rule runs through its form: «مستوفٍ» for the worker; management sees what awaits its decision.
      const asEmployee = (raw) => frameRow(raw, { lane, ar, level: raw.info ? "info" : "met", pill: raw.info ? undefined : raw.status === "waiting" ? T(ar, "بانتظار قرار", "Awaiting decision") : raw.status === "settled" ? T(ar, "معتمد", "Approved") : raw.live ? T(ar, "طلبك الحالي", "Your request") : T(ar, "متاح", "Available") });
      const asManager = (raw) => frameRow(raw, { lane, ar, level: raw.info ? "info" : raw.status === "waiting" ? "alert" : "met" });
      if (lane === "manage") return acrossPeople((people || []).filter(Boolean).map((p) => build(p).map(asManager)), ar);
      return build(subject).map(asEmployee);
    },
  },

  payroll: {
    title: (ar, lane) => (lane === "manage" ? T(ar, "أنظمة الوزارة — ما يخص الأجور", "Ministry rules — wages") : T(ar, "أنظمة الوزارة — ما يخص راتبي", "Ministry rules — my pay")),
    anchor: "nv-ministry-payroll",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — الأجر", "Labour Law — the wage"), T(ar, "موعد الأجر، حد الحسم، الإضافي، المكافأة", "Payday, the deduction cap, overtime, the award")],
      regs: (ar) => [T(ar, "اللائحة التنفيذية — ما يمس الأجر", "Implementing Regulations — pay"), T(ar, "العيد والإجازات، السكن والنقل، البعيد عن العمران", "Eid and leave, housing and transport, remote sites")],
      model: (ar) => [T(ar, "النموذج الموحد — الأجر وما يُسترد معه", "Model regulation — the wage and refunds"), T(ar, "الأجر الأساسي والفعلي، النقل والانتداب، أجر المنع", "Basic and actual wage, relocation and missions, prevented days")],
      gosi: (ar) => [T(ar, "التأمينات — الاشتراك", "GOSI — contributions"), T(ar, "رقم المشترك قبل الملف الشهري، وإبلاغ تغيّر الأجر", "A subscriber number before the monthly file; wage changes reported")],
    },
    rows({ lane, ar, today, data, month, items = [], employeeForItem = null }) {
      const self = lane !== "manage";
      const list = payrollPanelRows({ data, month, items, employeeForItem, self, today, ar })
        .filter((raw) => !(self && raw.key === "regs-30" && raw.status === "void"))
        .map((raw) => frameRow(raw, { lane, ar, manageOnly: raw.key === "labour-90" || raw.key === "labour-92" }));
      const lines = (items || []).filter(Boolean);
      const personOf = (line) => (typeof employeeForItem === "function" ? employeeForItem(line) : null)
        || (data?.employees || []).find((row) => String(row.id) === String(line?.employeeId)) || null;
      const numberOf = (line) => String(line?.gosiNumber || personOf(line)?.gosiNumber || personOf(line)?.profile?.gosiNumber || "").trim();
      const missing = lines.filter((line) => !numberOf(line)).length;
      list.push(frameRow({
        key: "gosi-number",
        badge: ruleBadge("gosi.register.cite", ar, today),
        title: self ? T(ar, "رقمك في التأمينات على المسير", "Your GOSI number on the run") : T(ar, "رقم تأمينات لكل مشترك قبل الملف الشهري", "A GOSI number for every subscriber before the monthly file"),
        note: ruleText("gosi.register.cite", ar, today),
        status: !lines.length ? "void" : missing ? "alert" : "settled",
        pill: !lines.length ? T(ar, "لا مسير", "No run") : missing ? (self ? T(ar, "غير مسجّل", "Not recorded") : T(ar, `${missing} بلا رقم`, `${missing} missing`)) : undefined,
      }, { lane, ar }));
      if (!self) {
        list.push(frameRow({
          key: "gosi-wage-change",
          badge: ruleBadge("gosi.wageChange.cite", ar, today),
          title: T(ar, "إبلاغ التأمينات فوراً بأي تغيّر في الأجر", "Report any wage change to GOSI at once"),
          note: ruleText("gosi.wageChange.cite", ar, today),
          status: "void",
        }, { lane, ar, manageOnly: true }));
      }
      return list;
    },
  },

  contract: {
    title: (ar) => T(ar, "أنظمة الوزارة — ما يخص العقد", "Ministry rules — the contract"),
    anchor: "nv-ministry-contract",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — نوع العقد", "Labour Law — contract type"), T(ar, "تحوّل المحدد المدة إلى غير محدد", "A fixed term turning open-ended")],
      regs: (ar) => [T(ar, "اللائحة التنفيذية — العقد", "Implementing Regulations — the contract"), T(ar, "المؤقت، عقد غير السعودي، أجير، مكان العمل، المحاكم", "Temporary work, non-Saudi contracts, Ajeer, workplace, courts")],
      gosi: (ar) => [T(ar, "التأمينات — التسجيل", "GOSI — registration"), T(ar, "التسجيل بنهاية شهر الالتحاق", "Registered by the end of the joining month")],
    },
    rows({ lane, ar, today, employee }) {
      const list = contractMinistryRows(employee || {}, { today, ar }).map((raw) => frameRow(raw, { lane, ar }));
      const person = employee || {};
      const number = String(person.gosiNumber || person.profile?.gosiNumber || "").trim();
      const since = String(person.gosiRegisteredAt || person.profile?.gosiRegisteredAt || "").slice(0, 10);
      const hired = String(person.hireDate || person.profile?.hireDate || "").slice(0, 10);
      const due = (() => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(hired)) return "";
        const d = new Date(`${hired}T00:00:00Z`);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      })();
      const late = !number && !since && due && dayOf(today) > due;
      list.push(frameRow({
        key: "gosi-register",
        badge: ruleBadge("gosi.register.cite", ar, today),
        title: T(ar, "التسجيل في التأمينات بنهاية شهر الالتحاق", "Registered with GOSI by the end of the joining month"),
        note: ruleText("gosi.register.cite", ar, today),
        status: number || since ? "settled" : late ? "alert" : due ? "waiting" : "void",
        pill: number || since ? (since ? T(ar, `مسجّل ${since}`, `Registered ${since}`) : T(ar, "مسجّل", "Registered")) : late ? T(ar, `فاتت المهلة ${due}`, `Past ${due}`) : due ? T(ar, `حتى ${due}`, `By ${due}`) : T(ar, "تاريخ المباشرة غير مسجّل", "No start date"),
      }, { lane, ar }));
      return list;
    },
  },

  offboarding: {
    title: (ar) => T(ar, "أنظمة الوزارة — ما يخص نهاية الخدمة", "Ministry rules — the end of service"),
    anchor: "nv-ministry-offboarding",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — نهاية الخدمة", "Labour Law — the end of service"), T(ar, "الإشعار، المكافأة، الشهادة والوثائق، التصفية", "Notice, the award, certificate and documents, settlement")],
      regs: (ar) => [T(ar, "اللائحة التنفيذية — الإجازة التعويضية", "Implementing Regulations — comp leave"), T(ar, "صرف ما بقي منها عند ترك العمل", "Paid out on leaving")],
      model: (ar) => [T(ar, "النموذج الموحد — انتهاء العقد والعودة", "Model regulation — the end and the return"), T(ar, "حالات الانتهاء وتذكرة العودة", "How a contract ends and the return ticket")],
      gosi: (ar) => [T(ar, "التأمينات — الاستبعاد", "GOSI — removal"), T(ar, "الاستبعاد بنهاية شهر ترك العمل", "Removed by the end of the leaving month")],
    },
    rows({ lane, ar, today, employee, caseRow = null, eos = null, comp = null }) {
      const list = offboardingMinistryRows({ employee: employee || {}, caseRow, eos, comp, today, ar }).map((raw) => frameRow(raw, { lane, ar }));
      if (lane === "manage") {
        list.push(frameRow({
          key: "gosi-exclude",
          badge: ruleBadge("gosi.exclude.cite", ar, today),
          title: T(ar, "استبعاد المشترك من التأمينات بنهاية شهر تركه العمل", "Remove the subscriber from GOSI by the end of the leaving month"),
          note: ruleText("gosi.exclude.cite", ar, today),
          status: "void",
        }, { lane, ar, manageOnly: true }));
      }
      return list;
    },
  },

  discipline: {
    title: (ar, lane) => (lane === "manage" ? T(ar, "أنظمة الوزارة — ما يخص الجزاءات", "Ministry rules — sanctions") : T(ar, "أنظمة الوزارة — ما يخص الجزاء عليّ", "Ministry rules — sanctions on me")),
    anchor: "nv-ministry-discipline",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — الجزاءات", "Labour Law — sanctions"), T(ar, "قائمة الجزاءات، الإجراء، المهل، السقوف، الاعتراض", "The list, the procedure, the windows, the caps, objection")],
      model: (ar) => [T(ar, "النموذج الموحد — الواجبات والتظلم", "Model regulation — duties and grievance"), T(ar, "الواجبات، الزي، صحيفة الجزاءات، التظلم", "Duties, uniform, the penalties record, grievance")],
    },
    rows({ lane, ar, today, cases = [], employees = [], uniform = null }) {
      const list = [];
      if (lane === "manage") {
        disciplineLawRows({ cases, employees, ar, today }).forEach((raw) => {
          list.push(frameRow({ key: raw.key, source: "labour", badge: ar ? `م ${raw.art}` : `Art. ${raw.art}`, title: raw.head, note: raw.applied, status: raw.status, pill: raw.tag }, { lane, ar }));
        });
      } else {
        DISCIPLINE_RIGHTS.forEach((right) => {
          const cite = citeRule(right.ruleId, today);
          const court = right.ruleId === "discipline.decision.days";
          list.push(frameRow({
            key: right.ruleId,
            source: "labour",
            badge: cite ? (ar ? `م ${cite.article}` : `Art. ${cite.article}`) : ministrySource("labour", ar).badge,
            title: ar ? right.ar : right.en,
            status: court ? "void" : "settled",
            pill: court ? undefined : T(ar, "تطبّقه المنصة", "Enforced"),
          }, { lane, ar, hintObj: disciplineRuleHint(right.ruleId, ar ? right.ar : right.en, { view: "employee", ar, today }) }));
        });
        // Art. 91 — the damage objection lives in الجزاءات (owner's placement).
        const damage = citeRule("payroll.damage.objectionWorkingDays", today);
        if (damage) {
          list.push(frameRow({
            key: "payroll.damage.objectionWorkingDays",
            source: "labour",
            badge: ar ? `م ${damage.article}` : `Art. ${damage.article}`,
            title: T(ar, `الاعتراض على خصم الإتلاف خلال ${damage.value} يوم عمل`, `Object to a damage deduction within ${damage.value} working days`),
            note: ar ? damage.hintAr : damage.hintEn,
            status: "settled",
            pill: T(ar, "تطبّقه المنصة", "Enforced"),
          }, { lane, ar }));
        }
      }
      disciplineModelRows({ uniform, employees, manage: lane === "manage", ar }).forEach((raw) => list.push(frameRow(raw, { lane, ar })));
      return list.sort((a, b) => (a.source === b.source ? 0 : a.source === "labour" ? -1 : 1)
        || ((parseInt(a.cites?.[0]?.article, 10) || 999) - (parseInt(b.cites?.[0]?.article, 10) || 999)));
    },
  },

  voice: {
    title: (ar) => T(ar, "أنظمة الوزارة — ما يخص صوت الموظف", "Ministry rules — the employee voice"),
    anchor: "nv-ministry-voice",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — الكرامة", "Labour Law — dignity"), T(ar, "حسن المعاملة وبطلان الانتقام", "Decent treatment, no reprisal")],
      regs: (ar) => [T(ar, "لائحة تنظيم العمل — قناة الصوت", "Work regulation — the voice channel"), T(ar, "المهلة، التصعيد تلقائياً، والقرار المكتوب قبل الإغلاق", "The window, automatic escalation, a written ruling")],
      model: (ar) => [T(ar, "النموذج الموحد — التحرش والإيذاء والتقاضي", "Model regulation — abuse and recourse"), T(ar, "الشكوى خلال خمسة أيام عمل، لجنة تحقق، السرية، ثم المحكمة", "Complaint in five working days, a committee, confidentiality, then court")],
    },
    rows({ lane, ar, today, breached = 0, abuseCases = [], calendar }) {
      return voiceMinistryRows({ breached, abuseCases, calendar, today, ar }).map((raw) => frameRow(raw, { lane, ar }));
    },
  },

  performance: {
    title: (ar, lane) => (lane === "manage" ? T(ar, "أنظمة الوزارة — ما يخص الأداء", "Ministry rules — performance") : T(ar, "أنظمة الوزارة — ما يخص أدائي", "Ministry rules — my performance")),
    anchor: "nv-ministry-performance",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — المعاملة والفصل", "Labour Law — treatment and dismissal"), T(ar, "معاملة واحدة، والدرجة وحدها ليست سبباً للفصل", "Equal treatment; a score alone is no ground to dismiss")],
      model: (ar) => [T(ar, "النموذج الموحد — التقرير والعلاوة والترقية", "Model regulation — report, increment, promotion"), T(ar, "تقرير سنوي بخمسة مستويات، صورة وتظلم، علاوة وترقية", "A yearly five-level report, a copy and grievance, increments and promotion")],
    },
    rows({ lane, ar, today, employee = null, reports = null, perf = null, people = [], notes = {}, quality = null, objections = [] }) {
      const one = (person, own) => perfMinistryRows({
        reports: own || perfReportsFor({ cycles: perf?.cycles || [], ratings: perf?.ratings || [], employeeId: person?.id }),
        hireDate: person?.hireDate || person?.profile?.hireDate,
        lastIncrementAt: person?.profile?.lastIncrementAt,
        today,
        ar,
        notes,
        quality: own ? quality : null,
        objections: own ? objections : [],
      }).map((raw) => frameRow(raw, { lane, ar }));
      const list = lane === "manage"
        ? acrossPeople((people || []).filter(Boolean).map((p) => one(p, null)), ar)
        : one(employee, reports || []);
      ["employer.nonDiscrimination.cite", "eos.art80.cite"].forEach((id) => {
        const cite = citeRule(id, today);
        if (!cite) return;
        list.push(frameRow({
          key: id,
          source: "labour",
          badge: ar ? `م ${cite.article}` : `Art. ${cite.article}`,
          title: id === "eos.art80.cite"
            ? T(ar, "الدرجة وحدها لا تكون سبباً للفصل دون مكافأة", "A score alone is no ground for dismissal without the award")
            : T(ar, "معاملة واحدة وأوزان واحدة لمن في الوظيفة نفسها", "Equal treatment and the same weights for the same job"),
          note: ar ? cite.hintAr : cite.hintEn,
          // The score and its weights are computed one way for everyone — the platform holds Art. 61;
          // Art. 80 is a court question: for reference.
          status: id === "eos.art80.cite" ? "void" : "settled",
        }, { lane, ar }));
      });
      return list;
    },
  },

  safety: {
    title: (ar, lane) => (lane === "manage" ? T(ar, "أنظمة الوزارة — ما يخص السلامة", "Ministry rules — safety") : T(ar, "أنظمة الوزارة — ما يخص سلامتي", "Ministry rules — my safety")),
    anchor: "nv-ministry-safety",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — السلامة والصحة المهنية", "Labour Law — occupational safety"), T(ar, "الحماية من الأخطار، الإسعافات، إصابة العمل", "Protection from hazards, first aid, work injury")],
      regs: (ar) => [T(ar, "اللائحة التنفيذية — المواقع", "Implementing Regulations — sites"), T(ar, "الأماكن البعيدة عن العمران", "Sites far from towns")],
      3337: (ar) => [T(ar, "القرار 3337 — حظر العمل المكشوف", "Decision 3337 — sun ban"), T(ar, "لا عمل مكشوف ظهراً في الصيف", "No exposed work at midday in summer")],
      gosi: (ar) => [T(ar, "التأمينات — الأخطار المهنية", "GOSI — occupational hazards"), T(ar, "إبلاغ الإصابة خلال عشرة أيام", "Injuries reported within ten days")],
    },
    rows({ lane, ar, today, facts = {} }) {
      const day = dayOf(today);
      const inSeason = isHeatBanDate(day);
      const injuryDays = (() => { try { return ruleValue("gosi.injury.reportDays", day); } catch { return 10; } })();
      if (lane !== "manage") {
        // The worker's lane: his protections, none of the company's open findings.
        return [
          frameRow({ key: "labour-122", source: "labour", badge: ruleBadge("safety.precautions.cite", ar, day), title: T(ar, "الحماية من أخطار العمل ووسائل الوقاية", "Protection from work hazards and protective gear"), note: ruleText("safety.precautions.cite", ar, day), status: "void" }, { lane, ar }),
          frameRow({ key: "labour-142", source: "labour", badge: ruleBadge("safety.firstAid.cite", ar, day), title: T(ar, "خزانة إسعافات أولية في مكان العمل", "A first-aid cabinet at work"), note: ruleText("safety.firstAid.cite", ar, day), status: "void" }, { lane, ar }),
          frameRow({ key: "3337", badge: "3337", title: T(ar, "لا عمل مكشوف 12:00–15:00 من 15 يونيو إلى 15 سبتمبر", "No exposed work 12:00–15:00, 15 June – 15 September"), note: T(ar, "إن كُلّفت بعمل مكشوف وقت الحظر فارفع بلاغاً من طلباتي.", "If assigned exposed work in the ban hours, file a report from My requests."), status: inSeason ? "settled" : "void", pill: inSeason ? T(ar, "الإنجاز الميداني موقوف وقت الحظر", "Field completion blocked in the ban hours") : T(ar, "خارج الموسم", "Off season") }, { lane, ar }),
          frameRow({ key: "gosi-injury", badge: ruleBadge("gosi.injury.reportDays", ar, day), title: T(ar, `إصابتك تُبلَّغ للتأمينات خلال ${injuryDays} أيام`, `Your injury is reported to GOSI within ${injuryDays} days`), note: ruleText("gosi.injury.reportDays", ar, day), status: "void" }, { lane, ar }),
        ];
      }
      const list = safetyMinistryRows(facts || {}, { ar, onDate: day })
        // ISO 45001 is a management standard, not a ministry rule — it stays in the risk register.
        .filter((raw) => !raw.key.startsWith("iso-"))
        .map((raw) => {
          if (raw.key === "regs-30") {
            const unknown = Number(facts?.siteUnknown) || 0;
            const remote = Number(facts?.remoteCount) || 0;
            const status = !facts?.stationCount ? "void" : unknown ? "alert" : "settled";
            return frameRow({ ...raw, status, pill: unknown ? raw.pill : remote ? T(ar, `${remote} فرع بعيد — 146 و147`, `${remote} remote — Arts. 146, 147`) : raw.pill }, { lane, ar });
          }
          if (raw.key === "3337") {
            // The roster and the field gates enforce the ban; the season alone is no breach.
            return frameRow({ ...raw, status: inSeason ? "settled" : "void", pill: inSeason ? T(ar, "الموسم قائم — الجدول والإنجاز الميداني يمنعانه", "In season — the roster and field gates block it") : T(ar, "خارج الموسم", "Off season") }, { lane, ar });
          }
          if (raw.key === "labour-141") {
            return frameRow({ ...raw, status: facts?.injuryOpen ? "alert" : facts?.stationCount ? "settled" : "void", pill: facts?.injuryOpen ? raw.pill : T(ar, "لا إصابة مفتوحة", "No open injury") }, { lane, ar });
          }
          return frameRow(raw, { lane, ar });
        });
      list.push(frameRow({
        key: "gosi-injury",
        badge: ruleBadge("gosi.injury.reportDays", ar, day),
        title: T(ar, `إبلاغ التأمينات عن إصابة العمل خلال ${injuryDays} أيام`, `Report a work injury to GOSI within ${injuryDays} days`),
        note: ruleText("gosi.injury.reportDays", ar, day),
        status: facts?.injuryOpen ? "alert" : facts?.stationCount ? "settled" : "void",
        pill: facts?.injuryOpen ? T(ar, "إصابة مفتوحة — بلّغ", "Open injury — report it") : undefined,
      }, { lane, ar }));
      return list;
    },
  },

  records: {
    title: (ar) => T(ar, "أنظمة الوزارة — ما يخص السجلات والتدريب", "Ministry rules — registers and training"),
    anchor: "nv-ministry-compliance",
    cards: {
      regs: (ar) => [T(ar, "اللائحة التنفيذية — السجلات والتدريب", "Implementing Regulations — registers and training"), T(ar, "بيانات المنشأة، السجلات، الوثائق، التدريب", "Establishment data, registers, documents, training")],
      qiwa: (ar) => [T(ar, "ما يُدار عبر منصة قوى", "Handled on Qiwa"), T(ar, "التوظيف والتوطين والتراخيص والاستقدام", "Employment, Saudization, licences, recruitment")],
      gosi: (ar) => [T(ar, "التأمينات — تسجيل المشتركين", "GOSI — registering subscribers"), T(ar, "رقم تأمينات لكل عامل", "A GOSI number for every worker")],
    },
    rows({ lane, ar, today, data = {} }) {
      const list = complianceMinistryRows(data || {}, { today, ar }).map((raw) => frameRow(raw, { lane, ar, manageOnly: true }));
      const staff = (data?.employees || []).filter((p) => p && p.status !== "terminated" && p.active !== false);
      const missing = staff.filter((p) => !String(p.gosiNumber || p.profile?.gosiNumber || "").trim() && !String(p.gosiRegisteredAt || p.profile?.gosiRegisteredAt || "").trim()).length;
      list.push(frameRow({
        key: "gosi-register",
        badge: ruleBadge("gosi.register.cite", ar, today),
        title: T(ar, "كل عامل مسجّل في التأمينات", "Every worker registered with GOSI"),
        note: ruleText("gosi.register.cite", ar, today),
        status: !staff.length ? "void" : missing ? "alert" : "settled",
        pill: missing ? T(ar, `${missing} بلا رقم تأمينات`, `${missing} without a GOSI number`) : undefined,
      }, { lane, ar, manageOnly: true }));
      return list;
    },
  },

  org: {
    title: (ar) => T(ar, "أنظمة الوزارة — ما يخص الهيكل", "Ministry rules — the organisation"),
    anchor: "nv-ministry-org",
    cards: {
      labour: (ar) => [T(ar, "نظام العمل — لائحة تنظيم العمل", "Labour Law — the work regulation"), T(ar, "إعلانها في مكان ظاهر", "Announced where workers see it")],
      regs: (ar) => [T(ar, "اللائحة التنفيذية — اعتماد اللائحة", "Implementing Regulations — approving it"), T(ar, "لائحة خاصة مصدّقة، أو النموذج الموحد لمن دون خمسين عاملاً", "An own certified regulation, or the model under fifty workers")],
      model: (ar) => [T(ar, "النموذج الموحد — السلم الوظيفي", "Model regulation — the job ladder"), T(ar, "مسميات الوظائف ودرجاتها وشروط شغلها", "Job titles, grades and requirements")],
    },
    rows({ lane, ar, today, data = {} }) {
      const reg = regulationOf(data || {});
      const own = reg?.source === "own";
      const headcount = (data?.employees || []).filter((p) => p && p.status !== "terminated" && p.active !== false).length;
      const needsOwn = !own && headcount >= 50;
      const grades = (data?.jobGrades || []).filter(Boolean).length;
      return [
        frameRow({ key: "workRegulation.announce.cite", source: "labour", badge: ruleBadge("workRegulation.announce.cite", ar, today), title: T(ar, "لائحة تنظيم العمل معلنة للعاملين", "The work regulation announced to the workers"), note: ruleText("workRegulation.announce.cite", ar, today), status: "settled", pill: T(ar, "منشورة في «لائحة الجزاءات»", "Published under the sanctions list") }, { lane, ar }),
        frameRow({ key: "regs-4", source: "regs", badge: ar ? "اللائحة م3 · 4" : "Regs Arts. 3 · 4", title: T(ar, "لائحة خاصة مصدّقة، أو النموذج الموحد لمن يقل عماله عن خمسين", "An own certified regulation, or the model under fifty workers"), note: T(ar, "اللائحة الخاصة تُراجَع وتُصدَّق من مكتب محاماة معتمد ثم تُرفع للوزارة؛ ويجوز لمن يقل عماله عن خمسين اختيار النموذج الموحد إلكترونياً دون تعديل.", "An own regulation is reviewed and certified by an accredited law firm, then filed; under fifty workers may adopt the model online unchanged."), status: needsOwn ? "alert" : "settled", pill: own ? T(ar, `لائحة خاصة${reg.approvalNo ? ` · ${reg.approvalNo}` : ""}`, "Own regulation") : needsOwn ? T(ar, `${headcount} عاملاً — يلزم لائحة خاصة`, `${headcount} workers — an own regulation is due`) : T(ar, "النموذج الموحد", "The model regulation") }, { lane, ar, manageOnly: true }),
        frameRow({ key: "model-22", source: "model", badge: ar ? "النموذج الموحد م22" : "Model Art. 22", title: T(ar, "سلم وظيفي بمسميات التصنيف السعودي ودرجاتها وشروط شغلها", "A job ladder on the Saudi classification, with grades and requirements"), note: T(ar, "تضع المنشأة سلماً وظيفياً تحدد فيه عدد الوظائف ومسمياتها ودرجة كل وظيفة وشروط شغلها وبداية أجرها.", "The establishment sets a job ladder: the jobs, their titles, grades, requirements and starting wage."), status: grades ? "settled" : "alert", pill: grades ? T(ar, `${grades} درجات في السلم`, `${grades} grades on the ladder`) : T(ar, "لا سلم وظيفي مسجّل", "No job ladder recorded") }, { lane, ar, manageOnly: true }),
      ];
    },
  },

  tasks: {
    title: (ar) => T(ar, "أنظمة الوزارة — ما يخص المهام", "Ministry rules — tasks"),
    anchor: "nv-ministry-tasks",
    cards: {
      3337: (ar) => [T(ar, "القرار 3337 — حظر العمل المكشوف", "Decision 3337 — sun ban"), T(ar, "الإنجاز الميداني وإثبات العمل المكشوف وقت الحظر", "Field completion and open-air proof in the ban hours")],
    },
    rows({ lane, ar, today }) {
      const inSeason = isHeatBanDate(dayOf(today));
      const status = inSeason ? "settled" : "void";
      return [
        frameRow({ key: "3337-field", badge: "3337", title: T(ar, "لا يُسجَّل إنجاز ميداني 12:00–15:00 في الموسم", "No field completion logged 12:00–15:00 in season"), note: T(ar, "الإسناد جائز، والتنفيذ الميداني خارج النافذة؛ تسجيل الإنجاز داخلها يُرفض.", "Assigning is allowed; field work runs outside the window, and a completion inside it is refused."), status, pill: inSeason ? T(ar, "تطبّقه المنصة", "Enforced") : T(ar, "خارج الموسم", "Off season") }, { lane, ar }),
        frameRow({ key: "3337-proof", badge: "3337", title: T(ar, "لا يُفتح إثبات عمل في الهواء الطلق وقت الحظر", "No open-air work proof in the ban hours"), note: T(ar, "يُفتح الإثبات بعد نهاية النافذة، أو يُختار العمل داخل المنشأة.", "Open it after the window ends, or state the work is indoors."), status, pill: inSeason ? T(ar, "تطبّقه المنصة", "Enforced") : T(ar, "خارج الموسم", "Off season") }, { lane, ar }),
      ];
    },
  },
};

/** Grievance rights on a sanction — the rule ids come from the catalog; the text is the worker's. */
export const DISCIPLINE_RIGHTS = [
  { ruleId: "discipline.penalties.cite", ar: "لا يُوقَّع عليّ إلا جزاء من قائمة الجزاءات.", en: "Only a listed penalty may be signed on me." },
  { ruleId: "discipline.hearing.cite", ar: "لا جزاء قبل إبلاغي كتابةً وسماع أقوالي في محضر.", en: "No sanction before written notice and a hearing in minutes." },
  { ruleId: "discipline.charge.maxDays", ar: "لا اتهام بعد 30 يوماً من كشف المخالفة، ولا جزاء بعد 30 يوماً من انتهاء التحقيق.", en: "No charge 30 days after discovery, no sanction 30 days after the inquiry." },
  { ruleId: "discipline.fine.maxDays", ar: "جزاء واحد للفعل، ولا غرامات أو إيقاف فوق خمسة أيام في الشهر.", en: "One penalty per act; fines or suspension never over five days a month." },
  { ruleId: "discipline.workplace.cite", ar: "لا جزاء على أمر خارج العمل إلا إن اتصل بالعمل أو بصاحبه أو بمديري.", en: "Nothing outside work unless it touches the work, the employer or my manager." },
  { ruleId: "discipline.listedOnly.cite", ar: "لا جزاء غير وارد في النظام أو في لائحة تنظيم العمل.", en: "No penalty outside the Law or the work regulation." },
  { ruleId: "discipline.repeat.cooloffDays", ar: "لا تشديد عند التكرار بعد 180 يوماً من إبلاغ الجزاء السابق.", en: "No harsher repeat 180 days after the previous notice." },
  { ruleId: "discipline.appeal.internalDays", ar: "أتظلّم كتابةً خلال 30 يوماً عدا العطل الرسمية.", en: "I grieve in writing within 30 days, holidays aside." },
  { ruleId: "discipline.decision.days", ar: "إن رُفض تظلّمي أو لم يُبتّ فيه خلال 15 يوماً فلي المحكمة العمالية خلال 30 يوماً.", en: "If refused or unanswered in 15 days, the labour court within 30 days." },
];

export const MINISTRY_SECTION_KEYS = Object.keys(SECTIONS);

/** Sections with an employee lane — records and org are the establishment's alone. */
export const MINISTRY_EMPLOYEE_SECTIONS = MINISTRY_SECTION_KEYS.filter((key) => !["records", "org"].includes(key));

/**
 * The one builder. `inputs` are the section's own (see each section's rows()).
 * Returns { key, lane, title, anchor, cards, rows, totals }.
 */
export function buildMinistrySection(key, { lane = "employee", ar = true, today, ...inputs } = {}) {
  const def = SECTIONS[key];
  if (!def) throw new Error(`MINISTRY_SECTION_UNKNOWN:${key}`);
  const side = lane === "manage" ? "manage" : "employee";
  const day = dayOf(today);
  let rows = def.rows({ lane: side, ar, today: day, ...inputs }) || [];
  if (side === "employee") rows = rows.filter((row) => !row.manageOnly);
  // Never cite what the owner excluded, or an article the catalog does not know.
  rows = rows.filter((row) => !(row.cites || []).some(citeExcluded));
  const cards = MINISTRY_SOURCE_ORDER
    .filter((source) => rows.some((row) => row.source === source))
    .map((source) => {
      const own = rows.filter((row) => row.source === source);
      const counts = ministryTotals(own);
      const src = ministrySource(source, ar);
      const [title, topic] = def.cards?.[source]?.(ar) || [src.title, ""];
      const arts = articleList(own, source);
      const runs = articleRuns(arts);
      const list = runs.length > 6 ? (ar ? `${arts.length} مادة` : `${arts.length} articles`) : runs.join(ar ? "، " : ", ");
      const scope = arts.length ? `${topic}${topic ? " · " : ""}${runs.length > 6 ? "" : (ar ? "م " : "Art. ")}${list}` : topic;
      return { key: source, badge: src.badge, title, scope, instrument: src.instrument, counts, tone: totalsTone(counts) };
    });
  return {
    key,
    lane: side,
    title: def.title(ar, side),
    anchor: def.anchor,
    cards,
    rows,
    totals: ministryTotals(rows),
  };
}

/** Index counts for one section — the totals of its panel (so the index never reads rows twice). */
export function ministrySectionCounts(key, options = {}) {
  return buildMinistrySection(key, options).totals;
}
