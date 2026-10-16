/**
 * «أنظمة الوزارة — ما يخص العقد» — rows for the contract tab of the employee file.
 * Status is read from the file through the existing derivations; rules the platform does not run
 * read «للعلم». Pure (node-testable); the component only lays them out.
 */
import { deriveArt55Conversion, deriveRegs1Conversion } from "./contractLawDerivations.js";
import { deriveSaudiStatus, localDateKey } from "./complianceDerivations.js";
import { isFixedContractType } from "./employeeProfileFields.js";
import { deriveReturnTicket } from "./returnTicket.js";
import {
  ajeerRegsNote,
  contractEndModelNote,
  labourCourtRegsNote,
  nonSaudiFixedRegsNote,
  repatriationModelNote,
  tempConversionRegsNote,
  workplaceClauseRegsNote,
} from "./implementingRegsNotes.js";

const info = (ar) => (ar ? "للعلم" : "For reference");

export const CONTRACT_MINISTRY_CARDS = (ar = true) => [
  {
    key: "labour",
    title: ar ? "نظام العمل — نوع العقد" : "Labour Law — contract type",
    scope: ar ? "تحوّل المحدد المدة إلى غير محدد (55)." : "A fixed term turning open-ended (55).",
  },
  {
    key: "regs",
    badge: ar ? "اللائحة" : "Regs",
    title: ar ? "اللائحة التنفيذية — العقد" : "Implementing Regulations — the contract",
    scope: ar ? "المؤقت والعرضي (م1)، عقد غير السعودي (م12)، أجير (م13)، شرط مكان العمل (م20)، المحاكم العمالية." : "Temporary and casual (Art. 1), non-Saudi contract (12), Ajeer (13), workplace clause (20), labour courts.",
  },
  {
    key: "model",
    badge: ar ? "النموذج الموحد" : "Model reg.",
    title: ar ? "النموذج الموحد — انتهاء العقد والعودة" : "Model regulation — the end and the return",
    scope: ar ? "حالات انتهاء العقد (م57)، تذكرة العودة عند انتهاء الخدمة (م11)." : "The cases that end the contract (Art. 57), the return ticket (Art. 11).",
  },
];

