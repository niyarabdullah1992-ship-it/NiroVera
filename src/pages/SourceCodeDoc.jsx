import React, { useState, useEffect } from "react";
import { Printer, Loader2, FileCode2 } from "lucide-react";

// مستند الكود المصدري الكامل — لتسجيل حقوق الملكية الفكرية (المصنفات).
// يجمع كل ملفات المشروع (واجهة + خلفية + إعدادات) نصًا كاملًا في صفحة واحدة
// قابلة للطباعة/الحفظ PDF، مع صفحة غلاف تتضمن بيانات المصنف المطلوبة.
const FILE_MODULES = import.meta.glob(
  [
    "/index.html",
    "/package.json",
    "/tailwind.config.js",
    "/vite.config.js",
    "/src/**/*.{js,jsx,css,ts}",
    "/base44/**/*.{ts,jsonc}",
  ],
  { query: "?raw", import: "default" }
);

const TEXTS = {
  ar: {
    bar: "مستند الكود المصدري الكامل — مقدّم إلى الهيئة السعودية للملكية الفكرية",
    authorPh: "اسم المؤلف / المبرمج (كما في الطلب)",
    print: "طباعة / حفظ PDF",
    collecting: "جاري تجميع كل ملفات الكود…",
    deposit: "SOURCE CODE DEPOSIT — نسخة إيداع الكود المصدري",
    title: "منصة NiroVera",
    subtitle: "وثيقة إيداع الكود المصدري المقدّمة إلى الهيئة السعودية للملكية الفكرية لمصنف برمجي سحابي متكامل لإدارة الفروع، الموارد البشرية، الحضور، المهام، السلامة، والتوقيع الرقمي للمستندات.",
    rows: {
      workName: ["اسم المصنف", "NiroVera — منصة إدارة الفروع والقوى العاملة"],
      author: "اسم المؤلف / المبرمج",
      langs: ["لغة/لغات البرمجة المستخدمة", "JavaScript (React JSX)، TypeScript، HTML، CSS (Tailwind)، JSON"],
      os: ["نظام التشغيل", "مستقل عن نظام التشغيل — يعمل عبر المتصفح على Windows، macOS، Linux، Android، iOS"],
      env: ["بيئة التشغيل", "ويب / سحابي (SaaS) — واجهة React + خدمات خلفية سحابية (Deno / قاعدة بيانات سحابية)"],
      fileCount: "عدد الملفات المصدرية",
      lineCount: "إجمالي أسطر الكود",
      date: "تاريخ إصدار هذه النسخة",
      filesUnit: "ملفًا",
      linesUnit: "سطرًا",
    },
    note: "يحتوي هذا المستند على النسخة الكاملة وغير المنقوصة من الأكواد المصدرية للبرنامج، مرتبة حسب مسار كل ملف داخل المشروع، من أول ملف حتى آخر ملف — لأغراض إيداع وتسجيل حقوق الملكية الفكرية.",
    index: "فهرس الملفات",
    loading: "جاري تحميل الكود المصدري الكامل…",
    end: "نهاية الكود المصدري",
  },
  en: {
    bar: "Complete Source Code Document — Submitted to the Saudi Authority for Intellectual Property",
    authorPh: "Author / Programmer name (as in the application)",
    print: "Print / Save PDF",
    collecting: "Collecting all source files…",
    deposit: "SOURCE CODE DEPOSIT",
    title: "NiroVera Platform",
    subtitle: "Source-code deposit document submitted to the Saudi Authority for Intellectual Property for an integrated cloud platform covering station management, HR, attendance, tasks, safety (HSE), and digital document signing.",
    rows: {
      workName: ["Work title", "NiroVera — Station & Workforce Management Platform"],
      author: "Author / Programmer",
      langs: ["Programming language(s)", "JavaScript (React JSX), TypeScript, HTML, CSS (Tailwind), JSON"],
      os: ["Operating system", "OS-independent — runs in the browser on Windows, macOS, Linux, Android, iOS"],
      env: ["Runtime environment", "Web / Cloud (SaaS) — React frontend + cloud backend services (Deno / cloud database)"],
      fileCount: "Number of source files",
      lineCount: "Total lines of code",
      date: "Version date",
      filesUnit: "files",
      linesUnit: "lines",
    },
    note: "This document contains the complete, unabridged source code of the software, ordered by each file's path within the project, from the first file to the last — for the purpose of intellectual property deposit and registration.",
    index: "File Index",
    loading: "Loading the complete source code…",
    end: "End of source code",
  },
};

