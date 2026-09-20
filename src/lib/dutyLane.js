/** Mine / manage lane for attendance, calendar, and shifts. */

export function dutyLaneFromSearch(searchParams, canManage) {
  if (!canManage) return "mine";
  if (searchParams?.get?.("lane") === "manage") return "manage";
  const tab = searchParams?.get?.("tab");
  if (tab === "team" || tab === "policy" || tab === "schedule") return "manage";
  return "mine";
}

export function writeDutyLane(searchParams, lane) {
  const next = new URLSearchParams(searchParams);
  if (lane === "manage") next.set("lane", "manage");
  else next.delete("lane");
  return next;
}
