import React, { useMemo, useState } from "react";
import { answerOtCapConsent, setOtDecision } from "@/lib/store";
import { approvedOvertimeHoursForYear, isOtDecisionOpen } from "@/lib/attendanceDerivations";
import { formatOtPremiumLabel } from "@/lib/laborHoursPolicy.js";
import { HOLIDAY_WORK_LABEL_AR, HOLIDAY_WORK_LABEL_EN, weekDateKeys, weekNamedOvertime } from "@/lib/shiftWeek";
import { formatRuleFigure, ruleValue } from "@/lib/laborRules.js";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import LawGateAlertRow from "@/components/shared/LawGateAlertRow";
import RightHint from "@/components/shared/RightHint";
import { attRightHint } from "@/lib/rightHints.att.js";
import { toast } from "@/components/ui/use-toast";
import { SW } from "@/lib/shiftWeek";
import { viewerEmployeeId } from "@/lib/employeeFileView";
import { otDayStatus, PLANNED_OT_LABEL_AR, PLANNED_OT_LABEL_EN } from "@/lib/otDecisionPlan";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { otClock } from "@/lib/autoOvertime";

/** Overtime as hours:minutes (0:07), never a decimal hour (0.12). */
const hm = (hours) => otClock(Math.round((Number(hours) || 0) * 60));

/**
 * Live Art. 107 overtime decision — hours derived from the published rota
 * versus 98/99/Ramadan/164, plus rest-day and Eid hours. Default is pay.
 */
