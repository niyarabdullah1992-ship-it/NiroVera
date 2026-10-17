import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { imageBlobToPdf } from "@/lib/signPdf";
import SigningStatusBoard, { RecipientAvatar, settledState } from "@/components/files/SigningStatusBoard";
import VerifyWorkspace from "@/components/files/VerifyWorkspace";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import TwoPaneWorkspace, { ListStack } from "@/components/shared/TwoPaneWorkspace";
import CollapsibleItemCard, { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";
import AttachDropzone from "@/components/shared/AttachDropzone";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import SectionBackLink from "@/components/shared/SectionBackLink";
import { SearchWrap } from "@/components/shared/NvIcon";
import { chip, mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { formatUiNumber } from "@/lib/dateFormat";
import { getCompanyToken } from "@/lib/store";
import { invokeLocalMultiSign, shouldUseLocalMultiSign } from "@/lib/localMultiSignFallback";
import { isServiceOutage } from "@/lib/serviceErrors";
import { listFieldTemplates } from "@/lib/signingFieldTools";
import { isArchivedSigningEnvelope } from "@/lib/multiSignDerivations";
import {
  envelopeBucket,
  envelopeMatches,
  envelopePillCounts,
  envelopeRecipients,
  isOverdueEnvelope,
  lastActivityAt,
  remindableSigners,
  senderAnalytics,
} from "@/lib/signingEnvelopes";
import { toast } from "@/components/ui/use-toast";

const MAX_SIZE = 25 * 1024 * 1024;
const isPdf = (file) => file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
const isPng = (file) => file?.type === "image/png" || file?.name?.toLowerCase().endsWith(".png");
const isJpeg = (file) => file?.type === "image/jpeg" || /\.jpe?g$/i.test(file?.name || "");
const isImage = (file) => isPng(file) || isJpeg(file);

/** Bucket → the row dot. Status colour is meaning: amber needs a hand, green closed, red refused. */
const DOT = {
  action: "#C8A45A",
  waiting: "var(--nv-line, #D5DCD8)",
  done: "#3C7D50",
  declined: "#B4443C",
};

function stamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // Mono Latin digits in Riyadh time, 24h — no ص/م marks to break the direction.
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(",", "");
}

function docTitle(name = "") {
  return String(name || "").replace(/\.(pdf|png|jpe?g)$/i, "").trim() || name;
}

/** A row inside a slab: label and muted note on one side, the value or control on the other. */
function Line({ label, note, children, dataKey }) {
  return (
    <div data-sign-line={dataKey || undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderTop: "1px solid var(--nv-line2, #EEF2F7)", minWidth: 0, flexWrap: "wrap" }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 160px" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nv-ink)" }}>{label}</span>
        {note ? <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.6 }}>{note}</span> : null}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>{children}</span>
    </div>
  );
}

