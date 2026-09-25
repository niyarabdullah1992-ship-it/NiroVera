import React from "react";
import { subscriptionTotals, formatSubscriptionMoney } from "@/lib/subscriptionTax";
import { OWNER_MONO, ownerPaper } from "@/components/owner/ownerUi";

export default function SubscriptionRevenueSummary({ amount = 0, ar }) {
  const totals = subscriptionTotals(amount);
  const items = [
    { label: ar ? "الإيراد الشهري قبل الضريبة" : "Monthly revenue before VAT", value: totals.subtotal, state: "mute" },
    { label: ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)", value: totals.vat, state: "mute" },
    { label: ar ? "الإجمالي الشهري شامل الضريبة" : "Monthly total including VAT", value: totals.total, state: "ok" },
  ];

  return (
    <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
      {items.map((item) => (
        <div key={item.label} style={{ ...ownerPaper(item.state), padding: 14 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--nv-muted)" }}>{item.label}</p>
          <p dir="ltr" style={{ ...OWNER_MONO, margin: "8px 0 0", fontSize: 22, fontWeight: 500, color: item.state === "ok" ? "var(--nv-ok-ink)" : "var(--nv-ink)" }}>
            {formatSubscriptionMoney(item.value, "USD", ar)}
          </p>
        </div>
      ))}
    </section>
  );
}
