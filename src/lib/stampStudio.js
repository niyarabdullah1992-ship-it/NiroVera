/**
 * Stamp studio — one canvas renderer for every seal shape.
 *
 * The same function draws the live preview and the PNG that gets merged into the
 * signed PDF, so what the owner approves is byte-for-byte what lands on the page.
 * Colours, logo and identity fields are free; the verification id, QR and SHA-256
 * chain are not — they are generated and cannot be typed over.
 */

import { ensureSignatureFonts } from "@/lib/typedSignatureImage";

const SANS = "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif";
const MONO = "'IBM Plex Mono', 'Courier New', monospace";
const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";

export const STAMP_NAME_FONTS = [
  { id: "naskh", ar: "نسخ", en: "Naskh", family: NASKH },
  { id: "amiri", ar: "أميري", en: "Amiri", family: "'Amiri', 'Noto Naskh Arabic', serif" },
  { id: "ruqaa", ar: "رقعة", en: "Ruqaa", family: "'Aref Ruqaa', 'Amiri', serif" },
  { id: "sans", ar: "واضح", en: "Sans", family: SANS },
];

const nameFace = (d) => (STAMP_NAME_FONTS.find((item) => item.id === d.nameFont) || STAMP_NAME_FONTS[1]).family;

/** Platform identity — the defaults every new seal starts from. */
export const STAMP_DEFAULT_ACCENT = "#1E9E63";
export const STAMP_DEFAULT_INK = "#14284B";
export const STAMP_DEFAULT_PAPER = "#FFFFFF";

export const STAMP_ACCENTS = [
  { name: "أخضر المنصة", en: "Platform green", hex: "#1E9E63" },
  { name: "كحلي", en: "Navy", hex: "#14284B" },
  { name: "أزرق", en: "Blue", hex: "#1F6FE0" },
  { name: "ذهبي", en: "Gold", hex: "#B8860B" },
  { name: "عنابي", en: "Maroon", hex: "#8A1C2B" },
  { name: "بنفسجي", en: "Violet", hex: "#5B3FA6" },
  { name: "فيروزي", en: "Teal", hex: "#0F8A8A" },
];

export const STAMP_INKS = [
  { name: "كحلي المنصة", en: "Platform navy", hex: "#14284B" },
  { name: "أسود", en: "Black", hex: "#1A1A1A" },
  { name: "رصاصي", en: "Slate", hex: "#3B4252" },
  { name: "بني", en: "Brown", hex: "#3D2B1F" },
];

export const STAMP_PAPERS = [
  { name: "أبيض", en: "White", hex: "#FFFFFF" },
  { name: "عاجي", en: "Ivory", hex: "#FBFAF6" },
  { name: "رمادي فاتح", en: "Light grey", hex: "#F3F5F9" },
];

export const STAMP_MARK_COLORS = [
  ...STAMP_INKS,
  { name: "أخضر المنصة", en: "Platform green", hex: "#1E9E63" },
  { name: "أزرق حبر", en: "Ink blue", hex: "#1B4F9C" },
  { name: "أزرق", en: "Blue", hex: "#1F6FE0" },
  { name: "ذهبي", en: "Gold", hex: "#B8860B" },
  { name: "عنابي", en: "Maroon", hex: "#8A1C2B" },
];

export const STAMP_DESIGNS = [
  { id: "heritage", ar: "أفقي بزوايا", en: "Bracketed row", w: 900, h: 240 },
  { id: "seal", ar: "ختم دائري", en: "Round seal", w: 440, h: 440 },
  { id: "badge", ar: "بطاقة عمودية", en: "Vertical badge", w: 380, h: 560 },
  { id: "ticket", ar: "تذكرة", en: "Ticket", w: 900, h: 270 },
  { id: "line", ar: "سطر توقيع", en: "Signature line", w: 780, h: 240 },
  { id: "dark", ar: "داكن", en: "Dark card", w: 440, h: 600 },
  { id: "hex", ar: "سداسي", en: "Hexagon", w: 470, h: 530 },
  { id: "square", ar: "مربع QR", en: "QR square", w: 440, h: 440 },
];

