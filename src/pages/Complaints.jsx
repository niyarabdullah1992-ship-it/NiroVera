import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany, addNotification, getAnonUsage } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import { hasHRPermission } from "@/lib/permissions";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { pageKicker } from "@/lib/moduleMeta";
import { sha256HexOfFile } from "@/lib/fileHash";
import AttachFileButton from "@/components/shared/AttachFileButton";
import {
  appendVoiceAudit,
  applySlaAutoEscalate,
  resolveVoiceWorkStationId,
  checkCloseGate,
  checkEscalateGate,
  checkReturnNoteGate,
  checkSubmitVoiceGate,
  checkWorkerAppealGate,
  defaultEscalationChain,
  deriveEscalationChain,
} from "@/lib/complaintDerivations";
import { countAr } from "@/lib/disciplineBoard";
import {
  VOICE_CHANNELS,
  VOICE_PRIOs,
  channelOf,
  collectVoiceItems,
  deriveVoiceBoard,
  voiceDecisionNoticeText,
} from "@/lib/voiceBoard";
import VoiceArchiveBoard from "@/components/complaints/VoiceArchiveBoard";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";
import VoiceRelatedLinks from "@/components/complaints/VoiceRelatedLinks";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { railLaneTabs, useRailSide } from "@/lib/railSide";

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "9px 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

function actionStyle(kind, off) {
  if (off) return { background: "var(--nv-card)", color: "var(--nv-muted)", border: "1px solid var(--nv-line)", borderRadius: 10, cursor: "default" };
  if (kind === "go") return { background: "var(--nv-ok-fill)", color: "var(--nv-btn-ink)", border: "1px solid var(--nv-ok-fill)", borderRadius: 10, cursor: "pointer" };
  return { background: "var(--nv-card)", color: "var(--nv-ink)", border: "1px solid var(--nv-line)", borderRadius: 10, cursor: "pointer" };
}

