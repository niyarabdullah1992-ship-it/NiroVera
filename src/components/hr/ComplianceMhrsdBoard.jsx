import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { ACCENT, BAD, MUTED, NAVY, NAVY_FILL, NEUTRAL, OK, WARN, field, CARD, SURFACE } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";
import { visibleStations } from "@/lib/permissions";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { deriveStationReadiness, READINESS_COLOR, readinessLabel } from "@/lib/stationReadiness";
import { nitaqatBandLabel } from "@/lib/complianceDerivations";
import { printReport } from "@/lib/printReport";
import { deriveInspectionPack } from "@/lib/inspectionPackDerivations";

const SURFACE_LINKS = [
  { to: "/app/leave", ar: "طلبات الإجازة", en: "Leave Requests", ready: true },
  { to: "/app/hr", ar: "الموارد البشرية", en: "Human Resources", ready: true },
  { to: "/app/safety", ar: "السلامة HSE", en: "Safety HSE", ready: true },
  { to: "/app/complaints", ar: "صوت الموظف", en: "Employee Voice", ready: true },
  { to: "/app/payroll", ar: "الرواتب", en: "Payroll", ready: true },
  { to: "/app/discipline", ar: "الجزاءات", en: "Sanctions", ready: true },
];

function LiveChip({ on, label, ar }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        height: "28px",
        padding: "0 11px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        background: on ? "#ECFDF3" : "#F8FAFC",
        border: `1px solid ${on ? "#BBF7D0" : "#E2E8F0"}`,
        color: on ? "#15803D" : MUTED,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: on ? ACCENT : "#94A3B8",
          flexShrink: 0,
        }}
      />
      {label}
      {" · "}
      {on ? (ar ? "حي" : "live") : ar ? "قيد الربط الحي" : "pending live"}
    </span>
  );
}

