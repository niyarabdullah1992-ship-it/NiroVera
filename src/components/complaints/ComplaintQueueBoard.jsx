import React, { useEffect, useState } from "react";
import { ArrowUpCircle, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  checkCloseGate,
  checkEscalateGate,
  deriveComplaintStats,
  matchesVoiceChannel,
} from "@/lib/complaintDerivations";
import { matchesStationScope } from "@/hooks/useStationScope";
import { ACCENT, MUTED, NAVY, BAD, OK, WARN, NEUTRAL, num, tableShell, CARD } from "@/lib/platformStyles";
import { toast } from "@/components/ui/use-toast";

async function complaintsApi(payload) {
  const res = await base44.functions.invoke("complaints", payload);
  return res?.data ?? res;
}

const KIND_LABEL = {
  anonymous: { ar: "مجهول", en: "Anonymous" },
  safety: { ar: "سلامة", en: "Safety" },
  suggestion: { ar: "اقتراح", en: "Suggestion" },
  facilities: { ar: "مرافق", en: "Facilities" },
  public: { ar: "مُعرَّف", en: "Named" },
};

const KIND_STYLE = {
  anonymous: NEUTRAL,
  safety: BAD,
  suggestion: OK,
  facilities: WARN,
  public: NEUTRAL,
};

function slaText(r, ar) {
  if (r.status !== "open" || r.slaHoursLeft == null) return "—";
  const h = r.slaHoursLeft;
  if (h < 0) {
    const overdue = Math.abs(h);
    if (overdue >= 24) {
      const d = Math.round(overdue / 24);
      return ar ? `تجاوز ${d} يومًا` : `${d}d overdue`;
    }
    return ar ? `تجاوز ${Math.round(overdue)} ساعات` : `${Math.round(overdue)}h overdue`;
  }
  if (h >= 24) {
    const d = Math.round(h / 24);
    return ar ? `${d} أيام` : `${d} days`;
  }
  return ar ? `${Math.round(h)} ساعات` : `${Math.round(h)}h`;
}

