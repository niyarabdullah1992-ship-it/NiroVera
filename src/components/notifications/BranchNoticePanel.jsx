import React, { useMemo, useState } from "react";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { KindTile, NoticeFoot, NoticeHead, NoticeShell, rowChip } from "@/components/notifications/noticeChrome";

const MONO = "'IBM Plex Mono', monospace";
const BANDS = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "urgent", ar: "عاجل", en: "Urgent" },
  { id: "decision", ar: "قرارك", en: "Your decision" },
  { id: "info", ar: "للعلم", en: "For notice" },
];

function doneKey(companyId, userId) {
  return `powercare_branch_notice_done_${companyId || "local"}_${userId || "me"}`;
}

function readDone(companyId, userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(doneKey(companyId, userId)) || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

function bandTone(band) {
  if (band === "urgent") return "bad";
  if (band === "decision") return "warn";
  return "navy";
}

/**
 * Alerts for every branch the viewer administers.
 * Opening a row selects that branch and opens its section.
 */
export default function BranchNoticePanel({
  items = [],
  lang = "ar",
  companyId,
  userId,
  onOpen,
  onPickBranch,
  embedded = false,
}) {
  const ar = lang === "ar";
  const [band, setBand] = useState("all");
  const [doneTick, setDoneTick] = useState(0);
  const done = useMemo(() => readDone(companyId, userId), [companyId, userId, doneTick]);
  const live = items.filter((item) => !done.has(`${item.id}:${item.count}`));
  const sum = (id) => live.filter((item) => id === "all" || item.band === id).reduce((total, item) => total + item.count, 0);
  const rows = live.filter((item) => band === "all" || item.band === band);
  const brief = useMemo(() => {
    const byId = new Map();
    for (const item of live) {
      const row = byId.get(item.stationId) || { id: item.stationId, name: item.branch, urgent: 0, decision: 0, info: 0 };
      row[item.band] += item.count;
      byId.set(item.stationId, row);
    }
    return [...byId.values()];
  }, [live]);

  const markDone = (item) => {
    const next = readDone(companyId, userId);
    next.add(`${item.id}:${item.count}`);
    try {
      localStorage.setItem(doneKey(companyId, userId), JSON.stringify([...next]));
    } catch {
      /* ignore quota */
    }
    setDoneTick((value) => value + 1);
  };

  const body = (
    <div data-scope-notices style={{ overflow: "auto", flex: 1, minHeight: 0, padding: "8px 10px 10px", display: "grid", alignContent: "start", gridAutoRows: "max-content", gap: 6 }}>
      <div style={{ padding: "2px 2px 0" }}>
        <StatusFilterPills
          bare
          size="sm"
          dataKey="scope-notices"
          value={band}
          onChange={setBand}
          items={BANDS.map((entry) => ({ id: entry.id, label: ar ? entry.ar : entry.en, n: sum(entry.id) }))}
        />
      </div>

      {brief.length > 0 ? (
        <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line2)", borderRadius: 10, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 46px 46px 46px", gap: 6, fontSize: 10.5, color: "var(--nv-muted)", alignItems: "baseline" }}>
            <strong style={{ fontSize: 11.5, color: "var(--nv-ink)" }}>{ar ? "اليوم في فروعك" : "Today in your branches"}</strong>
            <span style={{ textAlign: "center" }}>{ar ? "عاجل" : "Urgent"}</span>
            <span style={{ textAlign: "center" }}>{ar ? "قرارك" : "Yours"}</span>
            <span style={{ textAlign: "center" }}>{ar ? "للعلم" : "Notice"}</span>
          </div>
          {brief.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onPickBranch?.(row.id)}
              title={ar ? "اختر هذا الفرع في «نطاقك»" : "Pick this branch in your scope"}
              style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 46px 46px 46px", gap: 6, alignItems: "center", fontSize: 12, padding: "5px 0", border: "none", borderTop: "1px solid var(--nv-line2)", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "start", color: "var(--nv-ink)" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <KindTile tone="ok" letter={String(row.name || "").replace(/^فرع\s+/u, "").slice(0, 1)} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{row.name}</span>
              </span>
              {["urgent", "decision", "info"].map((key) => (
                <span key={key} style={{ textAlign: "center" }}>
                  {row[key]
                    ? <span dir="ltr" style={{ ...rowChip(bandTone(key)), fontFamily: MONO, unicodeBidi: "isolate" }}>{row[key]}</span>
                    : <span style={{ color: "var(--nv-line)" }}>—</span>}
                </span>
              ))}
            </button>
          ))}
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div style={{ padding: "16px 14px", background: "var(--nv-card)", border: "1px solid var(--nv-line2)", borderRadius: 10, fontSize: 12, color: "var(--nv-muted)" }}>
          {ar ? "لا إشعارات في هذا الفلتر." : "No notices in this filter."}
        </div>
      ) : rows.map((item) => (
        <div key={item.id} data-scope-notice={item.band} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 10px 10px 8px", background: "var(--nv-card)", border: `1px solid ${item.band === "urgent" ? "var(--nv-bad-line)" : "var(--nv-line2)"}`, borderRadius: 10 }}>
          <KindTile tone={bandTone(item.band)} letter={item.band === "urgent" ? "!" : item.band === "decision" ? "ق" : "i"} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.6 }}>{ar ? item.titleAr : item.titleEn}</strong>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={rowChip("ok")}>{item.branch}</span>
              <span style={rowChip("navy")}>{ar ? item.kindAr : item.kindEn}</span>
              <span dir="ltr" style={{ ...rowChip(bandTone(item.band)), fontFamily: MONO, unicodeBidi: "isolate" }}>{`×${item.count}`}</span>
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "stretch", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onOpen?.(item)}
              style={{ fontFamily: "inherit", height: 28, padding: "0 12px", borderRadius: 8, border: "none", background: "var(--nv-btn-fill, #0B3D27)", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
            >
              {ar ? "افتح" : "Open"}
            </button>
            <button
              type="button"
              onClick={() => markDone(item)}
              style={{ fontFamily: "inherit", height: 24, padding: "0 10px", borderRadius: 8, border: "1px solid var(--nv-line2)", background: "var(--nv-card)", color: "var(--nv-muted)", fontSize: 10.5, cursor: "pointer" }}
            >
              {ar ? "تمّ" : "Done"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  if (embedded) return body;
  return (
    <NoticeShell ar={ar} label={ar ? "إشعارات كل نطاقي" : "Notices for all my scope"}>
      <NoticeHead title={ar ? "إشعارات كل نطاقي" : "Notices for all my scope"} sub={ar ? "مرتّبة بالأولوية · مجمّعة لكل فرع" : "By priority · grouped per branch"} />
      {body}
      <NoticeFoot>{SCOPE_FOOT[ar ? "ar" : "en"]}</NoticeFoot>
    </NoticeShell>
  );
}

export const SCOPE_FOOT = {
  ar: "يصلك إشعار كل فرع تديره. فتح الإشعار يختار ذلك الفرع ويفتح قسمه. الحدث المتكرّر يُجمَّع، والعاجل بلا إجراء يصعد بعد 48 ساعة.",
  en: "You are notified for every branch you administer. Opening a notice selects that branch and opens its section. Repeats are grouped, and an urgent item with no action escalates after 48 hours.",
};
