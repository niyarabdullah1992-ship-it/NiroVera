import React, { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ChevronDown, ChevronLeft, ChevronRight, Download, Printer, Rows3, Rows4, Search, X } from "lucide-react";
import { printSheet } from "@/lib/printSheet";
import { formatDateTime, formatMonthYear } from "@/lib/dateFormat";
import { peopleQueryMatches } from "@/lib/peopleTreeGraph";
import {
  ARCHIVE_GROUPINGS,
  ARCHIVE_PERIODS,
  archiveCsv,
  archiveFacet,
  archiveHighlight,
  archiveHistogram,
  archiveMonthKey,
  archiveOutcomes,
  archiveTone,
  groupArchiveBy,
  inArchivePeriod,
} from "@/lib/archiveFacts";

/**
 * الأرشيف — one archive for every section, built to stay readable at hundreds of records:
 * a twelve-month map on the head (where the records sit, click a month to read it),
 * only the newest group open, the rest folded to one summary line, compact rows by default,
 * grouping by month / person / branch / outcome, filters that stack as removable chips,
 * search that marks what it found, and a side preview that keeps your place in the list.
 */

const DK = { bg: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", soft: "#C5DBCD", faint: "#A9CDB8", line: "rgba(255,255,255,.14)", gold: "#C8A45A" };
const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };
const GROUP_PAGE = 30;
const DENSITY_KEY = "nv_archive_density";

const TONE = {
  ok: { ink: "var(--nv-ok-ink)", bg: "var(--nv-ok-soft)", line: "var(--nv-ok-line)", dot: "#0F5535", onDark: "#7FD1A3" },
  bad: { ink: "var(--nv-bad-ink)", bg: "var(--nv-bad-soft)", line: "var(--nv-bad-line)", dot: "var(--nv-bad-fill)", onDark: "#F4A3A3" },
  warn: { ink: "var(--nv-warn-ink)", bg: "var(--nv-warn-soft)", line: "var(--nv-warn-line)", dot: "#C8A45A", onDark: "#C8A45A" },
  mute: { ink: "var(--nv-ink2)", bg: "var(--nv-soft)", line: "var(--nv-line)", dot: "var(--nv-muted)", onDark: "#A9CDB8" },
};

export function archiveItemSearchHay(it) {
  return [it?.title, it?.text, it?.badge, it?.person, it?.branch, it?.search, it?.hay, it?.date].filter(Boolean).join(" ");
}

function dayParts(date, lang) {
  const d = date ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const ar = lang === "ar";
  return {
    day: d.getDate(),
    dm: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
    week: d.toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "short" }),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

function monthShort(key, ar) {
  return new Date(`${key}-01T12:00:00`).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { month: "short" });
}

function readDensity() {
  try { return localStorage.getItem(DENSITY_KEY) === "comfy" ? "comfy" : "compact"; } catch { return "compact"; }
}

function Marked({ text, query }) {
  const parts = archiveHighlight(text, query);
  return parts.map((p, i) => (p.hit
    ? <mark key={i} style={{ background: "#F3E3BC", color: "inherit", borderRadius: 3, padding: "0 1px" }}>{p.text}</mark>
    : <React.Fragment key={i}>{p.text}</React.Fragment>));
}

function TonePill({ badge, tone }) {
  if (!badge) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 21, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: tone.ink, background: tone.bg, border: `1px solid ${tone.line}`, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{badge}</span>
  );
}

/** Stacked bar of a group's outcomes — read a folded month without opening it. */
function OutcomeStrip({ rows }) {
  const outs = archiveOutcomes(rows);
  const total = rows.length || 1;
  if (!outs.length) return null;
  return (
    <span aria-hidden style={{ display: "inline-flex", width: 72, height: 6, borderRadius: 999, overflow: "hidden", background: "var(--nv-line2, #EEF1EF)", flexShrink: 0 }}>
      {outs.map((o) => <span key={o.badge} style={{ width: `${(o.count / total) * 100}%`, background: (TONE[o.tone] || TONE.mute).dot }} />)}
    </span>
  );
}

