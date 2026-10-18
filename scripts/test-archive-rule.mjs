import assert from "node:assert/strict";
import { ARCHIVE_AFTER_DAYS, archiveDueAt, isPastArchiveDue, daysUntilArchive } from "../src/lib/archiveRule.js";

const NOW = Date.parse("2026-10-18T09:00:00Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();
assert.equal(ARCHIVE_AFTER_DAYS, 30);
// A fresh decision stays on its face; after 30 days it moves to the archive.
assert.equal(isPastArchiveDue({ settledAt: ago(5) }, NOW), false);
assert.equal(isPastArchiveDue({ settledAt: ago(31) }, NOW), true);
// The effect holds it: an approved leave ending in the future stays even after 30 days from approval.
assert.equal(isPastArchiveDue({ settledAt: ago(40), holdUntil: "2026-11-02" }, NOW), false);
// Withdrawn / void goes at once.
assert.equal(isPastArchiveDue({ settledAt: ago(0), immediate: true }, NOW), true);
// An unknown decision time never loses the item from its face.
assert.equal(isPastArchiveDue({ settledAt: "" }, NOW), false);
assert.equal(daysUntilArchive({ settledAt: ago(10) }, NOW), 20);
assert.ok(Number.isFinite(archiveDueAt({ settledAt: ago(1) })));
console.log("PASS archive rule");
