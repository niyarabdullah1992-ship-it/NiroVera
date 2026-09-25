/** Design system law for /app — Design System v2.
 *  Six form rules + two behaviour rules + named surfaces.
 *  Document cards: 12px radius, 1px line, soft paper shadow.
 *  Status lives on the top 3px edge. Controls 10px. Chips 999.
 *  Tokens live in CSS `--nv-*`.
 */

export const DS_RADIUS = 12;
export const DS_CONTROL_RADIUS = 8;
export const DS_PILL_RADIUS = 999;
export const DS_EDGE_PX = 3;
export const DS_ARABIC_FLOOR = 10;
export const DS_SHADOW = "0 1px 2px var(--nv-shadow2)";

export const DS_STATES = {
  settled: { id: "settled", token: "ok", ar: "استقرّ", en: "Settled", jobAr: "اعتُمد · نُفّذ · سليم ومطابق", jobEn: "Approved · done · matches" },
  waiting: { id: "waiting", token: "warn", ar: "ينتظر", en: "Waiting", jobAr: "قيد النظر · بانتظار ختمك · مهلة", jobEn: "Under review · awaiting your seal · deadline" },
  blocked: { id: "blocked", token: "bad", ar: "مُنع", en: "Blocked", jobAr: "رُفض · معدّل · تجاوز مادة", jobEn: "Refused · amended · statute breach" },
  void: { id: "void", token: "mute", ar: "بلا أثر", en: "No effect", jobAr: "سُحب · غير مسجّل · منتهٍ", jobEn: "Withdrawn · unrecorded · ended" },
};

export const DS_STATE_IDS = Object.keys(DS_STATES);

export function dsState(id) {
  return DS_STATES[id] || DS_STATES.void;
}

export function dsDegree(stateId, degree = "ink") {
  const token = dsState(stateId).token;
  const key = degree === "line" ? "line" : degree;
  return `var(--nv-${token}-${key})`;
}

export function docFrame(stateId) {
  const fill = stateId ? dsDegree(stateId, "fill") : "var(--nv-line)";
  return {
    background: "var(--nv-card)",
    border: "1px solid var(--nv-line)",
    borderTop: `${DS_EDGE_PX}px solid ${fill}`,
    borderRadius: DS_RADIUS,
    boxShadow: DS_SHADOW,
  };
}

export function stateChip(stateId, extra = {}) {
  return {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 9px",
    borderRadius: DS_PILL_RADIUS,
    color: dsDegree(stateId, "ink"),
    background: dsDegree(stateId, "soft"),
    border: `1px solid ${dsDegree(stateId, "line")}`,
    whiteSpace: "nowrap",
    ...extra,
  };
}

export const DS_FORM_RULES = [
  {
    id: "doc",
    num: "01",
    ar: "الوثيقة لا اللوحة",
    en: "Document, not a dashboard",
    dAr: "حدّ هيكل 1px يبني العمق، وشريط 3px على الحرف الأعلى وحده يحمل الحالة. السطح يُقرأ مستنداً: جداول وحقائق وأرقام مواد.",
    dEn: "A 1px structure border builds depth. A 3px strip on the top edge alone carries status. The surface reads as a document.",
    noAr: "لا إطار ملوّن يحيط البطاقة، ولا ظلّ يعوّض عن الحدّ، ولا حدّ أسمك من 3px.",
    noEn: "No coloured frame around the card, no shadow instead of a border, no edge thicker than 3px.",
  },
  {
    id: "pair",
    num: "02",
    ar: "زوج لوني وأربع حالات",
    en: "One pair, four states",
    dAr: "كحلي للهيكل والحبر، وأخضر واحد للمعنى. والحالة أربع لا خامسة لها: استقرّ · ينتظر · مُنع · بلا أثر.",
    dEn: "Navy for structure and ink, one green for meaning. Four states only: settled · waiting · blocked · no effect.",
    noAr: "لا لون زينةً، ولا حالة خامسة، ولا معنى واحد بلونين في شاشة واحدة.",
    noEn: "No decorative colour, no fifth state, and no one meaning in two colours on one screen.",
  },
  {
    id: "degrees",
    num: "03",
    ar: "ثلاث درجات: ink · soft · fill",
    en: "Three degrees: ink · soft · fill",
    dAr: "ink للنصّ وللأسطح التي تحمل نصّاً، soft للخلفية الفاتحة، fill للأشرطة والنقاط فقط.",
    dEn: "ink for text and text-bearing surfaces, soft for light wash, fill for bars and dots only.",
    noAr: "لا fill خلفيةً لزرّ فيه نصّ — ذلك أشهر خطأ تباين في هذا النظام.",
    noEn: "Do not put fill behind a labelled button — the most common contrast error in this system.",
  },
  {
    id: "tokens",
    num: "04",
    ar: "رموز --nv-* مصدر واحد",
    en: "Tokens --nv-* are the source",
    dAr: "أرضية وبطاقة وحدود وحبر وحالات — تُعرَّف مرّة، والوضع الليلي يقلبها ولا يُعاد تصميمه.",
    dEn: "Page, card, lines, ink, and states are defined once. Dark mode flips them; it is not a second design.",
    noAr: "لا لون مكتوب حرفيّاً في سطر جديد — ولا في حالة التمرير.",
    noEn: "No new literal colour in a line — including hover.",
  },
  {
    id: "type",
    num: "05",
    ar: "خطّان وأرضية 10px",
    en: "Two faces, 10px Arabic floor",
    dAr: "Readex Pro للعناوين، IBM Plex Sans Arabic للنصّ، IBM Plex Mono للأرقام داخل dir=\"ltr\" منفصل.",
    dEn: "Readex Pro for titles, IBM Plex Sans Arabic for body, IBM Plex Mono for figures in a separate dir=\"ltr\".",
    noAr: "لا نصّ عربي دون 10px، ولا خلط عربي ولاتيني في سياق ثنائي الاتجاه واحد، ولا نصّ دون 4.5:1.",
    noEn: "No Arabic under 10px, no mixed bidi in one run, no text under 4.5:1.",
  },
  {
    id: "icons",
    num: "06",
    ar: "شبكة 24 للرموز",
    en: "24-grid icons",
    dAr: "وزن واحد وأشكال مغلقة، وكل قسم مربوط برمزه في خريطة واحدة.",
    dEn: "One stroke weight, closed shapes, each section bound to one glyph in one map.",
    noAr: "لا رمز مرتجل بخطوط متقاطعة، ولا وزنان في صفحة.",
    noEn: "No improvised crossed strokes, and no two weights on one page.",
  },
];

