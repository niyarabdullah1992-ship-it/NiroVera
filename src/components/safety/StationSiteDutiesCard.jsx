import React, { useEffect, useState } from "react";
import { FIRST_AID_CONDITIONS, FIRST_AID_ITEMS, checkFirstAidRecordGate, deriveFirstAidCabinet } from "@/lib/firstAidCabinet";
import { ROAD_TYPES, checkSiteRecordGate, deriveRemoteness } from "@/lib/siteRemoteness";
import { field, MUTED, ui } from "@/lib/platformStyles";

const MONO = "'IBM Plex Mono', monospace";
const shell = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" };
const head = { padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const row = { padding: "10px 14px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 8 };
const tone = (t) => ({
  ok: { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" },
  warn: { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" },
  bad: { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" },
}[t] || { color: "var(--nv-ink3)", background: "var(--nv-soft)" });
const pill = (t) => ({ ...tone(t), height: 22, display: "inline-flex", alignItems: "center", padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700 });

/**
 * One station's site duties on the inspection tab: where it sits (Regs Art. 30 → «بعيد عن العمران») and
 * its first-aid cabinet (Art. 142 · Regs Art. 29). Both are kept on the station's safety record with who
 * and when; the flags are derived from what is recorded.
 */
export default function StationSiteDutiesCard({ ar, stations = [], recFor, canEdit, today, onSaveSite, onSaveCabinet }) {
  const L = (a, e) => (ar ? a : e);
  const [stationId, setStationId] = useState(stations[0]?.id || "");
  useEffect(() => {
    if (!stations.some((s) => s.id === stationId)) setStationId(stations[0]?.id || "");
  }, [stations, stationId]);
  const station = stations.find((s) => s.id === stationId) || null;
  const rec = (station && recFor(station.id)) || {};
  const site = rec.site || {};
  const cabinet = rec.firstAidCabinet || null;
  const remote = deriveRemoteness(site, station?.remoteSite);
  const aid = deriveFirstAidCabinet(cabinet, { today });

  const [siteDraft, setSiteDraft] = useState(null);
  const [aidDraft, setAidDraft] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { setSiteDraft(null); setAidDraft(null); setError(""); }, [stationId]);

  const aidTone = aid.state === "met" ? "ok" : aid.state === "stale" ? "warn" : aid.state === "none" ? "" : "bad";
  const aidLabel = aid.state === "met"
    ? L(`مكتملة · فُحصت ${aid.checkedAt}`, `Complete · checked ${aid.checkedAt}`)
    : aid.state === "stale"
      ? L(`مضى ${aid.age} يوماً على آخر فحص`, `${aid.age} days since the last check`)
      : aid.state === "none"
        ? L("لم تُفحص", "Never checked")
        : L(`${aid.short.length} صنف ناقص · ${aid.missing.length} شرط`, `${aid.short.length} short · ${aid.missing.length} condition(s)`);

  const startSite = () => setSiteDraft({ distanceKm: site.distanceKm ?? "", roadType: site.roadType || "paved", noServices: !!site.noServices });
  const saveSite = () => {
    const gate = checkSiteRecordGate(siteDraft);
    if (!gate.ok) { setError(ar ? gate.reason : gate.reasonEn); return; }
    onSaveSite?.(station.id, gate.site);
    setSiteDraft(null);
    setError("");
  };
  const startAid = () => setAidDraft({
    counts: Object.fromEntries(FIRST_AID_ITEMS.map((item) => [item.key, cabinet?.counts?.[item.key] ?? ""])),
    conditions: { ...(cabinet?.conditions || {}) },
    location: cabinet?.location || "",
    keeper: cabinet?.keeper || "",
    extra: cabinet?.extra || "",
  });
  const saveAid = () => {
    const gate = checkFirstAidRecordGate(aidDraft);
    if (!gate.ok) { setError(ar ? gate.reason : gate.reasonEn); return; }
    onSaveCabinet?.(station.id, {
      counts: Object.fromEntries(FIRST_AID_ITEMS.map((item) => [item.key, Number(aidDraft.counts[item.key])])),
      conditions: Object.fromEntries(FIRST_AID_CONDITIONS.map((c) => [c.key, aidDraft.conditions[c.key] === true])),
      location: aidDraft.location.trim(),
      keeper: aidDraft.keeper.trim(),
      extra: String(aidDraft.extra || "").trim(),
    });
    setAidDraft(null);
    setError("");
  };

  if (!station) return null;
  return (
    <section data-station-site-duties={station.id} style={shell}>
      <header style={head}>
        <strong style={{ fontSize: 13.5, flex: "1 1 200px" }}>{L("موقع الفرع وخزانة الإسعافات", "Site and first-aid cabinet")}</strong>
        {stations.length > 1 ? (
          <select value={stationId} onChange={(e) => setStationId(e.target.value)} style={{ ...field, width: "auto", maxWidth: "100%", height: 32 }}>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <span style={{ fontSize: 12, color: MUTED }}>{station.name}</span>}
      </header>

      <div data-site-remote={remote.remote ? "1" : "0"} style={row}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: "#C8A45A" }}>{L("اللائحة م30", "Regs 30")}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 180px" }}>{L("بُعد الموقع عن العمران", "Distance from towns")}</span>
          <span style={pill(!remote.known ? "" : remote.remote ? "warn" : "ok")}>
            {!remote.known ? L("غير مسجّل", "Not recorded") : remote.remote ? L("بعيد عن العمران", "Remote from towns") : L("داخل الحد", "Within the limit")}
          </span>
        </div>
        <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
          {ar ? remote.reasonAr : remote.reasonEn}
          {site.recordedBy ? L(` · سجّله ${site.recordedBy} ${String(site.recordedAt || "").slice(0, 10)}`, ` · by ${site.recordedBy} ${String(site.recordedAt || "").slice(0, 10)}`) : ""}
        </span>
        {remote.remote ? (
          <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
            {L("يترتب عليه: المادة 146 (حوانيت، ترفيه، رعاية طبية وعلاج الأسرة، مدارس، مساجد، محو أمية — كلها أو بعضها بقرار الوزير) والمادة 147 (مساكن أو مخيمات ووجبات) — تُقرأ في «الظروف والبدلات» بملف كل موظف في الفرع.",
              "Brings in Art. 146 (shops, recreation, medical care, schools, mosques, literacy — all or some by Minister decision) and Art. 147 (housing or camps, meals) — read under each worker's site conditions.")}
          </span>
        ) : null}
        {canEdit && !siteDraft ? <button type="button" onClick={startSite} style={{ ...ui.btnRow, alignSelf: "flex-start" }}>{L("سجّل المسافة ونوع الطريق", "Record distance and road")}</button> : null}
        {siteDraft ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 8, alignItems: "end" }}>
            <label style={{ fontSize: 11, color: MUTED }}>
              {L("المسافة عن النطاق العمراني (كم)", "Distance from the urban boundary (km)")}
              <input type="number" min="0" dir="ltr" value={siteDraft.distanceKm} onChange={(e) => setSiteDraft((d) => ({ ...d, distanceKm: e.target.value }))} style={{ ...field, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: MUTED }}>
              {L("الطريق", "Road")}
              <select value={siteDraft.roadType} onChange={(e) => setSiteDraft((d) => ({ ...d, roadType: e.target.value }))} style={{ ...field, marginTop: 4 }}>
                {ROAD_TYPES.map((r) => <option key={r.key} value={r.key}>{ar ? `${r.ar} — الحد ${r.limit} كم` : `${r.en} — limit ${r.limit} km`}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={siteDraft.noServices} onChange={(e) => setSiteDraft((d) => ({ ...d, noServices: e.target.checked }))} />
              {L("تجمع سكاني بلا مرافق وخدمات (م30/2)", "A cluster without utilities and services (30(2))")}
            </label>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={saveSite} style={ui.btnPrimary}>{L("حفظ", "Save")}</button>
              <button type="button" onClick={() => { setSiteDraft(null); setError(""); }} style={ui.btnRow}>{L("إلغاء", "Cancel")}</button>
            </span>
          </div>
        ) : null}
      </div>

      <div data-first-aid={aid.state} style={{ ...row, borderBottom: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: "#C8A45A" }}>{L("م 142 · اللائحة م29", "Art. 142 · Regs 29")}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, flex: "1 1 180px" }}>{L("خزانة الإسعافات الأولية — الأصناف والكميات والإعلان عن مكانها", "First-aid cabinet — items, quantities and its posted place")}</span>
          <span style={pill(aidTone)}>{aidLabel}</span>
        </div>
        {aid.state !== "none" ? (
          <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
            {L(`مكانها: ${aid.location || "—"} · المسؤول: ${aid.keeper || "—"} · فحصها ${aid.checkedBy || "—"} ${aid.checkedAt}`, `Place: ${aid.location || "—"} · keeper: ${aid.keeper || "—"} · checked by ${aid.checkedBy || "—"} ${aid.checkedAt}`)}
            {aid.short.length && aid.state === "short" ? L(` · يُكمَل: ${aid.short.map((i) => i.ar).join("، ")}`, ` · make up: ${aid.short.map((i) => i.en).join(", ")}`) : ""}
            {aid.missing.length ? L(` · شرط ناقص: ${aid.missing.map((c) => c.ar).join("، ")}`, ` · missing: ${aid.missing.map((c) => c.en).join(", ")}`) : ""}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>{L("عُدّ محتوى الخزانة صنفاً صنفاً مقابل الحد الأدنى في اللائحة، واكتب مكانها واسم المسؤول عنها.", "Count the cabinet item by item against the Regulation's minimum, and write its place and keeper.")}</span>
        )}
        {canEdit && !aidDraft ? <button type="button" onClick={startAid} style={{ ...ui.btnRow, alignSelf: "flex-start" }}>{aid.state === "none" ? L("افحص الخزانة", "Check the cabinet") : L("فحص جديد", "New check")}</button> : null}
        {aidDraft ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--nv-line2)", borderRadius: 10, overflow: "hidden" }}>
            {FIRST_AID_ITEMS.map((item) => {
              const n = aidDraft.counts[item.key];
              const low = n !== "" && Number(n) < item.min;
              return (
                <label key={item.key} data-aid-item={item.key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto 84px", gap: 8, alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--nv-line2)", background: low ? "var(--nv-bad-soft)" : "transparent" }}>
                  <span style={{ fontSize: 12, minWidth: 0 }}>{ar ? item.ar : item.en}</span>
                  <span dir="ltr" style={{ fontFamily: MONO, fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>≥ {item.min}</span>
                  <input type="number" min="0" dir="ltr" value={n} onChange={(e) => setAidDraft((d) => ({ ...d, counts: { ...d.counts, [item.key]: e.target.value } }))} style={{ ...field, height: 30, padding: "4px 8px" }} />
                </label>
              );
            })}
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
              {FIRST_AID_CONDITIONS.map((c) => (
                <label key={c.key} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={aidDraft.conditions[c.key] === true} onChange={(e) => setAidDraft((d) => ({ ...d, conditions: { ...d.conditions, [c.key]: e.target.checked } }))} />
                  {ar ? c.ar : c.en} <span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>({c.para})</span>
                </label>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 8 }}>
                <input value={aidDraft.location} onChange={(e) => setAidDraft((d) => ({ ...d, location: e.target.value }))} placeholder={L("مكان الخزانة", "Cabinet place")} style={field} />
                <input value={aidDraft.keeper} onChange={(e) => setAidDraft((d) => ({ ...d, keeper: e.target.value }))} placeholder={L("اسم المسؤول عنها", "Its keeper")} style={field} />
              </div>
              <input value={aidDraft.extra} onChange={(e) => setAidDraft((d) => ({ ...d, extra: e.target.value }))} placeholder={L("مستلزمات إضافية تقتضيها طبيعة العمل (م29/5)", "Extra supplies the work calls for (29(5))")} style={field} />
              <span style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={saveAid} style={ui.btnPrimary}>{L("حفظ الفحص", "Save the check")}</button>
                <button type="button" onClick={() => { setAidDraft(null); setError(""); }} style={ui.btnRow}>{L("إلغاء", "Cancel")}</button>
              </span>
            </div>
          </div>
        ) : null}
        {error ? <span role="alert" style={{ fontSize: 12, color: "var(--nv-bad-ink)" }}>{error}</span> : null}
      </div>
    </section>
  );
}
