import React from "react";
import { Search } from "lucide-react";
import { filterChip, pillRail, ui } from "@/lib/platformStyles";

export function OpsControlBar({ children }) {
  return (
    <div style={{ border: "1px solid #E4E9E6", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
      {children}
    </div>
  );
}

export function OpsStripSearch({ value, onChange, placeholder }) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      margin: 0,
      padding: "8px 12px",
      borderTop: "1px solid #E4E9E6",
    }}
    >
      <Search size={14} color="#8E9A93" strokeWidth={1.75} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="nv-signing-inline"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: "#111418",
        }}
      />
    </label>
  );
}

const OUTER = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "8px 10px",
};

export default function OpsToolbarStrip({
  ar,
  dir,
  filter,
  onFilterChange,
  chips,
  showCreate,
  onToggleCreate,
  canCreate = true,
  createLabel,
  hideLabel,
}) {
  return (
    <div dir={dir} style={OUTER}>
      <div className="no-scrollbar" style={{ ...pillRail, flex: "1 1 220px", minWidth: 0, border: "none", boxShadow: "none", background: "transparent", padding: 0 }}>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onFilterChange(chip.id)}
            style={filterChip(filter === chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {canCreate ? (
        <button type="button" onClick={onToggleCreate} style={showCreate ? ui.btnCreateQuiet : ui.btnCreate}>
          {showCreate
            ? (hideLabel || (ar ? "إخفاء النموذج" : "Hide form"))
            : (createLabel || (ar ? "مهمة جديدة" : "New task"))}
        </button>
      ) : null}
    </div>
  );
}
