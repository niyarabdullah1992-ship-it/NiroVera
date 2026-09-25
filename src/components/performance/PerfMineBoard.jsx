import React, { useMemo } from "react";
import { formatMonthYear } from "@/lib/dateFormat";
import {
  MIN_PROOF,
  PERF_DRIVERS,
  bandOf,
  jobOf,
  monthsInRange,
  personFacts,
  personMonthMap,
  scoreOf,
  segsOf,
  textOf,
} from "@/lib/perfRange";
import { PERF_BODY, PERF_INK, PERF_LINE, PERF_MUTED, PERF_SOFT, PERF_SURFACE, PERF_WHITE } from "@/components/performance/PerformanceSectionFrame";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const DASH = "—";

function shown(value) {
  return value == null || value === "" ? DASH : String(value);
}

/** The signed-in person's own derived score. No other people, no branch list. */
export default function PerfMineBoard({ lang, from, to, employee, data }) {
  const ar = lang === "ar";
  const valid = Boolean(employee?.id && from && to && from <= to);
  const facts = useMemo(
    () => (valid ? personFacts(employee, from, to, data) : null),
    [valid, employee, from, to, data],
  );
  const months = valid ? monthsInRange(from, to) : [];
  const byMonth = useMemo(
    () => (valid ? personMonthMap(employee, from, to, data) : {}),
    [valid, employee, from, to, data],
  );
  const score = facts ? scoreOf(facts) : null;
  const station = (data?.stations || []).find((row) => String(row.id) === String(employee?.stationId || ""));
  const job = jobOf(employee);
  const place = String(station?.name || "").trim();

  return (
    <div data-perf-face="self" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "درجتي في هذا المدى" : "My score in this range"}</span>
            <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.8 }}>
              {ar ? "المسمى" : "Title"}
              {" · "}
              {shown(job)}
              {" · "}
              {ar ? "الفرع" : "Branch"}
              {" · "}
              {shown(place)}
            </span>
          </div>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span dir="ltr" style={{ ...mono, fontSize: 36, fontWeight: 500, color: score == null ? PERF_MUTED : textOf(score), lineHeight: 1 }}>{score == null ? DASH : score}</span>
            <span style={{ fontSize: 11, color: PERF_MUTED }}>{score == null ? DASH : (ar ? "من 100" : "/100")}</span>
            <span style={{ fontSize: 11, color: PERF_BODY }}>{score == null ? DASH : bandOf(score, ar)}</span>
          </span>
        </div>
        <span style={{ display: "flex", height: 14, background: "var(--nv-inset)", borderRadius: 10, overflow: "hidden", minWidth: 0 }}>
          {(facts ? segsOf(facts) : []).map((seg) => (
            <span key={seg.id} title={seg.tip} style={{ width: seg.w, background: seg.color, borderInlineEnd: "1px solid var(--nv-card)" }} />
          ))}
        </span>
        <span style={{ fontSize: 11, color: PERF_BODY, lineHeight: 1.9 }}>
          {facts
            ? (facts.proof >= MIN_PROOF
              ? (ar
                ? `إثباتك المعتمد في المدى ${facts.proof}، وقد بلغ حد ${MIN_PROOF} مهام مثبتة، فتدخل الدرجة في متوسط الإدارة.`
                : `Your approved proof in the range is ${facts.proof}, which meets the floor of ${MIN_PROOF} proven tasks, so the score enters the management average.`)
              : (ar
                ? `إثباتك المعتمد في المدى ${facts.proof} من ${MIN_PROOF}. الدرجة معروضة ولا تدخل متوسط الإدارة — نقص إثبات لا سوء أداء.`
                : `Your approved proof in the range is ${facts.proof} of ${MIN_PROOF}. The score is shown and stays out of the management average — missing proof is not poor performance.`))
            : (ar ? "لا درجة حتى يكتمل المدى." : "No score until the range is valid.")}
        </span>
      </section>

      <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${PERF_SOFT}`, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "محرّكات درجتي" : "Drivers of my score"}</span>
          <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.8 }}>{ar ? "كل نسبة تُشتق من إثباتك في المدى، والوزن من وصف الوظيفة." : "Each share is derived from your proof in the range. The weight comes from the job."}</span>
        </div>
        {PERF_DRIVERS.map((driver) => (
          <div key={driver.id} style={{ padding: "12px 20px", borderBottom: `1px solid ${PERF_SOFT}`, display: "grid", gridTemplateColumns: "12px minmax(0,1fr) 72px 52px", gap: 12, alignItems: "center" }}>
            <span style={{ width: 12, height: 12, background: driver.color }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{ar ? driver.nameAr : driver.nameEn}</span>
              <span style={{ fontSize: 11, color: PERF_BODY, lineHeight: 1.7 }}>{ar ? driver.srcAr : driver.srcEn}</span>
            </span>
            <span dir="ltr" style={{ ...mono, fontSize: 16, fontWeight: 500, color: PERF_INK, textAlign: "end" }}>{facts ? `${facts[driver.id]}%` : DASH}</span>
            <span dir="ltr" style={{ ...mono, fontSize: 11, color: PERF_MUTED, textAlign: "end" }}>{driver.w}%</span>
          </div>
        ))}
      </section>

      <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "مسار درجتي شهراً بشهر" : "My score, month by month"}</span>
          <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.8 }}>{ar ? "درجة كل شهر على حدة، من إثبات ذلك الشهر فقط." : "Each month on its own, from that month's proof only."}</span>
        </div>
        {months.length ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${months.length},minmax(0,1fr))`, gap: 8 }}>
            {months.map((key) => {
              const monthFacts = byMonth[key];
              const monthScore = monthFacts ? scoreOf(monthFacts) : null;
              return (
                <div key={key} style={{ background: PERF_SURFACE, border: `1px solid ${PERF_SOFT}`, borderRadius: 12, padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: PERF_INK, textAlign: "center", lineHeight: 1.4 }}>{formatMonthYear(`${key}-01T12:00:00`, ar ? "ar" : "en") || DASH}</span>
                  <span dir="ltr" style={{ ...mono, fontSize: 18, fontWeight: 500, color: monthScore == null ? PERF_MUTED : textOf(monthScore) }}>{monthScore == null ? DASH : monthScore}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: PERF_MUTED }}>{DASH}</span>
        )}
      </section>
    </div>
  );
}
