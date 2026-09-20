/** Named gate: a signature or written consent cannot fire before the file is read. */

export function consentFileKind(file) {
  const name = String(file?.name || file?.url || "").toLowerCase();
  const type = String(file?.type || "");
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) return "image";
  return file?.name || file?.url ? "other" : "none";
}

export function seenPageCount(seen) {
  if (!seen) return 0;
  if (typeof seen.size === "number") return seen.size;
  if (Array.isArray(seen)) return new Set(seen).size;
  return 0;
}

export function seenPageSet(seen) {
  if (seen instanceof Set) return seen;
  if (Array.isArray(seen)) return new Set(seen);
  return new Set();
}

/** First page not yet marked read, or null when the file is fully seen. */
export function nextUnreadPage(seen, pageCount) {
  const need = Math.max(1, Number(pageCount) || 1);
  const have = seenPageSet(seen);
  for (let page = 1; page <= need; page += 1) {
    if (!have.has(page)) return page;
  }
  return null;
}

export function checkDocumentReadGate({ required = true, pageCount = 1, seen, readAt }) {
  if (!required) return { ok: true };
  if (readAt) return { ok: true };
  const need = Math.max(1, Number(pageCount) || 1);
  const have = seenPageCount(seen);
  if (have < need) {
    return {
      ok: false,
      error: "READ_INCOMPLETE",
      reason: `اقرأ الملف كاملاً قبل الإقرار — ${have} من ${need} صفحات.`,
      reasonEn: `Read the whole file before acknowledging — ${have} of ${need} pages.`,
      have,
      need,
    };
  }
  return { ok: true };
}

export function defaultConsentMark() {
  return { id: "consent-sign", type: "signature", page: 1, x: 72, y: 84, scale: 100 };
}

export function normalizeSignMark(mark) {
  if (!mark) return null;
  const x = Number(mark.x);
  const y = Number(mark.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    id: mark.id || "consent-sign",
    type: "signature",
    page: Math.max(1, Number(mark.page) || 1),
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(96, Math.max(4, y)),
    scale: Math.min(200, Math.max(40, Number(mark.scale) || 100)),
  };
}
