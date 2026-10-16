/**
 * Synchronous station scope store — localStorage + listeners.
 * Write on click (not only in useEffect) so a Layout remount cannot wipe a
 * selection that has not yet been persisted.
 */
const KEY = "powercare_station_scope";
const RECENT_KEY = "powercare_station_scope_recent";
const RECENT_LIMIT = 6;
/** Set only when the person picks a branch by hand — kept until they sign out or a new sign-in; a restored or automatic scope is not a choice. */
const MANUAL_KEY = "powercare_station_scope_manual";
const listeners = new Set();

function readRaw() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function normalizeStationScope(id) {
  if (id == null || id === "" || id === "all") return "all";
  let value = String(id);
  if (value.endsWith(":self")) value = value.slice(0, -5);
  if (value.endsWith(":tree")) value = value.slice(0, -5);
  return value || "all";
}

export function getStationScope() {
  return normalizeStationScope(readRaw());
}

export function getRecentStationScopes() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(normalizeStationScope).filter((id) => id !== "all") : [];
  } catch {
    return [];
  }
}

function pushRecent(id) {
  if (id === "all") return;
  try {
    const next = [id, ...getRecentStationScopes().filter((entry) => entry !== id)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

/** True when the header branch was picked by hand since this sign-in (not set by a notification). */
export function isStationScopeManual() {
  try {
    return localStorage.getItem(MANUAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStationScope(id, { manual = true } = {}) {
  const next = normalizeStationScope(id);
  try {
    if (manual && next !== "all") localStorage.setItem(MANUAL_KEY, "1");
    else localStorage.removeItem(MANUAL_KEY);
  } catch {
    /* ignore private mode */
  }
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore quota / private mode */
  }
  pushRecent(next);
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* listener errors must not break other subscribers */
    }
  });
  try {
    window.dispatchEvent(new CustomEvent("powercare:scope-change", { detail: { stationId: next } }));
  } catch {
    /* ignore */
  }
  return next;
}

/** Sign-out must not hand the next user the previous user's station. */
export function clearStationScope() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
  return setStationScope("all", { manual: false });
}

export function subscribeStationScope(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
