import React, { useState } from "react";
import { FileText, ReceiptText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { subscriptionTotals, subscriptionBillableAmount, formatSubscriptionMoney } from "@/lib/subscriptionTax";
import { printSubscriptionInvoices, subscriptionInvoiceNumber } from "@/lib/subscriptionInvoiceExport";
import { OWNER_MONO, ownerGhostBtn, ownerPaper, ownerPrimaryBtn } from "@/components/owner/ownerUi";

export default function SubscriptionInvoice({ row, ar }) {
  const [open, setOpen] = useState(false);
  const amount = row.amount ?? row.customPrice;
  if (amount == null && !row.exempt && !row.isFree && row.plan !== "Free") {
    return <span style={{ color: "var(--nv-muted)" }}>—</span>;
  }
  const currency = row.currency || "USD";
  const totals = subscriptionTotals(subscriptionBillableAmount(row));
  const invoiceNumber = subscriptionInvoiceNumber(row);
  const issueDate = new Date(row.startedAt || Date.now()).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
  const money = (value) => formatSubscriptionMoney(value, currency, ar);
  const lines = [
    [ar ? "المبلغ قبل الضريبة" : "Subtotal before VAT", money(totals.subtotal)],
    [ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)", money(totals.vat)],
  ];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={ownerGhostBtn()}>
        <ReceiptText className="h-3.5 w-3.5" />
        {ar ? "بيان" : "Statement"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir={ar ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ReceiptText className="h-5 w-5" style={{ color: "var(--nv-accent)" }} />
              {ar ? "بيان الاشتراك الداخلي" : "Internal subscription statement"}
            </DialogTitle>
          </DialogHeader>
          <div style={{ ...ownerPaper("mute"), overflow: "hidden", padding: 0 }}>
            <div style={{ padding: 16, borderBottom: "1px solid var(--nv-line)", background: "var(--nv-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11, color: "var(--nv-muted)" }}>
                <span dir="ltr" style={OWNER_MONO}>{invoiceNumber}</span>
                <span>{issueDate}</span>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "العميل" : "Customer"}</p>
              <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600, color: "var(--nv-ink)" }}>{row.companyName || "—"}</h3>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--nv-muted)" }} dir="ltr">{row.email || "—"}</p>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--nv-muted)" }}>
                {row.plan} · {row.billing === "yearly" ? (ar ? "سنوي" : "Yearly") : (ar ? "شهري" : "Monthly")}
              </p>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {lines.map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
                  <span style={{ color: "var(--nv-muted)" }}>{label}</span>
                  <strong dir="ltr" style={{ color: "var(--nv-ink)" }}>{value}</strong>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, borderTop: "1px solid var(--nv-line)", paddingTop: 14 }}>
                <span style={{ fontWeight: 600, color: "var(--nv-ink)" }}>
                  {ar ? "الإجمالي شامل الضريبة" : "Total including VAT"}
                </span>
                <strong dir="ltr" style={{ fontSize: 17, color: "var(--nv-accent)" }}>{money(totals.total)}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => printSubscriptionInvoices([row], ar, `${ar ? "بيان اشتراك" : "Subscription statement"} ${invoiceNumber}`)}
            style={{ ...ownerPrimaryBtn(), width: "100%" }}
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
