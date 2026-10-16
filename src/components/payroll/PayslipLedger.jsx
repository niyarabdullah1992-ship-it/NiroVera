import React from "react";
import { Printer } from "lucide-react";
import { contributoryWage, employeeWageSplit, inKindOf, moneySar } from "@/lib/employeeFileView";
import { allowanceLedger, HOSPITAL_FAR_MINUTES, siteConditions } from "@/lib/allowanceKinds";
import { gosiLine } from "@/lib/payrollDerivations";
import { payrollSaudiFlag } from "@/lib/payrollWageSync";
import { readGosiRegisteredAt } from "@/lib/facts";
import { printSheet } from "@/lib/printSheet";
import { otMonthBreakdown } from "@/lib/otOffer";
import { parseOtHours } from "@/lib/overtimeAssignment";
import { chip, mono, SectionHead, slab, sourceBadge } from "@/components/schedules/scheduleChrome";
import { FileRow } from "@/components/employees/EmployeeFileFieldCard";
import RightHint from "@/components/shared/RightHint";
import { payHintFor, slipRowHint } from "@/lib/rightHints.pay";

/**
 * قسيمتي on the employee file and on the payslip page: the month as the file sets it (base, every
 * allowance by name, GOSI share, net), each allowance with its basis and how the wage rules treat it,
 * and what the work site obliges. The wage run (locked attendance) stays the paying record — this is
 * the file's reading of it, labelled as an estimate where it is one.
 */

const DK = { bg: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", soft: "#C5DBCD", faint: "#A9CDB8", line: "rgba(255,255,255,.14)", gold: "#C8A45A" };
const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };
const GROUP = { fixed: ["ثابتة بالعقد", "Fixed by contract"], site: ["من موقع العمل", "From the work site"], night: ["العمل الليلي", "Night work"], variable: ["متغيّرة شهرياً", "Changes monthly"] };

export function payslipFromFile(employee, ar = true) {
  const profile = employee?.profile || {};
  const wage = employeeWageSplit(profile, employee);
  const ledger = allowanceLedger(wage, ar);
  const saudiFlag = payrollSaudiFlag(employee);
  const quote = gosiLine(
    {
      base: wage.base,
      allowances: wage.allowances,
      housingAllowance: wage.split ? wage.housing : undefined,
      commissionAmount: wage.commission || 0,
    },
    { saudi: saudiFlag !== false, registeredAt: readGosiRegisteredAt(employee) },
  );
  const unknownNationality = saudiFlag !== true && saudiFlag !== false;
  const gosiEmployee = saudiFlag === true && !quote.blocked ? quote.employeeShare : 0;
  return {
    wage,
    ledger,
    inKind: inKindOf(profile),
    contributory: contributoryWage(wage, saudiFlag !== false),
    quote,
    saudi: saudiFlag,
    unknownNationality,
    gosiEmployee,
    gross: ledger.cash,
    net: Math.max(0, ledger.cash - gosiEmployee),
  };
}

function gosiNote(slip, ar) {
  if (slip.unknownNationality) return ar ? "لا حسم قبل ثبوت الجنسية في الملف" : "No share until nationality is on file";
  if (slip.saudi === false) return ar ? "غير سعودي: لا حصة على الموظف — 2% أخطار مهنية على صاحب العمل" : "Non-Saudi: no employee share — 2% hazards paid by the employer";
  if (slip.quote.blocked) return ar ? slip.quote.reason : slip.quote.reasonEn;
  const pct = Math.round((slip.quote.employeeRate || 0) * 10000) / 100;
  return ar ? `حصة الموظف ${pct}% على الأجر الخاضع ${moneySar(slip.quote.base, ar)}` : `Employee share ${pct}% of the contributory wage ${moneySar(slip.quote.base, ar)}`;
}

