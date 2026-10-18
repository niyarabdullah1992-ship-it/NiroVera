import React, { useMemo } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { useRailSide } from "@/lib/railSide";
import { hrSectionAccessFor } from "@/lib/navVisibility";
import { orgRedirectTarget } from "@/lib/hrSection";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import OpsFrame from "@/components/tasks/OpsFrame";
import OrgChartEntry from "@/components/hr/orgdesign/OrgChartEntry";
import { MUTED } from "@/lib/platformStyles";

/**
 * /app/org — «مكاني في الهيكل», the employee's own place in the structure (read-only: chain,
 * peers, team; the full chart at /app/org/chart). The management content that lived here
 * («المحطات التي أديرها» — chart, seats, health, authority, changes, branches) moved into
 * «الموارد البشرية» (/app/hr): an admin link redirects to the matching pane with its parameters
 * (lib/hrSection orgRedirectTarget). The employee side never sees an HR pane.
 */
export default function OrgStructure() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const railSide = useRailSide();
  const access = useMemo(
    () => (data && currentUser ? hrSectionAccessFor(currentUser, data, company) : { panes: [] }),
    [data, currentUser, company],
  );

  const ownView = railSide === "employee" || searchParams.get("view") === "employee";
  if (data && currentUser && !ownView && access.panes.includes("org")) {
    const target = orgRedirectTarget(location.search, location.hash);
    if (target) return <Navigate to={target} replace state={location.state} />;
  }

  return (
    <OpsFrame
      ar={ar}
      lane="mine"
      section={ar ? "ملفي" : "My file"}
      title={ar ? "مكاني في الهيكل" : "My place in the structure"}
      hint={ar
        ? "للاطلاع — الشركة كلها: كل الفروع وكل الموظفين، والمخطط يفتح على بطاقتك. التغيير في الهيكل عبر الموارد البشرية."
        : "Read-only — the whole company: every branch and every person; the chart opens on your card. Structural changes go through HR."}
    >
      {!data || !currentUser || !company ? (
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "جارٍ تحميل الهيكل…" : "Loading org structure…"}</p>
      ) : (
        <div className="nv-org-page" data-org-pane="mine">
          <PageErrorBoundary resetKey="mine">
            <OrgChartEntry ar={ar} data={data} user={currentUser} scope="all" />
          </PageErrorBoundary>
        </div>
      )}
    </OpsFrame>
  );
}
