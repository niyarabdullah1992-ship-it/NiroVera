// Fixes from the review of the November update: an impossible register date is refused, and a branch HR
// manager who is replaced gets their own title back.
import assert from "node:assert/strict";
import { checkRegisterAnnualDueGate } from "../src/lib/commercialRegister.js";
import { linkBranchHr } from "../src/lib/hrTree.js";

assert.equal(checkRegisterAnnualDueGate("2026-02-30").ok, false, "30 February is not a date");
assert.equal(checkRegisterAnnualDueGate("2026-13-01").ok, false);
assert.deepEqual(checkRegisterAnnualDueGate("2028-02-29"), { ok: true, value: "2028-02-29" });
assert.deepEqual(checkRegisterAnnualDueGate(""), { ok: true, value: "" });

const data = {
  ownerId: "ceo",
  stations: [{ id: "hq", name: "المقر", isCompanyRoot: true }, { id: "a", name: "فرع أ", parentStationId: "hq" }],
  employees: [
    { id: "ceo", name: "نورة", role: "director", stationId: "hq", profile: { position: "الرئيس التنفيذي" } },
    { id: "c", name: "كاشير", role: "employee", stationId: "a", profile: { position: "أمين صندوق" } },
    { id: "d", name: "دانة", role: "employee", stationId: "a", profile: { position: "محاسبة" } },
  ],
  orgSeats: [],
};
assert.equal(linkBranchHr(data, "a", "c").ok, true);
const c = data.employees.find((e) => e.id === "c");
assert.equal(c.profile.position, "مدير موارد بشرية", "linking retitles the appointee");
assert.equal(linkBranchHr(data, "a", "d").ok, true);
assert.equal(c.profile.position, "أمين صندوق", "the replaced HR manager serves no branch and gets the old title back");
assert.equal(c.hrTitleBefore, undefined);

console.log("PASS update review fixes: register date gate and HR title restore");
