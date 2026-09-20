import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { deriveBranchEscalationChain } from "@/lib/orgDerivations";
import { isEscalated } from "@/lib/opsDerivations";
import { canAccessPath } from "@/lib/navVisibility";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { workplaceStations } from "@/lib/stationTree";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";
import { BORDER, CARD, INK, MUTED, NAVY, emptyState, ui } from "@/lib/platformStyles";

export default function Escalation() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const headerScope = useStationScope();

  const allowed = canAccessPath("/app/escalation", currentUser, data, company);

  const stations = useMemo(() => {
    const workplaces = workplaceStations(data?.stations || []);
    const scoped = workplaces.filter((s) => matchesStationScope(s.id, headerScope));
    return scoped.length ? scoped : workplaces;
  }, [data?.stations, headerScope]);

  const tasks = useMemo(() => {
    const ids = new Set(stations.map((s) => s.id));
    return (data?.tasks || []).filter((t) => !t.stationId || ids.has(t.stationId));
  }, [data?.tasks, stations]);

  const escalatedTasks = useMemo(() => tasks.filter(isEscalated), [tasks]);

  const stationLadders = useMemo(() => stations.map((station) => ({
    station,
    chain: deriveBranchEscalationChain(station.id, data),
  })), [stations, data]);

  if (!allowed) {
    return (
      <PlatformStampShell ar={ar} kicker={pageKicker("/app/escalation", lang)} title={ar ? "التصعيد" : "Escalation"} hint={ar ? "لا صلاحية." : "No access."}>
        <div style={emptyState}>{ar ? "هذا القسم للمديرين فقط." : "Managers only."}</div>
      </PlatformStampShell>
    );
  }

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/escalation", lang)}
      title={ar ? "نظام التصعيد" : "Escalation system"}
      hint={ar
        ? "سلسلة لكل فرع — الرفض يُعاد للمنفّذ، وبعد ثلاثة رفض يحق له التصعيد. أسباب الرفض والتصعيد تظهر في مراسلات بطاقة المهمة، ليست خاصة. التصعيد التلقائي يبقى عند احتراق إيقاع الإنجاز."
        : "Per-station chain — a reject returns to the executor; after three rejects they may escalate. Reject and escalate reasons stay on the task card thread, not in a private channel. Auto-escalate still fires when pace quota burns."}
      maxWidth={1280}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{ar ? "صندوق التصعيد" : "Escalation inbox"}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  {ar ? `${escalatedTasks.length} مهمة بانتظار مراجعة على مستواك` : `${escalatedTasks.length} task(s) awaiting review at your level`}
                </div>
              </div>
              <Link to="/app/tasks?filter=escalated" style={{ ...ui.btnGhost, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                {ar ? "افتح في المهام" : "Open in tasks"}
                <ArrowUpRight style={{ width: 14, height: 14 }} />
              </Link>
            </div>
            {escalatedTasks.length === 0 ? (
              <div style={{ ...emptyState, margin: 0, border: "none" }}>
                {ar ? "لا مهام مصعّدة في هذا النطاق." : "No escalated tasks in this scope."}
              </div>
            ) : (
              escalatedTasks.slice(0, 8).map((task) => {
                const station = stations.find((s) => s.id === task.stationId);
                return (
                  <Link
                    key={task.id}
                    to="/app/tasks?filter=escalated"
                    style={{
                      display: "block",
                      padding: "12px 16px",
                      borderBottom: `1px solid ${BORDER}`,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{task.title}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      {station?.name || "—"} · {ar ? `مستوى ${(Number(task.escalationLevel) || 0) + 1}` : `Level ${(Number(task.escalationLevel) || 0) + 1}`}
                      {task.autoEscalated ? (ar ? " · تلقائي" : " · auto") : ""}
                    </div>
                  </Link>
                );
              })
            )}
          </section>

          <section style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 600, color: INK }}>
              {ar ? "سلاسل التصعيد حسب الفرع" : "Escalation chains by station"}
            </div>
            {stationLadders.length === 0 ? (
              <div style={{ ...emptyState, margin: 0, border: "none" }}>
                {ar ? "لا فروع في النطاق الحالي." : "No stations in current scope."}
              </div>
            ) : (
              stationLadders.map(({ station, chain }) => (
                <div key={station.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{station.name}</div>
                  {chain.length === 0 ? (
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
                      {ar ? "لا سلسلة — عيّن مدير الفرع والأب في الهيكل." : "No chain — assign station manager and parent in Org."}
                    </div>
                  ) : (
                    <ol style={{ margin: "8px 0 0", paddingInlineStart: 18, fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
                      {chain.map((step, idx) => (
                        <li key={`${step.employeeId}-${idx}`}>
                          <span style={{ color: INK, fontWeight: 500 }}>{step.name}</span>
                          {step.title ? ` — ${step.title}` : ""}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))
            )}
          </section>
      </div>
    </PlatformStampShell>
  );
}
