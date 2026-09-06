import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  checkCompanyRecordGate,
  checkGeofenceConfigGate,
  deriveVerificationMode,
} from "@/lib/settingsDerivations";
import { toast } from "@/components/ui/use-toast";
import { renameCompany } from "@/lib/companySettings";
import { ACCENT, MUTED, NAVY, pageCol, ui, field, CARD, SURFACE } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import SettingsPermDelegation from "@/components/hr/SettingsPermDelegation";

async function settingsApi(payload) {
  const res = await base44.functions.invoke("settings", payload);
  return res?.data ?? res;
}

export default function CompanySettingsBoard({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const [record, setRecord] = useState({
    name: "",
    commercialRegistration: "",
    vatNumber: "",
    qiwaEstablishment: "",
    allowedEmailDomain: "",
  });
  const [companyRows, setCompanyRows] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [verification, setVerification] = useState(deriveVerificationMode(true));
  const [rateLimits, setRateLimits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editGeo, setEditGeo] = useState(null);
  const [gateHint, setGateHint] = useState(null);

  const isOwner = currentUser && (
    data?.ownerId === currentUser.id
    || ["owner", "admin"].includes(currentUser.role)
  );
  const canManage = currentUser && (
    isOwner
    || ["director", "ops_manager", "pgm", "station_manager", "hr_manager"].includes(currentUser.role)
  );

  const applyRemote = (remote) => {
    if (!remote) return;
    if (remote.record) {
      setRecord({
        name: remote.record.name || "",
        commercialRegistration: remote.record.commercialRegistration || "",
        vatNumber: remote.record.vatNumber || "",
        qiwaEstablishment: remote.record.qiwaEstablishment || "",
        allowedEmailDomain: remote.record.allowedEmailDomain || "",
      });
    }
    if (Array.isArray(remote.companyRows)) setCompanyRows(remote.companyRows);
    if (Array.isArray(remote.geofences)) setGeofences(remote.geofences);
    if (remote.verification) setVerification(remote.verification);
    if (Array.isArray(remote.rateLimits)) setRateLimits(remote.rateLimits);
  };

  const load = async () => {
    if (!company?.id) return;
    setBusy(true);
    try {
      let remote = await settingsApi({ action: "list", companyId: company.id });
      const noRecord = !remote?.record?.commercialRegistration && !remote?.record?.vatNumber;
      const noGeo = Array.isArray(remote?.geofences)
        && remote.geofences.every((g) => !g.configured);
      if (canManage && (noRecord || noGeo)) {
        remote = await settingsApi({ action: "seedDemo", companyId: company.id });
      }
      applyRemote(remote);
      setGateHint(null);
    } catch {
      setCompanyRows([]);
      setGeofences([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, [company?.id]);

  const saveRecord = async () => {
    if (!company?.id || !canManage) return;
    const gate = checkCompanyRecordGate(record);
    if (!gate.ok) {
      setGateHint(ar ? gate.reason : gate.reasonEn);
      toast({
        description: ar ? gate.reason : gate.reasonEn,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const remote = await settingsApi({
        action: "updateCompanyRecord",
        companyId: company.id,
        ...record,
      });
      if (remote?.error) {
        setGateHint(ar ? remote.reason : (remote.reasonEn || remote.reason));
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.error),
          variant: "destructive",
        });
        return;
      }
      applyRemote(remote);
      setGateHint(null);
      if (record.name?.trim()) await renameCompany(company.id, record.name);
      toast({ description: ar ? "حُفظت بيانات المنشأة" : "Company record saved" });
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleGeo = async () => {
    if (!company?.id || !isOwner) {
      setGateHint(ar
        ? "اشتراط التحقق بالموقع قرار لمالك الحساب وحده."
        : "Geofence verification is the account owner's decision alone.");
      return;
    }
    setBusy(true);
    try {
      const remote = await settingsApi({
        action: "setGeofenceVerification",
        companyId: company.id,
        enabled: !verification.geofenceVerificationRequired,
      });
      if (remote?.error) {
        setGateHint(ar ? remote.reason : (remote.reasonEn || remote.reason));
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.error),
          variant: "destructive",
        });
        return;
      }
      applyRemote(remote);
      setGateHint(null);
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveGeofence = async () => {
    if (!company?.id || !canManage || !editGeo) return;
    const gate = checkGeofenceConfigGate(editGeo);
    if (!gate.ok) {
      setGateHint(ar ? gate.reason : gate.reasonEn);
      toast({
        description: ar ? gate.reason : gate.reasonEn,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const remote = await settingsApi({
        action: "updateGeofence",
        companyId: company.id,
        stationId: editGeo.stationId,
        lat: gate.lat,
        lng: gate.lng,
        radiusMeters: gate.radiusMeters,
      });
      if (remote?.error) {
        setGateHint(ar ? remote.reason : (remote.reasonEn || remote.reason));
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.error),
          variant: "destructive",
        });
        return;
      }
      applyRemote(remote);
      setEditGeo(null);
      setGateHint(null);
      toast({ description: ar ? "حُفظ النطاق الجغرافي" : "Geofence saved" });
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!currentUser) return null;

  const fieldInput = { ...field };
  const geoOn = !!verification.geofenceVerificationRequired;
  const geoSwitchStyle = {
    position: "relative",
    width: "44px",
    height: "24px",
    borderRadius: "14px",
    border: "none",
    cursor: isOwner && !busy ? "pointer" : "not-allowed",
    padding: 0,
    flexShrink: 0,
    background: geoOn ? ACCENT : "#CBD5E1",
    opacity: !isOwner || busy ? 0.6 : 1,
  };
  const geoKnobStyle = {
    position: "absolute",
    top: "3px",
    ...(geoOn ? { insetInlineEnd: "3px" } : { insetInlineStart: "3px" }),
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: CARD,
  };

  return (
    <section style={{ ...pageCol, margin: "0 auto" }} dir={ar ? "rtl" : "ltr"}>
      {gateHint && (
        <div style={{ borderRadius: "11px", border: "1px solid #FECACA", background: "#FEF2F2", padding: "12px 14px", fontSize: "11px", color: "#B91C1C" }}>
          {gateHint}
        </div>
      )}

      {/* L2107–2117 company record */}
      <ChromeBox>
        <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ flex: 1 }}>{ar ? "بيانات المنشأة" : "Company record"}</span>
          {busy && <Loader2 style={{ width: 14, height: 14, color: MUTED }} className="animate-spin" />}
        </div>
        <div style={{ marginTop: 8 }}>
          <LaborArticleCite ruleId="compliance.establishment.dataUpdateDays" ar={ar} showText />
        </div>
        {canManage ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "16px", marginTop: "16px" }}>
              {[
                { key: "name", label: ar ? "اسم المنشأة" : "Company name", dir: "auto" },
                { key: "commercialRegistration", label: ar ? "السجل التجاري" : "Commercial registration", dir: "ltr" },
                { key: "vatNumber", label: ar ? "الرقم الضريبي" : "VAT number", dir: "ltr" },
                { key: "qiwaEstablishment", label: ar ? "رقم المنشأة في قوى" : "Qiwa establishment", dir: "ltr" },
                { key: "allowedEmailDomain", label: ar ? "النطاق البريدي المسموح" : "Allowed email domain", dir: "ltr" },
              ].map((f) => (
                <label key={f.key} style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "11px", color: MUTED, marginBottom: "5px" }}>{f.label}</span>
                  <input
                    dir={f.dir}
                    value={record[f.key] || ""}
                    onChange={(e) => setRecord({ ...record, [f.key]: e.target.value })}
                    style={fieldInput}
                  />
                  {f.key === "qiwaEstablishment" && (
                    <span style={{ display: "block", fontSize: 10, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                      {ar ? "ملف جاهز — الإرسال الحي عند الاعتماد." : "File ready — live send when credentials are approved."}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={saveRecord} style={{ ...ui.btnPrimary, marginTop: "14px", opacity: busy ? 0.5 : 1 }}>
              {ar ? "احفظ بيانات المنشأة" : "Save company record"}
            </button>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "16px", marginTop: "16px" }}>
            {companyRows.map((r) => (
              <div key={r.key}>
                <div style={{ fontSize: "11px", color: MUTED }}>{ar ? r.labelAr : r.labelEn}</div>
                <div dir={r.dir} style={{ fontSize: "13px", color: NAVY, marginTop: "6px", textAlign: ar ? "right" : "left" }}>{r.value}</div>
                {(r.key === "qiwaEstablishment" || /قوى|Qiwa/i.test(`${r.labelAr || ""} ${r.labelEn || ""}`)) && (
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                    {ar ? "ملف جاهز — الإرسال الحي عند الاعتماد." : "File ready — live send when credentials are approved."}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ChromeBox>

      {/* L2119–2159 geofences */}
      <ChromeBox padded={false}>
        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "النطاق الجغرافي للفروع" : "Station geofences"}</div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>
            {ar
              ? "تسجيل الحضور وإثبات العمل يُقبلان داخل هذا النطاق فقط."
              : "Check-in and work proof are accepted inside this radius only."}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "14px", padding: "13px 15px", borderRadius: "11px", background: SURFACE, border: "1px solid #E2E8F0", flexWrap: "wrap" }}>
            <button type="button" onClick={toggleGeo} disabled={!isOwner || busy} aria-pressed={geoOn} style={geoSwitchStyle}>
              <span style={geoKnobStyle} />
            </button>
            <span style={{ flex: "1 1 240px", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY }}>
                {ar ? "اشتراط التحقق بالموقع الجغرافي" : "Require geofence verification"}
              </span>
              <span style={{ display: "block", fontSize: "11px", color: geoOn ? "#15803D" : "#B45309", marginTop: "2px" }}>
                {ar ? verification.statusAr : verification.statusEn}
              </span>
            </span>
            <span style={{ flexBasis: "100%", fontSize: "11px", color: MUTED, lineHeight: 1.7 }}>
              {ar ? verification.noteAr : verification.noteEn}
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: "620px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) 110px minmax(180px,1fr) 120px", gap: "12px", padding: "10px 20px", background: SURFACE, borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", fontSize: "10px", letterSpacing: "0.06em", color: MUTED, fontWeight: 600 }}>
              <div>{ar ? "الفرع" : "STATION"}</div>
              <div>{ar ? "نصف القطر" : "RADIUS"}</div>
              <div>{ar ? "الإحداثيات" : "COORDINATES"}</div>
              <div>{ar ? "الطاقم" : "CREW"}</div>
            </div>
            {geofences.map((g) => (
              <div
                key={g.stationId}
                style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) 110px minmax(180px,1fr) 120px", gap: "12px", padding: "12px 20px", borderBottom: "1px solid #F1F5F9", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: NAVY }}>{g.name}</div>
                  <div style={{ fontSize: "10px", color: MUTED, fontFamily: "'IBM Plex Mono',monospace", marginTop: "2px" }}>{g.code}</div>
                </div>
                <div style={{ fontSize: "12px", color: MUTED }}>{ar ? g.radiusLabelAr : g.radiusLabelEn}</div>
                <div dir="ltr" style={{ fontSize: "12px", color: MUTED, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" }}>
                  {g.configured ? g.coordsLabel : (ar ? "بانتظار تحديد الموقع" : "Awaiting site survey")}
                </div>
                <div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => setEditGeo({
                        stationId: g.stationId,
                        lat: g.lat ?? "",
                        lng: g.lng ?? "",
                        radiusMeters: g.radiusMeters || 200,
                      })}
                      style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", background: CARD, color: MUTED, fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {g.configured ? (ar ? "عدّل" : "Edit") : (ar ? "حدّد" : "Set")}
                    </button>
                  ) : (
                    <span style={{ fontSize: "12px", color: MUTED }}>{g.crewLabel || "—"}</span>
                  )}
                </div>
              </div>
            ))}
            {geofences.length === 0 && (
              <div style={{ padding: "22px 20px", textAlign: "center", fontSize: "13px", color: MUTED }}>
                {ar ? "لا فروع بعد — أضف فرع من الهيكل." : "No stations yet — add one from the structure."}
              </div>
            )}
          </div>
        </div>

        {editGeo && (
          <div style={{ borderTop: "1px solid #E2E8F0", background: SURFACE, padding: "15px 16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "10px" }}>
              {ar ? `تعديل نطاق: ${editGeo.stationId}` : `Edit geofence: ${editGeo.stationId}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "11px" }}>
              {[
                { key: "lat", label: "Lat" },
                { key: "lng", label: "Lng" },
                { key: "radiusMeters", label: ar ? "نصف القطر (م)" : "Radius (m)" },
              ].map((f) => (
                <label key={f.key} style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{f.label}</span>
                  <input
                    dir="ltr"
                    type="number"
                    step="any"
                    value={editGeo[f.key]}
                    onChange={(e) => setEditGeo({ ...editGeo, [f.key]: e.target.value })}
                    style={fieldInput}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "13px" }}>
              <button type="button" disabled={busy} onClick={saveGeofence} style={{ ...ui.btnPrimary, opacity: busy ? 0.5 : 1 }}>
                {ar ? "احفظ" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditGeo(null)}
                style={{ height: "36px", padding: "0 14px", borderRadius: "9px", border: "1px solid #E2E8F0", background: CARD, color: MUTED, fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}
              >
                {ar ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </ChromeBox>

      {/* L2162–2231 — design owns these on settings */}
      <SettingsPermDelegation lang={lang} />

      <ChromeBox>
        <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
          {ar ? "حدود البلاغات المجهولة" : "Anonymous report rate limits"}
        </div>
        <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>
          {ar
            ? "ثوابت مشتركة مع صوت الموظف (3 / 10 / 30) — للعرض فقط."
            : "Shared constants with Employee Voice (3 / 10 / 30) — read-only."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px", marginTop: "16px" }}>
          {rateLimits.map((r) => (
            <div key={r.key} style={{ border: "1px solid #E2E8F0", borderRadius: "11px", padding: "14px", background: SURFACE }}>
              <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "22px", fontWeight: 600, lineHeight: 1, textAlign: "right", color: NAVY }}>{r.value}</div>
              <div style={{ fontSize: "11px", color: MUTED, marginTop: "6px" }}>{ar ? r.labelAr : r.labelEn}</div>
            </div>
          ))}
        </div>
      </ChromeBox>
    </section>
  );
}
