/** True when the buffer starts with %PDF (optional leading whitespace). */
export function looksLikePdf(bytes) {
  if (!bytes || bytes.byteLength < 5) return false;
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let i = 0;
  while (i < view.length && (view[i] === 0x20 || view[i] === 0x09 || view[i] === 0x0d || view[i] === 0x0a)) i += 1;
  return view[i] === 0x25 && view[i + 1] === 0x50 && view[i + 2] === 0x44 && view[i + 3] === 0x46;
}
