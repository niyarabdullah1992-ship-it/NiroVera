/**
 * «أنظمة الوزارة — ما يخص طلباتي» — the rows RequestsMinistryPanel lists, and the «الامتثال الوزاري»
 * index sums person by person. A row's status is read from the person's own requests:
 *   waiting → a request under that rule awaits a decision
 *   settled → a request under that rule was approved (or the file already carries it)
 *   void    → nothing filed yet (متاح) / information only (للعلم, `info`)
 * Hours, rest, overtime, night roster and sun-ban roster checks stay in the duty section. Pure.
 */
import { lawArticleCards } from "./requestWorkspace.js";
import { profileLeaveGender } from "./leaveDerivations.js";
import { injuryLeaves, injuryStatus } from "./workInjury.js";
import { nursingSplitLabel, nursingSplitOf } from "./dutyRequests.js";
import {
  annualLeaveRegsNote,
  disabilityDefinitionsRegsNote,
  missionModelNote,
  relocationModelNote,
  sickLeaveRegsNote,
  treatmentDaysRegsNote,
  unpaidLeaveRegsNote,
  workplaceClauseRegsNote,
} from "./implementingRegsNotes.js";

const PENDING = new Set(["pending", "pending_manager", "pending_employee", "open", "revise"]);

/** Which request types each rule covers. `info` rows never carry a status of their own. */
const LABOUR_TYPES = {
  109: ["annual"],
  110: ["annual"],
  111: [],
  113: ["marriage", "bereavement", "bereavement_sibling", "paternity"],
  114: ["hajj"],
  115: ["exam", "study_consent"],
  116: ["unpaid"],
  117: ["sick"],
  118: [],
  151: ["maternity", "maternity_extend", "maternity_companion"],
  160: ["iddah"],
  75: ["resignation"],
  "79 مكرر": ["resignation"],
  58: [],
  59: [],
  60: [],
};
const FEMALE_ONLY = new Set(["151", "160", "154"]);

/** Implementing Regulations that rest on a Labour Law article — read under that article's row. */
const REGS_ON_ARTICLE = {
  109: annualLeaveRegsNote,
  116: unpaidLeaveRegsNote,
  117: sickLeaveRegsNote,
  58: workplaceClauseRegsNote,
};

/** In the employee file leave lives in طلباتي and the duty tab holds the night medical report. */
const FILE_LABOUR = new Set(["75", "79 مكرر", "58", "59", "60"]);

function statusOf(types, requests, article) {
  const hits = requests.filter((row) => types.includes(row.type) || (article && String(row.article || "") === String(article) && row.type === "written_consent"));
  if (hits.some((row) => PENDING.has(row.status || "pending"))) return "waiting";
  if (hits.some((row) => (row.status || "") === "approved" || (row.status || "") === "signed")) return "settled";
  return "void";
}

