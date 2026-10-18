import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import MarketingChrome from "@/components/landing/MarketingChrome";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { trackVisit } from "@/lib/trackVisit";
import { DEFAULT_SUBSCRIPTION_PLANS, planDisplayName } from "@/lib/subscriptionPlans";

/*
 * The public face of NiroVera — rebuilt in the platform's own identity: the dark green of the app chrome,
 * one gold accent, Readex Pro for the few large lines, IBM Plex Sans Arabic for the reading, mono Latin digits
 * for every article and figure. One job per band, nothing said twice:
 *   1. the claim and the Proof Cycle (the memorable thing — a connected chain, not a picture);
 *   2. the sections as a ledger (what each proves, and under which article);
 *   3. the law the platform reads, and what is honestly still pending;
 *   4. what changed in this release;
 *   5. the subscription, from the live plan catalogue.
 * No trial or "enter" buttons, no hero image: the header keeps a quiet sign-in link.
 */

const C = {
  green: "#0B3D27",
  deep: "#0A2E1E",
  gold: "#C8A45A",
  goldInk: "#7A5B1C",
  paper: "#F4F7F5",
  card: "#FFFFFF",
  line: "#E3E9E5",
  ink: "#111418",
  mid: "#4A5852",
  soft: "#A9CDB8",
};
const DISPLAY = "'Readex Pro','IBM Plex Sans Arabic',sans-serif";
const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums" };

/** The Proof Cycle — six links, in order (CLAUDE.md). */
const CHAIN = [
  ["حضور", "Attendance", "الشخص والمكان والوقت", "Person, place, time"],
  ["مهمة", "Task", "وزن الجهد والدليل وإقرار الموظف", "Effort, evidence, attestation"],
  ["مراجعة", "Review", "اعتماد أو رفض بسبب مكتوب", "Approve or reject with a written reason"],
  ["تصعيد", "Escalation", "حين تنقضي المهلة بلا تقدّم", "When time runs out without progress"],
  ["توقيع", "Signature", "توقيع آمن وبصمة الملف", "Secure signature and file fingerprint"],
  ["إثبات للعميل", "Client proof", "حقول مسموحة ورابط تحقق عام", "Allowed fields and a public verify link"],
];

/** The sections — what each one proves, and the rule it reads. */
const SECTIONS = [
  ["الحضور والدوام", "Attendance", "البصمة تُقارن بالجدول، والراحة والشمس والليل في مسار اليوم", "The punch against the roster; rest, sun and night on the day's path", "م 98 · 101", "/app/attendance"],
  ["الجدول", "Roster", "لا يُنشر دوام يخالف ساعات العمل أو حظر الشمس أو العمل الليلي", "No shift that breaks hours, heat or night rules is published", "ق 3337 · 18632", "/app/shifts"],
  ["المهام وإثبات العمل", "Tasks and work proof", "مهمة بصاحب وموعد ووزن، تُغلق بمراجعة مكتوبة", "An owner, a due date and a weight, closed by a written review", "الإثبات شرط", "/app/tasks"],
  ["الطلبات", "Requests", "الرصيد من النظام، والطلب يصعد إن طال بلا قرار", "Balances from the law; a stalled request escalates", "م 109 · 117", "/app/requests"],
  ["الأجور والمخالصة", "Pay and settlement", "المسير من البصمة، والحسم بسند، والإضافي يُسجَّل تلقائياً", "Payroll from the punch, deductions with a document, overtime logged", "م 90 · 107", "/app/payroll"],
  ["الجزاءات", "Discipline", "لا جزاء خارج اللائحة، وبعد سماع الدفاع ومهلة الاعتراض", "None outside the list, after a hearing and an appeal window", "م 66–72", "/app/discipline"],
  ["الأداء", "Performance", "الدرجة من المهام المعتمدة، لا من تقدير بلا سند", "A score from approved tasks, not an unsupported rating", "وصف الوظيفة", "/app/performance"],
  ["صوت الموظف", "Employee voice", "الشكوى لا تصل إلى المشكو منه، وتصعد بمهلة", "A complaint never reaches its subject, and escalates on time", "م 72", "/app/complaints"],
  ["السلامة", "Safety", "بلاغ بصورة وموقع، وتصاريح وتفتيش جاهزية", "A report with a photo and a place, permits and readiness checks", "م 121 · 122", "/app/safety"],
  ["التوقيع الرقمي", "Digital signing", "موقّعون بالترتيب أو معاً، وإيصال وبصمة لكل مستند", "Signers in order or together, a receipt and a fingerprint", "التعاملات الإلكترونية", "/app/signing"],
  ["القوى العاملة", "Workforce", "المقر والفروع، والوظيفة ثابتة والشخص يتغيّر", "Head office and branches; the seat stays, the person changes", "م 50 · 51", "/app/org"],
  ["المساعد", "Assistant", "اسأل بيانات المنشأة بالعربية في حدود صلاحيتك", "Ask the company's data in Arabic, within your permissions", "الصلاحية من الهيكل", "/app/assistant"],
];

