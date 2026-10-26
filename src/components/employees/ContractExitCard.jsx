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
import { RETURN_TICKET_EXCEPTIONS, checkReturnTicketExceptionGate, deriveReturnTicket } from "@/lib/returnTicket";
import { repatriationModelNote } from "@/lib/implementingRegsNotes";

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
  const [ticketException, setTicketException] = useState("");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketError, setTicketError] = useState("");
  const ticket = deriveReturnTicket(employee);
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  // Model Art. 11 — the non-Saudi worker's return ticket at the end of service, or the Art. 11(4) exception.
  const recordTicket = (patch) => {
    updateEmployeeProfile(companyId, employee.id, { contractExit: { ...exit, returnTicket: { ...patch, recordedAt: todayIso } } });
    setTicketError("");
  };
  const recordException = () => {
    const gate = checkReturnTicketExceptionGate({ exception: ticketException, note: ticketNote, exitReason: exit.reason });
    if (!gate.ok) { setTicketError(ar ? gate.reason : gate.reasonEn); return; }
    recordTicket({ exception: ticketException, note: ticketNote.trim() });
  };

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
          onChange={(e) => {
            const next = e.target.value;
            setReason(next);
            // The reason names who ended it — Arts. 75–77 read the party from here.
            if (next === "employer_termination") setParty("employer");
            else if (next === "resignation" || next === "article_81" || next === "worker_force_majeure") setParty("worker");
          }}
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
      {ticket.state === "na" ? null : (
        <div data-return-ticket={ticket.state} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid var(--nv-line2)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>
            {ar ? "تذكرة العودة عند انتهاء الخدمة — النموذج الموحد م11" : "Return ticket at the end of service — model Art. 11"}
          </span>
          <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.8 }}>{repatriationModelNote(ar)}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: ticket.state === "owed" ? "var(--nv-warn-ink)" : ticket.state === "provided" || ticket.state === "excepted" ? "var(--nv-ok-ink)" : MUTED }}>
            {ticket.state === "provided"
              ? (ar ? `أُمِّنت التذكرة ${ticket.ticket.providedAt}` : `Ticket provided ${ticket.ticket.providedAt}`)
              : ticket.state === "excepted"
                ? (ar ? `لا تتحملها المنشأة: ${RETURN_TICKET_EXCEPTIONS.find((x) => x.key === ticket.ticket.exception)?.ar || ""} — ${ticket.ticket.note || ""}` : `Not borne: ${RETURN_TICKET_EXCEPTIONS.find((x) => x.key === ticket.ticket.exception)?.en || ""}`)
                : ticket.state === "owed"
                  ? (ar ? "على المنشأة — يُسجَّل قبل إغلاق ملف إنهاء الخدمة." : "Owed — record it before the exit file closes.")
                  : ticket.state === "unknown"
                    ? (ar ? "الجنسية غير محسومة في الملف — تُقرأ منها." : "Nationality not settled on the file.")
                    : (ar ? "تُستحق عند انتهاء الخدمة إن كان العامل غير سعودي." : "Due at the end of service for a non-Saudi worker.")}
          </span>
          {canManage && ticket.state === "owed" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={() => recordTicket({ providedAt: todayIso })} style={{ ...field, width: "auto", alignSelf: "flex-start", background: NAVY_FILL, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
                {ar ? "سجّل تأمين تذكرة العودة" : "Record the return ticket"}
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 8 }}>
                <select value={ticketException} onChange={(e) => setTicketException(e.target.value)} style={field}>
                  <option value="">{ar ? "أو حالة استثناء (م11/4)" : "Or an exception (11(4))"}</option>
                  {RETURN_TICKET_EXCEPTIONS.map((row) => <option key={row.key} value={row.key}>{ar ? row.ar : row.en}</option>)}
                </select>
                <input value={ticketNote} onChange={(e) => setTicketNote(e.target.value)} placeholder={ar ? "سند الاستثناء" : "Basis"} style={field} />
              </div>
              {ticketException ? (
                <button type="button" onClick={recordException} style={{ ...field, width: "auto", alignSelf: "flex-start", cursor: "pointer", fontWeight: 600 }}>
                  {ar ? "سجّل الاستثناء" : "Record the exception"}
                </button>
              ) : null}
              {ticketError ? <span role="alert" style={{ fontSize: 12, color: "var(--nv-bad-ink)" }}>{ticketError}</span> : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
