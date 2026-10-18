/**
 * Writes for the employer-duty records on the worker's file: training (Arts. 42–48), periodic medical
 * exams (Art. 143) and documents held by the employer (Regs Art. 6). Each passes its pure gate first.
 */
import { updateCompany } from "@/lib/store";
import { checkMedicalExamGate, checkTrainingRecordGate } from "@/lib/employerDuties";

const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

function patchEmployee(companyId, employeeId, fn) {
  let hit = false;
  updateCompany(companyId, (d) => {
    const emp = (d.employees || []).find((e) => String(e.id) === String(employeeId));
    if (!emp) return;
    fn(emp, d);
    hit = true;
  });
  return hit ? { ok: true } : { ok: false, error: "NOT_FOUND", reason: "الموظف غير موجود.", reasonEn: "Employee not found." };
}

export function addTrainingRecord(companyId, record, by = "") {
  const gate = checkTrainingRecordGate(record);
  if (!gate.ok) return gate;
  return patchEmployee(companyId, record.employeeId, (emp) => {
    emp.trainings = [...(emp.trainings || []), { ...record, id: uid("trn"), cost: Number(record.cost) || 0, hours: Number(record.hours) || 0, by, at: new Date().toISOString() }];
    emp.fileLog = [{ text: `سُجّل تدريب: ${record.course} (${record.hours} ساعة)`, by, at: stamp(), dot: "#3C7D50" }, ...(emp.fileLog || [])].slice(0, 40);
  });
}

export function markTrainingDocumented(companyId, employeeId, trainingId, at, by = "") {
  return patchEmployee(companyId, employeeId, (emp) => {
    const row = (emp.trainings || []).find((t) => t.id === trainingId);
    if (row) { row.documentedAt = String(at || "").slice(0, 10); row.documentedBy = by; }
  });
}

export function setOccupationalExposure(companyId, employeeId, hazard = "", by = "") {
  return patchEmployee(companyId, employeeId, (emp) => {
    emp.profile = { ...(emp.profile || {}), occupationalExposure: Boolean(String(hazard).trim()), exposureHazard: String(hazard).trim() };
    emp.fileLog = [{ text: hazard ? `معرّض لخطر مهني: ${hazard} — فحص طبي سنوي (المادة 143)` : "أُزيل التعرض المهني", by, at: stamp(), dot: "#A57F2C" }, ...(emp.fileLog || [])].slice(0, 40);
  });
}

export function addMedicalExam(companyId, employeeId, exam, by = "") {
  const gate = checkMedicalExamGate(exam);
  if (!gate.ok) return gate;
  return patchEmployee(companyId, employeeId, (emp) => {
    emp.medicalExams = [...(emp.medicalExams || []), { ...exam, id: uid("mex"), by }];
    emp.fileLog = [{ text: `فحص طبي دوري ${exam.at}: ${exam.result}`, by, at: stamp(), dot: "#3C7D50" }, ...(emp.fileLog || [])].slice(0, 40);
  });
}

export function recordHeldDocument(companyId, employeeId, { kind, heldSince, reason = "" }, by = "") {
  if (!kind || !String(heldSince || "").slice(0, 10)) return { ok: false, error: "HELD_DOC_FIELDS", reason: "اختر الوثيقة وتاريخ استلامها.", reasonEn: "Pick the document and when it was taken." };
  return patchEmployee(companyId, employeeId, (emp) => {
    const list = [...(emp.profile?.heldDocuments || []), { id: uid("hdoc"), kind, heldSince: String(heldSince).slice(0, 10), reason, by }];
    emp.profile = { ...(emp.profile || {}), heldDocuments: list };
  });
}

export function returnHeldDocument(companyId, employeeId, docId, at, by = "") {
  return patchEmployee(companyId, employeeId, (emp) => {
    const list = (emp.profile?.heldDocuments || []).map((d) => (d.id === docId ? { ...d, returnedAt: String(at).slice(0, 10), returnedBy: by } : d));
    emp.profile = { ...(emp.profile || {}), heldDocuments: list };
    emp.fileLog = [{ text: "أُعيدت وثيقة إلى العامل (اللائحة م6 · المادة 64/2)", by, at: stamp(), dot: "#3C7D50" }, ...(emp.fileLog || [])].slice(0, 40);
  });
}
