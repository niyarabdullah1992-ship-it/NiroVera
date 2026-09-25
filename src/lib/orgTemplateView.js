import { employeeJobGrade, jobGradeLabel } from "@/lib/jobGrades";
import { listedPacks } from "@/lib/permissionPackTemplate";
import { companyLists, templateLabel } from "@/lib/permissionTemplates";
import { rankLabel, SMART_DEPARTMENTS } from "@/lib/smartPositions";
import { activeActingAssignments, ownerEmployee, seatForEmployee } from "@/lib/orgHire";
import { extraCoverageStationIds, effectiveUnitKind, isHrUnit, isTreeManagerTitle, scopeStationsForDisplay, stationParentId, stationSubtreeIds } from "@/lib/stationTree";
import { workplaceManagerDisplay } from "@/lib/orgStructureLog";

const GREEN = "hsl(154 79% 27%)";
const GREENT = "hsl(154 74% 22%)";
const AMBER = "hsl(41 62% 46%)";
const MUTED = "hsl(220 9% 46%)";
const NAVY = "hsl(222 70% 15%)";

const LIST_TONE = {
  القيادة: NAVY,
  الفنيين: GREEN,
  المهندسين: "hsl(186 44% 32%)",
  "الموارد البشرية": "hsl(219 45% 40%)",
  IT: "hsl(258 34% 44%)",
  السلامة: AMBER,
};

const PACK_TONE = {
  الميداني: GREEN,
  "موظف ميداني": GREEN,
  "مدير فرع": NAVY,
  "الموارد البشرية": "hsl(219 45% 40%)",
  "مسؤول موارد بشرية": "hsl(219 45% 40%)",
  المالية: "hsl(186 44% 30%)",
  "مسؤول مالية": "hsl(186 44% 30%)",
  الالتزام: AMBER,
  "مسؤول سلامة": AMBER,
  "ضبط النظام": "hsl(258 34% 44%)",
  المالك: NAVY,
};

export const peopleWord = (n, ar = true) => {
  const count = Math.max(0, Number(n) || 0);
  if (!ar) return count === 1 ? "1 employee" : `${count} employees`;
  if (count === 0) return "لا موظفون";
  if (count === 1) return "موظف واحد";
  if (count === 2) return "موظفان";
  if (count <= 10) return `${count} موظفين`;
  return `${count} موظفًا`;
};

export const branchWord = (n, ar = true) => {
  const count = Math.max(0, Number(n) || 0);
  if (!ar) return count === 1 ? "1 branch" : `${count} branches`;
  if (count === 1) return "فرع واحد";
  if (count === 2) return "فرعان";
  if (count <= 10) return `${count} فروع`;
  return `${count} فرعًا`;
};

export const DEPTH_TONE = [
  "hsl(41 48% 42%)",
  "hsl(258 28% 48%)",
  "hsl(154 55% 32%)",
  "hsl(186 40% 32%)",
  "hsl(219 40% 40%)",
];

export const seatWord = (n, ar = true) => {
  if (!ar) return n === 1 ? "1 seat" : `${n} seats`;
  if (n === 1) return "منصب واحد";
  if (n === 2) return "منصبان";
  if (n <= 10) return `${n} مناصب`;
  return `${n} منصبًا`;
};

function listTone(name) {
  return LIST_TONE[name] || MUTED;
}

function packTone(name) {
  return PACK_TONE[name] || GREEN;
}

function managerOf(employee, data) {
  const nodes = data?.orgTree || [];
  const node = nodes.find((item) => item.type === "employee" && item.refId === employee.id);
  const parent = nodes.find((item) => item.id === node?.parentId);
  if (!parent || parent.type !== "employee") return "";
  return (data?.employees || []).find((item) => item.id === parent.refId)?.name || "";
}

