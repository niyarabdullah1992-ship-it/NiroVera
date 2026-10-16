/**
 * The sanction's papers, printed on the platform's one sheet (printSheet):
 *
 *   قبل التوقيع — إبلاغ كتابي بما نُسب إلى العامل واستدعاء لسماع أقواله (المادة 71)، مع مهل المادة 69.
 *   بعد التوقيع — قرار توقيع الجزاء يُبلَّغ كتابةً، ومعه إثبات الإبلاغ: يداً بيد، أو بكتاب مسجّل على
 *   عنوانه في ملفه إن امتنع أو غاب، وحقّه في التظلّم ثم المحاكم العمالية (المادة 72).
 *   بعد الاستقرار — القرار كما استقرّ، بحيثيات البتّ في التظلّم إن وُجد.
 *
 * Pure builder (disciplineSheet) plus one print call.
 */

import { cutPhrase, effectivePenalty, fmtDisciplineDate, penaltyLabel } from "./disciplineBoard.js";
import { printSheet } from "./printSheet.js";
import { DISCIPLINE_DELIVERY_METHODS, art80Ground, disciplineRepeatLine, resolvePenaltyKind } from "./disciplineDerivations.js";

const TIME_AR = ["الأولى", "الثانية", "الثالثة", "الرابعة"];

function regulationLine(item, ar) {
  if (!item?.regulationRef) return "";
  const time = Number(item.regulationTime) || 0;
  const t = time ? (ar ? ` · المرة ${TIME_AR[time - 1] || time}` : ` · time ${time}`) : "";
  return `${item.regulationRef}${t}`;
}

/** Which paper this file prints as now. */
export function disciplinePaperKind(card) {
  const item = card?.item || {};
  if (!card?.signedAt) return "notice";
  if (item.rulingLabel || card.face?.id === "closed") return "settled";
  return "decision";
}

