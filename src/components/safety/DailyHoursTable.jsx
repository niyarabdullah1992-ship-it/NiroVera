import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function DailyHoursTable({ selectedMonth, dailyHours = [], totalHours, canEdit, lang, onChange }) {
  const [open, setOpen] = useState(true);
  const ar = lang === "ar";
  const [year, month] = selectedMonth.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  const today = localDateKey();
  const entries = new Map(dailyHours.map((item) => [item.date, item.hours]));
  const days = Array.from({ length: count }, (_, index) => {
    const date = `${selectedMonth}-${String(index + 1).padStart(2, "0")}`;
    return { date, future: date > today, day: new Date(`${date}T12:00:00`).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US", { weekday: "short" }) };
  });
  const setHours = (date, raw) => {
    const rest = dailyHours.filter((item) => item.date !== date);
    const next = raw === "" ? rest : [...rest, { date, hours: Math.max(0, Number(raw) || 0) }];
    onChange(next.sort((a, b) => a.date.localeCompare(b.date)));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 bg-card px-3 py-3 text-start hover:bg-muted/40">
        <span><span className="block text-xs font-semibold">{ar ? "سجل ساعات العمل اليومية" : "Daily work hours"}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{ar ? `إجمالي الشهر: ${totalHours.toLocaleString()} ساعة` : `Monthly total: ${totalHours.toLocaleString()} hours`}</span></span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span>{open ? (ar ? "طي" : "Collapse") : (ar ? "فرد" : "Expand")}</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && <>
      <div className="grid grid-cols-[1fr_8rem] border-t border-border bg-muted/60 px-3 py-2 text-[11px] font-semibold text-muted-foreground"><span>{ar ? "اليوم والتاريخ" : "Day and date"}</span><span>{ar ? "ساعات العمل" : "Work hours"}</span></div>
      <div className="max-h-80 overflow-y-auto divide-y divide-border/60">{days.map(({ date, future, day }) => <div key={date} className={`grid grid-cols-[1fr_8rem] items-center px-3 py-1.5 ${future ? "bg-muted/40 text-muted-foreground/60" : "bg-card"}`}><span className="text-xs"><strong>{day}</strong><span className="ms-2 text-[10px] text-muted-foreground">{date}</span></span><input type="number" min="0" step="0.25" disabled={!canEdit || future} value={!future && entries.has(date) ? entries.get(date) : ""} onChange={(event) => setHours(date, event.target.value)} className="h-8 rounded-md border border-input px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50" /></div>)}</div>
      <div className="flex items-center justify-between border-t border-border bg-[#F7F8FA] px-3 py-2 text-xs"><span className="font-semibold text-[#14284B]">{ar ? "إجمالي ساعات الشهر" : "Monthly total"}</span><strong className="text-[#1E9E63]">{totalHours.toLocaleString()}</strong></div>
      </>}
    </div>
  );
}