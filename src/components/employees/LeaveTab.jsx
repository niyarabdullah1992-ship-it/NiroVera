import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { submitLeaveRequest, setLeaveRequestStatus } from "@/lib/store";
import { BORDER, MUTED, NAVY, NAVY_FILL, field, CARD } from "@/lib/platformStyles";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { Send } from "lucide-react";
import CommentFiles from "@/components/tasks/CommentFiles";
import VoiceRecorder from "@/components/tasks/VoiceRecorder";
import LeaveBalanceCard from "@/components/employees/LeaveBalanceCard";
import LeaveTotalsEditor from "@/components/employees/LeaveTotalsEditor";
import LeaveRequestItem from "@/components/employees/LeaveRequestItem";
import { LEAVE_TYPES, LEAVE_THRESHOLD_DAYS, computeDays, leaveTypesForProfile, remainingLeaveDays, endDateFromLeaveDays } from "@/lib/leaveTypes";
import { checkApproveLeaveGate } from "@/lib/leaveDerivations";
import PolicyDeviationAlert from "@/components/shared/PolicyDeviationAlert";
import { generateAbsenceDeduction } from "@/lib/deductionGenerators";
import { base44 } from "@/api/base44Client";

async function workforce(payload) {
  const res = await base44.functions.invoke("workforce", payload);
  return res?.data ?? res;
}

