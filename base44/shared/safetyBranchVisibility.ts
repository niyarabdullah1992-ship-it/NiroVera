// Server twin of src/lib/safetyBranchVisibility.js (same rule, same named reasons).
/**
 * Safety cards (a station's incidentLog rows) — who sees which card, and how it moves.
 *
 * The branch rule is the one المهام / إثبات العمل / إثبات الزائر use (isSameProofBranch):
 *   1. the reporter sees his own card, always — an anonymous card too, matched by his id;
 *   2. same-branch staff and the branch manager (viewer.stationId === the card's station) see the branch's cards;
 *   3. a manager sees the branches in his scope (managedStationIds; `all` = owner, director, safety officer);
 *   4. anyone else does not see the card: «بلاغ فرع آخر».
 * Named redactions on what is shown:
 *   - anonymous → the reporter's name and id are never shown to anyone but the reporter (managers included);
 *   - injury    → the injured person's name is shown to the reporter and to managers in scope only.
 * Stages: open → progress (assigned / corrective action / escalated) → closed → archive (closed > 30 days).
 * Server twin: the cloud reads the same branch rule before it returns incidentLog rows.
 */

export const SAFETY_ARCHIVE_DAYS = 30;
export const SAFETY_ESCALATION_TOP = 2;
export const SAFETY_NOTE_MIN = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const str = (value: unknown): string => String(value ?? "").trim();

export const SAFETY_STAGE_LABEL = Object.freeze({
  open: { ar: "مفتوحة", en: "Open" },
  progress: { ar: "قيد المعالجة", en: "In progress" },
  closed: { ar: "مغلقة", en: "Closed" },
  archive: { ar: "الأرشيف", en: "Archive" },
});

export const SAFETY_ESCALATION_LEVELS = Object.freeze([
  { level: 1, ar: "مدير الفرع", en: "Branch manager" },
  { level: 2, ar: "الإدارة العليا", en: "Senior management" },
]);

/** The reporter's own card: by id first; a named card also by name; an anonymous card only by id. */
export function safetyCardIsMine(item: any, viewer: any) {
  if (!item || !viewer) return false;
  const id = str(viewer.id);
  if (id && (str(item.reporterId) === id || str(item.card?.reporterId) === id)) return true;
  if (item.anonymous || item.card?.anonymous) return false;
  return Boolean(item.by && viewer.name && item.by === viewer.name);
}

export function isSameSafetyBranch(viewerStationId: unknown, stationId: unknown) {
  return Boolean(str(viewerStationId) && str(stationId) && str(viewerStationId) === str(stationId));
}

/**
 * May `viewer` see this card, and with which redactions?
 * @returns {{ see, mine, sameBranch, managed, reason?, reasonAr?, reasonEn?, redactions: {key, ar, en}[] }}
 */
export function safetyCardAccess({ item, stationId, viewer, managedStationIds = [], all = false }: any = {}) {
  if (!item || !viewer) {
    return { see: false, mine: false, sameBranch: false, managed: false, reason: "NO_VIEWER", reasonAr: "لا مستخدم.", reasonEn: "No viewer.", redactions: [] };
  }
  const mine = safetyCardIsMine(item, viewer);
  const sameBranch = isSameSafetyBranch(viewer.stationId, stationId);
  const managed = Boolean(all) || (managedStationIds || []).map(str).includes(str(stationId));
  if (!mine && !sameBranch && !managed) {
    return {
      see: false,
      mine,
      sameBranch,
      managed,
      reason: "OTHER_BRANCH",
      reasonAr: "بلاغ فرع آخر — يراه فرعه ومديروه فقط.",
      reasonEn: "Another branch's report — only its branch and its managers see it.",
      redactions: [],
    };
  }
  const redactions: { key: string; ar: string; en: string }[] = [];
  if ((item.anonymous || item.card?.anonymous) && !mine) {
    redactions.push({ key: "reporter", ar: "المُبلِّغ محجوب — بلاغ بلا اسم يُتابَع برقمه.", en: "Reporter hidden — an anonymous report is followed by its number." });
  }
  if (item.card?.injured && !mine && !managed) {
    redactions.push({ key: "injured", ar: "اسم المصاب محجوب — خصوصية الإصابة للمُبلِّغ والإدارة.", en: "Injured person hidden — injury privacy is for the reporter and management." });
  }
  return { see: true, mine, sameBranch, managed, redactions };
}