export function contractMinistryRows(employee = {}, { today, ar = true } = {}) {
  const day = today || localDateKey();
  const profile = employee?.profile || {};
  const rows = [];

  const art55 = deriveArt55Conversion({ ...employee, today: day });
  rows.push({
    key: "labour-55",
    source: "labour",
    badge: ar ? "م 55" : "Art. 55",
    title: ar ? "المحدد المدة يصير غير محدد بالاستمرار أو بثلاثة تجديدات أو أربع سنوات" : "A fixed term becomes open-ended on continuing, three renewals or four years",
    note: ar ? "للسعودي فقط — يُكتب النوع في الملف عند التحول." : "Saudis only — the file type is rewritten on conversion.",
    ...(art55.converts
      ? { status: "alert", pill: ar ? "يتحول — طبّق المادة 55" : "Converts — apply Art. 55" }
      : profile.art55AppliedAt
        ? { status: "settled", pill: ar ? `طُبّقت ${profile.art55AppliedAt}` : `Applied ${profile.art55AppliedAt}` }
        : art55.approaching
          ? { status: "waiting", pill: ar ? "قريب" : "Near" }
          : art55.applies
            ? { status: "settled", pill: ar ? "مستوفى" : "Met" }
            : { status: "void", pill: ar ? "لا ينطبق" : "Not applicable" }),
  });

  const regs1 = deriveRegs1Conversion({ ...employee, today: day });
  rows.push({
    key: "regs-1",
    source: "regs",
    badge: ar ? "اللائحة م1" : "Regs Art. 1",
    title: ar ? `المؤقت أو العرضي فوق ${regs1.limit} يوماً يخضع لكل أحكام النظام` : `Temporary or casual past ${regs1.limit} days falls under the whole Law`,
    note: tempConversionRegsNote(ar, day),
    sub: regs1.converts ? (ar ? regs1.reason : regs1.reasonEn) : undefined,
    ...(!regs1.applies
      ? { status: "void", pill: regs1.seasonal ? (ar ? "موسمي — لا ينطبق" : "Seasonal — n/a") : (ar ? "لا ينطبق" : "Not applicable") }
      : regs1.needsStart
        ? { status: "waiting", pill: ar ? "يحتاج تاريخ البداية" : "Needs a start date" }
        : regs1.converts
          ? { status: "alert", pill: ar ? `تحوّل منذ ${regs1.convertsOn}` : `Converted since ${regs1.convertsOn}` }
          : regs1.approaching
            ? { status: "waiting", pill: ar ? `${regs1.limit - regs1.days} يوماً للتحول` : `${regs1.limit - regs1.days} days to convert` }
            : { status: "settled", pill: ar ? `${regs1.days} من ${regs1.limit} يوماً` : `${regs1.days} of ${regs1.limit} days` }),
  });

  const identity = deriveSaudiStatus(employee);
  const nonSaudi = identity.saudi !== true && (identity.nationalitySaudi === false || identity.idKind === "iqama");
  const typeRaw = String(profile.contract?.type || profile.contractType || "").trim();
  const type = !typeRaw ? "" : isFixedContractType(typeRaw) ? "fixed" : "indefinite";
  rows.push({
    key: "regs-12",
    source: "regs",
    badge: ar ? "اللائحة م12" : "Regs Art. 12",
    title: ar ? "عقد غير السعودي محدد المدة دائماً" : "A non-Saudi's contract is always fixed-term",
    note: nonSaudiFixedRegsNote(ar),
    ...(!nonSaudi
      ? { status: "void", pill: identity.saudi === true ? (ar ? "لا ينطبق" : "Not applicable") : info(ar) }
      : type === "fixed"
        ? { status: "settled", pill: ar ? "محدد المدة" : "Fixed term" }
        : type === "indefinite"
          ? { status: "alert", pill: ar ? "مسجّل غير محدد المدة" : "Recorded open-ended" }
          : { status: "waiting", pill: ar ? "نوع العقد غير مسجّل" : "Type not recorded" }),
  });
  rows.push({ key: "regs-13", source: "regs", badge: ar ? "اللائحة م13" : "Regs Art. 13", title: ar ? "العمل عبر برنامج أجير" : "Work through Ajeer", note: ajeerRegsNote(ar), status: "void", pill: info(ar) });
  rows.push({ key: "regs-20", source: "regs", badge: ar ? "اللائحة م20" : "Regs Art. 20", title: ar ? "شرط مكان العمل في العقد = موافقة على النقل (المادة 58)" : "A workplace clause = consent to transfer (Art. 58)", note: workplaceClauseRegsNote(ar), status: "void", pill: info(ar) });
  rows.push({ key: "regs-courts", source: "regs", badge: ar ? "اللائحة م1/2 · 17 · 27" : "Regs 1(2) · 17 · 27", title: ar ? "اختصاص المحاكم العمالية" : "Labour-court jurisdiction", note: labourCourtRegsNote(ar), status: "void", pill: info(ar) });
  const ticket = deriveReturnTicket(employee);
  rows.push({
    key: "model-11",
    source: "model",
    badge: ar ? "النموذج الموحد م11" : "Model Art. 11",
    title: ar ? "تذكرة عودة غير السعودي عند انتهاء الخدمة على المنشأة (المادة 40/1)" : "A non-Saudi's return ticket at the end of service is on the company (Art. 40(1))",
    note: repatriationModelNote(ar),
    ...(ticket.state === "owed"
      ? { status: "alert", pill: ar ? "مستحقة — لم تُسجَّل" : "Owed — not recorded" }
      : ticket.state === "provided"
        ? { status: "settled", pill: ar ? `أُمِّنت ${ticket.ticket.providedAt}` : `Provided ${ticket.ticket.providedAt}` }
        : ticket.state === "excepted"
          ? { status: "settled", pill: ar ? "استثناء م11/4 مسجّل" : "Art. 11(4) exception" }
          : ticket.state === "na"
            ? { status: "void", pill: ar ? "لا ينطبق" : "Not applicable" }
            : ticket.state === "unknown"
              ? { status: "waiting", pill: ar ? "الجنسية غير محسومة" : "Nationality unsettled" }
              : { status: "void", pill: ar ? "عند انتهاء الخدمة" : "At the end of service" }),
  });
  rows.push({ key: "model-57", source: "model", badge: ar ? "النموذج الموحد م57" : "Model Art. 57", title: ar ? "حالات انتهاء عقد العمل" : "When the contract ends", note: contractEndModelNote(ar), status: "void", pill: info(ar) });
  return rows;
}
