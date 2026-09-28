import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import StationExpenseScope from "@/components/expenses/StationExpenseScope";
import ExpenseReceiptUploader from "@/components/expenses/ExpenseReceiptUploader";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { ACCENT, MUTED, NAVY, BORDER, SURFACE, BRAND_SOFT, BRAND_BORDER, field, ui, CARD, PAPER_SHADOW, RADIUS, CONTROL_RADIUS } from "@/lib/platformStyles";
import { approvalStepsForAmount, checkOperatingClaimSurfaceGate } from "@/lib/expenseDerivations";

const TYPES = ["svc", "rent", "travel", "accommodation", "fuel", "overtime_meals", "tools_equipment", "training"];
const LABELS = {
  svc: ["Services & repair", "خدمات وإصلاح"],
  rent: ["Equipment hire", "تأجير معدات"],
  travel: ["Travel", "سفر"],
  accommodation: ["Accommodation", "سكن"],
  fuel: ["Fuel", "وقود"],
  overtime_meals: ["Overtime Meals", "وجبات العمل الإضافي"],
  tools_equipment: ["Tools & Equipment", "أدوات ومعدات"],
  training: ["Training", "تدريب"],
};
const COST_CENTERS = [
  ["ops", "تشغيل", "Operations"],
  ["maint", "صيانة", "Maintenance"],
  ["hse", "سلامة", "Safety"],
  ["admin", "إدارة", "Admin"],
  ["cx", "عملاء", "Customers"],
];

const labelStyle = { display: "block", fontSize: "11px", color: MUTED };
const inputWrap = { marginTop: "6px", ...field, height: "auto", minHeight: "36px", padding: "8px 12px" };

