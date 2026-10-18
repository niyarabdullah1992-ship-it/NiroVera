/**
 * «صوت الموظف» — who receives what, and who may see it.
 *
 *   • الشكوى الجهرية (named complaint) climbs the branch ladder: the direct manager first, then up the
 *     line on each missed window, ending with HR (the ladder is the branch's own — branchChain.js).
 *   • الشكوى السرية (anonymous), الاقتراح (suggestion) and شكوى الإيذاء/التحرش go straight to HR / the
 *     company administration with no ladder. A manager is never routed to them, never notified, and
 *     never sees a list line, a count, a badge, a file entry or an assistant answer about them — so a
 *     complaint about him cannot reach him through the platform.
 *
 * Pure (node-testable). Server twin: base44/shared/voicePrivacy.ts — keep the two in step.
 */
import { voiceKind } from "./complaintDerivations.js";

const str = (v) => String(v ?? "");

export const HR_ONLY_VOICE_CHANNELS = ["suggestion", "anonymous", "abuse", "heat"];
/** HR-level permissions that make a person a receiver of the HR-only voice channels. */
export const HR_VOICE_PERMISSIONS = ["view_anonymous_reports", "manage_anonymous_reports", "manage_complaints"];
/** Roles that are the company administration or HR by role (not a line manager). */
export const HR_VOICE_ROLES = ["owner", "admin", "director", "hr", "hr_manager"];

export const HR_ONLY_LINE_AR = "تصل إلى الموارد البشرية فقط — لا يراها مديرك";
export const HR_ONLY_LINE_EN = "Reaches HR only — your manager does not see it";
export const NAMED_LADDER_LINE_AR = "تبدأ عند مديرك وتتصعّد إن لم تُحل";
export const NAMED_LADDER_LINE_EN = "Starts with your manager and climbs if not resolved";

export const HR_TIER_ID = "hr_voice";

/** The voice channel of a decorated item or a raw stored row. */
export function voiceChannelOf(item) {
  if (!item) return "";
  const ch = str(item.channel);
  if (["suggestion", "complaint", "anonymous", "abuse", "heat"].includes(ch)) return ch;
  if (item.bucket === "anon") return "anonymous";
  if (item.reporterRole && item.accusedId !== undefined && item.kind && !item.type) return "abuse";
  const kind = voiceKind(item);
  if (kind === "anonymous") return "anonymous";
  if (kind === "suggestion") return "suggestion";
  return "complaint";
}

export function isHrOnlyVoice(item) {
  return HR_ONLY_VOICE_CHANNELS.includes(voiceChannelOf(item));
}

function levelOf(user, data) {
  if (!user?.hrLevelId) return null;
  return (data?.hrLevels || []).find((l) => l.id === user.hrLevelId && l.active !== false) || null;
}

/** Owner / admin / director — the company administration (company-wide reach). */
export function isCompanyAdmin(user, data) {
  if (!user) return false;
  if (user.isOwner || user.platformOwner) return true;
  if (data?.ownerId && str(user.id) === str(data.ownerId)) return true;
  return ["owner", "admin", "director"].includes(user.role);
}

/** Receives the HR-only channels: the administration, HR by role, or an HR level with a voice permission. */
export function isVoiceHrReceiver(user, data) {
  if (!user) return false;
  if (isCompanyAdmin(user, data)) return true;
  if (["hr", "hr_manager"].includes(user.role)) return true;
  const perms = levelOf(user, data)?.permissions || [];
  return HR_VOICE_PERMISSIONS.some((p) => perms.includes(p));
}

/** Stations an HR receiver covers: null = company-wide; [] = none. Mirrors permissions.hrScopeStations. */
export function voiceHrStationScope(user, data) {
  if (!isVoiceHrReceiver(user, data)) return [];
  if (isCompanyAdmin(user, data) || ["hr", "hr_manager"].includes(user.role)) return null;
  const level = levelOf(user, data);
  if (!level) return [];
  if (level.stationIds?.length) return level.stationIds.map(str);
  if (level.scope === "station") return user.hrStationId ? [str(user.hrStationId)] : [];
  if (level.scope === "cluster") {
    const cluster = (data?.hrClusters || []).find((c) => c.id === user.hrClusterId);
    return (cluster?.stationIds || []).map(str);
  }
  return null;
}

function stationOfItem(item, data) {
  if (item?.stationId) return str(item.stationId);
  const who = item?.authorId || item?.reporterId;
  const person = (data?.employees || []).find((e) => str(e.id) === str(who));
  return str(person?.stationId || "");
}

function inHrScope(item, user, data) {
  const scope = voiceHrStationScope(user, data);
  if (scope === null) return true;
  const st = stationOfItem(item, data);
  return Boolean(st) && scope.includes(st);
}

/** The author of a voice row (an anonymous row is matched by its rate actor, never shown). */
export function isOwnVoice(item, user) {
  const uid = str(user?.id);
  if (!uid || !item) return false;
  if (str(item.authorId) === uid) return true;
  if (str(item.reporterId) === uid) return true;
  return voiceChannelOf(item) === "anonymous" && str(item.rateActorId) === uid;
}

