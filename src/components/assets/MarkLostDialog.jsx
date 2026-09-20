import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

// Replaces the native prompt() when opening a loss report for an asset.
export default function MarkLostDialog({ lang, onClose, onConfirm }) {
  const ar = lang === "ar";
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onConfirm(reason.trim());
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/45 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} dir={ar ? "rtl" : "ltr"} className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-heading text-lg font-semibold">{ar ? "فتح بلاغ فقدان" : "Open a loss report"}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={4}
          placeholder={ar ? "سبب فتح بلاغ الفقدان" : "Reason for the loss report"}
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button type="submit" disabled={!reason.trim() || saving} className="flex-1 rounded-md bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-40">
            {saving
              ? (ar ? "جارٍ الحفظ..." : "Saving...")
              : reason.trim()
                ? (ar ? "تأكيد البلاغ" : "Confirm report")
                : (ar ? "اكتب سبب البلاغ." : "Write the report reason.")}
          </button>
        </div>
      </form>
    </div>
  );
}