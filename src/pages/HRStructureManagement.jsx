import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import JobGradeManager from "@/components/employees/JobGradeManager";
import HrDirectoryBoard from "@/components/hr/HrDirectoryBoard";
import ComplianceMhrsdBoard from "@/components/hr/ComplianceMhrsdBoard";
import useStationScope from "@/hooks/useStationScope";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";

const LAYERS = new Set(["people", "compliance"]);

/**
 * Platform `hr` — directory + the MHRSD compliance centre as a first-class tab
 * (Settings and the landing page link here).
 */
export default function HRStructureManagement() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const [gradesOpen, setGradesOpen] = useState(false);
  const stationScope = useStationScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const hashWantsCompliance = typeof window !== "undefined" && window.location.hash === "#compliance-center";
  const requested = searchParams.get("tab");
  const tab = LAYERS.has(requested) ? requested : (hashWantsCompliance ? "compliance" : "people");

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "people") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (hashWantsCompliance && tab !== "compliance") setTab("compliance");
  }, [hashWantsCompliance, tab]);

  if (!data || !currentUser) return null;

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/hr", lang)}
      title={tab === "compliance"
        ? (ar ? "مركز امتثال وزارة الموارد البشرية" : "MHRSD compliance centre")
        : (ar ? "الموارد البشرية" : "Human resources")}
      hint={tab === "compliance"
        ? (ar ? "درجة موزّعة على أجور وعقود ودوام وسلامة وجزاءات — مشتقة من الكتالوج. منافذ قوى/مدد جاهزة بلا إرسال حي." : "A score split across wages, contracts, hours, safety and discipline — derived from the catalog. Qiwa/Mudad ports are ready without a live send.")
        : (ar ? "الدليل الوظيفي والدرجات. امتثال الوزارة في التبويب المجاور." : "Directory and grades. Ministry compliance is the neighbouring tab.")}
      maxWidth={1280}
      sections={[
        { value: "people", label: ar ? "الدليل" : "Directory", icon: Users },
        { value: "compliance", label: ar ? "امتثال الوزارة" : "Ministry compliance", icon: ShieldCheck },
      ]}
      tool={tab}
      onTool={setTab}
    >
      <div className="space-y-4">
        {tab === "people" ? (
          <>
            <HrDirectoryBoard lang={lang} stationScope={stationScope} />
            <div>
              <button
                type="button"
                onClick={() => setGradesOpen((open) => !open)}
                aria-expanded={gradesOpen}
                className="flex w-full items-center justify-between py-3 text-start text-[13px] font-semibold text-[#14284B]"
              >
                {t("jobGradesManage")}
                <ChevronDown className={`h-4 w-4 text-[#5A6B85] transition-transform ${gradesOpen ? "rotate-180" : ""}`} />
              </button>
              {gradesOpen && (
                <div className="pb-2">
                  <JobGradeManager companyId={company.id} data={data} />
                </div>
              )}
            </div>
          </>
        ) : (
          <ComplianceMhrsdBoard />
        )}
      </div>
    </PlatformStampShell>
  );
}