/** The law the platform reads — article, then what the platform does with it. */
const LAW = [
  ["م 98", "Art. 98", "ثماني ساعات في اليوم أو ثمان وأربعون في الأسبوع — المنشأة تختار المعيار، والإضافي يُحسب به.", "Eight hours a day or forty-eight a week — the company picks the criterion; overtime follows it."],
  ["م 101", "Art. 101", "لا عمل أكثر من خمس ساعات متصلة؛ راحة نصف ساعة تجمع الراحة والصلاة والطعام، وبقاء لا يتجاوز اثنتي عشرة ساعة.", "No more than five hours in a row; half an hour for rest, prayer and food; no more than twelve hours on site."],
  ["م 102", "Art. 102", "الراحة ليست من ساعات العمل، ولا بصمة ولا موقع أثناءها.", "Rest is not working time — no punch and no location during it."],
  ["م 107", "Art. 107", "ما زاد على المعيار يُسجَّل عملاً إضافياً بانتظار قرار الأجر أو الإجازة.", "Time past the criterion is logged as overtime, awaiting a pay or leave decision."],
  ["ق 3337", "Dec. 3337", "لا عمل مكشوف تحت الشمس من 12:00 إلى 15:00، من 15 يونيو إلى 15 سبتمبر.", "No sun-exposed work 12:00–15:00, 15 June to 15 September."],
  ["ق 18632", "Dec. 18632", "الليل من 23:00 إلى 06:00: راحة 12 ساعة، وتدوير بعد ثلاثة أشهر، وإسعاف ونقل وطعام.", "Night is 23:00–06:00: 12 hours' rest, rotation after three months, first aid, transport and food."],
  ["م 17", "Art. 17", "جدول مواعيد العمل والراحة ويوم الراحة يُعلَّق في موقع العمل، ويراه كل موظف في «جدولي».", "The hours, rest and rest-day table is posted on site, and every worker sees it in «My schedule»."],
  ["ق 115921", "Dec. 115921", "اللائحة التنفيذية لعام 1446هـ ونموذج لائحة تنظيم العمل.", "The 1446 AH implementing regulations and the model work regulation."],
];

const PENDING_LINKS = ["قوى", "التأمينات", "مدد", "نفاذ"];
const PENDING_LINKS_EN = ["Qiwa", "GOSI", "Mudad", "Nafath"];