/** A copy of the row with the redacted fields emptied — what leaves the lib is what the viewer may read. */
export function redactSafetyItem(item: any, redactions: any[] = []) {
  if (!item) return item;
  const keys = new Set((redactions || []).map((row) => row.key));
  if (!keys.size) return item;
  const next = { ...item, card: item.card ? { ...item.card } : item.card };
  if (keys.has("reporter")) {
    next.by = "";
    next.reporterId = "";
    if (next.card) next.card.reporterId = "";
  }
  if (keys.has("injured") && next.card) {
    next.card.injuredName = "";
    next.card.injuredEmployeeId = "";
    delete next.card.injuredSelf;
  }
  return next;
}

function closedAtOf(item: any) {
  return item?.closedAt || item?.reviewedAt || item?.afterPhoto?.at || item?.at || "";
}

/** open · progress · closed · archive — derived from the row, never stored. */
export function safetyCardStage(item: any, now: number = Date.now()) {
  if (!item) return "open";
  if (item.status === "closed") {
    const at = Date.parse(closedAtOf(item));
    return Number.isFinite(at) && now - at > SAFETY_ARCHIVE_DAYS * DAY_MS ? "archive" : "closed";
  }
  if (item.assignedTo?.id || item.correctiveAction?.text || item.actionApprovedAt || item.escalated || Number(item.step) >= 1) return "progress";
  return "open";
}

/**
 * The cards `viewer` may see across the stations, newest first, each redacted for him.
 * @returns {{ stationId, stationName, item, mine, sameBranch, managed, redactions, stage }[]}
 */
export function safetyCardsVisibleTo({ safety = [], stations = [], viewer, managedStationIds = [], all = false, now = Date.now() }: any = {}) {
  if (!viewer) return [];
  const nameOf = new Map((stations || []).map((station) => [str(station.id), station.name || ""]));
  const rows: any[] = [];
  for (const rec of safety || []) {
    for (const item of rec?.incidentLog || []) {
      const access = safetyCardAccess({ item, stationId: rec.stationId, viewer, managedStationIds, all });
      if (!access.see) continue;
      rows.push({
        stationId: rec.stationId,
        stationName: nameOf.get(str(rec.stationId)) || "—",
        item: redactSafetyItem(item, access.redactions),
        mine: access.mine,
        sameBranch: access.sameBranch,
        managed: access.managed,
        redactions: access.redactions,
        stage: safetyCardStage(item, now),
      });
    }
  }
  return rows.sort((a, b) => (Date.parse(b.item.at) || 0) - (Date.parse(a.item.at) || 0));
}

/** Pill counts: الكل · مفتوحة · قيد المعالجة · مغلقة · الأرشيف — they always add up. */
export function safetyCardFaceCounts(rows: any[] = []) {
  const counts: Record<string, number> = { all: rows.length, open: 0, progress: 0, closed: 0, archive: 0 };
  for (const row of rows) counts[row.stage] = (counts[row.stage] || 0) + 1;
  return counts;
}

export function safetyCardsOnFace(rows: any[] = [], face: string = "all") {
  return face === "all" ? rows : rows.filter((row: any) => row.stage === face);
}

/**
 * One manager decision on a card: assign · action · close · escalate. Every refusal names its reason.
 * `actor` is { id, name }; a reporter does not decide on his own card (he may still escalate it).
 */
export function checkSafetyDecisionGate({ item, action, actor = {}, note = "", assignee = null, afterPhotoName = "" }: any = {}) {
  const refuse = (error: string, reasonAr: string, reasonEn: string) => ({ ok: false, error, reason: reasonAr, reasonEn });
  if (!item) return refuse("NOT_FOUND", "البلاغ غير موجود.", "Report not found.");
  if (item.status === "closed") return refuse("ALREADY_CLOSED", "البلاغ مُغلق — لا قرار بعد الإغلاق.", "The report is closed — no decision after closing.");
  const own = safetyCardIsMine(item, actor);
  const text = str(note);
  if (action === "escalate") {
    const level = Number(item.escalationLevel) || (item.escalated ? 1 : 0);
    if (level >= SAFETY_ESCALATION_TOP) return refuse("AT_TOP", "بلغ البلاغ أعلى السلسلة.", "The report is at the top of the chain.");
    return { ok: true, nextLevel: level + 1 };
  }
  if (own) return refuse("OWN_REPORT", "بلاغك — يقرّر فيه غيرك، ولك تصعيده.", "Your own report — someone else decides; you may escalate it.");
  if (action === "assign") {
    if (!str(assignee?.id)) return refuse("ASSIGNEE_REQUIRED", "اختر من يتولّى المعالجة.", "Pick who handles it.");
    return { ok: true };
  }
  if (action === "action") {
    if (text.length < SAFETY_NOTE_MIN) return refuse("ACTION_TEXT_REQUIRED", `اكتب الإجراء التصحيحي (${SAFETY_NOTE_MIN} أحرف على الأقل).`, `Write the corrective action (at least ${SAFETY_NOTE_MIN} characters).`);
    return { ok: true };
  }
  if (action === "close") {
    if (text.length < SAFETY_NOTE_MIN) return refuse("CLOSE_REASON_REQUIRED", `الإغلاق يحتاج سبباً مكتوباً (${SAFETY_NOTE_MIN} أحرف على الأقل).`, `Closing needs a written reason (at least ${SAFETY_NOTE_MIN} characters).`);
    const positive = Boolean(item.card?.positive);
    if (!positive && !(item.correctiveAction?.text || item.actionApprovedAt)) return refuse("ACTION_FIRST", "سجّل الإجراء التصحيحي قبل الإغلاق.", "Record the corrective action before closing.");
    if (!positive && !str(afterPhotoName)) return refuse("AFTER_PHOTO_REQUIRED", "أرفق صورة بعد المعالجة قبل الإغلاق.", "Attach an after photo before closing.");
    return { ok: true };
  }
  return refuse("UNKNOWN_ACTION", "قرار غير معروف.", "Unknown decision.");
}

