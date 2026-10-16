import React, { useState } from "react";
import { mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, { Counter, ministryBadgeStyle, MinistryRow, RegsSourceLine } from "@/components/schedules/MinistrySourceCards";
import { abuseLawStatus, ABUSE_WORKING_DAYS } from "@/lib/abuseComplaint";

/**
 * «أنظمة الوزارة — ما يخص صوت الموظف» — the same frame, source cards, group bands and rows as
 * «أنظمة الوزارة» in الحضور والدوام and طلباتي. Read only; each row says whether the platform meets it now.
 */
function Num({ children }) {
  return <span dir="ltr" style={mono}>{children}</span>;
}

/**
 * `abuseCases` — the harassment / abuse cases this viewer may see (HR: those it runs; a worker: his own),
 * so the model Arts. 54–56 rows read their status from them. `calendar` skips official holidays.
 */
export default function VoiceLawPanel({ ar, breached = 0, abuseCases = [], calendar, today }) {
  const [source, setSource] = useState("all");
  const day = today || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const abuse = abuseLawStatus(abuseCases, { today: day, calendar });
  const n = (value) => <span dir="ltr" style={mono}>{value}</span>;
  const rows = [
    {
      key: "regs-window",
      source: "regs",
      badge: ar ? "اللائحة" : "Regs",
      title: ar ? "قناة داخلية بمهلة — لا يُهمل صوت" : "An internal channel with a window — no voice is dropped",
      note: ar ? "ما لا يُراجع في مهلته يُرفع تلقائياً للمستوى التالي، ولا يُغلق بلا قرار مكتوب." : "What is not reviewed in its window is raised to the next level; nothing closes without a written ruling.",
      status: breached > 0 ? "alert" : "settled",
      pill: breached > 0 ? (ar ? `${breached} فاتت مهلته فصعد` : `${breached} raised on a missed window`) : (ar ? "مستوفى" : "Met"),
    },
    {
      key: "model-54",
      source: "model",
      badge: ar ? "النموذج الموحد م54" : "Model Art. 54",
      title: ar ? "ما يُعد إيذاءً في مكان العمل" : "What counts as abuse at work",
      note: ar
        ? "كل إساءة أو استغلال أو ابتزاز أو إغراء أو تهديد — جسدي أو نفسي أو جنسي — من صاحب العمل أو العامل أو زميل، بالقول أو الكتابة أو الإشارة أو الوسائل الإلكترونية؛ والمساعدة والتستر في حكمه."
        : "Any abuse, exploitation, blackmail, luring or threat — physical, psychological or sexual — by employer, worker or colleague, in words, writing, gesture or electronically; helping or covering it up counts too.",
      status: "void",
      pill: ar ? "للعلم" : "For reference",
    },
    {
      key: "model-55-1",
      source: "model",
      badge: ar ? "النموذج الموحد م55/1" : "Model Art. 55(1)",
      title: ar ? <>الشكوى للمنشأة خلال {n(ABUSE_WORKING_DAYS)} أيام عمل من الواقعة</> : <>Complain to the company within {n(ABUSE_WORKING_DAYS)} working days of the incident</>,
      note: ar
        ? "يُفحص عند التقديم في «تحرش أو إيذاء»، ويجوز للشاهد أن يبلّغ؛ وإن كان الإيذاء من صاحب المنشأة أو أعلى سلطة فيها فالشكوى للجهة الحكومية المختصة. لا يُسقط ذلك حق اللجوء للجهات الحكومية."
        : "Checked when filed under «Harassment or abuse»; a witness may report. Against the owner or the top authority, the complaint goes to the competent government body. The right to go to the authorities stays.",
      status: "settled",
      pill: ar ? "يُفحص عند التقديم" : "Checked on filing",
    },
    {
      key: "model-55-2",
      source: "model",
      badge: ar ? "النموذج الموحد م55/2" : "Model Art. 55(2)",
      title: ar ? <>لجنة بقرار تحقق وتوصي خلال {n(ABUSE_WORKING_DAYS)} أيام عمل من تلقي الشكوى</> : <>A committee by decision investigates and recommends within {n(ABUSE_WORKING_DAYS)} working days</>,
      note: ar
        ? <>{n(abuse.total)} قضية · {n(abuse.inquiry)} في مهلتها · {n(abuse.overdue)} تجاوزتها · {n(abuse.decided)} بتوصية مكتوبة — أيام العمل لا تشمل الراحة الأسبوعية والعطل الرسمية.</>
        : <>{n(abuse.total)} case(s) · {n(abuse.inquiry)} in window · {n(abuse.overdue)} past it · {n(abuse.decided)} with a written recommendation — working days skip rest days and official holidays.</>,
      status: abuse.overdue ? "alert" : abuse.inquiry ? "waiting" : abuse.total ? "settled" : "void",
      pill: abuse.overdue
        ? (ar ? `${abuse.overdue} تجاوزت المهلة` : `${abuse.overdue} past the window`)
        : abuse.inquiry
          ? (ar ? `${abuse.inquiry} قيد التحقيق` : `${abuse.inquiry} under inquiry`)
          : abuse.total ? (ar ? "مستوفى" : "Met") : (ar ? "لا قضية" : "No case"),
    },
    {
      key: "model-56",
      source: "model",
      badge: ar ? "النموذج الموحد م56" : "Model Art. 56",
      title: ar ? "السرية ومحاضر موقعة" : "Confidentiality and signed minutes",
      note: ar
        ? "تسمع اللجنة الأطراف والشهود بسرية في محاضر يوقعونها، ولها التوصية بالتفريق أثناء التحقيق، وترفع ما يشكل جريمة للمدير العام. القضية لا يراها إلا الموارد البشرية وأعضاء لجنتها وصاحبها."
        : "The committee hears parties and witnesses confidentially in signed minutes, may recommend separating them, and refers crimes to the general manager. Only HR, the committee and the filer see the case.",
      status: abuse.exposed ? "alert" : "settled",
      pill: abuse.exposed ? (ar ? `${abuse.exposed} غير سرية` : `${abuse.exposed} not confidential`) : (ar ? "مستوفى" : "Met"),
    },
    {
      key: "labour-61",
      source: "labour",
      badge: ar ? "م 61" : "Art. 61",
      title: ar ? "حسن المعاملة وحفظ الكرامة" : "Decent treatment and dignity",
      note: ar ? "أي جزاء مرتبط بصوت يُبطل، والصوت لا يصل إلى من هو عنه، ولا يراجع أحد صوتاً رفعه." : "A sanction tied to a voice is void, a voice never reaches the person it is about, and no one reviews their own voice.",
      status: "settled",
      pill: ar ? "مستوفى" : "Met",
    },
    {
      key: "labour-220",
      source: "labour",
      badge: ar ? "م 220" : "Art. 220",
      title: ar ? "التسوية الودية ثم المحكمة العمالية" : "Amicable settlement, then the labour court",
      note: ar ? "المسار الداخلي لا يُسقط حق صاحب الصوت؛ تبقى التسوية الودية ثم المحكمة العمالية." : "The internal path does not remove the right; amicable settlement and then the labour court remain.",
      status: "void",
      pill: ar ? "للعلم" : "For reference",
    },
  ];
  const tally = (list) => ({
    waiting: list.filter((row) => row.status === "waiting").length,
    alert: list.filter((row) => row.status === "alert").length,
    met: list.filter((row) => row.status === "settled").length,
    info: list.filter((row) => row.status === "void").length,
  });
  const counters = (t) => (
    <>
      <Counter value={t.alert} label={ar ? "تنبيه" : "alert"} tone="warn" />
      {t.waiting ? <Counter value={t.waiting} label={ar ? "قيد التحقيق" : "in inquiry"} tone="warn" /> : null}
      <Counter value={t.met} label={ar ? "مستوفى" : "met"} tone="ok" />
      {t.info ? <Counter value={t.info} label={ar ? "للعلم" : "reference"} tone="mute" /> : null}
    </>
  );
  const cards = [
    {
      key: "regs",
      badge: ar ? "اللائحة" : "Regs",
      title: ar ? "لائحة تنظيم العمل — قناة الصوت" : "Work regulations — the voice channel",
      scope: ar ? "المهلة، التصعيد تلقائياً، والقرار المكتوب قبل الإغلاق." : "The window, automatic escalation, and a written ruling before closing.",
    },
    {
      key: "model",
      badge: ar ? "النموذج الموحد" : "Model reg.",
      title: ar ? "النموذج الموحد م54–56 — التحرش والإيذاء" : "Model regulation Arts. 54–56 — harassment and abuse",
      scope: ar ? "الشكوى خلال خمسة أيام عمل، لجنة تحقق خلال خمسة أيام عمل، والسرية." : "Complaint within five working days, a committee inquiry within five working days, confidentiality.",
    },
    {
      key: "labour",
      title: ar ? "نظام العمل — الكرامة والتقاضي" : "Labour Law — dignity and recourse",
      scope: ar ? "حسن المعاملة وبطلان الانتقام (61)، والتسوية الودية ثم المحكمة (220)." : "Decent treatment and no reprisal (61); settlement then the court (220).",
    },
  ].map((card) => {
    const t = tally(rows.filter((row) => row.source === card.key));
    return { ...card, tone: t.alert || t.waiting ? "warn" : t.met ? "ok" : "mute", counters: counters(t) };
  });
  const total = tally(rows);
  const groups = cards
    .filter((card) => source === "all" || source === card.key)
    .map((card) => ({ card, rows: rows.filter((row) => row.source === card.key) }));

  return (
    <section data-voice-ministry="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={ar ? "أنظمة الوزارة — ما يخص صوت الموظف" : "Ministry rules — the employee voice"}
        note={ar
          ? <>قراءة فقط · <Num>{rows.length}</Num> قواعد تحكم القناة، وكل سطر يقول هل تستوفيها المنصة الآن.</>
          : <>Read only · <Num>{rows.length}</Num> rules govern the channel; each row says whether the platform meets it now.</>}
        trailing={<div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>{counters(total)}</div>}
      />
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <MinistrySourceCards cards={cards} active={source} onPick={setSource} ar={ar} />
      </div>
      {groups.map(({ card, rows: list }) => (
        <div key={card.key} data-voice-ministry-group={card.key} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            <span style={ministryBadgeStyle(card.badge ? "" : card.key, ar, card.badge ? { fontFamily: "inherit", direction: "rtl" } : {})}>{card.badge || (ar ? "م/51" : "M/51")}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5, flex: "1 1 180px", minWidth: 0 }}>{card.title}</span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}><Num>{list.length}</Num> {ar ? "في المجموع" : "in all"}</span>
          </div>
          {list.map((row) => (
            <MinistryRow key={row.key} rowKey={row.key} source={row.source} badge={row.badge} status={row.status} pill={row.pill} title={row.title} note={row.note} ar={ar} />
          ))}
        </div>
      ))}
      <RegsSourceLine ar={ar} />
    </section>
  );
}
