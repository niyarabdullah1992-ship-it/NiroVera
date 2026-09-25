import React from "react";
import LaneRecordCard from "@/components/shared/LaneRecordCard";
import WorkProofRecordCard from "@/components/proof/WorkProofRecordCard";
import { INK, MUTED, emptyState } from "@/lib/platformStyles";

const TONE = {
  ok: "ok",
  warn: "warn",
  bad: "bad",
  info: "neutral",
  neutral: "neutral",
};

export function proofOwnerInitials(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function ProofRow({ row, ar, heads, onOpen, renderActions, variant }) {
  if (variant === "work") {
    return (
      <WorkProofRecordCard
        row={row}
        ar={ar}
        onOpen={onOpen}
        actions={typeof renderActions === "function" ? renderActions(row) : null}
      />
    );
  }
  const target = Math.max(1, Number(row.progress?.target) || 1);
  const done = Math.max(0, Number(row.progress?.done) || 0);
  const pct = Math.min(100, Math.round((done / target) * 100));
  const labels = heads || [];
  const dueTone = row.dueTone === "late" || row.dueTone === "bad"
    ? "bad"
    : (row.dueTone === "today" || row.dueTone === "warn" ? "warn" : undefined);

  return (
    <LaneRecordCard
      title={row.title}
      refId={row.ref || "—"}
      meta={Array.isArray(row.meta) ? row.meta : []}
      statusLabel={row.statusLabel}
      tone={TONE[row.statusKind] || "neutral"}
      mark={proofOwnerInitials(row.owner)}
      facts={[
        { label: labels[1] || (ar ? "الفرع" : "Station"), value: row.station },
        { label: labels[2] || (ar ? "المسؤول" : "Owner"), value: row.owner },
        { label: ar ? "المدة" : "Time", value: row.due, tone: dueTone },
      ]}
      note={row.ownerChip}
      progress={{
        label: labels[4] || (ar ? "الإنجاز" : "Progress"),
        count: `${done}/${target}`,
        pct,
        extra: row.progress?.extra,
      }}
      onOpen={() => onOpen?.(row)}
      actions={typeof renderActions === "function" ? renderActions(row) : null}
    />
  );
}

export default function ProofRecordsTable({
  ar = true,
  loading = false,
  emptyLabel,
  heads,
  rows = [],
  onOpen,
  renderActions,
  variant,
}) {
  if (loading) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.9 }}>
        {ar ? "جاري التحميل…" : "Loading…"}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.9, color: MUTED }}>
        <div style={{ fontWeight: 600, color: INK }}>
          {emptyLabel || (ar ? "لا إثباتات مطابقة." : "No matching proofs.")}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((row) => (
        <ProofRow
          key={row.id}
          row={row}
          ar={ar}
          heads={heads}
          onOpen={onOpen}
          renderActions={renderActions}
          variant={variant}
        />
      ))}
    </div>
  );
}