export default function ExpenseForm({ stations, canPickStations, onSubmit, ar, headerStationId }) {
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("");
  const [scope, setScope] = useState(headerStationId ? "selected" : "all");
  const [selected, setSelected] = useState(headerStationId ? [headerStationId] : []);
  const [beforeTax, setBeforeTax] = useState("");
  const [tax, setTax] = useState("");
  const [quantity, setQuantity] = useState("");
  const [receipt, setReceipt] = useState({ url: "", name: "" });
  const [description, setDescription] = useState("");
  const [costCenter, setCostCenter] = useState("ops");
  const [expenseDate, setExpenseDate] = useState("");
  const count = canPickStations ? (scope === "all" ? stations.length : selected.length) : 1;
  const afterTax = Number(beforeTax || 0) + Number(tax || 0);
  const total = afterTax * count;
  useEffect(() => {
    if (!headerStationId) return;
    setSelected((prev) => (prev.includes(headerStationId) ? prev : [headerStationId, ...prev]));
  }, [headerStationId]);
  const stocky = checkOperatingClaimSurfaceGate(`${description} ${type}`);
  const steps = approvalStepsForAmount(total).map((step) => ({
    mgr: ar ? "مدير الفرع" : "Station manager",
    fin: ar ? "المالية" : "Finance",
    cfo: ar ? "المدير المالي" : "CFO",
  }[step])).join(" ← ");
  const blocked = (canPickStations && !count) || !receipt.url || afterTax <= 0 || !stocky.ok || !expenseDate;
  const blockLabel = !stocky.ok
    ? (ar ? stocky.reason : stocky.reasonEn)
    : !receipt.url
      ? (ar ? "أرفق الإيصال أولاً" : "Attach the receipt first")
      : afterTax <= 0
        ? (ar ? "اكتب قيمة الفاتورة" : "Enter the invoice amount")
        : !expenseDate
          ? (ar ? "حدد تاريخ الفاتورة" : "Set the invoice date")
        : (ar ? "اختر الفرع" : "Choose a station");

  const submit = async (event) => {
    event.preventDefault();
    if (blocked) return;
    setSaving(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const matchedType = TYPES.find((item) => LABELS[item][ar ? 1 : 0].toLowerCase() === type.trim().toLowerCase());
    const cloudTypes = ["travel", "accommodation", "fuel", "overtime_meals", "tools_equipment", "training", "other"];
    const expenseType = cloudTypes.includes(matchedType) ? matchedType : "other";
    const customExpenseType = expenseType === "other" ? (matchedType ? LABELS[matchedType][ar ? 1 : 0] : type.trim()) : "";
    const ok = await onSubmit({
      costCenter,
      expenseType,
      customExpenseType,
      beforeTaxAmount: Number(beforeTax),
      taxAmount: Number(tax || 0),
      afterTaxAmount: afterTax,
      quantity: quantity === "" ? null : Number(quantity),
      invoiceNumber: String(data.get("invoiceNumber") || "").trim(),
      amount: afterTax,
      expenseDate: expenseDate || data.get("expenseDate"),
      description: description || data.get("description"),
      receiptUrl: receipt.url,
      stationScope: canPickStations ? scope : "single",
      stationIds: scope === "selected" ? selected : [],
    });
    if (ok) {
      form.reset();
      setType("");
      setSelected([]);
      setBeforeTax("");
      setTax("");
      setQuantity("");
      setReceipt({ url: "", name: "" });
      setDescription("");
      setCostCenter("ops");
      setExpenseDate("");
    }
    setSaving(false);
  };

  return (
    <form
      className="nv-exp-form"
      onSubmit={submit}
      style={{
        display: "grid",
        gap: "12px",
        borderRadius: RADIUS,
        boxShadow: PAPER_SHADOW,
        border: `1px solid ${BORDER}`,
        background: CARD,
        padding: "18px 20px",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      }}
    >
      <label style={labelStyle}>
        {ar ? "نوع المصروف" : "Expense type"}
        <input list="expense-types" required value={type} onChange={(event) => setType(event.target.value)} placeholder={ar ? "خدمات وإصلاح · تأجير · سفر" : "Services, hire, travel…"} style={inputWrap} />
        <datalist id="expense-types">{TYPES.map((item) => <option key={item} value={LABELS[item][ar ? 1 : 0]} />)}</datalist>
      </label>
      <label style={labelStyle}>
        {ar ? "مركز التكلفة" : "Cost centre"}
        <select value={costCenter} onChange={(event) => setCostCenter(event.target.value)} style={inputWrap}>
          {COST_CENTERS.map(([id, arLabel, enLabel]) => (
            <option key={id} value={id}>{ar ? arLabel : enLabel}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>
        {ar ? "الفاتورة قبل الضريبة" : "Invoice before tax"}
        <input value={beforeTax} onChange={(event) => setBeforeTax(event.target.value)} type="number" min="0" step="0.01" required placeholder="0.00" style={inputWrap} />
      </label>
      <label style={labelStyle}>
        {ar ? "قيمة الضريبة" : "Tax amount"}
        <input value={tax} onChange={(event) => setTax(event.target.value)} type="number" min="0" step="0.01" required placeholder="0.00" style={inputWrap} />
      </label>
      <label style={labelStyle}>
        {ar ? "الفاتورة بعد الضريبة" : "Invoice after tax"}
        <input value={afterTax || ""} readOnly style={{ ...inputWrap, background: SURFACE, fontWeight: 600, color: NAVY }} />
      </label>
      <label style={labelStyle}>
        {ar ? "تاريخ الفاتورة" : "Invoice date"}
        <div style={{ marginTop: 6 }}>
          <PlatformDateField name="expenseDate" required value={expenseDate} onChange={setExpenseDate} ar={ar} />
        </div>
      </label>
      <label style={labelStyle}>
        {ar ? "رقم الفاتورة" : "Invoice number"}
        <input name="invoiceNumber" placeholder={ar ? "اختياري" : "Optional"} style={inputWrap} />
      </label>
      <label style={labelStyle}>
        {ar ? "الكمية (إن وجدت)" : "Quantity (if any)"}
        <input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0.01" step="0.01" placeholder={ar ? "اختياري" : "Optional"} style={inputWrap} />
      </label>
      <ExpenseReceiptUploader value={receipt.url} fileName={receipt.name} onChange={(url, name) => setReceipt({ url, name })} ar={ar} />
      <div style={{ gridColumn: "1 / -1" }}>
        <StationExpenseScope stations={stations} scope={scope} setScope={setScope} selected={selected} setSelected={setSelected} canPick={canPickStations} ar={ar} />
      </div>
      <div style={{
        gridColumn: "1 / -1",
        borderRadius: CONTROL_RADIUS,
        border: `1px solid ${BRAND_BORDER}`,
        background: BRAND_SOFT,
        padding: "11px 13px",
        fontSize: "13px",
        color: ACCENT,
        fontWeight: 500,
      }}>
        {ar ? `الإجمالي بعد الضريبة: ${afterTax.toLocaleString()} × ${count} فرع = ${total.toLocaleString()} ر.س · مسار: ${steps}` : `After-tax total: ${afterTax.toLocaleString()} × ${count} stations = ${total.toLocaleString()} SAR · path: ${steps}`}
      </div>
      {!stocky.ok && (
        <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.7 }}>
          {ar ? stocky.reason : stocky.reasonEn}
          {" "}
          {ar ? "افتح المخزون › شراء الفرع." : "Open Inventory › station purchase."}
        </div>
      )}
      <input
        name="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={ar ? "وصف مختصر — إصلاح مضخة عند ورشة خارجية" : "Short description — external pump repair"}
        style={{ ...inputWrap, gridColumn: "1 / -2", minWidth: 0 }}
      />
      <button
        disabled={saving || blocked}
        style={{
          ...ui.btnPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          height: "40px",
          opacity: saving || blocked ? 0.5 : 1,
          cursor: saving || blocked ? "not-allowed" : "pointer",
        }}
      >
        {saving && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
        {blocked ? blockLabel : (ar ? "أرسل المطالبة" : "Send claim")}
      </button>
    </form>
  );
}