const lineBtn = {
  fontFamily: "inherit",
  height: 30,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

export default function SigningHome({
  ar,
  lane = "employee",
  currentUser,
  companyId,
  employees = [],
  requests,
  loading,
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
  const manage = lane === "manage";
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [pill, setPill] = useState(() => (
    initialFilter === "mine" ? "action" : initialFilter === "archive" ? "archive" : "all"
  ));
  const [view, setView] = useState(() => (initialFilter === "verify" ? "verify" : "home"));
  const [focusId, setFocusId] = useState(focusRequestId || "");
  const [templateId, setTemplateId] = useState("");
  const [remindingAll, setRemindingAll] = useState(false);
  const templates = useMemo(() => listFieldTemplates(companyId), [companyId]);

  useEffect(() => {
    if (!activeFilter) return;
    if (activeFilter === "mine") { setView("home"); setPill("action"); }
    else if (activeFilter === "verify") setView("verify");
    else if (activeFilter === "archive") { setView("home"); setPill("archive"); }
    else { setView("home"); setPill("all"); }
  }, [activeFilter]);

  useEffect(() => {
    if (!focusRequestId) return;
    setFocusId(focusRequestId);
    setView("home");
    setPill("all");
  }, [focusRequestId]);

  // The employee lane is the person's own desk: what they sign and what they sent.
  // The management lane is every envelope this account can see.
  const rows = useMemo(() => {
    const all = requests || [];
    return manage ? all : all.filter((row) => row.myStatus || row.isCreator);
  }, [manage, requests]);

  const knownEmails = useMemo(() => {
    const set = new Set();
    employees.forEach((employee) => {
      const email = String(employee.email || "").toLowerCase();
      if (email) set.add(email);
    });
    const mine = String(currentUser?.email || "").toLowerCase();
    if (mine) set.add(mine);
    return set;
  }, [currentUser?.email, employees]);

  const activeRows = useMemo(() => rows.filter((row) => !isArchivedSigningEnvelope(row)), [rows]);
  const archiveRows = useMemo(() => rows.filter((row) => isArchivedSigningEnvelope(row)), [rows]);
  const pillCounts = useMemo(() => envelopePillCounts(rows), [rows]);
  const count = (id) => pillCounts[id] || 0;
  const query = q.trim().toLowerCase();
  const matchesQuery = (row) => {
    if (!query) return true;
    return [
      row.fileName,
      row.verificationId,
      row.finalHash,
      row.creatorName,
      ...(row.signers || []).map((signer) => `${signer.name || ""} ${signer.email || ""}`),
    ].join(" ").toLowerCase().includes(query);
  };
  const listed = (pill === "all" ? activeRows.filter(matchesQuery) : rows.filter((row) => envelopeMatches(row, pill) && matchesQuery(row)))
    .sort((left, right) => (Date.parse(lastActivityAt(right) || "") || 0) - (Date.parse(lastActivityAt(left) || "") || 0));
  const fold = useCollapsibleItems(listed.map((row) => row.id), focusId);

  const stats = useMemo(() => senderAnalytics(rows.filter((row) => row.isCreator || manage)), [manage, rows]);
  const overdueMine = stats.overdue.filter((row) => remindableSigners(row).length);

  const accept = async (file) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_SIZE) {
      setError(ar ? "الحد الأعلى 25 ميجابايت." : "The limit is 25MB.");
      return;
    }
    if (!isPdf(file) && !isImage(file)) {
      setError(ar
        ? "يُفتح PDF أو صورة PNG/JPEG. صدّر ملفات Word وExcel إلى PDF ثم ارفعها."
        : "Upload a PDF or a PNG/JPEG image. Export Word or Excel to PDF first.");
      return;
    }
    setPreparing(true);
    try {
      if (isPdf(file)) {
        onOpenDocument({ file, sourceUrl: URL.createObjectURL(file), templateId });
      } else {
        const { bytes } = await imageBlobToPdf(file, false);
        const pdfFile = new File([bytes], file.name.replace(/\.(png|jpe?g)$/i, ".pdf"), { type: "application/pdf" });
        onOpenDocument({ file: pdfFile, sourceUrl: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), templateId });
      }
    } catch {
      setError(ar
        ? "تعذّر تغليف الصورة في PDF. جرّب PNG أو JPEG، أو صدّر المستند إلى PDF."
        : "Couldn't wrap that image into a PDF. Try PNG or JPEG, or export to PDF.");
    } finally {
      setPreparing(false);
    }
  };

  const openDocument = (request) => {
    if (envelopeBucket(request) === "action" && request.myToken) {
      onOpenRequest(request);
      return;
    }
    if (request.docUrl) window.open(request.docUrl, "_blank", "noopener");
  };

  // «ذكّر الكل»: one reminder to each pending party of every overdue envelope you sent.
  const remindOverdue = async () => {
    if (remindingAll || !overdueMine.length) return;
    setRemindingAll(true);
    const actor = { id: currentUser?.id, userId: currentUser?.id, email: currentUser?.email || "", name: currentUser?.name || "", companyId };
    let sent = 0;
    let total = 0;
    for (const request of overdueMine) {
      for (const signer of remindableSigners(request)) {
        total += 1;
        const payload = {
          action: "remind",
          companyId,
          sessionToken: getCompanyToken(companyId),
          userId: currentUser?.id,
          requestId: request.id,
          signerEmail: signer.email,
          lang: ar ? "ar" : "en",
        };
        try {
          if (shouldUseLocalMultiSign()) invokeLocalMultiSign(payload, { actor });
          else {
            try {
              await base44.functions.invoke("multiSign", payload);
            } catch (err) {
              if (!isServiceOutage(err)) throw err;
              invokeLocalMultiSign(payload, { actor });
            }
          }
          sent += 1;
        } catch { /* counted below */ }
      }
    }
    setRemindingAll(false);
    toast({
      description: ar ? `أُرسل ${formatUiNumber(sent)} من ${formatUiNumber(total)} تذكيرات.` : `${sent} of ${total} reminders sent.`,
      variant: sent ? undefined : "destructive",
    });
    onReload?.();
  };

  // «توقيعاتي» / «المظاريف» pills: الكل is the open desk, الأرشيف what closed.
  const folders = [
    ["all", ar ? "الكل" : "All", activeRows.length],
    ["action", ar ? "يحتاج توقيعك" : "Needs you", count("action")],
    ["waiting", ar ? "بانتظار الآخرين" : "Waiting on others", count("waiting")],
    ["done", ar ? "مكتمل" : "Completed", count("done")],
    ["draft", ar ? "مسودات" : "Drafts", 0],
    ["declined", ar ? "ملغى/مرفوض" : "Voided/declined", count("declined")],
    ["archive", ar ? "الأرشيف" : "Archive", archiveRows.length],
  ];

  if (view === "verify") {
    return (
      <div className="nv-sign-home" data-signing-view="verify" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionBackLink ar={ar} label={manage ? (ar ? "التوقيع الرقمي" : "Digital signing") : (ar ? "توقيعاتي" : "My signatures")} onClick={() => setView("home")} />
        <VerifyWorkspace ar={ar} companyId={companyId} />
      </div>
    );
  }

  const raise = (
    <section data-signing-new="1" style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={ar ? "مستند جديد" : "New document"}
        note={ar ? "ارفعه، ثم المستلمون فالحقول فالمراجعة والإرسال." : "Upload it, then recipients, fields, review and send."}
      />
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <AttachDropzone
          ar={ar}
          required
          showNeed={false}
          busy={preparing}
          error={error}
          accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg"
          label={ar ? "اسحب المستند هنا أو اختره" : "Drop the document here or choose it"}
          typesLabel={ar ? "PDF أو صورة PNG/JPEG · حتى 25 ميجابايت" : "PDF or PNG/JPEG · up to 25 MB"}
          onPick={accept}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingTop: 12, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
          <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "قالب الحقول" : "Field template"}</strong>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "اختياري · يُطبَّق عند فتح المستند" : "Optional · applied when the document opens"}</span>
        </div>
        {templates.length ? (
          <SubTypeGrid label={ar ? "قالب الحقول" : "Field template"}>
            <SubTypeOption dataKey="none" on={!templateId} title={ar ? "بلا قالب" : "No template"} sub={ar ? "تضع الحقول بنفسك" : "Place the fields yourself"} onClick={() => setTemplateId("")} />
            {templates.map((template) => (
              <SubTypeOption
                key={template.id}
                dataKey={template.id}
                on={templateId === template.id}
                title={template.name}
                sub={(
                  <span>
                    <span dir="ltr" style={mono}>{formatUiNumber((template.fields || []).length)}</span>
                    {ar ? " حقول · " : " fields · "}
                    <span dir="ltr" style={mono}>{formatUiNumber(template.signerCount || 1)}</span>
                    {ar ? " موقّعين" : " signers"}
                  </span>
                )}
                onClick={() => setTemplateId(template.id)}
              />
            ))}
          </SubTypeGrid>
        ) : (
          <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7 }}>
            {ar ? "لا قوالب محفوظة. احفظ ترتيب الحقول كقالب من خطوة «الحقول»." : "No saved templates. Save a field layout as a template in the Fields step."}
          </span>
        )}
      </div>
      <Line
        dataKey="seal"
        label={ar ? "ختمك" : "Your seal"}
        note={sealReady ? null : (ar ? "يلزم لتوقيعك أنت؛ المستلمون يعتمدون توقيعهم عند التوقيع." : "Needed for your own signature; recipients adopt theirs when they sign.")}
      >
        {sealPreview ? <img src={sealPreview} alt={ar ? "ختمك" : "Your seal"} style={{ height: 34, maxWidth: 96, objectFit: "contain", border: "1px solid var(--nv-line)", borderRadius: 8, background: "#fff", padding: 2 }} /> : null}
        {sealId ? <span dir="ltr" style={{ ...mono, fontSize: 11, color: "var(--nv-muted)" }}>{sealId}</span> : null}
        <button type="button" onClick={onOpenStudio} style={lineBtn}>{sealReady ? (ar ? "غيّر الختم" : "Change seal") : (ar ? "صمّم ختمك" : "Design your seal")}</button>
        {sealReady && manage ? <button type="button" onClick={onRemoveSeal} style={{ ...lineBtn, color: "var(--nv-bad-ink)" }}>{ar ? "احذف" : "Remove"}</button> : null}
      </Line>
      <Line dataKey="verify" label={ar ? "تحقق من مستند" : "Verify a document"} note={ar ? "تُحسب البصمة على جهازك وتُطابق سجل الشركة." : "The fingerprint is computed on your device and matched to the registry."}>
        <button type="button" onClick={() => setView("verify")} style={lineBtn}>{ar ? "افتح التحقق" : "Open verify"}</button>
      </Line>
    </section>
  );

  const summary = manage ? (
    <section data-signing-analytics="1" style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={ar ? "أداء الإرسال" : "Sending"}
        trailing={overdueMine.length ? (
          <button type="button" onClick={remindOverdue} disabled={remindingAll} style={lineBtn}>
            {remindingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {ar ? "ذكّر الكل" : "Remind all"}
          </button>
        ) : null}
      />
      <Line dataKey="avg" label={ar ? "متوسط زمن التوقيع" : "Average time to sign"} note={stats.avgDays === null ? (ar ? "لا مظروف أجاب فيه الجميع بعد." : "No envelope answered by everyone yet.") : null}>
        <span dir="ltr" style={{ ...mono, fontSize: 13, color: "var(--nv-ink)" }}>{stats.avgDays === null ? "—" : formatUiNumber(stats.avgDays.toFixed(1))}</span>
        {stats.avgDays === null ? null : <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "يوم" : "days"}</span>}
      </Line>
      <Line dataKey="overdue" label={ar ? "متأخرة" : "Overdue"} note={ar ? "مفتوحة بلا نشاط 3 أيام، أو رابطها ينتهي خلال يوم." : "Open with no activity for 3 days, or the link expires within a day."}>
        {stats.overdue.length ? <span style={chip("warn")}>{ar ? "تحتاج تذكيراً" : "Needs a reminder"}</span> : null}
        <span dir="ltr" style={{ ...mono, fontSize: 13, color: "var(--nv-ink)" }}>{formatUiNumber(stats.overdue.length)}</span>
      </Line>
      {stats.overdue.slice(0, 3).map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => {
            setPill("all");
            setFocusId(row.id);
            if (!fold.isOpen(row.id)) fold.toggle(row.id);
            window.setTimeout(() => document.querySelector(`[data-envelope="${row.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
          }}
          style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, padding: "8px 18px 8px", paddingInlineStart: 30, border: "none", borderTop: "1px solid var(--nv-line2, #EEF2F7)", background: "transparent", cursor: "pointer", textAlign: "start", minWidth: 0 }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--nv-ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docTitle(row.fileName)}</span>
          <span dir="ltr" style={{ ...mono, fontSize: 11.5, color: "var(--nv-ink)" }}>{stamp(lastActivityAt(row), ar)}</span>
        </button>
      ))}
      <Line dataKey="month" label={ar ? "اكتمل هذا الشهر" : "Completed this month"}>
        <span dir="ltr" style={{ ...mono, fontSize: 13, color: "var(--nv-ink)" }}>{formatUiNumber(stats.doneMonth)}</span>
      </Line>
      <Line dataKey="refused" label={ar ? "رفضه الجميع" : "Refused by everyone"}>
        <span dir="ltr" style={{ ...mono, fontSize: 13, color: "var(--nv-ink)" }}>{formatUiNumber(stats.refused)}</span>
      </Line>
    </section>
  ) : null;

  const emptyText = pill === "draft"
    ? (ar ? "لا مسودات محفوظة. «مستند جديد» يفتح التحضير مباشرة." : "No saved drafts. New document opens preparation directly.")
    : query
      ? (ar ? `لا مظروف يطابق «${q.trim()}».` : `No envelope matches “${q.trim()}”.`)
      : pill === "archive"
        ? (ar ? "لا مظاريف في الأرشيف. المكتمل والمرفوض والمُلغى ينتقل إلى هنا بعد إغلاقه." : "Nothing is in the archive. Completed, refused, and voided envelopes move here once they close.")
        : pill === "all"
          ? (ar ? "لا مظاريف قيد التوقيع. ما أُغلق تجده في الأرشيف." : "No envelope is in signing. What closed is in the archive.")
          : (ar ? "لا مظاريف تحت هذا الفلتر." : "No envelopes under this filter.");

  const list = (
    <ListStack data-signing-list="1">
      <StatusFilterPills
        card
        dataKey={manage ? "signing-manage" : "signing-mine"}
        title={manage ? (ar ? "المظاريف" : "Envelopes") : (ar ? "توقيعاتي" : "My signatures")}
        value={pill}
        onChange={(id) => { setPill(id); setFocusId(""); }}
        items={folders.map(([id, label, n]) => ({ id, label, n: formatUiNumber(n) }))}
      >
        <SearchWrap style={{ width: "100%" }}>
          <input
            className="nv-sign-query"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={ar ? "ابحث باسم المستند أو طرف أو رقم التحقق" : "Search by document, party, or verification id"}
            style={{ height: 34, width: "100%", boxSizing: "border-box", padding: "0 12px", paddingInlineStart: 30, borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", fontSize: 12, outline: "none", color: "var(--nv-ink)", fontFamily: "inherit" }}
          />
        </SearchWrap>
      </StatusFilterPills>
      {requests === null || (loading && !rows.length) ? (
        <section style={{ ...slab, padding: 18, fontSize: 12.5, color: "var(--nv-muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Loader2 className="h-4 w-4 animate-spin" />{ar ? "جارٍ تحميل المظاريف…" : "Loading envelopes…"}</span>
        </section>
      ) : listed.length === 0 ? (
        <section style={{ ...slab, padding: 18, fontSize: 12.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>{emptyText}</section>
      ) : listed.map((request) => {
        const bucket = envelopeBucket(request);
        const { state } = settledState(request);
        const people = envelopeRecipients(request);
        const shown = people.slice(0, 5);
        const needsRelease = request.isCreator && state === "awaiting_release";
        const overdue = request.isCreator && isOverdueEnvelope(request);
        const statusChip = bucket === "action"
          ? <span style={chip("warn")}>{ar ? "يحتاج توقيعك" : "Needs your signature"}</span>
          : needsRelease
            ? <span style={chip("warn")}>{ar ? "بانتظار تمريرك" : "Awaiting your release"}</span>
            : overdue
              ? <span style={chip("warn")}>{ar ? "متأخر" : "Overdue"}</span>
              : null;
        const sender = request.isCreator ? (ar ? "أرسلته أنت" : "Sent by you") : (ar ? `من ${request.creatorName || "—"}` : `From ${request.creatorName || "—"}`);
        return (
          <CollapsibleItemCard
            key={request.id}
            data-envelope={request.id}
            data-envelope-bucket={bucket}
            open={fold.isOpen(request.id)}
            onToggle={() => fold.toggle(request.id)}
            focus={focusId === request.id}
            dot={DOT[bucket]}
            title={docTitle(request.fileName)}
            person={sender}
            date={stamp(lastActivityAt(request), ar)}
            hint={(
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} aria-label={ar ? "المستلمون" : "Recipients"}>
                {shown.map((row) => <RecipientAvatar key={`${row.email}-${row.index}`} initials={row.initials} state={row.state} title={row.name} />)}
                {people.length > shown.length ? <span dir="ltr" style={{ ...mono, fontSize: 11, color: "var(--nv-muted)", marginInlineStart: 2 }}>+{people.length - shown.length}</span> : null}
              </span>
            )}
            status={statusChip}
            ar={ar}
          >
            <SigningStatusBoard
              variant="card"
              requests={[request]}
              loading={loading}
              currentUser={currentUser}
              companyId={companyId}
              ar={ar}
              onReload={onReload}
              focusRequestId={request.id}
              sentLinks={focusId === request.id ? sentLinks : []}
              knownEmails={knownEmails}
              onOpen={openDocument}
            />
          </CollapsibleItemCard>
        );
      })}
    </ListStack>
  );

  return (
    <div className="nv-sign-home" data-signing-lane={lane} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <TwoPaneWorkspace dataKey="signing" raise={raise} summary={summary} list={list} />
    </div>
  );
}
