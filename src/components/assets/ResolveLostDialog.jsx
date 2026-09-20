import React, { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";

/** Closes a lost-asset case with a documented decision (API: resolveLost). */
export default function ResolveLostDialog({ lang, onClose, onConfirm }) {
  const ar = lang === "ar";
  const [decision, setDecision] = useState("found");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onConfirm({ decision, reason: reason.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/45 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        dir={ar ? "rtl" : "ltr"}
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-elevated"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">
              {ar ? "إغلاق بلاغ الفقدان" : "Close lost case"}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{ar ? "القرار" : "Decision"}</span>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
          >
            <option value="found">{ar ? "عُثر عليه — يعاد للمتاح" : "Found — back to available"}</option>
            <option value="charged">{ar ? "تحميل / شطب — يُستبعد" : "Charged / write-off — retire"}</option>
          </select>
        </label>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          placeholder={ar ? "سبب القرار (إلزامي للتدقيق)" : "Decision reason (required for audit)"}
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
        />

        <p className="text-xs leading-relaxed text-muted-foreground">
          {ar
            ? "سبب فتح البلاغ محفوظ ولا يُستبدل — هذا سبب القرار وحده، ويظهر السطران معًا على بطاقة الأصل."
            : "The opening reason is kept and never replaced — this is the decision's own reason, and both lines show on the asset card."}
        </p>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm">
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={!reason.trim() || saving}
            className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {saving
              ? (ar ? "جارٍ الحفظ..." : "Saving...")
              : reason.trim()
                ? (ar ? "تأكيد الإغلاق" : "Confirm close")
                : (ar ? "اكتب سبب القرار." : "Write the decision reason.")}
          </button>
        </div>
      </form>
    </div>
  );
}
