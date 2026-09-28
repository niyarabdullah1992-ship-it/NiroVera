import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { NAVY, CARD } from "@/lib/platformStyles";

export default function OrgTreeFullscreenButton({ active, onToggle, ar, htmlLabel = false }) {
  if (htmlLabel) {
    return (
      <button
        type="button"
        onClick={() => onToggle(!active)}
        aria-pressed={active}
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 32,
          padding: "0 12px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          background: active ? "var(--nv-navy)" : "var(--nv-card)",
          color: active ? "#fff" : "var(--nv-ok-ink)",
          border: "1px solid var(--nv-ok-line)",
        }}
      >
        {active
          ? (ar ? "إغلاق الشاشة الكاملة" : "Close full screen")
          : (ar ? "شاشة كاملة" : "Full screen")}
      </button>
    );
  }

  const Icon = active ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      title={active ? (ar ? "خروج من ملء الشاشة" : "Exit full screen") : (ar ? "ملء الشاشة" : "Full screen")}
      aria-pressed={active}
      aria-label={active ? (ar ? "خروج من ملء الشاشة" : "Exit full screen") : (ar ? "ملء الشاشة" : "Full screen")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 34,
        padding: "0 10px",
        borderRadius: 9,
        border: `1px solid ${active ? "var(--nv-navy)" : "var(--nv-line)"}`,
        background: active ? "var(--nv-navy)" : CARD,
        color: active ? "#fff" : NAVY,
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      <Icon style={{ width: 14, height: 14 }} strokeWidth={1.8} />
      {active ? (ar ? "خروج" : "Exit") : (ar ? "ملء الشاشة" : "Full screen")}
    </button>
  );
}
