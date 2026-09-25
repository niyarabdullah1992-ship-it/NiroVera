import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import useStationScope from "@/hooks/useStationScope";
import { setStationScope } from "@/lib/stationScopeStore";
import { buildManagerScopeModel } from "@/lib/managerScopeChips";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import { useRailSide } from "@/lib/railSide";

const INK = "#14213D";
const LINE = "#E4E8EE";
const PLAIN = "#137A49";
const WARN = "#C9962B";
const BAD = "#8A1C2B";

const TONE_BG = { plain: PLAIN, warn: WARN, bad: BAD };

function Badge({ count, tone }) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return null;
  return (
    <span
      dir="ltr"
      data-scope-badge={n}
      style={{
        minWidth: 16,
        height: 16,
        padding: "0 5px",
        boxSizing: "border-box",
        borderRadius: 999,
        background: TONE_BG[tone] || PLAIN,
        color: "#fff",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Chip({ id, label, on, count, tone, onPick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      data-scope-id={id}
      data-scope-count={count > 0 ? count : 0}
      onClick={onPick}
      style={{
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        border: `1px solid ${on ? "#000" : LINE}`,
        background: on ? "#000" : "#fff",
        color: on ? "#fff" : INK,
        fontSize: 12.5,
        fontWeight: 650,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span>{label}</span>
      <Badge count={count} tone={tone} />
    </button>
  );
}

export function useManagerScopeModel() {
  const { pathname, search } = useLocation();
  const { data, currentUser, company } = useAuth();
  const scope = useStationScope();
  const railSide = useRailSide();
  const attendanceRows = useMemo(
    () => listLocalTodayAttendance(company?.id, data),
    [company?.id, data],
  );
  return useMemo(
    () => buildManagerScopeModel({
      pathname,
      search,
      user: currentUser,
      data,
      scope,
      attendanceRows,
      railSide,
    }),
    [pathname, search, currentUser, data, scope, attendanceRows, railSide],
  );
}

/** One chip row for the admin face. Hidden on the employee face and when the viewer manages no branch. */
export default function ManagerScopeChips() {
  const { lang } = useI18n();
  const ar = lang !== "en";
  const railSide = useRailSide();
  const model = useManagerScopeModel();
  if (railSide === "employee" || !model.visible) return null;

  const pick = (id) => setStationScope(id || "all");

  return (
    <div
      data-nv="manager-scopes"
      role="radiogroup"
      aria-label={ar ? "نطاقات" : "Scopes"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        margin: "0 0 14px",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 650, color: INK, flexShrink: 0 }}>
        {ar ? "نطاقات" : "Scopes"}
      </span>
      <Chip
        id="all"
        label={ar ? "كل نطاق" : "Every scope"}
        on={model.selected === "all"}
        count={model.total}
        tone={model.tone}
        onPick={() => pick("all")}
      />
      {model.stations.map((station) => {
        const hit = model.counts[station.id];
        return (
          <Chip
            key={station.id}
            id={station.id}
            label={station.name}
            on={model.selected === station.id}
            count={hit?.count || 0}
            tone={hit?.tone || "plain"}
            onPick={() => pick(station.id)}
          />
        );
      })}
    </div>
  );
}
