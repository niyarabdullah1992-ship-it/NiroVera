import assert from "node:assert/strict";
import { buildSheetHtml } from "../src/lib/printSheet.js";

const html = buildSheetHtml({
  ar: true,
  kicker: "المهام والعمليات",
  title: "أمر عمل <script>",
  ref: "PERF-F_N1",
  company: "شركة التجربة",
  status: { label: "مكتملة", tone: "ok" },
  facts: [{ label: "الفرع", value: "الخفجي" }, { label: "فارغ", value: "" }, { label: "الإنجاز", value: "3/3", mono: true }],
  blocks: [
    { type: "table", heading: "السجل", cols: ["التاريخ", "البند"], rows: [["2026-10-01", "a&b"]], monoCols: [0] },
    { type: "trail", heading: "المسار", items: [{ at: "01/10", who: "عمر", what: "أنجز" }] },
    { type: "text", heading: "ملاحظة", body: "سطر أول\nسطر ثانٍ" },
  ],
  signatures: [{ label: "المنفّذ", name: "عمر ناصر" }, { label: "المعتمد" }],
});
assert.match(html, /dir="rtl"/);
assert.match(html, /أمر عمل &lt;script&gt;/, "title is escaped");
assert.ok(!html.includes("<script>window.addEventListener"), "no auto print unless asked");
assert.match(html, /a&amp;b/);
assert.ok(!html.includes("فارغ"), "blank facts are dropped");
assert.match(html, /<td class="m">2026-10-01<\/td>/);
assert.match(html, /التوقيعات/);
assert.match(html, /grid-template-columns:repeat\(2,/);
assert.match(html, /<p>سطر ثانٍ<\/p>/);
assert.match(buildSheetHtml({ ar: false, title: "x" }, { autoPrint: true }), /window\.print\(\)\}catch/);
assert.match(buildSheetHtml({ ar: false, title: "x" }), /dir="ltr"/);
console.log("print sheet ok");