export const DEFAULT_STAMP_CONFIG = Object.freeze({
  design: "heritage",
  accent: STAMP_DEFAULT_ACCENT,
  ink: STAMP_DEFAULT_INK,
  paper: STAMP_DEFAULT_PAPER,
  name: "",
  role: "",
  company: "NIROVERA",
  logoUrl: "",
  markUrl: "",
  nameFont: "amiri",
  markX: null,
  markY: null,
  markScale: 1,
  markAspect: null,
  markColor: STAMP_DEFAULT_INK,
  nameX: null,
  nameY: null,
  nameScale: 1,
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const safeColor = (value, fallback) => (HEX.test(String(value || "")) ? String(value) : fallback);
const clip = (value, max) => String(value ?? "").trim().slice(0, max);
const unitOrNull = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
};
export const clampMarkScale = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(2.2, Math.max(0.35, n)) : 1;
};
export const clampNameScale = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(2.4, Math.max(0.45, n)) : 1;
};

export const stampNameFamily = (d) => nameFace(typeof d === "string" ? { nameFont: d } : d);

export function normalizeStampConfig(config) {
  const raw = config && typeof config === "object" ? config : {};
  const design = STAMP_DESIGNS.some((item) => item.id === raw.design) ? raw.design : DEFAULT_STAMP_CONFIG.design;
  return {
    design,
    accent: safeColor(raw.accent, STAMP_DEFAULT_ACCENT),
    ink: safeColor(raw.ink, STAMP_DEFAULT_INK),
    paper: safeColor(raw.paper, STAMP_DEFAULT_PAPER),
    name: clip(raw.name, 60),
    role: clip(raw.role, 60),
    company: clip(raw.company, 32) || DEFAULT_STAMP_CONFIG.company,
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : "",
    markUrl: typeof raw.markUrl === "string" ? raw.markUrl : "",
    nameFont: STAMP_NAME_FONTS.some((item) => item.id === raw.nameFont) ? raw.nameFont : DEFAULT_STAMP_CONFIG.nameFont,
    markX: unitOrNull(raw.markX),
    markY: unitOrNull(raw.markY),
    markScale: raw.markScale == null || raw.markScale === "" ? 1 : clampMarkScale(raw.markScale),
    markAspect: Number(raw.markAspect) > 0.2 ? Number(raw.markAspect) : null,
    markColor: raw.markColor === "" || raw.markColor === "none" ? "" : safeColor(raw.markColor, STAMP_DEFAULT_INK),
    nameX: unitOrNull(raw.nameX),
    nameY: unitOrNull(raw.nameY),
    nameScale: raw.nameScale == null || raw.nameScale === "" ? 1 : clampNameScale(raw.nameScale),
  };
}

export const stampDesign = (id) => STAMP_DESIGNS.find((item) => item.id === id) || STAMP_DESIGNS[0];

/** Height / width of a seal shape — overlay and PDF write share this ratio. */
export const stampAspect = (id) => {
  const design = stampDesign(id);
  return design.h / design.w;
};

/** Default handwriting center (0–1) when the signer has not dragged yet. */
export function defaultMarkCenter(d, W, H) {
  const design = d.design || "heritage";
  if (design === "heritage") {
    const hasLogo = Boolean(d.logo || d.logoUrl);
    const slot = hasLogo ? 132 : 0;
    const tx = hasLogo ? 40 + slot + 34 : 36;
    const qrX = W - 44 - 128;
    const max = Math.max(80, qrX - 30 - tx);
    return { markX: (tx + max / 2) / W, markY: 108 / H };
  }
  if (design === "seal") return { markX: 0.5, markY: 0.35 };
  if (design === "badge") return { markX: 0.5, markY: 0.16 };
  if (design === "ticket") return { markX: (d.logo || d.logoUrl) ? 0.36 : 0.28, markY: 0.38 };
  if (design === "line") return { markX: 0.42, markY: 0.36 };
  if (design === "dark") return { markX: 0.5, markY: 0.18 };
  if (design === "hex") return { markX: 0.5, markY: 0.3 };
  if (design === "square") return { markX: 0.2, markY: 0.15 };
  return { markX: 0.5, markY: 0.4 };
}