/** This release — what changed, in the words a manager would use. */
const RELEASE = [
  ["الراحة بنص المادة 101", "Rest by Art. 101", "نصف ساعة قبل أن تكتمل خمس ساعات، تُخصم وحدها بلا بصمة، وراحتان في دوام اثنتي عشرة ساعة.", "Half an hour before five hours, deducted on its own with no punch; two on a twelve-hour day."],
  ["معيار ساعات العمل", "Hours criterion", "يومي أو أسبوعي من جدول الإدارة، ويُحسب العمل الإضافي بالمعيار المختار.", "Daily or weekly, set on the roster; overtime follows the chosen criterion."],
  ["التوقيع كما سيُطبع", "Signing as printed", "حقل التوقيع يعرض توقيع كل موقّع باسمه وتاريخه، وإيصال إرسال برقم مرجع.", "Each signature field previews the signer's own mark and date; a dispatch receipt with a reference."],
  ["أرشيف بقاعدة واحدة", "One archive rule", "ما حُسم يبقى ثلاثين يوماً ثم ينتقل إلى الأرشيف، في كل الأقسام.", "Anything decided stays thirty days, then moves to the archive — in every section."],
  ["مسار اليوم", "The day's path", "حد الخمس ساعات ومواعيد الصلوات وحظر الشمس في مكانها من اليوم.", "The five-hour mark, prayer times and the heat ban, each at its time of day."],
];

function Band({ id, tone = "paper", children, pad = "64px 48px" }) {
  const bg = tone === "green" ? C.green : tone === "card" ? C.card : C.paper;
  return (
    <section id={id} data-nv="pad" style={{ background: bg, padding: pad, borderTop: tone === "card" ? `1px solid ${C.line}` : "none" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function Heading({ title, lead, onDark = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28, maxWidth: 680 }}>
      <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 28, fontWeight: 600, lineHeight: 1.4, color: onDark ? "#fff" : C.ink }}>{title}</h2>
      {lead ? <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.9, color: onDark ? C.soft : C.mid }}>{lead}</p> : null}
    </div>
  );
}

