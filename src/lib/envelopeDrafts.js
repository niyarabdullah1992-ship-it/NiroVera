/**
 * «مسودات» — an envelope saved before it is sent. A draft lives with the sender on this device
 * (it has not left their hands, so it is no company record and no audit event yet). Documents are
 * kept when they fit; a draft too large to keep its files says so and asks for them again.
 */
const KEY = (companyId, userId) => `nv-sign-drafts:${companyId || "-"}:${userId || "-"}`;
export const DRAFT_DOC_BUDGET = 3 * 1024 * 1024; // bytes of documents a draft may keep on the device

function storageOf(storage) {
  if (storage) return storage;
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export function listEnvelopeDrafts(companyId, userId, storage) {
  const store = storageOf(storage);
  if (!store) return [];
  try {
    const rows = JSON.parse(store.getItem(KEY(companyId, userId)) || "[]");
    return Array.isArray(rows) ? rows.filter((row) => row?.id).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))) : [];
  } catch {
    return [];
  }
}

/** Save (or replace by id). Returns { ok, draft, keptDocs } — keptDocs false when files were too large. */
export function saveEnvelopeDraft(companyId, userId, draft, storage) {
  const store = storageOf(storage);
  if (!store || !draft) return { ok: false, draft: null, keptDocs: false };
  const id = draft.id || `draft_${Date.now().toString(36)}${Math.round(Math.random() * 1e4).toString(36)}`;
  const docs = Array.isArray(draft.docs) ? draft.docs : [];
  const size = docs.reduce((sum, row) => sum + (Number(row.size) || 0), 0);
  const keptDocs = size <= DRAFT_DOC_BUDGET && docs.every((row) => row.dataUrl);
  const row = {
    ...draft,
    id,
    savedAt: draft.savedAt || new Date().toISOString(),
    docs: docs.map((doc) => ({ name: doc.name, size: doc.size, type: doc.type, dataUrl: keptDocs ? doc.dataUrl : "" })),
    docsMissing: !keptDocs && docs.length > 0,
  };
  const rest = listEnvelopeDrafts(companyId, userId, store).filter((item) => item.id !== id);
  try {
    store.setItem(KEY(companyId, userId), JSON.stringify([row, ...rest].slice(0, 20)));
    return { ok: true, draft: row, keptDocs };
  } catch {
    // Quota: keep the setup without its files rather than lose the draft.
    const lean = { ...row, docs: row.docs.map((doc) => ({ ...doc, dataUrl: "" })), docsMissing: docs.length > 0 };
    try {
      store.setItem(KEY(companyId, userId), JSON.stringify([lean, ...rest].slice(0, 20)));
      return { ok: true, draft: lean, keptDocs: false };
    } catch {
      return { ok: false, draft: null, keptDocs: false };
    }
  }
}

export function deleteEnvelopeDraft(companyId, userId, id, storage) {
  const store = storageOf(storage);
  if (!store) return false;
  const rest = listEnvelopeDrafts(companyId, userId, store).filter((item) => item.id !== id);
  try {
    store.setItem(KEY(companyId, userId), JSON.stringify(rest));
    return true;
  } catch {
    return false;
  }
}
