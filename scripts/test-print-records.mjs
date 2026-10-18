import assert from "node:assert/strict";
import { taskWorkOrderSheet, workProofSheet, visitorPassSheet, maskId, vehicleLine, printStamp } from "../src/lib/printRecords.js";
import { buildSheetHtml } from "../src/lib/printSheet.js";

assert.equal(maskId("1098765432"), "•••• 5432");
assert.equal(maskId("12"), "12");
assert.equal(printStamp("2026-10-05"), "05/10/2026");
assert.equal(vehicleLine({ maker: "تويوتا", model: "هايلكس", plateLetters: "أ ب", plateNumbers: "1234" }), "تويوتا هايلكس · أ ب 1234");

const t = taskWorkOrderSheet({
  ar: true, doneN: 5, targetN: 10, owner: "عمر", branch: "الخفجي", doers: "عمر، سارة",
  status: { label: "قيد التنفيذ", tone: "warn" },
  task: { title: "جولة", ref: "T-1", dueAt: "2026-10-20", comments: [
    { kind: "log", authorName: "عمر", amount: 3, at: "2026-10-01T08:00:00", text: "بداية" },
    { kind: "log", authorName: "سارة", amount: 2, at: "2026-10-02T08:00:00" },
    { kind: "chat", authorName: "x", text: "ليس سجلاً" },
  ] },
});
assert.equal(t.blocks.find((b) => b.heading.startsWith("سجل الإنجاز")).rows.length, 2);
assert.deepEqual(t.blocks.find((b) => b.heading === "حصص الفريق").rows[0], ["عمر", "3", "60%"]);
assert.equal(t.signatures[0].name, "عمر");

const w = workProofSheet({ ar: true, proof: { entityName: "شركة", ref: "WP-1" }, crew: [{ name: "علي", id: "2233445566", inAt: "2026-10-01T07:00:00" }], vehicles: [] });
assert.deepEqual(w.blocks[0].rows[0], ["علي", "•••• 5566", "", "01/10/2026 07:00", "في الموقع"]);
assert.equal(w.blocks.length, 1, "no vehicle table when there are none");

const v = visitorPassSheet({ ar: true, proof: { hostName: "نيار", ref: "VP-1" }, people: [{ name: "زائر", id: "998877" }], from: "2026-10-01", to: "2026-10-03" });
assert.equal(v.title, "زائر");
assert.equal(v.signatures.length, 3);
const html = buildSheetHtml(v);
assert.ok(!html.includes("998877"), "full ID never printed");
assert.match(html, /•••• 8877/);
console.log("print records ok");
{
  const { requestDecisionSheet } = await import("../src/lib/printRecords.js");
  const s = requestDecisionSheet({ ar: true, row: { title: "إجازة سنوية", employeeName: "سارة", statusLabel: "معتمد", at: "2026-10-01T09:00:00", ref: "—", requestId: "r1", source: { startDate: "2026-10-10", endDate: "2026-10-14", days: 5 } }, trail: [{ at: "2026-10-01T09:00:00", by: "نيار", text: "اعتمد" }] });
  assert.equal(s.ref, "r1");
  assert.equal(s.facts.find((f) => f.label === "الأيام").value, "5");
  assert.equal(s.blocks[0].items[0].who, "نيار");
  console.log("request sheet ok");
}
{
  const { workProofSheet } = await import("../src/lib/printRecords.js");
  const s = workProofSheet({ ar: true, proof: {}, crew: [], vehicles: [{ maker: "", plate: "" }] });
  assert.equal(s.blocks.length, 1, "an empty placeholder vehicle prints no table");
  console.log("empty vehicle ok");
}
