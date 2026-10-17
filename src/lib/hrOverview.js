/**
 * «نظرة عامة» of «الموارد البشرية» — the HR decision glance. One row per thing that needs action
 * (a line, not a tile), each with the pane or file that fixes it; then «ما يحتاج قرارك اليوم» —
 * the dated items ordered by deadline. Everything is derived from the libs that already judge it:
 * complianceDerivations (documents, contracts, Nitaqat), contractLawDerivations (probation),
 * orgDesign (vacant seats, acting roles, change requests, structure health), fileReadiness (file
 * gaps on HR) and the ministry GOSI rule. Nothing here is hard-coded.
 * Pure: relative imports only.
 */
import {
  checkContractTermGate,
  collectEmployeeValidityDocs,
  collectRegisterValidityDocs,
  deriveNitaqat,
  EXPIRY_WARN_DAYS,
  localDateKey,
  nitaqatBandLabel,
} from "./complianceDerivations.js";
import { deriveProbationProgress } from "./contractLawDerivations.js";
import { activePeople, deriveOrgHealth, orgDesignOf } from "./orgDesign.js";
import { buildFileReadiness } from "./fileReadiness.js";
import { hrHref } from "./hrSection.js";

const str = (v) => String(v ?? "").trim();
const DAY = 86400000;

function addDays(day, n) {
  const [y, m, d] = String(day).slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1) + n * DAY);
  return t.toISOString().slice(0, 10);
}

