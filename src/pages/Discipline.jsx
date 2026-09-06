import React, { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany } from "@/lib/store";
import {
  DISCIPLINE_STEPS,
  checkAdvanceDisciplineGate,
  nextDisciplineStep,
  disciplineEvidenceList,
  disciplineAppealNote,
} from "@/lib/disciplineDerivations";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import PolicyDeviationAlert from "@/components/shared/PolicyDeviationAlert";
import IdentityCard from "@/components/shared/IdentityCard";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import ErpSectionFrame from "@/components/erp/ErpSectionFrame";
import DisciplineCaseThread from "@/components/employees/DisciplineCaseThread";
import CommentFiles from "@/components/tasks/CommentFiles";
import { BORDER, CARD, MUTED, NAVY, field, ui } from "@/lib/platformStyles";
import { Scale } from "lucide-react";

function uid() {
  return `dsc_${Date.now().toString(36)}`;
}

export default function Discipline() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, company, currentUser } = useAuth();
  const cases = data?.disciplinaryCases || [];
  const employees = data?.employees || [];
  const [employeeId, setEmployeeId] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [error, setError] = useState("");
  const [errorRuleId, setErrorRuleId] = useState("discipline.penalties.cite");

  const canManage = currentUser && (data?.ownerId === currentUser.id || currentUser.hrLevelId || ["director", "ops_manager"].includes(currentUser.role));
  const visibleCases = canManage ? cases : cases.filter((c) => c.employeeId === currentUser?.id);

  const openCount = useMemo(
    () => visibleCases.filter((c) => c.status !== "ruling" && c.status !== "closed").length,
    [visibleCases],
  );

  const saveCases = (next) => {
    if (!company?.id) return;
    updateCompany(company.id, (row) => {
      row.disciplinaryCases = next;
    });
  };

  const openCase = () => {
    if (!employeeId) {
      setError(ar ? "اختر الموظف." : "Pick the employee.");
      return;
    }
    const gate = checkAdvanceDisciplineGate({ employeeId }, "incident");
    if (!gate.ok) {
      setError(ar ? gate.reason : gate.reasonEn);
      setErrorRuleId(gate.cite?.id || "discipline.penalties.cite");
      return;
    }
    const attached = [...openFiles];
    const firstMessage = (note.trim() || attached.length)
      ? [{
        id: `dmsg_${Date.now().toString(36)}`,
        from: "hr",
        text: note.trim(),
        files: attached,
        senderName: currentUser?.name,
        createdAt: new Date().toISOString(),
      }]
      : [];
    saveCases([
      {
        id: uid(),
        employeeId,
        status: "incident",
        note,
        createdAt: new Date().toISOString(),
        evidence: [
          ...(evidence.trim() ? [evidence.trim()] : []),
          ...attached,
        ],
        messages: firstMessage,
      },
      ...cases,
    ]);
    setNote("");
    setEvidence("");
    setOpenFiles([]);
    setError("");
  };

  const advance = (item) => {
    const nxt = nextDisciplineStep(item.status);
    const files = disciplineEvidenceList(item, evidence.trim() ? [evidence.trim()] : []);
    const appealNote = disciplineAppealNote(item, note);
    const gate = checkAdvanceDisciplineGate(item, nxt.id, { files, appealNote });
    if (!gate.ok) {
      setError(ar ? gate.reason : gate.reasonEn);
      setErrorRuleId(gate.cite?.id || "discipline.penalties.cite");
      return;
    }
    const now = new Date().toISOString();
    saveCases(cases.map((c) => (c.id === item.id
      ? {
        ...c,
        status: nxt.id,
        updatedAt: now,
        hearingEndedAt: nxt.id === "hearing" ? (c.hearingEndedAt || now) : c.hearingEndedAt,
        evidence: files,
        appealNote: nxt.id === "appeal" ? (appealNote || c.appealNote) : c.appealNote,
      }
      : c)));
    setError("");
  };

  return (
    <PlatformStampShell
      ar={ar}
      kicker={ar ? "الجزاءات والتحقيق" : "Sanctions and investigation"}
      title={ar ? "مسار المواد 66–73" : "Articles 66–73 path"}
      hint={ar
        ? "واقعة من الحضور أو المهمة أو البلاغ، ثم إشعار ومحضر وقرار وتظلم. اكتب الرسالة وأرفق الملف في محادثة الملف."
        : "An incident from attendance, a task, or a report, then notice, minutes, decision, and appeal. Write the message and attach the file in the case conversation."}
    >
      <ErpSectionFrame path="/app/discipline" ar={ar} hideProof stats={[{ label: ar ? "ملفات مفتوحة" : "Open files", value: openCount, tone: openCount ? "warn" : "ok" }]}>
        <IdentityCard
          icon={Scale}
          kicker={ar ? "قسم جديد واحد" : "The one new section"}
          title={ar ? "الجزاءات" : "Sanctions"}
          subtitle={ar ? "التظلم خلال 30 يوماً والبت خلال 15 يوماً." : "Appeal within 30 days; ruling within 15."}
          meta={<LaborArticleCite ruleId="discipline.appeal.internalDays" ar={ar} />}
        >
          <LaborArticleCite ruleId="discipline.penalties.cite" ar={ar} showText />
          <LaborArticleCite ruleId="discipline.listedOnly.cite" ar={ar} showText />
          <LaborArticleCite ruleId="discipline.repeat.cooloffDays" ar={ar} showText />
          <LaborArticleCite ruleId="discipline.charge.maxDays" ar={ar} showText />
          <LaborArticleCite ruleId="discipline.fine.maxDays" ar={ar} showText />
          <LaborArticleCite ruleId="discipline.hearing.cite" ar={ar} showText />
          <LaborArticleCite ruleId="discipline.appeal.internalDays" ar={ar} showText />
          <LaborArticleCite ruleId="discipline.fines.register.cite" ar={ar} showText />
          {canManage ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={field}>
                  <option value="">{ar ? "الموظف" : "Employee"}</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "اكتب ملخص الواقعة أو الرسالة" : "Write the incident summary or message"} style={field} />
                <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={ar ? "مرجع من الحضور أو المهمة أو البلاغ" : "Reference from attendance, a task, or a report"} style={field} />
              </div>
              <CommentFiles files={openFiles} setFiles={setOpenFiles} />
              <button type="button" onClick={openCase} style={{ ...ui.btnCreate, alignSelf: "flex-start" }}>
                {ar ? "فتح واقعة" : "Open incident"}
              </button>
            </div>
          ) : null}
          {error ? <PolicyDeviationAlert gate={{ ok: false, reason: error, reasonEn: error }} ruleId={errorRuleId} ar={ar} /> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {visibleCases.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا ملفات جزاء بعد." : "No sanction files yet."}</p>
            ) : visibleCases.map((c) => {
              const emp = employees.find((e) => e.id === c.employeeId);
              const step = DISCIPLINE_STEPS.find((s) => s.id === c.status) || DISCIPLINE_STEPS[0];
              return (
                <div key={c.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px", background: CARD }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{emp?.name || c.employeeId}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{ar ? step.ar : step.en}</span>
                  </div>
                  {c.note ? <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>{c.note}</p> : null}
                  {canManage && c.status !== "ruling" ? (
                    <button type="button" onClick={() => advance(c)} style={{ marginTop: 10, ...field, width: "auto", cursor: "pointer" }}>
                      {ar ? `إلى: ${nextDisciplineStep(c.status).ar}` : `Next: ${nextDisciplineStep(c.status).en}`}
                    </button>
                  ) : null}
                  <DisciplineCaseThread
                    caseRow={c}
                    companyId={company?.id}
                    currentUser={currentUser}
                    canManage={canManage}
                    isSubject={c.employeeId === currentUser?.id}
                    ar={ar}
                  />
                </div>
              );
            })}
          </div>
        </IdentityCard>
      </ErpSectionFrame>
    </PlatformStampShell>
  );
}
