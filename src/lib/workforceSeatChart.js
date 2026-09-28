/**
 * Seat chart for /app/org — one card per person or vacant seat.
 * Parents follow the workplace reporting chain. Vacant orgSeats hang
 * under the person they report to, else the station manager.
 */

import { buildPeopleTree } from "./peopleTreeGraph.js";
import { isCompanyRootStation, isManagerUnit } from "./stationTree.js";
import { coordinateLine, hrManagerForStation, isHrDirector, isHrUnit, isRegionalHr, regionalSeatLine, servedStationIds } from "./hrTree.js";
import { productGradeIndex, productGradeLabel } from "./jobGradeTitles.js";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function activeActing(employee, day = todayKey()) {
  const today = String(day || todayKey()).slice(0, 10);
  return (employee?.actingAssignments || []).filter((item) => {
    if (item?.endedAt) return false;
    const until = String(item.until || "").slice(0, 10);
    return !until || until >= today;
  });
}

const HIRE_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function stripLock(value) {
  return String(value || "").replace(/🔒/g, "").replace(/\s+/g, " ").trim();
}

function hireFace(employee, acting, ar) {
  const raw = String(employee?.profile?.hireDate || employee?.hireDate || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { hireStamp: "", hireTip: "" };
  const full = ar
    ? `${Number(match[3])} ${HIRE_MONTHS[Number(match[2]) - 1] || ""} ${match[1]}`.trim()
    : raw;
  const kind = acting ? (ar ? "تكليف" : "acting") : (ar ? "دائم" : "permanent");
  return {
    hireStamp: `${match[2]}/${match[1]}`,
    hireTip: ar ? `تاريخ التعيين: ${full} · ${kind}` : `Hire date: ${full} · ${kind}`,
  };
}

function bandLabelFor({ role, vacant, acting, actingText, tone, station, ar }) {
  const tag = stripLock(role?.kindTag);
  if (role?.kindLock && role?.kind === "branch") return tag || (ar ? "فرع · HQ" : "Branch · HQ");
  if (vacant) return ar ? "شاغرة" : "Vacant";
  if (acting) {
    const short = String(actingText || "").split("·")[0].trim();
    return short || (ar ? "تكليف ساري" : "Acting");
  }
  if (role?.kind === "branch" || role?.kindLock) return tag || "—";
  if (tone === "warn" || tone === "block") return ar ? "تنبيه نظامي" : "Compliance alert";
  const place = arabicPlaceName(station).replace(/^فرع\s+/, "");
  return place || "—";
}

function fixedCoordinate(role, ar) {
  if (!role?.kindLock) return "";
  if (role.kind === "person") {
    return ar
      ? "وحدة ثابتة لا تُحذف · منها يُعيَّن مدير موارد بشرية لكل فرع"
      : "Fixed unit. An HR manager for each branch is appointed here.";
  }
  return ar
    ? "الفرع الأول · المقر الرئيسي — ثابت لا يُحذف ولا يُنقل"
    : "First branch · headquarters — fixed, not moved";
}

function branchCode(station) {
  const code = String(station?.code || "").trim();
  if (code && !/\bpreview\b/i.test(code)) return code;
  if (isCompanyRootStation(station)) return "HQ";
  const parts = String(station?.name || "").trim().split(/\s+/).filter((part) => part && !/\bpreview\b/i.test(part));
  const last = parts[parts.length - 1] || "";
  if (/[\u0600-\u06FF]/.test(last)) return last.slice(0, 8);
  return "—";
}

function empNoOf(employee) {
  return String(employee?.employeeNo || employee?.profile?.employeeNo || "").trim();
}

/** Seat title first, then the person record. Empty stays empty so the card can show —. */
function jobTitleOf(employee, seat, fallbackJob = "") {
  return String(
    seat?.title
    || employee?.profile?.position
    || employee?.jobTitle
    || employee?.profile?.jobTitle
    || employee?.position
    || fallbackJob
    || ""
  ).trim();
}

function isHrStation(station) {
  return isHrUnit(station);
}

/**
 * HTML kind: the company head is فرع · code 🔒, a branch head is فرع · code,
 * the HR director seat is قسم ثابت · HR with a lock, everyone else is موظف.
 * The HR station is not drawn as its own branch card.
 */
function classify(node, station, employee, data, ar) {
  if (isHrDirector(employee, data)) {
    return {
      kind: "person",
      kindTag: ar ? "قسم ثابت · HR" : "Fixed unit · HR",
      kindLock: true,
    };
  }
  const rootHead = Boolean(
    station
    && isCompanyRootStation(station)
    && String(station.managerId || "") === String(node?.id || "")
  );
  if (rootHead) {
    return { kind: "branch", kindTag: ar ? `فرع · ${branchCode(station)} 🔒` : `Branch · ${branchCode(station)}`, kindLock: true };
  }
  if (!station || isCompanyRootStation(station) || isHrStation(station)) {
    return { kind: "person", kindTag: ar ? "موظف" : "Employee", kindLock: false };
  }
  const branchHead = Boolean(node?.isBranchHead && !isManagerUnit(station));
  if (branchHead) {
    return { kind: "branch", kindTag: ar ? `فرع · ${branchCode(station)}` : `Branch · ${branchCode(station)}`, kindLock: false };
  }
  return { kind: "person", kindTag: ar ? "موظف" : "Employee", kindLock: false };
}

function titledSeat(job, grade) {
  const name = String(job || "").trim();
  const rank = String(grade?.title || "").trim();
  if (!name) return rank;
  if (!rank || rank === name) return name;
  return `${name} · ${rank}`;
}

function gradeRow(data, gradeId) {
  if (!gradeId) return null;
  return (data?.jobGrades || []).find((item) => String(item.id) === String(gradeId)) || null;
}

function gradeChip(data, gradeId) {
  const grade = gradeRow(data, gradeId);
  if (!grade) return { grade: "", gradeTip: "", gradeIndex: -1 };
  const stored = String(grade.gradeNumber || "").trim();
  return {
    grade: productGradeLabel(stored),
    gradeTip: String(grade.title || "").trim(),
    gradeIndex: productGradeIndex(stored),
  };
}

/** Arabic station name for the card face. Latin tokens such as Preview are not a branch name. */
function arabicPlaceName(station) {
  const name = String(station?.name || "").trim();
  return /[\u0600-\u06FF]/.test(name) ? name : "";
}

function stationFaceName(data, id) {
  const station = (data?.stations || []).find((row) => String(row.id) === String(id));
  return String(station?.name || "")
    .replace(/^فرع\s+/, "")
    .replace("المقر الرئيسي", "المقر")
    .trim();
}

function hrCardLines(employee, station, data) {
  if (!employee?.id) return { servesText: "", hrLine: "" };
  const served = isRegionalHr(employee, data) ? servedStationIds(data, employee.id) : [];
  const servesText = served.length
    ? served.slice(0, 3).map((id) => stationFaceName(data, id)).filter(Boolean).join(" + ")
    : "";
  const branchManager = Boolean(
    station
    && !isHrUnit(station)
    && !isCompanyRootStation(station)
    && String(station.managerId || "") === String(employee.id)
  );
  let hrLine = "";
  if (branchManager) {
    const hr = hrManagerForStation(data, station.id);
    hrLine = hr?.name || "شاغر";
  }
  return { servesText, hrLine };
}

function unitChip(station, ar, show) {
  if (!show || !station) return { unit: "", unitTip: "", unitNavy: false };
  const name = arabicPlaceName(station);
  if (!name) return { unit: "", unitTip: "", unitNavy: false };
  return {
    unit: name,
    unitTip: ar ? `يتبع: ${name}` : `Reports to: ${name}`,
    unitNavy: false,
  };
}

function actingBanner(employee, data, ar) {
  const item = activeActing(employee)[0];
  if (!item) return { acting: false, actingText: "", tone: "" };
  const until = String(item.until || "").slice(0, 10);
  const station = (data?.stations || []).find((row) => String(row.id) === String(item.stationId || ""));
  const originalId = String(station?.managerId || "");
  const original = originalId && originalId !== String(employee.id)
    ? (data?.employees || []).find((row) => String(row.id) === originalId)
    : null;
  const actingText = ar
    ? `مكلَّف حتى ${until || "—"} · الأصلي: ${original?.name || "—"}`
    : `Acting until ${until || "—"} · permanent: ${original?.name || "—"}`;
  return { acting: true, actingText, tone: "acting" };
}

function rollup(node) {
  let total = 0;
  (node.children || []).forEach((child) => {
    total += 1 + rollup(child);
  });
  node.direct = (node.children || []).length;
  node.total = total;
  return total;
}

export function flattenSeatChart(nodes, acc = []) {
  (nodes || []).forEach((node) => {
    if (!node) return;
    acc.push(node);
    flattenSeatChart(node.children || [], acc);
  });
  return acc;
}

export function pathToSeat(roots, id) {
  const key = String(id || "");
  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      const next = [...trail, node];
      if (String(node.id) === key || String(node.employeeId || "") === key || String(node.stationId || "") === key) return next;
      const hit = walk(node.children || [], next);
      if (hit) return hit;
    }
    return null;
  };
  return walk(roots, []);
}

