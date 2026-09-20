import { PDFDocument } from "pdf-lib";
import { base44 } from "@/api/base44Client";
import { generateVerificationId, verificationUrlFor } from "@/lib/verificationBadge";
import { STAMP_FALLBACK_SPOT, clampStampScale, fitStampSize } from "@/lib/signatureStampGeometry";
import { drawTextField } from "@/lib/signPdf";
import { DEFAULT_STAMP_CONFIG, normalizeStampConfig, renderStampDataUrl, STAMP_DESIGNS } from "@/lib/stampStudio";

function resolveStampConfig(name, markUrl, themeOrConfig) {
  const extra = themeOrConfig && typeof themeOrConfig === "object" && !Array.isArray(themeOrConfig)
    ? themeOrConfig
    : {};
  const designId = typeof themeOrConfig === "string" ? themeOrConfig : extra.design;
  const known = STAMP_DESIGNS.some((item) => item.id === designId);
  return normalizeStampConfig({
    ...DEFAULT_STAMP_CONFIG,
    ...extra,
    design: known ? designId : (extra.design || DEFAULT_STAMP_CONFIG.design),
    name: name || extra.name || "",
    markUrl: markUrl || extra.markUrl || "",
  });
}

// Same studio renderer as StampStudio — preview and PDF share one artwork.
export async function makeSignatureStamp(sigDataUrl, name, verificationId = "", _style, themeOrConfig) {
  const id = String(verificationId || "").trim() || generateVerificationId();
  const config = resolveStampConfig(name, sigDataUrl, themeOrConfig);
  return renderStampDataUrl(config, {
    verificationId: id,
    verificationUrl: verificationUrlFor(id),
  });
}

// Stamps the signer's composed stamp only in the creator-assigned fields.
// No certificate or extra page is appended to the original document.
export async function stampOnPdf(docUrl, stampDataUrl, slotIndex, _badge, spot, sizeScale = 1, uploadResult = true, fields = null, textValues = {}) {
  const scale = clampStampScale((Number(sizeScale) || 1) * 100) / 100;
  const pdfBytes = await fetch(docUrl).then((r) => r.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdf.getPages();

  const stampBytes = await fetch(stampDataUrl).then((r) => r.arrayBuffer());
  const stampImg = await pdf.embedPng(stampBytes);

  const assignedFields = Array.isArray(fields) && fields.length ? fields : [{ ...(spot?.page >= 1 ? spot : { ...STAMP_FALLBACK_SPOT, page: pages.length }), id: "signature", type: "signature", scale: scale * 100 }];
  for (const field of assignedFields) {
    const page = pages[Math.min(Math.max(Math.round(field.page || 1), 1), pages.length) - 1];
    if (field.type === "text") { await drawTextField(pdf, page, field, textValues[field.id]); continue; }
    const { width, height } = page.getSize();
    const fieldScale = clampStampScale(Number(field.scale) || scale * 100) / 100;
    const { width: sw, height: sh } = fitStampSize(width, height, stampImg.height / stampImg.width, fieldScale);
    const cx = (Number(field.x) / 100) * width;
    const cy = height - (Number(field.y) / 100) * height;
    const drawX = Math.min(width - sw, Math.max(0, cx - sw / 2));
    const drawY = Math.min(height - sh, Math.max(0, cy - sh / 2));
    page.drawImage(stampImg, { x: drawX, y: drawY, width: sw, height: sh });
  }

  const out = await pdf.save();
  if (!uploadResult) return { url: null, bytes: out };
  const file = new File([out], "signed-document.pdf", { type: "application/pdf" });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, bytes: out };
}