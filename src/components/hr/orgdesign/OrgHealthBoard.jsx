import React, { useMemo, useState } from "react";
import { deriveHeadcountPlan, deriveOrgHealth, deriveSpanLayers, orgDesignOf, todayKey } from "@/lib/orgDesign";
import { saveOrgDesignSettings, setUnitBudget } from "@/lib/orgDesignStore";
import { GateLine, SectionHead, SummaryLine, ToneChip, levelLabel } from "./orgDesignUi";

const VERDICT = {
  wide: { tone: "warn", ar: "نطاق واسع", en: "Too wide" },
  narrow: { tone: "", ar: "نطاق ضيق", en: "Too narrow" },
  deep: { tone: "warn", ar: "طبقة عميقة", en: "Too deep" },
  ok: { tone: "ok", ar: "متوازن", en: "Balanced" },
};

const SETTINGS = [
  ["spanMin", "أقل نطاق إشراف", "Minimum span"],
  ["spanMax", "أعلى نطاق إشراف", "Maximum span"],
  ["maxLayers", "أقصى عدد طبقات", "Maximum layers"],
  ["actingMaxDays", "حدّ التكليف (يوم)", "Acting limit (days)"],
  ["actingRemindDays", "التذكير قبل نهاية التكليف (يوم)", "Acting reminder (days)"],
  ["vacantAlertDays", "تنبيه الشاغر بعد (يوم)", "Vacancy alert after (days)"],
];

/**
 * «صحة الهيكل» — one list of findings (breaches first), then span & layers per manager and the
 * headcount plan vs actual with Saudization by unit. Thresholds are company settings.
 */
