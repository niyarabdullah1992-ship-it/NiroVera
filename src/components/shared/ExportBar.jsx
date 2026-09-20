import React from "react";
import { downloadXlsx } from "@/lib/simpleXlsx";
import { ui } from "@/lib/platformStyles";

/** Excel download for operational registers. */
export default function ExportBar({ title, headers, rows, compact = false }) {
  if (!headers?.length) return null;
  const onExport = () => {
    downloadXlsx(title || "export", [{
      name: "register",
      rows: [headers, ...(rows || [])],
      rtl: true,
    }]);
  };
  return (
    <button type="button" onClick={onExport} style={{ ...ui.btnSecondary, height: compact ? 32 : undefined }}>
      Excel
    </button>
  );
}
