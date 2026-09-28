import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DANGER, MUTED, textarea, ui } from "@/lib/platformStyles";

// Employee-facing dispute entry: a reason is mandatory before the dispute opens.
export default function DeductionDisputeForm({ ar, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...ui.btnDanger,
          marginTop: "8px",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 10px",
          fontSize: "11px",
        }}
      >
        <AlertTriangle style={{ width: 12, height: 12 }} /> {ar ? "اعتراض على الخصم" : "Dispute deduction"}
      </button>
    );
  }

  return (
    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={ar ? "سبب الاعتراض (إلزامي)" : "Reason for dispute (required)"}
        style={{ ...textarea, fontSize: "12px", resize: "none" }}
      />
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          disabled={note.trim().length < 5}
          onClick={() => onSubmit(note.trim())}
          style={{
            ...ui.btnDanger,
            background: "var(--nv-bad-fill)",
            color: "#fff",
            border: `1px solid ${DANGER}`,
            opacity: note.trim().length < 5 ? 0.5 : 1,
            cursor: note.trim().length < 5 ? "not-allowed" : "pointer",
          }}
        >
          {ar ? "إرسال الاعتراض" : "Submit dispute"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setNote(""); }}
          style={ui.btnGhost}
        >
          {ar ? "إلغاء" : "Cancel"}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: "11px", color: MUTED }}>{ar ? "خمسة أحرف على الأقل." : "At least five characters."}</p>
    </div>
  );
}
