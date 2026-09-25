import React, { useEffect } from "react";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, PAPER_SHADOW, RADIUS, SURFACE } from "@/lib/platformStyles";
import { managerEmployeeRegister } from "@/lib/requestWorkspace";

/**
 * إدارة due-inbox. Header scope is standing only.
 * A branch appears when it has pending work; only those people open.
 */
export default function ManagerEmployeeRegister({
  employees = [],
  stations = [],
  lang = "ar",
  selectedId,
  onSelect,
  onRecord,
  onHideRecord,
  focusStationId = "",
  recording = false,
  companyId,
  onFocusStation,
}) {
  const ar = lang === "ar";
  const board = managerEmployeeRegister(employees, lang, { stations, companyId, focusStationId });
  const rail = board.rail;
  const standingId = String(rail.focusStationId || "");

  useEffect(() => {
    if (!standingId) return;
    const node = document.getElementById(`nv-req-station-${standingId}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [standingId]);

  return (
    <section
      className="nv-req-people"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderInlineStart: `2px solid ${NAVY_FILL}`,
        borderRadius: RADIUS,
        boxShadow: PAPER_SHADOW,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="nv-req-title" style={{ fontSize: 14, color: NAVY }}>{ar ? "بانتظار القرار" : "Awaiting a decision"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, lineHeight: 1.6 }}>{rail.standing}</span>
        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.75 }}>{rail.note}</span>
        {rail.others ? (
          <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.65 }}>{rail.others}</span>
        ) : null}
        <span style={{ fontSize: 11, color: MUTED }}>
          {board.pendingPeople
            ? (ar ? `${board.pendingPeople} لهم طلب معلّق` : `${board.pendingPeople} with a pending request`)
            : (ar ? "لا طلب معلّق في الفروع التي تديرها" : "No pending request in the branches you manage")}
        </span>
      </div>
      {board.empty ? (
        <div style={{ padding: "16px 18px", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
          {ar ? "لا تنبيه الآن. من بلا طلب لا يُفتح هنا." : "No alert now. People without a request do not open here."}
        </div>
      ) : board.groups.map((group) => {
        const groupOn = standingId && String(group.stationId) === standingId;
        return (
          <div key={group.stationId || group.stationName} id={`nv-req-station-${group.stationId || "none"}`}>
            <button
              type="button"
              data-branch-alert="1"
              onClick={() => onFocusStation?.(groupOn ? "" : group.stationId)}
              style={{
                padding: "10px 18px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "100%",
                textAlign: "start",
                background: groupOn ? SURFACE : CARD,
                border: "none",
                borderBottom: "1px solid var(--nv-line3)",
                cursor: "pointer",
                fontFamily: "inherit",
                color: NAVY,
              }}
            >
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{group.stationName}</span>
                {groupOn ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: MUTED }}>{ar ? "وقوف" : "Standing"}</span>
                ) : null}
              </span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.55 }}>{group.alert}</span>
            </button>
            {group.rows.map((row) => {
              const on = String(row.id) === String(selectedId);
              return (
                <div
                  key={row.id}
                  style={{
                    borderBottom: "1px solid var(--nv-line2)",
                    background: on ? SURFACE : CARD,
                    borderInlineStart: on ? `2px solid ${NAVY}` : "2px solid transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect?.(row.id)}
                    aria-current={on ? "true" : undefined}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      width: "100%",
                      textAlign: "start",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: NAVY,
                    }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{row.name}</span>
                      {row.pendingCount ? (
                        <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", height: 18, padding: "0 7px", borderRadius: 999, font: "600 10.5px var(--font-mono), monospace", background: "var(--nv-warn-soft)", color: "var(--nv-warn-ink)" }}>
                          {row.pendingCount}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{row.statusLine}</span>
                  </button>
                  {on ? (
                    <div style={{ padding: "0 18px 10px" }}>
                      <button
                        type="button"
                        onClick={() => (recording ? onHideRecord?.() : onRecord?.(row.id))}
                        style={{
                          fontFamily: "inherit",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          color: NAVY,
                          cursor: "pointer",
                          textDecoration: "underline",
                          textUnderlineOffset: 3,
                        }}
                      >
                        {recording
                          ? (ar ? "أخفِ فعل الإدارة" : "Hide the management act")
                          : (ar ? "تكليف أو رصيد أو طلب من الإدارة" : "Assignment, credit, or other from management")}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
