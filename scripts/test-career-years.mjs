// Long careers: three newest years in view, the picked year always shown, the rest behind one fold.
import assert from "node:assert/strict";
import { careerVisibleYears } from "../src/lib/dutyYears.js";
const years = Array.from({ length: 9 }, (_, i) => ({ id: `y${9 - i}`, covered: true }));
const a = careerVisibleYears(years);
assert.deepEqual(a.shown.map((y) => y.id), ["y9", "y8", "y7"]);
assert.equal(a.hidden, 6);
const b = careerVisibleYears(years, { openId: "y2" });
assert.deepEqual(b.shown.map((y) => y.id), ["y9", "y8", "y7", "y2"], "a picked old year joins the view");
assert.equal(b.hidden, 5);
assert.equal(careerVisibleYears(years, { showAll: true }).shown.length, 9);
assert.equal(careerVisibleYears(years.slice(0, 3)).hidden, 0);
console.log("career-years: PASS");
