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
  return <div className="space-y-3">{events.map(([label, date], index) => <div key={label} className="flex gap-3 text-sm"><span className="mt-0.5 text-accent">{index === events.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span><div><p className="font-medium">{label}</p><p className="text-xs text-muted-foreground">{new Date(date).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}</p></div></div>)}</div>;
}