const AUDIT_LABEL: Record<string, { ar: string; en: string }> = {
  raised: { ar: "رُفع البلاغ", en: "Report raised" },
  assign: { ar: "أُسند للمعالجة", en: "Assigned" },
  action: { ar: "سُجّل الإجراء التصحيحي", en: "Corrective action recorded" },
  approve_action: { ar: "اعتُمد الإجراء", en: "Action approved" },
  escalate: { ar: "صُعّد", en: "Escalated" },
  close: { ar: "أُغلق بسبب مكتوب", en: "Closed with a written reason" },
};

/** The card's trail, oldest first. Rows recorded before the trail existed are read from their stamps. */
export function safetyCardAuditTrail(item: any, lang: string = "ar") {
  if (!item) return [];
  const ar = lang !== "en";
  const anonymous = Boolean(item.anonymous || item.card?.anonymous);
  const rows: any[] = [{ type: "raised", at: item.at, by: anonymous ? "" : (item.by || ""), note: "" }];
  const audit = Array.isArray(item.audit) ? item.audit : [];
  if (audit.length) rows.push(...audit);
  else {
    if (item.escalatedAt) rows.push({ type: "escalate", at: item.escalatedAt, by: item.escalatedBy || "", note: "" });
    if (item.actionApprovedAt) rows.push({ type: "approve_action", at: item.actionApprovedAt, by: item.actionApprovedBy || "", note: "" });
    if (item.status === "closed" && (item.reviewedAt || item.afterPhoto?.at)) rows.push({ type: "close", at: item.reviewedAt || item.afterPhoto?.at, by: item.reviewedBy || "", note: item.closeReason || "" });
  }
  return rows
    .filter((row) => row && row.at)
    .sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0))
    .map((row) => ({ ...row, label: (AUDIT_LABEL[row.type] || { ar: row.type, en: row.type })[ar ? "ar" : "en"] }));
}

/** The reporter's notice for one decision — the card's number, never the reporter's name. */
export function safetyReporterNotice(type: string, item: any, { lang = "ar", assigneeName = "", level = 0 }: any = {}) {
  const code = str(item?.card?.code) || str(item?.id);
  const ar = lang !== "en";
  const lines: Record<string, string[]> = {
    assign: [`بلاغ السلامة ${code}: أُسند للمعالجة${assigneeName ? ` إلى ${assigneeName}` : ""}.`, `Safety report ${code}: assigned${assigneeName ? ` to ${assigneeName}` : ""}.`],
    action: [`بلاغ السلامة ${code}: سُجّل الإجراء التصحيحي.`, `Safety report ${code}: corrective action recorded.`],
    escalate: [`بلاغ السلامة ${code}: صُعّد إلى ${(SAFETY_ESCALATION_LEVELS.find((row) => row.level === level) || SAFETY_ESCALATION_LEVELS[0]).ar}.`, `Safety report ${code}: escalated to ${(SAFETY_ESCALATION_LEVELS.find((row) => row.level === level) || SAFETY_ESCALATION_LEVELS[0]).en}.`],
    close: [`بلاغ السلامة ${code}: أُغلق بسبب مكتوب — افتح البطاقة لقراءته.`, `Safety report ${code}: closed with a written reason — open the card to read it.`],
  };
  const pair = lines[type];
  if (!pair || !code) return "";
  return ar ? pair[0] : pair[1];
}
