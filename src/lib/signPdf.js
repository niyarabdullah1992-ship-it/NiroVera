import { LineCapStyle, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { base44 } from "@/api/base44Client";
import { loadBadgeQr, makeVerificationBadgeCanvas } from "@/lib/verificationBadge";
import { TEXT_HEIGHT_PERCENT, TEXT_WIDTH_PERCENT, fitStampSize } from "@/lib/signatureStampGeometry";

// Renders the verification badge to PNG bytes using an ALREADY-LOADED QR image
// (prefetched while the user was choosing the file) — no network wait here.
async function badgePngBytes(sigId, signerName, qrImg, sigUrl, signatureVariant) {
  let signatureImg = null;
  let objectUrl = "";
  if (sigUrl) {
    const signatureBlob = await fetch(sigUrl).then((response) => response.blob());
    objectUrl = URL.createObjectURL(signatureBlob);
    signatureImg = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  }
  const qr = qrImg || await loadBadgeQr(sigId);
  const canvas = makeVerificationBadgeCanvas(sigId, signerName, qr, signatureImg, signatureVariant);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return { bytes: await blob.arrayBuffer(), ratio: canvas.height / canvas.width };
}

// A tick or a cross is drawn as vector strokes, not as a glyph: no standard PDF
// font encodes U+2713/U+2717, and a rasterised fallback would look different on
// every machine that opens the document.
export const MARK_GLYPHS = ["✓", "✗"];
export const isMarkField = (field) => field?.tool === "check";

function drawMark(page, glyph, centerX, centerY, size) {
  const ink = rgb(0.08, 0.12, 0.18);
  const thickness = Math.max(1.2, size * 0.13);
  const line = (x1, y1, x2, y2) => page.drawLine({
    start: { x: centerX + x1 * size, y: centerY + y1 * size },
    end: { x: centerX + x2 * size, y: centerY + y2 * size },
    thickness,
    color: ink,
    lineCap: LineCapStyle.Round,
  });
  if (glyph === "✗") {
    line(-0.3, -0.3, 0.3, 0.3);
    line(-0.3, 0.3, 0.3, -0.3);
    return;
  }
  line(-0.36, 0.02, -0.10, -0.28);
  line(-0.10, -0.28, 0.36, 0.32);
}

export async function drawTextField(pdf, page, field, rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return;
  const { width, height } = page.getSize();
  const scale = Math.min(2, Math.max(0.5, Number(field.scale || 100) / 100));
  const boxHeight = Math.max(20, height * (TEXT_HEIGHT_PERCENT / 100) * scale);
  const boxWidth = isMarkField(field) ? boxHeight : width * (TEXT_WIDTH_PERCENT / 100) * scale;
  const centerX = width * Number(field.x || 0) / 100;
  const centerY = height - height * Number(field.y || 0) / 100;
  if (isMarkField(field)) {
    drawMark(page, value, centerX, centerY, boxHeight);
    return;
  }
  const fontSize = Math.min(18, Math.max(8, boxHeight * 0.42));
  try {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let printable = value;
    while (printable.length > 1 && font.widthOfTextAtSize(printable, fontSize) > boxWidth - 8) printable = `${printable.slice(0, -2)}…`;
    page.drawText(printable, { x: centerX - boxWidth / 2 + 4, y: centerY - fontSize / 2, size: fontSize, font, color: rgb(0.08, 0.12, 0.18), maxWidth: boxWidth - 8 });
  } catch {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 220;
    const context = canvas.getContext("2d"); context.fillStyle = "#111827"; context.font = "52px Arial"; context.textAlign = "center"; context.textBaseline = "middle"; context.direction = /[\u0600-\u06ff]/.test(value) ? "rtl" : "ltr"; context.fillText(value.slice(0, 160), 600, 110, 1160);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const image = await pdf.embedPng(await blob.arrayBuffer());
    page.drawImage(image, { x: centerX - boxWidth / 2, y: centerY - boxHeight / 2, width: boxWidth, height: boxHeight });
  }
}

// Stamps the verification badge onto the PDF, uploads the signed copy and
// returns { url, bytes } — bytes are used to hash the file locally without
// re-downloading it.
export async function signPdfFile(docUrl, sigUrl, signerName, sigId, spot, qrImg, sizeScale = 1, uploadResult = true, fields = null, textValues = {}, signatureVariant = "unique", signatureTheme = "heritage", stampDataUrl = "") {
  const sc = Math.min(Math.max(Number(sizeScale) || 1, 0.5), 2);
  const pdfBytes = await fetch(docUrl).then((r) => r.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  // A seal designed in the stamp studio arrives already rendered — embed it as is
  // so the page carries exactly the artwork its owner approved.
  const badge = stampDataUrl
    ? { bytes: await fetch(stampDataUrl).then((r) => r.arrayBuffer()), ratio: 0 }
    : await badgePngBytes(sigId, signerName, qrImg, sigUrl, signatureVariant);
  const badgeImg = await pdf.embedPng(badge.bytes);
  const badgeRatio = badge.ratio || badgeImg.height / badgeImg.width;
  const pages = pdf.getPages();
  const assignedFields = Array.isArray(fields) && fields.length ? fields : [{ ...(spot || { page: pages.length, x: 76, y: 88 }), id: "signature", type: "signature", scale: sc * 100 }];
  for (const field of assignedFields) {
    const page = pages[Math.min(Math.max(Number(field.page) || 1, 1), pages.length) - 1];
    if (field.type === "text") { await drawTextField(pdf, page, field, textValues[field.id]); continue; }
    const { width, height } = page.getSize();
    const fieldScale = Math.min(2, Math.max(0.5, Number(field.scale || sc * 100) / 100));
    const { width: bw, height: bh } = fitStampSize(width, height, badgeRatio, fieldScale);
    const bx = Math.min(Math.max((width * Number(field.x)) / 100 - bw / 2, 0), width - bw);
    const by = Math.min(Math.max(height - (height * Number(field.y)) / 100 - bh / 2, 0), height - bh);
    page.drawImage(badgeImg, { x: bx, y: by, width: bw, height: bh });
  }
  const out = await pdf.save();
  if (!uploadResult) return { url: null, bytes: out };
  const file = new File([out], "signed-document.pdf", { type: "application/pdf" });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, bytes: out };
}

// Wraps an already-signed image (PNG blob) into a one-page PDF sized to the
// image, uploads it and returns { url, bytes }.
export async function imageBlobToPdf(blob, uploadResult = true) {
  const bytes = await blob.arrayBuffer();
  const pdf = await PDFDocument.create();
  let img;
  try {
    img = await pdf.embedPng(bytes.slice(0));
  } catch {
    img = await pdf.embedJpg(bytes.slice(0));
  }
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  const out = await pdf.save();
  if (!uploadResult) return { url: null, bytes: out };
  const file = new File([out], "signed-document.pdf", { type: "application/pdf" });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, bytes: out };
}