/** Platform settings L2234–2268 — Nitaqat + GOSI extras kept with literal chrome. */
export default function ComplianceMhrsdBoard() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { company, data: register, currentUser } = useAuth();
  const scope = useStationScope();
  const [data, setData] = useState(null);
  const [gosiNo, setGosiNo] = useState("");
  const [busy, setBusy] = useState(false);

  /* Readiness per station — derived from the local register, same signals the
     quick-switch palette shows, so the ministry view and the switcher agree. */
  const readinessRows = useMemo(() => {
    if (!register || !currentUser) return [];
    return visibleStations(currentUser, register)
      .filter((station) => matchesStationScope(station.id, scope, register?.stations))
      .map((station) => ({ station, readiness: deriveStationReadiness(register, station) }))
      .sort((a, b) => a.readiness.score - b.readiness.score);
  }, [register, currentUser, scope]);

  const load = useCallback(async () => {
    const localFallback = {
      nitaqat: { rate: 25, band: "mid_green", saudi: 1, nonSaudi: 3, total: 4 },
      expiring: [],
      gosiEstablishment: "",
      liveIntegrations: {
        qiwa: false,
        gosi: false,
        mudad: false,
        nafath: false,
        noteAr: "معاينة محلية — انشر دالة compliance للربط الكامل. الإرسال الحي لـ قوى/التأمينات/مدى مؤجّل حتى الاعتمادات.",
        noteEn: "Local preview — deploy the compliance function for full wiring. Live Qiwa/GOSI/Mudad send deferred until credentials.",
      },
    };
    if (!company?.id) {
      setData(localFallback);
      return;
    }
    try {
      const res = await base44.functions.invoke("compliance", { action: "overview", companyId: company.id });
      const payload = res?.data || res;
      if (!payload || payload.error) throw new Error(payload?.error || "compliance_unavailable");
      setData(payload);
      setGosiNo(payload?.gosiEstablishment || "");
    } catch {
      setData(localFallback);
    }
  }, [company?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveEstablishment = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("compliance", {
        action: "setGosiEstablishment",
        companyId: company.id,
        gosiEstablishment: gosiNo,
      });
      const payload = res?.data || res;
      if (payload?.error) {
        toast({
          title: ar ? "مرفوض" : "Blocked",
          description: ar ? payload.reason : (payload.reasonEn || payload.reason),
          variant: "destructive",
        });
      } else {
        toast({ title: ar ? "حُفظ رقم المنشأة" : "Establishment saved" });
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const runGosi = async (send) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("compliance", {
        action: "gosiMonthly",
        companyId: company.id,
        send,
      });
      const payload = res?.data || res;
      if (payload?.error) {
        toast({
          title: ar ? "مرفوض" : "Blocked",
          description: ar ? payload.reason : (payload.reasonEn || payload.reason),
          variant: "destructive",
        });
        return;
      }
      if (send) {
        toast({
          title: ar ? "إرسال محاكى لـ GOSI" : "Simulated GOSI send",
          description: `${payload.report?.grandTotal || 0} SAR`,
        });
      } else if (!payload.gate?.ok) {
        toast({
          title: ar ? "بوابة GOSI" : "GOSI gate",
          description: ar ? payload.gate.reason : (payload.gate.reasonEn || payload.gate.reason),
          variant: "destructive",
        });
      } else {
        toast({
          title: ar ? "ملف GOSI جاهز" : "GOSI file ready",
          description: `${payload.report?.grandTotal || 0} SAR · ${payload.report?.rows?.length || 0} rows`,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const n = data?.nitaqat;
  const live = data?.liveIntegrations;
  const rate = Number(n?.rate) || 0;
  const bandId = n?.band || (rate >= 40 ? "platinum" : rate >= 30 ? "high_green" : rate >= 20 ? "mid_green" : rate >= 10 ? "low_green" : "red");
  const bandLabel = nitaqatBandLabel(bandId, ar);
  const bandStyle = bandId === "red" ? BAD : bandId === "low_green" ? WARN : bandId === "platinum" ? NEUTRAL : OK;

  const bands = [
    { id: "red", label: nitaqatBandLabel("red", ar), range: "0–10%", color: "#DC2626", mute: "#FEE2E2" },
    { id: "low_green", label: nitaqatBandLabel("low_green", ar), range: "10–20%", color: "#4ADE80", mute: "#DCFCE7" },
    { id: "mid_green", label: nitaqatBandLabel("mid_green", ar), range: "20–30%", color: ACCENT, mute: "#DCFCE7" },
    { id: "high_green", label: nitaqatBandLabel("high_green", ar), range: "30–40%", color: "#15803D", mute: "#DCFCE7" },
    { id: "platinum", label: nitaqatBandLabel("platinum", ar), range: "≥ 40%", color: NAVY, mute: "#E2E8F0" },
  ].map((b) => ({
    ...b,
    style: { flex: 1, height: "8px", background: bandId === b.id ? b.color : b.mute },
  }));

  const fieldInput = {
    ...field,
    flex: "1 1 220px",
    minWidth: "180px",
  };

  /* Evidence export — prints exactly the derived rows on screen, no extra claim. */
  const exportReadiness = () => {
    printReport({
      title: ar ? "كشف جاهزية الامتثال لكل فرع" : "Per-station compliance readiness",
      companyName: company?.name || "",
      periodLabel: new Date().toLocaleDateString(ar ? "ar-SA" : "en-GB"),
      dir: ar ? "rtl" : "ltr",
      color: ACCENT,
      stats: [
        { label: ar ? "فروع" : "Stations", value: String(readinessRows.length) },
        {
          label: ar ? "جاهزة" : "Ready",
          value: String(readinessRows.filter((r) => r.readiness.level === "ready").length),
        },
        {
          label: ar ? "موقوفة بسبب" : "Blocked",
          value: String(readinessRows.filter((r) => r.readiness.level === "blocked").length),
        },
      ],
      sections: [
        {
          heading: ar ? "الجاهزية المشتقة من السجل" : "Readiness derived from the register",
          headers: ar
            ? ["الفرع", "الجاهزية", "الحالة", "الطاقم", "التوطين", "أسباب المنع"]
            : ["Station", "Readiness", "State", "Crew", "Saudization", "Blocking reasons"],
          rows: readinessRows.map(({ station, readiness }) => [
            station.name || station.id,
            `${readiness.score}%`,
            readinessLabel(readiness.level, ar),
            readiness.crew,
            `${readiness.saudiRate}%`,
            readiness.blockers.length
              ? readiness.blockers.map((b) => (ar ? b.ar : b.en)).join(" · ")
              : ar ? "لا مانع مفتوح" : "No open blocker",
          ]),
        },
      ],
    });
  };

  const btnGhost = {
    height: "38px",
    padding: "0 14px",
    borderRadius: "9px",
    border: "1px solid #E2E8F0",
    background: CARD,
    color: MUTED,
    fontSize: "12px",
    cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit",
    opacity: busy ? 0.6 : 1,
  };

  return (
    <div id="compliance-center" style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
      {/* Compliance centre header — MHRSD IA */}
      <ChromeBox>
        <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: ACCENT, fontWeight: 600 }}>
          {ar ? "وزارة الموارد البشرية والتنمية الاجتماعية" : "MHRSD"}
        </div>
        <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: 600, color: NAVY }}>
          {ar ? "مركز امتثال الموارد البشرية" : "HR compliance centre"}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: MUTED, lineHeight: 1.7, maxWidth: "720px" }}>
          {ar
            ? "نطاقات والتوطين، ملف التأمينات، وتنبيهات الوثائق — مشتقة من السجل. الربط الحي لقوى والتأمينات ومدى ونفاذ مؤجّل حتى الاعتمادات الرسمية (لا إرسال حكومي صامت)."
            : "Nitaqat, GOSI file and document alerts — derived from the register. Live Qiwa / GOSI / Mudad / Nafath deferred until official credentials (no silent government send)."}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" }}>
          <LiveChip on={!!live?.qiwa} label={ar ? "قوى" : "Qiwa"} ar={ar} />
          <LiveChip on={!!live?.gosi} label={ar ? "التأمينات" : "GOSI"} ar={ar} />
          <LiveChip on={!!live?.mudad} label={ar ? "مدى / WPS" : "Mudad / WPS"} ar={ar} />
          <LiveChip on={!!live?.nafath} label={ar ? "نفاذ" : "Nafath"} ar={ar} />
          <LiveChip on={!!live?.ajeer} label={ar ? "أجير" : "Ajeer"} ar={ar} />
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
          {ar
            ? "ملف جاهز — الإرسال الحي عند الاعتماد. الشارة الخضراء تعني اعتمادات حيّة فقط."
            : "File ready — live send when credentials are approved. A green chip means live credentials only."}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
          {SURFACE_LINKS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              style={{
                height: "32px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: SURFACE,
                color: NAVY,
                fontSize: "12px",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
              }}
            >
              {ar ? s.ar : s.en}
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: s.ready ? "#15803D" : MUTED,
                }}
              >
                {s.ready ? (ar ? "جاهز" : "ready") : ar ? "اشتقاق" : "derived"}
              </span>
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const pack = deriveInspectionPack(register || {});
            printReport({
              title: ar ? "ملف التفتيش المشتق" : "Derived inspection pack",
              companyName: company?.name || "NiroVera",
              periodLabel: new Date().toISOString().slice(0, 10),
              dir: ar ? "rtl" : "ltr",
              stats: [
                { label: ar ? "العاملون" : "Workers", value: pack.crew },
                { label: ar ? "جزاءات مفتوحة" : "Open sanctions", value: pack.openDiscipline },
              ],
              sections: [{
                title: ar ? "السجلات السبعة" : "The seven registers",
                headers: [ar ? "السجل" : "Register", ar ? "المادة" : "Article", ar ? "العدد" : "Count", ar ? "المصدر" : "Source"],
                rows: pack.registers.map((row) => [ar ? row.ar : row.en, row.articleLabel || "—", String(row.count), row.to]),
              }],
            });
          }}
          style={{
            marginTop: 12,
            height: 32,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            background: NAVY_FILL,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {ar ? "ملف التفتيش — مشتق من الأقسام" : "Inspection pack — derived from modules"}
        </button>
      </ChromeBox>

      {/* L2234–2268 Nitaqat card */}
      <ChromeBox>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
              {ar ? "نطاقات — نسبة التوطين" : "Nitaqat — Saudization rate"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", maxWidth: "620px", lineHeight: 1.65 }}>
              {ar
                ? "نسبة مشتقة من سجل الموظفين — بلا إدخال يدوي للنطاق. برنامج نطاقات ضمن التزامات الوزارة."
                : "Rate derived from the employee register — no manual band entry. Nitaqat programme under ministry obligations."}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <div
              dir="ltr"
              style={{
                fontFamily: "'IBM Plex Sans',sans-serif",
                fontSize: "30px",
                fontWeight: 600,
                lineHeight: 1,
                color: ACCENT,
              }}
            >
              {rate}%
            </div>
            <span style={bandStyle}>{bandLabel}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "3px", marginTop: "18px", borderRadius: "5px", overflow: "hidden" }}>
          {bands.map((b) => (
            <span key={b.label} style={b.style} />
          ))}
        </div>
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", marginTop: "12px" }}>
          {bands.map((b) => (
            <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "11px", color: MUTED }}>{b.label}</span>
              <span dir="ltr" style={{ fontSize: "10px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>{b.range}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "26px", flexWrap: "wrap", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
          <div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "20px", fontWeight: 600, textAlign: "right", color: NAVY }}>
              {n?.saudi ?? "—"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>{ar ? "سعوديون" : "Saudis"}</div>
          </div>
          <div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "20px", fontWeight: 600, textAlign: "right", color: NAVY }}>
              {n?.nonSaudi ?? "—"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>{ar ? "غير سعوديين" : "Non-Saudis"}</div>
          </div>
          <div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "20px", fontWeight: 600, textAlign: "right", color: NAVY }}>
              {n?.total ?? "—"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>{ar ? "الإجمالي" : "Total"}</div>
          </div>
          {n?.mismatch > 0 ? (
            <div>
              <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "20px", fontWeight: 600, textAlign: "right", color: "#DC2626" }}>
                {n.mismatch}
              </div>
              <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>{ar ? "تعارض جنسية/هوية" : "Nationality / ID mismatch"}</div>
            </div>
          ) : null}
        </div>
      </ChromeBox>

      {/* Per-station readiness — the same derivation the quick-switch palette shows */}
      {readinessRows.length > 0 && (
        <ChromeBox>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
                {ar ? "جاهزية الامتثال لكل فرع" : "Compliance readiness per station"}
              </div>
              <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", maxWidth: "660px", lineHeight: 1.65 }}>
                {ar
                  ? "مشتقة من السجل المحلي: الوثائق النظامية، السلامة، التقارير، الإجازات، والمهام المتأخرة. كل مانع يذكر سببه والسطح الذي يغلقه."
                  : "Derived from the local register: statutory documents, safety, reports, leave and overdue tasks. Every blocker names its reason and the surface that clears it."}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column" }}>
            {readinessRows.map(({ station, readiness }) => (
              <div
                key={station.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 0",
                  borderTop: "1px solid #F1F5F9",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    marginTop: "5px",
                    flexShrink: 0,
                    background: READINESS_COLOR[readiness.level],
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>
                    {station.name || station.id}
                  </div>
                  <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>
                    {readinessLabel(readiness.level, ar)} · {ar ? "الطاقم" : "crew"} {readiness.crew} · {ar ? "التوطين" : "Saudization"}{" "}
                    <span dir="ltr">{readiness.saudiRate}%</span>
                  </div>
                  {readiness.blockers.length === 0 ? (
                    <div style={{ fontSize: "11px", color: "#15803D", marginTop: "6px" }}>
                      {ar ? "لا مانع مفتوح" : "No open blocker"}
                    </div>
                  ) : (
                    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {readiness.blockers.slice(0, 3).map((blocker) => (
                        <li key={blocker.key} style={{ fontSize: "11px", color: MUTED, lineHeight: 1.6 }}>
                          <Link to={blocker.to} style={{ color: NAVY, textDecoration: "none", borderBottom: "1px solid #E2E8F0" }}>
                            {ar ? blocker.ar : blocker.en}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div
                  dir="ltr"
                  style={{
                    fontFamily: "'IBM Plex Sans',sans-serif",
                    fontSize: "18px",
                    fontWeight: 600,
                    color: READINESS_COLOR[readiness.level],
                    flexShrink: 0,
                  }}
                >
                  {readiness.score}%
                </div>
              </div>
            ))}
          </div>
      </ChromeBox>
      )}

      {/* App GOSI / expiry extras — same card chrome */}
      <ChromeBox>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "التأمينات الاجتماعية (GOSI) والوثائق المنتهية" : "GOSI & expiring documents"}
          </div>
          <LiveChip on={!!live?.gosi} label="GOSI" ar={ar} />
        </div>
        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>
          {ar
            ? "رقم المنشأة وملف شهري محاكى — بلا ربط حيّ حتى الاعتمادات. البوابات تُسمّي السبب عند المنع."
            : "Establishment number and simulated monthly file — no live rails until credentials. Gates name the blocking reason."}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "14px", alignItems: "center" }}>
          <input
            style={fieldInput}
            value={gosiNo}
            onChange={(e) => setGosiNo(e.target.value)}
            placeholder={ar ? "رقم منشأة التأمينات" : "e.g. 500000000"}
            dir="ltr"
            aria-label={ar ? "رقم منشأة التأمينات" : "GOSI establishment number"}
          />
          <button
            type="button"
            disabled={busy}
            onClick={saveEstablishment}
            style={{
              height: "38px",
              padding: "0 16px",
              borderRadius: "9px",
              border: "none",
              background: NAVY_FILL,
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {ar ? "حفظ" : "Save"}
          </button>
          <button type="button" disabled={busy} onClick={() => runGosi(false)} style={btnGhost}>
            {ar ? "معاينة ملف GOSI" : "Preview GOSI"}
          </button>
          <button type="button" disabled={busy} onClick={() => runGosi(true)} style={btnGhost}>
            {ar ? "إرسال محاكى (ليس حيًا)" : "Simulate send (not live)"}
          </button>
        </div>

        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "وثائق تنتهي ≤ 60 يومًا (إقامة · رخصة · تأمينات · قوى)" : "Docs expiring ≤ 60 days (Iqama · permit · GOSI · Qiwa)"}
          </div>
          {(data?.expiring || []).length === 0 ? (
            <div style={{ marginTop: "8px", fontSize: "12px", color: MUTED }}>
              {ar ? "لا تنبيهات انتهاء في النطاق الحالي — البوابة DOC_EXPIRING تُفعَّل عند الاقتراب." : "No expiry alerts in the current scope — DOC_EXPIRING gate fires when approaching."}
            </div>
          ) : (
            <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
              {data.expiring.slice(0, 12).map((row) => (
                <li
                  key={`${row.employeeId}-${row.kind}`}
                  style={{ fontSize: "12px", color: NAVY, padding: "8px 0", borderTop: "1px solid #F1F5F9" }}
                >
                  {row.name || row.employeeId} · {ar ? row.docLabelAr : row.docLabelEn} · {row.expiryDate} · {row.days}d
                </li>
              ))}
            </ul>
          )}
        </div>

        {live && (
          <div style={{ marginTop: "14px", borderRadius: "11px", background: SURFACE, border: "1px solid #E2E8F0", padding: "12px 14px", fontSize: "11px", color: MUTED, lineHeight: 1.6 }}>
            {ar ? live.noteAr : live.noteEn}
          </div>
        )}
      </ChromeBox>
    </div>
  );
}
