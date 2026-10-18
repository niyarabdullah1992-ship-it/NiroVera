import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  branchInspectionState,
  daysSinceLastLti,
  drillState,
  hseRates,
  injuryReportState,
  leadingIndicators,
  openCapas,
  permitBoard,
  riskRegisterState,
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
    const drills = drillState(rec, now);
    const risks = riskRegisterState(rec.riskItems || [], now);
    return {
      station,
      drillsCompliant: drills.compliant,
      drillsDue: drills.due,
      risksHigh: risks.high,
      risksReviewDue: risks.reviewDue,
      requestedPermits: pb.requested,
      closingPermits: pb.closing,
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
  if (pb.requested) queue.push({ key: "permits-requested", tone: "warn", tab: "permits", ar: `${pb.requested} طلب تصريح عمل بانتظار الإصدار`, en: `${pb.requested} permit requests awaiting issue` });
  if (pb.closing) queue.push({ key: "permits-closing", tone: "warn", tab: "permits", ar: `${pb.closing} تصريح أنهى منفّذه العمل — وقّع على سلامة الموقع`, en: `${pb.closing} permits finished by the holder — sign the site safe` });
  branches.filter((b) => b.risksHigh).forEach((b) => queue.push({ key: `risk-${b.station.id}`, tone: "bad", tab: "risks", ar: `${b.risksHigh} خطر متبقٍ مرتفع في سجل ${b.station.name} — ارفع مستوى الضابط`, en: `${b.risksHigh} high residual risks at ${b.station.name} — raise the control level` }));
  branches.filter((b) => b.risksReviewDue).forEach((b) => queue.push({ key: `riskrev-${b.station.id}`, tone: "warn", tab: "risks", ar: `${b.risksReviewDue} تقييم خطر تجاوز سنة بلا مراجعة — ${b.station.name}`, en: `${b.risksReviewDue} risk assessments a year without review — ${b.station.name}` }));
  branches.filter((b) => b.drillsDue).forEach((b) => queue.push({ key: `drill-${b.station.id}`, tone: "warn", tab: "inspect", ar: `${b.drillsDue} تمرين طوارئ مستحق — ${b.station.name}`, en: `${b.drillsDue} emergency drills due — ${b.station.name}` }));
  capas.filter((c) => c.overdue).forEach((c) => queue.push({ key: `capa-${c.item.id}`, tone: "bad", tab: "incidents", ar: `إجراء تصحيحي متأخر — ${c.item.investigation.capaOwner} · ${c.due}`, en: `Corrective action overdue — ${c.item.investigation.capaOwner} · ${c.due}` }));
  branches.filter((b) => b.roundDue).forEach((b) => queue.push({ key: `round-${b.station.id}`, tone: b.lastRound ? "bad" : "warn", tab: "inspect", ar: b.lastRound ? `جولة التفتيش الشهرية متأخرة — ${b.station.name}` : `لم تُجرَ جولة تفتيش بعد — ${b.station.name}`, en: b.lastRound ? `Monthly round overdue — ${b.station.name}` : `No inspection round yet — ${b.station.name}` }));
  const known = branches.filter((b) => b.readiness != null);
  const leading = leadingIndicators({ incidents, branches, now });
  return {
    headcount,
    rates,
    leading,
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
  const { rates, leading } = command;
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

      <SafetyKpiRow dataKey="leading" items={[
        { key: "nearmiss", label: L("نسبة الحوادث الوشيكة", "Near-miss ratio"), value: leading.nearMissRatio == null ? null : leading.nearMissRatio === Infinity ? `${leading.nearMiss} : 0` : `${leading.nearMissRatio} : 1`, sub: ar ? `${leading.nearMiss} وشيك لكل إصابة مسجّلة — الأعلى أفضل: ثقافة إبلاغ` : `${leading.nearMiss} near misses per recordable — higher is better`, tone: leading.nearMissRatio == null ? null : leading.nearMissRatio >= 10 ? "ok" : leading.nearMissRatio >= 3 ? "warn" : "bad" },
        { key: "rounds", label: L("التزام الجولات الشهرية", "Round compliance"), value: leading.roundCompliance == null ? null : `${leading.roundCompliance}%`, sub: L("فروع جولتها في موعدها", "Branches with a current round"), tone: leading.roundCompliance == null ? null : leading.roundCompliance >= 90 ? "ok" : leading.roundCompliance >= 60 ? "warn" : "bad" },
        { key: "drills", label: L("التزام تمارين الطوارئ", "Drill compliance"), value: leading.drillCompliance == null ? null : `${leading.drillCompliance}%`, sub: L("فروع تمارينها كلها في موعدها", "Branches with every drill in cadence"), tone: leading.drillCompliance == null ? null : leading.drillCompliance >= 90 ? "ok" : leading.drillCompliance >= 60 ? "warn" : "bad" },
        { key: "capa", label: L("إغلاق الإجراءات في موعدها", "CAPA on time"), value: leading.capaClosure == null ? null : `${leading.capaClosure}%`, sub: ar ? `من ${leading.capaDue} إجراءً حلّ موعده` : `Of ${leading.capaDue} actions that fell due`, tone: leading.capaClosure == null ? null : leading.capaClosure >= 90 ? "ok" : leading.capaClosure >= 60 ? "warn" : "bad" },
        { key: "findings", label: L("إغلاق ملاحظات التفتيش", "Finding closure"), value: leading.findingClosure == null ? null : `${leading.findingClosure}%`, sub: ar ? `من ${leading.findings} ملاحظة في 12 شهراً` : `Of ${leading.findings} findings in 12 months`, tone: leading.findingClosure == null ? null : leading.findingClosure >= 90 ? "ok" : leading.findingClosure >= 60 ? "warn" : "bad" },
      ]} />

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
