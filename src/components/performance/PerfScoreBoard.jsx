import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { visibleStations } from "@/lib/permissions";
import {
  PERF_DRIVERS,
  accentOf,
  bandOf,
  countAr,
  derivePerformanceRange,
  printPerformanceReport,
  scoreOf,
  segsOf,
  teamLabel,
  textOf,
} from "@/lib/perfRange";
import PerfScopePicker from "@/components/performance/PerfScopePicker";
import PerfHowBoard from "@/components/performance/PerfHowBoard";
import { PERF_BODY, PERF_INK, PERF_LINE, PERF_MUTED, PERF_SOFT, PERF_SURFACE, PERF_WHITE } from "@/components/performance/PerformanceSectionFrame";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const TREND = ["var(--nv-ink)", "var(--nv-ok-fill)", "var(--nv-warn-fill)", "var(--nv-ink3)"];
const QUIET = "var(--nv-mute-fill)";

function SegBar({ segs, height = 14 }) {
  return (
    <span style={{ display: "flex", height, background: "var(--nv-inset)", borderRadius: 10, overflow: "hidden", minWidth: 0 }}>
      {segs.map((seg) => (
        <span key={seg.id} title={seg.tip} style={{ width: seg.w, background: seg.color, borderInlineEnd: "1px solid var(--nv-card)" }} />
      ))}
    </span>
  );
}

function StatTile({ label, value, unit, note, accent }) {
  return (
    <div style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderTop: `3px solid ${accent}`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0, boxSizing: "border-box" }}>
      <span style={{ fontSize: 12, color: PERF_BODY }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
        <span dir="ltr" style={{ ...mono, fontSize: 30, fontWeight: 500, color: accent, lineHeight: 1.05 }}>{value}</span>
        {unit ? <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{unit}</span> : null}
      </span>
      <span style={{ fontSize: 11, color: PERF_MUTED, lineHeight: 1.7 }}>{note}</span>
    </div>
  );
}

