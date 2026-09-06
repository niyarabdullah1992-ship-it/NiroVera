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
  viewMode,
  onViewModeChange,
  filter,
  onFilterChange,
  chips,
  showCreate,
  onToggleCreate,
}) {
  const viewTabs = [
    { id: "list", label: ar ? "قائمة" : "List" },
    { id: "plan", label: ar ? "الخطة" : "Plan" },
  ];

  return (
    <div dir={dir} style={OUTER}>
      <div className="nv-tabrail">
        {viewTabs.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onViewModeChange(v.id)}
            aria-current={viewMode === v.id ? "true" : undefined}
            data-active={viewMode === v.id ? "true" : undefined}
          >
            {v.label}
          </button>
        ))}
      </div>
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
      <button type="button" onClick={onToggleCreate} style={showCreate ? ui.btnCreateQuiet : ui.btnCreate}>
        {showCreate ? (ar ? "إخفاء النموذج" : "Hide form") : (ar ? "مهمة جديدة" : "New task")}
      </button>
    </div>
  );
}
