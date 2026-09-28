import React, { useMemo, useState } from "react";

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

function chip(on) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 8,
    border: on ? "none" : "1px solid var(--nv-line)",
    background: on ? "var(--nv-navy)" : "var(--nv-card)",
    color: on ? "#fff" : "var(--nv-ink2)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function dotColor(band) {
  if (band === "urgent") return "#9B2335";
  if (band === "decision") return "#C8A45A";
  return "#8A938C";
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

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      role="dialog"
      aria-label={ar ? "إشعارات كل نطاقي" : "Notices for all my scope"}
      style={{
        width: "100%",
        maxHeight: "min(76vh, 640px)",
        display: "flex",
        flexDirection: "column",
        background: "var(--nv-card)",
        border: "1px solid var(--nv-line)",
        borderTop: "3px solid var(--nv-navy)",
        borderRadius: 8,
        boxShadow: "0 18px 44px rgba(12,20,16,.18)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{ar ? "إشعارات كل نطاقي" : "Notices for all my scope"}</strong>
          <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{ar ? "مرتّبة بالأولوية · مجمّعة لكل فرع" : "By priority · grouped per branch"}</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {BANDS.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setBand(entry.id)} style={chip(band === entry.id)}>
              {ar ? entry.ar : entry.en}
              <span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{sum(entry.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        {brief.length > 0 ? (
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--nv-line)", background: "#F6FAF7", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "اليوم في فروعك" : "Today in your branches"}</span>
            {brief.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onPickBranch?.(row.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 44px 44px 44px",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 11.5,
                  padding: "3px 0",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "start",
                  color: "var(--nv-ink)",
                }}
              >
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "center", color: "var(--nv-bad-ink)", fontWeight: 600, unicodeBidi: "isolate" }}>{row.urgent || ""}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "center", color: "var(--nv-warn-ink)", fontWeight: 600, unicodeBidi: "isolate" }}>{row.decision || ""}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "center", color: "var(--nv-muted)", unicodeBidi: "isolate" }}>{row.info || ""}</span>
              </button>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 44px 44px 44px", gap: 6, fontSize: 9.5, color: "var(--nv-muted)" }}>
              <span />
              <span style={{ textAlign: "center" }}>{ar ? "عاجل" : "Urgent"}</span>
              <span style={{ textAlign: "center" }}>{ar ? "قرارك" : "Yours"}</span>
              <span style={{ textAlign: "center" }}>{ar ? "للعلم" : "Notice"}</span>
            </div>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div style={{ padding: 22, textAlign: "center", fontSize: 12, color: "var(--nv-muted)" }}>
            {ar ? "لا إشعارات في هذا الفلتر." : "No notices in this filter."}
          </div>
        ) : rows.map((item) => (
          <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderBottom: "1px solid var(--nv-line)" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, background: dotColor(item.band), flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{ar ? item.titleAr : item.titleEn}</strong>
                <span dir="ltr" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--nv-muted)", unicodeBidi: "isolate" }}>{`${item.count}×`}</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{`${item.branch} · ${ar ? item.kindAr : item.kindEn}`}</span>
              <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{ar ? "الآن" : "Now"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => onOpen?.(item)}
                style={{ border: "none", background: "transparent", padding: 0, fontSize: 11, fontWeight: 600, color: "var(--nv-ink)", cursor: "pointer", fontFamily: "inherit" }}
              >
                {ar ? "افتح ←" : "Open"}
              </button>
              <button
                type="button"
                onClick={() => markDone(item)}
                style={{ border: "none", background: "transparent", padding: 0, fontSize: 10.5, color: "var(--nv-muted)", cursor: "pointer", fontFamily: "inherit" }}
              >
                {ar ? "تمّ" : "Done"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 14px", borderTop: "1px solid var(--nv-line)", background: "var(--nv-soft)", fontSize: 10.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
        {ar
          ? "يصلك إشعار كل فرع تديره. فتح الإشعار يختار ذلك الفرع ويفتح قسمه. الحدث المتكرّر يُجمَّع، والعاجل بلا إجراء يصعد بعد 48 ساعة."
          : "You are notified for every branch you administer. Opening a notice selects that branch and opens its section. Repeats are grouped, and an urgent item with no action escalates after 48 hours."}
      </div>
    </div>
  );
}
