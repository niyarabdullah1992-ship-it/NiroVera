import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  CHAT_SECTION,
  checkListGate,
  checkSendGate,
  demoChatFacts,
  deriveChatBoard,
  messagesForChannel,
  RATE_LIMIT_BURST,
  type ChatActor,
  type ChatChannel,
  type ChatFacts,
  type ChatMessage,
} from "../../shared/chatDerivations.ts";

/**
 * do-not-invoke-from-frontend — no page calls this function. Live groups cache on companyMeta;
 * messages stay on `stationChat` if a leftover caller arrives. Do not add a second chat bag.
 */
const CHAT_CATEGORY = "stationChat";

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyFacts(companyId: string): ChatFacts {
  return {
    companyId,
    channels: [],
    messages: [],
    seenByUser: {},
    sendTimesByUser: {},
    crossStationChatEnabled: false,
  };
}

function filterFacts(raw: ChatFacts, companyId: string): ChatFacts {
  return {
    companyId,
    channels: (raw.channels || []).filter(
      (c) => c && c.id && (!c.companyId || c.companyId === companyId),
    ),
    messages: (raw.messages || []).filter(
      (m) => m && m.id && m.channelId && (!m.companyId || m.companyId === companyId),
    ),
    seenByUser: raw.seenByUser && typeof raw.seenByUser === "object" ? raw.seenByUser : {},
    sendTimesByUser: raw.sendTimesByUser && typeof raw.sendTimesByUser === "object"
      ? raw.sendTimesByUser
      : {},
    crossStationChatEnabled: !!raw.crossStationChatEnabled,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = String(body.action || "");
    const companyId = requireCompanyId(body.companyId);
    if (!companyId) {
      return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }

    const sessionAuth = await authPowerCareSession(base44, companyId, body.sessionToken);
    if (!sessionAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const auth: ChatActor & {
      companyId: string;
      userId: string | null;
      name: string;
    } = {
      companyId,
      userId: sessionAuth.userId || null,
      name: sessionAuth.name || "User",
      role: sessionAuth.role || "employee",
      stationId: sessionAuth.stationId || null,
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
      allStations: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin
        || ["director", "ops_manager", "pgm", "hr_manager", "hr"].includes(String(sessionAuth.role || "")),
      stationIds: Array.isArray(body.stationIds)
        ? body.stationIds.filter((x: unknown) => typeof x === "string")
        : (sessionAuth.stationId ? [sessionAuth.stationId] : []),
    };

    const manageRoles = [
      "owner", "director", "ops_manager", "admin", "pgm", "station_manager", "hr_manager", "hr",
    ];
    const canManage = auth.owner || auth.admin || manageRoles.includes(String(auth.role || ""));

    const crossTenant = body.crossTenant === true
      || (typeof body.requestCompanyId === "string"
        && body.requestCompanyId.trim()
        && body.requestCompanyId.trim() !== auth.companyId);

    const loadBlob = async () => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category: CHAT_CATEGORY,
      });
      return rows[0] || null;
    };

    const loadFacts = async (): Promise<ChatFacts> => {
      const blob = await loadBlob();
      const raw = blob?.payload && typeof blob.payload === "object" ? blob.payload as ChatFacts : null;
      if (!raw) return emptyFacts(auth.companyId);
      return filterFacts(raw, auth.companyId);
    };

    const saveFacts = async (facts: ChatFacts) => {
      const blob = await loadBlob();
      const payload = filterFacts(facts, auth.companyId);
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: CHAT_CATEGORY,
          payload,
        });
      }
    };

    const audit = async (actionKey: string, details: string, extra: Record<string, unknown> = {}) => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: actionKey,
        performedBy: auth.name,
        details,
        reason: extra.reason || null,
        oldValue: extra.oldValue || null,
        newValue: extra.newValue || null,
      });
    };

    const packBoard = (facts: ChatFacts) => {
      const board = deriveChatBoard({
        facts,
        actor: auth,
        companyId: auth.companyId,
        userId: auth.userId,
      });
      return {
        ok: true,
        companyId: auth.companyId,
        section: CHAT_SECTION,
        channels: board.channels,
        stats: board.stats,
        subtitleAr: board.activeHintAr,
        subtitleEn: board.activeHintEn,
        rateLimit: RATE_LIMIT_BURST,
      };
    };

    const findChannel = (facts: ChatFacts, channelId: string): ChatChannel | null =>
      facts.channels.find((c) => c.id === channelId) || null;

    if (action === "board") {
      let facts = await loadFacts();
      if (!facts.channels.length) {
        return Response.json({
          ...packBoard(facts),
          empty: true,
          hintAr: "لا قنوات بعد — شغّل seedDemo أو اربط فروع الشركة.",
          hintEn: "No channels yet — run seedDemo or wire company stations.",
        });
      }
      return Response.json(packBoard(facts));
    }

    if (action === "seedDemo") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const existing = await loadFacts();
      if (existing.channels.length > 0) {
        return Response.json(packBoard(existing));
      }
      const facts = demoChatFacts(auth.companyId);
      await saveFacts(facts);
      await audit("chat.seedDemo", "Seeded station chat ops-log channels");
      return Response.json(packBoard(facts));
    }

    if (action === "listMessages") {
      const facts = await loadFacts();
      const channelId = String(body.channelId || "").trim();
      const channel = findChannel(facts, channelId);
      const gate = checkListGate({
        channelId,
        channel,
        actor: auth,
        companyId: auth.companyId,
        channelCompanyId: channel?.companyId,
        crossTenant,
        crossStationChatEnabled: facts.crossStationChatEnabled,
      });
      if (!gate.ok) {
        return Response.json({
          ok: false,
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          gate,
        }, { status: 400 });
      }
      if (!channel) {
        return Response.json({
          ok: false,
          error: "FORBIDDEN",
          reason: "القناة غير موجودة في نطاق شركتك.",
          reasonEn: "Channel not found in your company scope.",
        }, { status: 403 });
      }
      const messages = messagesForChannel(facts.messages, channelId, auth.companyId);
      return Response.json({
        ok: true,
        companyId: auth.companyId,
        channel,
        messages,
        header: {
          titleAr: channel.nameAr,
          titleEn: channel.nameEn,
          membersAr: `${channel.memberCount || 0} أعضاء · مرتبطة بالفرع`,
          membersEn: `${channel.memberCount || 0} members · bound to the station`,
          tagAr: "مؤرشفة في سجل التشغيل",
          tagEn: "Archived in the operations log",
        },
      });
    }

    if (action === "markSeen") {
      const facts = await loadFacts();
      const channelId = String(body.channelId || "").trim();
      const channel = findChannel(facts, channelId);
      const gate = checkListGate({
        channelId,
        channel,
        actor: auth,
        companyId: auth.companyId,
        channelCompanyId: channel?.companyId,
        crossTenant,
        crossStationChatEnabled: facts.crossStationChatEnabled,
      });
      if (!gate.ok) {
        return Response.json({
          ok: false,
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          gate,
        }, { status: 400 });
      }
      if (!auth.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const seen = { ...(facts.seenByUser || {}) };
      const mine = { ...(seen[auth.userId] || {}) };
      mine[channelId] = new Date().toISOString();
      seen[auth.userId] = mine;
      facts.seenByUser = seen;
      await saveFacts(facts);
      return Response.json(packBoard(facts));
    }

    if (action === "send") {
      const facts = await loadFacts();
      const channelId = String(body.channelId || body.stationKey || "").trim();
      const channel = findChannel(facts, channelId);
      const text = String(body.text || "").trim();
      const hasFiles = Array.isArray(body.files) && body.files.length > 0;
      const userKey = auth.userId || "anon";
      const recent = (facts.sendTimesByUser || {})[userKey] || [];
      const gate = checkSendGate({
        text,
        hasFiles,
        channelId,
        stationKey: channel?.stationKey || body.stationKey,
        channel,
        actor: auth,
        companyId: auth.companyId,
        channelCompanyId: channel?.companyId,
        crossTenant,
        crossStationChatEnabled: facts.crossStationChatEnabled,
        recentSendAts: recent,
        stations: Array.isArray(body.stations) ? body.stations : undefined,
      });
      if (!gate.ok) {
        return Response.json({
          ok: false,
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          gate,
        }, { status: 400 });
      }
      if (!channel) {
        return Response.json({
          ok: false,
          error: "FORBIDDEN",
          reason: "القناة غير موجودة في نطاق شركتك.",
          reasonEn: "Channel not found in your company scope.",
        }, { status: 403 });
      }

      const nowIso = new Date().toISOString();
      const cleanFiles = Array.isArray(body.files)
        ? body.files
          .filter((f: { url?: string }) => f && f.url)
          .map((f: { url: string; name?: string; type?: string; durationSec?: number }) => {
            const durationSec = Number(f.durationSec);
            return {
              url: String(f.url),
              name: String(f.name || "file"),
              type: String(f.type || "file"),
              ...(Number.isFinite(durationSec) && durationSec > 0
                ? { durationSec: Math.round(durationSec) }
                : {}),
            };
          })
        : [];
      const msg: ChatMessage = {
        id: uid("msg"),
        companyId: auth.companyId,
        channelId: channel.id,
        authorId: auth.userId,
        authorName: auth.name,
        text,
        files: cleanFiles,
        attachmentRef: typeof body.attachmentRef === "string" ? body.attachmentRef : null,
        createdAt: nowIso,
      };
      facts.messages = [...facts.messages, msg];
      const times = [...recent, nowIso].slice(-RATE_LIMIT_BURST.max);
      facts.sendTimesByUser = {
        ...(facts.sendTimesByUser || {}),
        [userKey]: times,
      };
      if (auth.userId) {
        const seen = { ...(facts.seenByUser || {}) };
        const mine = { ...(seen[auth.userId] || {}) };
        mine[channel.id] = nowIso;
        seen[auth.userId] = mine;
        facts.seenByUser = seen;
      }
      await saveFacts(facts);
      await audit("chat.send", `Sent message on ${channel.id}`, {
        newValue: { channelId: channel.id, messageId: msg.id },
      });
      return Response.json({
        ...packBoard(facts),
        message: msg,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String((error as Error)?.message || error) }, { status: 500 });
  }
});
