import React from "react";
import { filterChip, pillRail, ui } from "@/lib/platformStyles";

const OUTER = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
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
}) {
  return (
    <div dir={dir} style={OUTER}>
      <div className="no-scrollbar" style={{ ...pillRail, flex: "1 1 220px", minWidth: 0 }}>
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
          {showCreate ? (ar ? "إخفاء النموذج" : "Hide form") : (ar ? "مهمة جديدة" : "New task")}
        </button>
      ) : null}
    </div>
  );
}
