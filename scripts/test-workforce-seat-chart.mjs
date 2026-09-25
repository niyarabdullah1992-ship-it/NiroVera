import assert from "node:assert/strict";
import { buildWorkforceSeatChart, flattenSeatChart } from "../src/lib/workforceSeatChart.js";

const data = {
  ownerId: "o1",
  employees: [
    { id: "o1", name: "المالك", role: "owner", stationId: "hq", employeeNo: "NV-HQ-19-0001", profile: { position: "الرئيس التنفيذي" } },
    { id: "m1", name: "سالم", role: "employee", stationId: "khafji", employeeNo: "NV-KH-21-0004", profile: { directManagerId: "o1", position: "مدير الفرع" } },
    {
      id: "a1",
      name: "فهد",
      role: "employee",
      stationId: "port",
      profile: { directManagerId: "m1", position: "فني تشغيل" },
      actingAssignments: [{ stationId: "port", title: "مشرف تشغيل", until: "2099-01-01" }],
    },
    { id: "j1", name: "ليان", role: "employee", stationId: "khafji", jobTitle: "محاسب", profile: { directManagerId: "m1" } },
    { id: "n1", name: "بلا مسمى", role: "employee", stationId: "khafji", profile: { directManagerId: "m1" } },
  ],
  orgSeats: [
    { id: "s1", employeeId: "m1", stationId: "khafji", title: "مدير الفرع", reportsToEmployeeId: "o1" },
    { id: "s2", employeeId: "a1", stationId: "port", title: "فني تشغيل", reportsToEmployeeId: "m1" },
    { id: "sv", stationId: "khafji", title: "فني صيانة", reportsToEmployeeId: "m1" },
  ],
  stations: [
    { id: "hq", name: "الرئاسة", code: "HQ", isCompanyRoot: true, managerId: "o1" },
    { id: "khafji", name: "فرع الخفجي", code: "KH", parentStationId: "hq", managerId: "m1", unitKind: "branch" },
    { id: "port", name: "ميناء الدمام", parentStationId: "khafji", unitKind: "branch" },
  ],
};

const chart = buildWorkforceSeatChart(data, { ar: true, meId: "a1" });
const flat = flattenSeatChart(chart.roots);
const byId = new Map(flat.map((node) => [node.id, node]));

assert.equal(chart.roots.length, 1);
assert.equal(chart.roots[0].id, "o1");
assert.equal(byId.get("o1").kind, "branch");
assert.equal(byId.get("o1").kindTag, "فرع · HQ 🔒");
assert.equal(byId.get("o1").title, "الرئيس التنفيذي");
assert.equal(byId.get("o1").empLine, "NV-HQ-19-0001");
assert.equal(byId.get("o1").unit || "", "");
assert.ok(byId.get("o1").direct >= 1);

assert.equal(byId.get("m1").kind, "branch");
assert.equal(byId.get("m1").kindTag, "فرع · KH");
assert.equal(byId.get("m1").title, "مدير الفرع");

assert.equal(byId.get("a1").kind, "person");
assert.equal(byId.get("a1").kindTag, "موظف");
assert.equal(byId.get("a1").title, "فني تشغيل");
assert.equal(byId.get("j1").title, "محاسب");
assert.equal(byId.get("n1").title, "");
assert.equal(byId.get("a1").acting, true);
assert.match(byId.get("a1").actingText, /^مكلَّف حتى /);
assert.equal(byId.get("a1").isMe, true);
assert.ok(byId.get("a1").unit);

const vacant = flat.find((node) => node.seatId === "sv");
assert.ok(vacant);
assert.equal(vacant.kind, "vacant");
assert.equal(vacant.kindTag, "شاغرة");
assert.equal(vacant.vacant, true);
assert.equal(vacant.name, "شاغرة");
assert.equal(vacant.title, "فني صيانة");
const parent = flat.find((node) => (node.children || []).some((child) => child.id === vacant.id));
assert.equal(parent.id, "m1");

const portVacant = flat.find((node) => node.id === "vacant-station:port");
assert.ok(portVacant);
assert.equal(portVacant.kind, "vacant");

const vacated = structuredClone(data);
vacated.employees.find((item) => item.id === "m1").profile.unseatedAt = "2026-09-23T00:00:00.000Z";
vacated.orgSeats.find((item) => item.id === "s1").employeeId = null;
vacated.stations.find((item) => item.id === "khafji").managerId = null;
const after = buildWorkforceSeatChart(vacated, { ar: true });
const afterFlat = flattenSeatChart(after.roots);
assert.equal(afterFlat.some((node) => node.id === "m1"), false);
assert.ok(afterFlat.some((node) => node.id === "a1"));
const opened = afterFlat.find((node) => node.seatId === "s1");
assert.ok(opened);
assert.equal(opened.vacant, true);
assert.equal(opened.name, "شاغرة");
const openedParent = afterFlat.find((node) => (node.children || []).some((child) => child.seatId === "s1"));
assert.equal(openedParent.id, "o1");

console.log("workforce seat chart ok", flat.map((node) => `${node.kindTag}:${node.name}`).join(" | "));
