import React from "react";
import { ASSET_STATUSES, assetStatusLabel } from "@/lib/assetsApi";
import { field, labelMuted, MUTED } from "@/lib/platformStyles";

const selectStyle = {
  ...field,
  width: "auto",
  minWidth: 148,
  height: 34,
  paddingInline: 10,
  fontSize: 12,
  color: MUTED,
  cursor: "pointer",
};

export default function AssetFilters({ lang, stations, categories, filters, setFilters, allowAllStations = true }) {
  const ar = lang === "ar";
  const all = ar ? "الكل" : "All";
  const set = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ ...labelMuted, fontSize: 10 }}>{ar ? "الفئة" : "Category"}</span>
        <select value={filters.category} onChange={set("category")} style={selectStyle}>
          <option value="all">{all}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {allowAllStations ? (
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ ...labelMuted, fontSize: 10 }}>{ar ? "الوحدة" : "Unit"}</span>
        <select value={filters.stationId} onChange={set("stationId")} style={selectStyle}>
          <option value="all">{all}</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      ) : null}
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ ...labelMuted, fontSize: 10 }}>{ar ? "الحالة" : "Status"}</span>
        <select value={filters.status} onChange={set("status")} style={selectStyle}>
          <option value="all">{all}</option>
          {ASSET_STATUSES.map((s) => <option key={s} value={s}>{assetStatusLabel(s, lang)}</option>)}
        </select>
      </label>
    </div>
  );
}
