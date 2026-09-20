import { POWERCARE_LOGO_URL } from "@/lib/brand";
import { PDF_THEME, brandReportColor } from "@/lib/pdfTheme";
import { uiDateLocale } from "@/lib/dateFormat";

// Builds an elegant, print-ready (A4) HTML document from AI-generated content.
// Used by Niro's "create_document" action — supports headings, paragraphs,
// bullet lists, in Arabic (RTL) or English (LTR).
export function buildDocumentHtml({ title, subtitle, sections = [], dir = "ltr", companyName = "", authorName = "", color = PDF_THEME.navy, logoUrl = "" }) {
  const ar = dir === "rtl";
  const accent = brandReportColor(color);
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const sectionHtml = sections.map((sec, i) => `
    <section class="sec">
      ${sec.heading ? `<h2><span class="num">${i + 1}</span> ${esc(sec.heading)}</h2>` : ""}
      ${sec.body ? esc(sec.body).split(/\n{2,}|\n/).map((p) => `<p>${p}</p>`).join("") : ""}
      ${Array.isArray(sec.bullets) && sec.bullets.length
        ? `<ul>${sec.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
        : ""}
    </section>`).join("");

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${ar ? "ar" : "en"}">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${ar ? "'IBM Plex Sans Arabic'" : "'IBM Plex Sans Arabic'"}, sans-serif; color: #14284B; background: #F7F8FA; padding: 32px 16px; line-height: 1.9; }
  .page { position: relative; overflow: hidden; max-width: 800px; margin: 0 auto; background: #fff; padding: 56px 52px; border-top: 3px solid ${PDF_THEME.navy}; box-shadow: 0 4px 30px rgba(20,40,75,.06); }
  .head { position: relative; text-align: center; border-bottom: 1px solid #E2E8F0; padding-bottom: 24px; margin-bottom: 32px; }
  .head img { height: 52px; margin-bottom: 12px; }
  .head .brand { font-size: 12px; letter-spacing: .3em; text-transform: uppercase; color: ${accent}; margin-bottom: 10px; }
  h1 { font-family: 'Cormorant Garamond', serif; font-size: 34px; font-weight: 600; color: #14284B; }
  .subtitle { color: #5A6B85; font-size: 14px; margin-top: 8px; }
  .sec { margin-bottom: 26px; page-break-inside: avoid; }
  h2 { font-size: 18px; font-weight: 700; color: #14284B; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
  .num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: ${accent}; color: #fff; font-size: 13px; flex-shrink: 0; }
  p { font-size: 14.5px; margin-bottom: 8px; text-align: justify; }
  ul { padding-${ar ? "right" : "left"}: 22px; }
  li { font-size: 14.5px; margin-bottom: 6px; }
  li::marker { color: ${accent}; }
  .foot { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 12px; color: #5A6B85; }
  .toolbar { max-width: 800px; margin: 0 auto 16px; display: flex; justify-content: flex-end; }
  .toolbar button { background: ${accent}; color: #fff; border: 0; border-radius: 8px; padding: 10px 22px; font-size: 14px; font-family: inherit; cursor: pointer; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; padding: 24px 8px; max-width: none; }
    .toolbar { display: none; }
    @page { size: A4; margin: 18mm 14mm; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">${ar ? "تحميل PDF / طباعة" : "Download PDF / Print"}</button></div>
  <div class="page">
    <header class="head">
      <img src="${POWERCARE_LOGO_URL}" alt="NiroVera" />
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(companyName)}" />` : ""}
      ${companyName ? `<div class="brand">${esc(companyName)}</div>` : ""}
      <h1>${esc(title)}</h1>
      ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""}
    </header>
    ${sectionHtml}
    <footer class="foot">
      <span>${esc(authorName)}</span>
      <span>${new Date().toLocaleDateString(uiDateLocale(ar))}</span>
    </footer>
  </div>
</body>
</html>`;

  return html;
}

// Opens the built HTML in a new tab (falls back gracefully if popups are blocked).
export function openDocumentHtml(html) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

export function printDocument(opts) {
  return openDocumentHtml(buildDocumentHtml(opts));
}