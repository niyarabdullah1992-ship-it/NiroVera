import React from "react";
import { safetyLevelMeta } from "@/lib/safetyLogic";
import { BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

export default function SafetyStationStrip({ stations, recFor, selectedId, onSelect, ar }) {
  if (!stations.length) return null;
  return (
    <div
      role="listbox"
      aria-label={ar ? "اختيار الفرع" : "Choose station"}
      style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}
    >
      {stations.map((station) => {
        const rec = recFor(station.id);
        const tone = safetyLevelMeta(rec?.level, ar);
        const hazards = (rec?.hazards || []).length;
        const selected = selectedId === station.id;
        return (
          <button
            key={station.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(station.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 40,
              padding: "6px 10px 6px 8px",
              borderRadius: 10,
              border: `1px solid ${selected ? "color-mix(in oklab, var(--nv-ink) 22%, #fff)" : BORDER}`,
              background: selected ? CARD : SURFACE,
              boxShadow: selected ? "inset 3px 0 0 var(--nv-navy)" : "none",
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              textAlign: "start",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: NAVY }}>{station.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: tone.fg }}>{tone.label}</span>
                {hazards > 0 ? (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-warn-ink)" }}>
                    {ar ? `${hazards} خطر` : `${hazards} hazards`}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: MUTED }}>{ar ? "بلا خطر مفتوح" : "No open hazard"}</span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
