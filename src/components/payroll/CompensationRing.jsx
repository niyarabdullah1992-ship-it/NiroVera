import React, { useMemo, useState } from "react";
import { estimateOvertime, payslipFromFile } from "@/components/payroll/PayslipLedger";
import { lineOvertimePay } from "@/lib/payrollDerivations";
import { moneySar } from "@/lib/employeeFileView";
import { slab } from "@/components/schedules/scheduleChrome";

/**
 * «تكوين راتبي» — the wage as one ring: base and every allowance on the file, each slice its share
 * of the actual wage (Art. 2). Hover or focus a slice to read it; click it to land on its row in the
 * allowance ledger. Monthly by default, yearly on request. Figures derive from the file — nothing typed.
 */

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };
// one restrained family: the platform green and its tints, gold for housing — the one allowance GOSI counts
const PALETTE = ["#0B3D27", "#C8A45A", "#3F8A64", "#8FC3A6", "#2E6A4B", "#C9DFD1", "#6FA98A", "#E3C98C"];
const R = 70;
const STROKE = 22;
const C = 2 * Math.PI * R;

/**
 * Every component that reaches the slip: the fixed wage from the file (base, each named allowance,
 * in-kind) and this month's extra pay — overtime (the run's line, or approved paid assignments while
 * the run is not ready), bonus and commission on the line. Extra pay is monthly by nature, so the
 * yearly view multiplies only the fixed part and says so.
 */
export function compensationSlices(employee, ar = true, { line = null, month = "" } = {}) {
  const slip = payslipFromFile(employee, ar);
  const fixed = [
    { id: "base", name: ar ? "الأجر الأساسي" : "Base wage", amount: slip.ledger.base, cite: ar ? "م 2" : "Art. 2" },
    ...slip.ledger.rows.map((r) => ({ id: r.id, name: r.name, amount: r.amount, cite: r.cite })),
  ];
  if (slip.inKind.monthly > 0) fixed.push({ id: "inkind", name: ar ? "ميزات عينية" : "In-kind benefits", amount: slip.inKind.monthly, cite: ar ? "م 2/5" : "Art. 2/5" });
  const extra = [];
  const overtime = line ? lineOvertimePay(line) : (month ? estimateOvertime(employee, month, slip.wage.base, slip.wage.allowances, ar).pay : 0);
  if (overtime > 0) extra.push({ id: "overtime", name: ar ? "العمل الإضافي" : "Overtime", amount: overtime, cite: ar ? "م 107" : "Art. 107", variable: true });
  const bonus = Number(line?.bonus) || 0;
  if (bonus > 0) extra.push({ id: "bonus", name: ar ? "مكافأة" : "Bonus", amount: bonus, cite: ar ? "م 2" : "Art. 2", variable: true });
  const lineCommission = Number(line?.commissionAmount) || 0;
  if (lineCommission > 0 && !fixed.some((r) => r.id === "commission")) extra.push({ id: "commission", name: ar ? "عمولة" : "Commission", amount: lineCommission, cite: ar ? "م 2" : "Art. 2", variable: true });
  const rows = [...fixed, ...extra].filter((r) => r.amount > 0);
  const fixedTotal = fixed.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const extraTotal = extra.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const total = fixedTotal + extraTotal;
  return {
    total,
    fixedTotal,
    extraTotal,
    contributory: slip.contributory,
    gosiEmployee: slip.gosiEmployee,
    slices: rows.map((r, i) => ({ ...r, color: PALETTE[i % PALETTE.length], share: total ? r.amount / total : 0 })),
  };
}

