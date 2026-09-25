import React, { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { exportSubscriptionInvoicesExcel } from "@/lib/subscriptionInvoiceExport";
import { printSubscriptionInvoiceBundle } from "@/lib/subscriptionInvoiceBundle";
import { ownerChip, ownerGhostBtn, ownerPaper } from "@/components/owner/ownerUi";

export default function SubscriptionBulkExport({ rows, ar }) {
  const [open, setOpen] = useState(false);
  const invoiceRows = rows.filter((row) => row.status !== "no_subscription");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" onClick={() => setOpen(!open)} style={ownerChip(open)}>
        <FileText className="h-3.5 w-3.5" style={{ display: "inline", marginInlineEnd: 6, verticalAlign: -2 }} />
        {ar ? "تقرير الاشتراكات (PDF / Excel)" : "Subscriptions report (PDF / Excel)"}
      </button>
      {open ? (
        <div style={{ ...ownerPaper("mute"), padding: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            disabled={!invoiceRows.length}
            onClick={() => printSubscriptionInvoiceBundle(invoiceRows, ar)}
            style={ownerGhostBtn()}
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button
            type="button"
            disabled={!invoiceRows.length}
            onClick={() => exportSubscriptionInvoicesExcel(invoiceRows, ar)}
            style={ownerGhostBtn()}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
        </div>
      ) : null}
    </div>
  );
}