export const DS_BEHAVE_RULES = [
  {
    id: "derived",
    ar: "كل رقم مشتقّ لا مكتوب",
    en: "Every figure is derived, never typed",
    dAr: "الرصيد من تاريخ التعيين، والحسم النافذ من قرار الاعتراض، والنسبة من البنود المستوفاة. رقم مكتوب يكذّب جاره.",
    dEn: "Balance from hire date, effective cut from the objection, ratio from satisfied items. A typed figure contradicts its neighbour.",
    okAr: "«21 يوماً · 1.75 يوم/شهر» — مشتقّان من الخدمة، ويقفزان إلى 30 بعد خمس سنوات بلا تدخّل.",
    okEn: "“21 days · 1.75 day/month” — derived from service, and jumps to 30 after five years with no edit.",
    badAr: "«16 من 20» بمضاعِف مكتوب، ولوحٌ تحته يقول «3 من 5».",
    badEn: "“16 of 20” with a typed multiplier, and a slab beneath that says “3 of 5”.",
  },
  {
    id: "named",
    ar: "كل منع يعلن سببه ومادّته",
    en: "Every hold names its reason and article",
    dAr: "الزرّ المعطَّل يقول لماذا، لا يصمت رمادياً. والمانع يسمّي مادّته حين يكون نظامياً.",
    dEn: "A disabled control says why. A statutory hold names its article.",
    okAr: "«لا يجوز التوقيع: مضى 30 يوماً على الإبلاغ (المادة 72)» · «يتجاوز سقف 5 أيام — المتاح 2».",
    okEn: "“Cannot sign: 30 days have passed since notice (Art. 72)” · “Exceeds the 5-day cap — 2 remain”.",
    badAr: "زرّ رمادي بلا سبب، أو حقل يظهر ثم يُخفى بشرط متأخّر.",
    badEn: "A silent grey button, or a field shown then hidden by a late condition.",
  },
];

