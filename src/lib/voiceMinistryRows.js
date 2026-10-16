/**
 * «أنظمة الوزارة — ما يخص صوت الموظف» — the rows VoiceLawPanel lists and the «الامتثال الوزاري»
 * index counts. `breached` — voices whose review window passed (they climbed a level); `abuseCases`
 * — the harassment / abuse cases the viewer runs (or files), read by abuseLawStatus. Pure.
 */
import { abuseLawStatus, ABUSE_WORKING_DAYS } from "./abuseComplaint.js";
import { deriveVoiceBoard, viewerVoiceQueueItems } from "./voiceBoard.js";
import { canRunAbuseCase, filterAbuseCasesForViewer, isVoiceHrReceiver } from "./voicePrivacy.js";

export const VOICE_MINISTRY_CARDS = (ar = true) => [
  {
    key: "regs",
    badge: ar ? "اللائحة" : "Regs",
    title: ar ? "لائحة تنظيم العمل — قناة الصوت" : "Work regulations — the voice channel",
    scope: ar ? "المهلة، التصعيد تلقائياً، والقرار المكتوب قبل الإغلاق." : "The window, automatic escalation, and a written ruling before closing.",
  },
  {
    key: "model",
    badge: ar ? "النموذج الموحد" : "Model reg.",
    title: ar ? "النموذج الموحد م54–56 — التحرش والإيذاء" : "Model regulation Arts. 54–56 — harassment and abuse",
    scope: ar ? "الشكوى خلال خمسة أيام عمل، لجنة تحقق خلال خمسة أيام عمل، والسرية." : "Complaint within five working days, a committee inquiry within five working days, confidentiality.",
  },
  {
    key: "labour",
    title: ar ? "نظام العمل — الكرامة والتقاضي" : "Labour Law — dignity and recourse",
    scope: ar ? "حسن المعاملة وبطلان الانتقام (61)، والتسوية الودية ثم المحكمة (220)." : "Decent treatment and no reprisal (61); settlement then the court (220).",
  },
];

