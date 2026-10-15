import React, { useEffect } from "react";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, PAPER_SHADOW, RADIUS, SURFACE } from "@/lib/platformStyles";
import { managerEmployeeRegister } from "@/lib/requestWorkspace";

/**
 * إدارة due-inbox. Header scope is standing only.
 * A branch appears when it has pending work; only those people open.
 */
// Same dark-green slab as «رصيد إجازاتي» on the employee face.
const DK = {
  bg: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)",
  ink: "#fff",
  soft: "#C5DBCD",
  faint: "#A9CDB8",
  line: "rgba(255,255,255,.12)",
  on: "rgba(255,255,255,.08)",
  gold: "#C8A45A",
};

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
        background: DK.bg,
        color: DK.ink,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${DK.line}`, display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="nv-req-title" style={{ fontSize: 14, color: DK.ink }}>{ar ? "بانتظار القرار" : "Awaiting a decision"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: DK.ink, lineHeight: 1.6 }}>{rail.standing}</span>
        <span style={{ fontSize: 11, color: DK.soft, lineHeight: 1.75 }}>{rail.note}</span>
        {rail.others ? (
          <span style={{ fontSize: 11, color: DK.soft, lineHeight: 1.65 }}>{rail.others}</span>
        ) : null}
        <span style={{ fontSize: 11, color: DK.soft }}>
          {board.pendingPeople
            ? (ar ? `${board.pendingPeople} لهم طلب معلّق` : `${board.pendingPeople} with a pending request`)
            : (ar ? "لا طلب معلّق في الفروع التي تديرها" : "No pending request in the branches you manage")}
        </span>
      </div>
      {board.empty ? (
        <div style={{ padding: "16px 18px", fontSize: 12, color: DK.soft, lineHeight: 1.8 }}>
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
                background: groupOn ? DK.on : "transparent",
                border: "none",
                borderBottom: `1px solid ${DK.line}`,
                cursor: "pointer",
                fontFamily: "inherit",
                color: DK.ink,
              }}
            >
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: DK.ink }}>{group.stationName}</span>
                {groupOn ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: DK.soft }}>{ar ? "وقوف" : "Standing"}</span>
                ) : null}
              </span>
              <span style={{ fontSize: 11, color: DK.soft, lineHeight: 1.55 }}>{group.alert}</span>
            </button>
            {group.rows.map((row) => {
              const on = String(row.id) === String(selectedId);
              return (
                <div
                  key={row.id}
                  style={{
                    borderBottom: `1px solid ${DK.line}`,
                    background: on ? DK.on : "transparent",
                    borderInlineStart: on ? `3px solid ${DK.gold}` : "3px solid transparent",
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
                      color: DK.ink,
                    }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{row.name}</span>
                      {row.pendingCount ? (
                        <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", height: 18, padding: "0 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: DK.gold, color: "#0B3D27" }}>
                          {row.pendingCount}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ fontSize: 11, color: DK.soft, lineHeight: 1.6 }}>{row.statusLine}</span>
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
                          color: DK.gold,
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
