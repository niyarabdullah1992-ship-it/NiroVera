import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { updateCompany, addNotification, getCompanyToken, setAnonRateLimits } from "@/lib/store";
import { visibleStations, hasHRPermission, hrScopeStations } from "@/lib/permissions";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { complaintHandlersForLevel, complaintHasHandlerAtLevel, complaintLevelLabel, buildComplaintEscalationSteps, complaintEscalationStageCount, isManualComplaintHandler, usesManualComplaintEscalation } from "@/lib/escalation";
import { ShieldCheck, Send, Lock, LockOpen, ArrowUpCircle, Building2, ArrowLeft, X as XIcon } from "lucide-react";
import CommentFiles, { CommentAttachments } from "@/components/tasks/CommentFiles";
import FlowSwipeAction from "@/components/flow/FlowSwipeAction";
import VoiceRecorder from "@/components/tasks/VoiceRecorder";
import EscalationSteps from "@/components/escalation/EscalationSteps";
import EscalationInfoBox from "@/components/escalation/EscalationInfoBox";
import MobileSelect from "@/components/mobile/MobileSelect";
import VoiceStationList from "@/components/complaints/VoiceStationList";
import { ACCENT, BORDER, MUTED, NAVY, SURFACE, cardShell, field, labelMuted, textarea, ui, BAD, WARN, OK, NEUTRAL } from "@/lib/platformStyles";

const STAT_TYPES = ["complaint", "suggestion"];
const PRIORITIES = ["high", "medium", "low"];

const card = { ...cardShell, padding: "16px 18px" };

function ToneBadge({ text, tone = "muted" }) {
  const style =
    tone === "destructive" ? BAD
      : tone === "accent" ? OK
        : tone === "warn" ? WARN
          : NEUTRAL;
  return <span style={style}>{text}</span>;
}

