import React, { useState } from "react";
import { nv7Tab } from "@/components/shared/Nv7SectionHead";
import { ruleValue } from "@/lib/laborRules";
import { eosGratuity, eosResignationFraction } from "@/lib/offboardingDerivations";

/*
 * «جرّب القاعدة» — the claim "the law runs by itself", made checkable: the visitor types a wage and
 * moves one slider, and the page answers with the figure, the formula and the article. Every number
 * comes from the platform's own rule catalogue (ruleValue) and derivations — nothing is typed here.
 */

const G = "#0B3D27";
const FILL = "#3C7D50";
const LINE = "#E4E9E6";
const INK = "#111418";
const MID = "#555C66";
const HEAD = "var(--font-heading, 'Readex Pro','IBM Plex Sans Arabic',sans-serif)";
const MONO = { fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontVariantNumeric: "tabular-nums" };

const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt0 = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

const CASES = [
  { id: "late", ar: "تأخّر عن الدوام", en: "Late arrival", unitAr: "دقيقة تأخير", unitEn: "minutes late", min: 1, max: 120, start: 23 },
  { id: "ot", ar: "عمل إضافي", en: "Overtime", unitAr: "ساعات إضافية", unitEn: "overtime hours", min: 1, max: 12, start: 3 },
  { id: "eos", ar: "نهاية الخدمة", en: "End of service", unitAr: "سنوات الخدمة", unitEn: "years of service", min: 1, max: 30, start: 7 },
];

function derive(id, wage, n, resigned) {
  const dayHours = ruleValue("hours.shift.ordinaryHours");
  const hour = wage / 30 / dayHours;
  if (id === "late") {
    return {
      value: (hour / 60) * n,
      digits: 2,
      formula: `${fmt0(wage)} ÷ 30 ÷ ${dayHours} ÷ 60 × ${n}`,
      refAr: "أجر الوقت الذي لم يُعمل فيه", refEn: "Pay for time not worked",
      noteAr: "يُحسم أجر دقائق التأخير الفعلية فقط، ويرى الموظف المعادلة نفسها.",
      noteEn: "Only the actual late minutes are deducted, and the employee sees the same formula.",
    };
  }
  if (id === "ot") {
    const premium = ruleValue("hours.ot.premium");
    return {
      value: hour * premium * n,
      digits: 2,
      formula: `${fmt0(wage)} ÷ 30 ÷ ${dayHours} × ${premium} × ${n}`,
      refAr: "نظام العمل · م 107", refEn: "Labour Law · Art. 107",
      noteAr: "أجر الساعة مضافاً إليه 50% من الأجر الأساسي (المثال يعدّ الأجر كله أساسياً).",
      noteEn: "The hourly wage plus 50% of basic pay (the example treats the whole wage as basic).",
    };
  }
  const full = eosGratuity(n, wage);
  const fraction = resigned ? eosResignationFraction(n) : 1;
  const firstYears = Math.min(n, 5);
  const restYears = Math.max(0, n - 5);
  const fractionLabel = fraction === 1 ? "" : fraction === 0 ? " × 0" : fraction < 0.5 ? " × ⅓" : " × ⅔";
  return {
    value: full * fraction,
    digits: 0,
    formula: `(${firstYears} × ½ + ${restYears}) × ${fmt0(wage)}${fractionLabel}`,
    refAr: resigned ? "نظام العمل · م 84 · 85" : "نظام العمل · م 84", refEn: resigned ? "Labour Law · Art. 84 · 85" : "Labour Law · Art. 84",
    noteAr: resigned
      ? "في الاستقالة: لا شيء قبل سنتين، ثم الثلث، ثم الثلثان، وكاملة بعد عشر سنوات."
      : "نصف شهر عن كل سنة من الخمس الأولى، وشهر عن كل سنة بعدها.",
    noteEn: resigned
      ? "On resignation: nothing before two years, then a third, then two thirds, and in full after ten."
      : "Half a month for each of the first five years, and a month for every year after.",
  };
}

