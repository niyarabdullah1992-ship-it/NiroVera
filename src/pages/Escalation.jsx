import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { branchEscalationCardLine, branchEscalationHasChain } from "@/lib/orgDerivations";
import { isEscalated, isOpsTaskDeleted } from "@/lib/opsDerivations";
import { canAccessPath } from "@/lib/navVisibility";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { useRailSide } from "@/lib/railSide";
import { escalationLiveStations, isCompanyRootStation } from "@/lib/stationTree";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";
import { BORDER, CARD, INK, MUTED, NAVY, ui } from "@/lib/platformStyles";

function shown(value, vacant, ar) {
  if (vacant) return ar ? "شاغر" : "Vacant";
  const text = String(value || "").trim();
  return text || "—";
}

function countPill(n, ar) {
  const open = n > 0;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: `1px solid ${open ? "var(--nv-warn-line, #EAD6A8)" : BORDER}`,
    background: open ? "var(--nv-warn-soft, #FBF3E1)" : "var(--nv-card)",
    color: open ? "var(--nv-warn-ink, #8A5A12)" : MUTED,
    fontSize: 11,
    fontWeight: 650,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };
}

function stepFace(step, data, ar) {
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const employee = employees.find((item) => String(item.id) === String(step.employeeId || ""));
  const place = stations.find((item) => String(item.id) === String(step.stationId || ""))?.name || "";
  const job = employee?.profile?.position || employee?.jobTitle || step.title || "";
  return {
    name: shown(step.name || employee?.name, step.vacant, ar),
    job: step.vacant ? (ar ? "مقعد بلا مدير" : "No manager") : (job || "—"),
    place,
    acting: Boolean(step.acting),
    vacant: Boolean(step.vacant),
  };
}