export function voiceMinistryRows({ breached = 0, abuseCases = [], calendar, today, ar = true } = {}) {
  const day = today || new Date().toISOString().slice(0, 10);
  const abuse = abuseLawStatus(abuseCases, { today: day, calendar });
  return [
    {
      key: "regs-window",
      source: "regs",
      badge: ar ? "اللائحة" : "Regs",
      title: ar ? "قناة داخلية بمهلة — لا يُهمل صوت" : "An internal channel with a window — no voice is dropped",
      note: ar ? "ما لا يُراجع في مهلته يُرفع تلقائياً للمستوى التالي، ولا يُغلق بلا قرار مكتوب." : "What is not reviewed in its window is raised to the next level; nothing closes without a written ruling.",
      status: breached > 0 ? "alert" : "settled",
      pill: breached > 0 ? (ar ? `${breached} فاتت مهلته فصعد` : `${breached} raised on a missed window`) : (ar ? "مستوفى" : "Met"),
    },
    {
      key: "model-54",
      source: "model",
      badge: ar ? "النموذج الموحد م54" : "Model Art. 54",
      title: ar ? "ما يُعد إيذاءً في مكان العمل" : "What counts as abuse at work",
      note: ar
        ? "كل إساءة أو استغلال أو ابتزاز أو إغراء أو تهديد — جسدي أو نفسي أو جنسي — من صاحب العمل أو العامل أو زميل، بالقول أو الكتابة أو الإشارة أو الوسائل الإلكترونية؛ والمساعدة والتستر في حكمه."
        : "Any abuse, exploitation, blackmail, luring or threat — physical, psychological or sexual — by employer, worker or colleague, in words, writing, gesture or electronically; helping or covering it up counts too.",
      status: "void",
      pill: ar ? "للعلم" : "For reference",
    },
    {
      key: "model-55-1",
      source: "model",
      badge: ar ? "النموذج الموحد م55/1" : "Model Art. 55(1)",
      title: ar ? `الشكوى للمنشأة خلال ${ABUSE_WORKING_DAYS} أيام عمل من الواقعة` : `Complain to the company within ${ABUSE_WORKING_DAYS} working days of the incident`,
      note: ar
        ? "يُفحص عند التقديم في «تحرش أو إيذاء»، ويجوز للشاهد أن يبلّغ؛ وإن كان الإيذاء من صاحب المنشأة أو أعلى سلطة فيها فالشكوى للجهة الحكومية المختصة. لا يُسقط ذلك حق اللجوء للجهات الحكومية."
        : "Checked when filed under «Harassment or abuse»; a witness may report. Against the owner or the top authority, the complaint goes to the competent government body. The right to go to the authorities stays.",
      status: "settled",
      pill: ar ? "يُفحص عند التقديم" : "Checked on filing",
    },
    {
      key: "model-55-2",
      source: "model",
      badge: ar ? "النموذج الموحد م55/2" : "Model Art. 55(2)",
      title: ar ? `لجنة بقرار تحقق وتوصي خلال ${ABUSE_WORKING_DAYS} أيام عمل من تلقي الشكوى` : `A committee by decision investigates and recommends within ${ABUSE_WORKING_DAYS} working days`,
      note: ar
        ? `${abuse.total} قضية · ${abuse.inquiry} في مهلتها · ${abuse.overdue} تجاوزتها · ${abuse.decided} بتوصية مكتوبة — أيام العمل لا تشمل الراحة الأسبوعية والعطل الرسمية.`
        : `${abuse.total} case(s) · ${abuse.inquiry} in window · ${abuse.overdue} past it · ${abuse.decided} with a written recommendation — working days skip rest days and official holidays.`,
      status: abuse.overdue ? "alert" : abuse.inquiry ? "waiting" : abuse.total ? "settled" : "void",
      pill: abuse.overdue
        ? (ar ? `${abuse.overdue} تجاوزت المهلة` : `${abuse.overdue} past the window`)
        : abuse.inquiry
          ? (ar ? `${abuse.inquiry} قيد التحقيق` : `${abuse.inquiry} under inquiry`)
          : abuse.total ? (ar ? "مستوفى" : "Met") : (ar ? "لا قضية" : "No case"),
    },
    {
      key: "model-56",
      source: "model",
      badge: ar ? "النموذج الموحد م56" : "Model Art. 56",
      title: ar ? "السرية ومحاضر موقعة" : "Confidentiality and signed minutes",
      note: ar
        ? "تسمع اللجنة الأطراف والشهود بسرية في محاضر يوقعونها، ولها التوصية بالتفريق أثناء التحقيق، وترفع ما يشكل جريمة للمدير العام. القضية لا يراها إلا الموارد البشرية وأعضاء لجنتها وصاحبها."
        : "The committee hears parties and witnesses confidentially in signed minutes, may recommend separating them, and refers crimes to the general manager. Only HR, the committee and the filer see the case.",
      status: abuse.exposed ? "alert" : "settled",
      pill: abuse.exposed ? (ar ? `${abuse.exposed} غير سرية` : `${abuse.exposed} not confidential`) : (ar ? "مستوفى" : "Met"),
    },
    {
      key: "labour-61",
      source: "labour",
      badge: ar ? "م 61" : "Art. 61",
      title: ar ? "حسن المعاملة وحفظ الكرامة" : "Decent treatment and dignity",
      note: ar ? "أي جزاء مرتبط بصوت يُبطل، والصوت لا يصل إلى من هو عنه، ولا يراجع أحد صوتاً رفعه." : "A sanction tied to a voice is void, a voice never reaches the person it is about, and no one reviews their own voice.",
      status: "settled",
      pill: ar ? "مستوفى" : "Met",
    },
    {
      key: "labour-220",
      source: "labour",
      badge: ar ? "م 220" : "Art. 220",
      title: ar ? "التسوية الودية ثم المحكمة العمالية" : "Amicable settlement, then the labour court",
      note: ar ? "المسار الداخلي لا يُسقط حق صاحب الصوت؛ تبقى التسوية الودية ثم المحكمة العمالية." : "The internal path does not remove the right; amicable settlement and then the labour court remain.",
      status: "void",
      pill: ar ? "للعلم" : "For reference",
    },
  ];
}

/**
 * The management inputs for the index — the voices this viewer is queued on (the same list the
 * صوت الموظف badge counts) in the header scope, and the abuse cases he runs. HR-only by privacy:
 * a line manager gets null, so the index shows no voice counts to him (voicePrivacy).
 */
export function voiceMinistryInputs(data, user, { inScope = () => true } = {}) {
  if (!user || !isVoiceHrReceiver(user, data)) return null;
  const employees = data?.employees || [];
  const items = viewerVoiceQueueItems(data, user).filter((item) => {
    const author = employees.find((row) => String(row.id) === String(item.authorId));
    return inScope(item.stationId || author?.stationId);
  });
  const board = deriveVoiceBoard({ items, employees, stations: data?.stations || [], canManage: true, userId: user.id });
  const abuseCases = filterAbuseCasesForViewer(data?.abuseCases || [], user, data).filter((row) => canRunAbuseCase(row, user, data));
  return { breached: (board.overdue || []).length, abuseCases };
}
