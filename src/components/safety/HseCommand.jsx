import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  branchInspectionState,
  daysSinceLastLti,
  hseRates,
  injuryReportState,
  openCapas,
  permitBoard,
} from "@/lib/safetyOps";
import { SafetyKpiRow, SafetyPanel } from "@/components/safety/SafetyOpsKit";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

/** Everything the board needs, derived once from the branch records in scope. */
export function deriveHseCommand({ stations = [], recFor, employees = [], now = Date.now() }) {
  const scopeIds = new Set(stations.map((s) => String(s.id)));
  const headcount = employees.filter((e) => scopeIds.has(String(e.stationId || e.station_id || "")) && e.status !== "terminated").length;
  const incidents = [];
  const permits = [];
  const lti = [];
  const branches = stations.map((station) => {
    const rec = recFor(station.id) || {};
    const log = (rec.incidentLog || []).map((item) => ({ ...item, stationId: station.id, stationName: station.name }));
    incidents.push(...log);
    permits.push(...(rec.permits || []).map((p) => ({ ...p, stationId: p.stationId || station.id, stationName: station.name })));
    lti.push(...(rec.ltiEntries || []));
    const insp = branchInspectionState(rec, now);
    const pb = permitBoard(rec.permits || [], now);
    return {
      station,
      readiness: insp.pct,
      roundDue: insp.due,
      lastRound: insp.last ? String(insp.last.at).slice(0, 10) : "",
      openReports: log.filter((item) => item.status !== "closed" && !item.card?.positive).length,
      critical: log.filter((item) => item.status !== "closed" && Number(item.card?.score) >= 15).length,
      livePermits: pb.live,
      unclosedPermits: pb.unclosed,
      daysClear: daysSinceLastLti(log, rec.ltiEntries || [], now),
    };
  });
  const rates = hseRates({ incidents, headcount, now });
  const pb = permitBoard(permits, now);
  const gosi = incidents.filter((item) => ["due", "overdue"].includes(injuryReportState(item, now)?.state));
  const capas = openCapas(incidents, now);
  const queue = [];
  incidents.filter((item) => item.status !== "closed" && Number(item.card?.score) >= 15).forEach((item) => queue.push({ key: `crit-${item.id}`, tone: "bad", tab: "register", ar: `بلاغ حرج مفتوح — ${item.card?.code || ""} · ${item.stationName}`, en: `Critical report open — ${item.card?.code || ""} · ${item.stationName}` }));
  gosi.forEach((item) => {
    const st = injuryReportState(item, now);
    queue.push({ key: `gosi-${item.id}`, tone: st.state === "overdue" ? "bad" : "warn", tab: "incidents", ar: st.state === "overdue" ? `إصابة تجاوزت مهلة إبلاغ التأمينات — ${item.card?.code || ""}` : `أبلغ التأمينات عن إصابة ${item.card?.code || ""} خلال ${st.left} يوم`, en: st.state === "overdue" ? `Injury past the GOSI window — ${item.card?.code || ""}` : `Report injury ${item.card?.code || ""} to GOSI within ${st.left} d` });
  });
  if (pb.unclosed) queue.push({ key: "permits-unclosed", tone: "bad", tab: "permits", ar: `${pb.unclosed} تصريح انتهى دون توقيع إغلاق`, en: `${pb.unclosed} permits expired without a closing signature` });
  capas.filter((c) => c.overdue).forEach((c) => queue.push({ key: `capa-${c.item.id}`, tone: "bad", tab: "incidents", ar: `إجراء تصحيحي متأخر — ${c.item.investigation.capaOwner} · ${c.due}`, en: `Corrective action overdue — ${c.item.investigation.capaOwner} · ${c.due}` }));
  branches.filter((b) => b.roundDue).forEach((b) => queue.push({ key: `round-${b.station.id}`, tone: b.lastRound ? "bad" : "warn", tab: "inspect", ar: b.lastRound ? `جولة التفتيش الشهرية متأخرة — ${b.station.name}` : `لم تُجرَ جولة تفتيش بعد — ${b.station.name}`, en: b.lastRound ? `Monthly round overdue — ${b.station.name}` : `No inspection round yet — ${b.station.name}` }));
  const known = branches.filter((b) => b.readiness != null);
  return {
    headcount,
    rates,
    permits: pb,
    queue,
    branches,
    readiness: known.length ? Math.round(known.reduce((s, b) => s + b.readiness, 0) / known.length) : null,
    daysClear: daysSinceLastLti(incidents, lti, now),
  };
}

function rateTone(value, aim) {
  if (value == null) return null;
  return value <= aim ? "ok" : value <= aim * 2 ? "warn" : "bad";
}