function daysFrom(today, due) {
  const a = Date.parse(`${String(today).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(due).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / DAY);
}

const fileHref = (id, tab) => `/app/employees/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ""}`;

const ID_KINDS = new Set(["iqama", "national_id", "passport", "border_number"]);

function hasGosi(e) {
  return Boolean(str(e?.gosiNumber || e?.profile?.gosiNumber) || str(e?.gosiRegisteredAt || e?.profile?.gosiRegisteredAt));
}

/** The worker files this overview counts: active staff in scope (owner without a station is not a worker file). */
export function hrStaff(data, scopeIds = null) {
  return activePeople(data).filter((e) => {
    if (e.status === "terminated") return false;
    if (e.role === "owner" && !e.stationId) return false;
    if (!scopeIds) return true;
    return scopeIds.includes(str(e.stationId || e.profile?.stationId));
  });
}

/**
 * Per-file flags — the directory's status pills read the same rules as the overview rows.
 * @returns {{ expiring: boolean, contract: boolean, probation: boolean, gosi: boolean, incomplete: boolean }}
 */
export function hrEmployeeFlags(employee, { today = localDateKey(), ar = true } = {}) {
  const docs = collectEmployeeValidityDocs(employee, today);
  const gate = checkContractTermGate({ ...employee, today });
  const probation = deriveProbationProgress({ ...employee, today });
  const readiness = buildFileReadiness({ employee, view: "manager", canEditFile: true, ar, today });
  return {
    expiring: docs.length > 0,
    contract: gate.error === "CONTRACT_EXPIRED" || gate.error === "CONTRACT_END_REQUIRED" || gate.warning === "CONTRACT_EXPIRING",
    probation: probation.warning === "PROBATION_ENDING",
    gosi: !hasGosi(employee),
    incomplete: readiness.open.some((item) => item.owner === "hr"),
    readiness,
    docs,
    gate,
    probationState: probation,
  };
}

function T(ar, a, e) {
  return ar ? a : e;
}

/**
 * @param {object} data company data
 * @param {{ today?: string, ar?: boolean, scopeIds?: string[]|null, orgWrite?: boolean }} opts
 * @returns {{ rows: object[], clear: object[], decisions: object[], staff: number }}
 *   rows      — items that need action now (count > 0), in a fixed reading order
 *   clear     — the checks that came back clean (one muted line)
 *   decisions — dated items, nearest deadline first («ما يحتاج قرارك اليوم»)
 */
export function deriveHrOverview(data, { today = localDateKey(), ar = true, scopeIds = null, orgWrite = true } = {}) {
  const staff = hrStaff(data, scopeIds);
  const stationIn = (sid) => !scopeIds || scopeIds.includes(str(sid));
  const settings = orgDesignOf(data).settings;
  const decisions = [];
  const checks = [];
  const check = (row) => checks.push({ tone: "warn", ...row });

  /* 1 — iqamas and statutory documents */
  const staffIds = new Set(staff.map((e) => str(e.id)));
  const docs = collectRegisterValidityDocs({ ...data, employees: staff }, today)
    .filter((d) => !d.employeeId || staffIds.has(str(d.employeeId)) || !scopeIds);
  const expired = docs.filter((d) => d.days < 0);
  const iqamas = docs.filter((d) => d.kind === "iqama").length;
  check({
    id: "docs",
    label: T(ar, "إقامات ووثائق نظامية تنتهي", "Iqamas and statutory documents expiring"),
    count: docs.length,
    tone: expired.length ? "bad" : "warn",
    chip: expired.length ? T(ar, `${expired.length} منتهية`, `${expired.length} expired`) : "",
    note: T(
      ar,
      `خلال ${EXPIRY_WARN_DAYS} يوماً${iqamas ? ` · منها ${iqamas} إقامة` : ""} — لا إسناد بعد الانتهاء قبل التجديد.`,
      `Within ${EXPIRY_WARN_DAYS} days${iqamas ? ` · ${iqamas} iqama(s)` : ""} — no assignment after expiry until renewed.`,
    ),
    to: hrHref("people", { filter: "expiring" }),
  });
  docs.forEach((d) => {
    if (!d.employeeId) return;
    decisions.push({
      id: `doc:${d.employeeId}:${d.kind}:${d.expiryDate}`,
      kind: "doc",
      title: `${ar ? d.docLabelAr : d.docLabelEn} — ${d.name || ""}`.trim(),
      due: d.expiryDate,
      to: fileHref(d.employeeId, ID_KINDS.has(d.kind) ? "identity" : "compliance"),
    });
  });

  /* 2 — fixed-term contracts */
  let cExpired = 0;
  let cMissing = 0;
  let cExpiring = 0;
  staff.forEach((e) => {
    const gate = checkContractTermGate({ ...e, today });
    if (gate.error === "CONTRACT_EXPIRED") cExpired += 1;
    else if (gate.error === "CONTRACT_END_REQUIRED") cMissing += 1;
    else if (gate.warning === "CONTRACT_EXPIRING") cExpiring += 1;
    if (gate.endDate && (gate.error === "CONTRACT_EXPIRED" || gate.warning === "CONTRACT_EXPIRING")) {
      decisions.push({
        id: `contract:${e.id}`,
        kind: "contract",
        title: T(ar, `عقد محدد المدة — ${e.name}`, `Fixed-term contract — ${e.name}`),
        due: gate.endDate,
        to: fileHref(e.id, "contract"),
      });
    }
  });
  const contracts = cExpired + cMissing + cExpiring;
  check({
    id: "contracts",
    label: T(ar, "عقود محددة المدة تحتاج قراراً", "Fixed-term contracts needing a decision"),
    count: contracts,
    tone: cExpired || cMissing ? "bad" : "warn",
    chip: cExpired ? T(ar, `${cExpired} منتهٍ`, `${cExpired} expired`) : cMissing ? T(ar, `${cMissing} بلا نهاية`, `${cMissing} no end date`) : "",
    note: T(ar, `تجديد أو إنهاء قبل التاريخ — ينبّه قبل ${EXPIRY_WARN_DAYS} يوماً.`, `Renew or end before the date — warned ${EXPIRY_WARN_DAYS} days ahead.`),
    to: hrHref("people", { filter: "contract" }),
  });

  /* 3 — probation ending */
  let probation = 0;
  staff.forEach((e) => {
    const p = deriveProbationProgress({ ...e, today });
    if (p.warning !== "PROBATION_ENDING") return;
    probation += 1;
    decisions.push({
      id: `probation:${e.id}`,
      kind: "probation",
      title: T(ar, `نهاية التجربة — ${e.name}`, `Probation ends — ${e.name}`),
      due: addDays(today, Number(p.remaining) || 0),
      to: fileHref(e.id, "contract"),
    });
  });
  check({
    id: "probation",
    label: T(ar, "فترات تجربة تقترب من نهايتها", "Probation periods ending"),
    count: probation,
    note: T(ar, "ثبّت أو أنهِ قبل اليوم الأخير — تُحسب الأيام بلا العيدين والمرضية.", "Confirm or end before the last day — Eid and sick days excluded."),
    to: hrHref("people", { filter: "probation" }),
  });

  /* 4–6, 9 — the structure */
  const health = deriveOrgHealth(data);
  const findings = health.items.filter((i) => !i.stationId || stationIn(i.stationId));
  const vacant = findings.filter((i) => i.kind === "VACANT" && i.tone === "warn");
  const acting = findings.filter((i) => i.kind === "ACTING_OVER_LIMIT");
  const orgTo = (pane, extra = {}) => (orgWrite ? hrHref("org", { pane, ...extra }) : hrHref("org"));
  check({
    id: "vacant",
    label: T(ar, "مناصب شاغرة تجاوزت مدة التنبيه", "Vacant seats past the alert"),
    count: vacant.length,
    note: T(ar, `أكثر من ${settings.vacantAlertDays} يوماً بلا شاغل — وظّف أو جمّد المنصب.`, `Over ${settings.vacantAlertDays} days empty — hire or freeze the seat.`),
    to: orgTo("seats"),
  });
  vacant.forEach((i) => decisions.push({
    id: `vacant:${i.seatId}`,
    kind: "vacant",
    title: ar ? i.ar : i.en,
    due: addDays(today, settings.vacantAlertDays - (Number(i.days) || 0)),
    to: orgTo("seats", { seat: i.seatId }),
  }));
  check({
    id: "acting",
    label: T(ar, "تكليفات تجاوزت الحد", "Acting roles over the limit"),
    count: acting.length,
    tone: acting.length ? "bad" : "warn",
    note: T(ar, `حدّ الشركة ${settings.actingMaxDays} يوماً — ثبّت أو أنهِ التكليف.`, `Company limit ${settings.actingMaxDays} days — confirm or end the role.`),
    to: orgTo("health"),
  });
  acting.forEach((i) => decisions.push({
    id: `acting:${i.employeeId}:${i.stationId}`,
    kind: "acting",
    title: ar ? i.ar : i.en,
    due: addDays(today, settings.actingMaxDays - (Number(i.days) || 0)),
    to: orgTo("health"),
  }));

  const pending = (orgDesignOf(data).changes || []).filter((c) => c?.status === "pending");
  check({
    id: "changes",
    label: T(ar, "طلبات تغيير في الهيكل بانتظار الاعتماد", "Structure change requests awaiting approval"),
    count: pending.length,
    note: T(ar, "اعتمد أو ارفض بسبب مكتوب — تُنشر في تاريخ السريان.", "Approve or reject with a written reason — published on the effective date."),
    to: orgTo("changes"),
  });
  pending.forEach((c) => decisions.push({
    id: `change:${c.id}`,
    kind: "change",
    title: T(ar, `تغيير في الهيكل — ${str(c.title) || "بلا عنوان"}`, `Structure change — ${str(c.title) || "untitled"}`),
    due: str(c.effectiveDate).slice(0, 10) || today,
    to: orgTo("changes"),
  }));

  /* 7 — GOSI registration (the same rule as «أنظمة الوزارة — السجلات») */
  const noGosi = staff.filter((e) => !hasGosi(e)).length;
  check({
    id: "gosi",
    label: T(ar, "عاملون بلا تسجيل في التأمينات", "Workers without GOSI registration"),
    count: noGosi,
    tone: noGosi ? "bad" : "warn",
    note: T(ar, "يُسجَّل كل عامل في التأمينات الاجتماعية من المنشأة.", "The employer registers every worker with GOSI."),
    to: hrHref("people", { filter: "gosi" }),
  });

  /* 8 — files with gaps on HR */
  const gaps = staff.filter((e) => buildFileReadiness({ employee: e, view: "manager", canEditFile: true, ar, today }).open.some((item) => item.owner === "hr")).length;
  check({
    id: "files",
    label: T(ar, "ملفات تنقصها بيانات على الموارد البشرية", "Files with gaps HR must fill"),
    count: gaps,
    note: T(ar, "نسخة العقد، قوى، رقم التأمينات، الفحص الطبي، بيانات الوظيفة.", "Contract copy, Qiwa, GOSI number, medical, job data."),
    to: hrHref("people", { filter: "incomplete" }),
  });

  /* 9 — the rest of the structure health findings */
  const other = findings.filter((i) => (i.tone === "bad" || i.tone === "warn") && i.kind !== "VACANT" && i.kind !== "ACTING_OVER_LIMIT");
  check({
    id: "health",
    label: T(ar, "ملاحظات صحة الهيكل", "Structure health findings"),
    count: other.length,
    tone: other.some((i) => i.tone === "bad") ? "bad" : "warn",
    note: other[0] ? (ar ? other[0].ar : other[0].en) : T(ar, "نطاق الإشراف والطبقات والدورات في التبعية.", "Span, layers and reporting cycles."),
    to: orgTo("health"),
  });

  /* Saudization — a note, never a decision on its own */
  let nitaqat = null;
  if (staff.length) {
    const n = deriveNitaqat(staff);
    const weak = n.band === "red" || n.band === "low_green";
    nitaqat = {
      id: "nitaqat",
      label: T(ar, "التوطين (نطاقات)", "Saudization (Nitaqat)"),
      count: null,
      value: `${n.rate}%`,
      tone: weak ? "warn" : "info",
      chip: n.band === "red" ? nitaqatBandLabel(n.band, ar) : "",
      note: T(
        ar,
        `${nitaqatBandLabel(n.band, ar)} — قراءة من الملفات؛ النطاق الرسمي في منصة قوى.${n.mismatch ? ` ${n.mismatch} ملف بتعارض هوية لا يُحسب.` : ""}`,
        `${nitaqatBandLabel(n.band, ar)} — read from the files; the official band is on Qiwa.${n.mismatch ? ` ${n.mismatch} file(s) with an ID mismatch are not counted.` : ""}`,
      ),
      to: hrHref("compliance"),
    };
  }

  const rows = checks.filter((row) => row.count > 0);
  const clear = checks.filter((row) => !row.count);
  if (nitaqat) rows.push(nitaqat);

  const dated = decisions
    .map((d) => ({ ...d, days: daysFrom(today, d.due) }))
    .filter((d) => d.days != null)
    .sort((a, b) => a.days - b.days || String(a.title).localeCompare(String(b.title), "ar"));

  return { rows, clear, decisions: dated, staff: staff.length, today };
}

/** «تجاوز ٣ أيام» · «اليوم» · «خلال ٥ أيام». */
export function dueWord(days, ar = true) {
  if (days == null) return "";
  if (days === 0) return ar ? "اليوم" : "Today";
  const n = Math.abs(days);
  if (days < 0) return ar ? `متأخر ${n} يوماً` : `${n} day${n === 1 ? "" : "s"} overdue`;
  return ar ? `خلال ${n} يوماً` : `in ${n} day${n === 1 ? "" : "s"}`;
}
