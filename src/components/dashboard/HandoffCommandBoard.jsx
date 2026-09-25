import React from "react";
import { Link } from "react-router-dom";
import {
  BORDER, CARD, INK, MUTED, NAVY, SURFACE, bar, dot,
} from "@/lib/platformStyles";
import { LEAVE_STYLE } from "@/lib/shiftWeek";
import { setStationScope } from "@/lib/stationScopeStore";
import useStationScope from "@/hooks/useStationScope";

const MONO = "'IBM Plex Mono', monospace";
const LINE = "#E4E9E6";
const HAIR = "#EEF1EF";
const ROW = "#F4F7F5";
const OK = "#3C7D50";
const WARN = "#C8A45A";
const BAD = "#9B2335";
const HEAD = { fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#111418" };

function inferAlertLevel(to) {
  if (!to) return "warn";
  if (String(to).includes("safety")) return "critical";
  if (String(to).includes("leave") || String(to).includes("requests")) return "ok";
  if (String(to).includes("task") || String(to).includes("escalation")) return "info";
  return "warn";
}

function alertDot(level) {
  if (level === "critical" || level === "bad") return BAD;
  if (level === "ok") return OK;
  if (level === "info") return "#0B3D27";
  return WARN;
}

function leaveTag() {
  return {
    display: "inline-block",
    padding: "2px 9px",
    fontSize: 10,
    fontWeight: 600,
    background: LEAVE_STYLE.bg,
    color: LEAVE_STYLE.fg,
    border: `1px solid ${LEAVE_STYLE.color}33`,
    whiteSpace: "nowrap",
    borderRadius: 999,
  };
}

function kpiAccent(key, value) {
  if (key === "attendance") {
    if (value < 60) return BAD;
    if (value < 80) return WARN;
    return OK;
  }
  if (key === "decisions") return value > 0 ? BAD : "#111418";
  if (key === "readiness") {
    if (value < 40) return BAD;
    if (value < 70) return WARN;
    return OK;
  }
  return "#111418";
}

export default function HandoffCommandBoard({
  lang = "ar",
  greetName = "",
  toolbar = null,
  readinessScore = 0,
  readinessDelta = null,
  factors = [],
  employeesCount = 0,
  employeesDelta = null,
  attendanceRate = 0,
  pendingLeave = 0,
  leaveQueue = [],
  alerts = [],
  stations = [],
  openHazards = 0,
  criticalHazards = 0,
  presentCount = 0,
  lateCount = 0,
  leaveCount = 0,
  absentCount = 0,
  daysClear = null,
}) {
  const ar = lang === "ar";
  const scope = useStationScope();
  const score = Math.max(0, Math.min(100, Math.round(Number(readinessScore) || 0)));
  const factorBars = (factors.length ? factors : [
    { label: ar ? "الحضور" : "Attendance", pct: attendanceRate },
    { label: ar ? "مهام" : "Tasks", pct: 100 },
    { label: ar ? "سلامة" : "Safety", pct: Math.max(0, 100 - openHazards * 10) },
    { label: ar ? "اعتمادات" : "Approvals", pct: pendingLeave ? Math.max(0, 100 - pendingLeave * 8) : 100 },
  ]).slice(0, 4);

  const queue = leaveQueue.slice(0, 6).map((r) => ({
    ...r,
    to: r.to || "/app/requests/manage",
    action: r.action || (ar ? "راجع" : "Review"),
    age: r.date || r.age || "—",
    title: r.title || r.name || "—",
    meta: r.meta || [r.type, r.date || r.age].filter(Boolean).join(" · "),
    status: r.status || (ar ? "بانتظار المدير" : "Awaiting manager"),
    level: r.level || "warn",
  }));

  const pendingDecisions = Number(pendingLeave || 0);
  const alertLines = (alerts.length ? alerts : []).slice(0, 4).map((a) => {
    if (typeof a === "string") return { text: a, to: null, level: "warn" };
    return {
      text: a.title || a.message || a.text || String(a),
      to: a.to || a.href || null,
      level: a.level || inferAlertLevel(a.to),
    };
  });

  const present = presentCount || Math.round((attendanceRate / 100) * Math.max(1, employeesCount));
  const late = lateCount || 0;
  const onLeave = leaveCount || 0;
  const absent = absentCount || 0;
  const bandTotal = Math.max(1, present + late + onLeave + absent);
  const shiftBands = [
    { label: ar ? "حاضر" : "Present", count: present, color: OK, flex: present },
    { label: ar ? "متأخر" : "Late", count: late, color: WARN, flex: Math.max(late, 0) },
    { label: ar ? "إجازة" : "On leave", count: onLeave, color: LEAVE_STYLE.color, flex: Math.max(onLeave, 0) },
    { label: ar ? "غائب" : "Absent", count: absent, color: BAD, flex: Math.max(absent, 0) },
  ];

  const hseRows = [
    { count: criticalHazards, label: ar ? "مخاطر حرجة مفتوحة" : "Critical hazards open", tone: BAD },
    { count: Math.max(0, openHazards - criticalHazards), label: ar ? "ملاحظات سلامة بانتظار الإغلاق" : "Observations pending closure", tone: WARN },
  ];

  const decisionsCountLabel = queue.length === 0
    ? (ar ? "لا شيء معلّق" : "Nothing pending")
    : (ar ? (queue.length === 1 ? "بند واحد" : queue.length === 2 ? "بندان" : `${queue.length} بنود`) : `${queue.length} items`);

  const kpis = [
    {
      key: "scheduled",
      to: "/app/attendance",
      label: ar ? "المجدولون اليوم" : "Scheduled today",
      value: employeesCount,
      hint: employeesDelta
        ? (ar ? `${employeesDelta > 0 ? "+" : ""}${employeesDelta} تعيين هذا الشهر · نفس رقم الحضور` : `${employeesDelta > 0 ? "+" : ""}${employeesDelta} hired this month · same figure as Attendance`)
        : (ar ? "ضمن نطاق العرض الحالي · يغذّي المسير" : "in the current scope · feeds payroll"),
      accent: kpiAccent("scheduled", employeesCount),
    },
    {
      key: "attendance",
      to: "/app/attendance",
      label: ar ? "نسبة الحضور" : "Attendance rate",
      value: `${Math.round(Number(attendanceRate) || 0)}%`,
      hint: ar ? `${present} حاضرون الآن` : `${present} present now`,
      accent: kpiAccent("attendance", Number(attendanceRate) || 0),
    },
    {
      key: "decisions",
      to: "/app/requests/manage",
      label: ar ? "بانتظار قرارك" : "Awaiting your decision",
      value: pendingDecisions,
      hint: ar ? `${pendingLeave} إجازة بانتظار القرار` : `${pendingLeave} leave awaiting a decision`,
      accent: kpiAccent("decisions", pendingDecisions),
    },
    {
      key: "readiness",
      to: null,
      label: ar ? "مؤشر الجاهزية" : "Readiness index",
      value: score,
      hint: ar ? "حضور · مهام · سلامة · اعتمادات" : "attendance · tasks · safety · approvals",
      accent: kpiAccent("readiness", score),
      suffix: "/100",
    },
  ];

  const paperHead = {
    padding: "16px 20px",
    borderBottom: `1px solid ${HAIR}`,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toolbar ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{toolbar}</div>
      ) : null}

      <div className="nv-disc-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {kpis.map((kpi) => {
          const body = (
            <>
              <span style={{ fontSize: 12, color: MUTED }}>{kpi.label}</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 30, fontWeight: 500, color: kpi.accent, lineHeight: 1.05 }}>
                  {kpi.value}
                </span>
                {kpi.suffix ? <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>{kpi.suffix}</span> : null}
              </span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{kpi.hint}</span>
            </>
          );
          const face = {
            background: CARD,
            border: `1px solid ${LINE}`,
            borderTop: `3px solid ${kpi.accent}`,
            borderRadius: 14,
            boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
            textDecoration: "none",
            color: "inherit",
          };
          return kpi.to ? (
            <Link key={kpi.key} to={kpi.to} style={face}>{body}</Link>
          ) : (
            <div key={kpi.key} style={face}>{body}</div>
          );
        })}
      </div>

      <div className="nv-handoff-top nv-emp-summary">
        <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
          <div style={{ ...paperHead, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={HEAD}>{ar ? "ما يحتاج قرارك اليوم" : "Needs your decision today"}</span>
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
                {ar
                  ? <>مرتّبة بأثرها على التشغيل — الإجازة تغذي <Link to="/app/shifts" style={{ color: "inherit", fontWeight: 600 }}>الجدول</Link> و<Link to="/app/attendance" style={{ color: "inherit", fontWeight: 600 }}>الحضور</Link>.</>
                  : <>Ranked by operational impact — leave feeds the <Link to="/app/shifts" style={{ color: "inherit", fontWeight: 600 }}>rota</Link> and <Link to="/app/attendance" style={{ color: "inherit", fontWeight: 600 }}>attendance</Link>.</>}
              </span>
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: queue.length ? LEAVE_STYLE.fg : MUTED,
              background: queue.length ? LEAVE_STYLE.bg : SURFACE,
              border: `1px solid ${queue.length ? `${LEAVE_STYLE.color}33` : BORDER}`,
              padding: "3px 9px",
              whiteSpace: "nowrap",
              borderRadius: 999,
            }}>
              {decisionsCountLabel}
            </span>
          </div>
          {queue.length === 0 ? (
            <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: MUTED }}>
              {ar ? "لا بنود تحتاج قرارك اليوم" : "Nothing needs your decision today"}
            </div>
          ) : (
            queue.map((r) => (
              <div
                key={r.id || `${r.title}-${r.age}`}
                style={{
                  padding: "13px 20px",
                  borderBottom: `1px solid ${ROW}`,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, lineHeight: 1.5 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.7 }}>{r.meta}</div>
                </div>
                <span style={leaveTag()}>{r.status}</span>
                <Link
                  to={r.to}
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
                  {r.action}
                </Link>
              </div>
            ))
          )}
        </section>

        <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
          <div style={paperHead}>
            <span style={HEAD}>{ar ? "تنبيهات استباقية" : "Proactive alerts"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
              {ar ? "كل تنبيه يفتح القسم الذي يصلحه." : "Each alert opens the section that fixes it."}
            </span>
          </div>
          {alertLines.length === 0 ? (
            <div style={{ padding: "18px 20px", fontSize: 12, color: MUTED }}>
              {ar ? "لا تنبيهات الآن" : "No alerts right now"}
            </div>
          ) : (
            alertLines.map((line, i) => {
              const style = {
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "13px 20px",
                borderBottom: `1px solid ${ROW}`,
                cursor: line.to ? "pointer" : "default",
                fontFamily: "inherit",
                fontSize: 13,
                color: INK,
                textAlign: "start",
                width: "100%",
                textDecoration: "none",
                lineHeight: 1.55,
                background: "transparent",
                boxSizing: "border-box",
              };
              const body = (
                <>
                  <span style={{ ...dot(alertDot(line.level)), marginTop: 6 }} />
                  <span style={{ flex: 1 }}>{line.text}</span>
                </>
              );
              return line.to ? (
                <Link key={i} to={line.to} style={style}>{body}</Link>
              ) : (
                <div key={i} style={style}>{body}</div>
              );
            })
          )}

          <div style={{ ...paperHead, borderBottom: "none", borderTop: `1px solid ${HAIR}` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={HEAD}>{ar ? "مكونات الجاهزية" : "Readiness components"}</span>
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: "#111418", lineHeight: 1, unicodeBidi: "isolate" }}>
                  {score}
                  <span style={{ fontSize: 12, fontWeight: 500, color: MUTED }}> /100</span>
                </span>
              </div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
                {ar ? "نفس عوامل المؤشر أعلاه — مشتقّة لا تقدير." : "Same factors as the index — derived, not estimated."}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {factorBars.map((f) => {
                const pct = Math.max(0, Math.min(100, Number(f.pct) || 0));
                const barColor = pct < 70 ? WARN : OK;
                return (
                  <div key={f.label} style={{ display: "grid", gridTemplateColumns: "minmax(72px,auto) minmax(0,1fr) 36px", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{f.label}</span>
                    <span style={{ height: 10, background: SURFACE, overflow: "hidden", borderRadius: 10 }}>
                      <span style={bar(pct, barColor)} />
                    </span>
                    <span dir="ltr" style={{ textAlign: "end", fontSize: 12, fontFamily: MONO, color: INK }}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
        <div style={{ ...paperHead, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={HEAD}>{ar ? "الفروع" : "Stations"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
              {ar
                ? "اضغط فرعاً لتضييق اللوحة — النطاق نفسه في الحضور والمسير. إدارة = فرع واحد."
                : "Pick a branch to narrow the board — the same scope as attendance and payroll. Manage = one branch."}
            </span>
          </div>
          {scope !== "all" ? (
            <button
              type="button"
              onClick={() => setStationScope("all")}
              style={{
                marginInlineStart: "auto",
                border: `1px solid ${BORDER}`,
                background: CARD,
                padding: "8px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                color: NAVY,
                borderRadius: 10,
              }}
            >
              {ar ? "كل الفروع" : "All stations"}
            </button>
          ) : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10, padding: 12 }}>
          {(stations || []).map((s) => {
            const open = Number(s.open ?? 0);
            const crew = Number(s.crew ?? 0);
            const tone = open >= 8 ? BAD : open >= 4 ? WARN : OK;
            const active = String(scope) === String(s.id);
            return (
              <button
                key={s.id || s.name}
                type="button"
                onClick={() => setStationScope(s.id ? s.id : "all")}
                aria-pressed={active}
                title={ar ? "اجعل هذا الفرع نطاق الصفحة" : "Scope this page to this station"}
                style={{
                  background: active ? "#F2F7F4" : CARD,
                  border: `1px solid ${active ? "#C5DBCD" : LINE}`,
                  borderTop: `3px solid ${tone}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  color: "inherit",
                  display: "block",
                  width: "100%",
                  textAlign: "start",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={dot(tone)} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}
                  </span>
                  {s.code ? (
                    <span dir="ltr" style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{s.code}</span>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
                    <span dir="ltr" style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, lineHeight: 1, color: "#111418", unicodeBidi: "isolate" }}>{crew}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{ar ? "في الوردية" : "on shift"}</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
                    <span dir="ltr" style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, lineHeight: 1, color: tone, unicodeBidi: "isolate" }}>{open}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{ar ? "بند مفتوح" : "open"}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="nv-emp-summary" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
        <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
          <div style={paperHead}>
            <span style={HEAD}>{ar ? "حضور اليوم" : "Today's attendance"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
              {ar
                ? <>{employeesCount} متوقعاً اليوم · نفس رقم <Link to="/app/attendance" style={{ color: "inherit", fontWeight: 600 }}>شاشة الحضور</Link> · يغذّي <Link to="/app/payroll" style={{ color: "inherit", fontWeight: 600 }}>المسير</Link></>
                : <>{employeesCount} expected today · same figure as <Link to="/app/attendance" style={{ color: "inherit", fontWeight: 600 }}>Attendance</Link> · feeds <Link to="/app/payroll" style={{ color: "inherit", fontWeight: 600 }}>payroll</Link></>}
            </span>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", height: 10, overflow: "hidden", gap: 2 }}>
              {shiftBands.map((b) => (
                <span
                  key={b.label}
                  style={{
                    display: "block",
                    flex: Math.max(0.5, (b.flex / bandTotal) * 100),
                    background: b.color,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {shiftBands.map((b) => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={dot(b.color)} />
                  <span style={{ fontSize: 12, color: MUTED }}>{b.label}</span>
                  <span dir="ltr" style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO }}>{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
          <div style={{ ...paperHead, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={HEAD}>{ar ? "السلامة" : "Safety"}</span>
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
                {ar
                  ? <>بنود مفتوحة بانتظار الإغلاق — داخل <Link to="/app/safety" style={{ color: "inherit", fontWeight: 600 }}>سلسلة الثقة</Link>.</>
                  : <>Open items awaiting closure — inside the <Link to="/app/safety" style={{ color: "inherit", fontWeight: 600 }}>trust chain</Link>.</>}
              </span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
              <span dir="ltr" style={{ fontFamily: MONO, fontSize: 20, fontWeight: 500, lineHeight: 1, color: openHazards ? BAD : OK, unicodeBidi: "isolate" }}>
                {openHazards}
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>
                {ar ? "بنداً مفتوحاً" : "open items"}
              </span>
            </span>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {hseRows.map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: r.tone, lineHeight: 1 }}>{r.count}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: INK }}>{r.label}</span>
              </div>
            ))}
            {daysClear != null ? (
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                {ar ? `${daysClear} يوماً بلا حادث اليوم` : `${daysClear} incident-free days today`}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