export default function CompensationRing({ employee, ar = true, line = null, month = "", onViewAll, onHistory }) {
  const [period, setPeriod] = useState("month");
  const [hot, setHot] = useState("");
  const all = useMemo(() => compensationSlices(employee, ar, { line, month }), [employee, ar, line, month]);
  const yearly = period === "year";
  // yearly: the fixed wage × 12 — extra pay is earned month by month and is not projected
  const slices = useMemo(() => {
    if (!yearly) return all.slices;
    const rows = all.slices.filter((s) => !s.variable);
    return rows.map((s) => ({ ...s, share: all.fixedTotal ? s.amount / all.fixedTotal : 0 }));
  }, [all, yearly]);
  const total = yearly ? all.fixedTotal : all.total;
  const { contributory, gosiEmployee, extraTotal } = all;
  const k = yearly ? 12 : 1;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const active = slices.find((s) => s.id === hot) || null;
  const centerAmount = active ? active.amount * k : total * k;
  const centerLabel = active ? active.name : (period === "year" ? (ar ? "الأجر الفعلي في السنة" : "Actual wage a year") : (ar ? "الأجر الفعلي في الشهر" : "Actual wage a month"));

  const seg = (on) => ({ fontFamily: "inherit", height: 26, padding: "0 10px", borderRadius: 7, fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: "pointer", border: `1px solid ${on ? "#0B3D27" : "var(--nv-line)"}`, background: on ? "#0B3D27" : "var(--nv-card)", color: on ? "#fff" : "var(--nv-ink2)" });
  const jump = (id) => {
    const variable = slices.find((s) => s.id === id)?.variable;
    const el = (variable ? document.querySelector("[data-my-payslip] [data-payslip-board], [data-my-payslip] section") : null)
      || document.querySelector(id === "base" ? "[data-file-allowances]" : `[data-allowance="${id}"]`) || document.querySelector("[data-file-allowances]");
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    if (onViewAll && !el) onViewAll();
  };

  let offset = 0;
  return (
    <section data-comp-ring="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 10px", borderBottom: "1px solid var(--nv-line2)", flexWrap: "wrap" }}>
        <span aria-hidden style={{ width: 14, height: 2, background: "#C8A45A", borderRadius: 2, flexShrink: 0 }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 160px", minWidth: 0 }}>
          <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "تكوين راتبي" : "How my pay is made"}</strong>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>{ar ? "الأساسي وكل بدل على ملفك بحصته من الأجر الفعلي — المادة 2." : "Base and every allowance on your file, as a share of the actual wage — Art. 2."}</span>
        </span>
        <div role="radiogroup" aria-label={ar ? "المدة" : "Period"} style={{ display: "inline-flex", gap: 4 }}>
          <button type="button" role="radio" aria-checked={period === "month"} data-comp-period="month" onClick={() => setPeriod("month")} style={seg(period === "month")}>{ar ? "شهري" : "Monthly"}</button>
          <button type="button" role="radio" aria-checked={period === "year"} data-comp-period="year" onClick={() => setPeriod("year")} style={seg(period === "year")}>{ar ? "سنوي" : "Yearly"}</button>
        </div>
        {onHistory ? (
          <button type="button" data-comp-history="1" onClick={onHistory} title={ar ? "أرشيف قسيمتي" : "My payslip archive"} aria-label={ar ? "أرشيف قسيمتي" : "My payslip archive"} style={{ fontFamily: "inherit", width: 28, height: 28, borderRadius: 7, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink2)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></svg>
          </button>
        ) : null}
      </div>

      {!total ? (
        <p style={{ margin: 0, padding: "18px", fontSize: 12.5, color: "var(--nv-muted)" }}>{ar ? "لا أجر على ملفك بعد — يُعبَّأ من «العقد والأجر» في الملف." : "No wage on your file yet — it is filled under Contract and wage."}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 14, padding: "14px 18px 6px", alignItems: "center" }}>
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label={`${centerLabel} ${moneySar(centerAmount, ar)}`} style={{ maxWidth: "100%", overflow: "visible" }} onMouseLeave={() => setHot("")}>
              <circle cx="100" cy="100" r={R} fill="none" stroke="var(--nv-soft, #F1F4F2)" strokeWidth={STROKE} />
              <g transform="rotate(-90 100 100)">
                {slices.map((s) => {
                  const len = s.share * C;
                  const dash = `${Math.max(0, len - 1.2)} ${C - Math.max(0, len - 1.2) + 1.2}`;
                  const el = (
                    <circle
                      key={s.id}
                      data-comp-slice={s.id}
                      cx="100" cy="100" r={R}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={hot === s.id ? STROKE + 6 : STROKE}
                      strokeDasharray={dash}
                      strokeDashoffset={-offset}
                      style={{ transition: "stroke-width .16s ease, opacity .16s ease", opacity: hot && hot !== s.id ? 0.45 : 1, cursor: "pointer" }}
                      tabIndex={0}
                      onMouseEnter={() => setHot(s.id)}
                      onFocus={() => setHot(s.id)}
                      onBlur={() => setHot("")}
                      onClick={() => jump(s.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(s.id); } }}
                    >
                      <title>{`${s.name} · ${moneySar(s.amount * k, ar)} · ${pct(s.share)}`}</title>
                    </circle>
                  );
                  offset += len;
                  return el;
                })}
              </g>
            </svg>
            <div aria-hidden style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, pointerEvents: "none", textAlign: "center", padding: "0 44px" }}>
              <strong data-comp-center="1" style={{ ...MONO, fontSize: centerAmount >= 1000000 ? 17 : 20, color: "var(--nv-ink)", lineHeight: 1 }}>{Math.round(centerAmount).toLocaleString("en-US")}</strong>
              <span style={{ fontSize: 10.5, color: "var(--nv-muted)", lineHeight: 1.4 }}>{active ? `${centerLabel} · ${pct(active.share)}` : centerLabel}</span>
            </div>
          </div>

          <ul data-comp-legend="1" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {slices.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  data-comp-legend-row={s.id}
                  onMouseEnter={() => setHot(s.id)}
                  onMouseLeave={() => setHot("")}
                  onFocus={() => setHot(s.id)}
                  onBlur={() => setHot("")}
                  onClick={() => jump(s.id)}
                  style={{ fontFamily: "inherit", width: "100%", display: "grid", gridTemplateColumns: "10px minmax(0,1fr) auto auto", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8, border: "1px solid transparent", background: hot === s.id ? "var(--nv-soft, #F1F4F2)" : "transparent", color: "var(--nv-ink)", cursor: "pointer", textAlign: "start" }}
                >
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                  <span style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}{s.variable ? <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{ar ? " · هذا الشهر" : " · this month"}</span> : null}</span>
                  <span style={{ ...MONO, fontSize: 12, color: "var(--nv-ink)" }}>{Math.round(s.amount * k).toLocaleString("en-US")}</span>
                  <span style={{ ...MONO, fontSize: 11, color: "var(--nv-muted)", minWidth: 34, textAlign: "end" }}>{pct(s.share)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "10px 18px 14px", borderTop: "1px solid var(--nv-line2)", fontSize: 11.5, color: "var(--nv-muted)" }}>
        <span>{ar ? "الخاضع للتأمينات" : "Contributory"} <strong style={{ ...MONO, color: "var(--nv-ink)" }}>{moneySar(contributory * k, ar)}</strong></span>
        {gosiEmployee > 0 ? <span>{ar ? "حصتك" : "Your share"} <strong style={{ ...MONO, color: "var(--nv-ink)" }}>{moneySar(gosiEmployee * k, ar)}</strong></span> : null}
        {yearly && extraTotal > 0 ? <span data-comp-year-note="1">{ar ? "الإضافي والمكافآت تُكسب شهراً بشهر فلا تُسقَط على السنة." : "Overtime and bonus are earned month by month and are not projected."}</span> : null}
        <button type="button" data-comp-view-all="1" onClick={() => jump("base")} style={{ fontFamily: "inherit", marginInlineStart: "auto", height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "#0B3D27", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {ar ? "كل البدلات وأثرها ›" : "All allowances and their effect ›"}
        </button>
      </div>
    </section>
  );
}
