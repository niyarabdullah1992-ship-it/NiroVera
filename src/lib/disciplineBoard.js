import {
  buildDisciplineRegister,
  employeeContractWage,
  checkAdvanceDisciplineGate,
  checkDisciplineRepeatGate,
  checkDisciplineDoubleFileGate,
  checkSignDisciplineGate,
  disciplineEvidenceList,
  disciplineAppealNote,
  isSimpleOralOffence,
  flattenListedPenalties,
  listedPenaltyLabel,
  resolvePenaltyKind,
  monthCapDaysByKind,
} from "./disciplineDerivations.js";
import { citeRule, ruleValue } from "./laborRules.js";

export const FACE_STAGES = [
  { id: "notified", num: "01", ar: "أُبلغ كتابةً", en: "Notified in writing", shortAr: "أُبلغ", shortEn: "Notified", live: ["incident", "notice"] },
  { id: "defence", num: "02", ar: "سُمع دفاعه", en: "Defence heard", shortAr: "سُمع دفاعه", shortEn: "Heard", live: ["hearing"] },
  { id: "signed", num: "03", ar: "وُقّع", en: "Signed", shortAr: "وُقّع", shortEn: "Signed", live: ["decision", "notify"] },
  { id: "objected", num: "04", ar: "اعترض", en: "Objected", shortAr: "اعترض", shortEn: "Objected", live: ["appeal"] },
  { id: "closed", num: "05", ar: "أُغلق", en: "Closed", shortAr: "أُغلق", shortEn: "Closed", live: ["ruling", "closed"] },
];

export const PENALTIES = flattenListedPenalties();

const OPEN_FACES = new Set(["notified", "defence", "objected"]);
const IMPOSED_FACES = new Set(["signed", "objected", "closed"]);

const TONE = {
  notified: { color: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)", accent: "var(--nv-warn-fill)" },
  defence: { color: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", border: "var(--nv-warn-line)", accent: "var(--nv-warn-fill)" },
  signed: { color: "var(--nv-ink)", bg: "var(--nv-mute-soft)", border: "var(--nv-mute-line)", accent: "var(--nv-ink2)" },
  objected: { color: "var(--nv-bad-ink)", bg: "var(--nv-bad-soft)", border: "var(--nv-bad-line)", accent: "var(--nv-bad-fill)" },
  closed: { color: "var(--nv-ok-ink)", bg: "var(--nv-ok-soft)", border: "var(--nv-ok-line)", accent: "var(--nv-ok-fill)" },
};

function dateOnly(iso) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function daysBetween(from, to) {
  const a = dateOnly(from);
  const b = dateOnly(to);
  if (!a || !b) return null;
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
}

function todayRiyadh() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}

