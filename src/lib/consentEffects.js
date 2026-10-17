/**
 * What a signed (or refused) written consent actually unlocks or blocks.
 *
 *   المادة 58 — لا نقل يقتضي تغيير محل الإقامة بغير موافقة كتابية؛ والضرورة العارضة حتى 30 يوماً في السنة
 *               على حساب صاحب العمل في الانتقال والإقامة.
 *   المادة 59 — لا تحويل من الأجر الشهري إلى يومي أو أسبوعي أو بالقطعة أو بالساعة بغير موافقة كتابية.
 *   المادة 60 — لا تكليف بعمل يختلف جوهرياً بغير موافقة كتابية، إلا لضرورة عارضة حتى 30 يوماً في السنة.
 *   المادة 107 — الإجازة التعويضية بدل أجر الإضافي بموافقة العامل؛ دونها يُصرف الأجر.
 *
 * A consent for a move (58), a wage-type change (59) or different work (60) is used once — it is
 * spent by the action it allowed, so one signature cannot cover the next move. The overtime consent
 * (107) is standing: the latest answer governs until the worker answers a new request.
 */

import { WRITTEN_CONSENT_TYPE } from "./writtenConsent.js";
import { regulationDate } from "./workRegulation.js";

const daysAr = (n) => (n === 1 ? "يوماً واحداً" : n === 2 ? "يومين" : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يوماً`);

export const SINGLE_USE_TOPICS = new Set(["site", "wage_type", "different_work"]);
export const NECESSITY_CAP_DAYS = 30;

const dateOnly = (v) => {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/** Written consents of one topic, newest first. */
export function consentsOf(employee, topic) {
  return (employee?.otherRequests || [])
    .filter((row) => row?.type === WRITTEN_CONSENT_TYPE && row.topic === topic)
    .sort((a, b) => String(b.answeredAt || b.createdAt || "").localeCompare(String(a.answeredAt || a.createdAt || "")));
}

/**
 * Where the person stands on a topic now: "signed" (usable), "refused", "open" (awaiting reply)
 * or "none". Spent single-use consents are skipped.
 */
export function consentState(employee, topic) {
  const rows = consentsOf(employee, topic).filter((row) => !(SINGLE_USE_TOPICS.has(topic) && row.usedAt));
  const row = rows[0];
  if (!row) return { state: "none", row: null };
  const status = row.status || "open";
  if (status === "yes") return { state: "signed", row };
  if (status === "no") return { state: "refused", row };
  return { state: "open", row };
}

const WHAT = {
  site: { ar: "نقله إلى مكان يقتضي تغيير محل إقامته", en: "moving them somewhere that changes their residence", art: "58" },
  wage_type: { ar: "تحويل أجره من شهري إلى يومي أو أسبوعي أو بالقطعة أو بالساعة", en: "moving their pay off the monthly wage", art: "59" },
  different_work: { ar: "تكليفه بعمل يختلف جوهرياً عن المتفق عليه", en: "assigning substantially different work", art: "60" },
  ot: { ar: "إجازة تعويضية بدل أجر ساعاته الإضافية", en: "compensatory leave instead of overtime pay", art: "107" },
};

/**
 * Gate for an action that needs the worker's written consent.
 * Returns { ok, consent?, error, reason, reasonEn }.
 */
export function checkConsentGate(employee, topic, { ar = true } = {}) {
  const what = WHAT[topic] || { ar: "هذا الإجراء", en: "this action", art: "" };
  const name = employee?.name || (ar ? "الموظف" : "the worker");
  const { state, row } = consentState(employee, topic);
  if (state === "signed") return { ok: true, consent: row };
  if (state === "refused") {
    return {
      ok: false,
      error: "CONSENT_REFUSED",
      reason: `موقوف — رفض ${name} كتابياً ${what.ar}${row?.answeredAt ? ` بتاريخ ${dateOnly(row.answeredAt)}` : ""} (المادة ${what.art}). الرفض لا يُتخذ سبباً لجزاء.`,
      reasonEn: `Blocked — ${name} refused ${what.en} in writing (Art. ${what.art}).`,
    };
  }
  if (state === "open") {
    return {
      ok: false,
      error: "CONSENT_PENDING",
      reason: `موقوف — طلب موافقة ${name} على ${what.ar} لم يُجَب بعد${row?.deadline ? ` (المهلة ${dateOnly(row.deadline)})` : ""} (المادة ${what.art}).`,
      reasonEn: `Blocked — ${name} has not answered the consent request yet (Art. ${what.art}).`,
    };
  }
  return {
    ok: false,
    error: "CONSENT_REQUIRED",
    reason: `موقوف — ${what.ar} يحتاج موافقته الكتابية (المادة ${what.art}). أرسلها من الطلبات ← رفع طلب لموظف ← طلب موافقة خطية.`,
    reasonEn: `Blocked — ${what.en} needs their written consent (Art. ${what.art}). Send it from Requests → File for a worker → Written consent.`,
  };
}

/** Inclusive days of [from, until] that fall inside `year`. */
function daysInYear(from, until, year) {
  const a = dateOnly(from);
  const b = dateOnly(until) || a;
  if (!a) return 0;
  const start = a < `${year}-01-01` ? `${year}-01-01` : a;
  const end = b > `${year}-12-31` ? `${year}-12-31` : b;
  if (end < start) return 0;
  return Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1;
}

/** The day a temporary assignment really ends: when it was ended, else its date — or today if overdue. */
export function necessityEnd(row, today) {
  if (row?.endedAt) return dateOnly(row.endedAt);
  const until = dateOnly(row?.until);
  const t = dateOnly(today);
  return t && until && t > until ? t : until;
}

/** Days already used this year under the incidental-necessity exception for `kind` ("site" | "work").
 * Days past the end date while the person was not returned count too. */
export function necessityDaysUsed(employee, kind, year, today) {
  return (employee?.necessityLog || [])
    .filter((row) => row.kind === kind && !row.voidedAt)
    .reduce((sum, row) => sum + daysInYear(row.from, necessityEnd(row, today), year), 0);
}

export const NECESSITY_SOON_DAYS = 3;

/** Temporary assignments still running: { row, left, over, overBy }, soonest first. */
export function activeNecessities(employee, today) {
  const t = dateOnly(today) || new Date().toISOString().slice(0, 10);
  return (employee?.necessityLog || [])
    .filter((row) => !row.endedAt && !row.voidedAt && dateOnly(row.until))
    .map((row) => {
      const left = Math.round((new Date(`${dateOnly(row.until)}T00:00:00Z`) - new Date(`${t}T00:00:00Z`)) / 86400000);
      return { row, left, over: left < 0, overBy: left < 0 ? -left : 0, used: necessityDaysUsed(employee, row.kind, t.slice(0, 4), t) };
    })
    .sort((a, b) => a.left - b.left);
}

export function necessityId(row) {
  return row?.id || row?.transferId || `${row?.kind}-${row?.from}-${row?.until}`;
}

/** One plain line for a running temporary assignment. */
export function necessityText(item, name = "", ar = true) {
  const { row, left, over, overBy, used } = item;
  const who = String(name || "").trim() || (ar ? "الموظف" : "The worker");
  const site = row.kind === "site";
  const what = site
    ? (ar ? `تكليفه المؤقت في ${row.toStationName || "الفرع الآخر"}` : `the temporary posting at ${row.toStationName || "the other branch"}`)
    : (ar ? `تكليفه المؤقت بعمل «${row.toTitle || "مختلف"}»` : `the temporary “${row.toTitle || "different"}” work`);
  const back = site
    ? (ar ? `أعده إلى ${row.fromStationName || "فرعه السابق"}` : `return them to ${row.fromStationName || "their branch"}`)
    : (ar ? `أعد مسمّاه «${row.fromTitle || "السابق"}»` : `restore “${row.fromTitle || "the previous title"}”`);
  const art = site ? "58/2" : "60";
  if (over) {
    return ar
      ? `تجاوز ${who} ${what} بـ${daysAr(overBy)} (انتهى ${regulationDate(row.until)}) — كل يوم يُحسب من الثلاثين (المستخدم ${used})، وبعدها لا يستمر إلا بموافقته الكتابية. ${back} (المادة ${art}).`
      : `${who} is ${overBy} day(s) past ${what} (ended ${row.until}) — each day counts toward the 30 (used ${used}). ${back} (Art. ${art}).`;
  }
  const when = left === 0 ? (ar ? "ينتهي اليوم" : "ends today") : left === 1 ? (ar ? "ينتهي غداً" : "ends tomorrow") : (ar ? `ينتهي بعد ${daysAr(left)} (${regulationDate(row.until)})` : `ends in ${left} days (${row.until})`);
  return ar ? `${what.replace("تكليفه", `تكليف ${who}`)} ${when} — ${back} (المادة ${art}).` : `${who}: ${what} ${when} — ${back} (Art. ${art}).`;
}

function necessityStage(item) {
  if (item.over) return "over";
  if (item.left === 0) return "0";
  if (item.left <= NECESSITY_SOON_DAYS) return "3";
  return "";
}

/**
 * Reminders to send now: managers 3 days before, on the last day, and once overdue; the worker on
 * the last day and once overdue. Each key fires once. [{ userId, key, text, to }]
 */
export function planNecessityNotices({ data, today, existingKeys = [], audienceOf, ar = true } = {}) {
  const seen = new Set((existingKeys || []).filter(Boolean));
  const plans = [];
  const push = (userId, key, text, to) => {
    if (!userId || seen.has(key)) return;
    seen.add(key);
    plans.push({ userId, key, text, to });
  };
  for (const employee of data?.employees || []) {
    for (const item of activeNecessities(employee, today)) {
      const stage = necessityStage(item);
      if (!stage) continue;
      const id = necessityId(item.row);
      const to = `/app/employees/${employee.id}?tab=growth`;
      for (const m of (audienceOf ? audienceOf(employee) : []).filter((u) => u?.id && String(u.id) !== String(employee.id))) {
        push(m.id, `necessity:${employee.id}:${id}:${stage}:${m.id}`, necessityText(item, employee.name, ar), to);
      }
      if (stage === "0" || stage === "over") {
        const site = item.row.kind === "site";
        push(employee.id, `necessity:${employee.id}:${id}:${stage}:self`, ar
          ? (stage === "0"
            ? `ينتهي اليوم تكليفك المؤقت ${site ? `في ${item.row.toStationName || "الفرع الآخر"}` : `بعمل «${item.row.toTitle || ""}»`}. ${site ? "تعود إلى فرعك، وتكاليف انتقالك وإقامتك على المنشأة (المادة 58/2)." : "تعود إلى عملك المتفق عليه (المادة 60)."}`
            : `انتهت مدة تكليفك المؤقت في ${regulationDate(item.row.until)}، ولا يستمر بعد الثلاثين يوماً في السنة إلا بموافقتك الكتابية (المادة ${site ? "58" : "60"}).`)
          : (stage === "0" ? "Your temporary assignment ends today." : `Your temporary assignment ended on ${item.row.until}; it cannot go past 30 days a year without your written consent.`), "/app/requests");
      }
    }
  }
  return plans;
}

/** 58/2 and 60 — the incidental-necessity exception: a dated span, within 30 days a year. */
export function checkNecessityGate(employee, kind, { from, until, ar = true } = {}) {
  const a = dateOnly(from);
  const b = dateOnly(until);
  const art = kind === "site" ? "58" : "60";
  if (!a || !b) {
    return { ok: false, error: "NECESSITY_DATES", reason: `حدّد حتى متى — الضرورة العارضة مؤقتة ولا تتجاوز ${NECESSITY_CAP_DAYS} يوماً في السنة (المادة ${art}).`, reasonEn: `Set an end date — incidental necessity is temporary, up to ${NECESSITY_CAP_DAYS} days a year (Art. ${art}).` };
  }
  if (b < a) return { ok: false, error: "NECESSITY_DATES", reason: "تاريخ الانتهاء قبل البداية.", reasonEn: "The end is before the start." };
  const years = [...new Set([a.slice(0, 4), b.slice(0, 4)])];
  for (const y of years) {
    const used = necessityDaysUsed(employee, kind, y, a);
    const add = daysInYear(a, b, y);
    if (used + add > NECESSITY_CAP_DAYS) {
      return {
        ok: false,
        error: "NECESSITY_CAP",
        reason: `موقوف — الضرورة العارضة لا تتجاوز ${NECESSITY_CAP_DAYS} يوماً في السنة (المادة ${art}). استُخدم ${used} في ${y} وهذا ${add}. بعدها يلزم موافقته الكتابية.`,
        reasonEn: `Blocked — incidental necessity may not exceed ${NECESSITY_CAP_DAYS} days a year (Art. ${art}). Used ${used} in ${y}, this adds ${add}.`,
      };
    }
  }
  return { ok: true, days: daysInYear(a, b, a.slice(0, 4)) + (years.length > 1 ? daysInYear(a, b, b.slice(0, 4)) : 0) };
}

/** Spend a single-use consent on the action it allowed (mutates the request inside an update). */
export function spendConsent(request, { what, by, at } = {}) {
  if (!request) return;
  request.usedAt = at || new Date().toISOString();
  request.usedFor = String(what || "");
  request.usedBy = by || "";
}

/** One line under a consent: what it does now, in plain words. */
export function consentEffectLine(row, ar = true) {
  const what = WHAT[row?.topic];
  if (!what) return "";
  const status = row.status || "open";
  if (status === "open") return ar ? "لا أثر قبل رده — الإجراء موقوف حتى يوقّع." : "No effect until they answer — the action waits.";
  if (status === "no") {
    return row.topic === "ot"
      ? (ar ? "يُصرف له أجر الإضافي — لا إجازة تعويضية بدلاً منه." : "Overtime is paid — no compensatory leave instead.")
      : (ar ? `يمنع ${what.ar}${row.topic === "wage_type" ? "" : " — إلا لضرورة عارضة حتى 30 يوماً في السنة"}.` : `Blocks ${what.en}.`);
  }
  if (row.topic === "ot") return ar ? "تتيح احتساب إجازة تعويضية بدل أجر الإضافي في قرارات الإضافي." : "Allows compensatory leave instead of overtime pay.";
  if (row.usedAt) return ar ? `استُخدمت في: ${row.usedFor || what.ar} — ${dateOnly(row.usedAt)}.` : `Used for: ${row.usedFor || what.en} — ${dateOnly(row.usedAt)}.`;
  return ar ? `تتيح ${what.ar} مرة واحدة.` : `Allows ${what.en} once.`;
}

export const WAGE_TYPE_OPTIONS = [
  { value: "monthly", ar: "شهري", en: "Monthly" },
  { value: "daily", ar: "يومي", en: "Daily" },
  { value: "weekly", ar: "أسبوعي", en: "Weekly" },
  { value: "piece", ar: "بالقطعة", en: "Piece rate" },
  { value: "hourly", ar: "بالساعة", en: "Hourly" },
];

const norm = (v) => String(v || "").trim().replace(/\s+/g, " ");

/**
 * The employee-file save, checked against Arts. 59 and 60.
 *   wage type: leaving "monthly" needs a signed wage_type consent (spent by this save).
 *   title: a changed title asks what it is — "minor" (same work, wording), "essential" (signed
 *          different_work consent, spent) or "necessity" (temporary, within 30 days a year).
 * Returns { ok, spend: [{ consentId, what }], necessity, needsPositionChoice, error, reason, reasonEn }.
 */
export function checkFileChangeConsentGate({ employee, before = {}, after = {}, positionChange = "", necessityUntil = "", today = "" } = {}) {
  const spend = [];
  let necessity = null;
  const fromType = norm(before.wageType) || "monthly";
  const toType = norm(after.wageType) || fromType;
  if (fromType === "monthly" && toType !== "monthly" && WAGE_TYPE_OPTIONS.some((o) => o.value === toType)) {
    const gate = checkConsentGate(employee, "wage_type");
    if (!gate.ok) return gate;
    const label = WAGE_TYPE_OPTIONS.find((o) => o.value === toType)?.ar || toType;
    spend.push({ consentId: gate.consent.id, what: `تحويل الأجر من شهري إلى ${label}` });
  }
  const fromTitle = norm(before.position);
  const toTitle = norm(after.position);
  if (fromTitle && toTitle && fromTitle !== toTitle) {
    if (!["minor", "essential", "necessity"].includes(positionChange)) {
      return {
        ok: false,
        error: "POSITION_CHANGE_KIND",
        needsPositionChoice: true,
        reason: "تغيّر المسمّى — حدّد: تصحيح في التسمية لنفس العمل، أم عمل يختلف جوهرياً (المادة 60)؟",
        reasonEn: "The title changed — say whether it is a wording fix for the same work or substantially different work (Art. 60).",
      };
    }
    if (positionChange === "essential") {
      const gate = checkConsentGate(employee, "different_work");
      if (!gate.ok) return gate;
      spend.push({ consentId: gate.consent.id, what: `تكليف بعمل مختلف: من «${fromTitle}» إلى «${toTitle}»` });
    }
    if (positionChange === "necessity") {
      const from = dateOnly(today) || new Date().toISOString().slice(0, 10);
      const gate = checkNecessityGate(employee, "work", { from, until: necessityUntil });
      if (!gate.ok) return gate;
      necessity = { id: `nec_work_${from}_${Date.now().toString(36)}`, kind: "work", from, until: dateOnly(necessityUntil), what: `من «${fromTitle}» إلى «${toTitle}»`, fromTitle, toTitle };
    }
  }
  return { ok: true, spend, necessity };
}

/** For the worker before answering: what agreeing does, and what refusing does. */
export function consentChoiceLines(topic, ar = true) {
  const what = WHAT[topic];
  if (!what) return null;
  if (topic === "ot") {
    return {
      yes: ar ? "إن وافقت: يجوز أن تُعطى أيام إجازة مدفوعة بدل أجر ساعاتك الإضافية." : "If you agree: paid leave days may replace your overtime pay.",
      no: ar ? "إن رفضت: يُصرف لك أجر الإضافي كاملاً، ولا يُتخذ الرفض سبباً لجزاء." : "If you refuse: your overtime is paid in full, and refusing is never grounds for a penalty.",
    };
  }
  return {
    yes: ar ? `إن وافقت: يجوز ${what.ar} مرة واحدة بهذه الموافقة.` : `If you agree: ${what.en} is allowed once on this consent.`,
    no: ar
      ? `إن رفضت: لا يجوز ${what.ar}${topic === "wage_type" ? "" : " إلا لضرورة عارضة حتى 30 يوماً في السنة"}، ولا يُتخذ الرفض سبباً لجزاء.`
      : `If you refuse: ${what.en} is not allowed, and refusing is never grounds for a penalty.`,
  };
}
