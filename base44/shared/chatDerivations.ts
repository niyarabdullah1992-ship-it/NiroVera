/** Station chat (المحادثات التشغيلية) — channel list, unread counts, named send gates.
 *  Design: NiroVera Platform.dc.html (isChat / channels / messages / Enter-sends).
 *  Messages and unread badges are derived server-side within companyId + station scope.
 */

export const CHAT_SECTION = "chat";

/** Soft burst guard — design implies ops log, not a flood channel. */
export const RATE_LIMIT_BURST = {
  windowMs: 5 * 60_000,
  max: 30,
} as const;

export type ChatActor = {
  role?: string | null;
  owner?: boolean;
  admin?: boolean;
  userId?: string | null;
  stationId?: string | null;
  stationIds?: string[] | null;
  allStations?: boolean;
};

export type ChatChannel = {
  id: string;
  companyId?: string;
  stationKey: string;
  nameAr: string;
  nameEn: string;
  kind?: "station" | "supervisors" | "safety" | "procurement" | "group" | "all";
  memberCount?: number;
  accent?: string;
};

export type ChatAttachment = {
  url: string;
  name: string;
  type: string;
  durationSec?: number;
};

export type ChatMessage = {
  id: string;
  companyId?: string;
  channelId: string;
  authorId?: string | null;
  authorName: string;
  text: string;
  files?: ChatAttachment[];
  attachmentRef?: string | null;
  createdAt: string;
};

export type ChatFacts = {
  companyId: string;
  channels: ChatChannel[];
  messages: ChatMessage[];
  seenByUser?: Record<string, Record<string, string>>;
  sendTimesByUser?: Record<string, string[]>;
  crossStationChatEnabled?: boolean;
};

export type DerivedChannel = ChatChannel & {
  preview: string;
  unread: number;
  lastAt: string | null;
  inScope: boolean;
};

export type ChatBoardStats = {
  channelCount: number;
  unreadTotal: number;
  messageCount: number;
};

export type GateFail = {
  ok: false;
  error: string;
  reason: string;
  reasonEn: string;
};

export type GateOk = { ok: true };

const ALL_STATION_ROLES = new Set([
  "owner", "director", "ops_manager", "admin", "pgm", "hr_manager", "hr",
]);

export function actorSeesAllStations(actor?: ChatActor | null): boolean {
  if (!actor) return false;
  if (actor.owner || actor.admin || actor.allStations) return true;
  return ALL_STATION_ROLES.has(String(actor.role || ""));
}

export function actorStationSet(actor?: ChatActor | null): Set<string> {
  const ids = new Set<string>();
  if (!actor) return ids;
  if (actor.stationId) ids.add(actor.stationId);
  for (const id of actor.stationIds || []) {
    if (id) ids.add(id);
  }
  return ids;
}

/** A manager node is not an operational chat room — only workplace branches are. */
export function stationKeyAllowsOpsChat(
  stationKey: string | null | undefined,
  stations?: Array<{ id?: string; unitKind?: string }> | null,
): boolean {
  const key = String(stationKey || "").trim();
  if (!key || key === "all" || key.startsWith("group_")) return true;
  if (!Array.isArray(stations) || !stations.length) return true;
  const station = stations.find((item) => String(item?.id || "") === key);
  if (!station) return true;
  return String(station.unitKind || "").trim() !== "manager";
}

export function actorCanAccessChannel(
  channel: ChatChannel | null | undefined,
  actor?: ChatActor | null,
  opts?: { crossStationChatEnabled?: boolean },
): boolean {
  if (!channel || !actor) return false;
  if (actorSeesAllStations(actor)) return true;

  const key = String(channel.stationKey || channel.id || "");
  const kind = channel.kind || "station";
  const allowed = actorStationSet(actor);

  if (kind === "all" || key === "all") {
    return !!opts?.crossStationChatEnabled && (allowed.size > 0 || !!actor.stationId);
  }
  if (kind === "supervisors") {
    return ["station_manager"].includes(String(actor.role || ""));
  }
  if (kind === "safety") {
    return ["station_manager", "safety_officer"].includes(String(actor.role || ""));
  }
  if (kind === "procurement") {
    return ["station_manager", "procurement"].includes(String(actor.role || ""));
  }
  if (kind === "group" || key.startsWith("group_")) {
    return allowed.has(key) || allowed.has(channel.stationKey);
  }
  return allowed.has(key);
}