export function peopleFromCompany(data) {
  const owner = ownerEmployee(data);
  const people = (data?.employees || [])
    .filter((employee) => {
      if (employee.role === "system") return false;
      if (employee.active === false) return false;
      const status = employee.profile?.employmentStatus;
      return status !== "terminated";
    })
    .map((employee) => {
      const seat = seatForEmployee(data, employee.id);
      const position = (data?.smartPositions || []).find((item) => item.employeeId === employee.id);
      const homeId = employee.stationId || employee.profile?.stationId || seat?.stationId || "";
      const station = (data?.stations || []).find((item) => item.id === homeId);
      const grade = (data?.jobGrades || []).find((item) => item.id === (seat?.gradeId || employee.profile?.gradeId))
        || employeeJobGrade(employee, data);
      const pack = listedPacks(data).find((item) => item.id === (seat?.listId || position?.templateId))
        || companyLists(data).find((item) => item.id === (seat?.listId || position?.templateId));
      const extras = extraCoverageStationIds(employee, data)
        .map((id) => (data?.stations || []).find((item) => item.id === id)?.name)
        .filter(Boolean);
      const reportsEmp = (data?.employees || []).find((item) => item.id === (seat?.reportsToEmployeeId || employee.profile?.directManagerId));
      const managerSeat = reportsEmp ? seatForEmployee(data, reportsEmp.id) : null;
      const managerHome = (data?.stations || []).find((item) => item.id === (managerSeat?.stationId || reportsEmp?.stationId));
      const managerName = reportsEmp?.name || managerOf(employee, data) || owner?.name || "";
      const orphan = Boolean(seat?.reportsToMissing) || (!reportsEmp && !managerOf(employee, data));
      const acting = activeActingAssignments(employee).map((item) => {
        const branch = (data?.stations || []).find((stationItem) => stationItem.id === item.stationId)?.name || "";
        return [item.title || "", branch, item.until ? `حتى ${item.until}` : ""].filter(Boolean).join(" · ");
      }).filter(Boolean);
      return {
        name: employee.name || "",
        branch: station?.name || "",
        unit: employee.profile?.department || employee.profile?.unit || "",
        list: pack ? templateLabel(pack, true) : (seat?.list || employee.profile?.department || rankLabel(position?.rank || "employee", true)),
        grade: jobGradeLabel(grade) || "",
        job: seat?.title || position?.title || employee.profile?.position || employee.position || "",
        manager: managerName,
        pack: "",
        covers: extras.join("، "),
        acting: acting.join("، "),
        homeId: station?.id || homeId || "",
        employeeId: employee.id,
        seatId: seat?.id || "",
        cross: Boolean(managerHome?.name && station?.name && managerHome.name !== station.name),
        orphan,
      };
    });
  const vacant = (data?.orgSeats || [])
    .filter((seat) => !seat.employeeId)
    .map((seat) => {
      const station = (data?.stations || []).find((item) => item.id === seat.stationId);
      const grade = (data?.jobGrades || []).find((item) => item.id === seat.gradeId);
      const pack = listedPacks(data).find((item) => item.id === seat.listId);
      const reportsEmp = (data?.employees || []).find((item) => item.id === seat.reportsToEmployeeId);
      const managerSeat = reportsEmp ? seatForEmployee(data, reportsEmp.id) : null;
      const managerHome = (data?.stations || []).find((item) => item.id === (managerSeat?.stationId || reportsEmp?.stationId));
      return {
        name: "شاغر",
        vacant: true,
        hireOpen: seat.hireOpen !== false,
        seatId: seat.id,
        branch: station?.name || "",
        unit: "",
        list: pack ? templateLabel(pack, true) : (seat.list || "عام"),
        grade: jobGradeLabel(grade) || "",
        job: seat.title || "",
        manager: reportsEmp?.name || owner?.name || "",
        pack: "",
        covers: "",
        acting: "",
        homeId: seat.stationId || "",
        employeeId: "",
        cross: Boolean(managerHome?.name && station?.name && managerHome.name !== station.name),
        orphan: Boolean(seat.reportsToMissing) || !reportsEmp,
      };
    });
  return [...people, ...vacant];
}