export function money(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

export function countAr(n, one, two, few, many, zero) {
  if (n === 0) return zero || "لا شيء";
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function fmtDisciplineDate(iso, ar = true) {
  const s = dateOnly(iso);
  if (!s) return "—";
  const months = ar
    ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = Number(s.slice(8, 10));
  const month = months[Number(s.slice(5, 7)) - 1];
  const year = s.slice(0, 4);
  return ar ? `${day} ${month} ${year}` : `${day} ${month} ${year}`;
}

export function faceOf(status) {
  return FACE_STAGES.find((row) => row.live.includes(String(status || ""))) || FACE_STAGES[0];
}

export function cutDaysOf(item) {
  const days = Number(item?.cutDays || item?.fineDays || 0);
  if (days > 0) return days;
  return 0;
}

export function penaltyLabel(item, ar = true) {
  const kind = resolvePenaltyKind(item);
  if (item?.penaltyKind || item?.penaltyId) return listedPenaltyLabel(kind, cutDaysOf(item), ar);
  if (item?.penalty) return item.penalty;
  if (kind && kind !== "warning") return listedPenaltyLabel(kind, cutDaysOf(item), ar);
  const days = cutDaysOf(item);
  if (days === 1) return ar ? "غرامة أجر يوم" : "Fine of one day's wage";
  if (days === 2) return ar ? "غرامة أجر يومين" : "Fine of two days' wage";
  if (days >= 3) return ar ? `غرامة أجر ${days} أيام` : `Fine of ${days} days' wage`;
  const fine = item?.fineAmount ?? item?.penaltyAmount ?? item?.fine;
  if (fine != null && fine !== "") return ar ? `غرامة ${fine}` : `Fine ${fine}`;
  return ar ? "إنذار" : "Warning";
}

export function cutAmount(item, wage) {
  const days = cutDaysOf(item);
  if (days > 0 && wage > 0) return (days * wage) / 30;
  const fine = Number(item?.fineAmount ?? item?.penaltyAmount ?? item?.fine);
  return Number.isFinite(fine) && fine > 0 ? fine : 0;
}

export function rulingOutcome(item) {
  if (item?.rulingOutcome) return String(item.rulingOutcome);
  const label = String(item?.rulingLabel || "");
  if (/أُلغي|الغي|void/i.test(label)) return "void";
  if (/خُفِّض|خفّض|خفض|reduced|lower/i.test(label)) return "lower";
  if (/ثُبِّت|ثبّت|uphold|keep/i.test(label)) return "keep";
  return "";
}

export function effectivePenalty(item, ar = true) {
  const outcome = rulingOutcome(item);
  if (outcome === "void") return ar ? "أُلغي الجزاء" : "Sanction voided";
  if (outcome === "lower") return ar ? "إنذار" : "Warning";
  return penaltyLabel(item, ar);
}

export function penaltyShiftLabel(item, ar = true) {
  const original = penaltyLabel(item, ar);
  const next = effectivePenalty(item, ar);
  return next === original ? original : `${original} ← ${next}`;
}

export function isSignedSanction(item) {
  return Boolean(dateOnly(item?.signedAt || item?.decidedAt));
}

export function effectiveCutDays(item) {
  const outcome = rulingOutcome(item);
  if (outcome === "void" || outcome === "lower") return 0;
  if (!isSignedSanction(item)) return 0;
  return cutDaysOf(item);
}

export function effectiveCutAmount(item, wage) {
  const days = effectiveCutDays(item);
  if (days > 0 && wage > 0) return (days * wage) / 30;
  if (rulingOutcome(item) === "void" || rulingOutcome(item) === "lower") return 0;
  if (!isSignedSanction(item)) return 0;
  return cutAmount(item, wage);
}

export function cutPhrase(item, wage, ar = true) {
  const days = cutDaysOf(item);
  const eff = effectiveCutDays(item);
  const amount = effectiveCutAmount(item, wage);
  const outcome = rulingOutcome(item);
  if (eff > 0) {
    if (amount > 0) {
      return ar
        ? `${money(amount)} ر.س حسماً`
        : `${money(amount)} SAR deducted`;
    }
    return ar
      ? countAr(eff, "يوم واحد حسماً", "يومان حسماً", "أيام حسماً", "يوماً حسماً")
      : `${eff} day cut`;
  }
  if (!days) return ar ? "لا حسم" : "No deduction";
  if (outcome === "void") return ar ? "لا حسم — أُلغي الجزاء بقرار الاعتراض" : "No deduction — the sanction was voided on objection";
  if (outcome === "lower") return ar ? "لا حسم — خُفِّض الجزاء فأُلغي الحسم" : "No deduction — the sanction was reduced and the cut lifted";
  return ar ? "لا حسم" : "No deduction";
}

export function isDisciplineSettled(item) {
  const face = faceOf(item?.status);
  if (face.id === "objected") return Boolean(item?.rulingAt || item?.rulingLabel);
  return face.id === "signed" || face.id === "closed";
}

export function isErasedFromEmployeeRecord(item, today) {
  const signed = dateOnly(item?.signedAt || item?.decidedAt);
  if (!signed) return false;
  const day = dateOnly(today) || todayRiyadh();
  const n = daysBetween(signed, day);
  const erase = ruleValue("discipline.record.eraseDays", day) || 365;
  return n != null && n > erase;
}

export function shortFileHash(hash) {
  const value = String(hash || "");
  if (!value) return "";
  return value.length > 16 ? `${value.slice(0, 16)}…` : value;
}

export function collectDisciplineArchive({
  cases = [],
  employees = [],
  stations = [],
  ar = true,
  today,
  filter = "all",
  selfOnly = false,
  userId,
} = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const scoped = (cases || []).filter((item) => !selfOnly || String(item.employeeId) === String(userId));
  const rows = scoped.filter(isDisciplineSettled).map((item) => {
    const employee = employees.find((person) => String(person.id) === String(item.employeeId));
    const station = stations.find((row) => row.id === (employee?.stationId || employee?.station_id || item.stationId));
    const wage = employeeContractWage(employee);
    const days = effectiveCutDays(item);
    const amount = effectiveCutAmount(item, wage);
    const outcome = rulingOutcome(item);
    const erased = isErasedFromEmployeeRecord(item, day);
    const kind = (outcome || item.appealedAt)
      ? "objected"
      : (days > 0 ? "cut" : "warn");
    const at = dateOnly(item.rulingAt || item.signedAt || item.decidedAt || item.notifiedAt || item.createdAt);
    const title = `${employee?.name || item.employeeId || "—"} — ${penaltyShiftLabel(item, ar)}`;
    const meta = [
      item.note || item.reason || "",
      station?.name || "",
      item.signedBy ? (ar ? `وقّعه ${item.signedBy}` : `Signed by ${item.signedBy}`) : "",
      item.appealedAt ? (ar ? `اعترض في ${fmtDisciplineDate(item.appealedAt, ar)}` : `Objected ${fmtDisciplineDate(item.appealedAt, ar)}`) : "",
      erased ? (ar ? "مُحي من سجل الموظف الظاهر بعد سنة" : "Dropped from the employee's visible record after a year") : "",
    ].filter(Boolean).join(" · ");
    const state = item.rulingLabel
      || (faceOf(item.status).id === "closed"
        ? (item.signedAt ? (ar ? "نُفّذ وأُغلق" : "Executed and closed") : (ar ? "حُفظ بلا جزاء" : "Filed without a sanction"))
        : (ar ? "موقَّع ونافذ" : "Signed and in force"));
    return {
      id: item.id,
      kind,
      title,
      meta,
      state,
      stColor: item.rulingLabel ? "var(--nv-ink)" : (item.signedAt ? "var(--nv-ok-ink)" : "var(--nv-ink2)"),
      stBg: item.rulingLabel ? "var(--nv-mute-soft)" : (item.signedAt ? "var(--nv-ok-soft)" : "var(--nv-mute-soft)"),
      stBorder: item.rulingLabel ? "var(--nv-mute-line)" : (item.signedAt ? "var(--nv-ok-line)" : "var(--nv-mute-line)"),
      accent: item.rulingLabel ? "var(--nv-navy)" : (item.signedAt ? "var(--nv-ok-fill)" : "var(--nv-line)"),
      refTag: cutDaysOf(item) > 0 ? (ar ? "أثر مالي" : "Pay effect") : (item.signedAt ? (ar ? "أثر" : "Effect") : ""),
      ref: days
        ? (amount > 0
          ? (ar
            ? `${money(amount)} ر.س · ${countAr(days, "يوم واحد", "يومان", "أيام", "يوماً")}`
            : `${money(amount)} SAR · ${days} day(s)`)
          : (ar
            ? countAr(days, "يوم واحد حسماً", "يومان حسماً", "أيام حسماً", "يوماً حسماً")
            : `${days} day cut`))
        : (cutDaysOf(item)
          ? (ar ? `أُلغي حسم ${money(cutAmount(item, wage))} ر.س` : `Cut of ${money(cutAmount(item, wage))} SAR lifted`)
          : (item.signedAt ? (ar ? "لا حسم — قيد في الملف" : "No deduction — on the file") : "—")),
      at,
      year: at.slice(0, 4) || "—",
      employeeId: employee?.id || item.employeeId || "",
      href: employee?.id ? `/app/employees/${employee.id}?tab=growth` : "",
      payrollHref: days > 0 || cutDaysOf(item) > 0 ? "/app/payroll" : "",
    };
  }).filter((row) => filter === "all" || row.kind === filter);

  rows.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const years = {};
  for (const row of rows) {
    (years[row.year] ||= []).push(row);
  }
  const groups = Object.keys(years).sort().reverse().map((year) => ({
    title: ar ? `سنة ${year}` : `Year ${year}`,
    year,
    count: ar
      ? countAr(years[year].length, "ملف واحد", "ملفان", "ملفات", "ملفاً", "لا ملفات")
      : `${years[year].length} file(s)`,
    rows: years[year],
  }));
  return {
    rows,
    groups,
    note: ar
      ? `${countAr(rows.length, "ملف واحد مستقرّ", "ملفان مستقرّان", "ملفات مستقرّة", "ملفاً مستقرّاً", "لا ملفات مستقرّة")}${selfOnly ? " في ملفك" : " في هذا الفرع"} — لا يُحذف منها شيء.`
      : `${rows.length} settled file(s)${selfOnly ? " on your file" : " on this station"} — none are deleted.`,
  };
}

/** Settled archive rows → RecordSmartArchive items (search / day groups). */
export function disciplineArchiveSmartItems(rows = [], { ar = true } = {}) {
  return (rows || []).map((row) => ({
    id: row.id,
    title: row.title,
    text: [row.meta, row.ref].filter(Boolean).join(" · "),
    date: row.at,
    badge: row.state,
    search: [row.title, row.meta, row.state, row.ref, row.refTag, row.at].filter(Boolean).join(" "),
    row,
    ar,
  }));
}

export function deriveDisciplineBoard({
  cases = [],
  employees = [],
  stations = [],
  ar = true,
  today,
  canDecide = false,
  scopeLabel = "",
} = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const register = buildDisciplineRegister({ cases, employees, stations, ar });
  const faces = cases.map((item) => ({ item, face: faceOf(item.status) }));
  const open = faces.filter((row) => OPEN_FACES.has(row.face.id));
  const imposed = faces.filter((row) => IMPOSED_FACES.has(row.face.id));
  const objected = faces.filter((row) => row.face.id === "objected");
  const cut = imposed.reduce((sum, row) => {
    const employee = employees.find((person) => String(person.id) === String(row.item.employeeId));
    return sum + effectiveCutAmount(row.item, employeeContractWage(employee));
  }, 0);
  const cutFiles = imposed.filter((row) => effectiveCutDays(row.item) > 0).length;
  const lifted = imposed.some((row) => cutDaysOf(row.item) > 0 && effectiveCutDays(row.item) === 0);

  const monthCuts = {};
  const monthSuspend = {};
  for (const row of imposed) {
    const days = effectiveCutDays(row.item);
    if (days <= 0) continue;
    const key = String(row.item.employeeId);
    const kind = resolvePenaltyKind(row.item);
    if (kind === "suspend") monthSuspend[key] = monthCapDaysByKind(cases, key, day, "suspend");
    else if (kind === "fine") monthCuts[key] = monthCapDaysByKind(cases, key, day, "fine");
    else monthCuts[key] = (monthCuts[key] || 0) + days;
  }
  const topId = Object.keys(monthCuts).sort((a, b) => monthCuts[b] - monthCuts[a])[0];
  const monthCut = topId ? monthCuts[topId] : 0;
  const topName = employees.find((row) => String(row.id) === String(topId))?.name;
  const cap = ruleValue("discipline.fine.maxDays", day);
  const chargeDays = ruleValue("discipline.charge.maxDays", day);
  const overdue = cases.filter((item) => {
    const face = faceOf(item.status);
    if (face.id === "signed" || face.id === "closed" || face.id === "objected") return false;
    const ended = item.investigationEndedAt || item.hearingEndedAt || item.hearingAt;
    if (!ended) return false;
    const n = daysBetween(ended, day);
    return n != null && n > chargeDays;
  }).length;

  const maxStage = Math.max(1, ...FACE_STAGES.map((stage) => faces.filter((row) => row.face.id === stage.id).length));
  const stages = FACE_STAGES.map((stage) => {
    const n = faces.filter((row) => row.face.id === stage.id).length;
    return {
      id: stage.id,
      num: stage.num,
      name: ar ? stage.ar : stage.en,
      n,
      pct: `${Math.round((n / maxStage) * 100)}%`,
      color: n ? (stage.id === "objected" ? "var(--nv-bad-ink)" : stage.id === "closed" ? "var(--nv-ok-ink)" : "var(--nv-navy)") : "var(--nv-muted)",
    };
  });

  const stats = [
    { val: String(cases.length), unit: "", lbl: ar ? "ملفات في نطاقك" : "Files in scope", note: scopeLabel || (cases.length ? "—" : (ar ? "لا ملفات" : "No files")), accent: "var(--nv-ink)", border: "var(--nv-line)" },
    {
      val: String(open.length),
      unit: "",
      lbl: ar ? "مفتوحة" : "Open",
      note: objected.length
        ? (ar
          ? `${countAr(objected.length, "منها واحد تحت الاعتراض", "منها اثنان تحت الاعتراض", "منها تحت الاعتراض", "منها واحد تحت الاعتراض")} — يقرّر فيه من لم يوقّع`
          : `${objected.length} on objection — decided by whoever did not sign`)
        : (ar ? "لم يستقرّ فيها قرار · لا اعتراض قائم" : "No settled ruling · no open objection"),
      accent: "var(--nv-warn-fill)",
      border: "var(--nv-warn-line)",
    },
    { val: String(imposed.length), unit: "", lbl: ar ? "موقَّعة" : "Signed", note: ar ? "نُفّذت وقُيّدت" : "Executed and written to the file", accent: "var(--nv-ok-ink)", border: "var(--nv-ok-line)" },
    {
      val: money(cut),
      unit: ar ? "ر.س" : "SAR",
      lbl: ar ? "إجمالي الحسم النافذ" : "Effective deduction",
      note: (ar
        ? countAr(cutFiles, "من ملف واحد", "من ملفين", "ملفات بحسم", "ملفاً بحسم", "لا حسم نافذ")
        : (cutFiles ? `From ${cutFiles} file(s)` : "No effective deduction"))
        + (lifted ? (ar ? " · ما أُلغي أو خُفِّض لا يُحسب" : " · voided or reduced cuts are not counted") : ""),
      accent: "var(--nv-bad-ink)",
      border: "var(--nv-bad-line)",
    },
  ];

  const charge = citeRule("discipline.charge.maxDays", day);
  const fine = citeRule("discipline.fine.maxDays", day);
  const doubleHits = cases.filter((item) => !checkDisciplineDoubleFileGate(item, { cases, today: day }).ok).length;
  const rulingLate = cases.filter((item) => faceOf(item.status).id === "objected" && !checkAdvanceDisciplineGate(item, "ruling", { today: day }).ok).length;

  const gates = [
    {
      tag: ar ? `المادة ${charge?.article || "69"}` : `Art. ${charge?.article || "69"}`,
      head: ar ? `مهلة التوقيع ${chargeDays} يوماً من انتهاء التحقيق` : `${chargeDays}-day signing window from the investigation end`,
      body: ar
        ? "المادة 69: مهلة الاتهام من الكشف، ومهلة التوقيع من انتهاء التحقيق. ما تجاوز الثانية يُمنع توقيعه ويُكتب السبب."
        : "Article 69: the accusation window runs from discovery, and the signing window from the investigation end. Past the second clock, signing is blocked and the reason is written.",
      state: overdue
        ? (ar ? countAr(overdue, "ملف واحد تجاوزها", "ملفان تجاوزاها", "ملفات تجاوزتها", "ملفاً تجاوزها") : `${overdue} overdue`)
        : (ar ? "لا تجاوز" : "Within time"),
      kind: overdue ? "bad" : "ok",
    },
    {
      tag: ar ? `المادة ${fine?.article || "70"}` : `Art. ${fine?.article || "70"}`,
      head: ar ? `سقف الحسم ${cap} أيام شهرياً` : `${cap}-day monthly deduction cap`,
      body: ar
        ? "مجموع ما حُسم على الموظف الواحد في الشهر لا يتجاوز أجر خمسة أيام."
        : "What is deducted from one employee in a month may not exceed five days' wage.",
      state: monthCut > cap
        ? (ar ? `تجاوز — ${topName || ""}` : `Over — ${topName || ""}`)
        : (topName ? (ar ? `أعلى موظف ${monthCut} من ${cap}` : `Highest ${monthCut} of ${cap}`) : (ar ? "لا حسم هذا الشهر" : "No cut this month")),
      kind: monthCut > cap ? "bad" : "ok",
    },
    {
      tag: ar ? `المادة ${fine?.article || "70"}` : `Art. ${fine?.article || "70"}`,
      head: ar ? "لا عقوبتان على فعل" : "No two penalties for one act",
      body: ar
        ? "المخالفة الواحدة لا تُوقَّع عليها عقوبتان — المادة 70. والجزاء نفسه لا يخرج عن قائمة المادة 66 و67."
        : "One offence may not carry two penalties — Article 70. The penalty itself stays on the Article 66 and 67 list.",
      state: doubleHits
        ? (ar ? countAr(doubleHits, "ملف واحد متعارض", "ملفان متعارضان", "ملفات متعارضة", "ملفاً متعارضاً") : `${doubleHits} conflict(s)`)
        : (ar ? "مطبَّق" : "Applied"),
      kind: doubleHits ? "bad" : "ok",
    },
    {
      tag: ar ? "المادة 72" : "Art. 72",
      head: ar ? "البت في التظلم خلال 15 يوماً" : "Decide the appeal within 15 days",
      body: ar
        ? "إن انتهت المهلة يُحجب البت الداخلي ويُكتب أن للعامل الاعتراض أمام المحاكم العمالية."
        : "Past the window, the internal ruling is blocked and the worker's right to go to the labour courts is written.",
      state: rulingLate
        ? (ar ? countAr(rulingLate, "تظلم واحد تجاوز المهلة", "تظلمان تجاوزا المهلة", "تظلمات تجاوزت المهلة", "تظلماً تجاوز المهلة") : `${rulingLate} overdue`)
        : (ar ? "لا تجاوز" : "Within time"),
      kind: rulingLate ? "bad" : "ok",
    },
    {
      tag: ar ? "قاعدة المنصة" : "Platform rule",
      head: ar ? "كل قرار باسم صاحبه" : "Every decision names its author",
      body: ar
        ? "التوقيع والقرار في الاعتراض يُسجَّلان باسم من أصدرهما ووقتهما، ويظهران للموظف بحيثياتهما."
        : "Signing and the objection ruling are stored with the author's name and time, and the employee sees the reasons.",
      state: canDecide ? (ar ? "يُسجَّل باسمك" : "Recorded in your name") : (ar ? "للاطّلاع" : "For viewing"),
      kind: canDecide ? "ok" : "mute",
    },
  ].map((row) => ({
    ...row,
    color: row.kind === "bad" ? "var(--nv-bad-ink)" : row.kind === "mute" ? "var(--nv-ink2)" : "var(--nv-ok-ink)",
    bg: row.kind === "bad" ? "var(--nv-bad-soft)" : row.kind === "mute" ? "var(--nv-mute-soft)" : "var(--nv-ok-soft)",
    border: row.kind === "bad" ? "var(--nv-bad-line)" : row.kind === "mute" ? "var(--nv-mute-line)" : "var(--nv-ok-line)",
  }));

  const pulse = objected.length
    ? (ar
      ? countAr(objected.length, "اعتراض واحد ينتظر قراراً", "اعتراضان ينتظران قراراً", "اعتراضات تنتظر قراراً", "اعتراضاً ينتظر قراراً")
      : `${objected.length} objection(s) awaiting a ruling`)
    : open.length
      ? (ar
        ? countAr(open.length, "ملف واحد مفتوح", "ملفان مفتوحان", "ملفات مفتوحة", "ملفاً مفتوحاً")
        : `${open.length} open file(s)`)
      : (ar ? "لا ملف مفتوح" : "No open file");

  return {
    register,
    stats,
    stages,
    gates,
    monthCuts,
    monthSuspend,
    cap,
    chargeDays,
    today: day,
    openCount: open.length,
    appealCount: objected.length,
    imposedCount: imposed.length,
    pulse,
    pulseKind: objected.length ? "bad" : open.length ? "warn" : "ok",
    pulseColor: objected.length ? "var(--nv-bad-ink)" : open.length ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)",
    pulseBg: objected.length ? "var(--nv-bad-soft)" : open.length ? "var(--nv-warn-soft)" : "var(--nv-ok-soft)",
    pulseBorder: objected.length ? "var(--nv-bad-line)" : open.length ? "var(--nv-warn-line)" : "var(--nv-ok-line)",
    pulseDot: objected.length ? "var(--nv-bad-ink)" : open.length ? "var(--nv-warn-fill)" : "var(--nv-ok-fill)",
    stageNote: objected.length
      ? (ar
        ? `${countAr(objected.length, "ملف واحد تحت الاعتراض", "ملفان تحت الاعتراض", "ملفات تحت الاعتراض", "ملفاً تحت الاعتراض")} — الجزاء يبقى نافذاً حتى يصدر القرار.`
        : "The sanction stays in force until a ruling is issued.")
      : (ar ? "لا اعتراض قائم. كل انتقال في المسار يحمل اسم من قرّره ووقته." : "No open objection. Every move names who decided it and when."),
    recordScope: ar
      ? `${scopeLabel || "هذا الفرع"} · ${countAr(cases.length, "ملف واحد", "ملفان", "ملفات", "ملفاً", "لا ملفات")}`
      : `${scopeLabel || "This station"} · ${cases.length} file(s)`,
    recordNote: ar
      ? "كل انتقال يُسجَّل باسمك ووقته. ما يمنعه النظام يظهر بسببه مكتوباً بدل أن يُخفى الزر."
      : "Every move is stored with your name and time. A legal block writes its reason instead of hiding the button.",
  };
}

export function decorateDisciplineCase(item, {
  employees = [],
  stations = [],
  ar = true,
  today,
  currentUser,
  canManage = false,
  monthCuts = {},
  monthSuspend = {},
  cap = 5,
  cases = [],
} = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const employee = employees.find((row) => String(row.id) === String(item.employeeId));
  const station = stations.find((row) => row.id === (employee?.stationId || employee?.station_id || item.stationId));
  const face = faceOf(item.status);
  const tone = TONE[face.id] || TONE.notified;
  const wage = employeeContractWage(employee);
  const days = cutDaysOf(item);
  const cut = effectiveCutAmount(item, wage);
  const penalty = penaltyLabel(item, ar);
  const effPen = effectivePenalty(item, ar);
  const signedAt = dateOnly(item.signedAt || item.decidedAt);
  const notifiedAt = dateOnly(item.notifiedAt || (["notice", "hearing", "decision", "notify", "appeal", "ruling", "closed"].includes(item.status) ? item.createdAt : ""));
  const defenceAt = dateOnly(item.hearingEndedAt || item.hearingAt || item.investigationEndedAt);
  const objectedAt = dateOnly(item.appealedAt);
  const closedAt = dateOnly(item.rulingAt || (face.id === "closed" ? item.updatedAt : ""));
  const files = disciplineEvidenceList(item);
  const appealNote = disciplineAppealNote(item);

  const steps = [
    { id: "notified", name: ar ? "أُبلغ كتابةً" : "Notified in writing", when: notifiedAt ? fmtDisciplineDate(notifiedAt, ar) : (ar ? "لم يُبلَغ" : "Not yet"), done: Boolean(notifiedAt || ["notice", "hearing", "decision", "notify", "appeal", "ruling", "closed"].includes(item.status)) },
    { id: "defence", name: ar ? "سُمع دفاعه" : "Defence heard", when: defenceAt ? fmtDisciplineDate(defenceAt, ar) : (ar ? "لم يُسمع بعد" : "Not heard yet"), done: Boolean(defenceAt) },
    { id: "signed", name: ar ? "وُقّع" : "Signed", when: signedAt ? fmtDisciplineDate(signedAt, ar) : (ar ? "لم يُوقَّع" : "Not signed"), done: Boolean(signedAt) },
    { id: "objected", name: ar ? "اعترض" : "Objected", when: objectedAt ? fmtDisciplineDate(objectedAt, ar) : (ar ? "لا اعتراض" : "No objection"), done: Boolean(objectedAt || face.id === "objected") },
    { id: "closed", name: ar ? "أُغلق" : "Closed", when: item.rulingLabel ? `${item.rulingLabel} · ${fmtDisciplineDate(closedAt, ar)}` : (face.id === "closed" ? (ar ? "استقرّ" : "Settled") : (ar ? "مفتوح" : "Open")), done: face.id === "closed" },
  ].map((step) => ({
    ...step,
    bg: step.done ? "var(--nv-soft)" : "var(--nv-card)",
    color: step.done ? "var(--nv-ink)" : "var(--nv-muted)",
  }));

  const actions = [];
  let blocked = "";
  if (canManage && face.id === "notified") {
    const oral = isSimpleOralOffence(item);
    actions.push({
      id: "hear",
      kind: "go",
      label: oral ? (ar ? "أثبت الاستجواب الشفهي في المحضر" : "Record the oral questioning in the minutes") : (ar ? "دوّن سماع الدفاع" : "Record the hearing"),
      tip: oral
        ? (ar ? "المادة 71: المخالفة البسيطة تُستجوَب شفاهة ويُثبت ذلك في المحضر" : "Article 71: a minor offence may be questioned orally if that is recorded in the minutes")
        : (ar ? "لا توقيع قبل سماع الأقوال في محضر" : "No signing before the defence is heard in minutes"),
    });
  } else if (canManage && face.id === "defence") {
    const signGate = checkSignDisciplineGate(item, { files, today: day, cases });
    if (!signGate.ok) blocked = ar ? signGate.reason : signGate.reasonEn;
    else actions.push({ id: "sign", kind: "go", label: ar ? "وقّع الجزاء" : "Sign the sanction", tip: ar ? "يُنفَّذ ويبدأ حقّ الاعتراض" : "It takes effect and the right to object starts" });
    actions.push({ id: "close", kind: "plain", label: ar ? "احفظ الملف بلا جزاء" : "Close without a sanction", tip: ar ? "لم يثبت موجبه" : "The ground was not established" });
  } else if (canManage && face.id === "signed") {
    actions.push({ id: "close", kind: "plain", label: ar ? "أغلق الملف" : "Close the file", tip: ar ? "استقرّ ولم يُعترض عليه" : "It settled and was not objected to" });
  } else if (canManage && face.id === "objected") {
    const rulingGate = checkAdvanceDisciplineGate(item, "ruling", { today: day });
    if (!rulingGate.ok) {
      blocked = ar ? rulingGate.reason : rulingGate.reasonEn;
    } else {
      const selfSigned = item.signedBy && currentUser?.name && item.signedBy === currentUser.name;
      if (selfSigned) {
        blocked = ar
          ? "أنت من وقّع هذا الجزاء. قرارك في الاعتراض عليه يُثبَّت في السجل بهذا الوصف، وللموظف أن يصعّده."
          : "You signed this sanction. A ruling you issue on the objection is recorded as such, and the employee may escalate.";
      }
      actions.push({ id: "keep", kind: "plain", label: ar ? "ثبّت الجزاء" : "Uphold the sanction", tip: ar ? "الاعتراض لم يغيّره" : "The objection did not change it" });
      actions.push({ id: "lower", kind: "plain", label: ar ? "خفّض إلى إنذار" : "Reduce to a warning", tip: ar ? "يُخفَّض إلى إنذار ويُلغى الحسم" : "Reduced to a warning and the cut is lifted" });
      actions.push({ id: "void", kind: "go", label: ar ? "ألغِ الجزاء" : "Void the sanction", tip: ar ? "يُرفع من الملف" : "Removed from the file" });
    }
  }

  const signMax = Number(ruleValue("discipline.charge.maxDays", day)) || 0;
  const appealMax = Number(ruleValue("discipline.appeal.internalDays", day)) || 0;
  const cutCap = Number(cap) || Number(ruleValue("discipline.fine.maxDays", day)) || 0;
  const signElapsed = defenceAt ? daysBetween(defenceAt, signedAt || day) : null;
  const appealElapsed = signedAt ? daysBetween(signedAt, objectedAt || closedAt || day) : null;
  const fineUsed = monthCapDaysByKind(cases, item.employeeId, day, "fine");
  const suspendUsed = monthCapDaysByKind(cases, item.employeeId, day, "suspend");
  const cutUsed = fineUsed + suspendUsed;
  const meterPct = (used, max) => (!max || used == null ? 0 : Math.max(0, Math.min(100, Math.round((Number(used) / max) * 100))));
  const meters = [
    {
      id: "sign",
      label: ar ? "مهلة التوقيع" : "Signing window",
      article: citeRule("discipline.charge.maxDays", day)?.article || "69",
      text: signElapsed == null || !signMax ? "—" : `${signElapsed} / ${signMax}`,
      pct: meterPct(signElapsed, signMax),
      over: signElapsed != null && signMax > 0 && signElapsed > signMax,
    },
    {
      id: "appeal",
      label: ar ? "مهلة الاعتراض" : "Objection window",
      article: citeRule("discipline.appeal.internalDays", day)?.article || "72",
      text: appealElapsed == null || !appealMax ? "—" : `${appealElapsed} / ${appealMax}`,
      pct: meterPct(appealElapsed, appealMax),
      over: appealElapsed != null && appealMax > 0 && appealElapsed > appealMax,
    },
    {
      id: "cap",
      label: ar ? "سقف الحسم" : "Deduction cap",
      article: citeRule("discipline.fine.maxDays", day)?.article || "70",
      text: cutCap ? `${cutUsed} / ${cutCap}` : "—",
      pct: meterPct(cutUsed, cutCap),
      over: cutCap > 0 && cutUsed > cutCap,
    },
  ];
  const jobTitle = employee?.jobTitle || employee?.title || employee?.profile?.jobTitle || employee?.profile?.position || employee?.position || "";
  const fileCode = employee?.employeeNumber || employee?.profile?.employeeNumber || employee?.code || employee?.fileNo || "";

  const phrase = cutPhrase(item, wage, ar);
  const line = signedAt
    ? `${item.note || item.reason || (ar ? "بلا وصف" : "No text")} · ${penaltyShiftLabel(item, ar)} · ${phrase}`
    : `${item.note || item.reason || (ar ? "بلا وصف" : "No text")} · ${penalty} — ${ar ? "مقترح" : "proposed"} · ${ar ? "لم يُوقَّع بعد" : "Not signed yet"}`;

  const signedPaper = item.signedPaper;
  const settled = Boolean(item.rulingLabel || face.id === "closed");
  const stageDoc = !signedAt
    ? {
      title: ar ? `وثيقة الإبلاغ الكتابي — ${penalty} (مقترح)` : `Written notice — ${penalty} (proposed)`,
      note: ar
        ? "نزّلها ليوقّعها الموظف بخطّ يده ثم ارفعها، أو أرسلها للتوقيع الإلكتروني في التوقيع الرقمي — سجلّ التوقيع هناك لا هنا."
        : "Download it for a handwritten signature then upload it, or send it through Digital signing — the signing trail lives there, not here.",
    }
    : settled
      ? {
        title: ar ? `الوثيقة المستقرّة — ${effPen}` : `Settled document — ${effPen}`,
        note: ar
          ? `استقرّ الملف بقرار «${item.rulingLabel || ""}». النسخة المستقرّة للحفظ والاحتجاج — لا رفع ولا توقيع جديد عليها.`
          : `The file settled with “${item.rulingLabel || ""}”. The settled copy is for keeping — no new signing on it.`,
      }
      : {
        title: ar ? `نسخة الجزاء الموقَّع — ${penalty}` : `Signed sanction copy — ${penalty}`,
        note: ar
          ? `وُقّع في ${fmtDisciplineDate(signedAt, ar)} · ${phrase}. نسخة للحفظ — الرفع والتوقيع انتهيا، وحقّ الاعتراض قائم من وجه الموظف.`
          : `Signed ${fmtDisciplineDate(signedAt, ar)} · ${phrase}. A copy to keep — signing is done, and the right to object sits on the employee's face.`,
      };

  const appealFile = item.appealFile;
  const fileBit = appealFile?.name
    ? (ar ? ` · مرفق: ${appealFile.name}${appealFile.hash ? ` — بصمته ${shortFileHash(appealFile.hash)}` : ""}` : ` · attached: ${appealFile.name}${appealFile.hash ? ` — hash ${shortFileHash(appealFile.hash)}` : ""}`)
    : (appealNote ? (ar ? " · بلا مرفق" : " · no attachment") : "");
  const news = item.rulingNote
    ? (ar
      ? `القرار: ${item.rulingLabel || ""} — قرّره ${item.rulingBy || ""} في ${fmtDisciplineDate(closedAt, ar)}. حيثياته: «${item.rulingNote}».`
      : `Ruling: ${item.rulingLabel || ""} — by ${item.rulingBy || ""} on ${fmtDisciplineDate(closedAt, ar)}. ${item.rulingNote}`)
    : (appealNote
      ? (ar ? `اعتراض الموظف (${fmtDisciplineDate(objectedAt, ar)}): «${appealNote}»${fileBit}` : `Employee objection (${fmtDisciplineDate(objectedAt, ar)}): “${appealNote}”${fileBit}`)
      : "");

  return {
    item,
    employee,
    station,
    face,
    tone,
    wage,
    days,
    cut,
    penalty,
    effPen,
    line,
    steps,
    actions,
    blocked,
    signedAt,
    canObject: face.id === "signed" && item.employeeId === currentUser?.id && checkAdvanceDisciplineGate(item, "appeal", { appealNote: "—", today: day }).ok,
    objectBlocked: (() => {
      if (face.id !== "signed" || item.employeeId !== currentUser?.id) return "";
      const windowGate = checkAdvanceDisciplineGate(item, "appeal", { appealNote: "—", today: day });
      return windowGate.ok ? "" : (ar ? windowGate.reason : windowGate.reasonEn);
    })(),
    hasObjGate: face.id === "signed" && item.employeeId !== currentUser?.id && !appealNote && !item.rulingNote,
    objGate: ar
      ? "الاعتراض حقّ الموظف وحده — لا يُرفع باسمه من هنا. أنت ترى معاينة ملفه."
      : "Only the employee objects — it is not filed in their name from here. You are previewing their file.",
    hasNews: Boolean(appealNote || item.rulingNote),
    news,
    newsColor: item.rulingNote ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)",
    newsBg: item.rulingNote ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)",
    newsBorder: item.rulingNote ? "var(--nv-ok-line)" : "var(--nv-warn-line)",
    mineTitle: `${penaltyShiftLabel(item, ar)} — ${item.note || item.reason || (ar ? "بلا وصف" : "No text")}`,
    mineState: item.rulingLabel
      || (face.id === "objected" ? (ar ? "اعتراضي قيد النظر" : "Objection pending")
        : face.id === "signed" ? (ar ? "ساري" : "In force")
          : (ar ? face.shortAr : face.shortEn)),
    mineLine: signedAt
      ? `${ar ? "وُقّع" : "Signed"} ${fmtDisciplineDate(signedAt, ar)} · ${phrase}`
      : line,
    canWithdraw: face.id === "objected" && item.employeeId === currentUser?.id && !item.rulingNote,
    hasObj: Boolean(appealNote),
    objText: news,
    appealFile,
    signedPaper,
    canSignDoc: !signedAt,
    docTitle: stageDoc.title,
    docNote: signedPaper
      ? (ar
        ? `مرفوعة موقَّعة: ${signedPaper.name}${signedPaper.hash ? ` · بصمتها ${shortFileHash(signedPaper.hash)}` : ""}`
        : `Signed copy uploaded: ${signedPaper.name}${signedPaper.hash ? ` · hash ${shortFileHash(signedPaper.hash)}` : ""}`)
      : stageDoc.note,
    docColor: signedPaper ? "var(--nv-ok-ink)" : "var(--nv-muted)",
    dlLabel: !signedAt
      ? (ar ? "نزّل الإبلاغ" : "Download the notice")
      : (settled ? (ar ? "نزّل الوثيقة المستقرّة" : "Download the settled document") : (ar ? "نزّل نسخة الجزاء" : "Download the sanction copy")),
    dlTip: !signedAt
      ? (ar ? "نسخة A4 للطباعة والتوقيع بخطّ اليد" : "A4 copy to print and sign by hand")
      : (settled
        ? (ar ? "نسخة مستقرّة للحفظ والاحتجاج — لا توقيع جديد عليها" : "Settled copy to keep — no new signing on it")
        : (ar ? "نسخة الجزاء الموقَّع للحفظ — الاعتراض من وجه الموظف" : "Signed copy to keep — objection sits on the employee's face")),
    related: disciplineRelatedLinks(item, { employee, ar, signedAt }),
    meters,
    jobTitle: String(jobTitle || "").trim() || "—",
    fileCode: String(fileCode || "").trim() || "—",
  };
}

