import React, { useState } from "react";
import { Link } from "react-router-dom";
import { disciplineLawRows } from "@/lib/disciplineBoard";
import useHashScroll from "@/hooks/useHashScroll";
import { citeRule } from "@/lib/laborRules";
import { mono, quietAction, SectionHead, slab, sourceBadge } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, { Counter, MinistryRow, RegsSourceLine } from "@/components/schedules/MinistrySourceCards";

/**
 * «أنظمة الوزارة — ما يخص الجزاءات» — the same frame, cards, groups and rows as «أنظمة الوزارة» in طلباتي.
 * Only the Labour Law (M/51): no platform policy appears here. Each row's status is read from the files
 * in scope: blocked an action (منعت) · applies to an open file now (تنطبق) · for reference (للعلم).
 * A row opens the official text of its article.
 */

const KINDS = [
  { key: "scope", ar: "ما يجوز توقيعه", en: "What may be imposed", scopeAr: "قائمة الجزاءات، ولا جزاء خارجها أو خارج مكان العمل بلا صلة.", scopeEn: "The penalty list; nothing outside it or off-site without a work link." },
  { key: "act", ar: "الإجراء قبل الجزاء وبعده", en: "The procedure before and after", scopeAr: "إبلاغ كتابي وسماع دفاع في محضر، وسجل الغرامات وصرفها.", scopeEn: "Written notice and defence in minutes; the fine register and its use." },
  { key: "deadline", ar: "المهل", en: "The windows", scopeAr: "30 يوماً للاتهام وللتوقيع، و180 يوماً قبل أي تشديد.", scopeEn: "30 days to charge and to sign; 180 days before any increase." },
  { key: "cap", ar: "السقوف والحسم", en: "Caps and the cut", scopeAr: "خمسة أيام للمخالفة وللشهر، وجزاء واحد للفعل، ونصف الأجر سقف كل حسم.", scopeEn: "Five days per offence and per month, one penalty per act, half the wage caps every deduction." },
  { key: "right", ar: "حقوق العامل", en: "The worker's rights", scopeAr: "التظلّم خلال 30 يوماً، والبتّ خلال 15، ثم المحاكم العمالية.", scopeEn: "Grievance within 30 days, a ruling within 15, then the labour courts." },
];

