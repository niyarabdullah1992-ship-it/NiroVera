// Generic HTTP phrases a backend returns as its error body. They read as noise
// to an operator, so a surface-specific reason is shown instead of echoing them.
const GENERIC_PHRASES = new Set([
  "unauthorized",
  "forbidden",
  "not found",
  "bad request",
  "internal server error",
  "service unavailable",
  "network error",
]);

function isGeneric(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return true;
  if (GENERIC_PHRASES.has(value)) return true;
  return /^request failed with status code \d+$/.test(value);
}

/**
 * A refusal is not an outage.
 *
 * 401/403 is the server answering "no" with a named reason; 404/502/503/504 and a
 * request that never got an answer are the server being unreachable. Treating the
 * first as the second is how a guard gets bypassed in silence: the local ledger
 * re-runs the very write the gate just refused, and the Arabic reason never reaches
 * the operator. Every api layer asks this one question instead of keeping its own
 * status list.
 */
const OUTAGE_STATUS = new Set([404, 502, 503, 504]);

function statusOf(error) {
  return error?.response?.status || error?.status || 0;
}

export function isServiceOutage(error) {
  const status = statusOf(error);
  if (!status) return true;
  return OUTAGE_STATUS.has(status);
}

/**
 * Reading may still fall back when the session is refused: showing a stale board
 * carries out nothing. Writing may not.
 */
export function canFallBackForRead(error) {
  const status = statusOf(error);
  if (!status) return true;
  return OUTAGE_STATUS.has(status) || status === 401 || status === 403;
}

/** Re-throwing a refusal keeps its named reason on the error the screen reads. */
export function refusalError(error) {
  const data = error?.response?.data;
  if (!data || (!data.reason && !data.reasonEn && !data.error)) return error;
  const refused = new Error(data.reason || data.error || error?.message || "");
  refused.response = { data, status: statusOf(error) };
  return refused;
}

/**
 * Prefers a meaningful message from the server; falls back to a caller-supplied
 * reason that names the surface and what it is holding.
 */
export function namedServiceReason(error, ar, fallback) {
  const data = error?.response?.data || {};
  const preferred = ar
    ? (data.reason || data.error || error?.message)
    : (data.reasonEn || data.reason || data.error || error?.message);
  if (!isGeneric(preferred)) return preferred;
  return ar ? fallback.ar : fallback.en;
}