export default function ComplaintQueueBoard({ lang = "ar", stationScope = "all", voice = "all" }) {
  const ar = lang === "ar";
  const { company, currentUser, data } = useAuth();
  const [reports, setReports] = useState([]);
  const [chain, setChain] = useState([]);
  const [busy, setBusy] = useState(false);

  const applyRemote = (remote) => {
    if (Array.isArray(remote?.reports)) setReports(remote.reports);
    if (Array.isArray(remote?.chain)) setChain(remote.chain);
  };

  const load = async () => {
    if (!company?.id) return;
    try {
      let remote = await complaintsApi({ action: "list", companyId: company.id });
      if (Array.isArray(remote?.reports) && remote.reports.length === 0) {
        remote = await complaintsApi({ action: "seedDemo", companyId: company.id });
      }
      applyRemote(remote);
    } catch {
      setReports([]);
    }
  };

  useEffect(() => { load(); }, [company?.id]);

  const run = async (payload, okMsg) => {
    if (!company?.id) return;
    setBusy(true);
    try {
      const remote = await complaintsApi({ ...payload, companyId: company.id });
      if (remote?.error) {
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error),
          variant: "destructive",
        });
      } else {
        if (okMsg) toast({ description: okMsg });
        applyRemote(remote);
      }
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const escalate = async (report) => {
    const gate = checkEscalateGate(report, chain, { isHandler: true });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    await run(
      { action: "escalate", reportId: report.id },
      ar ? "صُعّد البلاغ إلى المستوى التالي" : "Report escalated to the next level",
    );
  };

  const close = async (report) => {
    const gate = checkCloseGate(report, { isHandler: true });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    await run(
      { action: "close", reportId: report.id, satisfaction: 86 },
      ar ? "أُغلق البلاغ" : "Report closed",
    );
  };

  if (!currentUser) return null;

  // Scope narrows the queue in place; the counters are re-derived from the same
  // rows so a station's figures never disagree with the list under them.
  const scopedReports = reports.filter((r) =>
    (stationScope === "all" || matchesStationScope(r.stationId, stationScope, data?.stations))
    && matchesVoiceChannel(r, voice),
  );
  const scopedStats = deriveComplaintStats(scopedReports);

  const voiceCopy = voice === "suggestion"
    ? {
      open: ar ? "اقتراحات مفتوحة" : "Open suggestions",
      openSuffix: ar ? "بانتظار المراجعة" : "awaiting review",
      avg: ar ? "متوسط زمن المراجعة" : "Average review time",
      breach: ar ? "تجاوزت زمن المراجعة" : "Review overdue",
      breachSuffix: ar ? "تُرفع للمدير التالي" : "raised to next manager",
      closed: ar ? "أُغلقت هذا الشهر" : "Closed this month",
      closedEmpty: ar ? "لا اقتراحات مغلقة بعد" : "no suggestions closed yet",
      list: ar ? "قائمة الاقتراحات" : "Suggestion queue",
      listHint: ar
        ? "الاقتراح يصل باسم صاحبه — يُراجع ثم يُعتمد أو يُعاد بملاحظة"
        : "Suggestions arrive with the author’s name — review, adopt, or return with a note",
      emptyAll: ar ? "لا اقتراحات في الصندوق." : "No suggestions in the queue.",
      emptyStation: ar ? "لا اقتراحات على هذا الفرع." : "No suggestions for this station.",
    }
    : voice === "anonymous"
      ? {
        open: ar ? "بلاغات مجهولة مفتوحة" : "Open anonymous reports",
        openSuffix: ar ? "الهوية محمية" : "identity protected",
        avg: ar ? "متوسط زمن الاستجابة" : "Average response time",
        breach: ar ? "تجاوزت زمن الاستجابة" : "Breached SLA",
        breachSuffix: ar ? "صُعّدت تلقائيًا" : "auto-escalated",
        closed: ar ? "أُغلقت هذا الشهر" : "Closed this month",
        closedEmpty: ar ? "لا بلاغات مغلقة بعد" : "no reports closed yet",
        list: ar ? "قائمة البلاغات المجهولة" : "Anonymous queue",
        listHint: ar
          ? "تصل دون كشف هوية المُبلِّغ — تجاوز الزمن يصعّد تلقائيًا"
          : "Arrive without revealing the reporter — SLA breach auto-escalates",
        emptyAll: ar ? "لا بلاغات مجهولة في الصندوق." : "No anonymous reports in the queue.",
        emptyStation: ar ? "لا بلاغات مجهولة على هذا الفرع." : "No anonymous reports for this station.",
      }
      : {
        open: ar ? "شكاوى مفتوحة" : "Open complaints",
        openSuffix: ar ? "هوية المُبلِّغ ظاهرة" : "reporter identified",
        avg: ar ? "متوسط زمن الاستجابة" : "Average response time",
        breach: ar ? "تجاوزت زمن الاستجابة" : "Breached SLA",
        breachSuffix: ar ? "صُعّدت تلقائيًا" : "auto-escalated",
        closed: ar ? "أُغلقت هذا الشهر" : "Closed this month",
        closedEmpty: ar ? "لا شكاوى مغلقة بعد" : "no complaints closed yet",
        list: ar ? "قائمة الشكاوى" : "Complaint queue",
        listHint: ar
          ? "الشكاوى الجهرية تُعالج بالاسم — تجاوز الزمن يصعّد تلقائيًا"
          : "Named complaints are handled in the open — SLA breach auto-escalates",
        emptyAll: ar ? "لا شكاوى في الصندوق." : "No complaints in the queue.",
        emptyStation: ar ? "لا شكاوى على هذا الفرع." : "No complaints for this station.",
      };

  const statCards = [
    {
      label: voiceCopy.open,
      value: scopedStats?.openCount ?? "—",
      suffix: voiceCopy.openSuffix,
    },
    {
      label: voiceCopy.avg,
      value: scopedStats?.avgResponseHours ?? "—",
      suffix: ar ? "ساعات" : "hours",
      accent: true,
    },
    {
      label: voiceCopy.breach,
      value: scopedStats?.breachedCount ?? "—",
      suffix: voiceCopy.breachSuffix,
      danger: true,
    },
    {
      label: voiceCopy.closed,
      value: scopedStats?.closedThisMonth ?? "—",
      suffix: scopedStats?.avgSatisfaction != null
        ? (ar ? `بنسبة رضا ${scopedStats.avgSatisfaction}٪` : `${scopedStats.avgSatisfaction}% satisfaction`)
        : voiceCopy.closedEmpty,
    },
  ];

  return (
    <section style={{ width: "100%", display: "flex", flexDirection: "column" }} dir={ar ? "rtl" : "ltr"}>
      <div style={tableShell}>
        <div className="nv-voice-kpis">
          {statCards.map((s) => (
            <div key={s.label} style={{ padding: "12px 16px", minWidth: 0 }}>
              <div style={{ fontSize: "11px", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                <span dir="ltr" style={{ ...num(s.danger ? "#DC2626" : s.accent ? ACCENT : NAVY) }}>
                  {s.value}
                </span>
                <span style={{ fontSize: "11px", color: MUTED }}>{s.suffix}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 16px", borderTop: "1px solid var(--nv-line)", borderBottom: scopedReports.length ? "1px solid var(--nv-line)" : "none", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{voiceCopy.list}</div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
              {voiceCopy.listHint}
            </div>
          </div>
          {busy && <Loader2 className="h-4 w-4 animate-spin" style={{ color: MUTED }} />}
        </div>

        {scopedReports.length === 0 ? (
          <div style={{ padding: "18px 16px", textAlign: "center", fontSize: "13px", color: MUTED }}>
            {stationScope === "all" ? voiceCopy.emptyAll : voiceCopy.emptyStation}
          </div>
        ) : scopedReports.map((r) => {
          const kindKey = r.kind || "public";
          const kindStyle = KIND_STYLE[kindKey] || KIND_STYLE.public;
          const tier = ar ? r.currentTierLabelAr : r.currentTierLabelEn;
          const slaColor = r.slaBreached ? "#DC2626" : r.slaHoursLeft != null && r.slaHoursLeft < 8 ? "#B45309" : MUTED;
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", flexWrap: "wrap" }}>
              <span style={kindStyle}>{ar ? (KIND_LABEL[kindKey]?.ar || kindKey) : (KIND_LABEL[kindKey]?.en || kindKey)}</span>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: NAVY }}>{r.title}</div>
                <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                  {[r.stationName, r.anonymousId || (r.reporterName ? (ar ? `بُلّغ عنه بواسطة ${r.reporterName}` : `reported by ${r.reporterName}`) : null)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px", minWidth: "96px" }}>
                <span style={{ fontSize: "10px", color: MUTED }}>{ar ? "المتبقي" : "Remaining"}</span>
                <span style={{ fontSize: "11px", fontWeight: 600, color: slaColor }}>{slaText(r, ar)}</span>
              </div>
              <span style={{ fontSize: "11px", color: MUTED, whiteSpace: "nowrap" }}>
                {r.lastEscalationReason === "SLA_BREACH"
                  ? (ar ? `صُعّد تلقائيًا · ${tier}` : `Auto-escalated · ${tier}`)
                  : (ar ? `لدى ${tier}` : `With ${tier}`)}
              </span>
              {r.status === "open" && !r.atTop && (
                <button type="button" disabled={busy} onClick={() => escalate(r)} style={{
                  padding: "7px 13px",
                  borderRadius: "9px",
                  border: `1px solid ${ACCENT}`,
                  background: CARD,
                  color: "var(--nv-ok-ink)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: busy ? 0.5 : 1,
                }}>
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  {ar ? "صعّد" : "Escalate"}
                </button>
              )}
              {r.status === "open" && r.atTop && (
                <span style={NEUTRAL}>{ar ? "أعلى مستوى" : "Top tier"}</span>
              )}
              {r.status === "open" && (
                <button type="button" disabled={busy} onClick={() => close(r)} style={{
                  padding: "7px 13px",
                  borderRadius: "9px",
                  border: "1px solid var(--nv-line)",
                  background: CARD,
                  color: MUTED,
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: busy ? 0.5 : 1,
                }}>
                  <Check className="h-3.5 w-3.5" />
                  {ar ? "أغلق" : "Close"}
                </button>
              )}
              <div style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", paddingTop: "4px" }}>
                <span style={{ fontSize: "9px", color: MUTED, letterSpacing: "0.06em", marginInlineEnd: "4px" }}>
                  {ar ? "سلسلة التصعيد" : "Escalation chain"}
                </span>
                {(r.steps || []).map((st, i) => (
                  <span key={st.id || i} style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    color: st.state === "current" ? ACCENT : MUTED,
                    fontWeight: st.state === "current" ? 600 : 400,
                  }}>
                    <span style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: st.state === "done" ? "#CBD5E1" : st.state === "current" ? ACCENT : "transparent",
                      border: st.state === "pending" ? "1px solid var(--nv-line)" : "none",
                      flexShrink: 0,
                    }} />
                    {ar ? st.labelAr : st.labelEn}
                    {i < (r.steps?.length || 0) - 1 && (
                      <span style={{ width: "14px", height: "1px", background: "var(--nv-line)", margin: "0 2px" }} />
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
