/**
 * «المستندات» of a new envelope: several files become ONE signing file, in the order the sender set.
 * The signing record, its fingerprint and its verify link stay one file — the merge happens before the
 * envelope exists, so nothing downstream (multiSign, the registry, the certificate) changes shape.
 * Pure of React and the store; pdf-lib only.
 */
import { PDFDocument } from "pdf-lib";

/** countPdfPages: the file opens only with a password — the signer could never read it. */
export const PDF_NEEDS_PASSWORD = -1;
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

/**
 * Browser fallback for PDFs pdf-lib cannot parse (non-standard cross-reference tables, owner-password
 * permissions, broken object streams — common in exported exam keys and bank statements): pdf.js opens
 * almost anything a viewer opens, so the page count comes from it and, for the merge, each page is drawn
 * to an image at print resolution. The signed file then carries those pages as images — the content and
 * fingerprint stay faithful; only text selection is lost. Never used in node (no canvas).
 */
async function openWithPdfjs(raw) {
  if (typeof document === "undefined") throw new Error("NO_PDFJS");
  const mod = await import("./pdfjsSetup.js");
  const pdfjsLib = mod.default || mod.pdfjsLib;
  return pdfjsLib.getDocument({ data: raw.slice ? raw.slice(0) : raw, password: "", isEvalSupported: false, useSystemFonts: true, stopAtErrors: false }).promise;
}

async function rasterizePdfInto(out, raw, scale = 2) {
  const pdf = await openWithPdfjs(raw);
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const view = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(view.width);
    canvas.height = Math.ceil(view.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: view }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const target = out.addPage([base.width, base.height]);
    target.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
  }
  return pdf.numPages;
}

async function bytesOf(file) {
  // Stored drafts carry raw bytes. A browser File has its own Blob.prototype.bytes() METHOD (Chrome 132+,
  // Safari, Firefox) — taking that function as the data made every PDF «unreadable» on current browsers.
  if (file?.bytes instanceof Uint8Array) return file.bytes;
  if (file?.bytes instanceof ArrayBuffer) return new Uint8Array(file.bytes);
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
      let src = null;
      try { src = await PDFDocument.load(raw, { ignoreEncryption: true, throwOnInvalidObject: false }); } catch { src = null; }
      // Copy the real pages only when pdf-lib reads the same number the viewer shows (and nothing is encrypted).
      let viewerPages = null;
      if (typeof document !== "undefined") {
        try { viewerPages = (await openWithPdfjs(raw)).numPages; } catch { viewerPages = null; }
      }
      if (src && !src.isEncrypted && (viewerPages == null || src.getPageCount() >= viewerPages)) {
        try {
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((page) => out.addPage(page));
          pageCounts.push(pages.length);
          continue;
        } catch { /* falls through to pdf.js */ }
      }
      // pdf-lib could not read it, or it is encrypted (copying would carry unreadable streams): pdf.js draws it.
      pageCounts.push(await rasterizePdfInto(out, raw));
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
  const raw = await bytesOf(doc).catch(() => null);
  if (!raw) return 0;
  // Two readers, the larger answer wins: pdf-lib can drop a malformed page or refuse a file a viewer
  // opens, pdf.js (the viewer's own engine) can miss a page pdf-lib still reads. In node only pdf-lib runs.
  let libPages = 0;
  let encrypted = false;
  try {
    const src = await PDFDocument.load(raw, { ignoreEncryption: true, throwOnInvalidObject: false });
    libPages = src.getPageCount();
    encrypted = src.isEncrypted;
  } catch { libPages = 0; }
  let viewerPages = 0;
  if (typeof document !== "undefined") {
    try {
      viewerPages = (await openWithPdfjs(raw)).numPages || 0;
    } catch (err) {
      if (err?.name === "PasswordException" || /password/i.test(String(err?.message || ""))) return PDF_NEEDS_PASSWORD;
      if (encrypted) return 0; // encrypted and the viewer cannot open it — the signers could not either
    }
  }
  return Math.max(libPages, viewerPages); // 0 = genuinely unreadable — the setup names it
}