export default function PerfScoreBoard({ lang, from, to, tab = "people" }) {
  const { data, currentUser, company } = useAuth();
  const ar = lang === "ar";
  const scope = useStationScope();
  const [selB, setSelB] = useState([]);
  const [selT, setSelT] = useState([]);
  const [selP, setSelP] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickQ, setPickQ] = useState("");
  const [openB, setOpenB] = useState({});

  const stations = useMemo(() => {
      const list = currentUser && data ? visibleStations(currentUser, data) : data?.stations || [];
    return list.filter((station) => matchesStationScope(station.id, scope, data?.stations));
  }, [currentUser, data, scope]);

  const employees = useMemo(
    () => (data?.employees || []).filter((employee) => matchesStationScope(employee.stationId, scope, data?.stations)),
    [data?.employees, data?.stations, scope],
  );

  const view = useMemo(
    () => derivePerformanceRange({ employees, stations, data, from, to, selB, selT, selP, ar }),
    [employees, stations, data, from, to, selB, selT, selP, ar],
  );

  const toggle = (list, setList, value) => {
    setList((cur) => (cur.includes(value) ? cur.filter((item) => item !== value) : [...cur, value]));
  };

  const download = () => {
    printPerformanceReport({
      ...view,
      selBNames: selB.map((id) => view.branches.find((row) => row.id === id)?.name || id),
      selTNames: selT.map((id) => `${ar ? "فريق" : "Team"} ${teamLabel(id, ar)}`),
      selPNames: selP.map((id) => view.people.find((row) => row.id === id)?.name || id),
    }, { companyName: company?.name || "NiroVera", ar });
  };

  const eligible = view.eligible;
  const rowsAll = view.rowsAll;
  const top = view.top;
  const climbers = view.climbers;
  const first = view.months[0];
  const last = view.months[view.months.length - 1];
  const lead = view.groups[0];
  const trendPeople = view.ranked.slice(0, 4);

  const stats = [
    {
      val: eligible.length ? String(view.avg) : "—",
      unit: eligible.length ? (ar ? "من 100" : "/100") : "",
      lbl: ar ? "متوسط الدرجة" : "Average score",
      note: eligible.length
        ? (ar ? `${eligible.length} من ${rowsAll.length} بلغوا ${view.minProof} مهام مثبتة` : `${eligible.length} of ${rowsAll.length} reached ${view.minProof} proven tasks`)
        : (ar ? `لا متوسط — لم يبلغ أحد ${view.minProof} مهام مثبتة في هذا المدى` : `No average — no one reached ${view.minProof} proven tasks`),
      accent: eligible.length ? "var(--nv-ink)" : "var(--nv-warn-ink)",
    },
    {
      val: top ? String(top.score) : "—",
      unit: "",
      lbl: ar ? "الأعلى في المدى" : "Highest in range",
      note: top ? `${top.name} · ${top.branch}` : (rowsAll.length ? (ar ? `لا صدارة — لم يبلغ أحد ${view.minProof} مهام مثبتة` : `No lead — no one reached ${view.minProof}`) : (ar ? "لا بيانات في المدى" : "No data in range")),
      accent: top ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)",
    },
    {
      val: climbers[0]?.d > 0 ? `+${climbers[0].d}` : "—",
      unit: climbers[0]?.d > 0 ? (ar ? countAr(climbers[0].d, "نقطة", "نقطتان", "نقاط", "نقطة").replace(/^\d+\s/, "") : (climbers[0].d === 1 ? "pt" : "pts")) : "",
      lbl: ar ? "أكبر تحسّن" : "Biggest rise",
      note: climbers[0]?.d > 0
        ? (ar ? `${climbers[0].p.name} بين أول المدى وآخره` : `${climbers[0].p.name} from the first month to the last`)
        : (view.months.length < 2
          ? (ar ? `يحتاج شهرين على الأقل — المدى الحالي ${countAr(view.months.length, "شهر واحد", "شهران", "أشهر", "شهراً", "بلا أشهر")}` : `Needs at least two months — this range has ${view.months.length}`)
          : (climbers.length ? (ar ? `لا تحسّن في المدى — أفضل تغيّر ${climbers[0].p.name} (${climbers[0].d > 0 ? "+" : ""}${climbers[0].d})` : `No rise — best change ${climbers[0].p.name} (${climbers[0].d})`) : (ar ? "لا بيانات شهرية في المدى" : "No monthly data"))),
      accent: climbers[0]?.d > 0 ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)",
    },
    {
      val: String(rowsAll.length - eligible.length),
      unit: "",
      lbl: ar ? "بلا إثبات كافٍ" : "Short of proof",
      note: rowsAll.length - eligible.length ? (ar ? "تُعرض درجتهم ولا تدخل المتوسط" : "Shown, but kept out of the average") : (ar ? "الكلّ بلغ الحدّ" : "Everyone reached the floor"),
      accent: rowsAll.length - eligible.length ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)",
    },
  ];

  const insights = [
    top ? { t: ar ? `${top.name} الأعلى بـ${top.score}` : `${top.name} leads at ${top.score}`, d: ar ? `يقود بمحرّك ${(() => { const driver = PERF_DRIVERS.slice().sort((a, b) => (top.a[b.id] * b.w) - (top.a[a.id] * a.w))[0]; return `${driver.nameAr} (${top.a[driver.id]}%)`; })()}.` : `Led by ${(() => { const driver = PERF_DRIVERS.slice().sort((a, b) => (top.a[b.id] * b.w) - (top.a[a.id] * a.w))[0]; return `${driver.nameEn} (${top.a[driver.id]}%)`; })()}.`, accent: "var(--nv-ok-fill)" } : null,
    climbers[0]?.d > 0 ? {
      t: ar ? `${climbers[0].p.name} الأكثر تحسّناً` : `${climbers[0].p.name} rose most`,
      d: ar
        ? `من ${climbers[0].p.months?.[first] ? scoreOf(climbers[0].p.months[first]) : "—"} إلى ${climbers[0].p.months?.[last] ? scoreOf(climbers[0].p.months[last]) : "—"} بين ${view.monthName(first)} و${view.monthName(last)}.`
        : `From ${climbers[0].p.months?.[first] ? scoreOf(climbers[0].p.months[first]) : "—"} to ${climbers[0].p.months?.[last] ? scoreOf(climbers[0].p.months[last]) : "—"} between ${view.monthName(first)} and ${view.monthName(last)}.`,
      accent: "var(--nv-ok-fill)",
    } : null,
    (view.low && top && view.low.name !== top.name) ? {
      t: ar ? `${view.low.name} الأدنى بين المكتملين` : `${view.low.name} is lowest among those with enough proof`,
      d: ar ? `أضعف محرّك ${(() => { const driver = PERF_DRIVERS.slice().sort((a, b) => view.low.a[a.id] - view.low.a[b.id])[0]; return `${driver.nameAr} (${view.low.a[driver.id]}%)`; })()} — هنا مكان الرفع.` : `Weakest driver ${(() => { const driver = PERF_DRIVERS.slice().sort((a, b) => view.low.a[a.id] - view.low.a[b.id])[0]; return `${driver.nameEn} (${view.low.a[driver.id]}%)`; })()} — that is the lift.`,
      accent: "var(--nv-warn-fill)",
    } : null,
    (rowsAll.length - eligible.length) ? {
      t: ar ? countAr(rowsAll.length - eligible.length, "موظف واحد بلا إثبات كافٍ", "موظفان بلا إثبات كافٍ", "موظفين بلا إثبات كافٍ", "موظفاً بلا إثبات كافٍ") : `${rowsAll.length - eligible.length} short of enough proof`,
      d: ar ? "درجاتهم معروضة لكن لا تدخل المتوسط حتى يُعتمد إثباتهم." : "Their scores are shown but stay out of the average until proof is approved.",
      accent: "var(--nv-bad-fill)",
    } : null,
  ].filter(Boolean);

  const scopeLabel = !view.anyPick
    ? (ar ? "كل الفروع" : "All branches")
    : [...selB.map((id) => view.branches.find((row) => row.id === id)?.name || id), ...selT.map((id) => `${ar ? "فريق" : "Team"} ${teamLabel(id, ar)}`), ...selP.map((id) => view.people.find((row) => row.id === id)?.name || id)].join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <PerfScopePicker
        ar={ar}
        view={view}
        pickerOpen={pickerOpen}
        pickQ={pickQ}
        openB={openB}
        selB={selB}
        selT={selT}
        selP={selP}
        onTogglePicker={() => setPickerOpen((cur) => !cur)}
        onToggleBranch={(id) => toggle(selB, setSelB, id)}
        onToggleTeam={(id) => toggle(selT, setSelT, id)}
        onTogglePerson={(id) => toggle(selP, setSelP, id)}
        onToggleOpen={(id) => setOpenB((cur) => ({ ...cur, [id]: cur[id] === false }))}
        onPickAll={(ids, allIn) => setSelP((cur) => (allIn ? cur.filter((id) => !ids.includes(id)) : [...cur.filter((id) => !ids.includes(id)), ...ids]))}
        onClear={() => { setSelB([]); setSelT([]); setSelP([]); }}
        onQuery={setPickQ}
        onReport={download}
      />

      {tab === "how" ? <PerfHowBoard lang={lang} /> : null}

      {tab === "people" ? (
        <>
          <div className="nv-perf-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {stats.map((stat) => (
              <StatTile key={stat.lbl} label={stat.lbl} value={stat.val} unit={stat.unit} note={stat.note} accent={stat.accent} />
            ))}
          </div>

          {view.hasGroups ? (
            <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${PERF_SOFT}`, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "مقارنة المجموعات المختارة" : "Selected groups"}</span>
                <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.8 }}>{ar ? "كل مجموعة درجتها متوسط أفرادها ذوي الإثبات الكافي في المدى. الفرق بينها مكتوب لا مقروء بالعين." : "Each group's score is the mean of its people with enough proof. The gap is written, not left to the eye."}</span>
              </div>
              {view.groups.map((group, index) => {
                const biggest = lead && group.el.length && lead.el.length
                  ? PERF_DRIVERS.slice().sort((a, b) => ((lead.a[b.id] - group.a[b.id]) * b.w) - ((lead.a[a.id] - group.a[a.id]) * a.w))[0]
                  : null;
                const diff = index === 0
                  ? (ar ? "الأعلى بين المختار" : "Highest among the pick")
                  : (group.el.length && lead?.el.length
                    ? (ar
                      ? `أدنى من ${lead.name} بـ${countAr(lead.score - group.score, "نقطة واحدة", "نقطتين", "نقاط", "نقطة", "لا فرق")} — الفارق الأكبر في ${biggest.nameAr} (${group.a[biggest.id]}% مقابل ${lead.a[biggest.id]}%)`
                      : `${lead.score - group.score} below ${lead.name} — widest gap in ${biggest.nameEn} (${group.a[biggest.id]}% vs ${lead.a[biggest.id]}%)`)
                    : (ar ? "لا إثبات كافٍ للمقارنة" : "Not enough proof to compare"));
                return (
                  <div key={`${group.kind}-${group.name}`} style={{ padding: "13px 20px", borderTop: `3px solid ${group.el.length ? accentOf(group.score) : QUIET}`, borderBottom: `1px solid ${PERF_SOFT}`, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2.4fr) 92px", gap: 14, alignItems: "center" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: PERF_BODY, background: "var(--nv-mute-soft)", border: "1px solid var(--nv-mute-line)", borderRadius: 999, padding: "1px 7px" }}>{group.kind}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{group.name}</span>
                      </span>
                      <span style={{ fontSize: 10, color: PERF_MUTED }}>{ar ? `${countAr(group.rows.length, "موظف واحد", "موظفان", "موظفين", "موظفاً", "لا أحد")} · ${group.el.length} بإثبات كافٍ` : `${group.rows.length} people · ${group.el.length} with enough proof`}</span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                      <SegBar segs={group.el.length ? segsOf(group.a) : []} height={16} />
                      <span style={{ fontSize: 10, color: PERF_BODY, lineHeight: 1.7 }}>{diff}</span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                      <span dir="ltr" style={{ ...mono, fontSize: 24, fontWeight: 500, color: group.el.length ? textOf(group.score) : PERF_BODY, lineHeight: 1 }}>{group.el.length ? group.score : "—"}</span>
                      <span style={{ fontSize: 10, color: PERF_MUTED }}>{group.el.length ? bandOf(group.score, ar) : (ar ? "بلا إثبات" : "No proof")}</span>
                    </span>
                  </div>
                );
              })}
            </section>
          ) : null}

          <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${PERF_SOFT}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? `مقارنة الموظفين — ${scopeLabel}` : `People comparison — ${scopeLabel}`}</span>
                <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.8 }}>{ar ? "مرتّبون بالدرجة المشتقّة في المدى المختار. الشريط يُقسَم بالمحرّكات الأربعة بأوزانها." : "Ranked by the derived score in the chosen range. The bar is split by the four weighted drivers."}</span>
              </div>
              <span style={{ marginInlineStart: "auto", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                {PERF_DRIVERS.map((driver) => (
                  <span key={driver.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: PERF_BODY }}>
                    <span style={{ width: 10, height: 10, background: driver.color }} />
                    {ar ? driver.nameAr : driver.nameEn}
                    <span dir="ltr" style={{ ...mono, color: PERF_MUTED }}>{driver.w}%</span>
                  </span>
                ))}
            </span>
          </div>
            <div style={{ padding: "10px 20px", background: PERF_SURFACE, borderBottom: `1px solid ${PERF_SOFT}`, display: "grid", gridTemplateColumns: "26px minmax(0,1.3fr) minmax(0,2.2fr) 60px 60px 60px 60px 72px", gap: 11, fontSize: 10, letterSpacing: ".05em", color: PERF_MUTED, fontWeight: 600 }}>
              <span />
              <span>{ar ? "الموظف" : "Employee"}</span>
              <span>{ar ? "تركيب الدرجة" : "Score mix"}</span>
              <span>{ar ? "الإنجاز" : "Done"}</span>
              <span>{ar ? "الموعد" : "Time"}</span>
              <span>{ar ? "السلامة" : "Safety"}</span>
              <span>{ar ? "التغطية" : "Cover"}</span>
              <span>{ar ? "الدرجة" : "Score"}</span>
          </div>
            {view.ranked.map((row, index) => (
              <div key={row.id} style={{ padding: "11px 20px", borderTop: `3px solid ${row.ok ? accentOf(row.score) : QUIET}`, borderBottom: `1px solid ${PERF_SOFT}`, background: row.ok ? PERF_WHITE : PERF_SURFACE, display: "grid", gridTemplateColumns: "26px minmax(0,1.3fr) minmax(0,2.2fr) 60px 60px 60px 60px 72px", gap: 11, alignItems: "center" }}>
                <span dir="ltr" style={{ ...mono, fontSize: 11, color: PERF_MUTED, textAlign: "right" }}>{index + 1}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
                  <span style={{ fontSize: 10, color: PERF_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.job} · {row.branch}{row.ok ? "" : (ar ? ` · إثبات ${row.a.proof} من ${view.minProof}` : ` · proof ${row.a.proof} of ${view.minProof}`)}</span>
                </span>
                <SegBar segs={segsOf(row.a)} />
                <span dir="ltr" style={{ ...mono, fontSize: 12, textAlign: "right" }}>{row.a.done}%</span>
                <span dir="ltr" style={{ ...mono, fontSize: 12, textAlign: "right" }}>{row.a.time}%</span>
                <span dir="ltr" style={{ ...mono, fontSize: 12, color: row.a.safe >= 90 ? "var(--nv-ok-ink)" : "var(--nv-bad-ink)", textAlign: "right" }}>{row.a.safe}%</span>
                <span dir="ltr" style={{ ...mono, fontSize: 12, textAlign: "right" }}>{row.a.cover}%</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 5, justifyContent: "flex-end" }}>
                  <span dir="ltr" style={{ ...mono, fontSize: 15, fontWeight: 500, color: row.ok ? textOf(row.score) : PERF_BODY }}>{row.score}</span>
                  <span style={{ fontSize: 10, color: PERF_MUTED }}>{bandOf(row.score, ar)}</span>
                </span>
              </div>
            ))}
            <div style={{ padding: "13px 20px" }}>
              <span style={{ fontSize: 11, color: PERF_BODY, lineHeight: 1.95 }}>{ar ? `الصفّ الرمادي لم يبلغ ${view.minProof} مهام مثبتة في المدى: درجته معروضة ولا تُحتسب في المتوسط — نقص إثبات لا سوء أداء.` : `A grey row is short of ${view.minProof} proven tasks in the range: the score is shown and kept out of the average — missing proof is not poor performance.`}</span>
            </div>
          </section>

          <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 0, alignItems: "stretch", boxSizing: "border-box" }}>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, borderInlineStart: `1px solid ${PERF_SOFT}`, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "مسار الدرجة شهراً بشهر" : "Score path, month by month"}</span>
                <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.8 }}>{ar ? `أعلى ${countAr(trendPeople.length, "موظف", "موظفين", "موظفين", "موظفاً")} في المدى، درجة كل شهر على حدة.` : `Top ${trendPeople.length} in the range, each month on its own.`}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, view.months.length)},minmax(0,1fr))`, gap: 8, alignItems: "end", height: 170, borderBottom: `1px solid ${PERF_LINE}` }}>
                {view.months.map((key) => (
                  <div key={key} style={{ display: "flex", gap: 2, alignItems: "flex-end", height: "100%", minWidth: 0 }}>
                    {trendPeople.map((person, index) => {
                      const facts = person.months?.[key];
                      const score = facts ? scoreOf(facts) : 0;
                      return <span key={person.id} title={`${person.name} · ${score}`} style={{ flex: 1, minWidth: 0, height: `${score}%`, background: TREND[index] }} />;
                    })}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, view.months.length)},minmax(0,1fr))`, gap: 8 }}>
                {view.months.map((key) => (
                  <span key={key} style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center", minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PERF_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{view.monthName(key)}</span>
                    <span style={{ display: "flex", gap: 2, width: "100%", minWidth: 0 }}>
                      {trendPeople.map((person, index) => {
                        const facts = person.months?.[key];
                        return <span key={person.id} dir="ltr" title={person.name} style={{ flex: 1, minWidth: 0, textAlign: "center", ...mono, fontSize: 10, color: TREND[index], whiteSpace: "nowrap", overflow: "hidden" }}>{facts ? scoreOf(facts) : "—"}</span>;
                      })}
                    </span>
              </span>
                ))}
            </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {trendPeople.map((person, index) => (
                  <span key={person.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: PERF_MUTED }}>
                    <span style={{ width: 10, height: 10, background: TREND[index] }} />
                    {person.name}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ padding: "16px 20px", background: PERF_SURFACE, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "ما يقوله المدى" : "What the range says"}</span>
              {insights.map((item) => (
                <div key={item.t} style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderTop: `3px solid ${item.accent}`, borderRadius: 14, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{item.t}</span>
                  <span style={{ fontSize: 11, color: PERF_MUTED, lineHeight: 1.85 }}>{item.d}</span>
                </div>
              ))}
              <span style={{ fontSize: 11, color: PERF_MUTED, lineHeight: 1.9 }}>{ar ? "كل جملة أعلاه مشتقّة من الأرقام في المدى — تتغيّر بتغيير التاريخين." : "Every sentence above is derived from the figures in the range — change the dates and it changes."}</span>
            </div>
          </section>
        </>
      ) : tab === "branches" ? (
        <>
          <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${PERF_SOFT}`, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "مقارنة الفروع" : "Branch comparison"}</span>
              <span style={{ fontSize: 12, color: PERF_MUTED, lineHeight: 1.8 }}>{ar ? "درجة الفرع متوسط موظفيه ذوي الإثبات الكافي في المدى. الشريط الأفقي بمحرّكاته." : "A branch score is the mean of its people with enough proof. The bar is the drivers."}</span>
            </div>
            {view.branchData.map((branch) => (
              <div key={branch.id} style={{ padding: "14px 20px", borderTop: `3px solid ${branch.el.length ? accentOf(branch.score) : QUIET}`, borderBottom: `1px solid ${PERF_SOFT}`, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2.6fr) 84px", gap: 14, alignItems: "center" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{branch.name}</span>
                  <span style={{ fontSize: 10, color: PERF_MUTED }}>{ar ? `${countAr(branch.ps.length, "موظف واحد", "موظفان", "موظفين", "موظفاً")} · ${branch.el.length} بإثبات كافٍ` : `${branch.ps.length} people · ${branch.el.length} with enough proof`}</span>
              </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <SegBar segs={branch.el.length ? segsOf(branch.a) : []} height={18} />
                  <span style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
                    {PERF_DRIVERS.map((driver) => (
                      <span key={driver.id} style={{ display: "flex", alignItems: "baseline", gap: 4, fontSize: 10, color: PERF_MUTED, whiteSpace: "nowrap" }}>
                        <span style={{ width: 8, height: 8, background: driver.color, flex: "none" }} />
                        {ar ? driver.nameAr : driver.nameEn}
                        <span dir="ltr" style={{ ...mono, color: PERF_INK }}>{branch.el.length ? `${branch.a[driver.id]}%` : "—"}</span>
          </span>
                    ))}
                  </span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  <span dir="ltr" style={{ ...mono, fontSize: 24, fontWeight: 500, color: branch.el.length ? textOf(branch.score) : PERF_MUTED, lineHeight: 1 }}>{branch.el.length ? branch.score : "—"}</span>
                  <span style={{ fontSize: 10, color: PERF_MUTED }}>{branch.el.length ? bandOf(branch.score, ar) : (ar ? "بلا إثبات" : "No proof")}</span>
                              </span>
              </div>
            ))}
            <div style={{ padding: "13px 20px" }}>
              <span style={{ fontSize: 11, color: PERF_MUTED, lineHeight: 1.95 }}>
                {view.shownBranches.length < view.branches.length
                  ? (ar ? `معروض ${view.shownBranches.length} من ${view.branches.length} فروع — حسب اختيارك أعلاه. امسح الاختيار لترى الجميع. ` : `Showing ${view.shownBranches.length} of ${view.branches.length} branches — from the pick above. Clear it to see everyone. `)
                  : (ar ? "كل الفروع معروضة — اختر فروعاً أعلاه لتقصر المقارنة عليها. " : "Every branch is shown — pick branches above to narrow the comparison. ")}
                {ar ? "والفرع يُقاس بمن أثبت عمله فيه، فالعدد مكتوب بجانبه." : "A branch is measured by who proved work there, so the count sits beside it."}
                          </span>
            </div>
          </section>
          <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderRadius: 14, display: "grid", gridTemplateColumns: `repeat(${Math.max(1, view.shownBranches.length)},minmax(0,1fr))`, gap: 0 }}>
            {view.branchData.map((branch) => (
              <div key={branch.id} style={{ padding: "16px 20px", borderInlineStart: `1px solid ${PERF_SOFT}`, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{branch.name}</span>
                  <span style={{ fontSize: 11, color: PERF_MUTED }}>{ar ? countAr(branch.ps.length, "موظف", "موظفان", "موظفين", "موظفاً") : `${branch.ps.length}`}</span>
                </div>
                {branch.ps.slice().sort((left, right) => right.score - left.score).map((person) => (
                  <div key={person.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr) 34px", gap: 9, alignItems: "center", borderBottom: `1px solid ${PERF_SOFT}`, paddingBottom: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{person.name}</span>
                    <span style={{ height: 8, background: "var(--nv-inset)", borderRadius: 999, overflow: "hidden", minWidth: 0 }}><span style={{ display: "block", height: "100%", width: `${person.score}%`, background: person.ok ? accentOf(person.score) : QUIET }} /></span>
                    <span dir="ltr" style={{ ...mono, fontSize: 12, color: person.ok ? textOf(person.score) : PERF_MUTED, textAlign: "right" }}>{person.score}</span>
                      </div>
                ))}
                        </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
