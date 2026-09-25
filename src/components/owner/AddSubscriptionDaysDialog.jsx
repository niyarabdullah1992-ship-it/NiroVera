import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ownerChip, ownerField, ownerPrimaryBtn } from "@/components/owner/ownerUi";

export default function AddSubscriptionDaysDialog({ open, onOpenChange, ar, onConfirm }) {
  const [days, setDays] = useState(30);
  const submit = async () => {
    await onConfirm(Number(days));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{ar ? "إضافة أيام للاشتراك" : "Add subscription days"}</DialogTitle>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--nv-muted)" }}>
            {ar ? "عدد الأيام" : "Number of days"}
            <input
              type="number"
              min="1"
              max="3650"
              value={days}
              onChange={(event) => setDays(event.target.value)}
              style={{ ...ownerField(), marginTop: 6 }}
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[7, 30, 90].map((value) => (
              <button key={value} type="button" onClick={() => setDays(value)} style={{ ...ownerChip(Number(days) === value), flex: 1, textAlign: "center" }}>
                +{value}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!Number(days) || Number(days) < 1}
            style={{ ...ownerPrimaryBtn(), width: "100%", opacity: !Number(days) || Number(days) < 1 ? 0.4 : 1 }}
          >
            {ar ? "إضافة الأيام" : "Add days"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