export default function Landing() {
  const { lang, setLang } = useI18n();
  const { session, currentUser } = useAuth();
  const loggedIn = Boolean(session?.userId && currentUser);
  const ar = lang === "ar";
  const T = (a, e) => (ar ? a : e);
  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((row) => row.slug === "professional") || DEFAULT_SUBSCRIPTION_PLANS[2];

  useEffect(() => {
    trackVisit("/");
  }, []);

  return (
    <MarketingChrome ar={ar} lang={lang} loggedIn={loggedIn} onToggleLang={() => setLang(ar ? "en" : "ar")}>
      <style>{`
        [data-nv="chain"] { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); }
        [data-nv="ledger"] { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 40px; }
        [data-nv="law"] { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(260px, 1fr); gap: 32px; align-items: start; }
        [data-nv="release"] { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
        [data-nv="plan"] { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; }
        @media (max-width: 1000px) {
          [data-nv="chain"] { grid-template-columns: 1fr; }
          [data-nv="chain"] > li { display: grid !important; grid-template-columns: 31px 1fr; column-gap: 12px !important; row-gap: 2px !important; align-items: center !important; text-align: start !important; padding: 0 0 14px !important; }
          [data-nv="chain"] > li > span:first-child { grid-row: 1 / span 2; grid-column: 1; }
          [data-nv="chain"] > li > strong, [data-nv="chain"] > li > span:last-child { grid-column: 2; }
          [data-nv="chain"] > li > span:last-child { max-width: none !important; }
          [data-nv="chain-note"] { text-align: start !important; }
          [data-nv="chain-rule"] { display: none; }
          [data-nv="ledger"], [data-nv="law"], [data-nv="plan"] { grid-template-columns: 1fr; }
          [data-nv="release"] { grid-template-columns: 1fr; }
          [data-nv="release"] > div { border-inline-start: none !important; border-top: 1px solid ${C.line}; padding: 16px 0 !important; }
          [data-nv="hero-title"] { font-size: 34px !important; }
        }
      `}</style>

      {/* 1 · The claim, and the Proof Cycle as one connected chain. */}
      <section id="how" data-nv="pad" style={{ background: C.green, color: "#E7F0EA", padding: "72px 48px 56px", borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 44 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
            <h1 data-nv="hero-title" style={{ margin: 0, fontFamily: DISPLAY, fontSize: 46, fontWeight: 600, lineHeight: 1.35, color: "#fff" }}>
              {T("العمل يُثبَت قبل أن يُحكم عليه", "Work is proven before it is judged")}
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 2, color: "#C5DBCD", maxWidth: 620 }}>
              {T(
                "نيروفيرا منصة موارد بشرية سعودية لا تكتفي بتسجيل العمل، بل تثبته: كل حكم — أجر أو جزاء أو درجة — يُقرأ من سجل واحد، وتحت كل قاعدة اسم مادتها من نظام العمل.",
                "NiroVera is a Saudi HR platform that does not only record work — it proves it. Every ruling, whether pay, a penalty or a score, reads one record, and every rule names its Labour Law article.",
              )}
            </p>
          </div>

          <ol data-nv="chain" aria-label={T("دورة الإثبات", "The Proof Cycle")} style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
            <span data-nv="chain-rule" aria-hidden style={{ position: "absolute", top: 15, insetInline: "8.33%", height: 1, background: "rgba(200,164,90,.55)" }} />
            {CHAIN.map(([nameAr, nameEn, noteAr, noteEn], i) => (
              <li key={nameAr} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, padding: "0 8px" }}>
                <span style={{ ...MONO, width: 31, height: 31, borderRadius: "50%", background: i === CHAIN.length - 1 ? C.gold : C.green, border: `1px solid ${C.gold}`, color: i === CHAIN.length - 1 ? C.deep : C.gold, fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>{i + 1}</span>
                <strong style={{ fontFamily: DISPLAY, fontSize: 15.5, fontWeight: 600, color: "#fff" }}>{T(nameAr, nameEn)}</strong>
                <span style={{ fontSize: 12, lineHeight: 1.7, color: C.soft, maxWidth: 170 }}>{T(noteAr, noteEn)}</span>
              </li>
            ))}
          </ol>
          <p data-nv="chain-note" style={{ margin: 0, fontSize: 12.5, color: C.soft, textAlign: "center" }}>
            {T("إن انقطعت حلقة لم يُغلق الحكم. هذه هي القاعدة التي يُبنى عليها كل قسم.", "If one link breaks, the ruling does not close. Every section is built on that rule.")}
          </p>
        </div>
      </section>

      {/* 2 · The sections, as a ledger. */}
      <Band id="sections" tone="paper">
        <Heading
          title={T("اثنا عشر قسماً على سجل واحد", "Twelve sections on one record")}
          lead={T("كل قسم يقرأ من الحضور والمهام نفسها، فلا يتناقض الأجر مع الجزاء ولا الأداء مع الدوام.", "Every section reads the same attendance and tasks, so pay never contradicts discipline, nor performance the roster.")}
        />
        <div data-nv="ledger" style={{ borderTop: `1px solid ${C.ink}` }}>
          {SECTIONS.map(([nameAr, nameEn, proofAr, proofEn, law, href]) => {
            const row = (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "4px 16px", padding: "16px 0", borderBottom: `1px solid ${C.line}`, alignItems: "baseline" }}>
                <strong style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.ink }}>{T(nameAr, nameEn)}</strong>
                <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 600, color: C.goldInk, whiteSpace: "nowrap" }}>{law}</span>
                <span style={{ gridColumn: "1 / -1", fontSize: 13.5, lineHeight: 1.8, color: C.mid }}>{T(proofAr, proofEn)}</span>
              </div>
            );
            return loggedIn
              ? <Link key={nameAr} to={href} style={{ color: "inherit", textDecoration: "none" }}>{row}</Link>
              : <div key={nameAr}>{row}</div>;
          })}
        </div>
      </Band>

      {/* 3 · The law it reads — and what is honestly still pending. */}
      <Band id="mhrsd" tone="card">
        <Heading
          title={T("النظام كما هو مكتوب", "The law as written")}
          lead={T("المنصة تطبّق نصوص نظام العمل والقرارات الوزارية حرفياً، وتسمّي المادة عند كل قاعدة وكل تنبيه.", "The platform applies the Labour Law and ministerial decisions to the letter, and names the article at every rule and alert.")}
        />
        <div data-nv="law">
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 22 }}>
            {LAW.map(([refAr, refEn, textAr, textEn], i) => (
              <React.Fragment key={refAr}>
                <dt style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700, color: C.green, padding: "13px 0", borderTop: i ? `1px solid ${C.line}` : "none", whiteSpace: "nowrap" }}>{T(refAr, refEn)}</dt>
                <dd style={{ margin: 0, fontSize: 13.5, lineHeight: 1.85, color: C.ink, padding: "13px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>{T(textAr, textEn)}</dd>
              </React.Fragment>
            ))}
          </dl>
          <aside style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 22, background: C.paper, display: "flex", flexDirection: "column", gap: 14 }}>
            <strong style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.ink }}>{T("الربط الحكومي", "Government links")}</strong>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.85, color: C.mid }}>
              {T("الأقسام تعمل اليوم داخل المنصة. الربط الحي بالمنصات الحكومية ينتظر الاعتماد الرسمي، ولا ندّعيه قبل ذلك.", "The sections work today inside the platform. Live links to government systems await official accreditation, and we do not claim them before then.")}
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
              {(ar ? PENDING_LINKS : PENDING_LINKS_EN).map((name, i) => (
                <li key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none", fontSize: 13 }}>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{name}</span>
                  <span style={{ color: C.goldInk }}>{T("بانتظار الاعتماد", "Awaiting accreditation")}</span>
                </li>
              ))}
            </ul>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.75, color: C.mid }}>
              {T("التوقيع في المنصة توقيع إلكتروني موثّق بسجل المنشأة، وليس شهادة حكومية مؤهلة.", "Signing in the platform is an electronic signature evidenced by the company registry, not a qualified government certificate.")}
            </p>
          </aside>
        </div>
      </Band>

      {/* 4 · This release. */}
      <Band id="release" tone="paper">
        <Heading
          title={T("الجديد في تحديث أكتوبر 2026", "New in the October 2026 update")}
          lead={T("ما تغيّر في هذا الإصدار، كما يراه المدير والموظف.", "What changed in this release, as a manager and an employee see it.")}
        />
        <div data-nv="release" style={{ borderTop: `1px solid ${C.ink}`, borderBottom: `1px solid ${C.line}` }}>
          {RELEASE.map(([titleAr, titleEn, bodyAr, bodyEn], i) => (
            <div key={titleAr} style={{ padding: "18px 18px 20px", borderInlineStart: i ? `1px solid ${C.line}` : "none", display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: C.ink, lineHeight: 1.5 }}>{T(titleAr, titleEn)}</strong>
              <span style={{ fontSize: 13, lineHeight: 1.85, color: C.mid }}>{T(bodyAr, bodyEn)}</span>
            </div>
          ))}
        </div>
      </Band>

      {/* 5 · The subscription, from the live catalogue. */}
      <Band id="pricing" tone="green" pad="56px 48px">
        <div data-nv="plan">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, color: "#fff" }}>{T("الاشتراك", "Subscription")}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, color: C.soft, maxWidth: 560 }}>
              {T("باقة واحدة تفتح الأقسام كلها لمنشأتك وفروعها. السعر من كتالوج الباقات الحي، والمقارنة الكاملة في صفحة الاشتراك.", "One plan opens every section for your company and its branches. The price comes from the live plan catalogue; the full comparison is on the subscription page.")}
            </p>
            <Link to="/pricing" style={{ fontSize: 13.5, fontWeight: 600, color: C.gold, textDecoration: "underline", textUnderlineOffset: 4, alignSelf: "flex-start" }}>
              {T("قارن الباقات", "Compare plans")}
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: ar ? "flex-start" : "flex-end", gap: 4 }}>
            <span style={{ fontSize: 12.5, color: "#E9D9AE", fontWeight: 600 }}>{planDisplayName(plan, ar ? "ar" : "en")}</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong style={{ ...MONO, fontSize: 48, fontWeight: 600, color: "#fff", lineHeight: 1 }}>{plan.monthlyPrice}</strong>
              <span style={{ fontSize: 13, color: C.soft }}>{plan.currency} / {T("شهر", "month")}</span>
            </span>
          </div>
        </div>
      </Band>
    </MarketingChrome>
  );
}
