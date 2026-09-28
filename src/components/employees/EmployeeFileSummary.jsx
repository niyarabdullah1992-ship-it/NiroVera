import React from "react";
import { Link } from "react-router-dom";
import { EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";

const paper = {
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 12,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const mono = { fontFamily: "'IBM Plex Mono', monospace" };

function factOf(view, key) {
  return (view.facts || []).find((row) => row.k === key) || null;
}

function expiringDocs(view) {
  return (view.docs || []).filter((row) => row.days != null && row.days <= EXPIRY_WARN_DAYS);
}

export default function EmployeeFileSummary({ view, ar, onOpenTab }) {
  const leave = factOf(view, ar ? "رصيد الإجازة السنوية" : "Annual leave");
  const service = factOf(view, ar ? "مدة الخدمة" : "Service");
  const livePenalties = (view.penalties || []).filter((row) => /نافذ|ساري|اعتراض|force|object/i.test(`${row.state || ""}`));
  const soon = expiringDocs(view);
  const kpis = [
    {
      label: ar ? "رصيد الإجازة السنوية" : "Annual leave",
      value: leave?.v || "—",
      note: leave?.note || (ar ? "المادة 109" : "Art. 109"),
      bar: "#3C7D50",
    },
    {
      label: ar ? "مدة الخدمة" : "Service",
      value: service?.v || "—",
      note: service?.note || "—",
      bar: "#C8A45A",
    },
    {
      label: ar ? "جزاءات سارية" : "Live sanctions",
      value: String(livePenalties.length),
      note: livePenalties.length ? (livePenalties[0].state || "—") : (ar ? "لا ساري" : "None live"),
      bar: livePenalties.length ? "#9B2335" : "#3C7D50",
    },
    {
      label: ar ? "وثائق تنتهي قريباً" : "Documents ending soon",
      value: String(soon.length),
      note: soon.length ? (ar ? "خلال 30 يوماً" : "Within 30 days") : (ar ? "لا تجديد معلّق" : "No renewal due"),
      bar: soon.length ? "#C8A45A" : "#3C7D50",
    },
  ];
  const rows = view.compliance || [];
  const met = rows.filter((row) => row.ok && !row.warn).length;
  const scored = rows.filter((row) => row.ok || row.warn || row.state).length || rows.length;
  const score = scored ? `${Math.round((met / scored) * 100)}%` : "—";
  const links = [
    {
      label: ar ? "الجزاءات" : "Sanctions",
      summary: livePenalties.length ? (livePenalties[0].t || livePenalties[0].state) : (ar ? "لا ساري" : "None live"),
      state: livePenalties.length ? (ar ? "ساري" : "Live") : (ar ? "لا ساري" : "Clear"),
      tab: "growth",
    },
    {
      label: ar ? "الطلبات" : "Requests",
      summary: view.hasPendingLeave ? (view.pendingPointer || "—") : (view.filed?.length ? (ar ? `${view.filed.length} مثبتة` : `${view.filed.length} on file`) : "—"),
      state: view.hasPendingLeave ? (ar ? "بانتظار القرار" : "Awaiting") : (ar ? "في الملف" : "On file"),
      href: view.pendingHref || "/app/requests",
    },
    {
      label: ar ? "التوقيعات" : "Signatures",
      summary: "—",
      state: ar ? "افتح" : "Open",
      href: "/app/signing",
    },
    {
      label: ar ? "السلامة" : "Safety",
      summary: soon.length ? (ar ? "شهادة تنتهي قريباً" : "A certificate ends soon") : "—",
      state: ar ? "افتح" : "Open",
      href: "/app/safety",
    },
    {
      label: ar ? "صوتي" : "My voice",
      summary: "—",
      state: ar ? "في التدرّج" : "On progression",
      tab: "growth",
    },
    {
      label: ar ? "القسيمة" : "Payslip",
      summary: factOf(view, ar ? "الأجر الشهري" : "Monthly wage")?.v || "—",
      state: ar ? "افتح" : "Open",
      href: "/app/payroll?view=self&tab=payslip",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="nv-file-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
        {kpis.map((item) => (
          <div key={item.label} style={{ position: "relative", overflow: "hidden", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 3, background: item.bar }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--nv-ink3)" }}>{item.label}</span>
            <strong style={{ fontSize: 18, color: "var(--nv-ink)", lineHeight: 1.4 }}>{item.value}</strong>
            <span style={{ fontSize: 11, color: "var(--nv-ink3)", lineHeight: 1.6 }}>{item.note}</span>
          </div>
        ))}
      </div>

      <section style={paper}>
        <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 180 }}>
            <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "امتثال الملف لأنظمة الوزارة" : "File compliance"}</strong>
            <span style={{ fontSize: 12, color: "var(--nv-ink3)" }}>
              {scored ? (ar ? `${met} من ${scored} متطلباً مستوفٍ` : `${met} of ${scored} met`) : "—"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 120, height: 6, borderRadius: 999, background: "var(--nv-line)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: score === "—" ? "0%" : score, borderRadius: 999, background: met === scored && scored ? "#3C7D50" : "#C8A45A" }} />
            </div>
            <strong dir="ltr" style={{ ...mono, fontSize: 20, color: "var(--nv-ink)" }}>{score}</strong>
          </div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>
          {rows.length === 0 ? (
            <div style={{ padding: "14px 18px", fontSize: 12, color: "var(--nv-ink3)" }}>—</div>
          ) : rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpenTab?.(row.tab)}
              style={{
                fontFamily: "inherit",
                textAlign: "start",
                border: "none",
                borderBottom: "1px solid var(--nv-line2)",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
              }}
            >
              <span style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none", color: row.color, background: row.bg }}>
                {row.ok && !row.warn ? "✓" : row.warn ? "!" : "✕"}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{row.label}</span>
                <span style={{ fontSize: 11.5, color: row.warn || !row.ok ? row.color : "var(--nv-ink3)" }}>{row.note || row.state || "—"}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section style={paper}>
        <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "السجلات المرتبطة" : "Linked records"}</strong>
          <span style={{ fontSize: 12, color: "var(--nv-ink3)" }}>{ar ? "تفتح سجلها ولا تُنسخ هنا" : "They open their own record"}</span>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.4fr) auto", gap: 12, padding: "8px 18px", fontSize: 11, color: "var(--nv-ink3)", borderBottom: "1px solid var(--nv-line)" }}>
          <span>{ar ? "السجل" : "Record"}</span>
          <span>{ar ? "الملخّص" : "Summary"}</span>
          <span>{ar ? "الحالة" : "State"}</span>
        </div>
        {links.map((row) => {
          const inner = (
            <>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{row.label}</span>
              <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6 }}>{row.summary || "—"}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#3C7D50" }}>{row.state}</span>
            </>
          );
          const style = {
            display: "grid",
            gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.4fr) auto",
            gap: 12,
            alignItems: "center",
            padding: "11px 18px",
            borderBottom: "1px solid var(--nv-line2)",
            textDecoration: "none",
            color: "inherit",
            background: "transparent",
            fontFamily: "inherit",
            textAlign: "start",
            width: "100%",
            cursor: "pointer",
          };
          if (row.href) return <Link key={row.label} to={row.href} style={style}>{inner}</Link>;
          return <button key={row.label} type="button" onClick={() => onOpenTab?.(row.tab)} style={style}>{inner}</button>;
        })}
      </section>

      <section style={paper}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "ما يحتاج إجراءً" : "Needs action"}</span>
          <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--nv-ink3)" }}>{view.todoNote}</span>
        </div>
        {(view.todos || []).length === 0 ? (
          <div style={{ padding: "14px 18px", fontSize: 12, color: "var(--nv-ink3)", lineHeight: 1.8 }}>
            {ar ? "لا نقص ولا تجديد معلّق على هذا الملف." : "No gap or renewal is pending on this file."}
          </div>
        ) : view.todos.map((item) => {
          const style = {
            fontFamily: "inherit",
            textAlign: "start",
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 18px",
            border: "none",
            borderBottom: "1px solid var(--nv-line2)",
            background: "transparent",
            cursor: "pointer",
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr) auto",
            gap: 11,
            alignItems: "start",
            textDecoration: "none",
            color: "inherit",
          };
          const body = (
            <>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.color, marginTop: 6 }} />
              <span style={{ fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.8, minWidth: 0 }}>{item.text}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: item.color, whiteSpace: "nowrap" }}>{item.tag}</span>
            </>
          );
          if (item.href) return <Link key={`${item.tab}-${item.text}`} to={item.href} style={style}>{body}</Link>;
          return <button key={`${item.tab}-${item.text}`} type="button" onClick={() => onOpenTab?.(item.tab)} style={style}>{body}</button>;
        })}
      </section>

      <details style={{ ...paper, borderRadius: 12 }}>
        <summary style={{ padding: "12px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", background: "var(--nv-soft)" }}>
          {ar ? "مرجع الوزارة على هذا الملف" : "Ministry reference on this file"}
        </summary>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { cite: "م 51 · 53", text: rows.find((row) => row.id === "contract")?.note || "—" },
            { cite: "م 109", text: leave?.note || "—" },
            { cite: "م 122", text: soon.length ? (ar ? "شهادة تنتهي خلال 30 يوماً" : "A certificate ends within 30 days") : (ar ? "لا تحذير انتهاء على الوثائق المؤرّخة" : "No dated document is inside the warning window") },
            { cite: ar ? "نطاقات" : "Nitaqat", text: rows.find((row) => row.id === "gosi")?.note || "—" },
          ].map((row) => (
            <div key={row.cite} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 12, padding: "10px 18px", borderTop: "1px solid var(--nv-line2)" }}>
              <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: "#C8A45A" }}>{row.cite}</span>
              <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{row.text}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
