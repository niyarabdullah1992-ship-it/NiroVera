import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import MarketingChrome from "@/components/landing/MarketingChrome";
import { Nv7Strip, nv7Count, nv7Tab } from "@/components/shared/Nv7SectionHead";
import { statusPillStyle } from "@/components/shared/StatusFilterPills";
import ProofWindow from "@/components/landing/ProofWindow";
import RuleLab from "@/components/landing/RuleLab";
import { LABOR_RULES } from "@/lib/laborRules";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { trackVisit } from "@/lib/trackVisit";
import { DEFAULT_SUBSCRIPTION_PLANS, currencyLabel, planDisplayName } from "@/lib/subscriptionPlans";

/*
 * The public face of NiroVera, drawn with the same parts as the inside of the platform (v7):
 * the paper page, the deep-green section band with its numbered gold kicker and lattice, the white
 * strip of tabs under it, white 12px cards with a hairline, letter tiles like «إجراء جديد», mono
 * article chips like «م 66», and the green status pills. Nothing here is a second design: a visitor
 * who signs in should feel they never left the page.
 *   the claim beside a window from the inside that plays the Proof Cycle link by link, the stepper
 *   as its control, and the page tabs in the white strip;
 *   «جرّب القاعدة»: a wage and a slider, answered by the rule catalogue with figure, formula, article;
 *   the sections (as the option tiles, grouped like the sidebar);
 *   the law (as the case rows) and the honest list of pending government links;
 *   what changed in this release;
 *   the subscription, from the live plan catalogue.
 */

const C = {
  green: "#0B3D27",
  fill: "#3C7D50",
  gold: "#C8A45A",
  goldInk: "#7A5B1C",
  paper: "#F4F7F5",
  card: "#FFFFFF",
  line: "#E4E9E6",
  ink: "#111418",
  mid: "#555C66",
  soft: "#A9CDB8",
  tile: "#E8F1EC",
};
const HEAD = "var(--font-heading, 'Readex Pro','IBM Plex Sans Arabic',sans-serif)";
const MONO = { fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontVariantNumeric: "tabular-nums" };
const CARD = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 1px 2px rgba(12,20,16,.06)" };

/** The Proof Cycle — six links, in order (CLAUDE.md). */
const CHAIN = [
  ["حضور", "Attendance", "الشخص والمكان والوقت", "Person, place, time"],
  ["مهمة", "Task", "وزن الجهد والدليل وإقرار الموظف", "Effort, evidence, attestation"],
  ["مراجعة", "Review", "اعتماد أو رفض بسبب مكتوب", "Approve or reject with a written reason"],
  ["تصعيد", "Escalation", "حين تنقضي المهلة بلا تقدّم", "When time runs out without progress"],
  ["توقيع", "Signature", "توقيع آمن وبصمة الملف", "Secure signature and file fingerprint"],
  ["إثبات للعميل", "Client proof", "حقول مسموحة ورابط تحقق عام", "Allowed fields and a public verify link"],
];

