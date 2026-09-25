import React from "react";
import PlanEntitlementsFields from "@/components/owner/PlanEntitlementsFields";
import { ownerField, ownerGhostBtn, ownerPaper, ownerPrimaryBtn } from "@/components/owner/ownerUi";

export default function PlanForm({ value, onChange, onSave, onCancel, ar }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <form onSubmit={onSave} style={{ ...ownerPaper("mute"), padding: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <input required value={value.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="اسم الباقة بالعربية" style={ownerField()} />
      <input required value={value.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="Plan name in English" style={ownerField()} />
      <input required value={value.slug} disabled={!!value.id} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="plan-id" style={{ ...ownerField(), opacity: value.id ? 0.6 : 1 }} />
      <select value={value.currency} onChange={(e) => set("currency", e.target.value)} style={ownerField()}>
        <option>USD</option>
        <option>SAR</option>
      </select>
      <input required type="number" min="0" step="0.01" value={value.monthlyPrice} onChange={(e) => set("monthlyPrice", Number(e.target.value))} placeholder={ar ? "السعر الشهري" : "Monthly price"} style={ownerField()} />
      <input required type="number" min="0" step="0.01" value={value.yearlyPrice} onChange={(e) => set("yearlyPrice", Number(e.target.value))} placeholder={ar ? "السعر السنوي" : "Yearly price"} style={ownerField()} />
      <textarea value={(value.featuresAr || []).join("\n")} onChange={(e) => set("featuresAr", e.target.value.split("\n").filter(Boolean))} placeholder="المزايا العربية — ميزة في كل سطر" style={{ ...ownerField(), minHeight: 112, gridColumn: "1 / -1" }} />
      <textarea value={(value.featuresEn || []).join("\n")} onChange={(e) => set("featuresEn", e.target.value.split("\n").filter(Boolean))} placeholder="English features — one per line" style={{ ...ownerField(), minHeight: 112, gridColumn: "1 / -1" }} />
      <div style={{ gridColumn: "1 / -1" }}>
        <PlanEntitlementsFields value={value} onChange={onChange} ar={ar} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--nv-ink)", gridColumn: "1 / -1" }}>
        <input type="checkbox" checked={value.freeNow === true} onChange={(e) => set("freeNow", e.target.checked)} />
        {ar ? "إتاحة الباقة مجانًا حاليًا" : "Offer this plan free for now"}
      </label>
      <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
        <button type="submit" style={ownerPrimaryBtn()}>{ar ? "حفظ الباقة" : "Save plan"}</button>
        <button type="button" onClick={onCancel} style={ownerGhostBtn()}>{ar ? "إلغاء" : "Cancel"}</button>
      </div>
    </form>
  );
}