/** Platform leave tab primary = balances (L2695–2710). Request UI is app secondary. */
export default function LeaveTab({ employee, companyId, currentUser, isSelf, canApprove }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [type, setType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [examRepeat, setExamRepeat] = useState(false);
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [daysWanted, setDaysWanted] = useState("");
  const requests = employee.leaveRequests || [];
  const leaveTypes = leaveTypesForProfile(employee.profile);
  const remainingAnnual = remainingLeaveDays(employee.profile, requests, "annual");

  const calendarDays = computeDays(startDate, endDate);
  const requestedAnnual = Number(daysWanted);
  const days = type === "annual" && Number.isFinite(requestedAnnual) && requestedAnnual >= 1
    ? Math.max(1, Math.round(requestedAnnual))
    : calendarDays;
  const typeConfig = LEAVE_TYPES.find((ty) => ty.key === type);
  const overThreshold = days > LEAVE_THRESHOLD_DAYS;
  const needsFile = typeConfig?.requiresFile || overThreshold;
  const needsReason = overThreshold;
  const draftGate = startDate && endDate
    ? checkApproveLeaveGate(
      { type, startDate, endDate, days, files, status: "pending", reason, eventDate, examRepeat },
      !!typeConfig?.requiresFile,
      { profile: employee.profile, requests },
    )
    : { ok: true };

  const submit = (e) => {
    e.preventDefault();
    setError("");
    if (!startDate || !endDate) return;
    if (type === "annual" && remainingAnnual != null && days > remainingAnnual) {
      setError(ar ? `المتبقي من السنوية ${remainingAnnual} يوماً.` : `Annual leave remaining is ${remainingAnnual} days.`);
      return;
    }
    if (needsReason && !reason.trim()) { setError(t("justificationRequired")); return; }
    if (needsFile && files.length === 0) { setError(t("attachmentRequired")); return; }
    if (!draftGate.ok) {
      setError(ar ? draftGate.reason : draftGate.reasonEn);
      return;
    }
    submitLeaveRequest(companyId, employee.id, { type, startDate, endDate, days, reason, files, eventDate, examRepeat });
    setStartDate(""); setEndDate(""); setReason(""); setFiles([]); setEventDate(""); setExamRepeat(false); setDaysWanted("");
  };

  const decide = async (id, status) => {
    const request = requests.find((r) => r.id === id);
    if (status === "approved") {
      const gate = checkApproveLeaveGate(
        request,
        !!LEAVE_TYPES.find((ty) => ty.key === request?.type)?.requiresFile,
        { profile: employee.profile, requests },
      );
      if (!gate.ok) {
        setError(ar ? gate.reason : gate.reasonEn);
        return;
      }
    }
    try {
      const remote = await workforce({
        action: status === "approved" ? "approveLeave" : "rejectLeave",
        companyId,
        employeeId: employee.id,
        requestId: id,
      });
      if (remote?.error === "ATTACHMENT_REQUIRED") {
        setError(ar ? remote.reason : (remote.reasonEn || remote.reason));
        return;
      }
    } catch {
      // Fall through to local store when function is unavailable.
    }
    setLeaveRequestStatus(companyId, employee.id, id, status, currentUser.name);
    if (status === "approved" && request?.type === "unpaid") {
      generateAbsenceDeduction(companyId, employee.id, id, request.days || computeDays(request.startDate, request.endDate), currentUser);
    }
  };

  const inputStyle = { ...field };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={ar ? "rtl" : "ltr"}>
      <LeaveBalanceCard profile={employee.profile} requests={requests} />

            {(isSelf || canApprove || requests.length > 0) && (
        <details
          open={isSelf ? true : undefined}
          style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: "16px",
          padding: "14px 18px",
        }}
        >
          <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: NAVY, listStyle: "none" }}>
            {ar ? "طلبات الإجازة وإدارة الأرصدة" : "Leave requests and balance admin"}
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
            {canApprove && <LeaveTotalsEditor employee={employee} companyId={companyId} />}

            {(isSelf || canApprove) && (
              <IdentityCard
                kicker={ar ? "أمر طلب" : "Request command"}
                title={t("submitRequest")}
                subtitle={ar ? "اختيار النوع يعرض نص المادة السارية عليه." : "Choosing a type shows the article text that governs it."}
                meta={<LaborArticleCite leaveType={type} profile={employee.profile} ar={ar} />}
              >
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "10px" }}>
                  <select
                    value={type}
                    onChange={(e) => {
                      const next = e.target.value;
                      setType(next);
                      if (next !== "annual") setDaysWanted("");
                    }}
                    style={inputStyle}
                  >
                    {leaveTypes.map((ty) => <option key={ty.key} value={ty.key}>{t(ty.key)}</option>)}
                  </select>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStartDate(next);
                      if (type === "annual" && requestedAnnual >= 1 && next) {
                        setEndDate(endDateFromLeaveDays(next, requestedAnnual));
                      }
                    }}
                    required
                    style={inputStyle}
                  />
                  {type === "annual" ? (
                    <input
                      type="number"
                      min="1"
                      max={remainingAnnual != null ? remainingAnnual : undefined}
                      value={daysWanted}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setDaysWanted(raw);
                        const n = Number(raw);
                        if (startDate && Number.isFinite(n) && n >= 1) {
                          setEndDate(endDateFromLeaveDays(startDate, n));
                        }
                      }}
                      placeholder={ar ? "عدد الأيام" : "Days"}
                      required
                      style={inputStyle}
                      title={ar ? "عدد أيام الإجازة السنوية المطلوبة" : "Number of annual leave days to take"}
                    />
                  ) : null}
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEndDate(next);
                      if (type === "annual" && startDate && next) {
                        setDaysWanted(String(computeDays(startDate, next)));
                      }
                    }}
                    required
                    style={inputStyle}
                  />
                  {(type === "paternity" || type === "maternity" || type === "marriage" || type === "bereavement" || type === "bereavement_sibling") ? (
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                      style={inputStyle}
                      title={
                        type === "marriage"
                          ? (ar ? "تاريخ الزواج" : "Marriage date")
                          : type === "paternity" || type === "maternity"
                            ? (ar ? "تاريخ الولادة" : "Birth date")
                            : (ar ? "تاريخ الوفاة" : "Date of death")
                      }
                    />
                  ) : null}
                </div>
                <LaborArticleCite leaveType={type} profile={employee.profile} ar={ar} showText />
                {type === "annual" ? (
                  <>
                    <LaborArticleCite ruleId="leave.annual.carry.cite" ar={ar} showText />
                    <LaborArticleCite ruleId="eos.unusedLeave.cite" ar={ar} showText />
                    <LaborArticleCite ruleId="leave.eid.cite" ar={ar} showText />
                    <LaborArticleCite ruleId="leave.eid.fitrDays" ar={ar} showText />
                    <LaborArticleCite ruleId="leave.eid.adhaDays" ar={ar} showText />
                    <LaborArticleCite ruleId="leave.nationalDay.days" ar={ar} showText />
                    <LaborArticleCite ruleId="leave.foundingDay.days" ar={ar} showText />
                    <LaborArticleCite ruleId="leave.eid.overlap.cite" ar={ar} showText />
                    <LaborArticleCite ruleId="leave.noOtherEmployer.cite" ar={ar} showText />
                  </>
                ) : null}
                {type === "exam" ? (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: MUTED }}>
                    <input type="checkbox" checked={examRepeat} onChange={(e) => setExamRepeat(e.target.checked)} />
                    <span>{ar ? "سنة معادة — الإجازة بلا أجر (المادة 115)" : "Repeat sitting — unpaid leave (Article 115)"}</span>
                  </label>
                ) : null}
                {!draftGate.ok ? <PolicyDeviationAlert gate={draftGate} leaveType={type} profile={employee.profile} ar={ar} /> : null}
                {draftGate.ok && draftGate.warning ? (
                  <div style={{ fontSize: 12, color: "#B45309", lineHeight: 1.65 }}>{ar ? draftGate.reason : draftGate.reasonEn}</div>
                ) : null}
                {type === "annual" && remainingAnnual != null ? (
                  <div style={{ fontSize: "12px", color: MUTED, lineHeight: 1.65 }}>
                    {ar
                      ? `المتبقي من الإجازة السنوية ${remainingAnnual} يوماً — اطلب العدد الذي تريده.`
                      : `${remainingAnnual} annual days remaining — request the number you want.`}
                  </div>
                ) : null}
                {days > 0 && (
                  <div style={{ fontSize: "12px", color: MUTED }}>{t("daysRequested")}: {days}</div>
                )}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("reason")}
                  rows={2}
                  style={{
                    ...inputStyle,
                    height: "auto",
                    padding: "10px 11px",
                    resize: "vertical",
                    borderColor: needsReason && !reason.trim() ? "#DC2626" : BORDER,
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>
                  <CommentFiles files={files} setFiles={setFiles} />
                  <VoiceRecorder files={files} setFiles={setFiles} />
                </div>
                {typeConfig?.requiresFile && (
                  <div style={{ fontSize: "12px", color: MUTED }}>{t("medicalReport")} — {t("attachmentRequired")}</div>
                )}
                {overThreshold && (
                  <div style={{ fontSize: "12px", color: "#B45309" }}>{t("thresholdNote")} {LEAVE_THRESHOLD_DAYS} {t("days")}</div>
                )}
                {error && <div style={{ fontSize: "12px", color: "#DC2626" }}>{error}</div>}
                <button
                  type="submit"
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 15px",
                    borderRadius: "9px",
                    border: "none",
                    background: NAVY_FILL,
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <Send style={{ width: 14, height: 14 }} /> {t("submitRequest")}
                </button>
              </form>
              </IdentityCard>
            )}

            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "10px" }}>{t("leaveRequests")}</div>
              {error && !isSelf && <div style={{ fontSize: "12px", color: "#DC2626", marginBottom: "8px" }}>{error}</div>}
              {requests.length === 0 ? (
                <div style={{ fontSize: "13px", color: MUTED }}>{t("noLeaveRequests")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {requests.map((r) => (
                    <LeaveRequestItem key={r.id} request={r} canApprove={canApprove} onDecide={decide} profile={employee.profile} requests={requests} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
