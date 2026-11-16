import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ownerChip, ownerField, ownerPrimaryBtn } from "@/components/owner/ownerUi";

// الحدّ المعلن على الحقل (max="3650" أي عشر سنوات) لم يكن يُفرض عند الإرسال: السمة
// تُفحص في تسليم نموذج، وهذا زرّ لا نموذج. فخطأ مطبعي (30000 بدل 3000) يمدّ الاشتراك
// ثمانين سنة بلا اعتراض. الحدّ واحد في الحقل وفي الزرّ.
const MAX_DAYS = 3650;
const validDays = (value) => {
  const days = Math.floor(Number(value));
  return Number.isFinite(days) && days >= 1 && days <= MAX_DAYS ? days : null;
};

export default function AddSubscriptionDaysDialog({ open, onOpenChange, ar, onConfirm }) {
  const [days, setDays] = useState(30);
  const clean = validDays(days);
  const submit = async () => {
    if (clean == null) return;
    await onConfirm(clean);
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
              max={MAX_DAYS}
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
            disabled={clean == null}
            style={{ ...ownerPrimaryBtn(), width: "100%", opacity: clean == null ? 0.4 : 1 }}
          >
            {ar ? "إضافة الأيام" : "Add days"}
          </button>
          {clean == null ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--nv-bad-ink, #DC2626)" }}>
              {ar ? `عدد الأيام بين 1 و${MAX_DAYS}.` : `Enter between 1 and ${MAX_DAYS} days.`}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
