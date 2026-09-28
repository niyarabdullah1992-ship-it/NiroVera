import React, { useRef, useState } from "react";
import { isHeatBanDate } from "@/lib/contractLawDerivations";
import { SAFETY_REPORT_CONTROLS, deriveOpenRiskMap, safetyReportSlaLine } from "@/lib/safetyReportCard";
import { PERMIT_TYPES } from "@/lib/safetyStandards";

const MONO = "'IBM Plex Mono', monospace";

const shell = {
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(12,20,16,.04)",
  overflow: "hidden",
};

function dash(value) {
  const text = value == null ? "" : String(value).trim();
  return text || "—";
}

function levelTone(tone) {
  if (tone === "crit") return { color: "#fff", background: "#9B2335" };
  if (tone === "bad") return { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" };
  if (tone === "warn") return { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  if (tone === "ok") return { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" };
  return { color: "var(--nv-ink3)", background: "var(--nv-soft)" };
}

function heatColor(score) {
  if (score >= 15) return "#C74B5E";
  if (score >= 10) return "#E7A0AA";
  if (score >= 5) return "#EFD08F";
  return "#A9D4B7";
}

function permitTypeLabel(type, ar) {
  const row = PERMIT_TYPES.find((item) => item[0] === type);
  return row ? (ar ? row[1] : row[2]) : "—";
}

function permitState(permit, now) {
  if (permit?.status === "cancelled") return "cancelled";
  if (permit?.status === "closed") return "closed";
  const until = new Date(permit?.validUntil).getTime();
  if (Number.isFinite(until) && until < now) return "expired";
  return "open";
}

function checklistCell(result, ar) {
  if (!result?.status) return { t: "—", sub: "—", tone: "idle" };
  if (result.status === "yes") return { t: ar ? "مطابق" : "Met", sub: result.comment || "—", tone: "ok" };
  if (result.status === "no") return { t: ar ? "يحتاج معالجة" : "Needs work", sub: result.comment || "—", tone: "bad" };
  return { t: ar ? "ملاحظة" : "Note", sub: result.comment || "—", tone: "warn" };
}

const READY_KEYS = [
  ["nfpa_team", "الإسعافات الأولية", "First aid"],
  ["iso_emergency", "حقيبة الإسعاف", "First-aid kit"],
  ["nfpa_ext", "طفايات الحريق", "Extinguishers"],
  ["nfpa_drill", "تمرين الإخلاء", "Evacuation drill"],
  ["iso_audit", "التفتيش الشهري", "Monthly inspection"],
];

function Kpi({ label, value, sub, tone }) {
  const color = tone === "bad" ? "#9B2335" : tone === "warn" ? "#8A5A12" : tone === "ok" ? "#3C7D50" : "var(--nv-ink)";
  return (
    <div style={{ ...shell, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>{label}</span>
      <strong style={{ font: `700 22px ${MONO}`, direction: "ltr", textAlign: "start", color }}>{dash(value)}</strong>
      <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{dash(sub)}</span>
    </div>
  );
}

export function SafetyDashboard({ ar, stations, recFor, onOpenRegister }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const openReports = [];
  let openHazards = 0;
  let activePermits = 0;
  let expiringWeek = 0;
  let lastInjuryAt = 0;
  stations.forEach((station) => {
    const rec = recFor(station.id) || {};
    openHazards += (rec.hazards || []).filter((hazard) => !hazard?.closedAt).length;
    (rec.incidentLog || []).forEach((item) => {
      if (item.status === "closed") {
        if (item.card?.injured || item.card?.kind === 3) lastInjuryAt = Math.max(lastInjuryAt, new Date(item.at || 0).getTime() || 0);
        return;
      }
      openReports.push(item);
      if (item.card?.injured || item.card?.kind === 3) lastInjuryAt = Math.max(lastInjuryAt, new Date(item.at || 0).getTime() || 0);
    });
    (rec.ltiEntries || []).forEach((entry) => {
      const at = new Date(entry.date).getTime();
      if (Number.isFinite(at)) lastInjuryAt = Math.max(lastInjuryAt, at);
    });
    (rec.permits || []).forEach((permit) => {
      const state = permitState(permit, now);
      if (state !== "open") return;
      activePermits += 1;
      const until = new Date(permit.validUntil).getTime();
      if (Number.isFinite(until) && until - now <= 7 * 86400000) expiringWeek += 1;
    });
  });

  const heat = [];
  for (let severity = 5; severity >= 1; severity -= 1) {
    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      const count = openReports.filter((item) => Number(item.card?.likelihood) === likelihood && Number(item.card?.severity) === severity).length;
      heat.push({ likelihood, severity, count, score: likelihood * severity });
    }
  }
  const riskMap = deriveOpenRiskMap(openReports);
  const legendColors = {
    critical: "#C74B5E",
    high: "#E7A0AA",
    medium: "#EFD08F",
    low: "#A9D4B7",
    ungraded: "var(--nv-ink3)",
  };

  const due = openReports
    .map((item) => {
      const line = safetyReportSlaLine(item.card, item.at, now, ar);
      const hours = item.card?.levelKey === "critical" ? 0 : item.card?.levelKey === "high" ? 24 : item.card?.levelKey === "medium" ? 72 : item.card?.levelKey === "low" ? 168 : null;
      const end = hours == null || !item.at ? null : new Date(item.at).getTime() + hours * 3600000;
      const days = end == null ? null : Math.ceil((end - now) / 86400000);
      return { item, line, days };
    })
    .filter((row) => row.days != null && row.days <= 7)
    .sort((a, b) => a.days - b.days);

  const readyRows = stations.map((station) => {
    const rec = recFor(station.id) || {};
    const results = rec.checklistResults || {};
    const cells = READY_KEYS.map(([key]) => checklistCell(results[key], ar));
    const answered = cells.filter((cell) => cell.t !== "—");
    const yes = answered.filter((cell) => cell.tone === "ok").length;
    const pct = answered.length ? Math.round((yes / answered.length) * 100) : null;
    return { name: station.name, cells, pct };
  });
  const readyKnown = readyRows.filter((row) => row.pct != null);
  const readyAvg = readyKnown.length ? Math.round(readyKnown.reduce((sum, row) => sum + row.pct, 0) / readyKnown.length) : null;
  const daysClear = lastInjuryAt ? Math.max(0, Math.floor((now - lastInjuryAt) / 86400000)) : null;

  const goalPct = daysClear == null ? 0 : Math.min(100, Math.round((daysClear / 180) * 100));
  return (
    <div data-hse="admin-board" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Kpi label={L("مخاطر مفتوحة", "Open hazards")} value={openHazards} sub={L("في نطاقك", "In your scope")} tone={openHazards ? "bad" : "ok"} />
        <Kpi label={L("تصاريح عمل سارية", "Live permits")} value={activePermits} sub={expiringWeek ? (ar ? `${expiringWeek} تنتهي هذا الأسبوع` : `${expiringWeek} expire this week`) : "—"} tone={expiringWeek ? "warn" : "ok"} />
        <Kpi label={L("إتمام تدريب السلامة", "Safety training")} value="—" sub={L("لا سجل تدريب في النطاق", "No training record in scope")} />
        <Kpi label={L("جاهزية الفروع", "Branch readiness")} value={readyAvg == null ? "—" : `${readyAvg}%`} sub={L("الإسعاف · الإطفاء · الإخلاء", "First aid · fire · evacuation")} tone={readyAvg == null ? null : readyAvg >= 80 ? "ok" : "warn"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
        <article style={shell}>
          <div style={{ padding: "16px 18px", background: "linear-gradient(135deg,#0B3D27,#0F5535)", color: "#fff", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".08em", fontWeight: 700, color: "#A9CDB8" }}>{L("سجل الأمان", "Safe record")}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong style={{ font: `700 40px ${MONO}`, lineHeight: 1, direction: "ltr" }}>{daysClear == null ? "—" : daysClear}</strong>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{L("يوماً بلا إصابة مُضيِّعة للوقت", "days without a lost-time injury")}</span>
            </div>
            <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>{daysClear == null ? "—" : L("من آخر إصابة مسجّلة في النطاق", "Since the last recorded injury in scope")}</span>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden", marginTop: 4 }}>
              <div style={{ height: "100%", borderRadius: 999, background: "#C8A45A", width: `${goalPct}%` }} />
            </div>
            <span style={{ fontSize: 11, color: "#C5DBCD" }}>{daysClear == null ? "—" : L("الهدف السنوي 180 يوماً بلا إصابة مضيّعة للوقت", "Annual aim: 180 days without a lost-time injury")}</span>
          </div>
        </article>

        <article style={{ ...shell, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{L("خريطة المخاطر المفتوحة", "Open risk map")}</strong>
            <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{ar ? `${riskMap.openCount} بلاغاً مفتوحاً` : `${riskMap.openCount} open reports`}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "18px repeat(5, 38px)", gap: 4, justifyContent: "center", alignItems: "center" }}>
            {[5, 4, 3, 2, 1].map((severity) => (
              <React.Fragment key={`row-${severity}`}>
                <span style={{ font: `500 10.5px ${MONO}`, color: "var(--nv-ink3)", textAlign: "center" }}>{severity}</span>
                {heat.filter((cell) => cell.severity === severity).map((cell) => (
              <span
                key={`${cell.likelihood}-${cell.severity}`}
                title={`${cell.likelihood}×${cell.severity}`}
                onClick={() => { if (cell.count && onOpenRegister) onOpenRegister(); }}
                style={{
                  cursor: cell.count && onOpenRegister ? "pointer" : "default",
                  width: 38,
                  height: 30,
                  borderRadius: 5,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: `700 13px ${MONO}`,
                  color: cell.count ? (cell.score >= 15 ? "#fff" : "#111418") : "transparent",
                  background: heatColor(cell.score),
                  outline: cell.count ? "2px solid var(--nv-ink)" : "none",
                  outlineOffset: 1,
                }}
              >
                {cell.count ? cell.count : ""}
              </span>
                ))}
              </React.Fragment>
            ))}
            <span />
            {[1, 2, 3, 4, 5].map((likelihood) => (
              <span key={`col-${likelihood}`} style={{ font: `500 10.5px ${MONO}`, color: "var(--nv-ink3)", textAlign: "center" }}>{likelihood}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {riskMap.buckets.map((item) => (
              <span key={item.key} data-risk-band={item.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--nv-ink2)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: legendColors[item.key] }} />
                {ar ? item.ar : item.en}
                <span style={{ fontFamily: MONO, direction: "ltr" }}>{item.n}</span>
              </span>
            ))}
          </div>
          <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", textAlign: "center" }}>{L("الاحتمال أفقياً · الشدة من الأعلى", "Likelihood across · severity from the top")}</span>
        </article>

        <article style={shell}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{L("يستحق خلال 7 أيام", "Due within 7 days")}</strong>
            <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{due.length || "—"}</span>
          </div>
          {due.length ? due.map((row) => (
            <div key={row.item.id || row.item.at} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 18px", borderBottom: "1px solid var(--nv-line2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: row.days < 0 ? "#9B2335" : row.days <= 1 ? "#C8A45A" : "#3C7D50" }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 12.5, color: "var(--nv-ink)" }}>{dash(row.item.description || row.item.card?.what)}</strong>
                <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{dash(row.item.card?.code)}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink2)", whiteSpace: "nowrap" }}>{row.line}</span>
            </div>
          )) : <p style={{ margin: 0, padding: "18px", textAlign: "center", color: "var(--nv-ink3)" }}>—</p>}
        </article>
      </div>

      <article style={shell}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)" }}>
          <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{L("جاهزية الفروع", "Branch readiness")}</strong>
        </div>
        <div style={{ overflow: "auto" }}>
          <div style={{ minWidth: 760 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.2fr) repeat(5, minmax(110px,1fr)) 110px", background: "var(--nv-soft)", borderBottom: "1px solid var(--nv-line)" }}>
              {[L("الفرع", "Branch"), ...READY_KEYS.map((item) => L(item[1], item[2])), L("الجاهزية", "Readiness")].map((head) => (
                <span key={head} style={{ padding: "9px 12px", fontSize: 10.5, fontWeight: 700, color: "var(--nv-ink3)" }}>{head}</span>
              ))}
            </div>
            {readyRows.length ? readyRows.map((row) => (
              <div key={row.name} style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.2fr) repeat(5, minmax(110px,1fr)) 110px", borderBottom: "1px solid var(--nv-line2)", alignItems: "center" }}>
                <strong style={{ padding: "11px 12px", fontSize: 12.5, color: "var(--nv-ink)" }}>{row.name}</strong>
                {row.cells.map((cell, index) => (
                  <div key={READY_KEYS[index][0]} style={{ padding: "11px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ ...levelTone(cell.tone === "idle" ? "" : cell.tone), display: "inline-flex", width: "fit-content", height: 22, alignItems: "center", padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{cell.t}</span>
                    <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>{cell.sub}</span>
                  </div>
                ))}
                <strong style={{ padding: "11px 12px", fontFamily: MONO, direction: "ltr", color: "var(--nv-ink)" }}>{row.pct == null ? "—" : `${row.pct}%`}</strong>
              </div>
            )) : <p style={{ margin: 0, padding: 18, textAlign: "center", color: "var(--nv-ink3)" }}>—</p>}
          </div>
        </div>
      </article>
    </div>
  );
}

export function SafetyRiskRegister({ ar, rows, canAct, onPatch }) {
  const L = (a, e) => (ar ? a : e);
  const fileRef = useRef(null);
  const [pendingClose, setPendingClose] = useState(null);
  const now = Date.now();

  const askClose = (row) => {
    setPendingClose(row);
    fileRef.current?.click();
  };
  const rowKey = (row) => row.item.id || `${row.stationId}-${row.item.at}`;
  const [picked, setPicked] = useState("");
  const selected = rows.find((row) => rowKey(row) === picked) || rows[0] || null;
  const card = selected?.item?.card || {};
  const score = Number(card.score) || 0;
  const crit = score >= 15 || card.levelKey === "critical";

  return (
    <div data-hse="admin-register" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
    <section style={{ ...shell, flex: "1 1 260px", minWidth: 0 }}>
      <header style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{L("سجل المخاطر", "Risk register")}</strong>
        <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{ar ? `${rows.length} مفتوحة` : `${rows.length} open`}</span>
      </header>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const name = event.target.files?.[0]?.name || "";
          const row = pendingClose;
          event.target.value = "";
          setPendingClose(null);
          if (row && name) onPatch(row.stationId, row.item.id, { afterPhotoName: name });
        }}
      />
      <div style={{ maxHeight: 640, overflow: "auto" }}>
        {rows.length ? rows.map((row) => {
          const rowCard = row.item.card || {};
          const on = selected && rowKey(row) === rowKey(selected);
          const tone = levelTone(rowCard.levelTone || "");
          return (
            <button
              key={rowKey(row)}
              type="button"
              onClick={() => setPicked(rowKey(row))}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                border: "none",
                borderBottom: "1px solid var(--nv-line2)",
                background: on ? "var(--nv-soft)" : "transparent",
                boxShadow: on ? "inset -3px 0 0 var(--nv-ink)" : "none",
                cursor: "pointer",
                textAlign: "start",
                fontFamily: "inherit",
                color: "inherit",
              }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 8, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", font: `700 12px ${MONO}`, ...tone }}>{rowCard.score || "—"}</span>
              <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                <strong style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dash(row.item.description || rowCard.what)}</strong>
                <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{dash(rowCard.code)} · {dash(rowCard.categoryAr && ar ? rowCard.categoryAr : rowCard.categoryEn)}</span>
              </span>
              <span style={{ ...tone, height: 22, display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, flex: "none" }}>{row.item.status === "closed" ? L("مُغلق", "Closed") : L("مفتوح", "Open")}</span>
            </button>
          );
        }) : <p style={{ margin: 0, padding: 18, textAlign: "center", color: "var(--nv-ink3)" }}>—</p>}
      </div>
    </section>
    <article style={{ ...shell, flex: "999 1 520px", minWidth: 0, borderTop: crit ? "3px solid #9B2335" : undefined }}>
      {selected ? (
        <>
          <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ font: `600 11px ${MONO}`, color: "var(--nv-ink3)", direction: "ltr" }}>{dash(card.code)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 999, padding: "0 8px" }}>{dash(ar ? card.categoryAr : card.categoryEn)}</span>
              </div>
              <strong style={{ fontSize: 18, lineHeight: 1.4, color: "var(--nv-ink)" }}>{dash(selected.item.description || card.what)}</strong>
              <span style={{ fontSize: 12, color: "var(--nv-ink3)" }}>{dash(selected.stationName)}{card.where ? ` · ${card.where}` : ""}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <span style={{ ...levelTone(card.levelTone || (crit ? "crit" : "")), height: 26, display: "inline-flex", alignItems: "center", padding: "0 11px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{dash(ar ? card.levelAr : card.levelEn)}</span>
              <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{safetyReportSlaLine(card, selected.item.at, now, ar)}</span>
            </div>
          </header>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, borderBottom: "1px solid var(--nv-line)" }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".08em", fontWeight: 700, color: "var(--nv-ink3)" }}>{L("وصف الخطر", "Hazard")}</span>
            <span style={{ fontSize: 13, lineHeight: 1.8, color: "var(--nv-ink)" }}>{dash(selected.item.description || card.what)}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", border: "1px solid var(--nv-line)", borderRadius: 8, overflow: "hidden" }}>
              {[
                [L("الفرع", "Branch"), dash(selected.stationName)],
                [L("المالك", "Owner"), selected.item.anonymous ? L("بلاغ بلا اسم", "Anonymous") : dash(selected.item.by)],
                [L("إصابة", "Injury"), card.injured ? L("نعم", "Yes") : L("بلا إصابة", "No injury")],
                [L("الضابط", "Control"), dash(ar ? card.controlAr : card.controlEn)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "9px 12px", borderInlineStart: "1px solid var(--nv-line2)" }}>
                  <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>{label}</span>
                  <strong style={{ fontSize: 12.5 }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".08em", fontWeight: 700, color: "var(--nv-ink3)" }}>{L("تسلسل الضوابط", "Hierarchy of controls")}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
              {SAFETY_REPORT_CONTROLS.map((control, index) => {
                const on = card.controlId === control.id;
                return (
                  <div key={control.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 10, borderRadius: 8, border: `1px solid ${on ? "#3C7D50" : "var(--nv-line)"}`, background: on ? "var(--nv-ok-soft)" : "var(--nv-soft)", opacity: on || !card.controlId ? 1 : 0.7 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", font: `700 10px ${MONO}`, background: on ? "#3C7D50" : "var(--nv-card)", color: on ? "#fff" : "var(--nv-ink3)" }}>{index + 1}</span>
                    <strong style={{ fontSize: 12 }}>{ar ? control.ar : control.en}</strong>
                  </div>
                );
              })}
            </div>
          </div>
          <footer style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", background: "var(--nv-soft)" }}>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>{L("لا يُغلق البند قبل صورة بعد واعتماد الإجراء.", "A report stays open until the action is approved and an after photo is filed.")}</span>
            {canAct ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button type="button" onClick={() => onPatch(selected.stationId, selected.item.id, { approveAction: true })} style={{ ...actionBtn(false), background: "#3C7D50", color: "#fff", borderColor: "#3C7D50" }}>{L("اعتماد الإجراء", "Approve action")}</button>
                <button type="button" onClick={() => askClose(selected)} style={actionBtn(false)}>{L("إغلاق بصورة بعد", "Close with after photo")}</button>
                <button type="button" onClick={() => onPatch(selected.stationId, selected.item.id, { escalate: true })} style={actionBtn(true)}>{L("صعّد", "Escalate")}</button>
              </div>
            ) : <span style={{ color: "var(--nv-ink3)" }}>—</span>}
          </footer>
        </>
      ) : <p style={{ margin: 0, padding: 24, textAlign: "center", color: "var(--nv-ink3)" }}>—</p>}
    </article>
    </div>
  );
}