export default function DisciplineLawBoard({ cases, employees, ar, today, own = false }) {
  const [kind, setKind] = useState("all");
  const [view, setView] = useState("all");
  const [reading, setReading] = useState("");
  const rows = disciplineLawRows({ cases, employees, ar, today });
  useHashScroll("nv-ministry-discipline");

  const tally = (list) => ({
    blocked: list.filter((r) => r.blocked).length,
    live: list.filter((r) => !r.blocked && r.live).length,
    info: list.filter((r) => !r.blocked && !r.live).length,
  });
  const countersOf = (t) => [
    <Counter key="b" value={t.blocked} label={ar ? "منعت إجراءً" : "blocked"} tone="bad" />,
    <Counter key="l" value={t.live} label={ar ? "تنطبق الآن" : "apply now"} tone="warn" />,
    <Counter key="i" value={t.info} label={ar ? "للعلم" : "reference"} tone="mute" />,
  ];
  const cards = KINDS.filter((k) => rows.some((r) => r.kind === k.key)).map((k) => {
    const list = rows.filter((r) => r.kind === k.key);
    const t = tally(list);
    const arts = [...new Set(list.map((r) => r.art))].join(" · ");
    return {
      key: k.key,
      badge: ar ? `م ${arts}` : `Art. ${arts}`,
      title: ar ? k.ar : k.en,
      scope: ar ? k.scopeAr : k.scopeEn,
      tone: t.blocked ? "bad" : t.live ? "warn" : "mute",
      counters: countersOf(t),
    };
  });
  const total = tally(rows);
  const applies = (r) => r.blocked || r.live;
  const groups = KINDS
    .filter((k) => kind === "all" || kind === k.key)
    .map((k) => {
      const all = rows.filter((r) => r.kind === k.key);
      return { k, all, list: view === "now" ? all.filter(applies) : all };
    })
    .filter((g) => g.all.length);
  const hiddenN = rows.filter((r) => (kind === "all" || r.kind === kind) && !applies(r)).length;

  return (
    <section id="nv-ministry-discipline" data-discipline-law="1" style={{ ...slab, display: "flex", flexDirection: "column", scrollMarginTop: 88 }}>
      <SectionHead
        title={own ? (ar ? "أنظمة الوزارة — ما يخص ملفي في الجزاءات" : "Ministry rules — sanctions on my file") : (ar ? "أنظمة الوزارة — ما يخص الجزاءات" : "Ministry rules — sanctions")}
        note={ar
          ? <>قراءة فقط · <span dir="ltr" style={mono}>{rows.length}</span> قاعدة من نظام العمل (م/51) تحكم الجزاء من المخالفة إلى الاعتراض. الحالة تُقرأ من ملفات {own ? "ملفك" : "نطاقك"}.</>
          : <>Read only · <span dir="ltr" style={mono}>{rows.length}</span> Labour Law (M/51) rules govern a sanction from the offence to the objection. Status is read from {own ? "your file" : "the files in scope"}.</>}
        trailing={<div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>{countersOf(total)}</div>}
      />
      <div style={{ padding: "14px 18px 12px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <MinistrySourceCards cards={cards} active={kind} onPick={setKind} ar={ar} />
      </div>
      <div data-law-rows="1" style={{ display: "flex", flexDirection: "column" }}>
        {view === "now" && !groups.some((g) => g.list.length) ? (
          <span style={{ padding: "14px 18px", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
            {ar ? "لا قاعدة تنطبق على ملف مفتوح الآن. اعرض كل المواد لتعرف الحدود." : "No rule applies to an open file now. Show all to see the limits."}
          </span>
        ) : null}
        {groups.filter((g) => g.list.length).map((g) => {
          const t = tally(g.all);
          return (
            <div key={g.k.key} data-law-group={g.k.key} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={sourceBadge({ direction: "rtl" })}>{ar ? "م/51" : "M/51"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", flex: "1 1 180px" }}>{ar ? g.k.ar : g.k.en}</span>
                <span style={{ display: "inline-flex", gap: 10, fontSize: 11, color: "var(--nv-muted)" }}>
                  {t.blocked ? <span><span dir="ltr" style={mono}>{t.blocked}</span> {ar ? "منعت" : "blocked"}</span> : null}
                  {t.live ? <span><span dir="ltr" style={mono}>{t.live}</span> {ar ? "تنطبق" : "apply"}</span> : null}
                  <span><span dir="ltr" style={mono}>{g.all.length}</span> {ar ? "في المجموع" : "in all"}</span>
                </span>
              </div>
              {g.list.map((row) => {
                const open = reading === row.id;
                const text = (() => { const c = citeRule(row.id, today); return c ? (ar ? c.textAr : c.textEn) : ""; })();
                return (
                  <div key={row.id} data-law-row={row.id}>
                    <button type="button" onClick={() => setReading(open ? "" : row.id)} aria-expanded={open} style={{ display: "block", width: "100%", padding: 0, border: "none", background: open ? "var(--nv-ok-soft)" : "transparent", textAlign: "inherit", cursor: text ? "pointer" : "default", fontFamily: "inherit" }}>
                      <MinistryRow
                        rowKey={row.id}
                        source="labour"
                        badge={ar ? `م ${row.art}` : `Art. ${row.art}`}
                        status={row.status}
                        pill={row.tag}
                        title={row.head}
                        note={row.applied}
                        sub={text ? (open ? (ar ? "إخفاء نص المادة ▴" : "Hide the article ▴") : (ar ? "اقرأ نص المادة ▾" : "Read the article ▾")) : undefined}
                        ar={ar}
                      />
                    </button>
                    {open && text ? (
                      <p data-law-text={row.id} style={{ margin: 0, padding: "10px 18px 14px", fontSize: 12.5, lineHeight: 1.9, color: "var(--nv-ink)", background: "var(--nv-ok-soft)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", whiteSpace: "pre-wrap" }}>
                        {text}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <button type="button" data-law-fold="1" aria-expanded={view === "all"} onClick={() => setView(view === "all" ? "now" : "all")} style={quietAction({ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)" })}>
          {view === "all"
            ? <>{ar ? "ما ينطبق الآن فقط" : "Only what applies now"} (<span dir="ltr" style={mono}>{rows.length - hiddenN}</span>)</>
            : (ar ? "عرض كل المواد" : "Show all rules")}
        </button>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>{ar ? "الحالة تُقرأ من الملفات — لا تقدير." : "Status is read from the files — no estimates."}</span>
      </div>
      <div style={{ padding: "10px 18px 12px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7, flex: "1 1 260px" }}>
          {ar
            ? "نظام العمل (م/51) ولائحة تنظيم العمل المعتمدة هما مصدر الحكم — عند الخلاف يُرجع إلى النص الرسمي وإلى المحكمة العمالية."
            : "The Labour Law (M/51) and the approved work-organization regulation govern — in a dispute, the official text and the labour court prevail."}
        </p>
        <Link to="/app/payroll?tab=deduct" style={quietAction({ fontSize: 12, color: "var(--nv-ok-ink)" })}>{ar ? "الحسم في مسير الرواتب" : "The cut in payroll"}</Link>
      </div>
      <RegsSourceLine ar={ar} />
    </section>
  );
}