export function scopeChannels(
  channels: ChatChannel[],
  actor: ChatActor | null | undefined,
  companyId: string,
  opts?: { crossStationChatEnabled?: boolean },
): ChatChannel[] {
  return (channels || []).filter(
    (c) =>
      c
      && c.id
      && (!c.companyId || c.companyId === companyId)
      && actorCanAccessChannel(c, actor, opts),
  );
}

export function scopeMessages(
  messages: ChatMessage[],
  channelIds: Set<string>,
  companyId: string,
): ChatMessage[] {
  return (messages || []).filter(
    (m) =>
      m
      && m.id
      && (!m.companyId || m.companyId === companyId)
      && channelIds.has(m.channelId),
  );
}

export function messagesForChannel(
  messages: ChatMessage[],
  channelId: string,
  companyId: string,
): ChatMessage[] {
  return (messages || [])
    .filter(
      (m) =>
        m
        && (!m.companyId || m.companyId === companyId)
        && m.channelId === channelId,
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function unreadForChannel(
  messages: ChatMessage[],
  channelId: string,
  seenAt: string | null | undefined,
  companyId: string,
  actorUserId?: string | null,
): number {
  const seenMs = seenAt ? Date.parse(seenAt) : 0;
  return messagesForChannel(messages, channelId, companyId).filter((m) => {
    if (actorUserId && m.authorId && m.authorId === actorUserId) return false;
    const t = Date.parse(m.createdAt);
    if (!Number.isFinite(t)) return false;
    return !seenMs || t > seenMs;
  }).length;
}

export function isAudioChatFile(file?: { type?: string; name?: string } | null): boolean {
  if (!file) return false;
  return /^audio\//i.test(String(file.type || ""))
    || /\.(webm|mp3|wav|m4a|ogg)$/i.test(String(file.name || ""));
}

export function messagePreview(msg?: ChatMessage | null): string {
  const text = String(msg?.text || "").trim();
  if (text) return text;
  const files = Array.isArray(msg?.files) ? msg.files : [];
  if (files.some(isAudioChatFile)) return "مقطع صوتي";
  if (files[0]?.name) return String(files[0].name);
  return "";
}

export function deriveChannelRow(
  channel: ChatChannel,
  messages: ChatMessage[],
  seenAt: string | null | undefined,
  companyId: string,
  actor?: ChatActor | null,
  opts?: { crossStationChatEnabled?: boolean },
): DerivedChannel {
  const thread = messagesForChannel(messages, channel.id, companyId);
  const last = thread[thread.length - 1];
  const inScope = actorCanAccessChannel(channel, actor, opts);
  return {
    ...channel,
    preview: messagePreview(last),
    unread: inScope
      ? unreadForChannel(messages, channel.id, seenAt, companyId, actor?.userId)
      : 0,
    lastAt: last?.createdAt || null,
    inScope,
  };
}

export function deriveChatBoard(input: {
  facts: ChatFacts;
  actor: ChatActor;
  companyId: string;
  userId?: string | null;
}): {
  channels: DerivedChannel[];
  stats: ChatBoardStats;
  activeHintAr: string;
  activeHintEn: string;
} {
  const opts = { crossStationChatEnabled: !!input.facts.crossStationChatEnabled };
  const scoped = scopeChannels(input.facts.channels, input.actor, input.companyId, opts);
  const ids = new Set(scoped.map((c) => c.id));
  const msgs = scopeMessages(input.facts.messages, ids, input.companyId);
  const seenMap = (input.facts.seenByUser || {})[input.userId || input.actor.userId || ""] || {};

  const channels = scoped
    .map((c) => deriveChannelRow(c, msgs, seenMap[c.id], input.companyId, input.actor, opts))
    .sort((a, b) => {
      const ta = a.lastAt ? Date.parse(a.lastAt) : 0;
      const tb = b.lastAt ? Date.parse(b.lastAt) : 0;
      return tb - ta;
    });

  const unreadTotal = channels.reduce((n, c) => n + (Number(c.unread) || 0), 0);
  return {
    channels,
    stats: {
      channelCount: channels.length,
      unreadTotal,
      messageCount: msgs.length,
    },
    activeHintAr: "قنوات لكل فرع · الرسائل جزء من سجل التشغيل",
    activeHintEn: "A channel per station · messages are part of the operations log",
  };
}

export function checkSendGate(input: {
  text?: string | null;
  hasFiles?: boolean;
  channelId?: string | null;
  stationKey?: string | null;
  channel?: ChatChannel | null;
  actor?: ChatActor | null;
  companyId?: string | null;
  channelCompanyId?: string | null;
  crossTenant?: boolean;
  crossStationChatEnabled?: boolean;
  recentSendAts?: string[] | null;
  nowMs?: number;
  stations?: Array<{ id?: string; unitKind?: string }> | null;
}): GateFail | GateOk {
  if (input.crossTenant) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "لا يُسمح بتجاوز حدود الشركة (companyId).",
      reasonEn: "Cross-tenant access is blocked (companyId scope).",
    };
  }

  const companyId = String(input.companyId || "").trim();
  if (!companyId) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "سجل الدردشة بلا companyId مرفوض.",
      reasonEn: "Chat records without companyId are rejected.",
    };
  }

  if (
    input.channelCompanyId
    && String(input.channelCompanyId).trim()
    && String(input.channelCompanyId).trim() !== companyId
  ) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "القناة خارج نطاق شركتك.",
      reasonEn: "That channel is outside your company scope.",
    };
  }

  const channelId = String(input.channelId || input.channel?.id || "").trim();
  const stationKey = String(
    input.stationKey || input.channel?.stationKey || "",
  ).trim();
  if (!channelId && !stationKey) {
    return {
      ok: false,
      error: "STATION_REQUIRED",
      reason: "اختر فرع أو قناة قبل الإرسال.",
      reasonEn: "Pick a station or channel before sending.",
    };
  }

  if (!stationKeyAllowsOpsChat(stationKey || channelId, input.stations)) {
    return {
      ok: false,
      error: "MANAGER_NO_CHAT",
      reason: "المدير ليس فرع تشغيل. المحادثة على الفروع التابعة له.",
      reasonEn: "A manager is not an operations channel. Chat on the branches under them.",
    };
  }

  if (input.channel && !actorCanAccessChannel(input.channel, input.actor, {
    crossStationChatEnabled: input.crossStationChatEnabled,
  })) {
    return {
      ok: false,
      error: "FORBIDDEN",
      reason: "هذه القناة خارج نطاق فرعك.",
      reasonEn: "This channel is outside your station scope.",
    };
  }

  const text = String(input.text || "").trim();
  if (!text && !input.hasFiles) {
    return {
      ok: false,
      error: "EMPTY_MESSAGE",
      reason: "اكتب رسالة أو أرفق ملفًا أو مقطعًا صوتيًا قبل الإرسال.",
      reasonEn: "Enter a message, attach a file, or send a voice note.",
    };
  }

  const now = input.nowMs ?? Date.now();
  const windowStart = now - RATE_LIMIT_BURST.windowMs;
  const recent = (input.recentSendAts || [])
    .map((iso) => Date.parse(iso))
    .filter((t) => Number.isFinite(t) && t >= windowStart);
  if (recent.length >= RATE_LIMIT_BURST.max) {
    return {
      ok: false,
      error: "RATE_LIMIT_BURST",
      reason: `تم تجاوز حد الإرسال (${RATE_LIMIT_BURST.max} رسالة / 5 دقائق).`,
      reasonEn: `Send rate exceeded (${RATE_LIMIT_BURST.max} messages / 5 minutes).`,
    };
  }

  return { ok: true };
}

