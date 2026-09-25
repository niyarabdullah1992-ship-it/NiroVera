import React from "react";
import { PLAN_SECTIONS, PLAN_FEATURES } from "@/lib/subscriptionPlans";
import { ownerField, ownerInset } from "@/components/owner/ownerUi";

export default function PlanEntitlementsFields({ value, onChange, ar }) {
  const toggle = (field, key) => {
    const current = new Set(value[field] || []);
    current.has(key) ? current.delete(key) : current.add(key);
    onChange({ ...value, [field]: [...current] });
  };
  const limit = (field, input) => onChange({ ...value, [field]: input === "" ? null : Math.max(1, Number(input)) });

  return (
    <div style={{ ...ownerInset(), display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <label style={{ fontSize: 13, color: "var(--nv-ink)" }}>
          {ar ? "الحد الأقصى للفروع" : "Maximum stations"}
          <input
            type="number"
            min="1"
            value={value.maxStations ?? ""}
            onChange={(event) => limit("maxStations", event.target.value)}
            placeholder={ar ? "غير محدود" : "Unlimited"}
            style={{ ...ownerField(), marginTop: 6 }}
          />
        </label>
        <label style={{ fontSize: 13, color: "var(--nv-ink)" }}>
          {ar ? "الحد الأقصى للموظفين" : "Maximum employees"}
          <input
            type="number"
            min="1"
            value={value.maxEmployees ?? ""}
            onChange={(event) => limit("maxEmployees", event.target.value)}
            placeholder={ar ? "غير محدود" : "Unlimited"}
            style={{ ...ownerField(), marginTop: 6 }}
          />
        </label>
      </div>

      <div>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--nv-ink)" }}>
          {ar ? "الأقسام المتاحة" : "Available sections"}
        </p>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {PLAN_SECTIONS.map((item) => (
            <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--nv-ink)" }}>
              <input
                type="checkbox"
                checked={(value.enabledSections || []).includes(item.key)}
                onChange={() => toggle("enabledSections", item.key)}
              />
              {ar ? item.ar : item.en}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--nv-ink)" }}>
          {ar ? "المزايا الخاصة" : "Premium features"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {PLAN_FEATURES.map((item) => (
            <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--nv-ink)" }}>
              <input
                type="checkbox"
                checked={(value.enabledFeatures || []).includes(item.key)}
                onChange={() => toggle("enabledFeatures", item.key)}
              />
              {ar ? item.ar : item.en}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
