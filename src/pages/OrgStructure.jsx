import React, { useMemo } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { useRailSide } from "@/lib/railSide";
import { hrSectionAccessFor } from "@/lib/navVisibility";
import { orgRedirectTarget } from "@/lib/hrSection";
import { pageKicker } from "@/lib/moduleMeta";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import OpsFrame from "@/components/tasks/OpsFrame";
import OrgTreeChart from "@/components/hr/orgdesign/OrgTreeChart";
import { OrgChartUpkeep } from "@/components/hr/OrgTemplateBoard";
import { MUTED } from "@/lib/platformStyles";

/**
 * /app/org — «الهيكل» on the employee side: a section like any other (band, then the content),
 * holding the whole company tree read-only — every branch and every person — opening on the
 * viewer's card. The tree's «شاشة كاملة» opens /app/org/chart?lane=employee, whose «خروج»
 * returns here. The management content that lived here
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
      section={pageKicker("/app/org", lang).split("·").slice(1).join("·").trim() || (ar ? "القوى العاملة" : "Workforce")}
      title={ar ? "الهيكل" : "Structure"}
      hint={ar
        ? "الشركة كلها للاطلاع: كل الفروع وكل الموظفين، والمخطط يفتح على بطاقتك. التغيير في الهيكل عبر الموارد البشرية."
        : "The whole company, read-only: every branch and every person; the chart opens on your card. Structural changes go through HR."}
    >
      {!data || !currentUser || !company ? (
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "جارٍ تحميل الهيكل…" : "Loading org structure…"}</p>
      ) : (
        <div className="nv-org-page" data-org-pane="mine" data-org-employee-tree="1">
          <PageErrorBoundary resetKey="mine">
            <OrgChartUpkeep lang={lang} />
            <OrgTreeChart
              ar={ar}
              data={data}
              user={currentUser}
              companyId={company?.id || ""}
              scope="all"
              canWrite={false}
              variant="embedded"
            />
          </PageErrorBoundary>
        </div>
      )}
    </OpsFrame>
  );
}
