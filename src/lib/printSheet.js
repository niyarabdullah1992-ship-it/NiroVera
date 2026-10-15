import { POWERCARE_MARK_URL } from "./brand.js";

/**
 * One printed page for the whole platform — a task's work order, a work proof, a visitor pass,
 * a request decision, an archive list. A4, the platform's dark-green band and gold dash,
 * facts as label-over-value cells, tables, an event trail, signature boxes, and a footer that
 * says where and when it was printed. Pure HTML builder plus one print call.
 *
 * sheet = {
 *   ar, kicker, title, subtitle, ref, company, issuedBy,
 *   status: { label, tone: "ok" | "warn" | "bad" | "mute" },
 *   facts: [{ label, value, mono, wide }],
 *   blocks: [
 *     { type: "text", heading, body },
 *     { type: "table", heading, cols: [..], rows: [[..]], monoCols: [index..] },
 *     { type: "trail", heading, items: [{ at, who, what }] },
 *   ],
 *   signatures: [{ label, name }],
 *   note,
 * }
 */

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TONE = {
  ok: { ink: "#14532D", bg: "#E8F3EC", line: "#B9D7C3" },
  warn: { ink: "#7A4E0E", bg: "#FBF3E1", line: "#EAD6A8" },
  bad: { ink: "#8F1D2C", bg: "#FBEDEF", line: "#F0C9CF" },
  mute: { ink: "#3E4B44", bg: "#F1F4F2", line: "#DCE3DF" },
};

function stamp(date, ar) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return ar
    ? `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function absUrl(u) {
  try { return new URL(u, typeof window !== "undefined" ? window.location.href : "http://localhost/").href; } catch { return u; }
}

function blockHtml(b) {
  const head = b.heading ? `<h2><i></i>${esc(b.heading)}</h2>` : "";
  if (b.type === "table") {
    const mono = new Set(b.monoCols || []);
    const keep = new Set(b.nowrapCols || []);
    const cls = (i) => [mono.has(i) ? "m" : "", keep.has(i) ? "nw" : ""].filter(Boolean).join(" ");
    const rows = (b.rows || []).length
      ? b.rows.map((r) => `<tr>${r.map((c, i) => `<td${cls(i) ? ` class="${cls(i)}"` : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${(b.cols || []).length || 1}" class="empty">${esc(b.empty || "—")}</td></tr>`;
    return `<section class="blk">${head}<table><thead><tr>${(b.cols || []).map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></section>`;
  }
  if (b.type === "trail") {
    const items = (b.items || []).map((it) => `<li><span class="m at">${esc(it.at)}</span><span class="who">${esc(it.who)}</span><span class="what">${esc(it.what)}</span></li>`).join("");
    return `<section class="blk">${head}<ol class="trail">${items || `<li class="empty">—</li>`}</ol></section>`;
  }
  const paras = String(b.body ?? "").split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
  return `<section class="blk">${head}${paras || "<p>—</p>"}</section>`;
}

