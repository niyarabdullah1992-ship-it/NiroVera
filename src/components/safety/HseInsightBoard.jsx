import React, { useMemo } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations } from "@/lib/permissions";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";

import {
  pyramidBar,
  pyramidLabel,
  pyramidRow,
  MUTED,
  NAVY,
  ACCENT,
  OK,
  WARN,
  NEUTRAL,
} from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";

const PYRAMID_LEVELS = [
  { key: "fatality", ar: "وفاة", en: "Fatality", color: "#991B1B" },
  { key: "lti", ar: "حادث يفقد وقت عمل", en: "Lost-time injury", color: "#DC2626" },
  { key: "restrict", ar: "تقييد عمل / علاج", en: "Restricted / medical", color: "#EA580C" },
  { key: "firstAid", ar: "إسعافات أولية", en: "First aid", color: "#F59E0B" },
  { key: "nearMiss", ar: "قرب حادث", en: "Near miss", color: "#CA8A04" },
  { key: "hazard", ar: "خطر مفتوح", en: "Open hazard", color: MUTED },
  { key: "observation", ar: "ملاحظة سلامة", en: "Safety observation", color: "#94A3B8" },
];

function riskTone(score) {
  if (score >= 15) return { bg: "#FEF2F2", fg: "#991B1B", bd: "#FECACA" };
  if (score >= 8) return { bg: "#FFF7ED", fg: "#C2410C", bd: "#FED7AA" };
  if (score >= 4) return { bg: "#FFFBEB", fg: "#B45309", bd: "#FDE68A" };
  return { bg: "#ECFDF3", fg: "#15803D", bd: "#BBF7D0" };
}

/**
 * Platform HSE visuals: Bird/Heinrich pyramid, 5×5 matrix, PTW / CAPA / drills shells.
 * Counts derived from existing safety records — no invented backend entities.
 */
