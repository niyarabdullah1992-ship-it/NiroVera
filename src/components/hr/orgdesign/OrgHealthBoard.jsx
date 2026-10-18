import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { deriveHeadcountPlan, deriveOrgHealth, deriveSpanLayers, orgDesignOf, todayKey } from "@/lib/orgDesign";
import { saveOrgDesignSettings, setUnitBudget } from "@/lib/orgDesignStore";
import { Collapsible, slab } from "@/components/schedules/scheduleChrome";
import { GateLine, Note, OkLine, Slab, SlabBar, SummaryLine, ToneChip, btnPrimary, btnQuiet, filterChip, levelLabel } from "./orgDesignUi";

const VERDICT = {
  wide: { tone: "warn", ar: "نطاق واسع", en: "Too wide" },
  narrow: { tone: "", ar: "نطاق ضيق", en: "Too narrow" },
  deep: { tone: "warn", ar: "طبقة عميقة", en: "Too deep" },
  ok: { tone: "ok", ar: "متوازن", en: "Balanced" },
};

const slabFold = { ...slab, overflow: "hidden" };

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
/** The one next step for a finding: its seat card, else the person on the chart — a green «افتح», not a warning. */
function OpenAction({ ar, item, onOpenSeat }) {
  const location = useLocation();
  const style = btnQuiet({ fontSize: 12, color: "var(--nv-ok-ink)", textDecoration: "none" });
  const arrow = <span aria-hidden>{ar ? " ‹" : " ›"}</span>;
  if (item.seatId && onOpenSeat) {
    return <button type="button" style={style} onClick={() => onOpenSeat(item.seatId)}>{ar ? "افتح المنصب" : "Open seat"}{arrow}</button>;
  }
  if (item.employeeId) {
    return <Link to={`/app/org/chart?lane=manage&focus=${encodeURIComponent(item.employeeId)}`} state={{ from: `${location.pathname}${location.search}` }} style={style}>{ar ? "افتح في المخطط" : "Open on chart"}{arrow}</Link>;
  }
  return null;
}