/** The sections — the same names and groups as the sidebar inside. */
const SECTIONS = [
  ["العمل اليومي", "Daily work", [
    ["ح", "الحضور والدوام", "Attendance", "البصمة من داخل نطاق الموقع وتُقارن بالجدول، والراحة والشمس والليل في مسار اليوم", "The punch from inside the site, against the roster; rest, sun and night on the day's path", "م 98 · 101", "/app/attendance"],
    ["م", "المهام والإثبات", "Tasks and proof", "مهمة بصاحب وموعد ووزن، تُغلق بدليل ومراجعة مكتوبة", "An owner, a due date and a weight, closed by evidence and a written review", "الإثبات شرط", "/app/tasks"],
    ["س", "السلامة", "Safety", "بلاغ بصورة وموقع، وتصاريح وتفتيش جاهزية", "A report with a photo and a place, permits and readiness checks", "م 121 · 122", "/app/safety"],
  ]],
  ["الموظفون", "People", [
    ["ب", "الموارد البشرية", "Human resources", "ملف الموظف ووثائقه بتواريخ انتهائها، والعقد والأجر ونهاية الخدمة", "The employee file and its expiring documents, contract, pay and end of service", "م 50 · 84", "/app/hr"],
    ["ط", "الطلبات", "Requests", "الرصيد من النظام، والطلب يصعد إن طال بلا قرار", "Balances from the law; a stalled request escalates", "م 109 · 117", "/app/requests"],
    ["ج", "الجزاءات", "Discipline", "لا جزاء خارج اللائحة، ولا قبل إبلاغ كتابي وسماع الدفاع", "None outside the list, and none before written notice and a hearing", "م 66–72", "/app/discipline"],
    ["ص", "صوت الموظف", "Employee voice", "الشكوى لا تصل إلى المشكو منه، وتصعد بمهلة", "A complaint never reaches its subject, and escalates on time", "م 72", "/app/complaints"],
    ["أ", "الأداء", "Performance", "الدرجة من المهام المعتمدة، لا من تقدير بلا سند", "A score from approved tasks, not an unsupported rating", "وصف الوظيفة", "/app/performance"],
  ]],
  ["المال", "Money", [
    ["ر", "المال والرواتب", "Pay and settlement", "المسير من البصمة، والحسم بسند وتحت سقفه، والإضافي يُسجَّل تلقائياً", "Payroll from the punch, deductions with a document and under the cap, overtime logged", "م 90 · 92 · 107", "/app/payroll"],
    ["ت", "التوقيع الرقمي", "Digital signing", "موقّعون بالترتيب أو معاً، وإيصال وبصمة لكل مستند", "Signers in order or together, a receipt and a fingerprint", "التعاملات الإلكترونية", "/app/signing"],
    ["ع", "المساعد", "Assistant", "اسأل بيانات المنشأة بالعربية في حدود صلاحيتك", "Ask the company's data in Arabic, within your permissions", "الصلاحية من الهيكل", "/app/assistant"],
  ]],
];
/** Section tags in English: article numbers keep their digits; the few word tags are translated. */
const TAG_EN = { "الإثبات شرط": "Proof required", "وصف الوظيفة": "Job description", "التعاملات الإلكترونية": "E-transactions law", "الصلاحية من الهيكل": "Access from the structure" };
function tagEn(tag) {
  if (TAG_EN[tag]) return TAG_EN[tag];
  return tag.replace(/^م /, "Art. ").replace(/^ق /, "Dec. ");
}
const SECTION_COUNT = SECTIONS.reduce((n, [, , rows]) => n + rows.length, 0);

/** The law the platform reads — article, then what the platform does with it. */
const LAW = [
  ["م 98", "Art. 98", "ثماني ساعات في اليوم أو ثمان وأربعون في الأسبوع — المنشأة تختار المعيار، والإضافي يُحسب به.", "Eight hours a day or forty-eight a week — the company picks the criterion; overtime follows it.", "hours"],
  ["م 101", "Art. 101", "لا عمل أكثر من خمس ساعات متصلة؛ راحة نصف ساعة تجمع الراحة والصلاة والطعام، وبقاء لا يتجاوز اثنتي عشرة ساعة.", "No more than five hours in a row; half an hour for rest, prayer and food; no more than twelve hours on site.", "hours"],
  ["م 102", "Art. 102", "الراحة ليست من ساعات العمل، ولا بصمة ولا موقع أثناءها.", "Rest is not working time — no punch and no location during it.", "hours"],
  ["م 107", "Art. 107", "ما زاد على المعيار يُسجَّل عملاً إضافياً بانتظار قرار الأجر أو الإجازة.", "Time past the criterion is logged as overtime, awaiting a pay or leave decision.", "pay"],
  ["م 71", "Art. 71", "لا يُوقَّع جزاء قبل إبلاغ العامل كتابةً بما نُسب إليه، واستجوابه، وتحقيق دفاعه.", "No penalty before written notice of the charge, questioning, and a hearing of the defence.", "rights"],
  ["ق 3337", "Dec. 3337", "لا عمل مكشوف تحت الشمس من 12:00 إلى 15:00، من 15 يونيو إلى 15 سبتمبر.", "No sun-exposed work 12:00–15:00, 15 June to 15 September.", "safety"],
  ["ق 18632", "Dec. 18632", "الليل من 23:00 إلى 06:00: راحة 12 ساعة، وتدوير بعد ثلاثة أشهر، وإسعاف ونقل وطعام.", "Night is 23:00–06:00: 12 hours' rest, rotation after three months, first aid, transport and food.", "safety"],
  ["م 17", "Art. 17", "جدول مواعيد العمل والراحة ويوم الراحة يُعلَّق في موقع العمل، ويراه كل موظف في «جدولي».", "The hours, rest and rest-day table is posted on site, and every worker sees it in «My schedule».", "rights"],
];
const LAW_FILTERS = [
  ["all", "الكل", "All"],
  ["hours", "الساعات والراحة", "Hours and rest"],
  ["pay", "الأجر", "Pay"],
  ["rights", "الحقوق", "Rights"],
  ["safety", "السلامة", "Safety"],
];