/** The decision glance: rates, the queue of what needs a decision, and the branch matrix. */
export default function HseCommand({ ar, command, onGo, part = "top" }) {
  const L = (a, e) => (ar ? a : e);
  const { rates } = command;
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const fmt = (v) => (v == null ? null : v.toFixed(2));
  return (
    <div data-hse={part === "matrix" ? "branch-matrix" : "command"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {part === "top" ? <>
      <SafetyKpiRow dataKey="rates" items={[
        { key: "trir", label: L("معدل الحوادث المسجّلة TRIR", "TRIR"), value: fmt(rates.trir), sub: ar ? `${rates.recordables} مسجّلة · لكل 200 ألف ساعة` : `${rates.recordables} recordable · per 200k hours`, tone: rateTone(rates.trir, 1) },
        { key: "ltifr", label: L("تكرار الإصابات المضيّعة LTIFR", "LTIFR"), value: fmt(rates.ltifr), sub: ar ? `${rates.counts.lti + rates.counts.fatality} إصابة · لكل مليون ساعة` : `${rates.counts.lti + rates.counts.fatality} LTI · per million hours`, tone: rateTone(rates.ltifr, 1) },
        { key: "severity", label: L("معدل الشدّة", "Severity rate"), value: fmt(rates.severity), sub: ar ? `${rates.lostDays} يوم مفقود · لكل 200 ألف ساعة` : `${rates.lostDays} lost days · per 200k hours`, tone: rateTone(rates.severity, 5) },
        { key: "clear", label: L("أيام بلا إصابة مضيّعة", "Days without LTI"), value: command.daysClear, sub: command.daysClear == null ? L("لا إصابة مضيّعة مسجّلة في النطاق", "No lost-time injury on record in scope") : L("منذ آخر إصابة مضيّعة للوقت", "Since the last lost-time injury"), tone: command.daysClear == null || command.daysClear >= 180 ? "ok" : null },
      ]} />
      <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6, marginTop: -6 }}>
        {ar
          ? `آخر 12 شهراً. الساعات تقديرية: ${command.headcount} عاملاً × ${rates.weekly} ساعة (المادة 98) × 52 أسبوعاً = ${rates.hours.toLocaleString("en-US")} ساعة.`
          : `Last 12 months. Hours estimated: ${command.headcount} workers × ${rates.weekly} h (Art. 98) × 52 weeks = ${rates.hours.toLocaleString("en-US")} h.`}
      </span>

      <SafetyPanel
        dataKey="queue"
        title={L("ما يحتاج قرارك", "Needs your decision")}
        note={command.queue.length ? (ar ? `${command.queue.length} بنداً — الأحرج أولاً` : `${command.queue.length} items — most severe first`) : L("لا شيء معلّق الآن.", "Nothing pending now.")}
        pad={false}
      >
        {command.queue.length ? [...command.queue].sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1)).slice(0, 8).map((row) => (
          <div key={row.key} data-queue={row.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--nv-line2)" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, flex: "none", background: row.tone === "bad" ? "var(--nv-bad-ink, #9B2335)" : "#C8A45A" }} />
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.6 }}>{ar ? row.ar : row.en}</span>
            <button type="button" data-queue-go={row.tab} onClick={() => onGo?.(row.tab)} style={{ fontFamily: "inherit", height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {L("افتح", "Open")}<Arrow size={13} aria-hidden />
            </button>
          </div>
        )) : null}
      </SafetyPanel>
      </> : null}

      {part === "matrix" ? <SafetyPanel dataKey="branch-matrix" title={L("الفروع في نظرة", "Branches at a glance")} note={L("الجاهزية من آخر جولة تفتيش · البلاغات المفتوحة · التصاريح · أيام بلا إصابة", "Readiness from the last round · open reports · permits · days without LTI")} pad={false}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 660 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.4fr) repeat(5, minmax(90px,1fr))", padding: "8px 16px", background: "var(--nv-soft)", fontSize: 11, fontWeight: 700, color: "var(--nv-ink3)" }}>
              {[L("الفرع", "Branch"), L("الجاهزية", "Readiness"), L("بلاغات مفتوحة", "Open reports"), L("حرجة", "Critical"), L("تصاريح سارية", "Live permits"), L("أيام بلا إصابة", "Days w/o LTI")].map((h) => <span key={h}>{h}</span>)}
            </div>
            {command.branches.map((b) => (
              <div key={b.station.id} data-branch-matrix={b.station.id} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.4fr) repeat(5, minmax(90px,1fr))", padding: "10px 16px", borderTop: "1px solid var(--nv-line2)", alignItems: "center", fontSize: 12.5 }}>
                <strong>{b.station.name}</strong>
                <span dir="ltr" style={{ fontFamily: MONO, fontWeight: 700, textAlign: "start", color: b.readiness == null ? "var(--nv-muted)" : b.readiness >= 90 ? "var(--nv-ok-ink)" : b.readiness >= 75 ? "var(--nv-warn-ink)" : "var(--nv-bad-ink)" }}>{b.readiness == null ? "—" : `${b.readiness}%`}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "start" }}>{b.openReports}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "start", color: b.critical ? "var(--nv-bad-ink)" : undefined, fontWeight: b.critical ? 700 : 400 }}>{b.critical}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "start" }}>{b.livePermits}{b.unclosedPermits ? <span style={{ color: "var(--nv-bad-ink)" }}>{` +${b.unclosedPermits}`}</span> : null}</span>
                <span dir="ltr" style={{ fontFamily: MONO, textAlign: "start" }}>{b.daysClear == null ? "—" : b.daysClear}</span>
              </div>
            ))}
          </div>
        </div>
      </SafetyPanel> : null}
    </div>
  );
}