export default function OtDecisionBoard({
  schedule,
  employees = [],
  weekStart,
  company,
  companyId,
  laborCalendar,
  otDecisions = {},
  currentUser,
  canEdit = false,
  mode = "manage",
  ar = true,
  onSaved,
  today,
}) {
  const asOf = String(today || toRiyadhDateKey()).slice(0, 10);
  const [consent, setConsent] = useState({});
  const [enjoyDate, setEnjoyDate] = useState({});
  const [notWorkedWhy, setNotWorkedWhy] = useState({});
  const [windowAgreed, setWindowAgreed] = useState({});
  const [busy, setBusy] = useState("");
  const cap = ruleValue("hours.ot.annualMaxHours", weekStart);
  const premium = formatOtPremiumLabel(weekStart, ar);
  const rows = useMemo(() => {
    return (employees || []).map((employee) => {
      const named = weekNamedOvertime(schedule, employee, weekStart, company, laborCalendar, ar);
      const ytd = approvedOvertimeHoursForYear(otDecisions, employee.id, weekStart);
      // One row per day: the roster's named OT, raised to the ACTUAL minutes the punches prove (Arts 101/106/107).
      const byDay = new Map();
      for (const row of named.rows) {
        const prev = byDay.get(row.dateKey);
        byDay.set(row.dateKey, prev ? { ...prev, overtimeHours: Math.round((prev.overtimeHours + row.overtimeHours) * 100) / 100, overtimeMinutes: prev.overtimeMinutes + row.overtimeMinutes } : { ...row });
      }
      for (const key of weekDateKeys(weekStart)) {
        const entry = otDecisions[`${employee.id}:${key}`];
        if (!entry || !(entry.workedProven || entry.holiday)) continue;
        const prev = byDay.get(key);
        // Punches replace the plan (never max over it); a planned-only holiday entry shows its plan.
        const minutes = entry.workedProven
          ? Number(entry.overtimeMinutes) || 0
          : Math.max(Number(entry.overtimeMinutes) || 0, prev?.overtimeMinutes || 0);
        byDay.set(key, {
          ...(prev || { dateKey: key, kind: entry.kind || (entry.holiday ? "holiday" : "actual"), ruleId: "hours.ot.premium" }),
          overtimeMinutes: minutes,
          overtimeHours: Math.round((minutes / 60) * 100) / 100,
          label: entry.holiday ? (ar ? HOLIDAY_WORK_LABEL_AR : HOLIDAY_WORK_LABEL_EN) : (prev?.label || (ar ? "ساعات بعد الدوام بحسب الحضور والانصراف — المادة 107" : "Hours past the shift per the punches — Art. 107")),
          proven: !!entry.workedProven,
          plannedOnly: !!entry.holiday && !entry.workedProven,
        });
      }
      const items = [...byDay.values()].sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
      const totalHours = Math.round(items.reduce((sum, row) => sum + row.overtimeHours, 0) * 100) / 100;
      const pack = { ...named, totalHours };
      const decided = items.map((row) => {
        const entry = otDecisions[`${employee.id}:${row.dateKey}`] || null;
        // Planned roster overtime (no punches yet) stays visible but is not payable until worked (Art. 107).
        const status = otDayStatus(entry, row.dateKey, asOf);
        return { ...row, status, decision: entry && !isOtDecisionOpen(entry) ? entry : null, open: entry && isOtDecisionOpen(entry) ? entry : null };
      });
      const plannedHours = Math.round(decided.filter((row) => row.status.planned).reduce((sum, row) => sum + row.overtimeHours, 0) * 100) / 100;
      pack.plannedHours = plannedHours;
      const pending = decided.filter((row) => !row.decision);
      return { employee, pack, ytd, pending, decided };
    }).filter((row) => row.pack.totalHours > 0);
  }, [employees, schedule, weekStart, company, laborCalendar, otDecisions, ar, asOf]);

  const mine = mode === "mine";
  const viewerId = viewerEmployeeId(currentUser);
  const visible = mine
    ? rows.filter((row) => !!viewerId && String(row.employee.id) === viewerId)
    : rows;

  if (!visible.length) {
    return (
      <section style={{ background: SW.card, border: `1px solid ${SW.line}`, padding: "14px 16px" }}>
        <LawGateAlertRow
          ar={ar}
          article="107"
          status="void"
          pillLabel={ar ? "بلا أثر" : "No effect"}
          summary={ar ? "قرار الإضافي — المادة 107" : "Overtime decision — Art. 107"}
        />
        <p style={{ margin: "8px 0 0", fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>
          {ar
            ? "لا ساعات إضافية مشتقّة من الجدول المنشور في هذا الأسبوع — فوق العادي أو في الراحة الأسبوعية أو العيد."
            : "No overtime derived from the published rota this week — above ordinary hours, or on weekly rest or an Eid."}
        </p>
      </section>
    );
  }

  const decide = (employeeId, dateKey, decision, overtimeMinutes, kinds) => {
    if (!canEdit || !companyId) return;
    const key = `${employeeId}:${dateKey}`;
    setBusy(key);
    const result = setOtDecision(companyId, employeeId, dateKey, {
      decision,
      overtimeMinutes,
      workerConsent: consent[key] === true,
      enjoyDate: enjoyDate[key],
      windowAgreed: windowAgreed[key] === true,
      reason: notWorkedWhy[key] || "",
      kinds,
      by: currentUser?.name,
    });
    setBusy("");
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({
      description: result.capConsentRequested
        ? (ar ? result.reason : result.reasonEn)
        : result.decision === "reject"
          ? (notWorkedWhy[key]
            ? (ar ? "أُغلق «لم يُعمل» — وصل السبب للعامل." : "Closed «not worked» — the worker received the reason.")
            : (ar ? "أُغلق اليوم: العمل المخطط لم يُعمل." : "Closed: the planned work was not done."))
          : result.decision === "comp_leave"
          ? (ar ? "سُجّلت إجازة تعويضية بموافقة العامل." : "Compensatory leave recorded with the worker's consent.")
          : (ar ? "سُجّل صرف الإضافي." : "Overtime pay recorded."),
    });
    onSaved?.();
  };

  /** Regs Art. 22 — the worker's own answer to passing the annual cap. */
  const answerCap = (dateKey, accept) => {
    if (!companyId || !viewerId) return;
    const result = answerOtCapConsent(companyId, viewerId, dateKey, { accept, by: currentUser?.name });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({ description: accept ? (ar ? "سُجّلت موافقتك على تجاوز السقف السنوي." : "Your consent to pass the annual cap is recorded.") : (ar ? "سُجّل رفضك — لا يُتجاوز السقف دون موافقتك." : "Your refusal is recorded — the cap is not passed without you.") });
    onSaved?.();
  };

  return (
    <section style={{ background: SW.card, border: `1px solid ${SW.line}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${SW.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <LawGateAlertRow
          ar={ar}
          article="107"
          status="waiting"
          pillLabel={visible.every((row) => row.decided.every((item) => item.status.planned))
            ? (ar ? "مخطط" : "Planned")
            : (ar ? "ينتظر" : "Waiting")}
          summary={ar ? "قرار الإضافي — أجر الساعة + 50% أو إجازة تعويضية بموافقة العامل" : "Overtime decision — hourly + 50% or compensatory leave with consent"}
        />
        {/* «المادة 107» is already the row's chip above — only the compensatory-leave cite is added here. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <LaborArticleCite ruleId="hours.ot.compLeave.cite" ar={ar} />
        </div>
        <LaborArticleCite ruleId="hours.ot.premium" ar={ar} showText showChip={false} />
        <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.75 }}>
          {ar
            ? `الساعات مشتقّة من الجدول المنشور مقابل سقف 98/99/رمضان. العطل والأعياد كلها إضافي. الافتراضي ${premium}. الإجازة التعويضية تحتاج موافقة مسجّلة. سقف السنة ${formatRuleFigure(cap, "hours", ar)} (اللائحة 22).`
            : `Hours are derived from the published rota against the 98/99/Ramadan cap. Rest-day and Eid hours are all overtime. Default is ${premium}. Compensatory leave needs recorded consent. Annual cap ${formatRuleFigure(cap, "hours", false)} (regs Art. 22).`}
        </span>
      </div>
      {visible.map((row) => (
        <div key={row.employee.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${SW.row}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {!mine ? (
            <span style={{ fontSize: 13, fontWeight: 600 }}>{row.employee.name}</span>
          ) : null}
          <span style={{ fontSize: 11, color: SW.muted }}>
            {ar
              ? `إضافي هذا الأسبوع ${hm(row.pack.totalHours)}${row.pack.plannedHours ? ` (منها ${hm(row.pack.plannedHours)} مخطط لم يُعمل بعد)` : ""} · السنوي المعتمد ${row.ytd} / ${cap} ساعة`
              : `Overtime this week ${hm(row.pack.totalHours)}${row.pack.plannedHours ? ` (${hm(row.pack.plannedHours)} planned, not worked yet)` : ""} · approved YTD ${row.ytd} / ${cap} h`}
          </span>
          {row.decided.map((item) => {
            const key = `${row.employee.id}:${item.dateKey}`;
            const saved = item.decision;
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderTop: `1px solid ${SW.hair}` }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{item.dateKey} · <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{hm(item.overtimeHours)}</span></span>
                  <RightHint
                    ar={ar}
                    onDate={item.dateKey}
                    hint={attRightHint(item.kind === "holiday" ? "holidayWork" : "overtime", {
                      date: item.dateKey,
                      hours: item.overtimeHours,
                      worked: !!item.proven || !item.status.planned,
                      yearHours: row.ytd,
                      consented: !!saved,
                    }, { view: mine ? "employee" : "manager", today: asOf, ar, employee: row.employee })}
                  />
                </span>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.7 }}>{item.label}</span>
                {item.status.planned && !saved ? (
                  <span data-ot-planned="1" style={{ fontSize: 11, color: SW.ink, lineHeight: 1.7 }}>
                    <span style={{ fontWeight: 600, padding: "1px 8px", border: `1px solid ${SW.line}`, borderRadius: 999, marginInlineEnd: 6 }}>
                      {ar ? PLANNED_OT_LABEL_AR : PLANNED_OT_LABEL_EN}
                    </span>
                    {item.status.payable
                      ? (ar ? "لا حضور يثبته — يُصرف إن عُمل، أو يُغلق «لم يُعمل»." : "No punches prove it — paid if it was worked, or closed as «not worked».")
                      : (ar ? "من الجدول المنشور — لا يُصرف قبل أن يُعمل ويثبته الحضور والانصراف." : "From the published roster — not payable until worked and proven by the punches.")}
                  </span>
                ) : null}
                {item.proven && !saved ? (
                  <span data-ot-proven={item.status.ordered ? "ordered" : "punch"} style={{ fontSize: 11, color: SW.ink, lineHeight: 1.7 }}>
                    {item.status.ordered
                      ? (ar ? "بتكليف معتمد أو دوام عطلة مجدول، والحضور والانصراف يثبتانها — تُصرف أو تُعوَّض بإجازة، ولا تُغلق «لم يُعمل»." : "Under an approved assignment or a rostered holiday, proven by the punches — paid or taken as compensatory leave, never closed «not worked».")
                      : (ar ? "مسجّلة من بصمة الانصراف بلا تكليف — قرارك: صرف، أو إجازة تعويضية بموافقة العامل، أو «لم يُعمل» بسبب مكتوب يصله وله الاعتراض عليه." : "Recorded from the checkout with no assignment — your call: pay, compensatory leave with consent, or «not worked» with a written reason he receives and may object to.")}
                  </span>
                ) : null}
                {item.open?.decision === "pending_worker_cap_consent" ? (
                  mine ? (
                    <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
                      <span style={{ color: SW.gold }}>{ar ? `يُطلب موافقتك على تجاوز سقف ${formatRuleFigure(cap, "hours", ar)} في السنة.` : `Your consent to pass the annual ${formatRuleFigure(cap, "hours", false)} cap is requested.`}</span>
                      <button type="button" data-ot-cap-accept="1" onClick={() => answerCap(item.dateKey, true)} style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "5px 10px", border: "1px solid var(--nv-btn-fill)", background: "var(--nv-btn-fill)", color: "var(--nv-btn-ink)", cursor: "pointer", borderRadius: 10 }}>{ar ? "أوافق" : "I consent"}</button>
                      <button type="button" onClick={() => answerCap(item.dateKey, false)} style={{ fontFamily: "inherit", fontSize: 11, padding: "5px 10px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, cursor: "pointer", borderRadius: 10 }}>{ar ? "لا أوافق" : "I decline"}</button>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: SW.gold }}>{ar ? "بانتظار موافقة العامل على تجاوز السقف السنوي." : "Awaiting the worker's consent to pass the annual cap."}</span>
                  )
                ) : null}
                {saved ? (
                  <span style={{ fontSize: 11, color: SW.green }}>
                    {saved.decision === "comp_leave"
                      ? (ar ? "إجازة تعويضية بموافقة مسجّلة" : "Compensatory leave with recorded consent")
                      : saved.decision === "reject"
                        ? (saved.notWorked
                          ? (saved.rejectReason
                            ? (ar ? `أُغلق «لم يُعمل» — ${saved.rejectReason}` : `Closed «not worked» — ${saved.rejectReason}`)
                            : (ar ? "أُغلق — العمل المخطط لم يُعمل" : "Closed — the planned work was not done"))
                          : (ar ? "رُفض الصرف — الساعات مسجّلة" : "Pay rejected — hours stay recorded"))
                        : (ar ? `${premium} — معتمد للمسير` : `${premium} — approved for payroll`)}
                  </span>
                ) : mine ? (
                  item.status.planned && !item.status.payable ? null : (
                    <span style={{ fontSize: 11, color: SW.gold }}>{ar ? "بانتظار قرار المسؤول" : "Awaiting the manager's decision"}</span>
                  )
                ) : canEdit && item.status.planned && !item.status.payable && !item.status.closable ? null
                : canEdit && item.open?.decision !== "pending_worker_cap_consent" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {item.status.payable ? (<>
                    <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={consent[key] === true}
                        onChange={(e) => setConsent((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {ar ? "موافقة العامل مسجّلة (للإجازة التعويضية)" : "Worker's consent on file (for compensatory leave)"}
                    </label>
                    {row.ytd + item.overtimeHours > cap && item.open?.decision !== "pending_worker_cap_consent" ? (
                      <span style={{ fontSize: 11, color: SW.mid }}>
                        {ar
                          ? `يتجاوز سقف السنة ${formatRuleFigure(cap, "hours", ar)} — يُطلب من العامل نفسه الموافقة.`
                          : `Passes the annual ${formatRuleFigure(cap, "hours", false)} cap — the worker himself is asked to consent.`}
                      </span>
                    ) : null}
                    <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {ar ? "موعد التمتع" : "Take-by date"}
                      <input
                        type="date"
                        value={enjoyDate[key] || ""}
                        onChange={(e) => setEnjoyDate((prev) => ({ ...prev, [key]: e.target.value }))}
                        style={{ fontFamily: "inherit", fontSize: 11, padding: "4px 6px", border: `1px solid ${SW.line}`, background: SW.card }}
                      />
                    </label>
                    <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={windowAgreed[key] === true}
                        onChange={(e) => setWindowAgreed((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {ar ? "اتُفق على موعد أبعد من 60 يوماً" : "A later date than 60 days was agreed"}
                    </label>
                    <button
                      type="button"
                      disabled={busy === key}
                      onClick={() => decide(row.employee.id, item.dateKey, "approve", item.overtimeMinutes, [item.kind])}
                      style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 10px", border: "1px solid var(--nv-btn-fill)", background: "var(--nv-btn-fill)", color: "var(--nv-btn-ink)", cursor: "pointer", borderRadius: 10 }}
                    >
                      {premium}
                    </button>
                    </>) : null}
                    {item.status.closable && item.status.needsReason ? (
                      <input
                        data-ot-not-worked-reason="1"
                        value={notWorkedWhy[key] || ""}
                        onChange={(e) => setNotWorkedWhy((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={ar ? "سبب «لم يُعمل» — يصل للعامل" : "Why «not worked» — the worker receives it"}
                        style={{ fontFamily: "inherit", fontSize: 11, padding: "5px 8px", minWidth: 220, flex: "1 1 220px", border: `1px solid ${SW.line}`, borderRadius: 8, background: SW.card, color: SW.ink }}
                      />
                    ) : null}
                    {item.status.closable ? (
                      <button
                        type="button"
                        data-ot-not-worked="1"
                        disabled={busy === key || (item.status.needsReason && String(notWorkedWhy[key] || "").trim().length < 3)}
                        onClick={() => decide(row.employee.id, item.dateKey, "reject", item.overtimeMinutes, [item.kind])}
                        style={{ fontFamily: "inherit", fontSize: 11, padding: "6px 10px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.mid, cursor: "pointer" }}
                      >
                        {ar ? "لم يُعمل — إغلاق" : "Not worked — close"}
                      </button>
                    ) : null}
                    {item.status.payable ? (
                    <button
                      type="button"
                      disabled={busy === key}
                      onClick={() => decide(row.employee.id, item.dateKey, "comp_leave", item.overtimeMinutes, [item.kind])}
                      style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 10px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, cursor: "pointer" }}
                    >
                      {ar ? "إجازة تعويضية" : "Compensatory leave"}
                    </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
