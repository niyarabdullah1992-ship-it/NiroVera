import React from "react";
import { Link } from "react-router-dom";
import { canAccessPath } from "@/lib/navVisibility";
import { formatUiNumber } from "@/lib/dateFormat";
import { ACCENT, BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";
import useCommandSigningSnapshot from "@/hooks/useCommandSigningSnapshot";
import { pendingWorkProofBadgeCount } from "@/lib/suiteBadges";

const MONO = "'IBM Plex Mono', monospace";
const LINE = "var(--nv-line, #DFE3EA)";
const HAIR = "#EEF0F4";
const ROW = "#F7F8FA";

function n(value) {
  return Number(value) || 0;
}

function waitingOf(key, metrics) {
  if (key === "attendance") return n(metrics.scheduled) > 0 ? n(metrics.absentCount) : 0;
  if (key === "tasks") return n(metrics.openTasks ?? (n(metrics.tasks) - n(metrics.completedTasks)));
  if (key === "review" || key === "escalation") return n(metrics.escalated);
  if (key === "signing" || key === "signing-mine") return n(metrics.signing);
  if (key === "work-proof") return n(metrics.workProofAwaiting);
  if (key === "signing-status") return n(metrics.signingOpen);
  if (key === "signing-verify") return n(metrics.signingCooling);
  if (key === "signing-reopen") return n(metrics.signingReopen);
  if (key === "leave") return n(metrics.pendingLeave);
  if (key === "safety") return n(metrics.hazards);
  if (key === "complaints") return n(metrics.complaints);
  if (key === "expenses") return n(metrics.expenses);
  return 0;
}

function toneOf(key, waiting) {
  if (waiting <= 0) return null;
  if (key === "tasks" || key === "signing" || key === "signing-mine" || key === "review" || key === "escalation" || key === "expenses") return "urgent";
  return "watch";
}

function tabBtn(on) {
  return {
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: on ? 700 : 400,
    padding: "9px 16px",
    border: `1px solid ${on ? NAVY_FILL : BORDER}`,
    background: on ? NAVY_FILL : CARD,
    color: on ? "#fff" : MUTED,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    borderRadius: 10,
  };
}

/**
 * Proof-cycle map — a connected chain first, then quieter destinations.
 */
export default function OperationsModuleGrid({ metrics, lang, user, data, company }) {
  const ar = lang === "ar";
  const [view, setView] = React.useState("attention");
  const signing = useCommandSigningSnapshot(company, user, data);
  // Work proof carries its own figure — the signing snapshot says nothing about it.
  const proofsAwaiting = pendingWorkProofBadgeCount(data?.workProofs || [], user);
  const mapMetrics = {
    ...metrics,
    signing: signing.mine,
    signingOpen: signing.open,
    signingCooling: signing.cooling,
    signingReopen: signing.reopen,
    workProofAwaiting: proofsAwaiting,
  };
  const dash = (value) => (n(value) > 0 ? formatUiNumber(value) : "—");

  const cycle = [
    {
      key: "attendance",
      step: "01",
      title: ar ? "حضور" : "Attend",
      note: ar
        ? `${metrics.checkedIn} حاضر · ${metrics.absentCount || 0} لم يسجّل — يغذّي المسير`
        : `${metrics.checkedIn} present · ${metrics.absentCount || 0} not in — feeds payroll`,
      value: n(metrics.absentCount) > 0 ? metrics.absentCount : `${metrics.attendanceRate}%`,
      to: "/app/attendance",
    },
    {
      key: "tasks",
      step: "02",
      title: ar ? "مهمة" : "Task",
      note: ar ? `${metrics.completedTasks} مكتملة من ${metrics.tasks}` : `${metrics.completedTasks} of ${metrics.tasks} completed`,
      value: n(metrics.openTasks) > 0 ? metrics.openTasks : metrics.tasks,
      to: "/app/tasks",
    },
    {
      key: "review",
      step: "03",
      title: ar ? "مراجعة" : "Review",
      note: ar ? "اعتماد أو رفض بسبب مكتوب" : "Approve or refuse with a written reason",
      value: dash(metrics.escalated),
      to: "/app/escalation",
    },
    {
      key: "escalation",
      step: "04",
      title: ar ? "تصعيد" : "Escalate",
      note: ar ? "عند احتراق الحصة دون تقدّم" : "When the time quota burns without progress",
      value: n(metrics.escalated) > 0 ? metrics.escalated : "—",
      to: "/app/escalation",
    },
    {
      key: "signing",
      step: "05",
      title: ar ? "توقيع" : "Sign",
      note: ar ? `متوازٍ حتى 100 طرف · ${dash(signing.mine)} ينتظر ختمك` : `Parallel, up to 100 parties · ${dash(signing.mine)} awaiting you`,
      value: dash(signing.mine),
      to: "/app/signing?tab=mine",
    },
    {
      key: "work-proof",
      step: "06",
      title: ar ? "إثبات العميل" : "Client proof",
      note: ar ? "جهة خارج الشركة · تحقق عام" : "Outside company · public verify",
      value: dash(proofsAwaiting),
      to: "/app/work-proof",
    },
  ]
    .filter((item) => canAccessPath(item.to, user, data, company))
    .map((item) => {
      const waiting = waitingOf(item.key, mapMetrics);
      return { ...item, waiting, tone: toneOf(item.key, waiting) };
    });

  const more = [
    {
      key: "people",
      title: ar ? "الناس" : "People",
      items: [
        { key: "leave", title: ar ? "طلباتي" : "My Requests", note: ar ? "إجازة وموافقة خطية — الختم غاية الطلب" : "Leave and written consent — the seal is the request's purpose", value: metrics.pendingLeave, to: "/app/requests" },
        { key: "org", title: ar ? "الهيكل" : "Org", note: ar ? "صلاحيات وتصعيد" : "Permissions and escalation", value: metrics.stations, to: "/app/org" },
        { key: "hr", title: ar ? "الموارد البشرية" : "HR", note: ar ? `${metrics.activeMembers} نشط اليوم` : `${metrics.activeMembers} active today`, value: metrics.employees, to: "/app/hr" },
        { key: "performance", title: ar ? "الأداء" : "Performance", note: ar ? "درجة من الإثبات المعتمد بين تاريخين" : "A score from approved proof between two dates", value: `${metrics.performance}%`, to: "/app/performance" },
        { key: "complaints", title: ar ? "صوت الموظف" : "Employee Voice", note: ar ? "اقتراح · شكوى · مجهول" : "Suggest · complain · anon", value: metrics.complaints, to: "/app/complaints" },
        { key: "discipline", title: ar ? "الجزاءات" : "Sanctions", note: ar ? "واقعة ثم قرار وتظلم — 66–73" : "Incident, decision, appeal — 66–73", value: "—", to: "/app/discipline" },
      ],
    },
    {
      key: "care",
      title: ar ? "الالتزام" : "Care",
      items: [
        { key: "safety", title: ar ? "السلامة HSE" : "Safety HSE", note: ar ? `${metrics.hazards} مخاطر مفتوحة` : `${metrics.hazards} open hazards`, value: metrics.hazards || metrics.safety, to: "/app/safety" },
        { key: "shifts", title: ar ? "الورديات" : "Shifts", note: ar ? "جدول الفرع الشهري" : "Monthly station matrix", value: metrics.stations, to: "/app/shifts" },
        { key: "calendar", title: ar ? "التقويم التشغيلي" : "Operational calendar", note: ar ? "حضر وتأخّر وغياب كل يوم" : "On time, late, and absent each day", value: "—", to: "/app/calendar" },
      ],
    },
    {
      key: "money",
      title: ar ? "المال" : "Money",
      items: [
        { key: "payroll", title: ar ? "الرواتب" : "Payroll", note: ar ? "يغذيه الحضور المعتمد" : "Fed by approved attendance", value: metrics.payroll, to: "/app/payroll" },
        { key: "expenses", title: ar ? "المصروفات" : "Expenses", note: ar ? "مطالبات بانتظار الاعتماد" : "Claims awaiting approval", value: n(metrics.expenses) > 0 ? metrics.expenses : "—", to: "/app/expenses" },
        { key: "assets", title: ar ? "الأصول / العهد" : "Assets / Custody", note: ar ? "سجل وتسليم ونقل بين الفروع" : "Register, handover, inter-station transfer", value: metrics.assets ?? "—", to: "/app/assets" },
        { key: "inventory", title: ar ? "المخزون" : "Inventory", note: ar ? "رصيد لا مركزي · طلب من فرع آخر" : "Decentralised balance · request from another station", value: metrics.inventory, to: "/app/inventory" },
      ],
    },
    {
      key: "trust",
      title: ar ? "الثقة" : "Trust",
      items: [
        { key: "signing-status", title: ar ? "الحالة والإثبات" : "Status and proof", note: ar ? `مهلة 0–3 أيام · إعادة فتح ${dash(signing.reopen)}` : `Retract 0–3 days · reopen ${dash(signing.reopen)}`, value: dash(signing.open), to: "/app/signing?tab=status" },
        { key: "signing-verify", title: ar ? "تحقق" : "Verify", note: ar ? "SHA-256 على جهازك · /verify عام" : "On-device SHA-256 · public /verify", value: dash(signing.cooling), to: "/app/signing?tab=verify" },
        { key: "visitor-proof", title: ar ? "إثبات زائر" : "Visitor Proof", note: ar ? "ضيف على الفرع — ليس موظفاً من فرع آخر" : "A guest at the station — not a company employee from another branch", value: "—", to: "/app/visitor-proof" },
        { key: "files", title: ar ? "الملفات" : "Files", note: ar ? "أرشيف مستقل" : "Standalone archive", value: metrics.files, to: "/app/files" },
        { key: "assistant", title: ar ? "المساعد" : "Assistant", note: ar ? "اسأل بيانات منشأتك" : "Ask company data", value: ar ? "جاهز" : "Ready", to: "/app/assistant" },
        { key: "settings", title: ar ? "الإعدادات" : "Settings", note: ar ? "نطاق وصلاحيات" : "Scope and permissions", value: "—", to: "/app/settings" },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canAccessPath(item.to, user, data, company))
        .map((item) => {
          const waiting = waitingOf(item.key, mapMetrics);
          return { ...item, waiting, tone: toneOf(item.key, waiting) };
        }),
    }))
    .filter((group) => group.items.length > 0);

  const shownMore = more
    .map((group) => ({
      ...group,
      items: view === "attention" ? group.items.filter((item) => item.tone) : group.items,
    }))
    .filter((group) => group.items.length > 0);

  const cycleWaiting = cycle.reduce((sum, item) => sum + (item.waiting || 0), 0);

  const renderRow = (item) => {
    const urgent = item.tone === "urgent";
    return (
      <Link
        key={item.to}
        to={item.to}
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0,1fr) auto",
          gap: 12,
          alignItems: "start",
          padding: "13px 20px",
          borderBottom: `1px solid ${ROW}`,
          textDecoration: "none",
          minWidth: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: urgent ? "#DC2626" : item.tone ? "#B45309" : SURFACE,
            border: item.tone ? "none" : `1px solid ${BORDER}`,
            marginTop: 6,
            flexShrink: 0,
          }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block" }}>{item.title}</span>
          <span style={{ marginTop: 3, fontSize: 11, color: MUTED, lineHeight: 1.7, display: "block" }}>{item.note}</span>
        </span>
        <span
          dir="ltr"
          style={{
            fontFamily: MONO,
            fontSize: 18,
            fontWeight: 500,
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

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIR}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "سلسلة الإثبات" : "Proof cycle"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
              {ar
                ? "حضور → مهمة → مراجعة → تصعيد → توقيع → إثبات للعميل. كل رقم من السجل والنطاق المعروض."
                : "Attend → task → review → escalate → sign → client proof. Each figure is from the registry and the current scope."}
            </span>
          </div>
          {cycleWaiting > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: ACCENT, padding: "3px 9px", fontFamily: MONO, borderRadius: 999 }}>
              {cycleWaiting}
            </span>
          ) : null}
        </div>
        <div className="nv-dash-cycle">
          {cycle.map((item, index) => {
            const urgent = item.tone === "urgent";
            const watch = item.tone === "watch";
            return (
              <Link
                key={item.step}
                to={item.to}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "16px 18px",
                  borderInlineStart: index ? `1px solid ${LINE}` : "none",
                  textDecoration: "none",
                  minWidth: 0,
                  background: CARD,
                }}
              >
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", color: MUTED }}>{item.step}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{item.title}</span>
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, color: urgent ? "#DC2626" : NAVY, lineHeight: 1.05 }}>
                  {item.value}
                </span>
                <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.7 }}>{item.note}</span>
                {urgent || watch ? (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: urgent ? "#DC2626" : "#B45309" }} />
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="nv-doc" style={{ background: CARD, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${HAIR}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "باقي المنصة" : "The rest of the suite"}</span>
            <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
              {ar ? "ناس والتزام ومال وثقة — يظهر ما ينتظرك أولاً." : "People, care, money, and trust — what is waiting appears first."}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setView("attention")} style={tabBtn(view === "attention")}>
              <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75 }}>01</span>
              {ar ? "ينتظرك" : "Waiting"}
            </button>
            <button type="button" onClick={() => setView("all")} style={tabBtn(view === "all")}>
              <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75 }}>02</span>
              {ar ? "كل الأقسام" : "All sections"}
            </button>
          </div>
        </div>

        {shownMore.length === 0 ? (
          <div style={{ padding: "18px 20px", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            {ar ? "لا شيء معلّق خارج السلسلة." : "Nothing pending outside the cycle."}
          </div>
        ) : (
          shownMore.map((group) => (
            <div key={group.key}>
              <div style={{ padding: "12px 20px 4px", fontSize: 11, letterSpacing: ".14em", color: MUTED }}>
                {group.title}
              </div>
              {group.items.map(renderRow)}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
