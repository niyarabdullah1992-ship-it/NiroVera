import assert from "node:assert/strict";
import { foldOrgLookup, orgLookupMatches, personLookupOption } from "../src/lib/orgLookup.js";

const saad = personLookupOption(
  { id: "e1", name: "سعد الشمري", profile: { position: "في صيانة" }, employeeNo: "NV-10021" },
  "فرع الخفجي",
  true,
);

assert.equal(orgLookupMatches(saad, ""), true);
assert.equal(orgLookupMatches(saad, "شمري صيانة"), true);
assert.equal(orgLookupMatches(saad, "صيانه"), true);
assert.equal(orgLookupMatches(saad, "سعد الخفجي"), true);
assert.equal(orgLookupMatches(saad, "10021"), true);
assert.equal(orgLookupMatches(saad, "NV-10021"), true);
assert.equal(orgLookupMatches(saad, "جدة"), false);
assert.equal(foldOrgLookup("إجازة"), "اجازه");

const branch = { id: "st", primary: "فرع رابغ", search: "فرع رابغ" };
assert.equal(orgLookupMatches(branch, "رابغ"), true);
assert.equal(orgLookupMatches(branch, "الخفجي"), false);

console.log("org lookup: PASS");