export function printPayslipSheet({ employee, slip, ar, monthLabel, stationName, otRows = [] }) {
  printSheet({
    ar,
    kicker: ar ? "قسيمتي · تقدير من ملف الموظف" : "My payslip · estimate from the file",
    title: employee?.name || "—",
    subtitle: monthLabel || "",
    ref: employee?.profile?.employeeNumber || employee?.id || "",
    status: { label: ar ? "تقدير" : "Estimate", tone: "warn" },
    facts: [
      { label: ar ? "الإجمالي" : "Gross", value: moneySar(slip.gross, ar), mono: true },
      { label: ar ? "خصم التأمينات" : "GOSI share", value: moneySar(slip.gosiEmployee, ar), mono: true },
      { label: ar ? "الصافي التقديري" : "Estimated net", value: moneySar(slip.net, ar), mono: true },
      { label: ar ? "الأجر الخاضع للتأمينات" : "Contributory wage", value: moneySar(slip.contributory, ar), mono: true },
      { label: ar ? "الفرع" : "Branch", value: stationName || "" },
      { label: ar ? "ساعة الإضافي ≈" : "OT hour ≈", value: moneySar(slip.ledger.otHour, ar), mono: true },
    ],
    blocks: [{
      type: "table",
      heading: ar ? "البنود" : "Lines",
      cols: [ar ? "البند" : "Line", ar ? "المبلغ" : "Amount", ar ? "السند" : "Basis", ar ? "التأمينات" : "GOSI"],
      monoCols: [1],
      nowrapCols: [1, 2],
      rows: [
        [ar ? "الأجر الأساسي" : "Base wage", moneySar(slip.ledger.base, ar), ar ? "م 2" : "Art. 2", ar ? "خاضع" : "Contributory"],
        ...slip.ledger.rows.map((r) => [r.name, moneySar(r.amount, ar), r.cite, r.gosiText]),
        ...otRows.map((r) => [r.label, r.info ? r.valueText : moneySar(r.amount, ar), ar ? "م 107" : "Art. 107", r.info ? (ar ? "بلا مبلغ" : "No amount") : (ar ? "غير خاضع" : "Not contributory")]),
        [ar ? "خصم التأمينات" : "GOSI share", `- ${moneySar(slip.gosiEmployee, ar)}`, ar ? "نظام التأمينات" : "GOSI", gosiNote(slip, ar)],
      ],
    }],
    note: ar
      ? "تقدير من بنود الأجر على الملف. القسيمة النهائية تصدر من المسير بعد إقفال الحضور، ويُدفع الأجر عبر حماية الأجور (المادة 90)."
      : "An estimate from the wage lines on file. The final slip comes from the run after attendance locks; the wage is paid through wage protection (Art. 90).",
  });
}

/** The month as the file sets it — a dark head with the net, then every line by name. */
/**
 * This month's approved overtime assignments on the estimate: the ones taken as pay are added to gross
 * and net (no GOSI on overtime), the ones taken as leave are shown with no amount.
 */
export function estimateOvertime(employee, month, base, allowances, ar = true) {
  const m = String(month || "").slice(0, 7);
  const paid = (employee?.otherRequests || []).filter((row) => row?.type === "overtime" && (row.assignment === true || row.source === "assignment")
    && row.status === "approved" && (row.compensation || row.compensationChoice) === "pay" && String(row.date || "").slice(0, 7) === m);
  const hours = paid.reduce((s, row) => s + (parseOtHours(row.hours) || 0), 0);
  const bd = otMonthBreakdown({ employee, month: m, totalHours: hours, totalPay: 0, base, allowances, ar });
  const rows = bd.rows.filter((r) => r.info || (r.id !== "ot" && r.amount > 0));
  const pay = Math.round(rows.filter((r) => !r.info).reduce((s, r) => s + r.amount, 0) * 100) / 100;
  return { rows, pay };
}

