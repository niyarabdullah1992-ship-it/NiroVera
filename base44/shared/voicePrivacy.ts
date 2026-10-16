// «صوت الموظف» — server twin of src/lib/voicePrivacy.js.
// الشكوى الجهرية تمر بسلم الفرع (المدير المباشر ثم من فوقه حتى الموارد البشرية)، أما الشكوى السرية
// والاقتراح وشكوى التحرش فتصل إلى الموارد البشرية والإدارة فقط — لا تُنزَّل لمدير خط ولا تُكتب بلسانه.

const str = (v: unknown) => String(v ?? "");

export const HR_VOICE_PERMISSIONS = ["view_anonymous_reports", "manage_anonymous_reports", "manage_complaints"];
export const HR_VOICE_ROLES = ["owner", "admin", "director", "hr", "hr_manager"];
export const VOICE_CATEGORIES = ["publicReports", "anonymousReports", "abuseCases"];

export type VoiceContext = {
  actor?: { role?: string; id?: string } | null;
  permissions?: Set<string>;
  senior?: boolean;
  scope?: string[] | null;
  userId?: string | null;
  ownReportIds?: Set<string>;
};

/** HR / the administration: an owner-or-admin session, an HR role, or an HR level with a voice permission. */
export function isServerVoiceHrReader(ctx: VoiceContext) {
  if (!ctx) return false;
  if (ctx.senior && !ctx.actor) return true; // owner / platform admin session
  if (ctx.actor && HR_VOICE_ROLES.includes(str(ctx.actor.role))) return true;
  return HR_VOICE_PERMISSIONS.some((p) => ctx.permissions?.has?.(p));
}

function hrScope(ctx: VoiceContext): string[] | null {
  if ((ctx.senior && !ctx.actor) || (ctx.actor && HR_VOICE_ROLES.includes(str(ctx.actor.role)))) return null;
  return ctx.scope === undefined ? null : ctx.scope;
}

/** A stored voice row that reaches HR only (anonymous report or suggestion). */
export function isHrOnlyVoiceRow(row: any, category: string) {
  if (!row) return false;
  if (category === "anonymousReports") return true;
  if (category === "abuseCases") return true;
  if (row.anonymous === true || row.kind === "anonymous" || row.channel === "anonymous") return true;
  return row.kind === "suggestion" || row.type === "suggestion" || row.channel === "suggestion";
}

function isOwnRow(row: any, ctx: VoiceContext) {
  const uid = str(ctx.userId);
  if (!uid || !row) return false;
  if (ctx.ownReportIds?.has?.(str(row.id))) return true;
  return [row.authorId, row.reporterId, row.userId, row.rateActorId].some((v) => str(v) === uid);
}

function committeeIds(row: any): string[] {
  return (row?.committee?.members || []).map((m: any) => str(m?.id ?? m)).filter(Boolean);
}

/**
 * May this caller read this voice row? HR-only rows → the author, the abuse committee named on the
 * case, or an HR reader in scope — never the accused, never a line manager, senior or not.
 * Named complaints keep the caller's existing rule (`fallback`).
 */
export function canServerReadVoiceRow(category: string, row: any, ctx: VoiceContext, fallback = true) {
  if (!row) return false;
  const uid = str(ctx.userId);
  if (category === "abuseCases") {
    if (uid && str(row.accusedId) === uid) return false;
    if (isOwnRow(row, ctx)) return true;
    if (uid && committeeIds(row).includes(uid)) return true;
    return isServerVoiceHrReader(ctx);
  }
  if (isOwnRow(row, ctx)) return true;
  if (!isHrOnlyVoiceRow(row, category)) return fallback;
  if (!isServerVoiceHrReader(ctx)) return false;
  const scope = hrScope(ctx);
  return scope === null || scope.includes(str(row.stationId));
}

export function filterVoiceRowsForServer(category: string, rows: any[], ctx: VoiceContext, fallback: (row: any) => boolean = () => true) {
  return (Array.isArray(rows) ? rows : []).filter((row) => canServerReadVoiceRow(category, row, ctx, fallback(row)));
}

/**
 * A full-snapshot write from someone who cannot read every row: the rows hidden from him are kept
 * exactly as stored (he cannot change or drop what he never received), his visible rows and new rows
 * come from the snapshot.
 */
export function mergeVoiceWriteForServer(category: string, priorRows: any[], incomingRows: any[], ctx: VoiceContext) {
  const prior = Array.isArray(priorRows) ? priorRows : [];
  const incoming = Array.isArray(incomingRows) ? incomingRows : [];
  const hidden = prior.filter((row) => !canServerReadVoiceRow(category, row, ctx));
  const hiddenIds = new Set(hidden.map((row) => str(row?.id)));
  const fromClient = incoming.filter((row) => !hiddenIds.has(str(row?.id)));
  return [...fromClient, ...hidden];
}
