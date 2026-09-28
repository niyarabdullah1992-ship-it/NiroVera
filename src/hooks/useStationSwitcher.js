import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations } from "@/lib/permissions";
import { headerScopeBranches, isNestedWorkplace, nearestHeaderBranch } from "@/lib/stationTree";
import {
  fallbackStationId,
  headerAllowsAllStations,
  pageLocksToOwnWorkplace,
} from "@/lib/stationScopePolicy";
import {
  getRecentStationScopes,
  setStationScope,
  subscribeStationScope,
} from "@/lib/stationScopeStore";
import useStationScope from "@/hooks/useStationScope";
import { deriveReadinessByStation } from "@/lib/stationReadiness";

export const OPEN_STATION_SWITCH_EVENT = "powercare:open-station-switch";

/** Any surface can raise the palette without importing it. */
export function openStationSwitcher() {
  window.dispatchEvent(new Event(OPEN_STATION_SWITCH_EVENT));
}

/**
 * Single source for the header scope: the stations a user may switch between,
 * the current selection, readiness per station, and in-place switching.
 * Switching never navigates — it only writes the scope store, so the mounted
 * section re-derives with the new station.
 */
export default function useStationSwitcher() {
  const { data, currentUser } = useAuth();
  const { pathname } = useLocation();
  const scope = useStationScope();
  const allowsAll = headerAllowsAllStations(pathname);
  const locksToOwn = pageLocksToOwnWorkplace({ pathname, employee: currentUser, data });
  const [recentIds, setRecentIds] = useState(() => getRecentStationScopes());

  useEffect(() => subscribeStationScope(() => setRecentIds(getRecentStationScopes())), []);

  const stations = useMemo(() => {
    const visible = headerScopeBranches(
      data && currentUser ? visibleStations(currentUser, data) : [],
      data?.stations || [],
    );
    if (!locksToOwn) return visible;
    const own = fallbackStationId({
      employee: currentUser,
      stations: data?.stations,
      visible,
    });
    return own ? visible.filter((row) => String(row.id) === String(own)) : visible;
  }, [data, currentUser, locksToOwn]);

  const readiness = useMemo(() => deriveReadinessByStation(data, stations), [data, stations]);

  const scopedStation = useMemo(
    () => (scope === "all" ? null : stations.find((s) => String(s.id) === String(scope)) || null),
    [scope, stations],
  );

  const recents = useMemo(
    () =>
      recentIds
        .map((id) => stations.find((s) => String(s.id) === String(id)))
        .filter(Boolean)
        .filter((s) => String(s.id) !== String(scope))
        .slice(0, 3),
    [recentIds, stations, scope],
  );

  useEffect(() => {
    if (!scope || scope === "all") return;
    const tree = data?.stations || [];
    const node = tree.find((station) => String(station.id) === String(scope));
    if (!node || !isNestedWorkplace(node, tree)) return;
    const branch = nearestHeaderBranch(node, tree);
    if (!branch || String(branch.id) === String(scope)) return;
    if (!stations.some((station) => String(station.id) === String(branch.id))) return;
    setStationScope(String(branch.id));
  }, [scope, data, stations]);

  const apply = useCallback((id) => setStationScope(id), []);

  /** Step through the visible stations; "all" is only on surfaces that allow it. */
  const step = useCallback(
    (delta) => {
      if (!stations.length) return;
      const ids = stations.map((s) => String(s.id));
      const ring = allowsAll ? ["all", ...ids] : ids;
      if (!ring.length) return;
      const at = ring.indexOf(String(scope));
      const next = ring[((at < 0 ? 0 : at) + delta + ring.length) % ring.length];
      setStationScope(next);
    },
    [stations, scope, allowsAll],
  );

  return {
    stations,
    scope,
    scopedStation,
    readiness,
    recents,
    apply,
    allowsAll,
    locksToOwn,
    next: () => step(1),
    previous: () => step(-1),
    canSwitch: !locksToOwn && stations.length > 1,
  };
}
