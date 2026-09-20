const SIGNATURE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Dancing+Script:wght@400..700&family=Great+Vibes&family=IBM+Plex+Mono:wght@400;500;600&family=Lateef:wght@400;700&family=Noto+Naskh+Arabic:wght@400;600;700&display=swap";

export function ensureSignatureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById("nv-signature-fonts")) return;
  const link = document.createElement("link");
  link.id = "nv-signature-fonts";
  link.rel = "stylesheet";
  link.href = SIGNATURE_FONTS_HREF;
  document.head.appendChild(link);
}

export function cropOpaque(canvas, padding) {
  const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels.data[(y * canvas.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) return canvas.toDataURL("image/png");
  const trimmed = document.createElement("canvas");
  trimmed.width = right - left + 1 + padding * 2;
  trimmed.height = bottom - top + 1 + padding * 2;
  trimmed.getContext("2d").drawImage(
    canvas,
    left,
    top,
    right - left + 1,
    bottom - top + 1,
    padding,
    padding,
    right - left + 1,
    bottom - top + 1,
  );
  return trimmed.toDataURL("image/png");
}

export function signatureScriptFont(text) {
  return /[\u0600-\u06ff]/.test(String(text || ""))
    ? "'Aref Ruqaa', 'Amiri', serif"
    : "'Great Vibes', 'Alex Brush', cursive";
}

export async function createTypedSignatureImage(text, fontFamily) {
  try {
    ensureSignatureFonts();
    await Promise.race([
      Promise.all([
        document.fonts.load(`64px ${fontFamily}`, text),
        document.fonts.ready,
      ]),
      new Promise((resolve) => setTimeout(resolve, 450)),
    ]);
  } catch { /* keep going with fallback glyphs */ }
  const canvas = document.createElement("canvas");
  canvas.width = 560;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14284B";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = /[\u0600-\u06ff]/.test(text) ? "rtl" : "ltr";
  let size = 64;
  ctx.font = `${size}px ${fontFamily}`;
  while (ctx.measureText(text).width > 520 && size > 20) {
    size -= 4;
    ctx.font = `${size}px ${fontFamily}`;
  }
  ctx.fillText(text, 280, 80);
  return cropOpaque(canvas, 4);
}

export async function createTypedSignatureWithDate(name, date, fontFamily) {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`32px ${fontFamily}`, name),
        document.fonts.load("32px Arial", date),
        document.fonts.ready,
      ]),
      new Promise((resolve) => setTimeout(resolve, 450)),
    ]);
  } catch { /* keep going with fallback glyphs */ }
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  const isArabic = /[\u0600-\u06ff]/.test(name);
  ctx.fillStyle = "#14284B";
  ctx.textBaseline = "middle";
  ctx.direction = isArabic ? "rtl" : "ltr";
  let size = 32;
  ctx.font = `${size}px ${fontFamily}`;
  while (ctx.measureText(name).width > 690 && size > 20) {
    size -= 4;
    ctx.font = `${size}px ${fontFamily}`;
  }
  ctx.textAlign = "center";
  ctx.fillText(name, 355, 60, 690);
  const nameWidth = Math.min(ctx.measureText(name).width, 690);
  ctx.direction = "ltr";
  ctx.font = "32px Arial";
  const dateWidth = Math.min(ctx.measureText(date).width, 180);
  const dateCenter = Math.min(850, 355 + nameWidth / 2 + 18 + dateWidth / 2);
  ctx.textAlign = "center";
  ctx.fillText(date, dateCenter, 60, 180);
  return cropOpaque(canvas, 6);
}