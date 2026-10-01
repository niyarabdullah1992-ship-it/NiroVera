import React from "react";
import { FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MUTED, CARD } from "@/lib/platformStyles";

/**
 * Employee files are retained. Exit is termination or resignation under the Labour Law —
 * never a hard delete of the person record.
 */
export default function DeleteEmployeeAccountCard() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div style={{
      borderRadius: "14px",
      border: "1px solid var(--nv-line)",
      background: CARD,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
    >
      <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "var(--nv-ink)" }}>
        <FileText style={{ width: 16, height: 16 }} />
        {ar ? "ملف الموظف محفوظ" : "Employee file is retained"}
      </h3>
      <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.65 }}>
        {ar
          ? "لا يُحذف ملف الموظف من المنصة. إنهاء العلاقة يكون بإنهاء الخدمة أو الاستقالة وفق نظام العمل والقرارات الوزارية — من تبويب إنهاء الخدمة / خروج العقد، مع بقاء السجل محفوظًا وسريًا داخل الشركة."
          : "The employee file is not deleted from the platform. Employment ends by termination or resignation under the Labour Law and ministerial decisions — from the Offboarding / contract-exit tab — while the record stays stored and confidential inside the company."}
      </p>
    </div>
  );
}
