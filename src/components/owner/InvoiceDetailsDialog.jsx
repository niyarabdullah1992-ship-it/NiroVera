import React from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InvoiceAuditTimeline from "@/components/owner/InvoiceAuditTimeline";
import { printOfficialInvoice } from "@/lib/officialInvoicePdf";
import OfficialInvoiceTemplate from "@/components/owner/OfficialInvoiceTemplate";
import { ownerGhostBtn, ownerPaper, ownerPrimaryBtn } from "@/components/owner/ownerUi";

export default function InvoiceDetailsDialog({ invoice, onClose, ar, onAudit }) {
  if (!invoice) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText className="h-5 w-5" style={{ color: "var(--nv-accent)" }} />
            {invoice.number}
          </DialogTitle>
        </DialogHeader>
        <OfficialInvoiceTemplate invoice={invoice} ar={ar} />
        <div style={{ ...ownerPaper("mute"), padding: 14 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--nv-ink)" }}>
            {ar ? "السجل الزمني القانوني" : "Invoice audit timeline"}
          </h3>
          <InvoiceAuditTimeline invoice={invoice} ar={ar} />
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: invoice.hostedUrl ? "1fr 1fr" : "1fr" }}>
          <button
            type="button"
            onClick={() => {
              onAudit("exported_pdf", invoice);
              printOfficialInvoice(invoice, ar);
            }}
            style={ownerPrimaryBtn()}
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
          {invoice.hostedUrl ? (
            <a
              href={invoice.hostedUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => onAudit("hosted_opened", invoice)}
              style={{ ...ownerGhostBtn(), textDecoration: "none" }}
            >
              <ExternalLink className="h-4 w-4" />
              {ar ? "النسخة الإلكترونية" : "Hosted invoice"}
            </a>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
