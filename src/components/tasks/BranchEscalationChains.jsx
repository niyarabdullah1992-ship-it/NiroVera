import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { branchEscalationCardLine, branchEscalationHasChain } from "@/lib/orgDerivations";
import { isCompanyRootStation } from "@/lib/stationTree";
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

export function BranchEscalationCard({ station, data, tasks, ar, opened, onOpen }) {
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


/** سلاسل التصعيد في الفروع — the branch ladders, folded under the manage list of المهام. */
export default function BranchEscalationChains({ ar = true, stations = [], data, tasks = [] }) {
  const [opened, setOpened] = useState({});
  const open = useMemo(() => tasks.length, [tasks]);
  return (
    <details data-branch-chains="1" className="nv-sched-fold" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, boxShadow: "var(--nv-paper)", overflow: "hidden" }}>
      <summary style={{ listStyle: "none", cursor: "pointer", padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
        <span className="nv-sched-fold-chevron" aria-hidden style={{ fontSize: 11, color: "var(--nv-muted)" }}>▸</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "سلاسل التصعيد في الفروع" : "Branch escalation chains"}</span>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "من مدير الفرع إلى من فوقه — المقعد الشاغر يبقى شاغراً حتى يُعيَّن." : "From the branch manager upward — a vacant seat stays vacant until filled."}</span>
        </span>
        <span style={{ marginInlineStart: "auto", ...countPill(open, ar) }}>{ar ? `${stations.length} فروع · ${open} مصعّدة` : `${stations.length} branches · ${open} escalated`}</span>
      </summary>
      <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {stations.map((station) => (
          <BranchEscalationCard
            key={station.id}
            station={station}
            data={data}
            tasks={tasks}
            ar={ar}
            opened={Boolean(opened[station.id])}
            onOpen={(id) => setOpened((prev) => ({ ...prev, [id]: true }))}
          />
        ))}
      </div>
    </details>
  );
}
