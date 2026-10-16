import React, { useState } from "react";
import { mono, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, { Counter, ministryBadgeStyle, MinistryRow, RegsSourceLine } from "@/components/schedules/MinistrySourceCards";

/**
 * «أنظمة الوزارة — …» for a surface that has no week roster: the same frame as VoiceLawPanel and
 * RequestsMinistryPanel — source cards, group bands, MinistryRow — fed with rows already derived by
 * the caller. The panel judges nothing itself; each row carries its status:
 *   blocked / alert → the platform found a gap · waiting → open, inside its window
 *   settled → met now · void → information («للعلم») or not applicable
 *
 * cards: [{ key, badge?, title, scope }] · rows: [{ key, source, badge, title, note?, sub?, status, pill }]
 */
function Num({ children }) {
  return <span dir="ltr" style={mono}>{children}</span>;
}

const tally = (list) => ({
  block: list.filter((row) => row.status === "blocked" || row.status === "violation").length,
  alert: list.filter((row) => row.status === "alert" || row.status === "waiting").length,
  met: list.filter((row) => row.status === "settled").length,
  info: list.filter((row) => row.status === "void").length,
});

export default function MinistryLawPanel({ ar = true, title, note, cards = [], rows = [], dataKey = "law", footer }) {
  const [source, setSource] = useState("all");
  const counters = (t) => (
    <>
      {t.block ? <Counter value={t.block} label={ar ? "مانع" : "block"} tone="bad" /> : null}
      <Counter value={t.alert} label={ar ? "تنبيه" : "alert"} tone="warn" />
      <Counter value={t.met} label={ar ? "مستوفى" : "met"} tone="ok" />
      {t.info ? <Counter value={t.info} label={ar ? "للعلم" : "reference"} tone="mute" /> : null}
    </>
  );
  const shown = cards.filter((card) => rows.some((row) => row.source === card.key)).map((card) => {
    const t = tally(rows.filter((row) => row.source === card.key));
    return { ...card, tone: t.block ? "bad" : t.alert ? "warn" : t.met ? "ok" : "mute", counters: counters(t) };
  });
  const groups = shown
    .filter((card) => source === "all" || source === card.key)
    .map((card) => ({ card, rows: rows.filter((row) => row.source === card.key) }));

  return (
    <section data-ministry-law={dataKey} style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={title}
        note={note ?? (ar
          ? <>قراءة فقط · <Num>{rows.length}</Num> قاعدة، وكل سطر يقول هل تستوفيها المنصة الآن أو أنه للعلم.</>
          : <>Read only · <Num>{rows.length}</Num> rules; each row says whether the platform meets it now, or is for reference.</>)}
        trailing={<div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>{counters(tally(rows))}</div>}
      />
      {shown.length > 1 ? (
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
          <MinistrySourceCards cards={shown} active={source} onPick={setSource} ar={ar} />
        </div>
      ) : null}
      {groups.map(({ card, rows: list }) => (
        <div key={card.key} data-ministry-law-group={card.key} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
            <span style={ministryBadgeStyle(card.badge ? "" : card.key, ar, card.badge ? { fontFamily: "inherit", direction: "rtl" } : {})}>{card.badge || (ar ? "م/51" : "M/51")}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5, flex: "1 1 180px", minWidth: 0 }}>{card.title}</span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}><Num>{list.length}</Num> {ar ? "في المجموع" : "in all"}</span>
          </div>
          {list.map((row) => (
            <MinistryRow key={row.key} rowKey={row.key} source={row.source} badge={row.badge} status={row.status} pill={row.pill} title={row.title} note={row.note} sub={row.sub} ar={ar} />
          ))}
        </div>
      ))}
      {footer ? (
        <p style={{ margin: 0, padding: "10px 18px 0", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>{footer}</p>
      ) : null}
      <RegsSourceLine ar={ar} />
    </section>
  );
}
