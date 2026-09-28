import React, { useMemo, useState } from "react";
import { Check, Info, Shield } from "lucide-react";
import { checkArticle93Gate, gosiLine, lineComponents, OT_RATE } from "@/lib/payrollDerivations";
import { registrationForPayroll } from "@/lib/facts";
import { contractAllowanceSplit, employeeWageSplit } from "@/lib/employeeFileView";
import { payrollSaudiFlag } from "@/lib/payrollWageSync";
import { citeRule } from "@/lib/laborRules";
import { MUTED, NAVY, field, ui, CARD, BORDER } from "@/lib/platformStyles";

const EDGE = {
  net: "#3C7D50",
  gross: "#0B3D27",
  deduct: "#C8A45A",
};

const TONE = {
  ok: { labelAr: "✓ مستقر", labelEn: "✓ Steady", color: "#2F6B43", background: "#E6F2EA" },
  warn: { labelAr: "! تنبيه", labelEn: "! Alert", color: "#8A5A12", background: "#FBF3E1" },
  bad: { labelAr: "× مخالفة", labelEn: "× Breach", color: "#9B2335", background: "#F8E8EB" },
  na: { labelAr: "— بلا أثر", labelEn: "— No effect", color: "#555C66", background: "#F2F5F3" },
};

function sarDigits(n) {
  return Math.abs(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function sarAfter(n) {
  return `${sarDigits(n)} SAR`;
}

function sarBefore(n, minus) {
  return minus ? `SAR ${sarDigits(n)} -` : `SAR ${sarDigits(n)}`;
}

function depositHint(item, ar) {
  const raw = item?.paid && item?.paidAt ? String(item.paidAt).slice(0, 10) : "";
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    const stamp = `${day}-${month}-${year}`;
    if (!ar) return `Deposited ${stamp} via Mudad`;
    return (
      <>
        يُودع <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{stamp}</span> عبر مدد
      </>
    );
  }
  if (item?.paid) return ar ? "صُرف عبر مدد" : "Paid via Mudad";
  return ar ? "يُودع في موعده عبر مدد" : "Deposited on time via Mudad";
}

function StatTile({ label, value, hint, edge, ink }) {
  return (
    <div style={{ flex: "1 1 180px", minWidth: 0, padding: "14px 16px 12px", borderRadius: 12, border: `1px solid ${BORDER}`, borderTop: `3px solid ${edge}`, background: CARD }}>
      <div style={{ fontSize: 12, color: MUTED }}>{label}</div>
      <div dir="ltr" style={{ marginTop: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700, color: ink, textAlign: "end", lineHeight: 1.15 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function RoundCheck({ on, onClick, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        border: on ? "none" : "1.5px solid #C5CDC8",
        background: on ? "#3C7D50" : "#fff",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {on ? <Check size={12} strokeWidth={3} /> : null}
    </button>
  );
}

export function slipRows(item, employee, parts, ar, month) {
  const profile = employee?.profile || {};
  const profileWage = employeeWageSplit(profile, employee);
  const stored = contractAllowanceSplit({
    housingAllowance: item?.housingAllowance,
    transportAllowance: item?.transportAllowance,
    otherAllowances: item?.otherAllowances,
  }, parts.allowances);
  const wage = profileWage.split ? profileWage : (stored ? {
    ...profileWage,
    housing: stored.housing,
    transport: stored.transport,
    other: stored.other,
    split: true,
  } : profileWage);
  const base = Number(parts.base) || 0;
  const lineAllow = Number(parts.allowances) || 0;
  const rows = [{
    id: "base",
    label: ar ? "الأجر الأساسي" : "Base wage",
    amount: base,
    source: ar ? "عقد العمل الموثّق في قوى" : "Qiwa employment contract",
  }];
  const profileSum = (wage.housing || 0) + (wage.transport || 0) + (wage.other || 0) + (wage.night || 0);
  const canSplit = wage.split && lineAllow > 0 && Math.abs(profileSum - lineAllow) <= 1;
  const showNamed = canSplit || lineAllow === 0;
  if (showNamed) {
    const quarter = base > 0 && wage.housing > 0 && Math.abs(wage.housing / base - 0.25) < 0.015;
    rows.push({
      id: "housing",
      label: ar ? "بدل السكن" : "Housing",
      amount: wage.housing || 0,
      source: quarter
        ? (ar ? "عقد العمل · 25% من الأساسي" : "Contract · 25% of base")
        : (ar ? "عقد العمل" : "Employment contract"),
    });
    rows.push({
      id: "transport",
      label: ar ? "بدل النقل" : "Transport",
      amount: wage.transport || 0,
      source: ar ? "عقد العمل" : "Employment contract",
    });
    rows.push({
      id: "other",
      label: ar ? "بدلات أخرى" : "Other allowances",
      amount: wage.other || 0,
      source: ar ? "عقد العمل" : "Employment contract",
    });
    if (wage.night > 0) {
      rows.push({
        id: "night",
        label: wage.nightKind === "transport" ? (ar ? "بدل نقل ليلي" : "Night transport") : (ar ? "أجر ليلي" : "Night pay"),
        amount: wage.night,
        source: ar ? "قرار الجدول · القرار 18632" : "Roster decision · 18632",
      });
    }
  } else if (lineAllow > 0) {
    rows.push({
      id: "allowances",
      label: ar ? "البدلات" : "Allowances",
      amount: lineAllow,
      source: ar ? "عقد العمل" : "Employment contract",
    });
  }
  if ((Number(parts.bonus) || 0) > 0) {
    rows.push({
      id: "bonus",
      label: ar ? "مكافأة" : "Bonus",
      amount: parts.bonus,
      source: ar ? "اعتماد المسير" : "Run approval",
    });
  }
  const otHours = Math.max(0, Number(parts.overtimeHours) || 0);
  const pct = Math.round((OT_RATE - 1) * 100);
  rows.push({
    id: "ot",
    label: ar ? `أجر إضافي — ${otHours} ساعات` : `Overtime — ${otHours} hours`,
    amount: Number(parts.overtimePay) || 0,
    source: ar ? `الحضور المقفل · المادة 107 (+${pct}%)` : `Locked attendance · Art. 107 (+${pct}%)`,
  });
  const registeredAt = registrationForPayroll(employee, item);
  const gosiQuote = gosiLine(item, {
    saudi: item?.isSaudi === true,
    onDate: month || item?.gosiAsOf || item?.month,
    registeredAt,
  });
  if (parts.gosiEmployee || item?.isSaudi === true || gosiQuote.blocked) {
    const source = gosiQuote.blocked
      ? (ar ? gosiQuote.reason : gosiQuote.reasonEn)
      : gosiQuote.subscriberClass === "old"
        ? (ar ? "نظام التأمينات · مشترك قديم" : "GOSI · old subscriber")
        : gosiQuote.subscriberClass === "new"
          ? (ar ? "نظام التأمينات · مشترك جديد" : "GOSI · new subscriber")
          : (ar ? "نظام التأمينات · على الأجر الخاضع" : "GOSI · on the contributory wage");
    rows.push({
      id: "gosi",
      label: ar ? "خصم التأمينات — المعاشات والساند" : "GOSI — pension and SANED",
      amount: gosiQuote.blocked ? 0 : (parts.gosiEmployee || 0),
      minus: !gosiQuote.blocked,
      blocked: gosiQuote.blocked,
      source,
    });
  }
  if ((Number(parts.deductions) || 0) > 0) {
    rows.push({
      id: "deduct",
      label: ar ? "خصومات بسند" : "Documented deductions",
      amount: parts.deductions,
      minus: true,
      source: ar ? "المادة 92 · بسند مكتوب" : "Art. 92 · written instrument",
    });
  }
  return rows;
}

function statuteText(ruleId, ar) {
  const cite = citeRule(ruleId);
  if (!cite) return "";
  return ar ? (cite.textAr || cite.hintAr) : (cite.textEn || cite.hintEn);
}

function deductionGuard(item) {
  const gate = checkArticle93Gate(item);
  const lines = (item?.deductionLines || []).filter((line) => Number(line?.amount) > 0);
  const amount = Number(item?.deductions) || 0;
  const missingInstrument = amount > 0 && lines.length === 0;
  const missingReason = lines.some((line) => line.source === "manual" && !String(line.reason || line.note || "").trim());
  if (!gate.ok) return { tone: "bad", effectAr: "فوق نصف الأجر", effectEn: "Over half the wage" };
  if (missingInstrument || missingReason) return { tone: "bad", effectAr: "حسم بلا سند", effectEn: "A deduction without an instrument" };
  return { tone: "ok", effectAr: "حارس الخصم مقفل", effectEn: "Deduction guard is closed" };
}

function payslipLawRows(item, employee, parts) {
  const hire = employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "";
  const guard = deductionGuard(item);
  const overtime = Number(parts?.overtimeHours) > 0;
  return [
    {
      id: "90",
      badgeAr: "المادة 90",
      badgeEn: "Art. 90",
      titleAr: "الأجر في موعده عبر حماية الأجور",
      titleEn: "Wage on time through wage protection",
      bodyAr: "يقفل الحضور قبل المسير، ويصدر ملف حماية الأجور.",
      bodyEn: "Attendance locks before the run, and the wage-protection file is issued.",
      effectAr: item?.paid ? "ملف مدد جاهز" : "في موعد الصرف عبر مدد",
      effectEn: item?.paid ? "Mudad file is ready" : "Due via Mudad",
      tone: "ok",
      textIds: ["payroll.wage.payment.cite"],
    },
    {
      id: "92",
      badgeAr: "المادة 92 · 93",
      badgeEn: "Art. 92 · 93",
      titleAr: "لا حسم بلا سند ولا فوق النصف",
      titleEn: "No deduction without an instrument, and none over half",
      bodyAr: "يطلب سنداً لكل حسم ويرفض ما فوق النصف.",
      bodyEn: "Every deduction needs an instrument, and anything over half the wage is refused.",
      effectAr: guard.effectAr,
      effectEn: guard.effectEn,
      tone: guard.tone,
      textIds: ["payroll.loan.capRatio", "payroll.deduction.capRatio"],
    },
    {
      id: "107",
      badgeAr: "المادة 107",
      badgeEn: "Art. 107",
      titleAr: "الإضافي 150% على الأساسي",
      titleEn: "Overtime at 150% of base",
      bodyAr: "يحسب الإضافي من البصمة بـ150% ويرحّله للمسير.",
      bodyEn: "Overtime is taken from the punch at 150% and carried into the run.",
      effectAr: overtime ? "محسوب في المسير" : "لا ساعات إضافية",
      effectEn: overtime ? "Counted in the run" : "No overtime hours",
      tone: overtime ? "ok" : "na",
      textIds: ["hours.ot.premium"],
    },
    {
      id: "84",
      badgeAr: "المادة 84",
      badgeEn: "Art. 84",
      titleAr: "مكافأة نهاية الخدمة على الأجر الأخير",
      titleEn: "End-of-service award on the last wage",
      bodyAr: "يحسب المكافأة على الأجر الأخير في طلب المخالصة.",
      bodyEn: "The award is calculated on the last wage in the clearance request.",
      effectAr: hire ? "تُحسب في المخالصة" : "لا تاريخ تعيين",
      effectEn: hire ? "Calculated at clearance" : "No hire date",
      tone: hire ? "ok" : "na",
      textIds: ["eos.gratuity.cite"],
    },
  ];
}

function PayslipMinistryStrip({ ar, item, employee, parts }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState("");
  const rows = payslipLawRows(item, employee, parts);
  const warns = rows.filter((row) => row.tone === "warn" || row.tone === "bad").length;
  const met = rows.filter((row) => row.tone === "ok").length;
  const quiet = rows.filter((row) => row.tone === "na").length;
  const head = warns
    ? (ar ? `${warns} تنبيه نظامي` : `${warns} statutory alert${warns > 1 ? "s" : ""}`)
    : (ar ? `مستقر · ${met} مستوفى · ${quiet} بلا أثر` : `Steady · ${met} met · ${quiet} with no effect`);
  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "#0B3D27", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Shield size={16} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{ar ? "أنظمة وزارة الموارد البشرية في هذا القسم" : "Ministry of Human Resources rules in this section"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{ar ? "تُفحص حيّاً من سجل القسم · انقر المادة لقراءة نصّها" : "Checked live from this section’s record · open an article to read it"}</span>
        </span>
        <span style={{ flex: 1, minWidth: 12 }} />
        <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: warns ? "#FBF3E1" : "#E6F2EA", color: warns ? "#8A5A12" : "#2F6B43" }}>{head}</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, height: 32, padding: "0 12px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--nv-line)", background: CARD, color: "var(--nv-ink2)" }}
        >
          {open ? (ar ? "إخفاء المواد ▴" : "Hide articles ▴") : (ar ? `عرض المواد (${rows.length}) ▾` : `Show articles (${rows.length}) ▾`)}
        </button>
      </div>
      {open ? rows.map((row) => {
        const tone = TONE[row.tone] || TONE.na;
        const shown = reading === row.id;
        return (
          <div key={row.id} style={{ padding: "14px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={() => setReading(shown ? "" : row.id)}
              aria-expanded={shown}
              style={{ fontFamily: "inherit", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "start", display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 6, background: "#0B3D27", color: "#fff", fontSize: 11, fontWeight: 700 }}>{ar ? row.badgeAr : row.badgeEn}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{ar ? "نظام العمل" : "Labour Law"}</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.5 }}>{ar ? row.titleAr : row.titleEn}</span>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{ar ? row.bodyAr : row.bodyEn}</span>
              {shown ? row.textIds.map((ruleId) => {
                const text = statuteText(ruleId, ar);
                return text ? (
                  <span key={ruleId} style={{ marginTop: 4, fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{text}</span>
                ) : null;
              }) : null}
            </button>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 108 }}>
              <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: tone.color, background: tone.background }}>{ar ? tone.labelAr : tone.labelEn}</span>
              <span style={{ fontSize: 11.5, color: MUTED, textAlign: "center", lineHeight: 1.4 }}>{ar ? row.effectAr : row.effectEn}</span>
            </span>
          </div>
        );
      }) : null}
      {open ? (
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
          <span><span style={{ color: "#2F6B43", fontWeight: 700 }}>{ar ? "✓ مستقر" : "✓ Steady"}</span>{ar ? ": القاعدة مستوفاة" : ": the rule is met"}</span>
          <span><span style={{ color: "#8A5A12", fontWeight: 700 }}>{ar ? "! تنبيه" : "! Alert"}</span>{ar ? ": يحتاج متابعة قبل أن يصير مخالفة" : ": needs a look before it becomes a breach"}</span>
          <span><span style={{ color: "#9B2335", fontWeight: 700 }}>{ar ? "× مخالفة" : "× Breach"}</span>{ar ? ": يتطلب إجراء الآن" : ": needs an action now"}</span>
          <span><span style={{ color: "#555C66", fontWeight: 700 }}>{ar ? "— بلا أثر" : "— No effect"}</span>{ar ? ": لا ينطبق على سجل القسم حالياً" : ": does not apply to this section’s record now"}</span>
        </div>
      ) : null}
    </section>
  );
}

