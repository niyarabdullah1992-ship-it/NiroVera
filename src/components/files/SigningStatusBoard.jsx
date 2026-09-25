import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Copy, Download, ExternalLink, Loader2, PenLine, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import SigningAuditTrail from "@/components/files/SigningAuditTrail";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import { getCompanyToken } from "@/lib/store";
import { invokeLocalMultiSign, shouldUseLocalMultiSign, writeSigningCompletionNotices } from "@/lib/localMultiSignFallback";
import { isServiceOutage, refusalError } from "@/lib/serviceErrors";
import { toast } from "@/components/ui/use-toast";
import { BORDER, BRAND, CARD, INK, MUTED, NAVY, SURFACE, textarea, ui } from "@/lib/platformStyles";
import { SIGN_LINE, SIGN_MUTED, SIGN_NAVY, SIGN_SURFACE, SIGN_WHITE } from "@/components/files/SigningSectionFrame";
import { canDownloadFinal, createGateMessage, refusalKindLabel, retractAlert, retractDaysLabel, refusalNote, refusalsOf, settledState, stateLabel } from "@/lib/multiSignDerivations";
import { formatUiNumber } from "@/lib/dateFormat";
import { signGhostBtn, signKicker, signMono as mono, signPrimaryBtn, signProofGrid, signStateChip } from "./signingUi";

export { refusalNote, refusalsOf, settledState, stateLabel };

const stateChip = (state, mine, cooling) => {
  if (cooling) return signStateChip("warn");
  if (state === "awaiting_release") return signStateChip("warn");
  if (state === "completed") return signStateChip("ok");
  if (state === "rejected") return signStateChip("bad");
  if (state === "completed_with_refusal") return signStateChip("warn");
  return mine ? signStateChip("wait") : signStateChip("idle");
};

const proofState = (state, cooling, ar) => {
  if (cooling) return ar ? "مهلة تراجع · معلّق" : "Retract window · pending";
  if (state === "awaiting_release") return ar ? "بانتظار تمرير المنشئ" : "Awaiting creator release";
  if (state === "completed") return ar ? "مكتمل" : "Completed";
  if (state === "completed_with_refusal") return ar ? "مكتمل مع رفض" : "Completed with refusal";
  if (state === "rejected") return ar ? "مرفوض" : "Refused";
  return ar ? "جارٍ · متوازٍ" : "Pending · parallel";
};

function tipFor(request, { signed, pending, state, cooling }, ar) {
  if (cooling) {
    return {
      tone: "warn",
      text: ar
        ? "مهلة التراجع مفتوحة — الملف يبقى في الحالة حتى تُغلق النوافذ. البصمة ورقم التحقق يُثبَّتان بعدها، لا قبلها."
        : "A retract window is open — the file stays on Status until every window closes. The fingerprint and verification id register only after that.",
    };
  }
  if (state === "awaiting_release") {
    return {
      tone: "warn",
      text: ar
        ? "الأطراف أجابت. التنزيل والإشعار بعد أن يمرّر المنشئ التوقيع — حتى إن وقّع الجميع أو رُفض أحدهم."
        : "Every party has answered. Download and the completion notice wait until the creator releases the file — even if everyone signed or one refused.",
    };
  }
  if (state === "completed_with_refusal") {
    return {
      tone: "warn",
      text: ar
        ? "أُغلق بحالة «مكتمل مع رفض». الامتناع لا يوقف الملف — نزّل النسخة النهائية دون الرجوع للرافضين."
        : "Closed as “completed with refusal”. A refusal does not block the file — download the final copy without going back to the refusers.",
    };
  }
  if (state === "rejected") {
    return {
      tone: "warn",
      text: ar ? "رفض جميع الموقّعين. السبب في سجل التدقيق." : "Every signer refused. The reason sits in the audit trail.",
    };
  }
  if (state === "completed") {
    return {
      tone: "ok",
      text: ar
        ? "اكتمل الجميع وأُغلقت المهلة. البصمة في سجل الشركة — يمكن مطابقتها من تحقق."
        : "Everyone signed and the retract windows closed. The fingerprint is in the company registry — Verify can match it.",
    };
  }
  if (request.myStatus === "pending") {
    return {
      tone: "ok",
      text: ar
        ? `بانتظار ختمك · ${pending} متبقّون. التوقيع متوازٍ ولا ينتظر ترتيبًا.`
        : `Awaiting your seal · ${pending} still open. Signing is parallel — no forced order.`,
    };
  }
  return {
    tone: "neutral",
    text: ar
      ? `أُرسل الملف · وقّع ${signed} والباقي يعمل بالتوازي. من لم يوقّع لا يوقف الملف — ذكّر أو مرّر دون الباقي؛ كل إجراء في سجل التدقيق.`
      : `File sent · ${signed} signed, the rest continue in parallel. Silence does not block the file — remind or continue without the rest; every action is in the audit trail.`,
  };
}

