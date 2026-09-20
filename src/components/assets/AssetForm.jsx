import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import MobileSelect from "@/components/mobile/MobileSelect";
import PlatformDateField from "@/components/shared/PlatformDateField";

const Field = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-xs font-body text-muted-foreground">{label}</span>
    {children}
  </label>
);

const input = "w-full rounded-md border border-input px-3 py-2 text-sm font-body";

export default function AssetForm({ asset, stations, employees, lang, onClose, onSave, defaultStationId }) {
  const [form, setForm] = useState({
    name: "", assetCode: "", category: "", stationId: asset?.stationId || defaultStationId || stations[0]?.id || "", site: "",
    holderId: "", purchaseDate: "", value: "", warrantyEndDate: "",
    nextInspectionDate: "", status: "available",
    ...(asset || {}),
    usefulLifeYears: asset?.usefulLifeMonths ? Math.round(asset.usefulLifeMonths / 12) : "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e?.target ? e.target.value : e });

  const submit = async () => {
    setSaving(true);
    try {
      // An asset may sit with the branch itself rather than a person — the unit
      // becomes the holder of record ("station:<id>").
      const branchHolder = String(form.holderId || "").startsWith("station:");
      const holder = employees.find((e) => e.id === form.holderId);
      const stationOf = stations.find((s) => s.id === String(form.holderId).replace("station:", ""));
      const { noWarranty, ...payload } = form;
      const ok = await onSave({
        ...payload,
        warrantyEndDate: noWarranty ? null : (form.warrantyEndDate || null),
        holderName: branchHolder ? `${lang === "ar" ? "عهدة الفرع" : "Branch custody"} — ${stationOf?.name || ""}` : (holder?.name || form.holderName || ""),
        value: form.value ? Number(form.value) : null,
        usefulLifeMonths: form.usefulLifeYears ? Number(form.usefulLifeYears) * 12 : null,
        inspectionIntervalDays: null,
        originStationId: asset?.originStationId || form.originStationId || form.stationId,
      });
      if (ok !== false) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="nv-paper w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-[14px] border border-border bg-card p-4 space-y-3 pb-safe">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">{asset ? (lang === "ar" ? "تعديل أصل" : "Edit asset") : (lang === "ar" ? "أصل جديد" : "New asset")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <Field label={lang === "ar" ? "اسم الأصل" : "Asset name"}><input value={form.name} onChange={set("name")} className={input} /></Field>
        <Field label={lang === "ar" ? "الرقم التسلسلي" : "Serial number"}><input value={form.assetCode} onChange={set("assetCode")} className={input} /></Field>
        <Field label={lang === "ar" ? "الفئة" : "Category"}><input value={form.category} onChange={set("category")} className={input} /></Field>

        <Field label={lang === "ar" ? "الوحدة المالكة" : "Owning unit"}>
          <MobileSelect value={form.stationId} onChange={set("stationId")} searchable className="w-full" options={stations.map((s) => ({ value: s.id, label: s.name }))} />
        </Field>
        <Field label={lang === "ar" ? "الحالة" : "Status"}>
          <MobileSelect value={form.status} onChange={set("status")} className="w-full" options={[
            { value: "available", label: lang === "ar" ? "متاح" : "Available" },
            { value: "in_custody", label: lang === "ar" ? "في العهدة" : "In custody" },
            { value: "maintenance", label: lang === "ar" ? "صيانة" : "Maintenance" },
            { value: "retired", label: lang === "ar" ? "خارج الخدمة" : "Out of service" },
          ]} />
        </Field>
        <Field label={lang === "ar" ? "المقر" : "Site"}><input value={form.site} onChange={set("site")} className={input} /></Field>
        <Field label={lang === "ar" ? "الحائز (موظف أو عهدة فرع)" : "Holder (employee or branch custody)"}>
          <MobileSelect value={form.holderId} onChange={set("holderId")} searchable className="w-full" options={[
            ...stations.filter((s) => s.id === form.stationId).map((s) => ({ value: `station:${s.id}`, label: `${lang === "ar" ? "عهدة الفرع" : "Branch custody"} — ${s.name}` })),
            ...employees.map((e) => ({ value: e.id, label: e.name })),
          ]} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={lang === "ar" ? "تاريخ الشراء" : "Purchase date"}>
            <PlatformDateField ar={lang === "ar"} value={form.purchaseDate || ""} onChange={(next) => setForm({ ...form, purchaseDate: next })} />
          </Field>
          <Field label={lang === "ar" ? "القيمة" : "Value"}><input type="number" value={form.value || ""} onChange={set("value")} className={input} /></Field>
          <Field label={lang === "ar" ? "العمر الافتراضي (سنوات)" : "Useful life (years)"}><input type="number" min="0" value={form.usefulLifeYears || ""} onChange={set("usefulLifeYears")} className={input} /></Field>
          <Field label={lang === "ar" ? "نهاية الضمان" : "Warranty end"}>
            <PlatformDateField ar={lang === "ar"} value={form.warrantyEndDate || ""} onChange={(next) => setForm({ ...form, warrantyEndDate: next })} disabled={form.noWarranty} />
            <label className="mt-1 flex items-center gap-2 text-xs font-body text-muted-foreground">
              <input type="checkbox" checked={!!form.noWarranty} onChange={(e) => setForm({ ...form, noWarranty: e.target.checked, warrantyEndDate: e.target.checked ? "" : form.warrantyEndDate })} className="h-3.5 w-3.5 accent-current" />
              {lang === "ar" ? "لا يوجد ضمان" : "No warranty"}
            </label>
          </Field>
        </div>

        <button disabled={!form.name || !form.assetCode || !form.stationId || saving} onClick={submit} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-body font-medium text-primary-foreground disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (lang === "ar" ? "حفظ" : "Save")}
        </button>
      </div>
    </div>
  );
}
