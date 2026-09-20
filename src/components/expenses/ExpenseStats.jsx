import React from "react";
import KpiStrip from "@/components/shared/KpiStrip";

export default function ExpenseStats({ claims, ar }) {
  const total = claims.reduce((sum, claim) => sum + Number(claim.totalAmount || claim.amount || 0), 0);
  const mgr = claims.filter((claim) => claim.status === "submitted").length;
  const fin = claims.filter((claim) => claim.status === "manager_approved").length;
  const cfo = claims.filter((claim) => claim.status === "cfo_pending").length;
  return (
    <KpiStrip stats={[
      { label: ar ? "إجمالي الطلبات" : "Total claims", value: claims.length },
      { label: ar ? "بانتظار المدير" : "Manager review", value: mgr, tone: mgr ? "warn" : "ok" },
      { label: ar ? "بانتظار المالية" : "Finance review", value: fin, tone: fin ? "warn" : null },
      { label: ar ? "بانتظار المدير المالي" : "CFO review", value: cfo, tone: cfo ? "warn" : null },
      { label: ar ? "إجمالي المبالغ" : "Total amount", value: total.toLocaleString("en-US"), suffix: "SAR" },
    ]} />
  );
}
