import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { canAccessPath } from "@/lib/navVisibility";
import { BAD, BORDER, CARD, MUTED, NAVY, WARN, navPill, pillRail } from "@/lib/platformStyles";

function n(value) {
  return Number(value) || 0;
}

function waitingOf(key, metrics) {
  if (key === "attendance") return n(metrics.scheduled) > 0 ? n(metrics.absentCount) : 0;
  if (key === "tasks") return n(metrics.openTasks ?? (n(metrics.tasks) - n(metrics.completedTasks)));
  if (key === "escalation") return n(metrics.escalated);
  if (key === "signing") return n(metrics.signing);
  if (key === "daily-report") return n(metrics.pendingReports);
  if (key === "leave") return n(metrics.pendingLeave);
  if (key === "safety") return n(metrics.hazards);
  if (key === "complaints") return n(metrics.complaints);
  if (key === "expenses") return n(metrics.expenses);
  return 0;
}

function toneOf(key, waiting) {
  if (waiting <= 0) return null;
  if (key === "tasks" || key === "signing" || key === "expenses" || key === "escalation") return waiting >= 1 ? "urgent" : "watch";
  return "watch";
}

function waitingCount(items) {
  return items.reduce((sum, item) => sum + (item.waiting || 0), 0);
}

function badgeStyle(items) {
  const urgent = items.some((item) => item.tone === "urgent");
  return urgent ? BAD : WARN;
}

/**
 * Command Center platform map — one card, four columns, attention filter.
 */
