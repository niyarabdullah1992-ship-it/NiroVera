/**
 * One archive for every section: closed records grouped by month, read by outcome and period,
 * searchable, exportable. Pure helpers — RecordSmartArchive draws them.
 */

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v).length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function archiveMonthKey(v) {
  const d = toDate(v);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "";
}

/** Outcome tone from the badge text: settled well, refused or broken, or neutral. */
export function archiveTone(badge = "") {
  const s = String(badge || "");
  // Finished, but someone refused along the way — a mixed outcome, not a failure.
  if (/(مكتمل|Completed).*(مع|with)\s*(رفض|refus)/i.test(s)) return "warn";
  if (/مرفوض|رُفض|رفض|ملغ|أُلغي|سُحب|مخالف|منتهي|انتهى|فسخ|Reject|Cancel|Withdraw|Void|Violation|Expired/i.test(s)) return "bad";
  if (/أُعيد|يحتاج|بانتظار|معلّق|جزئي|Return|Pending|Partial|Revise/i.test(s)) return "warn";
  if (/مدفوع|Paid|اعتُمد|معتمد|مكتمل|مُعتمد|خُتم|مختوم|مستلَم|غادر|أُغلق|عولج|عُولِج|منجز|نُفّذ|Approved|Completed|Sealed|Accepted|Left|Closed|Handled|Done|Adopted/i.test(s)) return "ok";
  return "mute";
}

export const ARCHIVE_PERIODS = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "month", ar: "هذا الشهر", en: "This month" },
  { id: "quarter", ar: "آخر 3 أشهر", en: "Last 3 months" },
  { id: "year", ar: "هذه السنة", en: "This year" },
];

export function inArchivePeriod(date, period = "all", now = new Date()) {
  if (period === "all") return true;
  const d = toDate(date);
  if (!d) return false;
  if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (period === "year") return d.getFullYear() === now.getFullYear();
  if (period === "quarter") {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return d >= from && d <= new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return true;
}

/** Badge counts, most common first — the outcome chips on the head. */
export function archiveOutcomes(items = []) {
  const map = new Map();
  for (const it of items) {
    const b = String(it?.badge || "").trim();
    if (!b) continue;
    map.set(b, (map.get(b) || 0) + 1);
  }
  return [...map.entries()].map(([badge, count]) => ({ badge, count, tone: archiveTone(badge) })).sort((a, b) => b.count - a.count);
}

/** Newest month first; inside a month newest first. Undated items go last under «بلا تاريخ». */
export function groupArchiveByMonth(items = []) {
  const map = new Map();
  for (const it of items) {
    const k = archiveMonthKey(it?.date) || "none";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === "none" ? 1 : b[0] === "none" ? -1 : b[0].localeCompare(a[0])))
    .map(([month, rows]) => ({
      month,
      rows: rows.slice().sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)),
    }));
}

function csvCell(v) {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a BOM so Excel opens Arabic correctly. */
export function archiveCsv(items = [], ar = true) {
  const hasPerson = items.some((it) => it?.person);
  const hasBranch = items.some((it) => it?.branch);
  const head = [
    ar ? "التاريخ" : "Date",
    ar ? "العنوان" : "Title",
    ...(hasPerson ? [ar ? "الشخص" : "Person"] : []),
    ...(hasBranch ? [ar ? "الفرع" : "Branch"] : []),
    ar ? "النتيجة" : "Outcome",
    ar ? "التفاصيل" : "Details",
  ];
  const rows = items.map((it) => {
    const d = toDate(it?.date);
    const when = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
    return [when, it?.title, ...(hasPerson ? [it?.person] : []), ...(hasBranch ? [it?.branch] : []), it?.badge, it?.text].map(csvCell).join(",");
  });
  return `﻿${[head.join(","), ...rows].join("\r\n")}`;
}

/** The last n months ending at now, oldest first, with how many records closed in each — the head's map. */
export function archiveHistogram(items = [], now = new Date(), n = 12) {
  const counts = new Map();
  for (const it of items) {
    const k = archiveMonthKey(it?.date);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ month, count: counts.get(month) || 0 });
  }
  return out;
}

/** Distinct values of one facet (person, branch) with counts, most common first; blanks left out. */
export function archiveFacet(items = [], key) {
  const map = new Map();
  for (const it of items) {
    const v = String(it?.[key] || "").trim();
    if (v) map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()].map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "ar"));
}

export const ARCHIVE_GROUPINGS = [
  { id: "month", ar: "الشهر", en: "Month" },
  { id: "person", ar: "الشخص", en: "Person" },
  { id: "branch", ar: "الفرع", en: "Branch" },
  { id: "outcome", ar: "النتيجة", en: "Outcome" },
];

/**
 * Groups for the list. By month: newest first. By person / branch / outcome: largest first,
 * blanks under one "none" group at the end. Rows inside every group are newest first.
 */
export function groupArchiveBy(items = [], by = "month") {
  if (by === "month") return groupArchiveByMonth(items).map((g) => ({ key: g.month, rows: g.rows }));
  const field = by === "outcome" ? "badge" : by;
  const map = new Map();
  for (const it of items) {
    const k = String(it?.[field] || "").trim() || "none";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  const byNewest = (a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0);
  return [...map.entries()]
    .sort((a, b) => (a[0] === "none" ? 1 : b[0] === "none" ? -1 : b[1].length - a[1].length || a[0].localeCompare(b[0], "ar")))
    .map(([key, rows]) => ({ key, rows: rows.slice().sort(byNewest) }));
}

/** Text split around the words searched for, so the list can mark them. */
export function archiveHighlight(text = "", query = "") {
  const s = String(text ?? "");
  const words = String(query || "").trim().split(/\s+/).filter((w) => w.length > 1)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!s || !words.length) return [{ text: s, hit: false }];
  const re = new RegExp(`(${words.join("|")})`, "gi");
  // split() with one capture group puts the matches at the odd places.
  return s.split(re).map((p, i) => ({ text: p, hit: i % 2 === 1 })).filter((p) => p.text !== "");
}