export default function RecordSmartArchive({
  items,
  lang,
  dir,
  emptyLabel,
  noMatchLabel,
  onOpen,
  query: queryProp,
  onQueryChange,
  skipFilter = false,
  searchPlaceholder,
  meta,
  kicker,
  title,
  subtitle,
  renderOpen,
  exportName,
  printRecord,
}) {
  const ar = lang === "ar";
  const [innerQuery, setInnerQuery] = useState("");
  const query = queryProp !== undefined ? queryProp : innerQuery;
  const setQuery = (value) => {
    onQueryChange?.(value);
    if (queryProp === undefined) setInnerQuery(value);
  };
  const [period, setPeriod] = useState("all");
  const [monthPick, setMonthPick] = useState("");
  const [outcome, setOutcome] = useState("");
  const [person, setPerson] = useState("");
  const [branch, setBranch] = useState("");
  const [groupBy, setGroupBy] = useState("month");
  const [density, setDensityState] = useState(readDensity);
  const [folded, setFolded] = useState({});
  const [groupLimit, setGroupLimit] = useState({});
  const [previewId, setPreviewId] = useState("");
  const listRef = useRef(null);

  const setDensity = (v) => {
    setDensityState(v);
    try { localStorage.setItem(DENSITY_KEY, v); } catch { /* per-viewer convenience only */ }
  };

  const source = items || [];
  const outcomes = useMemo(() => archiveOutcomes(source), [source]);
  const people = useMemo(() => archiveFacet(source, "person"), [source]);
  const branches = useMemo(() => archiveFacet(source, "branch"), [source]);
  const histogram = useMemo(() => archiveHistogram(source), [source]);
  const histMax = Math.max(1, ...histogram.map((h) => h.count));
  const thisMonth = histogram[histogram.length - 1]?.count || 0;

  const filtered = source.filter((it) => (skipFilter || peopleQueryMatches(archiveItemSearchHay(it), query))
    && inArchivePeriod(it?.date, period)
    && (!monthPick || archiveMonthKey(it?.date) === monthPick)
    && (!outcome || String(it?.badge || "").trim() === outcome)
    && (!person || String(it?.person || "").trim() === person)
    && (!branch || String(it?.branch || "").trim() === branch));

  const groupings = ARCHIVE_GROUPINGS.filter((g) => (g.id === "person" ? people.length > 1 : g.id === "branch" ? branches.length > 1 : g.id === "outcome" ? outcomes.length > 1 : true));
  const by = groupings.some((g) => g.id === groupBy) ? groupBy : "month";
  const groups = groupArchiveBy(filtered, by);
  const narrowed = !!(query || monthPick || outcome || person || branch || period !== "all");
  // Folded by default: only the first group opens — unless the reader already narrowed, or there is little to read.
  const openByDefault = (i) => narrowed || filtered.length <= 15 || i === 0;
  const isOpen = (key, i) => (folded[`${by}:${key}`] !== undefined ? !folded[`${by}:${key}`] : openByDefault(i));
  const toggleGroup = (key, i) => setFolded((m) => ({ ...m, [`${by}:${key}`]: isOpen(key, i) }));

  const visibleRows = groups.flatMap((g, i) => (isOpen(g.key, i) ? g.rows.slice(0, groupLimit[`${by}:${g.key}`] || GROUP_PAGE) : []));
  const previewIdx = visibleRows.findIndex((it) => it.id === previewId);
  const preview = previewIdx >= 0 ? visibleRows[previewIdx] : null;

  const hasPerson = people.length > 0;
  const hasBranch = branches.length > 0;
  const compact = density === "compact";
  const cols = [
    "58px",
    "minmax(0, 1.6fr)",
    ...(hasPerson && by !== "person" ? ["minmax(0, .8fr)"] : []),
    ...(hasBranch && by !== "branch" ? ["minmax(0, .7fr)"] : []),
    "minmax(92px, auto)",
    "44px",
  ].join(" ");

  const groupLabel = (key) => {
    if (key === "none") {
      return { month: ar ? "بلا تاريخ" : "Undated", person: ar ? "بلا اسم" : "No name", branch: ar ? "بلا فرع" : "No branch", outcome: ar ? "بلا نتيجة" : "No outcome" }[by];
    }
    return by === "month" ? formatMonthYear(`${key}-01T12:00:00`, lang) : key;
  };

  const clearAll = () => { setQuery(""); setPeriod("all"); setMonthPick(""); setOutcome(""); setPerson(""); setBranch(""); setFolded({}); };
  const chips = [
    query ? { k: "q", label: `«${query}»`, clear: () => setQuery("") } : null,
    monthPick ? { k: "m", label: formatMonthYear(`${monthPick}-01T12:00:00`, lang), clear: () => setMonthPick("") } : null,
    period !== "all" ? { k: "p", label: ar ? ARCHIVE_PERIODS.find((p) => p.id === period)?.ar : ARCHIVE_PERIODS.find((p) => p.id === period)?.en, clear: () => setPeriod("all") } : null,
    outcome ? { k: "o", label: outcome, clear: () => setOutcome("") } : null,
    person ? { k: "pe", label: person, clear: () => setPerson("") } : null,
    branch ? { k: "b", label: branch, clear: () => setBranch("") } : null,
  ].filter(Boolean);

  const namedEmpty = !source.length
    ? (emptyLabel || (ar ? "لا توجد سجلات مؤرشفة بعد." : "No archived records yet."))
    : (noMatchLabel
      || (query
        ? (ar ? `لا سجل مؤرشف يطابق «${query}».` : `No archived record matches “${query}”.`)
        : (ar ? "لا سجل مؤرشف في هذه التصفية." : "No archived record in this filter.")));

  const openable = !!(onOpen || renderOpen);
  const openRow = (it) => {
    if (renderOpen) setPreviewId(it.id);
    onOpen?.(it);
  };
  const step = (delta) => {
    const next = visibleRows[previewIdx + delta];
    if (next) setPreviewId(next.id);
  };

  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setPreviewId("");
      else if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!preview) return;
    listRef.current?.querySelector(`[data-archive-row="${CSS.escape(String(preview.id))}"]`)?.scrollIntoView({ block: "nearest" });
  }, [previewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onListKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(listRef.current?.querySelectorAll("[data-archive-row]") || [])];
    const at = rows.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  const download = () => {
    try {
      const blob = new Blob([archiveCsv(filtered, ar)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportName || (ar ? "الأرشيف" : "archive")}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { /* export is a convenience; the archive stays readable */ }
  };

  const printList = () => {
    const showPerson = filtered.some((it) => it.person);
    const showBranch = filtered.some((it) => it.branch);
    printSheet({
      ar,
      kicker: kicker || (ar ? "الأرشيف" : "Archive"),
      title: title || (ar ? "الأرشيف" : "Archive"),
      subtitle: chips.length ? `${ar ? "التصفية" : "Filter"}: ${chips.map((c) => c.label).join(" · ")}` : (ar ? "كل السجلات المؤرشفة" : "Every archived record"),
      ref: exportName || "",
      facts: [
        { label: ar ? "السجلات المطبوعة" : "Records printed", value: String(filtered.length), mono: true },
        filtered.length !== source.length ? { label: ar ? "من أصل" : "Out of", value: String(source.length), mono: true } : null,
        ...archiveOutcomes(filtered).slice(0, 4).map((o) => ({ label: o.badge, value: String(o.count), mono: true })),
      ],
      blocks: groupArchiveBy(filtered, by).map((g) => ({
        type: "table",
        heading: `${groupLabel(g.key)} · ${g.rows.length}`,
        cols: [ar ? "التاريخ" : "Date", ar ? "السجل" : "Record", ...(showPerson ? [ar ? "الشخص" : "Person"] : []), ...(showBranch ? [ar ? "الفرع" : "Branch"] : []), ar ? "النتيجة" : "Outcome", ar ? "التفاصيل" : "Details"],
        monoCols: [0],
        nowrapCols: [0, 1 + (showPerson ? 1 : 0) + (showBranch ? 1 : 0) + 1],
        rows: g.rows.map((it) => {
          const dp = dayParts(it.date, lang);
          const when = dp ? `${dp.dm}/${new Date(it.date).getFullYear()} ${dp.time}` : "—";
          return [when, it.title || "—", ...(showPerson ? [it.person || "—"] : []), ...(showBranch ? [it.branch || "—"] : []), it.badge || "—", it.text || ""];
        }),
      })),
    });
  };
  const printOne = (it) => {
    const custom = printRecord?.(it);
    if (custom) { printSheet({ ar, ...custom }); return; }
    printSheet({
      ar,
      kicker: title || (ar ? "الأرشيف" : "Archive"),
      title: it.title || "—",
      ref: String(it.ref || it.id || ""),
      status: it.badge ? { label: it.badge, tone: archiveTone(it.badge) } : null,
      facts: [
        { label: ar ? "تاريخ الإغلاق" : "Closed", value: formatDateTime(it.date, lang) },
        { label: ar ? "الشخص" : "Person", value: it.person },
        { label: ar ? "الفرع" : "Branch", value: it.branch },
      ],
      blocks: it.text ? [{ type: "text", heading: ar ? "التفاصيل" : "Details", body: it.text.split(" · ").join("\n") }] : [],
    });
  };

  const selectStyle = { fontFamily: "inherit", height: 34, maxWidth: 190, borderRadius: 9, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 12, padding: "0 10px" };
  const segBtn = (on) => ({ fontFamily: "inherit", height: 28, padding: "0 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: on ? 700 : 500, background: on ? "#0B3D27" : "transparent", color: on ? "#fff" : "var(--nv-ink2)", whiteSpace: "nowrap" });

  return (
    <section data-archive="1" data-density={density} dir={dir} style={{ display: "flex", flexDirection: "column", borderRadius: 14, overflow: "hidden", border: "1px solid var(--nv-line)", background: "var(--nv-card)", boxShadow: "var(--nv-paper)" }}>
      {/* Head — what the archive holds, and where in the year it sits. */}
      <header style={{ background: DK.bg, color: "#fff", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Archive size={18} strokeWidth={1.75} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 220px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: DK.faint }}>
              <span aria-hidden style={{ width: 12, height: 2, background: DK.gold, borderRadius: 8 }} />
              {kicker || (ar ? "سجل زمني" : "Timeline")}
            </span>
            <strong style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700 }}>{title || (ar ? "الأرشيف" : "Archive")}</strong>
            <span style={{ fontSize: 12, color: DK.soft, lineHeight: 1.7 }}>{subtitle || (ar ? "ما أُغلق من هذا القسم، مرتّباً حسب تاريخ الإغلاق." : "What closed in this section, by closing date.")}</span>
          </span>
          <span style={{ display: "flex", alignItems: "flex-end", gap: 16, flexShrink: 0 }}>
            {meta ? <span style={{ fontSize: 11.5, color: DK.soft, alignSelf: "center" }}>{meta}</span> : null}
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <strong data-archive-total="1" style={{ ...MONO, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{source.length}</strong>
              <span style={{ fontSize: 11, color: DK.faint }}>{ar ? "سجل" : "records"}</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <strong style={{ ...MONO, fontSize: 26, fontWeight: 700, lineHeight: 1, color: "#F3E3BC" }}>{thisMonth}</strong>
              <span style={{ fontSize: 11, color: DK.faint }}>{ar ? "هذا الشهر" : "this month"}</span>
            </span>
          </span>
        </div>

        {source.length ? (
          <div data-archive-map="1" role="group" aria-label={ar ? "آخر 12 شهراً — اضغط شهراً لقراءته" : "Last 12 months — click a month to read it"} style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 4, alignItems: "end", paddingTop: 10, borderTop: `1px solid ${DK.line}` }}>
            {histogram.map((h) => {
              const on = monthPick === h.month;
              const dim = monthPick && !on;
              return (
                <button
                  key={h.month}
                  type="button"
                  data-archive-bar={h.month}
                  aria-pressed={on}
                  disabled={!h.count}
                  title={`${formatMonthYear(`${h.month}-01T12:00:00`, lang)} · ${h.count}`}
                  onClick={() => { setMonthPick(on ? "" : h.month); setPeriod("all"); setGroupBy("month"); setFolded({}); }}
                  style={{ fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, padding: 0, border: "none", background: "transparent", cursor: h.count ? "pointer" : "default", color: "#fff", minWidth: 0 }}
                >
                  <span style={{ ...MONO, fontSize: 10, textAlign: "center", color: h.count ? (on ? "#F3E3BC" : DK.soft) : "transparent" }}>{h.count}</span>
                  <span style={{ height: 34, display: "flex", alignItems: "flex-end" }}>
                    <span style={{ display: "block", width: "100%", height: h.count ? `${Math.max(10, (h.count / histMax) * 100)}%` : 2, borderRadius: 4, background: on ? DK.gold : h.count ? `rgba(255,255,255,${dim ? 0.16 : 0.42})` : "rgba(255,255,255,.12)" }} />
                  </span>
                  <span style={{ fontSize: 10, textAlign: "center", color: on ? "#F3E3BC" : DK.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" }}>{monthShort(h.month, ar)}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {outcomes.length > 1 ? (
          <div role="group" aria-label={ar ? "حسب النتيجة" : "By outcome"} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ badge: "", count: source.length }, ...outcomes.slice(0, 5)].map((o) => {
              const on = outcome === o.badge;
              return (
                <button
                  key={o.badge || "all"}
                  type="button"
                  data-archive-outcome={o.badge || "all"}
                  aria-pressed={on}
                  onClick={() => setOutcome(o.badge)}
                  style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 11px", borderRadius: 999, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer", border: `1px solid ${on ? "#fff" : "rgba(255,255,255,.26)"}`, background: on ? "#fff" : "transparent", color: on ? "#0B3D27" : "#fff" }}
                >
                  {o.badge ? <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: on ? TONE[o.tone].dot : TONE[o.tone].onDark }} /> : null}
                  {o.badge || (ar ? "كل النتائج" : "All outcomes")}
                  <span style={{ ...MONO, fontSize: 11, opacity: 0.75 }}>{o.count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {/* Toolbar — search and period, then how to read: grouping, person, branch, density, export. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--nv-line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ position: "relative", flex: "1 1 220px", minWidth: 0, margin: 0 }}>
            <Search size={14} aria-hidden style={{ position: "absolute", top: "50%", insetInlineStart: 12, transform: "translateY(-50%)", color: "var(--nv-muted)", pointerEvents: "none" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder || (ar ? "ابحث باسم أو رقم أو كلمة…" : "Search by name, number, or word…")}
              aria-label={ar ? "بحث الأرشيف" : "Archive search"}
              className="nv-search-field"
              style={{ width: "100%", boxSizing: "border-box", height: 38, borderRadius: 10, border: "1px solid var(--nv-line)", background: "var(--nv-soft)", fontFamily: "inherit", fontSize: 13, color: "var(--nv-ink)", paddingInlineStart: 34, paddingInlineEnd: 12, outline: "none" }}
            />
          </label>
          <span role="tablist" aria-label={ar ? "الفترة" : "Period"} className="nv-archive-seg" style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, border: "1px solid var(--nv-line)", background: "var(--nv-soft)" }}>
            {ARCHIVE_PERIODS.map((p) => (
              <button key={p.id} type="button" role="tab" data-archive-period={p.id} aria-selected={period === p.id} onClick={() => { setPeriod(p.id); setMonthPick(""); }} style={segBtn(period === p.id)}>
                {ar ? p.ar : p.en}
              </button>
            ))}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {groupings.length > 1 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, color: "var(--nv-muted)", fontWeight: 600 }}>{ar ? "جمّع حسب" : "Group by"}</span>
              <span role="tablist" aria-label={ar ? "التجميع" : "Grouping"} style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 9, border: "1px solid var(--nv-line)", background: "var(--nv-soft)" }}>
                {groupings.map((g) => (
                  <button key={g.id} type="button" role="tab" data-archive-group={g.id} aria-selected={by === g.id} onClick={() => { setGroupBy(g.id); setFolded({}); }} style={segBtn(by === g.id)}>
                    {ar ? g.ar : g.en}
                  </button>
                ))}
              </span>
            </span>
          ) : null}
          {people.length > 1 ? (
            <select data-archive-person="1" aria-label={ar ? "الشخص" : "Person"} value={person} onChange={(e) => setPerson(e.target.value)} style={selectStyle}>
              <option value="">{ar ? `كل الأشخاص · ${people.length}` : `Everyone · ${people.length}`}</option>
              {people.map((p) => <option key={p.value} value={p.value}>{`${p.value} · ${p.count}`}</option>)}
            </select>
          ) : null}
          {branches.length > 1 ? (
            <select data-archive-branch="1" aria-label={ar ? "الفرع" : "Branch"} value={branch} onChange={(e) => setBranch(e.target.value)} style={selectStyle}>
              <option value="">{ar ? `كل الفروع · ${branches.length}` : `All branches · ${branches.length}`}</option>
              {branches.map((b) => <option key={b.value} value={b.value}>{`${b.value} · ${b.count}`}</option>)}
            </select>
          ) : null}
          <span style={{ flex: 1 }} />
          <span role="group" aria-label={ar ? "الكثافة" : "Density"} style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 9, border: "1px solid var(--nv-line)", background: "var(--nv-soft)" }}>
            {[["compact", Rows4, ar ? "مدمج" : "Compact"], ["comfy", Rows3, ar ? "مريح" : "Comfortable"]].map(([id, Icon, label]) => (
              <button key={id} type="button" data-archive-density={id} aria-pressed={density === id} title={label} aria-label={label} onClick={() => setDensity(id)} style={{ ...segBtn(density === id), width: 32, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={14} strokeWidth={2} aria-hidden />
              </button>
            ))}
          </span>
          <button
            type="button"
            data-archive-print="1"
            onClick={printList}
            disabled={!filtered.length}
            title={ar ? "اطبع ما يظهر — بالتصفية والتجميع الحاليين" : "Print what is shown — with the current filter and grouping"}
            style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: filtered.length ? "#0B3D27" : "var(--nv-muted)", fontSize: 12, fontWeight: 700, cursor: filtered.length ? "pointer" : "default" }}
          >
            <Printer size={14} strokeWidth={2} aria-hidden />
            {ar ? "طباعة" : "Print"}
          </button>
          <button
            type="button"
            data-archive-export="1"
            onClick={download}
            disabled={!filtered.length}
            title={ar ? "تصدير ما يظهر إلى ملف Excel (CSV)" : "Export what is shown to Excel (CSV)"}
            style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: filtered.length ? "#0B3D27" : "var(--nv-muted)", fontSize: 12, fontWeight: 700, cursor: filtered.length ? "pointer" : "default" }}
          >
            <Download size={14} strokeWidth={2} aria-hidden />
            {ar ? "تصدير" : "Export"}
          </button>
        </div>
        {chips.length ? (
          <div data-archive-chips="1" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", fontWeight: 600 }}>
              {ar
                ? <><span style={MONO}>{filtered.length}</span> نتيجة في <span style={MONO}>{groups.length}</span> {by === "month" ? "شهر" : "مجموعة"}</>
                : <><span style={MONO}>{filtered.length}</span> results in <span style={MONO}>{groups.length}</span> {by === "month" ? "months" : "groups"}</>}
            </span>
            {chips.map((c) => (
              <button key={c.k} type="button" onClick={c.clear} data-archive-chip={c.k} style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 6px 0 10px", borderRadius: 999, border: "1px solid var(--nv-ok-line)", background: "var(--nv-ok-soft)", color: "var(--nv-ok-ink)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", maxWidth: 220 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                <X size={12} strokeWidth={2.5} aria-label={ar ? "إزالة" : "Remove"} />
              </button>
            ))}
            {chips.length > 1 ? (
              <button type="button" onClick={clearAll} style={{ fontFamily: "inherit", border: "none", background: "transparent", color: "var(--nv-muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                {ar ? "مسح الكل" : "Clear all"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* The list — groups fold to one line; rows are a table when compact, cards when comfortable. */}
      <div ref={listRef} onKeyDown={onListKey} style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 10, background: "var(--nv-page, #F4F7F5)" }}>
        {!groups.length ? (
          <div data-archive-empty="1" style={{ padding: "34px 8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span aria-hidden style={{ width: 46, height: 46, borderRadius: 14, background: "var(--nv-card)", border: "1px dashed var(--nv-line)", display: "grid", placeItems: "center", color: "var(--nv-muted)" }}>
              <Archive size={20} strokeWidth={1.5} />
            </span>
            <p style={{ margin: 0, fontSize: 13, color: "var(--nv-muted)", maxWidth: 420, lineHeight: 1.8 }}>{namedEmpty}</p>
            {chips.length ? (
              <button type="button" onClick={clearAll} style={{ fontFamily: "inherit", height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "#0B3D27", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {ar ? "امسح التصفية" : "Clear filters"}
              </button>
            ) : null}
          </div>
        ) : groups.map((g, gi) => {
          const open = isOpen(g.key, gi);
          const lim = groupLimit[`${by}:${g.key}`] || GROUP_PAGE;
          const outs = archiveOutcomes(g.rows);
          return (
            <div key={g.key} data-archive-month={g.key} data-open={open ? "1" : "0"} style={{ display: "flex", flexDirection: "column", borderRadius: 12, border: "1px solid var(--nv-line)", background: "var(--nv-card)", overflow: "hidden" }}>
              <button
                type="button"
                aria-expanded={open}
                data-archive-fold={g.key}
                onClick={() => toggleGroup(g.key, gi)}
                style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: open ? "var(--nv-soft)" : "var(--nv-card)", cursor: "pointer", textAlign: "start", color: "var(--nv-ink)", borderBottom: open ? "1px solid var(--nv-line)" : "none" }}
              >
                <ChevronDown size={15} strokeWidth={2.25} aria-hidden style={{ color: "var(--nv-muted)", transform: open ? "none" : (ar ? "rotate(90deg)" : "rotate(-90deg)"), transition: "transform .15s", flexShrink: 0 }} />
                <strong style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{groupLabel(g.key)}</strong>
                <span style={{ ...MONO, fontSize: 11.5, fontWeight: 700, color: "#0B3D27", background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)", borderRadius: 999, padding: "0 8px", lineHeight: "20px" }}>{g.rows.length}</span>
                <span className="nv-archive-sumtext" style={{ fontSize: 11.5, color: "var(--nv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>
                  {by !== "outcome" ? outs.slice(0, 3).map((o) => `${o.count} ${o.badge}`).join(" · ") : ""}
                </span>
                {by !== "outcome" ? <OutcomeStrip rows={g.rows} /> : null}
              </button>
              {open ? (
                <>
                  {compact ? (
                    <div className="nv-archive-thead" aria-hidden style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: "7px 14px", fontSize: 10.5, fontWeight: 600, color: "var(--nv-muted)", borderBottom: "1px solid var(--nv-line2, #EEF1EF)" }}>
                      <span>{ar ? "التاريخ" : "Date"}</span>
                      <span>{ar ? "السجل" : "Record"}</span>
                      {hasPerson && by !== "person" ? <span className="nv-ac-hide-sm">{ar ? "الشخص" : "Person"}</span> : null}
                      {hasBranch && by !== "branch" ? <span className="nv-ac-hide-sm">{ar ? "الفرع" : "Branch"}</span> : null}
                      <span>{ar ? "النتيجة" : "Outcome"}</span>
                      <span className="nv-ac-hide-sm">{ar ? "الوقت" : "Time"}</span>
                    </div>
                  ) : null}
                  <ol style={{ listStyle: "none", margin: 0, padding: compact ? 0 : 8, display: "flex", flexDirection: "column", gap: compact ? 0 : 8 }}>
                    {g.rows.slice(0, lim).map((it) => {
                      const tone = TONE[archiveTone(it.badge)] || TONE.mute;
                      const dp = dayParts(it.date, lang);
                      const active = preview && preview.id === it.id;
                      const rowProps = {
                        key: it.id,
                        "data-archive-row": it.id,
                        role: openable ? "button" : undefined,
                        tabIndex: 0,
                        "aria-current": active ? "true" : undefined,
                        onClick: openable ? () => openRow(it) : undefined,
                        onKeyDown: openable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRow(it); } } : undefined,
                      };
                      if (compact) {
                        return (
                          <li {...rowProps} className="nv-archive-row nv-archive-crow" style={{ display: "grid", gridTemplateColumns: cols, gap: 10, alignItems: "center", padding: "9px 14px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", background: active ? "var(--nv-ok-soft)" : "transparent", cursor: openable ? "pointer" : "default", position: "relative", minHeight: 42, boxSizing: "border-box" }}>
                            <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, background: tone.dot }} />
                            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                              <span style={{ ...MONO, fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", textAlign: "start" }}>{dp ? dp.dm : "—"}</span>
                              <span style={{ fontSize: 10, color: "var(--nv-muted)" }}>{dp ? dp.week : ""}</span>
                            </span>
                            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: 13, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Marked text={it.title || "—"} query={query} /></strong>
                              {it.text ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Marked text={it.text} query={query} /></span> : null}
                            </span>
                            {hasPerson && by !== "person" ? <span className="nv-ac-hide-sm" style={{ fontSize: 12, color: "var(--nv-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.person || "—"}</span> : null}
                            {hasBranch && by !== "branch" ? <span className="nv-ac-hide-sm" style={{ fontSize: 12, color: "var(--nv-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.branch || "—"}</span> : null}
                            <span style={{ minWidth: 0, display: "flex" }}><TonePill badge={it.badge} tone={tone} /></span>
                            <span className="nv-ac-hide-sm" title={formatDateTime(it.date, lang)} style={{ fontSize: 11, color: "var(--nv-muted)" }}><span style={MONO}>{dp ? dp.time : ""}</span></span>
                          </li>
                        );
                      }
                      return (
                        <li {...rowProps} className="nv-archive-row" style={{ display: "grid", gridTemplateColumns: "54px minmax(0, 1fr)", gap: 12, padding: "11px 14px", borderRadius: 12, border: `1px solid ${active ? "#0B3D27" : "var(--nv-line)"}`, background: active ? "var(--nv-ok-soft)" : "var(--nv-card)", cursor: openable ? "pointer" : "default", position: "relative" }}>
                          <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: tone.dot }} />
                          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", padding: "6px 0", alignSelf: "start" }}>
                            <strong style={{ ...MONO, fontSize: 18, lineHeight: 1.1, color: "var(--nv-ink)" }}>{dp ? dp.day : "—"}</strong>
                            <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{dp ? dp.week : ""}</span>
                          </span>
                          <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                              <strong style={{ fontSize: 13.5, color: "var(--nv-ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}><Marked text={it.title || "—"} query={query} /></strong>
                              <TonePill badge={it.badge} tone={tone} />
                              <span title={formatDateTime(it.date, lang)} style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--nv-muted)" }}><span style={MONO}>{dp ? dp.time : ""}</span></span>
                            </span>
                            {it.text ? <span className="nv-archive-text" style={{ fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7 }}><Marked text={it.text} query={query} /></span> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {g.rows.length > lim ? (
                    <button
                      type="button"
                      data-archive-more="1"
                      onClick={() => setGroupLimit((m) => ({ ...m, [`${by}:${g.key}`]: lim + GROUP_PAGE }))}
                      style={{ fontFamily: "inherit", height: 38, border: "none", borderTop: "1px solid var(--nv-line2, #EEF1EF)", background: "var(--nv-card)", color: "#0B3D27", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      {ar ? `اعرض المزيد في هذه المجموعة · بقي ${g.rows.length - lim}` : `Show more here · ${g.rows.length - lim} left`}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Side preview — opens beside the list (a sheet on phones), ↑ ↓ to move, Esc to close. */}
      {preview && renderOpen ? (
        <>
          <div aria-hidden onClick={() => setPreviewId("")} style={{ position: "fixed", inset: 0, background: "rgba(11,30,20,.28)", zIndex: 60 }} />
          <aside data-archive-preview="1" dir={dir} role="dialog" aria-label={preview.title || ""} className="nv-archive-drawer" style={{ position: "fixed", top: 0, bottom: 0, insetInlineEnd: 0, width: "min(460px, 100vw)", background: "var(--nv-card)", zIndex: 61, display: "flex", flexDirection: "column", boxShadow: "0 0 40px rgba(6,40,25,.25)" }}>
            <div style={{ background: DK.bg, color: "#fff", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: DK.faint }}>
                  <span aria-hidden style={{ width: 12, height: 2, background: DK.gold, borderRadius: 8 }} />
                  {title || (ar ? "الأرشيف" : "Archive")}
                </span>
                <span style={{ ...MONO, marginInlineStart: "auto", fontSize: 11, color: DK.faint }}>{previewIdx + 1} / {visibleRows.length}</span>
                <button type="button" data-archive-print-one="1" onClick={() => printOne(preview)} aria-label={ar ? "طباعة السجل" : "Print record"} title={ar ? "طباعة السجل" : "Print record"} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Printer size={15} />
                </button>
                <button type="button" onClick={() => setPreviewId("")} aria-label={ar ? "إغلاق" : "Close"} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={15} />
                </button>
              </div>
              <strong style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700, lineHeight: 1.5 }}>{preview.title || "—"}</strong>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: DK.soft }}>
                {preview.badge ? <TonePill badge={preview.badge} tone={TONE[archiveTone(preview.badge)] || TONE.mute} /> : null}
                <span>{formatDateTime(preview.date, lang)}</span>
                {preview.person ? <span>· {preview.person}</span> : null}
                {preview.branch ? <span>· {preview.branch}</span> : null}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {preview.text ? <p style={{ margin: 0, fontSize: 13, color: "var(--nv-ink2)", lineHeight: 1.8 }}>{preview.text}</p> : null}
              <div>{renderOpen(preview)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--nv-line)", flexShrink: 0 }}>
              {[[-1, ar ? "السابق" : "Previous", ar ? ChevronRight : ChevronLeft], [1, ar ? "التالي" : "Next", ar ? ChevronLeft : ChevronRight]].map(([d, label, Icon]) => {
                const can = !!visibleRows[previewIdx + d];
                return (
                  <button key={d} type="button" disabled={!can} onClick={() => step(d)} style={{ fontFamily: "inherit", flex: 1, height: 38, borderRadius: 10, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: can ? "#0B3D27" : "var(--nv-muted)", fontSize: 12.5, fontWeight: 700, cursor: can ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, flexDirection: d < 0 ? "row" : "row-reverse" }}>
                    <Icon size={15} aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