function BranchEscalationCard({ station, data, tasks, ar, opened, onOpen }) {
  const line = branchEscalationCardLine(station.id, data);
  const hasChain = branchEscalationHasChain(station.id, data);
  const visible = hasChain || opened;
  const branchTasks = tasks.filter((task) => String(task.stationId || "") === String(station.id));
  const openLabel = branchTasks.length
    ? (ar ? `${branchTasks.length} مفتوحة` : `${branchTasks.length} open`)
    : (ar ? "لا مهام مفتوحة" : "No open tasks");

  return (
    <section
      data-escalation-branch={station.id}
      style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden" }}
    >
      <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Readex Pro', sans-serif", fontSize: 15, fontWeight: 650, color: NAVY, lineHeight: 1.3 }}>
            {shown(station.name, false, ar)}
            {isCompanyRootStation(station) ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginInlineStart: 8 }}>
                {ar ? "المقر" : "HQ"}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>
            {ar ? "من مدير الفرع إلى من فوقه" : "From the branch manager upward"}
          </div>
        </div>
        {branchTasks.length > 0 ? (
          <Link to="/app/tasks?lane=manage&filter=escalated" style={countPill(branchTasks.length, ar)}>
            {openLabel}
            <ArrowUpRight style={{ width: 13, height: 13 }} />
          </Link>
        ) : (
          <span style={countPill(0, ar)}>{openLabel}</span>
        )}
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        {visible ? (
          line.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 8 }}>
              {line.map((step, idx) => {
                const face = stepFace(step, data, ar);
                const top = idx === line.length - 1;
                return (
                  <React.Fragment key={`${station.id}-${idx}-${step.employeeId || "vacant"}`}>
                    {idx > 0 ? (
                      <span aria-hidden style={{ alignSelf: "center", color: "var(--nv-muted)", fontSize: 14, lineHeight: 1 }}>←</span>
                    ) : null}
                    <div
                      style={{
                        flex: "1 1 168px",
                        maxWidth: 240,
                        minWidth: 148,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${face.vacant ? "#EAD6A8" : BORDER}`,
                        background: face.vacant ? "#FBF3E1" : "var(--nv-soft, #F4F7F5)",
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          flex: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          font: "600 11px 'IBM Plex Mono', monospace",
                          background: face.vacant ? "#FBF3E1" : (top ? "var(--nv-navy, #0B3D27)" : "var(--nv-card)"),
                          color: face.vacant ? "#8A5A12" : (top ? "#fff" : NAVY),
                          border: face.vacant ? "1px dashed #EAD6A8" : `1px solid ${top ? "var(--nv-navy, #0B3D27)" : BORDER}`,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 650, color: face.vacant ? "#8A5A12" : INK, lineHeight: 1.35 }}>{face.name}</div>
                        <div style={{ fontSize: 11, color: face.vacant ? "#8A5A12" : MUTED, lineHeight: 1.45, marginTop: 2 }}>
                          {face.job}
                          {face.acting ? (ar ? " · بالوكالة" : " · acting") : ""}
                        </div>
                        {face.place ? (
                          <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.4, marginTop: 1 }}>{face.place}</div>
                        ) : null}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: MUTED }}>—</div>
          )
        ) : (
          <button
            type="button"
            data-open-branch={station.id}
            onClick={() => onOpen(station.id)}
            style={ui.btnSecondary}
          >
            {ar ? "افتح تصعيد هذا الفرع" : "Open this branch escalation"}
          </button>
        )}
      </div>

      {branchTasks.length > 0 ? (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {branchTasks.slice(0, 8).map((task, index) => (
            <Link
              key={task.id}
              to="/app/tasks?lane=manage&filter=escalated"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderTop: index ? `1px solid ${BORDER}` : "none",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{shown(task.title, false, ar)}</span>
              <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
                {ar ? `مستوى ${(Number(task.escalationLevel) || 0) + 1}` : `Level ${(Number(task.escalationLevel) || 0) + 1}`}
                {task.autoEscalated ? (ar ? " · تلقائي" : " · auto") : ""}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function Escalation() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const headerScope = useStationScope();
  const railSide = useRailSide();
  const [opened, setOpened] = useState({});

  const allowed = canAccessPath("/app/escalation", currentUser, data, company);
  const employeeFace = railSide === "employee";

  const stations = useMemo(() => {
    const live = escalationLiveStations(data?.stations || []);
    if (!headerScope || headerScope === "all") return live;
    return live.filter((station) => matchesStationScope(station.id, headerScope));
  }, [data?.stations, headerScope]);

  const tasks = useMemo(
    () => (data?.tasks || []).filter((task) => isEscalated(task) && !isOpsTaskDeleted(task)),
    [data?.tasks],
  );
  const openInScope = useMemo(() => {
    const ids = new Set(stations.map((station) => String(station.id)));
    return tasks.filter((task) => ids.has(String(task.stationId || ""))).length;
  }, [stations, tasks]);

  if (!allowed || employeeFace) {
    return (
      <PlatformStampShell ar={ar} kicker={pageKicker("/app/escalation", lang)} title={ar ? "التصعيد" : "Escalation"} hint={ar ? "قائمة الفروع للإدارة." : "The branch list is for managers."}>
        <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
          {ar
            ? "تصعيد المهمة يظهر على بطاقتها إذا كانت مُسندة إليك."
            : "A task escalation shows on its card when the task is assigned to you."}
        </div>
      </PlatformStampShell>
    );
  }

  return (
    <PlatformStampShell
      ar={ar}
      kicker={pageKicker("/app/escalation", lang)}
      title={ar ? "نظام التصعيد" : "Escalation system"}
      hint={ar
        ? "سلسلة لكل فرع حي — من مدير الفرع إلى من فوقه في الهيكل. المقعد الشاغر يبقى شاغرًا. الرفض يُعاد للمنفّذ، وبعد ثلاثة رفض يحق له التصعيد."
        : "One chain per live branch — from that branch manager up the org line. A vacant seat stays vacant. A reject returns to the executor; after three rejects they may escalate."}
      maxWidth={1280}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {stations.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={countPill(0, ar)}>
              {ar ? `${stations.length} فروع` : `${stations.length} branches`}
            </span>
            <span style={countPill(openInScope, ar)}>
              {ar ? `${openInScope} مهام مصعّدة مفتوحة` : `${openInScope} open escalated tasks`}
            </span>
          </div>
        ) : null}
        {stations.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
            {ar ? "لا فروع في النطاق الحالي." : "No branches in the current scope."}
          </div>
        ) : (
          stations.map((station) => (
            <BranchEscalationCard
              key={station.id}
              station={station}
              data={data}
              tasks={tasks}
              ar={ar}
              opened={Boolean(opened[station.id])}
              onOpen={(stationId) => setOpened((prev) => ({ ...prev, [stationId]: true }))}
            />
          ))
        )}
      </div>
    </PlatformStampShell>
  );
}
