import React from "react";
import { Link } from "react-router-dom";
import { MIN_PROOF, PERF_DRIVERS } from "@/lib/perfRange";
import JobObjectiveBoard from "@/components/performance/JobObjectiveBoard";
import { PERF_BODY, PERF_LINE, PERF_MUTED, PERF_SOFT, PERF_WHITE } from "@/components/performance/PerformanceSectionFrame";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const ACTION = "#3C7D50";
const DRIVER_COLOR = {
  done: "#0B8A4F",
  time: "var(--nv-ink)",
  safe: "#C8A45A",
  cover: "#8E9A93",
};

/** Weights stay on the job. They are shown, never typed over a person. */
export default function PerfHowBoard({ lang }) {
  const ar = lang === "ar";
  const total = PERF_DRIVERS.reduce((sum, driver) => sum + driver.w, 0);
  const rules = [
    { tag: ar ? "إثبات" : "Proof", t: ar ? `من لم يبلغ ${MIN_PROOF} مهام مثبتة معتمدة في المدى تُعرض درجته ولا تدخل المتوسط — نقص إثبات لا حكم.` : `Anyone short of ${MIN_PROOF} approved proofs in the range is shown and kept out of the average — missing proof is not a verdict.` },
    { tag: ar ? "المدى" : "Range", t: ar ? "كل رقم يُحسب بين التاريخين المختارين فقط. غيّر المدى فتتغيّر الدرجات والترتيب." : "Every figure is counted only between the two dates. Change the range and the scores and rank change." },
    { tag: ar ? "المادة 61" : "Article 61", t: ar ? "الأوزان من وصف الوظيفة. لا يغيّرها مدير لموظف بعينه، ومجموعها 100، وهي واحدة لمن في الوظيفة نفسها." : "Weights come from the job description. A manager does not change them for one person, they total 100, and they are the same for the same job." },
    { tag: ar ? "المادة 80" : "Article 80", t: ar ? "الدرجة وحدها ليست سبباً للفصل بلا مكافأة نهاية الخدمة." : "A score alone is never grounds for dismissal without the end-of-service award." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section data-perf-card style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${PERF_SOFT}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14 }}>{ar ? "أوزان المحرّكات" : "Driver weights"}</strong>
          <span style={{ fontSize: 12, color: PERF_MUTED }}>{ar ? `من وصف الوظيفة · المجموع ${total}%` : `From the job description · total ${total}%`}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: total === 100 ? ACTION : "#9B2335" }}>{total === 100 ? (ar ? "متوازن" : "Balanced") : (ar ? "يجب أن يساوي 100" : "Must equal 100")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) 90px minmax(0,2fr)", background: "var(--nv-soft)", borderBottom: `1px solid ${PERF_LINE}`, fontSize: 12, fontWeight: 700, color: PERF_BODY }}>
          <span style={{ padding: "9px 12px" }}>{ar ? "المحرّك" : "Driver"}</span>
          <span style={{ padding: "9px 12px", borderInlineStart: `1px solid ${PERF_SOFT}` }}>{ar ? "الوزن" : "Weight"}</span>
          <span style={{ padding: "9px 12px", borderInlineStart: `1px solid ${PERF_SOFT}` }}>{ar ? "مصدر القياس" : "Measured from"}</span>
        </div>
        {PERF_DRIVERS.map((driver) => (
          <div key={driver.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) 90px minmax(0,2fr)", borderBottom: `1px solid ${PERF_SOFT}`, fontSize: 13, alignItems: "center" }}>
            <span style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: DRIVER_COLOR[driver.id] || ACTION, flex: "none" }} />
              {ar ? driver.nameAr : driver.nameEn}
            </span>
            <span dir="ltr" style={{ ...mono, padding: "10px 12px", borderInlineStart: `1px solid ${PERF_SOFT}`, fontWeight: 600, textAlign: "end" }}>{driver.w}%</span>
            <span style={{ padding: "10px 12px", borderInlineStart: `1px solid ${PERF_SOFT}`, color: PERF_BODY }}>{ar ? driver.srcAr : driver.srcEn}</span>
          </div>
        ))}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: PERF_BODY, background: "var(--nv-soft)", lineHeight: 1.7 }}>
          <span>{ar ? "الدرجة = مجموع (نسبة المحرّك × وزنه)." : "Score = sum of (driver share × its weight)."}</span>
          <span>{ar ? `لا يدخل المتوسط من لديه أقل من ${MIN_PROOF} مهام مثبتة في المدى.` : `Anyone short of ${MIN_PROOF} proven tasks in the range stays out of the average.`}</span>
        </div>
      </section>

      <section data-perf-card style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{ar ? "قواعد لا تتغيّر" : "Rules that do not move"}</span>
        {rules.map((rule) => (
          <div key={rule.tag} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10, alignItems: "start" }}>
            <span className="nv-perf-chip" style={{ fontSize: 11, fontWeight: 700, color: PERF_BODY, background: "var(--nv-soft)", border: `1px solid ${PERF_LINE}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{rule.tag}</span>
            <span style={{ fontSize: 12, color: PERF_BODY, lineHeight: 1.75 }}>{rule.t}</span>
          </div>
        ))}
        <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.75 }}>
          {ar ? "لا درجة تُعدَّل بالطلب. ارفع إثباتك في " : "No score is edited on request. Raise your proof in "}
          <Link to="/app/work-proof" style={{ color: ACTION, fontWeight: 700 }}>{ar ? "إثبات العمل" : "Work proof"}</Link>
          {ar ? "، وما اعتُمد يظهر هنا. والخطأ في الدرجة يُعترض عليه من " : ", and what is approved appears here. A wrong score is objected from "}
          <Link to="/app/requests" style={{ color: ACTION, fontWeight: 700 }}>{ar ? "طلباتي" : "My Requests"}</Link>
          .
        </span>
      </section>

      <div data-perf-card style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, padding: 14 }}>
        <JobObjectiveBoard lang={lang} />
      </div>
    </div>
  );
}
