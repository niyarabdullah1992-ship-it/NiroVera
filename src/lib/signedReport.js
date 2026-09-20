import { base44 } from "@/api/base44Client";
import { getCompanyToken } from "@/lib/store";
import { registerLocalSignedDoc } from "@/lib/localSignedDocs";
import { makeVerificationBadgeCanvas, generateVerificationId, loadBadgeQr } from "@/lib/verificationBadge";
import { imageBlobToPdf } from "@/lib/signPdf";
import { sha256HexOfBuffer } from "@/lib/fileHash";
import { PDF_THEME } from "@/lib/pdfTheme";
import { POWERCARE_MARK_URL } from "@/lib/brand";

// Draws the report DIRECTLY on canvas (title + table + signature + verification
// badge) — fully deterministic, full Arabic/RTL support, no HTML rendering step
// that could silently fail. The badge and signature are part of the file pixels.

function clip(ctx, text, maxW) {
  let s = String(text ?? "");
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawReportCanvas({ title, companyName, dir, headers, rows }) {
  const W = 1400;
  const rowH = 42;
  const tableTop = 190;
  const footerSpace = 340; // reserved for signature + badge
  const H = tableTop + (rows.length + 1) * rowH + footerSpace;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const rtl = dir === "rtl";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PDF_THEME.ink;
  ctx.fillRect(0, 0, W, 8);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  const xTitle = rtl ? W - 120 : 120;

  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillStyle = PDF_THEME.muted;
  ctx.font = "700 13px Tahoma, Arial, sans-serif";
  ctx.fillText("NIROVERA", xTitle, 46);
  ctx.fillStyle = PDF_THEME.ink;
  ctx.font = "600 34px Georgia, Tahoma, serif";
  ctx.fillText(title, xTitle, 86);
  ctx.fillStyle = PDF_THEME.muted;
  ctx.font = "17px Tahoma, Arial, sans-serif";
  ctx.fillText(`${companyName} — ${new Date().toLocaleDateString(rtl ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}`, xTitle, 120);
  ctx.strokeStyle = PDF_THEME.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 148);
  ctx.lineTo(W - 48, 148);
  ctx.stroke();

  // Table
  const colW = (W - 96) / headers.length;
  const cellX = (i) => (rtl ? W - 48 - i * colW - 10 : 48 + i * colW + 10);

  ctx.fillStyle = PDF_THEME.ink;
  ctx.fillRect(48, tableTop - 28, W - 96, rowH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 15px Tahoma, Arial, sans-serif";
  headers.forEach((h, i) => ctx.fillText(clip(ctx, h, colW - 20), cellX(i), tableTop));

  ctx.font = "15px Tahoma, Arial, sans-serif";
  rows.forEach((r, ri) => {
    const y = tableTop + (ri + 1) * rowH;
    if (ri % 2) {
      ctx.fillStyle = PDF_THEME.cream;
      ctx.fillRect(48, y - 28, W - 96, rowH);
    }
    ctx.fillStyle = PDF_THEME.ink;
    r.forEach((c, ci) => ctx.fillText(clip(ctx, c, colW - 20), cellX(ci), y));
    ctx.strokeStyle = PDF_THEME.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, y + 11);
    ctx.lineTo(W - 48, y + 11);
    ctx.stroke();
  });

  ctx.fillStyle = PDF_THEME.muted;
  ctx.font = "13px Tahoma, Arial, sans-serif";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillText("NiroVera • Secure verified document", rtl ? W - 48 : 48, H - 24);

  return canvas;
}

export async function generateSignedReport({ title, companyName, dir, headers, rows, signerName, signerId, companyId, signatureUrl, logoUrl }) {
  const canvas = drawReportCanvas({ title, companyName, dir, headers, rows });
  const ctx = canvas.getContext("2d");

  // Add the company logo to the report header without replacing NiroVera's verification identity.
  const sigId = generateVerificationId();
  const [qr, sigImg, logoImg, platformLogo] = await Promise.all([loadBadgeQr(sigId), loadImage(signatureUrl), loadImage(logoUrl), loadImage(POWERCARE_MARK_URL)]);
  if (platformLogo) {
    const x = dir === "rtl" ? canvas.width - 112 : 48;
    ctx.drawImage(platformLogo, x, 28, 72, 72);
  }
  if (logoImg) {
    const maxW = 96;
    const maxH = 72;
    const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height);
    const width = logoImg.width * scale;
    const height = logoImg.height * scale;
    const x = dir === "rtl" ? 48 : canvas.width - 48 - width;
    ctx.drawImage(logoImg, x, 34 + (maxH - height) / 2, width, height);
  }

  // Stamp the handwritten signature + verification badge in the bottom corner.
  const badge = makeVerificationBadgeCanvas(sigId, signerName, qr);
  const bw = 520;
  const bh = bw * (badge.height / badge.width);
  const bx = canvas.width - bw - 48;
  const by = canvas.height - bh - 40;
  if (sigImg) {
    const sw = bw * 0.5;
    const sh = sw * (sigImg.height / sigImg.width);
    ctx.drawImage(sigImg, bx + (bw - sw) / 2, Math.max(by - sh - 6, 0), sw, sh);
  }
  ctx.drawImage(badge, bx, by, bw, bh);

  // Wrap into a PDF, fingerprint it and register in the verification registry.
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Report image too large to sign");
  const { bytes } = await imageBlobToPdf(blob);
  const fileHash = await sha256HexOfBuffer(bytes);
  const entry = {
    verificationId: sigId,
    fileHash,
    signerName,
    signerId,
    companyId,
    fileName: `${title}.pdf`,
  };
  registerLocalSignedDoc(companyId, entry);
  try {
    await base44.functions.invoke("signedDocs", {
      action: "register",
      ...entry,
      sessionToken: getCompanyToken(companyId),
    });
  } catch (err) {
    if (String(err?.response?.data?.error || err?.message || "").includes("SIGNATURE_REUSE")) throw err;
  }

  // Download the signed PDF locally.
  const dl = new Blob([bytes], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(dl);
  a.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}-signed.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);

  return { verificationId: sigId };
}