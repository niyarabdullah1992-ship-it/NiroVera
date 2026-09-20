import React from "react";
import { CalendarRange } from "lucide-react";
import PlatformDateField from "@/components/shared/PlatformDateField";

const optionsFor = (ar) => [
  ["all", ar ? "كل الأشهر" : "All months"],
  ["current", ar ? "الشهر الحالي" : "Current month"],
  ["3", ar ? "3 أشهر" : "3 months"],
  ["6", ar ? "6 أشهر" : "6 months"],
  ["12", ar ? "سنة" : "1 year"],
  ["range", ar ? "بين تاريخين" : "Date range"],
];

export default function InvoicePeriodFilters({ period, onPeriodChange, from, to, onFromChange, onToChange, ar }) {
  return (
    <section className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><CalendarRange className="h-3.5 w-3.5" />{ar ? "فواتير الاشتراكات حسب الفترة" : "Subscription invoices by period"}</p>
      <div className="flex flex-wrap gap-2">
        {optionsFor(ar).map(([value, label]) => <button key={value} type="button" onClick={() => onPeriodChange(value)} className={`rounded-full border px-3 py-1.5 text-xs font-body transition ${period === value ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}>{label}</button>)}
      </div>
      {period === "range" && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-xs text-muted-foreground">{ar ? "من تاريخ" : "From date"}</span><PlatformDateField ar={ar} value={from} max={to || undefined} onChange={onFromChange} /></label>
        <label><span className="mb-1 block text-xs text-muted-foreground">{ar ? "إلى تاريخ" : "To date"}</span><PlatformDateField ar={ar} value={to} min={from || undefined} onChange={onToChange} /></label>
      </div>}
    </section>
  );
}