export default function SourceCodeDoc() {
  const [files, setFiles] = useState(null);
  const [author, setAuthor] = useState("");
  const [docLang, setDocLang] = useState("en");
  const T = TEXTS[docLang];
  const isAr = docLang === "ar";

  useEffect(() => {
    document.title = "NiroVera — Source Code / الكود المصدري الكامل";
    (async () => {
      const paths = Object.keys(FILE_MODULES).sort();
      const loaded = await Promise.all(
        paths.map(async (p) => {
          try {
            const content = await FILE_MODULES[p]();
            return { path: p.replace(/^\//, ""), content: String(content) };
          } catch {
            return null;
          }
        })
      );
      setFiles(loaded.filter(Boolean));
    })();
  }, []);

  const totalLines = (files || []).reduce((sum, f) => sum + f.content.split("\n").length, 0);

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-white text-black">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print { .no-print { display: none !important; } }
        .code-block { direction: ltr; text-align: left; font-family: "Courier New", monospace; font-size: 8.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-all; background: #F7F8FA; border: 1px solid #E2E8F0; padding: 10px; }
        .file-head { break-inside: avoid; }
      `}</style>

      {/* شريط التحكم — لا يظهر في الطباعة */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-3">
        <FileCode2 className="w-5 h-5 text-[#14284B]" />
        <p className="text-sm font-semibold">{T.bar}</p>
        <button
          onClick={() => setDocLang(isAr ? "en" : "ar")}
          className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-semibold hover:bg-gray-50"
        >
          {isAr ? "English" : "عربي"}
        </button>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder={T.authorPh}
          className="px-3 py-1.5 rounded-md border border-gray-300 text-sm w-72"
        />
        <button
          onClick={() => window.print()}
          disabled={!files}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
        >
          <Printer className="w-4 h-4" /> {T.print}
        </button>
        {!files && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {T.collecting}
          </span>
        )}
      </div>

      <div className="max-w-[190mm] mx-auto px-6 py-10">
        {/* صفحة الغلاف — بيانات المصنف */}
        <div className="border-2 border-black p-10 mb-10" style={{ breakAfter: "page" }}>
          <p className="text-xs tracking-widest text-[#14284B] font-bold mb-4">{T.deposit}</p>
          <h1 className="text-3xl font-bold mb-2">{T.title}</h1>
          <p className="text-sm text-gray-700 mb-8">{T.subtitle}</p>

          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                T.rows.workName,
                [T.rows.author, author || "……………………………………"],
                T.rows.langs,
                T.rows.os,
                T.rows.env,
                [T.rows.fileCount, files ? `${files.length} ${T.rows.filesUnit}` : "…"],
                [T.rows.lineCount, files ? `${totalLines.toLocaleString("en-US")} ${T.rows.linesUnit}` : "…"],
                [T.rows.date, new Date().toLocaleDateString(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="border border-gray-400 bg-gray-50 font-semibold p-2.5 w-56">{k}</td>
                  <td className="border border-gray-400 p-2.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-gray-600 mt-8 leading-relaxed">{T.note}</p>
        </div>

        {/* فهرس الملفات */}
        {files && (
          <div className="mb-10" style={{ breakAfter: "page" }}>
            <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">{T.index} ({files.length})</h2>
            <ol dir="ltr" className="text-[10px] font-mono leading-5 list-decimal list-inside columns-2">
              {files.map((f) => (
                <li key={f.path}>{f.path}</li>
              ))}
            </ol>
          </div>
        )}

        {/* الكود الكامل ملفًا ملفًا */}
        {files ? (
          files.map((f, i) => (
            <div key={f.path} className="mb-6">
              <div className="file-head flex items-baseline justify-between border-b-2 border-black pb-1 mb-2" dir="ltr">
                <p className="font-mono text-[11px] font-bold">{i + 1}. {f.path}</p>
                <p className="font-mono text-[9px] text-gray-500">{f.content.split("\n").length} lines</p>
              </div>
              <div className="code-block">{f.content}</div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> {T.loading}
          </div>
        )}

        {files && (
          <div className="border-t-2 border-black pt-4 mt-10 text-xs text-gray-600 flex justify-between">
            <span>NiroVera — {T.end} ({files.length} {T.rows.filesUnit} • {totalLines.toLocaleString("en-US")} {T.rows.linesUnit})</span>
            <span>{new Date().toLocaleDateString(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}</span>
          </div>
        )}
      </div>
    </div>
  );
}