/**
 * الإيذاء في مكان العمل — the unified model work regulation (Implementing Regulations, Annex 1):
 *
 *   م54 — الإيذاء: كل إساءة إيجابية أو سلبية، وكل استغلال أو ابتزاز أو إغراء أو تهديد، جسدياً أو نفسياً أو
 *         جنسياً، يقع في مكان العمل من صاحب العمل على العامل، أو من العامل على صاحب العمل، أو من عامل على
 *         آخر أو على أي شخص في مكان العمل — بالقول أو الكتابة أو الإشارة أو الإيحاء أو الرسم أو الهاتف أو
 *         الوسائل الإلكترونية. والمساعدة والتستر عليه في حكمه.
 *   م55/1 — لمن وقع عليه الإيذاء — دون إخلال بحقه في الالتجاء إلى الجهات الحكومية — أن يشتكي للمنشأة خلال
 *         خمسة أيام عمل من وقوعه، ولكل من شاهده أو اطلع عليه أن يبلغ. فإن وقع من صاحب المنشأة أو أعلى سلطة
 *         فيها فالشكوى للجهة الحكومية المختصة.
 *   م55/2 — تُشكَّل لجنة بقرار من المسؤول المختص تحقق وتطلع على الأدلة وتوصي بالجزاء خلال خمسة أيام عمل من
 *         تلقي الشكوى أو البلاغ.
 *   م56 — سرية؛ سماع الأطراف والشهود في محاضر يوقعونها ويوقعها أعضاء اللجنة في نهاية كل صفحة؛ استدعاء من
 *         تراه؛ التوصية بالتفريق بين الطرفين أثناء التحقيق؛ التوصية بالجزاء بالأغلبية عند الثبوت؛ رفع ما يشكل
 *         جريمة جنائية للمدير العام لإبلاغ الجهات الحكومية؛ جزاء المبلّغ إن ثبت أن البلاغ كيدي؛ ولا يمنع الجزاء
 *         التأديبي لجوء المعتدى عليه للجهات الحكومية.
 *   م45/1 — تعامل المنشأة العمال بالاحترام اللائق؛ م71/1 — لا يضار العامل من تقديم تظلمه.
 *
 * Pure module (node-testable). Cases live in `data.abuseCases`.
 */

import { isOfficialHoliday } from "./ummAlQuraCalendar.js";

export const ABUSE_WORKING_DAYS = 5;

export const ABUSE_KINDS = [
  { id: "physical", ar: "جسدي", en: "Physical" },
  { id: "psychological", ar: "نفسي — إساءة أو تهديد أو ابتزاز", en: "Psychological — abuse, threat or blackmail" },
  { id: "sexual", ar: "جنسي — تحرش أو إيحاء أو استدراج", en: "Sexual — harassment, suggestion or luring" },
  { id: "verbal", ar: "قولي أو كتابي أو بالإشارة", en: "Verbal, written or by gesture" },
  { id: "electronic", ar: "بالهاتف أو بالوسائل الإلكترونية", en: "By phone or electronic means" },
];

export const ABUSE_OUTCOMES = [
  { id: "proven", ar: "ثبتت الواقعة — توصية بالجزاء على المعتدي (م56/4)", en: "Proven — penalty recommended for the aggressor (Art. 56(4))" },
  { id: "not_proven", ar: "لم تثبت الواقعة", en: "Not proven" },
  { id: "malicious", ar: "لم تثبت والبلاغ كيدي — توصية بجزاء المبلّغ (م56/6)", en: "Not proven and malicious — penalty recommended for the reporter (Art. 56(6))" },
];

/** The government path when the internal route is closed (م55/1) or a crime is involved (م56/5). */
export const ABUSE_GOV_PATH_AR = "الجهة الحكومية المختصة: وزارة الموارد البشرية والتنمية الاجتماعية (مكتب العمل المختص أو قنوات البلاغات الرسمية)، وفي ما يشكل جريمة جنائية: الجهات الأمنية أو النيابة العامة.";
export const ABUSE_GOV_PATH_EN = "The competent government body: the Ministry of Human Resources and Social Development (the labour office or its official reporting channels); for a criminal act, the police or the Public Prosecution.";

function dateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function addDay(iso, n = 1) {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** A working day: not a weekly rest day (default Friday and Saturday) and not an official holiday. */
export function isWorkingDay(iso, { calendar, restWeekdays = [5, 6] } = {}) {
  const d = dateOnly(iso);
  if (!d) return false;
  const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
  if ((restWeekdays || []).includes(wd)) return false;
  return !isOfficialHoliday(d, calendar);
}

/** The last day of an `n`-working-day window that starts the day after `from`. */
export function addWorkingDays(from, n, opts = {}) {
  let cursor = dateOnly(from);
  if (!cursor) return "";
  let counted = 0;
  let guard = 0;
  while (counted < n && guard < 120) {
    cursor = addDay(cursor, 1);
    guard += 1;
    if (isWorkingDay(cursor, opts)) counted += 1;
  }
  return cursor;
}

/** Working days used between `from` (exclusive) and `to` (inclusive). */
export function workingDaysBetween(from, to, opts = {}) {
  const a = dateOnly(from);
  const b = dateOnly(to);
  if (!a || !b || b <= a) return 0;
  let n = 0;
  let cursor = a;
  let guard = 0;
  while (cursor < b && guard < 800) {
    cursor = addDay(cursor, 1);
    guard += 1;
    if (isWorkingDay(cursor, opts)) n += 1;
  }
  return n;
}

const fail = (error, reason, reasonEn, extra = {}) => ({ ok: false, error, reason, reasonEn, ...extra });

/**
 * Filing a complaint (the person harmed) or a report (a witness) — model Arts. 54–55(1).
 * `accusedTop` — the accused is the owner of the establishment or its highest authority.
 */
export function checkFileAbuseGate({ role = "victim", incidentAt, filedAt, kind, description = "", accusedId = "", accusedName = "", accusedTop = false, reporterId = "", calendar, restWeekdays } = {}) {
  const today = dateOnly(filedAt) || new Date().toISOString().slice(0, 10);
  if (accusedTop) {
    return fail(
      "ABUSE_TOP_AUTHORITY",
      `إذا كان الإيذاء من صاحب المنشأة أو من أعلى سلطة فيها فالشكوى تُقدَّم للجهة الحكومية المختصة لا للمنشأة (النموذج الموحد م55/1). ${ABUSE_GOV_PATH_AR}`,
      `When the abuse is by the owner or the top authority, the complaint goes to the competent government body, not the establishment (model Art. 55(1)). ${ABUSE_GOV_PATH_EN}`,
      { route: "government" },
    );
  }
  if (!ABUSE_KINDS.some((k) => k.id === kind)) return fail("ABUSE_KIND", "اختر نوع الإيذاء (النموذج م54).", "Pick the kind of abuse (model Art. 54).");
  const incident = dateOnly(incidentAt);
  if (!incident) return fail("ABUSE_INCIDENT_DATE", "اكتب تاريخ وقوع الواقعة.", "Enter the date of the incident.");
  if (incident > today) return fail("ABUSE_INCIDENT_FUTURE", "تاريخ الواقعة لا يكون بعد اليوم.", "The incident date cannot be after today.");
  if (!String(accusedId || accusedName || "").trim()) return fail("ABUSE_ACCUSED", "حدّد من صدر منه الإيذاء.", "Name who committed the abuse.");
  if (reporterId && accusedId && String(reporterId) === String(accusedId)) return fail("ABUSE_SELF", "لا تُرفع الشكوى على النفس.", "A complaint is not filed against oneself.");
  if (String(description || "").trim().length < 10) return fail("ABUSE_DESCRIPTION", "صف ما حدث بالتاريخ والمكان والشهود — 10 أحرف على الأقل.", "Describe what happened, with date, place and witnesses.");
  if (role !== "witness") {
    const lastDay = addWorkingDays(incident, ABUSE_WORKING_DAYS, { calendar, restWeekdays });
    if (today > lastDay) {
      return fail(
        "ABUSE_FILING_LATE",
        `مضت خمسة أيام عمل على الواقعة (آخرها ${lastDay}) — مهلة الشكوى للمنشأة انتهت (النموذج م55/1)، ويبقى حقك في الالتجاء إلى الجهة الحكومية المختصة. ${ABUSE_GOV_PATH_AR}`,
        `Five working days have passed since the incident (last day ${lastDay}) — the internal complaint window closed (model Art. 55(1)); your right to go to the government body stays. ${ABUSE_GOV_PATH_EN}`,
        { route: "government", lastDay },
      );
    }
  }
  return { ok: true, lastDay: role === "witness" ? "" : addWorkingDays(incident, ABUSE_WORKING_DAYS, { calendar, restWeekdays }) };
}

/** The case row a filing creates. Confidential: only the reporter and senior HR read it (blob rule "self"). */
export function planAbuseCase({ id, role = "victim", reporter, accused = {}, kind, incidentAt, place = "", description = "", witnesses = "", filedAt, files = [] } = {}) {
  const at = filedAt || new Date().toISOString();
  return {
    id: id || `abc_${Date.now().toString(36)}`,
    userId: reporter?.id || "",
    reporterId: reporter?.id || "",
    reporterName: reporter?.name || "",
    reporterRole: role === "witness" ? "witness" : "victim",
    accusedId: accused.id || "",
    accusedName: accused.name || "",
    kind,
    incidentAt: dateOnly(incidentAt),
    place: String(place || "").trim(),
    description: String(description || "").trim(),
    witnesses: String(witnesses || "").trim(),
    files,
    filedAt: at,
    status: "filed",
    confidential: true,
    committee: null,
    hearings: [],
    separation: null,
    outcome: null,
    referral: null,
    log: [{ at, text: role === "witness" ? "قُدِّم بلاغ شاهد (النموذج م55/1)." : "قُدِّمت الشكوى (النموذج م55/1)." }],
  };
}

export const ABUSE_STEPS = [
  { id: "filed", ar: "قُدِّمت", en: "Filed" },
  { id: "committee", ar: "شُكّلت اللجنة", en: "Committee formed" },
  { id: "investigating", ar: "تحقيق سري", en: "Confidential inquiry" },
  { id: "decided", ar: "توصية اللجنة", en: "Committee recommendation" },
  { id: "closed", ar: "أُغلق", en: "Closed" },
];

/** Model Art. 55(2): a committee by decision of the competent official — not the parties to the case. */
export function checkAbuseCommitteeGate(row, { members = [], decisionRef = "" } = {}) {
  const ids = (members || []).map((m) => String(m?.id || m)).filter(Boolean);
  if (!ids.length) return fail("ABUSE_COMMITTEE_EMPTY", "سمِّ عضواً واحداً على الأقل في لجنة التحقيق (النموذج م55/2).", "Name at least one committee member (model Art. 55(2)).");
  if (ids.includes(String(row?.accusedId || "")) || ids.includes(String(row?.reporterId || ""))) {
    return fail("ABUSE_COMMITTEE_PARTY", "لا يكون الشاكي أو المشكو في حقه عضواً في لجنة التحقيق.", "Neither party may sit on the committee.");
  }
  if (!String(decisionRef || "").trim()) return fail("ABUSE_COMMITTEE_DECISION", "اكتب رقم قرار تشكيل اللجنة من المسؤول المختص (النموذج م55/2).", "Enter the decision forming the committee (model Art. 55(2)).");
  return { ok: true };
}

/** Model Art. 56(1): every statement is in minutes signed by the speaker and by the committee on each page. */
export function checkAbuseHearingGate({ who = "", role = "", statement = "", signedByParty = false, signedByCommittee = false } = {}) {
  if (!String(who).trim() || !["complainant", "accused", "witness"].includes(role)) return fail("ABUSE_HEARING_WHO", "حدّد من سُمعت أقواله وصفته.", "Name who was heard and in what capacity.");
  if (String(statement || "").trim().length < 5) return fail("ABUSE_HEARING_TEXT", "دوّن الأقوال في المحضر.", "Record the statement in the minutes.");
  if (!signedByParty || !signedByCommittee) return fail("ABUSE_HEARING_SIGNED", "المحضر يوقعه صاحب الأقوال، ويوقعه أعضاء اللجنة في نهاية كل صفحة (النموذج م56/1).", "The minutes are signed by the speaker and by the committee on each page (model Art. 56(1)).");
  return { ok: true };
}

/** Closing with the committee's recommendation (model Art. 56(4–6)). */
export function checkAbuseOutcomeGate(row, { outcome, recommendation = "", criminal = false, referredAt = "" } = {}) {
  if (!row?.committee) return fail("ABUSE_NO_COMMITTEE", "لا توصية قبل تشكيل لجنة التحقيق (النموذج م55/2).", "No recommendation before the committee is formed.");
  const heard = row.hearings || [];
  if (!heard.some((h) => h.role === "complainant") || !heard.some((h) => h.role === "accused")) {
    return fail("ABUSE_PARTIES_UNHEARD", "تستمع اللجنة لجميع الأطراف قبل التوصية — الشاكي والمشكو في حقه (النموذج م56/1).", "The committee hears all parties before recommending (model Art. 56(1)).");
  }
  if (!ABUSE_OUTCOMES.some((o) => o.id === outcome)) return fail("ABUSE_OUTCOME", "اختر نتيجة التحقيق.", "Pick the outcome.");
  if ((outcome === "proven" || outcome === "malicious") && String(recommendation || "").trim().length < 5) {
    return fail("ABUSE_RECOMMENDATION", "اكتب الجزاء التأديبي الموصى به وبند لائحة تنظيم العمل.", "Write the recommended penalty and its regulation clause.");
  }
  if (criminal && !dateOnly(referredAt)) {
    return fail("ABUSE_CRIMINAL_REFERRAL", "الاعتداء الذي يشكل جريمة جنائية تُرفع شكواه للمدير العام لإبلاغ الجهات الحكومية المختصة — سجّل تاريخ الإحالة (النموذج م56/5).", "A criminal act is referred to the general manager to inform the authorities — record the referral date (model Art. 56(5)).");
  }
  return { ok: true };
}

/** The two five-working-day clocks of Art. 55, for the board and the due notices. */
export function abuseCaseClocks(row, { today, calendar, restWeekdays } = {}) {
  const day = dateOnly(today) || new Date().toISOString().slice(0, 10);
  const opts = { calendar, restWeekdays };
  const filed = dateOnly(row?.filedAt);
  const out = [];
  if (filed && !["decided", "closed"].includes(row?.status)) {
    const due = addWorkingDays(filed, ABUSE_WORKING_DAYS, opts);
    const left = ABUSE_WORKING_DAYS - workingDaysBetween(filed, day, opts);
    out.push({ id: "investigate", article: "55/2", due, left, over: day > due, soon: day <= due && left <= 2 });
  }
  return out;
}

/** Notices to send now: the inquiry clock (2 working days left, and once over). Each key fires once. */
export function planAbuseNotices({ cases = [], today, calendar, restWeekdays, audience = [], existingKeys = [], ar = true } = {}) {
  const seen = new Set(existingKeys || []);
  const out = [];
  for (const row of cases || []) {
    for (const c of abuseCaseClocks(row, { today, calendar, restWeekdays })) {
      const stage = c.over ? "over" : c.soon ? "2" : "";
      if (!stage) continue;
      for (const m of audience) {
        if (!m?.id || String(m.id) === String(row.accusedId)) continue;
        const key = `abuse:${row.id}:${c.id}:${stage}:${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          userId: m.id,
          key,
          to: "/app/complaints",
          text: c.over
            ? (ar ? `انقضت مهلة التحقيق في شكوى إيذاء (خمسة أيام عمل من تلقيها — النموذج م55/2). أكمل التحقيق ودوّن التوصية.` : `The five-working-day inquiry window on an abuse complaint has passed (model Art. 55(2)).`)
            : (ar ? `شكوى إيذاء: يبقى ${c.left} يوم عمل لانتهاء مهلة التحقيق (حتى ${c.due}) — النموذج م55/2.` : `Abuse complaint: ${c.left} working day(s) left to investigate (until ${c.due}).`),
        });
      }
    }
  }
  return out;
}

/**
 * No retaliation (model Art. 71(1) «لا يضار العامل»; Law Art. 61(1) respect and dignity): a sanction file
 * opened on the reporter after the filing is a review item for HR — not blocked, but named.
 */
export function abuseRetaliationFlags(row, disciplinaryCases = []) {
  const filed = dateOnly(row?.filedAt);
  if (!filed || !row?.reporterId) return [];
  return (disciplinaryCases || [])
    .filter((c) => String(c.employeeId) === String(row.reporterId) && dateOnly(c.createdAt) >= filed && c.rulingOutcome !== "void")
    .map((c) => ({
      caseId: c.id,
      at: dateOnly(c.createdAt),
      reason: "فُتح ملف جزاء على صاحب الشكوى بعد تقديمها — راجِع أنه غير متصل بها؛ لا يضار العامل من شكواه (النموذج م71/1).",
      reasonEn: "A sanction file was opened on the complainant after filing — confirm it is unrelated; no one is harmed for complaining.",
    }));
}

/** What a reporter or the committee sees as the case's stage. */
export function abuseStepIndex(row) {
  const i = ABUSE_STEPS.findIndex((s) => s.id === row?.status);
  return i < 0 ? 0 : i;
}
