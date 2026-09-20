import React from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Image } from "@/components/ui/image";
import { ACCENT, MUTED, NAVY, BORDER, SURFACE, emptyState, NEUTRAL, WARN, OK, BAD, ui, cardShell } from "@/lib/platformStyles";
import { formatDateTime } from "@/lib/dateFormat";

const TYPE = { travel: ["Travel", "سفر"], accommodation: ["Accommodation", "سكن"], fuel: ["Fuel", "وقود"], overtime_meals: ["Overtime Meals", "وجبات العمل الإضافي"], tools_equipment: ["Tools & Equipment", "أدوات ومعدات"], training: ["Training", "تدريب"], svc: ["Services & repair", "خدمات وإصلاح"], rent: ["Equipment hire", "تأجير معدات"] };
const STATUS = {
  submitted: ["Manager review", "مراجعة المدير"],
  manager_approved: ["Finance review", "مراجعة المالية"],
  manager_rejected: ["Manager rejected", "مرفوض من المدير"],
  finance_approved: ["Approved", "معتمد"],
  finance_rejected: ["Finance rejected", "مرفوض من المالية"],
  cfo_pending: ["CFO review", "مراجعة المدير المالي"],
  cfo_approved: ["CFO approved", "معتمد من المدير المالي"],
  cfo_rejected: ["CFO rejected", "مرفوض من المدير المالي"],
};
const STATUS_STYLE = {
  submitted: WARN,
  manager_approved: WARN,
  manager_rejected: BAD,
  finance_approved: OK,
  finance_rejected: BAD,
  cfo_pending: WARN,
  cfo_approved: OK,
  cfo_rejected: BAD,
};
const isPdf = (url = "") => decodeURIComponent(url).toLowerCase().includes(".pdf");

// A vessel refusal is part of the claim's history: finance really did decide, and the
// claim stayed where it was because the branch's vessel is spent. The last attempt is
// the one that still holds, so that is the one the row states.
const VESSEL_STAGE = {
  finance: ["finance approval", "اعتماد المالية"],
  cfo: ["CFO approval", "اعتماد المدير المالي"],
  vessel: ["approval from the operating vessel", "الاعتماد من الوعاء التشغيلي"],
};

function lastVesselBlock(claim) {
  const trail = Array.isArray(claim?.vesselBlocks) ? claim.vesselBlocks : [];
  return trail.length ? trail[trail.length - 1] : null;
}