/**
 * The privacy layer: may this viewer see this voice at all?
 * HR-only channels → the author, or an HR receiver in scope. A named complaint is not restricted
 * here — the branch ladder (the caller's scope) decides who handles it.
 */
export function canSeeVoiceItem(item, user, data) {
  if (!item || !user) return false;
  if (isOwnVoice(item, user)) return true;
  if (!isHrOnlyVoice(item)) return true;
  return isVoiceHrReceiver(user, data) && inHrScope(item, user, data);
}

export function filterVoiceForViewer(items, user, data) {
  return (items || []).filter((item) => canSeeVoiceItem(item, user, data));
}

/** May this viewer rule on it? HR-only: an HR receiver in scope who is not its author. */
export function canHandleHrVoice(item, user, data) {
  if (!isHrOnlyVoice(item)) return false;
  if (isOwnVoice(item, user)) return false;
  return isVoiceHrReceiver(user, data) && inHrScope(item, user, data);
}

/** Everyone who receives HR-only voices (for notices), minus `exclude` ids. */
export function voiceHrReceivers(data, { exclude = [], item = null } = {}) {
  const skip = new Set((exclude || []).map(str).filter(Boolean));
  return (data?.employees || []).filter((e) => e?.id
    && !skip.has(str(e.id))
    && isVoiceHrReceiver(e, data)
    && (!item || inHrScope(item, e, data)));
}

/** The one tier an HR-only voice sits at — no ladder above it. */
export function hrVoiceTier(data) {
  return {
    id: HR_TIER_ID,
    labelAr: "الموارد البشرية",
    labelEn: "Human Resources",
    handlerIds: voiceHrReceivers(data).map((e) => str(e.id)),
    vacant: false,
  };
}

export function hrVoiceChain(data) {
  return [hrVoiceTier(data)];
}

/**
 * The named-complaint ladder: the branch line (direct manager → up), closing at HR when HR is not
 * already on it — so an unresolved open complaint always ends with the administration.
 */
export function namedComplaintChain(branchTiers = [], data) {
  const tiers = Array.isArray(branchTiers) ? branchTiers.filter(Boolean) : [];
  const hr = hrVoiceTier(data);
  const hrIds = new Set(hr.handlerIds);
  const top = tiers[tiers.length - 1];
  const topIsHr = top && (top.id === HR_TIER_ID || (top.handlerIds || []).some((id) => hrIds.has(str(id))));
  if (!tiers.length || topIsHr || !hr.handlerIds.length) return tiers;
  return [...tiers, hr];
}

/** The chain an item climbs (HR-only → the single HR tier). */
export function voiceChainFor(item, branchTiers, data) {
  return isHrOnlyVoice(item) ? hrVoiceChain(data) : namedComplaintChain(branchTiers, data);
}

/* ----------------------------- abuse / harassment ----------------------------- */

function committeeIds(row) {
  return (row?.committee?.members || []).map((m) => str(m?.id ?? m)).filter(Boolean);
}

/** Model regulation Art. 56(1): the filer, that case's named committee, and HR — never the accused. */
export function canSeeAbuseCase(row, user, data) {
  if (!row || !user) return false;
  const uid = str(user.id);
  if (uid && str(row.accusedId) === uid) return false;
  if (uid && str(row.reporterId || row.userId) === uid) return true;
  if (uid && committeeIds(row).includes(uid)) return true;
  return isVoiceHrReceiver(user, data) && inHrScope({ reporterId: row.reporterId || row.userId }, user, data);
}

export function filterAbuseCasesForViewer(rows, user, data) {
  return (rows || []).filter((row) => canSeeAbuseCase(row, user, data));
}

/** May this viewer form the committee / close the file (HR, not a party, not merely a member)? */
export function canRunAbuseCase(row, user, data) {
  if (!row || !user) return false;
  const uid = str(user.id);
  if (str(row.accusedId) === uid || str(row.reporterId || row.userId) === uid) return false;
  return isVoiceHrReceiver(user, data);
}

/**
 * What one viewer may see of the whole voice area — the one place list, count, badge, notification
 * and file views read from.
 */
export function viewerVoiceSlice(data, user) {
  const pub = Array.isArray(data?.publicReports) ? data.publicReports : [];
  const anon = Array.isArray(data?.anonymousReports) ? data.anonymousReports : [];
  const abuse = Array.isArray(data?.abuseCases) ? data.abuseCases : [];
  return {
    publicReports: pub.filter((row) => canSeeVoiceItem(row, user, data)),
    anonymousReports: anon.filter((row) => canSeeVoiceItem({ ...row, bucket: "anon" }, user, data)),
    abuseCases: filterAbuseCasesForViewer(abuse, user, data),
  };
}

/** A notification about an HR-only voice may only go to an HR receiver (or the author). */
export function mayNotifyAboutVoice(item, recipient, data) {
  if (!recipient) return false;
  if (isOwnVoice(item, recipient)) return true;
  if (!isHrOnlyVoice(item)) return true;
  return isVoiceHrReceiver(recipient, data) && inHrScope(item, recipient, data);
}