export function checkListGate(input: {
  channelId?: string | null;
  channel?: ChatChannel | null;
  actor?: ChatActor | null;
  companyId?: string | null;
  channelCompanyId?: string | null;
  crossTenant?: boolean;
  crossStationChatEnabled?: boolean;
}): GateFail | GateOk {
  if (input.crossTenant) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "لا يُسمح بتجاوز حدود الشركة (companyId).",
      reasonEn: "Cross-tenant access is blocked (companyId scope).",
    };
  }
  const companyId = String(input.companyId || "").trim();
  if (!companyId) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "سجل الدردشة بلا companyId مرفوض.",
      reasonEn: "Chat records without companyId are rejected.",
    };
  }
  if (
    input.channelCompanyId
    && String(input.channelCompanyId).trim()
    && String(input.channelCompanyId).trim() !== companyId
  ) {
    return {
      ok: false,
      error: "OUT_OF_SCOPE",
      reason: "القناة خارج نطاق شركتك.",
      reasonEn: "That channel is outside your company scope.",
    };
  }
  if (!input.channelId && !input.channel) {
    return {
      ok: false,
      error: "STATION_REQUIRED",
      reason: "اختر فرع أو قناة لعرض الرسائل.",
      reasonEn: "Pick a station or channel to view messages.",
    };
  }
  if (input.channel && !actorCanAccessChannel(input.channel, input.actor, {
    crossStationChatEnabled: input.crossStationChatEnabled,
  })) {
    return {
      ok: false,
      error: "FORBIDDEN",
      reason: "هذه القناة خارج نطاق فرعك.",
      reasonEn: "This channel is outside your station scope.",
    };
  }
  return { ok: true };
}

