import React, { useState } from "react";
import { X, Undo2 } from "lucide-react";
import { INK, MUTED, BORDER, SURFACE, dialogOverlay, dialogCard, field, labelMuted, ui } from "@/lib/platformStyles";

const Row = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
    <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
    <span style={{ fontSize: 13, color: INK, textAlign: "end" }}>{value || "—"}</span>
  </div>
);

/**
 * Reversing a stock movement is a correction, not an erasure: the dialog says so
 * before the click, and the reason it collects is what gets written on the new
 * compensating movement.
 */
export default function ReverseMovementDialog({ ar, movement, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const ready = reason.trim().length > 0 && !busy;

  const submit = (event) => {
    event.preventDefault();
    if (!ready) return;
    onConfirm(reason.trim());
  };

  return (
    <div style={dialogOverlay} onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        dir={ar ? "rtl" : "ltr"}
        style={{ ...dialogCard, maxWidth: 520, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: INK, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Undo2 size={16} /> {ar ? "عكس حركة مخزون" : "Reverse a stock movement"}
          </h3>
          <button type="button" onClick={onClose} style={{ ...ui.btnGhost, padding: 6 }} aria-label={ar ? "إغلاق" : "Close"}>
            <X size={16} />
          </button>
        </div>

        <div>
          <Row label={ar ? "الحركة" : "Movement"} value={movement.label} />
          <Row label={ar ? "الصنف" : "Item"} value={movement.itemName} />
          <Row label={ar ? "الكمية" : "Quantity"} value={movement.quantity} />
          <Row label={ar ? "الاتجاه" : "Direction"} value={movement.direction} />
        </div>

        <p style={{ margin: 0, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, fontSize: 12, color: INK, lineHeight: 1.9 }}>
          {ar
            ? "العكس لا يمحو الحركة الأصلية: تبقى في الدفتر برقمها موسومةً «عُكست»، وتُقيَّد حركة معاكسة جديدة برقم خاص بها. الرصيد يرجع إلى ما كان عليه قبل الحركة، والسبب الذي تكتبه يُقيَّد على الحركة المعاكسة."
            : "A reversal does not erase the original: it stays on the ledger under its own number, marked as reversed, and a new compensating movement is booked with a number of its own. The balance returns to what it was, and the reason you write is recorded on the compensating movement."}
        </p>

        <div>
          <label style={labelMuted}>{ar ? "سبب العكس (إلزامي للتدقيق)" : "Reversal reason (required for audit)"}</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={3}
            placeholder={ar ? "سبب العكس — يظهر في الدفتر" : "Reversal reason — shown on the ledger"}
            style={{ ...field, height: "auto", padding: 10, lineHeight: 1.7 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={ui.btnSecondary}>{ar ? "إلغاء" : "Cancel"}</button>
          <button type="submit" disabled={!ready} style={{ ...ui.btnDanger, opacity: ready ? 1 : 0.45 }}>
            {ready
              ? (ar ? "تأكيد العكس" : "Confirm reversal")
              : (ar ? "اكتب سبب العكس." : "Write the reversal reason.")}
          </button>
        </div>
      </form>
    </div>
  );
}