export function resolveMarkPlace(d, W, H) {
  const fallback = defaultMarkCenter(d, W, H);
  return {
    markX: d.markX == null ? fallback.markX : d.markX,
    markY: d.markY == null ? fallback.markY : d.markY,
    markScale: clampMarkScale(d.markScale ?? 1),
  };
}

function resolveMarkAspect(d) {
  const fromImg = d.mark?.width && d.mark?.height ? d.mark.width / d.mark.height : 0;
  const fromCfg = Number(d.markAspect);
  if (fromImg > 0.2) return fromImg;
  if (Number.isFinite(fromCfg) && fromCfg > 0.2) return fromCfg;
  return 2.8;
}

/** Pixel box for the handwritten mark — hugs the ink, not a wide empty frame. */
export function markBox(d, W, H) {
  const place = resolveMarkPlace(d, W, H);
  const aspect = resolveMarkAspect(d);
  let w = Math.min(W * 0.86, Math.max(36, W * 0.24 * place.markScale));
  let h = w / aspect;
  if (h > H * 0.38) {
    h = H * 0.38;
    w = h * aspect;
  }
  if (h < 16) h = 16;
  const minX = w * 0.12;
  const maxX = W - w * 0.12;
  const minY = h * 0.12;
  const maxY = H - h * 0.12;
  const cx = Math.min(maxX, Math.max(minX, place.markX * W));
  const cy = Math.min(maxY, Math.max(minY, place.markY * H));
  return { x: cx - w / 2, y: cy - h / 2, w, h, markX: cx / W, markY: cy / H, markScale: place.markScale };
}

function hasMarkLayer(d) {
  return Boolean(d.markUrl || d.mark || d.hasMark);
}

export function defaultNameCenter(d, W, H) {
  const design = d.design || "heritage";
  const marked = hasMarkLayer(d);
  if (design === "heritage") {
    const hasLogo = Boolean(d.logo || d.logoUrl);
    const slot = hasLogo ? 132 : 0;
    const tx = hasLogo ? 40 + slot + 34 : 36;
    const qrX = W - 44 - 128;
    const max = Math.max(80, qrX - 30 - tx);
    return { nameX: (tx + max / 2) / W, nameY: (marked ? 138 : 112) / H };
  }
  if (design === "seal") return { nameX: 0.5, nameY: (d.logo || marked ? 228 : 160) / H };
  if (design === "badge") return { nameX: 0.5, nameY: 208 / H };
  if (design === "ticket") return { nameX: 0.28, nameY: (marked ? 150 : 140) / H };
  if (design === "line") return { nameX: 0.36, nameY: (marked ? 128 : 124) / H };
  if (design === "dark") return { nameX: 0.5, nameY: 244 / H };
  if (design === "hex") return { nameX: 0.5, nameY: 256 / H };
  if (design === "square") return { nameX: 0.5, nameY: 364 / H };
  return { nameX: 0.5, nameY: 0.48 };
}

export function defaultNameSize(d) {
  const marked = hasMarkLayer(d);
  const design = d.design || "heritage";
  if (design === "heritage") return marked ? 26 : 48;
  if (design === "seal") return (d.logo || marked) ? 36 : 44;
  if (design === "badge") return 38;
  if (design === "ticket") return marked ? 28 : 46;
  if (design === "line") return marked ? 28 : 52;
  if (design === "dark") return 40;
  return 34;
}

export function resolveNamePlace(d, W, H) {
  const fallback = defaultNameCenter(d, W, H);
  return {
    nameX: d.nameX == null ? fallback.nameX : d.nameX,
    nameY: d.nameY == null ? fallback.nameY : d.nameY,
    nameScale: clampNameScale(d.nameScale ?? 1),
  };
}