export function demoChatFacts(companyId: string): ChatFacts {
  const channels: ChatChannel[] = [
    {
      id: "jbl2",
      companyId,
      stationKey: "jbl2",
      kind: "station",
      nameAr: "الجبيل 2 — وردية الصباح",
      nameEn: "Jubail 2 — morning shift",
      memberCount: 9,
      accent: "#DC2626",
    },
    {
      id: "supervisors",
      companyId,
      stationKey: "supervisors",
      kind: "supervisors",
      nameAr: "مشرفو الفروع",
      nameEn: "Station supervisors",
      memberCount: 6,
      accent: "#1E9E63",
    },
    {
      id: "jbl1",
      companyId,
      stationKey: "jbl1",
      kind: "station",
      nameAr: "الجبيل 1 — وردية الصباح",
      nameEn: "Jubail 1 — morning shift",
      memberCount: 8,
      accent: "#1E9E63",
    },
    {
      id: "safety",
      companyId,
      stationKey: "safety",
      kind: "safety",
      nameAr: "السلامة — كل الفروع",
      nameEn: "Safety — all stations",
      memberCount: 12,
      accent: "#F59E0B",
    },
    {
      id: "purchasing",
      companyId,
      stationKey: "purchasing",
      kind: "procurement",
      nameAr: "المشتريات",
      nameEn: "Procurement",
      memberCount: 4,
      accent: "#94A3B8",
    },
  ];

  const iso = (h: number, m: number) => {
    const d = new Date(2026, 7, 11, h, m, 0);
    return d.toISOString();
  };

  const messages: ChatMessage[] = [
    { id: "m1", companyId, channelId: "jbl2", authorId: "u_turki", authorName: "تركي المطيري", text: "مضخة التبريد توقفت الساعة 5:40. رفعت بلاغ سلامة وصورة الموقع.", attachmentRef: "HSE-0912", createdAt: iso(5, 52) },
    { id: "m2", companyId, channelId: "jbl2", authorId: "u_saud", authorName: "سعود الحربي", text: "وصلت الموقع. التسريب من وصلة التغذية رقم 3، أحتاج صمام بديل من المخزون.", createdAt: iso(6, 18) },
    { id: "m3", companyId, channelId: "jbl2", authorId: "u_you", authorName: "أنت", text: "الصمام تحت الحد في المخزون — أنشأت أمر شراء عاجل وأرسلته للتوقيع.", createdAt: iso(6, 31) },
    { id: "m4", companyId, channelId: "jbl2", authorId: "u_khalid", authorName: "خالد الزهراني", text: "يوجد صمام مطابق في مخزون ينبع. أنقله اليوم بدل انتظار التوريد.", createdAt: iso(6, 44) },
    { id: "m5", companyId, channelId: "jbl2", authorId: "u_you", authorName: "أنت", text: "وافق. حدّث أمر العمل بعد التركيب وأرفق صورة الإثبات.", createdAt: iso(6, 47) },
    { id: "m6", companyId, channelId: "supervisors", authorId: "u_fahd", authorName: "فهد القحطاني", text: "جدول الورديات القادم منشور — راجعوا تغطية الليلية قبل الخميس.", createdAt: iso(8, 12) },
    { id: "m7", companyId, channelId: "supervisors", authorId: "u_you", authorName: "أنت", text: "راجعته. ينبع تحتاج مناوبًا إضافيًا يوم الأربعاء.", createdAt: iso(8, 26) },
    { id: "m8", companyId, channelId: "safety", authorId: "u_muna", authorName: "منى العتيبي", text: "تسريب زيت عند مضخة التغذية 3 — أوقفت العمل وعزلت المنطقة.", attachmentRef: "HSE-0908", createdAt: iso(7, 14) },
    { id: "m9", companyId, channelId: "purchasing", authorId: "u_khalid", authorName: "خالد الزهراني", text: "مخزون الصمامات تحت حد إعادة الطلب في ثلاث فروع.", createdAt: iso(10, 5) },
    { id: "m10", companyId, channelId: "jbl1", authorId: "u_noura", authorName: "نورة الرشيد", text: "ثلاث شهادات سلامة تنتهي هذا الشهر — أرفقت القائمة.", createdAt: iso(12, 10) },
  ];

  return {
    companyId,
    channels,
    messages,
    seenByUser: {},
    sendTimesByUser: {},
    crossStationChatEnabled: false,
  };
}

