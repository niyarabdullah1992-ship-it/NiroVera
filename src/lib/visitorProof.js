import { workplaceStations } from "./stationTree.js";
import { ID_TYPE_OPTIONS, GENDER_OPTIONS } from "./employeeProfileFields.js";
import {
  cleanedPeople,
  cleanedVehicles,
  formPeople,
  formVehicles,
} from "./workProofCrew.js";

export const VISITOR_NATIONALITIES = [
  "سعودي",
  "يمني",
  "مصري",
  "سوداني",
  "هندي",
  "باكستاني",
  "بنغلاديشي",
  "فلبيني",
  "إندونيسي",
  "نيبالي",
  "أردني",
  "سوري",
  "لبناني",
  "فلسطيني",
  "إثيوبي",
];

export function visitorIdTypeLabel(value, ar) {
  const hit = ID_TYPE_OPTIONS.find((item) => item.value === value);
  if (!hit) return value || "";
  return ar ? hit.ar : hit.en;
}

export function visitorGenderLabel(value, ar) {
  const hit = GENDER_OPTIONS.find((item) => item.value === value);
  if (!hit) return value || "";
  return ar ? hit.ar : hit.en;
}

export function visitorPersonLine(person, ar) {
  if (!person?.name) return "";
  return [
    person.name,
    person.nationality,
    visitorIdTypeLabel(person.idType, ar),
    person.id,
  ].filter(Boolean).join(" · ");
}

export function visitorPeopleLabel(proof, ar) {
  const people = Array.isArray(proof?.people) ? proof.people : [];
  return people.map((person) => visitorPersonLine(person, ar)).filter(Boolean).join(" · ")
    || proof?.personName
    || "";
}

/** Guest presence cards only — never an employee roster row. */
export function isVisitorProofRecord(item) {
  if (!item || typeof item !== "object") return false;
  if (item.kind === "work") return false;
  if (item.kind === "visitor") return true;
  return !!(item.visitReason || item.visitFrom || item.visitTo);
}

export function visitorProofsOnly(list) {
  return (Array.isArray(list) ? list : []).filter(isVisitorProofRecord);
}

export function visitorProofScopeLabel(ar) {
  return ar ? "كل الزوار" : "All visitors";
}

export function visitorNamesOf(item) {
  const named = (Array.isArray(item?.people) ? item.people : [])
    .map((person) => String(person?.name || "").trim())
    .filter(Boolean);
  if (named.length) return named;
  const fallback = String(item?.personName || item?.visitorName || "").trim();
  return fallback ? [fallback] : [];
}

export function visitorProofRowText(item, ar) {
  const names = visitorNamesOf(item);
  if (names.length > 1) {
    return ar ? `${names[0]} و${names.length - 1} زوار` : `${names[0]} +${names.length - 1}`;
  }
  if (names[0]) return names[0];
  return String(item?.title || item?.ref || "").trim() || (ar ? "زائر" : "Visitor");
}

export function visitorProofClockSource(item) {
  const arrived = String(item?.arrivedAt || "").trim();
  if (arrived) return arrived;
  const created = String(item?.createdAt || "").trim();
  if (created) return created;
  const from = String(item?.visitFrom || "").trim();
  return from.includes("T") ? from : "";
}

export function visitDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || "").trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

