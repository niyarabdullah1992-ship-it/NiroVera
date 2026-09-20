import React from "react";
import { Download } from "lucide-react";
import { AUTHOR, PROGRAM, DESCRIPTION_SECTIONS, CODE_FILES, FILE_TREE } from "@/lib/copyrightDocContent";
import Logo from "@/components/Logo";

// Official copyright-registration document (Saudi Authority for Intellectual
// Property). Renders as a clean A4-style document; the button opens the
// browser's print dialog where the user chooses "Save as PDF".
export default function CopyrightDoc() {
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-200 print:bg-white py-8 print:py-0 font-body">
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          .no-print { display: none !important; }
          .doc-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
          pre { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>

      {/* Download button */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 px-4 flex justify-end">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-landing-olive text-white text-sm hover:opacity-90 shadow"
        >
          <Download className="w-4 h-4" /> تحميل الوثيقة PDF
        </button>
      </div>

      <div className="doc-sheet max-w-[210mm] mx-auto bg-white text-neutral-900 shadow-xl px-10 py-12 md:px-14 space-y-10">
        {/* Cover */}
        <div className="text-center space-y-4 border-b-2 border-neutral-800 pb-10">
          <div className="flex justify-center"><Logo size={56} /></div>
          <p className="text-sm text-neutral-500">وثيقة توثيق حقوق المؤلف — مُعدّة للهيئة السعودية للملكية الفكرية</p>
          <h1 className="text-3xl font-bold font-heading">{PROGRAM.nameAr}</h1>
          <p className="text-neutral-600" dir="ltr">{PROGRAM.nameEn} — Cloud HR &amp; Workforce Management Platform</p>
          <div className="pt-6 space-y-1">
            <p className="text-sm text-neutral-500">المؤلف وصاحب الحقوق</p>
            <p className="text-xl font-bold">{AUTHOR.nameAr}</p>
            <p className="text-base tracking-wide" dir="ltr">{AUTHOR.nameEn}</p>
          </div>
          <p className="text-xs text-neutral-500 pt-4">تاريخ إصدار الوثيقة: {today}</p>
        </div>

        {/* Description */}
        {DESCRIPTION_SECTIONS.map((s, i) => (
          <section key={i} className="space-y-3">
            <h2 className="text-xl font-bold font-heading border-r-4 border-neutral-800 pr-3">{s.title}</h2>
            {s.body.split("\n").map((p, j) => (
              <p key={j} className="text-[15px] leading-8 text-justify">{p}</p>
            ))}
          </section>
        ))}

        {/* Full source inventory */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold font-heading border-r-4 border-neutral-800 pr-3">جرد الكود المصدري الكامل</h2>
          <p className="text-[15px] leading-8 text-justify">
            يتكون الكود المصدري الكامل للبرنامج من أكثر من مئتين وخمسين ملفاً برمجياً، جميعها من تأليف صاحب هذه
            الوثيقة. فيما يلي الجرد الكامل لملفات البرنامج مصنفة حسب وحداتها:
          </p>
          {FILE_TREE.map((g, i) => (
            <div key={i} className="border border-neutral-300 rounded overflow-hidden">
              <p className="text-sm font-bold bg-neutral-100 px-3 py-2 border-b border-neutral-300">{g.group}</p>
              <p dir="ltr" className="text-[10.5px] leading-relaxed font-mono px-3 py-2 text-neutral-700">
                {g.files.join("  ·  ")}
              </p>
            </div>
          ))}
        </section>

        {/* Source code */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold font-heading border-r-4 border-neutral-800 pr-3">الكود المصدري للبرنامج — مقتطفات جوهرية</h2>
          <p className="text-[15px] leading-8 text-justify">
            فيما يلي مقتطفات تمثيلية من الملفات الجوهرية توضح بنية البرنامج ومنطقه البرمجي الأصيل،
            وجميعها من تأليف صاحب هذه الوثيقة:
          </p>
        </section>

        {CODE_FILES.map((f, i) => (
          <section key={i} className="space-y-2">
            <p className="text-sm font-bold bg-neutral-100 border border-neutral-300 rounded px-3 py-2">
              {i + 1}. {f.name}
            </p>
            <pre dir="ltr" className="text-[10.5px] leading-relaxed bg-neutral-50 border border-neutral-200 rounded p-4 overflow-x-auto whitespace-pre-wrap font-mono">
              {f.code}
            </pre>
          </section>
        ))}

        {/* Declaration */}
        <section className="space-y-3 border-t-2 border-neutral-800 pt-8">
          <h2 className="text-xl font-bold font-heading border-r-4 border-neutral-800 pr-3">إقرار الملكية</h2>
          <p className="text-[15px] leading-8 text-justify">
            أقر أنا الموقّع أدناه، <span className="font-bold">{AUTHOR.nameAr}</span> (<span dir="ltr">{AUTHOR.nameEn}</span>)،
            بأنني المؤلف وصاحب الحقوق الفكرية الكاملة لبرنامج «{PROGRAM.nameAr}» بجميع مكوناته: الفكرة، والتصميم،
            والكود المصدري، وقواعد البيانات، والواجهات، وأن هذا العمل من إبداعي الأصيل. وقد أُعدّت هذه الوثيقة
            لغرض توثيق حقوق المؤلف لدى الهيئة السعودية للملكية الفكرية.
          </p>
          <div className="pt-10 grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-neutral-500 mb-8">الاسم والتوقيع:</p>
              <p className="border-t border-neutral-400 pt-2 font-bold">{AUTHOR.nameAr}</p>
            </div>
            <div>
              <p className="text-neutral-500 mb-8">التاريخ:</p>
              <p className="border-t border-neutral-400 pt-2">{today}</p>
            </div>
          </div>
        </section>

        <p className="text-center text-[11px] text-neutral-400 pt-4">
          © {new Date().getFullYear()} {AUTHOR.nameEn} — {PROGRAM.nameEn}. All rights reserved. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}