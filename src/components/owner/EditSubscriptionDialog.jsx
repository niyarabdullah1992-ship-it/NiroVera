import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import PlatformDateField from "@/components/shared/PlatformDateField";

const dateValue = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const validPlan = (plan) => ["Starter", "Professional", "Enterprise", "Custom"].includes(plan) ? plan : "Starter";
export default function EditSubscriptionDialog({ open, onOpenChange, row, ar, onSaved }) {
  const [form, setForm] = useState({ plan: validPlan(row.plan), start: dateValue(row.startedAt), end: dateValue(row.endsAt), customPrice: row.customPrice ?? "", freePlan: row.exempt === true, reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setForm({ plan: validPlan(row.plan), start: dateValue(row.startedAt), end: dateValue(row.endsAt), customPrice: row.customPrice ?? "", freePlan: row.exempt === true, reason: "" }); setError(""); } }, [open, row]);
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const planChanged = form.plan !== row.plan;
      if (planChanged || form.freePlan !== (row.exempt === true) || (form.plan === "Custom" && Number(form.customPrice) !== Number(row.customPrice))) await base44.functions.invoke("subscriptionOverview", { action: "changePlan", accountId: row.accountId, plan: form.plan, customPrice: form.customPrice, freePlan: form.freePlan, reason: form.reason });
      if (planChanged) await base44.functions.invoke("subscriberEmails", { action: "manualUpgrade", accountId: row.accountId });
      if (form.end !== dateValue(row.endsAt) || form.start !== dateValue(row.startedAt)) await base44.functions.invoke("subscriptionOverview", { action: "extend", accountId: row.accountId, subscriptionStart: form.start, subscriptionEnd: form.end, reason: form.reason });
      await onSaved(); onOpenChange(false);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || (ar ? "تعذر تطبيق الترقية اليدوية." : "Manual upgrade could not be applied."));
    } finally { setSaving(false); }
  };
  const field = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md" dir={ar ? "rtl" : "ltr"}><DialogHeader><DialogTitle>{ar ? "ترقية الشركة يدويًا" : "Upgrade company manually"} — {row.companyName}</DialogTitle></DialogHeader><div className="space-y-3"><label className="block text-xs text-muted-foreground">{ar ? "الباقة" : "Plan"}<select value={form.plan} onChange={field("plan")} className="mt-1 w-full rounded-xl border border-border bg-card p-3 text-sm">{["Starter", "Professional", "Enterprise", "Custom"].map((plan) => <option key={plan}>{plan}</option>)}</select></label><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3"><input type="checkbox" checked={form.freePlan} onChange={(event) => setForm((value) => ({ ...value, freePlan: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="block text-sm font-medium text-foreground">{ar ? "جعل هذه الباقة مجانية" : "Make this plan free"}</span><span className="mt-1 block text-xs text-muted-foreground">{ar ? "يحصل المشترك على جميع مزايا الباقة دون رسوم." : "The subscriber keeps all plan benefits without charges."}</span></span></label>{form.plan === "Custom" && !form.freePlan && <label className="block text-xs text-muted-foreground">{ar ? "السعر الشهري المخصص ($)" : "Custom monthly price ($)"}<input type="number" min="0" value={form.customPrice} onChange={field("customPrice")} className="mt-1 w-full rounded-xl border border-border bg-card p-3 text-sm" /></label>}<div className="grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">{ar ? "البداية" : "Start"}<div className="mt-1"><PlatformDateField ar={ar} value={form.start} onChange={(next) => setForm((value) => ({ ...value, start: next }))} /></div></label><label className="text-xs text-muted-foreground">{ar ? "النهاية / التمديد" : "End / extend"}<div className="mt-1"><PlatformDateField ar={ar} value={form.end} min={form.start} onChange={(next) => setForm((value) => ({ ...value, end: next }))} /></div></label></div><label className="block text-xs text-muted-foreground">{ar ? "سبب التغيير" : "Reason for change"}<textarea value={form.reason} onChange={field("reason")} className="mt-1 min-h-20 w-full rounded-xl border border-border bg-card p-3 text-sm" /></label>{error && <p className="text-sm text-destructive">{error}</p>}<button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{ar ? "تطبيق الترقية" : "Apply upgrade"}</button></div></DialogContent></Dialog>;
}