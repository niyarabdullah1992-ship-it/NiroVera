import { PDF_THEME, brandReportColor } from "@/lib/pdfTheme";
import { POWERCARE_MARK_URL } from "@/lib/brand";
import { deriveReportAnalytics } from "@/lib/reportAnalytics";
import { INVENTORY_REPORT_CSS, inventoryThemeClass } from "@/lib/inventoryReportThemes";

// Opens a print-ready, brand-styled report in a new window and triggers the
// browser's print dialog (user can save as PDF). Full RTL/Arabic support since
// it renders real HTML instead of drawing glyphs into a PDF canvas.
// Each company can supply its own logo and brand color; the color drives all
// accents in the document, with light tints derived via hex-alpha.
export function buildReportHtml({ title, companyName, periodLabel, dir = "ltr", stats = [], charts = [], sections = [], logoUrl = "", color = PDF_THEME.navy, theme = "default", autoPrint = false }) {
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const accent = brandReportColor(color);
  const isWide = theme === "inventorySimplified" ? false : theme === "attendanceModern" || sections.some((section) => (section.headers || []).length > 8);
  const locale = dir === "rtl" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
  const generatedAt = new Date().toLocaleString(locale);
  const sectionAnalytics = sections.map((section) => deriveReportAnalytics(section.headers, section.rows));
  const displayedStats = stats.length ? stats : sectionAnalytics.flatMap((item) => item.stats).slice(0, 4);
  const chartHtml = (chart) => `<div class="chart"><h3>${esc(chart.title)}</h3>${chart.entries.map((entry) => `<div class="bar-row"><span>${esc(entry.label)}</span><i><b style="width:${entry.percent}%"></b></i><strong>${esc(entry.display)}</strong></div>`).join("")}</div>`;

  const statsHtml = displayedStats.length
    ? `<div class="stats">${displayedStats.map((s) => theme === "attendanceModern" ? `<div class="stat"><span class="stat-icon">${esc(s.label).slice(0, 1)}</span><p class="lbl">${esc(s.label)}</p><p class="val">${esc(s.value)}</p><svg viewBox="0 0 100 28" aria-hidden="true"><path d="${Number(String(s.value).replace(/[^0-9.-]/g, "")) > 0 ? "M0 22 L68 22 L100 6" : "M0 22 L100 22"}" /></svg></div>` : `<div class="stat"><p class="val">${esc(s.value)}</p><p class="lbl">${esc(s.label)}</p></div>`).join("")}</div>`
    : "";
  const explicitChartsHtml = charts.length ? `<section class="report-charts">${charts.map(chartHtml).join("")}</section>` : "";

  const attendanceRows = sections.flatMap((section) => section.rows || []);
  const attendanceHeaders = sections[0]?.headers || [];
  const attendanceStatusIndex = attendanceHeaders.findIndex((header) => /status|الحالة/i.test(String(header)));
  const attendanceGroups = attendanceRows.reduce((groups, row) => {
    const label = String(row[attendanceStatusIndex] || "—");
    groups[label] = (groups[label] || 0) + 1;
    return groups;
  }, {});
  const attendanceEntries = Object.entries(attendanceGroups);
  const attendanceTotal = Math.max(attendanceRows.length, 1);
  const attendancePalette = ["#1E9E63", "#14284B", "#DC2626", "#5A6B85", "#94A3B8"];
  let attendanceOffset = 0;
  const attendanceGradient = attendanceEntries.map(([, value], index) => {
    const start = attendanceOffset; attendanceOffset += (value / attendanceTotal) * 100;
    return `${attendancePalette[index % attendancePalette.length]} ${start}% ${attendanceOffset}%`;
  }).join(", ");
  const attendanceNameIndex = attendanceHeaders.findIndex((header) => /employee|الموظف/i.test(String(header)));
  const attendanceHoursIndex = attendanceHeaders.findIndex((header) => /work hours|ساعات العمل/i.test(String(header)));
  const employeeHours = attendanceRows.slice(0, 10).map((row) => ({ name: row[attendanceNameIndex] || "—", hours: Number(row[attendanceHoursIndex]) || 0 }));
  const maxEmployeeHours = Math.max(...employeeHours.map((item) => item.hours), 1);
  const attendanceAnalyticsHtml = theme === "attendanceModern" && attendanceEntries.length ? `<section class="attendance-analysis"><div class="analysis-grid"><div class="hours-card"><h3>${dir === "rtl" ? "متوسط ساعات العمل" : "Work hours"}</h3><div class="vertical-chart">${employeeHours.map((item) => `<div class="vertical-item"><strong>${item.hours.toFixed(1)}</strong><i><b style="height:${Math.max(5, (item.hours / maxEmployeeHours) * 100)}%"></b></i><span>${esc(item.name)}</span></div>`).join("")}</div></div><div class="donut-card"><div class="analysis-copy"><h3>${dir === "rtl" ? "تحليل الحضور" : "Attendance analysis"}</h3><p>${dir === "rtl" ? "إجمالي الموظفين" : "Total records"}</p><div class="legend">${attendanceEntries.map(([label, value], index) => `<p><i style="background:${attendancePalette[index % attendancePalette.length]}"></i><span>${esc(label)}</span><b>${value}</b></p>`).join("")}</div></div><div class="donut" style="background:conic-gradient(${attendanceGradient})"><div><strong>${attendanceRows.length}</strong><span>${dir === "rtl" ? "سجل" : "records"}</span></div></div></div></div></section>` : "";

  const sectionsHtml = sections
    .map((sec, index) => `
      <h2>${esc(sec.heading)}</h2>
      ${theme === "attendanceModern" ? "" : sectionAnalytics[index].charts.map(chartHtml).join("")}
      ${sec.rows.length === 0 ? `<p class="empty">—</p>` : `
      <table>
        <thead><tr>${sec.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${sec.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`}`
    )
    .join("");
  const leadMark = logoUrl
    ? `<img class="company-mark" src="${esc(logoUrl)}" alt="${esc(companyName)}" />`
    : "";
  const headHtml = `<div class="head"><div class="identity">${leadMark}<div><p class="document-label">${esc(companyName || "NiroVera")}</p><h1>${esc(title)}</h1><p class="meta">${esc(companyName)}${periodLabel ? " — " + esc(periodLabel) : ""}</p></div></div></div>`;

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${dir === "rtl" ? "ar" : "en"}">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 ${isWide ? "landscape" : "portrait"}; margin: 14mm; }
  body { position: relative; font-family: Tahoma, "Segoe UI", Arial, sans-serif; color: ${PDF_THEME.ink}; background: #fff; padding: 36px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .top-rule { height: 3px; background: ${accent}; margin-bottom: 22px; }
  .head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 18px; margin-bottom: 22px; border-bottom: 1px solid ${PDF_THEME.line}; }
  .identity { display: flex; align-items: center; gap: 14px; }
  .head h1 { font: 600 22px Tahoma, sans-serif; color: ${PDF_THEME.ink}; letter-spacing: .01em; }
  .head .meta { font-size: 11px; color: ${PDF_THEME.muted}; margin-top: 6px; }
  .document-label { color: ${PDF_THEME.muted}; font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; margin-bottom: 6px; }
  .stats { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { flex: 1; min-width: 110px; border: 1px solid ${PDF_THEME.line}; border-top: 3px solid ${accent}; padding: 13px 14px; background: ${PDF_THEME.cream}; }
  .stat .val { font: 700 23px Georgia, Tahoma, serif; color: ${PDF_THEME.ink}; }
  .stat .lbl { font-size: 10px; color: ${PDF_THEME.muted}; margin-top: 4px; }
  .report-charts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 4px 0 20px; break-inside: avoid; }
  .report-charts .chart { margin: 0; }
  .chart { margin: 12px 0 20px; padding: 14px; border: 1px solid ${PDF_THEME.line}; background: ${PDF_THEME.cream}; break-inside: avoid; }
  .chart h3 { color: ${PDF_THEME.ink}; font: 700 12px Tahoma, sans-serif; margin-bottom: 10px; }
  .bar-row { display: grid; grid-template-columns: minmax(80px, 1fr) 3fr 58px; gap: 8px; align-items: center; margin: 6px 0; font-size: 9px; }
  .bar-row i { display: block; height: 10px; background: #fff; border: 1px solid ${PDF_THEME.line}; }
  .bar-row b { display: block; height: 100%; background: linear-gradient(90deg, ${PDF_THEME.ink}, ${accent}); }
  .bar-row strong { color: ${PDF_THEME.ink}; text-align: end; }
  h2 { font: 600 16px Georgia, Tahoma, serif; margin: 24px 0 10px; color: ${PDF_THEME.ink}; padding-bottom: 7px; border-bottom: 1px solid ${PDF_THEME.line}; }
  h2::before { content: ""; display: inline-block; width: 18px; height: 3px; margin-inline-end: 8px; vertical-align: middle; background: ${accent}; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 16px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: ${accent}; color: #fff; text-align: start; padding: 8px; border-inline-end: 1px solid ${PDF_THEME.inkSoft}; font-size: 9px; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid ${PDF_THEME.line}; vertical-align: top; }
  tr:nth-child(even) td { background: ${PDF_THEME.cream}; }
  .wide table { table-layout: fixed; font-size: 6.5px; }
  .wide th, .wide td { padding: 5px 3px; text-align: center; overflow-wrap: anywhere; }
  .wide th:first-child, .wide td:first-child { width: 13%; text-align: start; font-weight: 600; }
  .empty { font-size: 12px; color: ${PDF_THEME.muted}; padding: 10px 0; }
  .foot { margin-top: 30px; padding-top: 10px; border-top: 1px solid ${PDF_THEME.line}; font-size: 9px; color: ${PDF_THEME.muted}; display: flex; justify-content: space-between; }
  .head img, .company-mark { width: 64px; height: 64px; object-fit: contain; }
  .foot-brand { display: inline-flex; align-items: center; gap: 8px; }
  .foot-brand img { width: 18px; height: 18px; object-fit: contain; }
  .attendance-modern { padding:22px; background:#fff; color:#14284B; }
  .attendance-modern .stats { position:relative; z-index:2; direction:ltr; display:grid; grid-template-columns:repeat(6,1fr); gap:9px; margin:0 24px 15px; }
  .attendance-modern .stat { position:relative; direction:rtl; min-width:0; height:92px; padding:10px; overflow:hidden; border:1px solid #E2E8F0; border-radius:9px; background:#ffffff; box-shadow:0 5px 12px rgba(15,37,72,.13); text-align:start; }
  .attendance-modern .stat-icon { position:absolute; inset-inline-end:9px; top:9px; display:grid; width:23px; height:23px; place-items:center; border-radius:7px; background:#d9efe2; color:#168552; font-weight:700; }.attendance-modern .stat:nth-child(2) .stat-icon { background:#fff0d5;color:#d98a16; }.attendance-modern .stat:nth-child(3) .stat-icon { background:#f4d9d4;color:#a72f2f; }.attendance-modern .stat:nth-child(4) .stat-icon { background:#efe8ce;color:#9c792f; }.attendance-modern .stat:nth-child(5) .stat-icon { background:#dce3ee;color:#0f2548; }
  .attendance-modern .stat .lbl { width:72%; color:#111; font-size:10px; font-weight:700; }.attendance-modern .stat .val { margin-top:3px; color:#111; font:700 15px Tahoma,sans-serif; }
  .attendance-modern .stat svg { position:absolute; inset-inline:9px; bottom:8px; width:calc(100% - 18px); height:28px; }.attendance-modern .stat svg path { fill:none; stroke:#1d8d58; stroke-width:2; }.attendance-modern .stat:nth-child(2) svg path { stroke:#dc8b19; }.attendance-modern .stat:nth-child(3) svg path { stroke:#a72f2f; }.attendance-modern .stat:nth-child(4) svg path { stroke:#557f93; }.attendance-modern .stat:nth-child(5) svg path { stroke:#0f2548; }.attendance-modern .stat:nth-child(6) svg path { stroke:#1E9E63; }
  .attendance-modern h2 { margin:0; padding:9px 13px; border:0; border-bottom:1px solid #E2E8F0; background:#ffffff; color:#111; font:700 13px Tahoma,sans-serif; }.attendance-modern h2::before { display:none; }
  .attendance-modern table { margin:0 0 12px; overflow:hidden; border:1px solid #E2E8F0; border-radius:9px; background:#fff; box-shadow:0 5px 12px rgba(15,37,72,.12); }
  .attendance-modern th { padding:8px 6px; border-color:#E2E8F0; background:#F7F8FA; color:#111; font-size:8px; }.attendance-modern td { padding:7px 6px; border:1px solid #F1F5F9; color:#111; font-size:8px; }.attendance-modern tr:nth-child(even) td { background:#F7F8FA; }
  .attendance-analysis { margin-top:10px; break-inside:avoid; }.analysis-grid { display:grid; grid-template-columns:1.1fr 1fr; gap:10px; }
  .donut-card,.hours-card { min-height:142px; padding:12px 14px; border:1px solid #E2E8F0; border-radius:9px; background:#fff; box-shadow:0 5px 12px rgba(15,37,72,.1); }.donut-card { display:flex; align-items:center; justify-content:center; gap:20px; }.hours-card h3,.analysis-copy h3 { margin-bottom:8px; color:#111; font-size:12px; }.analysis-copy>p { color:#657383; font-size:8px; }
  .donut { width:95px; height:95px; flex:0 0 auto; padding:17px; border-radius:50%; }.donut>div { width:100%; height:100%; display:grid; place-content:center; text-align:center; border-radius:50%; background:#fff; }.donut strong { font:700 19px Georgia,serif; }.donut span { display:block; color:#657383; font-size:7px; }
  .legend p { display:grid; grid-template-columns:7px 1fr auto; gap:6px; align-items:center; margin:5px 0; font-size:8px; }.legend i { width:6px; height:6px; border-radius:50%; }
  .vertical-chart { display:flex; align-items:end; gap:8px; height:103px; padding-top:5px; border-bottom:1px solid #E2E8F0; background:#fff; }.vertical-item { display:grid; grid-template-rows:12px 72px 15px; flex:1; min-width:0; text-align:center; font-size:6px; }.vertical-item>i { position:relative; display:block; align-self:end; height:72px; }.vertical-item>i b { position:absolute; inset-inline:20%; bottom:0; display:block; background:#0f2548; border-top:4px solid #E2E8F0; }.vertical-item span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  ${INVENTORY_REPORT_CSS}
  @media print { body { padding: 0; } .top-rule { margin-top: 0; } .inventory-powercare { background: #F7F8FA !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body class="${isWide ? "wide" : "standard"} ${theme === "attendanceModern" ? "attendance-modern" : ""} ${inventoryThemeClass(theme)}">
  <div class="top-rule"></div>
  ${headHtml}
  ${statsHtml}
  ${explicitChartsHtml}
  ${sectionsHtml}
  ${attendanceAnalyticsHtml}
  <div class="foot">
    <span class="foot-brand"><img src="${POWERCARE_MARK_URL}" alt="" />${dir === "rtl" ? "صادرة عبر NiroVera" : "Issued on NiroVera"}${companyName ? ` • ${esc(companyName)}` : ""}</span>
    <span>${esc(generatedAt)}</span>
  </div>
  ${autoPrint ? `<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>` : ""}
</body>
</html>`;

  return html;
}

export function downloadReportHtml({ filename = "report", ...opts }) {
  const html = buildReportHtml({ ...opts, autoPrint: false });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const base = String(filename || opts.title || "report").replace(/[^\w\u0600-\u06FF.-]+/g, "_").slice(0, 80) || "report";
  link.download = base.toLowerCase().endsWith(".html") ? base : `${base}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  return true;
}

export function printReport(opts) {
  const html = buildReportHtml({ ...opts, autoPrint: true });
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    return true;
  }
  downloadReportHtml({ filename: opts.title, ...opts });
  return false;
}