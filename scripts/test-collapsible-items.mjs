import assert from "node:assert/strict";
import { EMPTY_EXPANDED, isItemExpanded, toggleExpanded } from "../src/lib/collapsibleItems.js";

// Folded by default.
assert.equal(isItemExpanded(EMPTY_EXPANDED, "a", { visibleIds: ["a", "b"] }), false);
// A list of one opens by itself.
assert.equal(isItemExpanded(EMPTY_EXPANDED, "a", { visibleIds: ["a"] }), true);
// The deep-linked item opens by itself; others stay folded.
assert.equal(isItemExpanded(EMPTY_EXPANDED, "b", { visibleIds: ["a", "b"], focusId: "b" }), true);
assert.equal(isItemExpanded(EMPTY_EXPANDED, "a", { visibleIds: ["a", "b"], focusId: "b" }), false);
// Ids compare as strings.
assert.equal(isItemExpanded(EMPTY_EXPANDED, 7, { visibleIds: [7], focusId: "" }), true);
assert.equal(isItemExpanded(EMPTY_EXPANDED, 7, { visibleIds: ["1", "7"], focusId: 7 }), true);

// The person's click wins over both automatic opens.
let s = toggleExpanded(EMPTY_EXPANDED, "a", true);
assert.equal(isItemExpanded(s, "a", { visibleIds: ["a"] }), false, "closing the only item keeps it closed");
s = toggleExpanded(s, "a", false);
assert.equal(isItemExpanded(s, "a", { visibleIds: ["a", "b"] }), true, "reopened by hand");
s = toggleExpanded(EMPTY_EXPANDED, "b", true);
assert.equal(isItemExpanded(s, "b", { visibleIds: ["a", "b"], focusId: "b" }), false, "closing the deep-linked item");

// The open set survives filtering: an item opened, filtered out and back, is still open.
s = toggleExpanded(EMPTY_EXPANDED, "c", false);
assert.equal(isItemExpanded(s, "c", { visibleIds: ["c", "d"] }), true);
assert.equal(isItemExpanded(s, "c", { visibleIds: ["c", "d", "e"] }), true);

// Toggling is pure and idempotent per direction.
const before = { open: ["x"], closed: [] };
const after = toggleExpanded(before, "x", true);
assert.deepEqual(before, { open: ["x"], closed: [] });
assert.deepEqual(after, { open: [], closed: ["x"] });
assert.equal(toggleExpanded(before, "", true), before);
assert.equal(isItemExpanded(before, "", { visibleIds: [""] }), false);

console.log("test-collapsible-items: all assertions passed");
