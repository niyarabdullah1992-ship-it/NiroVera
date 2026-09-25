import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany } from "@/lib/store";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { localAttendanceSettings } from "@/lib/localAttendanceFallback";
import { useI18n } from "@/lib/i18n";
import { BORDER, CARD, DANGER, MUTED, NAVY } from "@/lib/platformStyles";
import HoursLawSettings from "@/components/attendance/HoursLawSettings";

function previewSettings(company) {
  return {
    ...localAttendanceSettings(),
    gps_required: false,
    ...(company?.attendanceSettings || {}),
    schedule_required: true,
    late_threshold_minutes: 0,
  };
}

function policyBtn(on, invert) {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    padding: "9px 15px",
    borderRadius: 10,
    border: `1px solid ${invert ? BORDER : (on ? "var(--nv-btn-fill)" : BORDER)}`,
    background: invert ? CARD : (on ? "var(--nv-btn-fill)" : CARD),
    color: invert ? "var(--nv-ink2)" : (on ? "var(--nv-btn-ink)" : "var(--nv-ink)"),
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

const row = { padding: "15px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 5 };

/** Attendance policy — HTML row layout. GPS only; no NFC auto-punch. */
export default function AttendanceSettingsBoard({ company, currentUser, canEditSettings }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data } = useAuth();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const local = isLocalPreviewActive();

  useEffect(() => {
    if (!company?.id) return;
    const apply = (next) => {
      setSaved(next);
      setDraft(next);
    };
    if (local) {
      apply(previewSettings(company));
      return;
    }
    base44.functions
      .invoke("supabaseAttendance", { action: "getSettings", companyId: company.id })
      .then((res) => apply(res?.data?.settings || previewSettings(company)))
      .catch(() => apply(previewSettings(company)));
  }, [company?.id, local]);

  if (!draft || !data) {
    return (
      <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, padding: 24, textAlign: "center", fontSize: 12, color: MUTED }}>
        {ar ? "جاري التحميل…" : "Loading…"}
      </section>
    );
  }

  const locationEnabled = draft.gps_enabled === true;
  const dirty = JSON.stringify({ gps_enabled: draft.gps_enabled === true }) !== JSON.stringify({ gps_enabled: saved?.gps_enabled === true });

  const persist = (next) => {
    updateCompany(company.id, (d) => {
      d.attendanceSettings = {
        ...(d.attendanceSettings || {}),
        gps_enabled: next.gps_enabled === true,
        gps_required: next.gps_required === true,
        schedule_required: true,
        late_threshold_minutes: 0,
      };
    });
  };

  const save = async () => {
    if (!canEditSettings) return;
    setSaving(true);
    setError("");
    try {
      if (local) {
        persist(draft);
        setSaved(draft);
        return;
      }
      const res = await base44.functions.invoke("supabaseAttendance", {
        action: "updateSettings",
        companyId: company.id,
        userRole: currentUser.role,
        lateThresholdMinutes: 0,
        gpsEnabled: draft.gps_enabled === true,
        gpsRequired: draft.gps_enabled === true,
      });
      if (draft.gps_enabled !== saved?.gps_enabled) {
        await base44.functions.invoke("supabaseAttendance", { action: "clearAttendanceEmergency", companyId: company.id }).catch(() => {});
      }
      const next = res?.data?.settings || draft;
      setDraft(next);
      setSaved(next);
    } catch (err) {
      setError(err?.response?.data?.error || (ar ? "تعذر الحفظ" : "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} dir={ar ? "rtl" : "ltr"}>
    <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "سياسة الحضور" : "Attendance policy"}</span>
        <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
          {ar
            ? "مصدر الوقت جدول الدوام المنشور، وشرط الموقع قبل البصمة. لا ساعة شركة ولا سماح يُخفّف الرقم."
            : "The published rota is the clock, and location is required before punch. No company clock, and grace does not replace the shift."}
        </span>
      </div>

      <div style={row}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{ar ? "التأخير" : "Lateness"}</span>
        <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
          {ar
            ? "يُعدّ متأخراً من بصم بعد بداية الوردية في الجدول المنشور. لا حدّ سماح: الرقم يُسجَّل كما هو، ومعالجته قرار مدير لا إعداد نظام."
            : "A punch after the published shift start is late. There is no grace: the minutes are recorded as they are, and handling them is a manager decision, not a setting."}
        </span>
      </div>

      <div style={{ ...row, gap: 9 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{ar ? "شرط الموقع" : "Location requirement"}</span>
            <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              {locationEnabled
                ? (ar ? "يجب أن يكون الموظف داخل نطاق الفرع عند البصمة." : "The employee must be inside the station range to punch.")
                : (ar ? "التسجيل بلا دليل موقع — يُوسم السجل ويذهب لطابور قرارك." : "Punch without location proof — the row is flagged for your decision.")}
            </span>
          </span>
          <button
            type="button"
            onClick={() => canEditSettings && setDraft({ ...draft, gps_enabled: !locationEnabled, gps_required: !locationEnabled })}
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: "9px 15px",
              border: `1px solid ${locationEnabled ? BORDER : "var(--nv-ok-fill)"}`,
              background: locationEnabled ? CARD : "var(--nv-ok-fill)",
              color: locationEnabled ? "var(--nv-ink)" : "var(--nv-btn-ink)",
              cursor: canEditSettings ? "pointer" : "default",
              whiteSpace: "nowrap",
              opacity: canEditSettings ? 1 : 0.55,
            }}
          >
            {locationEnabled ? (ar ? "إطفاء" : "Turn off") : (ar ? "تشغيل" : "Turn on")}
          </button>
        </div>
        {!locationEnabled ? (
          <span style={{ fontSize: 11, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", padding: "10px 12px", lineHeight: 1.85, borderRadius: 10 }}>
            {ar
              ? "إطفاؤه يكسر حلقة النطاق: التسجيل يصبح إقراراً بلا دليل موقع، ويُوسم السجل «بلا موقع» ويذهب لطابور قرارك. اقصره على الفرق الميدانية المتنقّلة."
              : "Turning it off breaks the range link: the punch becomes a declaration without location proof, and the row is flagged. Keep it for mobile field teams only."}
          </span>
        ) : null}
      </div>

      <div style={row}>
        <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{ar ? "شرط جدول اليوم" : "Today's rota"}</span>
        <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
          {ar
            ? "إلزامي دائماً. غير المدرج في وردية اليوم لا يبصم — إلا بتسجيل يدوي من المدير. ولا يُحتسب عليه غياب، لأن الغياب بلا وردية منشورة لا معنى له."
            : "Always required. Unscheduled staff cannot punch — except a manager override. Absence without a published shift has no meaning."}
        </span>
      </div>

      <div style={{ padding: "15px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
          {dirty
            ? (ar ? "مسودة — لا تسري حتى الحفظ." : "Draft — not live until you save.")
            : (ar ? "السياسة المحفوظة سارية على بصمة اليوم." : "The saved policy applies to today's punch.")}
        </span>
        {error ? <span style={{ fontSize: 11, color: DANGER }}>{error}</span> : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            style={{
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              padding: "11px 18px",
              border: "none",
              background: dirty ? "var(--nv-ok-fill)" : "var(--nv-warn-fill)",
              color: "var(--nv-btn-ink)",
              cursor: dirty && !saving ? "pointer" : "default",
              whiteSpace: "nowrap",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 style={{ width: 14, height: 14, display: "inline", animation: "spin 1s linear infinite" }} /> : null}
            {dirty ? (ar ? "احفظ السياسة" : "Save policy") : (ar ? "لا تغيير للحفظ" : "Nothing to save")}
          </button>
          <button type="button" onClick={() => setDraft(saved)} style={policyBtn(false, true)}>
            {ar ? "تراجع" : "Undo"}
          </button>
        </div>
      </div>
    </section>
    <HoursLawSettings
      company={data}
      employees={data?.employees || []}
      canEdit={canEditSettings}
      ar={ar}
    />
    </div>
  );
}