export default function AnonymousReports({ underQueue = false }) {
  const { t, dir, lang } = useI18n();
  const { data, currentUser, company, refresh } = useAuth();
  const stationScope = useStationScope();
  const [submitting, setSubmitting] = useState(false);
  const [type] = useState("complaint");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [replyText, setReplyText] = useState({});
  const [files, setFiles] = useState([]);
  const [replyFiles, setReplyFiles] = useState({});
  const [reportStationId, setReportStationId] = useState("");
  const [selectedStation, setSelectedStation] = useState(null);
  const [monthlyLimitInput, setMonthlyLimitInput] = useState("");
  const [ownReportIds, setOwnReportIds] = useState([]);

  useEffect(() => {
    setSelectedStation(null);
  }, [stationScope]);

  useEffect(() => {
    if (!company?.id || !currentUser?.id) return;
    base44.functions.invoke("companyDirectory", {
      action: "getMyAnonymousReportIds",
      companyId: company.id,
      sessionToken: getCompanyToken(company.id),
    }).then((res) => setOwnReportIds(res?.data?.reportIds || []));
  }, [company?.id, currentUser?.id]);

  if (!data || !currentUser) return null;
  const STAGE_COUNT = complaintEscalationStageCount(data);
  const manualHandler = isManualComplaintHandler(currentUser, data);
  const canAct = manualHandler || hasHRPermission(currentUser, data, "manage_anonymous_reports");
  const canView = manualHandler || hasHRPermission(currentUser, data, "view_anonymous_reports");
  const isHRAnon = canAct || canView;
  const hrStations = manualHandler ? null : isHRAnon ? hrScopeStations(currentUser, data) : [];
  const isOwner = currentUser.id === data.ownerId;
  const isStaff = isHRAnon || currentUser.role === "director" || currentUser.role === "ops_manager" || currentUser.role === "station_manager" || isOwner;
  const myAnon = (data.anonymousReports || []).filter((report) => ownReportIds.includes(report.id));
  const now = Date.now();
  const usage = {
    day: myAnon.filter((r) => now - new Date(r.createdAt).getTime() < 86400000).length,
    week: myAnon.filter((r) => now - new Date(r.createdAt).getTime() < 86400000 * 7).length,
    month: myAnon.filter((r) => now - new Date(r.createdAt).getTime() < 86400000 * 30).length,
    dayLimit: data.settings?.rateLimitDaily ?? 3,
    weekLimit: data.settings?.rateLimitWeekly ?? 10,
    monthLimit: data.settings?.rateLimitMonthly ?? 30,
  };

  const stationName = (id) => (data.stations || []).find((s) => s.id === id)?.name || "—";
  const assignedStationIds = [...new Set([
    currentUser.stationId,
    ...(currentUser.stationIds || []),
    ...(currentUser.managedStations || []),
  ].filter(Boolean))];
  const assignedStations = (data.stations || []).filter((station) => assignedStationIds.includes(station.id));
  const effectiveReportStationId = assignedStations.some((station) => station.id === reportStationId)
    ? reportStationId
    : assignedStations[0]?.id || "";
  const displayCode = (r) => r.anonymousId || `ANON-${String(r.id).slice(-8).toUpperCase()}`;
  const saveMonthlyLimit = () => {
    const val = Number(monthlyLimitInput);
    if (!val || val < 1) return;
    setAnonRateLimits(company.id, { monthly: val });
    setMonthlyLimitInput("");
  };

  // Reports visible to a staff member based on HR scope (or full oversight for director/owner/ops manager)
  const visibleReports = (data.anonymousReports || []).filter((r) => {
    if (!matchesStationScope(r.stationId, stationScope, data.stations)) return false;
    if (currentUser.role === "director" || currentUser.role === "ops_manager" || isOwner) return true;
    if (currentUser.role === "station_manager") {
      const managed = currentUser.managedStations?.length ? currentUser.managedStations : [currentUser.stationId];
      return managed.includes(r.stationId);
    }
    if (isHRAnon) return hrStations === null || hrStations.includes(r.stationId);
    return false;
  });

  const currentHandlerLabel = (r) => complaintLevelLabel(r.escalationLevel || 0, data, t, lang);
  const canReplyTo = (r) => {
    const level = r.escalationLevel || 0;
    if (!complaintHandlersForLevel(level, r, data).some((h) => h.id === currentUser.id)) return false;
    return usesManualComplaintEscalation(data) ? true : level === 0 ? true : canAct;
  };
  const isAtTop = (r) => (r.escalationLevel || 0) >= STAGE_COUNT - 1;
  const isConfidentialHidden = (r) => r.confidential && r.confidentialBy !== currentUser.id;
  const toggleConfidential = (id) => {
    updateCompany(company.id, (d) => {
      const r = d.anonymousReports.find((x) => x.id === id);
      if (!r) return;
      if (r.confidential && r.confidentialBy === currentUser.id) {
        r.confidential = false;
        r.confidentialBy = null;
      } else if (!r.confidential) {
        r.confidential = true;
        r.confidentialBy = currentUser.id;
      }
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;
    const assignedStation = assignedStations.find((station) => station.id === effectiveReportStationId);
    if (!assignedStation) {
      alert(lang === "ar" ? "يجب تعيين فرع للموظف قبل إرسال شكوى سرية." : "The employee must have an assigned station before filing an anonymous complaint.");
      return;
    }
    if (usage.day >= usage.dayLimit || usage.week >= usage.weekLimit || usage.month >= usage.monthLimit) return;
    const draft = { stationId: assignedStation.id };
    const initialLevel = Array.from({ length: STAGE_COUNT }).findIndex((_, level) => complaintHandlersForLevel(level, draft, data).length > 0);
    if (initialLevel < 0) {
      alert(t("noHandlerAssigned"));
      return;
    }
    // Filed through its own server action: one appended record, server-side rate
    // limits, and a private receipt — never a full-array replacement that could be
    // rejected or overwritten and silently lose the report.
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("companyDirectory", {
        action: "createAnonymousReport",
        companyId: company.id,
        sessionToken: getCompanyToken(company.id),
        report: { stationId: assignedStation.id, type, priority, message, files, escalationLevel: initialLevel },
      });
      const created = res?.data?.report;
      if (!created?.id) throw new Error("REPORT_NOT_SAVED");
      setOwnReportIds((ids) => [created.id, ...ids]);
      const initialHandlers = complaintHandlersForLevel(initialLevel, draft, data);
      for (const handler of initialHandlers) addNotification(company.id, handler.id, `New ${t(type)} report at ${assignedStation.name || ""} (${t(priority)}).`);
      setMessage("");
      setFiles([]);
      refresh();
    } catch (error) {
      const code = error?.response?.data?.error || error?.message;
      alert(code === "RATE_LIMIT_REACHED"
        ? (lang === "ar" ? "بلغت الحد المسموح من البلاغات لهذه الفترة." : "You've reached the report limit for this period.")
        : (lang === "ar" ? "لم يُحفظ البلاغ. حاول مرة أخرى." : "The report was not saved. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const decide = (id, decision) => {
    const txt = (replyText[id] || "").trim();
    const rep = data.anonymousReports.find((x) => x.id === id);
    if (!rep || rep.status !== "open" || !canReplyTo(rep) || !txt) return;
    updateCompany(company.id, (d) => {
      const r = d.anonymousReports.find((x) => x.id === id);
      if (!r) return;
      if (txt) {
        r.replies = r.replies || [];
        r.replies.push({ level: r.escalationLevel || 0, role: currentUser.role, authorName: currentUser.name, text: txt, files: replyFiles[id] || [], createdAt: new Date().toISOString() });
      }
      r.status = decision === "approved" || isAtTop(rep) ? "closed" : "rejected";
      r.resolution = decision;
    });
    base44.functions.invoke("companyDirectory", {
      action: "notifyAnonymousAuthor",
      companyId: company.id,
      reportId: rep.id,
      text: `Your anonymous ${t(rep.type)} was ${t(decision)}.`,
      sessionToken: getCompanyToken(company.id),
    });
    setReplyText({ ...replyText, [id]: "" });
    setReplyFiles({ ...replyFiles, [id]: [] });
  };

  const undoEscalate = (id, previous) => {
    updateCompany(company.id, (d) => {
      const r = d.anonymousReports.find((x) => x.id === id);
      if (r) { r.escalationLevel = previous.escalationLevel || 0; r.status = previous.status; r.resolution = previous.resolution || null; }
    });
  };

  const escalate = (id) => {
    const rep = data.anonymousReports.find((x) => x.id === id);
    if (!rep) return;
    const isAuthorAppeal = ownReportIds.includes(rep.id) && !isStaff;
    if (isAuthorAppeal && rep.status !== "rejected") return;
    if (!isAuthorAppeal && (rep.status !== "open" || !canReplyTo(rep))) return;
    const nextLevel = (rep.escalationLevel || 0) + 1;
    if (nextLevel >= STAGE_COUNT) return;
    if (!complaintHasHandlerAtLevel(nextLevel, rep, data)) {
      alert(t("noHandlerAssigned"));
      return;
    }
    const nextHandlers = complaintHandlersForLevel(nextLevel, rep, data);
    updateCompany(company.id, (d) => {
      const r = d.anonymousReports.find((x) => x.id === id);
      if (r) { r.escalationLevel = nextLevel; r.status = "open"; r.resolution = null; }
    });
    for (const h of nextHandlers) addNotification(company.id, h.id, `Escalated anonymous report at ${stationName(rep.stationId)} — now requires your attention.`);
  };

  // Escalation ladder showing each level, its reply (if any), and whether anyone is assigned to it
  const renderTimeline = (r) => {
    const steps = buildComplaintEscalationSteps(r.escalationLevel || 0, r, data, t, lang, STAGE_COUNT).map((s) => ({
      ...s,
      reply: (r.replies || []).find((rp) => rp.level === s.idx) || null,
    }));
    return <EscalationSteps steps={steps} t={t} lang={lang} />;
  };

  const stats = {
    complaint: visibleReports.filter((a) => a.type === "complaint").length,
    suggestion: visibleReports.filter((a) => a.type === "suggestion").length,
  };

  // Station grouping for staff navigation — merges role-based scope with HR scope
  const hrStationList = isHRAnon ? (hrStations === null ? (data.stations || []) : (data.stations || []).filter((s) => hrStations.includes(s.id))) : [];
  const stationMap = new Map();
  [...visibleStations(currentUser, data), ...hrStationList].forEach((s) => stationMap.set(s.id, s));
  const myStations = Array.from(stationMap.values()).filter((s) => matchesStationScope(s.id, stationScope, data.stations));
  const scopedToOne = stationScope !== "all";
  const activeStation = scopedToOne ? stationScope : selectedStation;
  const stationGroups = myStations.map((s) => ({
    key: s.id,
    name: s.name,
    count: visibleReports.filter((r) => r.stationId === s.id).length,
  }));
  const stationReports = activeStation ? visibleReports.filter((r) => r.stationId === activeStation) : [];
  const selectedStationName = activeStation ? stationName(activeStation) : "";

  const emptyMsg = { margin: 0, fontSize: "13px", color: MUTED, textAlign: "center", padding: "20px 0" };
  const metaRow = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", fontSize: "11px", color: MUTED };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={dir}>
      <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.6 }}>
        {isStaff ? t("overview") : t("identityProtected")}
      </p>

      <EscalationInfoBox t={t} />

      {!isStaff && (
        <>
          <div style={{
            ...card,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderColor: "color-mix(in oklab, var(--nv-ok-ink) 28%, #fff)",
            background: "color-mix(in oklab, var(--nv-ok-ink) 8%, #fff)",
          }}
          >
            <ShieldCheck style={{ width: 18, height: 18, color: ACCENT, flexShrink: 0 }} />
            <p style={{ margin: 0, flex: 1, fontSize: "13px", color: "var(--nv-ok-ink)" }}>{t("identityProtected")}</p>
            <Lock style={{ width: 14, height: 14, color: ACCENT }} />
          </div>

          <form onSubmit={submit} style={{ ...card, display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={labelMuted}>{t("priority")}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={field}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{t(p)}</option>)}
              </select>
            </div>
            {assignedStations.length > 1 ? (
              <div>
                <label style={labelMuted}>{t("station")}</label>
                <MobileSelect value={effectiveReportStationId} onChange={setReportStationId} searchable searchPlaceholder={t("search")} placeholder={t("selectStation")} className="w-full" options={assignedStations.map((station) => ({ value: station.id, label: station.location ? `${station.name} — ${station.location}` : station.name }))} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: effectiveReportStationId ? MUTED : "var(--nv-bad-ink)" }}>
                <Building2 style={{ width: 14, height: 14 }} />
                {t("station")}: {effectiveReportStationId ? stationName(effectiveReportStationId) : (lang === "ar" ? "لا توجد فرع معيّنة" : "No assigned station")}
              </div>
            )}
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={t("fileReport")} required style={{ ...textarea, resize: "none" }} />
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "8px" }}>
              <CommentFiles files={files} setFiles={setFiles} />
              <VoiceRecorder files={files} setFiles={setFiles} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: MUTED }}>
                {usage.dayLimit - usage.day} {t("remaining")} · {usage.weekLimit - usage.week} {t("weekRemaining")} · {usage.monthLimit - usage.month} {t("monthRemaining")}
              </p>
              <button
                type="submit"
                disabled={submitting || !effectiveReportStationId || usage.day >= usage.dayLimit || usage.week >= usage.weekLimit || usage.month >= usage.monthLimit}
                style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: "6px", opacity: submitting || !effectiveReportStationId || usage.day >= usage.dayLimit || usage.week >= usage.weekLimit || usage.month >= usage.monthLimit ? 0.4 : 1 }}
              >
                <Send style={{ width: 14, height: 14 }} /> {t("fileReport")}
              </button>
            </div>
          </form>

          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "10px" }}>{t("yourReports")}</div>
            {myAnon.length === 0 ? (
              <p style={emptyMsg}>{t("noReply")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {myAnon.map((r) => (
                  <div key={r.id} style={{ ...card, display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <div style={metaRow}>
                        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{displayCode(r)}</span>
                        {r.stationId && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Building2 style={{ width: 12, height: 12 }} /> {stationName(r.stationId)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <ToneBadge text={t(r.type)} />
                        <ToneBadge text={t(r.priority)} tone={r.priority === "high" ? "destructive" : "muted"} />
                        <ToneBadge text={currentHandlerLabel(r)} tone="accent" />
                        {r.confidential && <ToneBadge text={t("confidential")} tone="destructive" />}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: NAVY, lineHeight: 1.65 }}>{r.message}</p>
                    <CommentAttachments files={r.files} />
                    {renderTimeline(r)}
                    {!isAtTop(r) && r.status === "rejected" && (
                      <button type="button" onClick={() => escalate(r.id)} style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: "6px", borderColor: "var(--nv-line)", color: "var(--nv-warn-ink)", alignSelf: "flex-start" }}>
                        <ArrowUpCircle style={{ width: 14, height: 14 }} /> {t("notConvinced")}
                      </button>
                    )}
                    {isAtTop(r) && r.status === "rejected" && (
                      <p style={{ margin: 0, fontSize: "11px", color: MUTED, fontStyle: "italic" }}>{t("finalLevel")}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isStaff && (
        <>
          {(currentUser.role === "director" || isOwner) && (
            <div style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
              <label style={{ ...labelMuted, marginBottom: 0 }}>{t("monthlyLimit")}</label>
              <input
                type="number"
                min="1"
                placeholder={String(data.settings?.rateLimitMonthly ?? 30)}
                value={monthlyLimitInput}
                onChange={(e) => setMonthlyLimitInput(e.target.value)}
                style={{ ...field, width: "96px" }}
              />
              <button type="button" onClick={saveMonthlyLimit} style={ui.btnPrimary}>{t("save")}</button>
            </div>
          )}
          {!underQueue && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "10px" }}>
            {STAT_TYPES.map((ty) => (
              <div key={ty} style={card}>
                <div dir="ltr" style={{ fontSize: "22px", fontWeight: 600, color: NAVY, fontFamily: "'IBM Plex Sans',sans-serif" }}>{stats[ty]}</div>
                <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>{t(ty)}</div>
              </div>
            ))}
          </div>
          )}

          {!underQueue && !activeStation ? (
            <VoiceStationList
              stations={stationGroups}
              onPick={setSelectedStation}
              emptyLabel={t("noReply")}
            />
          ) : activeStation ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {!scopedToOne && (
              <>
              <button type="button" onClick={() => setSelectedStation(null)} style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start" }}>
                <ArrowLeft style={{ width: 14, height: 14, transform: dir === "rtl" ? "scaleX(-1)" : "none" }} /> {t("back")}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: NAVY }}>
                <Building2 style={{ width: 16, height: 16 }} /> {selectedStationName}
              </div>
              </>
              )}
              {stationReports.length === 0 ? (
                scopedToOne ? null : <p style={emptyMsg}>{t("noReply")}</p>
              ) : (
                stationReports.map((r) => (
                  <div key={r.id} style={{ ...card, display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <div style={metaRow}>
                        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{displayCode(r)}</span>
                        {r.stationId && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Building2 style={{ width: 12, height: 12 }} /> {stationName(r.stationId)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <ToneBadge text={t(r.type)} />
                        <ToneBadge text={t(r.priority)} tone={r.priority === "high" ? "destructive" : "muted"} />
                        <ToneBadge text={currentHandlerLabel(r)} tone="accent" />
                        <ToneBadge text={t(r.status)} tone={r.status === "closed" ? (r.resolution === "approved" ? "accent" : "destructive") : "muted"} />
                        {r.confidential && <ToneBadge text={t("confidential")} tone="destructive" />}
                      </div>
                    </div>
                    {isConfidentialHidden(r) ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: MUTED, fontStyle: "italic", padding: "10px 12px", borderRadius: "9px", background: SURFACE }}>
                        <Lock style={{ width: 14, height: 14 }} /> {t("confidentialHidden")}
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: "13px", color: NAVY, lineHeight: 1.65 }}>{r.message}</p>
                        <CommentAttachments files={r.files} />
                        {renderTimeline(r)}
                      </>
                    )}
                    {canReplyTo(r) && !isConfidentialHidden(r) && r.status === "open" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "10px", borderTop: `1px solid ${BORDER}` }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "8px" }}>
                          <CommentFiles files={replyFiles[r.id] || []} setFiles={(f) => setReplyFiles({ ...replyFiles, [r.id]: f })} />
                          <VoiceRecorder files={replyFiles[r.id] || []} setFiles={(f) => setReplyFiles({ ...replyFiles, [r.id]: f })} />
                        </div>
                        <input value={replyText[r.id] || ""} onChange={(e) => setReplyText({ ...replyText, [r.id]: e.target.value })} placeholder={t("reply")} style={field} />
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {(replyText[r.id] || "").trim() && (
                            <div style={{ width: "100%" }}>
                              <FlowSwipeAction sensitive label={lang === "ar" ? "اسحب لاعتماد وإغلاق البلاغ" : "Swipe to approve and close"} onAction={() => decide(r.id, "approved")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} />
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={!(replyText[r.id] || "").trim()}
                            onClick={() => decide(r.id, "rejected")}
                            style={{ ...ui.btnDanger, display: "inline-flex", alignItems: "center", gap: "6px", opacity: !(replyText[r.id] || "").trim() ? 0.4 : 1 }}
                          >
                            <XIcon style={{ width: 14, height: 14 }} /> {t("rejectReport")}
                          </button>
                          {!isAtTop(r) && (
                            <div style={{ width: "100%" }}>
                              <FlowSwipeAction label={lang === "ar" ? "اسحب للتصعيد للمستوى التالي" : "Swipe to escalate"} onAction={() => escalate(r.id)} onUndo={() => undoEscalate(r.id, r)} undoLabel={lang === "ar" ? "تراجع عن التصعيد" : "Undo escalation"} />
                            </div>
                          )}
                          {(!r.confidential || r.confidentialBy === currentUser.id) && (
                            <button type="button" onClick={() => toggleConfidential(r.id)} style={{ ...ui.btnGhost, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              {r.confidential ? <LockOpen style={{ width: 14, height: 14 }} /> : <Lock style={{ width: 14, height: 14 }} />}
                              {r.confidential ? t("removeConfidential") : t("makeConfidential")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {!canReplyTo(r) && r.status !== "closed" && !isConfidentialHidden(r) && (
                      <p style={{ margin: 0, fontSize: "11px", color: MUTED, fontStyle: "italic" }}>
                        {isHRAnon && !canAct ? t("auditTrail") : `${t("escalatedTo")} ${currentHandlerLabel(r)}`}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}