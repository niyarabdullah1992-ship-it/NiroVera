import { buildXlsx, namedRange, listValidation } from "../src/lib/simpleXlsx.js";

const extra = `<dataValidations count="1">${listValidation("I2:I80", "NV_BRANCHES", {
  promptTitle: "فرع المنصة",
  prompt: "اختر فرعاً",
})}</dataValidations>`;

const bytes = buildXlsx([
  { name: "الأشخاص", rows: [["الاسم", "الفرع"], ["", ""]], extra, rtl: true, freeze: true },
  { name: "الفروع", rows: [["الفرع"], ["فرع الخفجي"], ["فرع رابغ"], ["فرع جدة"]] },
], { definedNames: [namedRange("NV_BRANCHES", "الفروع", 2, 3, "A")] });

const text = new TextDecoder().decode(bytes);
const checks = {
  named: text.includes("NV_BRANCHES"),
  ref: text.includes("'الفروع'!$A$2:$A$4"),
  validation: text.includes("dataValidation"),
  formula: text.includes("<formula1>NV_BRANCHES</formula1>"),
  rtl: text.includes('rightToLeft="1"'),
  prompt: text.includes("اختر فرعاً"),
};

console.log(JSON.stringify(checks, null, 2));
if (Object.values(checks).some((ok) => !ok)) process.exit(1);
