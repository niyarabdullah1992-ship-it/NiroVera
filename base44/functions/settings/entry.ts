import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import { DEFAULT_RATE_LIMITS } from "../../shared/complaintDerivations.ts";
import {
  checkCompanyRecordGate,
  checkGeofenceConfigGate,
  checkLocationAgainstGeofence,
  deriveCompanyRows,
  deriveVerificationMode,
  enrichGeofenceRow,
  exposeAnonymousRateLimits,
  normalizeCompanyRecord,
  type CompanyRecord,
  type StationGeofenceLike,
} from "../../shared/settingsDerivations.ts";

const SETTINGS_CATEGORY = "companyMeta";
const SETTINGS_LEGACY_CATEGORY = "companySettings"; // do-not-write — read fallback only

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

type ColorThemePref = {
  id: string;
  navy: string;
  accent: string;
};

type ReportBrandingPref = {
  logoUrl: string;
  color: string;
};

type SettingsPayload = {
  record: CompanyRecord;
  geofenceVerificationRequired: boolean;
  colorTheme?: ColorThemePref | null;
  reportBranding?: ReportBrandingPref | null;
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function normalizeColorTheme(raw: unknown): ColorThemePref | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { id?: unknown; navy?: unknown; accent?: unknown };
  const navy = String(row.navy || "").trim();
  const accent = String(row.accent || "").trim();
  if (!HEX_COLOR.test(navy) || !HEX_COLOR.test(accent)) return null;
  const id = String(row.id || "custom").trim().slice(0, 32) || "custom";
  return { id, navy: navy.toUpperCase(), accent: accent.toUpperCase() };
}

function normalizeReportBranding(raw: unknown): ReportBrandingPref | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { logoUrl?: unknown; color?: unknown };
  const logoUrl = String(row.logoUrl || "").trim();
  const color = String(row.color || "").trim();
  if (!logoUrl && !HEX_COLOR.test(color)) return null;
  return {
    logoUrl: logoUrl.slice(0, 800_000),
    color: HEX_COLOR.test(color) ? color.toUpperCase() : "#14284B",
  };
}