export function buildOrgDiagram(people, openMap = {}, onToggle, stations = []) {
  const byBranch = {};
  people.forEach((row) => {
    const branch = row.branch || "بلا فرع";
    const list = row.list || "عام";
    const bucket = byBranch[branch] || (byBranch[branch] = { lists: {}, head: "", homeId: row.homeId || "" });
    (bucket.lists[list] || (bucket.lists[list] = [])).push(row);
    if (row.homeId) bucket.homeId = row.homeId;
    if (!row.vacant && isTreeManagerTitle(row.job)) {
      bucket.head = `${row.name} · ${row.job}`;
    }
  });
  (stations || []).forEach((station) => {
    if (isHrUnit(station)) return;
    const name = station.name || "";
    if (!name) return;
    if (!byBranch[name]) byBranch[name] = { lists: {}, head: "", homeId: station.id };
    else byBranch[name].homeId = byBranch[name].homeId || station.id;
  });
  const branchNames = Object.keys(byBranch);
  const LIST_GAP = 9;
  const ROW_GAP = 16;
  const CLOSED_H = 58;
  const SEAT_H = 28;

  const branches = branchNames.map((name) => {
    const bucket = byBranch[name];
    const lists = Object.keys(bucket.lists);
    const seats = lists.reduce((sum, key) => sum + bucket.lists[key].length, 0);
    const items = lists.map((key) => {
      const rows = bucket.lists[key];
      const id = `${name}|${key}`;
      const opened = Boolean(openMap[id]);
      return {
        id,
        name: key,
        open: opened,
        tone: listTone(key),
        hNum: CLOSED_H + (opened ? rows.length * SEAT_H + 9 : 0),
        line: opened ? "hsl(220 13% 82%)" : "hsl(220 13% 91%)",
        caret: opened ? "−" : "+",
        toggle: () => onToggle?.(id),
        seats: seatWord(rows.length),
        sub: opened ? "المناصب وشاغلوها" : rows.map((row) => row.grade || row.job).filter(Boolean).join(" · "),
        rows: rows.map((row) => ({
          grade: row.grade || "—",
          job: row.job || "—",
          who: row.name,
          whoFg: row.vacant ? GREEN : row.orphan ? AMBER : "hsl(220 43% 11%)",
          vacant: Boolean(row.vacant),
          seatId: row.seatId || "",
          employeeId: row.employeeId || "",
          covers: String(row.covers || "").trim(),
          acting: String(row.acting || "").trim(),
          homeId: row.homeId || bucket.homeId || "",
          orphan: Boolean(row.orphan),
          cross: Boolean(row.cross) || Boolean(row.manager && people.find((item) => item.name === row.manager)?.branch && people.find((item) => item.name === row.manager)?.branch !== name),
        })),
      };
    });
    const ownPeople = Object.values(bucket.lists).flat().filter((row) => !row.vacant).length;
    const station = (stations || []).find((item) => String(item.id) === String(bucket.homeId));
    const parentId = stationParentId(station);
    const parent = (stations || []).find((item) => String(item.id) === String(parentId || ""));
    const { managerId, managerName, managerTitle } = workplaceManagerDisplay(
      station,
      Object.values(bucket.lists).flat().concat(people),
    );
    const listsTotal = items.reduce((sum, item) => sum + item.hNum, 0) + Math.max(0, items.length - 1) * LIST_GAP;
    const rowH = Math.max(88, listsTotal);
    const first = items[0]?.hNum || 88;
    const last = items[items.length - 1]?.hNum || 88;
    return {
      name,
      stationId: bucket.homeId || "",
      parentStationId: parentId || "",
      isCompanyRoot: Boolean(station?.isCompanyRoot),
      unitKind: effectiveUnitKind(station),
      kind: effectiveUnitKind(station) === "manager" ? "إدارة" : "فرع تشغيلي",
      head: bucket.head || (parent?.name ? `تتبع ${parent.name}` : "تتبع الرئاسة مباشرة"),
      managerName,
      managerTitle,
      managerId,
      ownPeople,
      seatCount: seats,
      count: seatWord(seats),
      hNum: rowH,
      h: `${rowH}px`,
      spine: items.length > 1 ? `${listsTotal - first / 2 - last / 2}px` : "0px",
      spineShift: `${(first - last) / 2}px`,
      lists: items.map((item) => ({ ...item, h: `${item.hNum}px` })),
      children: [],
    };
  });

  const byId = new Map();
  branches.forEach((branch) => {
    if (branch.stationId && !byId.has(String(branch.stationId))) byId.set(String(branch.stationId), branch);
  });
  const ancestorIds = (branch) => {
    const ids = new Set();
    let cursor = branch;
    while (cursor) {
      const id = String(cursor.stationId || "");
      if (!id || ids.has(id)) break;
      ids.add(id);
      cursor = cursor.parentStationId ? byId.get(String(cursor.parentStationId)) : null;
    }
    return ids;
  };
  const roots = [];
  branches.forEach((branch) => {
    const parent = branch.parentStationId ? byId.get(String(branch.parentStationId)) : null;
    if (parent && parent !== branch && !ancestorIds(parent).has(String(branch.stationId || ""))) {
      parent.children.push(branch);
    } else {
      roots.push(branch);
    }
  });
  const companyRootBranch = branches.find((branch) => branch.isCompanyRoot);
  if (companyRootBranch) {
    roots.forEach((branch) => {
      if (branch === companyRootBranch) return;
      if (!companyRootBranch.children.includes(branch)) companyRootBranch.children.push(branch);
    });
    roots.length = 0;
    roots.push(companyRootBranch);
  }
  const seen = new Set();
  const peopleUnder = (stationId) => {
    const scope = new Set(stationSubtreeIds(stations, stationId));
    const ids = new Set();
    (people || []).forEach((row) => {
      if (row.vacant) return;
      const home = String(row.homeId || "");
      if (!home || !scope.has(home)) return;
      const homeStation = (stations || []).find((item) => String(item.id) === home);
      // Manager seats are not workplaces — people parked on them are not hired staff.
      if (effectiveUnitKind(homeStation) === "manager") return;
      ids.add(String(row.employeeId || `${row.name}:${home}`));
    });
    return ids.size;
  };
  const rollup = (branch, depth = 0) => {
    if (!branch || seen.has(branch) || depth > 40) return branch?.ownPeople || 0;
    seen.add(branch);
    branch.depth = depth;
    branch.tone = DEPTH_TONE[Math.min(depth, DEPTH_TONE.length - 1)];
    let childSeats = 0;
    (branch.children || []).forEach((child) => {
      rollup(child, depth + 1);
      childSeats += child.treeSeats || 0;
    });
    branch.childCount = (branch.children || []).length;
    branch.treePeople = peopleUnder(branch.stationId);
    branch.treeSeats = (branch.seatCount || 0) + childSeats;
    branch.count = peopleWord(branch.treePeople);
    return branch.treePeople;
  };
  roots.forEach((branch) => rollup(branch, 0));

  const heights = roots.map((branch) => branch.hNum);
  const total = heights.reduce((sum, value) => sum + value, 0) + Math.max(0, heights.length - 1) * ROW_GAP;
  const spine = heights.length > 1 ? `${total - heights[0] / 2 - heights[heights.length - 1] / 2}px` : "0px";
  const spineShift = heights.length ? `${(heights[0] - heights[heights.length - 1]) / 2}px` : "0px";

  const hired = people.filter((row) => !row.vacant);
  const allLists = {};
  people.forEach((row) => {
    const key = row.list || "عام";
    (allLists[key] || (allLists[key] = [])).push(row.grade || row.job);
  });

  return {
    branches: roots,
    spine,
    spineShift,
    listCards: Object.keys(allLists).map((name) => ({
      name,
      tone: listTone(name),
      seats: seatWord(allLists[name].length),
      grades: allLists[name].filter((item, index, list) => item && list.indexOf(item) === index).map((t) => ({ t })),
    })),
    headline: `${hired.length} ملف موظف و${Object.keys(allLists).length} قوائم و${people.length} منصبًا و${branchNames.length} فروع`,
  };
}

