import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { visibleStations } from "@/lib/permissions";
import { readEmployeeNo } from "@/lib/employeeNumber";
import { toast } from "@/components/ui/use-toast";
import PlatformDateField from "@/components/shared/PlatformDateField";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import {
  MIN_PROOF,
  PERF_DRIVERS,
  TEAM_IDS,
  bandOf,
  countAr,
  derivePerformanceRange,
  personProofEntries,
  printPerformanceReport,
  scoreOf,
  teamLabel,
} from "@/lib/perfRange";
import PerfHowBoard from "@/components/performance/PerfHowBoard";
import { PERF_BODY, PERF_INK, PERF_LINE, PERF_MUTED, PERF_SOFT, PERF_WHITE } from "@/components/performance/PerformanceSectionFrame";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const DASH = "—";
const ACTION = "#3C7D50";
const DANGER = "#9B2335";
const GOLD = "#C8A45A";
const DRIVER_COLOR = {
  done: "#0B8A4F",
  time: "var(--nv-ink)",
  safe: GOLD,
  cover: "#8E9A93",
};

const card = {
  background: PERF_WHITE,
  border: `1px solid ${PERF_LINE}`,
  borderRadius: 14,
};

function ghostBtn(disabled = false) {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${PERF_LINE}`,
    background: disabled ? "var(--nv-soft)" : PERF_WHITE,
    color: disabled ? PERF_MUTED : PERF_INK,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };
}

function actionBtn(on) {
  return {
    ...ghostBtn(!on),
    border: "none",
    background: on ? ACTION : "var(--nv-soft)",
    color: on ? "#fff" : PERF_MUTED,
  };
}

function checkStyle(on) {
  return {
    width: 16,
    height: 16,
    borderRadius: 4,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    background: on ? ACTION : "transparent",
    border: on ? "none" : `1px solid ${PERF_LINE}`,
    boxSizing: "border-box",
  };
}

function statusOf(row, ar) {
  if (!row.ok) return { label: ar ? "إثبات ناقص" : "Short of proof", color: PERF_MUTED };
  if (row.score >= 85) return { label: bandOf(row.score, ar), color: ACTION };
  if (row.score >= 70) return { label: bandOf(row.score, ar), color: "#0B6E5F" };
  if (row.score >= 55) return { label: bandOf(row.score, ar), color: "#8A5A12" };
  return { label: bandOf(row.score, ar), color: DANGER };
}

function driverValue(ok, value) {
  return ok ? `${value}%` : DASH;
}

export default function PerfScoreBoard({
  lang,
  from,
  to,
  presets = [],
  onFrom,
  onTo,
  onPreset,
  tab = "people",
  onTab,
  cycles = [],
  goalItems = [],
  dir = "rtl",
  onlyId = "",
}) {
  const { data, currentUser, company } = useAuth();
  const ar = lang === "ar";
  const scope = useStationScope();
  const [variant, setVariant] = useState("std");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("score");
  const [sortDir, setSortDir] = useState(-1);
  const [bSort, setBSort] = useState("avg");
  const [bDir, setBDir] = useState(-1);
  const [picked, setPicked] = useState([]);
  const [pickedB, setPickedB] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [dTab, setDTab] = useState("drv");
  const [compareOn, setCompareOn] = useState(false);

  const employees = useMemo(() => {
    const list = (data?.employees || []).filter((employee) => matchesStationScope(employee.stationId, scope, data?.stations));
    if (!onlyId) return list;
    const id = String(onlyId);
    const mine = list.filter((employee) => String(employee.id) === id);
    if (mine.length) return mine;
    if (currentUser && String(currentUser.id) === id) return [currentUser];
    return [];
  }, [data?.employees, data?.stations, scope, onlyId, currentUser]);

  const stations = useMemo(() => {
      const list = currentUser && data ? visibleStations(currentUser, data) : data?.stations || [];
    const visible = list.filter((station) => matchesStationScope(station.id, scope, data?.stations));
    if (!onlyId) return visible;
    const mine = employees[0];
    const sid = String(mine?.stationId || "");
    if (!sid) return [];
    const hit = visible.filter((station) => String(station.id) === sid);
    if (hit.length) return hit;
    return [{ id: sid, name: mine?.stationName || mine?.station || "" }];
  }, [currentUser, data, scope, onlyId, employees]);

  const view = useMemo(
    () => derivePerformanceRange({
      employees,
      stations,
      data,
      from,
      to,
      selB: branchId ? [branchId] : [],
      selT: teamId ? [teamId] : [],
      selP: [],
      ar,
    }),
    [employees, stations, data, from, to, branchId, teamId, ar],
  );

  const q = query.trim();
  const people = useMemo(() => {
    const rows = (view.ranked || []).filter((row) => {
      if (variant === "low" && row.score >= 70) return false;
      if (!q) return true;
      const blob = `${row.name || ""} ${row.job || ""} ${readEmployeeNo(row)}`;
      return blob.includes(q);
    });
    const valueOf = {
      score: (row) => row.score,
      name: (row) => row.name || "",
      no: (row) => readEmployeeNo(row),
      br: (row) => row.branch || "",
      done: (row) => row.a.done,
      time: (row) => row.a.time,
      safe: (row) => row.a.safe,
      cov: (row) => row.a.cover,
    };
    const read = valueOf[sort] || valueOf.score;
    return rows.slice().sort((left, right) => {
      const a = read(left);
      const b = read(right);
      if (typeof a === "number" && typeof b === "number") return (a - b) * sortDir;
      return String(a).localeCompare(String(b), ar ? "ar" : "en") * sortDir;
    });
  }, [view.ranked, variant, q, sort, sortDir, ar]);

  const branchRows = useMemo(() => {
    const rows = (view.branchData || []).map((branch) => {
      const best = branch.el.slice().sort((left, right) => right.score - left.score)[0] || null;
      const low = branch.el.filter((row) => row.score < 55).length;
      return { ...branch, best, low };
    });
    const valueOf = {
      name: (row) => row.name || "",
      avg: (row) => (row.el.length ? row.score : -1),
      done: (row) => (row.el.length ? row.a.done : -1),
      time: (row) => (row.el.length ? row.a.time : -1),
      safe: (row) => (row.el.length ? row.a.safe : -1),
      cov: (row) => (row.el.length ? row.a.cover : -1),
      proof: (row) => (row.ps.length ? row.el.length / row.ps.length : 0),
      low: (row) => row.low,
    };
    const read = valueOf[bSort] || valueOf.avg;
    return rows.slice().sort((left, right) => {
      const a = read(left);
      const b = read(right);
      if (typeof a === "number" && typeof b === "number") return (a - b) * bDir;
      return String(a).localeCompare(String(b), ar ? "ar" : "en") * bDir;
    });
  }, [view.branchData, bSort, bDir, ar]);

  const valid = view.valid;
  const eligible = people.filter((row) => row.ok);
  const avg = valid && eligible.length ? Math.round(eligible.reduce((sum, row) => sum + row.score, 0) / eligible.length) : null;
  const highest = valid && people.length ? Math.max(...people.map((row) => row.score)) : null;
  const follow = people.filter((row) => row.ok && row.score < 55).length;
  const short = people.filter((row) => !row.ok).length;
  const openRow = people.find((row) => row.id === openId) || (view.ranked || []).find((row) => row.id === openId) || null;
  const proofs = useMemo(
    () => (openRow && valid ? personProofEntries(openRow, from, to, data) : []),
    [openRow, valid, from, to, data],
  );

  const closedRows = useMemo(() => (cycles || []).filter((cycle) => String(cycle.status) === "closed").map((cycle) => {
    const spanOk = cycle.from && cycle.to && cycle.from <= cycle.to;
    const snap = spanOk ? derivePerformanceRange({ employees, stations, data, from: cycle.from, to: cycle.to, ar }) : null;
    return {
      id: cycle.id,
      name: cycle.period || (ar ? "دورة تقييم" : "Review cycle"),
      from: cycle.from || "",
      to: cycle.to || "",
      range: [cycle.from, cycle.to].filter(Boolean).join(" → ") || DASH,
      avg: snap?.eligible?.length ? String(snap.avg) : DASH,
      n: snap ? String(snap.rowsAll.length) : DASH,
    };
  }), [cycles, employees, stations, data, ar]);

  const toggleSort = (key) => {
    setSort(key);
    setSortDir((cur) => (sort === key ? -cur : -1));
  };
  const toggleBSort = (key) => {
    setBSort(key);
    setBDir((cur) => (bSort === key ? -cur : -1));
  };
  const toggleId = (list, setList, id) => {
    setList((cur) => (cur.includes(id) ? cur.filter((item) => item !== id) : [...cur, id]));
  };

  const activeTab = onlyId && tab !== "people" && tab !== "branches" ? "people" : tab;
  const compareCount = activeTab === "branches" ? pickedB.length : picked.length;
  const compareReady = compareCount >= 2 && compareCount <= 4;
  const runCompare = () => {
    if (compareReady) {
      setCompareOn(true);
      return;
    }
    toast({
      title: activeTab === "branches"
        ? (ar ? "حدّد فرعين إلى أربعة للمقارنة." : "Pick two to four branches to compare.")
        : (ar ? "حدّد موظفين اثنين إلى أربعة للمقارنة." : "Pick two to four people to compare."),
    });
  };

  const download = () => {
    printPerformanceReport({
      ...view,
      selBNames: branchId ? [view.branches.find((row) => row.id === branchId)?.name || branchId] : [],
      selTNames: teamId ? [`${ar ? "فريق" : "Team"} ${teamLabel(teamId, ar)}`] : [],
      selPNames: [],
    }, { companyName: company?.name || "NiroVera", ar });
  };

  const clearFilters = () => {
    const preset = presets.find((row) => row.id === "q") || presets[0];
    setBranchId("");
    setTeamId("");
    setQuery("");
    setVariant("std");
    if (preset) onPreset?.(preset);
  };

  const modes = onlyId
    ? [
      { id: "people", label: ar ? "الموظفون" : "People" },
      { id: "branches", label: ar ? "الفروع" : "Branches" },
    ]
    : [
      { id: "people", label: ar ? "الموظفون" : "People" },
      { id: "branches", label: ar ? "الفروع" : "Branches" },
      { id: "how", label: ar ? "كيف تُحسب" : "How it is scored" },
      { id: "archive", label: ar ? "الأرشيف" : "Archive" },
    ];

  useEffect(() => {
    if (!onlyId || !people[0]) return;
    setOpenId(people[0].id);
  }, [onlyId, people[0]?.id]);

  const peopleHeads = [
    ["no", ar ? "الرقم" : "No."],
    ["name", ar ? "الموظف" : "Employee"],
    ["br", ar ? "الفرع" : "Branch"],
    ["done", ar ? "الإنجاز" : "Done"],
    ["time", ar ? "الموعد" : "On time"],
    ["safe", ar ? "السلامة" : "Safety"],
    ["cov", ar ? "التغطية" : "Cover"],
    ["score", ar ? "الدرجة" : "Score"],
    ["", ar ? "الحالة" : "Status"],
  ];
  const branchHeads = [
    ["name", ar ? "الفرع" : "Branch"],
    ["done", ar ? "الإنجاز" : "Done"],
    ["time", ar ? "الموعد" : "On time"],
    ["safe", ar ? "السلامة" : "Safety"],
    ["cov", ar ? "التغطية" : "Cover"],
    ["avg", ar ? "المتوسط" : "Average"],
    ["proof", ar ? "الإثبات" : "Proof"],
    ["", ar ? "الأعلى" : "Highest"],
    ["low", ar ? "متابعة" : "Follow-up"],
  ];

  const cols = "36px 78px minmax(150px,1.5fr) minmax(90px,1fr) repeat(4,68px) 64px minmax(108px,1fr)";
  const bcols = "36px minmax(140px,1.3fr) repeat(4,68px) 68px 72px minmax(120px,1.1fr) 72px";
  const cell = { display: "flex", alignItems: "center", gap: 6, padding: "0 10px", minHeight: 44, borderInlineStart: `1px solid ${PERF_SOFT}`, fontSize: 12.5, minWidth: 0 };
  const headCell = { ...cell, minHeight: 36, fontSize: 12, fontWeight: 700, color: PERF_BODY, cursor: "pointer", background: "transparent" };

  const tiles = [
    { label: ar ? "متوسط الدرجة" : "Average score", value: avg == null ? DASH : String(avg), unit: avg == null ? "" : (ar ? "من 100" : "/100"), sub: eligible.length ? (ar ? `${eligible.length} من ${people.length} مكتمل الإثبات` : `${eligible.length} of ${people.length} with enough proof`) : (ar ? `لا متوسط — لم يبلغ أحد ${MIN_PROOF} مهام مثبتة` : `No average — no one reached ${MIN_PROOF} proven tasks`), color: PERF_INK },
    { label: ar ? "الأعلى" : "Highest", value: highest == null ? DASH : String(highest), unit: "", sub: ar ? "في النطاق المحدد" : "In the current filter", color: ACTION },
    { label: ar ? "يحتاج متابعة" : "Needs follow-up", value: valid ? String(follow) : DASH, unit: ar ? "موظف" : "", sub: ar ? "درجة أقل من 55" : "Score under 55", color: DANGER },
    { label: ar ? "إثبات ناقص" : "Short of proof", value: valid ? String(short) : DASH, unit: ar ? "موظف" : "", sub: ar ? "لا يدخل المتوسط" : "Kept out of the average", color: "#8A5A12" },
    { label: ar ? "الأشهر في المدى" : "Months in range", value: valid ? String(view.months.length) : DASH, unit: ar ? "شهر" : "", sub: valid ? `${from} → ${to}` : DASH, color: PERF_INK },
  ];

  const allPeopleOn = people.length > 0 && people.every((row) => picked.includes(row.id));
  const allBranchesOn = branchRows.length > 0 && branchRows.every((row) => pickedB.includes(row.id));

  const compareSet = activeTab === "branches"
    ? branchRows.filter((row) => pickedB.includes(row.id)).slice(0, 4).map((row) => ({
      id: row.id,
      title: row.name,
      sub: ar ? `${row.el.length} من ${row.ps.length} موظفين` : `${row.el.length} of ${row.ps.length}`,
      drivers: PERF_DRIVERS.map((driver) => (row.el.length ? row.a[driver.id] : null)),
      score: row.el.length ? row.score : null,
    }))
    : (view.ranked || []).filter((row) => picked.includes(row.id)).slice(0, 4).map((row) => ({
      id: row.id,
      title: row.name,
      sub: `${row.branch || DASH} · ${row.job || DASH}`,
      drivers: PERF_DRIVERS.map((driver) => row.a[driver.id]),
      score: row.score,
    }));

  const fieldLabel = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: PERF_BODY, fontWeight: 600 };
  const fieldInput = {
    height: 32,
    padding: "0 8px",
    borderRadius: 8,
    border: `1px solid ${PERF_LINE}`,
    background: PERF_WHITE,
    color: PERF_INK,
    fontSize: 13,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div data-perf-face={onlyId ? "self" : "manage"} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section data-perf-card style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${PERF_SOFT}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 220 }}>
            <span style={{ fontSize: 11, color: PERF_MUTED }}>{ar ? "الأداء · تقرير المقارنة" : "Performance · comparison"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 17, color: PERF_INK }}>{ar ? "مقارنة أداء الموظفين" : "Compare performance"}</strong>
              <select className="nv-perf-search" value={variant} onChange={(event) => setVariant(event.target.value)} style={{ ...fieldInput, width: "auto", height: 28, border: "none", background: "transparent", color: ACTION, fontWeight: 700, padding: 0 }}>
                <option value="std">{ar ? "عرض: قياسي" : "View: standard"}</option>
                <option value="drv">{ar ? "عرض: المحرّكات" : "View: drivers"}</option>
                <option value="low">{ar ? "عرض: يحتاج متابعة" : "View: needs follow-up"}</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", border: `1px solid ${PERF_LINE}`, borderRadius: 8, overflow: "hidden" }}>
              {modes.map((mode) => {
                const on = activeTab === mode.id;
                return (
                  <button key={mode.id} type="button" onClick={() => { onTab?.(mode.id); setCompareOn(false); }} style={{ height: 32, padding: "0 12px", border: "none", background: on ? ACTION : PERF_WHITE, color: on ? "#fff" : PERF_INK, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <button type="button" style={ghostBtn()} onClick={() => setFiltersOpen((cur) => !cur)}>{filtersOpen ? (ar ? "إخفاء التصفية" : "Hide filters") : (ar ? "التصفية" : "Filters")}</button>
            <button type="button" style={ghostBtn()} onClick={download} title={ar ? "طباعة / حفظ PDF" : "Print / save PDF"}>{ar ? "طباعة" : "Print"}</button>
            <button type="button" style={actionBtn(compareReady)} onClick={runCompare}>
              {activeTab === "branches"
                ? (ar ? `قارن الفروع (${pickedB.length})` : `Compare branches (${pickedB.length})`)
                : (ar ? `قارن الموظفين (${picked.length})` : `Compare people (${picked.length})`)}
            </button>
          </div>
              </div>

        {filtersOpen ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px", background: "var(--nv-soft)", borderBottom: `1px solid ${PERF_SOFT}` }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {presets.map((preset) => {
                const on = from === preset.from && to === preset.to;
                return (
                  <button key={preset.id} type="button" className="nv-perf-chip" onClick={() => onPreset?.(preset)} style={{ ...ghostBtn(), height: 28, background: on ? ACTION : PERF_WHITE, color: on ? "#fff" : PERF_INK, borderColor: on ? ACTION : PERF_LINE }}>
                    {ar ? preset.labelAr : preset.labelEn}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, alignItems: "end" }}>
              <label style={fieldLabel}>
                {ar ? "من تاريخ" : "From"}
                <PlatformDateField compact ar={ar} value={from} onChange={onFrom} />
              </label>
              <label style={fieldLabel}>
                {ar ? "إلى تاريخ" : "To"}
                <PlatformDateField compact ar={ar} value={to} min={from} onChange={onTo} />
              </label>
              <label style={fieldLabel}>
                {ar ? "الفرع" : "Branch"}
                <select className="nv-perf-search" value={branchId} onChange={(event) => setBranchId(event.target.value)} style={fieldInput}>
                  <option value="">{ar ? "كل الفروع" : "All branches"}</option>
                  {view.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || DASH}</option>)}
                </select>
              </label>
              <label style={fieldLabel}>
                {ar ? "الفريق" : "Team"}
                <select className="nv-perf-search" value={teamId} onChange={(event) => setTeamId(event.target.value)} style={fieldInput}>
                  <option value="">{ar ? "الكل" : "All"}</option>
                  {TEAM_IDS.map((id) => <option key={id} value={id}>{teamLabel(id, ar)}</option>)}
                </select>
              </label>
              <label style={fieldLabel}>
                {ar ? "الموظف" : "Employee"}
                <input className="nv-perf-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "الاسم أو الرقم الوظيفي" : "Name or employee number"} style={fieldInput} />
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={ghostBtn()} onClick={clearFilters}>{ar ? "مسح" : "Clear"}</button>
                <button type="button" style={actionBtn(true)} onClick={() => toast({ title: ar ? `طُبّقت التصفية · ${people.length} نتيجة` : `Filter applied · ${people.length}` })}>{ar ? "تطبيق" : "Apply"}</button>
              </div>
            </div>
            {!valid ? <span style={{ fontSize: 12, color: DANGER }}>{ar ? "تاريخ البداية بعد النهاية — صحّح المدى ليُحسب شيء." : "The start is after the end — correct the range so a score can be derived."}</span> : null}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          {tiles.map((tile, index) => (
            <div key={tile.label} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "12px 16px", borderInlineStart: index ? `1px solid ${PERF_SOFT}` : "none" }}>
              <span style={{ fontSize: 12, color: PERF_MUTED }}>{tile.label}</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <strong dir="ltr" style={{ ...mono, fontSize: 24, fontWeight: 700, color: tile.color, lineHeight: 1.15 }}>{tile.value}</strong>
                {tile.unit ? <span style={{ fontSize: 11, color: PERF_MUTED }}>{tile.unit}</span> : null}
              </span>
              <span style={{ fontSize: 11, color: PERF_BODY }}>{tile.sub}</span>
            </div>
          ))}
        </div>
      </section>

      {activeTab === "people" ? (
        <div style={{ display: "grid", gridTemplateColumns: openRow ? "repeat(auto-fit,minmax(min(100%,560px),1fr))" : "minmax(0,1fr)", gap: 12, alignItems: "start" }}>
          <section data-perf-card style={{ ...card, minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${PERF_SOFT}`, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{ar ? "الموظفون" : "People"} <span style={{ fontWeight: 500, color: PERF_MUTED }}>({people.length})</span></strong>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: PERF_MUTED }}>{ar ? "ترتيب:" : "Sort:"}</span>
              {[["score", ar ? "الدرجة" : "Score"], ["name", ar ? "الاسم" : "Name"], ["done", ar ? "الإنجاز" : "Done"]].map(([id, label]) => (
                <button key={id} type="button" className="nv-perf-chip" onClick={() => toggleSort(id)} style={{ ...ghostBtn(), height: 28, background: sort === id ? "color-mix(in oklab, #3C7D50 16%, var(--nv-card))" : PERF_WHITE, color: sort === id ? ACTION : PERF_BODY, borderColor: sort === id ? ACTION : PERF_LINE }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 860 }}>
                <div style={{ display: "grid", gridTemplateColumns: cols, background: "var(--nv-soft)", borderBottom: `1px solid ${PERF_LINE}` }}>
                  <button type="button" onClick={() => setPicked(allPeopleOn ? [] : people.map((row) => row.id))} style={{ ...headCell, justifyContent: "center", border: "none" }}><span style={checkStyle(allPeopleOn)}>{allPeopleOn ? "✓" : ""}</span></button>
                  {peopleHeads.map(([id, label]) => (
                    <button key={label} type="button" onClick={() => id && toggleSort(id)} style={{ ...headCell, border: "none", cursor: id ? "pointer" : "default" }}>
                      {label}
                      <span style={{ color: ACTION }}>{id && sort === id ? (sortDir < 0 ? " ▼" : " ▲") : ""}</span>
                    </button>
                  ))}
                </div>
                {people.map((row) => {
                  const on = picked.includes(row.id);
                  const opened = openId === row.id;
                  const status = statusOf(row, ar);
                  const number = readEmployeeNo(row);
                  return (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenId(row.id)}
                      onKeyDown={(event) => { if (event.key === "Enter") setOpenId(row.id); }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: cols,
                        borderBottom: `1px solid ${PERF_SOFT}`,
                        cursor: "pointer",
                        background: opened ? "color-mix(in oklab, #3C7D50 16%, var(--nv-card))" : on ? "color-mix(in oklab, #3C7D50 8%, var(--nv-card))" : PERF_WHITE,
                        boxShadow: opened ? "inset -3px 0 0 #3C7D50" : "none",
                        color: row.ok ? PERF_INK : PERF_MUTED,
                      }}
                    >
                      <span
                        role="presentation"
                        onClick={(event) => { event.stopPropagation(); toggleId(picked, setPicked, row.id); }}
                        style={{ ...cell, justifyContent: "center" }}
                      >
                        <span style={checkStyle(on)}>{on ? "✓" : ""}</span>
                      </span>
                      <span dir="ltr" style={{ ...cell, ...mono, color: PERF_MUTED }}>{number || DASH}</span>
                      <span style={{ ...cell, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 0, lineHeight: 1.35 }}>
                        <strong style={{ fontSize: 13, color: ACTION }}>{row.name || DASH}</strong>
                        <span style={{ fontSize: 11, color: PERF_MUTED }}>{[row.job, teamLabel(row.team, ar)].filter(Boolean).join(" · ") || DASH}</span>
                      </span>
                      <span style={cell}>{row.branch || DASH}</span>
                {PERF_DRIVERS.map((driver) => (
                        <span key={driver.id} dir="ltr" style={{ ...cell, ...mono, color: row.a[driver.id] < 45 ? DANGER : PERF_INK, fontWeight: row.a[driver.id] < 45 ? 700 : 500, background: variant === "drv" ? `color-mix(in oklab, ${DRIVER_COLOR[driver.id]} 22%, var(--nv-card))` : "transparent" }}>
                          {row.a[driver.id]}%
                  </span>
                ))}
                      <span dir="ltr" style={{ ...cell, ...mono, fontWeight: 700 }}>{row.score}</span>
                      <span style={cell}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: status.color }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: status.color }} />
                          {status.label}
                        </span>
            </span>
          </div>
                  );
                })}
                {!people.length ? <div style={{ padding: 24, textAlign: "center", color: PERF_MUTED }}>{ar ? "لا نتائج — غيّر عوامل التصفية." : "No results — change the filters."}</div> : null}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderTop: `1px solid ${PERF_SOFT}`, background: "var(--nv-soft)", fontSize: 12, color: PERF_MUTED, flexWrap: "wrap" }}>
              <span>{ar ? `المتوسط يحتسب من بلغ ${MIN_PROOF} مهام مثبتة فقط · الأوزان من وصف الوظيفة` : `The average counts only people with ${MIN_PROOF} proven tasks · weights come from the job`}</span>
              <span dir="ltr" style={mono}>{people.length ? `1–${people.length} / ${people.length}` : DASH}</span>
            </div>
          </section>

          {openRow ? (
            <aside data-perf-card style={{ ...card, position: "sticky", top: 12, maxWidth: 420, width: "100%", justifySelf: "end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${PERF_SOFT}`, background: "var(--nv-soft)" }}>
                <span style={{ width: 40, height: 40, borderRadius: 8, background: ACTION, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flex: "none" }}>{(openRow.name || DASH).trim().slice(0, 1)}</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
                  <strong style={{ fontSize: 14 }}>{openRow.name || DASH}</strong>
                  <span style={{ fontSize: 12, color: PERF_MUTED }}>{[readEmployeeNo(openRow) || DASH, openRow.job || DASH, openRow.branch || DASH].join(" · ")}</span>
                </div>
                <button type="button" onClick={() => setOpenId(null)} style={{ ...ghostBtn(), width: 32, padding: 0, justifyContent: "center" }} aria-label={ar ? "إغلاق" : "Close"}>×</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${PERF_SOFT}` }}>
                <div style={{ padding: "12px 14px", borderInlineEnd: `1px solid ${PERF_SOFT}`, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 11, color: PERF_MUTED }}>{ar ? "الدرجة" : "Score"}</span>
                  <strong dir="ltr" style={{ ...mono, fontSize: 26, lineHeight: 1.2 }}>{openRow.score}</strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusOf(openRow, ar).color }}>{statusOf(openRow, ar).label}</span>
                </div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 11, color: PERF_MUTED }}>{ar ? "الإثبات في المدى" : "Proof in range"}</span>
                  <strong dir="ltr" style={{ ...mono, fontSize: 26, lineHeight: 1.2 }}>{openRow.a.proof}</strong>
                  <span style={{ fontSize: 11, color: PERF_MUTED }}>{ar ? `مهام معتمدة · الحد ${MIN_PROOF}` : `Approved tasks · floor ${MIN_PROOF}`}</span>
                  </div>
              </div>
              <div style={{ display: "flex", borderBottom: `1px solid ${PERF_SOFT}` }}>
                {[["drv", ar ? "المحرّكات" : "Drivers"], ["trend", ar ? "المسار" : "Months"], ["log", ar ? "الأدلة" : "Proof"]].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setDTab(id)} style={{ flex: 1, height: 38, border: "none", background: dTab === id ? ACTION : "transparent", color: dTab === id ? "#fff" : PERF_BODY, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                    {label}
                  </button>
                ))}
              </div>
              {dTab === "drv" ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 52px 52px 52px", gap: 8, padding: "8px 14px", background: "var(--nv-soft)", fontSize: 11, fontWeight: 700, color: PERF_BODY }}>
                    <span>{ar ? "المحرّك" : "Driver"}</span><span>{ar ? "النسبة" : "Share"}</span><span>{ar ? "الوزن" : "Weight"}</span><span>{ar ? "النقاط" : "Points"}</span>
                  </div>
                  {PERF_DRIVERS.map((driver) => {
                    const share = openRow.a[driver.id];
                    const points = Math.round((share * driver.w) / 100);
                    return (
                      <div key={driver.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 52px 52px 52px", gap: 8, padding: "9px 14px", borderTop: `1px solid ${PERF_SOFT}`, fontSize: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span>{ar ? driver.nameAr : driver.nameEn}</span>
                          <div style={{ height: 4, background: "var(--nv-inset)", borderRadius: 999 }}><div style={{ height: "100%", width: `${share}%`, background: DRIVER_COLOR[driver.id] || ACTION, borderRadius: 999 }} /></div>
                        </div>
                        <span dir="ltr" style={mono}>{share}%</span>
                        <span dir="ltr" style={{ ...mono, color: PERF_MUTED }}>{driver.w}%</span>
                        <strong dir="ltr" style={{ ...mono, color: ACTION }}>+{points}</strong>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderTop: `1px solid ${PERF_LINE}`, background: "var(--nv-soft)", fontSize: 13 }}>
                    <strong>{ar ? "المجموع" : "Total"}</strong>
                    <strong dir="ltr" style={mono}>{openRow.score}</strong>
                  </div>
                </div>
              ) : null}
              {dTab === "trend" ? (
                <div style={{ padding: "8px 14px 12px" }}>
                  {view.months.length ? view.months.map((key) => {
                    const facts = openRow.months?.[key];
                    const monthScore = facts ? scoreOf(facts) : null;
                    return (
                      <div key={key} style={{ display: "grid", gridTemplateColumns: "88px minmax(0,1fr) 36px", gap: 10, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${PERF_SOFT}`, fontSize: 12 }}>
                        <span>{view.monthName(key) || DASH}</span>
                        <div style={{ height: 10, background: "var(--nv-inset)", borderRadius: 999 }}>{monthScore != null ? <div style={{ height: "100%", width: `${monthScore}%`, background: ACTION, borderRadius: 999 }} /> : null}</div>
                        <strong dir="ltr" style={mono}>{monthScore == null ? DASH : monthScore}</strong>
                      </div>
                    );
                  }) : <div style={{ padding: "12px 0", color: PERF_MUTED }}>{DASH}</div>}
            </div>
              ) : null}
              {dTab === "log" ? (
                <div style={{ padding: "4px 14px 12px" }}>
                  {proofs.length ? proofs.map((row) => (
                    <Link key={row.id} to={row.href} style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr)", gap: 10, padding: "8px 0", borderTop: `1px solid ${PERF_SOFT}`, fontSize: 12, textDecoration: "none", color: "inherit" }}>
                      <span dir="ltr" style={{ ...mono, color: PERF_MUTED }}>{row.at || DASH}</span>
                      <span style={{ color: ACTION, fontWeight: 600 }}>{row.title || DASH}</span>
                    </Link>
                  )) : <div style={{ padding: "12px 0", color: PERF_MUTED }}>{DASH}</div>}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: `1px solid ${PERF_SOFT}`, background: "var(--nv-soft)", alignItems: "center" }}>
                <button type="button" style={ghostBtn()} onClick={() => {
                  const one = derivePerformanceRange({ employees: [openRow], stations, data, from, to, ar });
                  printPerformanceReport(one, { companyName: company?.name || "NiroVera", ar });
                }}>{ar ? "تقرير الموظف" : "Person report"}</button>
                <span style={{ flex: 1 }} />
                <Link to="/app/requests" style={{ color: ACTION, fontWeight: 700, fontSize: 12 }}>{ar ? "اعتراض من الطلبات ←" : "Object from requests"}</Link>
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}

      {!onlyId && activeTab === "how" ? <PerfHowBoard lang={lang} /> : null}

      {!onlyId && activeTab === "archive" ? (
        <section data-perf-card style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${PERF_SOFT}` }}>
            <strong style={{ fontSize: 14 }}>{ar ? "الدورات المغلقة" : "Closed cycles"}</strong>
            <span style={{ fontSize: 12, color: PERF_MUTED, marginInlineStart: 8 }}>{ar ? "للقراءة فقط · لا تُعدّل بعد الإغلاق" : "Read only · a closed cycle is not edited"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.2fr) minmax(0,1fr) 90px 90px 110px", background: "var(--nv-soft)", borderBottom: `1px solid ${PERF_LINE}`, fontSize: 12, fontWeight: 700, color: PERF_BODY }}>
            {[ar ? "الدورة" : "Cycle", ar ? "المدى" : "Range", ar ? "المتوسط" : "Average", ar ? "الموظفون" : "People", ""].map((label) => (
              <span key={label || "open"} style={{ padding: "9px 12px", borderInlineStart: label === (ar ? "الدورة" : "Cycle") ? "none" : `1px solid ${PERF_SOFT}` }}>{label}</span>
            ))}
          </div>
          {closedRows.length ? closedRows.map((row) => (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.2fr) minmax(0,1fr) 90px 90px 110px", borderBottom: `1px solid ${PERF_SOFT}`, fontSize: 13, alignItems: "center" }}>
              <strong style={{ padding: "10px 12px" }}>{row.name || DASH}</strong>
              <span dir="ltr" style={{ ...mono, padding: "10px 12px", borderInlineStart: `1px solid ${PERF_SOFT}`, textAlign: "end" }}>{row.range}</span>
              <span dir="ltr" style={{ ...mono, padding: "10px 12px", borderInlineStart: `1px solid ${PERF_SOFT}`, fontWeight: 700 }}>{row.avg}</span>
              <span dir="ltr" style={{ ...mono, padding: "10px 12px", borderInlineStart: `1px solid ${PERF_SOFT}` }}>{row.n}</span>
              <button type="button" onClick={() => { if (row.from && row.to) { onFrom?.(row.from); onTo?.(row.to); onTab?.("people"); } }} style={{ margin: "8px 12px", ...ghostBtn(!(row.from && row.to)), color: ACTION, border: "none", background: "transparent" }}>{ar ? "افتح ←" : "Open"}</button>
            </div>
          )) : <div style={{ padding: "16px 14px", color: PERF_MUTED }}>{DASH}</div>}
          <div style={{ padding: 14 }}>
            <RecordSmartArchive
              items={goalItems}
              lang={ar ? "ar" : "en"}
              dir={dir}
              emptyLabel={ar ? "لا أهداف منجزة في هذا النطاق." : "No completed goals in this scope."}
            />
            </div>
          </section>
      ) : null}

      {activeTab === "branches" ? (
        <section data-perf-card style={{ ...card, minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${PERF_SOFT}`, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>{ar ? "الفروع" : "Branches"} <span style={{ fontWeight: 500, color: PERF_MUTED }}>({branchRows.length})</span></strong>
            <span style={{ fontSize: 12, color: PERF_MUTED }}>{ar ? "المتوسط من الموظفين مكتملي الإثبات · حدّد فرعين إلى أربعة للمقارنة" : "Average of people with enough proof · pick two to four branches"}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 920 }}>
              <div style={{ display: "grid", gridTemplateColumns: bcols, background: "var(--nv-soft)", borderBottom: `1px solid ${PERF_LINE}` }}>
                <button type="button" onClick={() => setPickedB(allBranchesOn ? [] : branchRows.map((row) => row.id))} style={{ ...headCell, justifyContent: "center", border: "none" }}><span style={checkStyle(allBranchesOn)}>{allBranchesOn ? "✓" : ""}</span></button>
                {branchHeads.map(([id, label]) => (
                  <button key={label} type="button" onClick={() => id && toggleBSort(id)} style={{ ...headCell, border: "none" }}>
                    {label}
                    <span style={{ color: ACTION }}>{id && bSort === id ? (bDir < 0 ? " ▼" : " ▲") : ""}</span>
                  </button>
                ))}
            </div>
              {branchRows.map((row) => {
                const on = pickedB.includes(row.id);
                return (
                  <div key={row.id} style={{ display: "grid", gridTemplateColumns: bcols, borderBottom: `1px solid ${PERF_SOFT}`, background: on ? "color-mix(in oklab, #3C7D50 10%, var(--nv-card))" : PERF_WHITE }}>
                    <button type="button" onClick={() => toggleId(pickedB, setPickedB, row.id)} style={{ ...cell, justifyContent: "center", border: "none", background: "transparent", cursor: "pointer" }}><span style={checkStyle(on)}>{on ? "✓" : ""}</span></button>
                    <button type="button" onClick={() => { setBranchId(row.id); onTab?.("people"); setCompareOn(false); }} style={{ ...cell, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 0, lineHeight: 1.35, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
                      <strong style={{ fontSize: 13, color: ACTION }}>{row.name || DASH}</strong>
                      <span style={{ fontSize: 11, color: PERF_MUTED }}>{ar ? countAr(row.ps.length, "موظف واحد", "موظفان", "موظفين", "موظفاً", "لا أحد") : `${row.ps.length}`}</span>
                    </button>
                    {PERF_DRIVERS.map((driver) => (
                      <span key={driver.id} dir="ltr" style={{ ...cell, ...mono, background: variant === "drv" && row.el.length ? `color-mix(in oklab, ${DRIVER_COLOR[driver.id]} 22%, var(--nv-card))` : "transparent" }}>{driverValue(row.el.length, row.a[driver.id])}</span>
                    ))}
                    <span dir="ltr" style={{ ...cell, ...mono, fontWeight: 700 }}>{row.el.length ? row.score : DASH}</span>
                    <span dir="ltr" style={{ ...cell, ...mono }}>{row.ps.length ? `${row.el.length}/${row.ps.length}` : DASH}</span>
                    <span style={{ ...cell, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 0, lineHeight: 1.35 }}>
                      <span style={{ fontSize: 12 }}>{row.best?.name || DASH}</span>
                      <span style={{ fontSize: 11, color: PERF_MUTED }}>{row.best ? `${row.best.score} · ${row.best.job || DASH}` : DASH}</span>
                  </span>
                    <span dir="ltr" style={{ ...cell, ...mono, fontWeight: 700, color: row.low ? DANGER : ACTION }}>{row.low}</span>
                  </div>
                );
              })}
              {!branchRows.length ? <div style={{ padding: 24, textAlign: "center", color: PERF_MUTED }}>{DASH}</div> : null}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderTop: `1px solid ${PERF_SOFT}`, background: "var(--nv-soft)", fontSize: 12, color: PERF_MUTED, flexWrap: "wrap" }}>
            <span>{ar ? "انقر اسم الفرع لعرض موظفيه" : "Click a branch name to see its people"}</span>
            <span>{ar ? "متوسط كل الفروع:" : "Average of every branch:"} <strong dir="ltr" style={{ ...mono, color: PERF_INK }}>{view.eligible.length ? view.avg : DASH}</strong></span>
          </div>
        </section>
      ) : null}

      {compareOn && compareSet.length >= 2 ? (
        <section data-perf-card style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${PERF_SOFT}` }}>
            <strong style={{ fontSize: 14 }}>{activeTab === "branches" ? (ar ? "مقارنة الفروع" : "Branch comparison") : (ar ? "مقارنة الموظفين" : "People comparison")}</strong>
            <span style={{ fontSize: 12, color: PERF_MUTED }}>{ar ? "الفارق مقابل الأعلى بين المحدد · ★ الأعلى" : "Gap against the highest of the pick · ★ leads"}</span>
            <span style={{ flex: 1 }} />
            <button type="button" style={ghostBtn()} onClick={() => setCompareOn(false)}>{ar ? "إغلاق" : "Close"}</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `minmax(120px,1fr) repeat(${compareSet.length},minmax(140px,1fr))`, minWidth: 160 + compareSet.length * 150 }}>
              <span style={{ padding: "8px 12px", background: "var(--nv-soft)", fontSize: 12, fontWeight: 700, color: PERF_BODY }}>{ar ? "المحرّك" : "Driver"}</span>
              {compareSet.map((col) => (
                <span key={col.id} style={{ padding: "8px 12px", background: "var(--nv-soft)", display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
                  <strong style={{ fontSize: 12 }}>{col.title || DASH}</strong>
                  <span style={{ fontSize: 11, color: PERF_MUTED, fontWeight: 500 }}>{col.sub || DASH}</span>
                </span>
              ))}
              {PERF_DRIVERS.map((driver, index) => {
                const values = compareSet.map((col) => col.drivers[index]);
                const numeric = values.filter((value) => value != null);
                const best = numeric.length ? Math.max(...numeric) : null;
                return (
                  <React.Fragment key={driver.id}>
                    <span style={{ padding: "8px 12px", borderTop: `1px solid ${PERF_SOFT}`, fontSize: 12 }}>{ar ? driver.nameAr : driver.nameEn}</span>
                    {compareSet.map((col, colIndex) => {
                      const value = values[colIndex];
                      const gap = value == null || best == null ? null : best - value;
                      return (
                        <span key={col.id} dir="ltr" style={{ padding: "8px 12px", borderTop: `1px solid ${PERF_SOFT}`, ...mono, fontWeight: 600, color: value == null ? PERF_MUTED : gap ? (gap >= 15 ? DANGER : PERF_BODY) : ACTION, background: value != null && !gap ? "color-mix(in oklab, #3C7D50 14%, var(--nv-card))" : "transparent" }}>
                          {value == null ? DASH : `${value}%${gap ? `  (−${gap})` : "  ★"}`}
                              </span>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              <span style={{ padding: "8px 12px", borderTop: `1px solid ${PERF_SOFT}`, fontSize: 12, fontWeight: 700 }}>{activeTab === "branches" ? (ar ? "المتوسط" : "Average") : (ar ? "الدرجة" : "Score")}</span>
              {compareSet.map((col) => {
                const numeric = compareSet.map((item) => item.score).filter((value) => value != null);
                const best = numeric.length ? Math.max(...numeric) : null;
                const gap = col.score == null || best == null ? null : best - col.score;
                return (
                  <span key={col.id} dir="ltr" style={{ padding: "8px 12px", borderTop: `1px solid ${PERF_SOFT}`, ...mono, fontWeight: 700, color: col.score == null ? PERF_MUTED : gap ? PERF_BODY : ACTION }}>
                    {col.score == null ? DASH : `${col.score}${gap ? `  (−${gap})` : "  ★"}`}
                          </span>
                );
              })}
            </div>
                        </div>
          </section>
      ) : null}
    </div>
  );
}
