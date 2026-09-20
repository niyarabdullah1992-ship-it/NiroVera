import React, { useState } from "react";
import { updateEmployeeProfile } from "@/lib/store";
import {
  TERMINATION_REASONS,
  checkTerminationGate,
  checkResignationGate,
  deriveNotice,
  noticeRuleId,
} from "@/lib/contractLawDerivations";
import { checkContractTermGate } from "@/lib/complianceDerivations";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import PolicyDeviationAlert from "@/components/shared/PolicyDeviationAlert";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { MUTED, NAVY, NAVY_FILL, field, WARN } from "@/lib/platformStyles";

export default function ContractExitCard({ employee, companyId, ar, canManage }) {
  const profile = employee?.profile || {};
  const exit = profile.contractExit || {};
  const [reason, setReason] = useState(exit.reason || "");
  const [party, setParty] = useState(exit.party || "employer");
  const [noticeGivenDate, setNoticeGivenDate] = useState(exit.noticeGivenDate || "");
  const [effectiveDate, setEffectiveDate] = useState(exit.effectiveDate || "");
  const [resignAt, setResignAt] = useState(exit.resignationSubmittedAt || "");
  const [postponeNote, setPostponeNote] = useState(exit.postponeNote || "");
  const [evidenceName, setEvidenceName] = useState(exit.evidenceName || "");
  const [error, setError] = useState("");

  const term = checkContractTermGate(employee);
  const notice = deriveNotice({
    employee,
    term: term.term,
    payCycle: "monthly",
    party,
    noticeGivenDate,
    lastWorkDate: effectiveDate,
  });
  const resignation = resignAt
    ? checkResignationGate({ submittedAt: resignAt, postponeNote, status: exit.status })
    : null;

  const save = () => {
    const files = evidenceName ? [{ name: evidenceName }] : (exit.evidenceFiles || []);
    const termGate = checkTerminationGate({
      reason,
      evidenceFiles: files,
      employee,
      leaveRequests: employee?.leaveRequests,
    });
    if (!termGate.ok) {
      setError(ar ? termGate.reason : termGate.reasonEn);
      return;
    }
    if (reason === "resignation") {
      const g = checkResignationGate({ submittedAt: resignAt, postponeNote, status: exit.status });
      if (!g.ok) {
        setError(ar ? g.reason : g.reasonEn);
        return;
      }
    }
    updateEmployeeProfile(companyId, employee.id, {
      contractExit: {
        ...exit,
        reason,
        party,
        noticeGivenDate,
        effectiveDate,
        resignationSubmittedAt: resignAt,
        postponeNote,
        evidenceName,
        noticeRequiredDays: notice.required,
        noticeShortfall: notice.shortfall,
      },
    });
    setError("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <LaborArticleCite ruleId="contract.termination.cite" ar={ar} showText />
      <LaborArticleCite ruleId="eos.unlawful.cite" ar={ar} showText />
      <LaborArticleCite ruleId="contract.maternity.noDismissal.cite" ar={ar} showText />
      <label style={{ fontSize: 11, color: MUTED }}>
        {ar ? "سبب الإنهاء النظامي" : "Statutory end reason"}
        <select
          value={reason}
          disabled={!canManage}
          onChange={(e) => setReason(e.target.value)}
          style={{ ...field, marginTop: 6 }}
        >
          <option value="">{ar ? "اختر السبب" : "Pick a reason"}</option>
          {TERMINATION_REASONS.map((row) => (
            <option key={row.id} value={row.id}>{ar ? row.ar : row.en}</option>
          ))}
        </select>
      </label>
      {reason === "article_80" ? (
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "دليل المادة 80 (اسم الملف)" : "Article 80 evidence (file name)"}
          <input
            value={evidenceName}
            disabled={!canManage}
            onChange={(e) => setEvidenceName(e.target.value)}
            style={{ ...field, marginTop: 6 }}
          />
        </label>
      ) : null}
      {term.term === "indefinite" ? (
        <>
          <LaborArticleCite ruleId={noticeRuleId({ term: term.term, payCycle: "monthly", party })} ar={ar} showText />
          {party === "employer" ? <LaborArticleCite ruleId="contract.notice.jobSearchDaysPerWeek" ar={ar} showText /> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <label style={{ fontSize: 11, color: MUTED }}>
              {ar ? "طرف الإشعار" : "Notice party"}
              <select value={party} disabled={!canManage} onChange={(e) => setParty(e.target.value)} style={{ ...field, marginTop: 6 }}>
                <option value="employer">{ar ? "صاحب العمل (60 يوماً)" : "Employer (60 days)"}</option>
                <option value="worker">{ar ? "العامل (30 يوماً)" : "Worker (30 days)"}</option>
              </select>
            </label>
            <label style={{ fontSize: 11, color: MUTED }}>
              {ar ? "تاريخ الإشعار" : "Notice given"}
              <div style={{ marginTop: 6 }}>
                <PlatformDateField ar={ar} value={noticeGivenDate} disabled={!canManage} onChange={setNoticeGivenDate} />
              </div>
            </label>
            <label style={{ fontSize: 11, color: MUTED }}>
              {ar ? "آخر يوم عمل" : "Last working day"}
              <div style={{ marginTop: 6 }}>
                <PlatformDateField ar={ar} value={effectiveDate} disabled={!canManage} onChange={setEffectiveDate} />
              </div>
            </label>
          </div>
          {!notice.pending && notice.shortfall > 0 ? (
            <div>
              <LaborArticleCite ruleId="contract.notice.compensation.cite" ar={ar} showText />
              <div style={{ ...WARN, fontSize: 12 }}>
                {ar
                  ? `نقص الإشعار ${notice.shortfall} يوماً — يُعوَّض بأجر المهلة في التسوية.`
                  : `Notice shortfall ${notice.shortfall} days — compensated at the wage for that period in the settlement.`}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {reason === "resignation" ? (
        <>
          <LaborArticleCite ruleId="contract.resignation.autoAcceptDays" ar={ar} showText />
          <label style={{ fontSize: 11, color: MUTED }}>
            {ar ? "تاريخ تقديم الاستقالة المكتوبة" : "Written resignation date"}
            <div style={{ marginTop: 6 }}>
              <PlatformDateField ar={ar} value={resignAt} disabled={!canManage} onChange={setResignAt} />
            </div>
          </label>
          <label style={{ fontSize: 11, color: MUTED }}>
            {ar ? "مسوغ تأجيل القبول إن وُجد" : "Postpone justification if any"}
            <input value={postponeNote} disabled={!canManage} onChange={(e) => setPostponeNote(e.target.value)} style={{ ...field, marginTop: 6 }} />
          </label>
      {resignation && !resignation.ok ? (
        <PolicyDeviationAlert gate={resignation} ruleId="contract.resignation.autoAcceptDays" ar={ar} />
      ) : null}
          {resignation?.ok && resignation.deemedAccepted ? (
            <div style={{ fontSize: 12, color: NAVY }}>
              {ar ? "الاستقالة تُعد مقبولة بعد 30 يوماً دون رد." : "Resignation is deemed accepted after 30 days without a reply."}
            </div>
          ) : null}
        </>
      ) : null}
      {error ? <PolicyDeviationAlert gate={{ ok: false, reason: error, reasonEn: error }} ruleId="contract.termination.cite" ar={ar} /> : null}
      {canManage ? (
        <button type="button" onClick={save} style={{ ...field, width: "auto", alignSelf: "flex-start", background: NAVY_FILL, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
          {ar ? "حفظ سبب الإنهاء" : "Save end reason"}
        </button>
      ) : null}
    </div>
  );
}