export function buildSheetHtml(sheet = {}, { autoPrint = false } = {}) {
  const ar = sheet.ar !== false;
  const dir = ar ? "rtl" : "ltr";
  const tone = TONE[sheet.status?.tone] || TONE.mute;
  const facts = (sheet.facts || []).filter((f) => f && f.value !== undefined && f.value !== null && f.value !== "");
  const printed = stamp(new Date(), ar);
  const sigs = sheet.signatures || [];

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${ar ? "ar" : "en"}">
<head>
<meta charset="utf-8" />
<title>${esc([sheet.title, sheet.ref].filter(Boolean).join(" — "))}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Readex+Pro:wght@600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#EEF2EF}
body{font-family:'IBM Plex Sans Arabic',sans-serif;color:#111418;font-size:12.5px;line-height:1.7;padding:24px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:794px;margin:0 auto;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 6px 24px rgba(11,61,39,.08)}
.band{background:linear-gradient(160deg,#0B3D27 0%,#0F5535 100%);color:#fff;padding:22px 30px 20px;display:flex;flex-direction:column;gap:10px}
.top{display:flex;align-items:center;gap:10px}
.top img{width:26px;height:26px;background:#fff;border-radius:7px;padding:4px;box-sizing:content-box}
.brand{display:flex;flex-direction:column;line-height:1.25}
.brand b{font-size:13px}
.brand span{font-size:10px;color:#A9CDB8}
.top .co{margin-inline-start:auto;font-size:12px;color:#C5DBCD;text-align:end}
.kick{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#A9CDB8;font-weight:600;margin-top:6px}
.kick i{display:inline-block;width:14px;height:2px;background:#C8A45A;border-radius:4px}
h1{font-family:'Readex Pro','IBM Plex Sans Arabic',sans-serif;font-size:22px;font-weight:700;line-height:1.35}
.sub{font-size:12px;color:#C5DBCD}
.meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:10px;border-top:1px solid rgba(255,255,255,.14);font-size:11.5px;color:#C5DBCD}
.pill{display:inline-block;padding:1px 10px;border-radius:999px;font-weight:700;font-size:11px;background:${tone.bg};color:${tone.ink};border:1px solid ${tone.line}}
.m{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.body{padding:22px 30px 26px;display:flex;flex-direction:column;gap:18px}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.fact{border:1px solid #E3E9E5;background:#F7FAF8;border-radius:8px;padding:8px 11px;min-width:0}
.fact.wide{grid-column:1/-1}
.fact small{display:block;font-size:10.5px;color:#5B6B63;font-weight:600}
.fact b{display:block;font-size:13px;font-weight:700;overflow-wrap:anywhere}
.blk{break-inside:avoid-page}
h2{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;margin-bottom:8px;color:#0B3D27}
h2 i{display:inline-block;width:14px;height:2px;background:#C8A45A;border-radius:4px}
p{margin-bottom:6px;color:#26332C}
table{width:100%;border-collapse:collapse;font-size:11.5px}
th{background:#E8F3EC;color:#0B3D27;font-weight:700;text-align:start;padding:7px 9px;border-bottom:1.5px solid #B9D7C3;white-space:nowrap}
td{padding:7px 9px;border-bottom:1px solid #EEF1EF;vertical-align:top;overflow-wrap:anywhere}
tbody tr:nth-child(even) td{background:#FAFCFB}
tr{break-inside:avoid}
td.nw{white-space:nowrap;overflow-wrap:normal}
td.empty,li.empty{color:#7A8A82;text-align:center}
.trail{list-style:none;display:flex;flex-direction:column;border-inline-start:2px solid #DCE8E0;padding-inline-start:12px;gap:6px}
.trail li{display:grid;grid-template-columns:120px 140px minmax(0,1fr);gap:8px;position:relative}
.trail li::before{content:"";position:absolute;inset-inline-start:-18px;top:7px;width:10px;height:10px;border-radius:999px;background:#0F5535;border:2px solid #fff}
.trail .at{font-size:11px;color:#5B6B63;text-align:start}
.trail .who{font-weight:700}
.sigs{display:grid;grid-template-columns:repeat(${Math.max(1, Math.min(3, sigs.length))},minmax(0,1fr));gap:12px;margin-top:6px}
.sig{border:1px dashed #B9C8BF;border-radius:8px;padding:10px 12px;height:96px;display:flex;flex-direction:column;justify-content:space-between}
.sig small{font-size:10.5px;color:#5B6B63;font-weight:600}
.sig b{font-size:12.5px}
.sig span{font-size:10.5px;color:#7A8A82;border-top:1px solid #DCE3DF;padding-top:4px}
.note{font-size:11px;color:#5B6B63;background:#FBF8F0;border:1px solid #EFE3C4;border-radius:8px;padding:8px 11px}
.foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 30px;border-top:1px solid #E3E9E5;font-size:10.5px;color:#5B6B63;background:#F7FAF8}
.bar{max-width:794px;margin:0 auto 12px;display:flex;justify-content:flex-end}
.bar button{font-family:inherit;background:#0B3D27;color:#fff;border:0;border-radius:9px;height:38px;padding:0 18px;font-size:13px;font-weight:700;cursor:pointer}
@media print{
  html,body{background:#fff}
  body{padding:0}
  .page{box-shadow:none;border-radius:0;max-width:none}
  .bar{display:none}
  @page{size:A4;margin:12mm 10mm}
}
</style>
</head>
<body>
<div class="bar"><button type="button" onclick="window.print()">${ar ? "طباعة / حفظ PDF" : "Print / save PDF"}</button></div>
<main class="page">
  <header class="band">
    <div class="top">
      <img src="${esc(absUrl(POWERCARE_MARK_URL))}" alt="" />
      <span class="brand"><b>${ar ? "نيروفيرا" : "NiroVera"}</b><span>NiroVera</span></span>
      ${sheet.company ? `<span class="co">${esc(sheet.company)}</span>` : ""}
    </div>
    ${sheet.kicker ? `<div class="kick"><i></i>${esc(sheet.kicker)}</div>` : ""}
    <h1>${esc(sheet.title || "—")}</h1>
    ${sheet.subtitle ? `<div class="sub">${esc(sheet.subtitle)}</div>` : ""}
    <div class="meta">
      ${sheet.status?.label ? `<span class="pill">${esc(sheet.status.label)}</span>` : ""}
      ${sheet.ref ? `<span>${ar ? "المرجع" : "Ref"} <span class="m">${esc(sheet.ref)}</span></span>` : ""}
      <span>${ar ? "طُبع" : "Printed"} <span class="m">${esc(printed)}</span></span>
      ${sheet.issuedBy ? `<span>${ar ? "بواسطة" : "By"} ${esc(sheet.issuedBy)}</span>` : ""}
    </div>
  </header>
  <div class="body">
    ${facts.length ? `<div class="facts">${facts.map((f) => `<div class="fact${f.wide ? " wide" : ""}"><small>${esc(f.label)}</small><b${f.mono ? ' class="m"' : ""}>${esc(f.value)}</b></div>`).join("")}</div>` : ""}
    ${(sheet.blocks || []).filter(Boolean).map(blockHtml).join("")}
    ${sigs.length ? `<section class="blk"><h2><i></i>${ar ? "التوقيعات" : "Signatures"}</h2><div class="sigs">${sigs.map((s) => `<div class="sig"><small>${esc(s.label)}</small><b>${esc(s.name || "")}</b><span>${ar ? "التوقيع والتاريخ" : "Signature & date"}</span></div>`).join("")}</div></section>` : ""}
    ${sheet.note ? `<div class="note">${esc(sheet.note)}</div>` : ""}
  </div>
  <footer class="foot">
    <span>${ar ? "صادر من منصة نيروفيرا — الأرقام مشتقة من السجل" : "Issued from NiroVera — figures derived from the record"}</span>
    <span class="m">${esc(sheet.ref || "")}</span>
  </footer>
</main>
${autoPrint ? `<script>window.addEventListener("load",function(){var go=function(){setTimeout(function(){try{window.print()}catch(e){}},120)};if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go,go)}else{go()}});</script>` : ""}
</body>
</html>`;
}

function safeName(s) {
  return String(s || "nirovera").replace(/[^\w؀-ۿ.-]+/g, "_").slice(0, 80) || "nirovera";
}

/**
 * Print the sheet. A hidden frame first (stays on the page, works where pop-ups are blocked),
 * then a new tab, then a downloaded HTML file the person can open and print.
 * Returns "frame" | "tab" | "file".
 */
export function printSheet(sheet) {
  const html = buildSheetHtml(sheet, { autoPrint: false });
  try {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("data-print-frame", "1");
    frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const go = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        openTabOrFile(sheet);
      }
      setTimeout(() => frame.remove(), 60000);
    };
    const fonts = frame.contentWindow.document.fonts;
    const ready = () => setTimeout(go, 150);
    if (fonts?.ready) fonts.ready.then(ready, ready);
    else ready();
    return "frame";
  } catch {
    return openTabOrFile(sheet);
  }
}

function openTabOrFile(sheet) {
  const html = buildSheetHtml(sheet, { autoPrint: true });
  try {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      return "tab";
    }
  } catch { /* fall through to the file */ }
  const blob = new Blob([buildSheetHtml(sheet)], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName([sheet.title, sheet.ref].filter(Boolean).join("-"))}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return "file";
}
