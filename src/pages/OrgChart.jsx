import React, { useCallback } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { canAccessPath, canAccessPlanPath } from "@/lib/navVisibility";
import { isBase44BackendConfigured } from "@/lib/localPreview";
import TrialExpiryGate from "@/components/TrialExpiryGate";
import PlatformBoot from "@/components/shared/PlatformBoot";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import OrgTreeChart from "@/components/hr/orgdesign/OrgTreeChart";

const HR_ROLES = ["owner", "director", "admin", "pgm", "hr_manager", "ops_manager"];

/**
 * /app/org/chart — the whole org tree, full screen: no rail, no header, no other sections; only
 * «رجوع» back to where the viewer came from, search, open/fold all, zoom, download and options.
 * Opens on the viewer's own card with their chain open; ?focus=<seatId> opens the path to another.
 *
 * HR / owner read the whole tree (scope "all"); everyone else — or ?scope=mine — receives the
 * pruned tree (chain, peers, own subtree), filtered in the data, not only hidden on screen.
 * Rendered outside the Layout chrome, so the auth gate lives here (same rules as RequireAuth).
 */
export default function OrgChart() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { session, company, data, currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = typeof location.state?.from === "string" && location.state.from.startsWith("/app") ? location.state.from : "";

  const canWrite = Boolean(currentUser && (currentUser.id === data?.ownerId || HR_ROLES.includes(currentUser.role)));
  const scope = canWrite && searchParams.get("scope") !== "mine" ? "all" : "mine";

  const onBack = useCallback(() => {
    navigate(from || (scope === "all" ? "/app/org?view=admin" : "/app/org"));
  }, [navigate, from, scope]);

  const onHire = useCallback((detail = {}) => {
    const params = new URLSearchParams({ view: "admin", hire: "1" });
    if (detail.stationId) params.set("station", detail.stationId);
    if (detail.seatId) params.set("seat", detail.seatId);
    navigate(`/app/org?${params.toString()}`);
  }, [navigate]);

  if (!session) {
    return (
      <Navigate
        to={isBase44BackendConfigured() ? "/login" : "/preview"}
        replace
        state={{ from: location.pathname }}
      />
    );
  }
  if (!data || !company || (session.userId && !currentUser)) return <PlatformBoot variant="full" />;
  if (!canAccessPath(location.pathname, currentUser, data, company)) {
    return <Navigate to={canAccessPlanPath(location.pathname, company) ? "/app" : "/pricing"} replace />;
  }

  return (
    <TrialExpiryGate company={company}>
      <div className="powercare-shell" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}>
        <PageErrorBoundary resetKey={`tree:${scope}`}>
          <OrgTreeChart
            key={`${scope}:${currentUser?.id || ""}`}
            ar={ar}
            data={data}
            user={currentUser}
            companyId={company.id}
            scope={scope}
            canWrite={canWrite}
            onHire={onHire}
            onBack={onBack}
          />
        </PageErrorBoundary>
      </div>
    </TrialExpiryGate>
  );
}
