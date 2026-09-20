import React, { useState } from "react";
import { ACCENT, INK, MUTED, emptyState, tableHeadRow, tableShell } from "@/lib/platformStyles";

/** Same row language as the operations task list: identity, station, owner, status, progress. Period lives on the card. */
const GRID_COLS = "minmax(260px,2.4fr) 112px 168px 112px 128px";

function pill(bg, fg, bd) {
  return {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 500,
    background: bg,
    color: fg,
    border: `1px solid ${bd}`,
    whiteSpace: "nowrap",
  };
}

const STATUS_PILL = {
  ok: pill("#ECFDF3", "#15803D", "#BBF7D0"),
  warn: pill("#FFFBEB", "#B45309", "#FDE68A"),
  info: pill("#EFF6FF", "#1D4ED8", "#BFDBFE"),
  bad: pill("#FEF2F2", "#DC2626", "#FECACA"),
  neutral: pill("#F7F8FA", "#5A6B85", "#E2E8F0"),
};

function dotStyle(color) {
  return {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
    marginTop: "5px",
  };
}

function metaSep() {
  return (
    <span aria-hidden style={{ color: "#CBD5E1", fontSize: "10px", userSelect: "none" }}>·</span>
  );
}

function metaText(children, opts = {}) {
  return (
    <span
      dir={opts.ltr ? "ltr" : undefined}
      style={{
        fontSize: "11px",
        color: opts.strong ? INK : MUTED,
        fontWeight: opts.strong ? 600 : 500,
        fontFamily: opts.mono ? "'IBM Plex Mono',monospace" : "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function proofOwnerInitials(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function IdentityStack({ row }) {
  const owner = row.owner || "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, paddingTop: "1px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
        <span
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            background: "#F1F5F9",
            border: "1px solid #E2E8F0",
            fontSize: "9px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: MUTED,
            flexShrink: 0,
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          {proofOwnerInitials(owner)}
        </span>
        <span
          style={{
            fontSize: "12px",
            color: MUTED,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {owner}
        </span>
      </div>
      {row.ownerChip ? (
        <span
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "2px 8px",
            borderRadius: 8,
            // Only a recorded breach reaches this chip, so it carries the platform's red,
            // not a softer amber the row would read as a passing warning.
            border: "1px solid #f0d0d4",
            background: "#fdf2f2",
            color: "#8a1c2b",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1.4,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.ownerChip}
        </span>
      ) : null}
    </div>
  );
}

function ProofRow({ row, onOpen, renderActions }) {
  const [hover, setHover] = useState(false);
  const status = STATUS_PILL[row.statusKind] || STATUS_PILL.neutral;
  const target = Math.max(1, Number(row.progress?.target) || 1);
  const done = Math.max(0, Number(row.progress?.done) || 0);
  const pct = Math.min(100, Math.round((done / target) * 100));
  const barColor = pct >= 100 ? ACCENT : pct === 0 ? "#CBD5E1" : row.statusKind === "bad" ? "#DC2626" : ACCENT;
  const meta = Array.isArray(row.meta) ? row.meta.filter(Boolean) : [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(row)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(row);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLS,
        gap: "12px",
        padding: "14px 18px",
        borderBottom: "1px solid #F1F5F9",
        alignItems: "start",
        cursor: onOpen ? "pointer" : "default",
        background: hover ? "#F7F8FA" : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0 }}>
        <span style={dotStyle(row.dotColor || "#F59E0B")} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: INK,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "-0.01em",
            }}
          >
            {row.title || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px", flexWrap: "wrap", minWidth: 0 }}>
            {metaText(row.ref || "—", { mono: true, ltr: true })}
            {meta.map((item) => (
              <React.Fragment key={item}>
                {metaSep()}
                {metaText(item, { strong: item === meta[0] })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: MUTED,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingTop: "2px",
        }}
      >
        {row.station || "—"}
      </div>

      <IdentityStack row={row} />

      <div style={{ paddingTop: "1px" }}>
        <span style={status}>{row.statusLabel || "—"}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
          <span
            dir="ltr"
            style={{
              fontSize: "12px",
              fontWeight: 650,
              color: INK,
              fontFamily: "'IBM Plex Sans',sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {`${done}/${target}`}
          </span>
          <span
            dir="ltr"
            style={{
              fontSize: "10px",
              color: MUTED,
              fontFamily: "'IBM Plex Sans',sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {`${pct}%`}
          </span>
        </div>
        <span style={{ display: "block", height: "4px", borderRadius: "4px", background: "#F1F5F9", overflow: "hidden" }}>
          <span style={{ display: "block", width: `${pct === 0 ? 2 : pct}%`, height: "100%", background: barColor, borderRadius: "4px" }} />
        </span>
        {row.progress?.extra ? (
          <span style={{ fontSize: "10px", color: MUTED, fontWeight: 600 }}>{row.progress.extra}</span>
        ) : null}
      </div>

      {typeof renderActions === "function" ? (
        <div style={{ gridColumn: "1 / -1" }} onClick={(event) => event.stopPropagation()}>
          {renderActions(row)}
        </div>
      ) : null}
    </div>
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
}) {
  const labels = heads || (ar
    ? ["الإثبات", "الفرع", "المسؤول", "الحالة", "الإنجاز"]
    : ["PROOF", "STATION", "OWNER", "STATUS", "PROGRESS"]);

  if (loading) {
    return (
      <div style={tableShell}>
        <div style={{ padding: "24px 18px", fontSize: "13px", color: MUTED }}>
          {ar ? "جاري التحميل…" : "Loading…"}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.9 }}>
        {emptyLabel || (ar ? "لا إثباتات مطابقة." : "No matching proofs.")}
      </div>
    );
  }

  return (
    <div style={tableShell}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "780px" }}>
          <div
            style={{
              ...tableHeadRow,
              gridTemplateColumns: GRID_COLS,
              gap: "12px",
            }}
          >
            {labels.map((label) => (
              <div key={label} style={label === labels[labels.length - 1] ? { textAlign: "end" } : undefined}>
                {label}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <ProofRow
              key={row.id}
              row={row}
              onOpen={onOpen}
              renderActions={renderActions}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
