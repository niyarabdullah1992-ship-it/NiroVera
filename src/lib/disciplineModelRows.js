/**
 * «أنظمة الوزارة — النموذج الموحد في الجزاءات» — the model-regulation rows the Labour Law board above
 * does not carry: Arts. 47–48 (prohibited items, the worker's duties) for reference on both sides,
 * Art. 53 (the uniform rules: set, announced, acknowledged) on the manager side with its derived
 * status, and Art. 69 (the penalties record) with Art. 61. Pure (node-testable).
 */
import { penaltiesRecordModelNote, uniformModelNote, workerDutiesModelNote } from "./implementingRegsNotes.js";
import { uniformAckStatus, uniformStanding } from "./uniformPolicy.js";

const info = (ar) => (ar ? "للعلم" : "For reference");

export const DISCIPLINE_MODEL_CARDS = (ar = true) => [
  {
    key: "model",
    badge: ar ? "النموذج الموحد" : "Model reg.",
    title: ar ? "النموذج الموحد — الواجبات والزي وصحيفة الجزاءات" : "Model regulation — duties, uniform and the penalties record",
    scope: ar ? "المواد المحظورة (م47)، واجبات العامل (م48)، اشتراطات الزي (م53)، صحيفة الجزاءات (م69) ومهلة التشديد (م61)." : "Prohibited items (47), the worker's duties (48), uniform rules (53), the penalties record (69) and the repeat window (61).",
  },
];

export function disciplineModelRows({ uniform = null, employees = [], manage = false, ar = true } = {}) {
  const rows = [
    {
      key: "model-47",
      source: "model",
      badge: ar ? "النموذج الموحد م47" : "Model Art. 47",
      title: ar ? "لا تدخل مادة محرّمة شرعاً إلى أماكن العمل" : "No religiously forbidden substance in the workplace",
      note: manage
        ? (ar ? "على المنشأة ومن له سلطة على العمال منع دخولها، وتُطبَّق على من وُجدت لديه أو تعاطاها العقوبات المقررة في النظام دون إخلال بالعقوبات الشرعية." : "The company and anyone with authority keep it out; the set penalties apply to whoever holds or uses it.")
        : (ar ? "يُمنع إدخالها أو حيازتها أو تعاطيها في أماكن العمل، وتُطبَّق العقوبات المقررة." : "Bringing, holding or using it at work is forbidden; the set penalties apply."),
      status: "void",
      pill: info(ar),
    },
    {
      key: "model-48",
      source: "model",
      badge: ar ? "النموذج الموحد م48" : "Model Art. 48",
      title: ar ? "واجبات العامل" : "The worker's duties",
      note: workerDutiesModelNote(ar),
      status: "void",
      pill: info(ar),
    },
  ];
  if (manage) {
    const standing = uniformStanding(uniform);
    const ack = uniformAckStatus(uniform, employees);
    rows.push({
      key: "model-53",
      source: "model",
      badge: ar ? "النموذج الموحد م53" : "Model Art. 53",
      title: ar ? "اشتراطات الزي: مكتوبة، بعقوباتها، معلنة على حدة، ومقرّ بها — ولا جزاء زي قبل الإقرار" : "Uniform rules: written, with penalties, announced, acknowledged — no uniform penalty before",
      note: uniformModelNote(ar),
      sub: standing.id === "announced" ? (ar ? `أقرّ ${ack.acked.length} من ${ack.total}` : `${ack.acked.length} of ${ack.total} acknowledged`) : undefined,
      ...(standing.id === "none"
        ? { status: "alert", pill: ar ? "لم توضع" : "Not set" }
        : standing.id === "draft"
          ? { status: "waiting", pill: ar ? "محفوظة — لم تُعلَن" : "Saved — not announced" }
          : ack.pending.length
            ? { status: "waiting", pill: ar ? `${ack.pending.length} لم يُقرّ` : `${ack.pending.length} not acknowledged` }
            : { status: "settled", pill: ar ? "معلنة ومقرّ بها" : "Announced and acknowledged" }),
    });
  }
  rows.push({
    key: "model-69",
    source: "model",
    badge: ar ? "النموذج الموحد م69 · م61" : "Model Arts. 69 · 61",
    title: ar ? "صحيفة الجزاءات في ملف الخدمة — لا يُمحى منها جزاء" : "The penalties record in the service file — nothing is erased",
    note: penaltiesRecordModelNote(ar),
    status: "settled",
    pill: manage ? (ar ? "في ملف الموظف ← التدرّج والجزاءات" : "Employee file → progression") : (ar ? "تحفظها الموارد البشرية" : "Kept by HR"),
  });
  return rows;
}
