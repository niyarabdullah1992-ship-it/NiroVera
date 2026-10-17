/**
 * «المستندات» of a new envelope: several files become ONE signing file, in the order the sender set.
 * The signing record, its fingerprint and its verify link stay one file — the merge happens before the
 * envelope exists, so nothing downstream (multiSign, the registry, the certificate) changes shape.
 * Pure of React and the store; pdf-lib only.
 */
import { PDFDocument } from "pdf-lib";

export const ENVELOPE_DOC_MAX_BYTES = 25 * 1024 * 1024;
export const ENVELOPE_DOC_MAX_COUNT = 10;
export const ENVELOPE_DOC_ACCEPT = "application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg";

const lower = (value) => String(value || "").toLowerCase();
export const isPdfName = (file) => file?.type === "application/pdf" || lower(file?.name).endsWith(".pdf");
export const isImageName = (file) => ["image/png", "image/jpeg"].includes(file?.type) || /\.(png|jpe?g)$/i.test(file?.name || "");

/** One file offered to «المستندات»: the reason it is refused, or null when it may join. */
export function envelopeDocRefusal(file, docs = [], ar = true) {
  if (!file) return ar ? "لم يُختر ملف." : "No file chosen.";
  if (!isPdfName(file) && !isImageName(file)) {
    return ar ? "يُقبل PDF أو صورة PNG/JPEG. صدّر Word وExcel إلى PDF ثم ارفعها." : "PDF or PNG/JPEG only. Export Word or Excel to PDF first.";
  }
  if (Number(file.size) > ENVELOPE_DOC_MAX_BYTES) return ar ? "الحد الأعلى للملف 25 ميجابايت." : "The limit is 25 MB per file.";
  const total = (docs || []).reduce((sum, row) => sum + (Number(row.size) || 0), 0) + (Number(file.size) || 0);
  if (total > ENVELOPE_DOC_MAX_BYTES * 2) return ar ? "مجموع المستندات يتجاوز 50 ميجابايت." : "All documents together exceed 50 MB.";
  if ((docs || []).length >= ENVELOPE_DOC_MAX_COUNT) return ar ? `الحد ${ENVELOPE_DOC_MAX_COUNT} مستندات في المظروف.` : `Up to ${ENVELOPE_DOC_MAX_COUNT} documents per envelope.`;
  return null;
}

/** Move one document up (-1) or down (+1) in the envelope order. */
export function moveDoc(docs = [], index, dir) {
  const target = index + dir;
  if (index < 0 || target < 0 || index >= docs.length || target >= docs.length) return docs;
  const next = [...docs];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** «عقد الخدمة» from «عقد-الخدمة.pdf». */
export function docTitleOf(name = "") {
  return String(name || "").replace(/\.(pdf|png|jpe?g)$/i, "").replace(/[_-]+/g, " ").trim() || String(name || "");
}

/** The signing file name: one document keeps its name, several take the subject (or the first title). */
export function envelopeFileName(docs = [], subject = "") {
  if ((docs || []).length === 1) {
    const name = String(docs[0].name || "document.pdf");
    return /\.pdf$/i.test(name) ? name : name.replace(/\.(png|jpe?g)$/i, "") + ".pdf";
  }
  const base = String(subject || "").trim() || docTitleOf(docs?.[0]?.name) || "envelope";
  return `${base.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 120).trim()}.pdf`;
}

async function bytesOf(file) {
  if (file?.bytes) return file.bytes;
  if (typeof file?.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  throw new Error("UNREADABLE");
}

/**
 * Merge the documents into one PDF, in order. An image becomes one page of its own size.
 * Returns { bytes, pageCounts: [n per document], pages }.
 */
export async function mergeEnvelopeDocuments(docs = []) {
  const out = await PDFDocument.create();
  const pageCounts = [];
  for (const doc of docs || []) {
    const raw = await bytesOf(doc);
    if (isPdfName(doc)) {
      const src = await PDFDocument.load(raw, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((page) => out.addPage(page));
      pageCounts.push(pages.length);
    } else {
      let img;
      try { img = await out.embedPng(raw); } catch { img = await out.embedJpg(raw); }
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      pageCounts.push(1);
    }
  }
  const bytes = await out.save();
  return { bytes, pageCounts, pages: pageCounts.reduce((sum, n) => sum + n, 0) };
}

/** Pages of one PDF document (0 for images and unreadable files — an image is one page once merged). */
export async function countPdfPages(doc) {
  if (!isPdfName(doc)) return 1;
  try {
    const src = await PDFDocument.load(await bytesOf(doc), { ignoreEncryption: true });
    return src.getPageCount();
  } catch {
    return 0;
  }
}
