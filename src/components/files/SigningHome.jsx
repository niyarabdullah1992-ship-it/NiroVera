import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, PenLine, ShieldCheck, Upload, Users } from "lucide-react";
import { imageBlobToPdf } from "@/lib/signPdf";
import SigningStatusBoard, { settledState, stateLabel } from "@/components/files/SigningStatusBoard";
import { canDownloadFinal, isOpenSigningState } from "@/lib/multiSignDerivations";
import SigningArchiveBoard from "@/components/files/SigningArchiveBoard";
import VerifyWorkspace from "@/components/files/VerifyWorkspace";
import { signGhostBtn, signMono as mono, signPrimaryBtn } from "./signingUi";
import { signTab } from "@/components/files/SigningSectionFrame";
import {
  SIGN_BODY,
  SIGN_GREEN,
  SIGN_INK,
  SIGN_LINE,
  SIGN_MARK,
  SIGN_MUTED,
  SIGN_NAVY,
  SIGN_SOFT,
  SIGN_SURFACE,
  SIGN_WHITE,
} from "@/components/files/SigningSectionFrame";
import { formatUiNumber } from "@/lib/dateFormat";

const MAX_SIZE = 25 * 1024 * 1024;
const GRID_COLS = "minmax(200px, 2.2fr) minmax(0, 1.2fr) minmax(100px, 160px) 118px 120px 92px";
const isPdf = (file) => file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
const isPng = (file) => file?.type === "image/png" || file?.name?.toLowerCase().endsWith(".png");
const isJpeg = (file) => file?.type === "image/jpeg" || /\.jpe?g$/i.test(file?.name || "");
const isImage = (file) => isPng(file) || isJpeg(file);

const stamp = (value, ar) => (value
  ? new Date(value).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "—");

const PAPER = {
  background: SIGN_WHITE,
  border: `1px solid ${SIGN_LINE}`,
  borderRadius: 14,
  boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
  boxSizing: "border-box",
};

