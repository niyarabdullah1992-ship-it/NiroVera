import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import SigningHome from "@/components/files/SigningHome";
import StampStudio from "@/components/files/StampStudio";
import SigningWorkspace from "@/components/files/SigningWorkspace";
import PublicSignFlow from "@/components/files/PublicSignFlow";
import EnvelopeSetup from "@/components/files/EnvelopeSetup";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { pageKicker } from "@/lib/moduleMeta";
import { toast } from "@/components/ui/use-toast";
import { envelopeFileName, mergeEnvelopeDocuments } from "@/lib/envelopeDocuments";
import { dueAutoReminders } from "@/lib/envelopeSetup";
import { deleteEnvelopeDraft, listEnvelopeDrafts, saveEnvelopeDraft } from "@/lib/envelopeDrafts";
import { isOpenSigningState, settledState } from "@/lib/multiSignDerivations";
import { invokeLocalMultiSign, shouldUseLocalMultiSign } from "@/lib/localMultiSignFallback";
import { canCreateSignatureRequests, visibleEmployees } from "@/lib/permissions";
import { updateEmployeeProfile } from "@/lib/store";
import { MUTED, pageCol } from "@/lib/platformStyles";
import { ensureSignatureFonts } from "@/lib/typedSignatureImage";
import { deskSigningRows, isConsentSignToken } from "@/lib/writtenConsent";
import { useRailSide } from "@/lib/railSide";

// Old ?tab= bookmarks open the matching surface. Archive is the الأرشيف tab.
const TAB_FILTERS = { inbox: "status", status: "status", archive: "archive", verify: "verify", mine: "mine", individual: "all", group: "all" };

