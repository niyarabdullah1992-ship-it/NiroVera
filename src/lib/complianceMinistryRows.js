/**
 * «أنظمة الوزارة — السجلات والتدريب» on the ministry-compliance page (/app/hr?tab=compliance).
 * Implementing Regulations the platform runs for the establishment: Art. 4 bis (data update),
 * Art. 5 (registers kept at the workplace), Art. 6 (documents held), Arts. 15–16 (training).
 * Every count comes from the owning derivation — employerDuties / inspectionPackDerivations.
 * Arts. 7, 8, 10 and 14 run on Qiwa and read as one «للعلم» line. Pure (node-testable).
 */
import { ruleValue } from "./laborRules.js";
import { deriveInspectionPack } from "./inspectionPackDerivations.js";
import { TRAINING_DOCUMENT_DAYS, trainingPlanGaps } from "./employerDuties.js";
import { qiwaRegsNote } from "./implementingRegsNotes.js";

const info = (ar) => (ar ? "للعلم" : "For reference");

export const COMPLIANCE_MINISTRY_CARDS = (ar = true) => [
  {
    key: "regs",
    badge: ar ? "اللائحة" : "Regs",
    title: ar ? "اللائحة التنفيذية — السجلات والتدريب" : "Implementing Regulations — registers and training",
    scope: ar ? "تحديث بيانات المنشأة (م4 مكرر)، السجلات (م5)، الوثائق (م6)، التدريب (م15–16)." : "Establishment data (Art. 4 bis), registers (5), documents (6), training (15–16).",
  },
  {
    key: "qiwa",
    badge: ar ? "قوى" : "Qiwa",
    title: ar ? "ما يُدار عبر منصة قوى" : "Handled on Qiwa",
    scope: ar ? "التوظيف والتوطين والتراخيص والاستقدام — م7، 8، 10، 14." : "Employment channels, Saudization, licences, recruitment — Arts. 7, 8, 10, 14.",
  },
];

