import React, { useState } from "react";
import { cutLeaveForAttendance } from "@/lib/store";
import { daysAr, planLeaveCutForAttendance } from "@/lib/leaveCut";
import { leaveTypeLabel } from "@/lib/leaveTypes";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { useAuth } from "@/lib/PowerCareAuth";
import { chargeableLeaveDays } from "@/lib/leaveDerivations";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";

/**
 * Shown when check-in stops on an approved leave day: the worker who is at work may cut the leave
 * from today (Art. 151's mandatory weeks excepted). Two steps — the offer, then a confirmation.
 */
export default function LeaveCutOffer({ ar = true, companyId, employee, onDone }) {
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useAuth();
  const day = toRiyadhDateKey();
  const plan = planLeaveCutForAttendance(employee, day, {
    chargeable: (start, end, type) => chargeableLeaveDays(start, end, type, laborCalendarOf(data), data, employee),
  });
  if (!plan.ok && plan.error === "NO_LEAVE") return null;
  if (!plan.ok) {
    return <p data-leave-cut="blocked" style={{ margin: 0, fontSize: 11.5, color: "var(--nv-bad-ink)", lineHeight: 1.7 }}>{ar ? plan.reason : plan.reasonEn}</p>;
  }
  const label = leaveTypeLabel(plan.type, ar);
  const box = { display: "flex", flexDirection: "column", gap: 6, padding: "9px 11px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", fontSize: 12, lineHeight: 1.7, flex: "1 1 100%" };
  const btn = (primary) => ({ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 34, padding: "0 14px", borderRadius: 6, cursor: "pointer", border: `1px solid ${primary ? "#0B3D27" : "var(--nv-line)"}`, background: primary ? "#0B3D27" : "var(--nv-card)", color: primary ? "#fff" : "var(--nv-ink)" });
  return (
    <div data-leave-cut="1" style={box}>
      {!confirm ? (
        <>
          <span>{ar ? `أنت في إجازة معتمدة (${label}). إن كنت على رأس العمل فاقطعها من اليوم، ثم سجّل حضورك.` : `You are on approved leave (${label}). If you are at work, cut it from today, then check in.`}</span>
          <button type="button" style={{ ...btn(false), alignSelf: "flex-start" }} onClick={() => setConfirm(true)}>
            {ar ? "أنا على رأس العمل — اقطع إجازتي من اليوم" : "I'm at work — cut my leave from today"}
          </button>
        </>
      ) : (
        <>
          <span>
            {plan.whole
              ? (ar ? `تُلغى الإجازة كلها (${daysAr(plan.freedDays)}) وتعود إلى رصيدك.` : `The whole leave (${plan.freedDays} days) is cancelled and returns to your balance.`)
              : (ar ? `تبقى ${daysAr(plan.keptDays)} إجازة حتى أمس، ويعود ${daysAr(plan.freedDays)} إلى رصيدك. يصل إشعار لمسؤولك.` : `${plan.keptDays} days stay leave up to yesterday; ${plan.freedDays} days return to your balance. Your manager is told.`)}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} style={btn(true)} onClick={() => {
              setBusy(true);
              const res = cutLeaveForAttendance(companyId, employee.id, { day, actorId: employee.id });
              setBusy(false);
              if (!res.ok) { setMsg(ar ? res.reason : res.reasonEn); return; }
              setMsg(ar ? "قُطعت الإجازة — سجّل حضورك الآن." : "Leave cut — check in now.");
              onDone?.();
            }}>{ar ? "أكّد القطع" : "Confirm"}</button>
            <button type="button" style={btn(false)} onClick={() => setConfirm(false)}>{ar ? "تراجع" : "Back"}</button>
          </div>
        </>
      )}
      {msg ? <span style={{ fontWeight: 600 }}>{msg}</span> : null}
    </div>
  );
}
