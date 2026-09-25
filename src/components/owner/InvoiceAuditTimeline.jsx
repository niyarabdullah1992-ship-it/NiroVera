import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

export default function InvoiceAuditTimeline({ invoice, ar }) {
  const events = [
    [ar ? "إنشاء الفاتورة" : "Invoice created", invoice.createdAt],
    [ar ? "اعتماد الفاتورة" : "Invoice finalized", invoice.finalizedAt],
    [ar ? "سداد الفاتورة" : "Invoice paid", invoice.paidAt],
    [ar ? "إلغاء الفاتورة" : "Invoice voided", invoice.voidedAt],
    [ar ? "تعذر التحصيل" : "Marked uncollectible", invoice.uncollectibleAt],
  ].filter((item) => item[1]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {events.map(([label, date], index) => (
        <div key={label} style={{ display: "flex", gap: 10, fontSize: 13 }}>
          <span style={{ marginTop: 2, color: index === events.length - 1 ? "var(--nv-accent)" : "var(--nv-muted)" }}>
            {index === events.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--nv-ink)" }}>{label}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--nv-muted)" }}>
              {new Date(date).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
