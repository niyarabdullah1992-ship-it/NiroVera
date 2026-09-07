import React from "react";
import { ShieldCheck, Fingerprint, QrCode, FileWarning } from "lucide-react";
import SigningPanel from "./SigningPanel";
import { MUTED, NAVY } from "@/lib/platformStyles";

export default function HowSigningWorks({ ar }) {
  const steps = ar
    ? [
        { icon: Fingerprint, title: "بصمة الختم", text: "الختم يحمل رمز إصبع تقني مشتق من الرقم المشفّر، وليس بصمة حيوية أو نفاذ." },
        { icon: QrCode, title: "QR ورقم مشفّر", text: "كل ختم يحمل رمز QR ورقمًا PWC يمكن مسحه أو نسخه للتحقق دون كشف بيانات زائدة." },
        { icon: ShieldCheck, title: "تحقق لأي جهة", text: "ارفع الملف أو أدخل المعرّف: تطابق البصمة يعني أن النسخة لم تُعدَّل بعد التوقيع." },
        { icon: FileWarning, title: "كشف التلاعب", text: "نسخ الختم على ملف آخر أو تغيير حرف واحد يغيّر البصمة ويظهر عدم التطابق فورًا." },
      ]
    : [
        { icon: Fingerprint, title: "Seal fingerprint", text: "The stamp carries a technical finger mark derived from the encrypted id — not a biometric scan or Nafath." },
        { icon: QrCode, title: "QR and encrypted id", text: "Every stamp carries a QR code and a PWC serial that can be scanned or copied without extra disclosure." },
        { icon: ShieldCheck, title: "Anyone can verify", text: "Upload the file or enter the id: a matching fingerprint means the copy was not altered after signing." },
        { icon: FileWarning, title: "Tamper detection", text: "Copying the seal onto another file or changing a single character fails verification immediately." },
      ];

  return (
    <SigningPanel icon={ShieldCheck} title={ar ? "كيف يُحفظ التوقيع ويُكشف التلاعب؟" : "How is the signature kept and tampering detected?"}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))", gap: 10 }}>
        {steps.map((s, index) => {
          const Icon = s.icon;
          return (
          <div key={s.title} className="nv-signing-trust-tile" style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "16px 14px",
            borderRadius: 14,
            background: "var(--nv-inset, #F7F8FA)",
            border: "1px solid var(--nv-line, #E2E8F0)",
            minHeight: 132,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "#fff",
                border: "1px solid var(--nv-line, #E2E8F0)",
                color: NAVY,
              }}>
                <Icon style={{ width: 15, height: 15 }} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: MUTED }}>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 650, color: NAVY }}>{s.title}</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.65 }}>{s.text}</p>
            </div>
          </div>
          );
        })}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
        {ar
          ? "يُعتمد التحقق من السجل لا شكل الختم. هذا سجل إلكتروني داخل المنشأة، وليس شهادة رقمية مؤهلة صادرة عن مركز تصديق مرخّص."
          : "Trust the registry result, not the stamp’s look. This is an in-company electronic record, not a qualified certificate issued by a licensed CSP."}
      </p>
    </SigningPanel>
  );
}