export function disciplineSheet(card, ar = true, { company = "" } = {}) {
  const item = card?.item || {};
  const kind = disciplinePaperKind(card);
  const name = card?.employee?.name || item.employeeId || "—";
  const offence = item.note || item.reason || "—";
  const reg = regulationLine(item, ar);
  const fineCut = Number(item.cutDays || 0) > 0 && resolvePenaltyKind(item) === "fine";

  const title = {
    notice: ar ? "إبلاغ كتابي بمخالفة واستدعاء لسماع الأقوال" : "Written notice of an offence and call to be heard",
    decision: ar ? "قرار توقيع جزاء تأديبي" : "Disciplinary sanction decision",
    settled: ar ? "قرار جزاء مستقرّ" : "Settled sanction decision",
  }[kind];

  const facts = [
    { label: ar ? "الموظف" : "Employee", value: name },
    { label: ar ? "الرقم الوظيفي" : "File no.", value: card?.fileCode && card.fileCode !== "—" ? card.fileCode : "", mono: true },
    { label: ar ? "الوظيفة" : "Job", value: card?.jobTitle && card.jobTitle !== "—" ? card.jobTitle : "" },
    { label: ar ? "الفرع" : "Branch", value: card?.station?.name || "" },
    { label: ar ? "تاريخ كشف المخالفة" : "Discovered on", value: fmtDisciplineDate(item.discoveredAt, ar), mono: true },
    { label: ar ? "تاريخ الإبلاغ" : "Notified on", value: fmtDisciplineDate(item.notifiedAt || item.createdAt, ar), mono: true },
    kind === "notice"
      ? { label: ar ? "الجزاء المقترح" : "Proposed sanction", value: penaltyLabel(item, ar) }
      : { label: ar ? "الجزاء" : "Sanction", value: effectivePenalty(item, ar) },
    kind !== "notice" ? { label: ar ? "المقدار (النموذج الموحد م68)" : "Amount (model Art. 68)", value: cutPhrase(item, card.wage, ar) } : null,
    kind !== "notice" ? { label: ar ? "الجزاء عند التكرار" : "On repeat", value: disciplineRepeatLine(item, ar), wide: true } : null,
    resolvePenaltyKind(item) === "dismiss" && art80Ground(item.dismissGround)
      ? { label: ar ? "حالة الفسخ (المادة 80)" : "Dismissal case (Art. 80)", value: `${ar ? "الفقرة" : "Para"} ${art80Ground(item.dismissGround).para}: ${ar ? art80Ground(item.dismissGround).ar : art80Ground(item.dismissGround).en}`, wide: true }
      : null,
    kind !== "notice" ? { label: ar ? "تاريخ التوقيع" : "Signed on", value: fmtDisciplineDate(card.signedAt, ar), mono: true } : null,
    kind !== "notice" ? { label: ar ? "وقّعه" : "Signed by", value: item.signedBy || "" } : null,
    reg ? { label: ar ? "السند من اللائحة (المادة 67)" : "Regulation basis (Art. 67)", value: reg, wide: true } : null,
  ].filter(Boolean);

  const blocks = [{ type: "text", heading: ar ? "ما نُسب إلى العامل" : "What is attributed to the worker", body: offence }];

  if (kind === "notice") {
    blocks.push({
      type: "text",
      heading: ar ? "سماع الأقوال (المادة 71)" : "The hearing (Art. 71)",
      body: ar
        ? "لا يُوقَّع عليك جزاء إلا بعد إبلاغك كتابةً بما نُسب إليك واستجوابك وتحقيق دفاعك وإثبات ذلك في محضر يودع في ملفك. ويجوز أن يكون الاستجواب شفاهة في المخالفات البسيطة التي يُعاقب عليها بالإنذار أو بغرامة لا تتجاوز أجر يوم واحد، على أن يُثبت ذلك في المحضر.\nاكتب دفاعك في المساحة أدناه أو أرفقه، ويُسلَّم لجهة التحقيق."
        : "No sanction is imposed before you are told in writing what is attributed to you, questioned, your defence examined, and all of it recorded in minutes kept in your file. Minor offences punishable by a warning or a fine up to one day's wage may be questioned orally if recorded in the minutes.\nWrite your defence below or attach it.",
    });
    blocks.push({
      type: "table",
      heading: ar ? "المهل التي تحكم هذا الملف" : "The windows on this file",
      cols: [ar ? "المادة" : "Art.", ar ? "القاعدة" : "Rule"],
      nowrapCols: [0],
      rows: [
        ["69", ar ? "لا يُتّهم العامل بمخالفة مضى على كشفها أكثر من 30 يوماً، ولا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من 30 يوماً." : "No charge more than 30 days after discovery; no sanction more than 30 days after the investigation ends."],
        ["70", ar ? "لا يُوقَّع على المخالفة الواحدة أكثر من جزاء واحد، ولا تزيد الغرامة عنها على أجر خمسة أيام." : "One penalty per offence; a fine for one offence may not exceed five days' wage."],
        ["68", ar ? "لا يُشدَّد الجزاء عند التكرار إذا انقضى 180 يوماً على إبلاغ الجزاء السابق." : "No increase for a repeat once 180 days passed since notice of the previous sanction."],
      ],
    });
    blocks.push({ type: "text", heading: ar ? "دفاع العامل" : "The worker's defence", body: item.hearingMinutes || (ar ? "……………………………………………………………………………………\n……………………………………………………………………………………\n……………………………………………………………………………………" : "……………………………………………………………\n……………………………………………………………") });
  } else {
    if (item.hearingMinutes || item.hearingEndedAt) {
      blocks.push({
        type: "text",
        heading: ar ? "سماع الدفاع (المادة 71)" : "The hearing (Art. 71)",
        body: [item.hearingMinutes || "", item.hearingEndedAt ? (ar ? `أُثبت في المحضر بتاريخ ${fmtDisciplineDate(item.hearingEndedAt, ar)}.` : `Recorded in the minutes on ${fmtDisciplineDate(item.hearingEndedAt, ar)}.`) : ""].filter(Boolean).join("\n"),
      });
    }
    if (fineCut) {
      blocks.push({
        type: "text",
        heading: ar ? "حسم الغرامة (المادتان 92 و93)" : "Deducting the fine (Arts. 92–93)",
        body: ar
          ? "تُحسم الغرامة من الأجر دون حاجة إلى موافقة العامل (المادة 92/5)، ولا يتجاوز مجموع ما يُحسم في الشهر مع حصة التأمينات نصف الأجر المستحق (المادة 93)، ولا يُقتطع وفاءً للغرامات أكثر من أجر خمسة أيام في الشهر (المادة 70). وتُقيَّد في سجل الغرامات ولا يُتصرَّف فيها إلا لنفع عمال المنشأة (المادة 73)."
          : "The fine is deducted without the worker's consent (Art. 92/5); the month's total with the social-insurance share stays within half the wage (Art. 93), and no more than five days' wage is taken for fines in a month (Art. 70). It is entered in the fines register and used only for the workers' benefit (Art. 73).",
      });
    }
    if (kind === "settled") {
      blocks.push({
        type: "text",
        heading: ar ? "القرار في التظلّم" : "The ruling on the grievance",
        body: [
          `${item.rulingLabel || ""}${item.rulingAt ? ` — ${fmtDisciplineDate(item.rulingAt, ar)}` : ""}${item.rulingBy ? ` — ${item.rulingBy}` : ""}`,
          item.appealNote ? (ar ? `تظلّم العامل: «${item.appealNote}»` : `Grievance: “${item.appealNote}”`) : "",
          item.rulingNote || "",
        ].filter(Boolean).join("\n"),
      });
    }
    blocks.push({
      type: "text",
      heading: ar ? "حقّك في التظلّم (المادة 72)" : "Your right to a grievance (Art. 72)",
      body: ar
        ? "لك التظلّم كتابةً للجهة المختصة لدى صاحب العمل خلال ثلاثين يوماً — عدا أيام العطل الرسمية — من تاريخ إبلاغك بهذا القرار.\nفإن رُفض تظلّمك أو لم يُبتّ فيه كتابةً خلال خمسة عشر يوماً من تقديمه، فلك الاعتراض أمام المحاكم العمالية خلال ثلاثين يوماً — عدا العطل الرسمية — من تاريخ الرفض أو انتهاء مدة البتّ، أيهما أقرب."
        : "You may file a written grievance with the employer's competent party within thirty days, excluding official holidays, of being notified of this decision.\nIf it is refused or not decided in writing within fifteen days, you may object before the labour courts within thirty days, excluding official holidays, of the refusal or the end of the decision period, whichever is earlier.",
    });
    if (kind !== "notice") {
      const done = DISCIPLINE_DELIVERY_METHODS.find((m) => m.id === item.notifyMethod);
      blocks.push({
        type: "table",
        heading: ar ? "إثبات الإبلاغ بالقرار (المادة 72 · النموذج الموحد م68)" : "Proof of notice (Art. 72 · model Art. 68)",
        cols: [ar ? "الطريقة" : "Method", ar ? "التاريخ" : "Date", ar ? "المرجع / التوقيع" : "Reference / signature"],
        rows: done
          ? [[`☑ ${ar ? done.ar : done.en}`, fmtDisciplineDate(item.notifyDeliveredAt, ar), item.notifyRef || ""]]
          : DISCIPLINE_DELIVERY_METHODS.map((m) => [`☐ ${ar ? m.ar : m.en}`, "……/……/………", m.id === "hand" ? "" : (ar ? "المرجع: ……………" : "Ref.: ……………")]),
      });
    }
  }

  const signatures = kind === "notice"
    ? [
      { label: ar ? "استلم العامل الإبلاغ" : "Received by the worker", name },
      { label: ar ? "جهة التحقيق" : "Investigating party", name: "" },
    ]
    : kind === "decision"
      ? [
        { label: ar ? "استلم العامل القرار" : "Received by the worker", name },
        { label: ar ? "مُصدر القرار" : "Issued by", name: item.signedBy || "" },
        { label: ar ? "شاهد (عند الامتناع)" : "Witness (if refused)", name: "" },
      ]
      : [];

  return {
    ar,
    kicker: ar ? "الجزاءات · نظام العمل المواد 66–73" : "Sanctions · Labour Law Arts. 66–73",
    title,
    subtitle: name,
    ref: String(item.id || ""),
    company,
    status: {
      label: ar ? card?.face?.shortAr || "" : card?.face?.shortEn || "",
      tone: kind === "settled" ? "ok" : kind === "decision" ? "bad" : "warn",
    },
    facts,
    blocks,
    signatures,
    note: ar
      ? "يُحفظ أصل هذه الورقة موقَّعةً في ملف العامل. نظام العمل (م/51) ولائحة تنظيم العمل المعتمدة هما المرجع عند الخلاف."
      : "The signed original is kept in the worker's file. The Labour Law (M/51) and the approved regulation govern in a dispute.",
  };
}

export function printDisciplinePaper(card, ar = true, opts = {}) {
  return printSheet({ ...disciplineSheet(card, ar, opts), ar });
}

/** Kept for older callers: prints instead of downloading an HTML file. */
export function downloadDisciplineNotice(card, ar = true, opts = {}) {
  return printDisciplinePaper(card, ar, opts);
}