const PENDING_LINKS = [["قوى", "Qiwa"], ["التأمينات", "GOSI"], ["مدد", "Mudad"], ["نفاذ", "Nafath"]];

/** This release — what changed, in the words a manager would use. */
const RELEASE = [
  ["ملف الموظف كاملاً", "The full employee file", "الوثائق بتواريخ انتهائها، والعقد والأجر، والالتزام بالمنصات، وأرشيف الملف في مكان واحد.", "Documents with expiry dates, contract and pay, platform compliance and the file archive in one place."],
  ["التعيين والعقد", "Hiring and the contract", "تعيين الموظف على وظيفة في الهيكل، وعقد يُبنى من بيانات الملف ويُوقَّع داخل المنصة.", "Appoint a person to a seat in the structure; the contract is built from the file and signed in the platform."],
  ["مساران: الموظف والإدارة", "Two lanes: employee and management", "واجهة الموظف أبسط: بصمتي ومهامي وطلباتي، والإدارة في مسارها بصلاحياتها.", "A simpler employee lane — my punch, my tasks, my requests — and management in its own lane."],
  ["نهاية الخدمة بحرف النظام", "End of service by the letter", "المادتان 84 و85 في المكافأة، والمادة 110 في ترحيل الإجازة، محسوبة كما نصّت.", "Articles 84–85 for the award and 110 for leave carry-over, computed as written."],
  ["الراحة بنص المادة 101", "Rest by Art. 101", "نصف ساعة قبل أن تكتمل خمس ساعات، تُخصم وحدها بلا بصمة، وراحتان في دوام اثنتي عشرة ساعة.", "Half an hour before five hours, deducted on its own with no punch; two on a twelve-hour day."],
];

/** The deep-green band of the inside, at landing scale: numbered gold kicker, title, hint, lattice. */
function Band({ num, kicker, title, hint, children, big = false }) {
  return (
    <header
      className="nv7-section-head"
      style={{
        background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)",
        borderRadius: 12,
        boxShadow: "0 6px 18px rgba(6,61,38,.16)",
        color: "#fff",
        textAlign: "start",
        display: "flex",
        flexDirection: "column",
        gap: big ? 6 : 2,
        padding: big ? "40px 40px 34px" : undefined,
      }}
      data-nv="band"
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.soft, fontWeight: 600, fontSize: big ? 12 : 10.5 }}>
        <span aria-hidden style={{ width: 12, height: 2, background: C.gold, borderRadius: 8, display: "inline-block" }} />
        {num ? <span dir="ltr" style={{ ...MONO, letterSpacing: ".04em" }}>{num}</span> : null}
        <span>{kicker}</span>
      </span>
      <h2
        className="nv-h"
        data-nv={big ? "hero-title" : undefined}
        style={{ margin: 0, fontFamily: HEAD, fontSize: big ? 40 : 20, fontWeight: 700, color: "#fff", lineHeight: 1.35 }}
      >
        {title}
      </h2>
      {hint ? <p style={{ margin: 0, fontSize: big ? 15.5 : 12.5, lineHeight: big ? 1.95 : 1.7, color: "#C5DBCD", maxWidth: big ? 680 : 760 }}>{hint}</p> : null}
      {children}
    </header>
  );
}

/** A card head like «قائمة الجزاءات» / «إجراء جديد»: bold title, one muted line, optional trailing. */
function CardHead({ title, sub, trailing }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontFamily: HEAD, fontSize: 17, fontWeight: 700, color: C.ink }}>{title}</h3>
        {sub ? <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: C.mid }}>{sub}</p> : null}
      </div>
      {trailing}
    </div>
  );
}