export default function RuleLab({ ar }) {
  const T = (a, e) => (ar ? a : e);
  const [caseId, setCaseId] = useState("late");
  const [wage, setWage] = useState(6000);
  const [amounts, setAmounts] = useState(() => Object.fromEntries(CASES.map((c) => [c.id, c.start])));
  const [resigned, setResigned] = useState(false);
  const active = CASES.find((c) => c.id === caseId);
  const n = amounts[caseId];
  const safeWage = Math.min(100000, Math.max(0, Number(wage) || 0));
  const out = derive(caseId, safeWage, n, resigned);
  const control = { height: 40, borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff", fontFamily: "inherit", fontSize: 14, color: INK, padding: "0 12px", width: "100%" };

  return (
    <section id="lab" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: "0 1px 2px rgba(12,20,16,.06)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3 style={{ margin: 0, fontFamily: HEAD, fontSize: 17, fontWeight: 700, color: INK }}>{T("جرّب القاعدة بنفسك", "Try a rule yourself")}</h3>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: MID }}>{T("اكتب أجراً وحرّك المؤشر: الرقم والمعادلة والمادة تخرج من سجل قواعد المنصة نفسه.", "Type a wage and move the slider: the figure, the formula and the article come from the platform's own rule catalogue.")}</p>
      </div>
      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CASES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === caseId} onClick={() => setCaseId(c.id)} style={nv7Tab(c.id === caseId)}>{T(c.ar, c.en)}</button>
        ))}
      </div>
      <div data-nv="lab">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: MID }}>
            {T("الأجر الشهري (ريال)", "Monthly wage (SAR)")}
            <input type="number" inputMode="numeric" min={0} max={100000} step={100} value={wage} onChange={(e) => setWage(e.target.value)} dir="ltr" style={{ ...control, ...MONO, textAlign: "start" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: MID }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              {T(active.unitAr, active.unitEn)}
              <strong dir="ltr" style={{ ...MONO, fontSize: 15, color: G }}>{n}</strong>
            </span>
            <input type="range" min={active.min} max={active.max} step={1} value={n} onChange={(e) => setAmounts((prev) => ({ ...prev, [caseId]: Number(e.target.value) }))} style={{ width: "100%", accentColor: FILL }} />
          </label>
          {caseId === "eos" ? (
            <div role="radiogroup" aria-label={T("سبب انتهاء العلاقة", "Reason the contract ended")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[[false, "انتهاء العقد", "Contract ended"], [true, "استقالة", "Resignation"]].map(([val, la, le]) => (
                <button key={la} type="button" role="radio" aria-checked={resigned === val} onClick={() => setResigned(val)} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: resigned === val ? 700 : 500, border: resigned === val ? "none" : "1px solid #D5DCD8", background: resigned === val ? FILL : "#fff", color: resigned === val ? "#fff" : "#3A4048" }}>{T(la, le)}</button>
              ))}
            </div>
          ) : null}
        </div>
        <div aria-live="polite" style={{ background: "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)", borderRadius: 12, padding: "18px 20px", color: "#fff", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: "#E2C57E" }}>
            <span aria-hidden style={{ width: 12, height: 2, background: "#C8A45A", borderRadius: 8 }} />
            {T(out.refAr, out.refEn)}
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <strong dir="ltr" style={{ ...MONO, fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>{fmt(out.value, out.digits)}</strong>
            <span style={{ fontSize: 14, color: "#C5DBCD" }}>{T("ريال", "SAR")}</span>
          </span>
          <span style={{ ...MONO, display: "block", direction: "ltr", unicodeBidi: "isolate", fontSize: 13, color: "#C5DBCD", textAlign: ar ? "right" : "left" }}>{out.formula}</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.8, color: "#DCEAE1", borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 8, marginTop: 2 }}>{T(out.noteAr, out.noteEn)}</span>
        </div>
      </div>
    </section>
  );
}