export function nameFill(d) {
  return d.design === "dark" ? d.paper : d.ink;
}

export function nameBox(d, W, H) {
  const place = resolveNamePlace(d, W, H);
  const fontSize = Math.max(12, Math.min(Math.min(W, H) * 0.3, defaultNameSize(d) * place.nameScale));
  const label = String(d.name || "").trim() || " ";
  let textW = Math.max(32, label.length * fontSize * 0.62);
  if (typeof document !== "undefined") {
    const ctx = nameBox.measure || (nameBox.measure = document.createElement("canvas").getContext("2d"));
    if (ctx) {
      ctx.font = `600 ${Math.round(fontSize)}px ${nameFace(d)}`;
      textW = Math.max(28, ctx.measureText(label).width);
    }
  }
  const w = Math.min(W - 12, textW + 18);
  const h = Math.min(H - 12, fontSize * 1.5);
  const minX = 6 + w / 2;
  const maxX = W - 6 - w / 2;
  const minY = 6 + h / 2;
  const maxY = H - 6 - h / 2;
  const cx = Math.min(maxX, Math.max(minX, place.nameX * W));
  const cy = Math.min(maxY, Math.max(minY, place.nameY * H));
  return { x: cx - w / 2, y: cy - h / 2, w, h, fontSize, nameX: cx / W, nameY: cy / H, nameScale: place.nameScale };
}

/** Seed a live studio config from a pending signer, never an old badge theme. */
export function stampConfigFromSigner(signer) {
  return normalizeStampConfig({
    ...DEFAULT_STAMP_CONFIG,
    ...(signer?.stampConfig || {}),
    design: signer?.stampConfig?.design || signer?.stampTheme || DEFAULT_STAMP_CONFIG.design,
    name: signer?.stampConfig?.name || signer?.name || "",
    role: signer?.stampConfig?.role || signer?.role || "",
  });
}

/* ---------------------------------------------------------------- helpers */

const rgba = (hex, alpha) => {
  const value = safeColor(hex, "#000000");
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function hexPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h * 0.25);
  ctx.lineTo(x + w, y + h * 0.75);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h * 0.75);
  ctx.lineTo(x, y + h * 0.25);
  ctx.closePath();
}

/** Bracket corners — the scanner framing that marks a NiroVera seal. */
function corners(ctx, x, y, w, h, color, lw = 2) {
  const len = Math.max(8, Math.min(w, h) * 0.24);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  [
    [x, y + len, x, y, x + len, y],
    [x + w - len, y, x + w, y, x + w, y + len],
    [x, y + h - len, x, y + h, x + len, y + h],
    [x + w - len, y + h, x + w, y + h, x + w, y + h - len],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  });
}

function text(ctx, value, x, y, { font, color, align = "start", max, tracking = 0, rtl = false }) {
  const str = String(value ?? "");
  if (!str) return;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  if (rtl || /[\u0600-\u06FF]/.test(str)) {
    // Arabic runs right-to-left from its anchor, so a start-aligned string has to
    // be anchored at its own right edge — otherwise it spills backwards over the
    // logo slot instead of filling the column it was given.
    const shaped = `\u202B${str}\u202C`;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    if (align === "center") ctx.textAlign = "center";
    const anchor = align === "start"
      ? x + Math.min(ctx.measureText(shaped).width, max || Infinity)
      : x;
    ctx.fillText(shaped, anchor, y, max);
    ctx.restore();
    return;
  }
  ctx.direction = "ltr";
  if (!tracking) {
    ctx.textAlign = align === "start" ? "left" : align;
    ctx.fillText(str, x, y, max);
    ctx.restore();
    return;
  }
  const chars = [...str];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + tracking * (chars.length - 1);
  let cursor = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
  ctx.textAlign = "left";
  chars.forEach((ch, index) => {
    ctx.fillText(ch, cursor, y);
    cursor += widths[index] + tracking;
  });
  ctx.restore();
}