export default function FileSigning() {
  const { lang } = useI18n();
  const { company, data, currentUser } = useAuth();
  const ar = lang === "ar";
  const [searchParams, setSearchParams] = useSearchParams();
  const railSide = useRailSide();
  const [requests, setRequests] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [postSend, setPostSend] = useState(null);
  const [homeFilter, setHomeFilter] = useState(null);
  // «مظروف جديد»: the setup page's input (files handed from the desk, a draft, or a copy).
  const [setup, setSetup] = useState(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [draftTick, setDraftTick] = useState(0);
  // Mirrors the seal the studio just wrote so the home card updates without a reload.
  const [sealPatch, setSealPatch] = useState(null);

  const closeWorkspace = () => {
    setWorkspace((current) => {
      if (current?.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(current.sourceUrl);
      return null;
    });
  };

  useEffect(() => { ensureSignatureFonts(); }, []);

  const companyId = company?.id;
  const userId = currentUser?.id;
  const userEmail = (currentUser?.email || "").toLowerCase();

  const actor = useMemo(() => ({
    id: userId,
    userId,
    email: userEmail,
    name: currentUser?.name || "",
    role: currentUser?.role || "",
    companyId,
  }), [userId, userEmail, currentUser?.name, currentUser?.role, companyId]);

  const reload = useCallback(() => {
    if (!companyId || !userId) return;
    setLoading(true);
    const localList = () => invokeLocalMultiSign(
      { action: "list", companyId },
      { actor, employees: data?.employees || [] },
    ).requests || [];
    if (shouldUseLocalMultiSign()) {
      setRequests(deskSigningRows(localList()));
      setLoading(false);
      return;
    }
    base44.functions.invoke("multiSign", {
      action: "list",
      companyId,
      sessionToken: getCompanyToken(companyId),
      userId,
      email: userEmail,
    })
      .then((response) => setRequests(deskSigningRows(response.data?.requests || [])))
      .catch(() => setRequests(deskSigningRows(localList())))
      .finally(() => setLoading(false));
  }, [actor, companyId, data?.employees, userId, userEmail]);

  useEffect(() => { reload(); }, [reload]);

  const drafts = useMemo(() => listEnvelopeDrafts(companyId, userId), [companyId, userId, draftTick]);

  // «التذكير» the sender chose: each envelope owes its reminders when its cadence comes round.
  // Sent once per party per day from the sender's own desk, through the same remind call, and
  // logged as an automatic reminder in the audit trail.
  useEffect(() => {
    if (!requests?.length || !companyId || !userId) return;
    const day = new Date().toISOString().slice(0, 10);
    const jobs = [];
    for (const request of requests) {
      for (const signer of dueAutoReminders(request)) {
        const key = `nv-sign-auto:${request.id}:${String(signer.email).toLowerCase()}:${day}`;
        try { if (window.localStorage.getItem(key)) continue; window.localStorage.setItem(key, "1"); } catch { /* still send once this session */ }
        jobs.push({ action: "remind", auto: true, companyId, sessionToken: getCompanyToken(companyId), userId, requestId: request.id, signerEmail: signer.email, lang: ar ? "ar" : "en" });
      }
    }
    if (!jobs.length) return;
    (async () => {
      for (const payload of jobs) {
        try {
          if (shouldUseLocalMultiSign()) invokeLocalMultiSign(payload, { actor });
          else await base44.functions.invoke("multiSign", payload).catch(() => invokeLocalMultiSign(payload, { actor }));
        } catch { /* the next cadence tries again */ }
      }
      reload();
    })();
  }, [requests]);

  const active = useMemo(() => {
    if (requests === null) return null;
    return (requests || []).filter((row) => isOpenSigningState(settledState(row).state));
  }, [requests]);

  const canCreate = currentUser && data ? canCreateSignatureRequests(currentUser, data) : false;
  // «التوقيع الرقمي» (manage) is every envelope this account sees, with the sender rows;
  // «توقيعاتي» is the person's own desk. The rail side wins over a stale ?lane.
  const lane = canCreate && (railSide === "manage" || (railSide !== "employee" && searchParams.get("lane") === "manage"))
    ? "manage"
    : "employee";

  // An old ?tab= bookmark now picks the matching chip instead of a tab, then the
  // parameter is dropped so the URL settles on the single surface.
  const requested = searchParams.get("tab");
  const signToken = searchParams.get("sign") || "";
  const [initialFilter] = useState(() => TAB_FILTERS[searchParams.get("tab")] || "all");
  useEffect(() => {
    if (!requested) return;
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [requested, searchParams, setSearchParams]);

  const closeSignRequest = () => {
    setHomeFilter("mine");
    const next = new URLSearchParams(searchParams);
    next.delete("sign");
    next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  if (!currentUser || !company) {
    return (
      <div style={{ ...pageCol, margin: "0 auto" }}>
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "جارٍ تحميل قسم التوقيع…" : "Loading signing…"}</p>
      </div>
    );
  }

  const scopedEmployees = visibleEmployees(currentUser, data || { stations: [], employees: [] });
  const seal = { ...(currentUser.profile || {}), ...(sealPatch || {}) };
  const sealReady = Boolean(seal.signatureUrl);

  const removeSeal = () => {
    const cleared = { signatureUrl: "", signatureRawUrl: "", signatureVariant: "", signatureId: "", stampConfig: null };
    updateEmployeeProfile(company.id, currentUser.id, cleared);
    setSealPatch(cleared);
  };

  const openRequest = (request) => {
    if (settledState(request).state === "deleted") return;
    if (request.myStatus === "pending" && request.myToken) {
      setHomeFilter("mine");
      const next = new URLSearchParams(searchParams);
      next.set("sign", request.myToken);
      setSearchParams(next);
      return;
    }
    if (request.docUrl) window.open(request.docUrl, "_blank", "noopener");
  };

  if (signToken && isConsentSignToken(signToken, data?.signatureRequests, data?.employees)) {
    return <Navigate to="/app/requests" replace />;
  }

  if (signToken) {
    return <PublicSignFlow token={signToken} variant="app" onBack={closeSignRequest} />;
  }

  const applySavedSeal = (saved) => {
    setSealPatch(saved);
    setWorkspace((current) => (current
      ? {
        ...current,
        signature: {
          signatureUrl: saved.signatureUrl,
          signatureRawUrl: saved.signatureRawUrl,
          signatureVariant: saved.signatureVariant,
          stampConfig: saved.stampConfig,
          preview: saved.signatureUrl,
        },
      }
      : current));
  };

  if (studioOpen) {
    return (
      <StampStudio
        companyId={company.id}
        companyName={company.name}
        currentUser={{ ...currentUser, profile: seal }}
        ar={ar}
        onClose={() => setStudioOpen(false)}
        onSaved={(saved) => {
          applySavedSeal(saved);
          setStudioOpen(false);
        }}
      />
    );
  }

  if (workspace) {
    return (
      <SigningWorkspace
        file={workspace.file}
        sourceUrl={workspace.sourceUrl}
        currentUser={{ ...currentUser, profile: seal }}
        companyId={company.id}
        employees={scopedEmployees}
        canGroup={canCreate}
        sealPreview={workspace.signature?.preview || seal.signatureUrl}
        signatureUrl={workspace.signature?.signatureUrl || seal.signatureUrl}
        signatureRawUrl={workspace.signature?.signatureRawUrl || seal.signatureRawUrl}
        signatureVariant={workspace.signature?.signatureVariant || seal.signatureVariant}
        stampConfig={workspace.signature?.stampConfig || seal.stampConfig}
        initialTemplateId={workspace.templateId || ""}
        initialSigners={workspace.envelope ? workspace.signers : null}
        initialOrderMode={workspace.envelope?.orderMode || "parallel"}
        envelopeMeta={workspace.envelope || null}
        startStep={workspace.envelope ? 3 : 2}
        onBackToSetup={workspace.envelope ? () => {
          const back = workspace.envelope;
          closeWorkspace();
          setSetup({ ...back, files: (back.docs || []).map((doc) => doc.file).filter(Boolean), docs: [] });
        } : undefined}
        ar={ar}
        onOpenStudio={() => setStudioOpen(true)}
        onClose={() => { closeWorkspace(); setSetup(null); }}
        onSigned={(payload) => {
          reload();
          if (workspace.envelope?.id) {
            deleteEnvelopeDraft(companyId, userId, workspace.envelope.id);
            setDraftTick((n) => n + 1);
          }
          if (payload?.kind === "group") {
            setPostSend({
              requestId: payload.requestId || "",
              links: payload.links || [],
            });
          }
        }}
      />
    );
  }

  const sealSignature = {
    signatureUrl: seal.signatureUrl,
    signatureRawUrl: seal.signatureRawUrl,
    signatureVariant: seal.signatureVariant,
    stampConfig: seal.stampConfig,
    preview: seal.signatureUrl,
  };

  // Setup → field editor: the documents become one signing file, the recipients keep their order.
  const startFields = async (envelope, gate) => {
    setSetupBusy(true);
    setSetupError("");
    try {
      const { bytes } = await mergeEnvelopeDocuments(envelope.docs.map((doc) => doc.file));
      const name = envelopeFileName(envelope.docs, envelope.subject);
      const file = new File([bytes], name, { type: "application/pdf" });
      const signers = gate.signers.map((row) => (row.isMe
        ? { ...row, isMe: true, stamp: envelope.myStamp, color: "#3B5A86" }
        : row));
      setWorkspace({
        file,
        sourceUrl: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })),
        templateId: setup?.templateId || "",
        signature: sealSignature,
        envelope: { ...envelope, templateId: setup?.templateId || "" },
        signers,
      });
      setSetup(null);
    } catch {
      setSetupError(ar ? "تعذّر ضمّ المستندات في ملف واحد — صدّر المستند المتعذّر إلى PDF جديد ثم أعد إرفاقه." : "Couldn't join the documents into one file — export the failing one to a new PDF and attach it again.");
    } finally {
      setSetupBusy(false);
    }
  };

  const saveDraft = (draft) => {
    const result = saveEnvelopeDraft(companyId, userId, draft);
    setDraftTick((n) => n + 1);
    if (!result.ok) {
      toast({ description: ar ? "تعذّر حفظ المسودة على هذا الجهاز." : "Couldn't save the draft on this device.", variant: "destructive" });
      return;
    }
    toast({ description: result.keptDocs || !(draft.docs || []).length
      ? (ar ? "حُفظت المسودة في «مسودات»." : "Draft saved under Drafts.")
      : (ar ? "حُفظت المسودة دون ملفاتها (أكبر من سعة الجهاز) — تُرفق عند المتابعة." : "Draft saved without its files (too large) — attach them when you continue.") });
    setSetup(null);
    setHomeFilter("draft");
  };

  // «نسخة»: a new envelope with the same document, recipients, order and message.
  const copyEnvelope = async (request) => {
    const mine = String(currentUser.email || "").toLowerCase();
    const others = (request.signers || []).filter((row) => String(row.email || "").toLowerCase() !== mine);
    const base = {
      meSigns: (request.signers || []).some((row) => String(row.email || "").toLowerCase() === mine),
      recipients: others.map((row, index) => ({ key: `copy-${index}`, name: row.name || "", email: String(row.email || "").toLowerCase(), employeeId: row.employeeId || null, role: row.role || "", stationId: row.stationId || null, outside: row.external === true || !row.employeeId, stamp: row.stampRequired === true })),
      orderMode: request.signingMode === "sequential" ? "sequential" : "parallel",
      subject: request.subject || "",
      message: request.message || "",
      reminderEveryDays: request.reminderEveryDays || 0,
      expiryDays: 30,
      files: [],
    };
    try {
      const blob = await fetch(request.originalDocUrl || request.docUrl).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      });
      const name = /\.pdf$/i.test(request.fileName || "") ? request.fileName : `${request.fileName || "document"}.pdf`;
      setSetup({ ...base, files: [new File([blob], name, { type: "application/pdf" })] });
    } catch {
      setSetup(base);
      toast({ description: ar ? "نُسخ المستلمون والرسالة؛ تعذّر جلب المستند — أرفقه من جديد." : "Recipients and message copied; the document couldn't be fetched — attach it again." });
    }
  };

  const frameTitle = lane === "manage" ? (ar ? "التوقيع الرقمي" : "Digital signing") : (ar ? "توقيعاتي" : "My signatures");
  const frameHint = ar
    ? "خاتمة دورة الإثبات: ما ثبت بالحضور والمهمة والاعتماد يُوقَّع ويُختم هنا، ويُغلق ببصمة ورابط تحقق يفتحه العميل."
    : "The close of the proof cycle: what attendance, task and review proved is signed and stamped here, and closes with a fingerprint and a verify link the client can open.";

  if (setup) {
    return (
      <SuiteWorkspaceFrame ar={ar} kicker={pageKicker("/app/signing", lang)} title={frameTitle} hint={frameHint}>
        <EnvelopeSetup
          key={setup.id || "new"}
          ar={ar}
          currentUser={{ ...currentUser, profile: seal }}
          employees={scopedEmployees}
          stations={data?.stations || []}
          canGroup={canCreate}
          sealReady={sealReady}
          sealPreview={seal.signatureUrl}
          initial={setup}
          busy={setupBusy}
          error={setupError}
          onOpenStudio={() => setStudioOpen(true)}
          onCancel={() => { setSetup(null); setSetupError(""); }}
          onNext={startFields}
          onSaveDraft={saveDraft}
        />
      </SuiteWorkspaceFrame>
    );
  }

  return (
    <SuiteWorkspaceFrame ar={ar} kicker={pageKicker("/app/signing", lang)} title={frameTitle} hint={frameHint}>
    <div
      className="nv-sign-desk2"
      dir={ar ? "rtl" : "ltr"}
      style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}
    >
      <SigningHome
        ar={ar}
        lang={lang}
        lane={lane}
        currentUser={currentUser}
        companyId={company.id}
        companyName={company.name || ""}
        employees={scopedEmployees}
        stations={data?.stations || []}
        requests={requests}
        activeRequests={active}
        loading={loading}
        initialFilter={postSend ? "status" : initialFilter}
        activeFilter={homeFilter}
        focusRequestId={postSend?.requestId || ""}
        sentLinks={postSend?.links || []}
        sealPreview={seal.signatureUrl}
        sealId={seal.signatureId}
        sealReady={sealReady}
        onOpenStudio={() => setStudioOpen(true)}
        onRemoveSeal={removeSeal}
        onOpenDocument={({ file, sourceUrl, templateId }) => setWorkspace({
          file,
          sourceUrl,
          templateId: templateId || "",
          signature: {
            signatureUrl: seal.signatureUrl,
            signatureRawUrl: seal.signatureRawUrl,
            signatureVariant: seal.signatureVariant,
            stampConfig: seal.stampConfig,
            preview: seal.signatureUrl,
          },
        })}
        onOpenRequest={openRequest}
        onReload={reload}
        drafts={drafts}
        onNewEnvelope={({ files, templateId }) => { setSetupError(""); setSetup({ files: files || [], templateId: templateId || "" }); }}
        onOpenDraft={(draft) => { setSetupError(""); setSetup(draft); }}
        onDeleteDraft={(id) => { deleteEnvelopeDraft(companyId, userId, id); setDraftTick((n) => n + 1); }}
        onCopyEnvelope={copyEnvelope}
      />
    </div>
    </SuiteWorkspaceFrame>
  );
}
