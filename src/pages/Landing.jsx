import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import MarketingChrome from "@/components/landing/MarketingChrome";
import SiteLoginCard from "@/components/landing/SiteLoginCard";
import MhrsdComplianceModules from "@/components/landing/MhrsdComplianceModules";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { trackVisit } from "@/lib/trackVisit";
import { DEFAULT_SUBSCRIPTION_PLANS, planDisplayName } from "@/lib/subscriptionPlans";

const SECTIONS = [
  ["01", "الحضور والدوام", "Attendance", "البصمة قبل الجدول", "Punch before the roster", "بصمة بالموقع والوقت تُقارن بالجدول. حظر الشمس والليل مبنيّان في النشر.", "A punch of person, place, and time is checked against the roster. Heat and night rules sit in publish.", "م 98 · 101 · ق 3337", "/app/attendance"],
  ["02", "التشغيل اليومي", "Daily operations", "مهمة · إثبات عمل", "Task and work proof", "كل مهمة لها صاحب وموعد ووزن، وتُغلق بمراجعة مكتوبة.", "Every task has an owner, a due date, and a weight, and closes with a written review.", "الإثبات شرط الدرجة", "/app/tasks"],
  ["03", "الطلبات", "Requests", "إجازة ومغادرة وسلفة", "Leave, exit, advance", "الرصيد يُقرأ من المادة 109، والطلب يصعد إن طال بلا قرار.", "Balance is read from Article 109, and a request escalates when a decision stalls.", "م 109 · 117", "/app/requests"],
  ["04", "الجزاءات", "Discipline", "من القائمة، بعد سماع الدفاع", "From the list, after a hearing", "لا جزاء خارج لائحة الجزاءات. إبلاغ كتابي ومهلة اعتراض.", "No penalty outside the penalty list. Written notice and an objection window.", "م 66–72", "/app/discipline", "gold"],
  ["05", "القوى العاملة", "Workforce", "الوظيفة ثابتة والشخص يتغيّر", "The seat stays, the person changes", "شجرة المقر والفروع مع وحدة موارد بشرية ثابتة ورقم وظيفي تسلسلي.", "Headquarters and branches, a fixed HR unit, and a serial job number.", "م 50 · 51", "/app/org"],
  ["06", "الأداء", "Performance", "درجة من الإثبات", "A score from proof", "المحرّكات تُقرأ من المهام المعتمدة، لا من تقدير بلا سند.", "Engines read approved tasks, not an unsupported rating.", "أوزان وصف الوظيفة", "/app/performance"],
  ["07", "صوت الموظف", "Employee voice", "الشكوى لا تصل للمشكو منه", "The complaint does not reach the subject", "تصعيد بمهلة، ومسؤول معيّن لكل مستوى.", "Timed escalation, with a named owner at each level.", "م 72", "/app/complaints", "gold"],
  ["08", "التوقيع الرقمي", "Digital signing", "موقّعون بالترتيب أو معاً", "Signers in order or together", "حقول على المستند وشهادة إتمام مختومة.", "Fields on the document and a sealed completion certificate.", "نظام التعاملات الإلكترونية", "/app/signing"],
  ["09", "السلامة", "Safety", "البلاغ قبل الحادث", "The report before the incident", "بلاغ بصورة وموقع، وتصاريح وتفتيش جاهزية.", "A report with a photo and a place, plus permits and readiness checks.", "م 121 · 122", "/app/safety"],
  ["10", "المال والأصول", "Money and assets", "الحضور يُقفل في المسير", "Attendance closes into payroll", "المسير من البصمة، والحسم بسند، والعُهد قبل المخالصة.", "Payroll from the punch, deductions with a document, custody before settlement.", "م 90 · 92 · 93", "/app/payroll"],
  ["11", "الامتثال الوزاري", "Ministry compliance", "فحص واحد قبل التفتيش", "One check before an inspection", "يمرّ على الأقسام ويُظهر مادة المخالفة وطريق الإصلاح.", "It walks the sections and names the breached article and the fix.", "المواد المقروءة", "/app", "dark"],
  ["12", "المحطات", "Stations", "ما يديره كل مدير", "What each manager runs", "نطاق كل مدير من الهيكل، والإشعارات على فروعه فقط.", "Each manager's scope comes from the org, and notices stay on their branches.", "الصلاحية من الهيكل", "/app/org"],
];

const STEPS = [
  ["01", "حضور", "Attendance", "شخص · مكان · وقت", "Person, place, time"],
  ["02", "مهمة", "Task", "صاحب وموعد ووزن", "Owner, due date, weight"],
  ["03", "إثبات", "Proof", "صورة قبل وبعد", "Before and after photos"],
  ["04", "مراجعة", "Review", "اعتماد بسبب مكتوب", "Approval with a written reason"],
  ["05", "ختم", "Seal", "توقيع للعميل", "A signature for the client"],
];