/** Shrinks a font until the string fits, so a long Arabic name never overflows. */
function fitFont(ctx, value, max, weight, size, family) {
  let current = size;
  for (let guard = 0; guard < 24; guard += 1) {
    ctx.font = `${weight} ${current}px ${family}`;
    if (ctx.measureText(String(value || "")).width <= max || current <= size * 0.5) break;
    current -= Math.max(1, size * 0.04);
  }
  return `${weight} ${Math.round(current)}px ${family}`;
}

function drawContain(ctx, img, x, y, w, h, tint) {
  if (!img?.width || !img?.height) return false;
  const ratio = Math.min(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  if (!tint) {
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.ceil(dw));
  off.height = Math.max(1, Math.ceil(dh));
  const ink = off.getContext("2d");
  ink.drawImage(img, 0, 0, off.width, off.height);
  ink.globalCompositeOperation = "source-in";
  ink.fillStyle = tint;
  ink.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(off, dx, dy);
  return true;
}

/** Logo slot only. Handwriting is a free layer drawn after the seal. */
function drawMarkSlot(ctx, d, x, y, w, h) {
  if (d.logo) drawContain(ctx, d.logo, x, y, w, h);
}

function drawFreeMark(ctx, d, W, H) {
  if (!d.mark) return;
  const box = markBox(d, W, H);
  drawContain(ctx, d.mark, box.x, box.y, box.w, box.h, d.markColor || "");
}

function drawFreeName(ctx, d, W, H) {
  const label = String(d.name || "").trim();
  if (!label) return;
  const box = nameBox(d, W, H);
  text(ctx, label, box.x + box.w / 2, box.y + box.fontSize * 1.05, {
    font: `600 ${Math.round(box.fontSize)}px ${nameFace(d)}`,
    color: nameFill(d),
    align: "center",
    max: box.w,
  });
}

const drawQr = (ctx, d, x, y, size) => { if (d.qr) ctx.drawImage(d.qr, x, y, size, size); };

/* ---------------------------------------------------------------- designs */

function drawHeritage(ctx, d, W, H) {
  roundRect(ctx, 1, 1, W - 2, H - 2, 14);
  ctx.fillStyle = d.paper;
  ctx.fill();
  ctx.strokeStyle = d.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = d.accent;
  ctx.fillRect(10, 24, 4, H - 48);

  const hasLogo = Boolean(d.logo);
  const slot = hasLogo ? 132 : 0;
  const slotX = 40;
  const slotY = (H - slot) / 2;
  if (hasLogo) {
    corners(ctx, slotX, slotY, slot, slot, d.accent, 2.4);
    drawMarkSlot(ctx, d, slotX + 16, slotY + 16, slot - 32, slot - 32);
  }

  const qrSize = 128;
  const qrX = W - 44 - qrSize;
  const qrY = (H - qrSize) / 2;
  drawQr(ctx, d, qrX, qrY, qrSize);
  corners(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, d.accent, 2.4);

  ctx.strokeStyle = rgba(d.ink, 0.14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(qrX - 26, 30);
  ctx.lineTo(qrX - 26, H - 30);
  ctx.stroke();

  const tx = hasLogo ? slotX + slot + 34 : 36;
  const max = qrX - 30 - tx;
  text(ctx, d.company, tx, 34, { font: `600 12px ${SANS}`, color: rgba(d.ink, 0.66), tracking: 4.2, max });
  text(ctx, d.code, tx, H - 62, { font: `500 22px ${MONO}`, color: d.accent, tracking: 1.6, max });
  ctx.strokeStyle = rgba(d.ink, 0.16);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx, H - 50);
  ctx.lineTo(tx + max, H - 50);
  ctx.stroke();
  text(ctx, [d.role, d.date].filter(Boolean).join("  ·  "), tx, H - 28, { font: `400 16px ${SANS}`, color: rgba(d.ink, 0.75), max });
}

function drawSeal(ctx, d, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = d.paper;
  ctx.fill();
  ctx.strokeStyle = d.accent;
  ctx.lineWidth = 4.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.strokeStyle = d.paper;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 20, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(d.accent, 0.5);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  text(ctx, d.company, cx, 74, { font: `500 14px ${MONO}`, color: d.accent, align: "center", tracking: 5 });
  const hasArt = Boolean(d.logo || d.hasMark);
  if (d.logo) drawMarkSlot(ctx, d, cx - 108, 88, 216, 128);
  text(ctx, d.role, cx, hasArt ? 254 : 198, { font: `400 15px ${SANS}`, color: rgba(d.ink, 0.7), align: "center", max: W - 130 });
  drawQr(ctx, d, cx - 30, hasArt ? 272 : 230, 60);
  text(ctx, d.code, cx, hasArt ? 364 : 330, { font: `500 15px ${MONO}`, color: d.accent, align: "center", tracking: 1.2 });
}

function drawBadge(ctx, d, W, H) {
  roundRect(ctx, 1, 1, W - 2, H - 2, 22);
  ctx.fillStyle = d.paper;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 1, 1, W - 2, H - 2, 22);
  ctx.clip();
  ctx.fillStyle = d.accent;
  ctx.fillRect(0, 0, W, 12);
  ctx.restore();
  roundRect(ctx, 1, 1, W - 2, H - 2, 22);
  ctx.strokeStyle = rgba(d.ink, 0.16);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  drawMarkSlot(ctx, d, W / 2 - 52, 42, 104, 92);
  text(ctx, d.company, W / 2, 168, { font: `500 13px ${MONO}`, color: rgba(d.ink, 0.6), align: "center", tracking: 4.4 });
  text(ctx, d.role, W / 2, 244, { font: `400 15px ${SANS}`, color: rgba(d.ink, 0.7), align: "center", max: W - 70 });

  const qr = 168;
  roundRect(ctx, W / 2 - qr / 2 - 10, 272, qr + 20, qr + 20, 14);
  ctx.strokeStyle = d.accent;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  drawQr(ctx, d, W / 2 - qr / 2, 282, qr);
  text(ctx, d.code, W / 2, 496, { font: `500 17px ${MONO}`, color: d.accent, align: "center", tracking: 1.2 });
  text(ctx, `${d.date} · SHA-256`, W / 2, 522, { font: `400 13px ${MONO}`, color: rgba(d.ink, 0.55), align: "center" });
}