export default function Complaints() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, company, currentUser } = useAuth();
  const railSide = useRailSide();
  const employees = data?.employees || [];
  const stations = data?.stations || [];
  const stationScope = useStationScope();
  const canManage = Boolean(currentUser && (
    data?.ownerId === currentUser.id
    || ["director", "ops_manager", "pgm", "station_manager"].includes(currentUser.role)
    || hasHRPermission(currentUser, data, "view_anonymous_reports")
    || hasHRPermission(currentUser, data, "manage_anonymous_reports")
  ));
  const chain = useMemo(() => {
    const ids = data?.complaintEscalationChain || [];
    if (ids.length) return deriveEscalationChain(ids, employees);
    const home = stations.find((row) => String(row.id) === String(currentUser?.stationId))
      || stations.find((row) => String(row.name || "").includes("الخفجي"))
      || stations.find((row) => row.managerId)
      || stations[0];
    const named = employees.find((row) => String(row.id) === String(home?.managerId))?.name
      || employees.find((row) => row.role === "station_manager")?.name;
    return defaultEscalationChain(named);
  }, [data?.complaintEscalationChain, employees, stations, currentUser?.stationId]);

  const allItems = useMemo(
    () => collectVoiceItems({ publicReports: data?.publicReports, anonymousReports: data?.anonymousReports }),
    [data?.publicReports, data?.anonymousReports],
  );
  const queueItems = useMemo(() => {
    if (!canManage) return undefined;
    return allItems.filter((item) => {
      const author = employees.find((row) => String(row.id) === String(item.authorId));
      return matchesStationScope(item.stationId || author?.stationId, stationScope);
    });
  }, [allItems, canManage, employees, stationScope]);

  const board = useMemo(
    () => deriveVoiceBoard({
      items: allItems,
      queueItems,
      viewerStationId: currentUser?.stationId,
      employees,
      stations,
      ar,
      canManage,
      userId: currentUser?.id,
      chain,
    }),
    [allItems, queueItems, employees, stations, ar, canManage, currentUser?.id, currentUser?.stationId, chain],
  );
  const mineSettled = useMemo(
    () => (canManage ? board.mine.filter((card) => card.settled) : board.settled),
    [board.mine, board.settled, canManage],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab = ["mine", "manage"].includes(requestedTab) ? requestedTab : "mine";
  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };
  const [channel, setChannel] = useState("suggestion");
  const [prio, setPrio] = useState("low");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState({});
  const [queueFilter, setQueueFilter] = useState("due");
  const [mineFace, setMineFace] = useState("live");
  const [anonReceipt, setAnonReceipt] = useState("");

  useEffect(() => {
    if (!company?.id) return;
    const pub = applySlaAutoEscalate(data?.publicReports || [], chain);
    const hidden = applySlaAutoEscalate(data?.anonymousReports || [], chain);
    if (!pub.escalated && !hidden.escalated) return;
    updateCompany(company.id, (row) => {
      row.publicReports = pub.reports;
      row.anonymousReports = hidden.reports;
    });
  }, [company?.id, data?.publicReports, data?.anonymousReports, chain]);

  const picked = channelOf(channel);
  const titleOk = title.trim().length > 4;
  const bodyOk = body.trim().length > 14;
  const canSend = titleOk && bodyOk && Boolean(company?.id);
  let activeFace = ["mine", "manage"].includes(tab) && (canManage || tab !== "manage") ? tab : "mine";
  if (railSide === "employee") activeFace = "mine";
  else if (railSide === "manage" && canManage) activeFace = "manage";
  const adminVoice = canManage && railSide !== "employee";
  const tabs = railLaneTabs(canManage
    ? [
      { key: "mine", num: "01", ar: "ملفي", en: "My file" },
      { key: "manage", num: "02", ar: "إدارة", en: "Manage", count: board.openCount },
    ]
    : [
      { key: "mine", num: "01", ar: "ملفي", en: "My file", count: board.mineOpen },
    ], railSide);
  const manageSettledCount = board.settled.length;

  const pickChannel = (id) => {
    const next = channelOf(id);
    setChannel(id);
    setPrio(next.defaultPrio);
  };

  const pickFile = async (event) => {
    const next = event.target.files?.[0];
    event.target.value = "";
    if (!next) {
      setFile(null);
      return;
    }
    const hash = await sha256HexOfFile(next);
    setFile({ name: next.name, hash });
  };

  const send = () => {
    if (!company?.id) return;
    const usage = getAnonUsage(company.id, currentUser?.id);
    const limits = {
      day: data?.settings?.rateLimitDaily,
      week: data?.settings?.rateLimitWeekly,
      month: data?.settings?.rateLimitMonthly,
    };
    const stationId = resolveVoiceWorkStationId(currentUser);
    const gate = checkSubmitVoiceGate({ channel, title, message: body, usage, limits, stationId });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    const station = stations.find((row) => row.id === stationId);
    const managerId = station?.managerId;
    const notice = { outcome: "raised", channel, title: gate.title };
    if (channel === "anonymous") {
      const anonymousId = `AN-${String(Date.now()).slice(-4)}`;
      updateCompany(company.id, (row) => {
        row.anonymousReports = [
          {
            id: `an_${Date.now().toString(36)}`,
            type: "complaint",
            kind: "anonymous",
            anonymous: true,
            anonymousId,
            rateActorId: currentUser?.id || undefined,
            title: gate.title,
            message: gate.message,
            priority: prio,
            status: "open",
            stationId,
            files: file ? [file] : [],
            escalationLevel: 0,
            createdAt: now,
            replies: [],
            auditTrail: appendVoiceAudit({}, "raise", {}, { at: now, hideActor: true, level: 0 }),
          },
          ...(row.anonymousReports || []),
        ];
      });
      setAnonReceipt(anonymousId);
      if (managerId && String(managerId) !== String(currentUser?.id)) {
        addNotification(company.id, managerId, voiceDecisionNoticeText(notice, lang), { voiceNotice: notice });
      }
    } else {
      updateCompany(company.id, (row) => {
        row.publicReports = [
          {
            id: `pub_${Date.now().toString(36)}`,
            authorId: currentUser.id,
            stationId,
            type: channel === "suggestion" ? "suggestion" : "complaint",
            kind: channel === "suggestion" ? "suggestion" : "public",
            title: gate.title,
            message: gate.message,
            priority: prio,
            status: "open",
            files: file ? [file] : [],
            escalationLevel: 0,
            replies: [],
            createdAt: now,
            auditTrail: appendVoiceAudit({}, "raise", currentUser, { at: now, level: 0 }),
          },
          ...(row.publicReports || []),
        ];
      });
      setAnonReceipt("");
      if (managerId && String(managerId) !== String(currentUser?.id)) {
        addNotification(company.id, managerId, voiceDecisionNoticeText(notice, lang), { voiceNotice: notice });
      }
    }
    setTitle("");
    setBody("");
    setFile(null);
  };

  const patchVoice = (item, mutate) => {
    if (!company?.id) return;
    updateCompany(company.id, (row) => {
      const list = item.bucket === "anon" ? (row.anonymousReports || []) : (row.publicReports || []);
      const found = list.find((entry) => entry.id === item.id);
      if (found) mutate(found);
    });
  };

  const decide = (card, outcome) => {
    const close = checkCloseGate(card.item, { isHandler: canManage });
    if (!close.ok) {
      toast({ description: ar ? close.reason : close.reasonEn, variant: "destructive" });
      return;
    }
    const note = String(notes[card.item.id] || "").trim();
    if (outcome === "return") {
      const need = checkReturnNoteGate(note);
      if (!need.ok) {
        toast({ description: ar ? need.reason : need.reasonEn, variant: "destructive" });
        return;
      }
    }
    const now = new Date().toISOString();
    patchVoice(card.item, (found) => {
      found.replies = found.replies || [];
      found.replies.push({
        level: found.escalationLevel || 0,
        role: currentUser?.role,
        authorName: currentUser?.name,
        text: note || (outcome === "adopt"
          ? (card.item.channel === "anonymous" ? (ar ? "عُولِج بوقائعه." : "Handled on its facts.") : (ar ? "اعتُمد." : "Adopted."))
          : note),
        createdAt: now,
      });
      found.status = outcome === "adopt" ? "closed" : "rejected";
      found.resolution = outcome === "adopt" ? "approved" : "rejected";
      found.closedAt = now;
      found.auditTrail = appendVoiceAudit(found, outcome === "adopt" ? "adopt" : "return", currentUser, {
        at: now,
        detail: note || (outcome === "adopt"
          ? (card.item.channel === "anonymous" ? (ar ? "عُولِج بوقائعه." : "Handled on its facts.") : (ar ? "اعتُمد." : "Adopted."))
          : note),
        level: found.escalationLevel || 0,
      });
    });
    if (card.item.authorId) {
      const notice = { outcome, channel: card.item.channel, title: card.title };
      addNotification(company.id, card.item.authorId, voiceDecisionNoticeText(notice, lang), { voiceNotice: notice });
    }
    setNotes((prev) => ({ ...prev, [card.item.id]: "" }));
  };

  const escalate = (card, asAuthor = false) => {
    const gate = asAuthor
      ? checkWorkerAppealGate(card.item, chain, currentUser?.id)
      : checkEscalateGate(card.item, chain, { isHandler: canManage });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    patchVoice(card.item, (found) => {
      const fromLevel = found.escalationLevel || 0;
      found.escalationLevel = gate.nextLevel;
      found.levelSinceAt = now;
      found.status = "open";
      found.resolution = null;
      found.auditTrail = appendVoiceAudit(found, "escalate", currentUser, {
        at: now,
        level: fromLevel,
        toLevel: gate.nextLevel,
        reason: asAuthor ? "WORKER_APPEAL" : "MANUAL",
      });
    });
  };

  const dueSoon = board.open.filter((card) => card.left != null && card.left <= 24);
  const queue = board.open.filter((card) => {
    if (queueFilter === "archive") return false;
    if (queueFilter === "due") return card.left != null && card.left <= 24;
    if (queueFilter === "over") return card.overdue;
    if (queueFilter === "anon") return card.item.channel === "anonymous";
    return true;
  }).slice().sort((a, b) => Number(a.left ?? 999) - Number(b.left ?? 999));

  const queueFilters = [
    ["due", ar ? "ضاق وقتها" : "Due soon", dueSoon.length],
    ["over", ar ? "تجاوزت" : "Overdue", board.overdue.length],
    ["anon", ar ? "مجهولة" : "Anonymous", board.open.filter((card) => card.item.channel === "anonymous").length],
    ["all", ar ? "الكل" : "All", board.open.length],
    ["archive", ar ? "الأرشيف" : "Archive", manageSettledCount],
  ];

  const gates = [
    { ok: titleOk, text: titleOk ? (ar ? "العنوان مكتوب — هو ما يُقرأ في الطابور أولاً." : "The title is written — it is what the queue reads first.") : (ar ? "اكتب عنواناً مختصراً قبل الإرسال." : "Write a short title before sending.") },
    { ok: bodyOk, text: bodyOk ? (ar ? "التفصيل كافٍ للمراجعة." : "The detail is enough to review.") : (ar ? "اكتب التفصيل — بلا واقعة لا يُمكن مراجعة الصوت." : "Write the detail — a voice without an incident cannot be reviewed.") },
    {
      ok: true,
      text: channel === "anonymous"
        ? (ar ? "يُرسَل برقم مرجعي بلا هويّة، ولن يصلك ردّ شخصي — تابع قراره في أرشيف ملفي بالرقم." : "It is sent as a reference number with no identity. Follow the ruling in My file archive by that number.")
        : (ar
          ? `يُرسَل باسم ${currentUser?.name || ""} إلى ${chain[0]?.labelAr || "مدير الفرع"} · مهلة المراجعة ${VOICE_PRIOs.find((row) => row.id === prio)?.hours || picked.hours} ساعة.`
          : `Sent as ${currentUser?.name || ""} to ${chain[0]?.labelEn || "the station manager"} · review window ${VOICE_PRIOs.find((row) => row.id === prio)?.hours || picked.hours} hours.`),
    },
  ];

  return (
    <PlatformStampShell ar={ar} bare maxWidth={1320}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--nv-ink)", fontSize: 13 }}>
        <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 11, letterSpacing: ".14em", color: "var(--nv-muted)", display: "flex", gap: 7, alignItems: "center" }}>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{String(pageKicker("/app/complaints", "en")).slice(0, 2) || "06"}</span>
              <span>·</span>
              <span>{pageKicker("/app/complaints", lang).replace(/^\d+\s*·\s*/, "")}</span>
            </span>
            <span style={{ fontFamily: "'Noto Naskh Arabic',serif", fontSize: 24, fontWeight: 600 }}>{ar ? "صوت الموظف" : "Employee Voice"}</span>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
              {ar
                ? <>ثلاث قنوات لصوت واحد: <b>اقتراح</b> للتحسين باسم صاحبه · <b>شكوى</b> للمعالجة بهوية ظاهرة · <b>بلاغ مجهول</b> للحماية. القناة تحدّد الهوية والمهلة والتصعيد — لا الشكل.</>
                : <>Three channels, one voice: a <b>suggestion</b> in your name · a named <b>complaint</b> to resolve · an <b>anonymous report</b> to protect. The channel sets identity, window, and escalation — not the look.</>}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.7, maxWidth: 340 }}>
            {adminVoice
              ? (ar ? "إدارة — تراجع وتعتمد أو تُعيد بملاحظة. ما تجاوز مهلته يُرفع لمن بعدك تلقائياً، ولا يُغلق بلا قرار مكتوب." : "Management — you adopt or return with a note. What misses its window is raised to whoever follows you. Nothing closes without a written ruling.")
              : (ar ? "موظف — ترفع صوتك في القناة التي تختارها وتتابع قرارها. لا ترى أصوات غيرك، ولا تُعرف هويّتك في القناة المجهولة." : "Employee — you raise a voice on the channel you choose and follow its ruling. You do not see others' voices, and the anonymous channel does not name you.")}
          </span>
        </section>

        <div className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {tabs.map((item) => {
            const on = activeFace === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={on ? "page" : undefined}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: on ? 700 : 400,
                  padding: "9px 16px",
                  border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`,
                  background: on ? "var(--nv-btn-fill)" : "var(--nv-card)",
                  color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  borderRadius: 10,
                }}
              >
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.75 }}>{item.num}</span>
                {ar ? item.ar : item.en}
                {item.count ? (
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, background: on ? "color-mix(in oklab, var(--nv-btn-ink) 28%, transparent)" : "var(--nv-mute-soft)", color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)", padding: "1px 7px", borderRadius: 999 }}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
          <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 12, fontWeight: 600, color: board.pulseColor, background: board.pulseBg, border: `1px solid ${board.pulseBorder}`, borderRadius: 10, padding: "8px 13px", whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: board.pulseDot }} />
            {board.pulse}
          </span>
        </div>

        {activeFace === "mine" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              {[
                ["live", ar ? "ما أرسلتُه" : "What I sent", canManage ? board.mine.filter((c) => !c.settled).length : board.mineOpen],
                ["archive", ar ? "الأرشيف" : "Archive", mineSettled.length],
              ].map(([id, label, n]) => {
                const on = mineFace === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMineFace(id)}
                    style={{
                      fontFamily: "inherit",
                      fontSize: 11,
                      padding: "7px 12px",
                      border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`,
                      borderRadius: 10,
                      background: on ? "var(--nv-btn-fill)" : "var(--nv-card)",
                      color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
                      fontWeight: on ? 700 : 400,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    {label}
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.8 }}>{n}</span>
                  </button>
                );
              })}
              {canManage ? (
                <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                  {ar ? "أرشيف الإدارة بعد «الكل» في تبويب إدارة." : "Manage archive sits after All on the Manage tab."}
                </span>
              ) : null}
            </div>

            {mineFace === "archive" ? (
              <VoiceArchiveBoard
                cards={mineSettled}
                ar={ar}
                canManage={false}
                scope="mine"
              />
            ) : (
          <div className="nv-emp-summary" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
            <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "ارفع صوتك" : "Raise your voice"}</span>
                <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
                  {ar ? "اختر القناة أولاً — هي التي تحدّد هل يظهر اسمك، وكم مهلة الردّ، ولمن يُرفع إن تجاوزها." : "Choose the channel first — it sets whether your name appears, how long the reply window is, and who it is raised to if that window is missed."}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 0, borderBottom: "1px solid var(--nv-line3)" }}>
                {VOICE_CHANNELS.map((row) => {
                  const on = channel === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => pickChannel(row.id)}
                      style={{
                        fontFamily: "inherit",
                        textAlign: "start",
                        padding: "13px 15px",
                        border: "none",
                        borderInlineStart: "1px solid var(--nv-line2)",
                        borderTop: `3px solid ${on ? row.accent : "var(--nv-line3)"}`,
                        background: on ? "var(--nv-soft)" : "var(--nv-card)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: on ? 700 : 600, color: on ? "var(--nv-ink)" : "var(--nv-ink2)" }}>{ar ? row.ar : row.en}</span>
                      <span style={{ fontSize: 10, color: "var(--nv-muted)", lineHeight: 1.7 }}>{ar ? row.blurbAr : row.blurbEn}</span>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: row.color, background: row.bg, border: `1px solid ${row.border}`, padding: "2px 8px", whiteSpace: "nowrap" }}>
                          {ar ? row.identityAr : row.identityEn}
                        </span>
                        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--nv-ink2)", background: "var(--nv-mute-soft)", border: "1px solid var(--nv-mute-line)", padding: "2px 8px" }}>
                          {row.hours} {ar ? "ساعة" : "h"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: "15px 20px", background: "var(--nv-soft)", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "عنوان مختصر" : "Short title"}</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={channel === "suggestion" ? (ar ? "ما الذي تقترح تحسينه؟" : "What do you want to improve?") : channel === "complaint" ? (ar ? "ما الحقّ الذي تطلبه؟" : "What right are you claiming?") : (ar ? "ما الخطر أو التجاوز؟" : "What is the risk or the breach?")}
                      style={field}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الأولوية" : "Priority"}</span>
                    <select value={prio} onChange={(event) => setPrio(event.target.value)} style={field}>
                      {VOICE_PRIOs.map((row) => <option key={row.id} value={row.id}>{ar ? row.ar : row.en}</option>)}
                    </select>
                  </label>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "التفصيل" : "Detail"}</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={4}
                    placeholder={channel === "anonymous"
                      ? (ar ? "اكتب الواقعة بلا ما يدلّ عليك — ولا تذكر اسمك، فالبلاغ يصل برقم لا باسم." : "Write the incident without what names you — it arrives as a number, not a name.")
                      : (ar ? "الواقعة وتاريخها وأثرها على العمل." : "The incident, its date, and its effect on the work.")}
                    style={{ ...field, resize: "vertical", lineHeight: 1.9, padding: 10 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "أرفق ملفاً — اختياري" : "Attach a file — optional"}</span>
                  <AttachFileButton
                    ar={ar}
                    label={ar ? "أرفق الملف" : "Attach the file"}
                    onPick={(file) => pickFile({ target: { files: file ? [file] : [], value: "" } })}
                  />
                  <span style={{ fontSize: 10, color: file ? "var(--nv-ok-ink)" : "var(--nv-muted)", lineHeight: 1.8 }}>
                    {file
                      ? (ar ? `مرفق: ${file.name} · بصمته ${file.hash.slice(0, 16)}…` : `Attached: ${file.name} · hash ${file.hash.slice(0, 16)}…`)
                      : (channel === "anonymous"
                        ? (ar ? "تُحسب بصمته على جهازك. تجنّب ما يحمل اسمك — صورة أو مستند باسمك يكشفك." : "Its hash is taken on your device. Avoid anything that names you.")
                        : (ar ? "تُحسب بصمته على جهازك ويُحال مع صوتك كما هو." : "Its hash is taken on your device and travels with the voice as it is."))}
                  </span>
                </label>
                {gates.map((gate) => (
                  <div key={gate.text} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10, alignItems: "start" }}>
                    <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: gate.ok ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)", border: `1px solid ${gate.ok ? "var(--nv-ok-line)" : "var(--nv-warn-line)"}`, background: gate.ok ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)", marginTop: 2 }}>
                      {gate.ok ? "✓" : ""}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.85 }}>{gate.text}</span>
                  </div>
                ))}
                {anonReceipt ? (
                  <span style={{ fontSize: 12, color: "#8A1C2B", background: "#FBF1F2", border: "1px solid #E9C4C9", padding: "9px 11px", lineHeight: 1.9 }}>
                    {ar
                      ? `أُرسل بلا هويّة. رقم المتابعة ${anonReceipt} — تابع القرار في أرشيف ملفي بهذا الرقم، ولن يصلك ردّ شخصي.`
                      : `Sent with no identity. Follow-up number ${anonReceipt} — watch My file archive for that number; there is no personal reply.`}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={send}
                  style={{
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "11px 16px",
                    border: "none",
                    background: canSend ? "var(--nv-ok-fill)" : "var(--nv-line3)",
                    color: canSend ? "var(--nv-btn-ink)" : "var(--nv-muted)",
                    cursor: canSend ? "pointer" : "default",
                    alignSelf: "flex-start",
                  }}
                >
                  {!titleOk
                    ? (ar ? "اكتب العنوان" : "Write the title")
                    : (!bodyOk
                      ? (ar ? "اكتب التفصيل" : "Write the detail")
                      : (ar ? `أرسل ${picked.ar}${channel === "anonymous" ? " بلا هويّة" : " باسمك"}` : `Send ${picked.en}${channel === "anonymous" ? " with no identity" : " in your name"}`))}
                </button>
              </div>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{canManage ? (ar ? "ما أرسلتَه بنفسك" : "What you sent yourself") : (ar ? "ما أرسلتُه" : "What I sent")}</span>
                <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--nv-muted)" }}>
                  {ar
                    ? `${countAr(board.mine.length, "صوت واحد", "صوتان", "أصوات", "صوتاً", "لا شيء")}${canManage ? " — أصواتك أنت، لا ما تراجعه" : ""}`
                    : `${board.mine.length} voice(s)${canManage ? " — yours, not the queue" : ""}`}
                </span>
              </div>
              {board.mine.length === 0 ? (
                <div style={{ padding: "18px 20px", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.9 }}>
                  {canManage
                    ? (ar ? "لم ترفع صوتاً بنفسك. هذا اللوح شخصي — ما تراجعه في تبويب «إدارة». والبلاغات المجهولة لا تظهر في أي لوح شخصي." : "You have not raised a voice yourself. This board is personal — what you review sits on Manage. Anonymous reports do not appear on a personal board.")
                    : (ar ? "لا شيء بعد. ابدأ بفكرة واحدة لتحسين العمل — أو شكوى إن كان لك حقّ يُطلب. والبلاغ المجهول لا يظهر هنا، فمتابعته بالرقم في أرشيف ملفي." : "Nothing yet. Start with one idea to improve the work — or a complaint if a right is due. An anonymous report does not appear here; follow it by number in My file archive.")}
                </div>
              ) : board.mine.map((card) => (
                <article key={card.item.id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", borderInlineEnd: `3px solid ${card.accent}`, display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, lineHeight: 1.5 }}>{card.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: card.stColor, background: card.stBg, border: `1px solid ${card.stBorder}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{card.state}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.8 }}>{card.meta}</span>
                  {card.reply ? (
                    <span style={{ fontSize: 11, color: card.outcome === "adopt" ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)", background: card.outcome === "adopt" ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)", border: `1px solid ${card.outcome === "adopt" ? "var(--nv-ok-line)" : "var(--nv-warn-line)"}`, borderRadius: 10, padding: "9px 11px", lineHeight: 1.9 }}>{card.reply}</span>
                  ) : null}
                  {card.canEscalate ? (
                    <button type="button" onClick={() => escalate(card, true)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 12px", border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", alignSelf: "flex-start" }}>
                      {ar ? `لم أقتنع — ارفعه إلى ${chain[card.level + 1]?.labelAr || "المستوى التالي"}` : `I do not accept this — raise it to ${chain[card.level + 1]?.labelEn || "the next level"}`}
                    </button>
                  ) : null}
                  <VoiceAuditTrail events={card.audit} ar={ar} />
                  <VoiceRelatedLinks links={card.related} ar={ar} />
                </article>
              ))}
            </section>

            <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", fontSize: 15, fontWeight: 700 }}>
                {ar ? "ما تضمنه لك القناة" : "What the channel guarantees"}
              </div>
              {board.promises.map((row) => (
                <div key={row.tag} style={{ padding: "13px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 11, alignItems: "start" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-ink2)", background: "var(--nv-mute-soft)", border: "1px solid var(--nv-mute-line)", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", marginTop: 2 }}>{row.tag}</span>
                  <span style={{ fontSize: 11, color: "#3C4657", lineHeight: 1.9, minWidth: 0 }}>{row.t}</span>
                </div>
              ))}
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{ar ? "سلسلة المراجعة" : "Review chain"}</span>
                {board.chain.map((step) => (
                  <div key={step.num} style={{ display: "grid", gridTemplateColumns: "20px minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 18, height: 18, border: `1px solid ${step.border}`, background: step.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--nv-ink)" }}>{step.mark}</span>
                    <span style={{ fontSize: 11, fontWeight: step.weight, color: step.color, minWidth: 0 }}>{step.name}</span>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--nv-muted)" }}>{step.num}</span>
                  </div>
                ))}
                <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9, borderTop: "1px solid var(--nv-line2)", paddingTop: 9 }}>{board.chainNote}</span>
                <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.9 }}>
                  {ar
                    ? <>الاعتراض على جزاء موقَّع مسار آخر: <Link to="/app/discipline" style={{ color: "inherit" }}>الجزاءات</Link>.</>
                    : <>Objecting to a signed sanction is a different path: <Link to="/app/discipline" style={{ color: "inherit" }}>Sanctions</Link>.</>}
                </span>
              </div>
            </section>
          </div>
            )}
          </div>
        ) : null}

        {canManage && activeFace === "manage" ? (
          <>
            <div className="nv-disc-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {board.stats.map((stat) => (
                <div key={stat.lbl} className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderTop: `3px solid ${stat.accent}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{stat.lbl}</span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 28, fontWeight: 500, color: stat.accent, lineHeight: 1.05 }}>{stat.val}</span>
                    {stat.unit ? <span style={{ fontSize: 12, fontWeight: 600, color: stat.accent }}>{stat.unit}</span> : null}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>{stat.note}</span>
                </div>
              ))}
            </div>
            {queueFilter === "archive" ? (
              <>
                <div className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "طابور المراجعة" : "Review queue"}</span>
                    <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
                      {ar ? "الأرشيف بعد «الكل» — ما استقرّ في نطاق فرعك." : "Archive sits after All — settled voices in your station scope."}
                    </span>
                  </div>
                  <span style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {queueFilters.map(([id, label, n]) => {
                      const on = queueFilter === id;
                      return (
                        <button key={id} type="button" onClick={() => setQueueFilter(id)} style={{ fontFamily: "inherit", fontSize: 11, padding: "7px 12px", border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`, borderRadius: 10, background: on ? "var(--nv-btn-fill)" : "var(--nv-card)", color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)", fontWeight: on ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {label}
                          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.8 }}>{n}</span>
                        </button>
                      );
                    })}
                  </span>
                </div>
                <VoiceArchiveBoard
                  cards={board.cards}
                  ar={ar}
                  canManage
                  scope="manage"
                />
              </>
            ) : (
            <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "طابور المراجعة" : "Review queue"}</span>
                  <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
                    {ar ? "مرتّب بما ضاق وقته أولاً. تجاوز المهلة يُرفع للمدير التالي على السلسلة نفسها — لا يُهمل. الأرشيف بعد «الكل»." : "Sorted by the tightest window first. A missed window is raised to the next manager on the same chain — it is not dropped. Archive sits after All."}
                  </span>
                </div>
                <span style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {queueFilters.map(([id, label, n]) => {
                    const on = queueFilter === id;
                    return (
                      <button key={id} type="button" onClick={() => setQueueFilter(id)} style={{ fontFamily: "inherit", fontSize: 11, padding: "7px 12px", border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`, borderRadius: 10, background: on ? "var(--nv-btn-fill)" : "var(--nv-card)", color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)", fontWeight: on ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {label}
                        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.8 }}>{n}</span>
                      </button>
                    );
                  })}
                </span>
              </div>
              {queue.length === 0 ? (
                <div style={{ padding: "18px 20px", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.9 }}>
                  {queueFilter === "over"
                    ? (ar ? "لا صوت تجاوز مهلته — الطابور في وقته." : "No voice has missed its window — the queue is on time.")
                    : (ar ? "لا أصوات في هذا الترشيح." : "No voices in this filter.")}
                </div>
              ) : queue.map((card) => {
                const note = String(notes[card.item.id] || "");
                const noteReady = note.trim().length > 4;
                return (
                  <article key={card.item.id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", borderInlineEnd: `3px solid ${card.accent}`, display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 11, alignItems: "start" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: card.ch.color, background: card.ch.bg, border: `1px solid ${card.ch.border}`, padding: "2px 9px", whiteSpace: "nowrap", marginTop: 2 }}>{card.channel}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{card.title}</span>
                        <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.8 }}>{card.meta}{card.body ? ` · ${card.body}` : ""}</span>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 10, color: "var(--nv-muted)" }}>{card.slaLabel}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: card.slaColor }}>{card.slaVal}</span>
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: card.tierColor, background: card.tierBg, border: `1px solid ${card.tierBorder}`, padding: "2px 9px", whiteSpace: "nowrap", marginTop: 2 }}>{card.tier}</span>
                    </div>
                    <div style={{ display: "flex", gap: 0, flexWrap: "wrap", border: "1px solid var(--nv-line3)" }}>
                      {card.steps.map((step) => (
                        <span key={step.name} style={{ flex: "1 1 120px", minWidth: 0, padding: "7px 10px", borderInlineStart: "1px solid var(--nv-line3)", background: step.bg, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: step.color, lineHeight: 1.5 }}>{step.name}</span>
                          <span style={{ fontSize: 9, color: "var(--nv-muted)", lineHeight: 1.6 }}>{step.when}</span>
                        </span>
                      ))}
                    </div>
                    {card.item.channel === "anonymous" ? (
                      <span style={{ fontSize: 11, color: "#8A1C2B", background: "#FBF1F2", border: "1px solid #E9C4C9", padding: "9px 11px", lineHeight: 1.9 }}>
                        {ar
                          ? `بلاغ مجهول: لا تُطلب هويّة مُبلِّغه ولا يُراسَل شخصياً. يُعالَج بوقائعه، ويُنشر قراره بالرقم ${card.item.anonymousId}.`
                          : `Anonymous: the reporter is not named or written to. It is handled on its facts, and the ruling is published under ${card.item.anonymousId}.`}
                      </span>
                    ) : null}
                    <input
                      value={note}
                      onChange={(event) => setNotes((prev) => ({ ...prev, [card.item.id]: event.target.value }))}
                      placeholder={card.item.channel === "anonymous"
                        ? (ar ? "حيثيات القرار — تُنشر بالرقم لا بمخاطبة شخصية" : "Ruling reasons — published by number, not as a personal letter")
                        : (ar ? "الملاحظة التي تصل صاحب الصوت — إلزامية للإعادة" : "The note the author sees — required to return")}
                      style={field}
                    />
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" onClick={() => decide(card, "adopt")} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 13px", whiteSpace: "nowrap", ...actionStyle("go") }}>
                        {card.item.channel === "anonymous" ? (ar ? "عالِج البلاغ" : "Handle the report") : (ar ? "اعتمد" : "Adopt")}
                      </button>
                      <button type="button" onClick={() => decide(card, "return")} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 13px", whiteSpace: "nowrap", ...actionStyle("plain", !noteReady) }}>
                        {noteReady ? (ar ? "أَعِد بملاحظة" : "Return with a note") : (ar ? "الإعادة تحتاج ملاحظة" : "A return needs a note")}
                      </button>
                      <button type="button" onClick={() => escalate(card)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 13px", whiteSpace: "nowrap", ...actionStyle("plain", card.atTop) }}>
                        {card.atTop ? (ar ? "بلغ آخر السلسلة" : "End of the chain") : (ar ? `صعّد إلى ${chain[card.level + 1]?.labelAr || "التالي"}` : `Raise to ${chain[card.level + 1]?.labelEn || "next"}`)}
                      </button>
                    </div>
                    <VoiceAuditTrail events={card.audit} ar={ar} />
                    <VoiceRelatedLinks links={card.related} ar={ar} />
                  </article>
                );
              })}
              <div style={{ padding: "13px 20px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.95 }}>
                {ar
                  ? "كل إجراء يُقيَّد في مسار القرار بوقته. صاحب الصوت المسمّى يرى من قرّر؛ والبلاغ المجهول يُعرض مساره بلا اسم المراجع إلا للإدارة. والإعادة بملاحظة تحتاج نصّاً مكتوباً."
                  : "Every action is written on the decision path with its time. The named author sees who ruled; an anonymous path hides the reviewer's name except from management. A return needs a written note."}
              </div>
            </section>
            )}
          </>
        ) : null}
      </div>
    </PlatformStampShell>
  );
}
