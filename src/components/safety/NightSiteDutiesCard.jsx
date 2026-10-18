import React, { useEffect, useMemo, useRef, useState } from "react";
import { NIGHT_FACILITY_FLAGS, nightFacilityBags } from "@/lib/decision18632";
import { nightObligationRows } from "@/lib/nightObligations";
import NightObligationProof from "@/components/schedules/NightObligationProof";
import { field, MUTED, ui } from "@/lib/platformStyles";
import { isNightShift } from "@/lib/shiftWeek";

const MONO = "'IBM Plex Mono', monospace";
const shell = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", scrollMarginTop: 88 };
const head = { padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const row = { padding: "10px 14px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 8 };
const tone = (t) => ({
  ok: { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" },
  bad: { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" },
}[t] || { color: "var(--nv-ink3)", background: "var(--nv-soft)" });
const pill = (t) => ({ ...tone(t), height: 22, display: "inline-flex", alignItems: "center", padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" });

const FACILITY_KEYS = new Set(NIGHT_FACILITY_FLAGS.map((flag) => flag.key));

/** Does this branch's roster put anyone on a night shift from today on? Read from the roster, never set by hand. */
function stationHasNightWork(schedule, today) {
  const types = Array.isArray(schedule?.shiftTypes) ? schedule.shiftTypes : [];
  const nightIds = new Set(types.filter((type) => type && isNightShift(type)).map((type) => String(type.id)));
  if (!nightIds.size) return false;
  return Object.entries(schedule?.assignments || {}).some(([key, day]) => (
    /^\d{4}-\d{2}-\d{2}$/.test(key) && (!today || key >= today) && day && typeof day === "object"
    && Object.entries(day).some(([shiftId, ids]) => nightIds.has(String(shiftId)) && Array.isArray(ids) && ids.length > 0)
  ));
}

/**
 * Decision 18632 (III) — the branch's night-site duties: a first-aider, an emergency transfer and food
 * access. They belong to السلامة: proven here, read by the roster's publish gate (same flags and proofs
 * on the station roster), and the roster only links back here.
 */
export default function NightSiteDutiesCard({ ar, stations = [], data, companyId, canEdit, actor, today, focus = false, onSaved }) {
  const L = (a, e) => (ar ? a : e);
  const [stationId, setStationId] = useState(stations[0]?.id || "");
  const [proving, setProving] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!stations.some((s) => s.id === stationId)) setStationId(stations[0]?.id || "");
  }, [stations, stationId]);
  useEffect(() => { setProving(""); }, [stationId]);
  useEffect(() => {
    if (focus && ref.current) ref.current.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focus]);

  const station = stations.find((s) => s.id === stationId) || null;
  const schedule = (data?.schedules || []).find((s) => String(s.stationId) === String(stationId)) || null;
  const employees = useMemo(
    () => (data?.employees || []).filter((person) => person?.id && String(person.stationId) === String(stationId)),
    [data, stationId],
  );
  const nightWork = stationHasNightWork(schedule, today);
  const rows = useMemo(() => nightObligationRows({
    bags: nightFacilityBags({ schedule, station, company: data }),
    employees,
    today,
    nightWork: true,
    ar,
  }).filter((item) => FACILITY_KEYS.has(item.key)), [schedule, station, data, employees, today, ar]);

  if (!station) return null;
  const missing = rows.filter((item) => !item.met).length;
  return (
    <section ref={ref} id="nv-night-site-duties" data-night-site-duties={station.id} style={shell}>
      <header style={head}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 220px", minWidth: 0 }}>
          <strong style={{ fontSize: 13.5 }}>{L("التزامات الموقع للعمل الليلي", "Night-work site duties")}</strong>
          <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
            {nightWork
              ? L("في جدول هذا الفرع عمل ليلي — الناقص منها يمنع نشر الجدول حتى يُثبت هنا.", "This branch's roster has night work — anything missing blocks publishing until proven here.")
              : L("لا عمل ليلي في جدول هذا الفرع الآن — تُثبت مسبقاً حتى لا يتوقف النشر حين يُسند الليل.", "No night work on this branch's roster now — prove them ahead so publishing never stops when nights are assigned.")}
          </span>
        </span>
        {stations.length > 1 ? (
          <select value={stationId} onChange={(e) => setStationId(e.target.value)} style={{ ...field, width: "auto", maxWidth: "100%", height: 32 }}>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <span style={{ fontSize: 12, color: MUTED }}>{station.name}</span>}
      </header>

      {rows.map((item) => {
        const legacyFlag = item.reason === "flag";
        const open = proving === item.key;
        return (
          <div key={item.key} data-night-duty={item.key} data-met={item.met ? "1" : "0"} style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#C8A45A" }}>{L("القرار", "Dec.")} <span dir="ltr" style={{ fontFamily: MONO }}>18632</span></span>
              <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 180px" }}>{item.title}</span>
              <span style={pill(item.met ? "ok" : nightWork ? "bad" : "")}>
                {item.met ? L("مستوفى", "Met") : nightWork ? L("ناقص — يمنع النشر", "Missing — blocks publish") : L("غير مثبت", "Not proven")}
              </span>
            </div>
            {item.summary && !item.met ? <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>{item.reason === "cert_expired" ? item.summary : L("لم يُثبت بعد لهذا الفرع.", "Not proven for this branch yet.")}</span> : null}
            {item.sub ? <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>{item.sub}</span> : null}
            {canEdit && !open && (!item.met || legacyFlag) ? (
              <button type="button" data-night-prove={item.key} onClick={() => setProving(item.key)} style={{ ...ui.btnRow, alignSelf: "flex-start" }}>
                {legacyFlag ? L("أضف الإثبات", "Add proof") : L("أثبت", "Prove")}
              </button>
            ) : null}
            {open ? (
              <NightObligationProof
                obligationKey={item.key}
                ar={ar}
                companyId={companyId}
                stationId={station.id}
                employees={employees}
                actor={actor}
                onCancel={() => setProving("")}
                onSaved={() => { setProving(""); onSaved?.(); }}
              />
            ) : null}
          </div>
        );
      })}
      <div style={{ padding: "9px 14px", fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
        {missing
          ? L(`ناقص ${missing} من 3. جدول الدوام يقرأ هذا السجل نفسه عند النشر.`, `${missing} of 3 missing. The duty roster reads this same record when publishing.`)
          : L("الثلاثة مثبتة — جدول الدوام يقرأ هذا السجل نفسه عند النشر.", "All three proven — the duty roster reads this same record when publishing.")}
      </div>
    </section>
  );
}
