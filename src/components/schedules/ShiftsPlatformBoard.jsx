import React, { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { Loader2, Link2 } from "lucide-react";
import { useAuth } from "@/lib/PowerCareAuth";
import { canCreateTasks, isCompanyOwner } from "@/lib/permissions";
import useStationScope from "@/hooks/useStationScope";
import { rosterMineScopeCopy, rosterTableHeading, rosterTableStation, SW } from "@/lib/shiftWeek";
import { hydrateEmployeesLeave } from "@/lib/leaveDerivations";

const ShiftWeekBoard = lazy(() => import("@/components/schedules/ShiftWeekBoard"));

function RotaPerfLinkCard({ ar }) {
  const steps = [
    {
      n: "1",
      title: ar ? "الجدول يحدد المستحق — 65 يومًا حاليًا" : "The roster sets what is owed — currently 65 days",
      body: ar
        ? "مجموع الورديات المنشورة هو طول الفترة. وأثره في الأداء واحد ومحدد: من خدم جزءًا من الفترة تُعدَّل نقاط مهامه إلى معدّل الفترة الكاملة، فلا يُقارَن نصف ربع بربع كامل. أما الحضور نفسه فلا يدخل الدرجة إطلاقًا — يُرصد للأجر والانضباط."
        : "The sum of published shifts is the length of the period. Its effect on the score is single and specific: anyone who served only part of it has their task points pro-rated to a full-period rate. Attendance itself does not enter the score at all — it is recorded for pay and discipline.",
    },
    {
      n: "2",
      title: ar ? "البصمة تُقارن بالوردية لا باليوم" : "Check-in is compared to the shift",
      body: ar
        ? "التأخر يُقاس من بداية وردية الموظف هو، لا من ساعة موحدة. من ورديته ليلية لا يُعد متأخرًا لأنه لم يحضر صباحًا."
        : "Lateness is measured against that employee's own shift start, not a company-wide hour. Someone on nights is never late for not arriving in the morning.",
    },
    {
      n: "3",
      title: ar ? "الإجازة تخرج قبل الإسناد" : "Leave is removed before assignment",
      body: ar
        ? "من له إجازة معتمدة لا يُسند إلى وردية أصلًا، فلا يُسجَّل غيابه ولا يظهر في سجل الانضباط."
        : "Anyone on approved leave is never assigned a shift, so no absence is recorded and nothing enters their disciplinary record.",
    },
    {
      n: "4",
      title: ar ? "النقص يُقاس على الجدول لا على الموظف" : "Gaps are a roster fault, not a personal one",
      body: ar
        ? "الوردية ناقصة التغطية عبء جدولة، ولا تُحتسب غيابًا على أحد. ومن يتطوّع لسدّها تُحتسب له نقاط في بند تغطية الورديات."
        : "An under-covered shift is a scheduling burden and is never recorded as anyone's absence. Whoever volunteers to fill it is rewarded through the shift-coverage term.",
    },
  ];

  return (
    <section style={{ background: SW.card, border: `1px solid ${SW.line}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}`, display: "flex", alignItems: "center", gap: 10 }}>
        <Link2 style={{ width: 14, height: 14, color: SW.green, flexShrink: 0 }} strokeWidth={1.75} />
        <span style={{ fontSize: 15, fontWeight: 700, color: SW.ink }}>
          {ar ? "ارتباط الجدول بالأداء" : "How the roster reaches Performance"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>
        {steps.map((step) => (
          <div key={step.n} style={{ padding: "13px 18px", borderInlineStart: `1px solid ${SW.hair}`, borderBottom: `1px solid ${SW.hair}`, display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: SW.greenDot, marginTop: 6 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: SW.ink, lineHeight: 1.5 }}>{step.title}</span>
              <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{step.body}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ShiftsPlatformBoard({ lang = "ar", kicker, lane = "mine", employees: employeesProp, canManage = false }) {
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const headerScope = useStationScope();
  const mine = lane !== "manage";
  const table = rosterTableStation({
    lane: mine ? "mine" : "manage",
    employee: currentUser,
    headerScope,
    stations: data?.stations || [],
    fallbackStationId: currentUser?.managedStations?.[0] || data?.stations?.[0]?.id || null,
  });
  const heading = rosterTableHeading({
    lane: mine ? "mine" : "manage",
    stationName: table.stationName,
    missingWorkStation: table.missingWorkStation,
    canManage,
    ar,
  });
  const headerOther = !!(headerScope && headerScope !== "all" && table.workStationId && String(headerScope) !== String(table.workStationId));
  const mineScope = rosterMineScopeCopy({
    stationName: table.stationName,
    headerOther,
    ar,
  });
  const stationId = table.stationId;
  const canManageRotaPolicy = !!(currentUser && data && (
    isCompanyOwner(currentUser, data)
    || ["director", "ops_manager", "station_manager"].includes(currentUser.role)
    || canCreateTasks(currentUser)
  ));
  const source = (data?.employees || []).length
    ? data.employees
    : (Array.isArray(employeesProp) && employeesProp.length ? employeesProp : (currentUser ? [currentUser] : []));
  const employees = hydrateEmployeesLeave(source, data);

  return (
    <div className="nv-ops-cal" style={{ display: "flex", flexDirection: "column", gap: 16, color: SW.ink, fontSize: 13, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }} dir={ar ? "rtl" : "ltr"}>
      {mine && canManage && stationId && table.stationName && (
        <div style={{
          padding: "11px 18px",
          background: mineScope.emphasize ? SW.goldBg : SW.card,
          border: `1px solid ${mineScope.emphasize ? SW.goldBd : SW.line}`,
          fontSize: 12,
          color: mineScope.emphasize ? SW.gold : SW.mid,
          lineHeight: 1.7,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "baseline",
        }}>
          <span>{mineScope.line}</span>
          <Link to="/app/shifts?lane=manage" style={{ color: "inherit", fontWeight: 700 }}>
            {mineScope.action}
          </Link>
        </div>
      )}
      {!mine && table.headerAll && stationId && table.stationName && (
        <div style={{ padding: "11px 18px", background: SW.goldBg, border: `1px solid ${SW.goldBd}`, fontSize: 11, color: SW.gold, lineHeight: 1.7 }}>
          {ar
            ? `هذا محرّر فرع ${table.stationName} — النطاق «كل الفروع» لا يخلط جداول الفروع. اختر فرعاً من الهيدر لتبديل المحرر.`
            : `This is the ${table.stationName} editor — “all stations” does not mix branch weeks. Pick a station in the header to switch.`}
        </div>
      )}

      {!stationId && (
        <section style={{ background: SW.card, border: `1px solid ${SW.line}`, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: SW.ink }}>{heading.gridTitle}</span>
          <span style={{ fontSize: 13, color: SW.mid, lineHeight: 1.8 }}>
            {heading.emptyReason
              || (ar
                ? "لا فرع محدد — لا جدول يُعرض."
                : "No branch is selected — no roster to show.")}
          </span>
        </section>
      )}

      {stationId && (
        <Suspense
          fallback={
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Loader2 style={{ width: 20, height: 20, color: SW.green }} className="animate-spin" />
            </div>
          }
        >
          <ShiftWeekBoard
            schedule={(data?.schedules || []).find((row) => String(row.stationId) === String(stationId)) || { stationId, shiftTypes: [], assignments: {} }}
            employees={employees}
            stationId={stationId}
            stationName={table.stationName}
            companyId={company?.id}
            currentUser={currentUser}
            canEdit={!mine && canManageRotaPolicy}
            mode={mine ? "mine" : "manage"}
            lang={lang}
            kicker={kicker}
            pageTitle={heading.pageTitle}
            gridTitle={heading.gridTitle}
            gridLead={heading.gridLead}
          />
        </Suspense>
      )}

      <RotaPerfLinkCard ar={ar} />
    </div>
  );
}
