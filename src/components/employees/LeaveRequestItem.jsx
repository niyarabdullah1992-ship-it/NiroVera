import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { CommentAttachments } from "@/components/tasks/CommentFiles";
import { formatDate } from "@/lib/dateFormat";
import { LEAVE_TYPES, leaveTypeLabel } from "@/lib/leaveTypes";
import { checkApproveLeaveGate, checkExamSittingSettleGate, checkRejectLeaveGate, HOLIDAY_REQUEST_NOT_NEEDED, holidayNotNeededLabel } from "@/lib/leaveDerivations";
import PolicyDeviationAlert from "@/components/shared/PolicyDeviationAlert";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { requestReplyCopy, requestReplyHref } from "@/lib/requestWorkspace";

const STATUS_STYLE = {
  pending: { tone: "bg-amber-100 text-amber-700", icon: Clock },
  approved: { tone: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected: { tone: "bg-destructive/15 text-destructive", icon: XCircle },
  // Legacy Art. 112 request — the holiday applies from the calendar; no decision is needed.
  [HOLIDAY_REQUEST_NOT_NEEDED]: { tone: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

export default function LeaveRequestItem({ request, canApprove, profile, requests }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { tone, icon: StatusIcon } = STATUS_STYLE[request.status] || STATUS_STYLE.pending;
  const typeRequiresFile = !!LEAVE_TYPES.find((ty) => ty.key === request.type)?.requiresFile;
  const gate = checkApproveLeaveGate(request, typeRequiresFile, { profile, requests });
  const rejectGate = checkRejectLeaveGate(request, { nextStatus: "rejected", actor: "manager", profile, requests, skipGrounds: true });
  const settle = request.type === "exam" ? checkExamSittingSettleGate(request) : { ok: true, settled: true };
  const pending = (request.status || "pending") === "pending";

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-body font-medium">
          {leaveTypeLabel(request.type, ar, undefined, request.startDate)} · {formatDate(request.startDate, lang, { day: "numeric", month: "long", year: "numeric" })} → {formatDate(request.endDate, lang, { day: "numeric", month: "long", year: "numeric" })} ({request.days || 1} {t("days")})
        </p>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-body ${tone}`}>
          <StatusIcon className="w-3 h-3" /> {request.status === HOLIDAY_REQUEST_NOT_NEEDED ? holidayNotNeededLabel(request, ar) : t(request.status)}
        </span>
      </div>
      <LaborArticleCite leaveType={request.type} profile={profile} ar={ar} showText showOfficial />
      {pending && !gate.ok ? (
        <PolicyDeviationAlert gate={gate} leaveType={request.type} profile={profile} ar={ar} />
      ) : null}
      {pending && !rejectGate.ok ? (
        <PolicyDeviationAlert gate={rejectGate} leaveType={request.type} profile={profile} ar={ar} />
      ) : null}
      {request.type === "exam" && !settle.ok ? (
        <p className="text-sm font-body text-destructive" style={{ lineHeight: 1.7 }}>{ar ? settle.reason : settle.reasonEn}</p>
      ) : null}
      {request.reason && <p className="text-sm font-body text-muted-foreground">{request.reason}</p>}
      <CommentAttachments files={request.files} />
      {pending && (
        <Link
          to={requestReplyHref({ manage: !!canApprove })}
          className="inline-flex items-center pt-1 text-xs font-body font-semibold text-foreground"
          style={{ textDecoration: "none" }}
        >
          {requestReplyCopy(ar)}
        </Link>
      )}
    </div>
  );
}