function DeleteRequestDialog({ request, ar, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [intent, setIntent] = useState(false);
  if (!request) return null;
  const canSubmit = reason.trim().length > 0 && intent && !busy;
  return (
    <ComposerModalShell
      ar={ar}
      title={ar ? "حذف طلب التوقيع؟" : "Delete signature request?"}
      hint={ar
        ? "الحذف يُخرج الطلب من الحالة ويبقيه في الأرشيف وسجل التدقيق مع السبب والإقرار باسم المنشئ."
        : "Deletion removes the request from Status and keeps it in the archive and audit trail with the reason and acknowledgement under the creator’s name."}
      onClose={busy ? undefined : onClose}
      asForm={false}
      zIndex={120}
      footer={(
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy} style={ui.btnSecondary}>
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm(reason.trim())}
            style={{
              ...ui.btnPrimary,
              background: "#B91C1C",
              borderColor: "#B91C1C",
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 style={{ width: 14, height: 14 }} />}
            {ar ? "تأكيد الحذف" : "Confirm delete"}
          </button>
        </div>
      )}
    >
      <OpsTaskSection
        tone="bad"
        title={ar ? "إقرار الحذف" : "Deletion acknowledgement"}
        hint={ar ? "البوابة: السبب مطلوب. يظهر في سجل التدقيق باسم المنشئ." : "Named gate: a reason is required. It stays in the audit trail under the creator’s name."}
      >
        <div style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.65 }}>
          {ar
            ? `«${request.fileName}» لا يُمسح. يغادر الحالة ويبقى في الأرشيف وسجل التدقيق مع التوقيعات والامتناع والبصمة.`
            : `“${request.fileName}” is not wiped. It leaves Status and stays in the archive and audit trail with signatures, refusals, and the fingerprint.`}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 650, color: MUTED }}>{ar ? "سبب الحذف" : "Deletion reason"}</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={ar ? "سبب الحذف (مطلوب)" : "Deletion reason (required)"}
            style={textarea}
          />
        </label>
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
          {ar ? "السبب علني على السجل — ليُعرف لماذا أُخرج الطلب من الحالة." : "The reason is public on the record — so why it left Status stays visible."}
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.65, color: NAVY, cursor: "pointer" }}>
          <input type="checkbox" checked={intent} onChange={(event) => setIntent(event.target.checked)} style={{ marginTop: 3 }} />
          <span>
            {ar
              ? "أقرّ أن الحذف يُبقي الطلب في الأرشيف وسجل التدقيق، وأن السبب يُسجَّل باسمي كمنشئ."
              : "I acknowledge that deletion keeps the request in the archive and audit trail, and that the reason is recorded under my name as creator."}
          </span>
        </label>
      </OpsTaskSection>
    </ComposerModalShell>
  );
}

function partyLine(signer, ar) {
  const until = signer.retractUntil
    ? new Date(signer.retractUntil).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  const kind = refusalKindLabel(signer, ar);
  if (signer.status === "signed") {
    if (signer.canRetract) return ar ? `وقّع · ${retractDaysLabel(signer.retractDays || 1, true)}` : `Signed · ${retractDaysLabel(signer.retractDays || 1, false)}`;
    return until ? (ar ? "وقّع" : "Signed") : (ar ? "وقّع" : "Signed");
  }
  if (signer.status === "rejected") return kind;
  if (signer.status === "skipped") return ar ? "لم يوقّع" : "Unsigned";
  return ar ? "بانتظار" : "Waiting";
}

