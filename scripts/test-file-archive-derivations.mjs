import assert from "node:assert/strict";
// Updated: these derivations live in the backend shared module (base44/shared/*.ts, run via Node type stripping); there is no src/lib copy.
import {
  ACCESS_SCOPES,
  normalizeAccess,
  roleCanAccessScope,
  actorCanSeeStation,
  wouldCreateFolderCycle,
  findFolderCycle,
  checkAccessGate,
  checkStationBindingGate,
  checkCreateFolderGate,
  checkMoveFolderGate,
  checkUploadGate,
  countFilesInFolder,
  enrichFolder,
  deriveVisibleFolders,
  deriveRecentFiles,
  deriveArchiveStats,
  inferKind,
  formatSizeBytes,
} from "../base44/shared/fileArchiveDerivations.ts";

assert.deepEqual(ACCESS_SCOPES, ["restricted", "all_staff", "hr", "supervisors"]);
assert.equal(normalizeAccess("Restricted"), "restricted");
assert.equal(normalizeAccess("HR only"), "hr");
assert.equal(normalizeAccess("مشرفون"), "supervisors");
assert.equal(normalizeAccess(""), "all_staff");

assert.equal(roleCanAccessScope({ role: "employee" }, "all_staff"), true);
assert.equal(roleCanAccessScope({ role: "employee" }, "hr"), false);
assert.equal(roleCanAccessScope({ role: "hr" }, "hr"), true);
assert.equal(roleCanAccessScope({ role: "station_manager" }, "supervisors"), true);
assert.equal(roleCanAccessScope({ role: "station_manager" }, "restricted"), false);
assert.equal(roleCanAccessScope({ role: "employee", owner: true }, "restricted"), true);

assert.equal(actorCanSeeStation({ role: "employee", stationId: "jbl1" }, "jbl1"), true);
assert.equal(actorCanSeeStation({ role: "employee", stationId: "jbl1" }, "jbl2"), false);
assert.equal(actorCanSeeStation({ role: "employee", stationId: "jbl1" }, null, true), true);
assert.equal(actorCanSeeStation({ role: "director" }, "anywhere"), true);

assert.equal(inferKind("plan.pdf"), "PDF");
assert.equal(inferKind("stock.xlsx"), "XLSX");
assert.equal(inferKind("net.dwg"), "DWG");
assert.equal(formatSizeBytes(820_000), "801 KB");
assert.equal(formatSizeBytes(2_400_000), "2.3 MB");

const folders = [
  { id: "a", type: "folder", name: "A", parentId: null, access: "all_staff" },
  { id: "b", type: "folder", name: "B", parentId: "a", access: "all_staff" },
  { id: "c", type: "folder", name: "C", parentId: "b", access: "all_staff" },
];
assert.equal(wouldCreateFolderCycle(folders, "a", "c"), true);
assert.equal(wouldCreateFolderCycle(folders, "a", "a"), true);
assert.equal(wouldCreateFolderCycle(folders, "c", "a"), false);
assert.equal(wouldCreateFolderCycle(folders, "b", null), false);

const cyclic = [
  { id: "x", type: "folder", name: "X", parentId: "y" },
  { id: "y", type: "folder", name: "Y", parentId: "x" },
];
assert.ok(findFolderCycle(cyclic));

assert.equal(checkStationBindingGate({ stationId: null }).error, "MISSING_STATION_BINDING");
assert.equal(checkStationBindingGate({ companyWide: true }).ok, true);
assert.equal(checkStationBindingGate({ stationId: "jbl2" }).ok, true);
assert.equal(checkStationBindingGate({ stationId: "all" }).companyWide, true);

assert.equal(checkCreateFolderGate({ name: "" }).error, "NAME_REQUIRED");
assert.equal(checkCreateFolderGate({ name: "عقود", access: "restricted" }).access, "restricted");