export function complianceMinistryRows(data = {}, { today, ar = true } = {}) {
  const day = today || new Date().toISOString().slice(0, 10);
  const pack = deriveInspectionPack(data);
  const training = pack.trainingRegister || {};
  const medical = pack.medicalRegister || {};
  const held = pack.heldDocuments || [];
  const undocumented = (training.undocumented || []).length;
  const medicalOverdue = Number(medical.overdue) || 0;
  const gaps = trainingPlanGaps({ plan: data?.trainingPlan || [], employees: data?.employees || [], today: day });
  const planOpen = gaps.filter((row) => row.missing.length).length;
  const updateDays = (() => { try { return ruleValue("compliance.establishment.dataUpdateDays", day); } catch { return 10; } })();
  const registers = pack.registers.filter((row) => row.id !== "inspection_file").length;

  return [
    {
      key: "regs-4bis",
      source: "regs",
      badge: ar ? "اللائحة م4 مكرر" : "Regs Art. 4 bis",
      title: ar ? `تحديث بيانات المنشأة خلال ${updateDays} أيام من أي تغيير` : `Update the establishment's data within ${updateDays} days of a change`,
      note: ar ? "عبر المنصة المعتمدة من الوزارة — بيانات المنشأة في «الإعدادات»، والتحديث نفسه في قوى." : "On the ministry's platform — the record sits in Settings; the update itself is on Qiwa.",
      status: "void",
      pill: info(ar),
    },
    {
      key: "regs-5",
      source: "regs",
      badge: ar ? "اللائحة م5" : "Regs Art. 5",
      title: ar ? `السجلات في مكان العمل — ${registers} سجلات مشتقة من الأقسام` : `Registers at the workplace — ${registers} derived from the modules`,
      note: ar ? "أسماء العمال، الأجور وتواريخ استلامها وما حُسم وسببه، قيد الغرامات، الحضور والانصراف، تدريب السعوديين، الفحص الطبي، وملف لكل عامل." : "Workers, wages with dates and deductions, fines, attendance, Saudi training, medical exams, and a file per worker.",
      ...(undocumented + medicalOverdue + held.length
        ? { status: "alert", pill: ar ? `${undocumented + medicalOverdue + held.length} نقص في السجلات` : `${undocumented + medicalOverdue + held.length} register gap(s)` }
        : { status: "settled", pill: ar ? "مستوفى" : "Met" }),
    },
    {
      key: "regs-5-6",
      source: "regs",
      badge: ar ? "اللائحة م5/6" : "Regs Art. 5(6)",
      title: ar ? "سجل الفحص الطبي الدوري للمعرّضين لأمراض مهنية" : "Periodic medical-exam register for the exposed",
      note: ar ? `${medical.exposed || 0} عاملاً معرّضاً · ${medicalOverdue} فات فحصه.` : `${medical.exposed || 0} exposed · ${medicalOverdue} overdue.`,
      ...(medicalOverdue
        ? { status: "alert", pill: ar ? `${medicalOverdue} فات فحصه` : `${medicalOverdue} overdue` }
        : medical.exposed ? { status: "settled", pill: ar ? "مستوفى" : "Met" } : { status: "void", pill: ar ? "لا معرّض" : "None exposed" }),
    },
    {
      key: "regs-6",
      source: "regs",
      badge: ar ? "اللائحة م6" : "Regs Art. 6",
      title: ar ? "لا تحتفظ المنشأة بجواز العامل غير السعودي أو إقامته أو بطاقة تأمينه الطبي" : "No holding a non-Saudi's passport, iqama or medical-insurance card",
      note: ar ? "تُقرأ من «وثائق لدى المنشأة» في ملف كل عامل." : "Read from «documents held» on each worker's file.",
      ...(held.length
        ? { status: "violation", pill: ar ? `${held.length} وثيقة محتجزة` : `${held.length} held` }
        : { status: "settled", pill: ar ? "مستوفى" : "Met" }),
    },
    {
      key: "regs-15",
      source: "regs",
      badge: ar ? "اللائحة م15" : "Regs Art. 15",
      title: ar ? "خطة التدريب لكل مهنة، وشرط الاستمرار لا يتجاوز مدة البرنامج" : "A training plan per job; any stay-on bond within the programme's length",
      note: ar ? `${gaps.length} بنداً في خطة هذه السنة · ${planOpen} لم يحضره كل من في الدور. شرط الاستمرار يُفحص عند تسجيل التدريب (م15/6)، ولا يتحمل المتدرب النفقات (م15/7).` : `${gaps.length} plan row(s) this year · ${planOpen} not attended by everyone in the role. The bond is checked when the training is recorded (15(6)); the trainee bears no cost (15(7)).`,
      ...(planOpen
        ? { status: "waiting", pill: ar ? `${planOpen} بنداً مفتوحاً` : `${planOpen} open` }
        : gaps.length ? { status: "settled", pill: ar ? "مستوفى" : "Met" } : { status: "void", pill: ar ? "لا خطة مسجّلة" : "No plan recorded" }),
    },
    {
      key: "regs-16",
      source: "regs",
      badge: ar ? "اللائحة م16 · م5/5" : "Regs Art. 16 · 5(5)",
      title: ar ? `توثيق كل تدريب خلال ${TRAINING_DOCUMENT_DAYS} يوماً في منصة الوزارة` : `Document every training within ${TRAINING_DOCUMENT_DAYS} days on the ministry platform`,
      note: ar ? `${training.trained || 0} متدرباً في السجل · ${undocumented} لم يوثَّق. نفقات التدريب على العامل في حالات م16 ثانياً فقط — تُفحص عند انتهاء الخدمة.` : `${training.trained || 0} trained on the register · ${undocumented} undocumented. Training costs fall on the worker only in the Art. 16 second cases — checked at exit.`,
      ...(undocumented
        ? { status: "alert", pill: ar ? `${undocumented} لم يوثَّق` : `${undocumented} undocumented` }
        : training.trained ? { status: "settled", pill: ar ? "مستوفى" : "Met" } : { status: "void", pill: ar ? "لا تدريب مسجّل" : "No training recorded" }),
    },
    {
      key: "regs-qiwa",
      source: "qiwa",
      badge: ar ? "اللائحة م7 · 8 · 10 · 14" : "Regs 7 · 8 · 10 · 14",
      title: ar ? "للعلم — عبر منصة قوى" : "For reference — on Qiwa",
      note: qiwaRegsNote(ar),
      status: "void",
      pill: info(ar),
    },
  ];
}