export default function OrgHealthBoard({ ar, data, actor, companyId, canEdit, onOpenSeat }) {
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
    <div className="nv-od">
      <Slab
        label={ar ? "صحة الهيكل" : "Org health"}
        title={ar ? "صحة الهيكل" : "Org health"}
        note={ar
          ? "قائمة واحدة مشتقة من الهيكل الحي: ما يخالف قاعدة أولاً، ثم ما يحتاج قراراً، ثم ما يحسن معرفته. لا رقم مخزّن هنا."
          : "One list derived from the live structure: breaches first, then decisions, then notes. Nothing here is stored."}
      >
        <SlabBar>
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
        </SlabBar>
        <SlabBar label={ar ? "تصفية" : "Filter"} style={{ gap: 6 }}>
          {[["", ar ? "الكل" : "All", health.items.length], ["bad", ar ? "مخالفة" : "Breach", health.bad], ["warn", ar ? "قرار" : "Decision", health.warn], ["info", ar ? "للعلم" : "Note", health.info]].map(([id, label, n]) => (
            <button key={id || "all"} type="button" style={filterChip(tone === id)} aria-pressed={tone === id} onClick={() => setTone(id)}>{label} <span className="nv-od-num" style={{ color: "inherit" }}>{n}</span></button>
          ))}
        </SlabBar>
        {items.length ? (
          <ul className="nv-od-list">
            {items.map((item) => (
              <li key={item.id} data-tone={item.tone}>
                <span className="nv-od-dot" aria-hidden />
                <span style={{ flex: "1 1 220px", minWidth: 0 }}>{ar ? item.ar : item.en}</span>
                <span style={{ display: "inline-flex", gap: 10, alignItems: "center", marginInlineStart: "auto" }}>
                  {item.tone === "bad" ? <ToneChip tone="bad">{ar ? "مخالفة" : "Breach"}</ToneChip> : null}
                  {item.tone !== "info" ? <OpenAction ar={ar} item={item} onOpenSeat={onOpenSeat} /> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : <div style={{ padding: "14px 18px" }}><OkLine>{ar ? "لا شيء في هذه الفئة — الهيكل سليم هنا." : "Nothing in this group — the structure is sound here."}</OkLine></div>}
      </Slab>

      <Slab
        title={ar ? "نطاق الإشراف والطبقات" : "Span of control & layers"}
        note={ar
          ? `كل من يقود أحداً: مباشرون من الناس، ومناصب شاغرة تتبعه، والطبقة التي يجلس عليها. الحدود ${settings.spanMin}–${settings.spanMax} مباشراً و${settings.maxLayers} طبقات.`
          : `Everyone who leads: direct people, open seats under them, and their layer. Limits ${settings.spanMin}–${settings.spanMax} direct, ${settings.maxLayers} layers.`}
      >
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
        {!span.rows.length ? <Note style={{ padding: "14px 18px" }}>{ar ? "لا مدير يقود أحداً بعد — عيّن مدير الوحدة من المخطط." : "Nobody leads anyone yet — set unit managers from the chart."}</Note> : null}
      </Slab>

      <Slab
        title={ar ? "خطة القوى العاملة مقابل الفعلي" : "Headcount plan vs actual"}
        note={ar
          ? "الميزانية رقم تقرّه الإدارة لكل وحدة؛ الفعلي وتوزيع المناصب ونسبة السعودة مشتقة من الملفات. نسبة السعودة هنا للاطلاع، والنطاق الرسمي في امتثال الوزارة."
          : "The budget is set per unit; actuals, seat states and Saudization are derived from the files. Saudization here is informational — the official band lives in Ministry compliance."}
      >
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
                      style={{ width: 76, height: 30 }}
                      inputMode="numeric"
                      dir="ltr"
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
                      <span className="nv-od-num" dir="ltr">{r.variance > 0 ? `+${r.variance}` : r.variance}</span>
                      {r.variance > 0 ? <ToneChip tone="bad">{ar ? "فوق الميزانية" : "Over"}</ToneChip> : null}
                    </span>
                  )}
                </td>
                <td data-label={ar ? "المناصب" : "Seats"}><span className="nv-od-num" dir="ltr">{r.filled} / {r.vacant} / {r.frozen} / {r.planned}</span></td>
                <td data-label={ar ? "السعودة" : "Saudization"}>
                  {r.saudiPct == null ? <span className="nv-od-muted">—</span> : <span className="nv-od-num" dir="ltr">{r.saudiPct}%</span>}
                  {r.unknown ? <span className="nv-od-muted" style={{ fontSize: 11 }}> · {r.unknown} {ar ? "بلا جنسية" : "unknown"}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {budgetGate && !budgetGate.ok ? <div style={{ padding: "10px 18px" }}><GateLine gate={budgetGate} ar={ar} /></div> : null}
      </Slab>

      <div style={{ ...slabFold }}>
        <Collapsible
          title={ar ? "حدود الشركة لهذه القراءة" : "Company thresholds"}
          note={ar ? "نطاق الإشراف والطبقات وحدّ التكليف وتنبيه الشاغر — منها تُشتق القائمة أعلاه." : "Span, layers, acting limit and vacancy alert — the list above is derived from them."}
        >
          <div style={{ padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="nv-od-form">
              {SETTINGS.map(([key, labelAr, labelEn]) => (
                <label key={key} className="nv-od-field">{ar ? labelAr : labelEn}
                  <input className="nv-od-input nv-od-num" dir="ltr" inputMode="numeric" value={form[key] ?? ""} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </label>
              ))}
            </div>
            <GateLine gate={gate} ar={ar} />
            {canEdit ? (
              <div>
                <button type="button" style={btnPrimary()} onClick={() => setGate(saveOrgDesignSettings(companyId, actor, form))}>{ar ? "حفظ الحدود" : "Save thresholds"}</button>
              </div>
            ) : null}
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
