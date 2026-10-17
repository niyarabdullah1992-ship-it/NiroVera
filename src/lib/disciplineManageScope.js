import { ROLE_RANK, canSeeAllStations, hrScopeStations, visibleStations } from "@/lib/permissions";

/**
 * Whose sanction files a manager may see and raise — the scope الجزاءات applies, shared with the
 * «الامتثال الوزاري» index so its counts read the same files.
 */
export function managedScope(person, data) {
  if (!person) return { all: false, ids: new Set() };
  if (canSeeAllStations(person) || String(person.id) === String(data?.ownerId || "")) return { all: true, ids: new Set() };
  if (person.hrLevelId) {
    const scope = hrScopeStations(person, data);
    if (scope === null) return { all: true, ids: new Set() };
    return { all: false, ids: new Set((scope || []).map(String)) };
  }
  if (["station_manager", "pgm", "ops_manager", "director"].includes(person.role)) {
    return { all: false, ids: new Set(visibleStations(person, data).map((row) => String(row.id))) };
  }
  return { all: false, ids: new Set() };
}

/** A sanction is not raised on yourself, or on someone whose scope is equal or wider. */
export function scopeEqualOrWider(person, actor, data) {
  if (!person || !actor) return false;
  if (String(person.id) === String(actor.id)) return true;
  const theirs = managedScope(person, data);
  const mine = managedScope(actor, data);
  if (theirs.all) return true;
  if (mine.all) return false;
  if (!theirs.ids.size) return false;
  if (!mine.ids.size) return true;
  const personRank = ROLE_RANK[person.role] || 0;
  const actorRank = ROLE_RANK[actor.role] || 0;
  if (personRank >= actorRank && personRank >= ROLE_RANK.station_manager && theirs.ids.size >= mine.ids.size) return true;
  let covers = true;
  mine.ids.forEach((id) => {
    if (!theirs.ids.has(id)) covers = false;
  });
  return covers && theirs.ids.size >= mine.ids.size;
}

/** Who manages الجزاءات: the owner, an HR level, or a branch / operations line role. */
export function canManageDiscipline(user, data) {
  return Boolean(user && (data?.ownerId === user.id || user.hrLevelId || ["director", "ops_manager", "station_manager"].includes(user.role)));
}

/**
 * The files the management side lists: never the viewer's own, nor one of a person whose scope is
 * equal or wider, and only in the header scope (`inScope(stationId)`).
 */
export function disciplineManageCases(data, user, { inScope = () => true } = {}) {
  const employees = data?.employees || [];
  return (data?.disciplinaryCases || []).filter((item) => {
    const person = employees.find((row) => String(row.id) === String(item.employeeId));
    if (String(item.employeeId) === String(user?.id)) return false;
    if (person && scopeEqualOrWider(person, user, data)) return false;
    return inScope(item.stationId || person?.stationId || person?.station_id);
  });
}