export default function HseInsightBoard({ lang = "ar", stationScope }) {
  const ar = lang === "ar";
  const { data, currentUser } = useAuth();
  const headerScope = useStationScope();
  const scope = stationScope || headerScope || "all";
  const stations = (currentUser && data ? visibleStations(currentUser, data) : []).filter((s) =>
    matchesStationScope(s.id, scope, data?.stations),
  );
  const safety = (data?.safety || []).filter((rec) => matchesStationScope(rec.stationId, scope, data?.stations));

  const counts = useMemo(() => {
    let fatality = 0;
    let lti = 0;
    let restrict = 0;
    let firstAid = 0;
    let nearMiss = 0;
    let hazard = 0;
    let observation = 0;
    const matrix = Array.from({ length: 5 }, () => Array(5).fill(0));
    const openHazards = [];
    const permits = [];
    const capa = [];

    for (const rec of safety) {
      const station = stations.find((s) => String(s.id) === String(rec.stationId)) || { name: "—" };
      for (const h of rec.hazards || []) {
        if (h.closedAt) continue;
        hazard += 1;
        const severity = Math.min(5, Math.max(1, Number(h.severity || h.s || 3)));
        const likelihood = Math.min(5, Math.max(1, Number(h.likelihood || h.l || 3)));
        matrix[5 - severity][likelihood - 1] += 1;
        openHazards.push({
          id: `${rec.stationId}-${h.id || h.title}`,
          title: h.title || h.description || (ar ? "خطر" : "Hazard"),
          meta: `${station.name} · ${h.owner || h.ownerName || "—"}`,
          level: h.level || (severity * likelihood >= 15 ? (ar ? "حرج" : "Critical") : severity * likelihood >= 8 ? (ar ? "عالٍ" : "High") : ar ? "متوسط" : "Medium"),
          due: h.dueDate || h.due || "—",
          score: severity * likelihood,
        });
      }
      for (const i of rec.incidentLog || []) {
        const kind = (i.kind || i.type || i.severity || "").toString().toLowerCase();
        if (/fatal|وفاة/.test(kind)) fatality += 1;
        else if (/lti|lost|يفقد/.test(kind)) lti += 1;
        else if (/restrict|medical|علاج|تقييد/.test(kind)) restrict += 1;
        else if (/first|إسعاف/.test(kind)) firstAid += 1;
        else if (/near|قرب/.test(kind)) nearMiss += 1;
        else observation += 1;
      }
      for (const p of rec.permits || rec.ptw || []) {
        permits.push({
          ...p,
          station: station.name,
        });
      }
      for (const c of rec.capa || []) {
        capa.push({ ...c, station: station.name });
      }
    }

    // If incident kinds are sparse, seed pyramid from open hazards / near-miss fields.
    if (fatality + lti + restrict + firstAid + nearMiss + observation === 0) {
      nearMiss = Math.max(0, Number(safety.reduce((n, r) => n + (r.nearMissCount || 0), 0)));
      observation = Math.max(observation, openHazards.length);
    }

    return {
      pyramid: { fatality, lti, restrict, firstAid, nearMiss, hazard, observation },
      matrix,
      openHazards: openHazards.slice(0, 12),
      permits: permits.slice(0, 8),
      capa: capa.slice(0, 8),
    };
  }, [safety, stations, ar]);

  const maxPyramid = Math.max(1, ...PYRAMID_LEVELS.map((l) => counts.pyramid[l.key] || 0));

  const competency = (data?.employees || [])
    .filter((e) => matchesStationScope(e.stationId, scope, data?.stations))
    .filter((e) => e.role === "safety_officer" || /سلامة|safety/i.test(e.position || ""))
    .slice(0, 6)
    .map((e) => ({
      name: e.name,
      who: e.position || (ar ? "سلامة" : "Safety"),
      note: e.profile?.medicalExam === "expired"
        ? (ar ? "شهادة منتهية — يحتاج تجديد" : "Credential expired — renewal required")
        : (ar ? "شهادة سارية" : "Credential current"),
      ok: e.profile?.medicalExam !== "expired",
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ maxWidth: "1320px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
        <ChromeBox style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "هرم الحوادث (بيرد / هاينريش)" : "Incident pyramid (Bird / Heinrich)"}
          </div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.7 }}>
            {ar
              ? "من سجلات السلامة في النطاق — القاعدة أعرض لأنها أكثر تكرارًا."
              : "From safety logs in scope — the base is wider because it is more frequent."}
          </div>
          <div style={{ marginTop: "12px" }}>
            {PYRAMID_LEVELS.map((level) => {
              const n = counts.pyramid[level.key] || 0;
              const pct = n === 0 ? 0 : Math.max(2, Math.round(Math.sqrt(n / maxPyramid) * 100));
              return (
                <div key={level.key} style={pyramidRow}>
                  <span style={pyramidLabel}>{ar ? level.ar : level.en}</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                      <span style={pyramidBar(pct, level.color, n === 0)} />
                    </span>
                    <span dir="ltr" style={{ fontSize: "12px", fontWeight: 600, color: NAVY, fontFamily: "'IBM Plex Sans',sans-serif" }}>{n}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </ChromeBox>

        <ChromeBox style={{ flex: "1 1 380px", minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "مصفوفة المخاطر 5×5" : "5×5 risk matrix"}
          </div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.7 }}>
            {ar ? "الشدة × الاحتمال للمخاطر المفتوحة" : "Severity × likelihood for open hazards"}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <div style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: "9px",
              letterSpacing: "0.08em",
              color: MUTED,
              fontWeight: 600,
              textAlign: "center",
            }}>
              {ar ? "الشدة" : "SEVERITY"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {[5, 4, 3, 2, 1].map((sev, ri) => (
                <div key={sev} style={{ display: "grid", gridTemplateColumns: "18px repeat(5,1fr)", gap: "5px", marginBottom: "5px", alignItems: "center" }}>
                  <div dir="ltr" style={{ fontSize: "10px", color: MUTED, textAlign: "center", fontFamily: "'IBM Plex Sans',sans-serif" }}>{sev}</div>
                  {[1, 2, 3, 4, 5].map((lik, ci) => {
                    const score = sev * lik;
                    const tone = riskTone(score);
                    const value = counts.matrix[ri]?.[ci] || 0;
                    return (
                      <div
                        key={`${sev}-${lik}`}
                        style={{
                          display: "flex",
                          minHeight: "40px",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "6px",
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          padding: "4px",
                        }}
                      >
                        <span style={{ fontSize: "13px", fontWeight: 600 }} dir="ltr">{value}</span>
                        <span style={{ fontSize: "9px", opacity: 0.7 }} dir="ltr">{score}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "18px repeat(5,1fr)", gap: "5px", marginTop: "2px" }}>
                <div />
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} dir="ltr" style={{ fontSize: "10px", color: MUTED, textAlign: "center" }}>{n}</div>
                ))}
              </div>
              <div style={{ fontSize: "9px", letterSpacing: "0.08em", color: MUTED, fontWeight: 600, textAlign: "center", marginTop: "6px" }}>
                {ar ? "الاحتمال" : "LIKELIHOOD"}
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px", paddingTop: "11px", borderTop: "1px solid #F1F5F9" }}>
                {[
                  { label: ar ? "منخفض" : "Low", c: "#BBF7D0" },
                  { label: ar ? "متوسط" : "Medium", c: "#FDE68A" },
                  { label: ar ? "عالٍ" : "High", c: "#FED7AA" },
                  { label: ar ? "حرج" : "Critical", c: "#FECACA" },
                ].map((b) => (
                  <span key={b.label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: MUTED }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: b.c, flexShrink: 0 }} />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </ChromeBox>
      </div>

      <ChromeBox>
        <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "2px" }}>
          {ar ? "سجل المخاطر — المفتوحة" : "Hazard register — open"}
        </div>
        <div style={{ fontSize: "11px", color: MUTED, marginBottom: "12px" }}>
          {ar
            ? "لكل خطر مسؤول وتاريخ إغلاق، والمُغلق يبقى بإثباته للمراجعة"
            : "Every hazard has an owner and a closure date; closed ones stay with proof for review"}
        </div>
        {counts.openHazards.length === 0 ? (
          <div style={{ padding: "22px 0", textAlign: "center", fontSize: "13px", color: MUTED }}>
            {ar ? "لا مخاطر مفتوحة في هذا النطاق." : "No open hazards in this scope."}
          </div>
        ) : (
          counts.openHazards.map((h) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
                borderTop: "1px solid #F1F5F9",
                flexWrap: "wrap",
              }}
            >
              <span style={WARN}>{h.level}</span>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: NAVY }}>{h.title}</div>
                <div style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>{h.meta}</div>
              </div>
              <span style={{ fontSize: "11px", color: MUTED, whiteSpace: "nowrap" }} dir="ltr">{h.due}</span>
              <span style={NEUTRAL} dir="ltr">S×L {h.score}</span>
            </div>
          ))
        )}
      </ChromeBox>

      {/* PTW / CAPA / competency / drills — secondary detail, not a competing board */}
      <details style={{ padding: "8px 0 0", borderTop: "1px solid #E2E8F0" }}>
        <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: NAVY, listStyle: "none" }}>
          {ar ? "تصاريح · CAPA · كفاءة · تمارين — تفصيل" : "PTW · CAPA · competency · drills — detail"}
        </summary>
        <p style={{ margin: "8px 0 14px", fontSize: "11px", color: MUTED, lineHeight: 1.65 }}>
          {ar
            ? "الهرم والمصفوفة وسجل المخاطر أعلاه هما السطح الأساسي — التفاصيل أدناه اختيارية."
            : "Pyramid, matrix, and hazard register above are primary — details below are optional."}
        </p>

        <section style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "تصاريح العمل (PTW)" : "Permits to work (PTW)"}
          </div>
          {counts.permits.length === 0 ? (
            <div style={{ padding: "14px 0", fontSize: "12px", color: MUTED }}>
              {ar ? "لا تصاريح نشطة في هذا النطاق." : "No active permits in this scope."}
            </div>
          ) : (
            counts.permits.map((p, i) => (
              <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderTop: "1px solid #F1F5F9", flexWrap: "wrap" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                <span style={{ flex: "1 1 210px", minWidth: 0, fontSize: "12px", fontWeight: 600, color: NAVY }}>{p.type || p.title}</span>
                <span style={OK}>{p.status || (ar ? "ساري" : "Live")}</span>
              </div>
            ))
          )}
        </section>

        <section style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "إجراءات تصحيحية ووقائية (CAPA)" : "Corrective & preventive actions (CAPA)"}
          </div>
          {counts.capa.length === 0 ? (
            <div style={{ padding: "14px 0", fontSize: "12px", color: MUTED }}>
              {ar ? "لا بنود CAPA مفتوحة في النطاق." : "No open CAPA items in scope."}
            </div>
          ) : (
            counts.capa.map((c, i) => (
              <div key={c.ref || c.id || i} style={{ borderTop: "1px solid #F1F5F9", padding: "10px 0", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", fontWeight: 600, color: NAVY }} dir="ltr">{c.ref || `CAPA-${i + 1}`}</span>
                <span style={WARN}>{c.status || (ar ? "مفتوح" : "Open")}</span>
              </div>
            ))
          )}
        </section>

        <section style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "كفاءة السلامة" : "Safety competency"}</div>
          {competency.length === 0 ? (
            <div style={{ padding: "14px 0", fontSize: "12px", color: MUTED }}>
              {ar ? "لا منسقي سلامة معيّنين في الدليل بعد." : "No safety coordinators assigned in the directory yet."}
            </div>
          ) : (
            competency.map((c) => (
              <div key={c.name} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", borderTop: "1px solid #F1F5F9", padding: "8px 0" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: c.ok ? ACCENT : "#DC2626", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: NAVY }}>{c.name}</span>
                <span style={{ fontSize: "11px", color: MUTED }}>{c.note}</span>
              </div>
            ))
          )}
        </section>

        <section style={{ borderTop: "1px solid #F1F5F9", paddingTop: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "تمارين الطوارئ" : "Emergency drills"}</div>
          <div style={{ marginTop: "8px", fontSize: "12px", color: MUTED }}>
            {ar ? "تمارين مسجّلة: " : "Recorded drills: "}
            <span dir="ltr" style={{ color: NAVY, fontWeight: 600 }}>
              {String(safety.reduce((n, r) => n + ((r.drills || []).length || (r.lastDrillAt ? 1 : 0)), 0) || "—")}
            </span>
            {" · "}
            {ar ? "الإيقاع المستهدف: ربع سنوي" : "Target cadence: quarterly"}
          </div>
        </section>
      </details>
    </div>
  );
}
