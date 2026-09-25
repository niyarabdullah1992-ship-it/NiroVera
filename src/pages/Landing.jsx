import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import MarketingChrome from "@/components/landing/MarketingChrome";
import LandingProofStrip from "@/components/landing/LandingProofStrip";
import EnterprisePilotPath from "@/components/landing/EnterprisePilotPath";
import MhrsdComplianceModules from "@/components/landing/MhrsdComplianceModules";
import SuiteAppsGallery from "@/components/suite/SuiteAppsGallery";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { trackVisit } from "@/lib/trackVisit";
import { DEFAULT_SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import { publicSuiteApps } from "@/lib/suiteApps";
import {
  ACCENT,
  BORDER,
  BRAND_BORDER,
  BRAND_SOFT,
  CARD,
  INK,
  MUTED,
  NAVY, NAVY_FILL,
  ON_NAVY,
  ON_NAVY_ACCENT,
  ON_NAVY_MUTED,
  SURFACE,
} from "@/lib/publicChrome";

const PAD = { paddingLeft: "48px", paddingRight: "48px" };

/**
 * Marketing landing — NiroVera Landing.dc.html L30–266 (inline styles AS-IS).
 * App-only marketing blocks demoted below primary.
 */
export default function Landing() {
  const { lang, setLang } = useI18n();
  const { session, currentUser } = useAuth();
  const loggedIn = Boolean(session?.userId && currentUser);
  const ar = lang === "ar";
  const T = (a, e) => (ar ? a : e);
  const numAlign = ar ? "right" : "left";

  useEffect(() => {
    trackVisit("/");
  }, []);

  /** First-viewport MHRSD strip — honest live-gov status (not decorative). */
  const heroGov = [
    { title: T("طلبات الإجازة", "Leave Requests"), note: T("الاستحقاق ونهاية الخدمة", "Entitlement & end-of-service"), chip: T("جاهز في المنصة", "Ready in product"), live: false, href: "#mhrsd-leave" },
    { title: T("الموارد البشرية", "Human Resources"), note: T("نظام العمل والعقود", "Labour Law & contracts"), chip: T("جاهز في المنصة", "Ready in product"), live: false, href: "#mhrsd-hr" },
    { title: T("الرواتب", "Payroll"), note: T("حماية الأجور · مدى / WPS", "Wage protection · Mudad / WPS"), chip: T("قيد الربط الحي", "Live link pending"), live: true, href: "#mhrsd-payroll" },
  ];

  const problems = [
    { value: "7", text: T("أدوات منفصلة في المتوسط: إكسل، واتساب، ورق، بريد، ونظام حضور مستقل.", "Seven separate tools on average: spreadsheets, chat apps, paper, email and a standalone attendance system.") },
    { value: "3h", text: T("يوميًا من وقت المشرفين تذهب في جمع البيانات وتجميع التقارير يدويًا.", "Three hours of supervisor time a day spent collecting data and assembling reports by hand.") },
    { value: "48h", text: T("متوسط التأخير حتى تصل مشكلة ميدانية إلى من يملك قرار حلّها.", "The average delay before a field problem reaches the person who can decide on it.") },
  ];

  const proofPoints = [
    T("الحضور يُتحقق منه بموقع الفرع، لا بضغطة زر من أي مكان.", "Attendance is verified against the station's location, not a button press from anywhere."),
    T("كل تغيير على البيانات يُسجَّل تلقائيًا: من، ومتى، وماذا تغيّر بالضبط.", "Every data change is logged automatically: who, when, and exactly what changed."),
    T("البلاغ المجهول يصل برمز متغيّر كل ثلاثين يومًا، فلا يُربط بصاحبه من داخل النظام.", "Anonymous reports arrive under a code that rotates every thirty days, so they can't be traced from inside the system."),
  ];

  const compareRows = [
    { criterion: T("مدة التطبيق", "Implementation time"), legacy: T("6 إلى 18 شهرًا", "6 to 18 months"), nirovera: T("أسبوعان", "Two weeks") },
    { criterion: T("التدريب المطلوب", "Training required"), legacy: T("دورات لكل وحدة", "A course per module"), nirovera: T("الفني يسجّل حضوره من هاتفه بلا تدريب", "Technicians check in from their phone with no training") },
    { criterion: T("اللغة والاتجاه", "Language and direction"), legacy: T("عربية مضافة على واجهة إنجليزية", "Arabic bolted onto an English interface"), nirovera: T("عربية أصلية من اليمين لليسار", "Native right-to-left Arabic") },
    { criterion: T("العمل الميداني", "Field work"), legacy: T("إدخال لاحق من المكتب", "Entered later from the office"), nirovera: T("إثبات مصوّر مختوم بالموقع والوقت", "Photo proof stamped with location and time") },
    { criterion: T("امتثال الوزارة", "Ministry compliance"), legacy: T("ملفات منفصلة وتذكير يدوي", "Separate files and manual reminders"), nirovera: T("بوابات نظام العمل · WPS · GOSI · قوى · نطاقات", "Labour Law gates · WPS · GOSI · Qiwa · Nitaqat") },
    { criterion: T("التكلفة السنوية", "Annual cost"), legacy: T("مئات الآلاف قبل التخصيص", "Hundreds of thousands before customization"), nirovera: T("اشتراك ثابت بلا رسوم تطبيق", "A flat subscription with no implementation fee") },
    { criterion: T("مسار الشركات الكبيرة", "Enterprise entry"), legacy: T("استبدال كامل أو لا شيء", "Full rip-and-replace or nothing"), nirovera: T("تجريب موقع واحد 90 يومًا فوق النظام الحالي", "90-day one-site pilot on top of your current stack") },
  ];

  const publicAppCount = publicSuiteApps().length;

  const plans = DEFAULT_SUBSCRIPTION_PLANS.filter((plan) => plan.slug !== "free").map((plan) => {
    const isEnterprise = plan.slug === "enterprise";
    const isPro = plan.slug === "professional";
    return {
      name: T(plan.nameAr, plan.nameEn),
      tag: isPro ? T("الأكثر اختيارًا", "Most chosen") : "",
      price: isEnterprise ? T("حسب الاتفاق", "Custom") : String(plan.monthlyPrice),
      unit: isEnterprise ? "" : `${plan.currency} / ${T("موظف / شهر", "employee / month")}`,
      desc: isEnterprise
        ? T(
            "تجريب موقع واحد، تكامل لاحق مع الأنظمة القائمة، عزل بيانات الشركة، ودعم تشغيلي مسمّى.",
            "One-site pilot, later integration with your stack, company data isolation, and a named ops contact.",
          )
        : isPro
          ? T(
              `كل ${publicAppCount} تطبيقًا في الحزمة، بما فيها الرواتب والتوقيع الرقمي ومركز امتثال الوزارة والمساعد الذكي.`,
              `All ${publicAppCount} suite apps, including payroll, digital signing, MHRSD compliance centre and the AI assistant.`,
            )
          : T(plan.featuresAr.join(" · "), plan.featuresEn.join(" · ")),
      cta: isEnterprise ? T("اطلب تجريب موقع", "Request a site pilot") : T("ابدأ", "Get started"),
      dark: isPro,
      priceBig: !isEnterprise,
    };
  });

  const security = [
    { title: T("التزام نظامي مبني في الملف", "Regulatory compliance built into the file"), text: T("ملف الموظف يحمل الإقامة ورخصة العمل والتأمينات والمسمى في قوى، ويُنبَّه تلقائيًا قبل انتهاء أي منها بستين يومًا — بوابات بأسماء أسباب.", "Each employee file carries Iqama, work permit, GOSI and the Qiwa job title, and flags any of them sixty days before expiry — named gates.") },
    { title: T("حماية الأجور ونطاقات", "Wage protection & Nitaqat"), text: T("صفوف مدى/WPS مشتقة قبل الإيداع، ونسبة التوطين من السجل — الإرسال الحي لقوى والتأمينات ومدى قيد الربط عند الاعتمادات.", "Mudad/WPS rows derived before deposit, and Saudization from the register — live Qiwa/GOSI/Mudad send pending credentials.") },
    { title: T("سجل تدقيق تلقائي", "Automatic audit trail"), text: T("كل تغيير على البيانات يُسجَّل من مصدره — دون أن يعتمد على انضباط المستخدم أو تذكّره.", "Every data change is logged at its source — it doesn't depend on user discipline or memory.") },
    { title: T("صلاحيات وتصعيد", "Permissions & escalation"), text: T("الصلاحية من الدور والهيكل معًا؛ البلاغات تُصعَّد تلقائيًا عند تجاوز زمن الاستجابة.", "Access from role and org structure together; reports escalate automatically when response time is breached.") },
  ];

  return (
    <MarketingChrome ar={ar} lang={lang} loggedIn={loggedIn} onToggleLang={() => setLang(ar ? "en" : "ar")}>
      <style>{`
        @media (max-width: 900px) {
          [data-nv="split"] { flex-direction: column !important; }
          [data-nv="h1"] { font-size: 40px !important; }
          [data-nv="h2"] { font-size: 30px !important; }
          [data-nv="proof-grid"] { grid-template-columns: 1fr 1fr !important; }
          [data-nv="mod-grid"] { grid-template-columns: 1fr 1fr !important; }
          [data-nv="hero-gov"] { grid-template-columns: 1fr 1fr !important; }
        }
        @media (min-width: 901px) {
          [data-nv="proof-arrow"] { display: inline !important; }
        }
      `}</style>

      {/* Institutional hero — brand + one promise + CTAs */}
      <section
        data-nv="pad"
        style={{
          padding: "0",
          minHeight: "min(92vh, 820px)",
          background: `linear-gradient(155deg, ${NAVY_FILL} 0%, #0f1c33 48%, color-mix(in oklab, ${NAVY} 88%, #1E9E63) 100%)`,
          position: "relative",
          overflow: "hidden",
          color: ON_NAVY,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 55% 45% at 85% 20%, rgba(30,158,99,0.22), transparent 55%), radial-gradient(ellipse 40% 50% at 10% 90%, rgba(255,255,255,0.05), transparent 50%)",
            animation: "nvHeroGlow 12s ease-in-out infinite alternate",
          }}
        />
        <div style={{ maxWidth: "1240px", margin: "0 auto", position: "relative", width: "100%", padding: "96px 48px 88px", boxSizing: "border-box" }}>
          <p style={{ margin: 0, fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "clamp(42px, 7vw, 72px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05, color: ON_NAVY }}>
            NiroVera
          </p>
          <p style={{ margin: "14px 0 0", display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 0, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)", fontSize: 12, fontWeight: 600, color: ON_NAVY, letterSpacing: "0.06em" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT }} />
            {T("منصة تشغيل سعودية · معايير عالمية", "Saudi operations platform · global standard")}
          </p>
          <h1 data-nv="h1" style={{ margin: "18px 0 0", fontSize: "clamp(26px, 3.6vw, 40px)", fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.02em", maxWidth: "720px", textWrap: "pretty", color: ON_NAVY }}>
            {T("إثبات العمل قبل الحكم — منظومة موارد مؤسسية مبنية للسعودية", "Prove work before judgment — institutional HR built for Saudi Arabia")}
          </h1>
          <p style={{ margin: "20px 0 0", fontSize: "18px", lineHeight: 1.65, color: ON_NAVY_MUTED, maxWidth: "560px", textWrap: "pretty" }}>
            {T("حضور ومهام وإثبات ورواتب وأصول وامتثال وزارة — تطبيقات مترابطة في مساحة شركة واحدة.", "Attendance, tasks, proof, payroll, assets, and ministry compliance — connected apps in one company space.")}
          </p>
          <div style={{ display: "flex", gap: "12px", marginTop: "36px", flexWrap: "wrap" }}>
            <Link to="/pricing" style={{ height: "48px", padding: "0 26px", borderRadius: 0, background: "#fff", color: NAVY_FILL, fontSize: "15px", fontWeight: 600, display: "flex", alignItems: "center", textDecoration: "none" }}>
              {T("أنشئ مساحة شركتك", "Create your company space")}
            </Link>
            <a href="#apps" style={{ height: "48px", padding: "0 26px", borderRadius: 0, background: "transparent", color: ON_NAVY, border: "1px solid rgba(255,255,255,.28)", fontSize: "15px", fontWeight: 500, display: "flex", alignItems: "center", textDecoration: "none" }}>
              {T("شاهد التطبيقات", "See the apps")}
            </a>
          </div>
          <div style={{ marginTop: "48px", display: "flex", flexWrap: "wrap", gap: "10px 28px", fontSize: "13px", color: ON_NAVY_MUTED }}>
            {[T("حضور بموقع الفرع", "Station-geofenced attendance"), T("مهمة بإثبات", "Task with proof"), T("توقيع وختم", "Sign and seal"), T("رواتب وأصول", "Payroll and assets")].map((item) => (
              <span key={item} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT }} />
                {item}
              </span>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes nvHeroGlow {
            from { opacity: 0.85; transform: scale(1); }
            to { opacity: 1; transform: scale(1.04); }
          }
        `}</style>
      </section>

      <section data-nv="pad" style={{ padding: "28px 48px", background: NAVY_FILL, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <div data-nv="hero-gov" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            {heroGov.map((g) => (
              <a key={g.title} href={g.href} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 0, padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", textDecoration: "none", color: "inherit", height: "100%", boxSizing: "border-box" }}>
                <span style={{ height: "22px", padding: "0 9px", borderRadius: 0, fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px", background: g.live ? "rgba(148,163,184,.15)" : "rgba(30,158,99,.18)", color: g.live ? "#CBD5E1" : "#6EE7B7", border: `1px solid ${g.live ? "rgba(148,163,184,.35)" : "rgba(110,231,183,.35)"}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: g.live ? "#94A3B8" : "#6EE7B7" }} />
                  {g.chip}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: ON_NAVY, lineHeight: 1.4 }}>{g.title}</span>
                {g.note ? <span style={{ fontSize: "12px", color: ON_NAVY_MUTED, lineHeight: 1.45 }}>{g.note}</span> : null}
              </a>
            ))}
          </div>
        </div>
      </section>

      <LandingProofStrip ar={ar} />

      <EnterprisePilotPath ar={ar} />

      <MhrsdComplianceModules ar={ar} loggedIn={loggedIn} />

      <section data-nv="pad" style={{ padding: "72px 48px", background: CARD, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <h2 data-nv="h2" style={{ margin: 0, fontSize: "40px", fontWeight: 600, letterSpacing: "-0.02em" }}>{T("لماذا تتأخر القرارات التشغيلية", "Why operational decisions run late")}</h2>
          <p style={{ margin: "16px 0 0", fontSize: "18px", color: MUTED, maxWidth: "700px", lineHeight: 1.65 }}>{T("المعلومة موجودة، لكنها موزّعة على أدوات لا تتحدث مع بعضها.", "The information exists, but it's spread across tools that don't talk to each other.")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: "22px", marginTop: "46px" }}>
            {problems.map((p) => (
              <div key={p.value} style={{ borderTop: `2px solid ${NAVY}`, paddingTop: "24px" }}>
                <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "52px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em", textAlign: numAlign }}>{p.value}</div>
                <p style={{ margin: "16px 0 0", fontSize: "16px", lineHeight: 1.7, color: MUTED, textWrap: "pretty" }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="apps" data-nv="pad" style={{ padding: "80px 48px", background: SURFACE }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <SuiteAppsGallery
            ar={ar}
            mode="public"
            title={T("تطبيقات المنصة — مساحة شركة واحدة", "Suite apps — one company space")}
            subtitle={T(
              "كل قسم يغذي التالي: حضور ثم مهمة ثم إثبات ثم رواتب وأصول. سجّل شركتك وافتح الحزمة.",
              "Each app feeds the next: attendance, task, proof, then payroll and assets. Register and open the suite.",
            )}
          />
          <div style={{ marginTop: 36 }}>
            <Link to="/pricing" style={{ display: "inline-flex", height: 44, padding: "0 22px", borderRadius: 0, background: NAVY_FILL, color: ON_NAVY, fontSize: 14, fontWeight: 600, alignItems: "center", textDecoration: "none" }}>
              {T("أنشئ مساحة شركتك", "Create your company space")}
            </Link>
          </div>
        </div>
      </section>

      {/* L115–153 proof */}
      <section data-nv="pad" style={{ padding: "80px 48px", background: CARD, borderTop: `1px solid ${BORDER}` }}>
        <div data-nv="split" style={{ maxWidth: "1240px", margin: "0 auto", display: "flex", gap: "56px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 340px" }}>
            <div style={{ fontSize: "12px", letterSpacing: "0.12em", color: ACCENT, fontWeight: 600 }}>{T("إثبات العمل", "WORK PROOF")}</div>
            <h2 data-nv="h2" style={{ margin: "18px 0 0", fontSize: "40px", fontWeight: 600, letterSpacing: "-0.02em", textWrap: "pretty" }}>{T("العمل يُغلق بصورة مختومة بالموقع والوقت", "Work closes with a photo stamped by location and time")}</h2>
            <p style={{ margin: "20px 0 0", fontSize: "17px", lineHeight: 1.75, color: MUTED, textWrap: "pretty" }}>{T("الفني يلتقط صورة قبل وبعد من داخل نطاق الفرع. الرفع من خارج النطاق يُرفض تلقائيًا، فلا يمكن إغلاق عمل لم يُنفَّذ.", "The technician captures a before and after photo from inside the station's geofence. Uploads from outside are rejected automatically, so work that wasn't done can't be closed.")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "30px" }}>
              {proofPoints.map((text) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: BRAND_SOFT, border: `1px solid ${BRAND_BORDER}`, color: "var(--nv-accent-deep)", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>✓</span>
                  <span style={{ fontSize: "16px", lineHeight: 1.65, color: INK, textWrap: "pretty" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: "1 1 340px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 0, padding: "26px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: "12px", flex: 1, minHeight: "190px" }}>
              {[T("قبل", "BEFORE"), T("بعد", "AFTER")].map((label, i) => (
                <div key={label} style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.08em" }}>{label}</span>
                  <span dir="ltr" style={{ fontSize: "13px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif" }}>{i === 0 ? "06:18" : "09:42"}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "18px", paddingTop: "18px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                <span style={{ fontSize: "14px", color: MUTED }}>{T("داخل نطاق الجبيل 2 · 12 مترًا", "Inside Jubail 2 geofence · 12m")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: BORDER, flexShrink: 0 }} />
                <span style={{ fontSize: "14px", color: MUTED }}>{T("راجعه فهد القحطاني", "Reviewed by F. Alqahtani")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* L155–175 assistant */}
      <section data-nv="pad" style={{ padding: "80px 48px", background: NAVY_FILL, color: ON_NAVY }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <div style={{ fontSize: "12px", letterSpacing: "0.12em", color: ON_NAVY_ACCENT, fontWeight: 600 }}>{T("المساعد الذكي", "AI ASSISTANT")}</div>
          <h2 data-nv="h2" style={{ margin: "18px 0 0", fontSize: "40px", fontWeight: 600, letterSpacing: "-0.02em", maxWidth: "800px", textWrap: "pretty" }}>{T("يقرأ بيانات شركتك، ويعرض مصدر كل رقم", "It reads your company's data and shows the source behind every number")}</h2>
          <div style={{ marginTop: "38px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 0, padding: "32px" }}>
            <div style={{ fontSize: "12px", color: ON_NAVY_ACCENT, fontWeight: 600, letterSpacing: "0.08em" }}>{T("السؤال", "QUESTION")}</div>
            <p style={{ margin: "14px 0 0", fontSize: "24px", fontWeight: 500, lineHeight: 1.5, textWrap: "pretty" }}>{T("لماذا انخفض إنجاز المهام في فرع الجبيل 2 هذا الأسبوع؟", "Why did task completion drop at Jubail 2 this week?")}</p>
            <div style={{ height: "1px", background: "rgba(255,255,255,.1)", margin: "26px 0" }} />
            <p style={{ margin: 0, fontSize: "17px", lineHeight: 1.8, color: ON_NAVY_MUTED, maxWidth: "920px", textWrap: "pretty" }}>{T("الانخفاض مصدره سبب واحد: توقف مضخة التبريد يوم الأحد أوقف 3 مهام معتمدة عليها، ولم تُعَد جدولتها. الحضور والطاقم لم يتغيرا.", "The drop traces to a single cause: Sunday's cooling pump stoppage blocked 3 dependent tasks that were never rescheduled. Attendance and crew levels were unchanged.")}</p>
            <div style={{ display: "flex", gap: "14px", marginTop: "28px", flexWrap: "wrap" }}>
              {[
                { source: T("العمليات", "OPERATIONS"), value: "-23%" },
                { source: T("الحضور", "ATTENDANCE"), value: "0%" },
                { source: T("الأصول", "ASSETS"), value: "31h" },
              ].map((e) => (
                <div key={e.source} style={{ flex: "1 1 150px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 0, padding: "18px" }}>
                  <div style={{ fontSize: "11px", color: ON_NAVY_MUTED, letterSpacing: "0.08em" }}>{e.source}</div>
                  <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "30px", fontWeight: 600, marginTop: "8px", textAlign: numAlign }}>{e.value}</div>
                </div>
              ))}
              <div style={{ flex: "1 1 200px", background: ACCENT, borderRadius: 0, padding: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 600, textAlign: "center" }}>
                {T("أعد جدولة المهام الثلاث", "Reschedule the 3 tasks")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* L177–199 compare */}
      <section data-nv="pad" style={{ padding: "80px 48px", background: CARD }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <h2 data-nv="h2" style={{ margin: 0, fontSize: "40px", fontWeight: 600, letterSpacing: "-0.02em" }}>{T("مقارنة بأنظمة الموارد التقليدية", "Compared with a traditional ERP")}</h2>
          <div style={{ marginTop: "40px", border: `1px solid ${BORDER}`, borderRadius: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "760px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: NAVY_FILL, color: ON_NAVY }}>
                  <div style={{ padding: "18px 24px", fontSize: "14px", fontWeight: 600 }}>{T("المعيار", "Criterion")}</div>
                  <div style={{ padding: "18px 24px", fontSize: "14px", fontWeight: 600, color: ON_NAVY_MUTED }}>{T("نظام موارد تقليدي", "Traditional ERP")}</div>
                  <div style={{ padding: "18px 24px", fontSize: "14px", fontWeight: 600, color: ON_NAVY_ACCENT }}>NiroVera</div>
                </div>
                {compareRows.map((r) => (
                  <div key={r.criterion} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ padding: "20px 24px", fontSize: "15px", fontWeight: 500 }}>{r.criterion}</div>
                    <div style={{ padding: "20px 24px", fontSize: "15px", color: MUTED }}>{r.legacy}</div>
                    <div style={{ padding: "20px 24px", fontSize: "15px", color: INK, fontWeight: 500 }}>{r.nirovera}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* L201–225 pricing */}
      <section id="pricing" data-nv="pad" style={{ padding: "80px 48px", background: SURFACE, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <h2 data-nv="h2" style={{ margin: 0, fontSize: "40px", fontWeight: 600, letterSpacing: "-0.02em" }}>{T("الأسعار", "Pricing")}</h2>
          <p style={{ margin: "16px 0 0", fontSize: "18px", color: MUTED, maxWidth: "640px", lineHeight: 1.65 }}>{T("سعر لكل موظف شهريًا، بلا رسوم تهيئة ولا فريق تطبيق مقيم.", "Priced per employee per month, with no setup fee and no on-site implementation team.")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "20px", marginTop: "44px" }}>
            {plans.map((p) => (
              <div
                key={p.name}
                style={{
                  background: p.dark ? NAVY_FILL : CARD,
                  border: `1px solid ${p.dark ? NAVY_FILL : BORDER}`,
                  borderRadius: 0,
                  padding: "32px",
                  display: "flex",
                  flexDirection: "column",
                  color: p.dark ? ON_NAVY : INK,
                  minHeight: "290px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "22px", fontWeight: 600 }}>{p.name}</span>
                  {!!p.tag && (
                    <span style={{ fontSize: "11px", background: ACCENT, color: ON_NAVY, borderRadius: 0, padding: "4px 11px", fontWeight: 600 }}>{p.tag}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "9px", marginTop: "18px" }}>
                  <span
                    dir="ltr"
                    style={
                      p.priceBig
                        ? { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "42px", fontWeight: 600, lineHeight: 1 }
                        : { fontSize: "30px", fontWeight: 600, lineHeight: 1 }
                    }
                  >
                    {p.price}
                  </span>
                  {!!p.unit && (
                    <span style={{ fontSize: "14px", color: p.dark ? ON_NAVY_MUTED : MUTED }}>{p.unit}</span>
                  )}
                </div>
                <p style={{ margin: "20px 0 0", fontSize: "16px", lineHeight: 1.7, color: p.dark ? ON_NAVY_MUTED : MUTED }}>{p.desc}</p>
                <div style={{ flex: 1 }} />
                <a
                  href="/pricing"
                  style={{
                    marginTop: "26px",
                    height: "44px",
                    borderRadius: 0,
                    background: p.dark ? ON_NAVY : SURFACE,
                    border: p.dark ? "none" : `1px solid ${BORDER}`,
                    color: p.dark ? NAVY_FILL : INK,
                    fontSize: "14px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* L227–239 security */}
      <section id="trust" data-nv="pad" style={{ padding: "80px 48px", background: CARD, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <h2 data-nv="h2" style={{ margin: 0, fontSize: "40px", fontWeight: 600, letterSpacing: "-0.02em" }}>{T("الأمان وامتثال صاحب العمل", "Security and employer compliance")}</h2>
          <p style={{ margin: "16px 0 0", fontSize: "17px", color: MUTED, maxWidth: "720px", lineHeight: 1.65 }}>
            {T("بوابات مشتقة من نظام العمل والملف النظامي — مع شارات صادقة لحالة الربط الحكومي (قوى · التأمينات · مدى).", "Gates derived from Labour Law and the statutory file — with honest chips for government-link status (Qiwa · GOSI · Mudad).")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "26px", marginTop: "44px" }}>
            {security.map((s) => (
              <div key={s.title} style={{ borderTop: `2px solid ${ACCENT}`, paddingTop: "22px" }}>
                <div style={{ fontSize: "19px", fontWeight: 600 }}>{s.title}</div>
                <p style={{ margin: "12px 0 0", fontSize: "16px", lineHeight: 1.7, color: MUTED, textWrap: "pretty" }}>{s.text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "36px" }}>
            <a
              href={loggedIn ? "/app/hr?tab=compliance" : "#mhrsd"}
              style={{
                height: "44px",
                padding: "0 22px",
                borderRadius: 0,
                background: NAVY_FILL,
                color: ON_NAVY,
                fontSize: "14px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              {loggedIn
                ? T("مركز امتثال الموارد البشرية", "HR compliance centre")
                : T("وحدات الامتثال", "Compliance modules")}
            </a>
          </div>
        </div>
      </section>

      {/* L241–250 contact */}
      <section id="contact" data-nv="pad" style={{ padding: "88px 48px", background: NAVY_FILL, color: ON_NAVY }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <h2 data-nv="h2" style={{ margin: 0, fontSize: "48px", fontWeight: 600, letterSpacing: "-0.025em", maxWidth: "800px", lineHeight: 1.25, textWrap: "pretty" }}>{T("فرع واحد — قيسوا الإثبات قبل التوسّع", "One station — measure proof before you scale")}</h2>
          <p style={{ margin: "22px 0 0", fontSize: "19px", color: ON_NAVY_MUTED, maxWidth: "700px", lineHeight: 1.65, textWrap: "pretty" }}>{T("للمؤسسات: تجريب 90 يومًا على موقع واحد فوق أنظمتكم الحالية. للصفقات الأصغر: فرع واحد خلال أسبوعين بلا التزام.", "Enterprises: a 90-day pilot on one site on top of your current stack. Smaller deals: one station in two weeks, no commitment.")}</p>
          <div style={{ display: "flex", gap: "12px", marginTop: "34px", flexWrap: "wrap" }}>
            <a href="mailto:niyar@powercares.pro?subject=NiroVera%20Enterprise%20Pilot" style={{ height: "50px", padding: "0 28px", borderRadius: 0, background: "#fff", color: NAVY_FILL, fontSize: "15px", fontWeight: 600, display: "flex", alignItems: "center", textDecoration: "none" }}>{T("اطلب تجريب موقع", "Request a site pilot")}</a>
            <a href="tel:+966595414472" dir="ltr" style={{ height: "50px", padding: "0 28px", borderRadius: 0, background: "transparent", color: ON_NAVY, border: "1px solid rgba(255,255,255,.2)", fontSize: "15px", fontWeight: 500, display: "flex", alignItems: "center", textDecoration: "none" }}>+966 59 541 4472</a>
          </div>
        </div>
      </section>

    </MarketingChrome>
  );
}
