import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import PlatformDateField from "@/components/shared/PlatformDateField";

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function SafetyLtiEntries({ selectedMonth, entries = [], canEdit, lang, onChange }) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const monthEnd = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate();
  const futureMonth = `${selectedMonth}-01` > todayKey();
  const maxDate = futureMonth ? `${selectedMonth}-01` : [`${selectedMonth}-${String(monthEnd).padStart(2, "0")}`, todayKey()].sort()[0];
  const [date, setDate] = useState(maxDate);
  useEffect(() => setDate(maxDate), [maxDate]);
  const visible = entries.map((item, index) => ({ ...item, index })).filter((item) => String(item.date).startsWith(selectedMonth));
  const add = () => {
    if (!date || !date.startsWith(selectedMonth) || date > todayKey()) return;
    onChange([...entries, { date, ...(description.trim() ? { description: description.trim() } : {}) }]);
    setDescription(""); setOpen(false);
  };

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">{ar ? "إصابات الوقت الضائع LTI" : "Lost-time injuries (LTI)"}</p><p className="text-[10px] text-muted-foreground">{ar ? `${visible.length} إصابة في الشهر المحدد` : `${visible.length} in selected month`}</p></div>{canEdit && !futureMonth && <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] hover:bg-muted"><Plus className="h-3.5 w-3.5" />{ar ? "إضافة إصابة LTI" : "Add LTI"}</button>}</div>
      {open && <div className="grid gap-2 rounded-lg bg-muted/50 p-2 sm:grid-cols-[minmax(10rem,1fr)_1fr_auto]"><PlatformDateField compact ar={ar} min={`${selectedMonth}-01`} max={maxDate} value={date} onChange={setDate} /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={ar ? "وصف اختياري" : "Optional description"} className="rounded-md border border-input px-2 py-1.5 text-xs" /><button type="button" onClick={add} className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">{ar ? "حفظ" : "Save"}</button></div>}
      <div className="space-y-1.5">{visible.map((item) => <div key={`${item.date}-${item.index}`} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2"><div className="min-w-0"><p className="text-[11px] font-semibold">{item.date}</p><p className="truncate text-[10px] text-muted-foreground">{item.description || (ar ? "بدون وصف" : "No description")}</p></div>{canEdit && <button type="button" aria-label={ar ? "حذف الإصابة" : "Delete injury"} onClick={() => onChange(entries.filter((_, index) => index !== item.index))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}</div>)}</div>
    </div>
  );
}