assert.equal(checkMoveFolderGate(folders, "missing", null).error, "FOLDER_NOT_FOUND");
assert.equal(checkMoveFolderGate(folders, "a", "c").error, "FOLDER_CYCLE");
assert.equal(checkMoveFolderGate(folders, "c", "a").ok, true);

const NOW = new Date(2026, 7, 11, 12, 0, 0).getTime();
const nodes = [
  { id: "f1", type: "folder", name: "العقود", parentId: null, access: "restricted", companyWide: true, stationId: "all" },
  { id: "f2", type: "folder", name: "إجراءات", parentId: null, access: "all_staff", companyWide: true, stationId: "all" },
  { id: "f3", type: "folder", name: "شهادات", parentId: null, access: "hr", companyWide: true, stationId: "all" },
  {
    id: "d1", type: "file", name: "contract.pdf", parentId: "f1", kind: "PDF",
    companyWide: true, stationId: "all", sizeBytes: 1000,
    updatedAt: new Date(NOW - 2 * 3600_000).toISOString(),
  },
  {
    id: "d2", type: "file", name: "ops.pdf", parentId: "f2", kind: "PDF",
    stationId: "rbg", stationName: "رابغ", sizeBytes: 2000,
    updatedAt: new Date(NOW - 20 * 3600_000).toISOString(),
  },
  {
    id: "d3", type: "file", name: "cert.pdf", parentId: "f3", kind: "PDF",
    stationId: "jbl1", sizeBytes: 3000,
    updatedAt: new Date(NOW - 40 * 3600_000).toISOString(),
  },
];

const employee = { role: "employee", stationId: "rbg" };
assert.equal(checkAccessGate(employee, nodes, nodes[0]).error, "ACCESS_DENIED_BY_SCOPE");
assert.equal(checkAccessGate(employee, nodes, nodes[1]).ok, true);
assert.equal(checkAccessGate(employee, nodes, nodes.find((n) => n.id === "d3")).error, "ACCESS_DENIED_BY_SCOPE");

const hr = { role: "hr", stationId: "jbl1" };
assert.equal(checkAccessGate(hr, nodes, nodes.find((n) => n.id === "d3")).ok, true);

assert.equal(
  checkUploadGate({ name: "x.pdf", stationId: null, actor: employee }).error,
  "MISSING_STATION_BINDING",
);
assert.equal(
  checkUploadGate({ name: "x.pdf", stationId: "rbg", folderId: "f1", nodes, actor: employee }).error,
  "ACCESS_DENIED_BY_SCOPE",
);
assert.equal(
  checkUploadGate({ name: "x.pdf", stationId: "rbg", folderId: "f2", nodes, actor: employee }).ok,
  true,
);

assert.equal(countFilesInFolder(nodes, "f2"), 1);
const enriched = enrichFolder(nodes[1], nodes, employee, NOW);
assert.equal(enriched.fileCount, 1);
assert.ok(enriched.metaEn.includes("1 files"));

const visibleEmp = deriveVisibleFolders(nodes, employee);
assert.equal(visibleEmp.length, 1);
assert.equal(visibleEmp[0].id, "f2");

const visibleHr = deriveVisibleFolders(nodes, hr);
assert.equal(visibleHr.length, 2); // all_staff + hr (not restricted)

const recent = deriveRecentFiles(nodes, { role: "director", owner: true }, { folderId: "f2" });
assert.equal(recent.length, 1);
assert.equal(recent[0].id, "d2");

const scoped = deriveRecentFiles(nodes, { role: "director", owner: true }, { stationScope: "rbg" });
assert.ok(scoped.every((f) => f.companyWide || f.stationId === "rbg" || f.stationId === "all"));

const stats = deriveArchiveStats(nodes, { role: "director", owner: true });
assert.equal(stats.folderCount, 3);
assert.equal(stats.fileCount, 3);
assert.equal(stats.byAccess.restricted, 1);
assert.equal(stats.byAccess.hr, 1);

console.log("file archive derivations ok");
