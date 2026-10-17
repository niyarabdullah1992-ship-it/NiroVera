import React, { useCallback, useEffect, useMemo, useState } from "react";
import { hcmCall } from "@/lib/hcmApi";
import { PERF_ELEMENTS, checkPerfGrievanceGate, perfGrievanceState, perfLevelByNumber, reportElementSource } from "@/lib/perfReport";
import { modelLaw } from "@/lib/modelArticleTexts";
import { StatuteLink } from "@/components/shared/RightHint";
import { incrementsModelNote, performanceReportModelNote } from "@/lib/implementingRegsNotes";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";
import { field, MUTED, ui } from "@/lib/platformStyles";
import { toast } from "@/components/ui/use-toast";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const card = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden" };
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

/**
 * «نسخة تقرير الأداء» in أدائي — model Arts. 18–20: the copy of every approved annual report (its
 * five-level rating and the three elements), and the worker's grievance on it within 30 days; HR
 * decides in writing within 15. Below it, «أنظمة الوزارة — ما يخص أدائي» with Arts. 18–23.
 */
export default function PerfReportCopy({ ar, employee, companyId, quality = null, objections = [] }) {
  const today = todayIso();
  const [reports, setReports] = useState(null);
  const [open, setOpen] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!companyId) return;
    hcmCall({ action: "myPerfReports", companyId })
      .then((res) => setReports(Array.isArray(res?.reports) ? res.reports : []))
      .catch(() => setReports([]));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const list = reports || [];
  const lawInputs = useMemo(() => ({
    employee,
    reports: reports || [],
    notes: { report: performanceReportModelNote(ar), advancement: incrementsModelNote(ar) },
    quality,
    objections,
  }), [reports, employee, ar, quality, objections]);

  const send = async (report) => {
    const gate = checkPerfGrievanceGate({ report, reason, today });
    if (!gate.ok) { toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" }); return; }
    setBusy(true);
    try {
      const res = await hcmCall({ action: "filePerfGrievance", companyId, ratingId: report.ratingId, reason });
      if (res?.error) { toast({ description: ar ? res.reason : (res.reasonEn || res.reason), variant: "destructive" }); return; }
      setReports(res.reports || []);
      setOpen(""); setReason("");
      toast({ description: ar ? `أُرسل تظلمك — تُبلَّغ بالنتيجة كتابةً حتى ${gate.replyBy}.` : `Grievance sent — answer by ${gate.replyBy}.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section data-perf-reports="1" style={card}>
        <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 3 }}>
          <strong style={{ fontSize: 14 }}>{ar ? "نسخة تقرير الأداء" : "My performance report"}</strong>
          <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
            {ar ? "يعدّه مديرك المباشر ويُعتمد بإقفال دورة التقييم، فتصلك صورته هنا. عناصره من أدلتك: الكفاءة من مستويات جودة مهامك، والمواظبة من سجل دوامك، والسلوك تقدير مديرك. لك التظلم منه كتابةً خلال 30 يوماً عدا العطل الرسمية، ولا تُضار من تظلمك." : "Prepared by your manager and approved when the cycle closes; your copy arrives here. Its elements come from your evidence: competence from your task levels, attendance from your duty record, conduct by your manager. You may grieve it in writing within 30 days."}
          </span>
          <span style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatuteLink ar={ar} law={modelLaw(["18", "19", "20"], ar)} />
            <StatuteLink ar={ar} law={modelLaw(["21", "22", "23"], ar)} />
            <StatuteLink ar={ar} law={modelLaw(["71"], ar)} />
          </span>
        </header>
        {reports == null ? (
          <div style={{ padding: "14px 18px", color: MUTED, fontSize: 12.5 }}>…</div>
        ) : !list.length ? (
          <div style={{ padding: "14px 18px", color: MUTED, fontSize: 12.5 }}>{ar ? "لا تقرير معتمد لك بعد." : "No approved report yet."}</div>
        ) : list.map((r) => {
          const state = perfGrievanceState(r.grievance, today);
          const canGrieve = !r.grievance && today <= r.grievanceBy;
          return (
            <div key={r.ratingId} data-perf-report={r.cycleId} style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13 }}>{r.period}</strong>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)" }}>{ar ? r.level?.ar : r.level?.en}</span>
                <span dir="ltr" style={{ ...mono, fontSize: 11.5, color: MUTED }}>{r.rating}/100</span>
                <span style={{ fontSize: 11, color: MUTED, marginInlineStart: "auto" }}>{ar ? `اعتُمد ${r.approvedAt} · أعدّه ${r.ratedByName || "—"}` : `Approved ${r.approvedAt} · by ${r.ratedByName || "—"}`}</span>
              </div>
              {r.elements ? (
                <div data-report-elements="1" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {PERF_ELEMENTS.map((el) => (
                    <div key={el.key} data-report-element={el.key} style={{ display: "flex", flexDirection: "column", gap: 0, fontSize: 11.5, lineHeight: 1.7 }}>
                      <span style={{ color: "var(--nv-ink2)" }}>
                        {`${ar ? el.ar : el.en}: `}
                        <strong style={{ color: "var(--nv-ink)" }}>{(ar ? perfLevelByNumber(r.elements[el.key])?.ar : perfLevelByNumber(r.elements[el.key])?.en) || "—"}</strong>
                      </span>
                      <span style={{ color: MUTED }}>{reportElementSource(r, el.key, ar)}</span>
                    </div>
                  ))}
                  {r.elementReasons?.overall ? (
                    <span style={{ fontSize: 11.5, color: MUTED }}>{ar ? `التقدير العام يبعد ${r.elementReasons.overall.gap} مستوى عن متوسط العناصر (${r.elementReasons.overall.elementAvg}): ${r.elementReasons.overall.reason}` : `Overall is ${r.elementReasons.overall.gap} levels from the elements' mean: ${r.elementReasons.overall.reason}`}</span>
                  ) : null}
                </div>
              ) : null}
              {r.justification ? <span style={{ fontSize: 11.5, color: MUTED }}>{r.justification}</span> : null}
              {state ? (
                <span style={{ fontSize: 11.5, color: state.stage === "overdue" ? "var(--nv-bad-ink)" : "var(--nv-ink2)", lineHeight: 1.7 }}>
                  {state.stage === "pending" ? (ar ? `تظلمك بانتظار البتّ — حتى ${state.replyBy}` : `Your grievance awaits a decision — by ${state.replyBy}`)
                    : state.stage === "overdue" ? (ar ? `لم يُبتّ في تظلمك خلال 15 يوماً — لك الاعتراض أمام المحاكم العمالية خلال 30 يوماً (م71/2)` : "No decision within 15 days — you may go to the labour court within 30 days (Art. 71(2))")
                      : state.stage === "upheld" ? (ar ? `قُبل تظلمك: ${r.grievance.note}` : `Upheld: ${r.grievance.note}`)
                        : (ar ? `رُفض تظلمك: ${r.grievance.note} — لك الاعتراض أمام المحاكم العمالية خلال 30 يوماً (م71/2)` : `Refused: ${r.grievance.note}`)}
                </span>
              ) : null}
              {canGrieve && open !== r.ratingId ? (
                <button type="button" onClick={() => { setOpen(r.ratingId); setReason(""); }} style={{ ...ui.btnRow, alignSelf: "flex-start" }}>
                  {ar ? `التظلم من التقرير (حتى ${r.grievanceBy})` : `Grieve this report (until ${r.grievanceBy})`}
                </button>
              ) : null}
              {open === r.ratingId ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? "أي عنصر تراه غير صحيح، ولماذا" : "What you contest and why"} style={{ ...field, height: "auto", resize: "vertical" }} />
                  <span style={{ display: "flex", gap: 6 }}>
                    <button type="button" disabled={busy} onClick={() => send(r)} style={ui.btnPrimary}>{ar ? "أرسل التظلم" : "Send"}</button>
                    <button type="button" onClick={() => setOpen("")} style={ui.btnRow}>{ar ? "إلغاء" : "Cancel"}</button>
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
      <MinistrySectionPanel sectionKey="performance" lane="employee" ar={ar} today={today} inputs={lawInputs} />
    </>
  );
}
