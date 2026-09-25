/** Mine / manage lane for attendance, calendar, and shifts. The rail side wins over a stale query. */

export function dutyLaneFromSearch(searchParams, canManage, railSide = "") {
  if (!canManage) return "mine";
  if (railSide === "employee") return "mine";
  if (railSide === "manage") return "manage";
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