const LAW_KIND = {
  all: { ar: "الكل", en: "All" },
  scope: { ar: "نطاق", en: "Scope" },
  act: { ar: "إجراء", en: "Act" },
  deadline: { ar: "مهل", en: "Deadlines" },
  cap: { ar: "سقوف", en: "Caps" },
  right: { ar: "حقوق", en: "Rights" },
};

const LAW_CATALOG = [
  { ruleId: "discipline.penalties.cite", kind: "scope", headAr: "الجزاءات الجائز توقيعها", headEn: "Penalties that may be imposed" },
  { ruleId: "discipline.listedOnly.cite", kind: "scope", headAr: "لا جزاء خارج النظام أو اللائحة", headEn: "No penalty outside the Law or the regulations" },
  { ruleId: "discipline.repeat.cooloffDays", kind: "deadline", headAr: "لا تشديد بعد 180 يوماً", headEn: "No increase after 180 days" },
  { ruleId: "discipline.charge.maxDays", kind: "deadline", headAr: "مهلة الاتهام والتوقيع 30 يوماً", headEn: "30-day accusation and signing window" },
  { ruleId: "discipline.fine.maxDays", kind: "cap", headAr: "سقف الغرامة والحسم ووحدة الجزاء", headEn: "Fine cap, monthly cut, and one penalty per act" },
  { ruleId: "discipline.workplace.cite", kind: "scope", headAr: "لا جزاء خارج مكان العمل بلا صلة", headEn: "No off-site penalty without a work link" },
  { ruleId: "discipline.hearing.cite", kind: "act", headAr: "إبلاغ كتابي وسماع دفاع", headEn: "Written notice and a recorded defence" },
  { ruleId: "discipline.appeal.internalDays", kind: "right", headAr: "التظلم خلال 30 يوماً عدا العطل والبت خلال 15", headEn: "Object within 30 days excluding holidays; a ruling within 15" },
  { ruleId: "discipline.fines.register.cite", kind: "act", headAr: "سجل الغرامات وصرفها", headEn: "Fine register and how they are used" },
  { ruleId: "discipline.record.eraseDays", kind: "right", headAr: "محو السجل الظاهر بعد سنة", headEn: "Drop from the visible record after a year" },
];

