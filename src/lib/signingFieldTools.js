import { getCompanyData, updateCompany } from "@/lib/store";
import { STAMP_WIDTH_PERCENT, TEXT_WIDTH_PERCENT } from "@/lib/signatureStampGeometry";

/* --------------------------- signature spot detection --------------------------- */

// Half-widths used to park a suggested field beside its label instead of on top of it.
const HALF_WIDTH = {
  signature: STAMP_WIDTH_PERCENT / 2 + 1,
  date: TEXT_WIDTH_PERCENT / 2 + 1,
  name: TEXT_WIDTH_PERCENT / 2 + 1,
};

const LABELS = [
  { kind: "signature", test: /(التوقيع|توقيع|المُوقِّع|الموقع|signature|signed by)/i },
  { kind: "date", test: /(التاريخ|تاريخ|date)/i },
  { kind: "name", test: /(الاسم|اسم|full name|name)/i },
];

// Only treat short strings that read like form labels as anchors, so the word
// "التاريخ" inside a paragraph does not sprout a field in the middle of a line.
function labelKind(raw) {
  const text = raw.trim();
  if (!text || text.length > 32) return null;
  const looksLikeLabel = /[:：]/.test(text) || /[_.\u0640]{3,}$/.test(text) || text.split(/\s+/).length <= 3;
  if (!looksLikeLabel) return null;
  return LABELS.find((entry) => entry.test.test(text))?.kind || null;
}

/**
 * Reads the text layer of every page and proposes where signature, date and name
 * fields belong. Positions are page percentages, matching the field model.
 */
export async function detectFieldSpots(pdf) {
  if (!pdf) return [];
  const found = [];
  const seen = new Set();
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      const kind = labelKind(String(item.str || ""));
      if (!kind) continue;
      const left = Number(item.transform?.[4]) || 0;
      const bottom = Number(item.transform?.[5]) || 0;
      const width = Number(item.width) || 0;
      const rtl = /[\u0600-\u06FF]/.test(item.str);
      const half = HALF_WIDTH[kind];
      const anchorX = ((rtl ? left : left + width) / view.width) * 100;
      let x = rtl ? anchorX - half - 2 : anchorX + half + 2;
      let y = (1 - bottom / view.height) * 100 - 1.2;
      // No room beside the label — drop the field on the line underneath it.
      if (x < half + 2 || x > 98 - half) {
        x = Math.min(98 - half, Math.max(half + 2, anchorX));
        y += kind === "signature" ? 5 : 3.4;
      }
      if (y < 3 || y > 97) continue;
      const key = `${pageNumber}:${kind}:${Math.round(x / 4)}:${Math.round(y / 3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ page: pageNumber, x, y, kind });
    }
  }
  return found;
}

/* ------------------------------- field templates ------------------------------- */

const templateId = () => `tpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function listFieldTemplates(companyId) {
  if (!companyId) return [];
  return getCompanyData(companyId)?.signingFieldTemplates || [];
}

/** Stores the placement only — never the typed values, which belong to one document. */
export function saveFieldTemplate(companyId, name, fields) {
  if (!companyId) return null;
  const template = {
    id: templateId(),
    name: String(name || "").trim() || new Date().toLocaleDateString("en-GB"),
    savedAt: new Date().toISOString(),
    signerCount: fields.reduce((max, field) => Math.max(max, Number(field.signer) + 1), 1),
    fields: fields.map((field) => ({
      tool: field.tool,
      type: field.type,
      label: field.label,
      page: field.page,
      x: field.x,
      y: field.y,
      scale: field.scale,
      signer: field.signer,
      required: field.required !== false,
    })),
  };
  updateCompany(companyId, (data) => {
    data.signingFieldTemplates = [template, ...(data.signingFieldTemplates || [])].slice(0, 12);
  });
  return template;
}

export function deleteFieldTemplate(companyId, id) {
  if (!companyId) return;
  updateCompany(companyId, (data) => {
    data.signingFieldTemplates = (data.signingFieldTemplates || []).filter((template) => template.id !== id);
  });
}