function PartyRow({ signer, index, ar, link, onCopyLink, copiedKey, canReopen, onReopen, reopening }) {
  const signed = signer.status === "signed";
  const refused = signer.status === "rejected";
  const skipped = signer.status === "skipped";
  const mark = signed ? "✓" : refused || skipped ? "×" : String(index + 1);
  const copied = copiedKey === signer.email;
  const actions = Boolean(link || canReopen);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: actions ? "16px minmax(0, 1fr) auto auto" : "16px minmax(0, 1fr) auto",
        gap: 8,
        alignItems: "center",
        padding: "5px 2px",
        minHeight: 32,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: `1.5px solid ${signed ? BRAND : refused ? "#DC2626" : skipped ? "#B45309" : BORDER}`,
          background: signed ? BRAND : "transparent",
          color: signed ? "#fff" : refused ? "#DC2626" : skipped ? "#B45309" : MUTED,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          ...mono,
          flexShrink: 0,
        }}
      >
        {mark}
      </span>
      <span style={{ fontSize: 13, fontWeight: 550, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {signer.name}
      </span>
      <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{partyLine(signer, ar)}</span>
      {actions ? (
        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
          {canReopen ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onReopen(signer); }}
              disabled={reopening}
              style={{ ...signGhostBtn, padding: "4px 8px", fontSize: 11 }}
            >
              {reopening ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw style={{ width: 12, height: 12 }} />}
              {ar ? "فتح مرة أخرى" : "Reopen"}
            </button>
          ) : null}
          {link ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onCopyLink(signer.email, link); }}
              style={{ ...signGhostBtn, padding: "4px 8px", fontSize: 11 }}
            >
              <Copy style={{ width: 12, height: 12 }} />
              {copied ? (ar ? "نُسخ" : "Copied") : (ar ? "رابط" : "Link")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function countLine(derived, ar) {
  const { signed, rejected, skipped, pending, total } = derived;
  const bits = [ar ? `${formatUiNumber(`${signed}/${total}`, true)} وقّعوا` : `${signed}/${total} signed`];
  if (pending) bits.push(ar ? `${formatUiNumber(pending, true)} بانتظار` : `${pending} waiting`);
  if (rejected) bits.push(ar ? `${formatUiNumber(rejected, true)} رفض` : `${rejected} refused`);
  if (skipped) bits.push(ar ? `${formatUiNumber(skipped, true)} دون توقيع` : `${skipped} unsigned`);
  return bits.join(" · ");
}

function RequestCard({
  request,
  open,
  onToggle,
  ar,
  sentLinks,
  downloadingId,
  deletingId,
  continuingId,
  reopeningKey,
  onDownload,
  onRemove,
  onContinue,
  onReopen,
  onCopy,
  copiedKey,
}) {
  const cardRef = useRef(null);
  const derived = settledState(request);
  const { pending, state, cooling } = derived;
  const note = refusalNote(request, ar);
  const senderAlert = request.isCreator ? retractAlert(request, ar) : "";
  const downloadReady = canDownloadFinal(request);
  const tip = tipFor(request, derived, ar);
  const hashLine = request.finalHash
    ? request.finalHash
    : state === "awaiting_release"
      ? (ar ? "يُثبَّت بعد تمرير المنشئ" : "Registers after the creator releases")
      : (ar ? "يُثبَّت بعد إغلاق المهلة وتمرير المنشئ" : "Registers after cooling closes and the creator releases");
  const title = (request.fileName || "").replace(/\.pdf$/i, "");
  const myLink = request.myStatus === "pending" && request.myToken
    ? `${window.location.origin}/sign?token=${request.myToken}`
    : "";
  const linksByEmail = Object.fromEntries((sentLinks || []).map((row) => [String(row.email || "").toLowerCase(), row.url]));
  const statusText = cooling
    ? stateLabel(state, ar, true)
    : state === "pending" && request.myStatus === "pending"
      ? (ar ? "بانتظار ختمك" : "Awaiting your seal")
      : stateLabel(state, ar, false, derived);

  useEffect(() => {
    if (!open || !cardRef.current) return;
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);

  return (
    <article
      ref={cardRef}
      id={`sign-request-${request.id}`}
      style={{
        background: open ? SIGN_SURFACE : SIGN_WHITE,
        border: "none",
        borderBottom: `1px solid ${SIGN_LINE}`,
        borderInlineStart: open ? `3px solid ${SIGN_NAVY}` : "3px solid transparent",
        borderRadius: 0,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        className="nv-sign-request-row"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) auto minmax(0, 1.2fr) auto",
          gap: 12,
          alignItems: "center",
          padding: "10px 14px",
          background: open ? SURFACE : CARD,
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "start",
          color: INK,
        }}
      >
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <span style={{ ...mono, fontSize: 11, color: MUTED }}>{request.verificationId || "—"}</span>
        </span>
        <span style={{ ...stateChip(state, request.myStatus === "pending", cooling), justifySelf: "start" }}>{statusText}</span>
        <span style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{countLine(derived, ar)}</span>
        <span style={{ fontSize: 11, color: MUTED }}>{open ? (ar ? "طي" : "Close") : (ar ? "تفاصيل" : "Open")}</span>
      </button>

      {open ? (
        <div className="nv-sign-request-detail" style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${BORDER}`, background: CARD }}>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "10px 14px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: MUTED }}>{tip.text}</p>
            {senderAlert || note ? (
              <p style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.6,
                color: state === "rejected" ? "#B91C1C" : "#92400E",
                display: "flex",
                gap: 6,
                alignItems: "flex-start",
              }}>
                <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2 }} />
                <span>{senderAlert || note}</span>
              </p>
            ) : null}
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                <span style={signKicker}>{ar ? "الأطراف" : "Parties"}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{countLine(derived, ar)}</span>
              </div>
              {(request.signers || []).map((signer, index) => (
                <PartyRow
                  key={`${signer.email}-${index}`}
                  signer={signer}
                  index={index}
                  ar={ar}
                  link={signer.status === "pending"
                    ? (linksByEmail[String(signer.email || "").toLowerCase()] || (signer.signToken ? `${window.location.origin}/sign?token=${signer.signToken}` : ""))
                    : ""}
                  onCopyLink={onCopy}
                  copiedKey={copiedKey}
                  canReopen={request.isCreator && signer.status === "rejected" && state !== "deleted"}
                  onReopen={(party) => onReopen(request, party)}
                  reopening={reopeningKey === `${request.id}:${signer.email}`}
                />
              ))}
            </section>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, color: NAVY }}>{ar ? "الإثبات" : "Proof"}</summary>
              <div style={{ ...signProofGrid, marginTop: 8, padding: "8px 10px" }}>
                <span style={{ color: MUTED }}>{ar ? "الحالة" : "State"}</span>
                <span style={{ color: cooling ? "#B45309" : INK, fontWeight: 500 }}>{proofState(state, cooling, ar)}</span>
                <span style={{ color: MUTED }}>{ar ? "بصمة الملف" : "SHA-256"}</span>
                <span dir="ltr" style={{ color: request.finalHash ? INK : MUTED, wordBreak: "break-all", textAlign: ar ? "right" : "left" }}>{hashLine}</span>
                <span style={{ color: MUTED }}>{ar ? "المرجع" : "Ref"}</span>
                <span dir="ltr" style={{ color: INK, textAlign: ar ? "right" : "left" }}>{request.verificationId || "—"}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                {ar ? "ليست شهادة حكومية مؤهلة. التحقق من سجل الشركة بعد إغلاق المهلة." : "Not a qualified government certificate. Verify against the company registry after cooling closes."}
              </p>
            </details>
            <SigningAuditTrail events={request.auditTrail} ar={ar} open={false} />
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderTop: `1px solid ${BORDER}`, flexWrap: "wrap", background: CARD }}>
            {request.myStatus === "pending" && request.myToken && state === "pending" ? (
              <Link to={`/app/signing?tab=mine&sign=${encodeURIComponent(request.myToken)}`} style={{ ...signPrimaryBtn, textDecoration: "none", padding: "7px 12px" }}>
                <PenLine style={{ width: 14, height: 14 }} />
                {ar ? "وقّع" : "Sign"}
              </Link>
            ) : null}
            {request.isCreator && state === "pending" && pending > 0 ? (
              <ConfirmDeleteDialog
                title={ar ? "متابعة الملف دون من لم يوقّع؟" : "Continue the file without those who have not signed?"}
                description={ar
                  ? "سيُغلق من لم يُجب. التنزيل وإشعار الاكتمال بعد أن تمرّر التوقيع إذا لم تبقَ مهلة تراجع."
                  : "Unanswered links close. Download and the completion notice follow after you release, once retract windows are shut."}
                confirmLabel={ar ? "متابعة دون الباقي" : "Continue without the rest"}
                danger={false}
                onConfirm={() => onContinue(request)}
                trigger={(
                  <button type="button" disabled={continuingId === request.id} style={{ ...signGhostBtn, padding: "7px 12px" }}>
                    {continuingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {ar ? "متابعة دون الباقي" : "Continue without"}
                  </button>
                )}
              />
            ) : null}
            {request.isCreator && state === "awaiting_release" ? (
              <ConfirmDeleteDialog
                title={ar ? "تمرير التوقيع وإنهاء الملف؟" : "Release the file and finish signing?"}
                description={ar
                  ? "بعد التمرير يمكن تنزيل النسخة النهائية ويُرسل إشعار الاكتمال. الرفض المسجّل يبقى في السجل."
                  : "After release the final copy can be downloaded and a completion notice is sent. Any recorded refusal stays in the audit trail."}
                confirmLabel={ar ? "مرّر التوقيع" : "Release file"}
                danger={false}
                onConfirm={() => onContinue(request)}
                trigger={(
                  <button type="button" disabled={continuingId === request.id} style={{ ...signPrimaryBtn, padding: "7px 12px" }}>
                    {continuingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {ar ? "مرّر التوقيع" : "Release file"}
                  </button>
                )}
              />
            ) : null}
            {request.docUrl && downloadReady ? (
              <button type="button" onClick={() => onDownload(request)} disabled={downloadingId === request.id} style={{ ...signGhostBtn, padding: "7px 12px" }}>
                {downloadingId === request.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Download style={{ width: 14, height: 14 }} />}
                {ar ? "النسخة النهائية" : "Final copy"}
              </button>
            ) : request.docUrl && state === "pending" && pending > 0 ? (
              <button type="button" onClick={() => onDownload(request)} disabled={downloadingId === request.id} style={{ ...signGhostBtn, padding: "7px 12px" }}>
                {downloadingId === request.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ExternalLink style={{ width: 14, height: 14 }} />}
                {ar ? "المستند" : "Document"}
              </button>
            ) : null}
            {myLink ? (
              <button type="button" onClick={() => onCopy("mine", myLink)} style={{ ...signGhostBtn, padding: "7px 12px" }}>
                <Copy style={{ width: 13, height: 13 }} />
                {copiedKey === "mine" ? (ar ? "نُسخ" : "Copied") : (ar ? "نسخ الرابط" : "Copy link")}
              </button>
            ) : null}
            {request.verificationId ? (
              <button type="button" onClick={() => onCopy("ref", request.verificationId)} style={{ ...signGhostBtn, padding: "7px 12px" }}>
                <Copy style={{ width: 13, height: 13 }} />
                {copiedKey === "ref" ? (ar ? "نُسخ" : "Copied") : (ar ? "نسخ المرجع" : "Copy ref")}
              </button>
            ) : null}
            {request.isCreator && state !== "deleted" ? (
              <button
                type="button"
                disabled={deletingId === request.id}
                onClick={() => onRemove(request)}
                style={{ ...signGhostBtn, padding: "7px 12px", color: "#DC2626", marginInlineStart: "auto" }}
              >
                {deletingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 style={{ width: 14, height: 14 }} />}
                {ar ? "حذف" : "Delete"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function shortHash(hash) {
  const clean = String(hash || "").replace(/\s/g, "");
  if (!clean) return "";
  if (clean.length < 16) return clean;
  return `${clean.slice(0, 4)} ${clean.slice(4, 8)} … ${clean.slice(-4)}`;
}

function auditStamp(value, ar) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function auditText(event, ar) {
  const who = event.actorName || event.targetName || "";
  const kind = {
    created: ar ? "أُنشئ المظروف" : "Envelope created",
    signed: ar ? "وقّع" : "Signed",
    rejected: ar ? "رفض" : "Refused",
    deleted: ar ? "أُلغي" : "Voided",
    reminder_sent: ar ? "أُرسل تذكير" : "Reminder sent",
    skipped: ar ? "استمر الملف دون توقيعه" : "File continued without a signature",
    continued: ar ? "مُرّر دون الباقي" : "Continued without the rest",
    released: ar ? "مرّر المنشئ التوقيع" : "Creator released the file",
    retracted: ar ? "تُراجع عن التوقيع" : "Signature retracted",
    retract_window: ar ? "فُتحت مهلة تراجع" : "Retract window opened",
    retract_closed: ar ? "أُغلقت مهلة التراجع" : "Retract window closed",
    reopened: ar ? "أُعيد فتح التوقيع" : "Signing reopened",
    deadline_elapsed: ar ? "رفض بانتهاء المدة" : "Refused — deadline elapsed",
    lapsed: ar ? "انتهت صلاحية الرابط" : "Link expired",
  }[event.type] || event.type;
  return [who, kind, event.reason].filter(Boolean).join(" — ");
}

function EnvelopePath({
  request,
  ar,
  knownEmails,
  sentLinks,
  loading,
  remindingKey,
  downloadingId,
  deletingId,
  continuingId,
  reopeningKey,
  copiedKey,
  onRemind,
  onDownload,
  onRemove,
  onContinue,
  onReopen,
  onCopy,
  onReload,
}) {
  const derived = settledState(request);
  const { pending, state, cooling, signed, total } = derived;
  const downloadReady = canDownloadFinal(request);
  const toneKey = state === "deleted" ? "idle"
    : state === "rejected" ? "bad"
      : state === "completed" ? "ok"
        : state === "completed_with_refusal" || cooling || state === "awaiting_release" ? "warn"
          : request.myStatus === "pending" ? "wait" : "idle";
  const label = cooling
    ? stateLabel(state, ar, true)
    : state === "pending" && request.myStatus === "pending"
      ? (ar ? "يحتاج توقيعك" : "Needs your signature")
      : state === "pending"
        ? (ar ? "بانتظار الآخرين" : "Waiting on others")
        : stateLabel(state, ar, false, derived);
  const title = (request.fileName || "").replace(/\.pdf$/i, "");
  const linksByEmail = Object.fromEntries((sentLinks || []).map((row) => [String(row.email || "").toLowerCase(), row.url]));
  const known = knownEmails || new Set();
  const steps = [
    {
      key: "sender",
      name: ar ? `أُرسل من ${request.creatorName || "—"}` : `Sent by ${request.creatorName || "—"}`,
      email: "",
      kind: ar ? "مرسِل" : "Sender",
      external: false,
      detail: auditStamp(request.createdAt, ar),
      state: ar ? "أُرسل" : "Sent",
      mark: "✓",
      dot: "sent",
    },
    ...(request.signers || []).map((signer, index) => {
      const email = String(signer.email || "").toLowerCase();
      const external = email ? !known.has(email) : false;
      const signedRow = signer.status === "signed";
      const refused = signer.status === "rejected";
      return {
        key: `${email}-${index}`,
        name: signer.name,
        email: signer.email,
        kind: external ? (ar ? "خارجي" : "External") : (ar ? "موظف" : "Employee"),
        external,
        detail: signer.signedAt
          ? auditStamp(signer.signedAt, ar)
          : signer.rejectedAt
            ? (signer.rejectionReason || auditStamp(signer.rejectedAt, ar))
            : signer.status === "skipped"
              ? (ar ? "لم يوقّع — استمر الملف" : "Did not sign — file continued")
              : (ar ? "لم يُكمل بعد" : "Not finished yet"),
        state: signedRow ? (ar ? "وقّع" : "Signed") : refused ? (ar ? "رفض" : "Refused") : signer.status === "skipped" ? (ar ? "دون توقيع" : "Unsigned") : (ar ? "بانتظار" : "Waiting"),
        mark: signedRow ? "✓" : String(index + 1),
        dot: signedRow ? "sent" : refused ? "bad" : "wait",
        signer,
        canReopen: request.isCreator && refused && state !== "deleted",
      };
    }),
  ];
  const ghost = { ...signGhostBtn, height: 30, padding: "0 12px", borderRadius: 9, fontSize: 11.5 };
  const solid = { ...signPrimaryBtn, height: 30, padding: "0 12px", borderRadius: 9, fontSize: 11.5, background: "var(--nv-navy)", border: "1px solid var(--nv-navy)" };
  const log = (request.auditTrail || []).map((event) => ({ at: auditStamp(event.at, ar), text: auditText(event, ar) }));
  if (!log.length) {
    log.push({ at: auditStamp(request.lastActivityAt || request.createdAt, ar), text: ar ? "آخر تحديث على المظروف." : "Latest update on the envelope." });
  }

  return (
    <div className="nv-sign-split" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 1fr)", gap: 16, alignItems: "start" }}>
      <section style={{ background: SIGN_WHITE, border: `1px solid ${SIGN_LINE}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line3)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ width: 32, height: 38, borderRadius: 5, flex: "none", display: "inline-flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5, boxSizing: "border-box", font: "700 8px 'IBM Plex Mono', monospace", color: "#fff", background: toneKey === "ok" ? "var(--nv-ok-fill)" : toneKey === "bad" ? "var(--nv-bad-fill)" : toneKey === "warn" || toneKey === "wait" ? "var(--nv-warn-fill)" : "var(--nv-navy)" }}>PDF</span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <strong style={{ font: "700 14px var(--font-heading), sans-serif" }}>{title}</strong>
            <span dir="ltr" style={{ ...mono, fontSize: 10.5, color: SIGN_MUTED, textAlign: "end" }}>{request.verificationId || "—"}</span>
          </div>
          <span style={signStateChip(toneKey)}>{label}</span>
        </div>
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column" }}>
          <span style={signKicker}>{ar ? "مسار المظروف" : "Envelope path"}</span>
          <div style={{ height: 8 }} />
          {steps.map((step, index) => (
            <div key={step.key} style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "600 11px 'IBM Plex Mono', monospace",
                  background: step.dot === "sent" ? "var(--nv-ok-ink)" : step.dot === "bad" ? "var(--nv-bad-ink)" : SIGN_WHITE,
                  color: step.dot === "wait" ? "var(--nv-ink)" : "#fff",
                  border: step.dot === "wait" ? "1.5px solid var(--nv-box)" : "none",
                }}>{step.mark}</span>
                <span style={{ flex: 1, width: 2, background: index === steps.length - 1 ? "transparent" : step.dot === "sent" ? "var(--nv-ok-ink)" : SIGN_LINE }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", paddingBottom: 16, minWidth: 0 }}>
                <strong style={{ fontSize: 12.5 }}>
                  {step.name}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, marginInlineStart: 4, background: step.external ? "var(--nv-warn-soft)" : "var(--nv-soft)", color: step.external ? "var(--nv-warn-ink)" : "var(--nv-mute-ink)" }}>{step.kind}</span>
                </strong>
                {step.email ? <span dir="ltr" style={{ ...mono, fontSize: 11, color: SIGN_MUTED, textAlign: "end" }}>{step.email}</span> : null}
                <span style={{ fontSize: 11, color: "var(--nv-ink2)" }}>{step.detail}</span>
                {step.canReopen ? (
                  <button type="button" onClick={() => onReopen(request, step.signer)} disabled={reopeningKey === `${request.id}:${step.signer.email}`} style={{ ...ghost, marginTop: 6, alignSelf: "flex-start" }}>
                    {reopeningKey === `${request.id}:${step.signer.email}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw style={{ width: 12, height: 12 }} />}
                    {ar ? "فتح مرة أخرى" : "Reopen"}
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, alignSelf: "center" }}>
                <span style={signStateChip(step.dot === "sent" ? "ok" : step.dot === "bad" ? "bad" : "idle")}>{step.state}</span>
                {request.isCreator && state === "pending" && step.signer?.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => onRemind(request, step.signer)}
                    disabled={remindingKey === `${request.id}:${step.signer.email}`}
                    style={{
                      ...signStateChip("idle"),
                      fontFamily: "inherit",
                      cursor: remindingKey === `${request.id}:${step.signer.email}` ? "wait" : "pointer",
                      background: SIGN_WHITE,
                    }}
                  >
                    {ar ? "ذكّر" : "Remind"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--nv-line3)", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {request.myStatus === "pending" && request.myToken && state === "pending" && !cooling ? (
            <Link to={`/app/signing?sign=${encodeURIComponent(request.myToken)}`} style={{ ...solid, textDecoration: "none", background: "var(--nv-warn-fill)", borderColor: "var(--nv-warn-fill)" }}>
              <PenLine style={{ width: 13, height: 13 }} />
              {ar ? "وقّع" : "Sign"}
            </Link>
          ) : null}
          {request.isCreator && state === "pending" && pending > 0 ? (
            <ConfirmDeleteDialog
              title={ar ? "متابعة الملف دون من لم يوقّع؟" : "Continue the file without those who have not signed?"}
              description={ar
                ? "سيُغلق من لم يُجب. التنزيل وإشعار الاكتمال بعد أن تمرّر التوقيع إذا لم تبقَ مهلة تراجع."
                : "Unanswered links close. Download and the completion notice follow after you release, once retract windows are shut."}
              confirmLabel={ar ? "متابعة دون الباقي" : "Continue without the rest"}
              danger={false}
              onConfirm={() => onContinue(request)}
              trigger={(
                <button type="button" disabled={continuingId === request.id} style={ghost}>
                  {continuingId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {ar ? "متابعة دون الباقي" : "Continue without the rest"}
                </button>
              )}
            />
          ) : null}
          {request.isCreator && state === "awaiting_release" ? (
            <ConfirmDeleteDialog
              title={ar ? "تمرير التوقيع وإنهاء الملف؟" : "Release the file and finish signing?"}
              description={ar
                ? "بعد التمرير يمكن تنزيل النسخة النهائية ويُرسل إشعار الاكتمال. الرفض المسجّل يبقى في السجل."
                : "After release the final copy can be downloaded and a completion notice is sent. Any recorded refusal stays in the audit trail."}
              confirmLabel={ar ? "مرّر التوقيع" : "Release file"}
              danger={false}
              onConfirm={() => onContinue(request)}
              trigger={(
                <button type="button" disabled={continuingId === request.id} style={solid}>
                  {continuingId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {ar ? "مرّر التوقيع" : "Release file"}
                </button>
              )}
            />
          ) : null}
          {downloadReady ? (
            <button type="button" onClick={() => onDownload(request)} disabled={downloadingId === request.id} style={state === "completed" || state === "completed_with_refusal" ? solid : ghost}>
              {downloadingId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download style={{ width: 13, height: 13 }} />}
              {ar ? "تنزيل المستند" : "Download"}
            </button>
          ) : null}
          {(() => {
            const party = (request.signers || []).find((signer) => signer.status === "pending");
            const url = party
              ? (linksByEmail[String(party.email || "").toLowerCase()] || (party.signToken ? `${window.location.origin}/sign?token=${party.signToken}` : ""))
              : "";
            if (!url) return null;
            return (
              <button type="button" onClick={() => onCopy("party", url)} style={ghost}>
                <Copy style={{ width: 13, height: 13 }} />
                {copiedKey === "party" ? (ar ? "نُسخ" : "Copied") : (ar ? "نسخ رابط الطرف" : "Copy party link")}
              </button>
            );
          })()}
          <button type="button" onClick={onReload} disabled={loading} style={ghost} aria-label={ar ? "تحديث" : "Refresh"}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {request.isCreator && state !== "deleted" ? (
            <button type="button" disabled={deletingId === request.id} onClick={() => onRemove(request)} style={{ ...ghost, color: "var(--nv-bad-ink)", borderColor: "var(--nv-bad-line)" }}>
              {deletingId === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {ar ? "إلغاء المظروف" : "Void envelope"}
            </button>
          ) : null}
          <span style={{ ...mono, fontSize: 10.5, color: SIGN_MUTED, alignSelf: "center" }}>{formatUiNumber(`${signed}/${total}`, ar)}</span>
        </div>
      </section>
      <section style={{ background: SIGN_WHITE, border: `1px solid ${SIGN_LINE}`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <strong style={{ font: "700 13.5px var(--font-heading), sans-serif" }}>{ar ? "سجل التدقيق" : "Audit trail"}</strong>
        {log.map((row, index) => (
          <div key={`${row.at}-${index}`} style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 10, fontSize: 11.5, padding: "6px 0", borderBottom: "1px solid var(--nv-line2)" }}>
            <span dir="ltr" style={{ ...mono, fontSize: 10.5, color: SIGN_MUTED, whiteSpace: "nowrap" }}>{row.at}</span>
            <span>{row.text}</span>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "4px 12px", fontSize: 11, paddingTop: 6 }}>
          <span style={{ color: SIGN_MUTED }}>{ar ? "المرسِل" : "Sender"}</span>
          <span>{request.creatorName || "—"}</span>
          <span style={{ color: SIGN_MUTED }}>{ar ? "البصمة" : "Fingerprint"}</span>
          <span dir="ltr" style={{ ...mono, textAlign: "end", wordBreak: "break-all" }}>{request.finalHash ? shortHash(request.finalHash) : (ar ? "تُثبَّت عند الإكمال" : "Registers when complete")}</span>
        </div>
        <p style={{ margin: 0, fontSize: 10.5, color: SIGN_MUTED, lineHeight: 1.7 }}>
          {ar ? "بصمة SHA-256 في سجل الشركة بعد إغلاق المهلة وتمرير المنشئ. ليست شهادة حكومية." : "SHA-256 is written to the company registry after cooling closes and the creator releases. Not a government certificate."}
        </p>
      </section>
    </div>
  );
}

export default function SigningStatusBoard({
  requests,
  loading,
  currentUser,
  companyId,
  ar,
  onReload,
  focusRequestId = "",
  sentLinks = [],
  variant = "status",
  knownEmails,
}) {
  const [openId, setOpenId] = useState(focusRequestId || "");
  const [deletingId, setDeletingId] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);
  const [continuingId, setContinuingId] = useState(null);
  const [remindingKey, setRemindingKey] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [reopeningKey, setReopeningKey] = useState("");

  useEffect(() => {
    if (focusRequestId) setOpenId(focusRequestId);
  }, [focusRequestId]);

  const actor = {
    id: currentUser?.id,
    userId: currentUser?.id,
    email: currentUser?.email || "",
    name: currentUser?.name || "",
    companyId,
  };

  // Delete, continue-without and reopen decide the fate of a signed file. This used
  // to re-run any failed call on the local ledger, so a server that refused the
  // account — expired session, not the creator, not allowed to release — had its
  // refusal carried out locally anyway and never shown. Only an unreachable service
  // falls back; a refusal is re-thrown with its named reason for the toast below.
  const call = async (payload) => {
    if (shouldUseLocalMultiSign()) return invokeLocalMultiSign(payload, { actor });
    try {
      const response = await base44.functions.invoke("multiSign", payload);
      return response?.data || response;
    } catch (err) {
      if (!isServiceOutage(err)) throw refusalError(err);
      const local = invokeLocalMultiSign(payload, { actor });
      if (local?.error) throw err;
      return local;
    }
  };

  const remove = async (request, reason) => {
    setDeletingId(request.id);
    try {
      const body = await call({
        action: "delete",
        companyId,
        sessionToken: getCompanyToken(companyId),
        userId: currentUser.id,
        requestId: request.id,
        reason,
      });
      if (body?.error) throw new Error(body.reason || body.error);
      setDeleteFor(null);
      onReload?.();
    } catch (error) {
      toast({ description: error?.response?.data?.error || error.message || (ar ? "تعذّر حذف الطلب." : "Couldn't delete the request."), variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const continueWithout = async (request) => {
    setContinuingId(request.id);
    try {
      const body = await call({
        action: "continueWithout",
        companyId,
        sessionToken: getCompanyToken(companyId),
        userId: currentUser.id,
        requestId: request.id,
        lang: ar ? "ar" : "en",
      });
      if (body?.error) throw new Error(body.reason || body.error);
      if (body?.notifyComplete || body?.released) {
        const next = {
          ...request,
          status: body.status || request.status,
          releasedAt: request.releasedAt || new Date().toISOString(),
        };
        writeSigningCompletionNotices(companyId, next, actor, ar);
        toast({
          description: body.status === "completed_with_refusal"
            ? (ar ? "اكتمل التوقيع مع رفض — يمكن تنزيل النسخة النهائية. أُضيف إشعار في القائمة." : "Completed with a refusal — the final copy can be downloaded. A notice was added to the list.")
            : (ar ? "اكتمل التوقيع — يمكن تنزيل النسخة النهائية. أُضيف إشعار في القائمة." : "Signing completed — the final copy can be downloaded. A notice was added to the list."),
        });
      }
      onReload?.();
    } catch (error) {
      toast({ description: error?.response?.data?.error || error.message || (ar ? "تعذّر متابعة الملف." : "Couldn't continue the file."), variant: "destructive" });
    } finally {
      setContinuingId(null);
    }
  };

  const reopen = async (request, signer) => {
    const key = `${request.id}:${signer.email}`;
    setReopeningKey(key);
    try {
      const body = await call({
        action: "reopen",
        companyId,
        sessionToken: getCompanyToken(companyId),
        userId: currentUser.id,
        requestId: request.id,
        signerEmail: signer.email,
        lang: ar ? "ar" : "en",
      });
      if (body?.error) throw new Error(createGateMessage(body.error, ar) || body.reason || body.error);
      toast({ description: ar ? `أُعيد فتح التوقيع لـ ${signer.name}.` : `Signing reopened for ${signer.name}.` });
      onReload?.();
    } catch (error) {
      toast({ description: createGateMessage(error.message, ar) || error?.response?.data?.error || error.message || (ar ? "تعذّر إعادة الفتح." : "Couldn't reopen signing."), variant: "destructive" });
    } finally {
      setReopeningKey("");
    }
  };

  const remind = async (request, signer) => {
    const key = `${request.id}:${signer.email}`;
    setRemindingKey(key);
    try {
      await call({
        action: "remind",
        companyId,
        sessionToken: getCompanyToken(companyId),
        userId: currentUser.id,
        requestId: request.id,
        signerEmail: signer.email,
        lang: ar ? "ar" : "en",
      });
    } catch (error) {
      toast({ description: error?.response?.data?.error || (ar ? "تعذّر إرسال التذكير." : "Couldn't send the reminder."), variant: "destructive" });
    } finally {
      setRemindingKey("");
    }
  };

  const download = async (request) => {
    if (!request.docUrl) return;
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

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    } catch {
      toast({ description: ar ? "تعذّر النسخ." : "Couldn't copy.", variant: "destructive" });
    }
  };

  if (requests === null) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: SIGN_MUTED, padding: "24px 18px" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {ar ? "جارٍ تحميل حالة الملفات…" : "Loading file status…"}
      </div>
    );
  }

  if (variant === "path") {
    const focus = focusRequestId ? requests.find((row) => row.id === focusRequestId) : null;
    const shown = focus ? [focus] : requests.slice(0, 1);
    return (
      <div>
        {shown.length === 0 ? (
          <div style={{ padding: "24px 20px", fontSize: 12, color: SIGN_MUTED, lineHeight: 1.8, background: SIGN_WHITE, border: `1px solid ${SIGN_LINE}`, borderRadius: 14 }}>
            {ar ? "لا مظروف لتتبّعه. اختر اتفاقاً من القائمة." : "No envelope to track. Pick an agreement from the list."}
          </div>
        ) : shown.map((request) => (
          <EnvelopePath
            key={request.id}
            request={request}
            ar={ar}
            knownEmails={knownEmails}
            sentLinks={sentLinks}
            loading={loading}
            remindingKey={remindingKey}
            downloadingId={downloadingId}
            deletingId={deletingId}
            continuingId={continuingId}
            reopeningKey={reopeningKey}
            copiedKey={copiedKey}
            onRemind={remind}
            onDownload={download}
            onRemove={setDeleteFor}
            onContinue={continueWithout}
            onReopen={reopen}
            onCopy={copy}
            onReload={onReload}
          />
        ))}
        <DeleteRequestDialog
          request={deleteFor}
          ar={ar}
          busy={Boolean(deleteFor && deletingId === deleteFor.id)}
          onClose={() => { if (!deletingId) setDeleteFor(null); }}
          onConfirm={(reason) => remove(deleteFor, reason)}
        />
      </div>
    );
  }

  const rows = focusRequestId
    ? [...requests].sort((left, right) => (left.id === focusRequestId ? -1 : right.id === focusRequestId ? 1 : 0))
    : requests;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px", borderBottom: `1px solid ${SIGN_LINE}`, background: SIGN_WHITE }}>
        <button type="button" onClick={onReload} disabled={loading} style={signGhostBtn} aria-label={ar ? "تحديث" : "Refresh"}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {requests.length === 0 ? (
        <div style={{ padding: "24px 20px", fontSize: 12, color: SIGN_MUTED, lineHeight: 1.8 }}>
          {variant === "archive"
            ? (ar ? "لا توجد ملفات مؤرشفة بعد." : "No archived files yet.")
            : (ar ? "لا يوجد ملف قيد التوقيع الآن. ما اكتمل تجده في الأرشيف." : "No file is in signing right now. Anything settled sits in the archive.")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              open={openId === request.id}
              onToggle={() => setOpenId((current) => (current === request.id ? "" : request.id))}
              ar={ar}
              sentLinks={openId === request.id ? sentLinks : []}
              downloadingId={downloadingId}
              deletingId={deletingId}
              continuingId={continuingId}
              reopeningKey={reopeningKey}
              onDownload={download}
              onRemove={setDeleteFor}
              onContinue={continueWithout}
              onReopen={reopen}
              onCopy={copy}
              copiedKey={copiedKey}
            />
          ))}
        </div>
      )}
      <DeleteRequestDialog
        request={deleteFor}
        ar={ar}
        busy={Boolean(deleteFor && deletingId === deleteFor.id)}
        onClose={() => { if (!deletingId) setDeleteFor(null); }}
        onConfirm={(reason) => remove(deleteFor, reason)}
      />
    </div>
  );
}