const LAW_APPLIED = {
  "discipline.penalties.cite": {
    ar: "لا يُوقَّع إلا البنود الستة: إنذار، غرامة حتى خمسة أيام، تأجيل علاوة أو ترقية، إيقاف بلا أجر، أو فصل مقرر.",
    en: "Only the six listed penalties may be imposed: warning, a fine of up to five days, a deferred increment or promotion, unpaid suspension, or a prescribed dismissal.",
  },
  "discipline.listedOnly.cite": {
    ar: "لا يُكتب جزاء نصّاً حرّاً، ولا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل.",
    en: "A penalty is not free text, and none may be imposed unless it is in the Law or the work-organization regulations.",
  },
  "discipline.repeat.cooloffDays": {
    ar: "جزاء أقدم من 180 يوماً لا يرفع درجة الجزاء التالي، ويُكتب سبب المنع.",
    en: "A penalty older than 180 days does not raise the next one, and the block writes its reason.",
  },
  "discipline.charge.maxDays": {
    ar: "مهلة الاتهام من تاريخ الكشف، ومهلة التوقيع من انتهاء التحقيق، وما تجاوز الثانية يُمنع توقيعه.",
    en: "The accusation window runs from discovery and the signing window from the investigation end; past the second, signing is blocked.",
  },
  "discipline.fine.maxDays": {
    ar: "سقف الغرامة الشهري منفصل عن سقف الإيقاف، ولا يُوقَّع أكثر من جزاء واحد على المخالفة الواحدة.",
    en: "The monthly fine cap is separate from the suspension cap, and more than one penalty may not be imposed for a single offence.",
  },
  "discipline.workplace.cite": {
    ar: "خارج مكان العمل لا يُرفع الجزاء إلا إذا اتصل بالعمل أو بصاحبه أو بالمدير المسؤول.",
    en: "An off-site act is not raised unless it is connected with the work, the employer, or the responsible manager.",
  },
  "discipline.hearing.cite": {
    ar: "الإنذار أو غرامة يوم تُستجوَب شفاهة في المحضر، وغيرها يحتاج محضر دفاع مكتوباً.",
    en: "A warning or a one-day fine may be questioned orally in the minutes; other penalties need written defence minutes.",
  },
  "discipline.appeal.internalDays": {
    ar: "الاعتراض خلال 30 يوماً من التوقيع عدا العطل، والبتّ خلال 15 يوماً وإلا حُجب القرار الداخلي وبقي حق المحاكم العمالية.",
    en: "The objection is within 30 days of signing excluding holidays, and the ruling within 15 days, or the internal decision is blocked and the labour-court right remains.",
  },
  "discipline.fines.register.cite": {
    ar: "الغرامة تُقيَّد في السجل وتُرحَّل إلى المسير، ولا تُصرف إلا بقرار لجنة أو موافقة وزارة مكتوبة.",
    en: "A fine is written to the register and posted to payroll, and is disposed of only with a written committee decision or Ministry approval.",
  },
  "discipline.record.eraseDays": {
    ar: "الملف يبقى في أرشيف الشركة ويُمحى من سجل الموظف الظاهر بعد سنة.",
    en: "The file stays in the company archive and drops off the employee's visible record after a year.",
  },
};

