import { deriveReportAnalytics } from "@/lib/reportAnalytics";
import { PDF_THEME, brandReportColor } from "@/lib/pdfTheme";

export function exportExcelColored({ filename, title, headers, rows, color = PDF_THEME.navy, dir = "ltr", companyName = "", logoUrl = "" }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const analytics = deriveReportAnalytics(headers, rows);
  const ink = brandReportColor(color) === PDF_THEME.navy ? PDF_THEME.navy : brandReportColor(color);
  const surface = "#F7F8FA";
  const columnCount = Math.max(headers.length, 3);
  const columnWidths = Array.from({ length: columnCount }, (_, index) => {
    const values = [headers[index], ...rows.filter((row) => row.length === headers.length).map((row) => row[index])];
    const longest = Math.max(...values.map((value) => String(value ?? "").length), 10);
    return Math.min(260, Math.max(115, longest * 9 + 32));
  });
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const columns = `<colgroup>${columnWidths.map((width) => `<col width="${width}" style="width:${width}px;mso-width-source:userset;" />`).join("")}</colgroup>`;
  const generated = new Date().toLocaleString(dir === "rtl" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
  const headerCells = headers.map((h) => `<th style="height:34px;background:${ink};color:#ffffff;padding:10px 14px;border:1px solid ${ink};font-size:13px;font-weight:700;white-space:nowrap;">${esc(h)}</th>`).join("");
  const bodyRows = rows.map((row, index) => {
    if (!row.length) return `<tr><td colspan="${columnCount}" style="height:10px;border:none;background:#ffffff;"></td></tr>`;
    if (row.length === 1) return `<tr><td colspan="${columnCount}" style="padding:10px 14px;background:${surface};color:${ink};font-size:13px;font-weight:700;border:1px solid #E2E8F0;">${esc(row[0])}</td></tr>`;
    const background = index % 2 === 0 ? "#ffffff" : surface;
    return `<tr style="height:28px;">${row.map((cell) => `<td style="padding:8px 14px;border:1px solid #E2E8F0;background:${background};color:${ink};font-size:13px;white-space:nowrap;">${esc(cell)}</td>`).join("")}</tr>`;
  }).join("");
  const summary = analytics.stats.length
    ? `<tr><td colspan="${columnCount}" style="background:${surface};color:${ink};padding:10px 14px;font-size:13px;font-weight:700;border:1px solid #E2E8F0;">${dir === "rtl" ? "الملخص" : "Summary"}</td></tr>${analytics.stats.map((stat) => `<tr><td style="padding:8px 12px;background:${ink};color:#ffffff;font-weight:700;">${esc(stat.value)}</td><td colspan="${columnCount - 1}" style="padding:8px 12px;background:${surface};color:${ink};border:1px solid #E2E8F0;">${esc(stat.label)}</td></tr>`).join("")}`
    : "";
  const company = esc(companyName || "");
  const logoCell = logoUrl
    ? `<img src="${esc(logoUrl)}" width="48" height="48" style="width:48px;height:48px;object-fit:contain;" />`
    : "";
  const banner = `<tr><td colspan="${columnCount}" style="height:3px;background:${ink};border:none;"></td></tr><tr><td colspan="${columnCount}" style="background:#ffffff;color:${ink};padding:14px 16px 2px;border:none;font-size:12px;font-weight:700;">${logoCell}${logoCell && company ? "&nbsp;&nbsp;" : ""}${company}</td></tr><tr><td colspan="${columnCount}" style="background:#ffffff;color:${ink};padding:2px 16px 6px;border:none;font-size:18px;font-weight:700;">${esc(title)}</td></tr><tr><td colspan="${columnCount}" style="background:#ffffff;color:#5A6B85;padding:0 16px 14px;border:none;border-bottom:1px solid #E2E8F0;font-size:11px;">${esc(generated)}</td></tr>`;
  const footer = `<tr><td colspan="${columnCount}" style="padding:12px 16px;border:none;color:#5A6B85;font-size:10px;">${dir === "rtl" ? "صادرة عبر NiroVera" : "Issued on NiroVera"}</td></tr>`;
  const html = `<html dir="${dir}" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{margin:18px;background:#ffffff}table{width:${tableWidth}px;table-layout:fixed;border-collapse:collapse;font-family:Tahoma,Arial,sans-serif}td,th{vertical-align:middle;mso-number-format:\\"General\\"}</style></head><body><table>${columns}${banner}${summary}<tr>${headerCells}</tr>${bodyRows}${footer}</table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const safeName = String(filename || "report").replace(/[^\w\u0600-\u06FF.-]+/g, "_").replace(/_+/g, "_").slice(0, 80) || "report";
  link.download = `${safeName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
