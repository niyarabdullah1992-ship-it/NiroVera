import React from "react";
import LaneRecordCard from "@/components/shared/LaneRecordCard";

function markOf(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "·";
}

function PhotoSlot({ filled, label, caption }) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        minHeight: 72,
        borderRadius: 10,
        border: filled ? "1px solid var(--nv-accent-border)" : "1px dashed var(--nv-line)",
        background: filled ? "var(--nv-accent-soft)" : "var(--nv-soft)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        minWidth: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: filled ? "var(--nv-btn-fill)" : "#EEF1EF",
          color: filled ? "#fff" : "#8E9A93",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {filled ? "✓" : "·"}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <strong style={{ fontSize: 12.5, color: filled ? "var(--nv-ink)" : "var(--nv-ink2)" }}>{label}</strong>
        <span style={{ fontSize: 11, color: filled ? "var(--nv-ok-ink)" : "#8E9A93", fontWeight: 600 }}>{caption}</span>
      </span>
    </div>
  );
}

/** Outside-party proof on the same card as a work order, with the before/after pair. */
export default function WorkProofRecordCard({ row, ar, onOpen, actions }) {
  const workers = Array.isArray(row.workers) ? row.workers.filter(Boolean) : [];
  const individual = row.scopeKind === "person";

  return (
    <LaneRecordCard
      title={row.title}
      refId={row.ref}
      meta={row.meta}
      statusLabel={row.statusLabel}
      tone={row.statusKind}
      mark={markOf(row.owner)}
      markGold={individual}
      facts={[
        { label: ar ? "الفرع" : "Station", value: row.station },
        { label: individual ? (ar ? "المؤسسة" : "Firm") : (ar ? "الجهة" : "Company"), value: row.owner },
        { label: ar ? "البداية" : "Started", value: row.due },
      ]}
      note={row.ownerChip}
      onOpen={() => onOpen?.(row)}
      actions={actions}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <PhotoSlot
          filled={!!row.before}
          label={ar ? "قبل" : "Before"}
          caption={row.before ? (ar ? "الصورة مرفوعة" : "Photo attached") : (ar ? "بانتظار الصورة" : "Photo still due")}
        />
        <PhotoSlot
          filled={!!row.after}
          label={ar ? "بعد" : "After"}
          caption={row.after ? (ar ? "الصورة مرفوعة" : "Photo attached") : (ar ? "تُرفق عند الإنهاء" : "Attached when the work ends")}
        />
      </div>
      {workers.length || row.creator ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {workers.length ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-muted)" }}>
              {ar ? `عمال الجهة · ${workers.length}` : `Crew · ${workers.length}`}
            </span>
          ) : null}
          {workers.slice(0, 3).map((name) => (
            <span key={name} style={{ fontSize: 11, fontWeight: 600, color: "var(--nv-ink)", background: "var(--nv-accent-soft)", borderRadius: 999, padding: "2px 8px" }}>
              {name}
            </span>
          ))}
          {row.creator ? (
            <span style={{ fontSize: 11, color: "#8E9A93", fontWeight: 600 }}>
              {ar ? `رفعها ${row.creator}` : `Raised by ${row.creator}`}
            </span>
          ) : null}
        </div>
      ) : null}
    </LaneRecordCard>
  );
}
