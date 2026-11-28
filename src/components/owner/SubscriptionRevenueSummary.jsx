import React from "react";
import { subscriptionTotals, formatSubscriptionMoney } from "@/lib/subscriptionTax";
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
          <p dir="ltr" style={{ ...OWNER_MONO, margin: "6px 0 0", fontSize: 20, fontWeight: 600, color: "var(--nv-ink)", textAlign: ar ? "right" : "left" }}>
            {formatSubscriptionMoney(item.value, "USD", ar)}
          </p>
        </div>
      ))}
    </section>
  );
}