export default function OperationsModuleGrid({ metrics, lang, user, data, company }) {
  const ar = lang === "ar";
  const [view, setView] = useState("attention");
  const [inboxPending, setInboxPending] = useState(0);

  useEffect(() => {
    if (!company?.id || !user?.id) {
      setInboxPending(0);
      return undefined;
    }
    let active = true;
    base44.functions
      .invoke("multiSign", {
        action: "list",
        companyId: company.id,
        sessionToken: getCompanyToken(company.id),
        userId: user.id,
        email: (user.email || "").toLowerCase(),
      })
      .then((response) => {
        if (!active) return;
        const pending = (response.data?.requests || []).filter((row) => row.myStatus === "pending").length;
        setInboxPending(pending);
      })
      .catch(() => {
        if (active) setInboxPending(0);
      });
    return () => {
      active = false;
    };
  }, [company?.id, user?.id, user?.email]);

  const mapMetrics = { ...metrics, signing: inboxPending };

  const groups = [
    {
      key: "daily",
      eyebrow: "01",
      title: ar ? "دورة الإثبات" : "Proof cycle",
      description: ar
        ? "من الحضور إلى ختم العميل. كل قسم يغذي التالي — لا تسجيل بلا إثبات."
        : "From attendance to the client seal. Each section feeds the next.",
      items: [
        { key: "attendance", title: ar ? "الحضور" : "Attendance", note: ar ? `${metrics.checkedIn} حاضر · ${metrics.absentCount || 0} لم يسجّل` : `${metrics.checkedIn} present · ${metrics.absentCount || 0} not in`, value: n(metrics.absentCount) > 0 ? metrics.absentCount : `${metrics.attendanceRate}%`, to: "/app/attendance" },
        { key: "tasks", title: ar ? "المهام والعمليات" : "Operations", note: ar ? `${metrics.completedTasks} مكتملة من ${metrics.tasks}` : `${metrics.completedTasks} of ${metrics.tasks} completed`, value: n(metrics.openTasks) > 0 ? metrics.openTasks : metrics.tasks, to: "/app/tasks" },
        { key: "escalation", title: ar ? "التصعيد" : "Escalation", note: ar ? "صندوق مراجعة المهام" : "Task review inbox", value: n(metrics.escalated) > 0 ? metrics.escalated : "—", to: "/app/escalation" },
        { key: "work-proof", title: ar ? "إثبات العمل" : "Work Proof", note: ar ? "دليل ميداني وإفصاح العميل" : "Field evidence and client disclosure", value: "—", to: "/app/work-proof" },
        { key: "signing", title: ar ? "التوقيع الرقمي" : "Digital signing", note: ar ? "طلبات بانتظار التوقيع" : "Requests awaiting signature", value: n(mapMetrics.signing) > 0 ? mapMetrics.signing : "—", to: "/app/signing" },
        { key: "daily-report", title: ar ? "التقرير اليومي" : "Daily report", note: ar ? `${metrics.pendingReports} بانتظار المراجعة` : `${metrics.pendingReports} awaiting review`, value: n(metrics.pendingReports) > 0 ? metrics.pendingReports : (metrics.reports || "—"), to: "/app/daily-report" },
        { key: "chat", title: ar ? "المحادثات" : "Ops chat", note: ar ? "قنوات الفروع" : "Station channels", value: metrics.messages, to: "/app/chat" },
      ],
    },
    {
      key: "workforce",
      eyebrow: "02",
      title: ar ? "القوى العاملة" : "Workforce",
      description: ar ? "من يعمل وكيف يُدار. الورديات والإجازات تغذي الحضور ثم المسير." : "Who works and how they are managed.",
      items: [
        { key: "shifts", title: ar ? "الورديات" : "Shifts", note: ar ? "جدول الفرع الشهري" : "Monthly station matrix", value: metrics.stations, to: "/app/shifts" },
        { key: "leave", title: ar ? "الإجازات" : "Leave", note: ar ? "طلبات بانتظار القرار" : "Awaiting a decision", value: metrics.pendingLeave, to: "/app/leave" },
        { key: "hr", title: ar ? "الموارد البشرية" : "HR", note: ar ? `${metrics.activeMembers} نشط اليوم` : `${metrics.activeMembers} active today`, value: metrics.employees, to: "/app/hr" },
        { key: "performance", title: ar ? "الأداء" : "Performance", note: ar ? "من بيانات فعلية" : "From actual data", value: `${metrics.performance}%`, to: "/app/performance" },
        { key: "org", title: ar ? "الهيكل" : "Org", note: ar ? "صلاحيات وتصعيد" : "Permissions and escalation", value: metrics.stations, to: "/app/org" },
      ],
    },
    {
      key: "compliance",
      eyebrow: "03",
      title: ar ? "الالتزام والرعاية" : "Care & compliance",
      description: ar ? "سلامة الموقع وصوت الموظف — ليست تصعيد المهمة." : "Site care and the people channel — not task escalation.",
      items: [
        { key: "safety", title: ar ? "السلامة HSE" : "Safety HSE", note: ar ? `${metrics.hazards} مخاطر مفتوحة` : `${metrics.hazards} open hazards`, value: metrics.hazards || metrics.safety, to: "/app/safety" },
        { key: "complaints", title: ar ? "صوت الموظف" : "Employee Voice", note: ar ? "بلاغات مفتوحة الآن" : "Open now", value: metrics.complaints, to: "/app/complaints" },
      ],
    },
    {
      key: "money",
      eyebrow: "04",
      title: ar ? "المال والأصول" : "Money & assets",
      description: ar ? "البصمة تغذي المسير. المصروف والمخزون والأصول والعهد في مسار واحد." : "Attendance feeds payroll. Expenses, stock, and assets & custody each have a path.",
      items: [
        { key: "payroll", title: ar ? "الرواتب" : "Payroll", note: ar ? "يغذيه الحضور المعتمد" : "Fed by approved attendance", value: metrics.payroll, to: "/app/payroll" },
        { key: "expenses", title: ar ? "المصروفات" : "Expenses", note: ar ? "مطالبات بانتظار الاعتماد" : "Claims awaiting approval", value: n(metrics.expenses) > 0 ? metrics.expenses : "—", to: "/app/expenses" },
        { key: "assets", title: ar ? "الأصول / العهد" : "Assets / Custody", note: ar ? "سجل وتسليم" : "Register and handover", value: metrics.assets ?? "—", to: "/app/assets" },
        { key: "inventory", title: ar ? "المخزون" : "Inventory", note: ar ? "مواد ووحدات" : "Stock and units", value: metrics.inventory, to: "/app/inventory" },
      ],
    },
    {
      key: "admin",
      eyebrow: "05",
      title: ar ? "المؤسسة" : "Institution",
      description: ar ? "ملفات ومساعد وإعدادات — ذاكرة المنشأة في مكان واحد." : "Files, assistant, and settings — the institution's memory.",
      items: [
        { key: "files", title: ar ? "الملفات" : "Files", note: ar ? "مقيّدة بالصلاحية" : "Permission-scoped", value: metrics.files, to: "/app/files" },
        { key: "assistant", title: ar ? "المساعد" : "Assistant", note: ar ? "اسأل بيانات منشأتك" : "Ask company data", value: ar ? "جاهز" : "Ready", to: "/app/assistant" },
        { key: "settings", title: ar ? "الإعدادات" : "Settings", note: ar ? "نطاق وصلاحيات" : "Scope and permissions", value: "—", to: "/app/settings" },
      ],
    },
  ]
    .map((group) => {
      const items = group.items
        .filter((item) => canAccessPath(item.to, user, data, company))
        .map((item) => {
          const waiting = waitingOf(item.key, mapMetrics);
          return { ...item, waiting, tone: toneOf(item.key, waiting) };
        });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  const columns = groups.filter((group) => group.key !== "admin");
  const institution = groups.find((group) => group.key === "admin");

  const viewPill = (id) => navPill(view === id);

  const renderItem = (item) => {
    const urgent = item.tone === "urgent";
    const watch = item.tone === "watch";
    return (
      <Link
        key={item.to}
        to={item.to}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "11px 0",
          borderBottom: `1px solid ${BORDER}`,
          textDecoration: "none",
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {(urgent || watch) && (
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: urgent ? "#DC2626" : "#F59E0B",
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{item.title}</span>
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: MUTED, lineHeight: 1.45 }}>{item.note}</div>
        </div>
        <span
          style={{
            fontFamily: "'IBM Plex Sans',sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: urgent ? "#DC2626" : NAVY,
            flexShrink: 0,
            lineHeight: 1.1,
          }}
        >
          {item.value}
        </span>
      </Link>
    );
  };

  const renderColumn = (group, footer) => {
    const visible = view === "attention" ? group.items.filter((item) => item.tone) : group.items;
    const waiting = waitingCount(group.items);
    if (view === "attention" && visible.length === 0 && !footer) return null;
    return (
      <section key={group.key} style={{ minWidth: 0, padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>
              <span style={{ color: MUTED, marginInlineEnd: 6 }}>{group.eyebrow}</span>
              {group.title}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{group.description}</p>
          </div>
          {waiting > 0 ? (
            <span style={{ ...badgeStyle(group.items), flexShrink: 0 }}>
              {ar ? `${waiting} بانتظارك` : `${waiting} waiting`}
            </span>
          ) : null}
        </div>
        <div>
          {visible.map(renderItem)}
          {view === "attention" && visible.length === 0 && footer}
          {view === "all" && footer}
        </div>
      </section>
    );
  };

  const institutionFooter = institution ? (
    <div style={{ paddingTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>
        <span style={{ color: MUTED, marginInlineEnd: 6 }}>{institution.eyebrow}</span>
        {institution.title}
      </div>
      {waitingCount(institution.items) === 0 ? (
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
          <Check style={{ width: 14, height: 14, color: "#94A3B8" }} strokeWidth={1.8} />
          {ar ? "لا شيء معلق" : "Nothing pending"}
        </p>
      ) : (
        institution.items.filter((item) => view === "all" || item.tone).map(renderItem)
      )}
      {waitingCount(institution.items) === 0 && view === "all" ? (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{institution.description}</p>
      ) : null}
    </div>
  ) : null;

  return (
    <section
      dir={ar ? "rtl" : "ltr"}
      style={{
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        background: CARD,
        padding: "18px 8px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 16px 16px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: NAVY }}>
            {ar ? "خريطة المنصة" : "Platform map"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
            {ar
              ? "من الحضور إلى ختم العميل. كل قسم يغذي التالي — لا تسجيل بلا إثبات."
              : "From attendance to the client seal. Each section feeds the next — no logging without proof."}
          </p>
        </div>
        <div style={pillRail}>
          <button type="button" onClick={() => setView("attention")} style={viewPill("attention")}>
            {ar ? "يحتاج انتباهك" : "Needs attention"}
          </button>
          <button type="button" onClick={() => setView("all")} style={viewPill("all")}>
            {ar ? "كل الأقسام" : "All sections"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 0,
        }}
      >
        {columns.map((group, index) => (
          <div
            key={group.key}
            style={{
              borderInlineStart: index === 0 ? "none" : `1px solid ${BORDER}`,
            }}
          >
            {renderColumn(group, group.key === "daily" ? institutionFooter : null)}
          </div>
        ))}
      </div>
    </section>
  );
}
