import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import PresenceStatusPicker from "@/components/employees/PresenceStatusPicker";
import QuickCheckInCard from "@/components/attendance/QuickCheckInCard";
import EmployeeTour from "@/components/onboarding/EmployeeTour";
import { BORDER, CARD, MUTED, NAVY, SURFACE, bar } from "@/lib/platformStyles";

const MONO = "'IBM Plex Mono', monospace";
const LINE = "var(--nv-line)";
const HAIR = "var(--nv-line)";
const ROW = "var(--nv-line2)";
const OK = "var(--nv-ok-fill)";
const WARN = "var(--nv-warn-fill)";
const BAD = "var(--nv-bad-fill)";
const HEAD = { fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" };

export default function EmployeeDashboard({ user, company, data }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const effectiveStationId = user.stationId || data?.stations?.[0]?.id || null;
  const station = data?.stations?.find((s) => s.id === effectiveStationId) || null;
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!company?.id) {
      setLoading(false);
      return undefined;
    }
    base44.functions
      .invoke("operations", {
        action: "list",
        companyId: company.id,
        sessionToken: getCompanyToken(company.id),
        lang: ar ? "ar" : "en",
        scope: effectiveStationId || null,
      })
      .then((res) => {
        if (!active) return;
        const body = res?.data || res || {};
        const all = Array.isArray(body.tasks) ? body.tasks : [];
        const mine = all.filter((tg) => {
          const owner = tg.ownerId || tg.employee_id;
          const members = tg.memberIds || tg.assignees || [];
          if (owner === user.id || owner === user.employeeId) return true;
          if (Array.isArray(members) && (members.includes(user.id) || members.includes(user.employeeId))) return true;
          if (tg.assignMode === "all" && (tg.stationId === effectiveStationId || tg.assignment_id === effectiveStationId)) return true;
          return false;
        });
        setTasks(mine);
        setCounts(body.counts || null);
      })
      .catch(() => {
        if (!active) return;
        setTasks([]);
        setCounts(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user.id, user.employeeId, company?.id, effectiveStationId, ar]);

  const open = tasks.filter((tg) => tg.status !== "completed");
  const awaiting = tasks.filter((tg) => tg.status === "awaiting_approval");
  const overdue = open.filter((tg) => tg.dueAt && new Date(tg.dueAt) < new Date() && tg.status !== "awaiting_approval");
  const donePct = tasks.length ? Math.round(((tasks.length - open.length) / tasks.length) * 100) : 100;
  const readiness = Math.max(20, Math.min(100, Math.round((donePct * 0.55) + ((overdue.length ? 0 : 35)) + (awaiting.length ? 10 : 20))));
  const points = user.points || counts?.pointsAwarded || 0;

  const factors = [
    { label: ar ? "مهامي" : "My tasks", pct: donePct },
    { label: ar ? "في الموعد" : "On time", pct: open.length ? Math.max(15, 100 - overdue.length * 25) : 100 },
    { label: ar ? "إثبات" : "Proof", pct: awaiting.length ? 55 : 90 },
    { label: ar ? "نقاط" : "Points", pct: Math.min(100, points ? 40 + Math.min(60, points) : 35) },
  ];

  const queue = open.slice(0, 6).map((tg) => ({
    id: tg.id,
    name: tg.title,
    type: tg.ref || tg.workKind || "task",
    status: tg.status === "awaiting_approval"
      ? (ar ? "بانتظار الاعتماد" : "Awaiting approval")
      : (overdue.some((o) => o.id === tg.id) ? (ar ? "متأخرة" : "Overdue") : (ar ? "نشطة" : "Active")),
    tone: tg.status === "awaiting_approval" ? WARN : (overdue.some((o) => o.id === tg.id) ? BAD : OK),
  }));

  const alerts = [
    ...(overdue.length ? [{ text: ar ? `${overdue.length} مهمة متأخرة — سجّل إثباتاً أو اطلب تمديداً.` : `${overdue.length} overdue tasks — log proof or request an extension.`, to: "/app/tasks" }] : []),
    ...(awaiting.length ? [{ text: ar ? `${awaiting.length} إنجاز بانتظار اعتماد المشرف.` : `${awaiting.length} completions awaiting supervisor approval.`, to: "/app/tasks" }] : []),
    { text: ar ? "سجّل حضور اليوم قبل الإنجاز الميداني." : "Check in today before logging on-site work.", to: "/app/attendance" },
  ].slice(0, 4);

  const kpis = [
    { key: "open", label: ar ? "مهام مفتوحة" : "Open tasks", value: open.length, hint: ar ? "للتنفيذ" : "To execute", to: "/app/tasks", accent: open.length ? "var(--nv-ink)" : OK },
    { key: "await", label: ar ? "بانتظار الاعتماد" : "Awaiting approval", value: awaiting.length, hint: ar ? "بعد الإثبات" : "After proof", to: "/app/tasks", accent: awaiting.length ? WARN : "var(--nv-ink)" },
    { key: "late", label: ar ? "متأخرة" : "Overdue", value: overdue.length, hint: ar ? "تحتاج متابعة" : "Need follow-up", to: "/app/tasks", accent: overdue.length ? BAD : "var(--nv-ink)" },
    { key: "points", label: ar ? "نقاطي" : "My points", value: points, hint: ar ? "تُمنح عند الاعتماد فقط" : "Awarded on approval only", to: "/app/performance?view=self", accent: "var(--nv-ink)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <EmployeeTour user={user} company={company} />
      <QuickCheckInCard currentUser={user} company={company} />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
          {station
            ? (ar
              ? <>{station.name} · ملفي = محطة العمل · <Link to="/app/attendance" style={{ color: "inherit", fontWeight: 600 }}>حضورك</Link> ثم <Link to="/app/tasks" style={{ color: "inherit", fontWeight: 600 }}>مهامك</Link> في سلسلة الإثبات</>
              : <>{station.name} · My file = work station · your <Link to="/app/attendance" style={{ color: "inherit", fontWeight: 600 }}>attendance</Link> then <Link to="/app/tasks" style={{ color: "inherit", fontWeight: 600 }}>tasks</Link> in the proof cycle</>)
            : (ar
              ? <>حضورك ثم مهامك في سلسلة الإثبات</>
              : <>Your attendance then your tasks in the proof cycle</>)}
        </p>
        <PresenceStatusPicker user={user} />
      </div>

      <div className="nv-disc-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {kpis.map((k) => (
          <Link
            key={k.key}
            to={k.to}
            className="nv-doc"
            style={{
              background: CARD,
              border: `1px solid ${LINE}`,
              borderTop: `3px solid ${k.accent}`,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span style={{ fontSize: 12, color: MUTED }}>{k.label}</span>
            <span dir="ltr" style={{ fontFamily: MONO, fontSize: 30, fontWeight: 500, color: k.accent, lineHeight: 1.05 }}>{k.value}</span>
            <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{k.hint}</span>
          </Link>
        ))}
      </div>

      <div className="nv-emp-summary" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
        <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIR}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={HEAD}>{ar ? "مهامي النشطة" : "My active tasks"}</span>
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
                {ar ? "كل إنجاز يحتاج إثباتاً قبل النقاط." : "Every completion needs proof before points."}
              </span>
            </div>
            <Link
              to="/app/tasks"
              style={{
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                padding: "8px 14px",
                border: "none",
                background: OK,
                color: "#fff",
                textDecoration: "none",
                whiteSpace: "nowrap",
                borderRadius: 8,
              }}
            >
              {ar ? "العمليات" : "Operations"}
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 36, background: SURFACE }} />)}
            </div>
          ) : queue.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: MUTED, textAlign: "center", padding: "26px 20px" }}>
              {ar ? "لا مهام مفتوحة — سلسلة إثباتك نظيفة اليوم." : "No open tasks — your proof chain is clear today."}
            </p>
          ) : (
            queue.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: `1px solid ${ROW}` }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.tone, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 700, color: NAVY }}>{r.name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: r.tone, background: SURFACE, border: `1px solid ${BORDER}`, padding: "2px 9px", whiteSpace: "nowrap", borderRadius: 999 }}>{r.status}</span>
              </div>
            ))
          )}
        </section>

        <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIR}` }}>
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={HEAD}>{ar ? "جاهزية اليوم" : "Day readiness"}</span>
              <span dir="ltr" style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: "var(--nv-ink)", unicodeBidi: "isolate" }}>
                {readiness}
                <span style={{ fontSize: 12, fontWeight: 500, color: MUTED }}> /100</span>
              </span>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.75 }}>
              {ar ? `${open.length} مفتوحة · ${points} نقطة معتمدة` : `${open.length} open · ${points} awarded points`}
            </div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {factors.map((f) => (
              <div key={f.label} style={{ display: "grid", gridTemplateColumns: "72px 1fr 36px", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: MUTED }}>{f.label}</span>
                <div style={{ height: 10, overflow: "hidden", background: SURFACE, borderRadius: 10 }}>
                  <span style={bar(f.pct, OK)} />
                </div>
                <span dir="ltr" style={{ fontSize: 12, fontFamily: MONO, color: NAVY, textAlign: "end" }}>{f.pct}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIR}` }}>
          <div style={HEAD}>{ar ? "تنبيهات اليوم" : "Today's alerts"}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.75 }}>{ar ? "كل تنبيه يفتح القسم الذي يصلحه." : "Each alert opens the section that fixes it."}</div>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
          {alerts.map((line, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 20px", borderBottom: `1px solid ${ROW}` }}>
              <span style={{ width: 7, height: 7, marginTop: 6, borderRadius: "50%", background: WARN, flexShrink: 0 }} />
              <Link to={line.to} style={{ fontSize: 13, color: NAVY, textDecoration: "none", lineHeight: 1.55 }}>{line.text}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
