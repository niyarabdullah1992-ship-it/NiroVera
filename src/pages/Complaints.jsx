import React, { useEffect, useMemo, useState } from "react";
import FigureRow from "@/components/shared/FigureRow";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany, addNotification, getAnonUsage } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import { hasHRPermission } from "@/lib/permissions";
import { branchReviewTiers } from "@/lib/branchChain";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { pageKicker } from "@/lib/moduleMeta";
import { sha256HexOfFile } from "@/lib/fileHash";
import {
  appendVoiceAudit,
  applySlaAutoEscalate,
  resolveVoiceWorkStationId,
  checkCloseGate,
  checkEscalateGate,
  checkReturnNoteGate, checkAdoptNoteGate, firstReviewLevel, checkSelfReviewGate,
  checkSubmitVoiceGate,
  checkWorkerAppealGate,
  defaultEscalationChain,
  deriveEscalationChain,
} from "@/lib/complaintDerivations";
import { getRoleLabel } from "@/lib/roles";
import { voicePublicId,
  ABUSE_VOICE_CHANNEL,
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
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import VoiceMineBoard from "@/components/complaints/VoiceMineBoard";
import VoiceQueueList from "@/components/complaints/VoiceQueueList";
import VoiceDecisionCard from "@/components/complaints/VoiceDecisionCard";
import VoiceRaiseCard from "@/components/complaints/VoiceRaiseCard";
import VoiceRelatedLinks from "@/components/complaints/VoiceRelatedLinks";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import AbuseCaseRaise from "@/components/complaints/AbuseCaseRaise";
import AbuseCasesBoard from "@/components/complaints/AbuseCasesBoard";
import { ABUSE_STEPS, ABUSE_KINDS, abuseStepIndex } from "@/lib/abuseComplaint";
import {
  canHandleHrVoice,
  canRunAbuseCase,
  filterAbuseCasesForViewer,
  filterVoiceForViewer,
  hrVoiceChain,
  isHrOnlyVoice,
  isVoiceHrReceiver,
  namedComplaintChain,
  voiceChainFor,
  voiceHrReceivers,
} from "@/lib/voicePrivacy";
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

const fmtDay = (iso) => String(iso || "").slice(0, 10) || "—";

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
  // HR / the administration receive the HR-only channels (suggestion, confidential, harassment).
  const hrReceiver = isVoiceHrReceiver(currentUser, data);
  const canManage = Boolean(currentUser && (
    hrReceiver
    || data?.ownerId === currentUser.id
    || ["director", "ops_manager", "pgm", "station_manager"].includes(currentUser.role)
    || hasHRPermission(currentUser, data, "view_anonymous_reports")
    || hasHRPermission(currentUser, data, "manage_anonymous_reports")
  ));
  // الشكوى الجهرية: the same ladder as المهام — the branch line from the org — closing at HR.
  const chain = useMemo(() => {
    const tiers = namedComplaintChain(branchReviewTiers(data, currentUser?.stationId), data);
    if (tiers.length) return tiers;
    const ids = data?.complaintEscalationChain || [];
    if (ids.length) return deriveEscalationChain(ids, employees);
    const home = stations.find((row) => String(row.id) === String(currentUser?.stationId))
      || stations.find((row) => row.managerId)
      || stations[0];
    const named = employees.find((row) => String(row.id) === String(home?.managerId))?.name
      || employees.find((row) => row.role === "station_manager")?.name;
    return defaultEscalationChain(named);
  }, [data, employees, stations, currentUser?.stationId]);

  // The ladder a voice climbs is its own branch's — the same people المهام routes to.
  const stationOfVoice = (item) => {
    if (item?.stationId) return String(item.stationId);
    const author = employees.find((row) => String(row.id) === String(item?.authorId));
    return String(author?.stationId || "");
  };
  // Suggestion / confidential complaint: the single HR tier — no ladder, never the manager.
  const hrChain = useMemo(() => hrVoiceChain(data), [data]);
  const chainFor = (item) => {
    if (isHrOnlyVoice(item)) return hrChain;
    const tiers = voiceChainFor(item, branchReviewTiers(data, stationOfVoice(item)), data);
    return tiers.length ? tiers : chain;
  };
  /** Only the people on the voice's ladder, from its current level up, rule on it (owner/admin always). */
  const isVoiceReviewer = (item) => {
    if (!currentUser) return false;
    if (isHrOnlyVoice(item)) return canHandleHrVoice(item, currentUser, data);
    if (currentUser.isOwner || currentUser.role === "owner" || currentUser.role === "admin" || String(data?.ownerId || "") === String(currentUser.id)) return true;
    const tiers = chainFor(item);
    if (!tiers.some((tier) => (tier.handlerIds || []).length)) return canManage;
    const level = Math.max(0, Number(item?.escalationLevel) || 0);
    return tiers.slice(level).some((tier) => tier.handlerIds.includes(String(currentUser.id)));
  };

  // The privacy layer first: what this viewer may see at all (HR-only channels → HR or the author).
  const allItems = useMemo(
    () => filterVoiceForViewer(collectVoiceItems({ publicReports: data?.publicReports, anonymousReports: data?.anonymousReports }), currentUser, data),
    [data?.publicReports, data?.anonymousReports, data?.employees, data?.hrLevels, currentUser?.id],
  );
  const queueItems = useMemo(() => {
    if (!canManage) return undefined;
    return allItems.filter((item) => {
      if (isHrOnlyVoice(item) && !canHandleHrVoice(item, currentUser, data)) return false;
      const author = employees.find((row) => String(row.id) === String(item.authorId));
      return matchesStationScope(item.stationId || author?.stationId, stationScope);
    });
  }, [allItems, canManage, employees, stationScope, currentUser?.id]);

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
      chainFor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, queueItems, employees, stations, ar, canManage, currentUser?.id, currentUser?.stationId, chain, data?.branchEscalationChains, data?.orgTree, data?.stations],
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
  // ?channel=abuse (old طلباتي links) opens the harassment form.
  const [channel, setChannel] = useState(() => (["suggestion", "complaint", "anonymous", "abuse"].includes(searchParams.get("channel")) ? searchParams.get("channel") : "suggestion"));
  const asked = searchParams.get("channel");
  useEffect(() => {
    if (["suggestion", "complaint", "anonymous", "abuse"].includes(asked)) setChannel(asked);
  }, [asked]);
  const [pickedId, setPickedId] = useState("");
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
    const run = (list) => {
      let escalated = 0;
      const reports = list.map((r) => {
        const res = applySlaAutoEscalate([r], chainFor(r));
        escalated += res.escalated || 0;
        return (res.reports || [r])[0];
      });
      return { reports, escalated };
    };
    const pub = run(data?.publicReports || []);
    const hidden = run(data?.anonymousReports || []);
    if (!pub.escalated && !hidden.escalated) return;
    updateCompany(company.id, (row) => {
      row.publicReports = pub.reports;
      row.anonymousReports = hidden.reports;
    });
  }, [company?.id, data?.publicReports, data?.anonymousReports, chain]);

  const hrOnlyPicked = channel !== "complaint";
  const picked = channel === "abuse" ? ABUSE_VOICE_CHANNEL : channelOf(channel);
  const me = employees.find((row) => String(row.id) === String(currentUser?.id)) || currentUser;
  // Abuse cases: HR runs them; a named committee member sees his; the filer follows his own.
  const visibleAbuse = useMemo(() => filterAbuseCasesForViewer(data?.abuseCases || [], currentUser, data), [data, currentUser]);
  const runAbuse = visibleAbuse.filter((row) => canRunAbuseCase(row, currentUser, data));
  const sitAbuse = visibleAbuse.filter((row) => !canRunAbuseCase(row, currentUser, data)
    && String(row.reporterId || row.userId) !== String(currentUser?.id));
  const myAbuse = visibleAbuse.filter((row) => String(row.reporterId || row.userId) === String(currentUser?.id));
  const openAbuseCount = runAbuse.filter((row) => !["decided", "closed"].includes(String(row.status || ""))).length;
  const titleOk = title.trim().length >= 6;
  const bodyOk = body.trim().length >= 15;
  const dateOk = channel === "suggestion" || /^\d{4}-\d{2}-\d{2}$/.test(when);
  const wantOk = want.trim().length > 0;
  const ackOk = channel === "anonymous" || ack;
  const canSend = titleOk && bodyOk && dateOk && wantOk && ackOk && Boolean(company?.id);
  const homeManagerId = stations.find((row) => row.id === resolveVoiceWorkStationId(currentUser))?.managerId;
  const startTier = hrOnlyPicked ? hrChain[0] : (chain[firstReviewLevel(chain, currentUser?.id, homeManagerId)] || chain[0]);
  const firstTier = hrOnlyPicked
    ? (ar ? "الموارد البشرية" : "HR")
    : (ar ? (startTier?.labelAr || "مدير الفرع") : (startTier?.labelEn || "the station manager"));
  const roleLabel = currentUser?.role ? getRoleLabel(company, currentUser.role, t) : "";
  const reporter = channel === "anonymous"
    ? (ar ? "يصل برقم — لا يُسجَّل اسمك" : "It arrives as a number — your name is not stored")
    : `${currentUser?.name || "—"} · ${roleLabel || "—"}`;
  let activeFace = ["mine", "manage"].includes(tab) && (canManage || tab !== "manage") ? tab : "mine";
  if (railSide === "employee") activeFace = "mine";
  else if (railSide === "manage" && canManage) activeFace = "manage";
  const tabs = railLaneTabs(canManage
    ? [
      { key: "mine", num: "01", ar: "ملفي", en: "My file" },
      { key: "manage", num: "02", ar: "إدارة", en: "Manage", count: board.openCount + openAbuseCount },
    ]
    : [
      { key: "mine", num: "01", ar: "ملفي", en: "My file", count: board.mineOpen },
    ], railSide);
  const manageSettledCount = board.settled.length;

  const pickChannel = (id) => {
    const next = id === "abuse" ? ABUSE_VOICE_CHANNEL : channelOf(id);
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
    if (!company?.id || channel === "abuse") return;
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
    // HR-only channels sit at the single HR tier; only the open complaint starts at the manager.
    const startLevel = hrOnlyPicked ? 0 : firstReviewLevel(chain, currentUser?.id, managerId);
    const notice = { outcome: "raised", channel, title: gate.title };
    const tellReceivers = () => {
      if (hrOnlyPicked) {
        // Never the manager: the notice goes to HR / the administration only.
        for (const hr of voiceHrReceivers(data, { exclude: [currentUser?.id], item: { stationId } })) {
          addNotification(company.id, hr.id, voiceDecisionNoticeText(notice, lang), { voiceNotice: notice, to: "/app/complaints?tab=manage" });
        }
        return;
      }
      if (managerId && String(managerId) !== String(currentUser?.id)) {
        addNotification(company.id, managerId, voiceDecisionNoticeText(notice, lang), { voiceNotice: notice });
      }
    };
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
            escalationLevel: startLevel,
            reviewStartLevel: startLevel,
            levelSinceAt: now,
            createdAt: now,
            replies: [],
            auditTrail: appendVoiceAudit({}, "raise", {}, { at: now, hideActor: true, level: startLevel }),
          },
          ...(row.anonymousReports || []),
        ];
      });
      setAnonReceipt(anonymousId);
      tellReceivers();
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
            escalationLevel: startLevel,
            reviewStartLevel: startLevel,
            levelSinceAt: now,
            replies: [],
            createdAt: now,
            auditTrail: appendVoiceAudit({}, "raise", currentUser, { at: now, level: startLevel }),
          },
          ...(row.publicReports || []),
        ];
      });
      setAnonReceipt("");
      tellReceivers();
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
    if (!isVoiceReviewer(card.item)) {
      const tier = chainFor(card.item)[Math.max(0, Number(card.item?.escalationLevel) || 0)];
      toast({
        description: ar
          ? `هذا الصوت عند ${tier?.labelAr || "مستوى آخر"} في سلسلة فرعه — يقرّر فيه من في السلسلة من مستواه فما فوق.`
          : `This voice is with ${tier?.labelEn || "another level"} on its branch ladder — only people at that level or above rule on it.`,
        variant: "destructive",
      });
      return;
    }
    const close = checkCloseGate(card.item, { isHandler: canManage });
    if (!close.ok) {
      toast({ description: ar ? close.reason : close.reasonEn, variant: "destructive" });
      return;
    }
    const self = checkSelfReviewGate(card.item, currentUser?.id);
    if (!self.ok) {
      toast({ description: ar ? self.reason : self.reasonEn, variant: "destructive" });
      return;
    }
    const note = String(notes[card.item.id] || "").trim();
    if (outcome === "adopt") {
      const need = checkAdoptNoteGate(note);
      if (!need.ok) {
        toast({ description: ar ? need.reason : need.reasonEn, variant: "destructive" });
        return;
      }
    }
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
      ? checkWorkerAppealGate(card.item, chainFor(card.item), currentUser?.id)
      : checkEscalateGate(card.item, chainFor(card.item), { isHandler: isVoiceReviewer(card.item) });
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
    ...(hrReceiver ? [["anon", ar ? "سرية" : "Confidential", board.open.filter((card) => card.item.channel === "anonymous").length]] : []),
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
  const slaLine = hrOnlyPicked
    ? (ar
      ? `المهلة ${picked.hours} ساعة لدى الموارد البشرية — بلا تصعيد ولا مرور بمديرك، ولا تُغلق بلا قرار مكتوب.`
      : `The window is ${picked.hours} hours with HR — no ladder, never via your manager; nothing closes without a written ruling.`)
    : (ar
      ? `المهلة ${picked.hours} ساعة عند كل مستوى. ما لا يُراجع فيها يُرفع للمستوى التالي تلقائياً حتى الموارد البشرية، ولا يُغلق بلا قرار مكتوب.`
      : `The window is ${picked.hours} hours at each level. What is not reviewed in time climbs automatically up to HR, and nothing closes without a written ruling.`);
  const mineBreaches = board.mine.filter((card) => card.overdue).length;

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/complaints", lang)}
      title={ar ? "صوت الموظف" : "Employee Voice"}
      hint={ar
        ? "قل ما يحسّن العمل أو ما يضرّك، وتابع قراره حتى يُكتب. القناة تحدّد الهوية والمهلة والتصعيد."
        : "Say what would improve work or what harms you, and follow it to a written ruling. The channel sets identity, window and escalation."}
      // The rail already picks the lane (الموظف / الإدارة) and carries the open count, so a
      // single-lane tab plus its note only repeated it — shown only when more than one lane remains.
      tabs={tabs.length > 1 ? tabs.map((item) => ({ value: item.key, label: ar ? item.ar : item.en, count: item.count })) : []}
      tool={activeFace}
      onTool={setTab}
      meta={activeFace !== "manage" ? null : (
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
                    abuseSlot={channel === "abuse" ? (
                      <AbuseCaseRaise employee={me} companyId={company?.id} ar={ar} onSent={() => setMineFace("live")} />
                    ) : null}
                    receipt={anonReceipt ? (ar
                      ? `أُرسل بلا هويّة إلى الموارد البشرية. رقم المتابعة ${anonReceipt} — تتابع قراره في ملفك بهذا الرقم.`
                      : `Sent with no identity. Follow-up number ${anonReceipt} — watch the archive for that number; there is no personal reply.`) : ""}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                    {/* Settled voices live in «الأرشيف» only; each open card already carries its chain. */}
                    <VoiceMineBoard cards={board.mine.filter((card) => !card.settled)} chain={chain} ar={ar} onEscalate={(card) => escalate(card, true)} />
                    {myAbuse.length ? (
                      <section data-abuse-mine="" className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 10 }}>
                        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--nv-line)", fontSize: 13, fontWeight: 700 }}>
                          {ar ? `شكاوى التحرش أو الإيذاء · ${myAbuse.length}` : `Harassment or abuse complaints · ${myAbuse.length}`}
                        </div>
                        {myAbuse.map((row) => {
                          const kind = ABUSE_KINDS.find((k) => k.id === row.kind);
                          const step = ABUSE_STEPS[abuseStepIndex(row)] || ABUSE_STEPS[0];
                          return (
                            <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "9px 14px", borderBottom: "1px solid var(--nv-line2)", fontSize: 12.5 }}>
                              <span style={{ minWidth: 0 }}>{ar ? kind?.ar : kind?.en} · {fmtDay(row.filedAt)}</span>
                              <span style={{ fontWeight: 700, color: "var(--nv-ok-ink)" }}>{ar ? step.ar : step.en}</span>
                            </div>
                          );
                        })}
                        <div style={{ padding: "8px 14px", fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "تصل إلى الموارد البشرية فقط — لا يراها مديرك." : "HR only — your manager does not see it."}</div>
                      </section>
                    ) : null}
                    {sitAbuse.length ? (
                      <AbuseCasesBoard data={data} companyId={company?.id} ar={ar} by={currentUser?.name || ""} cases={sitAbuse} committeeMemberId={String(currentUser?.id || "")} canRun={false} />
                    ) : null}
                    {/* The channel promises are on the channel tiles; only the two shared guarantees stay. */}
                    <VoiceGuaranteeList rows={board.promises.slice(-2)} ar={ar} />
                  </div>
                </div>
                {board.mine.some((card) => !card.settled) ? null : (hrOnlyPicked
                  ? <VoiceChainBoard chain={[{ num: "01", name: ar ? "الموارد البشرية" : "Human Resources", mark: "check", bg: "var(--nv-ok-ink)", border: "var(--nv-ok-ink)", color: "var(--nv-ink)", weight: 700 }]} note={ar ? "يصل إلى الموارد البشرية وحدها، بلا تصعيد ولا مرور بمديرك أو مدير الفرع." : "It reaches HR alone — no ladder, never via your manager or the branch manager."} ar={ar} />
                  : <VoiceChainBoard chain={board.chain} note={board.chainNote} ar={ar} />)}
                <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                  {ar
                    ? <>التظلّم من قرار أو إجراء أو جزاء مسار آخر: <Link to="/app/discipline?tab=mine&raise=grievance" style={{ color: "inherit" }}>الجزاءات</Link>.</>
                    : <>A grievance on a decision, action or sanction is a different path: <Link to="/app/discipline?tab=mine&raise=grievance" style={{ color: "inherit" }}>Sanctions</Link>.</>}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {canManage && activeFace === "manage" ? (
          <>
            {hrReceiver && runAbuse.length ? (
              <AbuseCasesBoard data={data} companyId={company?.id} ar={ar} by={currentUser?.name || ""} cases={runAbuse} />
            ) : null}
            <FigureRow
              ar={ar}
              figures={board.stats.filter((stat) => hrReceiver || stat.id !== "anon").map((stat, i) => ({
                key: `voice-${i}`,
                label: stat.lbl,
                value: stat.val,
                suffix: stat.unit || "",
                hint: stat.note,
                tone: stat.tone,
                flag: stat.flag,
              }))}
            />
            <div className="nv-paper" data-voice-queue="1" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              {queueFilters.map(([id, label, n]) => {
                const on = queueFilter === id;
                return (
                  <button key={id} type="button" onClick={() => setQueueFilter(id)} style={{ fontFamily: "inherit", fontSize: 11, padding: "7px 12px", border: `1px solid ${on ? "var(--nv-btn-fill)" : "var(--nv-line)"}`, borderRadius: 999, background: on ? "var(--nv-btn-fill)" : "var(--nv-card)", color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)", fontWeight: on ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {label}
                    <span dir="ltr" style={{ fontSize: 10, opacity: 0.8 }}>{n}</span>
                  </button>
                );
              })}
              <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                {ar ? "ما يتجاوز مهلته يُرفع تلقائياً للمستوى التالي." : "What misses its window goes up the chain automatically."}
              </span>
            </div>
            {queueFilter === "archive" ? (
              <VoiceArchiveBoard cards={board.cards} ar={ar} canManage scope="manage" />
            ) : (() => {
              const picked = queue.find((card) => String(card.item.id) === String(pickedId)) || queue[0] || null;
              const note = picked ? String(notes[picked.item.id] || "") : "";
              const noteReady = note.trim().length > 4;
              const ownVoice = picked ? !checkSelfReviewGate(picked.item, currentUser?.id).ok : false;
              return (
                <div data-voice-manage-grid="1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, alignItems: "start" }}>
                  <VoiceDecisionCard
                    card={picked}
                    ar={ar}
                    note={note}
                    onNote={(value) => picked && setNotes((prev) => ({ ...prev, [picked.item.id]: value }))}
                    noteReady={noteReady}
                    ownVoice={ownVoice}
                    onAdopt={() => picked && decide(picked, "adopt")}
                    onReturn={() => picked && decide(picked, "return")}
                    onEscalate={() => picked && escalate(picked)}
                  />
                  <VoiceQueueList
                    cards={queue}
                    selectedId={picked?.item.id}
                    onPick={setPickedId}
                    ar={ar}
                    emptyText={queueFilter === "over"
                      ? (ar ? "لا صوت تجاوز مهلته — الطابور في وقته." : "No voice has missed its window — the queue is on time.")
                      : (ar ? "لا أصوات في هذا الترشيح." : "No voices in this filter.")}
                  />
                </div>
              );
            })()}
          </>
        ) : null}

        <VoiceLawPanel
          ar={ar}
          lane={activeFace === "manage" ? "manage" : "employee"}
          breached={activeFace === "manage" ? board.overdue.length : mineBreaches}
          abuseCases={activeFace === "manage" ? runAbuse : myAbuse}
          calendar={laborCalendarOf(data)}
        />
      </div>
    </SuiteWorkspaceFrame>
  );
}