function facedForGosi(item, employee, month) {
  if (!item || item.settledNet != null || item.paid) return item;
  const flag = item.isSaudi === true || item.isSaudi === false ? item.isSaudi : payrollSaudiFlag(employee);
  return {
    ...item,
    isSaudi: flag,
    gosiRegisteredAt: registrationForPayroll(employee, item),
    gosiAsOf: month || item.gosiAsOf || "",
  };
}

export default function PayrollSlipBoard({
  monthLabel,
  month,
  items = [],
  employeeForItem,
  ar,
  onExport,
  personal = false,
}) {
  const [empId, setEmpId] = useState(items[0]?.employeeId || "");
  const [picked, setPicked] = useState(() => new Set());
  const item = useMemo(
    () => items.find((row) => row.employeeId === empId) || items[0] || null,
    [items, empId],
  );
  const employee = item ? employeeForItem?.(item) : null;

  if (!item) {
    return <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا بند في هذا النطاق." : "No line in this scope."}</p>;
  }

  const live = facedForGosi(item, employee, month);
  const parts = lineComponents(live);
  const gross = parts.base + parts.allowances + parts.bonus + (Number(parts.overtimePay) || 0);
  const withheld = (Number(parts.deductions) || 0) + (Number(parts.gosiEmployee) || 0);
  const rows = slipRows(live, employee, parts, ar, month);
  const allOn = rows.length > 0 && rows.every((row) => picked.has(row.id));
  const toggle = (id) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setPicked(allOn ? new Set() : new Set(rows.map((row) => row.id)));
  };
  const foot = picked.size
    ? (ar ? "حدّد إجراء للسجلات المحددة من الأزرار في الصفوف" : "Choose an action for the selected rows")
    : (ar ? "انقر المربع لتحديد السجلات" : "Click a box to select rows");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!personal && items.length > 1 ? (
        <label style={{ display: "grid", gap: 4, maxWidth: 320 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الموظف" : "Employee"}</span>
          <select value={item.employeeId} onChange={(event) => { setEmpId(event.target.value); setPicked(new Set()); }} style={field}>
            {items.map((row) => (
              <option key={row.employeeId} value={row.employeeId}>
                {employeeForItem?.(row)?.name || row.employeeName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
        <StatTile
          label={ar ? `صافي ${String(monthLabel || "").replace(/\s+\d{4}$/, "")}` : `Net · ${monthLabel}`}
          value={sarAfter(Math.max(0, parts.net))}
          hint={depositHint(item, ar)}
          edge={EDGE.net}
          ink="#2F6B43"
        />
        <StatTile
          label={ar ? "الإجمالي" : "Gross"}
          value={sarAfter(gross)}
          hint={ar ? "أساسي + بدلات + إضافي" : "Base + allowances + overtime"}
          edge={EDGE.gross}
          ink={NAVY}
        />
        <StatTile
          label={ar ? "الخصومات" : "Deductions"}
          value={sarAfter(withheld)}
          hint={parts.gosiEmployee
            ? (ar ? "التأمينات · بمصدرها" : "GOSI · with its source")
            : (ar ? "بسند مكتوب" : "With a written instrument")}
          edge={EDGE.deduct}
          ink={NAVY}
        />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD }}>
        <p style={{ margin: 0, flex: 1, fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>
          {ar
            ? "قسيمتك تُبنى من الحضور المقفل. كل بند يحمل مصدره. الأجر يُدفع في موعده (المادة 90) عبر نظام حماية الأجور."
            : "The slip is built from locked attendance. Every line names its source. The wage is paid on time (Art. 90) through wage protection."}
        </p>
        <Info size={16} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
      </div>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: CARD, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
            {ar ? `البند (${rows.length})` : `Lines (${rows.length})`}
          </span>
          <button type="button" onClick={() => onExport?.(item)} style={{ ...ui.btnSecondary, height: 34, borderRadius: 8 }}>
            {ar ? "حفظ PDF" : "Save PDF"}
          </button>
        </div>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ background: "#F4F7F5" }}>
                <th style={{ width: 44, padding: "10px 12px", textAlign: "center" }}>
                  <RoundCheck on={allOn} onClick={toggleAll} label={ar ? "تحديد كل البنود" : "Select every line"} />
                </th>
                {[ar ? "البند" : "Line", ar ? "المبلغ" : "Amount", ar ? "المصدر" : "Source"].map((head) => (
                  <th key={head} style={{ textAlign: "start", fontSize: 12, fontWeight: 650, color: MUTED, padding: "10px 14px" }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const on = picked.has(row.id);
                return (
                  <tr key={row.id} style={{ background: on ? "#E8F3EC" : "transparent" }}>
                    <td style={{ padding: "12px 12px", borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
                      <RoundCheck on={on} onClick={() => toggle(row.id)} label={row.label} />
                    </td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: NAVY }}>{row.label}</td>
                    <td dir="ltr" style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: NAVY, textAlign: "end" }}>{row.blocked ? "—" : sarBefore(row.amount, row.minus)}</td>
                    <td style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 12.5, color: MUTED }}>{row.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 12, color: MUTED }}>{foot}</span>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: MUTED, unicodeBidi: "isolate" }}>{`1-${rows.length} / ${rows.length}`}</span>
        </div>
      </div>
      {personal ? null : <PayslipMinistryStrip ar={ar} item={item} employee={employee} parts={parts} />}
    </div>
  );
}
