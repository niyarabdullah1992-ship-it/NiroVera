import React, { useRef, useState } from "react";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { downloadElementPdf } from "@/lib/downloadElementPdf";
import TruePerfPage from "@/components/true-performance/TruePerfPage";
import TruePerfPillar from "@/components/true-performance/TruePerfPillar";
import TruePerfEquation from "@/components/true-performance/TruePerfEquation";
import TruePerfChart from "@/components/true-performance/TruePerfChart";
import TruePerfComparison from "@/components/true-performance/TruePerfComparison";
import TruePerfLayers from "@/components/true-performance/TruePerfLayers";
import TruePerfSteps from "@/components/true-performance/TruePerfSteps";
import TruePerfSaip from "@/components/true-performance/TruePerfSaip";
import TruePerfOwnership from "@/components/true-performance/TruePerfOwnership";
import { TP_META, TP_INTRO, TP_PILLARS, TP_ADVANTAGES, TP_FLOW, TP_CLOSING, TP_EQUATION, TP_LAYERS, TP_CHART, TP_COMPARISON, TP_STRENGTH, TP_MODERN_STEPS, TP_SAIP, TP_OWNERSHIP } from "@/lib/truePerformanceDocContent";

// ملف توثيقي A4 يشرح ربط الحضور والمهام بقسم الأداء — قابل للتحميل PDF.
export default function TruePerformanceDoc() {
  const documentRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const todayAr = new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "long", day: "numeric" });

  const downloadPdf = async () => {
    setDownloading(true);
    await downloadElementPdf(documentRef.current, "NiroVera-True-Performance.pdf");
    setDownloading(false);
  };

  return (
    <div dir="rtl" className="powercare-public min-h-screen bg-secondary py-8 font-body print:bg-background print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          .no-print { display: none !important; }
          .doc-sheet { box-shadow: none !important; margin: 0 !important; }
          .guide-page { break-after: page; page-break-after: always; min-height: 297mm !important; }
        }
        .guide-page { min-height: 1123px; }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[794px] justify-end px-4">
        <button onClick={downloadPdf} disabled={downloading} className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm text-primary-foreground shadow-elevated hover:opacity-90 disabled:opacity-60">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "جارٍ إنشاء الملف…" : "تحميل الملف PDF"}
        </button>
      </div>

      <div ref={documentRef} className="doc-sheet mx-auto w-[794px] max-w-full overflow-hidden bg-background shadow-elevated">
        {/* صفحة الغلاف + المقدمة */}
        <TruePerfPage footerAr={todayAr}>
          <div className="flex flex-col items-center pt-10 text-center">
            <Logo size={64} />
            <p className="mt-6 text-xs uppercase tracking-widest-xl text-accent">{TP_META.titleEn}</p>
            <h1 className="hero-title mt-3 text-5xl text-primary">{TP_META.titleAr}</h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">{TP_META.subtitleAr}</p>
            <div className="mt-8 h-px w-32 bg-accent" />
            <p className="mt-4 text-xs text-muted-foreground">{TP_META.authorAr} — NiroVera</p>
          </div>
          <div className="mt-12">
            <h2 className="font-heading text-2xl font-semibold text-primary">{TP_INTRO.titleAr}</h2>
            <div className="mt-4 space-y-4">
              {TP_INTRO.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="text-sm leading-7 text-foreground">{paragraph}</p>
              ))}
            </div>
          </div>
        </TruePerfPage>

        {/* صفحة الركائز الثلاث */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold text-primary">ركائز الفكرة</h2>
          <p className="mb-6 text-[11px] uppercase tracking-widest text-accent">The Three Pillars</p>
          <div className="space-y-5">
            {TP_PILLARS.map((pillar) => <TruePerfPillar key={pillar.icon} pillar={pillar} />)}
          </div>
        </TruePerfPage>

        {/* صفحة المزايا */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold text-primary">{TP_ADVANTAGES.titleAr}</h2>
          <p className="mb-6 text-[11px] uppercase tracking-widest text-accent">{TP_ADVANTAGES.titleEn}</p>
          <div className="grid grid-cols-2 gap-4">
            {TP_ADVANTAGES.items.map((item, index) => (
              <div key={item.titleAr} className="rounded-lg border border-border bg-card p-5">
                <span className="font-heading text-3xl font-semibold text-accent/60">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-heading text-lg font-semibold text-primary">{item.titleAr}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{item.textAr}</p>
              </div>
            ))}
          </div>
        </TruePerfPage>

        {/* صفحة الرسوم التوضيحية — المعادلة وطبقات النظام */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold text-primary">{TP_EQUATION.titleAr}</h2>
          <p className="mb-5 text-[11px] uppercase tracking-widest text-accent">{TP_EQUATION.titleEn}</p>
          <TruePerfEquation equation={TP_EQUATION} />
          <h2 className="mt-9 font-heading text-2xl font-semibold text-primary">{TP_LAYERS.titleAr}</h2>
          <p className="mb-4 text-[11px] uppercase tracking-widest text-accent">{TP_LAYERS.titleEn}</p>
          <TruePerfLayers layers={TP_LAYERS} />
        </TruePerfPage>

        {/* صفحة الرسم البياني وجدول المقارنة */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold text-primary">{TP_CHART.titleAr}</h2>
          <p className="mb-5 text-[11px] uppercase tracking-widest text-accent">{TP_CHART.titleEn}</p>
          <TruePerfChart chart={TP_CHART} />
          <h2 className="mt-9 font-heading text-2xl font-semibold text-primary">{TP_COMPARISON.titleAr}</h2>
          <p className="mb-4 text-[11px] uppercase tracking-widest text-accent">{TP_COMPARISON.titleEn}</p>
          <TruePerfComparison comparison={TP_COMPARISON} />
        </TruePerfPage>

        {/* صفحة قوة الفكرة والخطوات العصرية */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold text-primary">{TP_STRENGTH.titleAr}</h2>
          <p className="mb-4 text-[11px] uppercase tracking-widest text-accent">{TP_STRENGTH.titleEn}</p>
          <p className="mb-5 text-sm leading-7 text-foreground">{TP_STRENGTH.introAr}</p>
          <div className="grid grid-cols-2 gap-3">
            {TP_STRENGTH.items.map((item) => (
              <div key={item.titleAr} className="rounded-lg border border-accent/30 bg-card p-4">
                <h3 className="font-heading text-base font-semibold text-primary">{item.titleAr}</h3>
                <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">{item.textAr}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-border bg-secondary/60 p-4 text-[12px] leading-6 text-muted-foreground">{TP_STRENGTH.disclaimerAr}</p>
          <h2 className="mt-7 font-heading text-2xl font-semibold text-primary">{TP_MODERN_STEPS.titleAr}</h2>
          <p className="mb-4 text-[11px] uppercase tracking-widest text-accent">{TP_MODERN_STEPS.titleEn}</p>
          <TruePerfSteps steps={TP_MODERN_STEPS} />
        </TruePerfPage>

        {/* صفحة البيان الموجَّه للهيئة السعودية للملكية الفكرية */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold leading-tight text-primary">{TP_SAIP.titleAr}</h2>
          <p className="mb-5 text-[11px] uppercase tracking-widest text-accent">{TP_SAIP.titleEn}</p>
          <TruePerfSaip saip={TP_SAIP} />
        </TruePerfPage>

        {/* صفحة إقرار الملكية والأسبقية */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold text-primary">{TP_OWNERSHIP.titleAr}</h2>
          <p className="mb-5 text-[11px] uppercase tracking-widest text-accent">{TP_OWNERSHIP.titleEn}</p>
          <TruePerfOwnership
            ownership={{ ...TP_OWNERSHIP, dateAr: todayAr }}
            fingerprintSource={JSON.stringify([TP_META, TP_INTRO, TP_PILLARS, TP_ADVANTAGES, TP_FLOW, TP_CLOSING, TP_STRENGTH, TP_SAIP, TP_OWNERSHIP])}
          />
        </TruePerfPage>

        {/* صفحة الدورة اليومية + الخلاصة */}
        <TruePerfPage footerAr={todayAr}>
          <h2 className="font-heading text-3xl font-semibold text-primary">{TP_FLOW.titleAr}</h2>
          <p className="mb-6 text-[11px] uppercase tracking-widest text-accent">{TP_FLOW.titleEn}</p>
          <div className="space-y-3">
            {TP_FLOW.steps.map((step, index) => (
              <div key={step.ar} className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-base font-semibold text-accent">{index + 1}</span>
                <p className="text-sm leading-6 text-foreground">{step.ar}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-lg border border-accent/40 bg-primary p-7 text-primary-foreground">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-accent" strokeWidth={1.6} />
              <h3 className="font-heading text-2xl font-semibold">{TP_CLOSING.titleAr}</h3>
            </div>
            <p className="mt-3 text-sm leading-7 text-primary-foreground/85">{TP_CLOSING.textAr}</p>
          </div>
        </TruePerfPage>
      </div>
    </div>
  );
}