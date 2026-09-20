import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import useStationSwitcher, { openStationSwitcher } from "@/hooks/useStationSwitcher";
import { READINESS_COLOR } from "@/lib/stationReadiness";

const stepBtn = {
  width: "26px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: "var(--nv-muted, #5A6B85)",
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
  borderRadius: 0,
};

/** Header station scope — one 10px picker for the live operational range. */
export default function StationScopeControl() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const { stations, scope, scopedStation, readiness, previous, next, canSwitch } = useStationSwitcher();
  const rtl = dir === "rtl";

  const current = scopedStation ? readiness.get(String(scopedStation.id)) : null;
  const label = scopedStation
    ? `${scopedStation.name}${scopedStation.code || scopedStation.shortCode ? ` · ${scopedStation.code || scopedStation.shortCode}` : ""}`
    : scope !== "all"
      ? String(scope)
      : (ar ? `كل الفروع · ${stations.length}` : `All stations · ${stations.length}`);

  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className="nv-station-scope"
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--nv-line, #E2E8F0)",
        background: "var(--nv-soft, #F7F8FA)",
      }}
    >
      {canSwitch && (
        <button
          type="button"
          onClick={previous}
          aria-label={ar ? "الفرع السابق" : "Previous station"}
          title={ar ? "الفرع السابق · Ctrl+Shift+↑" : "Previous station · Ctrl+Shift+↑"}
          style={stepBtn}
        >
          <Prev style={{ width: 13, height: 13 }} />
        </button>
      )}
      <button
        type="button"
        onClick={openStationSwitcher}
        title={ar ? "تبديل سريع للفرع · Ctrl+Shift+K" : "Station quick switch · Ctrl+Shift+K"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          height: "34px",
          padding: "0 12px",
          borderRadius: 0,
          border: "none",
          borderInlineStart: canSwitch ? "1px solid var(--nv-line, #E2E8F0)" : "none",
          borderInlineEnd: canSwitch ? "1px solid var(--nv-line, #E2E8F0)" : "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {current && (
          <span
            aria-hidden
            style={{ width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0, background: READINESS_COLOR[current.level] }}
          />
        )}
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, textAlign: "start", minWidth: 0 }}>
          <span style={{ fontSize: "8px", color: "var(--nv-muted, #5A6B85)", letterSpacing: "0.1em" }}>
            {ar ? "النطاق" : "SCOPE"}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--nv-ink, #14284B)", whiteSpace: "nowrap" }}>{label}</span>
        </span>
        <span style={{ color: "var(--nv-muted, #5A6B85)", fontSize: "9px" }}>▾</span>
      </button>
      {canSwitch && (
        <button
          type="button"
          onClick={next}
          aria-label={ar ? "الفرع التالي" : "Next station"}
          title={ar ? "الفرع التالي · Ctrl+Shift+↓" : "Next station · Ctrl+Shift+↓"}
          style={stepBtn}
        >
          <Next style={{ width: 13, height: 13 }} />
        </button>
      )}
    </div>
  );
}