/** Mono article chip, the «م 66» of every case row. */
function ArticleChip({ children }) {
  return (
    <span dir="auto" style={{ ...MONO, display: "inline-flex", alignItems: "center", height: 24, padding: "0 8px", borderRadius: 6, background: "#EEF4F0", color: C.green, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export default function Landing() {
  const { lang, setLang } = useI18n();
  const { session, currentUser } = useAuth();
  const loggedIn = Boolean(session?.userId && currentUser);
  const ar = lang === "ar";
  const T = (a, e) => (ar ? a : e);
  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((row) => row.slug === "professional") || DEFAULT_SUBSCRIPTION_PLANS[2];
  const [lawFilter, setLawFilter] = React.useState("all");
  const lawRows = LAW.filter((row) => lawFilter === "all" || row[4] === lawFilter);

  useEffect(() => {
    trackVisit("/");
  }, []);

  const pageTabs = [
    ["#lab", T("جرّب القاعدة", "Try a rule"), 0],
    ["#sections", T("الأقسام", "Sections"), SECTION_COUNT],
    ["#mhrsd", T("النظام", "The law"), LAW.length],
    ["#release", T("الجديد", "What's new"), RELEASE.length],
    ["#pricing", T("الاشتراك", "Subscription"), 0],
  ];

  return (
    <MarketingChrome ar={ar} lang={lang} loggedIn={loggedIn} onToggleLang={() => setLang(ar ? "en" : "ar")}>
      <style>{`
        [data-nv="page"] { max-width: 1240px; margin: 0 auto; padding: 18px 24px 40px; display: flex; flex-direction: column; gap: 22px; }
        [data-nv="stepper"] { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); }
        .nv7-section-head h1[data-nv="hero-title"] { font-size: 46px !important; }
        [data-nv="proof-top"] { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 36px; align-items: center; }
        [data-nv="proof-panel"] { animation: nvProofIn .32s ease both; }
        @keyframes nvProofIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        [data-nv="step"]:focus-visible { outline: 2px solid #E2C57E; outline-offset: 4px; border-radius: 8px; }
        [data-nv="lab"] { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px; align-items: stretch; }
        @media (prefers-reduced-motion: reduce) { [data-nv="proof-panel"] { animation: none; } }
        [data-nv="tiles"] { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        [data-nv="law"] { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
        [data-nv="release"] { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        [data-nv="plan"] { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; }
        [data-nv="tile"]:hover { border-color: #3C7D50 !important; }
        @media (max-width: 1000px) {
          [data-nv="page"] { padding: 12px 14px 32px; }
          [data-nv="band"] { padding: 22px 18px !important; }
          .nv7-section-head h1[data-nv="hero-title"] { font-size: 30px !important; }
          [data-nv="proof-top"], [data-nv="lab"] { grid-template-columns: 1fr; gap: 20px; }
          [data-nv="stepper"] { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 14px; }
          [data-nv="stepper-rule"], [data-nv="step-note"] { display: none; }
          [data-nv="facts"] { gap: 18px !important; }
          [data-nv="tiles"], [data-nv="law"], [data-nv="release"], [data-nv="plan"] { grid-template-columns: 1fr; }
        }
      `}</style>

      <div data-nv="page">
        {/* The claim, and the Proof Cycle as the case stepper. */}
        <div id="how" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <header
            className="nv7-section-head"
            data-nv="band"
            style={{ background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)", borderRadius: 12, boxShadow: "0 6px 18px rgba(6,61,38,.16)", color: "#fff", textAlign: "start", padding: "36px 36px 30px" }}
          >
            <ProofWindow chain={CHAIN} ar={ar}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.soft, fontWeight: 600, fontSize: 12 }}>
                  <span aria-hidden style={{ width: 12, height: 2, background: C.gold, borderRadius: 8, display: "inline-block" }} />
                  <span dir="ltr" style={{ ...MONO, letterSpacing: ".04em" }}>00</span>
                  <span>{T("نيروفيرا", "NiroVera")}</span>
                </span>
                <h1 className="nv-h" data-nv="hero-title" style={{ margin: 0, fontFamily: HEAD, fontSize: 46, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                  {T("العمل يُثبَت قبل أن يُحكم عليه", "Work is proven before it is judged")}
                </h1>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.95, color: "#C5DBCD", maxWidth: 520 }}>
                  {T(
                    "منصة موارد بشرية سعودية لا تكتفي بتسجيل العمل، بل تثبته: كل حكم — أجر أو جزاء أو درجة — يُقرأ من سجل واحد، وتحت كل قاعدة اسم مادتها من نظام العمل.",
                    "A Saudi HR platform that does not only record work — it proves it. Every ruling, whether pay, a penalty or a score, reads one record, and every rule names its Labour Law article.",
                  )}
                </p>
                <dl data-nv="facts" style={{ margin: "6px 0 0", display: "flex", gap: 26, flexWrap: "wrap" }}>
                  {[
                    [LABOR_RULES.length, T("قاعدة نظامية مؤرّخة", "dated legal rules")],
                    [SECTION_COUNT, T("قسماً على سجل واحد", "sections on one record")],
                    [CHAIN.length, T("حلقات في دورة الإثبات", "links in the Proof Cycle")],
                  ].map(([figure, label]) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <dt style={{ order: 2, fontSize: 12, color: C.soft }}>{label}</dt>
                      <dd dir="ltr" style={{ ...MONO, margin: 0, fontSize: 30, fontWeight: 600, color: "#F1D98F", lineHeight: 1.1, textAlign: ar ? "right" : "left" }}>{figure}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </ProofWindow>
          </header>
          <Nv7Strip
            meta={(
              <>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.fill, fontWeight: 700 }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: C.fill }} />
                  {T("متوافق مع النظام", "Aligned with the law")}
                </span>
                <span>{T("إن انقطعت حلقة لم يُغلق الحكم — هذه هي القاعدة التي يُبنى عليها كل قسم.", "If one link breaks, the ruling does not close — every section is built on that rule.")}</span>
              </>
            )}
            tabs={(
              <nav aria-label={T("أقسام الصفحة", "On this page")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {pageTabs.map(([href, label, count], i) => (
                  <a key={href} href={`/${href}`} style={{ ...nv7Tab(i === 0), textDecoration: "none" }}>
                    {label}
                    {count ? <span dir="ltr" style={nv7Count(i === 0)}>{count}</span> : null}
                  </a>
                ))}
              </nav>
            )}
          />
        </div>

        <RuleLab ar={ar} />

        {/* The sections, as the option tiles of «إجراء جديد», grouped like the sidebar. */}
        <section id="sections" style={{ ...CARD, padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <CardHead
            title={T(`${SECTION_COUNT} قسماً على سجل واحد`, `${SECTION_COUNT} sections on one record`)}
            sub={T("كل قسم يقرأ من الحضور والمهام نفسها، فلا يتناقض الأجر مع الجزاء ولا الأداء مع الدوام.", "Every section reads the same attendance and tasks, so pay never contradicts discipline, nor performance the roster.")}
          />
          {SECTIONS.map(([groupAr, groupEn, rows]) => (
            <div key={groupAr} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.goldInk }}>{T(groupAr, groupEn)}</span>
              <div data-nv="tiles">
                {rows.map(([letter, nameAr, nameEn, proofAr, proofEn, law, href]) => {
                  const tile = (
                    <div data-nv="tile" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px", border: `1px solid ${C.line}`, borderRadius: 12, background: C.card, height: "100%", transition: "border-color .15s ease" }}>
                      <span aria-hidden style={{ width: 40, height: 40, borderRadius: 10, background: C.tile, color: C.green, fontFamily: HEAD, fontWeight: 700, fontSize: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ar ? letter : nameEn[0]}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <strong style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 700, color: C.ink }}>{T(nameAr, nameEn)}</strong>
                        <span style={{ fontSize: 12.5, lineHeight: 1.75, color: C.mid }}>{T(proofAr, proofEn)}</span>
                        <span dir="auto" style={{ fontSize: 11.5, fontWeight: 600, color: C.goldInk }}>{ar ? law : tagEn(law)}</span>
                      </span>
                    </div>
                  );
                  return loggedIn
                    ? <Link key={nameAr} to={href} style={{ color: "inherit", textDecoration: "none" }}>{tile}</Link>
                    : <div key={nameAr}>{tile}</div>;
                })}
              </div>
            </div>
          ))}
        </section>

        {/* The law as the case rows, and the honest list of pending links. */}
        <div id="mhrsd" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Band
            num=""
            kicker={T("الامتثال الوزاري", "Ministry compliance")}
            title={T("النظام كما هو مكتوب", "The law as written")}
            hint={T("المنصة تطبّق نصوص نظام العمل والقرارات الوزارية حرفياً، وتسمّي المادة عند كل قاعدة وكل تنبيه.", "The platform applies the Labour Law and ministerial decisions to the letter, and names the article at every rule and alert.")}
          />
          <div data-nv="law">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ ...CARD, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                <CardHead title={T("القواعد", "Rules")} sub={T("ما تقرؤه المنصة من النظام، وما تفعله به.", "What the platform reads from the law, and what it does with it.")} />
                <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LAW_FILTERS.map(([id, la, le]) => {
                    const n = id === "all" ? LAW.length : LAW.filter((row) => row[4] === id).length;
                    const on = lawFilter === id;
                    return (
                      <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setLawFilter(id)} style={statusPillStyle(on)}>
                        {T(la, le)}
                        <span dir="ltr" style={{ ...MONO, fontSize: 11, padding: "0 6px", borderRadius: 999, background: on ? "rgba(255,255,255,.22)" : "#EEF4F0", color: on ? "#fff" : C.green }}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {lawRows.map(([refAr, refEn, textAr, textEn]) => (
                <div key={refAr} style={{ ...CARD, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <ArticleChip>{T(refAr, refEn)}</ArticleChip>
                  <span style={{ fontSize: 13.5, lineHeight: 1.85, color: C.ink }}>{T(textAr, textEn)}</span>
                </div>
              ))}
            </div>
            <aside style={{ ...CARD, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <CardHead title={T("الربط الحكومي", "Government links")} sub={T("الأقسام تعمل اليوم داخل المنصة. الربط الحي بالمنصات الحكومية ينتظر الاعتماد الرسمي، ولا ندّعيه قبل ذلك.", "The sections work today inside the platform. Live links to government systems await official accreditation, and we do not claim them before then.")} />
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                {PENDING_LINKS.map(([nameAr, nameEn], i) => (
                  <li key={nameAr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${C.line}` : "none", fontSize: 13 }}>
                    <span style={{ color: C.ink, fontWeight: 700 }}>{T(nameAr, nameEn)}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#FBF3DF", color: C.goldInk }}>{T("بانتظار الاعتماد", "Awaiting accreditation")}</span>
                  </li>
                ))}
              </ul>
              <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: C.paper, fontSize: 11.5, lineHeight: 1.75, color: C.mid }}>
                {T("التوقيع في المنصة توقيع إلكتروني موثّق بسجل المنشأة، وليس شهادة حكومية مؤهلة.", "Signing in the platform is an electronic signature evidenced by the company registry, not a qualified government certificate.")}
              </p>
            </aside>
          </div>
        </div>

        {/* This release. */}
        <section id="release" style={{ ...CARD, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <CardHead
            title={T("الجديد في تحديث نوفمبر 2026", "New in the November 2026 update")}
            sub={T("ما تغيّر في هذا الإصدار، كما يراه المدير والموظف.", "What changed in this release, as a manager and an employee see it.")}
            trailing={<span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: C.fill, color: "#fff" }}>{T("آخر إصدار", "Latest")}</span>}
          />
          <div data-nv="release">
            {RELEASE.map(([titleAr, titleEn, bodyAr, bodyEn]) => (
              <div key={titleAr} style={{ padding: "14px 14px 16px", borderRadius: 12, background: C.paper, display: "flex", flexDirection: "column", gap: 6 }}>
                <strong style={{ fontFamily: HEAD, fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1.5 }}>{T(titleAr, titleEn)}</strong>
                <span style={{ fontSize: 12.5, lineHeight: 1.85, color: C.mid }}>{T(bodyAr, bodyEn)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* The subscription, from the live catalogue. */}
        <div id="pricing">
          <Band
            num=""
            kicker={T("الاشتراك", "Subscription")}
            title={planDisplayName(plan, ar ? "ar" : "en")}
            hint={T("باقة واحدة تفتح الأقسام كلها لمنشأتك وفروعها. السعر من كتالوج الباقات الحي، والمقارنة الكاملة في صفحة الاشتراك.", "One plan opens every section for your company and its branches. The price comes from the live plan catalogue; the full comparison is on the subscription page.")}
          >
            <div data-nv="plan" style={{ marginTop: 14 }}>
              <Link to="/pricing" style={{ ...nv7Tab(false), textDecoration: "none", justifySelf: "start", background: C.gold, border: `1px solid ${C.gold}`, color: "#3A2A08", fontWeight: 700 }}>
                {T("قارن الباقات", "Compare plans")}
              </Link>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <strong style={{ ...MONO, fontSize: 44, fontWeight: 600, color: "#fff", lineHeight: 1 }}>{plan.monthlyPrice}</strong>
                <span style={{ fontSize: 13, color: C.soft }}>{currencyLabel(plan.currency, ar)} / {T("شهر", "month")}</span>
              </span>
            </div>
          </Band>
        </div>
      </div>
    </MarketingChrome>
  );
}