function emptyPayload(): SettingsPayload {
  return {
    record: normalizeCompanyRecord(null),
    geofenceVerificationRequired: true,
    colorTheme: null,
    reportBranding: null,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = String(body.action || "");
    const companyId = requireCompanyId(body.companyId);
    if (!companyId) {
      return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }

    const sessionAuth = await authPowerCareSession(base44, companyId, body.sessionToken);
    if (!sessionAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const auth = {
      companyId,
      userId: sessionAuth.userId || null,
      name: sessionAuth.name || "User",
      role: sessionAuth.role || "employee",
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
    };

    const manageRoles = [
      "owner", "director", "ops_manager", "admin", "pgm", "station_manager", "hr_manager",
    ];
    const canManage = auth.owner || auth.admin || manageRoles.includes(String(auth.role || ""));
    const isOwner = auth.owner || auth.admin || auth.role === "owner";

    const loadBlob = async (category = SETTINGS_CATEGORY) => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category,
      });
      return rows[0] || null;
    };

    const metaRow = (raw: unknown): Record<string, unknown> => {
      if (Array.isArray(raw)) return raw[0] && typeof raw[0] === "object" ? { ...raw[0] } : {};
      return raw && typeof raw === "object" ? { ...raw } : {};
    };

    const settingsFrom = (raw: Record<string, unknown>): SettingsPayload => {
      const base = emptyPayload();
      const recordSrc = raw.record && typeof raw.record === "object" ? raw.record : raw;
      base.record = normalizeCompanyRecord(recordSrc);
      if (typeof raw.geofenceVerificationRequired === "boolean") {
        base.geofenceVerificationRequired = raw.geofenceVerificationRequired;
      }
      base.colorTheme = normalizeColorTheme(raw.colorTheme);
      base.reportBranding = normalizeReportBranding(raw.reportBranding);
      if (!base.record.name && typeof raw.name === "string") {
        base.record = normalizeCompanyRecord({ ...base.record, name: raw.name });
      }
      return base;
    };

    const loadPayload = async (): Promise<SettingsPayload> => {
      const blob = await loadBlob(SETTINGS_CATEGORY);
      const raw = metaRow(blob?.payload);
      let settings = settingsFrom(raw);
      const empty = !settings.record.commercialRegistration && !settings.record.vatNumber && !settings.colorTheme;
      if (empty) {
        const legacy = await loadBlob(SETTINGS_LEGACY_CATEGORY);
        if (legacy?.payload) settings = settingsFrom(metaRow(legacy.payload));
      }
      return settings;
    };

    const savePayload = async (payload: SettingsPayload) => {
      const blob = await loadBlob(SETTINGS_CATEGORY);
      const current = metaRow(blob?.payload);
      const next = {
        ...current,
        id: current.id || "meta",
        name: payload.record.name || current.name,
        record: payload.record,
        geofenceVerificationRequired: payload.geofenceVerificationRequired,
        colorTheme: payload.colorTheme || null,
        reportBranding: payload.reportBranding ?? current.reportBranding ?? null,
        settings: current.settings || {},
      };
      const wrapped = [next];
      if (blob) await base44.asServiceRole.entities.CompanyDataBlob.update(blob.id, { payload: wrapped });
      else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({
          companyId: auth.companyId,
          category: SETTINGS_CATEGORY,
          payload: wrapped,
        });
      }
    };

    const audit = async (actionKey: string, details: string, extra: Record<string, unknown> = {}) => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: actionKey,
        performedBy: auth.name,
        details,
        reason: extra.reason || null,
        oldValue: extra.oldValue || null,
        newValue: extra.newValue || null,
      });
    };

    const loadStations = async (): Promise<StationGeofenceLike[]> => {
      const rows = await base44.asServiceRole.entities.Station.filter({ companyId: auth.companyId });
      return (Array.isArray(rows) ? rows : []).filter(
        (s: { companyId?: string; stationId?: string }) =>
          s && s.companyId === auth.companyId && s.stationId,
      ).map((s: {
        stationId: string;
        name?: string;
        location?: string;
        lat?: number | null;
        lng?: number | null;
        radiusMeters?: number | null;
      }) => ({
        id: s.stationId,
        stationId: s.stationId,
        name: s.name || s.stationId,
        code: s.stationId,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        radiusMeters: s.radiusMeters ?? null,
      }));
    };

    const buildBoard = async (settings: SettingsPayload) => {
      const stations = await loadStations();
      const geofences = stations.map((s) => enrichGeofenceRow(s));
      const verification = deriveVerificationMode(settings.geofenceVerificationRequired);
      const companyRows = deriveCompanyRows(settings.record);
      // Same constants as complaints — read-only exposure, never a second source of truth.
      const rateLimits = exposeAnonymousRateLimits(DEFAULT_RATE_LIMITS);
      return {
        ok: true,
        record: settings.record,
        companyRows,
        geofences,
        verification,
        geofenceVerificationRequired: verification.geofenceVerificationRequired,
        rateLimits,
        colorTheme: settings.colorTheme || null,
        geoTitleAr: "النطاق الجغرافي للفروع",
        geoTitleEn: "Station geofences",
        geoSubAr: "تسجيل الحضور وإثبات العمل يُقبلان داخل هذا النطاق فقط.",
        geoSubEn: "Check-in and work proof are accepted inside this radius only.",
      };
    };

    if (action === "list") {
      const settings = await loadPayload();
      return Response.json(await buildBoard(settings));
    }

    if (action === "seedDemo") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const settings = await loadPayload();
      const empty =
        !settings.record.commercialRegistration
        && !settings.record.vatNumber
        && !settings.record.qiwaEstablishment;
      if (empty) {
        settings.record = normalizeCompanyRecord({
          name: settings.record.name || "Gulf Station Operations Co.",
          commercialRegistration: "1010472819",
          vatNumber: "310472819300003",
          qiwaEstablishment: "7-1104829",
          allowedEmailDomain: "@gulfops.sa",
          activeUsers: 142,
          seatLimit: 200,
        });
        settings.geofenceVerificationRequired = true;
        await savePayload(settings);
        await audit("settings.seedDemo", "Seeded company settings demo record");
      }
      const stations = await loadStations();
      const GEO_SEED = [
        { lat: 27.0174, lng: 49.6225, radiusMeters: 220 },
        { lat: 27.0332, lng: 49.6601, radiusMeters: 260 },
        { lat: 24.0891, lng: 38.0637, radiusMeters: 300 },
        { lat: 22.7986, lng: 39.0347, radiusMeters: 180 },
        { lat: 20.6821, lng: 39.5443, radiusMeters: 240 },
        { lat: 26.4207, lng: 50.0888, radiusMeters: 200 },
      ];
      let i = 0;
      for (const st of stations) {
        if (st.lat == null || st.lng == null) {
          const seed = GEO_SEED[i % GEO_SEED.length];
          const rows = await base44.asServiceRole.entities.Station.filter({
            companyId: auth.companyId,
            stationId: st.stationId,
          });
          if (rows[0]) {
            await base44.asServiceRole.entities.Station.update(rows[0].id, {
              lat: seed.lat,
              lng: seed.lng,
              radiusMeters: seed.radiusMeters,
            });
          }
        }
        i += 1;
      }
      return Response.json(await buildBoard(await loadPayload()));
    }

    if (action === "updateCompanyRecord") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const settings = await loadPayload();
      const next = {
        ...settings.record,
        name: body.name != null ? body.name : settings.record.name,
        commercialRegistration: body.commercialRegistration != null
          ? body.commercialRegistration
          : settings.record.commercialRegistration,
        vatNumber: body.vatNumber != null ? body.vatNumber : settings.record.vatNumber,
        qiwaEstablishment: body.qiwaEstablishment != null
          ? body.qiwaEstablishment
          : settings.record.qiwaEstablishment,
        allowedEmailDomain: body.allowedEmailDomain != null
          ? body.allowedEmailDomain
          : settings.record.allowedEmailDomain,
        activeUsers: body.activeUsers != null ? body.activeUsers : settings.record.activeUsers,
        seatLimit: body.seatLimit != null ? body.seatLimit : settings.record.seatLimit,
      };
      const gate = checkCompanyRecordGate(next);
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: 400 });
      }
      settings.record = gate.record as CompanyRecord;
      await savePayload(settings);
      await audit("settings.updateCompanyRecord", "Updated company record", {
        newValue: settings.record.commercialRegistration,
      });
      return Response.json(await buildBoard(settings));
    }

    if (action === "updateGeofence") {
      if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
      const stationId = String(body.stationId || "").trim();
      if (!stationId) {
        return Response.json({
          error: "STATION_REQUIRED",
          reason: "معرّف الفرع مطلوب.",
          reasonEn: "Station id is required.",
        }, { status: 400 });
      }
      const gate = checkGeofenceConfigGate({
        lat: body.lat,
        lng: body.lng,
        radiusMeters: body.radiusMeters,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
        }, { status: 400 });
      }
      const rows = await base44.asServiceRole.entities.Station.filter({
        companyId: auth.companyId,
        stationId,
      });
      if (!rows[0]) {
        return Response.json({
          error: "STATION_NOT_FOUND",
          reason: "الفرع غير موجودة في نطاق الشركة.",
          reasonEn: "Station not found in this company.",
        }, { status: 404 });
      }
      await base44.asServiceRole.entities.Station.update(rows[0].id, {
        lat: gate.lat,
        lng: gate.lng,
        radiusMeters: gate.radiusMeters,
      });
      await audit("settings.updateGeofence", `Updated geofence for ${stationId}`, {
        newValue: `${gate.lat},${gate.lng},${gate.radiusMeters}`,
      });
      const settings = await loadPayload();
      return Response.json(await buildBoard(settings));
    }

    if (action === "setGeofenceVerification") {
      if (!isOwner) {
        return Response.json({
          error: "OWNER_ONLY",
          reason: "اشتراط التحقق بالموقع قرار لمالك الحساب وحده.",
          reasonEn: "Geofence verification requirement is the account owner's decision alone.",
        }, { status: 403 });
      }
      const settings = await loadPayload();
      const next = body.enabled !== false && body.enabled !== "false" && body.enabled !== 0;
      const prev = settings.geofenceVerificationRequired;
      settings.geofenceVerificationRequired = !!next;
      await savePayload(settings);
      const verification = deriveVerificationMode(settings.geofenceVerificationRequired);
      await audit(
        "settings.setGeofenceVerification",
        verification.geofenceVerificationRequired
          ? "Geofence verification requirement turned on"
          : "Geofence verification requirement turned off — check-in is now manual",
        { oldValue: String(prev), newValue: String(next) },
      );
      return Response.json(await buildBoard(settings));
    }

    if (action === "verifyLocation") {
      const settings = await loadPayload();
      const stationId = String(body.stationId || "").trim();
      let station: StationGeofenceLike | null = null;
      if (stationId) {
        const stations = await loadStations();
        station = stations.find((s) => s.stationId === stationId) || null;
        if (!station) {
          return Response.json({
            error: "STATION_NOT_FOUND",
            reason: "الفرع غير موجودة في نطاق الشركة.",
            reasonEn: "Station not found in this company.",
          }, { status: 404 });
        }
      }
      const gate = checkLocationAgainstGeofence({
        geofenceVerificationRequired: settings.geofenceVerificationRequired,
        station,
        lat: body.lat,
        lng: body.lng,
        requireCoordsWhenOn: body.requireCoordsWhenOn !== false,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          verificationMode: gate.verificationMode,
          verdict: gate.verdict || null,
          // Privacy: do not echo submitted coordinates back.
          distanceMeters: gate.distanceMeters ?? null,
          radiusMeters: gate.radiusMeters ?? null,
        }, { status: gate.error === "OUTSIDE_GEOFENCE" ? 409 : 400 });
      }
      return Response.json({
        ok: true,
        verdict: gate.verdict,
        verificationMode: gate.verificationMode,
        checkInIsProof: gate.checkInIsProof,
        distanceMeters: gate.distanceMeters ?? null,
        discardedCoords: true,
      });
    }

    if (action === "getColorTheme") {
      const settings = await loadPayload();
      return Response.json({ ok: true, colorTheme: settings.colorTheme || null });
    }

    if (action === "setColorTheme") {
      const canTheme = auth.owner || auth.admin || ["owner", "director", "ops_manager"].includes(String(auth.role || ""));
      if (!canTheme) {
        return Response.json({
          error: "FORBIDDEN",
          reason: "تغيير ألوان المنصة لمالك الشركة أو المدير أو العمليات.",
          reasonEn: "Platform colors can be changed by the owner, director, or operations.",
        }, { status: 403 });
      }
      const next = normalizeColorTheme(body.colorTheme);
      if (!next) {
        return Response.json({
          error: "INVALID_THEME",
          reason: "اختر لوحة رسمية أو لونين بصيغة #RRGGBB.",
          reasonEn: "Choose an official palette or two #RRGGBB colors.",
        }, { status: 400 });
      }
      const settings = await loadPayload();
      settings.colorTheme = next;
      await savePayload(settings);
      await audit("settings.setColorTheme", `Updated platform color theme to ${next.id}`, {
        newValue: `${next.navy},${next.accent}`,
      });
      return Response.json({ ok: true, colorTheme: next });
    }

    if (action === "getReportBranding") {
      const settings = await loadPayload();
      return Response.json({ ok: true, reportBranding: settings.reportBranding || null });
    }

    if (action === "setReportBranding") {
      const canBrand = auth.owner || auth.admin || ["owner", "director", "ops_manager"].includes(String(auth.role || ""));
      if (!canBrand) {
        return Response.json({
          error: "FORBIDDEN",
          reason: "شعار التقارير لمالك الشركة أو المدير أو العمليات.",
          reasonEn: "Report branding can be changed by the owner, director, or operations.",
        }, { status: 403 });
      }
      const next = normalizeReportBranding(body.reportBranding);
      if (!next) {
        return Response.json({
          error: "INVALID_BRANDING",
          reason: "ارفع شعارًا أو لونًا بصيغة #RRGGBB.",
          reasonEn: "Upload a mark or a #RRGGBB color.",
        }, { status: 400 });
      }
      const settings = await loadPayload();
      settings.reportBranding = next;
      await savePayload(settings);
      await audit("settings.setReportBranding", "Updated report letterhead", {
        newValue: next.color,
      });
      return Response.json({ ok: true, reportBranding: next });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 500 });
  }
});
