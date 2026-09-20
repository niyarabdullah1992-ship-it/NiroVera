import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations } from "@/lib/permissions";
import { matchesExactStation, resolvePageStationScope } from "@/lib/stationScopePolicy";
import {
  getStationScope,
  normalizeStationScope,
  subscribeStationScope,
} from "@/lib/stationScopeStore";

/**
 * Stored header scope (`powercare_station_scope`) — may still be `all`
 * while the current page resolves it to one workplace.
 */
export function useRawStationScope() {
  const [stationId, setStationId] = useState(() => getStationScope());

  useEffect(() => {
    const sync = (next) => setStationId(normalizeStationScope(next ?? getStationScope()));
    const onEvent = (e) => {
      const fromDetail = e?.detail?.stationId;
      sync(fromDetail != null ? fromDetail : getStationScope());
    };
    const onStorage = (e) => {
      if (e.key && e.key !== "powercare_station_scope") return;
      sync(getStationScope());
    };
    const unsub = subscribeStationScope(sync);
    window.addEventListener("powercare:scope-change", onEvent);
    window.addEventListener("storage", onStorage);
    sync(getStationScope());
    return () => {
      unsub();
      window.removeEventListener("powercare:scope-change", onEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return stationId;
}

/**
 * Page-aware header scope. Duty / care / money (except inventory) never
 * return `all` — each section is one workplace. Consumers must still
 * enforce companyId on the server.
 */
export default function useStationScope() {
  const raw = useRawStationScope();
  const { pathname } = useLocation();
  const { data, currentUser } = useAuth();
  return useMemo(
    () => resolvePageStationScope({
      pathname,
      headerScope: raw,
      employee: currentUser,
      stations: data?.stations,
      visible: currentUser && data ? visibleStations(currentUser, data) : data?.stations,
      data,
    }),
    [pathname, raw, data, currentUser],
  );
}

/** One workplace at a time. `all` is only a match on surfaces that still allow it. */
export function matchesStationScope(rowStationId, scopeId) {
  return matchesExactStation(rowStationId, normalizeStationScope(scopeId));
}
