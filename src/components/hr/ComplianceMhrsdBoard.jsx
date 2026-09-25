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
import { deriveExpiringDocs, deriveNitaqat, nitaqatBandLabel, EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";
import { formatDate } from "@/lib/dateFormat";
import { printReport } from "@/lib/printReport";
import { deriveInspectionPack } from "@/lib/inspectionPackDerivations";
import StatutoryItem from "@/components/labor/StatutoryItem";
import { BOE_LABOUR_LAW_URL, HRSD_IMPLEMENTING_REGS_URL, HRSD_LABOUR_LAW_EDITION, HRSD_LABOUR_LAW_PDF } from "@/lib/laborRules";

const SURFACE_LINKS = [
  { to: "/app/requests/leave", ar: "طلبات الإجازة", en: "Leave Requests" },
  { to: "/app/hr", ar: "الموارد البشرية", en: "Human Resources" },
  { to: "/app/safety", ar: "السلامة HSE", en: "Safety HSE" },
  { to: "/app/complaints", ar: "صوت الموظف", en: "Employee Voice" },
  { to: "/app/payroll", ar: "الرواتب", en: "Payroll" },
  { to: "/app/discipline", ar: "الجزاءات", en: "Sanctions" },
];

/** Short name per derived blocker key — used for the headline cause, not as a new state. */
const BLOCKER_SHORT = {
  doc_expired: { ar: "وثائق نظامية منتهية", en: "Expired statutory documents" },
  doc_expiring: { ar: "وثائق تقترب من الانتهاء", en: "Documents nearing expiry" },
  contract_expired: { ar: "عقود منتهية", en: "Expired contracts" },
  contract_end_required: { ar: "عقود بلا تاريخ نهاية", en: "Contracts missing an end date" },
  contract_expiring: { ar: "عقود تقترب من الانتهاء", en: "Contracts nearing expiry" },
  safety_critical: { ar: "مستوى سلامة حرج", en: "Critical safety level" },
  hazards_open: { ar: "مخاطر مفتوحة", en: "Open hazards" },
  leave_pending: { ar: "إجازات بانتظار القرار", en: "Leave awaiting a decision" },
  task_overdue: { ar: "مهام تجاوزت الاستحقاق", en: "Overdue tasks" },
};

/** Where a blocker is actually cleared — named so the row is a route, not a verdict. */
const CLEARED_AT = {
  "/app/hr": { ar: "الدليل", en: "Directory" },
  "/app/safety": { ar: "السلامة", en: "Safety" },
  "/app/requests/leave": { ar: "الإجازات", en: "Leave" },
  "/app/tasks": { ar: "المهام", en: "Tasks" },
};

function countAr(n, one, two, few, many) {
  const v = Math.max(0, Number(n) || 0);
  if (v === 1) return one;
  if (v === 2) return two;
  if (v <= 10) return `${v} ${few}`;
  return `${v} ${many}`;
}

/** Signed day distance as Arabic prose — never a bare "-47 d". */
function expiryWording(days, ar) {
  const n = Math.abs(Number(days) || 0);
  if (!ar) return days < 0 ? `expired ${n} day(s) ago` : `${n} day(s) left`;
  const word = countAr(n, "يوم واحد", "يومين", "أيام", "يوماً");
  return days < 0 ? `انتهت قبل ${word}` : `تنتهي بعد ${word}`;
}

/* A rail that is only derived is not a rail that is connected — the fill has to say
   which of the two it is, otherwise five identical green chips claim five live links. */
function LiveChip({ on, label, ar }) {
  const live = !!on;
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
        background: live ? "#ECFDF3" : SURFACE,
        border: `1px solid ${live ? "#BBF7D0" : "#E2E8F0"}`,
        color: live ? "#15803D" : MUTED,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: live ? ACCENT : "#CBD5E1",
          flexShrink: 0,
        }}
      />
      {label}
      {" · "}
      {live ? (ar ? "حي" : "live") : (ar ? "مشتق" : "derived")}
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

  /* The headline is the news, not a tally: how many stations still owe something and
     which cause repeats most across them — both counted off the same derived rows. */
  const readinessNews = useMemo(() => {
    const blocked = readinessRows.filter(({ readiness }) => readiness.blockers.length > 0);
    const tally = new Map();
    for (const { readiness } of blocked) {
      for (const blocker of readiness.blockers) {
        tally.set(blocker.key, (tally.get(blocker.key) || 0) + 1);
      }
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      blockedCount: blocked.length,
      topCause: top ? BLOCKER_SHORT[top[0]] : null,
      topCauseStations: top ? top[1] : 0,
    };
  }, [readinessRows]);

  const scopedEmployees = useMemo(
    () => (register?.employees || []).filter((e) => matchesStationScope(e.stationId, scope)),
    [register?.employees, scope],
  );
  const localNitaqat = useMemo(() => deriveNitaqat(scopedEmployees), [scopedEmployees]);
  const registerExpiring = useMemo(
    () => deriveExpiringDocs(scopedEmployees),
    [scopedEmployees],
  );

  const load = useCallback(async () => {
    const localFallback = {
      nitaqat: localNitaqat,
      expiring: registerExpiring,
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
    const applyLocal = () => setData(localFallback);
    if (!company?.id) {
      applyLocal();
      return;
    }
    try {
      const res = await base44.functions.invoke("compliance", { action: "overview", companyId: company.id });
      const payload = res?.data || res;
      if (!payload || payload.error || payload.localPreview || !payload.nitaqat) {
        applyLocal();
        return;
      }
      setData(payload);
      setGosiNo(payload?.gosiEstablishment || "");
    } catch {
      applyLocal();
    }
  }, [company?.id, localNitaqat, registerExpiring, scopedEmployees.length, scope]);

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

  /* Nearest expiry first — an expired document outranks one with weeks left. */
  const expiringList = useMemo(() => {
    const source = registerExpiring.length ? registerExpiring : (data?.expiring || []);
    return [...source].sort((a, b) => (Number(a.days) || 0) - (Number(b.days) || 0));
  }, [registerExpiring, data?.expiring]);

  const n = data?.nitaqat && Number.isFinite(Number(data.nitaqat.rate)) && data.nitaqat.total != null
    ? data.nitaqat
    : localNitaqat;
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
      periodLabel: new Date().toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB"),
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
            /* The gate code left the screen but stays in the evidence sheet — the
               inspector needs the machine name, the manager does not. */
            readiness.blockers.length
              ? readiness.blockers
                .map((b) => `${ar ? b.ar : b.en} [${String(b.key).toUpperCase()}]`)
                .join(" · ")
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
      {/* L2234–2268 Nitaqat card — primary glance at top of compliance centre */}
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

      {/* Ministry rails — stamp already carries the centre title. */}
      <ChromeBox>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <LiveChip on={!!live?.qiwa} label={ar ? "قوى" : "Qiwa"} ar={ar} />
          <LiveChip on={!!live?.gosi} label={ar ? "التأمينات" : "GOSI"} ar={ar} />
          <LiveChip on={!!live?.mudad} label={ar ? "مدى / WPS" : "Mudad / WPS"} ar={ar} />
          <LiveChip on={!!live?.nafath} label={ar ? "نفاذ" : "Nafath"} ar={ar} />
          <LiveChip on={!!live?.ajeer} label={ar ? "أجير" : "Ajeer"} ar={ar} />
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
          {ar
            ? "الأنظمة مشتقة من السجل داخل المنصة. الإرسال الحكومي الحي مؤجّل حتى الاعتمادات الرسمية."
            : "The systems are derived from the register inside the product. Live government send waits for official credentials."}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
          {ar
            ? `مصدر الساعات والإجازات والعقود: نظام العمل ${HRSD_LABOUR_LAW_EDITION.decree} المعدّل بـ ${HRSD_LABOUR_LAW_EDITION.lastAmend} (${HRSD_LABOUR_LAW_EDITION.lastAmendHijri}).`
            : `Hours, leave and contracts follow Labour Law ${HRSD_LABOUR_LAW_EDITION.decree} as amended by ${HRSD_LABOUR_LAW_EDITION.lastAmend} (${HRSD_LABOUR_LAW_EDITION.lastAmendGregorian}).`}
          {" "}
          <a href={HRSD_LABOUR_LAW_PDF} target="_blank" rel="noreferrer" style={{ color: NAVY, fontWeight: 600 }}>
            {ar ? "ملف الوزارة" : "Ministry PDF"}
          </a>
          {" · "}
          <a href={BOE_LABOUR_LAW_URL} target="_blank" rel="noreferrer" style={{ color: NAVY }}>
            {ar ? "هيئة الخبراء" : "BOE"}
          </a>
          {" · "}
          <a href={HRSD_IMPLEMENTING_REGS_URL} target="_blank" rel="noreferrer" style={{ color: NAVY }}>
            {ar ? "اللائحة التنفيذية" : "Implementing regs"}
          </a>
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
                rows: pack.registers.map((row) => [ar ? row.ar : row.en, (ar ? row.articleLabel : row.articleLabelEn) || "—", String(row.count), row.to]),
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {deriveInspectionPack(register || {}).registers.filter((row) => row.article).map((row) => (
            <span key={row.id} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Link to={row.to} style={{ fontSize: 12, color: NAVY, textDecoration: "none" }}>{ar ? row.ar : row.en}</Link>
              <StatutoryItem article={row.article} ar={ar} entitlement={String(row.ruleId || "").startsWith("leave.")} />
            </span>
          ))}
        </div>
      </ChromeBox>

      {/* Per-station readiness — the same derivation the quick-switch palette shows */}
      {readinessRows.length > 0 && (
        <ChromeBox>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
                {readinessNews.blockedCount === 0
                  ? (ar ? "لا فرع بمانع مفتوح في هذا النطاق" : "No station has an open blocker in this scope")
                  : ar
                    ? `${countAr(readinessNews.blockedCount, "فرع واحد", "فرعان", "فروع", "فرعاً")} ${readinessNews.blockedCount === 1 ? "بمانع مفتوح" : "بموانع مفتوحة"}`
                    : `${readinessNews.blockedCount} station(s) with an open blocker`}
              </div>
              <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", maxWidth: "660px", lineHeight: 1.65 }}>
                {readinessNews.topCause
                  ? (ar
                    ? `أكثر سبب تكراراً: ${readinessNews.topCause.ar} — في ${countAr(readinessNews.topCauseStations, "فرع واحد", "فرعين", "فروع", "فرعاً")}. الترتيب من الأدنى جاهزية، والمانع مرتّب بأثره على النسبة.`
                    : `Most repeated cause: ${readinessNews.topCause.en} — in ${readinessNews.topCauseStations} station(s). Ordered by lowest readiness; blockers ordered by their weight on the score.`)
                  : (ar
                    ? "مشتقة من السجل المحلي: الوثائق النظامية، السلامة، الإجازات، والمهام المتأخرة."
                    : "Derived from the local register: statutory documents, safety, leave and overdue tasks.")}
              </div>
              <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.65 }}>
                {ar
                  ? `نافذة الإنذار قبل الانتهاء ${EXPIRY_WARN_DAYS} يوماً — مشتقة من قواعد الامتثال لا مكتوبة في الشاشة.`
                  : `Expiry warning window is ${EXPIRY_WARN_DAYS} days — derived from the compliance rules, not written into the screen.`}
              </div>
            </div>
            <button type="button" onClick={exportReadiness} style={btnGhost}>
              {ar ? "كشف الجاهزية — للتفتيش" : "Readiness sheet — for inspection"}
            </button>
          </div>

          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column" }}>
            {readinessRows.map(({ station, readiness }) => {
              /* A clear station asks for nothing, so it is written quietly. Saturation is
                 spent only where the register still owes the ministry something. */
              const clear = readiness.blockers.length === 0;
              const signal = clear ? "#E2E8F0" : READINESS_COLOR[readiness.level];
              return (
                <div
                  key={station.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 0",
                    borderTop: "1px solid #F1F5F9",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      marginTop: "5px",
                      flexShrink: 0,
                      background: signal,
                    }}
                  />
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: clear ? MUTED : NAVY }}>
                      {station.name || station.id}
                    </div>
                    <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>
                      {readinessLabel(readiness.level, ar)} · {ar ? "الطاقم" : "crew"} {readiness.crew} · {ar ? "التوطين" : "Saudization"}{" "}
                      <span dir="ltr">{readiness.saudiRate}%</span>
                    </div>
                    {clear ? (
                      <div style={{ fontSize: "11px", color: MUTED, marginTop: "6px" }}>
                        {ar ? "لا مانع مفتوح" : "No open blocker"}
                      </div>
                    ) : (
                      <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "5px" }}>
                        {readiness.blockers.map((blocker) => (
                          <li key={blocker.key} style={{ fontSize: "11px", color: MUTED, lineHeight: 1.6 }}>
                            <Link
                              to={blocker.to}
                              style={{
                                display: "inline-flex",
                                alignItems: "baseline",
                                flexWrap: "wrap",
                                gap: "6px",
                                color: NAVY,
                                textDecoration: "none",
                                borderBottom: "1px solid #E2E8F0",
                              }}
                            >
                              <span>{ar ? blocker.ar : blocker.en}</span>
                              <span style={{ fontSize: "10px", color: MUTED }}>
                                {ar
                                  ? `يُعالَج في ${(CLEARED_AT[blocker.to] || {}).ar || "المنصة"} ←`
                                  : `Cleared in ${(CLEARED_AT[blocker.to] || {}).en || "the platform"} →`}
                              </span>
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
                      color: clear ? MUTED : READINESS_COLOR[readiness.level],
                      flexShrink: 0,
                    }}
                  >
                    {readiness.score}%
                  </div>
                </div>
              );
            })}
          </div>
      </ChromeBox>
      )}

      {/* App GOSI / expiry extras — same card chrome */}
      <ChromeBox>
        <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
          {ar ? "التأمينات الاجتماعية (GOSI) والوثائق المنتهية" : "GOSI & expiring documents"}
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
            {ar ? `وثائق بتاريخ صلاحية تنتهي خلال ${EXPIRY_WARN_DAYS} يوماً` : `Dated documents expiring within ${EXPIRY_WARN_DAYS} days`}
          </div>
          {expiringList.length === 0 ? (
            <div style={{ marginTop: "8px", fontSize: "12px", color: MUTED }}>
              {ar ? "لا تنبيهات انتهاء في النطاق الحالي — يظهر التنبيه عند اقتراب نهاية الوثيقة." : "No expiry alerts in the current scope — an alert appears when a document nears its end date."}
            </div>
          ) : (
            <>
              <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                {expiringList.slice(0, 12).map((row) => {
                  const gone = Number(row.days) < 0;
                  return (
                    <li
                      key={`${row.employeeId}-${row.kind}-${row.expiryDate}-${row.docLabelAr}`}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        flexWrap: "wrap",
                        gap: "4px 10px",
                        fontSize: "12px",
                        color: NAVY,
                        padding: "8px 0",
                        borderTop: "1px solid #F1F5F9",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{row.name || (ar ? "بلا اسم على السجل" : "Unnamed on the register")}</span>
                      <span style={{ color: MUTED }}>{ar ? row.docLabelAr : row.docLabelEn}</span>
                      <span style={{ color: MUTED }}>{formatDate(row.expiryDate, lang, { year: "numeric", month: "short", day: "numeric" })}</span>
                      <span style={{ color: gone ? "#DC2626" : MUTED, fontWeight: gone ? 600 : 400 }}>
                        {expiryWording(row.days, ar)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {expiringList.length > 12 && (
                <div style={{ marginTop: "8px", fontSize: "11px", color: MUTED }}>
                  {ar
                    ? `تُعرض أقرب 12 وثيقة من ${expiringList.length} — الكشف الكامل في ملف التفتيش.`
                    : `Showing the nearest 12 of ${expiringList.length} — the full list is in the inspection pack.`}
                </div>
              )}
            </>
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