export function PayslipEstimateCard({ employee, ar = true, monthLabel = "", stationName = "", note = null, month = "", view = "employee" }) {
  const base0 = payslipFromFile(employee, ar);
  const ot = estimateOvertime(employee, month || new Date().toISOString().slice(0, 7), base0.ledger.base, Math.max(0, base0.ledger.cash - base0.ledger.base), ar);
  const slip = ot.pay ? { ...base0, gross: base0.gross + ot.pay, net: base0.net + ot.pay } : base0;
  const lines = [
    { id: "base", name: ar ? "الأجر الأساسي" : "Base wage", amount: slip.ledger.base },
    ...slip.ledger.rows.map((r) => ({ id: `al-${r.id}`, name: r.name, amount: r.amount, why: r.why })),
    ...ot.rows.map((r) => ({ id: r.id, name: r.label, amount: r.amount, info: r.info, valueText: r.valueText, hours: r.hours, why: r.source })),
  ];
  // «حقك» per line where the law protects it: the wage (due date / WPS), overtime (107), GOSI share.
  const hintCtx = { view, ar, name: employee?.name || "", employeeId: employee?.id, net: slip.net, base: slip.ledger.base, allowances: Math.max(0, slip.ledger.cash - slip.ledger.base) };
  return (
    <section data-payslip-estimate="1" style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <header style={{ background: DK.bg, color: "#fff", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: DK.faint }}>
            <span aria-hidden style={{ width: 12, height: 2, background: DK.gold, borderRadius: 8 }} />
            {ar ? `قسيمتي${monthLabel ? ` · ${monthLabel}` : ""}` : `My payslip${monthLabel ? ` · ${monthLabel}` : ""}`}
          </span>
          <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: "rgba(200,164,90,.18)", color: "#F3E3BC", border: "1px solid rgba(200,164,90,.5)" }}>
            {ar ? "تقدير من الملف" : "Estimate from the file"}
          </span>
          <button
            type="button"
            data-payslip-print="1"
            onClick={() => printPayslipSheet({ employee, slip, ar, monthLabel, stationName, otRows: ot.rows })}
            style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
          >
            <Printer size={14} aria-hidden />
            {ar ? "طباعة" : "Print"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11.5, color: DK.faint }}>{ar ? "الصافي التقديري" : "Estimated net"}</span>
            <strong style={{ ...MONO, fontSize: 30, fontWeight: 700, lineHeight: 1.05 }}>{moneySar(slip.net, ar)}</strong>
          </span>
          <span style={{ flex: 1 }} />
          {[
            [ar ? "الإجمالي" : "Gross", slip.gross],
            [ar ? "خصم التأمينات" : "GOSI share", slip.gosiEmployee],
            [ar ? "الأجر الخاضع" : "Contributory", slip.contributory],
          ].map(([label, v]) => (
            <span key={label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span style={{ fontSize: 11, color: DK.faint }}>{label}</span>
              <strong style={{ ...MONO, fontSize: 15, fontWeight: 700 }}>{moneySar(v, ar)}</strong>
            </span>
          ))}
        </div>
      </header>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {lines.map((line) => (
          <li key={line.id} data-payslip-line={line.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", alignItems: "center" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{line.name}</strong>
                <RightHint ar={ar} hint={slipRowHint({ id: line.id, amount: line.amount, hours: line.hours }, hintCtx)} />
              </span>
              {line.why ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>{line.why}</span> : null}
            </span>
            {line.info
              ? <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ok-ink, #2F6B43)", whiteSpace: "nowrap" }}>{line.valueText}</span>
              : <span style={{ ...MONO, fontSize: 13.5, fontWeight: 700, color: "var(--nv-ink)" }}>{moneySar(line.amount, ar)}</span>}
          </li>
        ))}
        <li data-payslip-line="gosi" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", alignItems: "center", background: "var(--nv-soft)" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "خصم التأمينات — المعاشات وساند" : "GOSI — annuities and SANED"}</strong>
              {slip.gosiEmployee ? <RightHint ar={ar} hint={payHintFor("gosi", { ...hintCtx, amount: slip.gosiEmployee })} /> : null}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.6 }}>{gosiNote(slip, ar)}</span>
          </span>
          <span style={{ ...MONO, fontSize: 13.5, fontWeight: 700, color: "var(--nv-ink)" }}>{slip.gosiEmployee ? `- ${moneySar(slip.gosiEmployee, ar)}` : moneySar(0, ar)}</span>
        </li>
      </ol>
      <p style={{ margin: 0, padding: "10px 18px 12px", fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>
        {note || (ar
          ? "تقدير من ملفك — القسيمة النهائية من المسير بعد إقفال الحضور."
          : "An estimate from your file — the final slip comes from the run once attendance locks.")}
      </p>
    </section>
  );
}

