import React, { useEffect, useMemo, useState } from "react";
import { checkWorkplaceLawGate, workplaceLawRows } from "@/lib/workplaceLaw";
import { field, ui } from "@/lib/platformStyles";

const shell = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" };
const head = { padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const TONE = {
  ok: { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" },
  bad: { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" },
  na: { color: "var(--nv-ink3)", background: "var(--nv-soft)" },
  none: { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" },
};
const pill = (t) => ({ ...(TONE[t] || TONE.none), height: 22, display: "inline-flex", alignItems: "center", padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" });

/**
 * «نظام العمل — بيئة العمل» on the inspection tab: Arts. 125 (fire), 63 (forbidden substances), 144 (health
 * care) and 158 (seats for women), per branch. Each row names its article; a check is recorded with who and
 * when; Art. 158 and Art. 144's cover count are read from the files.
 */
export default function WorkplaceLawCard({ ar, stations = [], recFor, data, canEdit, today, onSave, readOnly = false, self = null }) {
  const L = (a, e) => (ar ? a : e);
  const [stationId, setStationId] = useState(stations[0]?.id || "");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!stations.some((s) => s.id === stationId)) setStationId(stations[0]?.id || ""); }, [stations, stationId]);
  useEffect(() => { setDraft(null); setError(""); }, [stationId]);
  const station = stations.find((s) => s.id === stationId) || null;
  const rec = (station && recFor(station.id)) || {};
  const employees = useMemo(() => (data?.employees || []).filter((p) => p?.id && String(p.stationId) === String(stationId)), [data, stationId]);
  const rows = workplaceLawRows({ rec, employees, today }).map((row) => {
    // For his knowledge (employee side): his own cover, never a count of colleagues' files.
    if (!readOnly || row.id !== "law_144_health" || !self) return row;
    const end = String(self?.profile?.medicalInsuranceExpiry || "").slice(0, 10);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(end) && (!today || end >= today);
    return {
      ...row,
      blocked: false,
      state: valid ? (row.saved?.met === false ? "bad" : row.saved?.met === true ? "ok" : "none") : "bad",
      derivedAr: valid ? `تأمينك الطبي ساري حتى ${end}` : (end ? `انتهى تأمينك الطبي في ${end} — راجع الموارد البشرية` : "لا تاريخ لتأمينك الطبي في ملفك — راجع الموارد البشرية"),
      derivedEn: valid ? `Your medical cover runs to ${end}` : (end ? `Your medical cover ended on ${end} — ask HR` : "No medical cover date on your file — ask HR"),
    };
  });
  if (!station) return null;
  const open = rows.filter((r) => r.state === "bad" || r.state === "none").length;

  const save = () => {
    const gate = checkWorkplaceLawGate(draft);
    if (!gate.ok) { setError(ar ? gate.reason : gate.reasonEn); return; }
    onSave?.(station.id, { ...(rec.workplaceLaw || {}), [draft.id]: { met: draft.met, note: String(draft.note || "").trim() } }, draft.id);
    setDraft(null);
    setError("");
  };

  return (
    <section data-workplace-law={station.id} data-read-only={readOnly ? "1" : undefined} style={shell}>
      <div style={head}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 200 }}>
          <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{readOnly ? L("للعلم — حقك في بيئة العمل", "For your information — your workplace rights") : L("نظام العمل — بيئة العمل", "Labour Law — the workplace")}</strong>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{readOnly
            ? L(`ما يلزم صاحب العمل في فرعك ${station.name}، وحالته كما سجّلتها الإدارة. إن رأيت خلاف ذلك فارفع بلاغ سلامة.`, `What the employer owes at your branch ${station.name}, as management recorded it. If you see otherwise, raise a safety report.`)
            : L("الحريق والمواد المحرمة ومقاعد العاملات — كل بند بمادته.", "Fire, forbidden substances and seats for women — each under its article.")}</span>
        </span>
        <span style={pill(open ? "none" : "ok")}>{open ? L(open === 1 ? "بند واحد مفتوح" : open === 2 ? "بندان مفتوحان" : `${open} بنود مفتوحة`, `${open} open`) : L("مستوفى", "Met")}</span>
        {stations.length > 1 && !readOnly ? (
          <select value={stationId} onChange={(e) => setStationId(e.target.value)} style={{ ...field, height: 32, width: "auto", minWidth: 160 }} aria-label={L("الفرع", "Branch")}>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : null}
      </div>
      {rows.map((row) => {
        const editing = draft?.id === row.id;
        const statusLabel = row.state === "ok" ? L("مستوفى", "Met") : row.state === "bad" ? L("غير مستوفى", "Not met") : row.state === "na" ? L("لا ينطبق", "N/A") : L("لم يُفحص", "Not checked");
        return (
          <div key={row.id} data-workplace-law-row={row.id} data-state={row.state} style={{ padding: "11px 14px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 13, color: "var(--nv-ink)", lineHeight: 1.7 }}>{ar ? row.ar : row.en}</span>
                {row.derivedAr ? <span style={{ fontSize: 11.5, color: row.blocked ? "var(--nv-bad-ink)" : "var(--nv-muted)" }}>{ar ? row.derivedAr : row.derivedEn}</span> : null}
                {row.saved?.at && !readOnly ? (
                  <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
                    {L(`سجّله ${row.saved.by || "—"} في ${String(row.saved.at).slice(0, 10)}`, `Recorded by ${row.saved.by || "—"} on ${String(row.saved.at).slice(0, 10)}`)}
                    {row.saved.note ? ` — ${row.saved.note}` : ""}
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ok-ink)", whiteSpace: "nowrap" }} title={ar ? row.cite?.textAr : row.cite?.textEn}>{ar ? row.cite?.labelAr : row.cite?.labelEn}</span>
              <span style={pill(row.state)}>{statusLabel}</span>
              {!readOnly && canEdit && row.applies && row.id !== "law_144_health" && !editing ? (
                <button type="button" data-workplace-law-edit={row.id} onClick={() => { setDraft({ id: row.id, met: row.saved?.met ?? null, note: row.saved?.note || "" }); setError(""); }} style={{ ...ui.btnSecondary, height: 28, fontSize: 11.5 }}>{L("سجّل الفحص", "Record check")}</button>
              ) : null}
            </div>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-soft, #F7F9F8)" }}>
                <div role="radiogroup" style={{ display: "flex", gap: 14 }}>
                  {[[true, L("مستوفى", "Met")], [false, L("غير مستوفى", "Not met")]].map(([v, t]) => (
                    <label key={String(v)} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                      <input type="radio" name={`wl-${row.id}`} checked={draft.met === v} onChange={() => setDraft({ ...draft, met: v })} /> {t}
                    </label>
                  ))}
                </div>
                <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={draft.met === false ? L("ما الناقص؟", "What is missing?") : L("ملاحظة (اختياري)", "Note (optional)")} style={{ ...field, height: 34 }} />
                {error ? <span role="alert" style={{ fontSize: 11.5, color: "var(--nv-bad-ink)" }}>{error}</span> : null}
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" data-workplace-law-save={row.id} onClick={save} style={{ ...ui.btnPrimary, height: 30, fontSize: 12 }}>{L("احفظ", "Save")}</button>
                  <button type="button" onClick={() => setDraft(null)} style={{ ...ui.btnSecondary, height: 30, fontSize: 12 }}>{L("إلغاء", "Cancel")}</button>
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
