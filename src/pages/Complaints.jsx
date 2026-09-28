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
import { getRoleLabel } from "@/lib/roles";
import {
  channelOf,
  collectVoiceItems,
  deriveVoiceBoard,
  voiceDecisionNoticeText,
} from "@/lib/voiceBoard";
import VoiceArchiveBoard from "@/components/complaints/VoiceArchiveBoard";
import VoiceAuditTrail from "@/components/complaints/VoiceAuditTrail";
import VoiceChainBoard from "@/components/complaints/VoiceChainBoard";
import VoiceGuaranteeList from "@/components/complaints/VoiceGuaranteeList";
import VoiceLawPanel from "@/components/complaints/VoiceLawPanel";
import VoiceMineBoard from "@/components/complaints/VoiceMineBoard";
import VoiceRaiseCard from "@/components/complaints/VoiceRaiseCard";
import VoiceRelatedLinks from "@/components/complaints/VoiceRelatedLinks";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { railLaneTabs, useRailSide } from "@/lib/railSide";

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "9px 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

function actionStyle(kind, off) {
  if (off) return { background: "var(--nv-card)", color: "var(--nv-muted)", border: "1px solid var(--nv-line)", borderRadius: 999, cursor: "default" };
  if (kind === "go") return { background: "#3C7D50", color: "#fff", border: "1px solid #3C7D50", borderRadius: 999, cursor: "pointer" };
  return { background: "var(--nv-card)", color: "var(--nv-ink)", border: "1px solid var(--nv-line)", borderRadius: 999, cursor: "pointer" };
}

