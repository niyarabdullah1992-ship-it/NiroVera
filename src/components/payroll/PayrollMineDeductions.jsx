import React, { useState } from "react";
import { Check, Info } from "lucide-react";
import { gosiLine, lineComponents } from "@/lib/payrollDerivations";
import { registrationForPayroll } from "@/lib/facts";
import { deductionLines } from "@/lib/payrollDeductions";
import DeductionDisputeForm from "@/components/payroll/DeductionDisputeForm";
import { BORDER, CARD, MUTED, NAVY, ui } from "@/lib/platformStyles";

function sarBefore(n, minus) {
  const abs = Math.abs(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return minus ? `SAR ${abs} -` : `SAR ${abs}`;
}

function RoundCheck({ on, onClick, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        border: on ? "none" : "1.5px solid #C5CDC8",
        background: on ? "#3C7D50" : "#fff",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {on ? <Check size={12} strokeWidth={3} /> : null}
    </button>
  );
}

function faceOf(line, ar) {
  const ref = String(line.sourceRefId || "").trim();
  const held = line.disputeStatus === "open";
  if (line.source === "advance") {
    return {
      title: ar ? "قسط سلفة" : "Advance installment",
      sub: ref,
      reason: held
        ? (ar ? "معلّقة حتى البتّ في التظلّم · المادة 92" : "Held until the objection is decided · Art. 92")
        : (String(line.reason || "").trim() || (ar ? "طلب سلفة معتمد · المادة 92" : "Approved advance · Art. 92")),
    };
  }
  if (line.source === "discipline") {
    return {
      title: ar ? "جزاء" : "Sanction",
      sub: ref,
      reason: held
        ? (ar ? "معلّقة حتى البتّ في التظلّم · المادة 72" : "Held until the objection is decided · Art. 72")
        : (String(line.reason || "").trim() || (ar ? "لائحة الجزاءات" : "Penalty list")),
    };
  }
  if (line.source === "attendance") {
    return {
      title: ar ? "خصم غياب" : "Absence deduction",
      sub: ref,
      reason: String(line.reason || "").trim() || (ar ? "غياب معتمد من الحضور" : "Approved absence from attendance"),
    };
  }
  return {
    title: ar ? "خصم بسند" : "Documented deduction",
    sub: ref,
    reason: String(line.reason || "").trim() || (ar ? "سند مكتوب · المادة 92" : "Written instrument · Art. 92"),
  };
}

function statusOf(line, ar) {
  if (line.disputeStatus === "open") return { key: "held", label: ar ? "موقوفة" : "Held", dot: "#C8A45A", ink: "#8A5A12" };
  if (line.disputeStatus === "accepted") return { key: "gone", label: ar ? "أُلغي" : "Cancelled", dot: "#555C66", ink: "#555C66" };
  if (line.disputeStatus === "rejected") return { key: "refused", label: ar ? "رُفض الاعتراض" : "Objection refused", dot: "#9B2335", ink: "#9B2335" };
  return { key: "ok", label: ar ? "نظامي" : "Statutory", dot: "#3C7D50", ink: "#2F6B43" };
}

export function mineDeductionRows(item, ar, employee) {
  if (!item) return [];
  const parts = lineComponents(item);
  const rows = [];
  const registeredAt = registrationForPayroll(employee, item);
  const quote = gosiLine(item, {
    saudi: item.isSaudi === true,
    onDate: item.gosiAsOf || item.month,
    registeredAt,
  });
  if (Number(parts.gosiEmployee) > 0 || item.isSaudi === true || quote.blocked) {
    const className = quote.subscriberClass === "old"
      ? (ar ? "مشترك قديم" : "Old subscriber")
      : quote.subscriberClass === "new"
        ? (ar ? "مشترك جديد" : "New subscriber")
        : "";
    rows.push({
      id: "gosi",
      title: ar ? "خصم التأمينات — المعاشات والساند" : "GOSI — pension and SANED",
      sub: className || (ar ? "شهري" : "Monthly"),
      amount: quote.blocked ? 0 : parts.gosiEmployee,
      amountText: quote.blocked ? "—" : sarBefore(parts.gosiEmployee, true),
      blocked: quote.blocked,
      reason: quote.blocked
        ? (ar ? quote.reason : quote.reasonEn)
        : (ar
          ? `نظام التأمينات · الأجر الخاضع${className ? ` · ${className}` : ""}`
          : `GOSI · contributory wage${className ? ` · ${className}` : ""}`),
      status: { key: "ok", label: ar ? "نظامي" : "Statutory", dot: "#3C7D50", ink: "#2F6B43" },
      canDispute: false,
    });
  }
  for (const line of deductionLines(item)) {
    const face = faceOf(line, ar);
    const status = statusOf(line, ar);
    rows.push({
      id: line.id,
      title: face.title,
      sub: face.sub,
      amount: Number(line.amount) || 0,
      reason: face.reason,
      status,
      canDispute: !item.paid && (!line.disputeStatus || line.disputeStatus === "none"),
    });
  }
  return rows;
}

export default function PayrollMineDeductions({ ar, item, employee, onDispute, onExport }) {
  const [picked, setPicked] = useState(() => new Set());
  const rows = mineDeductionRows(item, ar, employee);
  const disputable = rows.filter((row) => row.canDispute);
  const allOn = disputable.length > 0 && disputable.every((row) => picked.has(row.id));
  const selected = rows.filter((row) => picked.has(row.id) && row.canDispute);

  const toggle = (id) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD }}>
        <p style={{ margin: 0, flex: 1, fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>
          {ar
            ? "لا يُخصم من أجرك إلا بسند مكتوب (المادة 92)، ولا يتجاوز مجموع الخصم نصف الأجر (المادة 93). لكل بند سببه، ولك الاعتراض عليه باسمك."
            : "Nothing is deducted without a written instrument (Art. 92), and the total may not pass half the wage (Art. 93). Each line names its reason, and you may object in your name."}
        </p>
        <Info size={16} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
      </div>

      {!item || rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
          {ar ? "لا خصم على راتبك هذا الشهر." : "No deduction is charged to your wage this month."}
        </p>
      ) : (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: CARD, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
              {ar ? `البند (${rows.length})` : `Lines (${rows.length})`}
            </span>
            <button type="button" onClick={() => onExport?.(rows)} style={{ ...ui.btnSecondary, height: 34, borderRadius: 8 }}>
              {ar ? "حفظ PDF" : "Save PDF"}
            </button>
          </div>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "#F4F7F5" }}>
                  <th style={{ width: 44, padding: "10px 12px", textAlign: "center" }}>
                    <RoundCheck
                      on={allOn}
                      onClick={() => setPicked(allOn ? new Set() : new Set(disputable.map((row) => row.id)))}
                      label={ar ? "تحديد البنود القابلة للاعتراض" : "Select objectionable lines"}
                    />
                  </th>
                  {(ar ? ["البند", "المبلغ", "السبب والسند", "الحالة"] : ["Line", "Amount", "Reason and instrument", "Status"]).map((head) => (
                    <th key={head} style={{ textAlign: "start", fontSize: 12, fontWeight: 650, color: MUTED, padding: "10px 14px" }}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const on = picked.has(row.id);
                  return (
                    <tr key={row.id} style={{ background: on ? "#E8F3EC" : "transparent" }}>
                      <td style={{ padding: "12px 12px", borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
                        {row.canDispute ? (
                          <RoundCheck on={on} onClick={() => toggle(row.id)} label={row.title} />
                        ) : (
                          <span aria-hidden style={{ display: "inline-block", width: 18, height: 18 }} />
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{row.title}</div>
                        {row.sub ? <div style={{ marginTop: 2, fontSize: 11.5, color: MUTED }}>{row.sub}</div> : null}
                      </td>
                      <td dir="ltr" style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: NAVY, textAlign: "end" }}>{row.amountText || sarBefore(row.amount)}</td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 12.5, color: MUTED }}>{row.reason}</td>
                      <td style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 12.5, fontWeight: 650, color: row.status.ink, whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {row.status.label}
                          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: row.status.dot }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, color: MUTED }}>
              {picked.size
                ? (ar ? "حدّد إجراء للسجلات المحددة من بطاقة الاعتراض" : "Use the objection card for the selected rows")
                : (ar ? "انقر المربع لتحديد السجلات" : "Click a box to select rows")}
            </span>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: MUTED }}>{`1–${rows.length} / ${rows.length}`}</span>
          </div>
        </div>
      )}

      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: NAVY }}>{ar ? "اعتراض على بند خصم" : "Object to a deduction"}</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.7 }}>
          {ar
            ? "يُسجّل باسمك ويصل الرواتب والموارد البشرية، ويُجمَّد البند حتى القرار."
            : "It is recorded in your name, reaches payroll and human resources, and the line stays held until the decision."}
        </p>
        {selected.length === 1 ? (
          <DeductionDisputeForm ar={ar} onSubmit={(note) => onDispute?.(selected[0].id, note)} />
        ) : selected.length > 1 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "#8A5A12" }}>{ar ? "اختر بنداً واحداً للاعتراض." : "Select one line to object."}</p>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: MUTED }}>{ar ? "حدّد بنداً قابلاً للاعتراض من الجدول." : "Select one objectionable line from the table."}</p>
        )}
      </section>
    </div>
  );
}