export function disciplineRelatedLinks(item, { employee, ar = true, signedAt } = {}) {
  const text = `${item?.note || ""} ${item?.reason || ""} ${item?.penalty || ""}`;
  const empId = employee?.id || item?.employeeId;
  const signed = signedAt != null ? Boolean(signedAt) : Boolean(dateOnly(item?.signedAt || item?.decidedAt));
  const days = cutDaysOf(item);
  const links = [];
  if (empId) {
    links.push({
      to: `/app/employees/${encodeURIComponent(empId)}?tab=growth`,
      label: ar ? "ملف الموظف" : "Employee file",
      tip: ar ? "الجزاء يظهر في تبويب النمو بعد التوقيع" : "The sanction appears on the growth tab after signing",
    });
  }
  if (!signed) {
    links.push({
      to: "/app/signing",
      label: ar ? "التوقيع الرقمي" : "Digital signing",
      tip: ar ? "سجلّ التوقيع الإلكتروني هناك لا هنا" : "The electronic signing trail lives there, not here",
    });
  }
  if (days > 0) {
    links.push({
      to: "/app/payroll",
      label: ar ? "مسير الرواتب" : "Payroll",
      tip: ar ? "الحسم النافذ يُرحَّل إلى المسير عند التوقيع" : "The effective cut posts to the run when signed",
    });
  }
  if (/تأخ|غياب|حضور|ورد|انصراف|late|absent|shift|attendance/i.test(text)) {
    links.push({
      to: "/app/attendance",
      label: ar ? "الحضور" : "Attendance",
      tip: ar ? "الواقعة مربوطة بوقت العمل" : "The incident is tied to working time",
    });
  }
  if (/عهد|إتلاف|أصل|عدّة|عدة|custody|asset/i.test(text)) {
    links.push({
      to: "/app/assets",
      label: ar ? "العهد" : "Custody",
      tip: ar ? "العهدة تُسلَّم وتُستعاد من سجل الأصول" : "Custody is handed and returned from the assets register",
    });
  }
  links.push({
    to: "/app/complaints",
    label: ar ? "صوت الموظف" : "Employee voice",
    tip: ar ? "الاعتراض ليس شكوى — الشكوى واقعة تريد أن تُنظر" : "An objection is not a complaint",
  });
  return links;
}

