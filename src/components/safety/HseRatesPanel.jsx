import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { deriveHseRates } from "@/lib/hseDerivations";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { MUTED, INK, BORDER, CARD } from "@/lib/platformStyles";

async function scores(payload) {
  const res = await base44.functions.invoke("scores", payload);
  return res?.data ?? res;
}

const TARGETS = {
  trir: 2.5,
  ltifr: 3.5,
  dart: 1.5,
};

const ACCENT = "var(--nv-btn-fill)";

const SHELL = {
  maxWidth: "1320px",
  background: CARD,
  border: "1px solid var(--nv-line)",
  borderRadius: "16px",
  padding: "18px 20px",
  boxShadow: "0 1px 0 var(--nv-line)",
};

const GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))",
  gap: "12px",
  marginTop: "14px",
};

function kpiCardStyle(ok) {
  return {
    padding: "14px 16px",
    borderRadius: "12px",
    border: `1px solid ${ok ? BORDER : "var(--nv-line)"}`,
    background: ok ? CARD : "var(--nv-warn-soft)",
  };
}

function kpiValueStyle(ok) {
  return {
    fontFamily: "'IBM Plex Sans',sans-serif",
    fontSize: "26px",
    fontWeight: 600,
    lineHeight: 1,
    color: ok ? ACCENT : "var(--nv-warn-ink)",
  };
}

function kpiTargetStyle(ok) {
  return {
    fontSize: "11px",
    fontWeight: 500,
    marginTop: "5px",
    color: ok ? "var(--nv-muted)" : "var(--nv-warn-ink)",
  };
}

/**
 * HSE KPI strip — TRIR / LTIFR / DART / days clear / near-miss ratio.
 * Rates from scores.hseSummary (exposure = headcount × 2080).
 */
export default function HseRatesPanel({ lang, stationScope }) {
  const { company, data } = useAuth();
  const headerScope = useStationScope();
  const scope = stationScope || headerScope || "all";
  const ar = lang === "ar";
  const [rates, setRates] = useState(null);
  const [daysClear, setDaysClear] = useState(null);

  useEffect(() => {
    const scopedEmployees = (data?.employees || []).filter((e) => matchesStationScope(e.stationId, scope, data?.stations));
    const scopedSafety = (data?.safety || []).filter((s) => matchesStationScope(s.stationId, scope, data?.stations));
    const headcount = scopedEmployees.length || 1;
    const local = deriveHseRates(headcount, { lti: 0, restrict: 0, medical: 0, nearMiss: 0 });
    setRates(local);

    const incidents = scopedSafety.flatMap((s) => s.incidentLog || []);
    const last = incidents
      .map((i) => (i.at ? new Date(i.at).getTime() : 0))
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    setDaysClear(last ? Math.max(0, Math.floor((Date.now() - last) / 86400000)) : null);

    if (!company?.id) return;
    scores({
      action: "hseSummary",
      companyId: company.id,
      ...(scope !== "all" ? { stationId: scope } : {}),
    })
      .then((remote) => {
        if (remote?.rates) setRates(remote.rates);
        if (remote?.daysClear != null) setDaysClear(Number(remote.daysClear));
      })
      .catch(() => {});
  }, [company?.id, data?.employees, data?.safety, scope]);

  if (!rates) return null;

  const scoped = scope !== "all";
  const clearVal = daysClear != null ? daysClear : 0;
  const nmRatio = rates.nearMissRatio ?? 0;

  const cards = [
    {
      key: "TRIR",
      value: rates.trir.toFixed(2),
      label: "TRIR",
      sub: ar ? "معدل الحوادث المسجَّلة" : "Total recordable incident rate",
      target: ar ? `الهدف ≤ ${TARGETS.trir.toFixed(2)}` : `Target ≤ ${TARGETS.trir.toFixed(2)}`,
      ok: rates.trir <= TARGETS.trir,
    },
    {
      key: "LTIFR",
      value: rates.ltifr.toFixed(2),
      label: "LTIFR",
      sub: ar ? "الحوادث المفقِدة لوقت العمل" : "Lost-time injury frequency",
      target: ar ? `الهدف ≤ ${TARGETS.ltifr.toFixed(2)}` : `Target ≤ ${TARGETS.ltifr.toFixed(2)}`,
      ok: rates.ltifr <= TARGETS.ltifr,
    },
    {
      key: "DART",
      value: rates.dartRate.toFixed(2),
      label: "DART",
      sub: ar ? "أيام غياب أو عمل مقيَّد" : "Days away / restricted / transfer",
      target: ar ? `الهدف ≤ ${TARGETS.dart.toFixed(2)}` : `Target ≤ ${TARGETS.dart.toFixed(2)}`,
      ok: rates.dartRate <= TARGETS.dart,
    },
    {
      key: "days-clear",
      value: daysClear != null ? String(daysClear) : "—",
      label: ar ? "بلا حادث" : "Days clear",
      sub: scoped
        ? (ar ? "يومًا دون حادث مفقِد لوقت العمل في هذا الفرع" : "days without a lost-time injury at this station")
        : (ar
          ? "يومًا دون حادث — محسوبة على أضعف فرع، فحادث في أي منها يقطع سجل الشركة"
          : "days clear — measured at the weakest station, since one incident anywhere breaks the company streak"),
      target: ar ? "مستمر" : "ongoing",
      ok: clearVal >= 180,
    },
    {
      key: "near-miss",
      value: `${nmRatio}:1`,
      label: ar ? "وشيك : مسجَّل" : "Near-miss ratio",
      sub: ar ? "كل حادث مسجَّل يقابله هذا العدد من التبليغات الوشيكة" : "near-miss reports per recordable incident",
      target: ar ? "الهدف ≥ 10:1" : "Target ≥ 10:1",
      ok: nmRatio >= 10,
    },
  ];

  return (
    <section dir={ar ? "rtl" : "ltr"} style={SHELL}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600 }}>
          {ar ? "مؤشرات السلامة المعيارية" : "Standard safety indicators"}
        </div>
        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.7, maxWidth: "900px" }}>
          {ar
            ? `ساعات التعرّض = ${rates.headcount} × 2080 = ${rates.exposureHours.toLocaleString("en-US")} — لا من ساعات مُعلَنة يدويًا.`
            : `Exposure hours = ${rates.headcount} × 2080 = ${rates.exposureHours.toLocaleString("en-US")} — not manually declared.`}
        </div>
      </div>
      <div style={GRID}>
        {cards.map((c) => (
          <div key={c.key} style={kpiCardStyle(c.ok)}>
            <div dir="ltr" style={kpiValueStyle(c.ok)}>
              {c.value}
            </div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: INK, marginTop: "7px" }}>
              {c.label}
            </div>
            <div style={{ fontSize: "10px", color: MUTED, marginTop: "3px", lineHeight: 1.5 }}>
              {c.sub}
            </div>
            <div style={kpiTargetStyle(c.ok)}>{c.target}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
