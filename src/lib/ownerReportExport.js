import { exportExcelColored } from "@/lib/exportExcelColored";
import { POWERCARE_MARK_URL } from "@/lib/brand";
import { CLEAN_PRINT_CSS } from "@/lib/pdfTheme";

const esc = (value) => String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function exportOwnerReportExcel({ filename, title, headers, rows, ar }) {
  exportExcelColored({ filename, title, headers, rows, dir: ar ? "rtl" : "ltr" });
}

export function printOwnerReport({ title, headers, rows, ar }) {
  const dir = ar ? "rtl" : "ltr";
  const tableHead = headers.map((header) => `<th>${esc(header)}</th>`).join("");
  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CLEAN_PRINT_CSS}@page{size:A4 landscape}body{padding:12mm}.head{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #E2E8F0}.head img{width:44px;height:44px;object-fit:contain}.head .meta{margin-inline-start:auto;text-align:end}</style></head><body><div class="rule"></div><header class="head"><img src="${POWERCARE_MARK_URL}" alt="NiroVera"><div><p class="kicker">NIROVERA</p><h1>${esc(title)}</h1></div><div class="meta">${new Date().toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}<br>${rows.length} ${ar ? "سجل" : "records"}</div></header><table style="margin-top:14px"><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table><div class="foot">NiroVera • ${ar ? "تقرير إداري" : "Management report"}</div><script>onload=()=>setTimeout(()=>print(),500)</script></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
