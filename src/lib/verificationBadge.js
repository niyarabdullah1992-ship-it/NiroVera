import {
  drawBrandSealFrame,
  drawEncryptedFingerprint,
  drawScannerCorners,
  fillTracked,
  GREEN,
  MUTED,
  NAVY,
  PAPER,
} from "@/lib/signatureStampThemes";
import { STAMP_CANVAS_HEIGHT, STAMP_CANVAS_WIDTH } from "@/lib/signatureStampGeometry";

const SANS = "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif";
const MONO = "'Courier New', monospace";

async function qrToCanvas(canvas, text, options) {
  const mod = await import("qrcode");
  const toCanvas = mod.toCanvas || mod.default?.toCanvas;
  if (typeof toCanvas !== "function") return null;
  await toCanvas(canvas, text, options);
  return canvas;
}

export function generateVerificationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(bytes, (x) => x.toString(16).padStart(2, "0").toUpperCase()).join("");
  return `PWC-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export function verificationUrlFor(sigId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verify?id=${encodeURIComponent(sigId)}`;
}

export async function loadBadgeQr(sigId) {
  if (!sigId) return null;
  try {
    const canvas = document.createElement("canvas");
    const drawn = await qrToCanvas(canvas, verificationUrlFor(sigId), {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: NAVY, light: PAPER },
    });
    return drawn;
  } catch {
    return null;
  }
}

function cropOpaqueImage(img) {
  if (!img?.width || !img?.height) return null;
  const probe = document.createElement("canvas");
  probe.width = img.width;
  probe.height = img.height;
  const pctx = probe.getContext("2d");
  pctx.drawImage(img, 0, 0);
  const pixels = pctx.getImageData(0, 0, probe.width, probe.height);
  let left = probe.width;
  let top = probe.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      if (pixels.data[(y * probe.width + x) * 4 + 3] > 12) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) return img;
  const pad = 4;
  const cropped = document.createElement("canvas");
  cropped.width = right - left + 1 + pad * 2;
  cropped.height = bottom - top + 1 + pad * 2;
  cropped.getContext("2d").drawImage(
    probe,
    left,
    top,
    right - left + 1,
    bottom - top + 1,
    pad,
    pad,
    right - left + 1,
    bottom - top + 1,
  );
  return cropped;
}

function looksLikeComposedStamp(img) {
  if (!img?.width || !img?.height) return false;
  const scale = img.width / STAMP_CANVAS_WIDTH;
  if (scale < 1 || Math.abs(scale - Math.round(scale)) > 0.01) return false;
  const s = Math.round(scale);
  return img.height === STAMP_CANVAS_HEIGHT * s || img.height === 176 * s;
}

function drawSignatureMark(ctx, img, x, y, maxW, maxH) {
  const mark = cropOpaqueImage(img) || img;
  if (!mark.width || !mark.height) return false;
  const ratio = Math.min(maxW / mark.width, maxH / mark.height);
  const dw = Math.max(1, mark.width * ratio);
  const dh = Math.max(1, mark.height * ratio);
  ctx.drawImage(mark, x, y + (maxH - dh) / 2, dw, dh);
  return true;
}

export function makeVerificationBadgeCanvas(sigId, signerName, qrImg, signatureImg = null, _signatureVariant = "unique") {
  const scale = 3;
  const W = STAMP_CANVAS_WIDTH;
  const H = STAMP_CANVAS_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const arabic =
    /[\u0600-\u06ff]/.test(signerName || "")
    || (typeof document !== "undefined" && document.documentElement.dir === "rtl");
  const id = String(sigId || "").trim();
  const dateText = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  drawBrandSealFrame(ctx, W, H);

  ctx.fillStyle = GREEN;
  ctx.fillRect(8, 18, 3, H - 36);

  drawEncryptedFingerprint(ctx, 92, H / 2, 118);

  const qrSize = 108;
  const qrX = W - 38 - qrSize;
  const qrY = (H - qrSize) / 2;
  if (qrImg) ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  drawScannerCorners(ctx, qrX, qrY, qrSize, qrSize, 7, GREEN);

  ctx.strokeStyle = "rgba(20, 40, 75, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(qrX - 22, 28);
  ctx.lineTo(qrX - 22, H - 28);
  ctx.stroke();

  const tx = 164;
  const maxText = qrX - 44 - tx;

  ctx.fillStyle = NAVY;
  ctx.font = `600 11px ${SANS}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  fillTracked(ctx, "NIROVERA", tx, 32, 2);

  const mark = signatureImg && !looksLikeComposedStamp(signatureImg) ? signatureImg : null;
  const drewMark = mark ? drawSignatureMark(ctx, mark, tx, 40, Math.min(maxText, 420), 86) : false;

  if (!drewMark) {
    ctx.fillStyle = MUTED;
    ctx.font = `500 10px ${SANS}`;
    if (arabic) {
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      const caption = "\u202Bرقم التحقق المشفّر\u202C";
      ctx.fillText(caption, tx + ctx.measureText(caption).width, 58, maxText);
      ctx.direction = "ltr";
      ctx.textAlign = "left";
    } else {
      fillTracked(ctx, "ENCRYPTED VERIFICATION ID", tx, 58, 1.5);
    }
  }

  ctx.fillStyle = GREEN;
  ctx.font = `700 22px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillText(id || "PWC-————-————-————", tx, H - 58, maxText);

  ctx.strokeStyle = "rgba(30, 158, 99, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx, H - 46);
  ctx.lineTo(tx + Math.min(maxText, 380), H - 46);
  ctx.stroke();

  ctx.fillStyle = NAVY;
  ctx.font = `600 16px ${SANS}`;
  ctx.direction = arabic ? "rtl" : "ltr";
  ctx.fillText(`${signerName || ""}  ·  ${dateText}`, tx, H - 24, maxText);
  ctx.direction = "ltr";

  return canvas;
}

export async function makeVerificationBadgePng(sigId, signerName) {
  const id = String(sigId || "").trim() || generateVerificationId();
  const qr = await loadBadgeQr(id);
  const canvas = makeVerificationBadgeCanvas(id, signerName, qr);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return { bytes: await blob.arrayBuffer(), ratio: canvas.height / canvas.width };
}
