import React, { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportOwnerReportExcel, printOwnerReport } from "@/lib/ownerReportExport";
import { ownerChip, ownerGhostBtn, ownerPaper } from "@/components/owner/ownerUi";

export default function OwnerExportButtons({ filename, title, headers, rows, ar }) {
  const [open, setOpen] = useState(false);
  const report = { filename, title, headers, rows, ar };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button type="button" onClick={() => setOpen(!open)} style={ownerChip(open)}>
        <FileText className="h-3.5 w-3.5" />
        {title} (PDF / Excel)
      </button>
      {open ? (
        <div style={{ ...ownerPaper("mute"), padding: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" disabled={!rows.length} onClick={() => exportOwnerReportExcel(report)} style={{ ...ownerGhostBtn(), opacity: rows.length ? 1 : 0.4, color: "var(--nv-ok-ink)", borderColor: "var(--nv-ok-line)" }}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button type="button" disabled={!rows.length} onClick={() => printOwnerReport(report)} style={{ ...ownerGhostBtn(), opacity: rows.length ? 1 : 0.4 }}>
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      ) : null}
    </div>
  );
}
