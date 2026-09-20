import React from "react";
import { EXPENSE_APPROVAL_POLICY } from "@/lib/expenseDerivations";
import { MUTED, NAVY, tableShell, SURFACE } from "@/lib/platformStyles";

const STEP = {
  mgr: { ar: "مدير الفرع", en: "Station manager" },
  fin: { ar: "المالية", en: "Finance" },
  cfo: { ar: "المدير المالي", en: "CFO" },
};

const EFFECT = [
  { ar: "يُصرف من صندوق الفرع", en: "Paid from the station cash box" },
  { ar: "المالية تفحص الوعاء والإيصال", en: "Finance checks the vessel and the receipt" },
  { ar: "المدير المالي يعتمد فوق 5,000 ويُقيَّد الالتزام على وعاء الفرع", en: "The CFO closes amounts above 5,000 and books the vessel" },
];

export default function ExpensePolicyBoard({ ar }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={tableShell}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px,1fr) minmax(200px,1.6fr) minmax(180px,1.4fr)",
          gap: 12,
          padding: "10px 16px",
          background: SURFACE,
          fontSize: 10,
          fontWeight: 600,
          color: MUTED,
        }}>
          {(ar ? ["المبلغ", "من يعتمد", "الأثر"] : ["Amount", "Who approves", "Effect"]).map((label) => <span key={label}>{label}</span>)}
        </div>
        {EXPENSE_APPROVAL_POLICY.map((row, index) => {
          const amount = row.upTo === Infinity
            ? (ar ? "فوق 5,000 ر.س" : "Above 5,000 SAR")
            : index === 0
              ? (ar ? "حتى 500 ر.س" : "Up to 500 SAR")
              : (ar ? "501 – 5,000 ر.س" : "501 – 5,000 SAR");
          return (
            <div
              key={row.upTo}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px,1fr) minmax(200px,1.6fr) minmax(180px,1.4fr)",
                gap: 12,
                padding: "12px 16px",
                borderTop: "1px solid #F1F5F9",
                color: NAVY,
              }}
            >
              <span style={{ fontWeight: 700 }}>{amount}</span>
              <span>{row.steps.map((step) => (ar ? STEP[step].ar : STEP[step].en)).join(" ← ")}</span>
              <span style={{ color: MUTED }}>{ar ? EFFECT[index].ar : EFFECT[index].en}</span>
            </div>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
        {ar
          ? "ثوابت لا تُكسر: بلا إيصال لا اعتماد · مطالبة صاحبها لا يعتمدها · التجاوز عن الوعاء يُرفض. حتى 500 يعتمدها المدير وحده · 501–5,000 تضيف المالية · فوق 5,000 يُغلقها المدير المالي. الخطوات تُشتقّ من المبلغ لا تُختار."
          : "Unbroken constants: no receipt, no approval · the claimant cannot approve their own claim · over-budget is refused. Up to 500 is manager-only · 501–5,000 adds finance · above 5,000 the CFO closes. Steps are derived from the amount, not chosen."}
      </p>
    </div>
  );
}
