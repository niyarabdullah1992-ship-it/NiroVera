import assert from "node:assert/strict";
import { archiveTone, inArchivePeriod, archiveOutcomes, groupArchiveByMonth, archiveCsv, archiveMonthKey } from "../src/lib/archiveFacts.js";

assert.equal(archiveTone("مرفوض"), "bad");
assert.equal(archiveTone("مكتمل"), "ok");
assert.equal(archiveTone("غادر"), "ok");
assert.equal(archiveTone("أُعيد بملاحظة"), "warn");
assert.equal(archiveTone("مستلَم"), "ok");
assert.equal(archiveTone("شيء آخر"), "mute");
assert.equal(archiveTone("مكتمل مع رفض"), "warn");

const now = new Date("2026-10-15T10:00:00");
assert.equal(inArchivePeriod("2026-10-02", "month", now), true);
assert.equal(inArchivePeriod("2026-09-02", "month", now), false);
assert.equal(inArchivePeriod("2026-08-02", "quarter", now), true);
assert.equal(inArchivePeriod("2026-07-30", "quarter", now), false);
assert.equal(inArchivePeriod("2025-12-30", "year", now), false);
assert.equal(inArchivePeriod("", "month", now), false);
assert.equal(inArchivePeriod("", "all", now), true);

const items = [
  { id: 1, title: "أ", badge: "مكتمل", date: "2026-10-10T09:00:00" },
  { id: 2, title: "ب", badge: "مرفوض", date: "2026-09-01T09:00:00" },
  { id: 3, title: "ج", badge: "مكتمل", date: "2026-10-12T09:00:00" },
  { id: 4, title: "د", badge: "", date: "" },
];
assert.deepEqual(archiveOutcomes(items).map((o) => [o.badge, o.count, o.tone]), [["مكتمل", 2, "ok"], ["مرفوض", 1, "bad"]]);
const groups = groupArchiveByMonth(items);
assert.deepEqual(groups.map((g) => g.month), ["2026-10", "2026-09", "none"]);
assert.deepEqual(groups[0].rows.map((r) => r.id), [3, 1]);
assert.equal(archiveMonthKey("2026-10-10"), "2026-10");

const csv = archiveCsv([{ title: 'عنوان, بفاصلة', badge: "مكتمل", text: "سطر\nثاني", date: "2026-10-10T09:05:00" }]);
assert.ok(csv.startsWith("﻿"));
assert.ok(csv.includes('"عنوان, بفاصلة"'));
assert.ok(csv.includes("2026-10-10 09:05"));
assert.ok(!csv.split("\r\n")[1].includes("\n"));
console.log("archive facts ok");

{
  const { archiveHistogram, archiveFacet, groupArchiveBy, archiveHighlight } = await import("../src/lib/archiveFacts.js");
  const now = new Date("2026-10-15T10:00:00");
  const items = [
    { id: 1, date: "2026-10-02T09:00:00", person: "عمر", branch: "الخفجي", badge: "مكتملة" },
    { id: 2, date: "2026-10-09T09:00:00", person: "عمر", branch: "رابغ", badge: "مرفوضة" },
    { id: 3, date: "2026-08-01T09:00:00", person: "سارة", branch: "الخفجي", badge: "مكتملة" },
    { id: 4, date: "2025-08-01T09:00:00", person: "", branch: "الخفجي", badge: "مكتملة" },
  ];
  const h = archiveHistogram(items, now);
  assert.equal(h.length, 12);
  assert.equal(h[11].month, "2026-10");
  assert.equal(h[11].count, 2);
  assert.equal(h[9].count, 1);
  assert.equal(h[0].month, "2025-11");
  assert.deepEqual(archiveFacet(items, "person"), [{ value: "عمر", count: 2 }, { value: "سارة", count: 1 }]);
  const byP = groupArchiveBy(items, "person");
  assert.deepEqual(byP.map((g) => g.key), ["عمر", "سارة", "none"]);
  assert.equal(byP[0].rows[0].id, 2);
  assert.deepEqual(groupArchiveBy(items, "month").map((g) => g.key), ["2026-10", "2026-08", "2025-08"]);
  assert.deepEqual(groupArchiveBy(items, "outcome").map((g) => g.key), ["مكتملة", "مرفوضة"]);
  const hl = archiveHighlight("جولة فرع الخفجي", "الخفجي");
  assert.deepEqual(hl, [{ text: "جولة فرع ", hit: false }, { text: "الخفجي", hit: true }]);
  assert.deepEqual(archiveHighlight("abc", ""), [{ text: "abc", hit: false }]);
  console.log("archive facets ok");
}
{
  const { archiveTone } = await import("../src/lib/archiveFacts.js");
  assert.equal(archiveTone("مدفوع"), "ok");
  console.log("paid tone ok");
}
