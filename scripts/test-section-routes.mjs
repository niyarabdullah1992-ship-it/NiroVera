import assert from "node:assert/strict";
import { sectionRouteFor, sectionRoutesForCard } from "../src/lib/sectionRoutes.js";

// Overtime (107) → طلباتي: management side for the manager, own side for the worker.
assert.equal(sectionRouteFor("overtime_107", { audience: "manager" }).href, "/app/requests/manage");
assert.equal(sectionRouteFor("overtime_107", { audience: "employee" }).href, "/app/requests");
// Night first aid / transfer / food → السلامة for management; nothing for the worker.
assert.equal(sectionRouteFor("night_facilities", { audience: "manager" }).section, "safety");
assert.equal(sectionRouteFor("night_facilities", { audience: "employee" }), null);
// Roster-fixable checks stay on the roster.
assert.equal(sectionRouteFor("weekly_rest", { audience: "manager" }), null);
// A grouped card: one link per section, never the employee file.
const links = sectionRoutesForCard({ audience: "manager", gateId: "hours_48", items: [{ gateId: "overtime_107" }, { gateId: "night_facilities" }, { gateId: "night_rotate" }] });
assert.deepEqual(links.map((row) => row.section), ["requests", "safety"]);
assert.ok(links.every((row) => !row.href.startsWith("/app/employees")));
console.log("PASS section routes");
