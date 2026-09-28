/**
 * Proof Cycle steps 2–4 and 6: task → review → escalation → client proof.
 * Signing (step 5) lives under signing.js so it is not recoupled to WorkProof.
 *
 * Live proof bag: workProofs (CompanyDataBlob). Typed entity WorkProof is retired —
 * do-not-write. Never create entities.WorkProof rows.
 */

export const PROOF_FACTS = Object.freeze([
  {
    id: "proof.task",
    domain: "proof",
    scope: "task",
    home: "tasks",
    path: "tasks",
    blobCategory: "tasks",
    writer: "ops-task",
    stored: true,
    isolation: "companyId",
    proofCycle: 2,
    legacyKeys: ["operationsTasks"],
    surfaceAr: "المهام",
    noteAr: "الجهد والبوابة الميدانية والدليل والإقرار. operationsTasks قراءة مرة فقط.",
  },
  {
    id: "proof.review",
    domain: "proof",
    scope: "taskTrail",
    home: "tasks[].review / trail",
    path: "review",
    writer: "ops-review",
    stored: true,
    isolation: "companyId",
    proofCycle: 3,
    surfaceAr: "المراجعة",
    noteAr: "اعتماد / رفض بسبب مكتوب — على مسار المهمة.",
  },
  {
    id: "proof.escalation",
    domain: "proof",
    scope: "taskTrail",
    home: "tasks[].escalation",
    path: "escalation",
    writer: "derived-only",
    stored: true,
    isolation: "companyId",
    proofCycle: 4,
    surfaceAr: "التصعيد",
    noteAr: "تصعيد تلقائي عند نفاد حصة الوقت بلا تقدّم.",
  },
  {
    id: "proof.workProof",
    domain: "proof",
    scope: "workProof",
    home: "workProofs",
    path: "workProofs",
    blobCategory: "workProofs",
    writer: "ops-task",
    stored: true,
    isolation: "companyId",
    proofCycle: 2,
    surfaceAr: "إثبات العمل",
    noteAr: "الشكل الحي: ref / sealId على workProofs. لا signToken هنا.",
  },
  {
    id: "proof.workProofEntity",
    domain: "proof",
    scope: "retired",
    home: "WorkProof",
    path: "WorkProof",
    writer: "do-not-write",
    stored: false,
    isolation: "companyId",
    legacyKeys: ["WorkProof"],
    surfaceAr: "كيان WorkProof (متقاعد)",
    noteAr: "جدول Typed غير مستخدم وقت التشغيل. الكتابة ممنوعة — المنزل الحي workProofs.",
  },
  {
    id: "proof.client",
    domain: "proof",
    scope: "clientProof",
    home: "ClientProof",
    path: "ClientProof",
    writer: "ops-review",
    stored: true,
    isolation: "companyId",
    proofCycle: 6,
    surfaceAr: "إثبات العميل",
    noteAr: "حقول مسموح بها + بصمة فقط. لا أسماء موظفين ولا رواتب.",
  },
  {
    id: "proof.visitor",
    domain: "proof",
    scope: "visitorProof",
    home: "visitorProofs",
    path: "visitorProofs",
    blobCategory: "visitorProofs",
    writer: "ops-task",
    stored: true,
    isolation: "companyId",
    surfaceAr: "إثبات الزائر",
  },
  {
    id: "proof.dailyReport",
    domain: "proof",
    scope: "report",
    home: "reports",
    path: "reports",
    blobCategory: "reports",
    writer: "ops-task",
    stored: true,
    isolation: "companyId",
    legacyKeys: ["dailyReports", "reportAnalytics"],
    surfaceAr: "التقرير اليومي",
  },
]);

/** Retired typed entities — never invoke entities.<Name>.create/update/bulk*. */
export const RETIRED_PROOF_ENTITIES = Object.freeze(["WorkProof"]);

export function readTasks(company) {
  return Array.isArray(company?.tasks) ? company.tasks : [];
}

export function readWorkProofs(company) {
  return Array.isArray(company?.workProofs) ? company.workProofs : [];
}

export function readVisitorProofs(company) {
  return Array.isArray(company?.visitorProofs) ? company.visitorProofs : [];
}

export function readReports(company) {
  return Array.isArray(company?.reports) ? company.reports : [];
}

export function workProofsForStation(company, stationId) {
  const sid = String(stationId || "");
  const rows = readWorkProofs(company);
  if (!sid) return rows;
  return rows.filter((row) => String(row?.stationId || "") === sid);
}

export function assertWorkProofBlobHome(categoryOrEntity) {
  const key = String(categoryOrEntity || "");
  if (key === "WorkProof" || RETIRED_PROOF_ENTITIES.includes(key)) {
    throw new Error('do-not-write: "WorkProof" entity is retired — persist workProofs blob only');
  }
  return key;
}
