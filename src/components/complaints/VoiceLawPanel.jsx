import React, { useState } from "react";
import { mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, { Counter, ministryBadgeStyle, MinistryRow, RegsSourceLine } from "@/components/schedules/MinistrySourceCards";
import { VOICE_MINISTRY_CARDS, voiceMinistryRows } from "@/lib/voiceMinistryRows";
import useHashScroll from "@/hooks/useHashScroll";

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
 * The rows live in lib/voiceMinistryRows — the «الامتثال الوزاري» index counts the same ones.
 */
export default function VoiceLawPanel({ ar, breached = 0, abuseCases = [], calendar, today }) {
  const [source, setSource] = useState("all");
  useHashScroll("nv-ministry-voice");
  const day = today || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const rows = voiceMinistryRows({ breached, abuseCases, calendar, today: day, ar });
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
  const cards = VOICE_MINISTRY_CARDS(ar).map((card) => {
    const t = tally(rows.filter((row) => row.source === card.key));
    return { ...card, tone: t.alert || t.waiting ? "warn" : t.met ? "ok" : "mute", counters: counters(t) };
  });
  const total = tally(rows);
  const groups = cards
    .filter((card) => source === "all" || source === card.key)
    .map((card) => ({ card, rows: rows.filter((row) => row.source === card.key) }));

  return (
    <section id="nv-ministry-voice" data-voice-ministry="1" style={{ ...slab, display: "flex", flexDirection: "column", scrollMarginTop: 88 }}>
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
