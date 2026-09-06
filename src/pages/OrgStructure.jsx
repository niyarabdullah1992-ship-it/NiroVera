import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { OPEN_HIRE_EVENT } from "@/lib/orgHire";
import { isManagerUnit } from "@/lib/stationTree";
import { toast } from "@/components/ui/use-toast";
import { syncWorkplaceManagers } from "@/lib/peopleTree";
import { orgChainHealth, orgChainNext } from "@/lib/orgChain";
import OrgChainStrip from "@/components/hr/OrgChainStrip";
import OrgTemplateBoard from "@/components/hr/OrgTemplateBoard";
import OrgPeopleTree from "@/components/hr/OrgPeopleTree";
import OrgListAccessBoard from "@/components/hr/OrgListAccessBoard";
import OrgEscalationBoard from "@/components/hr/OrgEscalationBoard";
import HireSeatDrawer from "@/components/hr/HireSeatDrawer";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { MUTED } from "@/lib/platformStyles";

const ORG_TABS = new Set(["branches", "people", "lists", "escalation"]);

/** Place → people → access. One workplace tree; people derived; lists grant permission. */
export default function OrgStructure() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hire, setHire] = useState(null);
  const requested = searchParams.get("tab");
  const tool = ORG_TABS.has(requested) ? requested : "branches";

  const setTool = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "branches") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const health = useMemo(() => orgChainHealth(data), [data]);
  const next = useMemo(() => orgChainNext(data, ar), [data, ar]);

  const sections = useMemo(() => [
    {
      value: "branches",
      step: 1,
      label: ar ? "المكان" : "Place",
      count: health.branches,
    },
    {
      value: "people",
      step: 2,
      label: ar ? "الناس" : "People",
      count: health.people,
    },
    {
      value: "lists",
      step: 3,
      label: ar ? "الصلاحية" : "Access",
      count: health.lists,
    },
    {
      value: "escalation",
      step: 4,
      label: ar ? "التصعيد" : "Escalation",
      count: health.escalationBranches || 0,
    },
  ], [ar, health.branches, health.people, health.lists, health.escalationBranches]);

  const openHire = (detail = {}) => {
    const station = (data?.stations || []).find((item) => String(item.id) === String(detail.stationId || ""));
    if (detail.stationId && isManagerUnit(station)) {
      toast({
        description: ar
          ? "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه."
          : "A manager is not a hire workplace. Convert it to a branch, then hire there.",
        variant: "destructive",
      });
      return;
    }
    setHire({
      stationId: detail.stationId || "",
      seatId: detail.seatId || "",
      listId: detail.listId || "",
      listName: detail.listName || "",
    });
  };

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;
    if (nextParams.get("tab") === "seats" || nextParams.get("tab") === "template") {
      nextParams.delete("tab");
      changed = true;
    }
    if (nextParams.get("hire")) {
      setHire({
        stationId: nextParams.get("station") || "",
        seatId: nextParams.get("seat") || "",
        listId: nextParams.get("list") || "",
        listName: "",
      });
      nextParams.delete("hire");
      nextParams.delete("station");
      nextParams.delete("seat");
      nextParams.delete("list");
      changed = true;
    }
    if (changed) setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onOpen = (event) => {
      const detail = event.detail || {};
      setHire({
        stationId: detail.stationId || "",
        seatId: detail.seatId || "",
        listId: detail.listId || "",
        listName: detail.listName || "",
      });
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        nextParams.delete("tab");
        nextParams.delete("hire");
        return nextParams;
      }, { replace: true });
    };
    window.addEventListener(OPEN_HIRE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HIRE_EVENT, onOpen);
  }, [setSearchParams]);

  const canWrite = Boolean(currentUser && (
    currentUser.id === data?.ownerId
    || ["owner", "director", "admin", "pgm", "hr_manager", "ops_manager"].includes(currentUser.role)
  ));

  useEffect(() => {
    if (!company?.id || !canWrite) return;
    syncWorkplaceManagers(company.id);
  }, [company?.id, canWrite]);

  return (
    <>
      <PlatformStampShell
        ar={ar}
        title={ar ? "الهيكل التنظيمي" : "Org structure"}
        sections={sections}
        tool={tool}
        onTool={setTool}
        maxWidth={1400}
        flushBody
        metaBar={(
          <OrgChainStrip ar={ar} onTool={setTool} health={health} next={next} />
        )}
      >
        {!data || !currentUser || !company ? (
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "جارٍ تحميل الهيكل…" : "Loading org structure…"}</p>
        ) : (
          <div className="nv-org-page">
          <PageErrorBoundary resetKey={tool}>
            {tool === "people" ? (
              <OrgPeopleTree lang={lang} canWrite={canWrite} />
            ) : tool === "lists" ? (
              <OrgListAccessBoard
                data={data}
                companyId={company.id}
                ar={ar}
                canWrite={canWrite}
                ownerMode={currentUser.id === data.ownerId || currentUser.role === "owner"}
                wide
                onHire={openHire}
              />
            ) : tool === "escalation" ? (
              <OrgEscalationBoard lang={lang} canWrite={canWrite} />
            ) : (
              <OrgTemplateBoard lang={lang} onHire={openHire} onNeedAccess={() => setTool("lists")} />
            )}
          </PageErrorBoundary>
          </div>
        )}
      </PlatformStampShell>
      {data && company ? (
        <HireSeatDrawer
          open={Boolean(hire)}
          data={data}
          companyId={company.id}
          ar={ar}
          stationId={hire?.stationId || ""}
          seatId={hire?.seatId || ""}
          listId={hire?.listId || ""}
          listName={hire?.listName || ""}
          onClose={() => setHire(null)}
          onNeedAccess={() => { setHire(null); setTool("lists"); }}
        />
      ) : null}
    </>
  );
}
