import React from "react";
import { ownerStatusChip } from "@/components/owner/ownerUi";

const tones = {
  paid: "ok",
  open: "warn",
  draft: "mute",
  void: "mute",
  uncollectible: "bad",
};
const arLabels = {
  paid: "مدفوعة",
  open: "مستحقة",
  draft: "مسودة",
  void: "ملغاة",
  uncollectible: "متعذرة التحصيل",
};

export default function InvoiceStatusBadge({ status, ar }) {
  const key = status || "draft";
  return (
    <span style={ownerStatusChip(tones[key] || "mute")}>
      {ar ? (arLabels[key] || status) : String(key).replaceAll("_", " ")}
    </span>
  );
}
