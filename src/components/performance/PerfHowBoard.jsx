import React from "react";
import { Link } from "react-router-dom";
import { MIN_PROOF, PERF_DRIVERS } from "@/lib/perfRange";
import JobObjectiveBoard from "@/components/performance/JobObjectiveBoard";
import { PERF_BODY, PERF_INK, PERF_LINE, PERF_MUTED, PERF_SOFT, PERF_SURFACE, PERF_WHITE } from "@/components/performance/PerformanceSectionFrame";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };

export default function PerfHowBoard({ lang }) {
  const ar = lang === "ar";
  const rules = [
    { tag: ar ? "إثبات" : "Proof", t: ar ? `من لم يبلغ ${MIN_PROOF} مهام مثبتة معتمدة في المدى تُعرض درجته ولا تدخل المتوسط — نقص إثبات لا حكم.` : `Anyone short of ${MIN_PROOF} approved proofs in the range is shown and kept out of the average — missing proof is not a verdict.` },
    { tag: ar ? "المدى" : "Range", t: ar ? "كل رقم يُحسب بين التاريخين المختارين فقط. غيّر المدى فتتغيّر الدرجات والترتيب والجُمل." : "Every figure is counted only between the two dates. Change the range and the scores, rank, and sentences change." },
    { tag: ar ? "الشفافية" : "Open", t: ar ? "الأرقام نفسها يراها كل موظف. لا لوحة خاصة بالإدارة ولا درجة مخفيّة." : "Every employee sees the same figures. There is no private management board and no hidden score." },
    { tag: ar ? "الأوزان" : "Weights", t: ar ? "من وصف الوظيفة. لا يغيّرها مدير لموظف بعينه، ومجموعها 100." : "They come from the job description. A manager does not change them for one person, and they always total 100." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderTop: "none", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 0, alignItems: "stretch", boxSizing: "border-box" }}>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 9, borderInlineStart: `1px solid ${PERF_SOFT}`, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "محرّكات الدرجة وأوزانها" : "Score drivers and weights"}</span>
          {PERF_DRIVERS.map((driver) => (
            <div key={driver.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) 44px", gap: 11, alignItems: "start", borderBottom: "1px solid #f7f8fa", paddingBottom: 8 }}>
              <span style={{ width: 12, height: 12, background: driver.color, marginTop: 4 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{ar ? driver.nameAr : driver.nameEn}</span>
                <span style={{ fontSize: 11, color: PERF_BODY, lineHeight: 1.85 }}>{ar ? driver.srcAr : driver.srcEn}</span>
              </span>
              <span dir="ltr" style={{ ...mono, fontSize: 14, fontWeight: 500, textAlign: "right" }}>{driver.w}%</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: PERF_BODY, lineHeight: 1.95 }}>{ar ? "الدرجة = مجموع (نسبة المحرّك × وزنه). الأوزان من وصف الوظيفة لا من المدير، ومجموعها 100 دائماً." : "Score = sum of (driver % × weight). Weights come from the job, not the manager, and always total 100."}</span>
        </div>
        <div style={{ padding: "16px 20px", background: PERF_SURFACE, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "قواعد لا تتغيّر" : "Rules that do not move"}</span>
          {rules.map((rule) => (
            <div key={rule.tag} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 11, alignItems: "start", borderBottom: `1px solid ${PERF_SOFT}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: PERF_BODY, background: "#f5f6f8", border: "1px solid #e6e9ef", padding: "2px 9px", whiteSpace: "nowrap", marginTop: 2 }}>{rule.tag}</span>
              <span style={{ fontSize: 11, color: "#3c4657", lineHeight: 1.9, minWidth: 0 }}>{rule.t}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: PERF_MUTED, lineHeight: 1.9 }}>
            {ar ? "لا درجة تُعدَّل بالطلب. ارفع إثباتك في " : "No score is edited on request. Raise your proof in "}
            <Link to="/app/work-proof" style={{ color: PERF_INK }}>{ar ? "إثبات العمل" : "Work proof"}</Link>
            {ar ? "، وما اعتُمد يظهر هنا. والخطأ في الدرجة يُعترض عليه من " : ", and what is approved appears here. A wrong score is objected from "}
            <Link to="/app/requests" style={{ color: PERF_INK }}>{ar ? "طلباتي" : "My Requests"}</Link>
            .
          </span>
        </div>
      </section>
      <div style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderTop: "none", padding: 16 }}>
        <JobObjectiveBoard lang={lang} />
      </div>
    </div>
  );
}