function addDays(key, days) {
  const d = new Date(`${String(key).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** What approvals already wrote on the file — shown under the rule it comes from. */
function fileFacts(profile = {}, ar = true) {
  const facts = {};
  if (profile.pregnant && profile.expectedBirthDate) {
    const from = addDays(profile.expectedBirthDate, -24 * 7);
    facts.pregnancy = ar
      ? `على الملف: الولادة المتوقعة ${profile.expectedBirthDate} · لا عمل ليلي من ${from}`
      : `On file: expected birth ${profile.expectedBirthDate} · no night work from ${from}`;
  }
  if (profile.nursingHour) {
    const where = nursingSplitLabel(nursingSplitOf(profile.nursingHour), ar);
    const until = profile.nursingHour.until ? (ar ? ` حتى ${profile.nursingHour.until}` : ` until ${profile.nursingHour.until}`) : "";
    facts.nursing = ar ? `على الملف: ${where}${until}` : `On file: ${where}${until}`;
  }
  const exit = profile.contractExit;
  if (exit && exit.reason === "resignation") {
    facts.resignation = ar
      ? `على الملف: إنهاء بالاستقالة${exit.effectiveDate ? ` · آخر يوم ${exit.effectiveDate}` : ""}`
      : `On file: ended by resignation${exit.effectiveDate ? ` · last day ${exit.effectiveDate}` : ""}`;
  }
  return facts;
}

export function requestsMinistryRows({ subject, liveArticle = "", liveKind = "", lang = "ar", ar = true, fileMode = false, today } = {}) {
  const day = today || new Date().toISOString().slice(0, 10);
  const requests = [...(subject?.leaveRequests || []), ...(subject?.otherRequests || [])];
  const gender = profileLeaveGender(subject?.profile);
  const facts = fileFacts(subject?.profile || {}, ar);
  const list = [];
  const keep = (art) => !(gender === "male" && FEMALE_ONLY.has(String(art)));
  lawArticleCards("requests", liveArticle, lang)
    .filter((card) => card.source !== "product" && card.citeKind !== "ops")
    .filter((card) => keep(card.art))
    .filter((card) => !fileMode || FILE_LABOUR.has(String(card.art)))
    .forEach((card) => {
      const types = LABOUR_TYPES[card.art] || [];
      const info = !types.length && !["58", "59", "60"].includes(String(card.art));
      list.push({
        key: `labour-${card.art}`,
        source: "labour",
        badge: ar ? `م ${card.art}` : `Art. ${card.art}`,
        title: card.name || (ar ? `المادة ${card.art}` : `Article ${card.art}`),
        note: [card.impl || card.hint || "", REGS_ON_ARTICLE[card.art]?.(ar) || ""].filter(Boolean).join(" · "),
        status: info ? "void" : (facts.resignation && types.includes("resignation") ? "settled" : statusOf(types, requests, card.art)),
        sub: types.includes("resignation") ? facts.resignation : undefined,
        info,
        live: card.live,
      });
    });
  if (keep("154")) {
    list.push({
      key: "labour-154",
      source: "labour",
      badge: ar ? "م 154" : "Art. 154",
      title: ar ? "ساعة الرضاعة" : "Nursing hour",
      note: ar ? "ساعة يومياً تُحسب من ساعات العمل الفعلية بلا خصم، أول الدوام أو آخره — يُخصم بها التأخير في سجلك." : "One hour a day counted as work, start or end of shift — lateness on your record is reduced by it.",
      status: facts.nursing ? "settled" : statusOf(["nursing_hour"], requests),
      sub: facts.nursing,
      live: liveKind === "nursing_hour",
    });
  }
  // Model Art. 42 + Annex 2 — dialysis and treatment days are paid leave on the provider's report.
  // Leave lives in طلباتي; the employee file keeps only contract rules.
  if (!fileMode) list.push({
    key: "model-42",
    source: "labour",
    badge: ar ? "النموذج الموحد م42" : "Model Art. 42",
    title: ar ? "الغسيل الكلوي وأيام العلاج — الملحق 2" : "Dialysis and treatment days — Annex 2",
    note: `${treatmentDaysRegsNote(ar)} — ${disabilityDefinitionsRegsNote(ar)}`,
    status: statusOf(["dialysis"], requests),
    live: liveKind === "leave:dialysis",
  });
  // Model Arts. 9/12 and 24 — relocation expenses (the worker claims) and missions (the manager decides);
  // both are repaid with the wage. Leave and duty rows above; the pay effect reads in قسيمتي.
  if (!fileMode) {
    list.push({
      key: "model-12",
      source: "labour",
      badge: ar ? "النموذج الموحد م9·12" : "Model Arts. 9·12",
      title: ar ? "نفقات النقل مع تغيير السكن" : "Relocation expenses",
      note: relocationModelNote(ar),
      status: statusOf(["relocation_expenses"], requests),
      live: liveKind === "relocation",
    });
    list.push({
      key: "model-24",
      source: "labour",
      badge: ar ? "النموذج الموحد م24" : "Model Art. 24",
      title: ar ? "الانتداب وبدله" : "Missions and their allowance",
      note: missionModelNote(ar),
      status: statusOf(["mission"], requests),
      live: liveKind === "mission",
    });
  }
  const injuryOnFile = injuryLeaves(subject).length > 0;
  if (!fileMode || injuryOnFile) list.push({
    key: "labour-gosi",
    source: "labour",
    badge: ar ? "التأمينات" : "GOSI",
    title: ar ? "إجازة إصابة العمل" : "Work-injury leave",
    note: ar ? "بتقرير طبي — تُعوَّض عبر فرع الأخطار المهنية في التأمينات الاجتماعية، لا من رصيدك." : "With a medical report — compensated through GOSI occupational hazards, not from your balance.",
    status: statusOf(["work_injury"], requests),
    sub: (() => {
      const st = injuryOnFile ? injuryStatus({ employee: subject, company: subject?.__company, today: day }) : null;
      if (!st) return undefined;
      return ar
        ? `إصابة ${st.injuryDate} · يوم العلاج ${st.dayIndex}${st.active ? " (جارٍ)" : ""}${st.art139 ? " · سقط الحق (139)" : ""}`
        : `Injury ${st.injuryDate} · treatment day ${st.dayIndex}${st.active ? " (ongoing)" : ""}${st.art139 ? " · right lost (139)" : ""}`;
    })(),
    live: liveKind === "leave:work_injury",
  });
  // In the file the week panel above already judges the 3-month night consent.
  if (!fileMode) list.push({
    key: "18632-consent",
    source: "18632",
    title: ar ? "موافقة العمل الليلي الخطية" : "Written night-work consent",
    note: ar ? "بعد ثلاثة أشهر ليلية متصلة يلزم اختيارك: موافقة خطية، أو تقليص الساعات، أو تدوير الفترة. لك سحبها." : "After three straight night months you choose: written consent, fewer hours, or rotation. You may withdraw it.",
    status: statusOf(["night_consent"], requests),
    live: liveKind === "night_consent",
  });
  if (!fileMode) list.push({
    key: "18632-fitness",
    source: "18632",
    title: ar ? "إعفاء من العمل الليلي بتقرير طبي" : "Medical exemption from night work",
    note: ar ? "تقرير يثبت عدم اللياقة للعمل الليلي — يمنع الجدول إسنادك لليل خلال مدته." : "A report of unfitness for night work — the roster blocks night shifts for its duration.",
    status: statusOf(["night_fitness"], requests),
    live: liveKind === "night_fitness",
  });
  list.push({
    key: "18632-family",
    source: "18632",
    title: ar ? "مسؤوليات عائلية — مراعاة في الإسناد الليلي" : "Family responsibilities — considered at night",
    note: ar ? "القرار 18632 (هـ): يُراعى قدر الإمكان أصحاب المسؤوليات العائلية وكبار السن (50 فأكثر تلقائياً) عند الإسناد الليلي — مراعاة لا مانع." : "Decision 18632 (e): family responsibilities and older workers (50+ automatically) are considered for night assignment — not a block.",
    status: subject?.profile?.familyResponsibilities === true || subject?.profile?.familyResponsibilities === "yes" ? "settled" : statusOf(["family_duties"], requests),
    sub: subject?.profile?.familyResponsibilities === true || subject?.profile?.familyResponsibilities === "yes"
      ? (ar ? `على الملف${subject?.profile?.familyResponsibilitiesSince ? ` منذ ${subject.profile.familyResponsibilitiesSince}` : ""}` : "On file")
      : undefined,
    live: liveKind === "family_duties",
  });
  if (keep("154")) {
    list.push({
      key: "18632-pregnancy",
      source: "18632",
      title: ar ? "إبلاغ الحمل" : "Pregnancy notice",
      note: ar ? "بعد الاعتماد لا عمل ليلي في الـ24 أسبوعاً قبل الوضع، ويُوفَّر عمل مناسب في الساعات المعتادة." : "Once approved, no night work in the 24 weeks before birth; ordinary-hours work is offered.",
      status: facts.pregnancy ? "settled" : statusOf(["pregnancy_notice"], requests),
      sub: facts.pregnancy,
      live: liveKind === "pregnancy_notice",
    });
  }
  // Decision 3337 report lives in صوت الموظف (channel «heat», HR-only), not in the requests ledger.
  return list;
}