export function packCardsFromGrants(packs) {
  return (packs || []).map((pack) => {
    const name = pack.name || pack.ar || "";
    const grants = SMART_DEPARTMENTS.filter((department) => pack.permissions?.[department.id] && pack.permissions[department.id] !== "hidden");
    const counts = {};
    grants.forEach((department) => {
      const level = pack.permissions[department.id] === "manage" ? "اعتماد" : "قراءة";
      counts[level] = (counts[level] || 0) + 1;
    });
    return {
      name,
      tone: packTone(name),
      count: grants.length <= 1 && pack.permissions && Object.values(pack.permissions).every((access) => access === "manage")
        ? "كل الأقسام"
        : `${grants.length} أقسام`,
      sections: grants.map((department) => department.ar).join(" · ") || "—",
      levels: Object.keys(counts).map((key) => ({
        t: `${key} · ${counts[key]}`,
        bg: key === "اعتماد" ? "hsl(154 79% 27% / .1)" : key === "إدخال" ? "hsl(219 45% 44% / .1)" : "hsl(220 16% 96%)",
        fg: key === "اعتماد" ? GREENT : key === "إدخال" ? "hsl(219 45% 34%)" : "hsl(220 20% 34%)",
      })),
    };
  });
}

export function packCardsFromCompany(data) {
  return packCardsFromGrants(listedPacks(data).map((pack) => ({
    name: templateLabel(pack, true),
    permissions: pack.permissions,
  })));
}

export function scopedSeatsFromCompany(data) {
  return (data?.employees || [])
    .filter((employee) => employee.role !== "system")
    .map((employee) => {
      const display = scopeStationsForDisplay(employee, data);
      if (display.homeIsCompanyRoot && !display.extras.length) return null;
      const covers = [...display.inherited, ...display.extras];
      if (!covers.length) return null;
      const position = (data?.smartPositions || []).find((item) => item.employeeId === employee.id);
      const grade = employeeJobGrade(employee, data);
      return {
        job: position?.title || employee.profile?.position || employee.position || "",
        grade: jobGradeLabel(grade) || "",
        who: employee.name || "",
        home: display.homeName || "",
        tone: AMBER,
        covers,
      };
    })
    .filter(Boolean);
}

export function scopedSeatsFromPeople(people) {
  return people
    .filter((row) => String(row.covers || "").trim())
    .map((row) => ({
      job: row.job,
      grade: row.grade,
      who: row.name,
      home: row.branch,
      tone: AMBER,
      covers: String(row.covers).split(/[،,]/).map((name) => name.trim()).filter(Boolean).map((name) => ({ name })),
    }))
    .filter((row) => row.covers.length > 1);
}

export { GREEN, GREENT, AMBER, MUTED, NAVY };
