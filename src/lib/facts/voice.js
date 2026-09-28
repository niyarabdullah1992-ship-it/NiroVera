/**
 * Voice / anonymous complaints.
 * Never store sender identity on the public report row.
 * Canonical: anonymousReports. Legacy: complaintQueue.
 */

export const VOICE_FACTS = Object.freeze([
  {
    id: "voice.anonymous",
    domain: "voice",
    scope: "report",
    home: "anonymousReports",
    path: "anonymousReports",
    blobCategory: "anonymousReports",
    writer: "voice-raise",
    stored: true,
    isolation: "companyId",
    legacyKeys: ["complaintQueue"],
    surfaceAr: "صوتي",
    noteAr: "صندوق مجهول — قابل للإلحاق. لا اسم مرسل على الصف.",
  },
  {
    id: "voice.public",
    domain: "voice",
    scope: "report",
    home: "publicReports",
    path: "publicReports",
    blobCategory: "publicReports",
    writer: "voice-raise",
    stored: true,
    isolation: "companyId",
    surfaceAr: "الشكاوى",
  },
  {
    id: "voice.receipt",
    domain: "voice",
    scope: "receipt",
    home: "AnonymousReportReceipt",
    path: "AnonymousReportReceipt",
    writer: "voice-raise",
    stored: true,
    isolation: "companyId",
    surfaceAr: "إيصال الصوت",
    noteAr: "الربط الخاص بالموظف — ليس على صف البلاغ العام.",
  },
  {
    id: "voice.escalation",
    domain: "voice",
    scope: "chain",
    home: "complaintEscalationChain | branchEscalationChains",
    path: "complaintEscalationChain",
    blobCategory: "complaintEscalationChain",
    writer: "voice-handle",
    stored: true,
    isolation: "companyId",
    surfaceAr: "سلسلة التصعيد",
  },
  {
    id: "voice.branchEscalationSla",
    domain: "voice",
    scope: "sla",
    home: "branchEscalationSla",
    path: "branchEscalationSla",
    blobCategory: "branchEscalationSla",
    writer: "voice-handle",
    stored: true,
    isolation: "companyId",
    surfaceAr: "مهل تصعيد الفرع",
    noteAr: "خريطة stationId → خطوات SLA. كائن وليس مصفوفة.",
  },
]);

export function readAnonymousReports(company) {
  return Array.isArray(company?.anonymousReports) ? company.anonymousReports : [];
}

export function readPublicReports(company) {
  return Array.isArray(company?.publicReports) ? company.publicReports : [];
}

export function readBranchEscalationSla(company) {
  const bag = company?.branchEscalationSla;
  return bag && typeof bag === "object" && !Array.isArray(bag) ? bag : {};
}

export function readBranchEscalationChains(company) {
  const bag = company?.branchEscalationChains;
  return bag && typeof bag === "object" && !Array.isArray(bag) ? bag : {};
}
