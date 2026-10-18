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

  const hrRole = Boolean(currentUser && (currentUser.id === data?.ownerId || HR_ROLES.includes(currentUser.role)));
  // Two separate charts of one tree. ?lane=employee (the rail's «الهيكل») is the employee's: read-only,
  // no HR tools even for HR people, and «خروج» goes back to the employee side. ?lane=manage (from
  // «الموارد البشرية») carries the management tools and exits to HR. No lane → by role.
  const laneParam = searchParams.get("lane");
  const lane = laneParam === "manage" || laneParam === "employee" ? laneParam : (hrRole ? "manage" : "employee");
  const canWrite = hrRole && lane === "manage";
  // Everyone reads the whole company: every branch and every person (cards carry names, titles,
  // units and seat states only — never file data). ?scope=mine keeps the pruned view.
  const scope = searchParams.get("scope") === "mine" ? "mine" : "all";

  const onBack = useCallback(() => {
    // «رجوع» returns into «الموارد البشرية › الهيكل» (or the employee's own place)
    // «خروج»: back to where the person came from on the same side; else HR (manage) or the employee's first section
    const sameSide = from && !from.startsWith("/app/org/chart") && (lane === "manage") === /lane=manage|tab=manage|view=manage|\/manage(?:$|[/?])|\/app\/hr|^\/app(?:$|\?)/.test(from);
    navigate(sameSide ? from : (lane === "manage" ? "/app/hr" : "/app/attendance"));
  }, [navigate, from, lane]);

  const onHire = useCallback((detail = {}) => {
    const params = new URLSearchParams({ tab: "org", hire: "1" });
    if (detail.stationId) params.set("station", detail.stationId);
    if (detail.seatId) params.set("seat", detail.seatId);
    navigate(`/app/hr?${params.toString()}`);
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
        <PageErrorBoundary resetKey={`tree:${scope}:${lane}`}>
          <OrgTreeChart
            key={`${scope}:${lane}:${currentUser?.id || ""}`}
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