export default function OrgHealthBoard({ ar, data, actor, companyId, canEdit }) {
  const day = todayKey();
  const settings = orgDesignOf(data).settings;
  const health = useMemo(() => deriveOrgHealth(data, { day, settings }), [data, day, settings]);
  const span = useMemo(() => deriveSpanLayers(data, settings, day), [data, settings, day]);
  const plan = useMemo(() => deriveHeadcountPlan(data, day), [data, day]);
  const [tone, setTone] = useState("");
  const [form, setForm] = useState(settings);
  const [gate, setGate] = useState(null);
  const [budgetGate, setBudgetGate] = useState(null);
  const vacancies = health.items.filter((i) => i.kind === "VACANT").length;
  const items = health.items.filter((i) => !tone || i.tone === tone);
  const totals = plan.reduce((acc, r) => ({ saudi: acc.saudi + r.saudi, non: acc.non + r.nonSaudi }), { saudi: 0, non: 0 });
  const saudiPct = totals.saudi + totals.non ? Math.round((totals.saudi / (totals.saudi + totals.non)) * 100) : null;

  return (
    <section className="nv-od" aria-label={ar ? "صحة الهيكل" : "Org health"}>
      <SectionHead
        title={ar ? "صحة الهيكل" : "Org health"}
        hint={ar
          ? "قائمة واحدة مشتقة من الهيكل الحي: ما يخالف قاعدة أولاً، ثم ما يحتاج قراراً، ثم ما يحسن معرفته. لا رقم مخزّن هنا."
          : "One list derived from the live structure: breaches first, then decisions, then notes. Nothing here is stored."}
      />
      <SummaryLine
        label={ar ? "ملخص صحة الهيكل" : "Health summary"}
        parts={ar
          ? [
            { key: "bad", value: health.bad, label: "مخالفة" },
            { key: "warn", value: health.warn, label: "تحتاج قراراً" },
            { key: "vac", value: vacancies, label: "منصب شاغر" },
            { key: "layers", value: `${span.layers}/${settings.maxLayers}`, label: "طبقات" },
            { key: "span", before: "وسيط نطاق الإشراف", value: span.medianSpan },
            { key: "saudi", before: "السعودة", value: saudiPct == null ? "—" : `${saudiPct}%`, label: "(للاطلاع)" },
          ]
          : [
            { key: "bad", value: health.bad, label: "breaches" },
            { key: "warn", value: health.warn, label: "need a decision" },
            { key: "vac", value: vacancies, label: "vacant seats" },
            { key: "layers", value: `${span.layers}/${settings.maxLayers}`, label: "layers" },
            { key: "span", before: "median span", value: span.medianSpan },
            { key: "saudi", before: "Saudization", value: saudiPct == null ? "—" : `${saudiPct}%`, label: "(info)" },
          ]}
      />

      <div className="nv-od-filters" role="group" aria-label={ar ? "تصفية" : "Filter"}>
        {[["", ar ? "الكل" : "All", health.items.length], ["bad", ar ? "مخالفة" : "Breach", health.bad], ["warn", ar ? "قرار" : "Decision", health.warn], ["info", ar ? "للعلم" : "Note", health.info]].map(([id, label, n]) => (
          <button key={id || "all"} type="button" className="nv-od-chip" aria-pressed={tone === id} onClick={() => setTone(id)}>{label} <span className="nv-od-num">{n}</span></button>
        ))}
      </div>
      <div className="nv-od-paper">
        {items.length ? (
          <ul className="nv-od-list">
            {items.map((item) => (
              <li key={item.id}>
                <span className="nv-od-dot" data-tone={item.tone} aria-hidden />
                <span style={{ flex: 1, minWidth: 0 }}>{ar ? item.ar : item.en}</span>
              </li>
            ))}
          </ul>
        ) : <p className="nv-od-ok">{ar ? "لا شيء في هذه الفئة — الهيكل سليم هنا." : "Nothing in this group — the structure is sound here."}</p>}
      </div>

      <SectionHead
        title={ar ? "نطاق الإشراف والطبقات" : "Span of control & layers"}
        hint={ar
          ? `كل من يقود أحداً: مباشرون من الناس، ومناصب شاغرة تتبعه، والطبقة التي يجلس عليها. الحدود ${settings.spanMin}–${settings.spanMax} مباشراً و${settings.maxLayers} طبقات.`
          : `Everyone who leads: direct people, open seats under them, and their layer. Limits ${settings.spanMin}–${settings.spanMax} direct, ${settings.maxLayers} layers.`}
      />
      <div className="nv-od-paper nv-od-paper--flush">
        <table className="nv-od-table">
          <thead>
            <tr>
              <th>{ar ? "المدير" : "Manager"}</th>
              <th>{ar ? "الطبقة" : "Layer"}</th>
              <th>{ar ? "مباشرون" : "Direct"}</th>
              <th>{ar ? "شواغر تتبعه" : "Open seats"}</th>
              <th>{ar ? "الفريق كله" : "Whole team"}</th>
              <th>{ar ? "طبقات تحته" : "Layers below"}</th>
              <th>{ar ? "الحكم" : "Verdict"}</th>
            </tr>
          </thead>
          <tbody>
            {span.rows.map((r) => (
              <tr key={r.employeeId}>
                <td data-label={ar ? "المدير" : "Manager"} style={{ fontWeight: 600 }}>{r.name}</td>
                <td data-label={ar ? "الطبقة" : "Layer"}><span className="nv-od-num">{r.level}</span></td>
                <td data-label={ar ? "مباشرون" : "Direct"}><span className="nv-od-num">{r.directPeople}</span></td>
                <td data-label={ar ? "شواغر تتبعه" : "Open seats"}><span className="nv-od-num">{r.directOpen}</span></td>
                <td data-label={ar ? "الفريق كله" : "Whole team"}><span className="nv-od-num">{r.total}</span></td>
                <td data-label={ar ? "طبقات تحته" : "Layers below"}><span className="nv-od-num">{r.layersBelow}</span></td>
                <td data-label={ar ? "الحكم" : "Verdict"}><ToneChip tone={VERDICT[r.verdict].tone}>{ar ? VERDICT[r.verdict].ar : VERDICT[r.verdict].en}</ToneChip></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!span.rows.length ? <p className="nv-od-note" style={{ padding: 16 }}>{ar ? "لا مدير يقود أحداً بعد — عيّن مدير الوحدة من المخطط." : "Nobody leads anyone yet — set unit managers from the chart."}</p> : null}
      </div>

      <SectionHead
        title={ar ? "خطة القوى العاملة مقابل الفعلي" : "Headcount plan vs actual"}
        hint={ar
          ? "الميزانية رقم تقرّه الإدارة لكل وحدة؛ الفعلي وتوزيع المناصب ونسبة السعودة مشتقة من الملفات. نسبة السعودة هنا للاطلاع، والنطاق الرسمي في امتثال الوزارة."
          : "The budget is set per unit; actuals, seat states and Saudization are derived from the files. Saudization here is informational — the official band lives in Ministry compliance."}
      />
      <div className="nv-od-paper nv-od-paper--flush">
        <table className="nv-od-table">
          <thead>
            <tr>
              <th>{ar ? "الوحدة" : "Unit"}</th>
              <th>{ar ? "الميزانية" : "Budget"}</th>
              <th>{ar ? "الفعلي" : "Actual"}</th>
              <th>{ar ? "الفرق" : "Variance"}</th>
              <th>{ar ? "مشغول / شاغر / مجمّد / مخطط" : "Filled / vacant / frozen / planned"}</th>
              <th>{ar ? "السعودة" : "Saudization"}</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((r) => (
              <tr key={r.stationId}>
                <td data-label={ar ? "الوحدة" : "Unit"}>
                  <span style={{ paddingInlineStart: Math.min(r.depth, 4) * 12, fontWeight: 600 }}>{r.name}</span>{" "}
                  <span className="nv-od-muted" style={{ fontSize: 11 }}>{levelLabel(r.level, ar)}</span>
                </td>
                <td data-label={ar ? "الميزانية" : "Budget"}>
                  {canEdit ? (
                    <input
                      className="nv-od-input nv-od-num"
                      style={{ width: 72, height: 28 }}
                      inputMode="numeric"
                      defaultValue={r.budget ?? ""}
                      aria-label={ar ? `ميزانية ${r.name}` : `Budget for ${r.name}`}
                      onBlur={(e) => {
                        if (String(e.target.value) === String(r.budget ?? "")) return;
                        setBudgetGate(setUnitBudget(companyId, actor, r.stationId, e.target.value));
                      }}
                    />
                  ) : <span className="nv-od-num">{r.budget ?? "—"}</span>}
                </td>
                <td data-label={ar ? "الفعلي" : "Actual"}><span className="nv-od-num">{r.actual}</span></td>
                <td data-label={ar ? "الفرق" : "Variance"}>
                  {r.variance == null ? <span className="nv-od-muted">—</span> : (
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <span className="nv-od-num">{r.variance > 0 ? `+${r.variance}` : r.variance}</span>
                      {r.variance > 0 ? <ToneChip tone="bad">{ar ? "فوق الميزانية" : "Over"}</ToneChip> : null}
                    </span>
                  )}
                </td>
                <td data-label={ar ? "المناصب" : "Seats"}><span className="nv-od-num">{r.filled} / {r.vacant} / {r.frozen} / {r.planned}</span></td>
                <td data-label={ar ? "السعودة" : "Saudization"}>
                  {r.saudiPct == null ? <span className="nv-od-muted">—</span> : <span className="nv-od-num">{r.saudiPct}%</span>}
                  {r.unknown ? <span className="nv-od-muted" style={{ fontSize: 11 }}> · {r.unknown} {ar ? "بلا جنسية" : "unknown"}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GateLine gate={budgetGate} ar={ar} />

      <details className="nv-od-paper">
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{ar ? "حدود الشركة لهذه القراءة" : "Company thresholds"}</summary>
        <div className="nv-od-form" style={{ marginTop: 12 }}>
          {SETTINGS.map(([key, labelAr, labelEn]) => (
            <label key={key} className="nv-od-field">{ar ? labelAr : labelEn}
              <input className="nv-od-input nv-od-num" inputMode="numeric" value={form[key] ?? ""} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
        <GateLine gate={gate} ar={ar} />
        {canEdit ? (
          <div style={{ marginTop: 10 }}>
            <button type="button" className="nv-od-btn nv-od-btn--primary" onClick={() => setGate(saveOrgDesignSettings(companyId, actor, form))}>{ar ? "حفظ الحدود" : "Save thresholds"}</button>
          </div>
        ) : null}
      </details>
    </section>
  );
}
