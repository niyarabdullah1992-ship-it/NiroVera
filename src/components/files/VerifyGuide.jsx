import React from "react";
import { BORDER, CARD, INK, MUTED } from "@/lib/platformStyles";
import { signMono } from "@/components/files/signingUi";
import { VERIFY_GRAY, VERIFY_MUTED, VERIFY_OK, VERIFY_RED } from "@/lib/verifyDocument";

function Card({ title, children, gap = 12 }) {
  return (
    <section className="nv-verify-guide-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", padding: 18, display: "flex", flexDirection: "column", gap }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{title}</span>
      {children}
    </section>
  );
}

export default function VerifyGuide({ ar }) {
  const how = ar
    ? [
      { n: "1", title: "اختر الملف", text: "النسخة المختومة كما استلمتها، دون فتحها في محرر أو إعادة حفظها." },
      { n: "2", title: "تُحسب البصمة محلياً", text: "SHA-256 لبايتات الملف تُحسب في متصفحك؛ الملف نفسه لا يغادر جهازك." },
      { n: "3", title: "تُطابق مع السجل", text: "تُقارن البصمة مع سجل الشركة، ويظهر الموقّع وتاريخ التوقيع وحالة الملف." },
    ]
    : [
      { n: "1", title: "Choose the file", text: "The sealed copy as you received it — do not open it in an editor or re-save it." },
      { n: "2", title: "The fingerprint is computed locally", text: "SHA-256 of the file bytes is computed in your browser; the file itself never leaves your device." },
      { n: "3", title: "It is matched to the registry", text: "The fingerprint is compared with the company registry. Signer, date, and file state are shown." },
    ];

  const outcomes = [
    { label: ar ? "سليم" : "Valid", color: VERIFY_OK, text: ar ? "البصمة مطابقة تماماً: الملف هو نفسه المسجّل، ولم يتغيّر بايت واحد بعد الختم." : "The fingerprint matches exactly: this is the registered file, and not one byte changed after sealing." },
    { label: ar ? "معدّل" : "Modified", color: VERIFY_RED, text: ar ? "الرقم مسجّل لدينا لكن بصمة هذا الملف لا تطابقه. يكشف أي اختلاف مهما صغر، لكنه لا يبيّن ماذا تغيّر ولا من غيّره." : "The id is on record but this file’s fingerprint does not match. Any difference is detected; what changed and who changed it are not." },
    { label: ar ? "غير مسجّل" : "Not registered", color: VERIFY_GRAY, text: ar ? "لا بصمة مطابقة إطلاقاً — يختلف عن «معدّل»: قد يكون الملف لم يُوقَّع عبر المنصة." : "No matching fingerprint at all — unlike modified, the file may never have been signed on the platform." },
  ];

  const caveats = ar
    ? [
      "التعديل يُكشف بيقين: SHA-256 تتغيّر كلياً مع أصغر تغيير — كلمة، رقم، توقيع مضاف، أو صفحة محذوفة.",
      "النتيجة ثنائية: مطابق أو غير مطابق. لا تُظهر ما الذي تغيّر ولا من غيّره.",
      "ما قبل الختم خارج النطاق: البصمة تُحسب لحظة التوقيع، وما كان في المستند حينها يُعدّ موقّعاً عليه.",
      "إعادة الحفظ أو الطباعة كـ PDF تغيّر البايتات دون تغيير ما تراه العين، فيظهر «معدّل» رغم تطابق المحتوى. ارفع النسخة كما استلمتها.",
    ]
    : [
      "A change is detected with certainty: SHA-256 flips entirely with the smallest edit — a word, a number, an added signature, or a removed page.",
      "The result is binary: match or mismatch. It does not show what changed or who changed it.",
      "Anything before sealing is out of scope: the fingerprint is taken at signing time, and whatever was in the document then is what was signed.",
      "Re-saving or printing as PDF changes the bytes without changing what the eye sees, so the result becomes modified even when the content matches. Use the copy as you received it.",
    ];

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card title={ar ? "كيف يعمل التحقق" : "How verification works"}>
        {how.map((step) => (
          <div key={step.n} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            <span style={{ width: 22, height: 22, borderRadius: 10, border: `1px solid ${BORDER}`, display: "inline-flex", alignItems: "center", justifyContent: "center", ...signMono, fontSize: 10, color: INK, marginTop: 1 }}>{step.n}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{step.title}</span>
              <span style={{ fontSize: 12, lineHeight: 1.7, color: MUTED }}>{step.text}</span>
            </span>
          </div>
        ))}
      </Card>

      <Card title={ar ? "النتائج الممكنة" : "Possible results"} gap={10}>
        <span style={{ fontSize: 12, color: MUTED }}>{ar ? "ثلاث نتائج فقط تهم من يتحقق." : "Only three results matter to the person who verifies."}</span>
        {outcomes.map((row) => (
          <div key={row.label} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr)", gap: 11, alignItems: "start", padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: row.color, marginTop: 5 }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.label}</span>
              <span style={{ fontSize: 12, lineHeight: 1.7, color: MUTED }}>{row.text}</span>
            </span>
          </div>
        ))}
        <span style={{ fontSize: 11, lineHeight: 1.7, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 9 }}>
          {ar
            ? "حالة تقنية إضافية: إن كانت مهلة تراجع أحد الموقّعين لم تنتهِ، تظهر البصمة كمؤقتة حتى تُغلق المهلة."
            : "A further technical state: if a signer’s retract window is still open, the fingerprint is shown as temporary until the window closes."}
        </span>
      </Card>

      <Card title={ar ? "ماذا يكشف التعديل — وماذا لا يكشف" : "What a change reveals — and what it does not"} gap={10}>
        {caveats.map((text) => (
          <div key={text} style={{ display: "grid", gridTemplateColumns: "6px minmax(0,1fr)", gap: 11, alignItems: "start" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: BORDER, marginTop: 7 }} />
            <span style={{ fontSize: 12, lineHeight: 1.9, color: VERIFY_MUTED }}>{text}</span>
          </div>
        ))}
      </Card>

      <Card title={ar ? "حدود هذا التحقق" : "Limits of this verification"} gap={8}>
        <span style={{ fontSize: 12, lineHeight: 1.9, color: VERIFY_MUTED }}>
          {ar ? (
            <>
              توقيع داخل المنصة مع سجل شركة، وليس شهادة حكومية مؤهلة. رقم التحقق مربوط بملف واحد للأبد؛ استخدامه على ملف آخر يظهر كـ{" "}
              <span dir="ltr" style={{ ...signMono, fontSize: 11 }}>SIGNATURE_REUSE</span>.
            </>
          ) : (
            <>
              An in-platform signature with a company registry — not a qualified government certificate. The verification id is bound to one file forever; using it on another file appears as{" "}
              <span dir="ltr" style={{ ...signMono, fontSize: 11 }}>SIGNATURE_REUSE</span>.
            </>
          )}
        </span>
      </Card>
    </aside>
  );
}