export const DS_SURFACES = [
  { href: "/app/signing", ar: "التوقيع الرقمي", en: "Digital signing", jobAr: "ختم متعدّد الأطراف ومهلة تراجع", jobEn: "Multi-party seal and retraction window", empAr: "يوقّع ويتراجع", empEn: "Signs and retracts", mgrAr: "يرسل ويتابع", mgrEn: "Sends and follows" },
  { href: "/app/attendance", ar: "الحضور", en: "Attendance", jobAr: "شخص ومكان ووقت في سلسلة الإثبات", jobEn: "Person, place, and time in the proof cycle", empAr: "بصمتي وكشفي", empEn: "My punch and my sheet", mgrAr: "القرار والسياسة", mgrEn: "Decision and policy" },
  { href: "/app/calendar", ar: "التقويم التشغيلي", en: "Operations calendar", jobAr: "يثبت ما مضى بحلقاته", jobEn: "Seals what already happened", empAr: "سجلّي", empEn: "My register", mgrAr: "الفريق والتوزيع", mgrEn: "Team and allocation" },
  { href: "/app/shifts", ar: "جدول الدوام", en: "Roster", jobAr: "حكم المنصة على الساعات والراحة", jobEn: "Platform judgment on hours and rest", empAr: "جدولك", empEn: "Your roster", mgrAr: "يحكم وينشر", mgrEn: "Judges and publishes" },
  { href: "/app/requests", ar: "طلباتي", en: "My Requests", jobAr: "يطلب ويردّ كتابةً ويؤرشف", jobEn: "Asks, answers in writing, archives", empAr: "يرسل ويردّ", empEn: "Sends and answers", mgrAr: "يقرّر ويمنح", mgrEn: "Decides and grants" },
  { href: "/app/tasks", ar: "التشغيل", en: "Operations", jobAr: "مهمة فإثبات فاعتماد — دون قطع السلسلة", jobEn: "Task, proof, review — the chain stays whole", empAr: "ينفّذ ويثبت", empEn: "Does and proves", mgrAr: "يعتمد أو يرفض بسبب", mgrEn: "Approves or refuses with a reason" },
  { href: "/app/discipline", ar: "الجزاءات", en: "Sanctions", jobAr: "إبلاغ ودفاع وتوقيع واعتراض", jobEn: "Notice, defence, sign, objection", empAr: "ملفّه واعتراضه", empEn: "His file and objection", mgrAr: "يبلّغ ويوقّع", mgrEn: "Notifies and signs" },
  { href: "/app/org", ar: "القوى العاملة", en: "Workforce", jobAr: "المقعد كائن مستقلّ عن الشخص", jobEn: "The seat is independent of the person", empAr: "بطاقته", empEn: "His card", mgrAr: "يعيّن وينقل", mgrEn: "Appoints and transfers" },
  { href: "/app/complaints", ar: "صوت الموظف", en: "Employee voice", jobAr: "بلاغ وحماية ومسار تحقيق", jobEn: "Report, protection, investigation path", empAr: "يرفع صوته", empEn: "Raises his voice", mgrAr: "يفتح ويغلق", mgrEn: "Opens and closes" },
  { href: "/app/safety", ar: "السلامة", en: "Safety", jobAr: "خطر بصورتين ومستوى معتمد", jobEn: "A hazard in two pictures and an adopted level", empAr: "يبلّغ عن خطر", empEn: "Reports a hazard", mgrAr: "يغلق ويعتمد", mgrEn: "Closes and adopts" },
  { href: "/app/payroll", ar: "المال والأصول", en: "Money and assets", jobAr: "أوعية منفصلة وقيود تُصدَّر", jobEn: "Separate vessels and posted entries", empAr: "كشفه", empEn: "His slip", mgrAr: "كل الطبقات", mgrEn: "Every layer" },
  { href: "/app/assistant", ar: "المساعد", en: "Assistant", jobAr: "يسأل السجل داخل صلاحيتك", jobEn: "Asks the register inside your permission", empAr: "يسأل ما يخصّه", empEn: "Asks what is his", mgrAr: "يسأل نطاقه", mgrEn: "Asks his scope" },
  { href: "/app/work-proof", ar: "التحقّق العام", en: "Public verify", jobAr: "بصمة بلا جلسة للحقول المسموح بها", jobEn: "A hash without a session for allowed fields", empAr: "عامّ", empEn: "Public", mgrAr: "عامّ", mgrEn: "Public" },
];

export const DS_TYPE_ROWS = [
  { id: "display", spec: "Readex Pro 700 · 24px", ar: "عنوان القسم", en: "Section title", style: { fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" } },
  { id: "slab", spec: "Plex Sans Arabic 700 · 15px", ar: "عنوان لوح", en: "Slab title", style: { fontSize: 15, fontWeight: 700 } },
  { id: "body", spec: "400 · 12px / 1.9", ar: "نصّ شرح يقول القاعدة ومادّتها.", en: "Body that names the rule and its article.", style: { fontSize: 12, lineHeight: 1.9, color: "var(--nv-ink2)" } },
  { id: "mono", spec: "Plex Mono 500 · dir=ltr", ar: "516.67", en: "516.67", style: { fontFamily: "var(--font-mono)", fontSize: 19, fontWeight: 500, direction: "ltr" } },
  { id: "floor", spec: "10px — أرضية العربي", ar: "أصغر نصّ عربي مسموح", en: "Smallest allowed Arabic", style: { fontSize: DS_ARABIC_FLOOR, color: "var(--nv-ink3)" } },
];

export const DS_TOKEN_KEYS = [
  "--nv-page", "--nv-card", "--nv-line", "--nv-line2", "--nv-hover", "--nv-soft",
  "--nv-ink", "--nv-ink2", "--nv-ink3",
  "--nv-ok-ink", "--nv-warn-ink", "--nv-bad-ink",
];

export function designSystemCatalog({ ar = true } = {}) {
  return {
    title: ar ? "نظام التصميم" : "Design system",
    lede: ar
      ? "ستّ قواعد للشكل وقاعدتان للسلوك. ما ليس هنا لا يُستحدث في قسم — والنماذج أدناه حيّة تقلب مع الثيم."
      : "Six form rules and two behaviour rules. What is not here is not invented in a section — the models below flip with the theme.",
    form: DS_FORM_RULES,
    behave: DS_BEHAVE_RULES,
    surfaces: DS_SURFACES,
    states: Object.values(DS_STATES),
    typeRows: DS_TYPE_ROWS,
    appliedIn: ar ? `مطبَّق في ${DS_SURFACES.length} أسطح` : `Applied on ${DS_SURFACES.length} surfaces`,
  };
}
