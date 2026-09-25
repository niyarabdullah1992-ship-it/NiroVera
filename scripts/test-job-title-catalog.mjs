import assert from "node:assert/strict";
import {
  gradesForCatalogTitle,
  isCatalogManagerTitle,
  orderJobTitleCatalog,
} from "../src/lib/jobGradeTitles.js";

const pack = { id: "ops", ar: "التشغيل" };
const titles = [
  "فني صيانة",
  "فني تشغيل",
  "منسق عمليات",
  "مسؤول مالية",
  "مدير موارد بشرية",
  "مدير الموقع",
  "مدير المنطقة",
  "مدير تنفيذي",
  "مدير الفرع",
  "موظف إداري",
  "مراقب وردية",
  "مشغل محطة",
  "فنّي صيانة",
];

function grade(jobTitle, gradeNumber, order) {
  return { id: `${jobTitle}-${gradeNumber}`, jobTitle, titleKey: jobTitle, gradeNumber, order, title: gradeNumber };
}

const data = {
  jobGrades: [
    grade("مسؤول مالية", "OP4", 1),
    grade("مسؤول مالية", "OP3", 2),
    grade("مسؤول مالية", "OP2", 3),
    grade("مسؤول مالية", "OP1", 4),
    grade("مدير الفرع", "LD1", 1),
    grade("منسق عمليات", "OP1", 1),
    grade("موظف إداري", "OP1", 1),
    grade("مراقب وردية", "OP1", 1),
    grade("مشغل محطة", "OP1", 1),
    grade("فني تشغيل", "OP1", 1),
    grade("فني صيانة", "OP1", 9),
  ],
};

const rows = titles.map((label, index) => ({
  label,
  listId: "ops",
  pack,
  positionId: `pos-${index}`,
}));
rows.push({ label: "فني صيانة", listId: "ops", pack: null, positionId: "" });

const ordered = orderJobTitleCatalog(rows, data);
const labels = ordered.map((row) => row.label);

assert.equal(labels.filter((label) => label.includes("صيانة")).length, 1);
assert.equal(ordered.find((row) => row.label === "فني صيانة").removals.length, 2);

const managers = labels.filter((label) => isCatalogManagerTitle(label));
const others = labels.filter((label) => !isCatalogManagerTitle(label));
assert.deepEqual(labels, [...managers, ...others]);
assert.deepEqual(managers, [
  "مدير الفرع",
  "مدير تنفيذي",
  "مدير المنطقة",
  "مدير موارد بشرية",
  "مدير الموقع",
]);
assert.deepEqual(others, [
  "مسؤول مالية",
  "فني تشغيل",
  "فني صيانة",
  "مراقب وردية",
  "مشغل محطة",
  "منسق عمليات",
  "موظف إداري",
]);

assert.deepEqual(
  gradesForCatalogTitle(data, "مسؤول مالية").map((row) => row.gradeNumber),
  ["OP1", "OP2", "OP3", "OP4"],
);
assert.deepEqual(
  gradesForCatalogTitle(data, "فنّي صيانة").map((row) => row.gradeNumber),
  ["OP1"],
);

const tied = orderJobTitleCatalog(
  ["مشغل محطة", "مدير الموقع", "فني صيانة"].map((label) => ({ label, pack, positionId: label })),
  { jobGrades: [grade("مشغل محطة", "OP4", 1), grade("مدير الموقع", "OP1", 1), grade("فني صيانة", "OP4", 1)] },
).map((row) => row.label);
assert.deepEqual(tied, ["مدير الموقع", "فني صيانة", "مشغل محطة"]);

console.log("job title catalog order ok");
console.log(labels.join("، "));