export function todayVisitDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatVisitDay(key) {
  const value = visitDateKey(key);
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function visitBounds(proof) {
  const from = visitDateKey(proof?.visitFrom || proof?.arrivedAt);
  const to = visitDateKey(proof?.visitTo) || from;
  return { from, to };
}

export function visitDurationDays(proof) {
  const { from, to } = visitBounds(proof);
  if (!from) return 0;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function visitDurationLabel(proof, ar) {
  const days = visitDurationDays(proof);
  if (!days) return "";
  if (!ar) return days === 1 ? "1 day" : `${days} days`;
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يومًا`;
}

export function visitRangeLabel(proof, ar) {
  const { from, to } = visitBounds(proof);
  if (!from && !to) return "";
  const start = formatVisitDay(from || to, ar);
  const end = formatVisitDay(to || from, ar);
  if (!start) return "";
  return `${start} → ${end}`;
}

export function visitPeriodLabel(proof, ar) {
  return [visitRangeLabel(proof, ar), visitDurationLabel(proof, ar)].filter(Boolean).join(" · ");
}

export function visitBoundLabels(proof, ar) {
  const { from, to } = visitBounds(proof);
  return {
    from: formatVisitDay(from, ar),
    to: formatVisitDay(to, ar),
  };
}

export function deriveVisitorProofStage(proof) {
  if (proof?.leftAt || proof?.status === "left") return "left";
  return "on_site";
}

export function deriveVisitorProofCounts(list) {
  const counts = { all: 0, on_site: 0, left: 0 };
  for (const item of Array.isArray(list) ? list : []) {
    counts.all += 1;
    const stage = deriveVisitorProofStage(item);
    counts[stage] = (counts[stage] || 0) + 1;
  }
  return counts;
}

export function visitStationIds(form) {
  const many = Array.isArray(form?.stationIds)
    ? form.stationIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const one = String(form?.stationId || "").trim();
  return [...new Set(many.length ? many : (one ? [one] : []))];
}

export function visitorProofsForStations(fields) {
  const ids = visitStationIds(fields);
  return ids.map((stationId) => ({ ...fields, stationId, stationIds: [stationId] }));
}

export function groupVisitorProofsByStation(proofs, stations, ar) {
  const list = Array.isArray(proofs) ? proofs : [];
  const tree = Array.isArray(stations) ? stations : [];
  const order = workplaceStations(tree).map((station) => String(station.id));
  const nameOf = (id) => {
    if (id === "__none__") return ar ? "بدون فرع" : "No branch";
    return tree.find((station) => String(station.id) === String(id))?.name || id;
  };
  const map = new Map();
  for (const proof of list) {
    const key = String(proof?.stationId || "").trim() || "__none__";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(proof);
  }
  const groups = [];
  for (const id of order) {
    const items = map.get(id);
    if (items?.length) groups.push({ id, name: nameOf(id), items });
  }
  for (const [id, items] of map) {
    if (id === "__none__" || order.includes(id) || !items.length) continue;
    groups.push({ id, name: nameOf(id), items });
  }
  const none = map.get("__none__");
  if (none?.length) groups.push({ id: "__none__", name: nameOf("__none__"), items: none });
  return groups;
}

export function visitorProofFields(form) {
  const stationIds = visitStationIds(form);
  const stationId = stationIds[0] || "";
  const visitReason = String(form?.visitReason || form?.workReason || "").trim();
  const people = cleanedPeople(formPeople(form), stationId);
  const vehicles = cleanedVehicles(formVehicles(form));
  const first = people[0];
  if (!stationIds.length) {
    return { ok: false, error: "STATION_REQUIRED", errorAr: "اختر فرع الزيارة أو أكثر.", errorEn: "Pick one or more visit stations." };
  }
  if (!visitReason) {
    return { ok: false, error: "REASON_REQUIRED", errorAr: "اكتب سبب الزيارة.", errorEn: "Write the visit reason." };
  }
  if (!first?.name) {
    return { ok: false, error: "VISITOR_REQUIRED", errorAr: "أدخل اسم زائر واحد على الأقل.", errorEn: "Enter at least one visitor name." };
  }
  if (!first.nationality) {
    return { ok: false, error: "NATIONALITY_REQUIRED", errorAr: "أدخل جنسية الزائر.", errorEn: "Enter the visitor nationality." };
  }
  const visitFrom = visitDateKey(form?.visitFrom || form?.arrivedAt) || todayVisitDateKey();
  const visitTo = visitDateKey(form?.visitTo);
  if (!visitFrom) {
    return { ok: false, error: "VISIT_FROM_REQUIRED", errorAr: "حدد تاريخ بداية الزيارة.", errorEn: "Pick the visit start date." };
  }
  if (!visitTo) {
    return { ok: false, error: "VISIT_TO_REQUIRED", errorAr: "حدد تاريخ نهاية الزيارة.", errorEn: "Pick the visit end date." };
  }
  if (visitTo < visitFrom) {
    return { ok: false, error: "DATE_RANGE_INVALID", errorAr: "تاريخ النهاية لا يكون قبل البداية.", errorEn: "The end date cannot be before the start date." };
  }
  return {
    ok: true,
    fields: {
      visitReason,
      stationId,
      stationIds,
      hostId: String(form?.hostId || "").trim(),
      hostName: String(form?.hostName || "").trim(),
      people,
      vehicles,
      personName: first.name,
      personId: first.id,
      personTitle: first.title,
      personPhone: first.phone,
      visitFrom,
      visitTo,
      arrivedAt: `${visitFrom}T00:00:00`,
      attachments: Array.isArray(form?.attachments) ? form.attachments : [],
    },
  };
}

export function checkCloseVisitorProofGate({ proof, actorUserId, sameBranch, isManager }) {
  if (!proof) {
    return { ok: false, error: "PROOF_NOT_FOUND", errorAr: "الإثبات غير موجود.", errorEn: "Proof not found." };
  }
  if (deriveVisitorProofStage(proof) === "left") {
    return { ok: false, error: "ALREADY_LEFT", errorAr: "الزائر سجّل المغادرة.", errorEn: "The visitor already left." };
  }
  const actor = String(actorUserId || "").trim();
  if (actor && String(proof.raiserId || "") === actor) return { ok: true };
  if (isManager || sameBranch) return { ok: true };
  return {
    ok: false,
    error: "BRANCH_OR_MANAGER_REQUIRED",
    errorAr: "إغلاق الإثبات لفرع الزيارة أو للمدير.",
    errorEn: "Closing this proof is for the visit branch or a manager.",
  };
}