export function findSeatNode(roots, pred) {
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (pred(node)) return node;
      const hit = walk(node.children || []);
      if (hit) return hit;
    }
    return null;
  };
  return walk(roots);
}

/**
 * @returns {{ roots: object[], flat: object[] }}
 */
export function buildWorkforceSeatChart(data, { ar = true, meId = "" } = {}) {
  const tree = buildPeopleTree(data);
  const stations = data?.stations || [];
  const byStation = new Map(stations.map((station) => [String(station.id), station]));
  const byEmployee = new Map((data?.employees || []).map((employee) => [String(employee.id), employee]));

  const mapPeople = (node) => {
    const employee = byEmployee.get(String(node.id)) || null;
    const children = (node.children || []).flatMap(mapPeople);
    if (employee?.profile?.chartReleased || employee?.profile?.unseatedAt) return children;
    const station = byStation.get(String(node.stationId || "")) || null;
    const role = classify(node, station, employee, data, ar);
    const banner = actingBanner(employee, data, ar);
    const seat = (data?.orgSeats || []).find((item) => String(item.employeeId || "") === String(node.id));
    const gradeId = seat?.gradeId || employee?.profile?.gradeId || "";
    const held = gradeRow(data, gradeId);
    const grade = gradeChip(data, gradeId);
    const unit = unitChip(station, ar, role.kind === "person" && !role.kindLock);
    const branchFace = role.kind === "branch" ? arabicPlaceName(station) : "";
    const coordinate = role.kindLock
      ? fixedCoordinate(role, ar)
      : coordinateLine(employee, data, ar);
    const hired = hireFace(employee, banner.acting, ar);
    return [{
      id: String(node.id),
      employeeId: String(node.id),
      seatId: seat?.id ? String(seat.id) : "",
      stationId: String(node.stationId || ""),
      name: node.name || (ar ? "شاغرة" : "Vacant"),
      title: titledSeat(jobTitleOf(employee, seat, node.job), held),
      kind: role.kind,
      kindTag: role.kindTag,
      fixedTag: role.fixedTag || "",
      hrPost: seat?.hrPost || "",
      kindLock: Boolean(role.kindLock),
      bandLabel: bandLabelFor({ role, vacant: false, acting: banner.acting, actingText: banner.actingText, tone: banner.tone || "ok", station, ar }),
      empLine: empNoOf(employee),
      ...hired,
      ...grade,
      ...unit,
      branchFace,
      vacant: false,
      acting: banner.acting,
      actingText: banner.actingText,
      tone: banner.tone || "ok",
      avatarUrl: node.avatar || "",
      isMe: Boolean(meId) && String(node.id) === String(meId),
      coordinate,
      ...hrCardLines(employee, station, data),
      children,
    }];
  };

  const roots = (tree.roots || []).flatMap(mapPeople);
  const byId = new Map(flattenSeatChart(roots).map((node) => [node.id, node]));

  (data?.orgSeats || []).forEach((seat) => {
    if (!seat?.id || seat.employeeId) return;
    const station = byStation.get(String(seat.stationId || "")) || null;
    const explicitParent = String(seat.reportsToEmployeeId || "").trim();
    const parentId = explicitParent || (seat.reportsToSeatId ? "" : String(station?.managerId || "").trim());
    const parent = parentId ? byId.get(parentId) : null;
    const node = {
      id: `seat:${seat.id}`,
      employeeId: "",
      seatId: String(seat.id),
      stationId: String(seat.stationId || ""),
      name: ar ? "شاغرة" : "Vacant",
      title: titledSeat(String(seat.title || (ar ? "مقعد شاغر" : "Vacant seat")), gradeRow(data, seat.gradeId)),
      kind: "vacant",
      kindTag: seat.hrPost === "director" ? (ar ? "قسم ثابت · HR" : "Fixed unit · HR") : (ar ? "شاغرة" : "Vacant"),
      kindLock: seat.hrPost === "director",
      hrPost: seat.hrPost || "",
      bandLabel: seat.hrPost === "director"
        ? (ar ? "قسم ثابت · HR" : "Fixed unit · HR")
        : (ar ? "شاغرة" : "Vacant"),
      empLine: "",
      hireStamp: "",
      hireTip: "",
      ...gradeChip(data, seat.gradeId),
      ...unitChip(station, ar, seat.hrPost !== "director"),
      vacant: true,
      acting: false,
      actingText: "",
      tone: "vacant",
      avatarUrl: "",
      isMe: false,
      coordinate: seat.hrPost === "director"
        ? (ar
          ? "وحدة ثابتة لا تُحذف · منها يُعيَّن مدير موارد بشرية لكل فرع"
          : "Fixed unit. An HR manager for each branch is appointed here.")
        : regionalSeatLine(seat, data, ar),
      children: [],
      direct: 0,
      total: 0,
    };
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
    byId.set(node.id, node);
  });

  (data?.orgSeats || []).forEach((seat) => {
    if (!seat?.id || seat.employeeId || seat.reportsToEmployeeId || !seat.reportsToSeatId) return;
    const node = byId.get(`seat:${seat.id}`);
    const parent = byId.get(`seat:${seat.reportsToSeatId}`);
    if (!node || !parent || node === parent) return;
    const detach = (list) => {
      const index = (list || []).findIndex((item) => item === node);
      if (index >= 0) list.splice(index, 1);
    };
    detach(roots);
    byId.forEach((item) => detach(item.children));
    parent.children.push(node);
  });

  stations.forEach((station) => {
    if (!station?.id || station.managerId || isCompanyRootStation(station) || isHrStation(station)) return;
    const already = flattenSeatChart(roots).some((node) => node.vacant && String(node.stationId) === String(station.id) && /مدير|شاغر/.test(node.title || ""));
    if (already) return;
    const parentStationId = String(station.parentStationId || "");
    const parentStation = byStation.get(parentStationId);
    const parentId = String(parentStation?.managerId || "").trim();
    const parent = parentId ? byId.get(parentId) : null;
    const node = {
      id: `vacant-station:${station.id}`,
      employeeId: "",
      seatId: "",
      stationId: String(station.id),
      name: ar ? "شاغرة" : "Vacant",
      title: ar ? "مدير الفرع" : "Branch manager",
      kind: "vacant",
      kindTag: ar ? "شاغرة" : "Vacant",
      bandLabel: ar ? "شاغرة" : "Vacant",
      empLine: "",
      hireStamp: "",
      hireTip: "",
      grade: "",
      gradeTip: "",
      gradeIndex: -1,
      ...unitChip(station, ar, true),
      vacant: true,
      acting: false,
      actingText: "",
      tone: "vacant",
      avatarUrl: "",
      isMe: false,
      coordinate: "",
      children: [],
      direct: 0,
      total: 0,
    };
    if (parent) parent.children.push(node);
    else roots.push(node);
    byId.set(node.id, node);
  });

  roots.forEach((node) => rollup(node));
  return { roots, flat: flattenSeatChart(roots) };
}