export default function Complaints() {
  const { lang, t } = useI18n();
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
  const [topicId, setTopicId] = useState("wage");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [want, setWant] = useState("");
  const [wit, setWit] = useState(false);
  const [ack, setAck] = useState(false);
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
  const titleOk = title.trim().length >= 6;
  const bodyOk = body.trim().length >= 15;
  const dateOk = channel === "suggestion" || /^\d{4}-\d{2}-\d{2}$/.test(when);
  const wantOk = want.trim().length > 0;
  const ackOk = channel === "anonymous" || ack;
  const canSend = titleOk && bodyOk && dateOk && wantOk && ackOk && Boolean(company?.id);
  const firstTier = ar ? (chain[0]?.labelAr || "مدير الفرع") : (chain[0]?.labelEn || "the station manager");
  const roleLabel = currentUser?.role ? getRoleLabel(company, currentUser.role, t) : "";
  const reporter = channel === "anonymous"
    ? (ar ? "يصل برقم — لا يُسجَّل اسمك" : "It arrives as a number — your name is not stored")
    : `${currentUser?.name || "—"} · ${roleLabel || "—"}`;
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
    const voiceFields = {
      topicId,
      requestText: want.trim(),
      witnesses: wit,
      incidentDate: channel === "suggestion" ? "" : when,
    };
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
            ...voiceFields,
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
            voiceRef: `VO-${String(Date.now()).slice(-4)}`,
            title: gate.title,
            message: gate.message,
            priority: prio,
            status: "open",
            acknowledged: true,
            files: file ? [file] : [],
            ...voiceFields,
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
    setWhen("");
    setWant("");
    setWit(false);
    setAck(false);
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

  const checks = [
    { ok: titleOk, text: ar ? "عنوان يُقرأ في الطابور (6 أحرف على الأقل)" : "A title the queue can read (at least 6 characters)" },
    { ok: bodyOk, text: ar ? "الواقعة مكتوبة بتفصيل كافٍ" : "The incident is written in enough detail" },
    { ok: dateOk, text: channel === "suggestion" ? (ar ? "التاريخ غير لازم للاقتراح" : "A date is not required for a suggestion") : (ar ? "تاريخ الواقعة محدّد" : "The incident date is set") },
    { ok: wantOk, text: ar ? "ما تطلبه واضح" : "What you are asking for is clear" },
    { ok: ackOk, text: channel === "anonymous" ? (ar ? "بلا هويّة — لا إقرار" : "No identity — no acknowledgement") : (ar ? "أقررت بصحة ما كتبت" : "You confirmed what you wrote") },
  ];
  const submitText = canSend
    ? (ar ? `أرسل ${picked.ar} إلى ${firstTier}` : `Send ${picked.en} to ${firstTier}`)
    : (ar ? `أكمل البنود لإرسال ${picked.ar}` : `Complete the items to send ${picked.en}`);
  const slaLine = ar
    ? `المهلة ${picked.hours} ساعة. ما لا يُراجع فيها يُرفع للمدير التالي تلقائياً، ولا يُغلق بلا قرار مكتوب.`
    : `The window is ${picked.hours} hours. What is not reviewed in time is raised to the next manager, and nothing closes without a written ruling.`;
  const mineBreaches = board.mine.filter((card) => card.overdue).length;

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/complaints", lang)}
      title={ar ? "صوت الموظف" : "Employee Voice"}
      hint={ar
        ? <>ثلاث قنوات لصوت واحد: <b>اقتراح</b> للتحسين باسم صاحبه · <b>شكوى</b> للمعالجة بهوية ظاهرة · <b>بلاغ مجهول</b> للحماية. القناة تحدّد الهوية والمهلة والتصعيد — لا الشكل.</>
        : <>Three channels, one voice: a <b>suggestion</b> in your name · a named <b>complaint</b> to resolve · an <b>anonymous report</b> to protect. The channel sets identity, window, and escalation — not the look.</>}
      viewNote={adminVoice
        ? (ar ? "إدارة — تراجع وتعتمد أو تُعيد بملاحظة. ما تجاوز مهلته يُرفع لمن بعدك تلقائياً، ولا يُغلق بلا قرار مكتوب." : "Management — you adopt or return with a note. What misses its window is raised to whoever follows you. Nothing closes without a written ruling.")
        : (ar ? "موظف — ترفع صوتك في القناة التي تختارها وتتابع قرارها. لا ترى أصوات غيرك، ولا تُعرف هويّتك في القناة المجهولة." : "Employee — you raise a voice on the channel you choose and follow its ruling. You do not see others' voices, and the anonymous channel does not name you.")}
      tabs={tabs.map((item) => ({ value: item.key, label: ar ? item.ar : item.en, count: item.count }))}
      tool={activeFace}
      onTool={setTab}
      meta={(
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 12, fontWeight: 600, color: board.pulseColor, background: board.pulseBg, border: `1px solid ${board.pulseBorder}`, borderRadius: 999, padding: "6px 12px", whiteSpace: "nowrap" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: board.pulseDot }} />
          {board.pulse}
        </span>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--nv-ink)", fontSize: 13 }}>

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
                      borderRadius: 999,
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
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, alignItems: "start" }}>
                  <VoiceRaiseCard
                    ar={ar}
                    channel={channel}
                    onChannel={pickChannel}
                    topicId={topicId}
                    onTopic={setTopicId}
                    title={title}
                    onTitle={setTitle}
                    body={body}
                    onBody={setBody}
                    when={when}
                    onWhen={setWhen}
                    want={want}
                    onWant={setWant}
                    wit={wit}
                    onWit={() => setWit((value) => !value)}
                    ack={ack}
                    onAck={() => setAck((value) => !value)}
                    file={file}
                    onFile={(next) => pickFile({ target: { files: next ? [next] : [], value: "" } })}
                    checks={checks}
                    canSend={canSend}
                    onSend={send}
                    submitText={submitText}
                    slaLine={slaLine}
                    reporter={reporter}
                    channelRow={picked}
                    receipt={anonReceipt ? (ar
                      ? `أُرسل بلا هويّة. رقم المتابعة ${anonReceipt} — تابع القرار في الأرشيف بهذا الرقم، ولن يصلك ردّ شخصي.`
                      : `Sent with no identity. Follow-up number ${anonReceipt} — watch the archive for that number; there is no personal reply.`) : ""}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                    <VoiceMineBoard cards={board.mine} chain={chain} ar={ar} onEscalate={(card) => escalate(card, true)} />
                    <VoiceGuaranteeList rows={board.promises} ar={ar} />
                  </div>
                </div>
                <VoiceChainBoard chain={board.chain} note={board.chainNote} ar={ar} />
                <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                  {ar
                    ? <>الاعتراض على جزاء موقَّع مسار آخر: <Link to="/app/discipline" style={{ color: "inherit" }}>الجزاءات</Link>.</>
                    : <>Objecting to a signed sanction is a different path: <Link to="/app/discipline" style={{ color: "inherit" }}>Sanctions</Link>.</>}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {canManage && activeFace === "manage" ? (
          <>
            <div className="nv-disc-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {board.stats.map((stat) => (
                <div key={stat.lbl} className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, borderTop: `3px solid ${stat.accent}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
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
                        <button key={id} type="button" onClick={() => setQueueFilter(id)} style={{ fontFamily: "inherit", fontSize: 11, padding: "7px 12px", border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`, borderRadius: 999, background: on ? "var(--nv-btn-fill)" : "var(--nv-card)", color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)", fontWeight: on ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", gap: 6, alignItems: "center" }}>
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
            <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                      <button key={id} type="button" onClick={() => setQueueFilter(id)} style={{ fontFamily: "inherit", fontSize: 11, padding: "7px 12px", border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`, borderRadius: 999, background: on ? "var(--nv-btn-fill)" : "var(--nv-card)", color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)", fontWeight: on ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", gap: 6, alignItems: "center" }}>
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
                      <span style={{ fontSize: 11, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-line)", padding: "9px 11px", lineHeight: 1.9 }}>
                        {ar
                          ? `بلاغ مجهول: لا تُطلب هويّة مُبلِّغه ولا يُراسَل شخصياً. يُعالَج بوقائعه، ويُنشر قراره بالرقم ${card.item.anonymousId || "—"}.`
                          : `Anonymous: the reporter is not named or written to. It is handled on its facts, and the ruling is published under ${card.item.anonymousId || "—"}.`}
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
                        {ar ? "اعتماد بقرار مكتوب" : "Adopt with a written ruling"}
                      </button>
                      <button type="button" onClick={() => decide(card, "return")} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 13px", whiteSpace: "nowrap", ...actionStyle("plain", !noteReady) }}>
                        {noteReady ? (ar ? "أَعِد بملاحظة" : "Return with a note") : (ar ? "الإعادة تحتاج ملاحظة" : "A return needs a note")}
                      </button>
                      <button type="button" onClick={() => escalate(card)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "8px 13px", whiteSpace: "nowrap", ...actionStyle("plain", card.atTop) }}>
                        {card.atTop ? (ar ? "بلغ آخر السلسلة" : "End of the chain") : (ar ? "صعّد للمستوى التالي" : "Escalate to the next level")}
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

        <VoiceLawPanel ar={ar} breached={activeFace === "manage" ? board.overdue.length : mineBreaches} />
      </div>
    </SuiteWorkspaceFrame>
  );
}