function drawTicket(ctx, d, W, H) {
  const stub = 220;
  const bodyW = W - stub;
  ctx.save();
  roundRect(ctx, 1, 1, W - 2, H - 2, 16);
  ctx.clip();
  ctx.fillStyle = d.paper;
  ctx.fillRect(0, 0, bodyW, H);
  ctx.fillStyle = d.ink;
  ctx.fillRect(bodyW, 0, stub, H);
  ctx.restore();
  roundRect(ctx, 1, 1, W - 2, H - 2, 16);
  ctx.strokeStyle = rgba(d.ink, 0.18);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([8, 7]);
  ctx.strokeStyle = rgba(d.paper, 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bodyW, 16);
  ctx.lineTo(bodyW, H - 16);
  ctx.stroke();
  ctx.restore();

  if (d.logo) drawMarkSlot(ctx, d, 32, 30, 84, 74);
  text(ctx, d.company, d.logo ? 132 : 32, 48, { font: `500 13px ${MONO}`, color: rgba(d.ink, 0.6), tracking: 3.6, max: bodyW - 300 });
  roundRect(ctx, bodyW - 176, 34, 144, 34, 6);
  ctx.fillStyle = d.accent;
  ctx.fill();
  text(ctx, "توقيع معتمد", bodyW - 104, 57, { font: `600 15px ${SANS}`, color: "#FFFFFF", align: "center" });

  text(ctx, d.role, 32, 188, { font: `400 16px ${SANS}`, color: rgba(d.ink, 0.7), max: bodyW - 70 });
  ctx.strokeStyle = rgba(d.ink, 0.14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 208);
  ctx.lineTo(bodyW - 32, 208);
  ctx.stroke();
  text(ctx, d.code, 32, 238, { font: `500 19px ${MONO}`, color: d.accent, tracking: 1.2 });
  text(ctx, d.date, bodyW - 32, 238, { font: `400 16px ${MONO}`, color: rgba(d.ink, 0.6), align: "right" });

  const qr = 120;
  roundRect(ctx, bodyW + (stub - qr - 16) / 2, 44, qr + 16, qr + 16, 10);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  drawQr(ctx, d, bodyW + (stub - qr) / 2, 52, qr);
  text(ctx, "امسح للتحقق", bodyW + stub / 2, 212, { font: `400 14px ${SANS}`, color: rgba(d.paper, 0.8), align: "center" });
}