/** Every allowance by name: why it is paid, its basis, and where GOSI, end of service, leave pay and overtime count it. */
export function AllowanceLedgerCard({ employee, ar = true }) {
  const slip = payslipFromFile(employee, ar);
  const { ledger } = slip;
  const head = { fontSize: 11, fontWeight: 600, color: "var(--nv-muted)", padding: "8px 12px", textAlign: "start", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", whiteSpace: "nowrap" };
  const cell = { fontSize: 12, padding: "10px 12px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", textAlign: "start", color: "var(--nv-ink2)", verticalAlign: "top" };
  const groups = ["fixed", "site", "night", "variable"].map((g) => ({ g, rows: ledger.rows.filter((r) => r.group === g) })).filter((x) => x.rows.length);
  return (
    <section data-file-allowances="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHead
        title={ar ? "البدلات بأنواعها وأثرها النظامي" : "Allowances by kind and how the rules count them"}
        note={ar ? "كل بدل على الملف باسمه وسببه وسنده — المادة 2 تجعله من الأجر الفعلي، ودليل التأمينات يحدّد ما يخضع للاشتراك." : "Each allowance on file by name, reason and basis — Art. 2 makes it part of the actual wage; the GOSI guide sets what is contributory."}
        trailing={(
          <span style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--nv-muted)" }}>
            <span>{ar ? "الأجر الفعلي" : "Actual wage"} <strong style={{ ...MONO, color: "var(--nv-ink)" }}>{moneySar(ledger.cash + (slip.inKind.monthly || 0), ar)}</strong></span>
            <span>{ar ? "الخاضع للتأمينات" : "Contributory"} <strong style={{ ...MONO, color: "var(--nv-ink)" }}>{moneySar(slip.contributory, ar)}</strong></span>
            <span>{ar ? "ساعة الإضافي ≈" : "OT hour ≈"} <strong style={{ ...MONO, color: "var(--nv-ink)" }}>{moneySar(ledger.otHour, ar)}</strong></span>
          </span>
        )}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={head}>{ar ? "البدل" : "Allowance"}</th>
              <th style={head}>{ar ? "المبلغ" : "Amount"}</th>
              <th style={head}>{ar ? "السند" : "Basis"}</th>
              <th style={head}>{ar ? "التأمينات" : "GOSI"}</th>
              <th style={head}>{ar ? "نهاية الخدمة · م 84" : "End of service · 84"}</th>
              <th style={head}>{ar ? "أجر الإجازة · م 109" : "Leave pay · 109"}</th>
              <th style={head}>{ar ? "الإضافي · م 107" : "Overtime · 107"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...cell, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "الأجر الأساسي" : "Base wage"}</td>
              <td style={cell}><span style={MONO}>{moneySar(ledger.base, ar)}</span></td>
              <td style={cell}><span style={sourceBadge({ direction: "rtl" })}>{ar ? "م 2" : "Art. 2"}</span></td>
              <td style={cell}><span style={chip("ok")}>{ar ? "خاضع" : "Contributory"}</span></td>
              <td style={cell}><span style={chip("ok")}>{ar ? "يدخل" : "Counts"}</span></td>
              <td style={cell}><span style={chip("ok")}>{ar ? "يدخل" : "Counts"}</span></td>
              <td style={cell}><span style={chip("ok")}>{ar ? "أساس الـ50٪" : "Base of the 50%"}</span></td>
            </tr>
            {!ledger.rows.length ? (
              <tr><td colSpan={7} style={{ ...cell, color: "var(--nv-muted)" }}>{ar ? "لا بدلات على الملف — تُضاف من «العقد والأجر» عند تحرير الملف." : "No allowances on file — add them under Contract and wage while editing the file."}</td></tr>
            ) : null}
            {groups.map(({ g, rows }) => (
              <React.Fragment key={g}>
                <tr><td colSpan={7} style={{ ...cell, padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#0B3D27", background: "var(--nv-ok-soft)" }}>{ar ? GROUP[g][0] : GROUP[g][1]}</td></tr>
                {rows.map((row) => (
                  <tr key={row.id} data-allowance={row.id}>
                    <td style={cell}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong style={{ color: "var(--nv-ink)", fontSize: 12.5 }}>{row.name}</strong>
                        <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 }}>{row.why}</span>
                      </span>
                    </td>
                    <td style={cell}><span style={MONO}>{moneySar(row.amount, ar)}</span></td>
                    <td style={cell}><span style={sourceBadge({ direction: "rtl" })}>{row.cite}</span></td>
                    <td style={cell}><span style={chip(row.gosi ? "ok" : "mute")}>{row.gosiText}</span></td>
                    <td style={cell}><span style={chip(/^(يدخل|Counts)$/.test(row.eos) ? "ok" : "warn")}>{row.eos}</span></td>
                    <td style={cell}><span style={chip("ok")}>{row.leave}</span></td>
                    <td style={cell}><span style={chip("mute")}>{row.ot}</span></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {slip.inKind.monthly > 0 ? (
              <tr data-allowance="inkind">
                <td style={cell}><strong style={{ color: "var(--nv-ink)", fontSize: 12.5 }}>{ar ? "ميزات عينية" : "In-kind benefits"}</strong></td>
                <td style={cell}><span style={MONO}>{moneySar(slip.inKind.monthly, ar)}</span></td>
                <td style={cell}><span style={sourceBadge({ direction: "rtl" })}>{ar ? "م 2/5" : "Art. 2/5"}</span></td>
                <td style={cell}><span style={chip("mute")}>{ar ? "غير خاضع" : "Not contributory"}</span></td>
                <td style={cell}><span style={chip("ok")}>{ar ? "يدخل" : "Counts"}</span></td>
                <td style={cell}><span style={chip("mute")}>{ar ? "لا تُصرف نقداً" : "Not paid in cash"}</span></td>
                <td style={cell}><span style={chip("mute")}>{ar ? "لا يدخل" : "Excluded"}</span></td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, padding: "10px 18px 12px", fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>
        {ar
          ? "الأجر الفعلي = الأساسي + البدلات والعمولات والميزات العينية (المادة 2)، وعليه تُحسب المكافأة (84) وأجر الإجازة (109). الخاضع للتأمينات = الأساسي + بدل السكن + العمولات، بحد أدنى 1,500 وأعلى 45,000 (دليل صاحب العمل). ساعة الإضافي = أجر الساعة + 50٪ من أجر الساعة الأساسي (107) — تقدير على 30 يوماً × 8 ساعات. مبالغ البدلات من العقد؛ النظام يُلزم في المواقع البعيدة بالخدمات نفسها (146–148) ويجوز البدل النقدي عنها بالعقد."
          : "Actual wage = base + allowances, commission and in-kind benefits (Art. 2); end of service (84) and leave pay (109) use it. Contributory = base + housing + commissions, floor 1,500, ceiling 45,000 (employer guide). An overtime hour = hourly wage + 50% of the basic hourly wage (107) — estimated on 30 × 8 hours. Amounts come from the contract; at remote sites the law obliges the services themselves (146–148), and a cash allowance may stand in by contract."}
      </p>
    </section>
  );
}

/** Where the work is: minutes to the nearest hospital, remote from towns or not, and what that obliges. */
export function SiteConditionsCard({ employee, station = {}, ar = true, editing = false, draft = {}, onDraft, canEdit = false }) {
  const profile = { ...(employee?.profile || {}), ...(editing ? Object.fromEntries(Object.entries(draft || {}).filter(([k]) => ["hospitalMinutes", "remoteSite", "mealsProvided", "medicalOnSite"].includes(k))) : {}) };
  const wage = employeeWageSplit(employee?.profile || {}, employee);
  const site = siteConditions({ profile, station, wage, nightWorker: wage.night > 0 });
  const yesNo = [{ value: "yes", label: ar ? "نعم" : "Yes" }, { value: "no", label: ar ? "لا" : "No" }];
  const asYesNo = (v) => (v === true || /^(yes|true|1|نعم)$/i.test(String(v ?? "")) ? "yes" : v === false || /^(no|false|0|لا)$/i.test(String(v ?? "")) ? "no" : "");
  const label = (v) => (asYesNo(v) === "yes" ? (ar ? "نعم" : "Yes") : asYesNo(v) === "no" ? (ar ? "لا" : "No") : "—");
  const rows = [
    { k: ar ? "أقرب مستشفى (بالدقائق)" : "Nearest hospital (minutes)", field: canEdit ? "hospitalMinutes" : "", type: "number", raw: profile.hospitalMinutes ?? "", v: site.minutes == null ? "—" : (ar ? `${site.minutes} دقيقة${profile.hospitalMinutes == null && station.hospitalMinutes != null ? " · من الفرع" : ""}` : `${site.minutes} min`), locked: !canEdit },
    { k: ar ? "موقع بعيد عن العمران" : "Remote from towns", field: canEdit ? "remoteSite" : "", raw: asYesNo(profile.remoteSite), options: yesNo, v: `${label(profile.remoteSite ?? station.remoteSite)}${profile.remoteSite == null && station.remoteness?.known ? ` · ${ar ? station.remoteness.reasonAr : station.remoteness.reasonEn}` : ""}`, locked: !canEdit },
    { k: ar ? "عيادة أو مسعف في الموقع" : "Clinic or medic on site", field: canEdit ? "medicalOnSite" : "", raw: asYesNo(profile.medicalOnSite), options: yesNo, v: label(profile.medicalOnSite ?? station.medicalOnSite), locked: !canEdit },
    { k: ar ? "وجبات مؤمَّنة" : "Meals provided", field: canEdit ? "mealsProvided" : "", raw: asYesNo(profile.mealsProvided), options: yesNo, v: label(profile.mealsProvided ?? station.mealsProvided), locked: !canEdit },
  ];
  return (
    <section data-site-conditions="1" style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SectionHead
        title={ar ? "ظروف موقع العمل وما تُلزم به" : "Work-site conditions and what they oblige"}
        note={ar
          ? `يُفعَّل التزام الترتيبات الطبية متى زاد بُعد أقرب مستشفى على ${HOSPITAL_FAR_MINUTES} دقيقة (معيار المنشأة) أو كان الموقع بعيداً عن العمران — والبعيد عن العمران (اللائحة م30) ما زاد على 50 كم عن النطاق العمراني بطريق معبّد أو 25 كم بغير معبّد، أو تجمع بلا مرافق وخدمات؛ يُسجَّل على الفرع في «السلامة ← التفتيش والجاهزية».`
          : `Medical duties switch on when the nearest hospital is past ${HOSPITAL_FAR_MINUTES} minutes (establishment criterion) or the site is remote — Regs Art. 30: over 50 km from the urban boundary by paved road or 25 km unpaved, or a cluster without services; recorded on the branch under Safety → Inspection.`}
        trailing={site.duties.length ? (
          <span style={chip(site.open ? "warn" : "ok")}>{site.open ? (ar ? `${site.open} التزام بلا تغطية` : `${site.open} duty uncovered`) : (ar ? "الالتزامات مغطّاة" : "Duties covered")}</span>
        ) : null}
      />
      <div>
        {rows.map((r) => (
          <FileRow key={r.k} row={{ ...r, hasChip: false }} editing={editing} draft={draft} onDraft={onDraft} ar={ar} />
        ))}
      </div>
      {site.duties.length ? (
        <ol style={{ listStyle: "none", margin: 0, padding: "10px 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {site.duties.map((d) => (
            <li key={d.id} data-site-duty={d.id} data-met={d.met ? "1" : "0"} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "9px 12px", borderRadius: 10, border: `1px solid ${d.met ? "var(--nv-ok-line)" : "var(--nv-warn-line)"}`, background: d.met ? "var(--nv-ok-soft)" : "var(--nv-warn-soft)" }}>
              <RightHint ar={ar} hint={payHintFor("siteDuty", { view: canEdit ? "manager" : "employee", ar, duty: d, employeeId: employee?.id, name: employee?.name || "" })} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", lineHeight: 1.6 }}>{ar ? d.ar : d.en}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: d.met ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)", whiteSpace: "nowrap" }}>
                {d.met ? (ar ? `مغطّى · ${d.howAr}` : `Covered · ${d.howEn}`) : (ar ? "يحتاج تغطية — خدمة أو بدل" : "Needs cover — a service or an allowance")}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ margin: 0, padding: "10px 18px 14px", fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
          {site.known
            ? (ar ? "الموقع قريب من الخدمات — لا التزامات إضافية من المواد 146 إلى 148." : "The site is near services — no extra duties from Arts. 146–148.")
            : (ar ? "لم يُسجَّل بُعد أقرب مستشفى ولا طبيعة الموقع — سجّلهما ليُعرف ما يستحقه الموظف من خدمات أو بدلات." : "Hospital distance and site type are not recorded — record them to see what services or allowances apply.")}
        </p>
      )}
    </section>
  );
}
