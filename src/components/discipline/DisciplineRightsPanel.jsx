import React, { useState } from "react";
import { mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, { Counter, ministryBadgeStyle, MinistryRow, RegsSourceLine } from "@/components/schedules/MinistrySourceCards";
import RightHint from "@/components/shared/RightHint";
import { citeRule } from "@/lib/laborRules";
import { disciplineRuleHint } from "@/lib/rightHints.disc";

/**
 * «حقوقي في هذا المسار» in the frame of «أنظمة الوزارة» (الحضور والدوام، طلباتي، صوت الموظف):
 * source cards, group bands, and one row per right with its article badge, whether the platform
 * enforces it, and the «حقك» hint. Articles come from the rule catalog, never typed here.
 */
function Num({ children }) {
  return <span dir="ltr" style={mono}>{children}</span>;
}

const GROUPS = [
  {
    key: "what",
    ar: "ما يجوز توقيعه عليّ",
    en: "What may be imposed on me",
    scopeAr: "قائمة الجزاءات وحدودها: لا جزاء خارج القائمة، ولا تجاوز للسقف، ولا تشديد بعد مضي المدة.",
    scopeEn: "The penalty list and its limits: nothing off the list, no cap breach, no harsher repeat after the cool-off.",
  },
  {
    key: "how",
    ar: "الإجراء والمواعيد",
    en: "Procedure and deadlines",
    scopeAr: "الإبلاغ والتحقيق قبل الجزاء، ومهلة الاتهام، ومهلة التظلّم والرد عليه.",
    scopeEn: "Notice and hearing first, the charge window, and the grievance and answer windows.",
  },
];

export default function DisciplineRightsPanel({ rights = [], ar = true, today }) {
  const [source, setSource] = useState("all");
  const groupOf = {
    "discipline.penalties.cite": "what",
    "discipline.listedOnly.cite": "what",
    "discipline.fine.maxDays": "what",
    "discipline.workplace.cite": "what",
    "discipline.repeat.cooloffDays": "what",
    "discipline.hearing.cite": "how",
    "discipline.charge.maxDays": "how",
    "discipline.appeal.internalDays": "how",
    "discipline.decision.days": "how",
  };
  // The court route after a refused grievance is outside the platform — shown for reference only.
  const referenceOnly = new Set(["discipline.decision.days"]);

  const rows = rights.map((row) => ({ row, cite: citeRule(row.ruleId, today) }))
    // Read in article order, like the other ministry panels.
    .sort((a, b) => (Number(a.cite?.article) || 999) - (Number(b.cite?.article) || 999))
    .map(({ row, cite }) => {
    const info = referenceOnly.has(row.ruleId);
    return {
      key: row.ruleId,
      source: groupOf[row.ruleId] || "how",
      badge: cite?.article ? (ar ? `م ${cite.article}` : `Art. ${cite.article}`) : (ar ? "نظام" : "Law"),
      title: ar ? row.ar : row.en,
      status: info ? "void" : "settled",
      pill: info ? (ar ? "للعلم" : "Reference") : (ar ? "تطبّقه المنصة" : "Enforced"),
      hint: disciplineRuleHint(row.ruleId, ar ? row.ar : row.en, { view: "employee", ar, today }),
    };
  });

  const tally = (list) => ({
    met: list.filter((row) => row.status === "settled").length,
    info: list.filter((row) => row.status === "void").length,
  });
  const counters = (t) => (
    <>
      <Counter value={t.met} label={ar ? "تطبّقه المنصة" : "enforced"} tone="ok" />
      {t.info ? <Counter value={t.info} label={ar ? "للعلم" : "reference"} tone="mute" /> : null}
    </>
  );
  const cards = GROUPS.map((g) => {
    const list = rows.filter((row) => row.source === g.key);
    const t = tally(list);
    const arts = [...new Set(list.map((row) => row.badge.replace(/^(م|Art\.)\s*/, "")))].join(" · ");
    return {
      key: g.key,
      badge: ar ? `م ${arts}` : `Art. ${arts}`,
      title: ar ? g.ar : g.en,
      scope: ar ? g.scopeAr : g.scopeEn,
      tone: t.met ? "ok" : "mute",
      counters: counters(t),
    };
  });
  const groups = cards
    .filter((card) => source === "all" || source === card.key)
    .map((card) => ({ card, rows: rows.filter((row) => row.source === card.key) }));

  return (
    <section data-disc-rights="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={ar ? "حقوقي في هذا المسار" : "My rights on this path"}
        note={ar
          ? <>نظام العمل · <Num>{rows.length}</Num> حقوق تحكم الجزاء عليك، وكل سطر يقول هل تطبّقه المنصة الآن.</>
          : <>Labour Law · <Num>{rows.length}</Num> rights govern a sanction on you; each row says whether the platform enforces it.</>}
        trailing={<div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>{counters(tally(rows))}</div>}
      />
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <MinistrySourceCards cards={cards} active={source} onPick={setSource} ar={ar} />
      </div>
      {groups.map(({ card, rows: list }) => (
        <div key={card.key} data-disc-rights-group={card.key} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            <span style={ministryBadgeStyle("", ar, { fontFamily: "inherit", direction: "rtl" })}>{card.badge}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5, flex: "1 1 180px", minWidth: 0 }}>{card.title}</span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}><Num>{list.length}</Num> {ar ? "في المجموع" : "in all"}</span>
          </div>
          {list.map((row) => (
            <MinistryRow
              key={row.key}
              rowKey={row.key}
              source={row.source}
              badge={row.badge}
              status={row.status}
              pill={row.pill}
              title={row.title}
              sub={<RightHint ar={ar} onDate={today} hint={row.hint} />}
              ar={ar}
            />
          ))}
        </div>
      ))}
      <RegsSourceLine ar={ar} />
    </section>
  );
}
