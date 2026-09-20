import React, { useState } from "react";
import { Wrench, Plus, Loader2 } from "lucide-react";
import MobileSelect from "@/components/mobile/MobileSelect";
import PlatformDateField from "@/components/shared/PlatformDateField";

// Rule 4 — an inspection closes only with photographic proof.
export default function MaintenanceLog({ records, lang, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "preventive", date: "", cost: "", result: "", performedBy: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onAdd({ ...form, cost: form.cost ? Number(form.cost) : null });
      setForm({ type: "preventive", date: "", cost: "", result: "", performedBy: "" });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading font-semibold flex items-center gap-2"><Wrench className="w-4 h-4" /> {lang === "ar" ? "الصيانة والفحوصات" : "Maintenance & inspections"}</h4>
        {onAdd ? (
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-body hover:bg-muted">
            <Plus className="w-3.5 h-3.5" /> {lang === "ar" ? "تسجيل" : "Log"}
          </button>
        ) : null}
      </div>

      {open && (
        <div className="rounded-[10px] border border-border p-3 space-y-2">
          <MobileSelect
            value={form.type} onChange={(v) => setForm({ ...form, type: v })} className="w-full"
            options={[{ value: "preventive", label: lang === "ar" ? "وقائية" : "Preventive" }, { value: "emergency", label: lang === "ar" ? "طارئة" : "Emergency" }]}
          />
          <PlatformDateField ar={lang === "ar"} value={form.date} onChange={(next) => setForm({ ...form, date: next })} />
          <input value={form.performedBy} onChange={(e) => setForm({ ...form, performedBy: e.target.value })} placeholder={lang === "ar" ? "المنفّذ" : "Performed by"} className="w-full rounded-md border border-input px-3 py-2 text-sm font-body" />
          <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder={lang === "ar" ? "التكلفة" : "Cost"} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          <textarea value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} rows={2} placeholder={lang === "ar" ? "النتيجة" : "Result"} className="w-full rounded-md border border-input px-3 py-2 text-sm font-body" />
          <button disabled={!form.date || saving} onClick={submit} className="w-full rounded-md bg-primary px-3 py-2 text-sm font-body text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (lang === "ar" ? "حفظ" : "Save")}
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-sm font-body text-muted-foreground">{lang === "ar" ? "لا توجد سجلات صيانة." : "No maintenance records."}</p>
      ) : (
        <div className="space-y-2">
          {records.map((m) => (
            <div key={m.id} className="rounded-[10px] border border-border p-3 text-sm font-body">
              <div className="flex justify-between gap-2">
                <span>{m.type === "emergency" ? (lang === "ar" ? "طارئة" : "Emergency") : (lang === "ar" ? "وقائية" : "Preventive")} · {m.performedBy || "—"}</span>
                <span className="font-display tabular-nums text-muted-foreground">{m.date}</span>
              </div>
              {m.result && <p className="text-xs text-muted-foreground mt-1">{m.result}</p>}
              {m.cost ? <p className="text-xs font-display tabular-nums mt-1">{Number(m.cost).toLocaleString("en-US")}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}