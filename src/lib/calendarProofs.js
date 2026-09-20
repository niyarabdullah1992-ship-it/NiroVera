import { isWorkProofArchived } from "./workProofDerivations.js";
import { deriveVisitorProofStage, visitBounds, visitDateKey } from "./visitorProof.js";
import { canSeeAllStations } from "./permissions.js";

export function proofDateKey(value) {
  return visitDateKey(value);
}

export function isCalendarProofEnded(proof) {
  if (!proof) return true;
  if (proof.kind === "visitor" || proof.visitReason || proof.visitFrom) {
    if (deriveVisitorProofStage(proof) === "left") return true;
    const { to } = visitBounds(proof);
    const today = proofDateKey(new Date().toISOString());
    return !!(to && today && to < today);
  }
  return isWorkProofArchived(proof);
}

export function proofCoversDate(proof, dateKey) {
  if (!proof || !dateKey || isCalendarProofEnded(proof)) return false;
  if (proof.kind === "visitor" || proof.visitReason || proof.visitFrom) {
    const { from, to } = visitBounds(proof);
    if (!from) return false;
    return dateKey >= from && dateKey <= (to || from);
  }
  const start = proofDateKey(proof.startedAt || proof.createdAt);
  const end = proofDateKey(proof.endedAt) || dateKey;
  if (!start) return dateKey === proofDateKey(proof.createdAt);
  return dateKey >= start && dateKey <= end;
}

export function canSeeStationProof(proof, user, data) {
  if (!proof || !user) return false;
  if (canSeeAllStations(user) || user.id === data?.ownerId || user.role === "director") return true;
  const stationId = String(proof.stationId || "");
  if (!stationId) return false;
  if (String(user.stationId || "") === stationId) return true;
  const managed = Array.isArray(user.managedStations) ? user.managedStations.map(String) : [];
  if (managed.includes(stationId)) return true;
  return ["ops_manager", "pgm", "station_manager"].includes(user.role)
    && String(user.stationId || "") === stationId;
}

export function liveCalendarProofs({ workProofs = [], visitorProofs = [], user, data, dateKey }) {
  const work = (Array.isArray(workProofs) ? workProofs : []).map((item) => ({ ...item, kind: "work" }));
  const visitors = (Array.isArray(visitorProofs) ? visitorProofs : []).map((item) => ({ ...item, kind: "visitor" }));
  return [...work, ...visitors].filter((proof) => (
    canSeeStationProof(proof, user, data) && proofCoversDate(proof, dateKey)
  ));
}

export function proofsByCalendarDate({ workProofs, visitorProofs, user, data, days }) {
  const map = {};
  for (const date of days || []) {
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const items = liveCalendarProofs({ workProofs, visitorProofs, user, data, dateKey: key });
    if (items.length) map[key] = items;
  }
  return map;
}
