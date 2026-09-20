import { cutPhrase, effectivePenalty, fmtDisciplineDate, penaltyLabel } from "./disciplineBoard.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDisciplineNoticeHtml(card, ar = true) {
  const item = card.item || {};
  const settled = Boolean(item.rulingLabel || card.face?.id === "closed");
  const signed = Boolean(card.signedAt);
  const head = !signed
    ? (ar ? "إبلاغ كتابي بمخالفة" : "Written notice of an offence")
    : (settled ? (ar ? "قرار جزاء مستقرّ" : "Settled sanction decision") : (ar ? "جزاء موقَّع" : "Signed sanction"));
  const pen = signed ? effectivePenalty(item, ar) : penaltyLabel(item, ar);
  const name = card.employee?.name || item.employeeId || "—";
  const branch = card.station?.name || "—";
  const offence = item.note || item.reason || "—";
  const rows = [
    [ar ? "الموظف" : "Employee", name],
    [ar ? "الفرع" : "Station", branch],
    [ar ? "المخالفة" : "Offence", offence],
    [signed ? (ar ? "الجزاء" : "Sanction") : (ar ? "الجزاء المقترح" : "Proposed sanction"), pen],
    [ar ? "الأثر المالي" : "Pay effect", signed ? cutPhrase(item, card.wage, ar) : (ar ? "لا يُحتسب قبل التوقيع" : "Not counted before signing")],
    [ar ? "تاريخ الإبلاغ" : "Notice date", fmtDisciplineDate(item.notifiedAt || item.createdAt, ar)],
  ];
  if (signed) rows.push([ar ? "تاريخ التوقيع" : "Signed on", fmtDisciplineDate(card.signedAt, ar)]);
  if (settled) rows.push([ar ? "القرار" : "Ruling", `${item.rulingLabel || ""} — ${fmtDisciplineDate(item.rulingAt, ar)}`]);

  const law = ar
    ? "للموظف أن يُبدي دفاعه ويُدوَّن قبل توقيع الجزاء (المادة 71). ولا يُتَّهم بمخالفة مضى على كشفها أكثر من ثلاثين يوماً، ولا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من ثلاثين يوماً (المادة 69). ولا يُوقَّع على المخالفة الواحدة أكثر من جزاء (المادة 67). وللموظف الاعتراض بعد التوقيع خلال ثلاثين يوماً (المادة 72)."
    : "No sanction before a recorded defence (Article 71). A worker may not be accused more than thirty days after discovery, nor sanctioned more than thirty days after the investigation ended (Article 69). One offence may not carry two penalties (Article 67). The worker may object within thirty days of signing (Article 72).";

  const sig = settled ? ""
    : `<div class="sig"><div><span>${esc(ar ? "توقيع الموظف" : "Employee signature")}</span><i></i><span>${esc(ar ? "التاريخ" : "Date")}</span><i></i></div>`
      + `<div><span>${esc(ar ? "توقيع المسؤول" : "Manager signature")}</span><i></i><span>${esc(ar ? "التاريخ" : "Date")}</span><i></i></div></div>`;

  return `<!DOCTYPE html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8">`
    + `<title>${esc(head)} — ${esc(name)}</title>`
    + `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Noto+Naskh+Arabic:wght@600&display=swap" rel="stylesheet">`
    + `<style>@page{size:A4;margin:22mm 20mm}`
    + `body{margin:0;font-family:"IBM Plex Sans Arabic",sans-serif;color:#14213d;font-size:12pt;line-height:1.9}`
    + `header{border-bottom:2px solid #14213d;padding-bottom:10pt;margin-bottom:18pt;display:flex;justify-content:space-between;align-items:flex-end;gap:16pt}`
    + `h1{font-family:"Noto Naskh Arabic",serif;font-size:19pt;margin:0}`
    + `.org{font-size:10pt;color:#4b5567;text-align:${ar ? "left" : "right"}}`
    + `table{width:100%;border-collapse:collapse;margin-bottom:16pt}`
    + `th{width:32%;text-align:start;font-weight:600;color:#4b5567;font-size:11pt;padding:7pt 0;vertical-align:top;border-bottom:1px solid #dfe3ea}`
    + `td{padding:7pt 0;border-bottom:1px solid #dfe3ea;vertical-align:top}`
    + `.law{background:#f7f8fa;border:1px solid #dfe3ea;padding:11pt 13pt;font-size:10.5pt;color:#3c4657;margin-bottom:20pt}`
    + `.sig{display:flex;gap:28pt;margin-top:26pt}`
    + `.sig>div{flex:1;display:flex;flex-direction:column;gap:4pt;font-size:10.5pt;color:#4b5567}`
    + `.sig i{display:block;border-bottom:1px dotted #14213d;height:22pt}`
    + `footer{margin-top:22pt;font-size:9.5pt;color:#6b7280;border-top:1px solid #dfe3ea;padding-top:9pt}`
    + `</style></head><body>`
    + `<header><h1>${esc(head)}</h1><span class="org">NiroVera · PowerCare<br>${esc(branch)}</span></header>`
    + `<table>${rows.map((row) => `<tr><th>${esc(row[0])}</th><td>${esc(row[1])}</td></tr>`).join("")}</table>`
    + `<p class="law">${esc(law)}</p>`
    + sig
    + `<footer>${esc(ar ? "وثيقة داخلية بسجلّ شركة. للتوقيع الإلكتروني متعدّد الأطراف احفظها PDF وارفعها في التوقيع الرقمي." : "Internal company record. For multi-party electronic signing, save as PDF and upload in Digital signing.")}</footer>`
    + `</body></html>`;
}

export function downloadDisciplineNotice(card, ar = true) {
  const item = card.item || {};
  const settled = Boolean(item.rulingLabel || card.face?.id === "closed");
  const signed = Boolean(card.signedAt);
  const head = !signed
    ? (ar ? "إبلاغ كتابي بمخالفة" : "Written notice")
    : (settled ? (ar ? "قرار جزاء مستقرّ" : "Settled sanction") : (ar ? "جزاء موقَّع" : "Signed sanction"));
  const name = card.employee?.name || item.employeeId || "file";
  const html = buildDisciplineNoticeHtml(card, ar);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${head} — ${name}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
