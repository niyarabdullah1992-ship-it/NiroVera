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
import { isOpenSigningState, settledState } from "@/lib/multiSignDerivations";
import { invokeLocalMultiSign, shouldUseLocalMultiSign } from "@/lib/localMultiSignFallback";
import { canCreateSignatureRequests, visibleEmployees } from "@/lib/permissions";
import { updateEmployeeProfile } from "@/lib/store";
import { MUTED, pageCol } from "@/lib/platformStyles";
import { ensureSignatureFonts } from "@/lib/typedSignatureImage";
import { deskSigningRows, isConsentSignToken } from "@/lib/writtenConsent";

// Old ?tab= bookmarks open the matching surface. Archive is the الأرشيف tab.
const TAB_FILTERS = { inbox: "status", status: "status", archive: "archive", verify: "verify", mine: "mine", individual: "all", group: "all" };

export default function FileSigning() {
  const { lang } = useI18n();
  const { company, data, currentUser } = useAuth();
  const ar = lang === "ar";
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [postSend, setPostSend] = useState(null);
  const [homeFilter, setHomeFilter] = useState(null);
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

  const active = useMemo(() => {
    if (requests === null) return null;
    return (requests || []).filter((row) => isOpenSigningState(settledState(row).state));
  }, [requests]);

  const canCreate = currentUser && data ? canCreateSignatureRequests(currentUser, data) : false;

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
        ar={ar}
        onOpenStudio={() => setStudioOpen(true)}
        onClose={closeWorkspace}
        onSigned={(payload) => {
          reload();
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

  return (
    <div
      className="nv-sign-frame nv-sign-desk"
      dir={ar ? "rtl" : "ltr"}
      style={{ width: "min(1320px, 100%)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}
    >
      <SigningHome
        ar={ar}
        lang={lang}
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
        onOpenDocument={({ file, sourceUrl }) => setWorkspace({
          file,
          sourceUrl,
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
      />
    </div>
  );
}