export default function ExpenseList({ claims, stations, canManagerReview, canFinanceReview, canCfoReview, onManagerReview, onFinanceReview, onCfoReview, ar }) {
  if (!claims.length) return <div style={emptyState}>{ar ? "لا توجد مصروفات بعد." : "No expenses yet."}</div>;
  const stationNames = (claim) => (claim.stationIds?.length ? claim.stationIds : [claim.stationId]).map((id) => stations.find((station) => station.stationId === id)?.name || id).join("، ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {claims.map((claim) => (
        <article key={claim.id} className="nv-doc" style={{ ...cardShell, padding: "16px 18px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: NAVY }}>
                {claim.expenseType === "other" ? claim.customExpenseType : TYPE[claim.expenseType]?.[ar ? 1 : 0]}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: MUTED }}>{claim.requesterName} · {claim.expenseDate}</p>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: MUTED }}>{stationNames(claim)}</p>
            </div>
            <div style={{ textAlign: "end" }}>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: NAVY, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                {Number(claim.totalAmount || claim.amount).toLocaleString()} {claim.currency}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: MUTED }}>
                {Number(claim.amount).toLocaleString()} × {(claim.stationIds?.length || 1)}
              </p>
              <span style={{ ...(STATUS_STYLE[claim.status] || NEUTRAL), marginTop: "6px" }}>
                {STATUS[claim.status]?.[ar ? 1 : 0]}
              </span>
            </div>
          </div>
          <div style={{
            marginTop: "12px",
            display: "grid",
            gap: "8px",
            borderRadius: 0,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            padding: "12px",
            fontSize: "13px",
            color: NAVY,
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          }}>
            <p style={{ margin: 0 }}><span style={{ color: MUTED }}>{ar ? "قبل الضريبة" : "Before tax"}: </span>{Number(claim.beforeTaxAmount ?? claim.amount).toLocaleString()} {claim.currency}</p>
            <p style={{ margin: 0 }}><span style={{ color: MUTED }}>{ar ? "الضريبة" : "Tax"}: </span>{Number(claim.taxAmount || 0).toLocaleString()} {claim.currency}</p>
            <p style={{ margin: 0, fontWeight: 600 }}><span style={{ color: MUTED }}>{ar ? "بعد الضريبة" : "After tax"}: </span>{Number(claim.afterTaxAmount ?? claim.amount).toLocaleString()} {claim.currency}</p>
            {(claim.quantity ?? claim.itemCount) != null && <p style={{ margin: 0 }}><span style={{ color: MUTED }}>{ar ? "الكمية" : "Quantity"}: </span>{Number(claim.quantity ?? claim.itemCount).toLocaleString()}</p>}
            {claim.invoiceNumber && <p style={{ margin: 0 }}><span style={{ color: MUTED }}>{ar ? "رقم الفاتورة" : "Invoice no."}: </span>{claim.invoiceNumber}</p>}
          </div>
          {claim.description && <p style={{ margin: "12px 0 0", fontSize: "13px", color: MUTED }}>{claim.description}</p>}
          {claim.rejectReason ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#8A1C2B", lineHeight: 1.6 }}>
              {ar ? `سبب الرفض: ${claim.rejectReason}` : `Rejection reason: ${claim.rejectReason}`}
            </p>
          ) : null}
          {lastVesselBlock(claim) ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#8A6516", lineHeight: 1.7 }}>
              {ar
                ? `وقفة الوعاء عند ${VESSEL_STAGE[lastVesselBlock(claim).stage]?.[1] || VESSEL_STAGE.vessel[1]} — ${lastVesselBlock(claim).reason} حاولها ${lastVesselBlock(claim).byName || "—"} في ${formatDateTime(lastVesselBlock(claim).at, "ar")}، فبقيت المطالبة بانتظار القرار ولم تُقيَّد على الوعاء.`
                : `Vessel hold at ${VESSEL_STAGE[lastVesselBlock(claim).stage]?.[0] || VESSEL_STAGE.vessel[0]} — ${lastVesselBlock(claim).reasonEn} ${lastVesselBlock(claim).byName || "—"} attempted it on ${formatDateTime(lastVesselBlock(claim).at, "en")}; the claim stayed awaiting a decision and nothing was booked.`}
            </p>
          ) : null}
          {claim.legacyStockSurface ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#8A6516", lineHeight: 1.6 }}>
              {ar
                ? "أُدخلت قبل بوابة المخزون — تبقى في الدفتر ولا تُحتسب مطالبة تشغيل جديدة. سجّل مثيلها في المخزون."
                : "Entered before the stock gate — kept on the ledger, not a new operating claim. Record its like on Inventory."}
            </p>
          ) : null}
          <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", borderTop: `1px solid ${BORDER}`, paddingTop: "12px" }}>
            <a href={claim.receiptUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: ACCENT, textDecoration: "none" }}>
              {isPdf(claim.receiptUrl)
                ? <span style={{ display: "flex", height: 48, width: 48, alignItems: "center", justifyContent: "center", borderRadius: "10px", border: `1px solid ${BORDER}`, background: SURFACE }}><FileText style={{ width: 20, height: 20 }} /></span>
                : <Image src={claim.receiptUrl} alt={ar ? "صورة الفاتورة" : "Invoice image"} className="h-12 w-12 rounded-lg border" fittingType="fill" style={{ border: `1px solid ${BORDER}`, borderRadius: "10px" }} />}
              <ExternalLink style={{ width: 16, height: 16 }} />
              {ar ? "عرض الإيصال" : "View receipt"}
            </a>
            {canManagerReview && claim.status === "submitted" && (
              <>
                <button type="button" onClick={() => onManagerReview(claim.id, "manager_approved")} style={{ ...ui.btnPrimary, marginInlineStart: "auto" }}>{ar ? "اعتماد" : "Approve"}</button>
                <button type="button" onClick={() => {
                  const reason = window.prompt(ar ? "اكتب سبب الرفض — يظهر على المطالبة." : "Write the rejection reason — it is shown on the claim.");
                  if (!String(reason || "").trim()) return;
                  onManagerReview(claim.id, "manager_rejected", String(reason).trim());
                }} style={ui.btnDanger}>{ar ? "رفض" : "Reject"}</button>
              </>
            )}
            {canFinanceReview && claim.status === "manager_approved" && (
              <>
                <button type="button" onClick={() => onFinanceReview(claim.id, "finance_approved")} style={{ ...ui.btnPrimary, marginInlineStart: "auto" }}>{ar ? "اعتماد المالية" : "Finance approve"}</button>
                <button type="button" onClick={() => {
                  const reason = window.prompt(ar ? "اكتب سبب الرفض — يظهر على المطالبة." : "Write the rejection reason — it is shown on the claim.");
                  if (!String(reason || "").trim()) return;
                  onFinanceReview(claim.id, "finance_rejected", String(reason).trim());
                }} style={ui.btnDanger}>{ar ? "رفض" : "Reject"}</button>
              </>
            )}
            {canCfoReview && claim.status === "cfo_pending" && (
              <>
                <button type="button" onClick={() => onCfoReview(claim.id, "cfo_approved")} style={{ ...ui.btnPrimary, marginInlineStart: "auto" }}>{ar ? "اعتماد المدير المالي" : "CFO approve"}</button>
                <button type="button" onClick={() => {
                  const reason = window.prompt(ar ? "اكتب سبب الرفض — يظهر على المطالبة." : "Write the rejection reason — it is shown on the claim.");
                  if (!String(reason || "").trim()) return;
                  onCfoReview(claim.id, "cfo_rejected", String(reason).trim());
                }} style={ui.btnDanger}>{ar ? "رفض" : "Reject"}</button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
