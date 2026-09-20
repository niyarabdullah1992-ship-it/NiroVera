import React, { useState } from "react";
import { Search } from "lucide-react";
import { ACCENT, MUTED, NAVY, BORDER, SURFACE, BRAND_SOFT, field, CARD, CONTROL_RADIUS, PILL_RADIUS, RADIUS } from "@/lib/platformStyles";

export default function StationExpenseScope({ stations, scope, setScope, selected, setSelected, canPick, ar }) {
  const [query, setQuery] = useState("");
  if (!canPick) {
    return (
      <p style={{ margin: 0, borderRadius: CONTROL_RADIUS, background: SURFACE, border: `1px solid ${BORDER}`, padding: "11px 13px", fontSize: "13px", color: NAVY }}>
        {ar ? "يُسجل المصروف على فرعك." : "Expense applies to your station."}
      </p>
    );
  }
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const visibleStations = stations.filter((station) => `${station.name || ""} ${station.location || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const chip = (active) => ({
    borderRadius: PILL_RADIUS,
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 500,
    border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
    background: active ? ACCENT : CARD,
    color: active ? "#fff" : NAVY,
    cursor: "pointer",
    fontFamily: "inherit",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderRadius: RADIUS, border: `1px solid ${BORDER}`, padding: "12px 13px", background: CARD }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button type="button" onClick={() => setScope("all")} style={chip(scope === "all")}>{ar ? "جميع الفروع" : "All stations"}</button>
        <button type="button" onClick={() => setScope("selected")} style={chip(scope === "selected")}>{ar ? "فروع معينة" : "Selected stations"}</button>
      </div>
      {scope === "selected" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: MUTED, pointerEvents: "none" }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ar ? "ابحث باسم الفرع أو الموقع..." : "Search by station name or location..."}
              style={{ ...field, paddingInlineStart: "40px", paddingInlineEnd: "14px" }}
            />
          </div>
          <div style={{ maxHeight: "240px", overflowY: "auto", borderRadius: CONTROL_RADIUS, border: `1px solid ${BORDER}`, background: CARD }}>
            {visibleStations.map((station) => (
              <label
                key={station.stationId}
                style={{
                  display: "flex",
                  width: "100%",
                  cursor: "pointer",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: NAVY,
                  borderBottom: `1px solid ${BORDER}`,
                  background: selected.includes(station.stationId) ? BRAND_SOFT : CARD,
                }}
              >
                <input type="checkbox" checked={selected.includes(station.stationId)} onChange={() => toggle(station.stationId)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{station.name}</span>
              </label>
            ))}
            {visibleStations.length === 0 && (
              <p style={{ margin: 0, padding: "20px 14px", textAlign: "center", fontSize: "13px", color: MUTED }}>
                {ar ? "لا توجد فروع مطابقة" : "No matching stations"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
