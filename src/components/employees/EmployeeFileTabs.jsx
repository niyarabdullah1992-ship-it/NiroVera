import React from "react";
import { NAVY, MUTED, CARD, BORDER } from "@/lib/platformStyles";

export default function EmployeeFileTabs({ tabs, value, onChange, ar }) {
  return (
    <div
      className="nv-file-tabs"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "9px 14px",
        display: "flex",
        gap: 5,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => {
        const on = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={on ? "page" : undefined}
            style={{
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: on ? 700 : 400,
              padding: "9px 16px",
              border: `1px solid ${on ? NAVY : BORDER}`,
              background: on ? NAVY : CARD,
              color: on ? "#fff" : MUTED,
              cursor: "pointer",
              whiteSpace: "nowrap",
              borderRadius: 10,
            }}
          >
            {ar ? tab.ar : tab.en}
          </button>
        );
      })}
    </div>
  );
}
