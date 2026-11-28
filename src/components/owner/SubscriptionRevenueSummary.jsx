import React from "react";
import { subscriptionTotals } from "@/lib/subscriptionTax";
import { currencyLabel } from "@/lib/subscriptionPlans";
import { OWNER_MONO, ownerPaper } from "@/components/owner/ownerUi";

/** Monthly revenue in one calm strip: before VAT · VAT · total. */
export default function SubscriptionRevenueSummary({ amount = 0, ar }) {
  const totals = subscriptionTotals(amount);
  const items = [
    { label: ar ? "الإيراد الشهري قبل الضريبة" : "Monthly revenue before VAT", value: totals.subtotal },
    { label: ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)", value: totals.vat },
    { label: ar ? "الإجمالي الشهري شامل الضريبة" : "Monthly total including VAT", value: totals.total, strong: true },
  ];

  return (
    <section style={{ ...ownerPaper(), display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {items.map((item, index) => (
        <div key={item.label} style={{ padding: "16px 20px", borderInlineStart: index ? "1px solid var(--nv-line)" : "none" }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--nv-muted)" }}>{item.label}</p>
          <p style={{ margin: "6px 0 0", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span dir="ltr" style={{ ...OWNER_MONO, fontSize: 22, fontWeight: 600, color: "var(--nv-ink)" }}>{Number(item.value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-muted)" }}>{currencyLabel("SAR", ar)}</span>
          </p>
        </div>
      ))}
    </section>
  );
}
