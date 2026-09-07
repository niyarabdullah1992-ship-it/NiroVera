import React, { useEffect, useState, useCallback } from "react";
import { Loader2, PenLine, Download, RefreshCw, Trash2, ShieldCheck, CalendarClock, Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import SignersProgress from "@/components/files/SignersProgress";
import { getCompanyToken } from "@/lib/store";
import SigningAuditTrail from "@/components/files/SigningAuditTrail";
import { toast } from "@/components/ui/use-toast";
import SignerReminderMenu from "@/components/files/SignerReminderMenu";
import IdentityCard from "@/components/shared/IdentityCard";
import { MUTED, NAVY, OK, WARN, BAD, emptyState, ui, SURFACE } from "@/lib/platformStyles";

function statusPill(status) {
  if (status === "completed") return OK;
  if (status === "rejected") return BAD;
  return WARN;
}

export default function MultiSignInbox({ currentUser, companyId, ar, refreshKey, onPendingChange }) {
  const [requests, setRequests] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [remindingKey, setRemindingKey] = useState("");
  const [remindedKey, setRemindedKey] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("multiSign", {
        action: "list",
        companyId,
        sessionToken: getCompanyToken(companyId),
        userId: currentUser.id,
        email: (currentUser.email || "").toLowerCase(),
      });
      const rows = res.data?.requests || [];
      setRequests(rows);
      onPendingChange?.(rows.filter((row) => row.myStatus === "pending").length);
    } catch {
      setRequests([]);
      onPendingChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, currentUser.id, currentUser.email, onPendingChange]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const remove = async (request) => {
    setDeletingId(request.id);
    try {
      await base44.functions.invoke("multiSign", {
        action: "delete",
        companyId,
        sessionToken: getCompanyToken(companyId),
        userId: currentUser.id,
        requestId: request.id,
      });
      setRequests((rows) => rows.filter((row) => row.id !== request.id));
    } finally {
      setDeletingId(null);
    }
  };

  const remind = async (request, signer) => {
    const key = `${request.id}:${signer.email}`;
    setRemindingKey(key);
    try {
      await base44.functions.invoke("multiSign", {
        action: "remind",
        companyId,
        sessionToken: getCompanyToken(companyId),
        userId: currentUser.id,
        requestId: request.id,
        signerEmail: signer.email,
        lang: ar ? "ar" : "en",
      });
      setRemindedKey(key);
      setTimeout(() => setRemindedKey(""), 2500);
    } catch (error) {
      toast({ description: error?.response?.data?.error || (ar ? "تعذّر إرسال التذكير." : "Couldn't send the reminder."), variant: "destructive" });
    } finally {
      setRemindingKey("");
    }
  };

  const downloadRejected = async (request) => {
    setDownloadingId(request.id);
    try {
      const blob = await fetch(request.docUrl).then((response) => response.blob());
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = request.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(request.docUrl, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  const stamp = (value) => value
    ? new Date(value).toLocaleString(ar ? "ar-SA" : "en-GB", { timeZone: "Asia/Riyadh" })
    : "—";

  if (requests === null) {
    return (
      <IdentityCard icon={Inbox} className="nv-signing-card" title={ar ? "الطلبات" : "Requests"} subtitle={ar ? "جارٍ التحميل…" : "Loading…"}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: MUTED }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {ar ? "جارٍ تحميل طلبات التوقيع…" : "Loading signature requests…"}
        </div>
      </IdentityCard>
    );
  }

  return (
    <IdentityCard
      className="nv-signing-card"
      icon={Inbox}
      title={ar ? "الطلبات" : "Requests"}
      subtitle={ar ? "طلبات بانتظارك، ونسخ مكتملة للتحميل." : "Requests waiting for you, and completed copies to download."}
      meta={(
        <button type="button" onClick={load} disabled={loading} style={ui.btnGhost} aria-label={ar ? "تحديث" : "Refresh"}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      )}
    >
      {requests.length === 0 ? (
        <div style={emptyState}>{ar ? "لا توجد طلبات توقيع حتى الآن." : "No signature requests yet."}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
      {requests.map((request) => (
        <article key={request.id} style={{ background: SURFACE, border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{request.fileName}</div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>
                {ar ? `أنشأه ${request.creatorName}` : `Created by ${request.creatorName}`}
              </p>
            </div>
            <span style={statusPill(request.status)}>
              {request.status === "completed"
                ? (ar ? "مكتمل" : "Completed")
                : request.status === "rejected"
                  ? (ar ? "مرفوض" : "Rejected")
                  : request.myStatus === "pending"
                    ? (ar ? "بانتظار توقيعك" : "Awaiting your signature")
                    : (ar ? "جارٍ" : "In progress")}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <SignersProgress signers={request.signers} ar={ar} />
          </div>
          {request.isCreator && request.status === "pending" && (
            <div style={{ marginTop: 10 }}>
              <SignerReminderMenu requestId={request.id} signers={request.signers} ar={ar} busyKey={remindingKey} sentKey={remindedKey} onRemind={(signer) => remind(request, signer)} />
            </div>
          )}
          {request.status === "rejected" && (
            <p style={{ margin: "10px 0 0", padding: "8px 10px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", fontSize: 12 }}>
              {ar ? "رُفض المستند" : "Document rejected"}{request.rejectionReason ? ` — ${request.rejectionReason}` : ""}
            </p>
          )}
          <p style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
            <CalendarClock style={{ width: 13, height: 13 }} />
            {ar ? "أُنشئ" : "Created"} {stamp(request.createdAt)}
          </p>
          <SigningAuditTrail events={request.auditTrail} ar={ar} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F1F5F9", flexWrap: "wrap" }}>
            {request.myStatus === "pending" && request.myToken && request.status === "pending" && (
              <a href={`/sign?token=${request.myToken}`} style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                <PenLine style={{ width: 14, height: 14 }} />
                {ar ? "وقّع" : "Sign"}
              </a>
            )}
            {request.status === "completed" && (
              <a href={request.docUrl} target="_blank" rel="noreferrer" style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                <Download style={{ width: 14, height: 14 }} />
                {ar ? "النسخة النهائية" : "Final copy"}
              </a>
            )}
            {request.status === "rejected" && (
              <button type="button" onClick={() => downloadRejected(request)} disabled={downloadingId === request.id} style={ui.btnSecondary}>
                {downloadingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download style={{ width: 14, height: 14, display: "inline", marginInlineEnd: 6 }} />}
                {ar ? "تنزيل الملف" : "Download file"}
              </button>
            )}
            {request.status === "completed" && <ShieldCheck style={{ width: 16, height: 16, color: "#15803D" }} />}
            {request.isCreator && (
              <ConfirmDeleteDialog
                title={ar ? "حذف طلب التوقيع؟" : "Delete signature request?"}
                description={ar ? `سيُحذف طلب "${request.fileName}" نهائيًا.` : `The request “${request.fileName}” will be permanently deleted.`}
                onConfirm={() => remove(request)}
                trigger={(
                  <button type="button" disabled={deletingId === request.id} style={ui.btnDanger}>
                    {deletingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 style={{ width: 14, height: 14 }} />}
                  </button>
                )}
              />
            )}
          </div>
          </div>
        </article>
      ))}
        </div>
      )}
    </IdentityCard>
  );
}