function actionBtn(danger) {
  return {
    height: 30,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${danger ? "#9B2335" : "var(--nv-line)"}`,
    background: danger ? "var(--nv-bad-soft)" : "var(--nv-card)",
    color: danger ? "#9B2335" : "var(--nv-ink)",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

export function SafetyComplyBoard({ ar, stations, recFor, part = "both" }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const permits = [];
  stations.forEach((station) => {
    (recFor(station.id)?.permits || []).forEach((permit) => permits.push({ ...permit, stationName: station.name }));
  });
  const live = permits.filter((permit) => permitState(permit, now) === "open");
  const soon = live.filter((permit) => {
    const until = new Date(permit.validUntil).getTime();
    return Number.isFinite(until) && until - now <= 48 * 3600000;
  });
  const loto = permits.filter((permit) => (permit.requirements || []).includes("isolation") && permitState(permit, now) === "open" && !permit.signedBy);
  const month = new Date().toISOString().slice(0, 7);
  const closedMonth = permits.filter((permit) => permitState(permit, now) !== "open" && String(permit.signedAt || permit.validUntil || "").startsWith(month));

  const inspect = [];
  stations.forEach((station) => {
    const results = recFor(station.id)?.checklistResults || {};
    READY_KEYS.forEach(([key, arLabel, enLabel]) => {
      const cell = checklistCell(results[key], ar);
      if (cell.t === "—") return;
      inspect.push({ station: station.name, label: L(arLabel, enLabel), cell, at: recFor(station.id)?.lastInspection || "—" });
    });
  });

  const showPermits = part === "both" || part === "permits";
  const showInspect = part === "both" || part === "inspect";
  return (
    <div data-hse={part === "inspect" ? "admin-inspect" : "admin-permits"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {showPermits ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Kpi label={L("سارية", "Live")} value={live.length} sub={L("تصاريح مفتوحة", "Open permits")} tone="ok" />
        <Kpi label={L("تنتهي خلال 48 س", "End within 48 h")} value={soon.length} sub={soon.length ? L("تحتاج تجديداً", "Need renewal") : "—"} tone={soon.length ? "warn" : null} />
        <Kpi label={L("معلّقة بانتظار العزل", "Waiting on isolation")} value={loto.length} sub="LOTO" tone={loto.length ? "bad" : null} />
        <Kpi label={L("أُغلقت هذا الشهر", "Closed this month")} value={closedMonth.length} sub={L("بتوقيع المشرف", "Signed by the supervisor")} />
      </div> : null}
      {showPermits ? <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink2)" }}>
        {L("لا يبدأ عمل على ارتفاع أو ساخن أو في حيّز محصور أو على نظام كهربائي قبل تصريح موقّع من المشرف ومسؤول السلامة. التصريح لوردية واحدة، ويُغلق بتوقيع عند انتهاء العمل.", "Work at height, hot work, confined space and electrical work do not start without a permit signed by the supervisor and the safety officer. A permit covers one shift and is closed with a signature.")}
      </p> : null}
      {showPermits ? <section style={shell}>
        <header style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line)" }}><strong style={{ fontSize: 13.5 }}>{L("تصاريح العمل", "Permits to work")}</strong></header>
        <div style={{ overflow: "auto" }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: "110px minmax(180px,1.4fr) 120px 160px 120px", padding: "8px 14px", background: "var(--nv-soft)", fontSize: 11, fontWeight: 700, color: "var(--nv-ink3)" }}>
              {[L("التصريح", "Permit"), L("العمل والموقع", "Work and place"), L("النوع", "Type"), L("الصلاحية", "Validity"), L("الحالة", "Status")].map((head) => <span key={head}>{head}</span>)}
            </div>
            {permits.length ? permits.map((permit) => {
              const state = permitState(permit, now);
              const label = state === "open" ? L("ساري", "Live") : state === "expired" ? L("منتهٍ", "Expired") : state === "cancelled" ? L("ملغى", "Cancelled") : L("مُغلق", "Closed");
              const tone = state === "open" ? "ok" : state === "expired" ? "warn" : "idle";
              return (
                <div key={permit.id} style={{ display: "grid", gridTemplateColumns: "110px minmax(180px,1.4fr) 120px 160px 120px", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--nv-line2)", alignItems: "center" }}>
                  <span style={{ fontFamily: MONO, direction: "ltr", fontSize: 12 }}>{dash(permit.id)}</span>
                  <div>
                    <strong style={{ display: "block", fontSize: 12.5 }}>{dash(permit.description)}</strong>
                    <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{dash(permit.stationName)}{permit.team ? ` · ${permit.team}` : ""}</span>
                  </div>
                  <span style={{ fontSize: 12 }}>{permitTypeLabel(permit.type, ar)}</span>
                  <span style={{ fontFamily: MONO, direction: "ltr", fontSize: 11.5 }}>{dash(permit.validUntil)}</span>
                  <span style={{ ...levelTone(tone === "idle" ? "" : tone), width: "fit-content", height: 22, display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{label}</span>
                </div>
              );
            }) : <p style={{ margin: 0, padding: 18, textAlign: "center", color: "var(--nv-ink3)" }}>—</p>}
          </div>
        </div>
      </section> : null}
      {showInspect ? <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink2)" }}>
        {L("بنود الجاهزية تُراجع شهرياً: حقيبة إسعاف مكتملة، مسعفون مدرّبون لكل وردية، طفايات سارية، ومخارج طوارئ مفتوحة، وتمرين إخلاء دوري.", "Readiness is reviewed monthly: a complete first-aid kit, trained first-aiders each shift, in-date extinguishers, open exits, and a periodic evacuation drill.")}
      </p> : null}
      {showInspect ? <section style={shell}>
        <header style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line)" }}><strong style={{ fontSize: 13.5 }}>{L("التفتيش والجاهزية", "Inspection and readiness")}</strong></header>
        <div style={{ overflow: "auto" }}>
          <div style={{ minWidth: 640, display: "grid", gridTemplateColumns: "minmax(180px,1.4fr) minmax(120px,.8fr) 140px 140px" }}>
            {[L("بند التفتيش", "Inspection item"), L("الفرع", "Branch"), L("آخر فحص", "Last check"), L("النتيجة", "Result")].map((head) => (
              <span key={head} style={{ padding: "8px 14px", background: "var(--nv-soft)", fontSize: 11, fontWeight: 700, color: "var(--nv-ink3)" }}>{head}</span>
            ))}
            {inspect.length ? inspect.map((row) => (
              <React.Fragment key={`${row.station}-${row.label}`}>
                <span style={{ padding: "10px 14px", borderTop: "1px solid var(--nv-line2)", fontSize: 12.5 }}>{row.label}</span>
                <span style={{ padding: "10px 14px", borderTop: "1px solid var(--nv-line2)", fontSize: 12.5 }}>{row.station}</span>
                <span style={{ padding: "10px 14px", borderTop: "1px solid var(--nv-line2)", fontFamily: MONO, direction: "ltr", fontSize: 12 }}>{dash(String(row.at).slice(0, 10))}</span>
                <span style={{ padding: "10px 14px", borderTop: "1px solid var(--nv-line2)" }}>
                  <span style={{ ...levelTone(row.cell.tone), height: 22, display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{row.cell.t}</span>
                </span>
              </React.Fragment>
            )) : <p style={{ gridColumn: "1 / -1", margin: 0, padding: 18, textAlign: "center", color: "var(--nv-ink3)" }}>—</p>}
          </div>
        </div>
      </section> : null}
    </div>
  );
}

export function SafetyInjuryTable({ ar, rows }) {
  const L = (a, e) => (ar ? a : e);
  const shown = rows.filter((row) => {
    const card = row.item.card || {};
    return card.injured || card.kind === 2 || card.kind === 3 || card.severity === 2;
  });
  return (
    <section style={shell}>
      <header style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 13.5 }}>{L("الحوادث والإصابات", "Incidents and injuries")}</strong>
        <span style={{ fontSize: 11.5, color: shown.some((row) => row.item.card?.injured && row.item.status !== "closed") ? "#9B2335" : "var(--nv-ink3)" }}>
          {L("إصابة العمل تُبلَّغ فوراً — المادة 133", "A work injury is reported at once — Art. 133")}
        </span>
      </header>
      <div style={{ overflow: "auto" }}>
        <div style={{ minWidth: 720 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px minmax(200px,1.6fr) 130px 120px 160px", padding: "8px 14px", background: "var(--nv-soft)", fontSize: 11, fontWeight: 700, color: "var(--nv-ink3)" }}>
            {[L("الرقم", "ID"), L("الحادث", "Incident"), L("التصنيف", "Class"), L("التاريخ", "Date"), L("الحالة", "Status")].map((head) => <span key={head}>{head}</span>)}
          </div>
          {shown.length ? shown.map((row) => {
            const card = row.item.card || {};
            const kind = card.injured || card.kind === 3 ? L("إصابة", "Injury") : card.kind === 2 ? L("حادث وشيك", "Near miss") : card.severity === 2 ? L("إسعاف أولي", "First aid") : dash(ar ? card.kindAr : card.kindEn);
            const status = row.item.status === "closed"
              ? L("مُغلق", "Closed")
              : row.item.actionApprovedAt
                ? L("إجراء تصحيحي مفتوح", "Corrective action open")
                : L("قيد التحقيق", "Under review");
            return (
              <div key={row.item.id || row.item.at} style={{ display: "grid", gridTemplateColumns: "120px minmax(200px,1.6fr) 130px 120px 160px", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--nv-line2)", alignItems: "center" }}>
                <span style={{ fontFamily: MONO, direction: "ltr", fontSize: 12 }}>{dash(card.code)}</span>
                <div>
                  <strong style={{ display: "block", fontSize: 12.5 }}>{dash(row.item.description || card.what)}</strong>
                  <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{dash(row.stationName)} · {card.injured ? L("إصابة", "Injured") : L("بلا إصابة", "No injury")}</span>
                </div>
                <span style={{ fontSize: 12 }}>{kind}</span>
                <span style={{ fontFamily: MONO, direction: "ltr", fontSize: 12 }}>{row.item.at ? String(row.item.at).slice(0, 10) : "—"}</span>
                <span style={{ fontSize: 12 }}>{status}</span>
              </div>
            );
          }) : <p style={{ margin: 0, padding: 18, textAlign: "center", color: "var(--nv-ink3)" }}>—</p>}
        </div>
      </div>
    </section>
  );
}

export function SafetyMinistryPanel({ ar, criticalOpen, controlLabel, controlTone, injuryOpen }) {
  const L = (a, e) => (ar ? a : e);
  const inSeason = isHeatBanDate(new Date());
  const rows = [
    ["م 121·122", L("الحماية من الأخطار", "Protection from hazards"), criticalOpen ? L("مخالفة", "Breach") : L("مستوفٍ", "Met"), criticalOpen ? "bad" : "ok"],
    ["م 125", L("وسائل الإسعافات الأولية", "First-aid means"), "—", ""],
    ["م 133", L("مهلة إبلاغ الإصابة", "Injury reporting deadline"), injuryOpen ? L("مفتوح — يُبلَّغ فوراً", "Open — report at once") : "—", injuryOpen ? "bad" : ""],
    ["ISO 45001 §8.1.2", L("ضابط لكل خطر", "A control for every hazard"), controlLabel || "—", controlTone || ""],
    ["قرار 3337", L("لا عمل مكشوف 12:00–15:00 من 15 يونيو إلى 15 سبتمبر", "No exposed work 12:00–15:00 from 15 June to 15 September"), inSeason ? L("الموسم قائم", "Season is open") : L("بلا أثر", "No effect"), inSeason ? "warn" : ""],
  ];
  return (
    <details style={{ ...shell, padding: 0, borderColor: criticalOpen ? "#9B2335" : undefined, boxShadow: criticalOpen ? "inset 0 3px 0 #9B2335" : shell.boxShadow }}>
      <summary style={{ padding: "12px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: criticalOpen ? "#9B2335" : "var(--nv-ink)" }}>{L("مرجعية الوزارة", "Ministry reference")}</summary>
      <div style={{ borderTop: "1px solid var(--nv-line)" }}>
        {rows.map((row) => (
          <div key={row[0]} style={{ display: "grid", gridTemplateColumns: "140px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--nv-line2)" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "#C8A45A" }}>{row[0]}</span>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{row[1]}</span>
            <span style={{ ...levelTone(row[3]), height: 22, display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{row[2]}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
