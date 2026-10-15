import React, { useState } from "react";
import { ART139_GROUNDS, disabilityOutcome, gosiInjuryWageMode, injuryStatus } from "@/lib/workInjury";
import { employeeWageSplit, moneySar } from "@/lib/employeeFileView";
import { setWorkInjuryArt139, setWorkInjuryHospitalDays, setWorkInjuryOutcome } from "@/lib/store";
import { toRiyadhDateKey } from "@/lib/riyadhDate";

/**
 * Work-injury facts beside a request (management) or on the file: who pays (Art. 132),
 * where the treatment day count stands (Art. 137), the one-year mark and the Art. 138 figure,
 * and the Art. 139 finding — written, with a reason, and reversible.
 */
export default function WorkInjuryPanel({ row, employee, data, companyId, ar = true, canDecide = false, by = "", onChanged }) {
  const person = employee || row?.employee;
  const wage = employeeWageSplit(person?.profile || {}, person).total;
  const status = injuryStatus({ employee: person, company: data, today: toRiyadhDateKey(), monthlyWage: wage });
  const covered = status ? status.covered : (data?.hoursPolicy?.gosiOccupationalHazards === "no" ? false : data?.hoursPolicy?.gosiOccupationalHazards === "yes" ? true : null);
  const [ground, setGround] = useState(row?.art139 || "");
  const [reason, setReason] = useState(row?.art139Reason || "");
  const [error, setError] = useState("");
  const [hospital, setHospital] = useState(String(row?.hospitalDays ?? ""));
  const [outKind, setOutKind] = useState(row?.outcome?.kind || "");
  const [outPct, setOutPct] = useState(String(row?.outcome?.percent || ""));
  const [outCare, setOutCare] = useState(!!row?.outcome?.needsCare);
  const [endContract, setEndContract] = useState(false);
  const saudi = /سعود|saudi/i.test(String(person?.profile?.nationality || person?.nationality || ""));
  const outcome = outKind ? disabilityOutcome({ covered, saudi, kind: outKind, percent: Number(outPct) || 0, monthlyWage: wage, needsCare: outCare }) : null;
  const control = { fontFamily: "inherit", fontSize: 12, padding: "6px 8px", border: "1px solid var(--nv-line)", borderRadius: 6, background: "var(--nv-card)" };
  const saveBtn = { alignSelf: "flex-start", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer" };
  const box = { display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-soft, #F7F9F8)", fontSize: 11.5, lineHeight: 1.8, color: "var(--nv-ink2)" };
  const strong = { color: "var(--nv-ink)", fontWeight: 700 };
  const approved = (row?.status || "") === "approved";
  return (
    <div data-work-injury="1" style={box}>
      <span>
        <span style={strong}>{ar ? "من يعوّض: " : "Who compensates: "}</span>
        {covered === false
          ? (ar ? "صاحب العمل — المنشأة غير مسجّلة في الأخطار المهنية. العلاج كله عليه (المادة 133)." : "The employer — not in GOSI occupational hazards. All treatment is on the employer (Art. 133).")
          : (ar ? `التأمينات الاجتماعية — فرع الأخطار المهنية (المادة 132). بلّغ التأمينات بالإصابة${covered === null ? " · لم يُحدَّد التسجيل في سياسة الحضور" : ""}.` : `GOSI occupational hazards (Art. 132). Report the injury to GOSI${covered === null ? " · coverage not set in the attendance policy" : ""}.`)}
      </span>
      {status ? (
        <span>
          <span style={strong}>{ar ? "يوم العلاج: " : "Treatment day: "}</span>
          <span dir="ltr">{status.dayIndex}</span>
          {covered === false
            ? (ar
              ? ` — ${status.phase === "full" ? `أجر كامل حتى ${status.fullUntil}، ثم 75٪` : status.phase === "reduced" ? "75٪ من الأجر (بعد اليوم 60)" : "بلغ سنة علاج"} (المادة 137).`
              : ` — ${status.phase === "full" ? `full pay until ${status.fullUntil}, then 75%` : status.phase === "reduced" ? "75% of the wage (after day 60)" : "one year of treatment reached"} (Art. 137).`)
            : (ar ? " — التعويض اليومي يصرفه نظام التأمينات." : " — the daily compensation is paid under the Social Insurance Law.")}
        </span>
      ) : null}
      {!status && covered === false && row?.startDate ? (
        <span>
          {(() => {
            const start = String(row.startDate).slice(0, 10);
            const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 59);
            const y = new Date(`${start}T00:00:00Z`); y.setUTCDate(y.getUTCDate() + 365);
            return ar
              ? `عند الاعتماد: أجر كامل حتى ${d.toISOString().slice(0, 10)}، ثم 75٪ من الأجر طوال العلاج (المادة 137). عند ${y.toISOString().slice(0, 10)} — سنة علاج — يُعدّ عجزاً كلياً (المادة 138).`
              : `On approval: full pay until ${d.toISOString().slice(0, 10)}, then 75% throughout treatment (Art. 137). At ${y.toISOString().slice(0, 10)} — a year of treatment — it is total disability (Art. 138).`;
          })()}
        </span>
      ) : null}
      {status && covered === false ? (
        <span style={{ color: status.phase === "year" ? "var(--nv-bad-ink, #8A1C2B)" : "inherit", fontWeight: status.phase === "year" ? 700 : 400 }}>
          {ar
            ? `عند ${status.yearMark} (سنة علاج) أو تقرير بعدم احتمال الشفاء: عجز كلي — ينتهي العقد ويُعوَّض أجر ثلاث سنوات ${moneySar(status.total138, true)} بحد أدنى 54,000 (المادة 138)، ولا يُسترد ما دُفع خلال السنة.`
            : `At ${status.yearMark} (a year of treatment) or a finding of no recovery: total disability — the contract ends with three years' wage ${moneySar(status.total138, false)}, at least 54,000 (Art. 138); nothing paid in that year is recovered.`}
        </span>
      ) : null}
      {canDecide && approved && covered !== false ? (
        <div data-injury-hospital="1" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 6, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
          <span style={strong}>{ar ? "أيام التنويم على نفقة التأمينات" : "Hospital days at GOSI's expense"}</span>
          <input dir="ltr" value={hospital} onChange={(e) => setHospital(e.target.value)} style={{ ...control, width: 70 }} />
          <button type="button" style={saveBtn} onClick={() => { setWorkInjuryHospitalDays(companyId, person?.id, row.id, hospital, by); onChanged?.(); }}>{ar ? "احفظ" : "Save"}</button>
          <span style={{ fontSize: 11 }}>
            {ar
              ? `البدل اليومي 100٪ من الأجر اليومي و75٪ أيام التنويم — ${gosiInjuryWageMode(data) === "stop" ? "الأجر موقوف أيام الإصابة" : "المنشأة تواصل الأجر"}.`
              : `Daily allowance 100% of the daily wage, 75% in hospital — ${gosiInjuryWageMode(data) === "stop" ? "wage stopped on injury days" : "the establishment keeps the wage"}.`}
          </span>
        </div>
      ) : null}
      {covered !== false ? (() => {
        const reported = row.gosiReportedAt;
        const st = row.gosiStatus || (reported ? "pending" : "");
        const injured = String(row.injuryDate || row.eventDate || row.startDate || "").slice(0, 10);
        const due = injured ? new Date(Date.parse(`${injured}T00:00:00Z`) + 10 * 86400000).toISOString().slice(0, 10) : "";
        const word = { pending: ar ? "بانتظار قرار التأمينات" : "awaiting GOSI", approved: ar ? "اعتمدتها التأمينات" : "approved by GOSI", rejected: ar ? "رفضتها التأمينات" : "rejected by GOSI" }[st] || "";
        return (
          <span data-injury-gosi="1" style={{ fontSize: 11.5, color: reported ? "inherit" : "var(--nv-warn-ink, #8A5A12)", paddingTop: 6, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
            {reported
              ? (ar ? `أُبلغت التأمينات في ${reported}${row.gosiRef ? ` — مرجع ${row.gosiRef}` : ""} · ${word}.` : `Reported to GOSI on ${reported}${row.gosiRef ? ` — ref ${row.gosiRef}` : ""} · ${word}.`)
              : (ar ? `لم يُسجَّل إبلاغ التأمينات بعد — المهلة حتى ${due} (عشرة أيام). يُسجَّل في الرواتب ← التأمينات ← متابعة التأمينات.` : `No GOSI report recorded yet — due by ${due} (ten days). Record it in Payroll → GOSI → follow-up.`)}
          </span>
        );
      })() : null}
      {canDecide && approved ? (
        <div data-injury-outcome="1" style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
          <span style={strong}>{ar ? "النتيجة الدائمة — بقرار اللجنة الطبية" : "Permanent outcome — by the medical committee"}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={outKind} onChange={(e) => setOutKind(e.target.value)} style={control}>
              <option value="">{ar ? "لا نتيجة دائمة بعد" : "No permanent outcome yet"}</option>
              <option value="partial">{ar ? "عجز دائم جزئي" : "Partial permanent disability"}</option>
              <option value="total">{ar ? "عجز دائم كلي" : "Total permanent disability"}</option>
              <option value="death">{ar ? "وفاة" : "Death"}</option>
            </select>
            {outKind === "partial" ? (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {ar ? "نسبة العجز ٪" : "Disability %"}
                <input dir="ltr" value={outPct} onChange={(e) => setOutPct(e.target.value)} style={{ ...control, width: 70 }} />
              </label>
            ) : null}
            {outKind && outKind !== "death" && covered !== false ? (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={outCare} onChange={(e) => setOutCare(e.target.checked)} />
                {ar ? "يحتاج معونة الغير" : "Needs care assistance"}
              </label>
            ) : null}
          </div>
          {outcome ? (
            <span data-injury-figure="1" style={{ color: "var(--nv-ink)" }}>
              {outcome.belowThreshold
                ? (ar ? "دون 50٪: يحدده قرار التأمينات — لا تقدير هنا." : "Under 50%: set by GOSI's decision — no estimate here.")
                : outcome.regime === "labour"
                  ? (ar ? `التعويض على صاحب العمل: ${moneySar(outcome.lump, true)} دفعة واحدة (المادة 138${outKind === "partial" ? " — نسبة العجز × تعويض الكلي" : " — أجر ثلاث سنوات بحد أدنى 54,000"}).` : `Employer compensation: ${moneySar(outcome.lump, false)} lump sum (Art. 138).`)
                  : outcome.monthly
                    ? (ar ? `من التأمينات: عائدة شهرية تقديرية ${moneySar(outcome.monthly, true)}${outcome.care ? ` منها معونة الغير ${moneySar(outcome.care, true)}` : ""}.` : `From GOSI: an estimated monthly pension ${moneySar(outcome.monthly, false)}.`)
                    : (ar ? `من التأمينات: دفعة واحدة تقديرية ${moneySar(outcome.lump, true)} (غير سعودي — بسقف ${outKind === "partial" ? "165,000" : "330,000"}).` : `From GOSI: an estimated lump sum ${moneySar(outcome.lump, false)} (non-Saudi).`)}
              {outcome.regime === "gosi" && !outcome.belowThreshold ? (ar ? " تقدير للتخطيط — القرار للتأمينات." : " A planning estimate — GOSI decides.") : ""}
            </span>
          ) : null}
          {outcome?.endsContract ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={endContract} onChange={(e) => setEndContract(e.target.checked)} />
              {ar ? "أنهِ العقد الآن — المادة 79 (وفاة العامل أو عجزه بشهادة طبية)" : "End the contract now — Art. 79"}
            </label>
          ) : null}
          <button
            type="button"
            style={saveBtn}
            onClick={() => {
              setWorkInjuryOutcome(companyId, person?.id, row.id, { kind: outKind, percent: Number(outPct) || 0, needsCare: outCare, figure: outcome, endContract, by });
              onChanged?.();
            }}
          >
            {ar ? "سجّل النتيجة" : "Record the outcome"}
          </button>
        </div>
      ) : row?.outcome?.kind ? (
        <span style={{ fontWeight: 600 }}>
          {ar ? `النتيجة: ${{ total: "عجز دائم كلي", partial: `عجز دائم جزئي ${row.outcome.percent}٪`, death: "وفاة" }[row.outcome.kind]}` : `Outcome: ${row.outcome.kind}`}
        </span>
      ) : null}
      {canDecide && approved && covered === false ? (
        <div data-art139="1" style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
          <span style={strong}>{ar ? "سقوط الحق — المادة 139" : "Loss of the right — Art. 139"}</span>
          <select value={ground} onChange={(e) => setGround(e.target.value)} style={{ fontFamily: "inherit", fontSize: 12, padding: "6px 8px", border: "1px solid var(--nv-line)", borderRadius: 6, background: "var(--nv-card)" }}>
            <option value="">{ar ? "لا — الحق قائم" : "No — the right stands"}</option>
            {ART139_GROUNDS.map((g) => <option key={g.key} value={g.key}>{ar ? g.ar : g.en}</option>)}
          </select>
          {ground ? (
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? "السبب والمستند — إلزامي" : "Reason and evidence — required"} style={{ fontFamily: "inherit", fontSize: 12, padding: "6px 8px", border: "1px solid var(--nv-line)", borderRadius: 6 }} />
          ) : null}
          {error ? <span style={{ color: "var(--nv-bad-ink, #8A1C2B)" }}>{error}</span> : null}
          <button
            type="button"
            onClick={() => {
              const res = setWorkInjuryArt139(companyId, person?.id, row.id, { ground, reason, by });
              if (!res.ok) { setError(ar ? res.reason || "تعذّر الحفظ." : res.reasonEn || "Could not save."); return; }
              setError("");
              onChanged?.();
            }}
            style={{ alignSelf: "flex-start", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer" }}
          >
            {ar ? "احفظ القرار" : "Save the finding"}
          </button>
          <span style={{ fontSize: 11 }}>{ar ? "عند السقوط تُحسب أيام هذه الإجازة بلا معونة في المسير، ويُبلَّغ الموظف ويُسجَّل في ملفه." : "When it falls, this leave's days carry no compensation in payroll; the worker is told and it is logged on the file."}</span>
        </div>
      ) : row?.art139 ? (
        <span style={{ color: "var(--nv-bad-ink, #8A1C2B)", fontWeight: 600 }}>
          {ar ? `سقط الحق (المادة 139): ${row.art139Reason || ""}` : `Right lost (Art. 139): ${row.art139Reason || ""}`}
        </span>
      ) : null}
    </div>
  );
}
