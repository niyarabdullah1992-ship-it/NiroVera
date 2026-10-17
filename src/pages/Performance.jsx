import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import PerfMineBoard from "@/components/performance/PerfMineBoard";
import PerfScoreBoard from "@/components/performance/PerfScoreBoard";
import PerformanceSectionFrame from "@/components/performance/PerformanceSectionFrame";
import usePerformanceTargets from "@/hooks/usePerformanceTargets";
import { syncPointsFromCloud } from "@/lib/store";
import { pageKicker } from "@/lib/moduleMeta";
import { hcmCall } from "@/lib/hcmApi";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { formatDayMonthYear } from "@/lib/dateFormat";
import { countAr, isoDay, monthsInRange, rangePresets } from "@/lib/perfRange";
import { canManagePerformance } from "@/lib/suiteRailFrame";
import { useRailSide } from "@/lib/railSide";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";

/** Performance is a derived judgment of approved proof between two dates. */
export default function Performance() {
  const { lang, dir } = useI18n();
  const { data, currentUser, company, refresh } = useAuth();
  const [searchParams] = useSearchParams();
  const canManage = canManagePerformance(currentUser, data);
  const railSide = useRailSide();
  const requested = searchParams.get("view");
  const face = railSide === "employee" || !canManage
    ? "self"
    : railSide === "manage"
      ? "manage"
      : ((requested === "self") ? "self" : ((requested === "manage" || !requested) ? "manage" : "self"));
  const targets = usePerformanceTargets(company, currentUser);
  const headerScope = useStationScope();
  const ar = lang === "ar";
  const today = isoDay();
  const presets = useMemo(() => rangePresets(today), [today]);
  const current = presets.find((row) => row.id === "q") || presets[0];
  const [tab, setTab] = useState("people");
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const [cycles, setCycles] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    syncPointsFromCloud(company.id).then((ok) => { if (ok) refresh?.(); }).catch(() => {});
  }, [company?.id]);

  useEffect(() => {
    if (face !== "manage" || !company?.id) return;
    let alive = true;
    hcmCall({
      action: "objectiveBoard",
      companyId: company.id,
      companyName: company.name,
      ...(headerScope !== "all" ? { stationId: headerScope } : {}),
    }).then((remote) => {
      if (!alive || !remote?.ok) return;
      setCycles(Array.isArray(remote.cycles) ? remote.cycles : []);
    }).catch(() => {
      if (alive) setCycles([]);
    });
    return () => { alive = false; };
  }, [face, company?.id, company?.name, headerScope]);

  const scopedTargets = targets || [];
  const empName = (id) => (data?.employees || []).find((e) => String(e.id) === String(id))?.name || "";
  const empStation = (id) => (data?.employees || []).find((e) => String(e.id) === String(id))?.stationId;

  const goalItems = useMemo(() => {
    const doneGoals = scopedTargets
      .filter((tg) => tg.status === "completed")
      .filter((tg) => {
        const stationId = tg.stationId || tg.station_id || empStation(tg.employee_id || tg.employeeId || tg.assignedTo);
        return matchesStationScope(stationId, headerScope, data?.stations);
      })
      .map((tg) => {
        const who = empName(tg.employee_id || tg.employeeId || tg.assignedTo);
        const done = tg.completed_tasks ?? tg.completed ?? "";
        const goal = tg.task_target ?? tg.target ?? "";
        return {
          id: `tg_${tg.id}`,
          date: tg.reviewedAt || tg.end_date || tg.endDate || tg.created_at || tg.createdAt,
          title: tg.title || (ar ? "هدف" : "Goal"),
          text: [who, (done !== "" && goal !== "") ? `${done}/${goal}` : ""].filter(Boolean).join(" · "),
          badge: ar ? "هدف منجز" : "Goal done",
        };
      });
    return doneGoals;
  }, [scopedTargets, headerScope, data?.stations, data?.employees, ar]);

  if (!data || !currentUser) return null;
  const valid = Boolean(from && to && from <= to);
  const monthKeys = valid ? monthsInRange(from, to) : [];
  const rangeNote = !valid
    ? (ar ? "تاريخ البداية بعد النهاية — صحّح المدى ليُحسب شيء." : "The start is after the end — correct the range so a score can be derived.")
    : (monthKeys.length
      ? `${formatDayMonthYear(`${from}T12:00:00`, ar ? "ar" : "en")} → ${formatDayMonthYear(`${to}T12:00:00`, ar ? "ar" : "en")} · ${ar ? countAr(monthKeys.length, "شهر واحد", "شهران", "أشهر", "شهراً") : `${monthKeys.length} mo`}`
      : (ar ? "لا بيانات في هذا المدى." : "No data in this range."));

  return (
    <PerformanceSectionFrame
      ar={ar}
      kicker={pageKicker("/app/performance", lang)}
      title={face === "self" ? (ar ? "أدائي" : "My performance") : (ar ? "الأداء" : "Performance")}
      hint={face === "self"
        ? (ar
          ? "درجتك تُشتقّ من إثباتك المعتمد في الفترة التي تختارها، وتراها أنت ومديرك المباشر."
          : "Your score is derived from your approved proof in the period you choose, and only you and your direct manager see it.")
        : (tab === "archive"
          ? (ar ? "دورات مقفلة وأهداف منجزة — مجمّعة حسب السنة ثم الشهر." : "Closed cycles and completed goals — grouped by year, then month.")
          : (ar
            ? "مقارنة الموظفين والفروع على الدرجة المشتقّة من الإثبات المعتمد بين تاريخين، مع قاعدة الحساب وأرشيف الدورات المقفلة."
            : "People and branches compared on the score derived from approved proof between two dates, with the scoring rule and the archive of closed cycles."))}
    >
      {face === "self" ? (
        <PerfMineBoard lang={lang} employee={currentUser} data={data} />
      ) : (
        <PerfScoreBoard
          key="manage"
          lang={lang}
          dir={dir}
          from={from}
          to={to}
          presets={presets}
          onFrom={setFrom}
          onTo={setTo}
          onPreset={(preset) => { setFrom(preset.from); setTo(preset.to); }}
          tab={tab}
          onTab={setTab}
          cycles={cycles}
          goalItems={goalItems}
        />
      )}
      {face === "self" ? null : (
        <MinistrySectionPanel
          sectionKey="performance"
          lane="manage"
          ar={ar}
          today={today}
          inputs={{
            people: (data?.employees || []).filter((e) => e && e.id !== currentUser?.id && matchesStationScope(e.stationId, headerScope)),
            perf: data?.hcmPerformance || {},
          }}
        />
      )}
    </PerformanceSectionFrame>
  );
}