const WHY = [
  ["المواد ظاهرة تحت كل قسم", "The article sits under each section", "كل قاعدة باسم مادتها، وتنبيه باسم الموظف حين تُخالَف.", "Each rule names its article, and a breach names the employee."],
  ["لا حكم بلا إثبات", "No ruling without proof", "الجزاء والأداء والمسير تُقرأ من سجل واحد.", "Discipline, performance, and payroll read one record."],
  ["حظر الشمس والليل في الجدول", "Heat and night sit in the roster", "لا يُنشر دوام يخالف القرار 3337 أو 18632.", "A shift that breaks Decision 3337 or 18632 cannot be published."],
  ["تقرير تفتيش من الفحص", "An inspection report from the check", "فحص الامتثال يُظهر المادة والاسم وطريق الإصلاح.", "The compliance check shows the article, the name, and the fix."],
];

function toneStyle(tone) {
  if (tone === "gold") return { background: "#FBF3E1", color: "#8A5A12" };
  if (tone === "dark") return { background: "#0F2A1C", color: "#fff" };
  return { background: "#E6F2EA", color: "#2F6B43" };
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
    <MarketingChrome
      ar={ar}
      lang={lang}
      loggedIn={loggedIn}
      onToggleLang={() => setLang(ar ? "en" : "ar")}
      ctaHref="/pricing"
      ctaLabel={T("ابدأ التجربة", "Start the trial")}
    >
      <style>{`
        @media (max-width: 980px) {
          [data-nv="hero-grid"] { grid-template-columns: 1fr !important; }
          [data-nv="sec-grid"] { grid-template-columns: 1fr !important; }
          [data-nv="price-grid"] { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <section style={{ background: "#0F2A1C", color: "#E7F0EA", borderBottom: "4px solid #C8A45A" }}>
        <div data-nv="hero-grid" style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 48px 40px", display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 400px)", gap: 36, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#E9D9AE", fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 16, height: 2, background: "#C8A45A", borderRadius: 2 }} />
              {T("منصة تشغيل سعودية", "A Saudi operations platform")}
            </span>
            <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.35, fontWeight: 700, color: "#fff" }}>
              {T("إثبات العمل قبل الحكم عليه", "Prove the work before judging it")}
            </h1>
            <p style={{ margin: 0, maxWidth: 560, fontSize: 15, lineHeight: 1.9, color: "#C5DBCD" }}>
              {T("حضور، مهمة، مراجعة، تصعيد، توقيع، ثم إثبات للعميل. كل حكم يُقرأ من السجل نفسه.", "Attendance, task, review, escalation, signature, then client proof. Every ruling reads the same record.")}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to={loggedIn ? "/app" : "/login"} style={{ height: 44, display: "inline-flex", alignItems: "center", padding: "0 18px", borderRadius: 8, background: "#C8A45A", color: "#3A2A08", fontWeight: 700, textDecoration: "none" }}>
                {T("ادخل المنصة", "Enter the platform")}
              </Link>
              <a href="#sections" style={{ height: 44, display: "inline-flex", alignItems: "center", padding: "0 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,.35)", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
                {T("استعرض الأقسام", "Browse the sections")}
              </a>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 8 }}>
              {[
                ["14", T("قسماً في ملف واحد", "sections in one file")],
                ["48", T("ساعة حدّ أسبوعي · المادة 98", "weekly hours · Article 98")],
                ["0", T("قرار بلا سبب مكتوب", "decisions without a written reason")],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong style={{ display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, color: "#fff" }}>{value}</strong>
                  <span style={{ fontSize: 12, color: "#A9CDB8" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div id="login" data-login-card style={{ background: "#fff", color: "#111418", borderRadius: 16, padding: 18, boxShadow: "0 16px 40px rgba(0,0,0,.18)" }}>
            {loggedIn ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <strong style={{ fontSize: 16 }}>{currentUser?.name || currentUser?.email}</strong>
                <span style={{ fontSize: 12, color: "#555C66" }}>{T("جلسة المنصة مفتوحة.", "The platform session is open.")}</span>
                <Link to="/app" style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#3C7D50", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
                  {T("ادخل المنصة", "Enter the platform")}
                </Link>
              </div>
            ) : (
              <SiteLoginCard ar={ar} />
            )}
          </div>
        </div>
      </section>

      <div style={{ background: "#F4F7F5", borderBottom: "1px solid #E4E9E6" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "12px 48px", display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#3A4048" }}>
          {[
            ["م 98", "ساعات العمل", "Working hours"],
            ["م 101", "الراحة", "Rest"],
            ["ق 3337", "حظر الشمس", "Heat ban"],
            ["ق 18632", "العمل الليلي", "Night work"],
            ["م 66–72", "التأديب", "Discipline"],
            ["م 109", "الإجازات", "Leave"],
          ].map(([ref, arLabel, enLabel]) => (
            <span key={ref} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{ref}</strong>
              {T(arLabel, enLabel)}
            </span>
          ))}
        </div>
      </div>

      <section id="sections" style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 48px 16px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 26 }}>{T("اثنا عشر قسماً، ملف واحد لكل موظف", "Twelve sections, one file per employee")}</h2>
        <p style={{ margin: "0 0 18px", color: "#555C66", fontSize: 14 }}>{T("كل قسم يُغلق على السجل نفسه الذي يُغلق عليه الحضور والتوقيع.", "Each section closes on the same record as attendance and signing.")}</p>
        <div data-nv="sec-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {SECTIONS.map(([num, nameAr, nameEn, tagAr, tagEn, bodyAr, bodyEn, law, href, tone]) => {
            const card = (
              <article style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 14, padding: 16, minHeight: 168, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, ...toneStyle(tone) }}>{num}</span>
                <strong style={{ fontSize: 16 }}>{T(nameAr, nameEn)}</strong>
                <span style={{ fontSize: 12, color: "#8A5A12", fontWeight: 600 }}>{T(tagAr, tagEn)}</span>
                <p style={{ margin: 0, fontSize: 13, color: "#3A4048", lineHeight: 1.7, flex: 1 }}>{T(bodyAr, bodyEn)}</p>
                <span style={{ fontSize: 11.5, color: "#2F6B43", fontWeight: 600 }}>{law}</span>
              </article>
            );
            return loggedIn ? <Link key={num} to={href} style={{ color: "inherit", textDecoration: "none" }}>{card}</Link> : <div key={num}>{card}</div>;
          })}
        </div>
      </section>

      <section id="how" style={{ background: "#0F2A1C", color: "#E7F0EA", marginTop: 36 }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 48px" }}>
          <h2 style={{ margin: "0 0 18px", color: "#fff", fontSize: 26 }}>{T("من الحضور إلى الختم في خمس خطوات", "From attendance to the seal in five steps")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {STEPS.map(([n, titleAr, titleEn, bodyAr, bodyEn]) => (
              <div key={n} style={{ border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: 14 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#C8A45A", fontWeight: 700 }}>{n}</span>
                <strong style={{ display: "block", marginTop: 8, color: "#fff" }}>{T(titleAr, titleEn)}</strong>
                <span style={{ fontSize: 12, color: "#A9CDB8" }}>{T(bodyAr, bodyEn)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 48px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 26 }}>{T("اشتراك المنصة", "Platform subscription")}</h2>
        <div data-nv="price-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)", gap: 14 }}>
          <article style={{ background: "#0F2A1C", color: "#E7F0EA", borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ color: "#E9D9AE", fontSize: 12, fontWeight: 600 }}>{planDisplayName(plan, ar ? "ar" : "en")}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 42, color: "#fff" }}>{plan.monthlyPrice}</strong>
              <span>{plan.currency} / {T("شهر", "month")}</span>
            </div>
            <p style={{ margin: 0, color: "#C5DBCD", fontSize: 13, lineHeight: 1.8 }}>
              {T("السعر من كتالوج الباقات الحي. التفاصيل والمقارنة في صفحة الاشتراك.", "The price comes from the live plan catalog. Detail and comparison sit on the subscription page.")}
            </p>
            <Link to="/pricing" style={{ marginTop: 8, height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#C8A45A", color: "#3A2A08", fontWeight: 700, textDecoration: "none" }}>
              {T("ابدأ التجربة", "Start the trial")}
            </Link>
          </article>
          <article style={{ background: "#fff", border: "1px solid #E4E9E6", borderRadius: 16, padding: 22 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>{T("لماذا تُعجب الوزارة", "Why the ministry can read it")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {WHY.map(([titleAr, titleEn, bodyAr, bodyEn]) => (
                <div key={titleAr}>
                  <strong style={{ display: "block", fontSize: 14 }}>{T(titleAr, titleEn)}</strong>
                  <span style={{ fontSize: 13, color: "#555C66" }}>{T(bodyAr, bodyEn)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <div id="mhrsd">
        <MhrsdComplianceModules ar={ar} />
      </div>
    </MarketingChrome>
  );
}