function drawLine(ctx, d, W, H) {
  ctx.fillStyle = d.paper;
  ctx.fillRect(0, 0, W, H);
  text(ctx, "التوقيع", 34, 44, { font: `400 15px ${SANS}`, color: rgba(d.ink, 0.6) });

  const slot = 78;
  if (d.logo) drawMarkSlot(ctx, d, W - 34 - slot, 60, slot, slot);

  ctx.strokeStyle = d.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(34, 150);
  ctx.lineTo(W - 34, 150);
  ctx.stroke();

  text(ctx, [d.role, d.company].filter(Boolean).join(" · "), 34, 178, { font: `400 15px ${SANS}`, color: rgba(d.ink, 0.72), max: W - 220 });
  text(ctx, d.date, W - 34, 178, { font: `400 15px ${MONO}`, color: rgba(d.ink, 0.6), align: "right" });
  drawQr(ctx, d, 34, 190, 40);
  text(ctx, d.code, 86, 218, { font: `500 16px ${MONO}`, color: d.accent, tracking: 1 });
  text(ctx, "SHA-256", W - 34, 218, { font: `400 13px ${MONO}`, color: rgba(d.ink, 0.45), align: "right" });
}

function drawDark(ctx, d, W, H) {
  roundRect(ctx, 1, 1, W - 2, H - 2, 28);
  ctx.fillStyle = d.ink;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(W / 2, 108, 62, 0, Math.PI * 2);
  ctx.fillStyle = rgba(d.paper, 0.08);
  ctx.fill();
  ctx.strokeStyle = d.accent;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  if (d.logo) drawContain(ctx, d.logo, W / 2 - 42, 66, 84, 84);

  text(ctx, d.company, W / 2, 202, { font: `500 13px ${MONO}`, color: rgba(d.paper, 0.6), align: "center", tracking: 4.4 });
  text(ctx, d.role, W / 2, 282, { font: `400 15px ${SANS}`, color: rgba(d.paper, 0.7), align: "center", max: W - 80 });

  ctx.strokeStyle = rgba(d.paper, 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 304);
  ctx.lineTo(W - 40, 304);
  ctx.stroke();

  text(ctx, d.code, W / 2, 338, { font: `500 19px ${MONO}`, color: d.accent, align: "center", tracking: 1.4 });
  const qr = 150;
  roundRect(ctx, W / 2 - qr / 2 - 10, 360, qr + 20, qr + 20, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  drawQr(ctx, d, W / 2 - qr / 2, 370, qr);
  text(ctx, `${d.date} · SHA-256`, W / 2, 560, { font: `400 14px ${MONO}`, color: rgba(d.paper, 0.65), align: "center" });
}

function drawHex(ctx, d, W, H) {
  hexPath(ctx, 2, 2, W - 4, H - 4);
  ctx.fillStyle = d.accent;
  ctx.fill();
  hexPath(ctx, 12, 12, W - 24, H - 24);
  ctx.fillStyle = d.paper;
  ctx.fill();

  drawMarkSlot(ctx, d, W / 2 - 42, 116, 84, 72);
  text(ctx, d.company, W / 2, 218, { font: `500 13px ${MONO}`, color: rgba(d.ink, 0.6), align: "center", tracking: 4.2 });
  drawQr(ctx, d, W / 2 - 44, 286, 88);
  text(ctx, d.code, W / 2, 406, { font: `500 16px ${MONO}`, color: d.accent, align: "center", tracking: 1.2 });
  text(ctx, d.date, W / 2, 432, { font: `400 13px ${MONO}`, color: rgba(d.ink, 0.55), align: "center" });
}

function drawSquare(ctx, d, W, H) {
  roundRect(ctx, 1, 1, W - 2, H - 2, 34);
  ctx.fillStyle = d.paper;
  ctx.fill();
  ctx.strokeStyle = rgba(d.ink, 0.16);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  drawMarkSlot(ctx, d, 32, 32, 84, 72);
  text(ctx, d.company, W - 32, 76, { font: `500 13px ${MONO}`, color: rgba(d.ink, 0.6), align: "right", tracking: 4 });

  const qr = 176;
  roundRect(ctx, W / 2 - qr / 2 - 12, 122, qr + 24, qr + 24, 18);
  ctx.strokeStyle = d.accent;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  drawQr(ctx, d, W / 2 - qr / 2, 134, qr);

  text(ctx, d.code, W / 2, 402, { font: `500 15px ${MONO}`, color: d.accent, align: "center", tracking: 1.2 });
}

const RENDERERS = {
  heritage: drawHeritage,
  seal: drawSeal,
  badge: drawBadge,
  ticket: drawTicket,
  line: drawLine,
  dark: drawDark,
  hex: drawHex,
  square: drawSquare,
};

/* ------------------------------------------------------------ public API */

export function loadStampImage(src) {
  if (!src || typeof src !== "string") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.width ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** QR in the seal's own ink, so the code reads as part of the stamp, not a sticker. */
export async function loadStampQr(verificationUrl, darkColor = STAMP_DEFAULT_INK) {
  try {
    const mod = await import("qrcode");
    const toCanvas = mod.toCanvas || mod.default?.toCanvas;
    if (typeof toCanvas !== "function") return null;
    const canvas = document.createElement("canvas");
    await toCanvas(canvas, verificationUrl, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: safeColor(darkColor, STAMP_DEFAULT_INK), light: "#FFFFFF00" },
    });
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Draws one seal at 3× and returns the canvas. Everything the caller can vary is
 * in `config`; the verification id and QR are passed separately because they are
 * generated, never authored.
 */
export function renderStampCanvas(config, { verificationId, qr = null, logo = null, mark = null, date, hideMark = false, hideName = false } = {}) {
  const cfg = normalizeStampConfig(config);
  const design = stampDesign(cfg.design);
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = design.w * scale;
  canvas.height = design.h * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const data = {
    ...cfg,
    logo,
    mark: hideMark ? null : mark,
    hasMark: Boolean(cfg.markUrl),
    qr,
    code: String(verificationId || "").trim() || "PWC-————-————-————",
    date: date || new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", year: "numeric" }),
  };
  (RENDERERS[design.id] || drawHeritage)(ctx, data, design.w, design.h);
  if (!hideName) drawFreeName(ctx, data, design.w, design.h);
  if (!hideMark) drawFreeMark(ctx, data, design.w, design.h);
  return canvas;
}

/** Loads the seal's images and fonts, then renders it to a PNG data url. */
export async function renderStampDataUrl(config, { verificationId, verificationUrl, hideMark = false, hideName = false } = {}) {
  const cfg = normalizeStampConfig(config);
  if (typeof document !== "undefined") {
    ensureSignatureFonts();
    const face = nameFace(cfg);
    await Promise.all([
      document.fonts?.ready?.catch(() => {}),
      document.fonts?.load(`600 36px ${face}`).catch(() => {}),
    ]);
  }
  const [qr, logo, mark] = await Promise.all([
    verificationUrl ? loadStampQr(verificationUrl, cfg.ink) : Promise.resolve(null),
    loadStampImage(cfg.logoUrl),
    hideMark ? Promise.resolve(null) : loadStampImage(cfg.markUrl),
  ]);
  return renderStampCanvas(cfg, { verificationId, qr, logo, mark, hideMark, hideName }).toDataURL("image/png");
}