export function deriveDisciplineLawBoard({
  cases = [],
  employees = [],
  ar = true,
  today,
  filter = "all",
} = {}) {
  const day = dateOnly(today) || todayRiyadh();
  const chargeDays = ruleValue("discipline.charge.maxDays", day);
  const cap = ruleValue("discipline.fine.maxDays", day);
  const monthCuts = {};
  for (const item of cases) {
    const days = effectiveCutDays(item);
    if (days <= 0) continue;
    const key = String(item.employeeId);
    monthCuts[key] = (monthCuts[key] || 0) + days;
  }

  const live = {};
  const blocked = {};
  const bump = (ruleId, count = 1, isBlock = false) => {
    live[ruleId] = (live[ruleId] || 0) + count;
    if (isBlock) blocked[ruleId] = (blocked[ruleId] || 0) + count;
  };

  for (const item of cases) {
    const face = faceOf(item.status);
    const signedAt = dateOnly(item.signedAt || item.decidedAt);
    const ended = dateOnly(item.investigationEndedAt || item.hearingEndedAt || item.hearingAt);
    const late = !signedAt && ended && daysBetween(ended, day) > chargeDays;
    const repeat = checkDisciplineRepeatGate(item, { cases, today: day });
    const double = checkDisciplineDoubleFileGate(item, { cases, today: day });
    const ruling = checkAdvanceDisciplineGate(item, "ruling", { today: day });

    if (item.note || item.reason) bump("discipline.penalties.cite");
    bump("discipline.listedOnly.cite");
    if (face.id === "notified") bump("discipline.hearing.cite");
    if (late) bump("discipline.charge.maxDays", 1, true);
    if (face.id === "defence") {
      const sign = checkSignDisciplineGate(item, { today: day, cases });
      if (!sign.ok && (sign.error === "DISCIPLINE_MONTH_CAP" || sign.error === "DISCIPLINE_SUSPEND_MONTH_CAP" || sign.error === "DISCIPLINE_FINE_OVER_CAP")) {
        bump("discipline.fine.maxDays", 1, true);
      }
    }
    if (item.offSite || item.place === "offsite") bump("discipline.workplace.cite");
    if (!double.ok) bump("discipline.fine.maxDays", 1, true);
    if (!repeat.ok) bump("discipline.repeat.cooloffDays", 1, true);
    if (face.id === "objected") bump("discipline.appeal.internalDays");
    if (face.id === "objected" && !ruling.ok) bump("discipline.appeal.internalDays", 1, true);
    if (signedAt && resolvePenaltyKind(item) === "fine" && effectiveCutDays(item) > 0) bump("discipline.fines.register.cite");
    if (isErasedFromEmployeeRecord(item, day)) bump("discipline.record.eraseDays");
  }

  const rows = LAW_CATALOG
    .filter((row) => filter === "all" || row.kind === filter)
    .map((row) => {
      const cite = citeRule(row.ruleId, day);
      const n = live[row.ruleId] || 0;
      const blockedN = blocked[row.ruleId] || 0;
      const art = cite?.article || "—";
      return {
        id: row.ruleId,
        art,
        kind: row.kind,
        kindLabel: ar ? LAW_KIND[row.kind].ar : LAW_KIND[row.kind].en,
        head: ar ? row.headAr : row.headEn,
        applied: ar ? LAW_APPLIED[row.ruleId].ar : LAW_APPLIED[row.ruleId].en,
        live: n,
        blocked: blockedN,
        rowBg: "var(--nv-card)",
        numColor: blockedN ? "var(--nv-bad-ink)" : n ? "var(--nv-warn-ink)" : "var(--nv-navy)",
        tag: blockedN
          ? (ar
            ? `مُنعت بها ${countAr(blockedN, "حالة واحدة", "حالتان", "حالات", "حالة")}`
            : `Blocked ${blockedN} action(s)`)
          : n
            ? (ar
              ? `تنطبق الآن على ${countAr(n, "ملف واحد", "ملفين", "ملفات", "ملفاً")}`
              : `Applies now to ${n} file(s)`)
            : (ar ? LAW_KIND[row.kind].ar : LAW_KIND[row.kind].en),
        tagColor: blockedN ? "var(--nv-bad-ink)" : n ? "var(--nv-warn-ink)" : "var(--nv-ink2)",
        tagBg: blockedN ? "var(--nv-bad-soft)" : "transparent",
        tagBorder: blockedN ? "var(--nv-bad-line)" : n ? "var(--nv-warn-line)" : "var(--nv-line)",
      };
    });

  return {
    rows,
    filter,
    filters: Object.entries(LAW_KIND).map(([id, labels]) => ({
      id,
      label: ar ? labels.ar : labels.en,
    })),
    note: ar
      ? "المادة المنطبقة تُوسم بعدّ الملفات، والتي منعت إجراءً تُوسم بسببها. المنصة تعرض الرقم ولا تُفتي."
      : "An article that applies is marked with the file count, and one that blocked an action is marked with its reason. The platform shows the number and does not give a fatwa.",
  };
}

export { employeeContractWage, buildDisciplineRegister };
