import React from "react";
import { MUTED, NAVY, statCard, num } from "@/lib/platformStyles";

export default function AssetStats({ assets, lang, originValue, physicalValue }) {
  const ar = lang === "ar";
  const inCustody = assets.filter((a) => a.status === "in_custody").length;
  const outOfService = assets.filter((a) => ["maintenance", "lost", "retired"].includes(a.status)).length;
  const derivedPhysical = physicalValue ?? assets
    .filter((a) => a.status !== "retired")
    .reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const derivedOrigin = originValue ?? derivedPhysical;
  const fmt = (n) => Number(n || 0).toLocaleString(ar ? "en-US" : "en-US");

  const cards = [
    { label: ar ? "أصول في الموقع" : "On site", value: assets.length, hint: ar ? "السجل حسب الفرع الحالي" : "Register by physical station" },
    { label: ar ? "عهد نشطة" : "Active custody", value: inCustody },
    { label: ar ? "خارج الخدمة" : "Out of service", value: outOfService },
    {
      label: ar ? "قيمة في الموقع" : "On-site value",
      value: fmt(derivedPhysical),
      money: true,
      hint: ar ? "ما هو موجود هنا الآن" : "What sits here now",
    },
    {
      label: ar ? "قيمة المنشأ / الوعاء" : "Origin / vessel",
      value: fmt(derivedOrigin),
      money: true,
      hint: ar ? "كتاب الشراء — لا ينتقل مع النقل" : "Buyer's book — does not move with a transfer",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 0, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
      {cards.map((card) => (
        <div key={card.label} style={statCard}>
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{card.label}</p>
          <p dir="ltr" style={{ margin: "8px 0 0", ...num(NAVY), fontSize: card.money ? 18 : 22, textAlign: "start" }}>{card.value}</p>
          {card.hint ? <p style={{ margin: "6px 0 0", fontSize: 10, color: MUTED, lineHeight: 1.5 }}>{card.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