function StatTile({ value, label, note, accent, ar }) {
  return (
    <div style={{ background: SIGN_WHITE, borderTop: `3px solid ${accent}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0, boxSizing: "border-box" }}>
      <span style={{ fontSize: 12, color: SIGN_BODY }}>{label}</span>
      <span dir="ltr" style={{ ...mono, fontSize: 30, fontWeight: 500, color: accent, lineHeight: 1.05 }}>{formatUiNumber(value, ar)}</span>
      {note ? <span style={{ fontSize: 11, color: SIGN_MUTED, lineHeight: 1.7 }}>{note}</span> : null}
    </div>
  );
}

async function downloadFinalCopy(request) {
  if (!request?.docUrl) return;
  try {
    const blob = await fetch(request.docUrl).then((response) => response.blob());
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = request.fileName || "document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    window.open(request.docUrl, "_blank");
  }
}

function DocumentRow({ request, ar, onOpen }) {
  const [hover, setHover] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { signed, total, rejected, skipped, state, cooling } = settledState(request);
  const downloadReady = canDownloadFinal(request);
  const pct = total ? Math.round((signed / total) * 100) : 0;
  const tone = state === "deleted" ? "#8a1c2b"
    : cooling ? "#8a6516"
    : state === "awaiting_release" ? "#8a6516"
    : state === "completed" ? SIGN_GREEN
    : state === "rejected" ? "#8a1c2b"
      : state === "completed_with_refusal" ? "#8a6516"
        : request.myStatus === "pending" ? SIGN_MARK : SIGN_INK;
  const label = state === "deleted"
    ? stateLabel(state, ar)
    : cooling
    ? stateLabel(state, ar, true)
    : state === "pending" && request.myStatus === "pending"
    ? (ar ? "ينتظر ختمك" : "Awaiting your seal")
    : stateLabel(state, ar, false, { skipped, rejected });
  const parties = (request.signers || []).map((signer) => signer.name).filter(Boolean);
  const partyText = parties.length > 2
    ? `${parties[0]} + ${formatUiNumber(parties.length - 1, ar)}`
    : parties.join("، ") || "—";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(request)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(request); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLS,
        gap: 16,
        padding: "13px 18px",
        borderBottom: "1px solid #f7f8fa",
        alignItems: "center",
        cursor: "pointer",
        background: hover ? SIGN_SURFACE : SIGN_WHITE,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "30px minmax(0, 1fr)", gap: 11, alignItems: "center", minWidth: 0 }}>
        <span style={{ width: 30, height: 38, border: `1px solid ${SIGN_LINE}`, background: SIGN_WHITE, display: "inline-flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 8, color: SIGN_MUTED, flexShrink: 0 }}>
          {ar ? "ملف" : "PDF"}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: SIGN_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{request.fileName}</span>
          <span dir="ltr" style={{ ...mono, fontSize: 11, color: SIGN_MUTED, textAlign: ar ? "right" : "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {request.verificationId || request.creatorName}
          </span>
        </span>
      </div>

      <span style={{ fontSize: 12, color: SIGN_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{partyText}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ flex: 1, height: 4, background: "#f1f4f8", overflow: "hidden", minWidth: 0 }}>
          <span style={{ display: "block", height: "100%", width: `${pct}%`, background: rejected > 0 ? "#8a6516" : state === "completed" ? SIGN_GREEN : SIGN_MARK }} />
        </span>
        <span style={{ ...mono, fontSize: 11, color: SIGN_MUTED, flexShrink: 0 }}>{formatUiNumber(`${signed}/${total}`, ar)}</span>
      </div>

      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: tone, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone, flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </span>

      <span dir="ltr" style={{ ...mono, fontSize: 11, color: SIGN_MUTED, textAlign: ar ? "right" : "left" }}>
        {stamp(request.lastActivityAt || request.createdAt, ar)}
      </span>

      <span style={{ display: "flex", justifyContent: ar ? "flex-start" : "flex-end" }}>
        {downloadReady ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (downloading) return;
              setDownloading(true);
              downloadFinalCopy(request).finally(() => setDownloading(false));
            }}
            disabled={downloading}
            style={{ ...signGhostBtn, padding: "5px 9px", fontSize: 11 }}
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download style={{ width: 12, height: 12 }} />}
            {ar ? "تنزيل" : "Download"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

export default function SigningHome({
  ar,
  lang,
  currentUser,
  companyId,
  requests,
  activeRequests,
  loading,
  canGroup,
  initialFilter = "all",
  activeFilter,
  sealPreview,
  sealId,
  sealReady,
  onOpenStudio,
  onRemoveSeal,
  onOpenDocument,
  onOpenRequest,
  onReload,
  focusRequestId = "",
  sentLinks = [],
}) {
  const inputRef = useRef(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [focusId, setFocusId] = useState(focusRequestId);

  useEffect(() => {
    if (activeFilter) setFilter(activeFilter);
  }, [activeFilter]);

  const rows = useMemo(() => requests || [], [requests]);
  const counts = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    let mine = 0;
    let open = 0;
    let done = 0;
    rows.forEach((row) => {
      const { state } = settledState(row);
      if (isOpenSigningState(state)) {
        open += 1;
        if (row.myStatus === "pending") mine += 1;
      } else if (String(row.lastActivityAt || "").slice(0, 7) === month) {
        done += 1;
      }
    });
    return { mine, open, done };
  }, [rows]);

  // Archive is a filter, not a separate destination — the same rule the tasks board
  // uses: the toolbar stays put and the surface below it swaps.
  const settled = useMemo(() => rows.filter((row) => !isOpenSigningState(settledState(row).state)), [rows]);
  const filtered = useMemo(() => rows.filter((row) => {
    const { state } = settledState(row);
    if (filter === "mine") return isOpenSigningState(state) && row.myStatus === "pending";
    if (filter === "sent") return row.isCreator;
    return true;
  }), [rows, filter]);

  const openRow = (request) => {
    const { state } = settledState(request);
    if (state === "deleted") {
      setFilter("archive");
      return;
    }
    if (request.myStatus === "pending" && request.myToken) {
      onOpenRequest(request);
      return;
    }
    if (isOpenSigningState(state)) {
      setFocusId(request.id);
      setFilter("status");
      return;
    }
    setFilter("archive");
  };

  const accept = async (file) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_SIZE) {
      setError(ar ? "الحد الأعلى 25 ميجابايت." : "The limit is 25MB.");
      return;
    }
    if (!isPdf(file) && !isImage(file)) {
      setError(ar
        ? "ورشة التوقيع تفتح PDF أو صورة PNG/JPEG. ملفات Word وExcel تُصدَّر إلى PDF من التطبيق الذي أنشأها ثم تُرفع هنا."
        : "The workspace opens PDF or a PNG/JPEG image. Export Word or Excel to PDF from the app that created them, then upload here.");
      return;
    }
    setPreparing(true);
    try {
      if (isPdf(file)) {
        onOpenDocument({ file, sourceUrl: URL.createObjectURL(file) });
      } else {
        const { bytes } = await imageBlobToPdf(file, false);
        const pdfFile = new File([bytes], file.name.replace(/\.(png|jpe?g)$/i, ".pdf"), { type: "application/pdf" });
        onOpenDocument({ file: pdfFile, sourceUrl: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) });
      }
    } catch {
      setError(ar
        ? "تعذّر تغليف الصورة في PDF. جرّب PNG أو JPEG، أو صدّر المستند إلى PDF ثم ارفعه."
        : "Couldn't wrap that image into a PDF. Try PNG or JPEG, or export the document to PDF and upload that.");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const composing = filter === "all" || filter === "mine" || filter === "sent";
  const heading = filter === "status"
    ? { kicker: ar ? "بعد الإرسال" : "After send", title: ar ? "الحالة والإثبات" : "Status and proof", hint: ar ? "الأطراف، مهلة التراجع، وسجل التدقيق. البصمة تُثبَّت بعد إغلاق المهلة — ليست شهادة حكومية." : "Parties, retract window, audit. The fingerprint registers after cooling closes — not a government certificate." }
    : filter === "archive"
      ? { kicker: ar ? "ما اكتمل" : "Settled", title: ar ? "الأرشيف" : "Archive", hint: ar ? "ما اكتمل أو أُغلق مع رفض أو حُذف — السجل يبقى مقروءًا." : "What completed, closed with refusal, or was deleted — the trail stays readable." }
      : filter === "verify"
        ? { kicker: "DOCUMENT VERIFICATION", title: ar ? "تحقق من مستند موقّع" : "Verify a signed document", hint: ar ? "تُحسب بصمة الملف على جهازك وتُطابق مع سجل الشركة. الملف لا يُرفع إلى الخادم." : "The file fingerprint is computed on your device and matched to the company registry. The file is never uploaded." }
        : { kicker: ar ? `أهلًا، ${currentUser?.name || ""}` : `Welcome, ${currentUser?.name || ""}`, title: ar ? "ابدأ توقيعًا جديدًا" : "Start a new signing", hint: "" };

  const filters = [
    { id: "all", num: "01", label: ar ? "الكل" : "All", count: rows.length },
    { id: "mine", num: "02", label: ar ? "ينتظر ختمك" : "Awaiting you", count: counts.mine },
    { id: "sent", num: "03", label: ar ? "أرسلتها" : "Sent by me" },
    { id: "status", num: "04", label: ar ? "الحالة" : "Status", count: counts.open },
    { id: "archive", num: "05", label: ar ? "الأرشيف" : "Archive", count: settled.length },
    { id: "verify", num: "06", label: ar ? "تحقق" : "Verify" },
  ];

  const stats = composing
    ? [
      { val: counts.mine, lbl: ar ? "ينتظر ختمك" : "Awaiting your seal", note: ar ? "ملفات تحتاج ختمك الآن" : "Files waiting for your seal", accent: counts.mine ? SIGN_MARK : SIGN_NAVY },
      { val: counts.open, lbl: ar ? "قيد الإكمال" : "In progress", note: ar ? "لم تُغلق بعد" : "Not closed yet", accent: SIGN_NAVY },
      { val: counts.done, lbl: ar ? "اكتمل هذا الشهر" : "Settled this month", note: ar ? "بعد إغلاق المهلة" : "After the retract window", accent: SIGN_GREEN },
    ]
    : [
      { val: counts.open, lbl: ar ? "في الحالة" : "On status", note: heading.hint, accent: SIGN_NAVY },
      { val: settled.length, lbl: ar ? "في الأرشيف" : "In archive", note: ar ? "مكتمل أو مرفوض أو محذوف" : "Completed, refused, or deleted", accent: SIGN_GREEN },
    ];

  return (
    <div className="nv-sign-home" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 56 }}>
      <div
        style={{
          background: SIGN_WHITE,
          border: `1px solid ${SIGN_LINE}`,
          borderRadius: 10,
          padding: "9px 14px",
          display: "flex",
          gap: 5,
          flexWrap: "wrap",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        {filters.map((item) => {
          const on = filter === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} style={signTab(on)}>
              <span dir="ltr" style={{ ...mono, fontSize: 10, opacity: 0.75 }}>{item.num}</span>
              {item.label}
              {item.count > 0 ? (
                <span dir="ltr" style={{ ...mono, fontSize: 11, background: on ? SIGN_MARK : "#f5f6f8", color: on ? "#fff" : SIGN_BODY, padding: "1px 7px", borderRadius: 999 }}>
                  {formatUiNumber(item.count, ar)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {filter !== "verify" ? (
        <>
          <section style={{ ...PAPER, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 12, color: SIGN_MUTED }}>{heading.kicker}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: SIGN_INK }}>{heading.title}</span>
            {heading.hint ? <span style={{ fontSize: 12, color: SIGN_MUTED, lineHeight: 1.8 }}>{heading.hint}</span> : null}
          </section>
          <div className="nv-sign-stats" style={{ ...PAPER, overflow: "hidden", display: "grid", gridTemplateColumns: `repeat(${stats.length},minmax(0,1fr))`, gap: 0 }}>
            {stats.map((stat) => (
              <StatTile key={stat.lbl} value={stat.val} label={stat.lbl} note={stat.note} accent={stat.accent} ar={ar} />
            ))}
          </div>
        </>
      ) : null}

      {composing ? (
        <section className="nv-sign-compose" style={{ ...PAPER, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(260px,340px)", gap: 0, paddingInlineEnd: 72 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !preparing && inputRef.current?.click()}
            onKeyDown={(event) => { if (event.key === "Enter") inputRef.current?.click(); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files?.[0]); }}
            style={{
              background: dragging ? "#f3fbf6" : SIGN_WHITE,
              borderInlineEnd: `1px solid ${SIGN_SOFT}`,
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textAlign: "center",
              minHeight: 148,
              cursor: preparing ? "wait" : "pointer",
              position: "relative",
            }}
          >
            <span style={{ width: 36, height: 36, borderRadius: 10, background: SIGN_SURFACE, border: `1px solid ${SIGN_LINE}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: SIGN_NAVY }}>
              {preparing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload style={{ width: 16, height: 16 }} />}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: SIGN_INK }}>
              {ar ? "اسحب المستند هنا أو اختر ملفًا" : "Drop the document here, or pick a file"}
            </span>
            <span style={{ fontSize: 12, color: SIGN_BODY, maxWidth: 440, lineHeight: 1.65 }}>
              {canGroup
                ? (ar ? "يفتح في الورشة: توقّعه وحدك أو أرسله لعدة موقّعين." : "Opens in the workspace: sign alone or send to several signers.")
                : (ar ? "يفتح في الورشة لتضع ختمك. الإرسال للآخرين يحتاج صلاحية." : "Opens in the workspace to place your seal. Sending to others needs permission.")}
            </span>
            <span style={{ ...mono, fontSize: 11, color: SIGN_MUTED }}>{ar ? "PDF أو PNG أو JPEG · حتى 25 ميجابايت" : "PDF · PNG · JPEG · ≤ 25 MB"}</span>
            <span style={{ ...signPrimaryBtn, pointerEvents: "none" }}>{ar ? "اختيار ملف" : "Choose a file"}</span>
            {error ? <span style={{ fontSize: 12, color: "#8a1c2b", lineHeight: 1.6 }}>{error}</span> : null}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg"
              onChange={(event) => accept(event.target.files?.[0])}
              onClick={(event) => event.stopPropagation()}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
            />
          </div>

          <aside style={{ background: SIGN_SURFACE, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: SIGN_INK }}>{ar ? "ختمك" : "Your seal"}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: sealReady ? SIGN_GREEN : SIGN_MUTED, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {sealReady ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : null}
                {sealReady ? (ar ? "محفوظ" : "Saved") : (ar ? "لم يُنشأ بعد" : "Not created yet")}
              </span>
            </div>
            <div style={{ border: `1px solid ${SIGN_LINE}`, borderRadius: 10, background: SIGN_WHITE, minHeight: 72, padding: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {sealPreview
                ? <img src={sealPreview} alt={ar ? "ختمك" : "Your seal"} style={{ maxWidth: "100%", maxHeight: 72, objectFit: "contain" }} />
                : <span style={{ fontSize: 12, color: SIGN_MUTED, textAlign: "center", lineHeight: 1.7 }}>{ar ? "صمّم ختمك من الستوديو — شكل، ألوان، شعار." : "Design your seal in the studio — shape, colours, logo."}</span>}
            </div>
            {sealId ? <span dir="ltr" style={{ ...mono, fontSize: 10, color: SIGN_MARK, textAlign: ar ? "right" : "left" }}>{sealId}</span> : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onOpenStudio} style={{ ...signGhostBtn, flex: 1 }}>
                <PenLine style={{ width: 13, height: 13 }} />
                {sealReady ? (ar ? "تغيير الختم" : "Change seal") : (ar ? "صمّم ختمك" : "Design your seal")}
              </button>
              {sealReady ? (
                <button type="button" onClick={onRemoveSeal} style={{ ...signGhostBtn, color: SIGN_MUTED }}>
                  {ar ? "حذف" : "Remove"}
                </button>
              ) : null}
            </div>
          </aside>
        </section>
      ) : null}

      {filter === "status" ? (
        <div style={{ ...PAPER, overflow: "hidden", paddingInlineEnd: 72 }}>
          <SigningStatusBoard
            requests={activeRequests}
            loading={loading}
            currentUser={currentUser}
            companyId={companyId}
            ar={ar}
            onReload={onReload}
            focusRequestId={focusId}
            sentLinks={sentLinks}
          />
        </div>
      ) : filter === "archive" ? (
        <div style={{ ...PAPER, overflow: "hidden", paddingInlineEnd: 72 }}>
          <SigningArchiveBoard
            requests={settled}
            loading={loading}
            currentUser={currentUser}
            companyId={companyId}
            ar={ar}
            onReload={onReload}
            focusRequestId={focusId}
            sentLinks={sentLinks}
          />
        </div>
      ) : filter === "verify" ? (
        <div>
          <VerifyWorkspace ar={ar} companyId={companyId} />
        </div>
      ) : (
        <section style={{ ...PAPER, overflow: "hidden", display: "flex", flexDirection: "column", paddingInlineEnd: 72 }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: 16, padding: "10px 20px", background: SIGN_SURFACE, borderBottom: `1px solid ${SIGN_SOFT}`, fontSize: 10, letterSpacing: ".05em", color: SIGN_MUTED, fontWeight: 600 }}>
                <span>{ar ? "المستند" : "Document"}</span>
                <span>{ar ? "الأطراف" : "Parties"}</span>
                <span>{ar ? "التقدّم" : "Progress"}</span>
                <span>{ar ? "الحالة" : "Status"}</span>
                <span>{ar ? "آخر تحديث" : "Last update"}</span>
                <span>{ar ? "التنزيل" : "Download"}</span>
              </div>
              {requests === null || loading ? (
                <div style={{ padding: "24px 18px", fontSize: 13, color: SIGN_MUTED, display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {ar ? "جارٍ تحميل المستندات…" : "Loading documents…"}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "24px 20px", fontSize: 12, color: SIGN_MUTED, lineHeight: 1.8 }}>
                  {rows.length === 0
                    ? (ar ? "لا توجد مستندات بعد. ارفع ملفًا لتبدأ." : "No documents yet. Upload a file to start.")
                    : (ar ? "لا شيء ضمن هذه التصفية." : "Nothing under this filter.")}
                </div>
              ) : (
                filtered.map((request) => (
                  <DocumentRow key={request.id} request={request} ar={ar} onOpen={openRow} />
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <div style={{ ...PAPER, padding: "13px 20px", paddingInlineEnd: 72, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 11, color: SIGN_MUTED }}>
        <ShieldCheck style={{ width: 13, height: 13 }} />
        {ar ? "كل ملف مختوم يحمل بصمة رقمية ورقم تحقق عام." : "Every sealed file carries a SHA-256 fingerprint and a public verification id."}
        <Users style={{ width: 13, height: 13 }} />
      </div>
    </div>
  );
}
